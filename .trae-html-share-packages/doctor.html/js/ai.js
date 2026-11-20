/* =========================================================
 * ai.js
 * 处理组专属的 AI 助理：悬浮入口 + 预设问答
 * ---------------------------------------------------------
 * 仅当 window.OD.group === 'treatment' 且当前页为医生主页时渲染
 * ========================================================= */
(function () {
  'use strict';

  var OD = window.OD;
  if (!OD || OD.group !== 'treatment') return;
  if (document.body.getAttribute('data-page') !== 'doctor') return;
  if (document.getElementById('ai-root')) return;

  var DOCTOR_NAME = '张明远';

  var GREETING = '您好，我是' + DOCTOR_NAME + '医生的 AI 助理。您可以问我医生擅长哪些疾病、问诊费用、就诊流程等常见问题。\n\n我的回答基于医生公开资料与常见问题整理，仅供参考，不能替代医生的诊断和处方。';

  var FALLBACK = '这个问题我暂时没有足够的信息来回答。您可以换一种问法，或者直接向' + DOCTOR_NAME + '医生本人提问（图文问诊 88 元/次，48 小时内不限次沟通）。\n\n如果出现持续胸痛、呼吸困难、晕厥等情况，请立即拨打 120 或前往线下急诊。';

  /* 预设问答库：keys 为关键词，q 为快捷问题，a 为回答 */
  var KB = [
    {
      id: 'severity',
      keys: ['严重', '危险', '要紧', '担心', '会不会'],
      q: '这个病严重吗？',
      a: '病情是否严重，需要结合具体诊断、血压血脂等指标水平，以及是否合并其他疾病来判断，仅凭文字描述无法下定论。\n\n' + DOCTOR_NAME + '医生擅长高血压、冠心病、心律失常等疾病的长期管理。如果只是体检指标偏高或偶发心慌，可以带上近期检查报告在线问诊评估；如果出现持续胸痛、呼吸困难、晕厥，或血压超过 180/110 mmHg 并伴明显不适，请立即线下急诊。'
    },
    {
      id: 'medicine',
      keys: ['吃什么药', '用药', '药物', '吃药', '处方', '降压药', '他汀', '副作用'],
      q: '需要吃什么药？',
      a: '用药需要医生根据您的年龄、肝肾功能、合并疾病以及正在服用的药物来确定，AI 不能开具或推荐具体处方。\n\n' + DOCTOR_NAME + '医生在图文问诊中可以根据您上传的检查单和病史给出用药建议，必要时开具电子处方。请不要自行加减药量，也不要参照他人的用药经验自行购药。'
    },
    {
      id: 'tests',
      keys: ['检查', '化验', '心电图', '彩超', '抽血', 'CT', '造影'],
      q: '需要做哪些检查？',
      a: '心血管常见的基础检查包括：血压监测、血常规、血脂、血糖、肝肾功能、心电图；必要时做心脏彩超、动态心电图（Holter）或冠脉 CTA。\n\n具体项目要结合症状由医生判断。您可以把已有的检查报告拍照上传，医生会告诉您还缺哪些项目，尽量避免重复检查。'
    },
    {
      id: 'price',
      keys: ['多少钱', '价格', '费用', '收费', '贵不贵', '挂号费', '医保'],
      q: '问诊怎么收费？',
      a: DOCTOR_NAME + '医生的图文问诊为 88 元/次，48 小时内不限次数沟通；电话问诊为 199 元/15 分钟。\n\n问诊费用不包含检查、药品和线下挂号费用。若医生判断需要线下就诊，会告知您挂号的科室和需要携带的资料。'
    },
    {
      id: 'expertise',
      keys: ['擅长', '看什么病', '主治', '专业', '专长'],
      q: '医生擅长哪些疾病？',
      a: DOCTOR_NAME + '医生是心血管内科主任医师、教授，擅长高血压（尤其是难治性高血压）、冠心病、心律失常、心力衰竭和高脂血症的诊断与长期管理，同时长期开展心血管疾病的一级预防与随访。'
    },
    {
      id: 'lifestyle',
      keys: ['注意', '饮食', '运动', '生活', '忌口', '盐', '熬夜', '戒烟', '喝酒'],
      q: '平时生活要注意什么？',
      a: '心血管疾病日常管理通常包括：每天食盐控制在 5 克以内，戒烟限酒，每周至少 150 分钟中等强度有氧运动（如快走），保持规律作息和情绪稳定，并坚持家庭自测血压并记录。\n\n具体的血压、血脂、体重目标值需要医生结合您的情况设定。'
    },
    {
      id: 'duration',
      keys: ['多久', '多长时间', '能好', '康复', '疗程', '治愈'],
      q: '大概多久能好？',
      a: '高血压、冠心病等多属于需要长期管理的慢性疾病，治疗目标通常是“控制达标、减少发作”，而不是短期治愈。\n\n多数人在规范用药和调整生活方式后 2 到 4 周内指标会趋于稳定，但用药方案需要按医嘱复诊调整。具体疗程请以医生面诊意见为准。'
    },
    {
      id: 'process',
      keys: ['怎么问诊', '流程', '怎么用', '如何问诊', '上传', '预约', '回复时间'],
      q: '问诊流程是怎样的？',
      a: '在医生主页选择图文问诊或电话问诊，提交病情描述和检查资料后，医生通常会在 24 小时内回复（工作时间更快）。\n\n图文问诊 48 小时内可以不限次数追问。如果病情紧急或症状加重，请直接到线下急诊，不要等待线上回复。'
    },
    {
      id: 'emergency',
      keys: ['胸痛', '呼吸困难', '晕倒', '急救', '120', '心梗', '胸闷'],
      q: '出现胸痛怎么办？',
      a: '如果出现压榨样胸痛持续超过 15 分钟，并伴有大汗、恶心、呼吸困难，或疼痛放射到左肩、下颌，请立即拨打 120，不要自行驾车，也不要等待在线回复。\n\n如果症状短暂且已经缓解，也建议尽快到线下心内科就诊评估。'
    }
  ];

  var QUICK_QUESTIONS = ['severity', 'medicine', 'tests', 'price', 'lifestyle', 'process'];

  /* ---------------- 构建界面 ---------------- */

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
          '<strong>' + DOCTOR_NAME + '医生的 AI 助理</strong>',
          '<span>基于公开资料与常见问题生成 · 仅供参考</span>',
        '</div>',
        '<button type="button" class="ai-close" id="ai-close" aria-label="关闭 AI 助理">×</button>',
      '</header>',
      '<div class="ai-body" id="ai-body" role="log" aria-live="polite"></div>',
      '<div class="ai-quick" id="ai-quick"></div>',
      '<form class="ai-inputbar" id="ai-form">',
        '<input id="ai-input" type="text" autocomplete="off" maxlength="120" placeholder="输入您的问题，如：需要吃什么药？" aria-label="输入问题">',
        '<button type="submit" class="ai-send">发送</button>',
      '</form>',
      '<p class="ai-disclaimer">AI 回答由预设内容生成，不构成医疗建议；急症请立即线下就医或拨打 120。</p>',
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

  /* ---------------- 渲染快捷问题 ---------------- */

  QUICK_QUESTIONS.forEach(function (id) {
    var item = KB.filter(function (k) { return k.id === id; })[0];
    if (!item) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = item.q;
    btn.addEventListener('click', function () {
      ask(item.q, 'quick', item.id);
    });
    quick.appendChild(btn);
  });

  /* ---------------- 消息 ---------------- */

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

  function matchAnswer(text) {
    var lower = String(text || '').toLowerCase();
    for (var i = 0; i < KB.length; i++) {
      var item = KB[i];
      for (var j = 0; j < item.keys.length; j++) {
        if (lower.indexOf(item.keys[j].toLowerCase()) !== -1) return item;
      }
    }
    return null;
  }

  function ask(text, source, presetIntent) {
    var question = String(text || '').trim();
    if (!question) return;

    addMessage('user', question);
    OD.aiLog('user', question, presetIntent || '', source);

    var typing = showTyping();
    var delay = 650 + Math.min(650, question.length * 25);

    window.setTimeout(function () {
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      var hit = matchAnswer(question);
      var answer = hit ? hit.a : FALLBACK;
      addMessage('assistant', answer);
      OD.aiLog('assistant', answer, hit ? hit.id : 'fallback', source);
    }, delay);
  }

  /* ---------------- 开合面板 ---------------- */

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

  fab.addEventListener('click', function () {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  });

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

  /* ---------------- 首次进入的轻提示 ---------------- */

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
