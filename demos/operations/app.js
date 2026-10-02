'use strict';

/* ------------------------------------------------------------------
   합성 데이터 데모 - 외부 API 호출, 파일 저장, 메신저 발송 없음
   ------------------------------------------------------------------ */

var SAMPLE_LOG = [
  '정우 대리: 견적서는 다음 주 수요일까지 고객사 쪽에 회신 드리면 됩니다.',
  '민서 과장: 계약서 초안은 오늘 중으로 보내겠다고 했습니다.',
  '정우 대리: 안전모 자재 발주서는 이번 주 금요일까지 확인해 보겠습니다.',
  '민서 과장: ⟦todo-brief⟧ 대기 3건, 기한 초과 1건입니다.',
  '현장 지원팀: 시공 사진은 내일까지 정리해서 메일로 전달할 예정입니다.',
  '정우 대리: 항공 좌석 재확인은 10월 5일에 연락드리겠습니다.',
  '민서 과장: 프로그램 이용료 정산 승인은 아직 기다리고 있습니다.'
].join('\n');

var PROMPT_KEYWORDS = [
  '회신', '답장', '연락드리', '확인해 보', '안내', '검토', '자료',
  '보내', '전달', '약속', '미루', '회의', '통화', '방문', '정산',
  '승인', '발주', '정리', '회신드릴'
];

var BRIEF_MARK = '⟦todo-brief⟧';
var WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

var state = {
  candidates: [],
  items: [],
  filter: 'all',
  seq: 1
};

var $ = function (id) { return document.getElementById(id); };

/* ---------- 날짜 유틸 ---------- */
function today() {
  var n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function addDays(base, n) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
}
function iso(d) {
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}
function prettyDate(d) {
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WEEKDAYS[d.getDay()] + ')';
}
function parseWhen(text, base) {
  var m;
  if ((m = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  if ((m = text.match(/(\d{1,2})월\s*(\d{1,2})일/))) {
    var year = base.getFullYear();
    var guess = new Date(year, Number(m[1]) - 1, Number(m[2]));
    if (guess.getTime() < base.getTime() - 180 * 86400000) guess = new Date(year + 1, Number(m[1]) - 1, Number(m[2]));
    return guess;
  }
  if (/모레/.test(text)) return addDays(base, 2);
  if (/내일/.test(text)) return addDays(base, 1);
  if (/오늘/.test(text)) return base;
  if ((m = text.match(/(\d+)\s*일\s*(뒤|후)/))) return addDays(base, Number(m[1]));
  if ((m = text.match(/(이번|다음|다다음)\s*주\s*([월화수목금토일])(요일)?/))) {
    var table = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 };
    var target = table[m[2]];
    var weekShift = m[1] === '이번' ? 0 : (m[1] === '다음' ? 7 : 14);
    var delta = (target - base.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    return addDays(base, delta + weekShift);
  }
  return null;
}

/* ---------- 스캔 ---------- */
function runScan() {
  var raw = $('sessionLog').value;
  var lines = raw.split(/\r?\n/);
  var scanned = 0;
  var skipped = 0;
  var found = [];

  lines.forEach(function (line) {
    var text = line.trim();
    if (!text) return;
    scanned += 1;
    if (text.indexOf(BRIEF_MARK) !== -1) { skipped += 1; return; }
    var hit = PROMPT_KEYWORDS.some(function (k) { return text.indexOf(k) !== -1; });
    if (!hit) return;
    var m = text.match(/^([가-힣A-Za-z]{2,10}(?:\s[가-힣]{1,4})?)\s*[:：]\s*(.+)$/);
    if (!m) return;
    var who = m[1].trim();
    var what = m[2].trim().replace(/[。\s]+$/, '');
    var when = parseWhen(what, today());
    found.push({
      who: who,
      what: what,
      followUp: when,
      auto: !when
    });
  });

  state.candidates = found.map(function (c, i) {
    return { id: 'c' + (state.seq++), checked: true, who: c.who, what: c.what, followUp: c.followUp, auto: c.auto };
  });

  $('scanLog').innerHTML =
    '읽은 줄 <b>' + scanned + '</b>줄 · 되먹임 제외 <b>' + skipped + '</b>줄 · 후보 <b>' + found.length + '</b>건' +
    (found.length ? ' · 날짜가 없어 기본 기한을 배정한 후보 ' +
      found.filter(function (c) { return c.auto; }).length + '건' : '');

  var box = $('candidateBox');
  if (!state.candidates.length) {
    box.hidden = true;
    $('candidateList').innerHTML = '';
    $('candidateCount').textContent = '0';
    return;
  }
  box.hidden = false;
  $('candidateCount').textContent = state.candidates.length + '건';
  renderCandidates();
}

function renderCandidates() {
  var ul = $('candidateList');
  ul.innerHTML = '';
  state.candidates.forEach(function (c) {
    var li = document.createElement('li');
    var label = document.createElement('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = c.checked;
    cb.dataset.id = c.id;
    cb.addEventListener('change', function () { c.checked = cb.checked; });
    var box = document.createElement('span');
    var what = document.createElement('span');
    what.className = 'cand-what';
    what.textContent = c.what;
    var meta = document.createElement('span');
    meta.className = 'cand-meta';
    meta.innerHTML = '<span class="tag">누가</span>' + c.who +
      ' · <span class="tag">언제</span>' + (c.followUp ? prettyDate(c.followUp) : '날짜 없음') +
      (c.auto ? ' <span class="tag tag-auto">기본 +2일 배정</span>' : '');
    box.appendChild(what);
    box.appendChild(document.createElement('br'));
    box.appendChild(meta);
    label.appendChild(cb);
    label.appendChild(box);
    li.appendChild(label);
    ul.appendChild(li);
  });
}

function registerSelected() {
  var picked = state.candidates.filter(function (c) { return c.checked; });
  picked.forEach(function (c) {
    state.items.push({
      id: 't' + (state.seq++),
      what: c.what,
      who: c.who,
      note: '',
      followUp: c.followUp || addDays(today(), 2),
      auto: c.auto,
      created: today(),
      status: 'waiting'
    });
  });
  state.candidates = state.candidates.filter(function (c) { return !c.checked; });
  $('scanLog').innerHTML += ' · 등록 ' + picked.length + '건';
  if (state.candidates.length) {
    renderCandidates();
    $('candidateCount').textContent = state.candidates.length + '건 (등록 대기)';
  } else {
    $('candidateBox').hidden = true;
  }
  renderInbox();
}

/* ---------- 대기 목록 ---------- */
function submitManual(ev) {
  ev.preventDefault();
  var title = $('mTitle').value.trim();
  var who = $('mWho').value.trim();
  var when = $('mWhen').value;
  var note = $('mNote').value.trim();
  var msg = $('formMsg');

  if (!title || !who || !when) {
    msg.textContent = '내용, 담당자, 재확인 기한을 모두 입력해 주세요. 서버로 전송하지 않습니다.';
    return;
  }
  var parts = when.split('-');
  state.items.push({
    id: 't' + (state.seq++),
    what: title,
    who: who,
    note: note,
    followUp: new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])),
    auto: false,
    created: today(),
    status: 'waiting'
  });
  msg.textContent = '화면 목록에만 추가했습니다. 새로고침하면 사라집니다.';
  $('mTitle').value = '';
  $('mWho').value = '';
  $('mNote').value = '';
  $('mWhen').value = '';
  renderInbox();
}

function dueState(item) {
  if (item.status === 'done') return 'done';
  var t = today().getTime();
  var f = new Date(item.followUp.getFullYear(), item.followUp.getMonth(), item.followUp.getDate()).getTime();
  if (f < t) return 'overdue';
  if (f === t) return 'today';
  return 'later';
}

function renderInbox() {
  var list = $('inbox');
  var counts = { all: state.items.length, waiting: 0, doing: 0, done: 0, overdue: 0, today: 0 };
  state.items.forEach(function (i) {
    counts[i.status] += 1;
    var d = dueState(i);
    if (d === 'overdue') counts.overdue += 1;
    if (d === 'today') counts.today += 1;
  });

  $('stats').innerHTML =
    stat('전체', counts.all, '') +
    stat('기한 초과', counts.overdue, 'is-overdue') +
    stat('오늘 마감', counts.today, 'is-due') +
    stat('대기 중', counts.waiting, '') +
    stat('완료', counts.done, '');

  var order = { overdue: 0, today: 1, later: 2, done: 3 };
  var visible = state.items.filter(function (i) {
    if (state.filter === 'all') return true;
    return i.status === state.filter;
  }).slice().sort(function (a, b) {
    var diff = order[dueState(a)] - order[dueState(b)];
    if (diff !== 0) return diff;
    return a.followUp - b.followUp;
  });

  list.innerHTML = '';
  if (!visible.length) {
    var li = document.createElement('li');
    li.className = 'empty';
    li.textContent = state.items.length
      ? '이 조건에 해당하는 항목이 없습니다.'
      : '대기 항목이 없습니다. 왼쪽에서 후보를 스캔해 등록하거나 직접 추가해 보세요.';
    list.appendChild(li);
    return;
  }

  visible.forEach(function (item) {
    var d = dueState(item);
    var li = document.createElement('li');
    li.className = 'inbox-item' +
      (d === 'overdue' ? ' is-overdue' : '') +
      (d === 'today' ? ' is-due' : '') +
      (d === 'done' ? ' is-done' : '');

    var top = document.createElement('div');
    top.className = 'inbox-top';
    var title = document.createElement('span');
    title.className = 'inbox-title';
    title.textContent = item.what;
    var tags = document.createElement('span');
    tags.innerHTML =
      (d === 'overdue' ? '<span class="badge-due badge-overdue">기한 초과</span> ' : '') +
      (d === 'today' ? '<span class="badge-due badge-today">오늘 재확인</span> ' : '') +
      (item.status === 'done'
        ? '<span class="badge-due badge-state-done">완료</span>'
        : '<span class="badge-due badge-state">' + (item.status === 'doing' ? '진행 중' : '대기 중') + '</span>');
    top.appendChild(title);
    top.appendChild(tags);

    var meta = document.createElement('p');
    meta.className = 'inbox-meta';
    meta.innerHTML = '담당 <b>' + item.who + '</b> · 재확인 ' + prettyDate(item.followUp) +
      (item.auto ? ' · 기본 배정' : '') + ' · 등록 ' + iso(item.created);

    li.appendChild(top);
    li.appendChild(meta);

    if (item.note) {
      var note = document.createElement('p');
      note.className = 'inbox-note';
      note.textContent = '비고: ' + item.note;
      li.appendChild(note);
    }

    var actions = document.createElement('div');
    actions.className = 'inbox-actions';
    if (item.status !== 'done') {
      actions.appendChild(actionBtn('답 확인 완료', 'btn-primary', function () {
        item.status = 'done';
        renderInbox();
      }));
      if (item.status === 'waiting') {
        actions.appendChild(actionBtn('진행 중으로 이동', 'btn-ghost', function () {
          item.status = 'doing';
          renderInbox();
        }));
      }
      actions.appendChild(actionBtn('기한 하루 연장', 'btn-ghost', function () {
        item.followUp = addDays(item.followUp, 1);
        item.auto = false;
        renderInbox();
      }));
    } else {
      actions.appendChild(actionBtn('다시 열기', 'btn-ghost', function () {
        item.status = 'doing';
        renderInbox();
      }));
    }
    actions.appendChild(actionBtn('삭제', 'btn-ghost', function () {
      state.items = state.items.filter(function (x) { return x.id !== item.id; });
      renderInbox();
    }));
    li.appendChild(actions);
    list.appendChild(li);
  });
}

function stat(label, value, cls) {
  return '<div class="stat ' + cls + '"><b>' + value + '</b><span>' + label + '</span></div>';
}

function actionBtn(text, cls, handler) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn-sm ' + cls;
  b.textContent = text;
  b.addEventListener('click', handler);
  return b;
}

/* ---------- 렌더 미리보기 ---------- */
var PAPERS = {
  A4: { w: 210, h: 297 },
  Letter: { w: 216, h: 279 }
};

function updatePreview() {
  var paper = PAPERS[$('paper').value];
  var landscape = $('orient').value === 'landscape';
  var w = landscape ? paper.h : paper.w;
  var h = landscape ? paper.w : paper.h;
  var margin = Number($('margin').value);
  $('marginOut').textContent = margin;

  var sheet = $('sheet');
  sheet.style.width = w + 'mm';
  sheet.style.height = h + 'mm';
  sheet.classList.toggle('is-dark', $('theme').value === 'dark');
  sheet.classList.toggle('no-bg', !$('printBg').checked);

  var page = $('sheetPage');
  page.style.padding = margin + 'mm';

  var viewport = $('previewViewport');
  var avail = viewport.clientWidth - 30;
  var pxW = w * 96 / 25.4;
  var pxH = h * 96 / 25.4;
  var summary =
    '용지 <b>' + $('paper').value + '</b> · ' + (landscape ? '가로' : '세로') + ' · 여백 <b>' + margin + 'mm</b>' +
    ' · 테마 <b>' + ($('theme').value === 'dark' ? '다크' : '라이트') + '</b> · 배경 인쇄 <b>' +
    ($('printBg').checked ? '포함' : '제외') + '</b>';

  if (avail <= 40) {
    // 미리보기 영역이 숨겨져 있으면 폭이 0이라 축척을 계산하지 않는다.
    $('previewMeta').innerHTML = summary + ' · 이 탭을 열면 축척이 계산됩니다';
    return;
  }

  var scale = Math.min(1, avail / pxW);
  sheet.style.transform = 'scale(' + scale + ')';
  $('sheetHolder').style.width = Math.floor(pxW * scale) + 'px';
  $('sheetHolder').style.height = Math.ceil(pxH * scale) + 'px';
  viewport.style.height = Math.ceil(pxH * scale) + 30 + 'px';

  $('previewMeta').innerHTML = summary + ' · 축척 ' + Math.round(scale * 100) + '%';
}

/* ---------- 탭 ---------- */
function initTabs() {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        $(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (tab.id === 'tab-render') updatePreview();
    });
  });
}

/* ---------- 초기화 ---------- */
function init() {
  $('sessionLog').value = SAMPLE_LOG;
  $('runScan').addEventListener('click', runScan);
  $('loadSample').addEventListener('click', function () {
    $('sessionLog').value = SAMPLE_LOG;
    runScan();
  });
  $('registerSelected').addEventListener('click', registerSelected);
  $('manualForm').addEventListener('submit', submitManual);

  $('filters').addEventListener('click', function (ev) {
    var btn = ev.target.closest('.chip');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    Array.prototype.forEach.call(this.querySelectorAll('.chip'), function (c) {
      c.classList.toggle('is-active', c === btn);
    });
    renderInbox();
  });

  ['paper', 'orient', 'margin', 'theme', 'printBg'].forEach(function (id) {
    $(id).addEventListener('input', updatePreview);
    $(id).addEventListener('change', updatePreview);
  });

  $('resetAll').addEventListener('click', function () {
    state.candidates = [];
    state.items = [];
    state.filter = 'all';
    state.seq = 1;
    $('sessionLog').value = SAMPLE_LOG;
    $('scanLog').textContent = '아직 스캔하지 않았습니다.';
    $('candidateBox').hidden = true;
    $('candidateList').innerHTML = '';
    $('candidateCount').textContent = '0';
    $('mTitle').value = '';
    $('mWho').value = '';
    $('mNote').value = '';
    $('mWhen').value = '';
    $('formMsg').textContent = '이 폼은 서버로 전송되지 않습니다. 값이 유효할 때만 화면 목록에 반영됩니다.';
    Array.prototype.forEach.call($('filters').querySelectorAll('.chip'), function (c) {
      c.classList.toggle('is-active', c.dataset.filter === 'all');
    });
    $('paper').value = 'A4';
    $('orient').value = 'portrait';
    $('margin').value = '16';
    $('theme').value = 'light';
    $('printBg').checked = true;
    renderInbox();
    updatePreview();
  });

  window.addEventListener('resize', updatePreview);

  initTabs();
  renderInbox();
  updatePreview();
}

document.addEventListener('DOMContentLoaded', init);