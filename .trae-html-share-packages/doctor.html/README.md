# 在线问诊 AI 助理实验平台

一个可直接运行的在线问诊实验页面，风格参照好大夫在线。用于比较「有 / 无 AI 助理」对患者问诊决策的影响：处理组展示 AI 助理悬浮入口，对照组不展示，仅能基于页面既有信息决策。

纯静态实现，无外部依赖、无后端，可直接双击打开或部署到任意静态托管平台。

## 目录结构

```
online_doctor/
├── index.html              # 入口：医生列表页（分组判断 + 被试 ID 生成）
├── doctor.html             # 医生主页：简介、擅长、评价、问诊价格、AI 入口（仅处理组）
├── css/
│   └── style.css           # 全部样式（含响应式与 AI 悬浮窗）
├── js/
│   ├── main.js             # 分组逻辑、行为埋点、停留时长、数据导出、见数跳转
│   └── ai.js               # AI 助理：悬浮入口 + 预设问答（仅处理组渲染）
├── data/
│   └── doctor-info.json    # 医生与评价数据（页面数据镜像，便于后续接后端）
└── README.md
```

> 页面内容为静态 HTML 渲染，`data/doctor-info.json` 是同一份数据的结构化副本，方便后续接入接口或做数据分析。修改医生信息时，请同步修改 `doctor.html`、`index.html` 与 JSON。

## 快速开始

方式一：直接双击 `index.html` 用浏览器打开（无需服务器）。

方式二：本地启动静态服务器（推荐，行为更接近线上）：

```bash
# 在项目根目录执行
python -m http.server 8000
# 浏览器打开 http://localhost:8000/index.html
```

## 实验分组

分组通过 URL 参数控制：

| 场景 | 链接 |
| --- | --- |
| 处理组（展示 AI 助理） | `index.html?group=treatment&subject_id=S001` |
| 对照组（无 AI 助理） | `index.html?group=control&subject_id=S001` |
| 未指定分组 | 自动随机（默认各 50%），并把结果与 `subject_id` 写回地址栏 |

分组优先级（从高到低）：

1. URL 中的 `group=treatment|control`
2. `js/main.js` 中的 `CONFIG.forceGroup`（本地调试用，默认 `null`）
3. 当前浏览器会话中该被试已确定的分组
4. 该 `subject_id` 在 localStorage 中记录过的分组
5. 按 `CONFIG.treatmentRatio` 随机分配

刷新页面、从列表页进入医生主页时，分组与被试 ID 都会自动带上（内部链接由 `main.js` 自动补参数），不会中途改变。

### 被试 ID

- 优先读取 URL 参数 `subject_id`（也兼容 `sid`、`pid`）
- 没有参数时创建随机 ID（形如 `S20261119153012A1B2`），保存在 `sessionStorage`
- 正式实验建议由见数问卷或实验员为每位被试传入唯一 `subject_id`，避免同一台电脑多被试数据混在一起

## 数据记录

所有数据保存在浏览器 `localStorage`，键名为 `od_records_v1`，按 `subject_id` 分组存储。每次操作都会即时写入。

记录的字段：

| 字段 | 说明 |
| --- | --- |
| `subject_id` | 被试 ID |
| `group` | 组别：`treatment` / `control` |
| `created_at` / `updated_at` | 首次进入 / 最近更新时间 |
| `page_views` | 各页面访问次数与累计停留时长（`index`、`doctor`） |
| `events` | 行为事件流（页面浏览、点击、AI 交互、决策等，含相对时间 `t_ms`） |
| `info_clicks` | 关键信息区域点击明细（擅长、简介、价格、评价、医生卡片等） |
| `ai.clicked` | 是否点击过 AI 助理 |
| `ai.click_count` / `open_count` | 点击次数 / 打开次数 |
| `ai.first_open_at` | 首次打开时间 |
| `ai.messages` | 完整对话记录（角色、内容、意图、来源、时间） |
| `decision.completed` | 是否完成问诊决策 |
| `decision.choice` | 选择的问诊方式（图文 / 电话） |
| `decision.time_to_decision_ms` | 从首次进入到完成决策的时长 |
| `survey.redirected` | 是否已跳转见数问卷 |

关键信息区域的点击通过 HTML 上的 `data-track="..."` 标记自动采集，例如：

```html
<section data-track="reviews" data-track-label="问诊评价区"> ... </section>
<div data-track="price" data-track-label="问诊价格卡片"> ... </div>
```

如需增加埋点区域，给它加上 `data-track` 属性即可，无需改 JS。

### 导出数据

页面右下角页脚的「实验数据导出」会下载 JSON 文件，内容为当前浏览器中**所有被试**的记录，并附带每条记录的总停留时长 `total_dwell_ms`。建议每位被试实验结束后立即导出，或实验全部结束后由实验员统一导出。

清空本机数据（换下一批被试前）：

```js
// 浏览器控制台执行
localStorage.removeItem('od_records_v1');
sessionStorage.removeItem('od_ctx_v1');
```

## 见数（Credamo）对接

在 `js/main.js` 顶部修改问卷地址：

```js
var CONFIG = {
  credamoUrl: 'https://www.credamo.com/xxx', // 替换为真实问卷链接
  treatmentRatio: 0.5,
  forceGroup: null
};
```

被试在弹窗中提交问诊方式后，会记录决策并跳转到该地址，自动携带参数：

| 参数 | 说明 |
| --- | --- |
| `subject_id` | 被试 ID（与页面记录一一对应） |
| `group` | `treatment` / `control` |
| `ai_used` | 是否使用过 AI 助理：`1` / `0` |
| `decision` | 是否完成决策：`1` / `0` |
| `time_to_decision_ms` | 决策耗时（毫秒） |
| `dwell_ms` | 总停留时长（毫秒） |

示例：

```
https://www.credamo.com/xxx?subject_id=S001&group=treatment&ai_used=1&decision=1&time_to_decision_ms=96320&dwell_ms=180430
```

未配置链接时，页面会提示「问卷链接尚未配置」，并在弹窗内展示完成状态，不会跳转到无效地址。

## 部署

项目为纯静态文件，无需构建：

- **Vercel / Netlify**：新建项目，直接导入本目录，Framework 选择 Other，Build Command 留空，Output Directory 填 `.`
- **GitHub Pages**：把文件推到仓库，Settings → Pages 选择分支根目录
- **任意服务器**：将整个目录上传到 Nginx / Apache 的静态目录即可

部署后给被试的链接形如：

```
https://your-domain.com/index.html?group=treatment&subject_id=S001
```

建议实验前为处理组、对照组各准备一条链接，或在见数问卷中按分组跳转。

## 自定义

- **医生信息 / 评价**：直接修改 `doctor.html` 中对应用户可见文本（列表页同步修改 `index.html`），并更新 `data/doctor-info.json`
- **AI 预设问答**：修改 `js/ai.js` 中的 `KB` 数组；每项包含 `keys`（关键词）、`q`（快捷问题）、`a`（回答），新增条目会自动参与关键词匹配
- **AI 快捷问题**：调整 `js/ai.js` 中的 `QUICK_QUESTIONS`（填写 `KB` 的 `id`）
- **配色**：修改 `css/style.css` 顶部 `:root` 中的 CSS 变量
- **分组比例**：修改 `CONFIG.treatmentRatio`（例如 `0.5` 表示各半）

## 说明

- 页面无任何外部资源请求（头像为内联 SVG，图标使用 Unicode 字符），断网也可正常使用
- 建议使用 Chrome / Edge 最新版；移动端已做响应式适配
- 本平台为学术研究模拟环境，医生信息、价格、评价均为虚构，不构成医疗建议；如需在正式实验中隐藏页脚的研究说明，可删除两处 `.footer-note` 与弹窗底部提示
