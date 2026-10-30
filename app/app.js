// 골라봄 Step 0 — 네 모드: 최신 트렌드 · 내 토픽 · 깊이 파기 · 리저브(전문가 추천).
// 원칙: 이력은 「내 토픽」의 출발점으로만 쓴다. 나머지 셋은 일부러 이력 밖에서 고른다.
// 질문은 영상까지 최대 2번. 데이터: data/topics.json · data/gen/(매일 자동 작업이 만든 영상 정보, 커밋 안 함)
import {CONFIG} from './config.js';

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

// ── 홈: 뜨는 영상 → 리저브 → 내 토픽 → 깊이 파기 ───────────────────
async function home() {
  light();
  if (!store.get('mytopics', null) && !DATA.testers[tester] && !store.get('pickSkipped', false)) return (location.hash = '#/pick');
  const mine = myTopics();
  const [trend, issues] = await Promise.all([load(`${BASE}/trend/all.json`), tester ? issuesFor(tester) : []]);
  const latest = issues.at(-1);
  const seen = store.get('seenIssue', 0);
  const today = new Date().toLocaleDateString('ko-KR', {month: 'long', day: 'numeric', weekday: 'long'});
  const strip = (trend?.videos || []).slice(0, 6);
  app.innerHTML = `
  <div class="wrap">
    ${bar()}
    <p class="sub">${esc(today)}</p>
    <h1>오늘은 무엇을 골라 볼까요?</h1>

    <a class="sec link" href="#/trend/all">🔥 지금 뜨는 영상 <small>쇼츠·자극적 제목은 뺐어요</small><span class="more">전체 보기 →</span></a>
    <div class="strip">${strip.map((v, i) => `<a class="sv" href="#/trend/all/${i}">${thumbInner(v, '🔥')}<span class="st">${esc(v.title)}</span></a>`).join('') || '<div class="empty">아직 데이터가 없어요.</div>'}</div>

    ${latest ? `
    <a class="rbanner" href="#/r/${esc(tester)}/${latest.vol}">
      ${latest.vol > seen ? '<span class="rnew">새 호</span>' : ''}
      <div class="rk">GOLABOM RESERVE</div>
      <div class="rvol">Vol.${latest.vol}</div>
      <div class="rsub">큐레이터가 고른 숨은 명작 5편 · ${esc(latest.week)}</div>
      <span class="rgo">이번 호 열어 보기 →</span>
    </a>` : `
    <div class="rbanner off">
      <div class="rk">GOLABOM RESERVE</div>
      <div class="rsub" style="margin-top:8px">큐레이터가 고른 숨은 명작 5편이 매주 월요일 도착해요.<br>지금은 초대받은 테스터에게만 보내고 있어요.</div>
    </div>`}

    <div class="sec">내 토픽 <small>누르면 바로 영상이 나와요</small><a class="more" href="#/pick">고치기</a></div>
    ${mine.length ? `<div class="tiles">${mine.map(t => `<a class="tile" href="#/t/${t.id}"><span class="e">${t.emoji}</span><span class="n">${esc(t.name)}</span><span class="c">영상 보기 →</span></a>`).join('')}</div>`
      : `<a class="tile add" href="#/pick"><span class="e">＋</span><span class="n">관심 있는 것 고르기</span><span class="c">한 번만 고르면 돼요</span></a>`}

    <div class="sec">🔭 깊이 파기 <small>알고리즘이 위로 올려 주지 않는 숨은 보석</small></div>
    <div class="fields">${DATA.deepFields.map(f => `<a class="field" href="#/d/${f.id}"><span class="e">${f.emoji}</span><span><span class="n">${esc(f.name)}</span><span class="c">${esc(f.desc)}</span></span></a>`).join('')}</div>

    ${sampleNote()}
    <div class="foot"><span>골라봄 Step 0 · 테스트 중</span><a href="../">예전 링크 검색기(Phase 0)</a></div>
  </div>`;
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
      <header class="cover">
        <div class="rk">GOLABOM RESERVE</div>
        <div class="rvol">Vol.${issue.vol}</div>
        <div class="rsub">큐레이터가 고른 숨은 명작 5편 · ${esc(issue.week)} · 테스터 ${esc(issue.tester)} 님께</div>
        <p class="lead">이번 호에는 알고리즘이 잘 보여 주지 않는 영상 다섯 편을 골랐습니다. 하루에 한 편씩, 천천히 보셔도 좋습니다.</p>
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
