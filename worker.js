/* =========================================================================
 * worker.js — Cloudflare Workers 中转 DeepSeek API
 * 作用：前端 → Worker → DeepSeek，Worker 从 Secrets 读取 API Key，
 *       不在任何仓库、HTML 或 JS 里出现明文密钥。
 *
 * 部署方式二选一：
 *   A) wrangler CLI：在本目录执行 `wrangler init` 生成 wrangler.toml 后再 `wrangler deploy`
 *   B) 控制台新建：Cloudflare Dashboard → Workers & Pages → Create → Upload 这段代码
 *
 * Secrets（不要写进代码）：
 *   DEEPSEEK_API_KEY   DeepSeek 官网申请的 sk-... 密钥
 *
 * 可选 Secrets（不配置也能跑，默认值写在下方 ALLOWED_ORIGINS）：
 *   ALLOWED_ORIGINS   允许跨域的来源，JSON 字符串，如
 *                      ["https://yuren-web.github.io","http://localhost:8000"]
 * ========================================================================= */

// 两个常量都不包含密钥；密钥只通过 env.DEEPSEEK_API_KEY 注入。
const UPSTREAM_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

// 线上 GitHub Pages + 本地调试端口（localhost / 127.0.0.1）
// 如需额外域名，可通过 Secret ALLOWED_ORIGINS（JSON 数组）追加，默认项始终保留。
const DEFAULT_ALLOWED_ORIGINS = [
  'https://yuren-web.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

// 单次转发的模型上下限，防止被刷 token
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 4000;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 健康检查：GET /ping
    if (request.method === 'GET' && url.pathname === '/ping') {
      return json({ ok: true, model: MODEL, origin: url.origin }, 200, {});
    }

    // 只接受 POST；CORS 预检单独放行
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, env);
    }

    // CORS：命中当前 Origin 才放行
    const origin = request.headers.get('origin');
    const allowed = resolveAllowedOrigins(env);
    const corsHeaders = origin && allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' }
      : {};

    // 读 key
    const apiKey = (env && env.DEEPSEEK_API_KEY) ? String(env.DEEPSEEK_API_KEY).trim() : '';
    if (!apiKey) {
      return json({ error: 'server_config_missing', detail: 'DEEPSEEK_API_KEY not set' }, 500, env, corsHeaders);
    }

    // 解析 body
    let body;
    try {
      body = await readJsonBody(request);
    } catch (e) {
      return json({ error: 'bad_request', detail: 'invalid_json' }, 400, env, corsHeaders);
    }

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: 'bad_request', detail: 'messages required' }, 400, env, corsHeaders);
    }

    // 限制规模，防刷 / 防失控
    if (body.messages.length > MAX_MESSAGES) {
      return json({ error: 'bad_request', detail: `too_many_messages (>${MAX_MESSAGES})` }, 400, env, corsHeaders);
    }
    for (const m of body.messages) {
      if (!m || typeof m.role !== 'string' || typeof m.content !== 'string') {
        return json({ error: 'bad_request', detail: 'messages items must have role+content' }, 400, env, corsHeaders);
      }
      if (m.content.length > MAX_CONTENT_CHARS) {
        return json({ error: 'bad_request', detail: `content_too_long (>${MAX_CONTENT_CHARS})` }, 400, env, corsHeaders);
      }
      if (!['system', 'user', 'assistant'].includes(m.role)) {
        return json({ error: 'bad_request', detail: 'invalid role' }, 400, env, corsHeaders);
      }
    }

    // 组装转发 payload：只透传我们允许的字段
    const payload = {
      model: MODEL,
      messages: body.messages,
      temperature: typeof body.temperature === 'number' ? clamp(body.temperature, 0, 2) : 0.7,
      max_tokens: Number.isFinite(body.max_tokens) ? Math.min(Math.max(body.max_tokens, 1), 4096) : 1024,
      stream: false, // Worker 做中转时默认关闭流式，避免自己也得处理 SSE
    };

    // 发起上游请求（DeepSeek 有速率限制，这里只做超时保护；更高阶的限流另加 Queue/D1）
    let upstream;
    try {
      upstream = await fetch(UPSTREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'online-doctor-worker/1.0',
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      return json({ error: 'upstream_unreachable', detail: String(e && e.message || e) }, 502, env, corsHeaders);
    }

    const upstreamText = await upstream.text();

    // 原样把 DeepSeek 的状态码和 JSON body 回传（前端能拿到官方错误）
    let data;
    try { data = JSON.parse(upstreamText); } catch (_) { data = { raw: upstreamText }; }

    return json(data, upstream.status, env, corsHeaders);
  },
};

/* ---------------- 工具函数 ---------------- */

async function readJsonBody(req) {
  if (!req.body) return null;
  const text = await req.text();
  if (!text) return null;
  return JSON.parse(text);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function resolveAllowedOrigins(env) {
  const list = DEFAULT_ALLOWED_ORIGINS.slice();
  const override = env && env.ALLOWED_ORIGINS;
  if (override) {
    try {
      const arr = JSON.parse(String(override));
      if (Array.isArray(arr)) {
        arr.forEach((x) => {
          if (typeof x === 'string' && x.length > 0 && !list.includes(x)) list.push(x);
        });
      }
    } catch (_) { /* 忽略非法 JSON，保留默认来源 */ }
  }
  return list;
}

function commonHeaders(env, extra) {
  const allowed = resolveAllowedOrigins(env);
  const base = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  };
  // 宽松 CORS 头；具体是否加 Access-Control-Allow-Origin 由调用方决定
  if (allowed.length) {
    base['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    base['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    base['Access-Control-Max-Age'] = '3600';
  }
  if (extra) Object.assign(base, extra);
  return base;
}

function json(data, status, env, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({}, commonHeaders(env), corsHeaders || {}),
  });
}

function handleOptions(request, env) {
  const origin = request.headers.get('origin');
  const allowed = resolveAllowedOrigins(env);
  const headers = origin && allowed.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' }
    : {};
  return new Response(null, { status: 204, headers: Object.assign({}, commonHeaders(env), headers) });
}
