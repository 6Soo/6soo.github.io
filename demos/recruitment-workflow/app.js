(function () {
  'use strict';

  var STAGES = [
    { id: 1, name: '1단계 사전문답' },
    { id: 2, name: '2단계 온라인 면접' },
    { id: 3, name: '3단계 모객글 과제' },
    { id: 4, name: '4단계 대면 계약' }
  ];

  /* 면접 텍스트 문서를 모의한 합성 데이터. 실제 발화가 아니다. */
  var TRANSCRIPTS = [
    {
      id: 'doc-2401',
      title: '면접실-A-2026-03-10-1052',
      applicant: 'A-1042',
      stage: 1,
      date: '2026-03-10',
      minutes: 18,
      keywords: ['리드', '계약 조건', '현장 대응'],
      turns: [
        { q: '가이드 업무에서 가장 중요하게 보는 부분은?', a: '예약자 이탈 구간의 응대와 일정 조율이라고 답함.' },
        { q: '조건이 정해지지 않았을 때 어떻게 결정하나요?', a: '가능한 선택지를 정리해 확인한 뒤 결정한다고 답함.' }
      ]
    },
    {
      id: 'doc-2402',
      title: '면접실-A-2026-03-11-1130',
      applicant: 'A-2071',
      stage: 2,
      date: '2026-03-11',
      minutes: 42,
      keywords: ['현장 사진 정리', '카페 글 작성', '문의 응대'],
      turns: [
        { q: '모객글을 쓸 때 무엇을 먼저 준비하나요?', a: '출발지와 소요 시간, 예약을 확정해 두고 쓰는 편이라고 답함.' },
        { q: '문서 사진이 흩어져 있을 때 어떻게 정리하나요?', a: '날짜와 지역 기준으로 묶어 목록을 만든 뒤 필요한 것만 골랐다고 답함.' },
        { q: '문의가 몰리는 시간대는 언제인가요?', a: '출발 전날과 당일 아침이 가장 많다고 답함.' }
      ]
    },
    {
      id: 'doc-2403',
      title: '면접실-B-2026-03-12-1005',
      applicant: 'B-3310',
      stage: 2,
      date: '2026-03-12',
      minutes: 37,
      keywords: ['예약금 정산', '일정 조율', '분쟁 대응'],
      turns: [
        { q: '예약 조건이 서로 다를 때 기준을 어떻게 잡나요?', a: '처음 합의한 조건을 문서로 남기고 그 기준에서만 조율한다고 답함.' },
        { q: '이용자 불편이 생기면 어떻게 하나요?', a: '먼저 상황을 정리해 전달하고 가능한 선택지를 두 개 안에서 제시한다고 답함.' }
      ]
    },
    {
      id: 'doc-2404',
      title: '온라인-면접-2026-03-13-1412',
      applicant: 'B-4486',
      stage: 3,
      date: '2026-03-13',
      minutes: 55,
      keywords: ['과제 제출', '가격 정보 표기', '문의 대응'],
      turns: [
        { q: '과제 글에서 금액 정보를 어떻게 표기했나요?', a: '여행비와 예약금, 잔금, 항공료를 구분해 표로 정리했다고 답함.' },
        { q: '오해를 부르기 쉬웠던 부분이 있었나요?', a: '잔금 지급 시점이 애매해 문구를 두 번 고쳤다고 답함.' }
      ]
    },
    {
      id: 'doc-2405',
      title: '면접실-A-2026-03-14-1058',
      applicant: 'C-5512',
      stage: 4,
      date: '2026-03-14',
      minutes: 26,
      keywords: ['계약 조건 확인', '정산 기준', '출근 형태'],
      turns: [
        { q: '정산 기준을 어떻게 잡을까요?', a: '일 단위와 건 단위를 함께 적어 두는 편이라고 답함.' },
        { q: '문의 창구는 하나로 모으고 싶습니다.', a: '응대 문구를 정리해 공유하는 방식을 제안함.' }
      ]
    },
    {
      id: 'doc-2406',
      title: '사전문답-2026-03-15-0940',
      applicant: 'C-6620',
      stage: 1,
      date: '2026-03-15',
      minutes: 6,
      keywords: ['출근 가능일', '간단 소개'],
      turns: [
        { q: '가이드 소개를 한 문장으로 해주세요.', a: '이동 동선을 정리해 전달하는 일을 맡고 있다고 답함.' }
      ]
    }
  ];

  var APPLICANTS = [
    { id: 'A-1042', alias: '가명 지원자 가', stage: 1 },
    { id: 'A-2071', alias: '가명 지원자 나', stage: 2 },
    { id: 'B-3310', alias: '가명 지원자 다', stage: 2 },
    { id: 'B-4486', alias: '가명 지원자 라', stage: 3 },
    { id: 'C-5512', alias: '가명 지원자 마', stage: 4 },
    { id: 'C-6620', alias: '가명 지원자 바', stage: 1 }
  ];

  var RECOMMENDATION = {
    1: '사전 확인 결과만으로는 합격 판단을 내리지 않고 다음 단계 검토로 넘깁니다.',
    2: '응답이 구체적이어서 조건부 추천. 3단계 과제로 진행 여부를 판단합니다.',
    3: '과제에서 금액 정보를 구분해 정리한 점을 확인했고, 진행 여부를 검토합니다.',
    4: '대면에서 정산 기준과 문의 창구를 함께 맞추고 계약으로 넘어갑니다.'
  };

  var CONCERN = {
    1: '소요 시간이 짧아 영역 판단이 제한적입니다. 2단계 면접에서 확인이 필요합니다.',
    2: '정산과 분쟁 대응의 실제 경험이 얕아 보입니다. 과제 단계에서 검증이 필요합니다.',
    3: '잔금 지급 시점처럼 오해가 생기기 쉬운 항목을 다시 맞추는 편이 안전합니다.',
    4: '정산 기준 문구를 합의 전에 문서로 남기는 절차를 확인하는 편이 안전합니다.'
  };

  var state = null;
  var dom = {};

  function stageName(stage) {
    var found = STAGES.filter(function (s) { return s.id === stage; })[0];
    return found ? found.name : '미지정';
  }

  function findTranscript(id) {
    var hit = null;
    TRANSCRIPTS.forEach(function (t) { if (t.id === id) hit = t; });
    return hit;
  }

  function findRecord(id) {
    var hit = null;
    state.records.forEach(function (r) { if (r.id === id) hit = r; });
    return hit;
  }

  function applicantById(id) {
    var hit = null;
    APPLICANTS.forEach(function (a) { if (a.id === id) hit = a; });
    return hit;
  }

  function buildBody(t, memo) {
    var items = t.turns.map(function (turn, index) {
      return 'Q' + (index + 1) + '. ' + turn.q + ' → ' + turn.a;
    });
    return [
      {
        h: '면접 기본',
        items: [
          '일시: ' + t.date,
          '지원자: ' + t.applicant + ' (합성 예시)',
          '구분: ' + stageName(t.stage),
          '소요: ' + t.minutes + '분 / 문답 ' + t.turns.length + '건'
        ]
      },
      { h: '질문과 답변 요지', items: items },
      { h: '운영자 확인 메모', items: [memo && memo.trim() ? memo.trim() : '(입력 없음)'] }
    ];
  }

  function buildDraft(t) {
    return {
      summary: '총 ' + t.minutes + '분, 문답 ' + t.turns.length + '건. 주요 키워드는 ' +
        t.keywords.join(', ') + '입니다.',
      strengths: t.turns.map(function (turn, index) {
        return '응답 ' + (index + 1) + ': ' + turn.a;
      }).join(' '),
      concerns: CONCERN[t.stage],
      recommendation: RECOMMENDATION[t.stage]
    };
  }

  function makeRecord(t, status, memo) {
    var record = {
      id: t.id,
      title: t.title,
      applicant: t.applicant,
      stage: t.stage,
      path: 'records/2026/' + t.date + '__' + t.applicant + '-' + t.id + '.md',
      status: status,
      memo: memo || '',
      body: buildBody(t, memo),
      draft: buildDraft(t)
    };
    return record;
  }

  function initialState() {
    var first = TRANSCRIPTS[0];
    return {
      records: [
        makeRecord(first, 'confirmed', '원문 대조 완료. 2단계 진행 여부는 운영자가 재확인하기로 함.')
      ],
      applicants: APPLICANTS.map(function (a) { return { id: a.id, alias: a.alias, stage: a.stage }; }),
      selectedRecordId: null,
      log: [
        { step: '기록 저장소 확인', text: '기존 기록 1개 확인: ' + first.applicant + ' / 확정 상태', tone: 'note' },
        { step: '동기화 대기', text: '새 면접 텍스트 문서 ' + (TRANSCRIPTS.length - 1) + '건 대기 중', tone: 'new' }
      ]
    };
  }

  function addLog(step, text, tone) {
    state.log.unshift({ step: step, text: text, tone: tone || 'note' });
    if (state.log.length > 40) state.log.length = 40;
  }

  function syncOne(t, forceNote) {
    var record = findRecord(t.id);
    if (!record) {
      state.records.push(makeRecord(t, 'draft', ''));
      addLog('새 문서 감지', t.title + ' → 마크다운 기록 생성 (' + t.applicant + ')', 'new');
      return 'created';
    }
    if (record.status === 'confirmed') {
      record.stage = t.stage;
      record.body = buildBody(t, record.memo);
      addLog('확정 파일 보호', t.title + ' · 확정 평가와 운영자 메모는 유지하고 본문만 갱신했습니다.', 'keep');
      return 'kept';
    }
    record.stage = t.stage;
    record.body = buildBody(t, '');
    record.draft = buildDraft(t);
    addLog('초안 파일 갱신', t.title + ' · 확정 전 초안이라 평가 문구를 다시 채웠습니다.', 'note');
    return 'updated';
  }

  function resetState() {
    state = initialState();
    dom.docSearch.value = '';
    dom.recordSearch.value = '';
    dom.recordFilter.value = 'all';
    addLog('초기화', '화면 상태를 처음 상태로 되돌렸습니다.', 'note');
    renderAll();
  }

  /* ---------- 렌더링 ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function renderDocs() {
    var query = (dom.docSearch.value || '').trim().toLowerCase();
    var list = dom.docList;
    list.textContent = '';

    TRANSCRIPTS.forEach(function (t) {
      var synced = !!findRecord(t.id);
      if (query) {
        var hay = (t.title + ' ' + t.applicant + ' ' + stageName(t.stage)).toLowerCase();
        if (hay.indexOf(query) === -1) return;
      }

      var li = el('li');
      var row = el('div', 'docrow');

      var btn = el('button', 'docitem');
      btn.type = 'button';
      btn.title = '이 문서의 동기화 결과를 미리 봅니다';
      btn.appendChild(el('span', 'doctitle', t.title));
      btn.appendChild(el('span', 'docmeta', t.applicant + ' · ' + t.date + ' · ' + t.minutes + '분'));
      btn.addEventListener('click', function () {
        var record = findRecord(t.id);
        if (!record) {
          var result = syncOne(t);
          if (result === 'created') {
            state.selectedRecordId = t.id;
            addLog('선택 미리보기', '새로 만들어진 기록을 바로 펼쳤습니다.', 'new');
          }
          renderAll();
          if (result === 'created') focusDetail();
          return;
        }
        state.selectedRecordId = t.id;
        renderAll();
        focusDetail();
      });

      var pill = synced
        ? el('span', 'pill pill-ok', '동기화됨')
        : el('span', 'pill pill-new', '미동기화');

      row.appendChild(btn);
      row.appendChild(pill);
      li.appendChild(row);
      list.appendChild(li);
    });

    var pending = TRANSCRIPTS.filter(function (t) { return !findRecord(t.id); }).length;
    dom.docCount.textContent = pending > 0 ? '미동기화 ' + pending + '건' : '모두 동기화됨';
  }

  function renderLog() {
    var list = dom.logList;
    list.textContent = '';
    state.log.forEach(function (entry) {
      var li = el('li', 'tone-' + entry.tone);
      li.appendChild(el('b', null, entry.step));
      li.appendChild(document.createTextNode(entry.text));
      list.appendChild(li);
    });
  }

  function renderRecords() {
var query = (dom.recordSearch.value || '').trim().toLowerCase();
  var filter = dom.recordFilter.value || 'all';
    var list = dom.recordList;
    list.textContent = '';

    state.records.forEach(function (record) {
      if (filter !== 'all' && record.status !== filter) return;
      if (query) {
        var hay = (record.title + ' ' + record.applicant + ' ' + record.path).toLowerCase();
        if (hay.indexOf(query) === -1) return;
      }

      var li = el('li');
      if (record.id === state.selectedRecordId) li.className = 'selected';
      var row = el('div', 'recordrow');

      var btn = el('button', 'recorditem');
      btn.type = 'button';
      btn.appendChild(el('span', 'doctitle', record.title));
      btn.appendChild(el('span', 'recordmeta', record.path));
      btn.addEventListener('click', function () {
        state.selectedRecordId = record.id;
        renderAll();
        focusDetail();
      });

      row.appendChild(btn);
      row.appendChild(el('span', 'pill pill-stage', record.applicant + ' · ' + stageName(record.stage)));
      row.appendChild(el('span', record.status === 'confirmed' ? 'pill pill-confirmed' : 'pill pill-draft',
        record.status === 'confirmed' ? '확정' : '초안'));
      li.appendChild(row);
      list.appendChild(li);
    });

    dom.recordCount.textContent = state.records.length + '건';
  }

  function field(labelText, value, key, record) {
    var wrap = el('div', 'draftrow');
    var label = el('label', null, labelText);
    var area = el('textarea');
    area.value = value;
    area.id = 'draft-' + key;
    area.addEventListener('input', function () {
      record.draft[key] = area.value;
      if (record.status === 'confirmed') dom.detailState.textContent = '확정 상태 · 내용을 수정하면 다음 동기화에도 이 문구가 유지됩니다.';
    });
    label.setAttribute('for', area.id);
    wrap.appendChild(label);
    wrap.appendChild(area);
    return wrap;
  }

  function renderDetail() {
    var box = dom.detailBody;
    box.textContent = '';

    var record = state.selectedRecordId ? findRecord(state.selectedRecordId) : null;
    if (!record) {
      dom.detailTitle.textContent = '기록 미리보기';
      dom.detailState.textContent = '왼쪽에서 기록을 선택하세요.';
      box.appendChild(el('p', 'empty', '선택된 기록이 없습니다. 동기화를 실행한 뒤 기록을 골라 주세요.'));
      dom.resyncBtn.disabled = true;
      return;
    }

    var transcript = findTranscript(record.id);
    dom.resyncBtn.disabled = false;
    dom.detailTitle.textContent = record.title;
    dom.detailState.textContent = record.status === 'confirmed'
      ? '확정 상태 · 재동기화해도 평가와 메모가 유지됩니다.'
      : '초안 상태 · 재동기화하면 평가 문구가 다시 채워집니다.';

    var md = el('div', 'markdown');
    md.appendChild(el('p', 'pathline', record.path));
    md.appendChild(el('p', null, stageName(record.stage) + ' · ' + record.applicant + ' · ' + (transcript ? transcript.date : '')));

    record.body.forEach(function (section) {
      md.appendChild(el('h4', null, section.h));
      var ul = el('ul');
      section.items.forEach(function (item) { ul.appendChild(el('li', null, item)); });
      md.appendChild(ul);
    });
    box.appendChild(md);

    var memoWrap = el('div', 'draftrow notememo');
    var memoLabel = el('label', null, '운영자 확인 메모 (직접 입력)');
    var memoArea = el('textarea');
    memoArea.id = 'memo-area';
    memoArea.value = record.memo;
    memoArea.addEventListener('input', function () { record.memo = memoArea.value; });
    memoLabel.setAttribute('for', 'memo-area');
    memoWrap.appendChild(memoLabel);
    memoWrap.appendChild(memoArea);
    box.appendChild(memoWrap);

    var stateLine = el('div', 'draftstate');
    stateLine.appendChild(el('span', record.status === 'confirmed' ? 'pill pill-confirmed' : 'pill pill-draft',
      record.status === 'confirmed' ? '평가 확정됨' : 'AI 초안(미확정)'));
    stateLine.appendChild(el('span', 'muted', '확정은 사람이 원문과 대조해 직접 내립니다.'));
    box.appendChild(stateLine);

    var form = el('div', 'draftform');
    form.appendChild(el('h3', null, '평가 초안'));
    form.appendChild(field('요약', record.draft.summary, 'summary', record));
    form.appendChild(field('강점', record.draft.strengths, 'strengths', record));
    form.appendChild(field('우려', record.draft.concerns, 'concerns', record));
    form.appendChild(field('추천', record.draft.recommendation, 'recommendation', record));
    box.appendChild(form);

    var actions = el('div', 'toolbar');
    var confirmBtn = el('button', 'btn btn-primary', '초안 확정');
    confirmBtn.type = 'button';
    confirmBtn.disabled = record.status === 'confirmed';
    confirmBtn.addEventListener('click', function () {
      if (record.status === 'confirmed') return;
      record.status = 'confirmed';
      addLog('사람 확정', record.applicant + ' · 평가 초안을 확정했습니다. 이후 동기화에서 보존됩니다.', 'keep');
      renderAll();
    });
    actions.appendChild(confirmBtn);

    var note = el('p', 'toolbar-note', '확정은 버튼을 누른 사람만 할 수 있고, 데모 안에서만 적용됩니다.');
    actions.appendChild(note);
    box.appendChild(actions);

    if (record.status === 'confirmed') {
      box.appendChild(el('p', 'lockmsg',
        '확정 파일은 파일 ID로 추적합니다. 같은 문서를 다시 동기화해도 본문만 갱신되고 확정된 평가와 메모는 그대로 남습니다.'));
    } else {
      box.appendChild(el('p', 'hintmsg',
        '아직 확정 전입니다. 이 상태에서 재동기화하면 평가 문구(요약·강점·우려·추천)가 새로 채워집니다. 직접 적어 둔 메모는 그대로 남습니다.'));
    }
  }

  function renderBoard() {
    var board = dom.stageBoard;
    board.textContent = '';

    state.applicants.forEach(function (applicant) {
      var records = state.records.filter(function (r) { return r.applicant === applicant.id; });
      var confirmed = records.some(function (r) { return r.status === 'confirmed'; });

      var card = el('li', 'stagecard');
      card.appendChild(el('h4', null, applicant.alias));
      card.appendChild(el('p', 'who', '지원자 번호 ' + applicant.id + ' · 현재 ' + stageName(applicant.stage)));

      var steps = el('div', 'steps');
      STAGES.forEach(function (stage) {
        var btn = el('button', 'stagebtn', String(stage.id));
        btn.type = 'button';
        btn.title = stage.name;
        btn.setAttribute('aria-pressed', applicant.stage === stage.id ? 'true' : 'false');
        btn.addEventListener('click', function () {
          if (applicant.stage === stage.id) return;
          applicant.stage = stage.id;
          var touched = 0;
          state.records.forEach(function (record) {
            if (record.applicant !== applicant.id) return;
            record.stage = stage.id;
            touched += 1;
          });
          addLog('전형 단계 변경', applicant.id + ' · ' + stageName(stage.id) +
            ' (기록 ' + touched + '건 갱신, 평가 초안은 그대로 유지)', 'new');
          renderAll();
        });
        steps.appendChild(btn);
      });
      card.appendChild(steps);

      var note = '기록 ' + records.length + '건' + (confirmed ? ' · 확정 기록 있음(단계 변경해도 평가 보존)' : ' · 확정 기록 없음');
      card.appendChild(el('p', 'stagenote', note));
      board.appendChild(card);
    });
  }

  function focusDetail() {
    if (dom.detailPanel && dom.detailPanel.scrollIntoView) {
      dom.detailPanel.scrollIntoView({ block: 'nearest' });
    }
  }

  function renderAll() {
    renderDocs();
    renderLog();
    renderRecords();
    renderDetail();
    renderBoard();
  }

  /* ---------- 이벤트 ---------- */

  function onSyncAll() {
    var created = 0; var updated = 0; var kept = 0;
    var firstCreated = null;
    TRANSCRIPTS.forEach(function (t) {
      var result = syncOne(t);
      if (result === 'created') {
        created += 1;
        if (!firstCreated) firstCreated = t.id;
      } else if (result === 'updated') {
        updated += 1;
      } else {
        kept += 1;
      }
    });
    addLog('동기화 실행', '신규 ' + created + '건 · 갱신 ' + updated + '건 · 확정 보존 ' + kept + '건', 'new');
    if (firstCreated) state.selectedRecordId = firstCreated;
    renderAll();
  }

  function onResync() {
    var record = state.selectedRecordId ? findRecord(state.selectedRecordId) : null;
    if (!record) {
      addLog('재동기화', '먼저 기록을 선택하세요.', 'note');
      renderAll();
      return;
    }
    var transcript = findTranscript(record.id);
    if (!transcript) return;
    syncOne(transcript);
    renderAll();
  }

  function init() {
    dom = {
      docList: document.getElementById('docList'),
      docCount: document.getElementById('docCount'),
      docSearch: document.getElementById('docSearch'),
      logList: document.getElementById('logList'),
      recordList: document.getElementById('recordList'),
      recordCount: document.getElementById('recordCount'),
      recordSearch: document.getElementById('recordSearch'),
      recordFilter: document.getElementById('recordFilter'),
      detailBody: document.getElementById('detailBody'),
      detailTitle: document.getElementById('detailTitle'),
      detailState: document.getElementById('detailState'),
      detailPanel: document.getElementById('detailPanel'),
      stageBoard: document.getElementById('stageBoard'),
      syncBtn: document.getElementById('syncBtn'),
      resyncBtn: document.getElementById('resyncBtn'),
      resetBtn: document.getElementById('resetBtn')
    };

    dom.syncBtn.addEventListener('click', onSyncAll);
    dom.resyncBtn.addEventListener('click', onResync);
    dom.resetBtn.addEventListener('click', resetState);
    dom.docSearch.addEventListener('input', renderDocs);
    dom.recordSearch.addEventListener('input', renderRecords);
    dom.recordFilter.addEventListener('change', renderRecords);

    state = initialState();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();