'use strict';

/* Paseo 로컬 연동 사례 데모 - 모든 데이터는 합성 데이터이며 외부 전송이 없다. */

var MODELS = {
  claude: ['Opus 계열 (시뮬레이션)', 'Sonnet 계열 (시뮬레이션)', 'Haiku 계열 (시뮬레이션)'],
  codex: ['고추출 모델 (시뮬레이션)', '균형 모델 (시뮬레이션)', '저비용 모델 (시뮬레이션)'],
  copilot: ['기본 모델 (시뮬레이션)', '심층 추론 모델 (시뮬레이션)'],
  opencode: ['균형 모델 (시뮬레이션)', '빠른 모델 (시뮬레이션)'],
  pi: ['기본 모델 (시뮬레이션)']
};

var PROVIDER_LABEL = {
  claude: 'Claude Code',
  codex: 'Codex',
  copilot: 'GitHub Copilot',
  opencode: 'OpenCode',
  pi: 'Pi'
};

/* 원본 문서(README.ko.md, docs/permissions.md)에서 확인한 권한 이름과 범위를 옮긴 설명용 표. */
var PERMISSIONS = [
  ['daemon.read', '데몬 상태, 진단, 설정, 제공자 정보 조회'],
  ['daemon.manage', '재시작, 업데이트, 설정 변경, 제공자·스킬·플러그인 관리'],
  ['tunnel.manage', '릴레이, 허브, 서비스 터널, 공개 엔드포인트 관계 관리'],
  ['access.manage', '페어링 초대, 주체, 자격 증명, 권한 부여와 폐기'],
  ['workspace.read', '프로젝트, 워크스페이스, 에이전트, 타임라인, 파일, diff, 터미널 출력 조회'],
  ['workspace.write', '지시, 에이전트 제어, 파일, 터미널, git 작업, 스크립트 실행'],
  ['workspace.manage', '프로젝트와 워크스페이스 생성, 이름 변경, 보관, 제거'],
  ['automation.manage', '일정, 하트비트, 반복 실행 관리']
];

/* 실행 단계 대본: 입력 문장의 키워드로 고른다. 어느 문장이든 기본 대본으로 동작한다. */
var SCENARIOS = [
  {
    match: /테스트|test/i,
    label: '테스트 보강 시나리오',
    slug: 'test-coverage',
    steps: [
      '워크스페이스 준비: 의존성 목록을 읽고 실행 명령을 파악했습니다.',
      '대상 모듈의 기존 테스트 구조를 확인했습니다.',
      { kind: 'perm', text: '테스트 파일 2개를 새로 만들려고 합니다. 허용할까요?', action: '파일 생성: src/api/order-list.test.ts' },
      '테스트를 추가하고 로컬에서 실행했습니다.',
      '실패한 케이스를 고쳐 통과시켰습니다.',
      { kind: 'ok', text: '검토 준비가 끝났습니다. 변경 파일 목록을 요약했습니다.' }
    ]
  },
  {
    match: /데이터베이스|DB|쿼리|마이그레이션/i,
    label: '데이터 처리 시나리오',
    slug: 'query-plan',
    steps: [
      '스키마 정의를 읽어 현재 테이블 구조를 파악했습니다.',
      '조회 구간을 실행해 슬로우 쿼리 후보를 좁혔습니다.',
      { kind: 'perm', text: '인덱스 생성을 위한 마이그레이션 파일 작성이 필요합니다. 허용할까요?', action: '명령 실행: 마이그레이션 생성' },
      '실행 계획이 달라지는지 비교 대조했습니다.',
      '실행 계획 비교 결과를 정리했습니다.'
    ]
  },
  {
    match: /API|성능|속도|응답|지연/i,
    label: '응답 시간 개선 시나리오',
    slug: 'api-latency',
    steps: [
      '대상 핸들러와 호출 경로를 따라가 봤습니다.',
      '느린 구간 후보를 두 곳 추려냈습니다.',
      { kind: 'perm', text: '캐시 계층 코드를 수정하려고 합니다. 허용할까요?', action: '파일 수정: src/api/orders.ts' },
      '배치 조회와 메모이제이션을 적용했습니다.',
      '합성 부하 테스트로 전후 수치를 비교했습니다(데모 값).',
      { kind: 'ok', text: '변경 내역을 정리했습니다. 실제 수치는 측정하지 않았습니다.' }
    ]
  }
];

var DEFAULT_SCENARIO = {
  label: '기본 시나리오',
  slug: 'general-task',
  steps: [
    '지시를 읽고 작업 범위를 정리했습니다.',
    '관련 파일을 찾아 현재 구현을 파악했습니다.',
    { kind: 'perm', text: '파일을 수정하려고 합니다. 허용할까요?', action: '파일 수정: 대상 파일' },
    '요청하신 변경을 적용했습니다.',
    { kind: 'ok', text: '변경 사항을 요약했습니다. 이 데모는 실행 결과가 없는 합성 대본입니다.' }
  ]
};

var FOLLOWUP = [
  '후속 지시를 확인했습니다.',
  { kind: 'perm', text: '추가 변경이 필요합니다. 허용할까요?', action: '추가 파일 수정' },
  '요청한 내용을 같은 세션에 이어서 적용했습니다.',
  { kind: 'ok', text: '후속 작업 요약을 덧붙였습니다(합성 데이터).' }
];

var SKILLS = {
  handoff: {
    title: 'handoff - 구현 위임',
    agent: '[위임] 응답 시간 개선',
    note: '새 에이전트는 맥락이 없는 상태로 시작하므로 브리핑이 필요합니다.',
    body: [
      ['작업', '주문 목록 API의 응답 시간을 줄이는 구현을 수행합니다.'],
      ['컨텍스트', '같은 기능의 요청 처리 흐름에서 느린 구간이 두 곳 확인된 상태입니다.'],
      ['관련 파일', 'src/api/orders.ts - 조회와 응답 조립을 담당하는 핸들러'],
      ['현재 상태', '실행 계획 비교까지 끝났고, 코드 변경은 아직 적용 전입니다.'],
      ['시도한 것', '쿼리 단일화 - 중복 조회가 남아 효과가 불확실해 중단'],
      ['결정', '워크트리 격리로 진행 - 기존 브랜치 상태를 건드리지 않기 위해'],
      ['수락 기준', '동일 입력에 대해 응답 조립 경로가 하나만 남는 것, 회귀 없음'],
      ['제약', '설정 파일과 자격 증명 파일은 수정하지 말 것']
    ]
  },
  advisor: {
    title: 'advisor - 둘째 의견',
    agent: '[자문] 인덱스 설계 검토',
    note: '작업은 넘기지 않고 검토만 맡깁니다.',
    body: [
      ['작업', '이미지를 직접 고치는 구현은 하지 말고, 설계안만 검토해 주세요.'],
      ['컨텍스트', '주문 목록 조회가 느리다는 보고가 있으며 현재 인덱스 구성을 검토 중입니다.'],
      ['관련 파일', 'docs/schema.sql - 현재 테이블과 인덱스 정의'],
      ['현재 상태', '실행 계획 비교 결과는 확인했고 인덱스 후보만 정리되지 않았습니다.'],
      ['결정', '작업 파일 수정은 금지'],
      ['수락 기준', '실행 계획을 개선하는지와 예상 부작용을 함께 설명할 것'],
      ['제약', '파일 수정 금지, 답변만']
    ]
  },
  committee: {
    title: 'committee - 위원회',
    agent: '[위원회 규모 확인]',
    note: '서로 다른 관점의 에이전트 두 명이 함께 근본 원인을 봅니다.',
    body: [
      ['작업', '느린 조회 문제를 두 관점에서 바라보고 원인과 개선 순서를 정리해 주세요.'],
      ['컨텍스트', '같은 증상이 환경마다 다르게 나타난다는 보고가 있습니다.'],
      ['관련 파일', 'docs/incident-2026-03.md - 증상 정리 문서'],
      ['현재 상태', '원인을 하나로 단정하지 못한 상태입니다.'],
      ['시도한 것', '단일 가설 검증 - 특정 인덱스만 가정해 다른 원인을 놓침'],
      ['결정', '가설을 나눠 각각 확인 후 비교'],
      ['수락 기준', '원인 후보와 확인 방법, 개선 순서가 함께 제시될 것'],
      ['제약', '확인되지 않은 수치를 결과처럼 쓰지 말 것']
    ]
  }
};

var el = {
  form: document.getElementById('launchForm'),
  provider: document.getElementById('provider'),
  model: document.getElementById('model'),
  isolation: document.getElementById('isolation'),
  prompt: document.getElementById('prompt'),
  runBtn: document.getElementById('runBtn'),
  formError: document.getElementById('formError'),
  stopBtn: document.getElementById('stopBtn'),
  sessionBadge: document.getElementById('sessionBadge'),
  timeline: document.getElementById('timeline'),
  streamEmpty: document.getElementById('streamEmpty'),
  followupBox: document.getElementById('followupBox'),
  followup: document.getElementById('followup'),
  sendBtn: document.getElementById('sendBtn'),
  agentList: document.getElementById('agentList'),
  trackEmpty: document.getElementById('trackEmpty'),
  briefing: document.getElementById('briefing'),
  briefingList: document.getElementById('briefingList'),
  closeBriefing: document.getElementById('closeBriefing'),
  permBody: document.getElementById('permBody'),
  resetBtn: document.getElementById('resetBtn')
};

var state = {
  seq: 0,
  session: null,
  followupTarget: null,
  queue: [],
  timer: null,
  waiting: false,
  clock: 0
};

function pad(n) { return n < 10 ? '0' + n : String(n); }

function stamp(offset) {
  var base = new Date(2026, 2, 18, 14, 32, 0);
  base.setSeconds(base.getSeconds() + (offset || 0));
  return pad(base.getHours()) + ':' + pad(base.getMinutes()) + ':' + pad(base.getSeconds());
}

function pickScenario(text) {
  for (var i = 0; i < SCENARIOS.length; i++) {
    if (SCENARIOS[i].match.test(text)) return SCENARIOS[i];
  }
  return DEFAULT_SCENARIO;
}

function shortId() {
  state.seq += 1;
  return 'a' + pad(state.seq) + String.fromCharCode(97 + (state.seq % 6)) + 'x';
}

function branchName(slug) {
  var safe = String(slug || 'general-task').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!safe) safe = 'general-task';
  return 'feat/' + safe.slice(0, 24) + '-' + state.seq;
}

function fillModels() {
  var list = MODELS[el.provider.value] || [];
  el.model.innerHTML = '';
  list.forEach(function (name) {
    var opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    el.model.appendChild(opt);
  });
}

function renderPermissions() {
  el.permBody.innerHTML = '';
  PERMISSIONS.forEach(function (row) {
    var tr = document.createElement('tr');
    var th = document.createElement('th');
    th.setAttribute('scope', 'row');
    var code = document.createElement('code');
    code.textContent = row[0];
    th.appendChild(code);
    var td = document.createElement('td');
    td.textContent = row[1];
    tr.appendChild(th);
    tr.appendChild(td);
    el.permBody.appendChild(tr);
  });
}

function setBadge(label, cls) {
  if (!label) {
    el.sessionBadge.hidden = true;
    el.sessionBadge.textContent = '';
    el.sessionBadge.className = 'badge';
    return;
  }
  el.sessionBadge.hidden = false;
  el.sessionBadge.textContent = label;
  el.sessionBadge.className = 'badge ' + cls;
}

function addLog(step, opts) {
  opts = opts || {};
  var li = document.createElement('li');
  var isPerm = typeof step === 'object' && step.kind === 'perm';
  var isOk = typeof step === 'object' && step.kind === 'ok';
  if (opts.denied) li.className = 'is-error';
  else if (isPerm) li.className = 'is-perm';
  else if (isOk) li.className = 'is-ok';

  var meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = stamp(state.clock);
  li.appendChild(meta);

  var text = document.createElement('div');
  text.textContent = isPerm ? step.text : (typeof step === 'string' ? step : step.text);
  li.appendChild(text);

  if (isPerm && !opts.resolved) {
    var row = document.createElement('div');
    row.className = 'perm-actions';

    var allow = document.createElement('button');
    allow.type = 'button';
    allow.className = 'btn btn-allow';
    allow.textContent = '허용';
    allow.addEventListener('click', function () { resolvePermission(true, li, step); });

    var deny = document.createElement('button');
    deny.type = 'button';
    deny.className = 'btn btn-deny';
    deny.textContent = '거절';
    deny.addEventListener('click', function () { resolvePermission(false, li, step); });

    row.appendChild(allow);
    row.appendChild(deny);
    li.appendChild(row);
  }

  el.timeline.appendChild(li);
}

function resolvePermission(allowed, li, step) {
  if (!state.session || state.session.status !== 'awaiting') return;
  state.waiting = false;

  var buttons = li.querySelector('.perm-actions');
  if (buttons) buttons.remove();

  var verdict = document.createElement('div');
  verdict.className = 'meta';
  verdict.textContent = '요청: ' + step.action + ' → ' + (allowed ? '허용' : '거절');
  li.appendChild(verdict);

  var session = state.session;
  if (allowed) {
    state.clock += 1;
    addLog('허용 확인을 받았습니다. 요청한 작업을 진행합니다.', { resolved: true });
  } else {
    li.className = 'is-error';
    state.clock += 1;
    addLog('권한이 거절되어 남은 단계를 중단했습니다. 작업은 대기 상태로 남습니다.', { resolved: true, denied: true });
    finish('blocked');
    return;
  }

  if (session.status === 'awaiting') session.status = 'running';
  el.stopBtn.hidden = false;
  setBadge('실행 중', 'badge-state-running');
  runQueue();
}

function pump() {
  if (!state.session || state.session.status === 'blocked' || state.session.status === 'idle') return;
  if (state.queue.length === 0) {
    finish(state.session.status === 'blocked' ? 'blocked' : 'idle');
    return;
  }
  var step = state.queue.shift();
  state.clock += 1;
  addLog(step);

  if (typeof step === 'object' && step.kind === 'perm') {
    state.session.status = 'awaiting';
    state.waiting = true;
    el.stopBtn.hidden = true;
    setBadge('권한 확인 대기', 'badge-state-pending');
    return;
  }
  state.timer = window.setTimeout(pump, 520);
}

function runQueue() {
  window.clearTimeout(state.timer);
  state.timer = window.setTimeout(pump, 260);
}

function finish(status, options) {
  options = options || {};
  window.clearTimeout(state.timer);
  state.timer = null;
  state.queue = [];
  state.waiting = false;
  if (!state.session) return;

  var session = state.session;
  session.status = status;
  el.stopBtn.hidden = true;

  if (status === 'blocked') {
    setBadge('중단됨', 'badge-state-blocked');
  } else if (status === 'stopped') {
    setBadge(options.silent ? '이전 세션 종료' : '중지 요청됨', 'badge-state-blocked');
    if (!options.silent) addLog('중지 요청을 받아 남은 단계를 종료했습니다.', { resolved: true, denied: true });
  } else {
    setBadge('완료', 'badge-state-idle');
  }

  var card = document.querySelector('[data-agent-id="' + session.id + '"]');
  if (card) {
    var badge = card.querySelector('.badge');
    if (badge) {
      badge.className = 'badge ' + (status === 'idle' ? 'badge-state-idle' : 'badge-state-blocked');
      badge.textContent = status === 'idle' ? '완료' : (status === 'blocked' ? '중단됨' : '중지됨');
    }
  }
  if (status === 'idle' || status === 'blocked') {
    state.followupTarget = session.id;
    el.followupBox.hidden = false;
  }
}

function addAgentCard(agent) {
  el.trackEmpty.hidden = true;
  var li = document.createElement('li');
  li.className = 'agent-item';
  li.setAttribute('data-agent-id', agent.id);

  var top = document.createElement('div');
  top.className = 'agent-top';

  var name = document.createElement('span');
  name.className = 'agent-name';
  name.textContent = agent.title;
  top.appendChild(name);

  var badge = document.createElement('span');
  badge.className = 'badge badge-state-running';
  badge.textContent = '실행 중';
  top.appendChild(badge);
  li.appendChild(top);

  var meta = document.createElement('p');
  meta.className = 'agent-meta';
  [
    ['에이전트 ID', agent.id],
    ['제공자 / 모델', PROVIDER_LABEL[agent.provider] + ' · ' + agent.model],
    ['격리', agent.isolation === 'worktree' ? '워크트리 (' + agent.branch + ')' : '로컬 폴더'],
    ['시나리오', agent.scenario]
  ].forEach(function (row) {
    var line = document.createElement('span');
    line.appendChild(document.createTextNode(row[0] + ': '));
    var code = document.createElement('code');
    code.textContent = row[1];
    line.appendChild(code);
    meta.appendChild(line);
  });
  li.appendChild(meta);

  el.agentList.appendChild(li);
}

function startRun(event) {
  if (event) event.preventDefault();
  var text = el.prompt.value.trim();
  if (!text) {
    el.formError.hidden = false;
    el.prompt.focus();
    return;
  }
  el.formError.hidden = true;

  if (state.session && (state.session.status === 'running' || state.session.status === 'awaiting')) {
    finish('stopped', { silent: true });
  }

  el.timeline.innerHTML = '';
  el.streamEmpty.hidden = true;
  el.followupBox.hidden = true;
  state.followupTarget = null;

  var scenario = pickScenario(text);
  var isolation = el.isolation.value;
  var session = {
    id: shortId(),
    title: text.length > 22 ? text.slice(0, 22) + '…' : text,
    provider: el.provider.value,
    model: el.model.value,
    isolation: isolation,
    branch: branchName(scenario.slug),
    scenario: scenario.label,
    status: 'running'
  };
  state.session = session;
  state.clock = 0;
  state.queue = scenario.steps.slice();

  addAgentCard(session);
  addLog('작업을 "' + session.title + '" 로 받았습니다. 합성 대본으로 재현합니다.');
  setBadge('실행 중', 'badge-state-running');
  el.stopBtn.hidden = false;
  el.runBtn.disabled = false;
  runQueue();
}

function sendFollowup() {
  var text = el.followup.value.trim();
  if (!state.session || state.followupTarget !== state.session.id) return;
  if (state.session.status === 'blocked' || state.session.status === 'stopped') {
    setBadge('중단됨', 'badge-state-blocked');
    el.followup.focus();
    return;
  }
  if (!text) { el.followup.focus(); return; }

  state.clock += 1;
  addLog('후속 지시를 받았습니다: ' + text);
  state.queue = state.queue.concat(FOLLOWUP);
  state.session.status = 'running';
  setBadge('실행 중', 'badge-state-running');
  el.followup.value = '';
  runQueue();
}

function renderBriefing(skillKey) {
  var skill = SKILLS[skillKey];
  var id = shortId();
  var agent = {
    id: id,
    title: skill.agent,
    provider: skillKey === 'advisor' ? 'codex' : (skillKey === 'committee' ? 'opencode' : 'claude'),
    model: MODELS[skillKey === 'advisor' ? 'codex' : (skillKey === 'committee' ? 'opencode' : 'claude')][0],
    isolation: skillKey === 'advisor' ? 'local' : 'worktree',
    branch: branchName('delegate'),
    scenario: skill.title
  };
  addAgentCard(agent);
  state.session = {
    id: id,
    title: agent.title,
    provider: agent.provider,
    model: agent.model,
    isolation: agent.isolation,
    branch: agent.branch,
    scenario: agent.scenario,
    status: 'idle'
  };
  setBadge('위임 준비됨', 'badge-state-idle');
  el.stopBtn.hidden = true;
  state.followupTarget = null;
  el.followupBox.hidden = true;

  el.briefing.hidden = false;
  el.briefingList.innerHTML = '';
  var pairs = [['스킬', skill.title]].concat(skill.body);
  pairs.push(['안내', skill.note]);
  pairs.forEach(function (pair) {
    var dt = document.createElement('dt');
    dt.textContent = pair[0];
    var dd = document.createElement('dd');
    dd.textContent = pair[1];
    el.briefingList.appendChild(dt);
    el.briefingList.appendChild(dd);
  });
}

function resetAll() {
  window.clearTimeout(state.timer);
  state.seq = 0;
  state.session = null;
  state.followupTarget = null;
  state.queue = [];
  state.timer = null;
  state.waiting = false;
  state.clock = 0;

  el.timeline.innerHTML = '';
  el.agentList.innerHTML = '';
  el.streamEmpty.hidden = false;
  el.trackEmpty.hidden = false;
  el.followupBox.hidden = true;
  el.followup.value = '';
  el.stopBtn.hidden = true;
  el.briefing.hidden = true;
  el.briefingList.innerHTML = '';
  el.formError.hidden = true;
  el.runBtn.disabled = false;
  setBadge(null);

  var chips = document.querySelectorAll('.btn-chip');
  for (var i = 0; i < chips.length; i++) chips[i].classList.remove('is-active');

  fillModels();
  el.prompt.value = '주문 목록 API의 응답 시간을 줄여 주세요.';
  el.prompt.focus();
}

el.provider.addEventListener('change', fillModels);
el.form.addEventListener('submit', startRun);
el.sendBtn.addEventListener('click', sendFollowup);
el.followup.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendFollowup();
  }
});
el.stopBtn.addEventListener('click', function () {
  if (state.session && (state.session.status === 'running' || state.session.status === 'awaiting')) {
    finish('stopped');
  }
});
el.resetBtn.addEventListener('click', resetAll);
el.closeBriefing.addEventListener('click', function () { el.briefing.hidden = true; });

var chips = document.querySelectorAll('.btn-chip');
for (var c = 0; c < chips.length; c++) {
  chips[c].addEventListener('click', function (e) {
    var key = e.currentTarget.getAttribute('data-skill');
    for (var i = 0; i < chips.length; i++) chips[i].classList.remove('is-active');
    e.currentTarget.classList.add('is-active');
    renderBriefing(key);
  });
}

renderPermissions();
fillModels();