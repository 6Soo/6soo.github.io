(function () {
  "use strict";

  var PRESETS = {
    report: {
      room: "업무 지시",
      text: "2026. 8. 3. 오전 9:12\n임팀장\n다음 주 월요일까지 운영 현황 보고서 초안을 만들어줘.\n최근 3개월 지표는 참고 폴더에서 확인하고, 확인 안 되는 수치는 비워둘 것."
    },
    ins: {
      room: "업무 지시",
      text: "오후 2:41\n박과장\n여행자보험 가입자 건 확인 부탁해.\n가입자 3명 기준이고 검토표 초안만 먼저 뽑아줘."
    },
    edtech: {
      room: "업무 지시",
      text: "오전 8:05\n정대리\n수강생 미납 명단을 기수별로 정리해서 회신 초안 만들어줘.\n전월 대조 표도 같이 붙여줘."
    },
    misc: {
      room: "잡담방",
      text: "오후 6:30\n최대리\n회의실 예약 어떻게 하는지 알려줘."
    }
  };

  var RULES = [
    {
      id: "travel_ins",
      target: "travel_ins",
      artifact: "검토표 초안 골격",
      scope: "전용 어댑터 + 검수",
      keys: ["여행자보험", "가입자", "보험료", " underwriting", "underwriting", "보험"]
    },
    {
      id: "edtech",
      target: "edtech",
      artifact: "명단 정리 초안 골격",
      scope: "상위 관리자 감시 하위 프로세스",
      keys: ["수강생", "미납", "기수", "학원", "수강료"]
    },
    {
      id: "research",
      target: "research",
      artifact: "보고서 초안 골격",
      scope: "초안만 생성, 외부 실행 대기",
      keys: ["보고서", "초안", "조사", "현황", "정리해서"]
    }
  ];

  var state = {
    records: [],
    logs: [],
    gate: null
  };

  function el(id) { return document.getElementById(id); }

  function setTag(node, text, kind) {
    node.textContent = text;
    node.className = "tag" + (kind ? " tag-" + kind : "");
  }

  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  function normalize(str) { return str.replace(/\s+/g, " ").trim(); }

  function isTimeLine(s) {
    return /오전|오후/.test(s) || /^\d{1,2}:\d{2}$/.test(s) ||
      /^\d{4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2}/.test(s);
  }

  function splitDateTime(s) {
    var out = { date: "", time: "" };
    var d = s.match(/\d{4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2}/);
    if (d) { out.date = d[0].replace(/\s+/g, " "); }
    var t = s.match(/(오전|오후)?\s*\d{1,2}:\d{2}/);
    if (t) { out.time = t[0].replace(/\s+/g, " "); }
    return out;
  }

  function parseClipboard(raw) {
    var lines = raw.replace(/\r/g, "").split("\n");
    while (lines.length && lines[0].trim() === "") { lines.shift(); }
    if (!lines.length) { return null; }

    var i = 0;
    var dt = { date: "", time: "" };
    if (isTimeLine(lines[0].trim())) {
      dt = splitDateTime(lines[0].trim());
      i = 1;
    } else if (lines.length > 1 && isTimeLine(lines[1].trim())) {
      dt = splitDateTime(lines[1].trim());
    }
    var sender = (lines[i] || "").trim() || "확인 불가";
    i += 1;
    var bodyLines = lines.slice(i);
    while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === "") {
      bodyLines.pop();
    }
    var body = bodyLines.join("\n").trim();

    if (!dt.time) { dt.time = "미확인"; }
    if (!dt.date) { dt.date = "미확인"; }
    if (!body) { return null; }

    return {
      sender: sender,
      date: dt.date,
      time: dt.time,
      body: body,
      bodyLines: bodyLines.filter(function (l) { return l.trim() !== ""; }).length,
      stableId: fnv1a([sender, dt.date, dt.time, normalize(body)].join("|"))
    };
  }

  function classify(rec) {
    var hit = null;
    var hay = rec.sender + " " + rec.body;
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      for (var k = 0; k < r.keys.length; k++) {
        if (hay.toLowerCase().indexOf(r.keys[k].toLowerCase()) !== -1) { hit = r; break; }
      }
      if (hit) { break; }
    }
    return hit;
  }

  function kv(key, value) {
    var nodes = el("parseOut").querySelectorAll("dd");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute("data-k") === key) {
        nodes[i].textContent = value;
        return;
      }
    }
  }

  function renderQueue() {
    var list = el("queueList");
    list.innerHTML = "";
    el("dlgList").hidden = state.records.length === 0;

    state.records.forEach(function (r) {
      var li = document.createElement("li");
      var head = document.createElement("b");
      head.textContent = r.sender;
      var meta = document.createElement("div");
      meta.className = "qmeta";
      var tag = document.createElement("span");
      tag.className = "pill" + (r.rule ? "" : " pill-mute");
      tag.textContent = r.rule ? r.rule.target : "직접 처리";
      meta.appendChild(tag);
      meta.appendChild(document.createTextNode(
        (r.date === "미확인" ? "날짜 미확인" : r.date) + " " + r.time + " · ID " + r.stableId
      ));
      var prev = document.createElement("div");
      prev.className = "qmeta";
      prev.textContent = r.body.length > 42 ? r.body.slice(0, 42) + "…" : r.body;
      li.appendChild(head);
      li.appendChild(meta);
      li.appendChild(prev);
      list.appendChild(li);
    });

    var sel = el("selectMsg");
    var keep = sel.value;
    sel.innerHTML = "";
    if (state.records.length === 0) {
      var o0 = document.createElement("option");
      o0.value = "";
      o0.textContent = "대기열이 비어 있습니다";
      sel.appendChild(o0);
    }
    state.records.forEach(function (r, idx) {
      var o = document.createElement("option");
      o.value = String(idx);
      o.textContent = "#" + (idx + 1) + " " + r.sender + " · " + (r.rule ? r.rule.target : "직접 처리");
      sel.appendChild(o);
    });
    if (keep && state.records[Number(keep)]) { sel.value = keep; }
  }

  function addLog(level, text) {
    state.logs.push({ level: level, text: text });
    var list = el("logList");
    list.innerHTML = "";
    state.logs.forEach(function (item) {
      var li = document.createElement("li");
      var lv = document.createElement("span");
      lv.className = "lv " + item.level;
      lv.textContent = item.level === "pass" ? "통과" : item.level === "hold" ? "대기" : "중단";
      var lt = document.createElement("span");
      lt.className = "lt";
      lt.textContent = item.text;
      li.appendChild(lv);
      li.appendChild(lt);
      list.appendChild(li);
    });
    el("logWrap").hidden = false;
  }

  function onParse() {
    var raw = el("rawInput").value;
    var rec = parseClipboard(raw);

    if (!rec) {
      setTag(el("parseTag"), "형식 오류", "danger");
      el("parseBody").textContent = "헤더(날짜 또는 시각, 발신자)와 본문이 필요합니다.";
      ["sender", "date", "time", "id", "lines"].forEach(function (k) { kv(k, "—"); });
      return;
    }

    kv("sender", rec.sender);
    kv("date", rec.date);
    kv("time", rec.time);
    kv("id", rec.stableId);
    kv("lines", String(rec.bodyLines));
    el("parseBody").textContent = rec.body;

    var room = el("roomInput").value.trim();
    if (room !== el("filterInput").value.trim()) {
      setTag(el("parseTag"), "필터 차단", "danger");
      el("parseBody").textContent =
        "채팅 제목이 통과 조건과 정확히 일치하지 않아 수신 단계에서 차단되었습니다.\n원본은 다음과 같습니다.\n\n" + rec.body;
      return;
    }

    var dup = state.records.some(function (r) { return r.stableId === rec.stableId; });
    if (dup) {
      setTag(el("parseTag"), "중복 제거", "warn");
      el("parseHint").textContent =
        "안정 ID " + rec.stableId + " 가 이미 적재돼 있어 이번 건은 버렸습니다. 반복 실행해도 같은 항목이 쌓이지 않습니다.";
      return;
    }

    rec.room = room;
    rec.rule = classify(rec);
    state.records.push(rec);
    setTag(el("parseTag"), rec.rule ? "업무 감지됨" : "직접 처리", rec.rule ? "ok" : "mute");
    el("parseHint").textContent =
      "대기열에 적재했습니다. 안정 ID " + rec.stableId +
      (rec.rule ? " · 라우팅 후보 " + rec.rule.target : " · 자동 배분 대상 없음");
    renderQueue();
  }

  function onRun() {
    var idx = Number(el("selectMsg").value);
    var rec = state.records[idx];
    state.logs = [];
    el("gateCard").hidden = true;
    state.gate = null;
    setTag(el("gateTag"), "실행 전", "mute");
    el("gateText").innerHTML = "실행할 항목을 선택하고 <b>파이프라인 실행</b>을 누르면 승인 카드가 열립니다.";

    if (!rec) {
      setTag(el("parseTag"), "대기열 비어 있음", "warn");
      addLog("stop", "적재된 메시지가 없어 실행을 시작할 수 없습니다.");
      return;
    }

    addLog("pass", "수신: 앱 패키지 필터와 채팅 제목 정확 일치 조건을 통과했습니다.");
    addLog("pass", "파싱: 발신자 " + rec.sender + ", 시각 " + rec.time + ", 본문 " + rec.bodyLines + "줄을 분리했습니다.");
    addLog("pass", "적재: 안정 ID " + rec.stableId + " 로 중복을 확인했고 신규 항목입니다.");

    if (!rec.rule) {
      addLog("stop", "분석: 라우팅 규칙에 해당하지 않아 자동 배분하지 않고 직접 처리 목록에 남깁니다.");
      setTag(el("gateTag"), "승인 불필요", "mute");
      el("gateText").innerHTML = "<b>직접 처리</b>로 분류되어 승인 게이트를 열지 않았습니다. 자동 발신은 언제나 사람 확인을 거칩니다.";
      setTag(el("parseTag"), "직접 처리", "mute");
      return;
    }

    addLog("pass", "분석: " + rec.rule.target + " 업무로 감지했습니다.");
    addLog("pass", "라우팅: " + rec.rule.target + " 저장소로 배분 골격을 잡습니다. 실행 방식은 " + rec.rule.scope + ".");
    if (rec.rule.id === "travel_ins") {
      addLog("hold", "라우팅 예외: 여행자보험은 일반 실행기로 우회하지 않고 전용 어댑터와 검수 절차로 넘깁니다.");
    }
    addLog("hold", "승인: 자동 발신은 사람 확인 게이트를 거칩니다. 승인 전에는 실행 골격을 만들지 않습니다.");

    state.gate = rec;
    el("gateCard").hidden = false;
    el("gateId").textContent = "REQ-" + rec.stableId.toUpperCase();
    el("gateTarget").textContent = rec.rule.target;
    el("gateArtifact").textContent = rec.rule.artifact;
    el("gateScope").textContent = rec.rule.scope;
    setTag(el("gateTag"), "승인 대기", "warn");
    el("gateText").innerHTML = "승인 카드가 열렸습니다. <b>승인</b>을 눌러야 골격이 생성되고, 반려하면 기록만 남습니다.";
    addLog("hold", "승인 대기: 사용자 응답을 기다립니다.");
  }

  function onApprove() {
    var rec = state.gate;
    if (!rec) { return; }
    addLog("pass", "승인: 사용자가 승인했습니다.");
    addLog("pass", "디스패치: " + rec.rule.target + " 작업 골격만 생성했습니다. 외부 실행과 실제 저장은 다음 승인을 기다립니다.");
    setTag(el("gateTag"), "승인 완료", "ok");
    el("gateText").innerHTML = "골격이 생성됐습니다. 이 데모는 실제 파일이나 외부 요청을 만들지 않습니다.";

    var li = document.createElement("li");
    var head = document.createElement("b");
    head.textContent = "REQ-" + rec.stableId.toUpperCase() + " · " + rec.rule.target;
    var meta = document.createElement("div");
    meta.className = "qmeta";
    var pill = document.createElement("span");
    pill.className = "pill pill-ok";
    pill.textContent = "골격 생성";
    meta.appendChild(pill);
    meta.appendChild(document.createTextNode(rec.rule.artifact + " · " + rec.rule.scope));
    li.appendChild(head);
    li.appendChild(meta);
    el("dispatchList").appendChild(li);
    el("dispatchWrap").hidden = false;
    state.gate = null;
  }

  function onReject() {
    var rec = state.gate;
    if (!rec) { return; }
    addLog("stop", "반려: 실행 골격을 만들지 않았습니다. 답변 기록은 업무 한정 규칙과 전역 규칙으로 나눠 남깁니다.");
    setTag(el("gateTag"), "반려", "danger");
    el("gateText").innerHTML = "반려 처리했습니다. 다음 실행을 위해 대기열 항목은 그대로 남습니다.";
    state.gate = null;
  }

  function resetAll() {
    state.records = [];
    state.logs = [];
    state.gate = null;
    el("rawInput").value = "";
    el("roomInput").value = "업무 지시";
    el("filterInput").value = "업무 지시";
    el("parseBody").textContent = "아직 파싱된 메시지가 없습니다.";
    ["sender", "date", "time", "id", "lines"].forEach(function (k) { kv(k, "—"); });
    setTag(el("parseTag"), "대기", null);
    el("parseHint").textContent = "외부 전송 없음. 입력은 이 브라우저 메모리에서만 다뤄집니다.";
    el("logList").innerHTML = "";
    el("logWrap").hidden = true;
    el("dispatchList").innerHTML = "";
    el("dispatchWrap").hidden = true;
    el("gateCard").hidden = true;
    setTag(el("gateTag"), "실행 전", "mute");
    el("gateText").innerHTML = "실행할 항목을 선택하고 <b>파이프라인 실행</b>을 누르면 승인 카드가 열립니다.";
    renderQueue();
    el("rawInput").focus();
  }

  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"), function (btn) {
      btn.addEventListener("click", function () {
        var p = PRESETS[btn.getAttribute("data-preset")];
        el("rawInput").value = p.text;
        el("roomInput").value = p.room;
        el("parseHint").textContent = "예시를 불러왔습니다. 파싱하고 적재를 누르면 파서가 본문을 분리합니다.";
        setTag(el("parseTag"), "입력됨", null);
        el("rawInput").focus();
      });
    });
    el("parseBtn").addEventListener("click", onParse);
    el("runBtn").addEventListener("click", onRun);
    el("approveBtn").addEventListener("click", onApprove);
    el("rejectBtn").addEventListener("click", onReject);
    el("resetBtn").addEventListener("click", resetAll);
    el("resetBtn2").addEventListener("click", resetAll);
    renderQueue();
  });
})();
