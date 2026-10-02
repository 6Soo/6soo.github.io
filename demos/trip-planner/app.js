/* Trip Planner 공개 데모 — 합성 데이터 전용, 서버·API·저장 없음 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. 합성 데이터 (지역·시설·요금은 모두 이 파일 안에서 만든 가짜 값)
   * ------------------------------------------------------------------ */
  var PLACES = [
    { id: 'p01', name: '구름다리 전망대', area: '오르막 마을', cat: '관광', price: 6000, min: 90, open: 8, close: 17, tags: ['nature', 'water'] },
    { id: 'p02', name: '오르막 마을 남죽طاق 공방', area: '오르막 마을', cat: '체험', price: 12000, min: 100, open: 10, close: 18, tags: ['craft', 'food'] },
    { id: 'p03', name: '다리 골목 상인거리', area: '오르막 마을', cat: '쇼핑', price: 0, min: 70, open: 10, close: 19, tags: ['food'] },

    { id: 'p04', name: '운하 항구 야시장', area: '운하 항구', cat: '음식', price: 15000, min: 80, open: 17, close: 22, tags: ['food'] },
    { id: 'p05', name: '운하 수상 자전거 창고', area: '운하 항구', cat: '체험', price: 18000, min: 120, open: 9, close: 17, tags: ['water', 'nature'] },
    { id: 'p06', name: '물길 전망 교량', area: '운하 항구', cat: '관광', price: 4000, min: 60, open: 7, close: 20, tags: ['water'] },
    { id: 'p07', name: '항구 하역창고 갤러리', area: '운하 항구', cat: '관광', price: 8000, min: 70, open: 11, close: 19, tags: ['craft'] },

    { id: 'p08', name: '유리숲 평원 유리공방', area: '유리숲 평원', cat: '체험', price: 22000, min: 110, open: 10, close: 18, tags: ['craft'] },
    { id: 'p09', name: '유리숲 잔디 언덕', area: '유리숲 평원', cat: '관광', price: 0, min: 60, open: 6, close: 21, tags: ['nature'] },
    { id: 'p10', name: '평원 하천 피크닉장', area: '유리숲 평원', cat: '관광', price: 3000, min: 90, open: 9, close: 18, tags: ['nature', 'food'] },

    { id: 'p11', name: '갯골 노을 산책로', area: '갯골', cat: '관광', price: 0, min: 100, open: 6, close: 19, tags: ['nature', 'water'] },
    { id: 'p12', name: '갯골 조개 그릇 만들기', area: '갯골', cat: '체험', price: 16000, min: 90, open: 10, close: 17, tags: ['craft'] },
    { id: 'p13', name: '바다앞 조개구이 시장', area: '갯골', cat: '음식', price: 19000, min: 70, open: 11, close: 20, tags: ['food'] },

    { id: 'p14', name: '이슬바람 숲 습기 폭포', area: '이슬바람 숲', cat: '관광', price: 3000, min: 100, open: 7, close: 18, tags: ['nature', 'water'] },
    { id: 'p15', name: '숲길 이끼 답사', area: '이슬바람 숲', cat: '체험', price: 14000, min: 120, open: 9, close: 16, tags: ['nature'] },
    { id: 'p16', name: '이슬바람 숲 야영장', area: '이슬바람 숲', cat: '숙박', price: 25000, min: 90, open: 9, close: 20, tags: ['nature'] },
    { id: 'p17', name: '숲속 찻집 다방', area: '이슬바람 숲', cat: '음식', price: 9000, min: 50, open: 10, close: 19, tags: ['food', 'nature'] }
  ];

  var HOTEL_PER_ROOM = 62000;   // 합성 값
  var TRANSFER_PER_DAY = 18000; // 합성 값

  var STEPS = [
    { key: 'accept',  name: '생성 요청 접수',       desc: '요청 본문과 202 접수 번호를 작업 큐에 넣습니다.',  src: 'backend/app/api/trips.py' },
    { key: 'route',   name: '작업 유형 판별',        desc: '요청을 다룰 작업 종류를 골라 해당 처리 경로를 고릅니다.', src: 'ai/router/agent_router.py' },
    { key: 'know',    name: '지역 후보 조회',        desc: '지역별 후보 묶음을 불러와 일정 후보를 모읍니다.',      src: 'knowledge/' },
    { key: 'route2',  name: '이동 경로 추정',        desc: '고정된 합성 경로로 순서와 소요 시간을 잡습니다.',        src: 'ai/route/' },
    { key: 'place',   name: '일정 시간 배치',        desc: '영업 시간과 하루 분량을 보고 시간표를 만듭니다.',        src: 'ai/schedule_builder.py' },
    { key: 'cost',    name: '비용 산정',             desc: '프로그램·숙박·이동 비용을 합산해 예산과 대조합니다.',   src: 'ai/cost_engine.py' },
    { key: 'verify',  name: '일정 검증',             desc: '빈 일정과 시간 초과를 검사합니다.',                      src: 'ai/agents/validator_agent.py' },
    { key: 'save',    name: '버전 저장',             desc: '검증을 통과한 결과만 영속 버전으로 남깁니다.',            src: 'backend/app/models/' }
  ];

  /* ------------------------------------------------------------------ *
   * 2. 상태
   * ------------------------------------------------------------------ */
  var state = {
    receipt: null,
    runState: 'idle',      // idle | running | ok | err
    draft: null,           // 현재 편집 중인 일정
    draftReq: null,        // 현재 편집 중인 요청 조건
    versions: [],          // 검증 통과해 저장된 버전
    activeId: null,
    dirty: false,
    share: null,
    jobSeq: 0
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var nf = new Intl.NumberFormat('ko-KR');
  function won(n) { return nf.format(Math.round(n)) + '원'; }
  function hhmm(m) {
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function byId(id) {
    for (var i = 0; i < PLACES.length; i++) if (PLACES[i].id === id) return PLACES[i];
    return { id: id, name: '(알 수 없는 항목)', area: '-', cat: '-', price: 0, min: 0, open: 0, close: 24, tags: [] };
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function readRequest() {
    return {
      region: $('#f-region').value,
      theme: $('#f-theme').value,
      days: parseInt($('#f-days').value, 10),
      party: parseInt($('#f-party').value, 10),
      pace: parseInt($('#f-pace').value, 10),
      budget: parseInt($('#f-budget').value, 10),
      note: $('#f-note').value.trim()
    };
  }

  /* ------------------------------------------------------------------ *
   * 3. 탭 전환
   * ------------------------------------------------------------------ */
  function showPanel(id) {
    $$('.tab').forEach(function (t) {
      var on = t.getAttribute('data-panel') === id;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.panel').forEach(function (p) {
      var on = p.id === id;
      p.classList.toggle('is-active', on);
      if (on) { p.removeAttribute('hidden'); } else { p.setAttribute('hidden', ''); }
    });
  }
  $$('.tab').forEach(function (t) {
    t.addEventListener('click', function () { showPanel(t.getAttribute('data-panel')); });
  });

  /* ------------------------------------------------------------------ *
   * 4. 입력 표시 갱신
   * ------------------------------------------------------------------ */
  function bindOutput(rangeId, outId, fmt) {
    var r = $('#' + rangeId), o = $('#' + outId);
    var sync = function () { o.textContent = fmt(parseInt(r.value, 10)); };
    r.addEventListener('input', sync); sync();
  }
  bindOutput('f-days', 'o-days', function (v) { return v + '일'; });
  bindOutput('f-party', 'o-party', function (v) { return v + '명'; });
  bindOutput('f-budget', 'o-budget', function (v) { return nf.format(v); });

  /* ------------------------------------------------------------------ *
   * 5. 생성 요청 접수
   * ------------------------------------------------------------------ */
  $('#req-form').addEventListener('submit', function (e) {
    e.preventDefault();
    state.jobSeq += 1;
    state.receipt = {
      code: '202',
      id: 'job_tc_' + Date.now().toString(36) + '_' + state.jobSeq,
      req: readRequest()
    };
    $('#receipt-id').textContent = state.receipt.id;
    $('#receipt').hidden = false;

    state.runState = 'idle';
    state.draft = null;
    state.dirty = false;
    state.share = null;
    $('#share-link').hidden = true;
    $('#share-preview').hidden = true;
    $('#btn-share-toggle').hidden = true;
    $('#run-state').textContent = '대기 중 (워커 실행 대기)';
    $('#run-state').className = 'run-state';
    $('#outcome').hidden = true;
    $('#btn-retry').hidden = true;
    renderPipeline();
    renderWorkspace();
    renderQuote();
    showPanel('p-pipeline');
  });

  /* ------------------------------------------------------------------ *
   * 6. 파이프라인 실행
   * ------------------------------------------------------------------ */
  function renderPipeline() {
    var ol = $('#pipeline');
    ol.textContent = '';
    STEPS.forEach(function (s, i) {
      var li = document.createElement('li');
      li.className = 'step';
      li.setAttribute('data-state', 'wait');
      li.setAttribute('data-key', s.key);

      var dot = document.createElement('span');
      dot.className = 'step-dot';
      dot.textContent = String(i + 1);

      var mid = document.createElement('div');
      mid.className = 'step-name';
      mid.textContent = s.name;
      var sub = document.createElement('span');
      sub.textContent = s.desc;
      mid.appendChild(sub);

      var src = document.createElement('span');
      src.className = 'step-src';
      src.textContent = s.src;

      li.appendChild(dot); li.appendChild(mid); li.appendChild(src);
      ol.appendChild(li);
    });
  }

  function setStep(key, st) {
    var li = $('.step[data-key="' + key + '"]');
    if (li) li.setAttribute('data-state', st);
  }

  function setRunState(text, cls) {
    var el = $('#run-state');
    el.textContent = text;
    el.className = 'run-state' + (cls ? ' ' + cls : '');
  }

  function runPipeline() {
    if (!state.receipt || state.runState === 'running') return;
    state.runState = 'running';
    var req = state.receipt.req;
    var i = 0;
    $('#btn-run').disabled = true;
    $('#btn-retry').hidden = true;
    $('#outcome').hidden = true;
    $('#btn-share-toggle').hidden = true;
    $('#share-link').hidden = true;
    $('#share-preview').hidden = true;
    state.share = null;
    setRunState('워커 실행 중', 'is-running');
    renderPipeline();

    function next() {
      if (i >= STEPS.length) { finish(); return; }
      var s = STEPS[i];
      setStep(s.key, 'run');
      setRunState('워커 실행 중 · ' + s.name, 'is-running');
      window.setTimeout(function () {
        if (s.key === 'verify') {
          var issues = validate(state.draft);
          if (issues.length) {
            setStep(s.key, 'err');
            fail(issues);
            return;
          }
        }
        setStep(s.key, 'ok');
        i += 1;
        next();
      }, 300);
    }

    function fail(issues) {
      setStep('save', 'skip');
      setRunState('검증 실패 · 저장하지 않음', 'is-err');
      state.runState = 'err';
      state.draft = null;
      state.dirty = false;
      $('#btn-run').disabled = false;
      $('#btn-retry').hidden = false;
      var box = $('#outcome');
      box.className = 'outcome is-err';
      box.hidden = false;
      box.textContent = '';
      box.appendChild(para('<b>검증 실패로 버전을 만들지 않았습니다.</b> 실패한 초안은 저장하지 않는 것이 원본의 규칙입니다.'));
      box.appendChild(para('사유: ' + issues.join(' / ')));
      box.appendChild(para('조치: 지역·테마 조합을 넓히거나 일수를 줄인 뒤 다시 실행하세요.'));
      renderWorkspace();
      renderQuote();
    }

    function finish() {
      state.runState = 'ok';
      state.dirty = false;
      var cost = computeCost(state.draft, req);
      var over = cost.grand > req.budget;
      setRunState('완료 · 검증 통과', 'is-ok');
      $('#btn-run').disabled = false;

      var v = {
        id: 'v' + (state.versions.length + 1),
        no: state.versions.length + 1,
        days: clone(state.draft),
        req: clone(req),
        cost: cost,
        at: stamp()
      };
      state.versions.push(v);
      state.activeId = v.id;
      state.draft = clone(v.days);
      state.draftReq = clone(req);

      var box = $('#outcome');
      box.className = 'outcome' + (over ? ' is-warn' : '');
      box.hidden = false;
      box.textContent = '';
      box.appendChild(para('<b>' + v.id + ' 버전을 저장했습니다.</b> 검증에 통과한 결과만 버전 목록에 쌓입니다.'));
      box.appendChild(para('합계 ' + won(cost.grand) + ' · 입력 예산 ' + won(req.budget) +
        (over ? ' → 예산을 ' + won(cost.grand - req.budget) + ' 넘습니다. 3단계에서 항목을 빼 조정할 수 있습니다.'
              : ' → 예산 안입니다.')));
      var jump = document.createElement('button');
      jump.type = 'button';
      jump.className = 'btn btn-ghost btn-sm';
      jump.textContent = '3단계로 이동';
      jump.addEventListener('click', function () { showPanel('p-workspace'); });
      box.appendChild(jump);

      renderWorkspace();
      renderQuote();
    }

    state.draft = buildItinerary(req);
    next();
  }

  function para(html) { var p = document.createElement('p'); p.innerHTML = html; return p; }
  function stamp() {
    var d = new Date();
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }

  $('#btn-run').addEventListener('click', runPipeline);
  $('#btn-retry').addEventListener('click', function () {
    if (!state.receipt) { showPanel('p-request'); return; }
    runPipeline();
  });

  /* ------------------------------------------------------------------ *
   * 7. 일정 생성 (시간 배치 규칙)
   * ------------------------------------------------------------------ */
  function buildItinerary(req) {
    var pool = PLACES.filter(function (p) { return req.region === 'all' || p.area === req.region; });
    var themed = req.theme === 'all' ? pool : pool.filter(function (p) { return p.tags.indexOf(req.theme) >= 0; });
    var base = themed.length ? themed : [];
    var used = {};
    var days = [];
    for (var d = 0; d < req.days; d++) {
      var items = [];
      var cur = 9 * 60;
      var left = req.pace;
      for (var i = 0; i < base.length; i++) {
        var p = base[i];
        if (used[p.id]) continue;
        if (cur / 60 < p.open) continue;
        if ((cur + p.min) / 60 > p.close) continue;
        if (p.min + 30 > left) continue;
        items.push({ pid: p.id, start: cur, min: p.min, on: true });
        used[p.id] = true;
        cur += p.min + 30;
        left -= p.min + 30;
      }
      days.push({ no: d + 1, items: items });
    }
    return days;
  }

  /* ------------------------------------------------------------------ *
   * 8. 검증 / 비용
   * ------------------------------------------------------------------ */
  function validate(days) {
    var issues = [];
    if (!days || !days.length) return ['일정을 만들지 못했습니다.'];
    days.forEach(function (d) {
      if (!d.items.length) issues.push(d.no + '일차에 배치된 항목이 없습니다');
    });
    days.forEach(function (d) {
      var mins = d.items.filter(function (i) { return i.on; })
        .reduce(function (s, i) { return s + i.min + 30; }, 0);
      if (mins > 620) issues.push(d.no + '일차 활동 시간이 10시간 20분을 넘습니다');
    });
    return issues;
  }

  function computeCost(days, req) {
    days = days || [];
    var perPerson = 0;
    days.forEach(function (d) {
      d.items.forEach(function (i) { if (i.on) perPerson += byId(i.pid).price; });
    });
    var nights = Math.max(req.days - 1, 0);
    var rooms = Math.ceil(req.party / 2);
    var lodgingTotal = nights * rooms * HOTEL_PER_ROOM;
    var transportTotal = TRANSFER_PER_DAY * req.days * req.party;
    var activityTotal = perPerson * req.party;
    return {
      nights: nights, rooms: rooms, perPerson: perPerson,
      lodgingTotal: lodgingTotal, transportTotal: transportTotal,
      activityTotal: activityTotal, grand: lodgingTotal + transportTotal + activityTotal
    };
  }

  /* ------------------------------------------------------------------ *
   * 9. 워크스페이스 렌더
   * ------------------------------------------------------------------ */
  function activeReq() {
    if (state.draftReq) return state.draftReq;
    var v = activeVersion();
    return v ? v.req : { days: 1, party: 1, budget: 0, region: 'all', theme: 'all', pace: 480, note: '' };
  }

  function activeVersion() {
    for (var i = 0; i < state.versions.length; i++) if (state.versions[i].id === state.activeId) return state.versions[i];
    return null;
  }

  function renderVersions() {
    var box = $('#version-list');
    box.textContent = '';
    if (!state.versions.length) {
      var p = document.createElement('p');
      p.className = 'empty';
      p.textContent = '저장된 버전이 없습니다.';
      box.appendChild(p);
      return;
    }
    state.versions.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'vbtn' + (v.id === state.activeId ? ' is-active' : '');
      var t = document.createElement('b');
      t.textContent = v.id + (v.req.note ? ' · ' + v.req.note : '');
      var s = document.createElement('span');
      s.textContent = v.at + ' · ' + won(v.cost.grand);
      b.appendChild(t); b.appendChild(s);
      b.addEventListener('click', function () {
        state.activeId = v.id;
        state.draft = clone(v.days);
        state.draftReq = clone(v.req);
        state.dirty = false;
        renderWorkspace();
        renderQuote();
      });
      box.appendChild(b);
    });
  }

  function renderWorkspace() {
    renderVersions();

    var sel = $('#f-active-version');
    sel.textContent = '';
    state.versions.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v.id;
      o.textContent = v.id + ' · ' + v.at;
      if (v.id === state.activeId) o.selected = true;
      sel.appendChild(o);
    });

    var hasV = state.versions.length > 0;
    $('#ws-toolbar').hidden = !hasV;
    $('#ws-foot').hidden = !hasV;

    var wrap = $('#itinerary');
    wrap.textContent = '';
    if (!state.draft) {
      var e = document.createElement('p');
      e.className = 'empty';
      e.textContent = '실행한 결과가 여기에 표시됩니다. 1단계에서 요청을 넣고 2단계에서 워커를 실행하세요.';
      wrap.appendChild(e);
      $('#dirty-flag').textContent = '';
      return;
    }

    var req = activeReq();
    var cost = computeCost(state.draft, req);

    state.draft.forEach(function (day) {
      var box = document.createElement('div');
      box.className = 'day';

      var head = document.createElement('div');
      head.className = 'day-head';
      head.textContent = day.no + '일차';
      var mins = day.items.filter(function (i) { return i.on; })
        .reduce(function (s, i) { return s + i.min + 30; }, 0);
      var sp = document.createElement('span');
      sp.textContent = day.items.filter(function (i) { return i.on; }).length + '곳 · 활동 ' +
        Math.floor(mins / 60) + '시간 ' + (mins % 60) + '분';
      head.appendChild(sp);
      box.appendChild(head);

      var ul = document.createElement('ul');
      ul.className = 'items';
      if (!day.items.length) {
        var li0 = document.createElement('li');
        li0.className = 'item';
        var n0 = document.createElement('div');
        n0.className = 'item-name';
        n0.textContent = '배치된 항목이 없습니다. 아래에서 직접 추가할 수 있습니다.';
        li0.appendChild(n0);
        ul.appendChild(li0);
      }
      day.items.forEach(function (item) {
        ul.appendChild(itemRow(day, item));
      });
      box.appendChild(ul);
      box.appendChild(addRow(day));
      wrap.appendChild(box);
    });

    var strip = document.createElement('div');
    strip.className = 'cost-strip';
    var over = cost.grand > req.budget;
    [
      ['프로그램 (1인)', won(cost.perPerson), ''],
      ['숙박 ' + cost.nights + '박 ' + cost.rooms + '실', won(cost.lodgingTotal), ''],
      ['지역 이동', won(cost.transportTotal), ''],
      ['합계 (' + req.party + '명 기준)', won(cost.grand), over ? 'over' : 'under'],
      ['입력 예산', won(req.budget), over ? 'over' : '']
    ].forEach(function (row) {
      var d = document.createElement('div');
      if (row[2]) d.className = row[2];
      var s = document.createElement('span'); s.textContent = row[0];
      var b = document.createElement('b'); b.textContent = row[1];
      d.appendChild(s); d.appendChild(b);
      strip.appendChild(d);
    });
    wrap.appendChild(strip);

    $('#dirty-flag').textContent = state.dirty ? '저장하지 않은 변경이 있습니다.' : '';
  }

  function itemRow(day, item) {
    var p = byId(item.pid);
    var li = document.createElement('li');
    li.className = 'item' + (item.on ? '' : ' is-off');

    var t = document.createElement('input');
    t.type = 'time';
    t.className = 'item-time';
    t.value = hhmm(item.start);
    t.setAttribute('aria-label', day.no + '일차 ' + p.name + ' 시작 시간');
    t.addEventListener('change', function () {
      var m = t.value.split(':');
      if (m.length < 2) return;
      var v = parseInt(m[0], 10) * 60 + parseInt(m[1], 10);
      if (isNaN(v)) return;
      item.start = v;
      day.items.sort(function (a, b) { return a.start - b.start; });
      markDirty();
      renderWorkspace();
    });
    li.appendChild(t);

    var name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = p.name;
    var meta = document.createElement('span');
    meta.textContent = p.area + ' · ' + p.cat + ' · ' + p.min + '분 · ' +
      (p.price ? won(p.price) : '무료') + ' / 1인';
    name.appendChild(meta);
    li.appendChild(name);

    var ops = document.createElement('div');
    ops.className = 'item-ops';

    var lab = document.createElement('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!item.on;
    cb.addEventListener('change', function () {
      item.on = cb.checked;
      markDirty();
      renderWorkspace();
    });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(' 포함'));
    ops.appendChild(lab);

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'row-btn';
    del.textContent = '빼기';
    del.setAttribute('aria-label', p.name + ' 빼기');
    del.addEventListener('click', function () {
      var i = day.items.indexOf(item);
      if (i >= 0) day.items.splice(i, 1);
      markDirty();
      renderWorkspace();
    });
    ops.appendChild(del);

    li.appendChild(ops);
    return li;
  }

  function addRow(day) {
    var row = document.createElement('div');
    row.className = 'add-row';

    var used = {};
    day.items.forEach(function (i) { used[i.pid] = true; });
    var pool = PLACES.filter(function (p) {
      var okArea = activeReq().region === 'all' || p.area === activeReq().region;
      return okArea && !used[p.id];
    });
    pool.sort(function (a, b) { return a.name < b.name ? -1 : 1; });

    var sel = document.createElement('select');
    sel.setAttribute('aria-label', day.no + '일차에 추가할 항목');
    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = pool.length ? '항목 추가하기' : '추가할 후보가 없습니다 (지역 밖)';
    ph.disabled = true;
    ph.selected = true;
    sel.appendChild(ph);
    pool.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name + ' · ' + p.cat + ' · ' + p.min + '분' + (p.price ? ' · ' + won(p.price) : '');
      sel.appendChild(o);
    });

    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'row-btn';
    add.textContent = '추가';
    add.addEventListener('click', function () {
      if (!sel.value) return;
      var last = day.items[day.items.length - 1];
      var start = last ? last.start + last.min + 30 : 9 * 60;
      day.items.push({ pid: sel.value, start: start, min: byId(sel.value).min, on: true });
      markDirty();
      renderWorkspace();
    });

    row.appendChild(sel);
    row.appendChild(add);
    return row;
  }

  function markDirty() { state.dirty = true; $('#dirty-flag').textContent = '저장하지 않은 변경이 있습니다.'; }

  $('#f-active-version').addEventListener('change', function (e) {
    var v = null;
    state.versions.forEach(function (x) { if (x.id === e.target.value) v = x; });
    if (!v) return;
    state.activeId = v.id;
    state.draft = clone(v.days);
    state.draftReq = clone(v.req);
    state.dirty = false;
    renderWorkspace();
    renderQuote();
  });

  $('#btn-restore').addEventListener('click', function () {
    var v = activeVersion();
    if (!v) return;
    state.draft = clone(v.days);
    state.draftReq = clone(v.req);
    state.dirty = false;
    renderWorkspace();
    renderQuote();
  });

  $('#btn-save').addEventListener('click', function () {
    if (!state.draft) return;
    var issues = validate(state.draft);
    if (issues.length) {
      var box = $('#outcome');
      box.className = 'outcome is-err';
      box.hidden = false;
      box.textContent = '';
      box.appendChild(para('<b>검증 실패로 새 버전을 만들지 않았습니다.</b>'));
      box.appendChild(para('사유: ' + issues.join(' / ')));
      showPanel('p-pipeline');
      return;
    }
    var req = activeReq();
    var v = {
      id: 'v' + (state.versions.length + 1),
      no: state.versions.length + 1,
      days: clone(state.draft),
      req: clone(req),
      cost: computeCost(state.draft, req),
      at: stamp()
    };
    state.versions.push(v);
    state.activeId = v.id;
    state.dirty = false;

    var box2 = $('#outcome');
    box2.className = 'outcome';
    box2.hidden = false;
    box2.textContent = '';
    box2.appendChild(para('<b>' + v.id + ' 버전을 저장했습니다.</b> 편집본은 별도 버전으로 쌓이고 원본은 그대로 남습니다.'));

    renderWorkspace();
    renderQuote();
  });

  /* ------------------------------------------------------------------ *
   * 10. 상품 견적
   * ------------------------------------------------------------------ */
  function renderQuote() {
    var sel = $('#f-quote-version');
    sel.textContent = '';
    state.versions.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v.id;
      o.textContent = v.id + ' · ' + v.req.days + '일 · ' + v.req.party + '명 · ' + won(v.cost.grand);
      if (v.id === state.activeId) o.selected = true;
      sel.appendChild(o);
    });

    var v = activeVersion();
    var guard = $('#quote-guard');
    if (!v) {
      guard.textContent = '보유한 일정이 없으면 견적을 만들 수 없습니다.';
      $('#quote-lines').textContent = '';
      $('#quote-totals').textContent = '';
      return;
    }
    guard.textContent = '견적 대상은 ' + v.id + ' 버전입니다. 본인이 소유한 일정만 목록에 오릅니다.';

    var head = parseInt($('#f-headcount').value, 10);
    var margin = parseInt($('#f-margin').value, 10);
    var tax = parseInt($('#f-tax').value, 10);
    $('#o-headcount').textContent = head + '명';
    $('#o-margin').textContent = margin + '%';

    var nights = Math.max(v.req.days - 1, 0);
    var rooms = Math.ceil(head / 2);
    var lodging = nights * rooms * HOTEL_PER_ROOM;
    var transfer = TRANSFER_PER_DAY * v.req.days * head;
    var program = v.cost.perPerson * head;
    var sub = lodging + transfer + program;
    var profit = sub * margin / 100;
    var sell = sub + profit;
    var vat = tax === 10 ? sell * 0.1 : 0;
    var total = sell + vat;

    var lines = $('#quote-lines');
    lines.textContent = '';
    [
      ['숙박 ' + nights + '박 · ' + rooms + '실', lodging],
      ['지역 이동 ' + v.req.days + '일 · ' + head + '명', transfer],
      ['프로그램 (입장·체험·식사) ' + head + '명', program]
    ].forEach(function (row) {
      var d = document.createElement('div');
      d.className = 'line';
      var a = document.createElement('span'); a.textContent = row[0];
      var b = document.createElement('span'); b.textContent = won(row[1]);
      d.appendChild(a); d.appendChild(b);
      lines.appendChild(d);
    });

    var totals = $('#quote-totals');
    totals.textContent = '';
    [
      ['원가 합계', won(sub), ''],
      ['마진 ' + margin + '%', won(profit), 'is-sub'],
      ['판매가 (부가세 별도)', won(sell), ''],
      ['부가세 ' + (tax === 10 ? '10%' : '별도'), won(vat), 'is-sub'],
      ['총 청구액 / 1인당', won(total) + ' / ' + won(total / head), 'grand']
    ].forEach(function (row) {
      var d = document.createElement('div');
      if (row[2]) d.className = row[2];
      var dt = document.createElement('dt'); dt.textContent = row[0];
      var dd = document.createElement('dd'); dd.textContent = row[1];
      d.appendChild(dt); d.appendChild(dd);
      totals.appendChild(d);
    });
  }

  $('#f-headcount').addEventListener('input', renderQuote);
  $('#f-margin').addEventListener('input', renderQuote);
  $('#f-tax').addEventListener('change', renderQuote);
  $('#f-quote-version').addEventListener('change', function (e) {
    state.activeId = e.target.value;
    var v = activeVersion();
    if (v) {
      state.draft = clone(v.days);
      state.draftReq = clone(v.req);
      state.dirty = false;
    }
    renderWorkspace();
    renderQuote();
  });

  /* ------------------------------------------------------------------ *
   * 11. 고정 버전 공유
   * ------------------------------------------------------------------ */
  $('#btn-share').addEventListener('click', function () {
    var v = activeVersion();
    if (!v) return;
    var token = 'tc-' + Math.random().toString(36).slice(2, 8) + '-' + v.id;
    state.share = { token: token, versionId: v.id, snapshot: clone(v.days), at: stamp() };
    var out = $('#share-link');
    out.hidden = false;
    out.textContent = '고정 버전 주소 (합성): https://example.invalid/shared/' + token;
    $('#btn-share-toggle').hidden = false;
    renderShare();
  });

  $('#btn-share-toggle').addEventListener('click', function () {
    var p = $('#share-preview');
    p.hidden = !p.hidden;
    $('#btn-share-toggle').textContent = p.hidden ? '고정 버전 보기' : '고정 버전 숨기기';
  });

  function renderShare() {
    var p = $('#share-preview');
    p.textContent = '';
    if (!state.share) return;
    var h = document.createElement('h5');
    h.textContent = '읽기 전용 고정 버전 · ' + state.share.versionId + ' · ' + state.share.at;
    p.appendChild(h);
    var ol = document.createElement('ol');
    state.share.snapshot.forEach(function (d) {
      var li = document.createElement('li');
      var names = d.items.filter(function (i) { return i.on; })
        .map(function (i) { return byId(i.pid).name + ' (' + hhmm(i.start) + ')'; });
      li.textContent = d.no + '일차 — ' + (names.length ? names.join(', ') : '항목 없음');
      ol.appendChild(li);
    });
    p.appendChild(ol);
    var note = document.createElement('p');
    note.textContent = '생성 시각에 고정한 미리보기입니다. 이 화면 안에서만 만들어졌고 실제 링크는 발송되지 않았습니다.';
    p.appendChild(note);
  }

  /* ------------------------------------------------------------------ *
   * 12. 초기화
   * ------------------------------------------------------------------ */
  $('#btn-reset').addEventListener('click', function () {
    state.receipt = null;
    state.runState = 'idle';
    state.draft = null;
    state.draftReq = null;
    state.versions = [];
    state.activeId = null;
    state.dirty = false;
    state.share = null;
    state.jobSeq = 0;

    $('#receipt').hidden = true;
    $('#receipt-id').textContent = '-';
    $('#outcome').hidden = true;
    $('#btn-run').disabled = false;
    $('#btn-retry').hidden = true;
    $('#share-link').hidden = true;
    $('#share-preview').hidden = true;
    $('#btn-share-toggle').hidden = true;
    $('#btn-share-toggle').textContent = '고정 버전 보기';
    $('#f-note').value = '';
    setRunState('대기 중', '');

    renderPipeline();
    renderWorkspace();
    renderQuote();
    showPanel('p-request');
  });

  /* ------------------------------------------------------------------ *
   * 13. 시작
   * ------------------------------------------------------------------ */
  renderPipeline();
  renderWorkspace();
  renderQuote();
})();
