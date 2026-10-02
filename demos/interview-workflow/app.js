(function () {
  'use strict';

  var STEPS = [
    {
      name: '화상 면접 진행',
      state: '대기',
      done: true,
      desc: '면접이 끝나면 서비스가 자막과 요약 초안을 함께 만들어 둡니다. 데모에서는 이 단계가 이미 끝난 것으로 보고, 이후 단계만 직접 실행합니다.'
    },
    {
      name: '자동 노트 생성',
      state: '대기',
      done: false,
      desc: '면접 서비스가 만든 노트가 문서 저장소 계정에 문서 하나(Google Docs)로 저장됩니다. 영상 파일은 옮기지 않고 링크로만 참조합니다.'
    },
    {
      name: '시간 트리거 감지',
      state: '대기',
      done: false,
      desc: 'Apps Script의 시간 트리거가 주기적으로 실행되며 아직 처리하지 않은 새 문서를 찾습니다. 여기서 못 알아본 문서는 다음 주기에 다시 확인됩니다.'
    },
    {
      name: '마크다운 변환',
      state: '대기',
      done: false,
      desc: '문서 본문 텍스트를 추출해 정해진 마크다운 기록 형식으로 바꿉니다. 평가 칸이 비어 있으면 비어 있는 채로 넣고, 이미 내용이 있으면 건드리지 않습니다.'
    },
    {
      name: '저장소 자동 커밋',
      state: '대기',
      done: false,
      desc: '만들어진 기록을 저장소의 연도 폴더에 API로 커밋합니다. 이미 처리한 문서는 파일 단위 식별자로 기억하고 있어 다시 덮어쓰지 않습니다.'
    }
  ];

  var SEED_RECORDS = [
    {
      id: 'doc-syn-0101',
      title: '1차 온라인 인터뷰 (여행 상품 운영)',
      date: '2026-05-12',
      status: 'confirmed',
      body: '지원자는 상품 상세 페이지와 후기를 직접 정리해 운영했다고 답했습니다.\n판매 페이지 구조를 설명할 때 개편 전후 화면을 함께 비교했습니다.\n질문 의도를 먼저 확인한 뒤 답하는 습관이 관찰되었습니다.',
      eval: {
        summary: '상품 정보 구조를 직접 설계하고 운영한 경험이 있는 지원자입니다. 개편 근거를 화면으로 설명할 수 있어 근거가 분명합니다.',
        strength: '실무 변경 이력을 근거와 함께 설명함, 질문 의도를 먼저 확인한 뒤 답변함',
        concern: '운영 규모와 협업 범위는 아직 확인할 필요가 있음',
        recommend: '다음 단계 진행 검토 (사람이 원문 대조 후 확정)'
      }
    },
    {
      id: 'doc-syn-0102',
      title: '사전 문답 면접',
      date: '2026-05-19',
      status: 'pending',
      body: '3분 문답으로 기본 근무 조건과 출근 가능일을 확인했습니다.\n녹취 길이가 짧아 평가 칸은 비어 있습니다.',
      eval: null
    },
    {
      id: 'doc-syn-0103',
      title: '온라인 인터뷰 (파트타임 지원)',
      date: '2026-05-26',
      status: 'onhold',
      body: '지원 가능 시간대가 주중 오전으로 제한적이었습니다.\n야간 근무 가능 여부를 다시 확인한 뒤 재검토하기로 했습니다.',
      eval: {
        summary: '주중 오전 근무가 가능한 지원자입니다. 야간 근무 조건이 확인될 때까지 보류합니다.',
        strength: '조건이 명확하게 표현됨',
        concern: '근무 가능 시간대가 당초 공고 조건과 일부 다름',
        recommend: '조건 재확인 후 재검토'
      }
    }
  ];

  var SEED_LOGS = [
    { tone: 'ok', text: '샘플 동기화 이력 3건을 불러왔습니다. (합성 데이터)' },
    { tone: 'ok', text: '다음 단계 실행을 누르면 파이프라인이 순서대로 동작합니다.' }
  ];

  var state = {
    cursor: 0,
    logs: [],
    records: [],
    filter: 'all',
    selectedStep: 0,
    seq: 0
  };

  var elStepper = document.getElementById('stepper');
  var elStepDetail = document.getElementById('step-detail');
  var elLog = document.getElementById('log');
  var elRun = document.getElementById('run-step');
  var elForm = document.getElementById('intake-form');
  var elMsg = document.getElementById('intake-msg');
  var elReset = document.getElementById('reset-all');
  var elRecords = document.getElementById('records');
  var elEmpty = document.getElementById('empty');
  var elCount = document.getElementById('record-count');
  var elFilters = document.getElementById('filters');

  var STATUS_TEXT = { pending: '검토 필요', confirmed: '확정', onhold: '보류' };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function log(text, tone) {
    state.logs.push({ tone: tone || '', text: text });
    renderLog();
  }

  function stamp() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : String(n); }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function setMsg(text, kind) {
    elMsg.textContent = text;
    elMsg.className = 'form-msg' + (kind ? ' is-' + kind : '');
  }

  function makeInput(labelText, value, multiline) {
    var wrap = document.createElement('div');
    wrap.className = 'field';

    var id = 'f' + (++state.seq);
    var label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = labelText;

    var input = document.createElement(multiline ? 'textarea' : 'input');
    input.id = id;
    if (multiline) { input.rows = 2; } else { input.type = 'text'; }
    input.value = value || '';

    wrap.appendChild(label);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function toMarkdown(rec) {
    var lines = [];
    lines.push('# ' + rec.title);
    lines.push('');
    lines.push('- 면접일: ' + rec.date);
    lines.push('- 문서 파일 ID: ' + rec.id);
    lines.push('- 상태: ' + STATUS_TEXT[rec.status]);
    lines.push('');
    lines.push('## 녹취 본문 (발췌)');
    lines.push('');
    var body = (rec.body || '').trim();
    if (body) {
      body.split('\n').forEach(function (line) {
        lines.push(line.trim() ? '> ' + line.trim() : '>');
      });
    } else {
      lines.push('> (녹취 본문 없음)');
    }
    lines.push('');
    lines.push('## 면접 평가');
    lines.push('');
    if (rec.eval && rec.eval.summary) {
      lines.push('- 요약: ' + rec.eval.summary);
      lines.push('- 강점: ' + (rec.eval.strength || '(미기재)'));
      lines.push('- 우려: ' + (rec.eval.concern || '(미기재)'));
      lines.push('- 추천: ' + (rec.eval.recommend || '(미기재)'));
      lines.push('- 확정: ' + (rec.status === 'confirmed' ? '사람이 원문 대조 후 확정' : '아직 확정 전'));
    } else {
      lines.push('- [AI 초안] 비어 있음. 자동화가 채우되, 사람이 원문과 대조해 확정해야 합니다.');
    }
    return lines.join('\n');
  }

  function renderStepper() {
    elStepper.textContent = '';
    STEPS.forEach(function (s, i) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'step';
      if (s.done) { btn.className += ' is-done'; }
      if (i === state.cursor && !s.done) { btn.className += ' is-active'; }
      if (i === state.selectedStep) { btn.className += ' is-selected'; }
      btn.setAttribute('aria-pressed', i === state.selectedStep ? 'true' : 'false');

      var num = document.createElement('span');
      num.className = 'step-num';
      num.textContent = 'STEP ' + (i + 1);

      var nm = document.createElement('span');
      nm.className = 'step-name';
      nm.textContent = s.name;

      var st = document.createElement('span');
      st.className = 'step-state';
      st.textContent = s.done ? '완료' : '대기';

      btn.appendChild(num);
      btn.appendChild(nm);
      btn.appendChild(st);
      btn.addEventListener('click', function () {
        state.selectedStep = i;
        renderStepper();
        renderStepDetail();
      });

      li.appendChild(btn);
      elStepper.appendChild(li);
    });
  }

  function renderStepDetail() {
    var s = STEPS[state.selectedStep];
    elStepDetail.textContent = '';
    var strong = document.createElement('strong');
    strong.textContent = 'STEP ' + (state.selectedStep + 1) + ' · ' + s.name + ' — ';
    elStepDetail.appendChild(strong);
    elStepDetail.appendChild(document.createTextNode(s.desc));
  }

  function renderLog() {
    elLog.textContent = '';
    if (!state.logs.length) {
      var p = document.createElement('p');
      p.className = 'log-empty';
      p.textContent = '실행 로그가 없습니다. 다음 단계 실행을 눌러 보세요.';
      elLog.appendChild(p);
      return;
    }
    state.logs.forEach(function (entry) {
      var p = document.createElement('p');
      if (entry.tone) { p.className = 'log-' + entry.tone; }
      var t = document.createElement('span');
      t.className = 'log-time';
      t.textContent = stamp();
      p.appendChild(t);
      p.appendChild(document.createTextNode(entry.text));
      elLog.appendChild(p);
    });
    elLog.scrollTop = elLog.scrollHeight;
  }

  function runStep() {
    if (state.cursor >= STEPS.length) {
      log('모든 단계를 마쳤습니다. 새 트랜스크립트를 등록해 다음 흐름을 확인하세요.', 'skip');
      return;
    }
    var s = STEPS[state.cursor];
    s.done = true;
    s.state = '완료';

    var line = s.name + ' 처리 완료.';
    var tone = 'ok';
    if (s.name === '저장소 자동 커밋') {
      line += ' 이력 파일 ' + state.records.length + '건을 확인했습니다.';
    }
    if (s.name === '시간 트리거 감지') {
      line += ' 미처리 문서 1건을 찾았습니다.';
      tone = 'skip';
    }
    log(line, tone);

    state.cursor += 1;
    state.selectedStep = Math.min(state.cursor, STEPS.length - 1);
    renderStepper();
    renderStepDetail();

    elRun.disabled = state.cursor >= STEPS.length;
    if (elRun.disabled) {
      elRun.textContent = '단계 모두 완료';
    }
  }

  function renderRecord(rec) {
    var card = document.createElement('article');
    card.className = 'record';

    var head = document.createElement('div');
    head.className = 'record-head';

    var left = document.createElement('div');
    var h3 = document.createElement('h3');
    h3.className = 'record-title';
    h3.textContent = rec.title;
    var meta = document.createElement('p');
    meta.className = 'record-meta';
    meta.textContent = '문서 파일 ID ' + rec.id + ' · 면접일 ' + rec.date;
    left.appendChild(h3);
    left.appendChild(meta);

    var pill = document.createElement('span');
    pill.className = 'pill pill-' + rec.status;
    pill.textContent = STATUS_TEXT[rec.status];

    head.appendChild(left);
    head.appendChild(pill);
    card.appendChild(head);

    var body = document.createElement('pre');
    body.className = 'record-body';
    body.textContent = toMarkdown(rec);
    card.appendChild(body);

    card.appendChild(buildEval(rec));
    return card;
  }

  function buildEval(rec) {
    var box = document.createElement('div');
    box.className = 'eval';

    var h4 = document.createElement('h4');
    h4.textContent = '평가 초안 (요약 · 강점 · 우려 · 추천)';
    box.appendChild(h4);

    var grid = document.createElement('div');
    grid.className = 'eval-grid';

    var draft = rec.eval || {};
    var fSummary = makeInput('요약', draft.summary, true);
    var fStrength = makeInput('강점', draft.strength, true);
    var fConcern = makeInput('우려', draft.concern, true);
    var fRecommend = makeInput('추천', draft.recommend, true);

    [fSummary, fStrength, fConcern, fRecommend].forEach(function (f) {
      grid.appendChild(f.wrap);
    });
    box.appendChild(grid);

    var actions = document.createElement('div');
    actions.className = 'eval-actions';

    var btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.className = 'btn btn-mini';
    btnSave.textContent = '초안 저장';
    btnSave.addEventListener('click', function () {
      rec.eval = {
        summary: fSummary.input.value.trim(),
        strength: fStrength.input.value.trim(),
        concern: fConcern.input.value.trim(),
        recommend: fRecommend.input.value.trim()
      };
      renderRecords();
      log('[' + rec.id + '] AI 초안을 저장했습니다. 아직 확정 전입니다.', 'skip');
    });
    actions.appendChild(btnSave);

    var check = document.createElement('label');
    check.className = 'check';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = rec.status === 'confirmed';
    var cbText = document.createElement('span');
    cbText.textContent = '원문과 대조했음';
    check.appendChild(cb);
    check.appendChild(cbText);
    actions.appendChild(check);

    var btnConfirm = document.createElement('button');
    btnConfirm.type = 'button';
    btnConfirm.className = 'btn btn-mini is-ghost';
    btnConfirm.textContent = '사람이 확정';
    btnConfirm.addEventListener('click', function () {
      if (!cb.checked) {
        log('[' + rec.id + '] 대조 확인이 없어 확정을 보류했습니다.', 'skip');
        return;
      }
      rec.status = 'confirmed';
      renderRecords();
      log('[' + rec.id + '] 사람이 원문 대조 후 확정을 마쳤습니다.', 'ok');
    });
    actions.appendChild(btnConfirm);

    var btnHold = document.createElement('button');
    btnHold.type = 'button';
    btnHold.className = 'btn btn-mini is-ghost';
    btnHold.textContent = '보류로 변경';
    btnHold.addEventListener('click', function () {
      rec.status = 'onhold';
      renderRecords();
      log('[' + rec.id + '] 보류로 변경했습니다. 재확인이 필요한 상태입니다.', 'skip');
    });
    actions.appendChild(btnHold);

    box.appendChild(actions);

    if (rec.eval && rec.eval.summary) {
      var pv = document.createElement('dl');
      pv.className = 'eval-preview';
      var pairs = [
        ['요약', rec.eval.summary],
        ['강점', rec.eval.strength || '(미기재)'],
        ['우려', rec.eval.concern || '(미기재)'],
        ['추천', rec.eval.recommend || '(미기재)']
      ];
      pairs.forEach(function (p) {
        var row = document.createElement('div');
        row.className = 'eval-row';
        var dt = document.createElement('dt');
        dt.textContent = p[0];
        var dd = document.createElement('dd');
        dd.textContent = p[1];
        row.appendChild(dt);
        row.appendChild(dd);
        pv.appendChild(row);
      });
      box.appendChild(pv);

      if (rec.status !== 'confirmed') {
        var note = document.createElement('p');
        note.className = 'eval-note';
        note.textContent = '초안 상태입니다. 확정 전까지는 판단 근거로 쓰지 않습니다.';
        box.appendChild(note);
      }
    }

    return box;
  }

  function visibleRecords() {
    if (state.filter === 'all') { return state.records; }
    return state.records.filter(function (r) { return r.status === state.filter; });
  }

  function renderRecords() {
    var list = visibleRecords();
    elRecords.textContent = '';
    list.forEach(function (rec) {
      elRecords.appendChild(renderRecord(rec));
    });

    elEmpty.hidden = list.length !== 0;

    var pending = state.records.filter(function (r) { return r.status === 'pending'; }).length;
    var confirmed = state.records.filter(function (r) { return r.status === 'confirmed'; }).length;
    var hold = state.records.filter(function (r) { return r.status === 'onhold'; }).length;
    elCount.textContent = '전체 ' + state.records.length + '건 · 검토 필요 ' + pending +
      '건 · 확정 ' + confirmed + '건 · 보류 ' + hold + '건 (표시 ' + list.length + '건)';
  }

  function setFilter(value) {
    state.filter = value;
    Array.prototype.forEach.call(elFilters.querySelectorAll('.chip'), function (chip) {
      var on = chip.getAttribute('data-filter') === value;
      chip.className = on ? 'chip is-active' : 'chip';
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderRecords();
  }

  function resetAll() {
    state.cursor = 0;
    state.seq = 0;
    state.filter = 'all';
    state.selectedStep = 0;
    state.records = clone(SEED_RECORDS);
    state.logs = clone(SEED_LOGS);

    STEPS.forEach(function (s, i) {
      s.done = i === 0;
      s.state = i === 0 ? '완료' : '대기';
    });

    elForm.reset();
    setMsg('');
    elRun.disabled = false;
    elRun.textContent = '다음 단계 실행';
    setFilter('all');
    renderStepper();
    renderStepDetail();
    renderLog();
    renderRecords();
  }

  elRun.addEventListener('click', runStep);

  elFilters.addEventListener('click', function (e) {
    var chip = e.target.closest ? e.target.closest('.chip') : null;
    if (chip) { setFilter(chip.getAttribute('data-filter')); }
  });

  elForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var docId = document.getElementById('doc-id').value.trim();
    var title = document.getElementById('doc-title').value.trim();
    var date = document.getElementById('doc-date').value.trim();
    var body = document.getElementById('doc-body').value.trim();

    if (!docId || !title || !date) {
      setMsg('문서 파일 ID, 면접 제목, 면접일을 모두 입력해 주세요.', 'err');
      return;
    }

    var dup = state.records.filter(function (r) { return r.id === docId; });
    if (dup.length) {
      setMsg('이미 동기화된 파일 ID입니다. 기존 평가를 보존하려 덮어쓰지 않고 건너뜁니다.', 'skip');
      log('[' + docId + '] 중복 감지. 재동기화 대신 건너뜁니다. 기존 평가를 보존했습니다.', 'skip');
      return;
    }

    var rec = {
      id: docId,
      title: title,
      date: date,
      status: 'pending',
      body: body || '(녹취 본문 없음)',
      eval: null
    };
    state.records.push(rec);

    setMsg('동기화했습니다. 새 카드가 추가됐습니다. 평가 초안을 작성해 보세요.', 'ok');
    log('[' + docId + '] 새 문서 감지 → 마크다운 변환 → records 폴더에 커밋 (총 ' + state.records.length + '건)', 'ok');

    document.getElementById('doc-id').value = '';
    document.getElementById('doc-title').value = '';
    document.getElementById('doc-body').value = '';

    state.filter = 'all';
    setFilter('all');
  });

  elReset.addEventListener('click', resetAll);

  resetAll();
})();
