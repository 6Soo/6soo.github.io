(function () {
  'use strict';

  // ── 합성 데이터: 실제 카드·사진·문구와 무관한 예시값 ──────────────
  var PHOTOS = [
    { id: 'none', label: '사진 없음 (단색 카드)', css: null },
    { id: 'coast', label: '합성 배경 A — 해안', css: 'linear-gradient(160deg,#3b6ea5 0%,#7fa9c9 46%,#e6dcc3 100%)' },
    { id: 'forest', label: '합성 배경 B — 숲길', css: 'linear-gradient(200deg,#25402f 0%,#4f7355 55%,#8fa383 100%)' },
    { id: 'terrace', label: '합성 배경 C — 논언덕', css: 'linear-gradient(140deg,#7c9c3f 0%,#b9c46a 60%,#e9e2b6 100%)' }
  ];

  function makeCards() {
    return [
      { id: 'cover-a', kind: 'cover', photo: 'coast', title: '여름 바다 끝 작은 마을', body: '', items: [] },
      { id: 'p-02', kind: 'photo', photo: 'coast', title: '잔潮이 길게 남는 해안', body: '안개가 걷힌 시간대만 바위가 드러난다.', items: [] },
      { id: 'p-03', kind: 'photo', photo: 'forest', title: '숲길 계곡의 물길', body: '계곡을 따라 걷는 길이 40분짜리 구간.', items: [] },
      { id: 'p-04', kind: 'photo', photo: 'terrace', title: '논 위에 내리는 저녁빛', body: '물고기가 비치는 시간은 해가 진 뒤 30분뿐.', items: [] },
      { id: 'p-05', kind: 'paper', photo: 'none', title: '장 볼 때 쓰는 메모', body: '', items: ['예약 확인', '주유소 위치', '빗날 대안 동선'] }
    ];
  }

  var state = { cards: makeCards(), selected: 'cover-a', gateRun: false, gatePass: false, rendered: [], archive: [] };

  var $ = function (id) { return document.getElementById(id); };
  var elCardSelect = $('cardSelect');
  var elKind = $('kind');
  var elTitle = $('cardTitle');
  var elBody = $('cardBody');
  var elItems = $('cardItems');
  var elPhoto = $('cardPhoto');
  var elItemsWrap = $('itemsWrap');
  var elPreview = $('preview');
  var elGateList = $('gateList');
  var elGateBadge = $('gateBadge');
  var elRenderGrid = $('renderGrid');
  var elArchive = $('archiveList');
  var elRunRender = $('runRender');
  var elRunRenderAll = $('runRenderAll');

  function current() {
    for (var i = 0; i < state.cards.length; i++) if (state.cards[i].id === state.selected) return state.cards[i];
    return null;
  }

  // 쪽번호: 표지는 게시 때 1쪽, 내지는 2쪽부터 (원본 스크립트의 규칙)
  function pageOf(card) {
    var inner = state.cards.filter(function (c) { return c.kind !== 'cover'; });
    if (card.kind === 'cover') return 1;
    return inner.indexOf(card) + 2;
  }
  function totalPages() {
    return state.cards.filter(function (c) { return c.kind !== 'cover'; }).length + 1;
  }

  // ── 인터랙션 1: 카드 편집 → 미리보기 즉시 갱신 ──────────────────
  function renderPreview() {
    var c = current();
    if (!c) { elPreview.innerHTML = ''; return; }
    var scrim = c.kind === 'cover'
      ? 'linear-gradient(180deg, rgba(8,12,10,.34) 0%, rgba(8,12,10,.08) 42%, rgba(8,10,9,.76) 100%)'
      : 'linear-gradient(180deg, rgba(8,12,10,.28) 0%, rgba(8,10,9,.86) 100%)';
    var photo = PHOTOS.filter(function (p) { return p.id === c.photo; })[0];
    var bg = c.kind === 'paper' ? '' : (photo && photo.css ? scrim + ',' + photo.css : scrim);
    var cls = 'preview ' + (c.kind === 'cover' ? 'pv-cover' : c.kind === 'paper' ? 'pv-paper' : 'pv-photo');

    var html = '';
    if (c.kind !== 'cover') {
      html += '<span class="pv-wm">합성 예시</span><span class="pv-pg">' + pageOf(c) + '/' + totalPages() + '</span>';
    } else {
      html += '<span class="pv-wm">합성 예시</span>';
    }

    if (c.kind === 'cover') {
      html += '<div><div class="pv-bar"></div><p class="pv-eye">카드를 읽는 순서</p>'
        + '<h3 class="pv-title">' + esc(c.title) + '</h3><p class="pv-body">' + esc(c.body || '') + '</p></div>';
    } else if (c.kind === 'paper') {
      html += '<div><div class="pv-bar dark"></div><p class="pv-eye">메모</p><h3 class="pv-title">' + esc(c.title) + '</h3>';
      if (c.items && c.items.length) {
        html += '<ul class="pv-list">' + c.items.map(function (it, i) {
          return '<li><b>' + pad(i + 1) + '</b><span>' + esc(it) + '</span></li>';
        }).join('') + '</ul>';
      } else {
        html += '<p class="pv-body">' + esc(c.body || '') + '</p>';
      }
      html += '</div>';
    } else {
      html += '<div style="margin-top:auto"><p class="pv-eye">현장 메모</p>'
        + '<h3 class="pv-title">' + esc(c.title) + '</h3><p class="pv-body">' + esc(c.body || '') + '</p></div>';
    }

    elPreview.className = cls;
    elPreview.style.background = bg;
    elPreview.innerHTML = html;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function fillForm() {
    var c = current();
    if (!c) return;
    elKind.value = c.kind;
    elTitle.value = c.title;
    elBody.value = c.body;
    elItems.value = (c.items || []).join('\n');
    elPhoto.value = c.photo;
    syncItemsVisibility();
  }

  function syncItemsVisibility() {
    elItemsWrap.style.display = elKind.value === 'paper' ? '' : 'none';
  }

  function fillSelects() {
    elCardSelect.innerHTML = state.cards.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.id) + ' · ' + kindName(c.kind) + '</option>';
    }).join('');
    elCardSelect.value = state.selected;
    if (elPhoto.options.length === 0) {
      elPhoto.innerHTML = PHOTOS.map(function (p) {
        return '<option value="' + p.id + '">' + esc(p.label) + '</option>';
      }).join('');
    }
  }
  function kindName(k) { return k === 'cover' ? '표지' : k === 'paper' ? '종이' : '사진'; }

  // ── 인터랙션 2: 규칙 검수(게이트) ─────────────────────────────────
  // 문서화된 규칙만 검사한다. 사진 없는 단색 카드 금지, 종이 카드는 8·9번째만 허용.
  function runGate() {
    var results = [];
    var inner = state.cards.filter(function (c) { return c.kind !== 'cover'; });
    var total = inner.length + 1;

    var covers = state.cards.filter(function (c) { return c.kind === 'cover'; });
    results.push({
      pass: covers.length === 1,
      label: '표지는 1장',
      fix: covers.length === 1 ? '' : '지금 표지는 ' + covers.length + '장이다. 게시 시 1장으로 본다.'
    });

    var flat = state.cards.filter(function (c) { return c.kind !== 'paper' && c.photo === 'none'; });
    results.push({
      pass: flat.length === 0,
      label: '사진 없는 단색 카드 없음',
      fix: flat.length === 0 ? '' : flat.length + '장에 사진이 없다: ' + flat.map(function (c) { return c.id; }).join(', ')
    });

    var badPaper = [];
    inner.forEach(function (c, i) {
      if (c.kind === 'paper' && i !== 7 && i !== 8) badPaper.push(c.id + '(' + (i + 1) + '번째)');
    });
    results.push({
      pass: badPaper.length === 0,
      label: '종이 카드는 뒤쪽 자리만',
      fix: badPaper.length === 0 ? '' : '문서 규칙상 종이 카드는 8·9번째만 허용: ' + badPaper.join(', ')
    });

    var blank = state.cards.filter(function (c) { return !c.title.trim() && !(c.items || []).length; });
    results.push({
      pass: blank.length === 0,
      label: '제목 또는 요약 존재',
      fix: blank.length === 0 ? '' : '내용이 비어 있음: ' + blank.map(function (c) { return c.id; }).join(', ')
    });

    results.push({
      pass: true,
      label: '쪽번호 규칙 적용 (' + total + '쪽 구성)',
      fix: '표지 1쪽 + 내지 ' + inner.length + '쪽'
    });

    state.gateRun = true;
    state.gatePass = results.every(function (r) { return r.pass; });
    elGateList.innerHTML = results.map(function (r) {
      return '<li class="' + (r.pass ? 'ok' : 'bad') + '"><span class="mark">' + (r.pass ? 'O' : 'X') + '</span>'
        + '<span>' + esc(r.label) + '<span class="fix">' + esc(r.pass ? r.fix : r.fix) + '</span></span></li>';
    }).join('');
    elGateBadge.textContent = state.gatePass ? '통과' : '수정 필요';
    elGateBadge.className = 'badge ' + (state.gatePass ? 'ok' : 'bad');
    elRunRender.disabled = !state.gatePass;
    elRunRenderAll.disabled = !state.gatePass;
    setStep('stepGate', state.gatePass ? 'done' : 'now');
    renderPreview();
  }

  // ── 인터랙션 3: 일괄 렌더 시뮬레이션 → 기록 페이지 ────────────────
  function doRender(targets) {
    elRenderGrid.innerHTML = targets.map(function (c) {
      return '<div class="r-item" data-id="' + esc(c.id) + '"><span class="r-name">' + esc(c.id) + '</span>'
        + '<span class="r-state">대기 중</span></div>';
    }).join('');
    setStep('stepRender', 'now');

    targets.forEach(function (c, i) {
      var node = elRenderGrid.querySelector('[data-id="' + c.id + '"]');
      if (!node) return;
      node.classList.add('working');
      node.querySelector('.r-state').textContent = '변환 중…';
      setTimeout(function () {
        node.classList.remove('working');
        node.classList.add('done');
        node.querySelector('.r-state').textContent = '1080×1350 완료';
        state.rendered.push(c.id);
        state.archive.push({ id: c.id, size: '1080×1350' });
        renderArchive();
      }, 260 + i * 220);
    });
  }

  function renderArchive() {
    if (!state.archive.length) {
      elArchive.innerHTML = '<p class="empty">아직 렌더 기록이 없습니다.</p>';
      return;
    }
    elArchive.innerHTML = state.archive.map(function (a) {
      return '<div class="archive-row"><span>' + esc(a.id) + ' · 검토용 페이지</span>'
        + '<code>' + esc(a.id) + '.png</code>'
        + '<span class="a-size">' + esc(a.size) + '</span></div>';
    }).join('');
    setStep('stepArchive', 'done');
  }

  function setStep(id, cls) {
    var n = $(id);
    if (!n) return;
    n.className = 'step' + (cls ? ' ' + cls : '');
  }

  // ── 이벤트 연결 ────────────────────────────────────────────────────
  elCardSelect.addEventListener('change', function () {
    state.selected = elCardSelect.value;
    fillForm();
    renderPreview();
  });

  elKind.addEventListener('change', function () {
    var c = current(); if (!c) return;
    c.kind = elKind.value;
    if (c.kind === 'paper' && c.photo !== 'none') { c.photo = 'none'; elPhoto.value = 'none'; }
    if (c.kind !== 'paper' && c.photo === 'none') { c.photo = 'coast'; elPhoto.value = 'coast'; }
    fillSelects();
    syncItemsVisibility();
    renderPreview();
  });

  elTitle.addEventListener('input', function () { var c = current(); if (c) { c.title = elTitle.value; renderPreview(); } });
  elBody.addEventListener('input', function () { var c = current(); if (c) { c.body = elBody.value; renderPreview(); } });
  elItems.addEventListener('input', function () {
    var c = current(); if (!c) return;
    c.items = elItems.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    renderPreview();
  });
  elPhoto.addEventListener('change', function () { var c = current(); if (c) { c.photo = elPhoto.value; renderPreview(); } });

  $('runGate').addEventListener('click', runGate);

  elRunRender.addEventListener('click', function () {
    var c = current(); if (c) doRender([c]);
  });

  elRunRenderAll.addEventListener('click', function () {
    doRender(state.cards.slice());
  });

  $('addCard').addEventListener('click', function () {
    var n = state.cards.filter(function (c) { return c.kind !== 'cover'; }).length + 2;
    var id = 'p-' + pad(n);
    state.cards.push({ id: id, kind: 'photo', photo: 'coast', title: '새 카드 ' + n + '장', body: '', items: [] });
    state.selected = id;
    fillSelects();
    fillForm();
    renderPreview();
  });

  $('resetAll').addEventListener('click', function () {
    state.cards = makeCards();
    state.selected = 'cover-a';
    state.gateRun = false;
    state.gatePass = false;
    state.rendered = [];
    state.archive = [];
    fillSelects();
    fillForm();
    renderPreview();
    elGateList.innerHTML = '<li class="empty">검수를 실행하면 항목별 판정이 표시됩니다.</li>';
    elGateBadge.textContent = '실행 전';
    elGateBadge.className = 'badge';
    elRunRender.disabled = true;
    elRunRenderAll.disabled = true;
    elRenderGrid.innerHTML = '';
    renderArchive();
    setStep('stepGate', '');
    setStep('stepRender', '');
    setStep('stepArchive', '');
    setStep('stepGate', 'now');
  });

  // 초기 표시
  elGateList.innerHTML = '<li class="empty">검수를 실행하면 항목별 판정이 표시됩니다.</li>';
  fillSelects();
  fillForm();
  renderPreview();
  setStep('stepGate', 'now');
})();