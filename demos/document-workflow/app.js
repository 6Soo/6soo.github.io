(function () {
  'use strict';

  /* ------------------------------------------------------------------
     합성 데이터 데모: 변호사 사건 자료·문서 자동화 워크플로우
     외부 요청, 저장소, 계정, 전송 기능 없음. 상태는 메모리에만 존재.
     ------------------------------------------------------------------ */

  var MATTERS = {
    civil: {
      label: '민사 자료',
      months: 1,
      notice: '접수 1개월 뒤 내부 검토일을 표시하는 합성 예시입니다. 법정 기한이 아닙니다.',
      checklist: ['상담 기록 작성', '소멸시효 증빙 확보', '소장 초안 검토', '송달 확인']
    },
    debt: {
      label: '채무불이행',
      months: 1,
      notice: '접수 1개월 뒤 내부 검토일을 표시하는 합성 예시입니다. 법정 기한이 아닙니다.',
      checklist: ['채무 확인서 수집', '상환 내역 대조', '소장 초안 검토', '송달 확인']
    },
    criminal: {
      label: '형사 고소',
      months: 1,
      notice: '접수 1개월 뒤 내부 검토일을 표시하는 합성 예시입니다. 법정 기한이 아닙니다.',
      checklist: ['고소 사실관계 정리', '자료 목록 정리', '고소장 초안 검토', '사건 배정 확인']
    },
    admin: {
      label: '행정 심판 / 진정',
      months: 1,
      notice: '접수 1개월 뒤 내부 검토일을 표시하는 합성 예시입니다. 법정 기한이 아닙니다.',
      checklist: ['처분 내용 확인', '심판 기한 계산', '심판 신청서 작성', '접수증 수령']
    }
  };

  var DOCS = {
    criminal: {
      title: '고 소 장 초 안',
      head: function (c) {
        return '고 소 자 : (의뢰인 성명)\n피고소자 : (피고소자 성명)\n부 적 : ' + c.kind + ' 관련 고소';
      },
      body: function (c) {
        return [
          '1. 사건 요지',
          '의뢰인은 피고소자로부터 ' + c.amountText + ' 상당의 대가를 지급하고 대상 물품을 취득하려 했으나,',
          '지급 이후 물품이 전달되지 않고, 물건의 소재에 관한 설명이 계속 서로 달라 계약 불이행이 반복되었습니다.',
          '상담 시 확인된 사실과 확보된 자료의 범위는 아래 3. 인용 자료와 같습니다.',
          '',
          '2. 관련 법리 (일반적 검토 사항, 사건별 확인 필요)',
          '- 계약 체결과 이행의 증명 -> 계약서, 지급 내역, 수령 기록',
          '- 사기죄 성립 가능성 -> 기망의 정도, 재산 이득의 취득, 상대방의 의도',
          '- 피해 금액 -> 실제 지급액과 반환 여부로 산정',
          '',
          '3. 인용 자료 (이 데모에서 근거로 선택한 항목만 표시)',
          '{CITE}',
          '',
          '4. 확인이 필요한 사항',
          '- 각 자료의 발급 시점과 원본 보관 위치',
          '- 상대방 진술과 자료상 내용 사이에 어긋나는 부분',
          '- 제3자 증인 및 상대방의 재산 현황 확인 가능성'
        ].join('\n');
      },
      tail: '위 사실과 확보한 자료를 정리하여 기재합니다.'
    },
    civil: {
      title: '민 사 소 장 초 안',
      head: function (c) {
        return '소 기 원 : (원고 성명)\n피 고 원 : (피고 성명)\n청 구 원 금 : ' + c.amountText;
      },
      body: function (c) {
        return [
          '제 1 항. 청구취지',
          '1. 피고는 원고에게 ' + c.amountText + ' 상당의 채무를 부담한다.',
          '2. 피고는 원고에게 위 1.의 금액과 그 지연손해금을 지급하라.',
          '',
          '제 2 항. 사실관계',
          '원고는 피고와의 계약에 따라 대금을 지급하였으나, 피고는 계약상 목적을 달성하지 못하였다.',
          '피고가 기한 내 지급하지 아니하여 원고가 본 소를 제기한다.',
          '',
          '제 3 항. 이유 (근거 자료 중심)',
          '- 계약 성립의 증명',
          '- 원고의 이행 및 피고의 불이행에 관한 자료',
          '- 손해 산정 자료',
          '',
          '제 4 항. 적용 법리 (사건별 검토 필요)',
          '- 채무불이행에 기초한 손해배상 청구',
          '- 소멸시효 관련: 시효 중단, 승인, 시효 완성에 관한 자료 확인',
          '',
          '제 5 항. 인용 자료 (근거로 선택한 항목만 표시)',
          '{CITE}'
        ].join('\n');
      },
      tail: '위 사실 및 이유에 따라 본 소를 제기함.'
    },
    claim: {
      title: '내 용 증 명 초 안',
      head: function (c) {
        return '수 신 : (상대방 성명)\n발 송 일 : 접수일 기준\n참 조 : ' + c.kind;
      },
      body: function (c) {
        return [
          '1. 요지',
          '당사는 귀하와 체결한 계약에 따라 ' + c.amountText + ' 상당의 대금을 지급하였으나,',
          '귀하로부터 계약상 의무 이행에 관한 어떠한 설명도 받지 못한 상태입니다.',
          '',
          '2. 요청 사항',
          '- 계약서 원본 및 이행 관련 서류의 제출',
          '- 반환 또는 이행 계획에 대한 서면 회신',
          '',
          '3. 회신 기한 및 미회신 시 대응',
          '- 기한 내 회신이 없으면 본 사유에 따른 조치를 검토할 예정입니다.',
          '- 회신 기한, 송달 방법, 보존 자료는 별도로 기록합니다.',
          '',
          '4. 근거 자료 목록 (근거로 선택한 항목만 표시)',
          '{CITE}',
          '',
          '5. 회신 기한 계산 메모',
          '접수일로부터 미리 잡아 둔 기한까지 며칠이 남았는지 사건 카드에서 확인합니다(데모용 참고 규칙).'
        ].join('\n');
      },
      tail: '위와 같이 요청드리오니 성의 검토 부탁드립니다.'
    }
  };

  var CLASSES = [
    { key: 'evidence', label: '증거', note: '청구·고소 근거로 인용 대상' },
    { key: 'ref', label: '참고', note: '맥락 확인용' },
    { key: 'hold', label: '보류', note: '개인정보·불명확, 인용 보류' }
  ];
  var STATES = [
    { key: 'memo', label: '미검토' },
    { key: 'ing', label: '검토중' },
    { key: 'done', label: '확정' }
  ];

  var CHECKLIST_DONE_DEFAULT = ['상담 기록 작성'];

  function iso(d) {
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }
  function fmt(isoStr) {
    if (!isoStr) return '—';
    var parts = isoStr.split('-');
    return parts[0] + '.' + parts[1] + '.' + parts[2];
  }
  function fmtDay(d) { return d.toLocaleDateString('ko-KR'); }
  function won(n) {
    if (!n || n <= 0) return '금액 미입력';
    return n.toLocaleString('ko-KR') + '원';
  }
  function addMonths(isoStr, m) {
    var p = isoStr.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1 + m, Number(p[2]));
    return iso(d);
  }
  function daysBetween(fromIso, toIso) {
    var a = fromIso.split('-'), b = toIso.split('-');
    var da = Date.UTC(Number(a[0]), Number(a[1]) - 1, Number(a[2]));
    var db = Date.UTC(Number(b[0]), Number(b[1]) - 1, Number(b[2]));
    return Math.round((db - da) / 86400000);
  }
  function say(node, text, warn) {
    node.textContent = text;
    node.classList.toggle('warn', !!warn);
  }

  /* ------------------------- 합성 시드 데이터 ------------------------- */

  function seed() {
    var today = iso(new Date());
    var cases = [
      {
        id: 'c1',
        client: '(가칭) 청담상사 최민호',
        kindKey: 'criminal',
        amount: 18000000,
        received: addMonths(today, -8),
        note: '대금 지급 후 물품 미인계. 상대방이 기한 내 회신을 거부한 purported 사실관계 정리.',
        picked: ['i1', 'i3', 'i5'],
        items: [
          { id: 'i1', name: '계약서 스캔본', cat: '계약서', form: 'PDF 이미지', cls: 'evidence', st: 'done' },
          { id: 'i2', name: '대금 지급 내역', cat: '증빙', form: '표 형식', cls: 'evidence', st: 'done' },
          { id: 'i3', name: '미인계 관련 카톡 캡처', cat: '대화', form: '이미지', cls: 'evidence', st: 'ing' },
          { id: 'i4', name: '상담 메모', cat: '내부', form: '메모', cls: 'ref', st: 'done' },
          { id: 'i5', name: '환불 요청 회신 캡처', cat: '대화', form: '이미지', cls: 'hold', st: 'memo' }
        ],
        checks: { '상담 기록 작성': true }
      },
      {
        id: 'c2',
        client: '(가칭) 한빛물산 박서준',
        kindKey: 'civil',
        amount: 6400000,
        received: addMonths(today, -14),
        note: '공급 대금 중 일부가 미지급. 자진 상환이 3차례나 있었음.',
        picked: ['j1'],
        items: [
          { id: 'j1', name: '공급 확인서 및 세금계산서', cat: '증빙', form: '문서', cls: 'evidence', st: 'done' },
          { id: 'j2', name: '상환 약정 메모', cat: '대화', form: '메모', cls: 'evidence', st: 'ing' },
          { id: 'j3', name: '대표자 주소 확인 자료', cat: '개인', form: '이미지', cls: 'hold', st: 'memo' }
        ],
        checks: { '채무 확인서 수집': true, '상환 내역 대조': true }
      }
    ];
    cases.forEach(function (c) { c.deadline = addMonths(c.received, MATTERS[c.kindKey].months); });
    return { cases: cases, activeId: 'c1', draft: null };
  }

  var state = seed();
  var seq = 0;

  var el = {
    form: document.getElementById('intakeForm'),
    client: document.getElementById('fClient'),
    matter: document.getElementById('fMatter'),
    amount: document.getElementById('fAmount'),
    date: document.getElementById('fDate'),
    note: document.getElementById('fNote'),
    intakeMsg: document.getElementById('intakeMsg'),
    caseGrid: document.getElementById('caseGrid'),
    caseMsg: document.getElementById('caseMsg'),
    activeCaseName: document.getElementById('activeCaseName'),
    itemBody: document.getElementById('itemBody'),
    itemMsg: document.getElementById('itemMsg'),
    docSel: document.getElementById('fDoc'),
    draftOut: document.getElementById('draftOut'),
    draftMsg: document.getElementById('draftMsg')
  };

  el.date.value = iso(new Date());

  function activeCase() {
    for (var i = 0; i < state.cases.length; i++) {
      if (state.cases[i].id === state.activeId) return state.cases[i];
    }
    return state.cases[0] || null;
  }
  function nextId(prefix) {
    seq += 1;
    return prefix + 'x' + seq;
  }

  /* --------------------------- 사건 목록 --------------------------- */

  function buildCaseCard(c) {
    var m = MATTERS[c.kindKey];
    var card = document.createElement('div');
    card.className = 'case-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-pressed', c.id === state.activeId ? 'true' : 'false');
    card.setAttribute('data-id', c.id);

    var top = document.createElement('div');
    top.className = 'case-top';
    var h = document.createElement('p');
    h.className = 'case-name';
    h.textContent = c.client;
    var kind = document.createElement('span');
    kind.className = 'case-kind';
    kind.textContent = m.label;
    top.appendChild(h);
    top.appendChild(kind);
    card.appendChild(top);

    var meta = document.createElement('p');
    meta.className = 'case-meta';
    meta.appendChild(document.createTextNode('금액 '));
    var b = document.createElement('b');
    b.textContent = won(c.amount);
    meta.appendChild(b);
    meta.appendChild(document.createTextNode(' · 접수 ' + fmt(c.received) + ' · 자료 ' + c.items.length + '건'));
    card.appendChild(meta);

    if (c.note) {
      var note = document.createElement('p');
      note.className = 'case-note';
      note.textContent = c.note;
      card.appendChild(note);
    }

    var left = daysBetween(iso(new Date()), c.deadline);
    var dl = document.createElement('div');
    dl.className = 'case-dead';
    var dlText = document.createElement('span');
    dlText.textContent = '예상 기한 ' + fmt(c.deadline);
    var days = document.createElement('span');
    days.className = 'days' + (left < 0 ? ' over' : left <= 30 ? ' soon' : '');
    days.textContent = left < 0 ? '기간 초과 ' + Math.abs(left) + '일' : '잔여 ' + left + '일';
    dl.appendChild(dlText);
    dl.appendChild(days);
    card.appendChild(dl);

    var ul = document.createElement('ul');
    ul.className = 'checklist';
    m.checklist.forEach(function (label) {
      var li = document.createElement('li');
      var lb = document.createElement('label');
      lb.className = 'chk';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!c.checks[label];
      cb.addEventListener('click', function (ev) { ev.stopPropagation(); });
      cb.addEventListener('change', function () {
        c.checks[label] = cb.checked;
        var total = m.checklist.length;
        var done = Object.keys(c.checks).filter(function (k) { return m.checklist.indexOf(k) >= 0 && c.checks[k]; }).length;
        say(el.caseMsg, c.client + ': 절차 진행 ' + done + '/' + total + ' 완료로 표시했습니다.');
      });
      var sp = document.createElement('span');
      sp.textContent = label;
      lb.appendChild(cb);
      lb.appendChild(sp);
      li.appendChild(lb);
      ul.appendChild(li);
    });
    card.appendChild(ul);

    function pick() { selectCase(c.id); }
    card.addEventListener('click', pick);
    card.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); }
    });
    return card;
  }

  function renderCases() {
    el.caseGrid.textContent = '';
    state.cases.forEach(function (c) { el.caseGrid.appendChild(buildCaseCard(c)); });
    if (!state.cases.length) {
      var p = document.createElement('p');
      p.className = 'empty';
      p.textContent = '등록된 사건이 없습니다. 위 접수 폼으로 합성 사건을 추가해 보세요.';
      el.caseGrid.appendChild(p);
    }
  }

  function selectCase(id) {
    state.activeId = id;
    state.draft = null;
    el.draftOut.textContent = '사건이 바뀌어 초안이 비워졌습니다. ’초안 만들기’를 다시 눌러 주세요.';
    say(el.draftMsg, '');
    say(el.itemMsg, '');
    renderCases();
    renderItems();
  }

  /* --------------------------- 자료 목록 --------------------------- */

  function segButton(label, pressed, title, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    b.addEventListener('click', onClick);
    return b;
  }

  function renderItems() {
    var c = activeCase();
    el.itemBody.textContent = '';
    if (!c) {
      var tr0 = document.createElement('tr');
      var td0 = document.createElement('td');
      td0.colSpan = 6;
      td0.className = 'empty';
      td0.textContent = '선택된 사건이 없습니다.';
      tr0.appendChild(td0);
      el.itemBody.appendChild(tr0);
      el.activeCaseName.textContent = '—';
      return;
    }
    el.activeCaseName.textContent = c.client;

    c.items.forEach(function (it) {
      var tr = document.createElement('tr');

      var tdCheck = document.createElement('td');
      tdCheck.className = 'col-check';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = c.picked.indexOf(it.id) >= 0;
      cb.title = '문서 초안 근거로 사용';
      cb.setAttribute('aria-label', it.name + ' 근거 사용');
      cb.addEventListener('change', function () {
        var i = c.picked.indexOf(it.id);
        if (cb.checked && i < 0) c.picked.push(it.id);
        if (!cb.checked && i >= 0) c.picked.splice(i, 1);
        say(el.itemMsg, '선택 근거 ' + c.picked.length + '건. ’초안 만들기’를 누르면 반영됩니다.');
      });
      tdCheck.appendChild(cb);

      var tdName = document.createElement('td');
      var nm = document.createElement('div');
      nm.className = 'item-name';
      nm.textContent = it.name;
      var mt = document.createElement('div');
      mt.className = 'item-meta';
      mt.textContent = it.form;
      tdName.appendChild(nm);
      tdName.appendChild(mt);

      var tdCat = document.createElement('td');
      tdCat.textContent = it.cat;

      var tdCls = document.createElement('td');
      var seg = document.createElement('div');
      seg.className = 'seg';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', it.name + ' 분류');
      CLASSES.forEach(function (o) {
        seg.appendChild(segButton(o.label, it.cls === o.key, o.note, function () {
          it.cls = o.key;
          renderItems();
          say(el.itemMsg, it.name + ' 분류를 ’' + o.label + '’(으)로 바꿨습니다. ' + o.note);
        }));
      });
      tdCls.appendChild(seg);

      var tdSt = document.createElement('td');
      var seg2 = document.createElement('div');
      seg2.className = 'seg';
      seg2.setAttribute('role', 'group');
      seg2.setAttribute('aria-label', it.name + ' 검토 상태');
      STATES.forEach(function (o) {
        seg2.appendChild(segButton(o.label, it.st === o.key, '검토 상태 변경', function () {
          it.st = o.key;
          renderItems();
          say(el.itemMsg, it.name + ' 검토 상태를 ’' + o.label + '’(으)로 바꿨습니다.');
        }));
      });
      tdSt.appendChild(seg2);

      tr.appendChild(tdCheck);
      tr.appendChild(tdName);
      tr.appendChild(tdCat);
      tr.appendChild(tdCls);
      tr.appendChild(tdSt);
      el.itemBody.appendChild(tr);
    });
  }

  function addSampleItem() {
    var c = activeCase();
    if (!c) { say(el.itemMsg, '먼저 사건을 등록하거나 선택해 주세요.', true); return; }
    var samples = [
      { name: '(합성) 배송 조회 결과 캡처', cat: '증빙', form: '이미지' },
      { name: '(합성) 통화 일지 요약', cat: '기록', form: '문서' },
      { name: '(합성) 관련 이메일 발송 내역', cat: '대화', form: '이미지' },
      { name: '(합성) 제3자 진술 메모', cat: '증언', form: '메모' }
    ];
    var s = samples[c.items.length % samples.length];
    var it = { id: nextId('n'), name: s.name, cat: s.cat, form: s.form, cls: 'ref', st: 'memo' };
    c.items.push(it);
    renderCases();
    renderItems();
    say(el.itemMsg, c.client + '에 ’' + s.name + '’ 항목을 추가했습니다. 분류와 근거 여부를 정해 보세요.');
  }

  /* ----------------------------- 초안 ----------------------------- */

  function buildDraft() {
    var c = activeCase();
    if (!c) { say(el.draftMsg, '먼저 사건을 선택해 주세요.', true); return; }
    var key = el.docSel.value;
    var doc = DOCS[key];
    var m = MATTERS[c.kindKey];

    var picked = c.items.filter(function (it) { return c.picked.indexOf(it.id) >= 0; });
    var cite;
    if (!picked.length) {
      cite = '- (근거로 체크한 자료가 없습니다. 자료 목록에서 체크 후 다시 만들어 주세요.)';
    } else {
      cite = picked.map(function (it, i) {
        var cls = CLASSES.filter(function (o) { return o.key === it.cls; })[0];
        var st = STATES.filter(function (o) { return o.key === it.st; })[0];
        return (i + 1) + ') ' + it.name + ' [' + it.cat + ' / ' + it.form + ' / 분류 ' + cls.label + ' / ' + st.label + ']';
      }).join('\n');
    }

    var text = '자료 검토 메모 — ' + doc.title + '\n' + new Array(46).join('=') + '\n\n' +
      '사건 : ' + c.client + ' (' + m.label + ', 접수 ' + fmt(c.received) + ')\n' +
      '작성 기준 : 본 데모는 합성 데이터로만 동작합니다.\n\n' +
      '상담 요지 (입력한 내용만 표시) : ' + (c.note || '미입력') + '\n\n' +
      '검토 자료 목록 :\n' + cite + '\n\n' +
      '확인 사항 : 원본 존재 여부, 작성 시점, 자료 간 일치 여부를 담당자가 검토합니다.\n\n' +
      '-'.repeat(40) + '\n' +
      '내부 검토일 : ' + fmt(c.deadline) + ' (접수 1개월 뒤 합성 예시, 법정 기한 아님)\n' +
      '첨부 예정 자료 : ' + picked.length + '건 / 전체 자료 ' + c.items.length + '건\n' +
      '주의 : 본문은 데모 문구이며 실제 제출 서면이 아닙니다. 사실 확인과 변호사 검토를 거친 뒤에만 사용하십시오.';

    state.draft = { key: key, title: doc.title, text: text };
    el.draftOut.textContent = text;
    say(el.draftMsg, picked.length
      ? '근거 ' + picked.length + '건을 인용해 ' + doc.title + '을(를) 만들었습니다.'
      : '근거로 체크한 자료가 없어 인용 목록이 비어 있습니다. 자료 목록에서 체크해 보세요.', !picked.length);
  }

  function downloadDraft() {
    if (!state.draft) { say(el.draftMsg, '먼저 ’초안 만들기’를 눌러 주세요.', true); return; }
    var head = '※ 합성 데이터 데모 결과물입니다. 실제 사건 자료가 아니며 제출용 서면이 아닙니다.\n\n';
    var blob = new Blob([head + state.draft.text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = state.draft.title.replace(/\s+/g, '_') + '_합성데모.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    say(el.draftMsg, '현재 초안을 브라우저에서 텍스트 파일로 내려받았습니다. 서버로 전송되지는 않습니다.');
  }

  /* ----------------------------- 접수 ----------------------------- */

  function registerCase(ev) {
    ev.preventDefault();
    var name = el.client.value.trim();
    if (!name) {
      say(el.intakeMsg, '의뢰인 이름(합성)을 입력해 주세요. 빈칸으로는 등록할 수 없습니다.', true);
      el.client.focus();
      return;
    }
    var kindKey = el.matter.value;
    var m = MATTERS[kindKey];
    var amount = Number(el.amount.value) || 0;
    var received = el.date.value || iso(new Date());
    var c = {
      id: nextId('c'),
      client: name,
      kindKey: kindKey,
      amount: amount,
      received: received,
      deadline: addMonths(received, m.months),
      note: el.note.value.trim(),
      picked: [],
      items: [],
      checks: (function () { var o = {}; o[CHECKLIST_DONE_DEFAULT[0]] = false; return o; })()
    };
    state.cases.push(c);
    state.activeId = c.id;
    state.draft = null;
    el.draftOut.textContent = '새 사건이 선택되었습니다. ’초안 만들기’를 눌러 보세요.';
    renderCases();
    renderItems();
    el.client.value = '';
    el.note.value = '';
    say(el.intakeMsg, '사건을 등록하고 자동 선택했습니다. 예상 기한 ' + fmt(c.deadline) + ' · ' + m.notice);
    say(el.caseMsg, '');
    say(el.draftMsg, '');
  }

  /* ----------------------------- 초기화 ----------------------------- */

  function resetAll() {
    state = seed();
    seq = 0;
    el.client.value = '';
    el.note.value = '';
    el.amount.value = '12000000';
    el.matter.value = 'civil';
    el.date.value = iso(new Date());
    el.docSel.value = 'criminal';
    el.draftOut.textContent = '아직 생성된 초안이 없습니다. 사건을 선택한 뒤 ’초안 만들기’를 누르세요.';
    renderCases();
    renderItems();
    say(el.intakeMsg, '모든 상태를 처음 합성 데이터로 되돌렸습니다.');
    say(el.caseMsg, '');
    say(el.itemMsg, '');
    say(el.draftMsg, '');
  }

  function clearFormOnly() {
    el.client.value = '';
    el.note.value = '';
    el.client.focus();
    say(el.intakeMsg, '입력란만 비웠습니다. 등록된 사건과 자료, 초안은 그대로 있습니다.');
  }

  /* ----------------------------- 연결 ----------------------------- */

  el.form.addEventListener('submit', registerCase);
  document.getElementById('btnClearForm').addEventListener('click', clearFormOnly);
  document.getElementById('btnAddSample').addEventListener('click', addSampleItem);
  document.getElementById('btnDraft').addEventListener('click', buildDraft);
  document.getElementById('btnCopy').addEventListener('click', downloadDraft);
  document.getElementById('btnResetAll').addEventListener('click', resetAll);

  renderCases();
  renderItems();
})();
