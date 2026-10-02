(function () {
  'use strict';

  var STEP_MS = 12;
  var SLOTS_PER_PAGE = 8;
  var PAGE_COUNT = 3;
  var SLOT_TOTAL = SLOTS_PER_PAGE * PAGE_COUNT;
  var DEFAULT_KEEP_SCORE = 8;
  var AREA_NAME = 'personal_stash';

  var PIPELINE = [
    '슬롯 좌표로 마우스 이동',
    '툴팁 표시 지연 대기',
    '툴팁 영역 캡처',
    '이미지 전처리',
    'OCR 텍스트 추출',
    '아이템 파싱',
    '가치 평가',
    '결과 저장 및 이미지 판정'
  ];

  var BASE_HINTS = { '룬': 30, '보석': 40, '그랜드 참': 60 };

  var POOL = [
    {
      id: 'a1', name: '합성 로브 룬', cat: '룬', quality: 'normal',
      ocr: '합성 로브 룬\n내구도: 14\n내구도 최대치: 15\n레벨 요구치: 11',
      rolls: [{ label: '내구도', value: 14, min: 9, max: 15 }]
    },
    {
      id: 'a2', name: '합성 투명 보석', cat: '보석', quality: 'normal',
      ocr: '합성 투명 보석\n속성: +5\n최대 속성: +6',
      rolls: [{ label: '속성', value: 5, min: 1, max: 6 }]
    },
    {
      id: 'a3', name: '합성 그랜드 활 룬', cat: '그랜드 참', quality: 'normal',
      ocr: '합성 그랜드 활 룬\n최대 데미지: 38\n초당 공격: 9\n필요 레벨: 74',
      rolls: [
        { label: '최대 데미지', value: 38, min: 20, max: 42 },
        { label: '초당 공격', value: 9, min: 5, max: 10 }
      ]
    },
    {
      id: 'a4', name: '합성 유니크 팔찌', cat: '장신구', quality: 'unique',
      ocr: '합성 유니크 팔찌\n내구도: 99\n최대 내구도: 100',
      rolls: [{ label: '내구도', value: 99, min: 50, max: 100 }]
    },
    {
      id: 'a5', name: '합성 레어 투구', cat: '투구', quality: 'rare',
      ocr: '합성 레어 투구\n방어력: 120\n내구도: 80\n레벨 요구치: 41',
      rolls: [
        { label: '방어력', value: 120, min: 60, max: 180 },
        { label: '내구도', value: 80, min: 40, max: 100 }
      ]
    },
    {
      id: 'a6', name: '합성 마법 갑옷', cat: '갑옷', quality: 'magic',
      ocr: '합성 마법 갑옷\n방어력: 96\n내구도: 70\n냉기 저항: 20',
      rolls: [{ label: '방어력', value: 96, min: 40, max: 120 }]
    },
    {
      id: 'a7', name: '합성 심판 자루', cat: '무기', quality: 'rare',
      ocr: '합성 심판 자루\n공격력: 180\n공격 속도: -30\n필요 공격력: 160',
      rolls: [
        { label: '공격력', value: 180, min: 80, max: 200 },
        { label: '공격 속도', value: -30, min: -40, max: 10 }
      ]
    },
    {
      id: 'a8', name: '합성 갑옷', cat: '갑옷', quality: 'normal',
      ocr: '합성 갑옷\n방어력: 40',
      rolls: []
    },
    {
      id: 'a9', name: '쓰레기 봉투', cat: '기타', quality: 'normal',
      ocr: '쓰레기 봉투',
      rolls: []
    },
    {
      id: 'a10', name: '합성 부츠', cat: '신발', quality: 'rare',
      ocr: '합성 부츠\n방어력: 74\n이속: 15\n내구도: 60',
      rolls: [
        { label: '방어력', value: 74, min: 30, max: 110 },
        { label: '이속', value: 15, min: -20, max: 20 }
      ]
    },
    {
      id: 'a11', name: '합성 방패 룬', cat: '룬', quality: 'normal',
      ocr: '합성 방패 룬\n내구도: 11\n내구도 최대치: 15',
      rolls: [{ label: '내구도', value: 11, min: 9, max: 15 }]
    },
    {
      id: 'a12', name: '합성 무기 룬', cat: '룬', quality: 'normal',
      ocr: '합성 무기 룬\n공격력: 15\n인격치: 3\n필요 레벨: 13',
      rolls: [{ label: '공격력', value: 15, min: 3, max: 16 }]
    },
    {
      id: 'a13', name: '합성 마법 반지', cat: '반지', quality: 'magic',
      ocr: '합성 마법 반지\n인텔리전스: 24\n마나: 15',
      rolls: [{ label: '인텔리전스', value: 24, min: 10, max: 30 }]
    },
    {
      id: 'a14', name: '합성 유니크 목걸이', cat: '장신구', quality: 'unique',
      ocr: '합성 유니크 목걸이\n마나: 32\n내구도: 55',
      rolls: [{ label: '마나', value: 32, min: 10, max: 40 }]
    },
    {
      id: 'a15', name: '상자 파편', cat: '기타', quality: 'normal',
      ocr: '상자 파편',
      rolls: []
    },
    {
      id: 'a16', name: '합성 레어 활', cat: '무기', quality: 'rare',
      ocr: '합성 레어 활\n공격력: 64\n필요 공격력: 55\n레벨 요구치: 22',
      rolls: [
        { label: '공격력', value: 64, min: 20, max: 90 },
        { label: '필요 공격력', value: 55, min: 20, max: 80 }
      ]
    },
    {
      id: 'a17', name: '합성 조끼', cat: '갑옷', quality: 'normal',
      ocr: '합성 조끼\n방어력: 55\n내구도: 30',
      rolls: []
    },
    {
      id: 'a18', name: '합성 색인 보석', cat: '보석', quality: 'normal',
      ocr: '합성 색인 보석\n속성: +2\n최대 속성: +6',
      rolls: [{ label: '속성', value: 2, min: 1, max: 6 }]
    },
    {
      id: 'n1', name: '합성 그랜드 투구 룬', cat: '그랜드 참', quality: 'normal',
      ocr: '합성 그랜드 투구 룬\n방어력: 120\n내구도: 90\n레벨 요구치: 48',
      rolls: [
        { label: '방어력', value: 120, min: 40, max: 160 },
        { label: '내구도', value: 90, min: 40, max: 100 }
      ]
    },
    {
      id: 'n2', name: '합성 레어 투구', cat: '투구', quality: 'rare',
      ocr: '합성 레어 투구 (교체)\n방어력: 168\n내구도: 95\n레벨 요구치: 45',
      rolls: [
        { label: '방어력', value: 168, min: 60, max: 180 },
        { label: '내구도', value: 95, min: 40, max: 100 }
      ]
    },
    {
      id: 'n3', name: '합성 청인 보석', cat: '보석', quality: 'normal',
      ocr: '합성 청인 보석\n속성: +6\n최대 속성: +6',
      rolls: [{ label: '속성', value: 6, min: 1, max: 6 }]
    },
    {
      id: 'n4', name: '마법이 걸린 골령', cat: '기타', quality: 'magic',
      ocr: '마법이 걸린 골령',
      rolls: []
    }
  ];

  var INITIAL_LAYOUT = [
    'a1', 'a2', null, 'a3', 'a4', 'a5', null, 'a6',
    'a7', 'a8', 'a9', null, 'a10', 'a11', 'a12', null,
    'a13', 'a14', null, 'a15', null, 'a16', 'a17', 'a18'
  ];

  var POOL_BY_ID = {};
  POOL.forEach(function (item) { POOL_BY_ID[item.id] = item; });

  var state = {
    page: 0,
    layout: [],
    results: {},
    keepScore: DEFAULT_KEEP_SCORE,
    selected: null,
    scanning: false,
    step: -1,
    stats: { processed: 0, reused: 0, kept: 0, discarded: 0, pages: 0 },
    logLines: []
  };

  var el = {
    grid: document.getElementById('slotGrid'),
    stepper: document.getElementById('stepper'),
    stats: document.getElementById('stats'),
    log: document.getElementById('log'),
    body: document.getElementById('resultBody'),
    pageChip: document.getElementById('pageChip'),
    stashMeta: document.getElementById('stashMeta'),
    itemPick: document.getElementById('itemPick'),
    editorHint: document.getElementById('editorHint'),
    thresholdForm: document.getElementById('thresholdForm'),
    thresholdInput: document.getElementById('thresholdInput'),
    scanPageBtn: document.getElementById('scanPageBtn'),
    scanSlotBtn: document.getElementById('scanSlotBtn'),
    diffBtn: document.getElementById('diffBtn'),
    resetBtn: document.getElementById('resetBtn'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    replaceBtn: document.getElementById('replaceBtn'),
    clearSlotBtn: document.getElementById('clearSlotBtn')
  };

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function contentHash(itemId) {
    var seed = 'slot:' + (itemId || 'empty') + ':' + AREA_NAME;
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function slotKey(index) {
    return AREA_NAME + ':' + index;
  }

  function pageSlotIndexes() {
    var base = state.page * SLOTS_PER_PAGE;
    var list = [];
    for (var i = 0; i < SLOTS_PER_PAGE; i++) { list.push(base + i); }
    return list;
  }

  function log(text, tone) {
    state.logLines.unshift({ text: text, tone: tone || '' });
    if (state.logLines.length > 120) { state.logLines.pop(); }
    var nodes = state.logLines.map(function (line) {
      var p = document.createElement('p');
      if (line.tone) { p.className = 'lg-' + line.tone; }
      p.textContent = line.text;
      return p;
    });
    el.log.replaceChildren.apply(el.log, nodes);
  }

  function evaluateRolls(rolls) {
    var total = 0;
    var evaluated = rolls.map(function (roll) {
      var percentile = roll.max > roll.min
        ? Math.round((roll.value - roll.min) / (roll.max - roll.min) * 100)
        : 100;
      percentile = Math.max(0, Math.min(100, percentile));
      total += percentile;
      return { label: roll.label, value: roll.value, percentile: percentile, perfect: percentile === 100 };
    });
    var score = evaluated.length ? Math.round(total / evaluated.length) : 0;
    return { evaluated: evaluated, rollScore: score };
  }

  function baseScore(item) {
    var score = 0;
    var name = item.name + ' ' + item.cat;
    Object.keys(BASE_HINTS).forEach(function (hint) {
      if (name.indexOf(hint) !== -1) { score = Math.max(score, BASE_HINTS[hint]); }
    });
    if (item.quality === 'unique') { score = Math.max(score, 30); }
    else if (item.quality === 'rare' || item.quality === 'magic') { score = Math.max(score, 20); }
    return score;
  }

  function liquidityOf(item, score) {
    if (item.cat === '룬' || item.cat === '보석') { return 15; }
    if (item.quality === 'unique') { return 70; }
    if (item.quality === 'rare') { return Math.round(45 + score / 4); }
    if (item.quality === 'magic') { return Math.round(60 + score / 6); }
    return Math.round(20 + score / 8);
  }

  function decide(score) {
    if (score >= state.keepScore) {
      return { label: '판매 검토 · 이미지 보관', cls: 'decision-keep', keep: true };
    }
    if (score >= 4) {
      return { label: '보관 후보 · 이미지 삭제', cls: 'decision-drop', keep: false };
    }
    return { label: '제외 · 이미지 삭제', cls: 'decision-drop', keep: false };
  }

  function evaluateItem(item) {
    var rolled = evaluateRolls(item.rolls);
    var base = baseScore(item);
    var valueScore = Math.max(rolled.rollScore, base);
    var verdict = decide(valueScore);
    return {
      empty: false,
      id: item.id,
      name: item.name,
      cat: item.cat,
      quality: item.quality,
      rolls: rolled.evaluated,
      rollScore: rolled.rollScore,
      baseScore: base,
      valueScore: valueScore,
      liquidity: liquidityOf(item, valueScore),
      decision: verdict.label,
      decisionClass: verdict.cls,
      keepImage: verdict.keep,
      hash: contentHash(item.id)
    };
  }

  function emptyResult(index) {
    return {
      empty: true,
      id: null,
      name: '빈 슬롯',
      cat: '-',
      quality: 'normal',
      rolls: [],
      rollScore: 0,
      baseScore: 0,
      valueScore: 0,
      liquidity: 0,
      decision: '스캔 생략',
      decisionClass: 'decision-drop',
      keepImage: false,
      hash: contentHash(null),
      index: index
    };
  }

  async function processSlot(index, stepMs) {
    var itemId = state.layout[index];
    var slotLabel = '슬롯 ' + String(index + 1).padStart(2, '0');

    if (!itemId) {
      state.step = 3;
      renderStepper();
      log(slotLabel + ' · 빈 슬롯 확인 · 캡처와 OCR 생략', 'skip');
      await sleep(stepMs);
      state.results[slotKey(index)] = emptyResult(index);
      state.stats.processed += 1;
      return;
    }

    var item = POOL_BY_ID[itemId];
    var ocrLines = item.ocr.split('\n');

    state.step = 0;
    renderStepper();
    log(slotLabel + ' · ' + PIPELINE[0] + ' (x=' + (120 + (index % 8) * 68) + ', y=' + (180 + Math.floor(index / 8) * 72) + ')', 'slot');
    await sleep(stepMs);

    state.step = 1;
    renderStepper();
    log(slotLabel + ' · ' + PIPELINE[1]);
    await sleep(stepMs);

    state.step = 2;
    renderStepper();
    log(slotLabel + ' · ' + PIPELINE[2] + ' · 해시 ' + contentHash(itemId));
    await sleep(stepMs);

    state.step = 3;
    renderStepper();
    log(slotLabel + ' · ' + PIPELINE[3] + ' · 합성 처리본 생성');
    await sleep(stepMs);

    state.step = 4;
    renderStepper();
    log(slotLabel + ' · ' + PIPELINE[4] + ' → ' + ocrLines.length + '줄 합성 텍스트');
    await sleep(stepMs);

    state.step = 5;
    renderStepper();
    log(slotLabel + ' · ' + PIPELINE[5] + ' → ' + item.name + ' / ' + item.quality + ' / 옵션 ' + item.rolls.length + '개');
    await sleep(stepMs);

    var result = evaluateItem(item);
    state.step = 6;
    renderStepper();
    log(slotLabel + ' · ' + PIPELINE[6] + ' → 롤 평균 ' + result.rollScore + ', 기본 ' + result.baseScore + ', 채택 ' + result.valueScore);
    await sleep(stepMs);

    state.results[slotKey(index)] = result;
    state.stats.processed += 1;

    state.step = 7;
    renderStepper();
    if (result.keepImage) {
      state.stats.kept += 1;
      log(slotLabel + ' · ' + PIPELINE[7] + ' → 보관 (점수 ' + result.valueScore + ' ≥ ' + state.keepScore + ')', 'keep');
    } else {
      state.stats.discarded += 1;
      log(slotLabel + ' · ' + PIPELINE[7] + ' → 캡처 삭제 (점수 ' + result.valueScore + ' < ' + state.keepScore + ')', 'drop');
    }
    await sleep(stepMs);

    state.step = -1;
    renderStepper();
    renderAll();
  }

  function setBusy(busy) {
    state.scanning = busy;
    [el.scanPageBtn, el.scanSlotBtn, el.diffBtn, el.prevPageBtn, el.nextPageBtn, el.replaceBtn, el.clearSlotBtn]
      .forEach(function (btn) { btn.disabled = busy; });
    el.scanSlotBtn.disabled = busy || state.selected === null;
  }

  async function runScan(indexes, mode) {
    if (state.scanning) { return; }
    setBusy(true);
    var stepMs = mode === 'page' ? 12 : 60;
    if (mode === 'page') { state.stats.pages += 1; }

    var processed = 0;
    var reused = 0;

    for (var i = 0; i < indexes.length; i++) {
      var index = indexes[i];
      var key = slotKey(index);
      var previous = state.results[key];
      var currentHash = contentHash(state.layout[index]);

      if (mode === 'diff') {
        if (previous && previous.hash === currentHash) {
          reused += 1;
          state.stats.reused += 1;
          log('슬롯 ' + String(index + 1).padStart(2, '0') + ' · 해시 ' + currentHash + ' 일치 · 기존 결과 재사용', 'skip');
          continue;
        }
        log('슬롯 ' + String(index + 1).padStart(2, '0') + ' · 해시 불일치 · 재처리 대상', 'slot');
      }

      await processSlot(index, stepMs);
      processed += 1;
    }

    if (mode === 'diff') {
      log('diff 스캔 완료 · 재처리 ' + processed + '건, 재사용 ' + reused + '건', 'skip');
    } else if (mode === 'page') {
      log('페이지 스캔 완료 · 처리 슬롯 ' + processed + '개 · 스냅샷 ' + state.stats.pages + '회차', 'skip');
    } else {
      log('단일 슬롯 스캔 완료 · 처리 슬롯 ' + processed + '개', 'skip');
    }

    state.step = -1;
    renderStepper();
    renderAll();
    setBusy(false);
  }

  function renderStepper() {
    var nodes = PIPELINE.map(function (label, i) {
      var li = document.createElement('li');
      li.textContent = (i + 1) + '. ' + label;
      if (state.step === i) { li.className = 'active'; }
      else if (state.step > i) { li.className = 'done'; }
      return li;
    });
    el.stepper.replaceChildren.apply(el.stepper, nodes);
  }

  function renderSlots() {
    var indexes = pageSlotIndexes();
    var nodes = indexes.map(function (index) {
      var itemId = state.layout[index];
      var item = itemId ? POOL_BY_ID[itemId] : null;
      var result = state.results[slotKey(index)];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot';
      btn.setAttribute('aria-pressed', String(state.selected === index));
      if (!item) { btn.classList.add('slot-empty'); }

      var idx = document.createElement('span');
      idx.className = 'slot-idx';
      idx.textContent = '슬롯 ' + String(index + 1).padStart(2, '0');
      btn.appendChild(idx);

      var name = document.createElement('span');
      name.className = 'slot-name';
      name.textContent = item ? item.name : '빈 슬롯';
      btn.appendChild(name);

      var meta = document.createElement('span');
      meta.className = 'slot-meta';
      if (result) {
        meta.textContent = '점수 ' + result.valueScore + ' · ' + (result.keepImage ? '보관' : '삭제');
      } else {
        meta.textContent = item ? '스캔 전' : '스캔 생략 대상';
      }
      btn.appendChild(meta);

      btn.addEventListener('click', function () {
        if (state.scanning) { return; }
        state.selected = index;
        renderSlots();
        renderEditor();
        el.scanSlotBtn.disabled = false;
      });
      return btn;
    });
    el.grid.replaceChildren.apply(el.grid, nodes);

    el.stashMeta.textContent = AREA_NAME + ' · 페이지 ' + (state.page + 1) + ' · 슬롯 ' + (indexes[0] + 1) + '~' + (indexes[indexes.length - 1] + 1);
  }

  function renderEditor() {
    if (state.selected === null) {
      el.editorHint.textContent = '슬롯 카드를 먼저 선택하세요.';
      return;
    }
    var itemId = state.layout[state.selected];
    var current = itemId ? POOL_BY_ID[itemId].name : '빈 슬롯';
    el.editorHint.textContent = '선택한 위치: 슬롯 ' + String(state.selected + 1).padStart(2, '0') + ' · 현재 내용: ' + current;
  }

  function renderStats() {
    var items = [
      ['재처리 슬롯', state.stats.processed],
      ['기존 결과 재사용', state.stats.reused],
      ['이미지 보관', state.stats.kept],
      ['캡처 삭제', state.stats.discarded],
      ['스냅샷 회차', state.stats.pages]
    ];
    var nodes = items.map(function (pair) {
      var li = document.createElement('li');
      var strong = document.createElement('b');
      strong.textContent = String(pair[1]);
      li.appendChild(strong);
      li.appendChild(document.createTextNode(' ' + pair[0]));
      return li;
    });
    el.stats.replaceChildren.apply(el.stats, nodes);
  }

  function renderRolls(result) {
    var wrap = document.createElement('div');
    if (!result) {
      var pending = document.createElement('span');
      pending.className = 'muted';
      pending.textContent = '스캔 전';
      wrap.appendChild(pending);
      return wrap;
    }
    if (!result.rolls.length) {
      var none = document.createElement('span');
      none.className = 'muted';
      none.textContent = '옵션 없음';
      wrap.appendChild(none);
      return wrap;
    }
    var list = document.createElement('div');
    result.rolls.forEach(function (roll) {
      var line = document.createElement('div');
      line.style.fontSize = '13px';
      var bar = document.createElement('div');
      bar.className = 'bar' + (roll.perfect ? ' perfect' : '');
      var fill = document.createElement('i');
      fill.style.width = roll.percentile + '%';
      bar.appendChild(fill);
      var label = document.createElement('div');
      label.textContent = roll.label + ' ' + roll.value + ' · 상위 ' + roll.percentile + '%' + (roll.perfect ? ' · 최상위' : '');
      line.appendChild(label);
      line.appendChild(bar);
      list.appendChild(line);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function renderResults() {
    var indexes = pageSlotIndexes();
    var nodes = indexes.map(function (index) {
      var result = state.results[slotKey(index)];
      var tr = document.createElement('tr');
      if (result && result.empty) { tr.className = 'is-empty'; }

      var cells = [
        ['슬롯 ' + String(index + 1).padStart(2, '0'), null],
        [result ? result.name : '스캔 전', null],
        [result ? result.quality : '-', 'tag-' + (result ? result.quality : 'normal')],
        ['', 'rolls'],
        [result ? String(result.valueScore) : '-', 'score'],
        [result ? String(result.liquidity) : '-', null],
        ['', 'decision']
      ];

      cells.forEach(function (cell) {
        var td = document.createElement('td');
        var text = cell[0];
        var cls = cell[1];
        if (cls === 'rolls') {
          td.appendChild(renderRolls(result));
        } else if (cls === 'decision') {
          var span = document.createElement('span');
          span.className = 'decision ' + (result ? result.decisionClass : 'decision-drop');
          span.textContent = result ? result.decision : '대기';
          td.appendChild(span);
        } else if (cls && cls.indexOf('tag-') === 0) {
          var tag = document.createElement('span');
          tag.className = 'tag ' + cls;
          tag.textContent = text;
          td.appendChild(tag);
        } else {
          td.textContent = text;
          if (cls) { td.className = cls; }
        }
        tr.appendChild(td);
      });
      return tr;
    });
    el.body.replaceChildren.apply(el.body, nodes);
  }

  function renderAll() {
    el.pageChip.textContent = (state.page + 1) + ' / ' + PAGE_COUNT;
    el.prevPageBtn.disabled = state.scanning || state.page === 0;
    el.nextPageBtn.disabled = state.scanning || state.page === PAGE_COUNT - 1;
    renderSlots();
    renderEditor();
    renderStats();
    renderResults();
    renderStepper();
  }

  function initItemPicker() {
    var groups = { '룬': [], '보석': [], '그랜드 참': [], '기타': [] };
    POOL.forEach(function (item) {
      if (!groups[item.cat]) { groups[item.cat] = []; }
      groups[item.cat].push(item);
    });
    var nodes = [];
    Object.keys(groups).forEach(function (cat) {
      var og = document.createElement('optgroup');
      og.label = cat;
      groups[cat].forEach(function (item) {
        var opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.name + ' (' + item.quality + ')';
        og.appendChild(opt);
      });
      nodes.push(og);
    });
    el.itemPick.replaceChildren.apply(el.itemPick, nodes);
  }

  function reset() {
    state.layout = INITIAL_LAYOUT.slice();
    state.results = {};
    state.page = 0;
    state.selected = null;
    state.step = -1;
    state.keepScore = DEFAULT_KEEP_SCORE;
    state.stats = { processed: 0, reused: 0, kept: 0, discarded: 0, pages: 0 };
    state.logLines = [];
    el.thresholdInput.value = String(DEFAULT_KEEP_SCORE);
    el.log.replaceChildren();
    log('합성 초기 배치로 되돌렸습니다. 스캔 기록, 보관 기준, 선택 상태가 모두 초기화됩니다.', 'skip');
    renderAll();
    el.scanSlotBtn.disabled = true;
  }

  el.scanPageBtn.addEventListener('click', function () {
    runScan(pageSlotIndexes(), 'page');
  });

  el.scanSlotBtn.addEventListener('click', function () {
    if (state.selected === null) { return; }
    runScan([state.selected], 'slot');
  });

  el.diffBtn.addEventListener('click', function () {
    var indexes = pageSlotIndexes();
    var hasSnapshot = Object.keys(state.results).length > 0;
    if (!hasSnapshot) {
      log('비교할 스냅샷이 없습니다. 먼저 현재 페이지를 스캔하세요.', 'drop');
      return;
    }
    runScan(indexes, 'diff');
  });

  el.prevPageBtn.addEventListener('click', function () {
    if (state.page > 0) { state.page -= 1; renderAll(); }
  });

  el.nextPageBtn.addEventListener('click', function () {
    if (state.page < PAGE_COUNT - 1) { state.page += 1; renderAll(); }
  });

  el.replaceBtn.addEventListener('click', function () {
    if (state.selected === null || state.scanning) { return; }
    state.layout[state.selected] = el.itemPick.value;
    log('슬롯 ' + String(state.selected + 1).padStart(2, '0') + ' · 창고 내용을 ' + POOL_BY_ID[el.itemPick.value].name + '(으)로 교체 · 새 해시 ' + contentHash(el.itemPick.value), 'slot');
    renderAll();
  });

  el.clearSlotBtn.addEventListener('click', function () {
    if (state.selected === null || state.scanning) { return; }
    state.layout[state.selected] = null;
    log('슬롯 ' + String(state.selected + 1).padStart(2, '0') + ' · 슬롯을 비움 · 해시 ' + contentHash(null), 'slot');
    renderAll();
  });

  el.thresholdForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var value = parseInt(el.thresholdInput.value, 10);
    if (isNaN(value) || value < 1 || value > 100) {
      el.thresholdInput.value = String(state.keepScore);
      log('보관 기준은 1에서 100 사이의 정수만 받습니다.', 'drop');
      return;
    }
    state.keepScore = value;
    log('이미지 보관 기준 점수를 ' + value + '(으)로 변경 · 기존 판정은 스냅샷에 그대로 남습니다.', 'slot');
    renderAll();
  });

  el.resetBtn.addEventListener('click', function () {
    if (state.scanning) { return; }
    reset();
  });

  initItemPicker();
  reset();
})();
