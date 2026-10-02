"use strict";
const grid=document.querySelector('#grid'),status=document.querySelector('#status'),search=document.querySelector('#search'),filters=document.querySelector('#filters'),count=document.querySelector('#count');
let projects=[],selected='전체';
const styles={'업무 자동화':['#eef1ff','#243bed'],'웹 서비스':['#e8f4fa','#1e6489'],'개발 도구':['#f0edfa','#66539d'],'AI 활용':['#f3ecff','#7b43ad']};
const editorial={
  'booking':['예약과 입금 정산','예약·입금·대장용 명단을 연결합니다. 입금 기록이 바뀌면 미수 잔액과 그룹별 정산 상태가 함께 갱신됩니다.',['Next.js','TypeScript','Turso']],
  'ledger':['비용 분류와 장부 자동화','카드 내역을 규칙으로 분류하고, 중복 입력과 규칙 충돌을 확인합니다. 분류 결과가 장부 집계로 이어집니다.',['Python','SQLite','Apps Script']],
  'trip-planner':['AI 일정 설계와 상품 견적','생성 요청·검증·수정·버전 관리를 상품 견적까지 연결하는 흐름입니다. 실제 모델 호출은 시뮬레이션합니다.',['FastAPI','React','PostgreSQL']],
  'bus-seats':['일정 분석과 좌석 배정','붙여넣은 일정 문구를 구조화하고, 차량의 좌석을 배정합니다. 원문 입력과 운영 화면을 한 흐름으로 연결합니다.',['JavaScript','HTML','CSS']],
  'message-workflow':['메신저 업무 지시 처리','비정형 메시지를 업무 항목으로 정리하고 승인 후 라우팅하는 흐름입니다. 실제 메시지를 발송하지 않습니다.',['Python','SQLite','Android']],
  'insurance-workflow':['보험 명단 검증','가입 명단의 입력을 검증하고 민감정보를 가리는 업무 흐름입니다. 보험 가입과 외부 전송은 실행하지 않습니다.',['Python','FastAPI','Playwright']],
  'recruitment-workflow':['채용 기록과 평가 초안','면접 기록을 동기화하고 평가 초안으로 이어지는 과정을 체험합니다. 실제 지원자 정보는 포함하지 않습니다.',['Apps Script','GitHub API','Node.js']],
  'interview-workflow':['면접 녹취 기록 파이프라인','녹취에서 문서와 기록으로 이어지는 처리 흐름을 보여줍니다. 수집·변환·후속 작업의 단계를 확인할 수 있습니다.',['Apps Script','Gmail API','GitHub Actions']],
  'content-workflow':['카드뉴스 제작과 검수','콘텐츠 입력부터 카드 구성과 검수까지. 반복 제작의 단계를 나누고 결과물을 미리 확인합니다.',['JavaScript','Node.js','Chromium']],
  'operations':['운영 업무와 기한 관리','약속과 기한을 정리하고 브리핑과 산출물 미리보기로 연결합니다. 업무 기록을 다음 행동으로 이어주는 흐름입니다.',['Python','Playwright','Node.js']],
  'desktop-tools':['모니터와 프로세스 관리','모니터 좌표에 따른 창 배치와 프로세스 정리를 체험합니다. 실제 PC 제어 없이 조작 흐름을 시뮬레이션합니다.',['Python','Win32 API','PowerShell']],
  'inventory-scanner':['화면 기반 아이템 스캐너','슬롯 스캔·텍스트 분석·평가를 연결하고 변경된 슬롯만 재검사합니다. 캡처와 OCR은 합성 텍스트로 대체합니다.',['Python','OpenCV','OCR']],
  'flight-brief':['항공 정보와 결제 전 검증','메신저 문구의 항공 정보를 구조화하고 결제 전 확인 항목을 검사합니다. 최종 결제는 사람이 판단하는 경계를 남깁니다.',['Python','FastAPI','Docker']],
  'agent-workspace':['다중 에이전트 작업 관리','세션 진행과 권한 확인·위임을 한 화면으로 정리합니다. 외부 오픈소스의 연동·운영 개선 사례입니다.',['JavaScript','세션 관리','권한 흐름']],
  'document-workflow':['사건 자료 정리 컨셉','자료 분류·검토·초안 구성을 연결한 신규 컨셉입니다. 기존 자동화 제품의 구현 성과나 법률 판단을 뜻하지 않습니다.',['JavaScript','상태 관리','컨셉 데모']]
};
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function render(){
  const query=search.value.trim().toLowerCase();
  const shown=projects.filter(p=>(selected==='전체'||p.category===selected)&&[p.title,p.summary,p.category,...p.stack,...p.capabilities,...(editorial[p.slug]||[]).flat()].join(' ').toLowerCase().includes(query));
  grid.replaceChildren();count.textContent=`${shown.length} / ${projects.length}개 프로젝트`;status.textContent=shown.length?'':'검색 결과가 없습니다. 검색어 또는 분야를 바꿔주세요.';
  for(const p of shown){
    const [title,summary,stack]=editorial[p.slug]||[p.title,p.summary,p.stack.slice(0,4)];const card=el('article',undefined,'card');
    const [tint,accent]=styles[p.category]||styles['업무 자동화'];card.style.setProperty('--tint',tint);card.style.setProperty('--accent',accent);
    const content=el('div',undefined,'card-content');const top=el('div',undefined,'card-top');top.append(el('span',p.category,'category'),el('span',String(projects.indexOf(p)+1).padStart(2,'0'),'project-index'));content.append(top,el('h3',title),el('p',summary));
    const tags=el('div',undefined,'tags');for(const tag of stack)tags.append(el('span',tag,'tag'));content.append(tags);
    const bottom=el('div',undefined,'card-bottom');const label=p.slug==='document-workflow'?'가상 데이터 · 신규 컨셉':p.slug==='agent-workspace'?'가상 데이터 · 연동 사례':'가상 데이터 · 체험형 데모';
    bottom.append(el('span',label));const link=el('a','데모 체험하기');link.href=`demos/${p.slug}/`;link.setAttribute('aria-label',`${title} 데모 체험하기`);bottom.append(link);content.append(bottom);card.append(content);grid.append(card);
  }
}
async function init(){
  try{
    const response=await fetch('./projects.json',{cache:'no-cache'});if(!response.ok)throw Error('목록 응답 오류');projects=await response.json();if(!Array.isArray(projects))throw Error('목록 형식 오류');
    for(const category of ['전체',...new Set(projects.map(p=>p.category))]){const b=el('button',category);b.type='button';b.setAttribute('aria-pressed',String(category===selected));b.addEventListener('click',()=>{selected=category;for(const item of filters.children)item.setAttribute('aria-pressed',String(item===b));render();});filters.append(b);}render();
  }catch(error){count.textContent='목록을 불러오지 못했습니다';status.textContent='새로고침하거나 전체 프로젝트 목록을 이용해주세요.';const a=el('a','전체 프로젝트 목록 열기','button');a.href='./projects.html';grid.append(a);}
}
search.addEventListener('input',render);init();
