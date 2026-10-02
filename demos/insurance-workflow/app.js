"use strict";

/* 여행자보험 명단 자동화 파이프라인 공개 데모
   - 서버 호출, 파일 저장, 실제 가입 진행 없음. 입력은 이 브라우저 안에서만 처리한다.
   - 예시 명단은 전부 합성 데이터이며 실제 사람 정보가 아니다. */

var STORE_KEY = "travel-ins-demo.learned-corrections.v1";

var SAMPLE_ROSTER = [
  "# 합성 예시: 이름 주민번호 명단 (가상 데이터)",
  "1 김도현 900615-1203013",
  "2 이서우(새벽알) 920308-2204023",
  "3 박지안 881123-1305038",
  "4 정채원 991332-1507050",
  "5 정예준 950701-2406041",
  "6 한유진 990214-1507050",
  "7 오지호 910930-2608061",
  "8 신채원 860509-1709079",
  "9 이서우 920308-2204023",
  "10 정하윤 790808-2314158"
].join("\n");

var SAMPLE_FOOTNOTE = [
  "3행: 체크섬 오류",
  "4행: 생년월일 오류(13월)",
  "9행: 2행과 중복",
  "10행: 성명 오탈자(검수 교정 필요)"
].join(" / ");

var WEIGHTS = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];

var el = {
  roster: document.getElementById("rosterInput"),
  btnValidate: document.getElementById("btnValidate"),
  btnSample: document.getElementById("btnSample"),
  btnReset: document.getElementById("btnReset"),
  toggleMask: document.getElementById("toggleMask"),
  statTotal: document.getElementById("statTotal"),
  statPass: document.getElementById("statPass"),
  statFail: document.getElementById("statFail"),
  statExcluded: document.getElementById("statExcluded"),
  body: document.getElementById("resultBody"),
  learnBox: document.getElementById("learnBox"),
  tripKind: document.getElementById("tripKind"),
  nationWrap: document.getElementById("nationWrap"),
  tripNation: document.getElementById("tripNation"),
  tripStart: document.getElementById("tripStart"),
  tripEnd: document.getElementById("tripEnd"),
  btnSnippet: document.getElementById("btnSnippet"),
  tripSummary: document.getElementById("tripSummary"),
  outSnippet: document.getElementById("outSnippet"),
  outTable: document.getElementById("outTable"),
  btnCopySnippet: document.getElementById("btnCopySnippet"),
  btnCopyTable: document.getElementById("btnCopyTable"),
  copyNote: document.getElementById("copyNote")
};

var state = {
  rows: [],
  excluded: {},
  editorOpen: null,
  learned: loadLearned()
};

/* ---------- 저장 (이 브라우저의 로컬 저장소만 사용) ---------- */

function loadLearned() {
  try {
    var raw = window.localStorage.getItem(STORE_KEY);
    var parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    return {};
  }
}

function saveLearned() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state.learned));
  } catch (err) {
    el.copyNote.textContent = "학습 사전을 이 브라우저에 저장하지 못했습니다. 현재 화면에서만 적용됩니다.";
  }
}

function clearLearned() {
  state.learned = {};
  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch (err) {
    /* 저장소를 쓸 수 없는 환경이면 이미 비어 있음 */
  }
}

/* ---------- 파싱 ---------- */

function parseRoster(text) {
  var lines = text.split(/\r?\n/);
  var rows = [];
  var id = 0;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line.charAt(0) === "#") continue;

    var tokens = line.split(/[\s,\t]+/).filter(Boolean);
    if (!tokens.length) continue;

    var givenSeq = null;
    if (/^\d{1,3}$/.test(tokens[0])) {
      givenSeq = parseInt(tokens[0], 10);
      tokens = tokens.slice(1);
    }

    var rrn = "";
    var rest = [];
    for (var t = 0; t < tokens.length; t++) {
      if (/^\d{6}-?\d{7}$/.test(tokens[t]) && !rrn) rrn = tokens[t];
      else rest.push(tokens[t]);
    }

    id += 1;
    rows.push({
      id: id,
      line: i + 1,
      givenSeq: givenSeq,
      rawName: rest.join(" "),
      rawRrn: rrn,
      source: line
    });
  }

  return rows;
}

function splitNickname(name) {
  var matched = /^(.+?)\s*[(\[]\s*([^)\]]+?)\s*[)\]]$/.exec(name.trim());
  if (matched) return { name: matched[1].trim(), nick: matched[2].trim() };
  return { name: name.trim(), nick: "" };
}

/* ---------- 검증 ---------- */

function validateRrn(rrn) {
  var issues = [];
  var info = { birth: "", gender: "" };

  if (!rrn) {
    issues.push("주민번호 없음");
    return { ok: false, issues: issues, info: info };
  }

  var digits = rrn.replace(/-/g, "");
  if (!/^\d{6}-\d{7}$/.test(rrn)) {
    issues.push("형식 오류(000000-0000000)");
    if (!/^\d{13}$/.test(digits)) return { ok: false, issues: issues, info: info };
  }

  var yy = parseInt(digits.slice(0, 2), 10);
  var mm = parseInt(digits.slice(2, 4), 10);
  var dd = parseInt(digits.slice(4, 6), 10);
  var g = parseInt(digits.charAt(6), 10);

  var century = 0;
  if (g >= 1 && g <= 4) century = 1900;
  else if (g >= 5 && g <= 8) century = 2000;
  else if (g === 9 || g === 0) century = 1800;
  else {
    issues.push("성별 코드 오류(1~8, 9, 0)");
    century = 1900;
  }

  var year = century + yy;
  info.birth = year + "-" + pad(mm) + "-" + pad(dd);
  if (g === 9) info.gender = "구";
  else if (g === 0 || g === 2 || g === 4 || g === 6 || g === 8) info.gender = "여";
  else info.gender = "남";

  var maxDay = daysInMonth(year, mm);
  if (mm < 1 || mm > 12) {
    issues.push("생년월일 오류(월 " + mm + ")");
  } else if (dd < 1 || dd > maxDay) {
    issues.push("생년월일 오류(" + year + "년 " + mm + "월은 " + maxDay + "일까지)");
  }

  var sum = 0;
  for (var i = 0; i < 12; i++) sum += parseInt(digits.charAt(i), 10) * WEIGHTS[i];
  var expected = (11 - (sum % 11)) % 10;
  var actual = parseInt(digits.charAt(12), 10);
  if (expected !== actual) {
    issues.push("체크섬 불일치(기대 " + expected + ", 입력 " + actual + ")");
  }

  return { ok: issues.length === 0, issues: issues, info: info };
}

function pad(n) {
  return (n < 10 ? "0" : "") + n;
}

function daysInMonth(year, month) {
  var table = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12) return 0;
  var last = table[month - 1];
  if (month === 2 && (year % 4 === 0 && year % 100 !== 0)) return 29;
  return last;
}

function learnedKey(row) {
  return row.rawName + "|" + row.rawRrn;
}

function build() {
  var rows = parseRoster(el.roster.value);
  var seenRrn = {};
  var prevGiven = 0;

  rows.forEach(function (row, index) {
    var key = learnedKey(row);
    var fixed = state.learned[key];
    row.seq = index + 1;
    row.learned = !!fixed;

    var namePart = splitNickname(fixed && fixed.name ? fixed.name : row.rawName);
    row.name = namePart.name;
    row.nick = namePart.nick;
    row.rrn = fixed && fixed.rrn ? fixed.rrn : row.rawRrn;

    var issues = [];
    var result = validateRrn(row.rrn);
    issues = issues.concat(result.issues);
    row.birth = result.info.birth;
    row.gender = result.info.gender;

    if (!row.name) issues.push("성명 누락");
    if (/^[a-zA-Z]+$/.test(row.name)) issues.push("닉네임만 입력됨 — 한글 성명 교정 필요");

    var digits = row.rrn.replace(/-/g, "");
    if (digits.length === 13 && digits !== "0000000000000") {
      if (seenRrn[digits]) {
        issues.push("중복(" + seenRrn[digits] + "행과 동일)");
      } else if (!/^0{13}$/.test(digits)) {
        seenRrn[digits] = row.seq;
      }
    }

    if (row.givenSeq !== null) {
      if (row.givenSeq !== prevGiven + 1) issues.push("순번 불일치(직전 " + prevGiven + ")");
      prevGiven = row.givenSeq;
    }

    row.issues = issues;
    row.ok = issues.length === 0;
  });

  state.rows = rows;
}

function maskedText(rrn) {
  if (el.toggleMask.checked) {
    return /^\d{6}-\d{7}$/.test(rrn) ? rrn.slice(0, 7) + "*****" : rrn;
  }
  return rrn;
}

/* ---------- 렌더링 ---------- */

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusPill(row) {
  if (state.excluded[row.id]) return '<span class="pill warn">제외됨</span>';
  if (row.ok) {
    return row.learned
      ? '<span class="pill ok">통과</span><span class="pill learned">교정 반영</span>'
      : '<span class="pill ok">통과</span>';
  }
  var html = '<span class="pill bad">실패</span>';
  row.issues.forEach(function (issue) {
    html += '<span class="pill bad">' + esc(issue) + "</span>";
  });
  return html;
}

function editorHtml(row) {
  if (state.editorOpen !== row.id || state.excluded[row.id]) return "";
  return [
    '<div class="editor">',
    '<p class="desc">원본 문자열 <code>' + esc(learnedKey(row)) + '</code> 를 기억해 같은 오탈자가 다시 나오면 자동 적용합니다.</p>',
    '<div class="grid2">',
    '<div><label class="field" for="fix-name-' + row.id + '">성명 교정</label>',
    '<input type="text" id="fix-name-' + row.id + '" value="' + esc(row.name) + '"></div>',
    '<div><label class="field" for="fix-rrn-' + row.id + '">주민번호 교정</label>',
    '<input type="text" id="fix-rrn-' + row.id + '" value="' + esc(row.rrn) + '" inputmode="numeric"></div>',
    "</div>",
    '<div class="btn-row">',
    '<button type="button" class="small primary" data-act="save" data-id="' + row.id + '">저장 후 재검증</button>',
    '<button type="button" class="small" data-act="cancel" data-id="' + row.id + '">취소</button>',
    "</div>",
    "</div>"
  ].join("");
}

function render() {
  var pass = 0;
  var fail = 0;
  var excluded = 0;

  if (!state.rows.length) {
    el.body.innerHTML = '<tr><td colspan="6" class="empty">검증을 실행하면 행별 결과가 여기에 표시됩니다.</td></tr>';
  } else {
    var html = state.rows.map(function (row) {
      var isOut = !!state.excluded[row.id];
      if (isOut) excluded += 1;
      else if (row.ok) pass += 1;
      else fail += 1;

      var actions = isOut
        ? '<button type="button" class="small" data-act="include" data-id="' + row.id + '">다시 포함</button>'
        : '<div class="btn-row"><button type="button" class="small" data-act="edit" data-id="' + row.id + '">교정</button>' +
          (row.ok ? "" : '<button type="button" class="small" data-act="exclude" data-id="' + row.id + '">검수에서 제외</button>') + "</div>";

      return [
        '<tr data-state="', isOut ? "excluded" : (row.ok ? "ok" : "bad"), '">',
        "<td>", esc(row.seq), "</td>",
        "<td>", row.nick ? esc(row.name) + '<br><span class="pill learned">닉네임 ' + esc(row.nick) + "</span>" : esc(row.name), "</td>",
        "<td class=\"mono\">", esc(row.birth || "-"), "</td>",
        "<td>", esc(row.gender || "-"), "</td>",
        '<td class="mono">', esc(maskedText(row.rrn) || "-"), "</td>",
        "<td>", statusPill(row), actions, editorHtml(row), "</td>",
        "</tr>"
      ].join("");
    }).join("");
    el.body.innerHTML = html;
  }

  el.statTotal.textContent = state.rows.length;
  el.statPass.textContent = pass;
  el.statFail.textContent = fail;
  el.statExcluded.textContent = excluded;
  renderLearned();
}

function renderLearned() {
  var keys = Object.keys(state.learned);
  if (!keys.length) {
    el.learnBox.innerHTML = '<p class="hint" style="margin:0;">아직 저장된 교정이 없습니다.</p>';
    return;
  }
  var items = keys.map(function (key) {
    var item = state.learned[key];
    return "<li><code>" + esc(key) + "</code> → 성명 <b>" + esc(item.name || "-") +
      "</b>, 주민번호 <b>" + esc(item.rrn || "-") + "</b></li>";
  }).join("");
  el.learnBox.innerHTML =
    '<p class="hint">이 브라우저에 저장된 교정 ' + keys.length + '건입니다. 목록에서 삭제할 수 있습니다.</p>' +
    '<ul class="facts">' + items +
    '<li><button type="button" class="small ghost" data-act="clear-learned">학습 사전 전체 삭제</button></li></ul>';
}

/* ---------- 스니펫 ---------- */

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

function tomorrow() {
  var d = new Date();
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function tripSettings() {
  var kind = el.tripKind.value;
  var start = el.tripStart.value || tomorrow();
  var end = el.tripEnd.value || start;
  var nation = el.tripNation.value.trim();
  var notes = [];
  if (!el.tripStart.value || !el.tripEnd.value) notes.push("기간 미입력: 기본값 적용");
  if (kind === "ABR" && !nation) notes.push("해외 구분인데 국가가 비어 있음");
  if (end < start) notes.push("종료일이 시작일보다 빠름");
  return {
    kind: kind,
    nation: nation,
    start: start,
    end: end,
    label: kind === "ABR" ? "해외여행 " + (nation || "(국가 미입력)") : "국내여행",
    notes: notes
  };
}

function usableRows() {
  return state.rows.filter(function (row) {
    return row.ok && !state.excluded[row.id];
  });
}

function makeSnippet() {
  build();
  render();

  var rows = usableRows();
  var trip = tripSettings();
  var lines = rows.map(function (row) {
    return row.name + " " + row.rrn;
  });
  var table = rows.map(function (row) {
    return row.name + "\t" + row.rrn;
  });

  el.outSnippet.value = lines.join("\n");
  el.outTable.value = table.join("\n");
  el.btnCopySnippet.disabled = lines.length === 0;
  el.btnCopyTable.disabled = table.length === 0;

  var failed = state.rows.filter(function (row) {
    return !row.ok && !state.excluded[row.id];
  }).length;

  el.tripSummary.innerHTML =
    "<b>분류</b> " + esc(trip.label) + " · <b>기간</b> " + esc(trip.start) + " ~ " + esc(trip.end) +
    "<br><b>사용 행</b> " + rows.length + "건 / <b>제외·실패</b> " + failed + "건" +
    (trip.notes.length ? "<br><span class=\"pill warn\">" + esc(trip.notes.join(" / ")) + "</span>" : "");

  if (!rows.length) {
    el.copyNote.textContent = "검증 통과한 행이 없어 스니펫을 만들지 않았습니다.";
  } else {
    el.copyNote.textContent = "검수가 끝난 값만 담았습니다. 복사는 이 브라우저 안에서만 동작합니다.";
  }
}

/* ---------- 복사 ---------- */

function copyText(value, label) {
  var area = el.outSnippet;
  var restore = area.value;

  function done(ok) {
    if (ok) el.copyNote.textContent = label + " 텍스트를 클립보드에 복사했습니다.";
    else el.copyNote.textContent = "복사하지 못했습니다. 출력 칸을 직접 선택해 복사해 주세요.";
    area.value = restore;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).then(function () { done(true); }, function () { done(legacyCopy(value)); });
  } else {
    done(legacyCopy(value));
  }
}

function legacyCopy(value) {
  var helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "readonly");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();
  var ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (err) {
    ok = false;
  }
  document.body.removeChild(helper);
  return ok;
}

/* ---------- 동작 ---------- */

function validateNow() {
  state.editorOpen = null;
  build();
  render();
  el.copyNote.textContent = "";
}

function rowById(id) {
  return state.rows.filter(function (row) {
    return row.id === id;
  })[0];
}

function onBodyClick(event) {
  var target = event.target.closest("button[data-act]");
  if (!target) return;

  var id = parseInt(target.getAttribute("data-id"), 10);
  var act = target.getAttribute("data-act");

  if (act === "clear-learned") {
    clearLearned();
    validateNow();
    return;
  }

  if (act === "exclude") {
    state.excluded[id] = true;
    state.editorOpen = null;
    build();
    render();
    return;
  }

  if (act === "include") {
    delete state.excluded[id];
    build();
    render();
    return;
  }

  if (act === "edit") {
    state.editorOpen = state.editorOpen === id ? null : id;
    render();
    var input = document.getElementById("fix-name-" + id);
    if (input) input.focus();
    return;
  }

  if (act === "cancel") {
    state.editorOpen = null;
    render();
    return;
  }

  if (act === "save") {
    var row = rowById(id);
    if (!row) return;
    var nameValue = document.getElementById("fix-name-" + id).value.trim();
    var rrnValue = document.getElementById("fix-rrn-" + id).value.trim();

    if (!nameValue) {
      el.copyNote.textContent = "성명을 입력해 주세요.";
      return;
    }
    if (rrnValue && !/^\d{6}-?\d{7}$/.test(rrnValue)) {
      el.copyNote.textContent = "주민번호는 000000-0000000 형식이어야 합니다.";
      return;
    }

    state.learned[learnedKey(row)] = { name: nameValue, rrn: rrnValue };
    saveLearned();
    state.editorOpen = null;
    build();
    render();
    el.copyNote.textContent = "교정을 저장하고 재검증했습니다.";
  }
}

function resetAll() {
  if (!window.confirm("입력, 결과, 스니펫, 학습 사전까지 모두 지웁니다. 계속할까요?")) return;

  state.rows = [];
  state.excluded = {};
  state.editorOpen = null;
  clearLearned();

  el.roster.value = "";
  el.outSnippet.value = "";
  el.outTable.value = "";
  el.btnCopySnippet.disabled = true;
  el.btnCopyTable.disabled = true;
  el.tripSummary.textContent = "아직 생성하지 않았습니다.";
  el.copyNote.textContent = "";
  el.tripKind.value = "DOM";
  el.tripStart.value = "";
  el.tripEnd.value = "";
  el.tripNation.value = "";
  el.nationWrap.style.display = "none";
  el.toggleMask.checked = true;

  render();
  el.roster.focus();
}

function loadSample() {
  el.roster.value = SAMPLE_ROSTER;
  state.excluded = {};
  state.editorOpen = null;
  validateNow();
  el.roster.focus();
  el.copyNote.textContent = "합성 예시를 불러왔습니다. 의도된 오류: " + SAMPLE_FOOTNOTE;
}

el.btnValidate.addEventListener("click", validateNow);
el.btnSample.addEventListener("click", loadSample);
el.btnReset.addEventListener("click", resetAll);
el.btnSnippet.addEventListener("click", makeSnippet);
el.toggleMask.addEventListener("change", render);
el.tripKind.addEventListener("change", function () {
  el.nationWrap.style.display = el.tripKind.value === "ABR" ? "block" : "none";
});
el.body.addEventListener("click", onBodyClick);
el.learnBox.addEventListener("click", onBodyClick);
el.btnCopySnippet.addEventListener("click", function () {
  copyText(el.outSnippet.value, "한 줄 스니펫");
});
el.btnCopyTable.addEventListener("click", function () {
  copyText(el.outTable.value, "붙여넣기 표");
});

render();
