(function () {
  'use strict';

  var INITIAL_MONITORS = [
    { id: 1, name: '내장 디스플레이', x: 0, y: 0, w: 1920, h: 1080, scale: 1.5, primary: true },
    { id: 2, name: '외부 모니터 A', x: 1920, y: 0, w: 2560, h: 1440, scale: 1, primary: false },
    { id: 3, name: '외부 모니터 B', x: -1920, y: 120, w: 1920, h: 1080, scale: 1.25, primary: false }
  ];

  var state = freshState();

  function freshState() {
    return {
      monitors: INITIAL_MONITORS.map(function (m) { return Object.assign({}, m); }),
      selectedId: null,
      running: false,
      hotkey: null,
      profileIsolated: true,
      withGpu: true,
      kiosk: false,
      windowRect: null,
      processTree: [],
      logs: []
    };
  }

  var el = {
    monitorList: document.getElementById('monitorList'),
    monitorReadout: document.getElementById('monitorReadout'),
    runBtn: document.getElementById('runBtn'),
    runHint: document.getElementById('runHint'),
    optProfile: document.getElementById('optProfile'),
    optGpu: document.getElementById('optGpu'),
    optKiosk: document.getElementById('optKiosk'),
    resultBox: document.getElementById('resultBox'),
    hotkeyInput: document.getElementById('hotkeyInput'),
    hotkeyClear: document.getElementById('hotkeyClear'),
    hotkeyState: document.getElementById('hotkeyState'),
    stopBtn: document.getElementById('stopBtn'),
    resetBtn: document.getElementById('resetBtn'),
    log: document.getElementById('log')
  };

  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function timeLabel(d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function addLog(message, level) {
    state.logs.push({ time: timeLabel(new Date()), message: message, level: level || 'ok' });
    renderLog();
  }

  function renderLog() {
    el.log.textContent = '';
    if (!state.logs.length) {
      el.log.appendChild(h('li', 'log-empty', '기록이 없습니다. 모니터를 선택해 보세요.'));
      return;
    }
    state.logs.forEach(function (entry) {
      var li = h('li');
      li.appendChild(h('span', 't', entry.time));
      li.appendChild(h('span', 'lvl ' + entry.level, entry.level.toUpperCase()));
      li.appendChild(h('span', 'msg', entry.message));
      el.log.appendChild(li);
    });
    el.log.scrollTop = el.log.scrollHeight;
  }

  function selectedMonitor() {
    var found = null;
    state.monitors.forEach(function (m) { if (m.id === state.selectedId) found = m; });
    return found;
  }

  function leftmostMonitor() {
    var best = null;
    state.monitors.forEach(function (m) {
      if (best === null || m.x < best.x || (m.x === best.x && m.y < best.y)) best = m;
    });
    return best;
  }

  function renderMonitors() {
    el.monitorList.textContent = '';
    var left = leftmostMonitor();
    state.monitors.forEach(function (m) {
      var btn = h('button', 'monitor');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', m.id === state.selectedId ? 'true' : 'false');

      var nameRow = h('div', 'monitor-name');
      nameRow.appendChild(h('span', null, m.name));
      if (m.id === left.id) {
        var flag = h('span', 'monitor-flag', '가장 왼쪽');
        nameRow.appendChild(flag);
      }
      btn.appendChild(nameRow);
      btn.appendChild(h('div', 'monitor-meta',
        m.w + ' x ' + m.h + ' · 위치 (' + m.x + ', ' + m.y + ') · 배율 ' + m.scale + 'x'));

      btn.addEventListener('click', function () { selectMonitor(m.id); });
      el.monitorList.appendChild(btn);
    });
  }

  function renderReadout() {
    el.monitorReadout.textContent = '';
    var m = selectedMonitor();
    if (!m) {
      el.monitorReadout.appendChild(h('p', 'readout-empty', '선택된 모니터가 없습니다.'));
      return;
    }
    var left = leftmostMonitor();
    var dl = h('dl', 'kv');
    function row(term, def) {
      dl.appendChild(h('dt', null, term));
      dl.appendChild(h('dd', null, def));
    }
    row('디스플레이', m.name);
    row('물리 좌표', '(' + m.x + ', ' + m.y + ')');
    row('크기', m.w + ' x ' + m.h + 'px');
    row('DPI 배율', m.scale + 'x');
    row('논리 좌표', Math.round(m.x / m.scale) + ', ' + Math.round(m.y / m.scale));
    row('가장 왼쪽', m.id === left.id ? '예' : '아니오');
    el.monitorReadout.appendChild(dl);
  }

  function selectMonitor(id) {
    var m = selectedMonitor();
    if (m && m.id === id) return;
    state.selectedId = id;
    if (state.running) {
      stopSession('모니터를 바꿔 기존 세션을 정리했습니다.');
    }
    var picked = selectedMonitor();
    addLog('대상 디스플레이 선택: ' + picked.name + ' (배율 ' + picked.scale + 'x)', 'ok');
    renderMonitors();
    renderReadout();
    renderControls();
  }

  function renderControls() {
    el.optProfile.checked = state.profileIsolated;
    el.optGpu.checked = state.withGpu;
    el.optKiosk.checked = state.kiosk;

    el.runBtn.disabled = state.selectedId === null || state.running;
    el.stopBtn.disabled = !state.running;

    if (state.running) {
      el.runHint.textContent = '세션이 실행 중입니다. 종료하려면 아래 세션 종료 버튼을 누르세요.';
    } else if (state.selectedId === null) {
      el.runHint.textContent = '먼저 대상 모니터를 선택하세요.';
    } else {
      el.runHint.textContent = '실행하면 창 좌표와 프로세스 트리가 예시로 표시됩니다.';
    }
  }

  function buildWindowRect(m) {
    var padX = Math.round(40 * m.scale);
    var padY = Math.round(40 * m.scale);
    var w = Math.round((m.w - padX * 2) / m.scale);
    var hgt = state.kiosk ? m.h : Math.round((m.h - padY * 2) / m.scale);
    return {
      x: Math.round(m.x / m.scale) + padX,
      y: Math.round(m.y / m.scale) + (state.kiosk ? 0 : padY),
      w: w,
      h: hgt,
      physical: { x: m.x + padX, y: m.y + (state.kiosk ? 0 : padY), w: w * m.scale, h: hgt * m.scale }
    };
  }

  function buildProcessTree(m) {
    var tree = [{ name: 'launcher', pid: 4800 + m.id, depth: 0 }];
    tree.push({ name: 'browser-main', pid: 4820 + m.id, depth: 1 });
    tree.push({ name: 'tab-renderer', pid: 4860 + m.id, depth: 2 });
    if (state.withGpu) {
      tree.push({ name: 'gpu-process', pid: 4870 + m.id, depth: 2 });
    }
    tree.push({ name: 'utility-network', pid: 4880 + m.id, depth: 2 });
    if (state.profileIsolated) {
      tree.push({ name: 'utility-storage', pid: 4890 + m.id, depth: 2 });
    }
    return tree;
  }

  function renderResult() {
    el.resultBox.textContent = '';
    if (!state.running) {
      el.resultBox.appendChild(h('p', 'readout-empty', '아직 실행 전입니다.'));
      return;
    }
    var m = selectedMonitor();
    var rect = state.windowRect;

    var pill = h('span', 'state-pill on', '세션 실행 중');
    el.resultBox.appendChild(pill);

    el.resultBox.appendChild(h('h4', null, '배치된 창'));
    var dl = h('dl', 'kv');
    function row(term, def) {
      dl.appendChild(h('dt', null, term));
      dl.appendChild(h('dd', null, def));
    }
    row('논리 좌표', rect.x + ', ' + rect.y);
    row('논리 크기', rect.w + ' x ' + rect.h);
    row('물리 픽셀', rect.physical.w + ' x ' + rect.physical.h);
    row('모드', state.kiosk ? '장식 제거' : '일반 창');
    row('임시 프로필', state.profileIsolated ? '격리 사용' : '공유 프로필');
    el.resultBox.appendChild(dl);

    el.resultBox.appendChild(h('h4', null, '프로세스 트리 (' + state.processTree.length + ')'));
    var ul = h('ul', 'tree');
    state.processTree.forEach(function (p) {
      var li = h('li', p.depth === 0 ? 'is-root' : null);
      li.style.paddingLeft = (0.5 + p.depth * 0.7) + 'rem';
      li.appendChild(h('span', null, p.name));
      li.appendChild(h('span', 'pid', 'PID ' + p.pid));
      ul.appendChild(li);
    });
    el.resultBox.appendChild(ul);
  }

  function startSession() {
    var m = selectedMonitor();
    if (!m || state.running) return;
    state.running = true;
    state.windowRect = buildWindowRect(m);
    state.processTree = buildProcessTree(m);

    addLog('브라우저 실행 파일 후보 검사', 'ok');
    addLog('임시 프로필 ' + (state.profileIsolated ? '생성' : '생략') + ' · 프로필 경로는 예시 값입니다.', state.profileIsolated ? 'ok' : 'warn');
    addLog('창 배치: 논리 (' + state.windowRect.x + ', ' + state.windowRect.y + ') 크기 ' + state.windowRect.w + 'x' + state.windowRect.h, 'ok');
    addLog('Job Object에 묶은 프로세스 ' + state.processTree.length + '개', 'ok');

    renderMonitors();
    renderReadout();
    renderControls();
    renderResult();
  }

  function stopSession(reason) {
    if (!state.running) return;
    var count = state.processTree.length;
    var profile = state.profileIsolated;
    state.running = false;
    state.windowRect = null;
    state.processTree = [];
    if (state.hotkey) {
      var key = state.hotkey;
      state.hotkey = null;
      el.hotkeyInput.value = '';
      setHotkeyState('세션 종료로 핫키도 해제했습니다.', 'bad');
      addLog('핫키 해제: ' + key, 'warn');
    }
    addLog((reason || '세션 종료 요청') + ' · 프로세스 ' + count + '개 회수', 'warn');
    addLog(profile ? '임시 프로필 폴더 삭제 (이 데모에서는 실제 삭제 없음)' : '임시 프로필 폴더 없음', 'warn');
    renderControls();
    renderResult();
  }

  var MOD_KEYS = [
    { name: 'Control', prop: 'ctrlKey', label: 'Ctrl' },
    { name: 'Alt', prop: 'altKey', label: 'Alt' },
    { name: 'Shift', prop: 'shiftKey', label: 'Shift' },
    { name: 'Meta', prop: 'metaKey', label: 'Win' }
  ];

  function prettyKey(e) {
    var code = e.key;
    if (code === ' ') return 'Space';
    if (code.length === 1) return code.toUpperCase();
    return code;
  }

  function setHotkeyState(text, cls) {
    el.hotkeyState.textContent = text;
    el.hotkeyState.className = 'hotkey-state' + (cls ? ' ' + cls : '');
  }

  el.hotkeyInput.addEventListener('keydown', function (e) {
    e.preventDefault();
    if (!state.running) {
      setHotkeyState('브라우저를 먼저 실행해야 핫키를 등록할 수 있습니다.', 'bad');
      return;
    }
    if (MOD_KEYS.some(function (m) { return e.key === m.name; })) return;
    if (e.key === 'Escape') {
      el.hotkeyInput.value = '';
      setHotkeyState('입력을 취소했습니다.', '');
      return;
    }
    var mods = MOD_KEYS.filter(function (m) { return e[m.prop]; });
    if (!mods.some(function (m) { return m.name === 'Control' || m.name === 'Alt'; })) {
      setHotkeyState('Ctrl 또는 Alt가 있어야 합니다.', 'bad');
      return;
    }
    var parts = mods.map(function (m) { return m.label; });
    parts.push(prettyKey(e));
    var combo = parts.join(' + ');
    state.hotkey = combo;
    el.hotkeyInput.value = combo;
    setHotkeyState('등록된 핫키: ' + combo, 'set');
    addLog('핫키 등록: ' + combo, 'ok');
  });

  el.hotkeyClear.addEventListener('click', function () {
    if (!state.hotkey) {
      setHotkeyState('등록된 핫키가 없습니다.', '');
      return;
    }
    var key = state.hotkey;
    state.hotkey = null;
    el.hotkeyInput.value = '';
    setHotkeyState('핫키를 해제했습니다.', '');
    addLog('핫키 해제: ' + key, 'warn');
  });

  el.runBtn.addEventListener('click', startSession);
  el.stopBtn.addEventListener('click', function () { stopSession('사용자가 세션을 종료했습니다.'); });

  function bindOption(input, key) {
    input.addEventListener('change', function () {
      state[key] = input.checked;
      if (state.running) {
        addLog('옵션 변경은 다음 실행부터 반영됩니다.', 'warn');
      }
    });
  }
  bindOption(el.optProfile, 'profileIsolated');
  bindOption(el.optGpu, 'withGpu');
  bindOption(el.optKiosk, 'kiosk');

  el.resetBtn.addEventListener('click', function () {
    var had = state.running || state.hotkey !== null || state.selectedId !== null;
    state = freshState();
    el.hotkeyInput.value = '';
    if (had) {
      addLog('데모 상태를 초기화했습니다.', 'warn');
    }
    renderMonitors();
    renderReadout();
    renderControls();
    renderResult();
    setHotkeyState('등록된 핫키가 없습니다.', '');
    renderLog();
  });

  renderMonitors();
  renderReadout();
  renderControls();
  renderResult();
  setHotkeyState('등록된 핫키가 없습니다.', '');
  renderLog();
})();
