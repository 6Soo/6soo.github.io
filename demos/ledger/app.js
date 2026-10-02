/* 법인카드 비용 분류 자동화 데모 (합성 데이터)
 * 원본 저장소의 비민감 소스에서 확인한 계약과 규칙만 참고해 다시 구현했습니다.
 * 외부 API 호출, 저장, 전송은 하지 않습니다. 모든 계산은 이 브라우저 안에서 끝납니다.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 상수 (원본 import 계약과 같은 이름·같은 판정 규칙)
   * ------------------------------------------------------------------ */
  var PROFILE_ID = 'synthetic-card-v1';
  var REQUIRED_COLUMNS = ['occurred_on', 'merchant', 'amount_krw'];
  var TRIP_TABS = [
    { id: 'trip-demo-a', label: '예시 여행 A (4월)' },
    { id: 'trip-demo-b', label: '예시 여행 B (5월)' }
  ];
  var CANCEL_TRUE = ['1', 'Y', 'y', 'true'];

  var COST_ITEMS = [
    '숙박료', '항공료', '지상교통', '식비', '활동비',
    '가맹점 수수료', '마케팅', '통신비', '기타 잡손'
  ];

  var QUESTIONS = [
    { key: 'rule_kind', prompt: '이번 거래에만 적용할까요, 비슷한 거래에도 적용할까요?',
      options: [['this_only', '이번 거래에만'], ['repeatable', '비슷한 거래에도']] },
    { key: 'evidence_basis', prompt: '이렇게 분류한 근거는 무엇인가요?',
      options: [['schedule_or_booking', '일정·예약 근거'],
                ['merchant_service', '가맹점의 특정 서비스'],
                ['one_off_exception', '이번 건만 예외']] },
    { key: 'trip_scope', prompt: '어느 여행에 적용할까요?',
      options: [['same_trip', '이 행과 같은 여행'], ['other_trip', '다른 여행'], ['no_trip', '여행 지정 안 함']] },
    { key: 'event_year', prompt: '어느 연도에 적용할까요?',
      options: [['this_year', '이번 연도']] },
    { key: 'period', prompt: '적용 기간을 제한할까요?',
      options: [['no_period_limit', '기간 제한 없음'], ['limited_period', '기간을 정함']] }
  ];

  var SAMPLE_CSV = [
    'occurred_on,merchant,amount_krw,currency,card_last4,approval_no,cancel_flag,suggested_tab,memo',
    '2026-04-09,OTADEMO 예약대행,120000,KRW,4417,AP240001,,trip-demo-a,',
    '2026-04-09,OTADEMO 예약대행,18000,KRW,4417,AP240002,,,예약 수수료',
    '2026-04-11,식당 데모넷,32000,KRW,4417,AP240003,,,야근 식사',
    '2026-04-12,OTADEMO 예약대행,240000,KRW,4417,AP240004,,trip-demo-a,'
  ].join('\n');

  var SAMPLE_CSV_ERR = [
    'occurred_on,merchant,amount_krw,currency,card_last4,approval_no,cancel_flag,suggested_tab,memo',
    '2026-05-02,OTADEMO 예약대행,90000,KRW,5521,AP250001,,,',
    '2026-5-2,날짜형식오류점,10000,KRW,5521,AP250002,,,',
    '2026-05-03,금액문자열점,abc,KRW,5521,AP250003,,,',
    '2026-05-04,0원예외점,0,KRW,5521,AP250004,,,',
    '2026-05-05,취소처리점,55000,KRW,5521,AP250005,1,',
    '2026-05-06,환불처리점,-55000,KRW,5521,AP250006,,,',
    '2026-05-07,빈가맹점점,,KRW,5521,AP250007,,,'
  ].join('\n');

  /* ------------------------------------------------------------------ *
   * 상태
   * ------------------------------------------------------------------ */
  var state = {
    rows: [],
    rowErrors: [],
    batches: {},          // 파일 해시 -> 배치 요약 (멱등 재사용)
    rules: [],
    selectedKey: null,
    filter: 'all',
    dialog: null
  };

  var $ = function (id) { return document.getElementById(id); };
  var won = function (n) { return (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('ko-KR') + '원'; };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ------------------------------------------------------------------ *
   * 해시 / 식별자
   * 데모용 축약 해시입니다. 원본은 서버에서 SHA-256을 쓰지만,
   * "안정 키와 내용 다이제스트를 분리한다"는 설계는 그대로 따릅니다.
   * ------------------------------------------------------------------ */
  function demoHash(text) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      h1 = (h1 ^ c) >>> 0; h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 = (h2 ^ (c + i)) >>> 0; h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }

  function cancelFlag(fields) {
    return CANCEL_TRUE.indexOf(String(fields.cancel_flag || '').trim()) >= 0 ? '1' : '';
  }

  // 승인번호가 있으면 카드뒷자리 + 승인번호만으로 키를 만든다.
  function stableKey(f) {
    var approval = String(f.approval_no || '').trim();
    var last4 = String(f.card_last4 || '').trim();
    var parts = approval
      ? [PROFILE_ID, last4, approval]
      : [PROFILE_ID, f.occurred_on, f.merchant, f.amount_krw, f.currency || '',
         last4, cancelFlag(f), 'no-approval'];
    return demoHash(parts.join('|'));
  }

  // 키와는 분리된 내용 지문. 가변 값(금액, 메모 등)도 여기 들어간다.
  function contentDigest(e) {
    return demoHash([
      e.occurred_on, e.merchant, e.amount_krw, e.currency || '', e.card_last4 || '',
      e.approval_no || '', e.event_kind, e.display_tab_id || '', e.memo || ''
    ].join('|'));
  }

  function normalizeMerchant(text) {
    return String(text == null ? '' : text).split(/\s+/).filter(Boolean).join(' ').toLowerCase();
  }

  /* ------------------------------------------------------------------ *
   * CSV 파싱 / 행 판정
   * ------------------------------------------------------------------ */
  function parseCsv(text) {
    var rows = [], field = '', row = [], inQuote = false;
    var src = String(text || '').replace(/^\uFEFF/, '');
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      if (inQuote) {
        if (ch === '"') {
          if (src[i + 1] === '"') { field += '"'; i++; } else { inQuote = false; }
        } else { field += ch; }
      } else if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch !== '\r') { field += ch; }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }

    var cleaned = rows.filter(function (r) {
      return r.some(function (v) { return String(v).trim() !== ''; });
    });
    if (!cleaned.length) return { error: 'CSV를 읽을 수 없어요' };

    var header = cleaned[0].map(function (h) { return h.trim(); });
    var missing = REQUIRED_COLUMNS.filter(function (c) { return header.indexOf(c) < 0; });
    if (missing.length) {
      return { error: '필수 열이 없어요: ' + missing.join(', ') };
    }
    var body = cleaned.slice(1).map(function (r) {
      var obj = {};
      header.forEach(function (h, idx) { obj[h] = String(r[idx] == null ? '' : r[idx]).trim(); });
      return obj;
    });
    return { header: header, rows: body };
  }

  // 원본 classify_parsed 판정: 필수값, 날짜 형식, 숫자 금액, 0원 제외,
  // 취소/환불/결제 구분, 허용 여행 지정 열에 따른 자동 분류 여부.
  function classifyParsed(f) {
    if (!f.occurred_on || !f.merchant || !f.amount_krw) {
      return { ok: false, note: '필수 값이 비었어요' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.occurred_on)) {
      return { ok: false, note: '날짜 형식이 달라요 (YYYY-MM-DD)' };
    }
    var amount = Number(String(f.amount_krw).replace(/,/g, ''));
    if (!/^[+-]?\d+$/.test(String(f.amount_krw).replace(/,/g, ''))) {
      return { ok: false, note: '금액이 숫자가 아니에요' };
    }
    if (amount === 0) {
      return { ok: false, note: '0원 행은 장부에 넣지 않아요' };
    }
    var isCancel = CANCEL_TRUE.indexOf(String(f.cancel_flag || '').trim()) >= 0;
    var kind = isCancel ? 'cancellation' : (amount < 0 ? 'refund' : 'purchase');
    var suggested = String(f.suggested_tab || '').trim();
    var allowed = TRIP_TABS.some(function (t) { return t.id === suggested; });
    return {
      ok: true,
      event: {
        occurred_on: f.occurred_on,
        merchant: f.merchant,
        amount_krw: amount,
        currency: String(f.currency || 'KRW').trim() || 'KRW',
        card_last4: String(f.card_last4 || '').trim(),
        approval_no: String(f.approval_no || '').trim(),
        event_kind: kind,
        display_tab_id: allowed ? suggested : null,
        classification_state: allowed ? 'auto_classified' : 'unclassified',
        memo: String(f.memo || '').trim(),
        card_kind: String(f.card_kind || '법인').trim() || '법인'
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * 가져오기 실행 (멱등 + 중복/충돌 판정)
   * ------------------------------------------------------------------ */
  function runImport() {
    var text = $('csv-input').value;
    var out = $('import-result');
    if (!text.trim()) { out.innerHTML = box('err', '붙여넣은 내용이 없어요. 샘플 CSV를 채우고 다시 실행하세요.'); return; }

    var parsed = parseCsv(text);
    if (parsed.error) { out.innerHTML = box('err', '파일 거부 · ' + esc(parsed.error)); return; }

    var batchHash = demoHash(text.split(/\r?\n/).join('\n'));
    var previous = state.batches[batchHash];
    if (previous) {
      // 원본: 파일 해시로 배치를 식별하고, 이미 있으면 새 행을 쌓지 않고 기존 결과를 재사용.
      out.innerHTML = box('warn',
        '<b>이미 받은 파일이라 재사용했습니다 (멱등).</b><ul>' +
        '<li>배치 식별자 <code>' + esc(previous.batchId) + '</code> · 기존 결과 그대로 반환</li>' +
        '<li>새로 추가된 행 0건 — 같은 파일을 다시 올려도 장부가 늘어나지 않습니다</li></ul>');
      return;
    }

    var added = 0, dup = 0, conflict = 0, errors = 0;
    var notes = [];
    state.rowErrors = [];

    parsed.rows.forEach(function (fields, idx) {
      var key = stableKey(fields);
      var judged = classifyParsed(fields);
      if (!judged.ok) {
        errors++;
        state.rowErrors.push({ line: idx + 2, key: key, note: judged.note, raw: fields });
        return;
      }
      var event = judged.event;
      var digest = contentDigest(event);
      var prior = null;
      for (var i = 0; i < state.rows.length; i++) {
        if (state.rows[i].key === key) { prior = state.rows[i]; break; }
      }
      if (prior) {
        if (prior.digest === digest) { dup++; }
        else {
          conflict++;
          state.rowErrors.push({ line: idx + 2, key: key, note: '같은 키에 다른 내용이에요 (충돌)', raw: fields });
        }
        return;
      }
      state.rows.push({
        key: key, digest: digest, locked: [],
        item: '', desc: '', ruleId: null,
        // 허용 여행 지정 열이 있으면 '여행 지정'만 자동 확정된다.
        // 비용 항목은 자동 판단하지 않고 운영자가 정해야 한다.
        pending: event.display_tab_id
          ? { tab: event.display_tab_id, item: '', desc: event.memo, auto: true }
          : null,
        event: event
      });
      added++;
    });

    state.batches[batchHash] = {
      batchId: 'imp-' + batchHash.slice(0, 16),
      added: added, dup: dup, conflict: conflict, errors: errors
    };

    var html = '<b>가져오기 완료</b> · 배치 <code>' + esc(state.batches[batchHash].batchId) + '</code><ul>' +
      '<li>장부 추가 <b>' + added + '</b>건</li>' +
      '<li>같은 키·같은 내용(중복) <b>' + dup + '</b>건 — 다시 쓰지 않음</li>' +
      '<li>같은 키·다른 내용(충돌) <b>' + conflict + '</b>건 — 자동 해소하지 않음</li>' +
      '<li>행 검사 오류 <b>' + errors + '</b>건 — 장부에서 제외</li></ul>';
    if (state.rowErrors.length) {
      html += '<details><summary>오류/충돌 행 보기 (' + state.rowErrors.length + '건)</summary><ul>' +
        state.rowErrors.map(function (e) {
          return '<li>입력 ' + e.line + '번째 줄 · ' + esc((e.raw && e.raw.merchant) || '(가맹점 없음)') +
            ' · ' + esc(e.note) + '</li>';
        }).join('') + '</ul></details>';
    }
    html += '<p class="help">같은 파일을 다시 실행하면 위의 ‘재사용’ 결과가 나옵니다.</p>';
    out.innerHTML = box(added ? 'ok' : 'warn', html);
    render();
  }

  /* ------------------------------------------------------------------ *
   * 규칙 매칭 / 효과 계획 / 충돌
   * ------------------------------------------------------------------ */
  function ruleMatches(rule, row) {
    if (rule.status !== 'active') return false;
    var conds = rule.conditions || {};
    if (conds.merchant_normalized) {
      if (normalizeMerchant(row.event.merchant) !== conds.merchant_normalized) return false;
    }
    if (conds.card_kind && row.event.card_kind !== conds.card_kind) return false;
    if (conds.transaction_direction && row.event.event_kind !== conds.transaction_direction) return false;
    if (conds.only_key && row.key !== conds.only_key) return false;
    return true;
  }

  function resolveValue(rule, row, field) {
    var val = rule.effects[field];
    if (val == null) return null;
    if (field === 'description_template') {
      return String(val).replace('{merchant}', row.event.merchant);
    }
    return val;
  }

  // 수동 잠금 필드는 건너뛴다. 같으면 바꿀 이유가 없으므로 change 로만 표시.
  function planEffect(rule, row) {
    var changes = {};
    Object.keys(rule.effects || {}).forEach(function (field) {
      if (row.locked && row.locked.indexOf(field) >= 0) return;
      var next = resolveValue(rule, row, field);
      var current = currentValue(row, field);
      if (next !== current) changes[field] = next;
    });
    return changes;
  }

  function currentValue(row, field) {
    if (field === 'display_tab_id') return row.pending ? row.pending.tab : '';
    if (field === 'item') return row.pending ? row.pending.item : row.item;
    if (field === 'description_template') return row.pending ? row.pending.desc : row.desc;
    return '';
  }

  function findConflicts(rule, activeRules) {
    var found = [];
    state.rows.forEach(function (row) {
      if (!ruleMatches(rule, row)) return;
      activeRules.forEach(function (other) {
        if (other.rule_id === rule.rule_id || other.status !== 'active') return;
        if (!ruleMatches(other, row)) return;
        Object.keys(other.effects || {}).forEach(function (field) {
          if (!(field in rule.effects)) return;
          var mine = resolveValue(rule, row, field);
          var theirs = resolveValue(other, row, field);
          if (mine != null && theirs != null && mine !== theirs) {
            found.push({
              row: row, other: other, field: field,
              existing: theirs, incoming: mine,
              resolution: 'existing_supersede_or_narrow', auto_resolved: false
            });
          }
        });
      });
    });
    return found;
  }

  function findSameEffect(rule, activeRules) {
    var same = [];
    state.rows.forEach(function (row) {
      if (!ruleMatches(rule, row)) return;
      activeRules.forEach(function (other) {
        if (other.rule_id === rule.rule_id || other.status !== 'active') return;
        if (!ruleMatches(other, row)) return;
        Object.keys(other.effects || {}).forEach(function (field) {
          if (!(field in rule.effects)) return;
          var mine = resolveValue(rule, row, field);
          var theirs = resolveValue(other, row, field);
          if (mine != null && theirs != null && mine === theirs) same.push({ row: row, field: field, value: mine });
        });
      });
    });
    return same;
  }

  /* ------------------------------------------------------------------ *
   * 규칙 대화 → 규칙 만들기
   * ------------------------------------------------------------------ */
  function openDialog() {
    var row = selectedRow();
    if (!row) return;
    state.dialog = { rowKey: row.key, index: 0, answers: {}, effect: null, conflicts: [], same: [], resolution: {} };
    $('panel-rule').hidden = false;
    $('csv-input').value = $('csv-input').value; // no-op, keeps focus semantics stable
    renderDialog();
    $('panel-rule').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildRuleFromAnswers() {
    var row = selectedRow();
    var a = state.dialog.answers;
    var effects = {};
    var pending = row.pending || { tab: '', item: '', desc: '' };
    if (a.trip_scope !== 'no_trip') {
      effects.display_tab_id = a.trip_scope === 'other_trip'
        ? (TRIP_TABS.filter(function (t) { return t.id !== pending.tab; })[0] || TRIP_TABS[0]).id
        : (pending.tab || TRIP_TABS[0].id);
    }
    if (a.rule_kind !== 'this_only' || a.evidence_basis === 'one_off_exception') {
      // 분류 패널에서 운영자가 고른 비용 항목만 규칙이 씁니다.
      var picked = $('sel-item').value;
      if (picked) effects.item = picked;
    }
    // 비고 서식의 원본은 운영자가 입력한 값입니다. 이미 치환된 값을 다시
    // 템플릿으로 쓰면 재적용 때 merchant 문자열이 누적되므로 입력값에서 만듭니다.
    var rawDesc = rawDescOf(row).trim();
    if (rawDesc) effects.description_template = '{merchant} · ' + rawDesc;

    var conditions = { card_kind: row.event.card_kind, transaction_direction: row.event.event_kind };
    if (a.rule_kind === 'repeatable' || a.evidence_basis === 'merchant_service') {
      conditions.merchant_normalized = normalizeMerchant(row.event.merchant);
    } else {
      conditions.only_key = row.key;
    }
    var optional = a.period === 'limited_period'
      ? { date_or_service_period: '2026-01-01 ~ 2026-12-31' } : {};

    return {
      rule_id: 'rule-' + demoHash(row.key + a.rule_kind + a.trip_scope + a.period + a.evidence_basis).slice(0, 8),
      version: 1,
      status: 'active',
      learning_case_id: 'demo-case-' + row.key.slice(0, 6),
      answers: a,
      conditions: conditions,
      optional_conditions: optional,
      effects: effects
    };
  }

  function renderDialog() {
    var d = state.dialog;
    var q = $('rule-question'), pv = $('rule-preview');
    var back = $('btn-rule-back'), next = $('btn-rule-next'), apply = $('btn-rule-apply');
    back.hidden = true; next.hidden = true; apply.hidden = true; pv.hidden = true;

    var dots = QUESTIONS.map(function (_, i) {
      return '<i class="' + (i < d.index || d.answers[QUESTIONS[i].key] ? 'is-done' : '') + '"></i>';
    }).join('');
    $('rule-progress').innerHTML = dots;

    if (d.index < QUESTIONS.length) {
      var spec = QUESTIONS[d.index];
      q.hidden = false;
      var answered = Object.keys(d.answers).map(function (k) {
        for (var i = 0; i < QUESTIONS.length; i++) {
          if (QUESTIONS[i].key !== k) continue;
          var lbl = '';
          QUESTIONS[i].options.forEach(function (o) { if (o[0] === d.answers[k]) lbl = o[1]; });
          return '<li>' + esc(String(QUESTIONS[i].prompt).replace(/[?]\s*$/, '')) + ': ' + esc(lbl) + '</li>';
        }
        return '';
      }).join('');
      q.innerHTML = '<h4>질문 ' + (d.index + 1) + ' / ' + QUESTIONS.length + ' — ' + esc(spec.prompt) + '</h4>' +
        (answered ? '<ul class="answered">' + answered + '</ul>' : '') +
        '<div class="opts" role="radiogroup" aria-label="' + esc(spec.prompt) + '">' +
        spec.options.map(function (o) {
          return '<label class="opt"><input type="radio" name="q" value="' + esc(o[0]) + '">' +
            '<span>' + esc(o[1]) + '</span></label>';
        }).join('') + '</div>';
      var picked = q.querySelector('input[name="q"]:checked');
      if (picked) { next.disabled = false; } else { next.disabled = true; }
      next.textContent = d.index === QUESTIONS.length - 1 ? '규칙 미리보기' : '다음 질문';
      next.hidden = false;
      back.hidden = d.index === 0;
      return;
    }

    // 5개 질문이 끝나면 미리보기
    var rule = buildRuleFromAnswers();
    d.rule = rule;
    var targets = state.rows.filter(function (r) { return ruleMatches(rule, r) && planEffect(rule, r) && Object.keys(planEffect(rule, r)).length; });
    d.targets = targets;
    d.conflicts = findConflicts(rule, state.rules);
    d.same = findSameEffect(rule, state.rules);

    q.hidden = true;
    pv.hidden = false;
    var html = '<h4>규칙 미리보기 — 적용 전에 무엇이 바뀌는지 확인합니다</h4><dl class="kv">' +
      '<dt>규칙 식별자</dt><dd><code>' + esc(rule.rule_id) + '</code> (v' + rule.version + ')</dd>' +
      '<dt>대상 조건</dt><dd>' + condText(rule.conditions) + '</dd>' +
      '<dt>선택 조건</dt><dd>' + (rule.optional_conditions.date_or_service_period
        ? '기간 <code>' + esc(rule.optional_conditions.date_or_service_period) + '</code>' : '없음') + '</dd>' +
      '<dt>근거 답변</dt><dd>' + esc(answerText(rule.answers)) + '</dd>' +
      '<dt>바뀌는 행</dt><dd><b>' + targets.length + '건</b> (수동 잠금 필드는 건너뜀)</dd></dl>';

    if (!rule.effects.item) {
      html += '<div class="box box-warn">비용 항목을 고르지 않아 이 규칙은 여행 지정과 비고만 씁니다. ' +
        '비용 항목까지 다루려면 3번 패널에서 항목을 고른 뒤 다시 열어주세요.</div>';
    }

    if (targets.length) {
      html += '<ul class="diff-list">' + targets.map(function (r) {
        var ch = planEffect(rule, r);
        return '<li><b>' + esc(r.event.merchant) + '</b> · ' + esc(r.event.occurred_on) +
          ' <ul class="diff-list">' + Object.keys(ch).map(function (f) {
            return '<li>' + esc(fieldLabel(f)) + ': <span class="to">' + esc(displayVal(f, ch[f])) + '</span></li>';
          }).join('') + '</ul></li>';
      }).join('') + '</ul>';
    }
    if (d.same.length) {
      html += '<div class="box box-warn" style="margin-top:12px">같은 값을 이미 쓰는 활성 규칙이 ' +
        d.same.length + '건 겹칩니다. 이 건들은 다시 쓰지 않습니다(중복 효과).</div>';
    }
    if (d.conflicts.length) {
      html += '<div class="conflict-box"><h5>충돌 ' + d.conflicts.length + '건 — 자동으로 해소하지 않습니다</h5>' +
        d.conflicts.map(function (c, i) {
          return '<div class="conflict"><h6>' + esc(c.row.event.merchant) + ' · ' +
            esc(fieldLabel(c.field)) + ' 값이 다름</h6>' +
            '<div>기존 규칙 <code>' + esc(c.other.rule_id) + '</code>: <b>' + esc(displayVal(c.field, c.existing)) + '</b> → ' +
            '새 규칙: <b>' + esc(displayVal(c.field, c.incoming)) + '</b></div>' +
            '<div class="opts" role="radiogroup" aria-label="충돌 ' + (i + 1) + '번 해결 방법">' +
            '<label class="opt"><input type="radio" name="cf' + i + '" value="keep_existing" checked>' +
            '<span>기존 규칙 유지 — 이 건은 자동 적용하지 않음</span></label>' +
            '<label class="opt"><input type="radio" name="cf' + i + '" value="supersede">' +
            '<span>기존 규칙을 대체로 표시하고 새 규칙 적용</span></label></div></div>';
        }).join('') + '</div>';
    }
    pv.innerHTML = html;
    apply.hidden = false;
  }

  function condText(conditions) {
    var parts = [];
    if (conditions.merchant_normalized) parts.push('가맹점 정규화값 = <code>' + esc(conditions.merchant_normalized) + '</code>');
    if (conditions.only_key) parts.push('이 건의 안정 키 = <code>' + esc(conditions.only_key.slice(0, 12)) + '…</code> (한 건만)');
    if (conditions.card_kind) parts.push('카드 종류 = ' + esc(conditions.card_kind));
    if (conditions.transaction_direction) parts.push('거래 방향 = ' + esc(kindLabel(conditions.transaction_direction)));
    return parts.join('<br>');
  }

  function answerText(answers) {
    var out = [];
    var given = answers || {};
    QUESTIONS.forEach(function (q) {
      var v = given[q.key];
      if (!v) return;
      var lbl = v;
      q.options.forEach(function (o) { if (o[0] === v) lbl = o[1]; });
      out.push(lbl);
    });
    return out.join(' / ');
  }

  function fieldLabel(f) {
    return { display_tab_id: '여행 지정', item: '비용 항목', description_template: '장부 비고' }[f] || f;
  }

  // 여행 지정은 내부 식별자 대신 화면용 이름을 보여줍니다.
  function displayVal(field, value) {
    if (field === 'display_tab_id') return value ? tabLabel(value) : '(지정 안 함)';
    return value || '(지정 안 함)';
  }

  function kindLabel(k) {
    return { purchase: '결제', refund: '환불', cancellation: '취소' }[k] || k;
  }

  function applyRule() {
    var d = state.dialog, rule = d.rule, out = $('detail-result');
    var superseded = 0, applied = 0, skipped = 0, dup = 0;

    d.conflicts.forEach(function (c, i) {
      var picked = document.querySelector('input[name="cf' + i + '"]:checked');
      var how = picked ? picked.value : 'keep_existing';
      if (how === 'supersede') { c.other.status = 'superseded'; superseded++; }
    });

    d.targets.forEach(function (row) {
      var blocked = d.conflicts.some(function (c) {
        if (c.row.key !== row.key) return false;
        var picked = document.querySelector('input[name="cf' + d.conflicts.indexOf(c) + '"]:checked');
        return !picked || picked.value === 'keep_existing';
      });
      if (blocked) { skipped++; return; }
      var ch = planEffect(rule, row);
      if (!Object.keys(ch).length) { dup++; return; }
      Object.keys(ch).forEach(function (f) { setValue(row, f, ch[f]); });
      row.ruleId = rule.rule_id;
      applied++;
    });

    state.rules.push(rule);
    state.dialog = null;
    $('panel-rule').hidden = true;
    $('rule-preview').hidden = true;
    $('rule-question').innerHTML = '';

    out.innerHTML = box('ok', '<b>규칙 적용 완료</b> · <code>' + esc(rule.rule_id) + '</code><ul>' +
      '<li>장부에 반영 <b>' + applied + '</b>건</li>' +
      '<li>기존 규칙 유지로 건너뜀 <b>' + skipped + '</b>건</li>' +
      '<li>이미 같은 값이라 변화 없음 <b>' + dup + '</b>건</li>' +
      '<li>대체로 표시된 기존 규칙 <b>' + superseded + '</b>개</li></ul>' +
      '<p class="help">같은 행에 이 규칙을 다시 적용해도 같은 값은 다시 쓰지 않습니다.</p>');
    render();
  }

  function setValue(row, field, value) {
    if (!row.pending) row.pending = { tab: '', item: '', desc: '', raw: '' };
    if (field === 'display_tab_id') row.pending.tab = value;
    if (field === 'item') row.pending.item = value;
    if (field === 'description_template') {
      row.pending.desc = value;
      // 치환된 값에서 가맹점 접두를 걷어내 운영자가 입력한 원문을 유지한다.
      row.pending.raw = String(value).split(String(row.event.merchant) + ' · ').join('');
    }
  }

  function rawDescOf(row) {
    if (row.pending && typeof row.pending.raw === 'string') return row.pending.raw;
    return typeof row.rawDesc === 'string' ? row.rawDesc : '';
  }

  /* ------------------------------------------------------------------ *
   * 행 단위 분류
   * ------------------------------------------------------------------ */
  function applySingleRow() {
    var row = selectedRow();
    if (!row) return;
    var item = $('sel-item').value;
    var tab = $('sel-tab').value;
    var desc = $('inp-desc').value.trim();
    row.item = item;
    row.desc = desc;
    row.rawDesc = desc;
    row.pending = { tab: tab, item: item, desc: desc, raw: desc, auto: false };
    row.ruleId = null;
    if ($('chk-lock').checked) {
      if (row.locked.indexOf('item') < 0) row.locked.push('item');
    } else {
      row.locked = row.locked.filter(function (f) { return f !== 'item'; });
    }
    $('detail-result').innerHTML = box('ok',
      '<b>이 건만 장부에 기록했습니다.</b><ul>' +
      '<li>비용 항목: ' + esc(item) + '</li>' +
      '<li>여행 지정: ' + esc(tabLabel(tab)) + '</li>' +
      '<li>상태: 완료 — 같은 판단이 반복되면 ‘규칙으로 만들어 적용’을 쓰세요.</li></ul>');
    render();
  }

  function tabLabel(id) {
    var t = TRIP_TABS.filter(function (x) { return x.id === id; })[0];
    return t ? t.label : '지정 안 함';
  }

  function selectedRow() {
    for (var i = 0; i < state.rows.length; i++) {
      if (state.rows[i].key === state.selectedKey) return state.rows[i];
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * 렌더링
   * ------------------------------------------------------------------ */
  function rowStatus(row) {
    if (!row.pending) return { cls: 'todo', text: '미분류' };
    if (row.pending.auto && !row.pending.item) return { cls: 'keep', text: '여행 자동 지정' };
    if (row.locked.indexOf('item') >= 0) return { cls: 'keep', text: '수동 지정' };
    if (row.ruleId) return { cls: 'done', text: '완료 (규칙)' };
    return { cls: 'done', text: '완료' };
  }

  function renderKpi() {
    var purchase = 0, refund = 0, done = 0, errorCount = state.rowErrors.length;
    var pendingAmount = 0;
    state.rows.forEach(function (r) {
      if (r.event.event_kind === 'purchase') purchase += r.event.amount_krw;
      else refund += Math.abs(r.event.amount_krw);
      // 여행 지정만 자동 확정된 행은 비용 항목이 남아 있어 완료로 세지 않습니다.
      if (r.pending && r.pending.item) done++; else pendingAmount += r.event.amount_krw;
    });
    var rate = state.rows.length ? Math.round((done / state.rows.length) * 100) : 0;
    $('kpi').innerHTML =
      '<dl class="kpi"><dt>장부 건수</dt><dd>' + state.rows.length + '건<small>합성 내역</small></dd></dl>' +
      '<dl class="kpi"><dt>승인 합계</dt><dd>' + won(purchase) + '<small>환불 ' + won(refund) + '</small></dd></dl>' +
      '<dl class="kpi"><dt>분류 완료율</dt><dd>' + rate + '%<small>완료 ' + done + ' / 전체 ' + state.rows.length + '</small></dd></dl>' +
      '<dl class="kpi"><dt>분류 남음 금액</dt><dd>' + won(pendingAmount) + '<small>행 오류 ' + errorCount + '건 별도</small></dd></dl>';
  }

  function renderBoard() {
    var body = $('board-body');
    if (!state.rows.length) {
      body.innerHTML = '<tr><td colspan="5" class="st-memo">보드 데이터가 없습니다. 1번 패널에서 CSV를 가져오세요.</td></tr>';
      return;
    }
    var list = state.rows.filter(function (r) {
      var settled = !!(r.pending && r.pending.item);
      if (state.filter === 'todo') return !settled;
      if (state.filter === 'done') return settled;
      return true;
    });
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="5" class="st-memo">이 필터에 해당하는 행이 없습니다.</td></tr>';
      return;
    }
    body.innerHTML = list.map(function (r) {
      var st = rowStatus(r);
      var memo;
      if (!r.pending) {
        memo = '';
      } else {
        memo = (r.pending.item || '비용 항목 선택 필요');
        if (r.pending.tab) memo += ' · ' + tabLabel(r.pending.tab);
      }
      return '<tr tabindex="0" role="button" data-key="' + esc(r.key) + '"' +
        (r.key === state.selectedKey ? ' class="is-selected"' : '') + '>' +
        '<td>' + esc(r.event.occurred_on) + '</td>' +
        '<td>' + esc(r.event.merchant) + '<div class="st-memo">' + esc(memo || '분류 전') + '</div></td>' +
        '<td class="num">' + esc(won(r.event.amount_krw)) + '</td>' +
        '<td><span class="tag tag-' + esc(r.event.event_kind) + '">' + esc(kindLabel(r.event.event_kind)) + '</span></td>' +
        '<td><span class="tag tag-' + esc(st.cls) + '">' + esc(st.text) + '</span></td></tr>';
    }).join('');
  }

  function renderDetail() {
    var row = selectedRow();
    $('detail-empty').hidden = !!row;
    $('detail-body').hidden = !row;
    if (!row) return;

    $('detail-title').textContent = row.event.merchant + ' · ' + won(row.event.amount_krw);
    $('detail-meta').textContent = row.event.occurred_on + ' · 카드끝' + (row.event.card_last4 || '----') +
      ' · 승인번호 ' + (row.event.approval_no || '(없음)') +
      ' · 안정 키 ' + row.key.slice(0, 12) + '… · 내용 지문 ' + row.digest.slice(0, 8) + '…';

    var cur = row.pending || {};
    $('sel-item').value = cur.item || row.item || '';
    $('sel-tab').value = cur.tab || '';
    if (document.activeElement !== $('inp-desc')) $('inp-desc').value = rawDescOf(row);
    $('chk-lock').checked = row.locked.indexOf('item') >= 0;
  }

  function renderRules() {
    var host = $('rules-list');
    if (!state.rules.length) {
      host.innerHTML = '<p class="help">아직 만든 규칙이 없습니다. 3번 패널에서 ‘규칙으로 만들어 적용’을 실행하세요.</p>';
      return;
    }
    host.innerHTML = state.rules.map(function (r) {
      var matched = state.rows.filter(function (row) { return ruleMatches(r, row); }).length;
      var st = r.status === 'active'
        ? '<span class="tag status-active">적용 중</span>'
        : '<span class="tag status-superseded">대체됨</span>';
      return '<div class="rule-card"><div class="rc-head"><b>' + esc(r.rule_id) + ' (v' + r.version + ')</b>' + st + '</div>' +
        '<p>조건: ' + condText(r.conditions) + '</p>' +
        '<p>효과: ' + esc(Object.keys(r.effects).map(function (f) {
          return fieldLabel(f) + ' = ' + (f === 'description_template'
            ? r.effects[f]
            : displayVal(f, r.effects[f]));
        }).join(', ') || '없음') + '</p>' +
        '<p class="rc-id">대상 행 ' + matched + '건 · 근거 ' + esc(answerText(r.answers) || '근거 답변 없음') + '</p></div>';
    }).join('');
  }

  function render() {
    renderKpi();
    renderBoard();
    renderDetail();
    renderRules();
  }

  function box(kind, html) { return '<div class="box box-' + kind + '">' + html + '</div>'; }

  /* ------------------------------------------------------------------ *
   * 초기화 / 시드
   * ------------------------------------------------------------------ */
  function resetAll() {
    state.rows = [];
    state.rowErrors = [];
    state.batches = {};
    state.rules = [];
    state.selectedKey = null;
    state.filter = 'all';
    state.dialog = null;
    $('csv-input').value = '';
    $('import-result').innerHTML = '';
    $('detail-result').innerHTML = '';
    $('panel-rule').hidden = true;
    $('rule-preview').hidden = true;
    $('rule-question').innerHTML = '';
    $('rule-progress').innerHTML = '';
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) {
      c.classList.toggle('is-on', c.dataset.filter === 'all');
    });
    $('sel-item').innerHTML = '<option value="">선택하세요 (비우면 이 규칙은 비용 항목을 다루지 않습니다)</option>' +
      COST_ITEMS.map(function (i) {
        return '<option value="' + esc(i) + '">' + esc(i) + '</option>';
      }).join('');
    $('sel-tab').innerHTML = '<option value="">지정 안 함</option>' + TRIP_TABS.map(function (t) {
      return '<option value="' + esc(t.id) + '">' + esc(t.label) + '</option>';
    }).join('');
    render();
    $('import-result').innerHTML = box('', '초기화했습니다. 모든 상태가 처음대로 돌아왔습니다.');
  }

  /* ------------------------------------------------------------------ *
   * 이벤트 바인딩
   * ------------------------------------------------------------------ */
  function bind() {
    $('btn-import').addEventListener('click', runImport);
    $('btn-sample').addEventListener('click', function () { $('csv-input').value = SAMPLE_CSV; });
    $('btn-sample2').addEventListener('click', function () { $('csv-input').value = SAMPLE_CSV_ERR; });
    $('btn-reset').addEventListener('click', resetAll);
    $('btn-apply-row').addEventListener('click', applySingleRow);
    $('btn-open-rule').addEventListener('click', openDialog);
    $('btn-close-rule').addEventListener('click', function () {
      state.dialog = null; $('panel-rule').hidden = true;
      $('rule-preview').hidden = true; $('rule-question').innerHTML = ''; $('rule-progress').innerHTML = '';
    });

    $('btn-rule-next').addEventListener('click', function () {
      var picked = document.querySelector('#rule-question input[name="q"]:checked');
      if (!picked) return;
      var spec = QUESTIONS[state.dialog.index];
      state.dialog.answers[spec.key] = picked.value;
      state.dialog.index++;
      renderDialog();
    });
    $('btn-rule-back').addEventListener('click', function () {
      if (state.dialog.index === 0) return;
      var prevKey = QUESTIONS[state.dialog.index - 1].key;
      delete state.dialog.answers[prevKey];
      state.dialog.index--;
      renderDialog();
    });
    $('btn-rule-apply').addEventListener('click', applyRule);

    $('rule-question').addEventListener('change', function () {
      var next = $('btn-rule-next');
      next.disabled = !document.querySelector('#rule-question input[name="q"]:checked');
    });

    $('board-body').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-key]');
      if (tr) selectRow(tr.dataset.key);
    });
    $('board-body').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var tr = e.target.closest && e.target.closest('tr[data-key]');
      if (!tr) return;
      e.preventDefault();
      selectRow(tr.dataset.key);
    });

    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (chip) {
      chip.addEventListener('click', function () {
        state.filter = chip.dataset.filter;
        Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) {
          c.classList.toggle('is-on', c === chip);
        });
        renderBoard();
      });
    });
  }

  function selectRow(key) {
    state.selectedKey = key;
    $('detail-result').innerHTML = '';
    render();
  }

  /* ------------------------------------------------------------------ */
  bind();
  resetAll();
  // 초기화는 입력창까지 비우므로, 첫 화면에서 바로 실행할 수 있게
  // 샘플을 그 다음에 채웁니다.
  $('csv-input').value = SAMPLE_CSV;
  $('import-result').innerHTML = box('', '샘플 CSV가 준비되어 있습니다. <b>가져오기 실행</b>을 눌러 시작하세요.');
})();
