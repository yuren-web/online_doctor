/* =========================================================
 * ai.js
 * 处理组（treatment）专属 AI 助理：本地硬编码状态机
 * ---------------------------------------------------------
 * 实验约束：
 *   - 已彻底停用 DeepSeek / 任何外部大模型调用，全程零 fetch
 *   - 用户零打字：输入框与发送按钮隐藏，只能点击底部预设标签
 *   - 处理组内部按开场选择分为 A / B / C 三条对话路径
 *   - 对照组不加载本文件的状态机，也不渲染任何 AI 入口
 *
 * 医生公开数据（硬编码，不得改动）：
 *   张明远，心血管内科，主任医师/教授/博导，
 *   仁和大学附属第一医院（三甲），
 *   4.9 分（326 条评价），近一年 1280 人次，
 *   回复率 98%，平均回复 15 分钟，接诊 2.3 万，好评 98%
 * ========================================================= */
(function () {
  'use strict';

  var OD = window.OD;
  if (!OD) return;

  var urlGroup = (new URLSearchParams(window.location.search).get('group') || '').trim().toLowerCase();
  if (urlGroup === 'control') return;
  if (urlGroup !== 'treatment' && OD.group !== 'treatment') return;

  if (document.body.getAttribute('data-page') !== 'doctor') return;
  if (document.getElementById('ai-root')) return;

  var DISCLAIMER = '以上为健康科普，不能替代医生面诊，急症请拨打120。预约请以医院官方挂号为准。';

  var GREETING = '您好，我是仁心在线心血管健康AI助理。请问您最近有什么不舒服？请选择下方标签，我会逐步了解您的情况。';

  var OPENING_CHOICES = [
    { path: 'A', label: '我最近血压偏高，偶尔头晕，想了解原因', start: 'A2' },
    { path: 'B', label: '我最近血压偏高，有点担心风险和服务', start: 'B2' },
    { path: 'C', label: '我体检发现血压偏高，想找医生咨询，也有些顾虑', start: 'C2' }
  ];

  var SERVICE_LINE = '这位医生目前的患者综合评分是4.9分（满分5分），共有326条患者评价。近一年在线咨询量为1,280人次，咨询回复率为98%，平均回复时间约15分钟。';

  /* ========== 1. 状态机剧本（严格对齐导师 A/B/C 话术） ========== */
  var SCRIPT = {
    A: {
      A2: {
        text: '您最近测量的血压大概是多少？',
        options: [
          { label: '大概150/95，持续一段时间了', next: 'A3' }
        ]
      },
      A3: {
        text: '多次测量出现这样的数值，建议您关注血压变化。长期血压偏高可能增加心脏、脑血管和肾脏负担，建议咨询心血管内科医生。',
        options: [
          { label: '那我这种情况严重吗？需要吃药吗？', next: 'A4' },
          { label: '这位医生能看高血压吗？', next: 'A5' }
        ]
      },
      A4: {
        text: '是否需要服药，需要医生结合您的血压记录和其他健康情况综合判断，建议不要自行用药。',
        options: [
          { label: '这位医生能看高血压吗？', next: 'A5' }
        ]
      },
      A5: {
        text: '可以。这位医生的专业方向是心血管内科，诊疗范围包括高血压等相关疾病。',
        options: [
          { label: '他平时服务怎么样？', next: 'A6' }
        ]
      },
      A6: {
        text: SERVICE_LINE,
        options: [
          { label: '好的，我再看看他的详细资料，考虑一下', next: 'END_A' }
        ]
      },
      END_A: {
        text: '好的，您可以结合医生的专业背景和主页上的服务信息进行了解。',
        end: true
      }
    },

    B: {
      B2: {
        text: '您测量的血压大概是多少？',
        options: [
          { label: '大概150/95，最近一周测了好几次', next: 'B3' }
        ]
      },
      B3: {
        text: '多次测量出现这样的数值，建议进一步咨询医生。长期血压偏高可能增加心脑血管疾病风险，即使没有明显不适也需要关注。',
        options: [
          { label: '我平时没什么明显不舒服，是不是可以先不管？', next: 'B4' },
          { label: '线上咨询能及时回复吗？', next: 'B5' }
        ]
      },
      B4: {
        text: '不建议因为没有明显症状就忽视血压偏高。您可以咨询心血管内科医生，评估是否需要进一步检查或干预。',
        options: [
          { label: '线上咨询能及时回复吗？', next: 'B5' },
          { label: '其他患者评价怎么样？', next: 'B6' }
        ]
      },
      B5: {
        text: '这位医生近一年在线咨询量为1,280人次，咨询回复率为98%，平均回复时间约15分钟。',
        options: [
          { label: '其他患者评价怎么样？', next: 'B6' }
        ]
      },
      B6: {
        text: '目前这位医生的患者综合评分是4.9分（满分5分），共有326条患者评价。您也可以查看具体评价内容，了解其他患者的实际服务体验。',
        options: [
          { label: '这个回复速度还可以，我想再看看具体患者评价', next: 'END_B' },
          { label: '返回问卷继续作答', action: 'back' }
        ]
      },
      END_B: {
        text: '好的，您可以在医生主页查看326条患者评价。',
        end: true
      }
    },

    C: {
      C2: {
        text: '您体检时测得的血压是多少？后来有再测量过吗？',
        options: [
          { label: '体检150/95，后来在家也测了几次，差不多都是这个数值', next: 'C3' }
        ]
      },
      C3: {
        text: '多次测量出现这样的数值，建议进一步评估。长期血压偏高可能增加心脑血管疾病风险，建议咨询心血管内科医生。',
        options: [
          { label: '这医生主要看什么疾病？', next: 'C4' },
          { label: '我还有点担心，医生会不会为了增加收入推荐不必要检查或治疗？', next: 'C5' }
        ]
      },
      C4: {
        text: '这位医生主要从事心血管内科相关疾病的诊疗，专业领域包括高血压，与您的问题比较相关。',
        options: [
          { label: '担心医生推荐不必要检查或治疗', next: 'C5' },
          { label: '他历史评价和服务记录怎么样？', next: 'C6' }
        ]
      },
      C5: {
        text: '仅凭医生主页的信息，无法判断具体诊疗建议是否必要。您可以查看医生的历史患者评价和服务记录，对于具体检查或治疗建议，也可以向医生提问相关依据。',
        options: [
          { label: '那他历史评价和服务记录怎么样？', next: 'C6' }
        ]
      },
      C6: {
        text: SERVICE_LINE + '这些数据可以帮助您了解医生过去的服务情况，但不能直接证明每项诊疗建议的合理性。',
        options: [
          { label: '好的，我明白了，我还是想再看看其他患者评价，再决定', next: 'END_C' },
          { label: '返回问卷继续作答', action: 'back' }
        ]
      },
      END_C: {
        text: '好的，您可以查看具体的患者评价，了解其他患者的实际服务体验。',
        end: true
      }
    }
  };

  /* ========== 2. 界面（沿用 ai-root / ai-fab / ai-panel / ai-body 等 id） ========== */
  var root = document.createElement('div');
  root.id = 'ai-root';
  root.innerHTML = [
    '<button type="button" class="ai-fab" id="ai-fab" aria-expanded="false" aria-controls="ai-panel">',
      '<span class="ai-fab-mark">AI</span>',
      '<span class="ai-fab-label">AI 助理<small>心血管健康科普</small></span>',
      '<span class="ai-fab-dot" aria-hidden="true"></span>',
    '</button>',
    '<section class="ai-panel" id="ai-panel" aria-hidden="true" aria-label="仁心在线 AI 助理对话窗口">',
      '<header class="ai-head">',
        '<div class="ai-head-avatar">AI</div>',
        '<div class="ai-head-text">',
          '<strong>仁心在线 AI 助理</strong>',
          '<span>心血管健康科普 · 本地预设对话</span>',
        '</div>',
        '<button type="button" class="ai-close" id="ai-close" aria-label="关闭 AI 助理">×</button>',
      '</header>',
      '<div class="ai-body" id="ai-body" role="log" aria-live="polite"></div>',
      '<div class="ai-quick" id="ai-quick" hidden></div>',
      '<form class="ai-inputbar" id="ai-form" hidden>',
        '<input id="ai-input" type="text" autocomplete="off" maxlength="120" placeholder="本实验为点选问答，无需输入" aria-label="输入问题">',
        '<button type="submit" class="ai-send">发送</button>',
      '</form>',
      '<p class="ai-disclaimer">' + DISCLAIMER + '</p>',
    '</section>'
  ].join('');

  document.body.appendChild(root);

  var fab = document.getElementById('ai-fab');
  var panel = document.getElementById('ai-panel');
  var closeBtn = document.getElementById('ai-close');
  var body = document.getElementById('ai-body');

  var isOpen = false;
  var greeted = false;
  var currentPath = null;
  var currentNodeId = '';
  var optionsWrap = null;

  /* ========== 3. 消息渲染（沿用既有气泡与 Markdown 样式） ========== */
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function addMessage(role, text) {
    var msg = document.createElement('div');
    msg.className = 'ai-msg ai-msg-' + role;
    var bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    if (role === 'assistant') {
      bubble.textContent = text;
    } else {
      bubble.textContent = text;
    }
    msg.appendChild(bubble);
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
    return msg;
  }

  function log(role, text, intent) {
    if (typeof OD.aiLog === 'function') OD.aiLog(role, text, intent || '', 'rct-static');
  }

  function removeOptions() {
    if (optionsWrap && optionsWrap.parentNode) {
      optionsWrap.parentNode.removeChild(optionsWrap);
    }
    optionsWrap = null;
  }

  function renderChoices(choices, onPick) {
    removeOptions();
    var wrap = document.createElement('div');
    wrap.className = 'ai-options';

    choices.forEach(function (choice) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-option';
      btn.textContent = choice.label;
      btn.addEventListener('click', function () {
        onPick(choice, wrap, btn);
      });
      wrap.appendChild(btn);
    });

    optionsWrap = wrap;
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  /* ========== 4. 状态机推进 ========== */
  function renderOpening() {
    body.innerHTML = '';
    addMessage('assistant', GREETING);
    log('assistant', GREETING, 'opening');

    renderChoices(OPENING_CHOICES, function (choice, wrap) {
      currentPath = choice.path;
      if (typeof OD.expPath === 'function') OD.expPath(choice.path);
      if (typeof OD.expTap === 'function') OD.expTap(choice.label, 'OPENING');

      wrap.parentNode.removeChild(wrap);
      optionsWrap = null;
      addMessage('user', choice.label);
      log('user', choice.label, 'path_' + choice.path);
      renderNode(choice.start);
    });
  }

  function renderNode(nodeId) {
    if (!currentPath) return;
    var nodes = SCRIPT[currentPath];
    var node = nodes && nodes[nodeId];
    if (!node) return;

    currentNodeId = nodeId;
    if (typeof OD.expNode === 'function') OD.expNode(nodeId);

    addMessage('assistant', node.text);
    log('assistant', node.text, nodeId);

    if (node.end) {
      renderEndActions();
      return;
    }

    renderChoices(node.options || [], function (choice, wrap) {
      if (choice.action === 'back') {
        if (typeof OD.expTap === 'function') OD.expTap(choice.label, nodeId);
        log('user', choice.label, nodeId);
        if (typeof OD.backToSurvey === 'function') OD.backToSurvey();
        return;
      }

      if (typeof OD.expTap === 'function') OD.expTap(choice.label, nodeId);
      wrap.parentNode.removeChild(wrap);
      optionsWrap = null;
      addMessage('user', choice.label);
      log('user', choice.label, nodeId);

      if (choice.next) renderNode(choice.next);
    });
  }

  function renderEndActions() {
    removeOptions();
    var wrap = document.createElement('div');
    wrap.className = 'ai-options ai-end-actions';

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'ai-option ai-option-primary';
    back.textContent = '返回问卷';
    back.addEventListener('click', function () {
      if (typeof OD.backToSurvey === 'function') OD.backToSurvey();
    });

    var browse = document.createElement('button');
    browse.type = 'button';
    browse.className = 'ai-option';
    browse.textContent = '继续浏览医生主页';
    browse.addEventListener('click', function () {
      if (typeof OD.markHomepageViewed === 'function') OD.markHomepageViewed();
      closePanel();
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        window.scrollTo(0, 0);
      }
    });

    wrap.appendChild(back);
    wrap.appendChild(browse);
    optionsWrap = wrap;
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  /* ========== 5. 面板开合 ========== */
  function openPanel() {
    if (isOpen) return;
    isOpen = true;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    fab.setAttribute('aria-expanded', 'true');

    if (typeof OD.aiOpen === 'function') OD.aiOpen();

    if (!greeted) {
      greeted = true;
      renderOpening();
    }
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    fab.setAttribute('aria-expanded', 'false');
    if (typeof OD.aiClose === 'function') OD.aiClose();
  }

  fab.addEventListener('click', function () {
    if (isOpen) closePanel();
    else openPanel();
  });
  closeBtn.addEventListener('click', closePanel);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  /* 输入框与发送按钮保持隐藏，仅保留 DOM 以便后续实验模式切换 */
  var form = document.getElementById('ai-form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
  });

  /* =========================================================
   * 已停用：旧版 DeepSeek / Cloudflare Worker 调用
   * 原实现（仅存档，不执行）：
   *   fetch('https://api.yuren-ai.xyz', {
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json' },
   *     body: JSON.stringify({ messages: [...] })
   *   })
   * 本实验全程零网络请求，所有回复来自上方 SCRIPT 硬编码状态机。
   * ========================================================= */
})();
