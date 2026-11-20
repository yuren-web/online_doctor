/* =========================================================
 * ai.js
 * 处理组专属的 AI 助理：悬浮入口 + 预设问答
 * ---------------------------------------------------------
 * 仅当 window.OD.group === 'treatment' 且当前页为医生主页时渲染
 * 另外做一层 URL 强制分组校验：
 *   ?group=control   一律不渲染
 *   ?group=treatment 一律渲染
 *
 * 回答逻辑：严格基于医生页面公开信息，不超纲、不编造。
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

  /* ========== 1. 页面医生信息库（严格受限，不超纲） ========== */
  var doctorInfo = {
    name: '张明远',
    dept: '心血管内科',
    title: '主任医师、教授',
    exp: '从医22年',
    hospital: '三级甲等医院',
    clinic: '周一上午、周三下午（专家门诊）',
    fees: {
      text: '图文问诊 88元/次（48小时内不限次沟通）',
      phone: '电话问诊 199元/15分钟'
    },
    note: '问诊费用不包含检查、药品和线下挂号；若需线下就诊，会告知挂号科室及携带资料。',
    scope: ['心脏不适', '胸闷', '心血管', '高血压', '心绞痛'],
    emergency: '若出现持续胸痛、呼吸困难、晕厥等情况，请立即拨打120或前往线下急诊。',
    disclaimer: 'AI回答由预设内容生成，仅供参考；急症请立即线下就医或拨打120。'
  };

  var GREETING = '您好，我是' + doctorInfo.name + '医生的 AI 助理。您可以问我心脏相关问题是否合适、问诊收费、需要做哪些检查、吃什么药、平时生活注意事项等。\n\n我的回答仅基于医生页面公开资料，不构成医疗建议。';

  /* ========== 2. 全量匹配逻辑（覆盖快捷按钮 + 自由提问） ========== */
  function getAIReply(rawInput) {
    var input = String(rawInput || '').toLowerCase().replace(/\s/g, '');

    // 【急诊兜底】最高优先级
    if (/持续胸痛|呼吸困难|晕厥|急救|120|快死了|撑不住/.test(input)) {
      return doctorInfo.emergency + '\n\n（' + doctorInfo.disclaimer + '）';
    }

    // 【快捷按钮1：吃什么药？】
    if (/吃什么药|用药|开药|药方|吃什么/.test(input)) {
      return '关于用药，' + doctorInfo.name + '医生（' + doctorInfo.dept + '）会在图文/电话问诊了解详情后指导。' + doctorInfo.fees.text + '。注意：费用不含药品，AI 不提供处方，请遵医嘱。\n\n（' + doctorInfo.disclaimer + '）';
    }

    // 【快捷按钮2：需要做哪些检查？】
    if (/做哪些检查|检查项目|体检|化验|心电图|抽血|彩超|ct|造影/.test(input)) {
      return '检查项目需' + doctorInfo.name + '医生（' + doctorInfo.dept + '）根据您的具体症状判断，问诊后会告知需线下做的检查及携带资料。' + doctorInfo.note + ' 建议先图文问诊：' + doctorInfo.fees.text + '。\n\n（' + doctorInfo.disclaimer + '）';
    }

    // 【快捷按钮3：问诊怎么收费？ / 费用】
    if (/收费|多少钱|费用|价格|问诊|图文|电话|挂号费|贵不贵|医保/.test(input)) {
      return doctorInfo.name + '医生问诊收费：①' + doctorInfo.fees.text + '；②' + doctorInfo.fees.phone + '。' + doctorInfo.note + ' 出诊：' + doctorInfo.clinic + '（' + doctorInfo.hospital + '）。\n\n（' + doctorInfo.disclaimer + '）';
    }

    // 【快捷按钮4：平时生活要注意？ / 日常注意】
    if (/生活注意|日常|保养|调理|饮食|运动|注意什么|作息|戒烟|限酒|低盐|低盐低脂/.test(input)) {
      return '心血管日常建议（仅供参考）：低盐低脂饮食、适度运动、规律作息、监测血压。具体需结合您情况，建议图文问诊（' + doctorInfo.fees.text + '）让' + doctorInfo.name + '医生（' + doctorInfo.dept + '，' + doctorInfo.exp + '）评估。\n\n（' + doctorInfo.disclaimer + '）';
    }

    // 【核心：合适吗 / 心脏不舒服 / 科室匹配】
    var isHeart = /心脏|心血管|胸闷|心慌|心绞痛|高血压|冠心病|心率|心律/.test(input);
    var askSuit = /合适吗|能看吗|挂这个科|看这个病|找他吗|能不能|可不可以|适合吗/.test(input);

    if (isHeart) {
      return '合适的。' + doctorInfo.name + '医生是' + doctorInfo.hospital + ' ' + doctorInfo.dept + ' ' + doctorInfo.title + '（' + doctorInfo.exp + '），擅长心血管相关问题。您可图文问诊：' + doctorInfo.fees.text + '；或电话：' + doctorInfo.fees.phone + '。出诊：' + doctorInfo.clinic + '。\n若持续胸痛/呼吸困难请立即急诊。\n\n（' + doctorInfo.disclaimer + '）';
    }
    if (askSuit) {
      return '张医生主攻' + doctorInfo.dept + '（' + doctorInfo.title + '，' + doctorInfo.exp + '），非心血管问题（如骨科/皮肤科）建议挂对应科室；若属心脏/心血管范畴则非常合适。' + doctorInfo.fees.text + '。\n\n（' + doctorInfo.disclaimer + '）';
    }

    // 【出诊时间 / 挂号】
    if (/出诊|挂号|上班|门诊时间|周几|什么时候上班/.test(input)) {
      return '张医生出诊时间：' + doctorInfo.clinic + '（专家门诊，' + doctorInfo.hospital + '）。问诊收费：' + doctorInfo.fees.text + '。若需线下就诊，问诊后会告知挂号科室及资料。\n\n（' + doctorInfo.disclaimer + '）';
    }

    // 【职称/资历】
    if (/职称|资历|经验|教授|主任|主任医师|博士生导师|多少年/.test(input)) {
      return doctorInfo.name + '医生：' + doctorInfo.title + '，' + doctorInfo.exp + '，执业于' + doctorInfo.hospital + ' ' + doctorInfo.dept + '。\n\n（' + doctorInfo.disclaimer + '）';
    }

    // 【兜底：只引导页面信息，不瞎编】
    return '我仅基于张明远医生页面信息回答：他是' + doctorInfo.hospital + doctorInfo.dept + doctorInfo.title + '（' + doctorInfo.exp + '），' + doctorInfo.fees.text + '。您可问："心脏不适合适吗 / 吃什么药 / 做哪些检查 / 收费多少 / 出诊时间 / 生活注意事项"。\n\n（' + doctorInfo.disclaimer + '）';
  }

  /* ========== 3. 原始意图提取（用于数据记录） ========== */
  function detectIntent(text) {
    var input = String(text || '').toLowerCase().replace(/\s/g, '');
    if (/持续胸痛|呼吸困难|晕厥|急救|120|快死了|撑不住/.test(input)) return 'emergency';
    if (/吃什么药|用药|开药|药方|吃什么/.test(input)) return 'medicine';
    if (/做哪些检查|检查项目|体检|化验|心电图|抽血|彩超|ct|造影/.test(input)) return 'tests';
    if (/收费|多少钱|费用|价格|问诊|图文|电话|挂号费|贵不贵|医保/.test(input)) return 'price';
    if (/生活注意|日常|保养|调理|饮食|运动|注意什么|作息|戒烟|限酒|低盐|低盐低脂/.test(input)) return 'lifestyle';
    var isHeart = /心脏|心血管|胸闷|心慌|心绞痛|高血压|冠心病|心率|心律/.test(input);
    var askSuit = /合适吗|能看吗|挂这个科|看这个病|找他吗|能不能|可不可以|适合吗/.test(input);
    if (isHeart || askSuit) return 'suitability';
    if (/出诊|挂号|上班|门诊时间|周几|什么时候上班/.test(input)) return 'schedule';
    if (/职称|资历|经验|教授|主任|主任医师|博士生导师|多少年/.test(input)) return 'qualification';
    return 'fallback';
  }

  /* ========== 4. 快捷按钮定义 ========== */
  var QUICK = [
    { id: 'medicine', q: '需要吃什么药？' },
    { id: 'tests', q: '需要做哪些检查？' },
    { id: 'price', q: '问诊怎么收费？' },
    { id: 'lifestyle', q: '平时生活要注意什么？' }
  ];

  /* ========== 5. 构建界面（沿用原 id：ai-root / ai-fab / ai-panel / ai-body / ai-quick / ai-form / ai-input） ========== */

  var root = document.createElement('div');
  root.id = 'ai-root';
  root.innerHTML = [
    '<button type="button" class="ai-fab" id="ai-fab" aria-expanded="false" aria-controls="ai-panel">',
      '<span class="ai-fab-mark">AI</span>',
      '<span class="ai-fab-label">AI 助理<small>问诊前先问一问</small></span>',
      '<span class="ai-fab-dot" aria-hidden="true"></span>',
    '</button>',
    '<section class="ai-panel" id="ai-panel" aria-hidden="true" aria-label="AI 助理对话窗口">',
      '<header class="ai-head">',
        '<div class="ai-head-avatar">AI</div>',
        '<div class="ai-head-text">',
          '<strong>' + doctorInfo.name + '医生的 AI 助理</strong>',
          '<span>基于医生页面公开资料 · 仅供参考</span>',
        '</div>',
        '<button type="button" class="ai-close" id="ai-close" aria-label="关闭 AI 助理">×</button>',
      '</header>',
      '<div class="ai-body" id="ai-body" role="log" aria-live="polite"></div>',
      '<div class="ai-quick" id="ai-quick"></div>',
      '<form class="ai-inputbar" id="ai-form">',
        '<input id="ai-input" type="text" autocomplete="off" maxlength="120" placeholder="输入您的问题，如：心脏不舒服找他合适吗？" aria-label="输入问题">',
        '<button type="submit" class="ai-send">发送</button>',
      '</form>',
      '<p class="ai-disclaimer">' + doctorInfo.disclaimer + '</p>',
    '</section>'
  ].join('');

  document.body.appendChild(root);

  var fab = document.getElementById('ai-fab');
  var panel = document.getElementById('ai-panel');
  var closeBtn = document.getElementById('ai-close');
  var body = document.getElementById('ai-body');
  var quick = document.getElementById('ai-quick');
  var form = document.getElementById('ai-form');
  var input = document.getElementById('ai-input');

  var isOpen = false;
  var greeted = false;

  /* 渲染快捷问题 */
  QUICK.forEach(function (item) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = item.q;
    btn.addEventListener('click', function () { ask(item.q, 'quick', item.id); });
    quick.appendChild(btn);
  });

  /* 消息渲染 */
  function addMessage(role, text) {
    var msg = document.createElement('div');
    msg.className = 'ai-msg ai-msg-' + role;
    var bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    bubble.textContent = text;
    msg.appendChild(bubble);
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function showTyping() {
    var msg = document.createElement('div');
    msg.className = 'ai-msg ai-msg-assistant ai-typing';
    msg.innerHTML = '<div class="ai-bubble"><span></span><span></span><span></span></div>';
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
    return msg;
  }

  function ask(text, source, presetIntent) {
    var question = String(text || '').trim();
    if (!question) return;

    addMessage('user', question);
    OD.aiLog('user', question, presetIntent || detectIntent(question), source);

    var typing = showTyping();
    var delay = 500 + Math.min(500, question.length * 20);

    window.setTimeout(function () {
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      var answer = getAIReply(question);
      var intent = presetIntent || detectIntent(question);
      addMessage('assistant', answer);
      OD.aiLog('assistant', answer, intent, source);
    }, delay);
  }

  /* 开合面板 */
  function openPanel() {
    if (isOpen) return;
    isOpen = true;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    fab.setAttribute('aria-expanded', 'true');

    OD.aiOpen();

    if (!greeted) {
      greeted = true;
      addMessage('assistant', GREETING);
      OD.aiLog('assistant', GREETING, 'greeting', 'auto');
    }

    window.setTimeout(function () {
      input.focus({ preventScroll: true });
    }, 220);
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    fab.setAttribute('aria-expanded', 'false');
    OD.aiClose();
  }

  fab.addEventListener('click', function () { isOpen ? closePanel() : openPanel(); });
  closeBtn.addEventListener('click', closePanel);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = input.value.trim();
    if (!value) return;
    input.value = '';
    ask(value, 'input');
  });

  /* 首次进入的轻提示 */
  window.setTimeout(function () {
    if (isOpen) return;
    var tip = document.createElement('div');
    tip.className = 'od-toast show';
    tip.textContent = '想先了解病情？可点击右下角「AI 助理」快速咨询';
    document.body.appendChild(tip);
    window.setTimeout(function () {
      tip.classList.remove('show');
      window.setTimeout(function () {
        if (tip.parentNode) tip.parentNode.removeChild(tip);
      }, 300);
    }, 4200);
  }, 6500);
})();
