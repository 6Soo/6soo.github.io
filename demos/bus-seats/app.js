"use strict";

/* ------------------------------------------------------------------
   여행 수행 도구 공개 데모 (합성 데이터 전용)
   외부 요청, 업로드, 저장 없음. 입력은 새로고침하면 사라진다.
   ------------------------------------------------------------------ */

/* ---------- 1. 일정 파서 ---------- */

var KOR_ORDINAL = {
  첫째: 1, 첫: 1, 하루: 1,
  둘째: 2, 둘: 2,
  셋째: 3, 셋: 3,
  넷째: 4, 넷: 4,
  다섯째: 5, 다섯: 5,
  여섯째: 6, 여섯: 6,
  일곱째: 7, 일곱: 7
};

var SKIP_LINES = [
  /^\[\s*[^\]]*기본[^\]]*\]$/,
  /^[-=~·.\s]{3,}$/,
  /^[-=~·.\s]*기본\s*일정[-=~·.\s]*$/
];

var DAY_HEADERS = [
  { re: /^<?\s*(\d{1,2})\s*일\s*차\s*>?\s*[.·:~\-]*\s*(.*)$/, num: function (m) { return Number(m[1]); } },
  { re: /^(첫날|둘째날|셋째날|넷째날|다섯째날|여섯날|일곱날|첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째)\s*[.·:~\-]*\s*(.*)$/,
    num: function (m) { return KOR_ORDINAL[m[1].replace("날", "")]; } },
  { re: /^[Dd][Aa][Yy]\s*\.?\s*(\d{1,2})\s*[.·:~\-]*\s*(.*)$/, num: function (m) { return Number(m[1]); } },
  { re: /^(\d{1,2})\s*일\s*[.·:~\-]*\s*(.*)$/, num: function (m) { return Number(m[1]); } }
];

var TIME_ONLY = /^\s*(?:\d{1,2}\s*시\s*(\d{1,2}\s*분)?\s*(~\s*\d{1,2}\s*시\s*(\d{1,2}\s*분)?)?|\d{1,2}\s*분)\s*(분\s*소요)?\s*[.·\-]?\s*$/;
var TIME_PREFIX = /^(\d{1,2}\s*시\s*(\d{1,2}\s*분)?\s*(~\s*\d{1,2}\s*시\s*(\d{1,2}\s*분)?)?)\s*(.*)$/;
var STAY_INLINE = /[\[\(]\s*숙박\s*[-–:]*\s*([^\]\)]+)\s*[\]\)]/;
var STAY_KEYWORD = /^(숙박|숙소)\s*[-–:]*\s*(.+)$/;
var STAY_BRACKET = /^\s*[\[\(]\s*([^\]\)]*(?:텔|리조트|장|션|료칸|민박|게스트하우스|콘도|캠핑|모텔|한옥)[^\]\)]*)\s*[\]\)]\s*$/;
var NOTE_START = /^[*＊✱]+\s*(.*)$/;

var CATEGORIES = [
  { key: "food", label: "식사", re: /(점심|저녁|브레이크|식사|맛집|카페|커피|밥|식당|조식)/ },
  { key: "move", label: "이동", re: /(이동|출발|도착|버스|차량|공항|역|곧장|승차|하차)/ },
  { key: "rest", label: "휴식", re: /(휴식|쉬기|쉼|자유시간|낮잠|차茶|자연휴식)/ },
  { key: "trek", label: "트레킹", re: /(트레킹|등산|산행|코스|하이킹|오름|능선|둘레길)/ },
  { key: "photo", label: "사진", re: /(사진|촬영|스냅|뷰포인트|전망)/ },
  { key: "shop", label: "쇼핑", re: /(쇼핑|기념품|면세|시장|서점|구매)/ },
  { key: "spa", label: "스파", re: /(스파|찜질|샤워|온천|목욕)/ },
  { key: "walk", label: "도보", re: /(도보|산책|거리|책 읽기|향수|둘레길|걷기|일출|일몰)/ }
];

function shouldSkip(line) {
  for (var i = 0; i < SKIP_LINES.length; i++) {
    if (SKIP_LINES[i].test(line)) return true;
  }
  return false;
}

function matchDayHeader(line) {
  for (var i = 0; i < DAY_HEADERS.length; i++) {
    var m = line.match(DAY_HEADERS[i].re);
    if (m) {
      var num = DAY_HEADERS[i].num(m);
      if (num && num <= 40) {
        return { num: num, rest: (m[2] || "").trim() };
      }
    }
  }
  return null;
}

function classify(text) {
  for (var i = 0; i < CATEGORIES.length; i++) {
    if (CATEGORIES[i].re.test(text)) return CATEGORIES[i].label;
  }
  return "일정";
}

function splitTime(line) {
  var m = line.match(TIME_PREFIX);
  if (!m) return null;
  var time = m[1].replace(/\s+/g, " ").replace("~", "~").trim();
  time = time.replace(/시\s*(\d{1,2})\s*분/, "시 $1분").replace(/시$/, "시");
  return { time: time, text: (m[5] || "").trim() };
}

function extractStay(line) {
  var inline = line.match(STAY_INLINE);
  if (inline) return inline[1].trim();
  var kw = line.match(STAY_KEYWORD);
  if (kw) return kw[2].trim();
  var bracket = line.match(STAY_BRACKET);
  if (bracket) return bracket[1].trim();
  return null;
}

function parseItinerary(raw) {
  var lines = String(raw).replace(/\r/g, "").split("\n");
  var days = [];
  var current = null;
  var pendingTime = null;

  function pushDay(num, rest) {
    current = { num: num, title: rest || "", items: [] };
    days.push(current);
  }

  function pushItem(item) {
    if (!current) pushDay(1, "");
    current.items.push(item);
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) { pendingTime = null; continue; }
    if (shouldSkip(line)) continue;

    var day = matchDayHeader(line);
    if (day) {
      pushDay(day.num, day.rest);
      if (day.rest) {
        current.items.push({ time: "", text: day.rest, tag: "day" });
      }
      pendingTime = null;
      continue;
    }

    if (TIME_ONLY.test(line)) {
      pendingTime = line.replace(/\s+/g, "");
      continue;
    }

    var stay = extractStay(line);
    var note = line.match(NOTE_START);
    var timed = splitTime(line);

    if (timed) {
      pushItem({
        time: timed.time,
        text: timed.text || pendingTime || "",
        tag: stay ? "stay" : null,
        stay: stay || null
      });
      pendingTime = null;
      continue;
    }

    if (note) {
      pushItem({ time: pendingTime || "", text: note[1], tag: "note", stay: null });
      pendingTime = null;
      continue;
    }

    pushItem({ time: pendingTime || "", text: line, tag: stay ? "stay" : null, stay: stay || null });
    pendingTime = null;
  }

  days = days.filter(function (d) { return d.items.length > 0; });
  return days;
}

function renderItinerary(days) {
  var box = document.getElementById("result");
  var counts = document.getElementById("counts");
  box.textContent = "";
  counts.textContent = "";

  if (!days.length) {
    var empty = document.createElement("p");
    empty.className = "lede";
    empty.textContent = "일정으로 읽을 수 있는 줄을 찾지 못했습니다.";
    box.appendChild(empty);
    return;
  }

  var totalItems = 0;
  var stayCount = 0;

  days.forEach(function (day) {
    var block = document.createElement("div");
    block.className = "day-block";

    var title = document.createElement("p");
    title.className = "day-title";
    title.textContent = (day.num + "일차") + (day.title ? " · " + day.title : "");
    block.appendChild(title);

    var ul = document.createElement("ul");
    ul.className = "items";

    day.items.forEach(function (item) {
      totalItems++;
      if (item.tag === "stay") stayCount++;

      var li = document.createElement("li");
      li.className = "item" + (item.time ? "" : " no-time");

      var time = document.createElement("time");
      time.textContent = item.time || "시간 미지정";
      li.appendChild(time);

      var right = document.createElement("div");
      var text = document.createElement("span");
      text.textContent = item.text;
      right.appendChild(text);

      var meta = document.createElement("span");
      meta.className = "meta";
      var chips = [];
      chips.push('<span class="chip">' + classify(item.text) + "</span>");
      if (item.tag === "stay") chips.push('<span class="chip stay">숙박 ' + escapeHtml(item.stay || "") + "</span>");
      if (item.tag === "note") chips.push('<span class="chip note">메모</span>');
      if (item.tag === "day") chips.push('<span class="chip day">일정 제목</span>');
      meta.innerHTML = chips.join(" ");
      right.appendChild(meta);

      li.appendChild(right);
      ul.appendChild(li);
    });

    block.appendChild(ul);
    box.appendChild(block);
  });

  [
    { label: "날짜 수", value: days.length + "일" },
    { label: "항목 수", value: totalItems + "개" },
    { label: "숙박 표기", value: stayCount + "건" }
  ].forEach(function (stat) {
    var div = document.createElement("div");
    div.className = "stat";
    div.innerHTML = "총 " + stat.label + "<b>" + stat.value + "</b>";
    counts.appendChild(div);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

var SAMPLE_RAW = [
  "=== 기본 일정 ===",
  "1일차: 숲길따라 오르는 아침",
  "9시30분~11시 시장 구경",
  "11시30분 점심 - 산정식당",
  "1시30분~4시 비자 숲길 트레킹",
  "*우천 시 대체 코스: 전망대 정지",
  "[숙박 - 솔밭산장 조식]",
  "",
  "2일차",
  "8시 아침 산책",
  "10시~12시00분 둘레길 걷기",
  "12시10분 사진 찍기",
  "5분",
  "귀환길 이동"
].join("\n");

document.getElementById("parse-btn").addEventListener("click", function () {
  renderItinerary(parseItinerary(document.getElementById("raw").value));
});

document.getElementById("sample-btn").addEventListener("click", function () {
  document.getElementById("raw").value = SAMPLE_RAW;
  renderItinerary(parseItinerary(SAMPLE_RAW));
});

document.getElementById("clear-btn").addEventListener("click", function () {
  document.getElementById("raw").value = "";
  renderItinerary([]);
});

/* ---------- 2. 차량 좌석 배치도 ---------- */

function buildBus(rows) {
  var seats = [];
  rows.forEach(function (row) {
    row.forEach(function (cell) {
      if (typeof cell === "number") {
        for (var i = 0; i < cell; i++) seats.push({ type: "passenger", name: "" });
      } else {
        seats.push(cell);
      }
    });
  });
  return seats;
}

function withRows(rows, cols) {
  return { cols: cols, seats: buildBus(rows) };
}

function countPassenger(def) {
  return def.seats.filter(function (s) { return s.type === "passenger"; }).length;
}

function defineBus(id, name, cols, rows) {
  var def = withRows(rows, cols);
  def.capacity = countPassenger(def) + "인승";
  BUSES[id] = { name: name, capacity: def.capacity, cols: def.cols, seats: def.seats };
  return BUSES[id];
}

var BUSES = {};

var ROW_P2_AISLE_P2 = function () {
  return [{ type: "passenger", name: "" }, { type: "aisle" },
          { type: "passenger", name: "" }, { type: "passenger", name: "" }];
};

defineBus("hiace10", "전륜 2인승 차량", 4, [
  [{ type: "fixed", label: "보조석" }, { type: "aisle" }, { type: "aisle" }, { type: "fixed", label: "운전석" }],
  [{ type: "fixed", label: "출입문" }, { type: "aisle" }, { type: "passenger", name: "" }, { type: "passenger", name: "" }],
  [{ type: "aisle" }, { type: "aisle" }, { type: "passenger", name: "" }, { type: "passenger", name: "" }],
  [{ type: "passenger", name: "" }, { type: "passenger", name: "" }, { type: "passenger", name: "" }, { type: "passenger", name: "" }],
  [{ type: "passenger", name: "" }, { type: "aisle" }, { type: "aisle" }, { type: "passenger", name: "" }]
]);

defineBus("coaster24", "우측 통로형 중형", 4, [
  [{ type: "passenger", name: "" }, { type: "aisle" }, { type: "aisle" }, { type: "fixed", label: "운전석" }],
  [{ type: "fixed", label: "냉장고" }, { type: "aisle" }, { type: "passenger", name: "" }, { type: "passenger", name: "" }],
  [{ type: "fixed", label: "출입문" }, { type: "aisle" }, { type: "passenger", name: "" }, { type: "passenger", name: "" }],
  ROW_P2_AISLE_P2(), ROW_P2_AISLE_P2(), ROW_P2_AISLE_P2(),
  ROW_P2_AISLE_P2(), ROW_P2_AISLE_P2(),
  [{ type: "passenger", name: "" }, { type: "passenger", name: "" }, { type: "passenger", name: "" }, { type: "passenger", name: "" }]
]);

defineBus("coaster28", "우측 통로형 대형", 4, [
  [{ type: "passenger", name: "" }, { type: "aisle" }, { type: "aisle" }, { type: "fixed", label: "운전석" }],
  [{ type: "fixed", label: "냉장고" }, { type: "aisle" }, { type: "passenger", name: "" }, { type: "passenger", name: "" }],
  [{ type: "fixed", label: "출입문" }, { type: "aisle" }, { type: "passenger", name: "" }, { type: "passenger", name: "" }],
  ROW_P2_AISLE_P2(), ROW_P2_AISLE_P2(), ROW_P2_AISLE_P2(),
  ROW_P2_AISLE_P2(), ROW_P2_AISLE_P2(), ROW_P2_AISLE_P2(), ROW_P2_AISLE_P2(),
  [{ type: "passenger", name: "" }, { type: "passenger", name: "" }]
]);

defineBus("korea40", "좌측 통로형 대형", 5, [
  [{ type: "fixed", label: "운전석" }, { type: "aisle" }, { type: "aisle" }, { type: "aisle" }, { type: "fixed", label: "출입문" }],
  [2, { type: "aisle" }, 2], [2, { type: "aisle" }, 2], [2, { type: "aisle" }, 2],
  [2, { type: "aisle" }, 2], [2, { type: "aisle" }, 2], [2, { type: "aisle" }, 2],
  [2, { type: "aisle" }, 2], [2, { type: "aisle" }, 2], [2, { type: "aisle" }, 2],
  [2, { type: "aisle" }, 2]
]);

var currentBus = "hiace10";
var seatsByBus = {};
Object.keys(BUSES).forEach(function (key) {
  seatsByBus[key] = BUSES[key].seats.map(function (s) {
    return { type: s.type, label: s.label || "", name: s.name || "" };
  });
});

var SYNTH_NAMES = [
  "가람", "다온", "라온", "마루", "보람", "서윤", "시온", "아윤",
  "예준", "온결", "유나", "이안", "재윤", "주원", "지후", "채원",
  "태윤", "하은", "하준", "현우"
];

function renderBusPicker() {
  var picker = document.getElementById("bus-picker");
  picker.textContent = "";
  Object.keys(BUSES).forEach(function (key) {
    var def = BUSES[key];
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-pressed", key === currentBus ? "true" : "false");
    btn.innerHTML = escapeHtml(def.name) + "<small>" + escapeHtml(def.capacity) + "</small>";
    btn.addEventListener("click", function () {
      currentBus = key;
      renderBusPicker();
      renderBus();
    });
    picker.appendChild(btn);
  });
}

function renderBus() {
  var bus = document.getElementById("bus");
  var def = BUSES[currentBus];
  var seats = seatsByBus[currentBus];
  bus.textContent = "";
  bus.style.gridTemplateColumns = "repeat(" + def.cols + ", minmax(0, 1fr))";

  var seatIndex = 0;

  seats.forEach(function (seat) {
    if (seat.type === "aisle") {
      var gap = document.createElement("div");
      gap.className = "seat aisle";
      gap.setAttribute("aria-hidden", "true");
      bus.appendChild(gap);
      return;
    }

    var node = document.createElement("div");

    if (seat.type === "fixed") {
      node.className = "seat fixed";
      node.textContent = seat.label;
      bus.appendChild(node);
      return;
    }

    seatIndex++;
    var filled = seat.name.trim() !== "";
    node.className = "seat " + (filled ? "filled" : "available");

    var input = document.createElement("input");
    input.type = "text";
    input.className = "name";
    input.maxLength = 8;
    input.value = seat.name;
    input.placeholder = String(seatIndex);
    input.setAttribute("aria-label", def.name + " " + seatIndex + "번 좌석 이름");

    var num = document.createElement("span");
    num.className = "seat-num";
    num.textContent = seatIndex + "번";

    node.appendChild(input);
    node.appendChild(num);

    input.addEventListener("input", function () {
      seat.name = input.value;
      var isFilled = seat.name.trim() !== "";
      node.className = "seat " + (isFilled ? "filled" : "available");
      renderSeatStats();
    });

    bus.appendChild(node);
  });

  renderSeatStats();
}

function renderSeatStats() {
  var seats = seatsByBus[currentBus];
  var total = 0;
  var filled = 0;
  seats.forEach(function (s) {
    if (s.type === "passenger") {
      total++;
      if (s.name.trim()) filled++;
    }
  });

  var box = document.getElementById("seat-stats");
  box.textContent = "";
  [
    { label: "승객 좌석", value: total + "석" },
    { label: "배정 완료", value: filled + "석" },
    { label: "남은 좌석", value: (total - filled) + "석" }
  ].forEach(function (stat) {
    var div = document.createElement("div");
    div.className = "stat";
    div.innerHTML = escapeHtml(stat.label) + "<b>" + escapeHtml(stat.value) + "</b>";
    box.appendChild(div);
  });
}

document.getElementById("fill-btn").addEventListener("click", function () {
  var seats = seatsByBus[currentBus];
  var idx = 0;
  seats.forEach(function (seat) {
    if (seat.type !== "passenger") return;
    seat.name = idx < SYNTH_NAMES.length ? SYNTH_NAMES[idx] : "";
    idx++;
  });
  renderBus();
});

document.getElementById("reset-seat-btn").addEventListener("click", function () {
  seatsByBus[currentBus] = seatsByBus[currentBus].map(function (s) {
    return { type: s.type, label: s.label, name: "" };
  });
  currentBus = "hiace10";
  renderBusPicker();
  renderBus();
  document.getElementById("share-preview").style.display = "none";
});

document.getElementById("share-preview-btn").addEventListener("click", function () {
  var def = BUSES[currentBus];
  var seats = seatsByBus[currentBus];
  var total = 0;
  var filled = 0;
  var names = [];
  seats.forEach(function (s) {
    if (s.type !== "passenger") return;
    total++;
    if (s.name.trim()) {
      filled++;
      names.push(s.name.trim());
    }
  });

  var preview = document.getElementById("share-preview");
  preview.style.display = "block";
  preview.textContent = "";
  var p = document.createElement("p");
  p.style.margin = "0 0 8px";
  p.textContent = "합성 데모 · 실제 전송 없음";
  var pre = document.createElement("p");
  pre.style.margin = "0";
  pre.style.whiteSpace = "pre-wrap";
  pre.textContent =
    "[" + def.name + " 좌석표]\n" +
    "배정 " + filled + "/" + total + "\n" +
    (names.length ? "이름: " + names.join(", ") : "아직 배정된 이름이 없습니다.");
  preview.appendChild(p);
  preview.appendChild(pre);
});

/* ---------- 3. MRZ 판독 ---------- */

var MRZ_SAMPLE = [
  "PASSPORT REPUBLIC OF KOREA",
  "PP KOR M123A4567",
  "15 JAN 1960 F",
  "20 JUN 2035",
  "P<KIM<<MINA<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "M123A45674KOR8001151F3506206<<<<<<<<<<<<<<0"
].join("\n");

function parseMrz(text) {
  var lines = String(text)
    .replace(/\r/g, "")
    .split("\n")
    .map(function (l) { return l.trim(); })
    .filter(function (l) { return l.length > 0; });

  var mrzLines = lines.filter(function (l) {
    return /^[A-Z0-9<]+$/.test(l.toUpperCase()) && l.length >= 20;
  });

  if (mrzLines.length < 2) return null;

  var nameLine = null;
  var dataLine = null;
  for (var i = 0; i < mrzLines.length; i++) {
    if (nameLine === null && mrzLines[i].indexOf("<<") !== -1) {
      nameLine = mrzLines[i];
      continue;
    }
    if (dataLine === null && mrzLines[i] !== nameLine) {
      dataLine = mrzLines[i];
    }
  }

  if (!nameLine || !dataLine) return null;

  // 여권 앞부분이 잘려도 읽히도록, << 앞의 마지막 단어를 성으로 본다.
  var parts = nameLine.split("<<");
  var surnameTokens = (parts[0] || "").split(/[^A-Z]+/).filter(Boolean);
  var surname = surnameTokens.length ? surnameTokens[surnameTokens.length - 1] : "";
  var given = (parts[1] || "").split(/[^A-Z]+/).filter(Boolean).join(" ");

  var passportNo = dataLine.substring(0, 9).replace(/<.*$/, "").trim();
  var nationality = dataLine.substring(10, 13).trim();
  var birthRaw = dataLine.substring(13, 19);
  var sex = dataLine.charAt(20);
  var expiryRaw = dataLine.substring(21, 27);

  function toIso(six) {
    if (!/^\d{6}$/.test(six)) return null;
    var yy = Number(six.slice(0, 2));
    var century = yy >= 80 ? 1900 : 2000;
    return century + yy + "-" + six.slice(2, 4) + "-" + six.slice(4, 6);
  }

  return {
    surname: surname,
    given: given,
    passportNo: passportNo,
    nationality: nationality,
    birth8: /^\d{6}/.test(birthRaw) ? "19" + birthRaw : birthRaw,
    birthIso: toIso(birthRaw),
    sex: sex === "F" ? "여성" : sex === "M" ? "남성" : "미상",
    expiryIso: toIso(expiryRaw)
  };
}

function renderMrz(result) {
  var box = document.getElementById("mrz-result");
  box.textContent = "";

  if (!result) {
    var p = document.createElement("p");
    p.className = "lede";
    p.textContent = "여권 MRZ로 판독하지 못했습니다. 항공권 화면이나 일반 문장은 여권이 아닙니다.";
    box.appendChild(p);
    return;
  }

  var rows = [
    ["이름", (result.surname + " " + result.given).trim() || "(읽기 실패)"],
    ["여권번호", result.passportNo || "(읽기 실패)"],
    ["국적 코드", result.nationality || "-"],
    ["생년월일", result.birthIso || result.birth8 || "-"],
    ["성별", result.sex],
    ["만료일", result.expiryIso || "-"]
  ];

  var table = document.createElement("table");
  table.className = "matrix";
  var tbody = document.createElement("tbody");
  rows.forEach(function (row) {
    var tr = document.createElement("tr");
    var th = document.createElement("th");
    th.scope = "row";
    th.textContent = row[0];
    var td = document.createElement("td");
    td.textContent = row[1];
    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  var note = document.createElement("p");
  note.className = "lede";
  note.style.margin = "10px 0 0";
  note.textContent = "합성 데이터이며 실제 여권 정보가 아닙니다.";

  box.appendChild(table);
  box.appendChild(note);
}

document.getElementById("mrz-btn").addEventListener("click", function () {
  renderMrz(parseMrz(document.getElementById("mrz").value));
});

document.getElementById("mrz-sample-btn").addEventListener("click", function () {
  document.getElementById("mrz").value = MRZ_SAMPLE;
  renderMrz(parseMrz(MRZ_SAMPLE));
});

document.getElementById("mrz-reject-btn").addEventListener("click", function () {
  var fake = "ICN FUK 8/1 3 passengers KOREA AIRLINES BOARDING PASS";
  document.getElementById("mrz").value = fake;
  renderMrz(parseMrz(fake));
});

/* ---------- 초기 상태 ---------- */

renderBusPicker();
renderBus();