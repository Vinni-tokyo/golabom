// 골라봄 Step 0 — 네 모드: 최신 트렌드 · 리저브(전문가 추천) · 깊이 파기 · 내 토픽(당신이 주로 즐기는 영상들). 홈 한 화면에서 끝낸다.
// 원칙: 이력은 「내 토픽」의 출발점으로만 쓴다. 나머지 셋은 일부러 이력 밖에서 고른다.
// 질문은 영상까지 최대 2번. 데이터: data/topics.json · data/gen/(매일 자동 작업이 만든 영상 정보, 커밋 안 함)
import {CONFIG} from './config.js?v=20261030e';
import {hotKeywords} from './keywords.js?v=20261030e';

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

function sampleNote(extra = '') {
  if (!META.sample && !DATA.example) return '';
  const why = META.missing
    ? '영상 데이터가 아직 없습니다. <code>python3 tools/fetch_videos.py --sample</code> 로 자리 데이터를 만드세요.'
    : META.sample ? '지금은 <b>샘플 화면</b>입니다. YouTube API 키를 등록하면 매일 실제 영상으로 바뀝니다.' : '';
  const ex = DATA.example ? ' 토픽과 리저브 내용은 인터뷰 전 예시입니다.' : '';
  return `<div class="sample"><span>🧪</span><span>${why}${ex}${extra}</span></div>`;
}
const bar = (back) => `<div class="bar">${back ? `<a class="back" href="${back}">← 골라봄</a>` : '<a class="logo" href="#/">골라<b>봄</b></a>'}${tester ? `<span class="who">테스터 ${esc(tester)}</span>` : ''}</div>`;
const light = () => document.body.classList.remove('rx');

// ── 홈: 한 화면에서 끝낸다(두 번째 페이지로 넘어가지 않음) ─────────────────
//   첫 화면은 Google 처럼 로고·검색창·지금 뜨는 말만. 아래로 내리면
//   ① 지금 뜨는 키워드 → 영상 · ② 리저브 5편 · ③ 깊이 파기(키워드) · ④ 당신이 주로 즐기는 영상들
const HOME = {q: '', kw: '', deepKw: '', topic: '', editTopics: false};
// 검색 좁히기 버튼. 「어떤 영상」은 검색어에 붙여 새로 찾고, 나머지는 받아 둔 결과 안에서 거른다(API 추가 없음).
const GUIDE = {kind: '', len: 'any', when: 'any', drop: [], sort: 'rel'};
const KINDS = ['', '후기', '비교', '고르는 법', '설명', '브이로그'];
const WHEN = [['any', '전체'], ['year', '1년 안'], ['month', '최근 한 달']];
const DROP = [['reaction', '리액션', ['리액션', 'reaction', '반응']], ['compile', '짜깁기', ['모음', '요약', '몰아보기', '총정리', 'compilation']],
  ['bait', '자극적 제목', ['충격', '경악', '소름', '레전드', '실화냐', '난리', '미쳤다', 'ㄷㄷ']]];
const SORT = [['rel', '관련순'], ['like', '만족도'], ['new', '최신'], ['views', '조회수']];
const lenLabel = () => GUIDE.len === 'any' ? '' : GUIDE.len === 'long' ? '20분 넘게' : CONFIG.lengths.find(l => l.id === GUIDE.len).label + ' 안쪽';
function guided(vids) {
  const now = Date.now();
  const days = {any: Infinity, year: 365, month: 31}[GUIDE.when];
  const max = GUIDE.len === 'any' || GUIDE.len === 'long' ? Infinity : CONFIG.lengths.find(l => l.id === GUIDE.len).max;
  const words = DROP.filter(d => GUIDE.drop.includes(d[0])).flatMap(d => d[2]);
  const out = vids.filter(v => v.sec <= max && (GUIDE.len !== 'long' || v.sec > 20 * 60)
    && (!v.published || (now - Date.parse(v.published)) / 864e5 <= days)
    && !words.some(w => v.title.toLowerCase().includes(w)));
  const by = {rel: (a, b) => (a.rel ?? 999) - (b.rel ?? 999), like: (a, b) => (b.likeRatio || 0) - (a.likeRatio || 0),
    new: (a, b) => (b.published || '').localeCompare(a.published || ''), views: (a, b) => (b.views || 0) - (a.views || 0)}[GUIDE.sort];
  return GUIDE.sort === 'rel' && out.every(v => v.rel === undefined) ? out : [...out].sort(by);
}

async function home() {
  light();
  const mine = myTopics();
  if (!HOME.topic || !mine.some(t => t.id === HOME.topic)) HOME.topic = mine[0]?.id || '';
  const [trendAll, issues, deepAll] = await Promise.all([
    Promise.all(DATA.trendCategories.map(c => load(`${BASE}/trend/${c.id}.json`))),
    tester ? issuesFor(tester) : [],
    Promise.all(DATA.deepFields.map(f => load(`${BASE}/deep/${f.id}.json`))),
  ]);
  // 트렌드: 분야를 합쳐 중복을 빼고, 「전체」 순서를 앞에 둔다
  const seen = new Set();
  const trendPool = trendAll.flatMap(d => d?.videos || []).filter(v => { const k = v.id || v.title; return !seen.has(k) && seen.add(k); });
  const hot = hotKeywords(trendPool, 8);
  const latest = issues.at(-1);
  app.innerHTML = `
  <div class="wrap">
    ${tester ? `<span class="who float">테스터 ${esc(tester)}</span>` : ''}
    <section class="hero${HOME.q ? ' searched' : ''}" id="hero">
      <a class="logo-big" href="#/" id="logoBig">골라<b>봄</b></a>
      <p class="tag-line">추천에 끌려가지 말고, 골라서 보세요</p>
      <form class="bigsearch" id="qForm" role="search">
        <span class="ic" aria-hidden="true">⌕</span>
        <input id="q" type="search" placeholder="무엇이 궁금하세요?" value="${esc(HOME.q)}" aria-label="영상 찾기" autocomplete="off">
        <button type="submit">골라 보기</button>
      </form>
      <div class="hotline" id="hotLine"></div>
      <nav class="jump"><a href="#hotSec">🔥 지금 뜨는</a>${latest ? `<a href="#rxSec">✦ RESERVE Vol.${latest.vol}</a>` : ''}<a href="#deepSec">🔭 깊이 파기</a><a href="#mySec">내가 즐기는 영상</a></nav>
      <div class="scrollcue" aria-hidden="true">아래로 내리면 오늘의 영상 ↓</div>
    </section>
    <section class="hs" id="qSec" hidden></section>

    <section class="hs" id="hotSec">
      <div class="sec">🔥 지금 뜨는 키워드 <small>여러 채널이 함께 이야기하는 말 · 쇼츠·자극적 제목은 뺐어요</small></div>
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

  // ① 지금 뜨는 키워드
  const drawHot = () => {
    const chosen = hot.find(h => h.kw === HOME.kw);
    const vids = (chosen ? trendPool.filter(v => chosen.ids.includes(v.id || v.title)) : trendPool).slice(0, 8);
    $('#hotChips').innerHTML = [{kw: '', label: '전체'}, ...hot.map(h => ({kw: h.kw, label: `${h.kw} <small>${h.channels}</small>`}))]
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
  let got = {videos: [], removed: {}, live: false, msg: ''};
  const fetchResults = async () => {
    got = {videos: [], removed: {}, live: false, msg: ''};
    if (CONFIG.searchApi) {
      try {
        const r = await fetch(`${CONFIG.searchApi}/search?` + new URLSearchParams({q: HOME.q, kind: GUIDE.kind}));
        const d = await r.json();
        if (r.ok) { got = {videos: d.videos, removed: d.removed, live: true, msg: ''}; return; }
        got.msg = d.message || '지금은 YouTube 전체 검색이 어려워요.';
      } catch { got.msg = '지금은 YouTube 전체 검색이 어려워요.'; }
    }
    const q = [HOME.q, GUIDE.kind].filter(Boolean).join(' ');
    got.videos = await searchPool(q, [...rxPicks, ...trendPool]);
  };
  const drawSearch = () => {
    const box = $('#qSec');
    const vids = guided(got.videos);
    const shown = vids.slice(0, HOME.more ? 24 : 12);
    const said = [HOME.q, GUIDE.kind, lenLabel(), WHEN.find(w => w[0] === GUIDE.when)[0] !== 'any' ? WHEN.find(w => w[0] === GUIDE.when)[1] : '',
      GUIDE.drop.length ? DROP.filter(d => GUIDE.drop.includes(d[0])).map(d => d[1]).join('·') + ' 빼고' : ''].filter(Boolean).join(' · ');
    const src = got.live ? `YouTube 전체에서 ${got.videos.length}편${got.removed.shorts || got.removed.ad ? ` · 쇼츠 ${got.removed.shorts || 0}·광고 ${got.removed.ad || 0}편은 뺐어요` : ''}`
      : `골라봄이 모아 둔 영상에서 ${got.videos.length}편${got.msg ? ' · ' + got.msg : ''}`;
    const row = (label, items, cur, attr) => `<div class="grow"><span class="gl">${label}</span><div class="chips">${items.map(([id, l]) =>
      `<button class="chip" ${attr}="${esc(id)}" aria-pressed="${Array.isArray(cur) ? cur.includes(id) : cur === id}">${esc(l)}</button>`).join('')}</div></div>`;
    box.hidden = false;
    box.innerHTML = `
      <div class="said"><b>${esc(said)}</b> <span>— 영상 ${vids.length}편</span><button class="more" id="qClear">지우기 ✕</button></div>
      <p class="note">${src}</p>
      <div class="guide">
        ${row('어떤 영상', KINDS.map(k => [k, k || '전체']), GUIDE.kind, 'data-gk')}
        ${row('길이', [['any', '상관없음'], ...CONFIG.lengths.filter(l => l.id !== 'any').map(l => [l.id, l.label + ' 안쪽']), ['long', '20분 넘게']], GUIDE.len, 'data-gl')}
        ${row('언제', WHEN, GUIDE.when, 'data-gw')}
        ${row('빼기', DROP.map(d => [d[0], d[1]]), GUIDE.drop, 'data-gd')}
        ${row('순서', SORT, GUIDE.sort, 'data-gs')}
      </div>
      ${shown.length ? `<div class="rowlist grid">${rowCards(shown, '⌕', 'search')}</div>` : '<div class="empty">조건에 맞는 영상이 없어요. 위 버튼을 몇 개 풀어 보세요.</div>'}
      ${vids.length > shown.length ? '<button class="moreBtn" id="qMore">더 보기</button>' : ''}`;
    bindRow('#qSec .rowlist', shown, '⌕', 'search', drawSearch);
    $('#qClear').onclick = () => runSearch('');
    $('#qMore')?.addEventListener('click', () => { HOME.more = true; drawSearch(); });
    box.querySelectorAll('[data-gk]').forEach(b => b.onclick = async () => { GUIDE.kind = b.dataset.gk; track('guide', 'kind:' + GUIDE.kind); box.classList.add('loading'); await fetchResults(); box.classList.remove('loading'); drawSearch(); });
    box.querySelectorAll('[data-gl]').forEach(b => b.onclick = () => { GUIDE.len = b.dataset.gl; track('guide', 'len:' + GUIDE.len); drawSearch(); });
    box.querySelectorAll('[data-gw]').forEach(b => b.onclick = () => { GUIDE.when = b.dataset.gw; track('guide', 'when:' + GUIDE.when); drawSearch(); });
    box.querySelectorAll('[data-gd]').forEach(b => b.onclick = () => { const d = b.dataset.gd; GUIDE.drop = GUIDE.drop.includes(d) ? GUIDE.drop.filter(x => x !== d) : [...GUIDE.drop, d]; track('guide', 'drop:' + d); drawSearch(); });
    box.querySelectorAll('[data-gs]').forEach(b => b.onclick = () => { GUIDE.sort = b.dataset.gs; track('guide', 'sort:' + GUIDE.sort); drawSearch(); });
  };
  const runSearch = async q => {
    HOME.q = q.trim(); HOME.more = false;
    $('#q').value = HOME.q;
    $('#hero').classList.toggle('searched', !!HOME.q);
    const box = $('#qSec');
    if (!HOME.q) { box.hidden = true; return; }
    box.hidden = false; box.innerHTML = '<p class="note">찾는 중…</p>';
    await fetchResults();
    drawSearch();
  };
  $('#qForm').onsubmit = e => { e.preventDefault(); track('search', $('#q').value.trim()); GUIDE.kind = ''; runSearch($('#q').value); };
  $('#hotLine').innerHTML = hot.length ? `<span class="hl">지금 뜨는 말</span>` + hot.slice(0, 5).map(h => `<button class="chip" data-hq="${esc(h.kw)}">${esc(h.kw)}</button>`).join('') : '';
  $('#hotLine').querySelectorAll('[data-hq]').forEach(b => b.onclick = () => { track('mode-trend', 'hero:' + b.dataset.hq); GUIDE.kind = ''; runSearch(b.dataset.hq); });
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
    app.querySelector('.go').onclick = () => { store.set('mytopics', [...chosen]); track('pick', String(chosen.size)); location.hash = '#/'; };
    app.querySelector('.skip').onclick = () => { store.set('pickSkipped', true); track('pick-skip'); location.hash = '#/'; };
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
      ${bar('#/')}
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
  if (!t) return (location.hash = '#/');
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
  if (!f) return (location.hash = '#/');
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
    app.innerHTML = `<div class="rx-wrap"><div class="bar"><a class="back" href="#/">← 골라봄</a></div><div class="cover"><div class="rk">GOLABOM RESERVE</div><p class="lead">아직 발행되지 않은 호입니다.</p></div></div>`;
    return;
  }
  track('mode-reserve', `${t}-${vol}`);
  store.set('seenIssue', Math.max(store.get('seenIssue', 0), +vol));
  const rx = store.get('rx', {});
  const picks = issue.picks.map(p => ({...p.video, ...p, title: p.video?.title || '(영상 정보 없음)'}));
  const draw = () => {
    app.innerHTML = `
    <div class="rx-wrap">
      <div class="bar"><a class="back" href="#/">← 골라봄</a></div>
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
    host: 'https://www.youtube-nocookie.com', videoId: v.id,
    playerVars: {autoplay: 1, rel: 0, playsinline: 1, modestbranding: 1},
    events: {onStateChange: e => { if (e.data === YT.PlayerState.ENDED) { track('ended', v.id); if (i + 1 < list.length) { close(); play(list, i + 1, emoji); } } }},
  });
}

// ── 길 안내 ──────────────────────────────────────────────────
function route() {
  window.scrollTo(0, 0);
  document.querySelector('.player')?.remove();
  const [, kind, a, b] = location.hash.split('/');
  if (kind === 'pick') return pick();
  if (kind === 'trend') return trend(a, b);
  if (kind === 't') return topic(a);
  if (kind === 'd') return deep(a);
  if (kind === 'r') return reserve(a, b);
  return home();
}
addEventListener('hashchange', route);
if (!sessionStorage.getItem('glb_visit')) { sessionStorage.setItem('glb_visit', '1'); track('visit'); }
route();
