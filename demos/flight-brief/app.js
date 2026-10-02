/* 항공권 예약 준비 자동화 데모 (합성 데이터 전용)
 * 참고한 원본 규칙을 브라우저 단독 JavaScript로 다시 작성한 예제입니다.
 * 원본 파이썬 소스를 복사하지 않았고, 서버 호출 / 저장 / 외부 전송이 없습니다.
 */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────
   * 1. 규칙 데이터 (원본 파서/검증기의 규칙을 옮긴 것)
   * ───────────────────────────────────────────────────────── */

  // 공항 매핑: 한글 표기 -> IATA 코드 (데모에 필요한 축약 사전)
  var AIRPORTS = {
    '인천': 'ICN', '김포': 'GMP', '제주': 'CJU', '부산': 'PUS',
    '도쿄': 'NRT', '나리타': 'NRT', '하네다': 'HND', '오사카': 'KIX',
    '간사이': 'KIX', '후쿠오카': 'FUK', '시즈오카': 'FSZ', '고마츠': 'KOJ',
    '아오모리': 'AOJ', '삿포로': 'CTS', '나고야': 'NGO', '나가오키': 'NGO'
  };
  var AIRPORT_NAMES = Object.keys(AIRPORTS).sort(function (a, b) {
    return b.length - a.length;
  });

  var KOREA_AIRPORTS = { ICN: 1, GMP: 1, CJU: 1, PUS: 1 };

  var KNOWN_CODES = (function () {
    var set = {};
    Object.keys(AIRPORTS).forEach(function (k) { set[AIRPORTS[k]] = 1; });
    return set;
  })();

  var VENDOR_ALIASES = {
    'trip.com': 'Trip.com',
    '트립닷컴': 'Trip.com',
    'teaflight': 'TeaFlight',
    '웹투어': '웹투어'
  };

  var PASSPORT_MIN_DAYS = 183;   // 약 6개월, 귀국일 기준
  var PASSPORT_WARN_DAYS = 213; // 183일 이상이지만 빠듯한 구간 상한

  var LEVEL = { ERROR: 'ERROR', WARN: 'WARN', INFO: 'INFO' };

  /* ─────────────────────────────────────────────────────────
   * 2. 파싱 (자유 텍스트 -> 주문서 배열)
   * ───────────────────────────────────────────────────────── */

  var RE_DATE_RANGE = /(\d{1,2})\s*[.\/월\-]\s*(\d{1,2})\s*일?\s*[~∼〜]\s*(?:(\d{1,2})\s*[.\/월\-]\s*)?(\d{1,2})\s*일?/g;
  var RE_DATE_ONE = /(\d{1,2})\s*[.\/월\-]\s*(\d{1,2})\s*일?/;
  var RE_TIME = /(오전|오후)\s*(\d{1,2})\s*:\s*(\d{2})/g;
  var RE_AIRLINE = /([가-힣A-Za-z]{1,10}항공)/g;
  var RE_PAREN_CODE = /\(([A-Za-z]{3})\)/g;
  var RE_VENDOR = /(Trip\.com|트립닷컴|TeaFlight|웹투어)/gi;
  var RE_VENDOR_PRICE = /(Trip\.com|트립닷컴|TeaFlight|웹투어)\s*₩\s*([\d,]+)/gi;
  var RE_PRICE = /₩\s*([\d,]+)/g;
  var RE_PAX_COUNT = /(\d+)\s*명/;
  var RE_PAX_LIST = /((?:\d+\s*[,，·]\s*)+\d+)\s*번/;

  function todayUTC() {
    var n = new Date();
    return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function toUTC(y, m, d) {
    var ms = Date.UTC(y, m - 1, d);
    var chk = new Date(ms);
    if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== m - 1 || chk.getUTCDate() !== d) {
      return null; // 존재하지 않는 날짜 (예: 2월 30일)
    }
    return ms;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function msToISO(ms) {
    if (ms == null) return '';
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  function isoToUTC(value) {
    if (!value) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return null;
    return toUTC(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  function yearOf(ms) { return new Date(ms).getUTCFullYear(); }
  function monthOf(ms) { return new Date(ms).getUTCMonth() + 1; }
  function dayOf(ms) { return new Date(ms).getUTCDate(); }

  // 연도 미지정 시: 해당 월일이 오늘보다 과거면 내년으로 보정
  function resolveYear(month, day, todayMs) {
    var y = new Date(todayMs).getUTCFullYear();
    var ms = toUTC(y, month, day);
    if (ms == null) return y;
    return ms >= todayMs ? y : y + 1;
  }

  function parseDateRanges(text, todayMs) {
    var out = [];
    var re = new RegExp(RE_DATE_RANGE.source, 'g');
    var m;
    while ((m = re.exec(text)) !== null) {
      var sM = Number(m[1]), sD = Number(m[2]);
      var eM = m[3] ? Number(m[3]) : sM, eD = Number(m[4]);
      var year = resolveYear(sM, sD, todayMs);
      var depart = toUTC(year, sM, sD);
      if (depart == null) continue;
      var ret = toUTC(year, eM, eD);
      if (ret == null) ret = null;
      else if (ret < depart) ret = toUTC(year + 1, eM, eD);
      out.push({ start: m.index, end: m.index + m[0].length, depart: depart, ret: ret });
    }
    return out;
  }

  function parseTimes(text) {
    var re = new RegExp(RE_TIME.source, 'g');
    var out = [];
    var m;
    while ((m = re.exec(text)) !== null) {
      var mer = m[1], h = Number(m[2]), mi = m[3];
      if (mer === '오후' && h !== 12) h += 12;
      else if (mer === '오전' && h === 12) h = 0;
      out.push(pad(h) + ':' + mi);
    }
    return out;
  }

  function parseAirlines(text) {
    var re = new RegExp(RE_AIRLINE.source, 'g');
    var out = [];
    var m;
    while ((m = re.exec(text)) !== null) out.push(m[1]);
    return out;
  }

  function parseAirportCodes(text) {
    var found = [];
    // 괄호 안 명시 코드(인천(ICN))를 같은 위치의 한글 표기보다 먼저 넣는다
    var explicitRe = new RegExp(RE_PAREN_CODE.source, 'g');
    var m;
    while ((m = explicitRe.exec(text)) !== null) {
      found.push({ at: m.index, len: 3, code: m[1].toUpperCase(), prio: 0 });
    }

    AIRPORT_NAMES.forEach(function (name) {
      var from = 0, idx;
      while ((idx = text.indexOf(name, from)) !== -1) {
        // 한 글자 약칭('인' -> 인천)은 낱말 경계 밖이면 버린다(확인/인사 오탐 방지)
        if (name.length === 1 && name === '인') {
          var before = idx > 0 ? text.charAt(idx - 1) : '';
          var after = idx + 1 < text.length ? text.charAt(idx + 1) : '';
          if (isHangul(before) || isHangul(after)) { from = idx + 1; return; }
        }
        found.push({ at: idx, len: name.length, code: AIRPORTS[name], prio: 1 });
        from = idx + name.length;
      }
    });
    // 등장 위치 순, 같은 위치면 명시 코드 우선, 겹치면 더 긴 표기 우선
    found.sort(function (a, b) { return a.at - b.at || a.prio - b.prio || b.len - a.len; });
    var out = [], seen = {}, consumed = -1;
    found.forEach(function (f) {
      if (f.at < consumed) return;         // 앞선 더 긴 매칭에 겹쳐 있으면 버림
      if (seen[f.code]) return;             // 같은 코드는 첫 등장만 유지
      seen[f.code] = true;
      out.push(f.code);
      consumed = f.at + f.len;
    });
    return out;
  }

  function isHangul(ch) {
    return !!ch && ch.charCodeAt(0) >= 0xAC00 && ch.charCodeAt(0) <= 0xD7A3;
  }

  function parsePrices(text) {
    var re = new RegExp(RE_PRICE.source, 'g');
    var out = [];
    var m;
    while ((m = re.exec(text)) !== null) out.push(Number(m[1].replace(/,/g, '')));
    return out;
  }

  function parseVendors(text) {
    var re = new RegExp(RE_VENDOR_PRICE.source, 'g');
    var pairs = [], m;
    while ((m = re.exec(text)) !== null) {
      pairs.push({ vendor: normVendor(m[1]), price: Number(m[2].replace(/,/g, '')) });
    }
    if (pairs.length) return pairs;

    var vre = new RegExp(RE_VENDOR.source, 'g');
    var names = [], prices = parsePrices(text);
    while ((m = vre.exec(text)) !== null) names.push(normVendor(m[1]));
    return names.map(function (v, i) {
      return { vendor: v, price: prices[i] != null ? prices[i] : 0 };
    });
  }

  function normVendor(raw) {
    var key = String(raw).toLowerCase();
    return VENDOR_ALIASES[key] || raw;
  }

  function parsePax(text) {
    var m = RE_PAX_COUNT.exec(text);
    if (m) return Math.max(1, Number(m[1]));
    var l = RE_PAX_LIST.exec(text);
    if (l) return l[1].split(/[,，·]/).filter(function (s) { return s.trim() !== ''; }).length;
    return 0;
  }

  function blankLeg() {
    return { origin: '', dest: '', dt: '', at: '', airline: '' };
  }

  function parseOrderFromSegment(text, todayMs, seed) {
    var times = parseTimes(text);
    var airlines = parseAirlines(text);
    var codes = parseAirportCodes(text);
    var ranges = parseDateRanges(text, todayMs);
    var vendors = parseVendors(text);
    var range = ranges[0] || null;
    var depart = range ? range.depart : null;
    var ret = range ? range.ret : null;
    var round = times.length >= 4 || codes.length >= 4 || ret != null;

    // 한국 출발 패턴:国外 공항이 있으면 도착지, 출발지는 한국 공항(없으면 ICN)
    var foreign = codes.filter(function (c) { return !KOREA_AIRPORTS[c]; });
    var korean = codes.filter(function (c) { return !!KOREA_AIRPORTS[c]; });
    var origin, dest;
    if (foreign.length) {
      origin = korean.length ? korean[0] : 'ICN';
      dest = foreign[0];
    } else {
      origin = codes.length ? codes[0] : '';
      dest = codes.length > 1 ? codes[1] : '';
    }

    var outbound = {
      origin: origin, dest: dest,
      dt: times[0] || '', at: times[1] || '',
      airline: airlines[0] || ''
    };
    var inbound = null;
    if (round) {
      inbound = {
        origin: outbound.dest, dest: outbound.origin,
        dt: times[2] || '', at: times[3] || '',
        airline: airlines[1] || ''
      };
    }

    var chosen = vendors.length ? vendors[0] : { vendor: '', price: 0 };
    return {
      label: (seed && seed.label) ? seed.label : 1,
      depart: depart, ret: round ? ret : null, round: round,
      outbound: outbound, inbound: inbound,
      vendor: chosen.vendor, price: chosen.price,
      vendors: vendors,
      pax: seed.pax || 0
    };
  }

  function parseOrders(text) {
    var todayMs = todayUTC();
    var ranges = parseDateRanges(text, todayMs);
    var segments;
    if (ranges.length <= 1) {
      segments = [{ text: text, pax: parsePax(text) }];
    } else {
      segments = ranges.map(function (r, i) {
        var end = i + 1 < ranges.length ? ranges[i + 1].start : text.length;
        return { text: text.slice(r.start, end), pax: 0 };
      });
      // 인원수 표기는 첫 날짜 앞에 쓰는 경우가 많아 첫 여정에 보충
      segments[0].pax = parsePax(text.slice(0, ranges[0].start)) || parsePax(segments[0].text);
    }
    return segments.map(function (seg, i) {
      return parseOrderFromSegment(seg.text, todayMs, { pax: seg.pax, label: i + 1 });
    });
  }

  /* ─────────────────────────────────────────────────────────
   * 3. 검증 (결제 전 체크리스트)
   * ───────────────────────────────────────────────────────── */

  function validateOrder(order, passengers, todayMs) {
    var checks = [];
    function add(level, field, message) { checks.push({ level: level, field: field, message: message }); }

    // 탑승자
    if (!passengers.length) {
      add(LEVEL.ERROR, 'passengers', '탑승자 정보가 없습니다.');
    }
    passengers.forEach(function (p, i) {
      var tag = 'passenger[' + i + ']';
      if (!p.family || !p.given) {
        add(LEVEL.ERROR, tag, '여권 영문 성/이름이 비어 있습니다.');
      } else {
        add(LEVEL.WARN, tag, '여권 영문명 ‘' + (p.family + ' ' + p.given).toUpperCase() +
          '’이 항공권 표기와 정확히 일치하는지 사람이 최종 확인하세요.');
      }
      var ref = order.ret != null ? order.ret : order.depart;
      if (p.expiry && ref != null) {
        var expiry = isoToUTC(p.expiry);
        if (expiry == null) {
          add(LEVEL.WARN, tag + '.expiry', '여권 만료일 형식을 확인하지 못했습니다.');
        } else {
          var remain = Math.round((expiry - ref) / 86400000);
          if (remain < PASSPORT_MIN_DAYS) {
            add(LEVEL.ERROR, tag + '.expiry',
              '여권 잔여 유효기간 부족: 귀국일 기준 ' + remain + '일 (최소 ' + PASSPORT_MIN_DAYS +
              '일 필요). 갱신 후 진행하세요.');
          } else if (remain < PASSPORT_WARN_DAYS) {
            add(LEVEL.WARN, tag + '.expiry',
              '여권 잔여 유효기간이 빠듯합니다: 귀국일 기준 ' + remain + '일.');
          } else {
            add(LEVEL.INFO, tag + '.expiry',
              '여권 잔여 유효기간 ' + remain + '일로 기준을 충족합니다. 항공사 기준은 따로 확인하세요.');
          }
        }
      } else if (!p.expiry) {
        add(LEVEL.WARN, tag + '.expiry', '여권 만료일을 확인할 수 없어 유효기간 검증을 건너뜁니다.');
      }
    });

    // 날짜
    if (order.depart == null) add(LEVEL.ERROR, 'depart_date', '가는 날이 비어 있습니다.');
    if (order.round && order.ret == null) add(LEVEL.ERROR, 'return_date', '왕복인데 오는 날이 비어 있습니다.');
    if (order.depart != null && order.ret != null && order.depart > order.ret) {
      add(LEVEL.ERROR, 'dates', '가는 날이 오는 날보다 늦습니다.');
    }
    if (order.depart != null && order.depart < todayMs) {
      add(LEVEL.WARN, 'depart_date', '가는 날이 오늘보다 과거입니다. 연도를 확인하세요.');
    }

    // 항공편
    var legs = [{ label: '가는편', leg: order.outbound }];
    if (order.round) legs.push({ label: '오는편', leg: order.inbound });
    legs.forEach(function (item) {
      var label = item.label, leg = item.leg;
      if (!leg) { add(LEVEL.ERROR, label, label + ' 정보가 없습니다.'); return; }
      [['출발공항', leg.origin], ['도착공항', leg.dest]].forEach(function (pair) {
        var fname = pair[0], val = pair[1];
        if (!val) {
          add(LEVEL.ERROR, label + '.' + fname, label + ' ' + fname + '이 비어 있습니다.');
        } else if (!KNOWN_CODES[val.toUpperCase()]) {
          add(LEVEL.WARN, label + '.' + fname,
            label + ' ' + fname + ' 코드 ‘' + val.toUpperCase() + '’를 사전에서 확인하지 못했습니다.');
        }
      });
      if (!leg.dt) add(LEVEL.WARN, label + '.출발시간', label + ' 출발시간이 비어 있습니다.');
      if (!leg.at) add(LEVEL.WARN, label + '.도착시간', label + ' 도착시간이 비어 있습니다.');
    });

    // 예약처 / 가격
    if (!order.vendor) {
      add(LEVEL.WARN, 'vendors', '예약처/가격 정보가 없습니다.');
    } else {
      add(LEVEL.INFO, 'price', '표시 가격은 참고값입니다. 실제 결제 금액은 결제 시점에 달라질 수 있습니다.');
    }

    // 항상 표시되는 안전 안내
    add(LEVEL.INFO, 'payment',
      '결제·카드/인증 정보 입력은 자동화하지 않습니다. 결제 버튼은 반드시 사람이 직접 확인 후 누르세요.');

    return {
      ok: !checks.some(function (c) { return c.level === LEVEL.ERROR; }),
      checks: checks
    };
  }

  // 가격 비교창을 열 수 있는지 (출발/도착/가는 날만 있으면 충분)
  function comparisonReadiness(order) {
    var missing = [];
    if (!order.outbound || !order.outbound.origin) missing.push('출발 공항');
    if (!order.outbound || !order.outbound.dest) missing.push('도착 공항');
    if (order.depart == null) missing.push('가는 날');
    return { ready: missing.length === 0, missing: missing };
  }

  /* ─────────────────────────────────────────────────────────
   * 4. 검색 URL 생성 (실제로 열지 않고 문자열만 반환)
   * ───────────────────────────────────────────────────────── */

  function buildLinks(order) {
    var out = [];
    var ready = comparisonReadiness(order);
    if (!ready.ready) {
      out.push({
        name: '검색 URL 생성 보류',
        note: '다음 항목이 채워져야 합니다: ' + ready.missing.join(', '),
        url: null
      });
      return out;
    }
    var o = order.outbound.origin.toUpperCase();
    var d = order.outbound.dest.toUpperCase();
    var dep = new Date(order.depart);
    var depStr = pad(dep.getUTCMonth() + 1) + pad(dep.getUTCDate());
    var pax = Math.max(1, order.pax || 1);

    var parts = [
      'https://www.skyscanner.net/transport/flights/' + o.toLowerCase() + '/' + d.toLowerCase() + '/' +
      String(yearOf(order.depart)).slice(2) + depStr + '/?adults=' + pax + '&cabinclass=economy'
    ];
    out.push({
      name: '가격 비교(스카이스캐너 형식 예시)',
      note: '도착지·가는 날까지 채운 결과 화면. 탑승자 선택과 결제는 사람이 진행합니다.',
      url: parts[0]
    });

    var trip = 'https://www.trip.com/flights/search?dcity=' + o + '&acity=' + d +
      '&ddate=' + yearOf(order.depart) + '-' + pad(dep.getUTCMonth() + 1) + '-' + pad(dep.getUTCDate());
    if (order.round && order.ret != null) {
      var ret = new Date(order.ret);
      trip += '&rdate=' + yearOf(order.ret) + '-' + pad(ret.getUTCMonth() + 1) + '-' + pad(ret.getUTCDate()) +
        '&triptype=rt';
    } else {
      trip += '&triptype=ow';
    }
    trip += '&quantity=' + pax;
    out.push({
      name: '예약처 검색(트립닷컴 형식 예시)',
      note: '결제창은 항공편 선택과 로그인이 필요해 URL만으로는 진입되지 않습니다.',
      url: trip
    });
    return out;
  }

  /* ─────────────────────────────────────────────────────────
   * 5. 상태 및 렌더링
   * ───────────────────────────────────────────────────────── */

  var SAMPLE_POOL = [
    { family: 'HANEUL', given: 'KIM' },
    { family: 'SEOJUN', given: 'LEE' },
    { family: 'MINJAE', given: 'PARK' },
    { family: 'YUNA', given: 'CHOI' },
    { family: 'Doyun', given: 'JUNG' },
    { family: 'SEOYEON', given: 'HAN' }
  ];

  var state = {
    orders: [],
    active: 0,
    passengers: [],
    validated: false,
    // 합성 여권 만료일 시드: 예시 2만 차단 케이스를 바로 보여주도록 100일로 둔다
    seedOffsetDays: 300
  };

  var $ = function (id) { return document.getElementById(id); };

  function emptyOrder(label) {
    return {
      label: label || 1, depart: null, ret: null, round: true,
      outbound: blankLeg(), inbound: blankLeg(),
      vendor: '', price: 0, vendors: [], pax: 0
    };
  }

  function resetState() {
    state.orders = [];
    state.active = 0;
    state.passengers = [];
    state.validated = false;
    $('sec-order').hidden = true;
    $('sec-validate').hidden = true;
    $('sec-sheet').hidden = true;
    $('trip-tabs').hidden = true;
    $('trip-tabs').innerHTML = '';
    $('pax-list').innerHTML = '';
  }

  function activeOrder() { return state.orders[state.active]; }

  function renderTabs() {
    var wrap = $('trip-tabs');
    if (state.orders.length <= 1) { wrap.hidden = true; wrap.innerHTML = ''; return; }
    wrap.hidden = false;
    wrap.innerHTML = '';
    state.orders.forEach(function (o, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === state.active ? 'true' : 'false');
      b.textContent = '여정 ' + o.label + ' · ' + legSummary(o);
      b.addEventListener('click', function () {
        state.active = i;
        state.validated = false;
        $('sec-validate').hidden = true;
        $('sec-sheet').hidden = true;
        syncPassengers();
        renderTabs();
        fillOrderForm();
      });
      wrap.appendChild(b);
    });
  }

  function legSummary(o) {
    var a = o.outbound.origin && o.outbound.dest ? o.outbound.origin.toUpperCase() + '→' + o.outbound.dest.toUpperCase() : '노선 미정';
    if (o.round && o.inbound && o.inbound.origin) a += ' / 왕복';
    return a;
  }

  function fillOrderForm() {
    var o = activeOrder();
    if (!o) return;
    $('f-depart').value = msToISO(o.depart);
    $('f-return').value = msToISO(o.ret);
    $('f-round').value = o.round ? 'round' : 'oneway';
    $('f-pax').value = o.pax > 0 ? o.pax : '';
    $('o-origin').value = o.outbound.origin;
    $('o-dest').value = o.outbound.dest;
    $('o-dt').value = o.outbound.dt;
    $('o-at').value = o.outbound.at;
    $('o-airline').value = o.outbound.airline;
    var inLeg = o.inbound || blankLeg();
    $('i-origin').value = inLeg.origin;
    $('i-dest').value = inLeg.dest;
    $('i-dt').value = inLeg.dt;
    $('i-at').value = inLeg.at;
    $('i-airline').value = inLeg.airline;
    $('f-vendor').value = o.vendor;
    $('f-price').value = o.price ? o.price : '';
    $('fs-in').hidden = !o.round;
    syncPassengers();
  }

  function collectOrderForm() {
    var o = activeOrder();
    if (!o) return;
    o.depart = isoToUTC($('f-depart').value);
    o.ret = o.round ? isoToUTC($('f-return').value) : null;
    o.pax = Math.max(0, parseInt($('f-pax').value, 10) || 0);
    o.outbound.origin = $('o-origin').value.trim().toUpperCase();
    o.outbound.dest = $('o-dest').value.trim().toUpperCase();
    o.outbound.dt = $('o-dt').value.trim();
    o.outbound.at = $('o-at').value.trim();
    o.outbound.airline = $('o-airline').value.trim();
    if (o.round) {
      if (!o.inbound) o.inbound = blankLeg();
      o.inbound.origin = $('i-origin').value.trim().toUpperCase();
      o.inbound.dest = $('i-dest').value.trim().toUpperCase();
      o.inbound.dt = $('i-dt').value.trim();
      o.inbound.at = $('i-at').value.trim();
      o.inbound.airline = $('i-airline').value.trim();
    }
    o.vendor = $('f-vendor').value.trim();
    o.price = Math.max(0, parseInt($('f-price').value, 10) || 0);
  }

  function setPassengerField(p, key, value) {
    p[key] = value;
    if (state.validated) runValidation();
  }

  function syncPassengers() {
    var o = activeOrder();
    var want = o ? (o.pax > 0 ? o.pax : state.passengers.length || 1) : 0;
    while (state.passengers.length > want) state.passengers.pop();
    while (state.passengers.length < want) {
      var seed = SAMPLE_POOL[state.passengers.length % SAMPLE_POOL.length];
      state.passengers.push({ family: seed.family, given: seed.given, passport: '', expiry: seedExpiry(o) });
    }
    renderPassengers();
  }

  // 합성 만료일: 귀국일(없으면 가는 날) 기준 +오프셋
  function seedExpiry(o) {
    var ref = (o && (o.ret != null ? o.ret : o.depart));
    if (ref == null) ref = todayUTC();
    return msToISO(ref + state.seedOffsetDays * 86400000);
  }

  function renderPassengers() {
    var box = $('pax-list');
    box.innerHTML = '';
    state.passengers.forEach(function (p, i) {
      var fs = document.createElement('fieldset');
      var legend = document.createElement('legend');
      legend.textContent = '탑승자 ' + (i + 1);
      fs.appendChild(legend);

      var grid = document.createElement('div');
      grid.className = 'grid cols-2';
      grid.appendChild(makeInput('성(영문)', 'pf-family-' + i, p.family, function (v) { setPassengerField(p, 'family', v.toUpperCase()); }));
      grid.appendChild(makeInput('이름(영문)', 'pf-given-' + i, p.given, function (v) { setPassengerField(p, 'given', v.toUpperCase()); }));
      grid.appendChild(makeInput('여권 만료일', 'pf-expiry-' + i, p.expiry, function (v) { setPassengerField(p, 'expiry', v); }, 'date'));
      grid.appendChild(makeInput('여권번호 (선택)', 'pf-pass-' + i, p.passport, function (v) { setPassengerField(p, 'passport', v); }, 'text', '합성값 입력, 화면에는 마스킹 표시'));
      fs.appendChild(grid);
      box.appendChild(fs);
    });
  }

  function makeInput(label, id, value, onInput, type, placeholder) {
    var wrap = document.createElement('div');
    wrap.className = 'field';
    var lb = document.createElement('label');
    lb.setAttribute('for', id);
    lb.textContent = label;
    var input = document.createElement('input');
    input.type = type || 'text';
    input.id = id;
    input.value = value || '';
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener('input', function () { onInput(input.value); });
    wrap.appendChild(lb);
    wrap.appendChild(input);
    return wrap;
  }

  function maskPassport(v) {
    var s = String(v || '').trim();
    if (!s) return '미입력';
    if (s.length <= 3) return new Array(s.length + 1).join('•');
    return new Array(s.length - 2 + 1).join('•') + s.slice(-2);
  }

  function runValidation() {
    var o = activeOrder();
    if (!o) return;
    collectOrderForm();
    var res = validateOrder(o, state.passengers, todayUTC());
    state.validated = true;

    var banner = $('v-banner');
    banner.className = 'banner ' + (res.ok ? 'pass' : 'block');
    banner.innerHTML = res.ok
      ? '<h3>차단 항목 없음 &mdash; 사람 확인 후 다음 단계로 진행할 수 있습니다.</h3>' +
        '<p>다만 경고(WARN) 항목은 통과한 것이 아니라 사람이 확인해야 하는 항목입니다. 결제 버튼은 직접 눌러야 합니다.</p>'
      : '<h3>차단됨 &mdash; ' + res.checks.filter(function (c) { return c.level === LEVEL.ERROR; }).length +
        '개 항목이 조건을 만족하지 않습니다.</h3>' +
        '<p>주문서 확정과 예약처 자동 입력을 진행하지 않습니다. 값을 고치면 위 폰에서 바로 다시 검증할 수 있습니다.</p>';

    var ul = $('v-checks');
    ul.innerHTML = '';
    res.checks.forEach(function (c) {
      var li = document.createElement('li');
      var lvl = document.createElement('span');
      lvl.className = 'lvl ' + c.level;
      lvl.textContent = c.level;
      var msg = document.createElement('span');
      msg.className = 'msg';
      msg.textContent = c.message;
      var target = document.createElement('span');
      target.className = 'target';
      target.textContent = '대상 필드: ' + c.field;
      msg.appendChild(target);
      li.appendChild(lvl);
      li.appendChild(msg);
      ul.appendChild(li);
    });

    $('sec-validate').hidden = false;
    // 차단됐으면 주문서 단계까지 넘기지 않는다
    $('sec-sheet').hidden = !res.ok;
    if (res.ok) renderSheet(o);
  }

  function fmtDate(ms) {
    if (ms == null) return '미정';
    var d = new Date(ms);
    return d.getUTCFullYear() + '.' + pad(d.getUTCMonth() + 1) + '.' + pad(d.getUTCDate());
  }

  function renderSheet(o) {
    var box = $('sheet');
    box.innerHTML = '';
    var dl = document.createElement('dl');

    function row(k, v) {
      var dt = document.createElement('dt');
      dt.textContent = k;
      var dd = document.createElement('dd');
      dd.textContent = v;
      dl.appendChild(dt);
      dl.appendChild(dd);
    }

    row('여정', '여정 ' + o.label + (o.round ? ' (왕복)' : ' (편도)'));
    row('기간', o.round ? fmtDate(o.depart) + ' ~ ' + fmtDate(o.ret) : fmtDate(o.depart));
    row('인원', (o.pax > 0 ? o.pax : state.passengers.length) + '명');
    row('예약처', o.vendor || '미정');
    row('표시 가격', o.price ? '₩' + o.price.toLocaleString('ko-KR') + ' (참고값)' : '미정');

    var legBox = document.createElement('div');
    function legBlock(title, leg) {
      var w = document.createElement('div');
      w.className = 'leg';
      var t = document.createElement('div');
      t.className = 'route';
      t.textContent = title + '  ' + (leg.origin || '?') + ' → ' + (leg.dest || '?');
      var meta = document.createElement('div');
      meta.textContent = '출발 ' + (leg.dt || '미정') + ' · 도착 ' + (leg.at || '미정') +
        ' · ' + (leg.airline || '항공사 미정');
      w.appendChild(t);
      w.appendChild(meta);
      legBox.appendChild(w);
    }
    legBox.appendChild(document.createElement('h3'));
    legBox.lastChild.textContent = '구간';
    legBlock('가는편', o.outbound);
    if (o.round && o.inbound) legBlock('오는편', o.inbound);

    box.appendChild(dl);
    box.appendChild(legBox);

    var paxWrap = document.createElement('div');
    paxWrap.className = 'leg';
    var paxT = document.createElement('div');
    paxT.className = 'route';
    paxT.textContent = '탑승자 여권';
    paxWrap.appendChild(paxT);
    state.passengers.forEach(function (p, i) {
      var line = document.createElement('div');
      line.textContent = (i + 1) + '. ' + ((p.family + ' ' + p.given).toUpperCase() || '성/이름 미입력') +
        ' · 여권번호 ' + maskPassport(p.passport) +
        ' · 만료 ' + (p.expiry ? p.expiry.replace(/-/g, '.') : '미확인');
      paxWrap.appendChild(line);
    });
    box.appendChild(paxWrap);

    var links = $('links');
    links.innerHTML = '';
    buildLinks(o).forEach(function (l) {
      var rowBox = document.createElement('div');
      rowBox.className = 'link-row';
      var t = document.createElement('div');
      t.className = 't';
      var name = document.createElement('span');
      name.textContent = l.name;
      var tag = document.createElement('span');
      tag.className = 'badge gray';
      tag.textContent = l.url ? '예시 형식' : '생성 보류';
      t.appendChild(name);
      t.appendChild(tag);
      rowBox.appendChild(t);

      var note = document.createElement('p');
      note.className = 'note';
      note.textContent = l.note;
      rowBox.appendChild(note);

      if (l.url) {
        var pre = document.createElement('pre');
        pre.className = 'url';
        pre.textContent = l.url;
        rowBox.appendChild(pre);
        var br = document.createElement('div');
        br.className = 'btn-row';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'URL 복사';
        btn.addEventListener('click', function () { copyText(l.url); });
        br.appendChild(btn);
        rowBox.appendChild(br);
      }
      links.appendChild(rowBox);
    });
  }

  function summaryText(o) {
    var lines = [];
    lines.push('[합성 데이터 데모] 항공권 주문서 (여정 ' + o.label + ')');
    lines.push('기간: ' + (o.round ? fmtDate(o.depart) + ' ~ ' + fmtDate(o.ret) : fmtDate(o.depart)));
    lines.push('인원: ' + (o.pax > 0 ? o.pax : state.passengers.length) + '명');
    lines.push('가는편: ' + (o.outbound.origin || '?') + ' → ' + (o.outbound.dest || '?') +
      '  ' + (o.outbound.dt || '?') + ' ~ ' + (o.outbound.at || '?') + '  ' + (o.outbound.airline || ''));
    if (o.round && o.inbound) {
      lines.push('오는편: ' + (o.inbound.origin || '?') + ' → ' + (o.inbound.dest || '?') +
        '  ' + (o.inbound.dt || '?') + ' ~ ' + (o.inbound.at || '?') + '  ' + (o.inbound.airline || ''));
    }
    lines.push('예약처: ' + (o.vendor || '미정') + (o.price ? '  ₩' + o.price.toLocaleString('ko-KR') + ' (참고값)' : ''));
    state.passengers.forEach(function (p, i) {
      lines.push('탑승자 ' + (i + 1) + ': ' + ((p.family + ' ' + p.given).toUpperCase() || '미입력') +
        ' / 여권번호 ' + maskPassport(p.passport) + ' / 만료 ' + (p.expiry || '미확인'));
    });
    lines.push('결제는 사람이 직접 확인하고 누릅니다.');
    return lines.join('\n');
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 1800);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('복사했습니다'); }, function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    toast(ok ? '복사했습니다' : '복사하지 못했습니다. 값을 직접 선택해 주세요');
  }

  /* ─────────────────────────────────────────────────────────
   * 6. 합성 예시 문구 (가상 인물, 가상 가격)
   * ───────────────────────────────────────────────────────── */

  // 예시 문구는 실제 사용 형태(자유 문장, 오타, 생략)를 흉내 낸 합성 데이터입니다.
  // 가격과 인물 정보는 모두 가상 값이며 실제 거래·여권 정보가 아닙니다.
  var SAMPLES = {
    ok: [
      '가족들이랑 같이 가는거 2명 12.1~5 인천(ICN)에서 나리타로 가요',
      '대한항공 오전 8:40 출발 오전 11:05 도착',
      '오는편은 오후 4:20 출발 오후 7:05 도착',
      'Trip.com ₩1,186,000 으로 넣었음 이번주까지 결제해야해'
    ].join('\n'),

    expiry: [
      '2,3번 12.1~5 인천(ICN)-나리타 오후 8:40 출발 오후 11:05 도착',
      '전대항공 오후 4:20 출발 오후 7:05 도착',
      'TeaFlight ₩980,000',
      '근데 3번분 여권 갱신 전이라 날짜 좀 봐줘'
    ].join('\n'),

    multi: [
      '2명 이번에 (12.1~5) 시즈오카 갔다가 Trip.com ₩742,000 전대항공 오후 7:25 출발 오후 10:50 도착',
      '(12.8~14) 나리타 들렀다 오는 걸로 웹투어 ₩798,000 전대항공 오전 9:40 출발 오후 1:15 도착'
    ].join('\n'),

    messy: [
      '12.9에 인천에서 후쿠오카 쪽 가는거 시간은 아직 못정했어',
      '대한항공이고 가격은 나중에 알려줄게',
      '편도일거 같은데 이거 돼?'
    ].join('\n')
  };

  /* ─────────────────────────────────────────────────────────
   * 7. 이벤트 바인딩
   * ───────────────────────────────────────────────────────── */

  function doParse() {
    var text = $('raw').value.trim();
    if (!text) {
      toast('먼저 문구를 입력하거나 예시를 불러오세요');
      return;
    }
    state.orders = parseOrders(text);
    state.active = 0;
    state.passengers = [];
    state.validated = false;
    $('sec-validate').hidden = true;
    $('sec-sheet').hidden = true;
    $('sec-order').hidden = false;
    renderTabs();
    fillOrderForm();
    $('sec-order').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function doReset() {
    resetState();
    state.seedOffsetDays = 300;
    $('raw').value = '';
    $('raw').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('모든 상태를 초기화했습니다');
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-sample]'), function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-sample');
        $('raw').value = SAMPLES[key] || '';
        state.seedOffsetDays = key === 'expiry' ? 100 : 300;
        $('raw').focus();
        toast('합성 예시를 불러왔습니다');
      });
    });

    $('btn-parse').addEventListener('click', doParse);
    $('btn-reset-top').addEventListener('click', doReset);
    $('btn-validate').addEventListener('click', runValidation);
    $('btn-pax-sync').addEventListener('click', function () {
      collectOrderForm();
      syncPassengers();
      toast('탑승자 폼을 인원수에 맞췄습니다');
    });

    $('btn-add-trip').addEventListener('click', function () {
      collectOrderForm();
      state.orders.push(emptyOrder(state.orders.length + 1));
      state.active = state.orders.length - 1;
      state.passengers = [];
      state.validated = false;
      $('sec-validate').hidden = true;
      $('sec-sheet').hidden = true;
      renderTabs();
      fillOrderForm();
      toast('빈 여정을 추가했습니다. 날짜부터 채워주세요');
    });

    $('btn-copy-all').addEventListener('click', function () {
      var o = activeOrder();
      if (o) copyText(summaryText(o));
    });

    // 폼을 고치면 검증 결과는 무효 표시 (다시 실행 유도)
    ['f-depart', 'f-return', 'f-round', 'f-pax', 'o-origin', 'o-dest', 'o-dt', 'o-at',
      'o-airline', 'i-origin', 'i-dest', 'i-dt', 'i-at', 'i-airline', 'f-vendor', 'f-price'
    ].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var mark = function () {
        state.validated = false;
        $('sec-validate').hidden = true;
        $('sec-sheet').hidden = true;
        collectOrderForm();
        renderTabs();
      };
      el.addEventListener('input', mark);
      el.addEventListener('change', mark);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
