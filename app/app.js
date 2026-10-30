// 골라봄 Step 0 — 네 모드: 최신 트렌드 · 리저브(전문가 추천) · 깊이 파기 · 내 토픽(당신이 주로 즐기는 영상들). 홈 한 화면에서 끝낸다.
// 원칙: 이력은 「내 토픽」의 출발점으로만 쓴다. 나머지 셋은 일부러 이력 밖에서 고른다.
// 질문은 영상까지 최대 2번. 데이터: data/topics.json · data/gen/(매일 자동 작업이 만든 영상 정보, 커밋 안 함)
import {CONFIG} from './config.js?v=20261031j';
import {hotKeywords} from './keywords.js?v=20261031j';
import {gallery, galleryIndex, galleryBand} from './gallery.js?v=20261031j';
import {omnibus} from './omnibus.js?v=20261031j';

const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ── 저장 (편의용 · 측정은 track 이 담당) ─────────────────────────
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('glb_' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('glb_' + k, JSON.stringify(v)); } catch {} },
};

// ── 테스터 코드: ?t=A 로 들어오면 기억한다 (이름은 저장하지 않음) ──────
const params = new URLSearchParams(location.search);
const SOURCE = params.get('src') || 'self';          // 리저브 링크로 온 날은 src=r → 재방문 판정에서 뺀다
if (/^[A-Z]$/.test(params.get('t') || '')) store.set('tester', params.get('t'));
let tester = store.get('tester', '');

// ── 방문 기록: 모드별로 남긴다(어떤 모드가 사람을 다시 오게 하는지 보려고) ──
function track(event, extra = '') {
  const row = {at: new Date().toISOString(), t: tester || '-', event, extra, src: SOURCE};
  const log = store.get('log', []); log.push(row); store.set('log', log.slice(-500));
  if (CONFIG.goatcounter) {
    const p = `/${row.t}/${event}${extra ? '/' + extra : ''}`;
    new Image().src = `${CONFIG.goatcounter}?p=${encodeURIComponent(p)}&t=${encodeURIComponent(SOURCE)}&e=true&rnd=${Math.random()}`;
  }
}

// ── 데이터 ─────────────────────────────────────────────────
const cache = {};
const load = path => (cache[path] ||= fetch(path, {cache: 'no-cache'}).then(r => (r.ok ? r.json() : null)).catch(() => null));
const DATA = await load('data/topics.json');
// 실제 데이터(gen/, 매일 자동 작업)가 없으면 커밋된 샘플(sample/)로 화면을 보여 준다
const GEN_META = await load('data/gen/meta.json');
const BASE = GEN_META ? 'data/gen' : 'data/sample';
const META = GEN_META || (await load('data/sample/meta.json')) || {sample: true, missing: true};
const TOPIC = Object.fromEntries(DATA.topics.map(t => [t.id, t]));
const FIELD = Object.fromEntries(DATA.deepFields.map(f => [f.id, f]));

// 내 토픽: 직접 고른 것 → 없으면 테스터 코드에 붙은 예시 → 없으면 비어 있음(첫 방문 고르기)
function myTopicIds() {
  const picked = store.get('mytopics', null);
  if (picked) return picked.filter(id => TOPIC[id]);
  return DATA.testers[tester] || [];
}
const myTopics = () => myTopicIds().map(id => TOPIC[id]);
async function issuesFor(t) {
  const out = [];
  for (let v = 1; v <= 52; v++) { const i = await load(`${BASE}/reserve/${t}-${v}.json`); if (!i) break; out.push(i); }
  return out;
}

// 업데이트 시각: 「오후 2:05 · 12분 전」(보는 사람의 시간대)
const agoText = iso => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 6e4)); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`; };
const whenText = iso => new Date(iso).toLocaleString('ko-KR', {month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit'}) + ' · ' + agoText(iso);
function sampleNote(extra = '') {
  if (!META.sample && !DATA.example) return '';
  const why = META.missing
    ? '영상 데이터가 아직 없습니다. <code>python3 tools/fetch_videos.py --sample</code> 로 자리 데이터를 만드세요.'
    : META.sample ? '지금은 <b>샘플 화면</b>입니다. YouTube API 키를 등록하면 매일 실제 영상으로 바뀝니다.' : '';
  const ex = DATA.example ? ' 토픽과 리저브 내용은 인터뷰 전 예시입니다.' : '';
  return `<div class="sample"><span>🧪</span><span>${why}${ex}${extra}</span></div>`;
}
const bar = (back) => `<div class="bar">${back ? `<a class="back" href="${back}">← 골라봄</a>` : '<a class="logo" href="#/home">골라<b>봄</b></a>'}${tester ? `<span class="who">테스터 ${esc(tester)}</span>` : ''}</div>`;
const light = () => document.body.classList.remove('rx', 'gx', 'fr');

// ── 홈: 한 화면에서 끝낸다(두 번째 페이지로 넘어가지 않음) ─────────────────
//   첫 화면은 Google 처럼 로고·검색창·지금 뜨는 말만. 아래로 내리면
//   ① 지금 뜨는 키워드 → 영상 · ② 리저브 5편 · ③ 깊이 파기(키워드) · ④ 당신이 주로 즐기는 영상들
const HOME = {q: '', kw: '', country: 'KR', deepKw: '', topic: '', editTopics: false};
// 검색 버튼은 두 단이다.
//   ① 다시 찾는 조건 — 검색문(-뺄 말 · "꼭 들어갈 말")과 YouTube 검색 조건(길이·시기·자막)으로 조립해 새로 찾는다.
//      사람은 정교한 검색어를 못 쓰니, 버튼이 대신 「한 줄의 완성된 검색문」을 만든다. 그 검색문을 화면에 보여 준다.
//   ② 결과 안에서 고르기 — 받아 둔 50편 안에서 세부 주제·자극적 제목·순서로 고른다(API 추가 없음).
// 검색은 「검색문 한 줄(line) + YouTube 필터」로 한다. line 은 버튼이 고치고, 사용자도 직접 고쳐 쓸 수 있다.
const QKEYS = ['line', 'dur', 'after', 'cap', 'def', 'lang', 'order'];
let GUIDE = {line: '', kind: '', aud: [], add: [], must: '', not: [], notText: '', dur: 'any', after: 'any', cap: false, def: 'any', lang: 'ko', order: 'rel', topic: '', bait: false, sort: 'rel'};
// 세부 주제에서 종류 말(추천·비교·후기…)을 걸러 낼 때 쓴다
const TYPES = [
  ['review', '후기·리뷰', /후기|리뷰|review|사용기|써보|써 본|솔직/i],
  ['compare', '비교', /비교|\bvs\b|versus|차이|대결/i],
  ['rank', '추천·순위', /추천|\btop ?\d|best|순위|랭킹|베스트/i],
  ['howto', '설명·강의', /설명|강의|강좌|방법|하는 ?법|배우|가이드|팁|기초|입문|tutorial|how to/i],
  ['vlog', '브이로그', /브이로그|vlog|일상|하루|캠핑장/i],
  ['news', '뉴스·시사', /뉴스|속보|단독|발언|논란|의혹|특검|대통령|국회|정치/i],
  ['music', '공연·음악', /\bmv\b|m\/v|music video|뮤직비디오|무대|커버|cover|노래|official audio|lyrics/i],   // 라이브·live 는 뉴스 방송에도 쓰여서 뺐다
  ['trailer', '예고편', /예고편|trailer|티저|teaser/i],
];
let FACET = {topics: []};      // 지금 결과에서 뽑은 세부 주제(hotKeywords 결과)
// 고르는 중인 조건. 버튼은 DRAFT 만 바꾸고, [새로 찾기]/[적용하기] 를 누르면 GUIDE(결과에 쓰는 조건)로 넘어간다.
let DRAFT = null;
const GUIDE0 = {line: '', kind: '', aud: [], add: [], must: '', not: [], notText: '', dur: 'any', after: 'any', cap: false, def: 'any', lang: 'ko', order: 'rel', topic: '', bait: false, sort: 'rel'};
const clone = g => ({...g, not: [...g.not], aud: [...g.aud], add: [...g.add]});
const sameGuide = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameQuery = (a, b) => QKEYS.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
// 종류 말은 YouTube 의 「또는」(|) 묶음으로 넓혀 넣는다 — 「후기」 하나보다 주제에서 벗어난 영상이 절반 이하로 줄었다(10-30 실측 20→9편/50)
const KIND = [['', '전체', []], ['후기', '후기', ['후기', '리뷰', '사용기', '내돈내산']], ['비교', '비교', ['비교', 'vs', '차이']],
  ['추천', '추천', ['추천', '순위', 'TOP']], ['방법', '방법·설명', ['방법', '하는법', '설명', '가이드']], ['입문', '입문', ['입문', '초보', '기초']],
  ['브이로그', '브이로그', ['브이로그', 'vlog']], ['장단점', '장단점', ['장단점', '단점', '솔직']], ['실수', '실수·주의', ['실수', '주의', '하지마세요']],
  ['꿀팁', '꿀팁', ['꿀팁', '팁', '노하우']], ['실험', '실험·테스트', ['실험', '테스트']], ['언박싱', '언박싱', ['언박싱', '개봉기']],
  ['인터뷰', '인터뷰', ['인터뷰', '대담']], ['다큐', '다큐', ['다큐', '다큐멘터리']], ['강의', '강의 전체', ['풀강의', '강의', '강좌']], ['qna', 'Q&A', ['Q&A', '질문', '궁금증']]];
// 대상·수준: 여러 개 고를 수 있고, 고른 것마다 「또는」 묶음 하나가 검색문에 들어간다
const AUD = [['beginner', '초보', ['초보자', '왕초보']], ['middle', '중급', ['중급']], ['expert', '전문가', ['전문가', '고수', '프로']],
  ['kids', '아이와 함께', ['아이와', '아이랑', '가족']], ['solo', '혼자', ['혼자', '1인', '솔로']], ['cheap', '가성비', ['가성비', '저렴한']], ['premium', '고급', ['고급', '프리미엄', '하이엔드']]];
const NOTS = [['reaction', '리액션', ['리액션', '반응', 'reaction']], ['compile', '짜깁기', ['몰아보기', '모음', '요약', '총정리']], ['kids', '키즈', ['키즈', '어린이', 'kids']]];
// 길이·기간·자막은 YouTube 가 검색어 글자로는 못 알아듣는다. 그래서 검색문에는 「길이:4~20분」 같은 골라봄 표기로 넣고,
// 검색할 때 골라봄이 읽어서 YouTube 검색 필터(videoDuration·publishedAfter·videoCaption)로 바꿔 보낸다. 마지막 칸 = 검색문 표기.
const DUR = [['any', '상관없음', 0, Infinity, ''], ['short', '4분 안쪽', 0, 240, '4분안쪽'], ['medium', '4~20분', 240, 1200, '4~20분'], ['long', '20분 넘게', 1200, Infinity, '20분넘게']];
const AFTER = [['any', '전체', Infinity, ''], ['week', '이번 주', 7, '이번주'], ['month', '최근 한 달', 31, '최근한달'], ['year', '1년 안', 365, '1년안']];
// 화질(videoDefinition · 4K 는 HD 필터 + 검색어 「4K」) · 언어(relevanceLanguage·regionCode) · 순서(YouTube 가 그 순서로 골라 줌)
const DEF = [['any', '상관없음', ''], ['hd', 'HD 이상', 'HD'], ['4k', '4K', '4K']];
const LANG = [['ko', '한국어', '한국어'], ['en', '영어', '영어'], ['ja', '일본어', '일본어']];
const ORDER = [['rel', '관련순', ''], ['date', '최신', '최신'], ['viewCount', '조회수', '조회수'], ['rating', '평점', '평점']];
const BAIT = ['충격', '경악', '소름', '레전드', '실화냐', '난리', '미쳤다', 'ㄷㄷ'];
const SORT = [['rel', '관련순'], ['like', '만족도'], ['new', '최신'], ['views', '조회수']];
const notWords = G => [...new Set([...NOTS.filter(n => G.not.includes(n[0])).flatMap(n => n[2]),
  ...G.notText.split(/[\s,]+/).map(w => w.replace(/^-+/, '')).filter(Boolean)])];
// 버튼으로 고른 것을 YouTube 가 알아듣는 한 줄로: 검색어 + 종류 말(|로 넓힘) + "꼭 들어갈 말" + -뺄 말. 이 줄 그대로 YouTube 에 검색한다.
const composeQ = G => [HOME.q, (KIND.find(k => k[0] === G.kind)?.[2] || []).join('|'), ...AUD.filter(a => G.aud.includes(a[0])).map(a => a[2].join('|')), ...G.add, G.must.trim() ? `"${G.must.trim().replace(/"/g, '')}"` : '', ...notWords(G).map(w => '-' + w),
  G.dur !== 'any' ? '길이:' + DUR.find(d => d[0] === G.dur)[4] : '', G.after !== 'any' ? '기간:' + AFTER.find(a => a[0] === G.after)[3] : '', G.cap ? '자막:있음' : '',
  G.def !== 'any' ? '화질:' + DEF.find(d => d[0] === G.def)[2] : '', G.lang !== 'ko' ? '언어:' + LANG.find(l => l[0] === G.lang)[2] : '', G.order !== 'rel' ? '순서:' + ORDER.find(o => o[0] === G.order)[2] : ''].filter(Boolean).join(' ');
// 검색문을 「YouTube 에 보낼 글자」와 「필터」로 나눈다. 모르는 표기(예: 길이:3분)는 필터로 쓰지 않고 버린다.
function parseLine(line) {
  const out = {q: [], dur: 'any', after: 'any', cap: false, def: 'any', lang: 'ko', order: 'rel'};
  const pick = (list, col, v, cur) => list.find(x => x[col] && x[col].toLowerCase() === v.toLowerCase())?.[0] || cur;
  for (const t of qTokens(line)) {
    const m = /^(길이|기간|자막|화질|언어|순서):(.+)$/.exec(t);
    if (!m) { out.q.push(t); continue; }
    if (m[1] === '길이') out.dur = pick(DUR, 4, m[2], out.dur);
    else if (m[1] === '기간') out.after = pick(AFTER, 3, m[2], out.after);
    else if (m[1] === '자막') out.cap = m[2] === '있음';
    else if (m[1] === '화질') out.def = pick(DEF, 2, m[2], out.def);
    else if (m[1] === '언어') out.lang = pick(LANG, 2, m[2], out.lang);
    else out.order = pick(ORDER, 2, m[2], out.order);
  }
  return {...out, q: out.q.join(' ')};
}
const syncFilters = G => { const p = parseLine(G.line); for (const k of ['dur', 'after', 'cap', 'def', 'lang', 'order']) G[k] = p[k]; };
// 버튼이 넣은 조각만 바꾼다: 예전 자동 조각(a)에만 있던 말은 빼고, 새 자동 조각(b)에만 있는 말은 그 자리에 넣는다.
// 사용자가 직접 쓴 말은 건드리지 않는다.
const qTokens = t => t.match(/"[^"]*"|\S+/g) || [];
function patchLine(line, a, b) {
  const A = qTokens(a), B = qTokens(b), L = qTokens(line);
  let at = -1;
  for (const t of A.filter(t => !B.includes(t))) { const i = L.indexOf(t); if (i >= 0) { L.splice(i, 1); if (at < 0 || i < at) at = i; } }
  const add = B.filter(t => !A.includes(t) && !L.includes(t));
  if (at >= 0) L.splice(at, 0, ...add); else L.push(...add);
  return L.join(' ');
}
// Worker 가 없을 때(모아 둔 영상에서 찾을 때)는 같은 조건을 브라우저에서 건다
function localQuery(vids, G) {
  const [, , lo, hi] = DUR.find(d => d[0] === G.dur), days = AFTER.find(a => a[0] === G.after)[2], nots = notWords(G), must = G.must.trim().toLowerCase();
  return vids.filter(v => v.sec > lo && v.sec <= hi && (!v.published || (Date.now() - Date.parse(v.published)) / 864e5 <= days)
    && (!G.cap || v.caption) && !nots.some(w => v.title.toLowerCase().includes(w.toLowerCase())) && (!must || v.title.toLowerCase().includes(must)));
}
function guided(vids, G = GUIDE) {
  const topicIds = G.topic ? new Set(FACET.topics.find(t => t.kw === G.topic)?.ids || []) : null;
  const out = vids.filter(v => !(G.bait && BAIT.some(w => v.title.toLowerCase().includes(w))) && (!topicIds || topicIds.has(v.id || v.title)));
  const by = {rel: (a, b) => (a.rel ?? 999) - (b.rel ?? 999), like: (a, b) => (b.likeRatio || 0) - (a.likeRatio || 0),
    new: (a, b) => (b.published || '').localeCompare(a.published || ''), views: (a, b) => (b.views || 0) - (a.views || 0)}[G.sort];
  return G.sort === 'rel' && out.every(v => v.rel === undefined) ? out : [...out].sort(by);
}

// ── 첫 화면(문): 알고리즘에 맡긴 시간을 돌아보게 하고, 눈을 감고 5초 생각한 뒤 적게 한다 ──────
//   적은 말은 그대로 홈(#/home)의 검색으로 넘어간다. 기존 홈의 기능은 그대로 둔다.
function front() {
  light();
  document.body.classList.add('fr');
  app.innerHTML = `
  <section class="front" id="front">
    <a class="logo-big" href="#/">골라<b>봄</b></a>
    <div class="frmsg">
      <p>쇼츠와 피드를 넘기다 몇 시간이 지나고,<br>무엇을 봤는지 하나도 기억나지 않던 밤이 있지 않나요?</p>
      <p class="frwarn">알고리즘에게 내 선택을 내주지 마세요.</p>
      <p>수백억 편의 영상 더미는 이제 그만.<br>유한한 내 인생을 의미 있게 해 줄 영상을 봅시다.</p>
    </div>
    <div class="frask" id="frAsk">
      <p class="frq">당신이 정말 관심 있던 것은 무엇이었나요?</p>
      <button type="button" class="frbtn" id="frClose">눈 감고 5초만 생각해 보기</button>
      <button type="button" class="frskip" id="frSkip">바로 적을게요</button>
    </div>
    <div class="frcount" id="frCount" hidden><b id="frN">5</b><span>눈을 감고, 정말 보고 싶었던 것을 떠올려 보세요</span></div>
    <form class="frform" id="frForm" hidden>
      <p class="frq">이제 적어 보세요.</p>
      <div class="bigsearch"><input id="frQ" type="search" placeholder="예) 혼자 사는 할머니의 하루, 바다 밑의 소리" autocomplete="off" aria-label="보고 싶었던 것">
      <button type="submit">찾아 주세요</button></div>
      <p class="frsub">우리가 찾아 드릴게요. 당신이 진정 보고 싶었던 것을.</p>
    </form>
    <nav class="frnav"><a href="#/g">명작 갤러리로</a><a href="#/home">골라봄 둘러보기</a></nav>
  </section>`;
  const showForm = () => { $('#frAsk').hidden = true; $('#frCount').hidden = true; $('#frForm').hidden = false; $('#frQ').focus(); };
  $('#frSkip').onclick = () => { track('front-skip'); showForm(); };
  $('#frClose').onclick = () => {
    track('front-close-eyes');
    $('#frAsk').hidden = true; $('#frCount').hidden = false; $('#front').classList.add('dim');
    let n = 5;
    const tick = setInterval(() => {
      n -= 1;
      if (n > 0) { $('#frN').textContent = n; return; }
      clearInterval(tick); $('#front').classList.remove('dim'); showForm();
    }, 1000);
  };
  $('#frForm').onsubmit = e => {
    e.preventDefault();
    const q = $('#frQ').value.trim();
    if (!q) return $('#frQ').focus();
    track('search', 'front:' + q);
    GUIDE = clone(GUIDE0); DRAFT = null; HOME.q = q;
    location.hash = '#/home';
  };
}

async function home() {
  light();
  const mine = myTopics();
  if (!HOME.topic || !mine.some(t => t.id === HOME.topic)) HOME.topic = mine[0]?.id || '';
  // 지금 뜨는 영상: Worker 가 1시간마다 채운 것(/trends)이 더 새로우면 그것을, 아니면 Pages 의 파일을 쓴다
  const [fileTrends, issues, deepAll, live] = await Promise.all([
    Promise.all(DATA.trendCategories.map(c => load(`${BASE}/trend/${c.id}.json`))),
    tester ? issuesFor(tester) : [],
    Promise.all(DATA.deepFields.map(f => load(`${BASE}/deep/${f.id}.json`))),
    CONFIG.searchApi ? load(`${CONFIG.searchApi}/trends`) : null,
  ]);
  const useLive = live?.trendAt && live.trendAt > (META.trendAt || '');
  const trendAll = useLive ? DATA.trendCategories.map(c => live.kr[c.id]) : fileTrends;
  // 트렌드: 분야를 합쳐 중복을 빼고, 「전체」 순서를 앞에 둔다
  const seen = new Set();
  const trendPool = trendAll.flatMap(d => d?.videos || []).filter(v => { const k = v.id || v.title; return !seen.has(k) && seen.add(k); });
  const hot = hotKeywords(trendPool, 15);
  // 나라별 지금 뜨는 영상(한국은 위의 분야 합본). 1시간마다 새로 받는다.
  const countries = DATA.trendCountries || [{id: 'KR', name: '한국', flag: '🇰🇷'}];
  const cPools = {KR: trendPool};
  await Promise.all(countries.filter(c => c.id !== 'KR').map(async c => {
    cPools[c.id] = (useLive ? live.countries[c.id] : await load(`${BASE}/trend/country-${c.id}.json`))?.videos || [];
  }));
  const cHot = Object.fromEntries(countries.map(c => [c.id, c.id === 'KR' ? hot : hotKeywords(cPools[c.id], 15)]));
  // 🌐 글로벌: 모든 나라(한국 포함)의 영상을 합쳐 「여러 나라에서 함께 뜨는 말」을 뽑는다. 뜬 나라 수가 많은 말부터.
  const where = new Map();                       // 영상 → 그 영상이 뜬 나라들
  for (const c of countries) for (const v of cPools[c.id] || []) { const k = v.id || v.title; if (!where.has(k)) where.set(k, new Set()); where.get(k).add(c.id); }
  const nations = ids => new Set(ids.flatMap(id => [...(where.get(id) || [])])).size;
  const gSeen = new Set();
  cPools.GLOBAL = countries.flatMap(c => cPools[c.id] || []).filter(v => { const k = v.id || v.title; return !gSeen.has(k) && gSeen.add(k); })
    .sort((a, b) => where.get(b.id || b.title).size - where.get(a.id || a.title).size || (b.views || 0) - (a.views || 0));
  cHot.GLOBAL = hotKeywords(cPools.GLOBAL, 80).map(h => ({...h, nations: nations(h.ids)})).filter(h => h.nations >= 2)
    .sort((a, b) => b.nations - a.nations || b.channels - a.channels).slice(0, 15);
  const hotTabs = [countries[0], {id: 'GLOBAL', name: '글로벌', flag: '🌐'}, ...countries.slice(1)];
  if (!hotTabs.some(c => c.id === HOME.country) || !cPools[HOME.country]?.length) HOME.country = 'KR';
  const updated = useLive ? live.trendAt : (META.trendAt || META.generatedAt);
  const latest = issues.at(-1);
  app.innerHTML = `
  <div class="wrap">
    ${tester ? `<span class="who float">테스터 ${esc(tester)}</span>` : ''}
    <section class="hero${HOME.q ? ' searched' : ''}" id="hero">
      <a class="logo-big" href="#/home" id="logoBig">골라<b>봄</b></a>
      <p class="tag-line">추천에 끌려가지 말고, 골라서 보세요</p>
      <form class="bigsearch" id="qForm" role="search">
        <span class="ic" aria-hidden="true">⌕</span>
        <input id="q" type="search" placeholder="무엇이 궁금하세요?" value="${esc(HOME.q)}" aria-label="영상 찾기" autocomplete="off">
        <button type="submit">골라 보기</button>
      </form>
      <div class="hotline" id="hotLine"></div>
      <nav class="jump"><a href="#/g">🖼 명작 갤러리</a><a href="#hotSec">🔥 지금 뜨는</a>${latest ? `<a href="#rxSec">✦ RESERVE Vol.${latest.vol}</a>` : ''}<a href="#deepSec">🔭 깊이 파기</a><a href="#mySec">내가 즐기는 영상</a></nav>
      <div class="scrollcue" aria-hidden="true">아래로 내리면 오늘의 영상 ↓</div>
    </section>
    <section class="hs" id="qSec" hidden></section>
    <section class="hs gxband" id="gxSec"></section>

    <section class="hs" id="hotSec">
      <div class="sec">🔥 지금 뜨는 키워드 <small>여러 채널이 함께 이야기하는 말 · 쇼츠·자극적 제목은 뺐어요</small>${updated ? `<span class="upd">최종 업데이트 ${esc(whenText(updated))}</span>` : ''}</div>
      <div class="ctabs" id="cTabs"></div>
      <div class="chips scroll" id="hotChips"></div>
      <div class="rowlist" id="hotList"></div>
    </section>

    ${latest ? `<section class="hs rxband" id="rxSec"></section>` : `
    <section class="hs rxband off">
      <div class="rxhead"><span class="rk">GOLABOM RESERVE</span><span class="rsub">큐레이터가 고른 숨은 명작 5편이 매주 월요일 도착해요 · 지금은 초대받은 테스터에게만 보내고 있어요</span></div>
    </section>`}

    <section class="hs" id="deepSec">
      <div class="sec">🔭 깊이 파기 <small>조회수 말고, 본 사람이 만족한 영상만</small></div>
      <div class="chips scroll" id="deepChips"></div>
      <div class="rowlist" id="deepList"></div>
    </section>

    <section class="hs" id="mySec">
      <div class="sec">당신이 주로 즐기는 영상들 <button class="more" id="editTopics">${HOME.editTopics ? '다 골랐어요' : '토픽 고치기'}</button></div>
      <div id="topicBox"></div>
    </section>

    ${sampleNote()}
    <div class="foot"><span>골라봄 Step 0 · 테스트 중</span><a href="../">예전 링크 검색기(Phase 0)</a></div>
  </div>`;

  // 명작 갤러리 띠(검색 바로 아래 · 명품관 입구)
  galleryBand($('#gxSec'), {esc, load});

  // ① 지금 뜨는 키워드
  const drawHot = () => {
    const pool = cPools[HOME.country], words = cHot[HOME.country];
    const chosen = words.find(h => h.kw === HOME.kw);
    const vids = (chosen ? pool.filter(v => chosen.ids.includes(v.id || v.title)) : pool).slice(0, 8);
    $('#cTabs').innerHTML = hotTabs.filter(c => cPools[c.id]?.length).map(c =>
      `<button class="ctab" data-cc="${c.id}" aria-pressed="${c.id === HOME.country}">${c.flag} ${esc(c.name)}</button>`).join('');
    $('#cTabs').querySelectorAll('[data-cc]').forEach(b => b.onclick = () => { HOME.country = b.dataset.cc; HOME.kw = ''; track('mode-trend', 'country:' + HOME.country); drawHot(); });
    $('#hotChips').innerHTML = [{kw: '', label: '전체'}, ...words.map(h => ({kw: h.kw, label: `${esc(h.kw)} <small>${h.nations ? h.nations + '개국' : h.channels}</small>`}))]
      .map(c => `<button class="chip" data-kw="${esc(c.kw)}" aria-pressed="${c.kw === HOME.kw}">${c.label}</button>`).join('');
    $('#hotList').innerHTML = rowCards(vids, '🔥', 'trend');
    bindRow('#hotList', vids, '🔥', 'trend', drawHot);
    $('#hotChips').querySelectorAll('[data-kw]').forEach(b => b.onclick = () => { HOME.kw = b.dataset.kw; track('mode-trend', 'kw:' + HOME.kw); drawHot(); });
  };
  drawHot();

  // ② 리저브: 표지 없이 바로 5편
  if (latest) {
    const rx = store.get('rx', {});
    const picks = latest.picks.map(p => ({...p.video, ...p, title: p.video?.title || '(영상 정보 없음)'}));
    const drawRx = () => {
      $('#rxSec').innerHTML = `
        <div class="rxhead"><span class="rk">GOLABOM RESERVE</span><span class="rvol">Vol.${latest.vol}</span>
          <span class="rsub">큐레이터가 고른 숨은 명작 5편 · ${esc(latest.week)}</span></div>
        <div class="rowlist rx">${picks.map((p, i) => {
          const key = `${tester}-${latest.vol}-${i}`;
          return `<article class="rc">
            <button class="thb" data-play="${i}" aria-label="재생">${thumbInner({...p, sec: p.sec || 0}, '✦')}</button>
            <div class="no">No.${String(i + 1).padStart(2, '0')}</div>
            <button class="ititle" data-play="${i}">${esc(p.title)}</button>
            ${p.hidden ? `<div class="hidden">${esc(p.hidden)}</div>` : ''}
            <p class="cm">“${esc(p.comment)}”</p>
            <div class="react">${[['good', '좋았어요'], ['so', '그저 그래요'], ['skip', '안 볼래요']].map(([v, l]) =>
              `<button data-rx="${key}|${v}" aria-pressed="${rx[key] === v}">${l}</button>`).join('')}</div>
          </article>`;
        }).join('')}</div>
        <div class="rxfoot"><span>— ${esc(CONFIG.curator)}</span><span>다음 호 · ${esc(latest.next)}</span></div>`;
      $('#rxSec').querySelectorAll('[data-play]').forEach(b => b.onclick = () => { track('mode-reserve', 'play'); play(picks, +b.dataset.play, '✦'); });
      $('#rxSec').querySelectorAll('[data-rx]').forEach(b => b.onclick = () => {
        const [key, v] = b.dataset.rx.split('|');
        rx[key] = rx[key] === v ? undefined : v; store.set('rx', rx); track('rx-' + (rx[key] || 'clear'), key); drawRx();
      });
    };
    drawRx();
    store.set('seenIssue', Math.max(store.get('seenIssue', 0), latest.vol));
  }

  // ③ 깊이 파기: 검색어(모아 둔 영상 안에서) 또는 키워드 칩
  // 구독자 100만 넘는 큰 채널은 「숨은」 보석이 아니라서 뺀다(자동 작업도 같은 기준 · 예전 데이터 대비)
  const small = v => !(v.subs > CONFIG.bigChannel);
  const deepByKw = Object.fromEntries(deepAll.flatMap(d => Object.entries(d?.byKeyword || {}).map(([k, vs]) => [k, vs.filter(small)])));
  const deepTop = deepAll.flatMap(d => (d?.all || []).filter(small)).sort((a, b) => (b.gem || 0) - (a.gem || 0));
  const kwChips = DATA.deepFields.flatMap(f => f.keywords.map(k => ({k, e: f.emoji})));
  const drawDeep = () => {
    const vids = (HOME.deepKw ? deepByKw[HOME.deepKw] || [] : deepTop).slice(0, 8);
    $('#deepChips').innerHTML = [{k: '', e: '💎', label: '오늘의 보석'}, ...kwChips]
      .map(c => `<button class="chip" data-dk="${esc(c.k)}" aria-pressed="${c.k === HOME.deepKw}">${c.e} ${esc(c.label || c.k)}</button>`).join('');
    $('#deepList').innerHTML = vids.length ? rowCards(vids, '🔭', 'deep') : '<div class="empty">이 키워드의 영상은 내일 아침에 채워져요.</div>';
    bindRow('#deepList', vids, '🔭', 'deep', drawDeep);
    $('#deepChips').querySelectorAll('[data-dk]').forEach(b => b.onclick = () => { HOME.deepKw = b.dataset.dk; track('mode-deep', 'kw:' + HOME.deepKw); drawDeep(); });
  };
  drawDeep();

  // ⓪ 첫 화면 검색: Worker 가 있으면 YouTube 전체에서(한 번에 50편), 없으면 골라봄이 모아 둔 영상에서.
  //    결과를 먼저 보여 주고, 위의 버튼으로 좁힌다. 「어떤 영상」만 새로 찾고 나머지는 받아 둔 50편 안에서 거른다.
  const rxPicks = (latest?.picks || []).map(p => p.video && p.video.id ? {...p.video, reason: '✦ RESERVE · ' + (p.hidden || '')} : null).filter(Boolean);
  let got = {videos: [], removed: {}, live: false, msg: '', q: ''};
  const fetchResults = async () => {
    const P = parseLine(GUIDE.line || HOME.q);
    got = {videos: [], removed: {}, live: false, msg: '', q: P.q};
    if (CONFIG.searchApi) {
      try {
        const r = await fetch(`${CONFIG.searchApi}/search?` + new URLSearchParams({q: P.def === '4k' && !/\b4k\b/i.test(got.q) ? got.q + ' 4K' : got.q, dur: P.dur, after: P.after, cap: P.cap ? '1' : '0',
          def: P.def === 'any' ? 'any' : 'high', lang: P.lang, order: P.order === 'rel' ? 'relevance' : P.order}));
        const d = await r.json();
        if (r.ok) { got = {...got, videos: d.videos, removed: d.removed, live: true}; return; }
        got.msg = d.message || '지금은 YouTube 전체 검색이 어려워요.';
      } catch { got.msg = '지금은 YouTube 전체 검색이 어려워요.'; }
    }
    got.videos = localQuery(await searchPool(HOME.q, [...rxPicks, ...trendPool]), GUIDE);
  };
  // 세부 주제: 결과 안에서 여러 영상이 함께 쓰는 말(검색어 자체는 뺀다)
  const makeFacets = () => {
    const qWords = qTokens(got.q).filter(t => !t.startsWith('-')).flatMap(t => t.replace(/"/g, '').split(/[|\s]+/)).map(w => w.toLowerCase()).filter(Boolean);
    // 종류 말(추천·비교·후기…)·「3가지」·「알려드립니다」 같은 말은 세부 주제로 내지 않는다
    const junk = kw => TYPES.some(t => t[2].test(kw)) || /^\d+가지$|니다$|세요$|해요$|^속 /.test(kw);
    FACET.topics = hotKeywords(got.videos, 16).filter(t => !junk(t.kw) && !qWords.some(w => t.kw.toLowerCase().includes(w) || w.includes(t.kw.toLowerCase())))
      .filter(t => t.ids.length < got.videos.length)
      .filter((t, i, all) => all.findIndex(o => o.kw.replace(/\s/g, '') === t.kw.replace(/\s/g, '')) === i)   // 「황제 골프」=「황제골프」
      .slice(0, 8);
  };
  // 완성된 검색문: 버튼을 고르면 바로 바뀌고, 사용자가 직접 고쳐 쓸 수도 있다. 검색은 [검색하기] 를 눌러야 한다.
  const lineLabel = fresh => fresh ? '완성된 검색문 · 아직 검색 전이에요. 고쳐 쓴 뒤 [검색하기]를 누르세요' : '이 검색문 그대로 YouTube 에서 찾은 결과예요';
  const applyLabel = () => {
    const fresh = !sameQuery(DRAFT, GUIDE), dirty = !sameGuide(DRAFT, GUIDE);
    return {fresh, dirty, go: fresh ? '🔍 이 검색문으로 검색하기' : '✓ 검색됨',
      text: fresh ? '🔍 이 검색문으로 검색하기' : dirty ? `적용하기 · ${guided(got.videos, DRAFT).length}편` : '적용됨'};
  };
  const drawSearch = () => {
    const box = $('#qSec');
    const vids = guided(got.videos);
    const shown = vids.slice(0, HOME.more ? 24 : 12);
    const picked = [GUIDE.topic, GUIDE.bait ? '자극적 제목 빼고' : ''].filter(Boolean);
    const src = got.live ? `YouTube 전체에서 ${got.videos.length}편${got.removed.shorts || got.removed.ad ? ` · 쇼츠 ${got.removed.shorts || 0}·광고 ${got.removed.ad || 0}편은 뺐어요` : ''}`
      : `골라봄이 모아 둔 영상에서 ${got.videos.length}편${got.msg ? ' · ' + got.msg : ''}`;
    if (!DRAFT) DRAFT = clone(GUIDE);
    const lbl = applyLabel();
    // ② 의 숫자는 「누르면 몇 편이 남는지」 — 검색문이 바뀌어 새로 찾아야 할 때는 숫자를 감춘다
    const count = patch => lbl.fresh ? null : guided(got.videos, {...DRAFT, ...patch}).length;
    const row = (label, items, cur, attr, n) => `<div class="grow"><span class="gl">${label}</span><div class="chips">${items.map(([id, l]) => {
      const on = Array.isArray(cur) ? cur.includes(id) : cur === id;
      const c = n ? n(id) : null;
      return `<button class="chip${c === 0 && !on ? ' zero' : ''}" ${attr}="${esc(id)}" aria-pressed="${on}">${esc(l)}${c !== null ? ` <small>${c}</small>` : ''}</button>`;
    }).join('')}</div></div>`;
    // 결과에 나온 말(세부 주제)을 검색문에 넣는 버튼. 이미 넣은 말은 결과가 바뀌어도 남긴다.
    const addWords = [...DRAFT.add, ...FACET.topics.map(t => t.kw).filter(w => !DRAFT.add.includes(w))];
    const input = (label, id, val, ph) => `<div class="grow"><label class="gl" for="${id}">${label}</label><input class="gin" id="${id}" value="${esc(val)}" placeholder="${esc(ph)}" maxlength="30" enterkeyhint="search"></div>`;
    box.hidden = false;
    box.innerHTML = `
      <div class="said"><b>${esc(HOME.q)}</b>${picked.length ? ` <em>· ${esc(picked.join(' · '))}</em>` : ''} <span>— 영상 ${vids.length}편</span><button class="more" id="qClear">지우기 ✕</button></div>
      <div class="qprompt${lbl.fresh ? ' draft' : ''}" id="qPrompt">
        <label class="ql" for="qLine" id="qLbl">${lineLabel(lbl.fresh)}</label>
        <textarea id="qLine" rows="2" maxlength="250" spellcheck="false" enterkeyhint="search">${esc(DRAFT.line)}</textarea>
        <div class="qrow"><button class="gok" id="qGo" ${lbl.fresh ? '' : 'disabled'}>${lbl.go}</button></div>
        <p class="qtip">말을 더 넣어 풍성하게 만들어도 돼요 · <b>-말</b> 빼기 · <b>"말"</b> 꼭 넣기 · <b>A|B</b> 둘 중 하나 · <b>길이:4~20분</b> <b>기간:1년안</b> <b>자막:있음</b> 은 YouTube 검색 필터로 걸려요</p>
      </div>
      <p class="note">${src}</p>
      <div class="guide">
        <p class="gsec">① 검색문 만들기 <small>고르면 위 검색문이 바뀌어요 · 검색은 [검색하기]를 눌러야 해요</small></p>
        ${row('종류', KIND.map(k => [k[0], k[1]]), DRAFT.kind, 'data-gk')}
        ${row('대상·수준', AUD.map(a => [a[0], a[1]]), DRAFT.aud, 'data-ga')}
        ${addWords.length ? row('결과에 나온 말', addWords.map(w => [w, (DRAFT.add.includes(w) ? '✓ ' : '+ ') + w]), DRAFT.add, 'data-gx') : ''}
        ${input('꼭 들어갈 말', 'gMust', DRAFT.must, '예: 접이식')}
        ${row('빼고 찾기', NOTS.map(n => [n[0], n[1]]), DRAFT.not, 'data-gn')}
        ${input('또 뺄 말', 'gNot', DRAFT.notText, '예: 광고 중고 (띄어 쓰기로 여러 개)')}
        ${row('길이', DUR.map(d => [d[0], d[1]]), DRAFT.dur, 'data-gl')}
        ${row('언제', AFTER.map(a => [a[0], a[1]]), DRAFT.after, 'data-gw')}
        <details class="gmore" id="gMore"${HOME.moreCond ? ' open' : ''}><summary>조건 더 보기 <small>자막 · 화질 · 언어 · 순서</small></summary>
        ${row('자막', [['0', '상관없음'], ['1', '자막 있는 것만']], DRAFT.cap ? '1' : '0', 'data-gc')}
        ${row('화질', DEF.map(d => [d[0], d[1]]), DRAFT.def, 'data-gq')}
        ${row('언어', LANG.map(l => [l[0], l[1]]), DRAFT.lang, 'data-gg')}
        ${row('순서', ORDER.map(o => [o[0], o[1]]), DRAFT.order, 'data-go')}
        </details>
        <p class="gsec">② 결과 안에서 고르기 <small>${lbl.fresh ? '새로 찾은 뒤에 고를 수 있어요' : '숫자 = 고르면 남는 영상 수'}</small></p>
        ${FACET.topics.length ? row('세부 주제', [['', '전체'], ...FACET.topics.map(t => [t.kw, t.kw])], DRAFT.topic, 'data-gp', id => count({topic: id})) : ''}
        ${row('빼기', [['bait', '자극적 제목']], DRAFT.bait ? ['bait'] : [], 'data-gb', () => count({bait: !DRAFT.bait}))}
        ${row('정렬', SORT, DRAFT.sort, 'data-gs')}
        <div class="gapply"><p class="gline${lbl.fresh ? ' fresh' : ''}" id="gLine"><span>검색문</span>${esc(DRAFT.line)}</p><button class="greset" id="gReset">초기화</button>
          <button class="gok" id="gApply" ${lbl.dirty ? '' : 'disabled'}>${lbl.text}</button></div>
      </div>
      ${shown.length ? `<div class="rowlist grid">${rowCards(shown, '⌕', 'search')}</div>` : `<div class="empty">${got.videos.length ? '조건에 맞는 영상이 없어요. 「결과 안에서 고르기」를 몇 개 풀어 보세요.' : '이 검색문으로는 영상이 없어요. 조건이 너무 많이 겹쳤어요. 대상·수준이나 결과에 나온 말을 하나 빼고 다시 찾아 보세요.'}</div>`}
      ${vids.length > shown.length ? '<button class="moreBtn" id="qMore">더 보기</button>' : ''}`;
    bindRow('#qSec .rowlist', shown, '⌕', 'search', drawSearch);
    if (HOME.flash) { HOME.flash = false; box.querySelectorAll('.said, .qprompt, .rowlist, .empty').forEach(el => el.classList.add('flash')); }
    $('#qClear').onclick = () => runSearch('');
    $('#qMore')?.addEventListener('click', () => { HOME.more = true; drawSearch(); });
    // 버튼은 DRAFT 를 바꾸고, 그 버튼이 만든 조각만 검색문에 넣고 뺀다
    const setQ = f => { const before = composeQ(DRAFT); f(); DRAFT.line = patchLine(DRAFT.line, before, composeQ(DRAFT)); };
    const on = (attr, f) => box.querySelectorAll(`[${attr}]`).forEach(b => b.onclick = () => { setQ(() => f(b.getAttribute(attr))); drawSearch(); });
    const toggle = (arr, x) => arr.includes(x) ? arr.filter(y => y !== x) : [...arr, x];
    on('data-gk', v => DRAFT.kind = v);
    on('data-gn', v => DRAFT.not = toggle(DRAFT.not, v));
    on('data-gl', v => DRAFT.dur = v);
    on('data-gw', v => DRAFT.after = v);
    on('data-gc', v => DRAFT.cap = v === '1');
    on('data-ga', v => DRAFT.aud = toggle(DRAFT.aud, v));
    on('data-gx', v => DRAFT.add = toggle(DRAFT.add, v));
    on('data-gq', v => DRAFT.def = v);
    on('data-gg', v => DRAFT.lang = v);
    on('data-go', v => DRAFT.order = v);
    $('#gMore').ontoggle = () => { HOME.moreCond = $('#gMore').open; };
    on('data-gp', v => DRAFT.topic = v);
    on('data-gb', () => DRAFT.bait = !DRAFT.bait);
    on('data-gs', v => DRAFT.sort = v);
    // 글자 칸은 칠 때마다 검색문·버튼만 바꾼다(전체를 다시 그리면 입력 중인 칸을 놓친다)
    const live = () => {
      const l = applyLabel();
      $('#qPrompt').classList.toggle('draft', l.fresh); $('#qLbl').textContent = lineLabel(l.fresh);
      $('#qGo').textContent = l.go; $('#qGo').disabled = !l.fresh;
      $('#gApply').textContent = l.text; $('#gApply').disabled = !l.dirty;
      $('#gLine').innerHTML = `<span>검색문</span>${esc(DRAFT.line)}`; $('#gLine').classList.toggle('fresh', l.fresh);
    };
    const enterGo = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!$('#gApply').disabled) apply(); } };
    [['#gMust', 'must'], ['#gNot', 'notText']].forEach(([sel, k]) => {
      const el = $(sel);
      el.oninput = () => { setQ(() => DRAFT[k] = el.value); $('#qLine').value = DRAFT.line; live(); };
      el.onkeydown = enterGo;
    });
    // 검색문에 길이·기간·자막 표기를 직접 써도 아래 버튼이 따라 눌린다
    $('#qLine').oninput = () => {
      DRAFT.line = $('#qLine').value.replace(/\s*\n\s*/g, ' '); syncFilters(DRAFT);
      [['data-gl', DRAFT.dur], ['data-gw', DRAFT.after], ['data-gc', DRAFT.cap ? '1' : '0'], ['data-gq', DRAFT.def], ['data-gg', DRAFT.lang], ['data-go', DRAFT.order]].forEach(([a, v]) => box.querySelectorAll(`[${a}]`).forEach(b => b.setAttribute('aria-pressed', b.getAttribute(a) === v)));
      live();
    };
    $('#qLine').onkeydown = enterGo;
    $('#gReset').onclick = () => { DRAFT = {...clone(GUIDE0), line: HOME.q}; drawSearch(); };
    const apply = async () => {
      DRAFT.line = DRAFT.line.trim().replace(/\s+/g, ' ');
      if (!DRAFT.line) { $('#qLine').focus(); return; }
      syncFilters(DRAFT);
      const fresh = !sameQuery(DRAFT, GUIDE);
      GUIDE = clone(DRAFT); HOME.flash = true; HOME.more = false;
      if (fresh) {
        GUIDE.topic = ''; DRAFT = null;          // 결과가 바뀌면 세부 주제도 새로 뽑는다
        track('research', GUIDE.line);
        box.classList.add('loading'); $('#gApply').textContent = $('#qGo').textContent = '찾는 중…';
        await fetchResults(); makeFacets();
        box.classList.remove('loading');
      } else track('guide', JSON.stringify(GUIDE));
      drawSearch();
      $('#qSec .said')?.scrollIntoView({behavior: 'smooth', block: 'start'});
    };
    $('#gApply').onclick = apply; $('#qGo').onclick = apply;
  };
  const runSearch = async q => {
    HOME.q = q.trim(); HOME.more = false;
    $('#q').value = HOME.q;
    $('#hero').classList.toggle('searched', !!HOME.q);
    const box = $('#qSec');
    if (!HOME.q) { box.hidden = true; return; }
    if (!GUIDE.line) { GUIDE.line = HOME.q; DRAFT = null; }
    box.hidden = false; box.innerHTML = '<p class="note">찾는 중…</p>';
    await fetchResults(); makeFacets();
    drawSearch();
  };
  $('#qForm').onsubmit = e => { e.preventDefault(); track('search', $('#q').value.trim()); GUIDE = clone(GUIDE0); DRAFT = null; runSearch($('#q').value); };
  $('#hotLine').innerHTML = hot.length ? `<span class="hl">지금 뜨는 말${updated ? ` <small>${esc(agoText(updated))}</small>` : ''}</span>` + hot.slice(0, 8).map(h => `<button class="chip" data-hq="${esc(h.kw)}">${esc(h.kw)}</button>`).join('') : '';
  $('#hotLine').querySelectorAll('[data-hq]').forEach(b => b.onclick = () => { track('mode-trend', 'hero:' + b.dataset.hq); GUIDE = clone(GUIDE0); DRAFT = null; runSearch(b.dataset.hq); });
  if (HOME.q) runSearch(HOME.q);

  // ④ 당신이 주로 즐기는 영상들
  const drawTopics = async () => {
    const box = $('#topicBox');
    const ids = myTopicIds();
    if (HOME.editTopics || !ids.length) {
      box.innerHTML = `<p class="note">${ids.length ? '관심 있는 것을 더 고르거나 빼 보세요.' : '관심 있는 것을 골라 주세요. 고른 것의 영상을 여기서 바로 보여 드려요.'}</p>
        <div class="chips">${DATA.topics.map(t => `<button class="chip pk" data-pk="${t.id}" aria-pressed="${ids.includes(t.id)}">${t.emoji} ${esc(t.name)}</button>`).join('')}</div>`;
      box.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => {
        const set = new Set(myTopicIds());
        set.has(b.dataset.pk) ? set.delete(b.dataset.pk) : set.add(b.dataset.pk);
        store.set('mytopics', [...set]); track('pick', String(set.size));
        if (!HOME.topic || !set.has(HOME.topic)) HOME.topic = [...set][0] || '';
        drawTopics();
      });
      return;
    }
    let len = store.get('len', CONFIG.defaultLength);
    const data = await load(`${BASE}/videos/${HOME.topic}.json`);
    const max = CONFIG.lengths.find(l => l.id === len).max;
    const vids = (data?.videos || []).filter(v => v.sec <= max).slice(0, 8);
    box.innerHTML = `
      <div class="chips scroll">${myTopics().map(t => `<button class="chip" data-tp="${t.id}" aria-pressed="${t.id === HOME.topic}">${t.emoji} ${esc(t.name)}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="영상 길이">${CONFIG.lengths.map(l => `<button data-len="${l.id}" aria-pressed="${l.id === len}">${l.label}${l.id !== 'any' ? ' 안쪽' : ''}</button>`).join('')}</div>
      ${vids.length ? `<div class="rowlist">${rowCards(vids, TOPIC[HOME.topic].emoji, 'topic')}</div>`
        : `<div class="empty">${data ? '이 길이에 맞는 영상이 없어요. 「넉넉히」를 눌러 보세요.' : '이 토픽의 영상은 내일 아침에 채워져요.'}</div>`}`;
    box.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => { HOME.topic = b.dataset.tp; track('mode-topic', HOME.topic); drawTopics(); });
    box.querySelectorAll('[data-len]').forEach(b => b.onclick = () => { store.set('len', b.dataset.len); track('length', b.dataset.len); drawTopics(); });
    bindRow('#topicBox .rowlist', vids, TOPIC[HOME.topic].emoji, 'topic', drawTopics);
  };
  $('#editTopics').onclick = () => { HOME.editTopics = !HOME.editTopics; $('#editTopics').textContent = HOME.editTopics ? '다 골랐어요' : '토픽 고치기'; drawTopics(); };
  drawTopics();
}

// 홈 카드 줄: 휴대폰은 옆으로 넘기고, PC 는 4칸 격자
function rowCards(vids, emoji, scope) {
  const fb = store.get('fb', {});
  return vids.map((v, i) => {
    const key = v.id || `${scope}#${i}`;
    return `<article class="hc">
      <button class="thb" data-play="${i}" aria-label="재생: ${esc(v.title)}">${thumbInner(v, emoji)}</button>
      <button class="vt" data-play="${i}">${esc(v.title)}</button>
      <div class="ch">${esc(v.channel)}</div>
      <div class="why${(v.reason || '').startsWith('💎') ? ' gem' : ''}">${esc(v.reason || '')}</div>
      <div class="fb sm"><button data-fb="${esc(key)}|up" aria-pressed="${fb[key] === 'up'}" aria-label="이런 것 더">👍</button><button data-fb="${esc(key)}|down" aria-pressed="${fb[key] === 'down'}" aria-label="이건 빼">👎</button></div>
    </article>`;
  }).join('');
}
function bindRow(sel, vids, emoji, scope, redraw) {
  const root = $(sel);
  if (!root) return;
  root.querySelectorAll('[data-play]').forEach(b => b.onclick = () => { track('mode-' + scope, 'play'); play(vids, +b.dataset.play, emoji); });
  root.querySelectorAll('[data-fb]').forEach(b => b.onclick = () => {
    const fb = store.get('fb', {});
    const [key, val] = b.dataset.fb.split('|');
    fb[key] = fb[key] === val ? undefined : val; store.set('fb', fb);
    track('fb-' + (fb[key] || 'clear'), `${scope}:${key}`); redraw();
  });
}

// 첫 화면 검색: 골라봄이 모아 둔 영상(리저브·트렌드·깊이 파기·내 토픽) 안에서 찾는다. 낱말이 모두 들어 있어야 한다.
let POOL;
async function searchPool(q, extra = []) {
  if (!POOL) {
    const files = [...DATA.deepFields.map(f => `${BASE}/deep/${f.id}.json`), ...DATA.topics.map(t => `${BASE}/videos/${t.id}.json`)];
    const got = await Promise.all(files.map(load));
    const seen = new Set();
    POOL = got.flatMap(d => [...(d?.all || []), ...Object.values(d?.byKeyword || {}).flat(), ...(d?.videos || [])])
      .filter(v => { const k = v.id || v.title; return !seen.has(k) && seen.add(k); });
  }
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const seen = new Set();
  return [...extra, ...POOL].filter(v => { const k = v.id || v.title; return !seen.has(k) && seen.add(k); }).filter(v => { const t = (v.title + ' ' + v.channel + ' ' + (v.kw || '') + ' ' + (v.tags || []).join(' ')).toLowerCase(); return terms.every(w => t.includes(w)); })
    .sort((a, b) => (b.gem || 0) - (a.gem || 0) || (b.likeRatio || 0) - (a.likeRatio || 0));
}

// ── 첫 방문: 관심 있는 것 고르기 (질문 1) ──────────────────────────
function pick() {
  light();
  const chosen = new Set(myTopicIds());
  const draw = () => {
    app.innerHTML = `
    <div class="wrap narrow">
      ${bar()}
      <h1>요즘 관심 있는 것을<br>모두 골라 주세요</h1>
      <p class="sub">고른 것이 「내 토픽」이 돼요. 언제든 바꿀 수 있어요.</p>
      <div class="picks">${DATA.topics.map(t => `<button class="pk" data-id="${t.id}" aria-pressed="${chosen.has(t.id)}"><span class="e">${t.emoji}</span>${esc(t.name)}</button>`).join('')}</div>
      <div class="pickbar">
        <button class="go" ${chosen.size ? '' : 'disabled'}>${chosen.size ? `${chosen.size}개 골랐어요 · 시작하기` : '하나 이상 골라 주세요'}</button>
        <button class="skip">건너뛰기</button>
      </div>
    </div>`;
    app.querySelectorAll('.pk').forEach(b => b.onclick = () => { chosen.has(b.dataset.id) ? chosen.delete(b.dataset.id) : chosen.add(b.dataset.id); draw(); });
    app.querySelector('.go').onclick = () => { store.set('mytopics', [...chosen]); track('pick', String(chosen.size)); location.hash = '#/home'; };
    app.querySelector('.skip').onclick = () => { store.set('pickSkipped', true); track('pick-skip'); location.hash = '#/home'; };
  };
  draw();
}

// ── 공통: 영상 목록 화면 ─────────────────────────────────────────
// opts: {title, sub, chips:[{id,label}], chip, onChip, note, videos, emoji, fbScope, withLength}
function listScreen(o) {
  let len = store.get('len', CONFIG.defaultLength);
  const fb = store.get('fb', {});
  const draw = () => {
    const max = o.withLength ? CONFIG.lengths.find(l => l.id === len).max : Infinity;
    const vids = (o.videos() || []).filter(v => v.sec <= max).slice(0, CONFIG.maxResults);
    app.innerHTML = `
    <div class="wrap">
      ${bar('#/home')}
      <h1>${o.title}</h1>
      ${o.sub ? `<p class="sub">${o.sub}</p>` : ''}
      ${o.chips ? `<div class="chips scroll">${o.chips.map(c => `<button class="chip" data-chip="${esc(c.id)}" aria-pressed="${c.id === o.chip()}">${esc(c.label)}</button>`).join('')}</div>` : ''}
      ${o.withLength ? `<div class="seg" role="group" aria-label="영상 길이">${CONFIG.lengths.map(l => `<button data-len="${l.id}" aria-pressed="${l.id === len}">${l.label}${l.id !== 'any' ? ' 안쪽' : ''}</button>`).join('')}</div>` : ''}
      <p class="note">영상 ${vids.length}편 · <b>${o.note()}</b></p>
      ${vids.length ? `<div class="list">${vids.map((v, i) => vcard(v, i, fb, o.emoji, o.fbScope)).join('')}</div>`
        : `<div class="empty">${o.videos() ? '조건에 맞는 영상이 없어요. 다른 칩을 눌러 보세요.' : '아직 영상 데이터가 없어요.'}</div>`}
      ${sampleNote()}
    </div>`;
    app.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { o.onChip(b.dataset.chip); draw(); });
    app.querySelectorAll('[data-len]').forEach(b => b.onclick = () => { len = b.dataset.len; store.set('len', len); track('length', len); draw(); });
    app.querySelectorAll('[data-play]').forEach(b => b.onclick = () => play(vids, +b.dataset.play, o.emoji));
    app.querySelectorAll('[data-fb]').forEach(b => b.onclick = () => {
      const [key, val] = b.dataset.fb.split('|');
      fb[key] = fb[key] === val ? undefined : val; store.set('fb', fb);
      track('fb-' + (fb[key] || 'clear'), `${o.fbScope}:${key}`); draw();
    });
    return vids;
  };
  return draw();
}

// ── 모드 ① 최신 트렌드 ────────────────────────────────────────
async function trend(cat = 'all', autoplay) {
  light();
  track('mode-trend', cat);
  const cats = DATA.trendCategories;
  const data = {};
  await Promise.all(cats.map(async c => { data[c.id] = await load(`${BASE}/trend/${c.id}.json`); }));
  let cur = cats.some(c => c.id === cat) ? cat : 'all';
  const vids = listScreen({
    title: '🔥 지금 뜨는 영상', sub: '인기 급상승 영상에서 쇼츠와 자극적인 제목을 걸러 냈어요.',
    chips: cats.map(c => ({id: c.id, label: c.name})), chip: () => cur, onChip: id => { cur = id; track('trend-cat', id); },
    videos: () => data[cur]?.videos, emoji: '🔥', fbScope: 'trend',
    note: () => { const r = data[cur]?.removed || {}; return `쇼츠 ${r.shorts || 0}편, 자극적 제목 ${r.bait || 0}편, 광고 ${r.ad || 0}편은 뺐어요`; },
  });
  if (autoplay !== undefined && vids[autoplay]) play(vids, +autoplay, '🔥');
}

// ── 모드 ② 내 토픽 ──────────────────────────────────────────
async function topic(id) {
  light();
  const t = TOPIC[id];
  if (!t) return (location.hash = '#/home');
  track('mode-topic', id);
  const data = await load(`${BASE}/videos/${id}.json`);
  listScreen({
    title: `${t.emoji} ${esc(t.name)}`, withLength: true, emoji: t.emoji, fbScope: 'topic',
    videos: () => data?.videos,
    note: () => { const r = data?.removed || {}; return `쇼츠 ${r.shorts || 0}편, 광고 표시 ${r.ad || 0}편은 뺐어요`; },
  });
}

// ── 모드 ③ 깊이 파기: 분야(질문 1) → 바로 보석 · 키워드 칩(질문 2)으로 좁히기 ──
async function deep(id) {
  light();
  const f = FIELD[id];
  if (!f) return (location.hash = '#/home');
  track('mode-deep', id);
  const data = await load(`${BASE}/deep/${id}.json`);
  let kw = '';
  listScreen({
    title: `${f.emoji} ${esc(f.name)} 깊이 파기`, sub: `${esc(f.desc)} · 구독자가 적어도 본 사람이 만족한 영상을 위로 올렸어요.`,
    chips: [{id: '', label: '분야 전체'}, ...f.keywords.map(k => ({id: k, label: k}))], chip: () => kw, onChip: k => { kw = k; track('deep-kw', `${id}:${k}`); },
    videos: () => (data ? (kw ? data.byKeyword?.[kw] : data.all) : null), emoji: f.emoji, fbScope: 'deep',
    note: () => { const r = data?.removed || {}; return `쇼츠 ${r.shorts || 0}편, 8분 미만 ${r.short || 0}편, 광고·자극적 제목 ${r.ad || 0}편은 뺐어요`; },
  });
}

const thumbInner = (v, emoji) => `
  <span class="th">
    ${v.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy">` : `<span class="ph">${emoji}<small>SAMPLE</small></span>`}
    ${v.sec ? `<span class="d">${mmss(v.sec)}</span>` : ''}
  </span>`;
function vcard(v, i, fb, emoji, scope) {
  const key = v.id || `${scope}#${i}`;
  return `<article class="vc">
    <button class="thb" data-play="${i}" aria-label="재생: ${esc(v.title)}">${thumbInner(v, emoji)}</button>
    <div>
      <button class="vt" data-play="${i}">${esc(v.title)}</button>
      <div class="ch">${esc(v.channel)}</div>
      <div class="why${(v.reason || '').startsWith('💎') ? ' gem' : ''}">${esc(v.reason || '')}</div>
      <div class="fb">
        <button data-fb="${esc(key)}|up" aria-pressed="${fb[key] === 'up'}">👍 이런 것 더</button>
        <button data-fb="${esc(key)}|down" aria-pressed="${fb[key] === 'down'}">👎 이건 빼</button>
      </div>
    </div>
  </article>`;
}

// ── 모드 ④ 리저브: 큐레이터가 고른 한 호 5편 ──────────────────────
async function reserve(t, vol) {
  if (/^[A-Z]$/.test(t) && !tester) { tester = t; store.set('tester', t); }
  const issue = await load(`${BASE}/reserve/${t}-${vol}.json`);
  document.body.classList.add('rx');
  if (!issue) {
    app.innerHTML = `<div class="rx-wrap"><div class="bar"><a class="back" href="#/home">← 골라봄</a></div><div class="cover"><div class="rk">GOLABOM RESERVE</div><p class="lead">아직 발행되지 않은 호입니다.</p></div></div>`;
    return;
  }
  track('mode-reserve', `${t}-${vol}`);
  store.set('seenIssue', Math.max(store.get('seenIssue', 0), +vol));
  const rx = store.get('rx', {});
  const picks = issue.picks.map(p => ({...p.video, ...p, title: p.video?.title || '(영상 정보 없음)'}));
  const draw = () => {
    app.innerHTML = `
    <div class="rx-wrap">
      <div class="bar"><a class="back" href="#/home">← 골라봄</a></div>
      <header class="cover compact">
        <div class="rk">GOLABOM RESERVE</div>
        <div class="rvol">Vol.${issue.vol}</div>
        <div class="rsub">큐레이터가 고른 숨은 명작 5편 · ${esc(issue.week)} · 테스터 ${esc(issue.tester)} 님께</div>
      </header>
      ${picks.map((p, i) => {
        const key = `${t}-${vol}-${i}`;
        return `<section class="item">
          <div class="no">No.${String(i + 1).padStart(2, '0')}</div>
          <button class="thb" data-play="${i}" aria-label="재생">${thumbInner({...p, sec: p.sec || 0}, '✦')}</button>
          <button class="ititle" data-play="${i}">${esc(p.title)}</button>
          <div class="imeta">${esc(p.channel || '')}${p.sec ? ' · ' + mmss(p.sec) : ''}${p.caption ? ' · 자막' : ''}</div>
          ${p.hidden ? `<div class="hidden">쉽게 못 찾는 이유 · ${esc(p.hidden)}</div>` : ''}
          <p class="cm">“${esc(p.comment)}”</p>
          <div class="react">${[['good', '좋았어요'], ['so', '그저 그래요'], ['skip', '안 볼래요']].map(([v, l]) =>
            `<button data-rx="${key}|${v}" aria-pressed="${rx[key] === v}">${l}</button>`).join('')}</div>
        </section>`;
      }).join('')}
      <div class="sign">— ${esc(CONFIG.curator)}</div>
      <div class="nextissue">다음 호 · ${esc(issue.next)}</div>
      ${sampleNote(issue.example ? ' 이 호의 영상과 코멘트도 예시입니다.' : '')}
    </div>`;
    app.querySelectorAll('[data-play]').forEach(b => b.onclick = () => play(picks, +b.dataset.play, '✦'));
    app.querySelectorAll('[data-rx]').forEach(b => b.onclick = () => {
      const [key, v] = b.dataset.rx.split('|');
      rx[key] = rx[key] === v ? undefined : v; store.set('rx', rx); track('rx-' + (rx[key] || 'clear'), key); draw();
    });
  };
  draw();
}

// ── 플레이어: 골라봄 안에서 재생, 끝나면 YouTube 추천이 아니라 내 목록의 다음 영상 ──
let ytReady;
const loadYT = () => ytReady ||= new Promise(res => {
  window.onYouTubeIframeAPIReady = () => res(window.YT);
  const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.append(s);
});
async function play(list, i, emoji) {
  const v = list[i];
  track('play', v.id || 'sample');
  const el = document.createElement('div');
  el.className = 'player';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="영상 재생">
    <div class="screen">${v.id ? '<div id="yt"></div>' : `<div class="ph"><b>${emoji || '✦'}</b>샘플 화면이라 재생할 영상이 없어요.<br>API 키를 등록하면 여기서 실제 영상이 재생됩니다.</div>`}</div>
    <div class="pmeta"><div><div class="t">${esc(v.title)}</div><div class="s">${esc(v.channel || '')}${v.reason ? ' · ' + esc(v.reason) : ''}</div></div></div>
    <div class="pbtn">${i + 1 < list.length ? '<button data-next>다음 영상 ▸</button>' : ''}<button class="x" data-close>닫기 ✕</button></div>
  </div>`;
  document.body.append(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  el.onclick = e => { if (e.target === el || e.target.closest('[data-close]')) close(); };
  el.querySelector('[data-next]')?.addEventListener('click', () => { close(); play(list, i + 1, emoji); });
  if (!v.id) return;
  const YT = await loadYT();
  new YT.Player('yt', {
    host: 'https://www.youtube.com', videoId: v.id,
    playerVars: {autoplay: 1, rel: 0, playsinline: 1, modestbranding: 1},
    events: {onStateChange: e => { if (e.data === YT.PlayerState.ENDED) { track('ended', v.id); if (i + 1 < list.length) { close(); play(list, i + 1, emoji); } } }},
  });
}

// ── 길 안내 ──────────────────────────────────────────────────
function route() {
  window.scrollTo(0, 0);
  document.querySelector('.player')?.remove();
  document.querySelector('.gxtheater')?.remove();
  document.querySelector('.obtheater')?.remove();
  const [, kind, a, b] = location.hash.split('/');
  if (kind === 'pick') return pick();
  if (kind === 'trend') return trend(a, b);
  if (kind === 't') return topic(a);
  if (kind === 'd') return deep(a);
  if (kind === 'r') return reserve(a, b);
  if (kind === 'g') return a ? gallery(app, a, {esc, track, load, store}) : galleryIndex(app, {esc, track, load});
  if (kind === 'o') return omnibus(app, a, {esc, track, load});
  if (kind === 'home') return home();
  return front();
}
addEventListener('hashchange', route);
if (!sessionStorage.getItem('glb_visit')) { sessionStorage.setItem('glb_visit', '1'); track('visit'); }
route();
