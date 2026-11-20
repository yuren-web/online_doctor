/* =========================================================
 * main.js
 * 实验分组、行为数据记录、见数（Credamo）跳转
 * ---------------------------------------------------------
 * 对外暴露 window.OD，供 ai.js 与页面内联脚本调用
 * ========================================================= */
(function () {
  'use strict';

  /* ---------------- 可配置项 ---------------- */

  var CONFIG = {
    // 见数问卷地址：部署前替换为真实链接
    credamoUrl: 'https://www.credamo.com/xxx',

    // 未指定 group 参数时的随机分组比例（处理组占比）
    treatmentRatio: 0.5,

    // 强制分组：'treatment' | 'control' | null
    // 置为 null 时按上面的比例随机；仅用于本地调试
    forceGroup: null,

    // 数据存储
    recordsKey: 'od_records_v1',
    ctxKey: 'od_ctx_v1'
  };

  /* ---------------- 基础工具 ---------------- */

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* 隐私模式下可能不可用，忽略即可 */
    }
  }

  function getSessionCtx() {
    try {
      return JSON.parse(window.sessionStorage.getItem(CONFIG.ctxKey) || 'null');
    } catch (e) {
      return null;
    }
  }

  function setSessionCtx(ctx) {
    try {
      window.sessionStorage.setItem(CONFIG.ctxKey, JSON.stringify(ctx));
    } catch (e) {
      /* ignore */
    }
  }

  function loadRecords() {
    try {
      var raw = window.localStorage.getItem(CONFIG.recordsKey);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function randomSubjectId() {
    var d = new Date();
    var stamp = '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
      pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
    return 'S' + stamp + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  /* ---------------- 1. 被试 ID 与分组 ---------------- */

  var params = new URLSearchParams(window.location.search);
  var pageFile = window.location.pathname.split('/').pop() || 'index.html';
  var pageKey = pageFile.replace(/\.html?$/i, '') || 'index';

  var sidParam = (params.get('subject_id') || params.get('sid') || params.get('pid') || '').trim();
  var groupParam = (params.get('group') || '').trim().toLowerCase();
  var ctx = getSessionCtx();

  var subjectId = sidParam || (ctx && ctx.subject_id) || randomSubjectId();
  var group;

  if (groupParam === 'treatment' || groupParam === 'control') {
    group = groupParam;
  } else if (CONFIG.forceGroup === 'treatment' || CONFIG.forceGroup === 'control') {
    group = CONFIG.forceGroup;
  } else if (ctx && (ctx.group === 'treatment' || ctx.group === 'control')) {
    group = ctx.group;
  } else {
    var savedGroup = safeGet('od_group_' + subjectId);
    if (savedGroup === 'treatment' || savedGroup === 'control') {
      group = savedGroup;
    } else {
      group = Math.random() < CONFIG.treatmentRatio ? 'treatment' : 'control';
    }
  }

  safeSet('od_group_' + subjectId, group);
  setSessionCtx({ subject_id: subjectId, group: group });

  // 把关键参数写回地址栏，刷新或复制链接后分组保持一致
  try {
    var url = new URL(window.location.href);
    url.searchParams.set('subject_id', subjectId);
    url.searchParams.set('group', group);
    window.history.replaceState(null, '', url.toString());
  } catch (e) {
    /* file:// 下个别浏览器会抛错，忽略 */
  }

  document.documentElement.setAttribute('data-group', group);

  /* ---------------- 2. 建立实验记录 ---------------- */

  var records = loadRecords();
  var record = records[subjectId];
  var bootAt = nowIso();

  if (!record) {
    record = {
      subject_id: subjectId,
      group: group,
      created_at: bootAt,
      updated_at: bootAt,
      user_agent: navigator.userAgent,
      viewport: window.innerWidth + 'x' + window.innerHeight,
      referrer: document.referrer || '',
      page_views: {},
      events: [],
      info_clicks: [],
      ai: {
        clicked: false,
        click_count: 0,
        open_count: 0,
        first_open_at: null,
        messages: []
      },
      decision: {
        completed: false,
        at: null,
        choice: null,
        time_to_decision_ms: null
      },
      survey: {
        redirected: false,
        redirected_at: null
      }
    };
  }
  record.group = group;
  record.updated_at = bootAt;

  var pageView = record.page_views[pageKey];
  if (!pageView) {
    pageView = record.page_views[pageKey] = {
      visits: 0,
      dwell_ms: 0,
      first_enter_at: bootAt
    };
  }
  pageView.visits += 1;
  pageView.last_enter_at = bootAt;

  function save() {
    record.updated_at = nowIso();
    records[subjectId] = record;
    try {
      window.localStorage.setItem(CONFIG.recordsKey, JSON.stringify(records));
    } catch (e) {
      /* ignore */
    }
  }

  save();

  /* ---------------- 3. 停留时间 ---------------- */

  var lastTick = Date.now();
  var dwellTimer = null;

  function flushDwell() {
    var now = Date.now();
    var delta = now - lastTick;
    if (delta > 0) {
      pageView.dwell_ms += delta;
      lastTick = now;
    }
    save();
  }

  function startDwellTimer() {
    if (dwellTimer) return;
    lastTick = Date.now();
    dwellTimer = window.setInterval(flushDwell, 5000);
  }

  function stopDwellTimer() {
    if (!dwellTimer) return;
    window.clearInterval(dwellTimer);
    dwellTimer = null;
  }

  startDwellTimer();

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      flushDwell();
      stopDwellTimer();
    } else {
      startDwellTimer();
    }
  });

  window.addEventListener('pagehide', flushDwell);
  window.addEventListener('beforeunload', flushDwell);

  function totalDwell() {
    var sum = 0;
    for (var key in record.page_views) {
      if (Object.prototype.hasOwnProperty.call(record.page_views, key)) {
        sum += record.page_views[key].dwell_ms || 0;
      }
    }
    return Math.round(sum);
  }

  /* ---------------- 4. 行为事件 ---------------- */

  function relTime() {
    var created = Date.parse(record.created_at) || Date.now();
    return Date.now() - created;
  }

  function track(type, data) {
    var ev = {
      type: type,
      page: pageKey,
      t_ms: relTime(),
      ts: nowIso()
    };
    if (data) {
      for (var k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k)) ev[k] = data[k];
      }
    }
    record.events.push(ev);
    save();
    return ev;
  }

  track('page_view', { referrer: document.referrer || '' });

  // 关键信息区域点击（擅长、价格、评价、简介等）
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    var el = target.closest('[data-track]');
    if (!el) return;
    var section = el.getAttribute('data-track');
    var label = el.getAttribute('data-track-label') || (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    record.info_clicks.push({
      section: section,
      label: label,
      page: pageKey,
      t_ms: relTime(),
      ts: nowIso()
    });
    track('info_click', { section: section, label: label });
  }, true);

  // 页面内跳转链接自动带上实验参数
  function syncInternalLinks() {
    var links = document.querySelectorAll('a[data-od-link]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') continue;
      try {
        var u = new URL(href, window.location.href);
        u.searchParams.set('subject_id', subjectId);
        u.searchParams.set('group', group);
        links[i].setAttribute('href', pageFilePrefix() + u.pathname.split('/').pop() + u.search);
      } catch (err) {
        /* ignore */
      }
    }
  }

  function pageFilePrefix() {
    var path = window.location.pathname;
    var idx = path.lastIndexOf('/');
    return idx >= 0 ? path.slice(0, idx + 1) : '';
  }

  /* ---------------- 5. Toast ---------------- */

  var toastEl = null;
  var toastTimer = null;

  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'od-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2800);
  }

  /* ---------------- 6. AI 助理数据接口 ---------------- */

  function aiOpen() {
    record.ai.clicked = true;
    record.ai.click_count += 1;
    record.ai.open_count += 1;
    if (!record.ai.first_open_at) record.ai.first_open_at = nowIso();
    track('ai_open');
  }

  function aiClose() {
    track('ai_close');
  }

  function aiLog(role, text, intent, source) {
    record.ai.messages.push({
      role: role,
      text: text,
      intent: intent || '',
      source: source || '',
      t_ms: relTime(),
      ts: nowIso()
    });
    track('ai_message', {
      role: role,
      text: text,
      intent: intent || '',
      source: source || ''
    });
  }

  /* ---------------- 7. 决策与见数跳转 ---------------- */

  function markDecision(choice) {
    if (!record.decision.completed) {
      record.decision.completed = true;
      record.decision.at = nowIso();
      record.decision.choice = choice || '';
      record.decision.time_to_decision_ms = relTime();
      track('decision_completed', { choice: choice || '' });
    } else {
      track('decision_again', { choice: choice || '' });
    }
    save();
  }

  function surveyUrl() {
    try {
      var u = new URL(CONFIG.credamoUrl);
      u.searchParams.set('subject_id', subjectId);
      u.searchParams.set('group', group);
      u.searchParams.set('ai_used', record.ai.clicked ? '1' : '0');
      u.searchParams.set('decision', record.decision.completed ? '1' : '0');
      u.searchParams.set('time_to_decision_ms', record.decision.time_to_decision_ms || 0);
      u.searchParams.set('dwell_ms', totalDwell());
      return u.toString();
    } catch (e) {
      return '';
    }
  }

  function goSurvey() {
    flushDwell();
    var target = surveyUrl();
    if (!target || CONFIG.credamoUrl.indexOf('/xxx') !== -1) {
      toast('问卷链接尚未配置，请修改 js/main.js 中的 CONFIG.credamoUrl');
      return false;
    }
    record.survey.redirected = true;
    record.survey.redirected_at = nowIso();
    track('survey_redirect', {
      choice: record.decision.choice || '',
      url: target
    });
    save();
    window.location.href = target;
    return true;
  }

  /* ---------------- 8. 数据导出 ---------------- */

  function exportData() {
    flushDwell();
    var all = loadRecords();
    all[subjectId] = record;

    var list = [];
    for (var key in all) {
      if (Object.prototype.hasOwnProperty.call(all, key)) {
        var item = all[key];
        item.total_dwell_ms = (function (r) {
          var sum = 0;
          for (var p in r.page_views) {
            if (Object.prototype.hasOwnProperty.call(r.page_views, p)) {
              sum += r.page_views[p].dwell_ms || 0;
            }
          }
          return Math.round(sum);
        })(item);
        list.push(item);
      }
    }

    var payload = {
      exported_at: nowIso(),
      experiment: 'online_doctor_ai_assistant',
      config: {
        credamo_url: CONFIG.credamoUrl,
        treatment_ratio: CONFIG.treatmentRatio
      },
      records: list
    };

    try {
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      var stamp = nowIso().slice(0, 19).replace(/[:T]/g, '-');
      a.href = URL.createObjectURL(blob);
      a.download = 'online_doctor_data_' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      window.setTimeout(function () {
        URL.revokeObjectURL(a.href);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 1000);
      track('data_export');
      toast('数据已导出（共 ' + list.length + ' 条记录）');
    } catch (e) {
      toast('当前浏览器不支持自动导出，请打开控制台复制数据');
      if (window.console) window.console.log(payload);
    }
  }

  /* ---------------- 9. 决策弹窗交互 ---------------- */

  function getModal() {
    return document.getElementById('decision-modal');
  }

  function openDecisionModal() {
    var modal = getModal();
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    track('decision_intent');
    var firstChoice = modal.querySelector('input[name="consult-type"]');
    if (firstChoice) firstChoice.focus({ preventScroll: true });
  }

  function closeDecisionModal() {
    var modal = getModal();
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    track('decision_cancel');
  }

  function submitDecision() {
    var modal = getModal();
    if (!modal) return;
    var checked = modal.querySelector('input[name="consult-type"]:checked');
    var choice = checked ? checked.value : '';
    markDecision(choice);
    track('consult_type_selected', { choice: choice });

    var redirected = goSurvey();
    if (redirected) return;

    var body = modal.querySelector('.modal-body');
    if (body) {
      body.innerHTML =
        '<div class="modal-done">' +
          '<div class="done-icon">✓</div>' +
          '<h3>已记录您的选择</h3>' +
          '<p>您选择的问诊方式：<b>' + choice + '</b><br>' +
          '本次研究数据已保存在当前浏览器中。<br>请告知实验人员，或点击下方按钮导出数据。</p>' +
          '<button type="button" class="btn btn-primary btn-block" data-od-action="export">导出本次数据</button>' +
        '</div>';
    }
  }

  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    var actionEl = target.closest('[data-od-action]');
    if (actionEl) {
      var action = actionEl.getAttribute('data-od-action');
      if (action === 'decision') {
        e.preventDefault();
        openDecisionModal();
        return;
      }
      if (action === 'close-decision') {
        e.preventDefault();
        closeDecisionModal();
        return;
      }
      if (action === 'submit-decision') {
        e.preventDefault();
        submitDecision();
        return;
      }
      if (action === 'export') {
        e.preventDefault();
        exportData();
        return;
      }
    }

    var exportEl = target.closest('[data-od-export]');
    if (exportEl) {
      e.preventDefault();
      exportData();
    }
  });

  document.addEventListener('click', function (e) {
    var modal = getModal();
    if (!modal || modal.hidden) return;
    if (e.target === modal) closeDecisionModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var modal = getModal();
    if (modal && !modal.hidden) closeDecisionModal();
  });

  /* ---------------- 10. 初始化页面级交互 ---------------- */

  syncInternalLinks();

  document.querySelectorAll('[data-od-export]').forEach(function (el) {
    el.setAttribute('title', '导出 localStorage 中的实验数据（研究者使用）');
  });

  // 页内导航高亮
  var tabLinks = document.querySelectorAll('.tabbar a[href^="#"]');
  var sections = [];
  tabLinks.forEach(function (link) {
    var id = link.getAttribute('href').slice(1);
    var section = document.getElementById(id);
    if (section) sections.push({ link: link, section: section });
    link.addEventListener('click', function () {
      track('tab_click', { section: id });
    });
  });

  if ('IntersectionObserver' in window && sections.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        sections.forEach(function (item) {
          item.link.classList.toggle('active', item.section === entry.target);
        });
      });
    }, { rootMargin: '-140px 0px -60% 0px', threshold: 0 });

    sections.forEach(function (item) { observer.observe(item.section); });
  }

  /* ---------------- 11. 暴露接口 ---------------- */

  window.OD = {
    config: CONFIG,
    subjectId: subjectId,
    group: group,
    page: pageKey,
    record: function () { return record; },
    track: track,
    toast: toast,
    save: save,
    totalDwell: totalDwell,
    aiOpen: aiOpen,
    aiClose: aiClose,
    aiLog: aiLog,
    markDecision: markDecision,
    goSurvey: goSurvey,
    exportData: exportData
  };

  // 便于研究者在控制台查看当前被试状态
  if (window.console && window.console.info) {
    window.console.info('[实验] subject_id=' + subjectId + ', group=' + group);
  }
})();
