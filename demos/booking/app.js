(function () {
  'use strict';

  var TOURS = [
    { id: 't1', name: '합성 투어 A · 2박 3일', dates: '10/14(토) 출발' },
    { id: 't2', name: '합성 투어 B · 1박 2일', dates: '10/21(토) 출발' }
  ];

  var INITIAL = [
    {
      id: 'r1', group: 'G-1042', tourId: 't1', name: '김하늘', people: 3, amount: 870000, paid: 0,
      members: [
        { name: '김하늘', phone: '010-0000-0000', passport: 'R8823174', rrn: '880315-2459911', status: '입금 확인' },
        { name: '박서준', phone: '010-0000-0000', passport: 'M4402918', rrn: '900211-1338204', status: '입금 확인' },
        { name: '최유나', phone: '010-0000-0000', passport: 'R1190652', rrn: '931120-2881403', status: '서류 보완' }
      ]
    },
    {
      id: 'r2', group: 'G-1042', tourId: 't1', name: '최유나', people: 2, amount: 580000, paid: 290000,
      members: [
        { name: '최유나', phone: '010-0000-0000', passport: 'R1190652', rrn: '931120-2881403', status: '부분 입금' },
        { name: '이도윤', phone: '010-0000-0000', passport: 'R7055128', rrn: '950407-3112287', status: '입금 확인' }
      ]
    },
    {
      id: 'r3', group: 'G-1051', tourId: 't2', name: '정하린', people: 4, amount: 1120000, paid: 0,
      members: [
        { name: '정하린', phone: '010-0000-0000', passport: 'R3320904', rrn: '870822-1900338', status: '입금 확인' },
        { name: '강시우', phone: '010-0000-0000', passport: 'M9912046', rrn: '920115-2887491', status: '입금 확인' },
        { name: '윤소희', phone: '010-0000-0000', passport: 'R2277145', rrn: '941203-2556612', status: '입금 확인' },
        { name: '임태오', phone: '010-0000-0000', passport: 'R8146309', rrn: '960528-1448902', status: '여권 유효기간 확인 필요' }
      ]
    },
    {
      id: 'r4', group: 'G-1057', tourId: 't2', name: '한지우', people: 2, amount: 560000, paid: 560000,
      members: [
        { name: '한지우', phone: '010-0000-0000', passport: 'R6610273', rrn: '890309-3110025', status: '입금 확인' },
        { name: '오민재', phone: '010-0000-0000', passport: 'M3384910', rrn: '930719-2778104', status: '입금 확인' }
      ]
    }
  ];

  var EXPORTS = [
    { title: '항공 정보', desc: 'DepartureFlight·ReturnFlight 항목을 묶은 표. 좌석·탑승 게이트 메모 포함.' },
    { title: '숙소 배정', desc: '호텔·룸타입·인원수·식사 옵션을 묶은 표.' },
    { title: '보험 가입자', desc: '가입자 성명, 생년월일, 여권번호로 구성한 명단.' },
    { title: '일정표', desc: '일자별 일정과 담당자 메모를 담은 일정 시트.' }
  ];

  var state = {
    reservations: [],
    filter: 'all',
    tourId: 't1',
    mask: true
  };

  var el = {
    stats: document.getElementById('stats'),
    filters: document.getElementById('filters'),
    rows: document.getElementById('rows'),
    rosterRows: document.getElementById('rosterRows'),
    maskToggle: document.getElementById('maskToggle'),
    tourSelect: document.getElementById('tourSelect'),
    exportList: document.getElementById('exportList'),
    resetBtn: document.getElementById('resetBtn')
  };

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function won(value) {
    return value.toLocaleString('ko-KR') + '원';
  }

  function statusOf(r) {
    if (r.paid <= 0) return 'unpaid';
    if (r.paid < r.amount) return 'partial';
    return 'paid';
  }

  function statusLabel(key) {
    if (key === 'paid') return '납부';
    if (key === 'partial') return '부분 입금';
    return '미수';
  }

  function maskPassport(value) {
    if (value.length <= 3) return '•'.repeat(value.length);
    return value.slice(0, 2) + '•'.repeat(value.length - 3) + value.slice(-1);
  }

  function maskRrn(value) {
    if (value.length <= 7) return '•'.repeat(value.length);
    return value.slice(0, 6) + '-•••••••';
  }

  function maskPhone(value) {
    var parts = value.split('-');
    if (parts.length !== 3) return maskPassport(value);
    return parts[0] + '-••••-' + parts[2];
  }

  function groupKey(r) {
    return r.group + '/' + r.tourId;
  }

  function groupProgress(key) {
    var total = 0;
    var paid = 0;
    var people = 0;
    var counts = 0;
    state.reservations.forEach(function (r) {
      if (groupKey(r) !== key) return;
      total += r.amount;
      paid += r.paid;
      people += r.people;
      counts += 1;
    });
    var rate = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { total: total, paid: paid, people: people, counts: counts, rate: rate };
  }

  function renderStats() {
    var total = 0;
    var paid = 0;
    var people = 0;
    var counts = { unpaid: 0, partial: 0, paid: 0 };
    var groups = {};

    state.reservations.forEach(function (r) {
      total += r.amount;
      paid += r.paid;
      people += r.people;
      counts[statusOf(r)] += 1;
      groups[groupKey(r)] = true;
    });

    var remain = Math.max(total - paid, 0);
    var rate = total > 0 ? Math.round((paid / total) * 100) : 0;
    var groupCount = Object.keys(groups).length;

    el.stats.innerHTML = [
      stat('총 청구액', won(total), '예약 ' + state.reservations.length + '건 · 그룹 ' + groupCount + '개'),
      stat('입금 확인액', won(paid), '납부율 ' + rate + '%'),
      stat('미수 잔액', won(remain), '미수 ' + counts.unpaid + '건 · 부분 입금 ' + counts.partial + '건'),
      stat('예약 인원', people + '명', '합성 명단 기준')
    ].join('');
  }

  function stat(label, value, sub) {
    return '<dl class="stat"><dt>' + label + '</dt><dd>' + value + '</dd><small>' + sub + '</small></dl>';
  }

  function renderFilters() {
    var counts = { all: state.reservations.length, unpaid: 0, partial: 0, paid: 0 };
    state.reservations.forEach(function (r) {
      counts[statusOf(r)] += 1;
    });

    var defs = [
      { key: 'all', label: '전체' },
      { key: 'unpaid', label: '미수' },
      { key: 'partial', label: '부분 입금' },
      { key: 'paid', label: '납부' }
    ];

    el.filters.innerHTML = defs.map(function (d) {
      return '<button type="button" class="chip" data-filter="' + d.key + '" aria-pressed="' +
        (state.filter === d.key) + '">' + d.label +
        '<span class="count">' + counts[d.key] + '</span></button>';
    }).join('');
  }

  function renderRows() {
    var list = state.reservations.filter(function (r) {
      return state.filter === 'all' || statusOf(r) === state.filter;
    });

    if (list.length === 0) {
      el.rows.innerHTML = '<tr><td colspan="8">조건에 맞는 예약 건이 없습니다.</td></tr>';
      return;
    }

    el.rows.innerHTML = list.map(function (r) {
      var key = groupKey(r);
      var p = groupProgress(key);
      var nextLabel = nextStateLabel(r);
      return '<tr>' +
        '<td class="group">' + r.group +
          '<div style="font-weight:600;font-size:.78rem;color:var(--muted);margin-top:4px;">그룹 ' +
            p.counts + '건 · ' + p.people + '명 · ' + p.rate + '%</div>' +
        '</td>' +
        '<td>' + tourName(r.tourId) + '</td>' +
        '<td>' + r.name + '</td>' +
        '<td class="num">' + r.people + '</td>' +
        '<td class="num">' + won(r.amount) + '</td>' +
        '<td class="num">' + won(r.paid) + '</td>' +
        '<td><span class="pill pill-' + statusOf(r) + '">' + statusLabel(statusOf(r)) + '</span></td>' +
        '<td><button type="button" class="btn" data-next="' + r.id + '">' + nextLabel + '</button></td>' +
      '</tr>';
    }).join('');
  }

  function nextStateLabel(r) {
    var key = statusOf(r);
    if (key === 'unpaid') return '50% 기록';
    if (key === 'partial') return '전액 기록';
    return '입금 취소';
  }

  function tourName(id) {
    for (var i = 0; i < TOURS.length; i += 1) {
      if (TOURS[i].id === id) return TOURS[i].name;
    }
    return id;
  }

  function renderTourOptions() {
    el.tourSelect.innerHTML = TOURS.map(function (t) {
      return '<option value="' + t.id + '"' + (t.id === state.tourId ? ' selected' : '') + '>' +
        t.name + ' · ' + t.dates + '</option>';
    }).join('');
  }

  function renderRoster() {
    var tour = null;
    for (var i = 0; i < TOURS.length; i += 1) {
      if (TOURS[i].id === state.tourId) tour = TOURS[i];
    }

    var rows = [];
    state.reservations.forEach(function (r) {
      if (r.tourId !== state.tourId) return;
      var rStatus = statusOf(r);
      r.members.forEach(function (m, idx) {
        var display = m.status;
        if (idx === 0 && rStatus === 'unpaid') display = '납부 확인 대기';
        rows.push({ r: r, m: m, display: display });
      });
    });

    if (rows.length === 0) {
      el.rosterRows.innerHTML = '<tr><td colspan="5">선택한 투어의 명단이 없습니다.</td></tr>';
      return;
    }

    var head = '<tr><td colspan="5" style="white-space:normal;background:#f7f9fe;">' +
      tour.name + ' · ' + tour.dates + ' · 명단 ' + rows.length + '명 · ' +
      (state.mask ? '개인정보 가림 표시' : '가림 해제(합성 원문 노출)') + '</td></tr>';

    var body = rows.map(function (row) {
      var m = row.m;
      var phone = state.mask ? maskPhone(m.phone) : m.phone;
      var passport = state.mask ? maskPassport(m.passport) : m.passport;
      var rrn = state.mask ? maskRrn(m.rrn) : m.rrn;
      return '<tr>' +
        '<td>' + m.name + ' <span class="pill pill-unpaid" style="background:#eef1f8;color:var(--muted);">' + row.r.group + '</span></td>' +
        '<td class="' + (state.mask ? 'masked' : '') + '">' + phone + '</td>' +
        '<td class="' + (state.mask ? 'masked' : '') + '">' + passport + '</td>' +
        '<td class="' + (state.mask ? 'masked' : '') + '">' + rrn + '</td>' +
        '<td>' + row.display + '</td>' +
      '</tr>';
    }).join('');

    el.rosterRows.innerHTML = head + body;
  }

  function renderExports() {
    el.exportList.innerHTML = EXPORTS.map(function (e) {
      return '<li><strong>' + e.title + '</strong><span>' + e.desc + '</span></li>';
    }).join('');
  }

  function render() {
    renderStats();
    renderFilters();
    renderRows();
    renderRoster();
  }

  function cyclePayment(id) {
    state.reservations.forEach(function (r) {
      if (r.id !== id) return;
      var key = statusOf(r);
      if (key === 'unpaid') {
        r.paid = Math.round(r.amount / 2 / 1000) * 1000;
      } else if (key === 'partial') {
        r.paid = r.amount;
      } else {
        r.paid = 0;
      }
    });
    render();
  }

  el.filters.addEventListener('click', function (event) {
    var btn = event.target.closest('button[data-filter]');
    if (!btn) return;
    state.filter = btn.getAttribute('data-filter');
    render();
  });

  el.rows.addEventListener('click', function (event) {
    var btn = event.target.closest('button[data-next]');
    if (!btn) return;
    cyclePayment(btn.getAttribute('data-next'));
  });

  el.maskToggle.addEventListener('change', function () {
    state.mask = el.maskToggle.checked;
    renderRoster();
  });

  el.tourSelect.addEventListener('change', function () {
    state.tourId = el.tourSelect.value;
    renderRoster();
  });

  el.resetBtn.addEventListener('click', function () {
    state.reservations = clone(INITIAL);
    state.filter = 'all';
    state.tourId = 't1';
    state.mask = true;
    el.maskToggle.checked = true;
    renderTourOptions();
    render();
  });

  state.reservations = clone(INITIAL);
  renderTourOptions();
  renderExports();
  render();
})();