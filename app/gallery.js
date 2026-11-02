// 골라봄 명작 갤러리 — 「영상의 명품관」. 여러 플랫폼에서 고른 영상을 테마 전시관으로 건다.
// 원칙: 영상을 내려받거나 다시 올리지 않는다. 각 플랫폼의 공식 퍼가기로만 재생한다.
//      카드마다 출처 플랫폼을 따로 표시한다(YouTube 개발자 정책 III.F.2).
// 데이터: data/gallery/index.json(층별 안내) · data/gallery/<id>.json(전시관 하나)
//   작품: {platform, id, title, channel, sec, thumb, note, license}  license = commercial-ok | nc-only | yt-api

import {CONFIG} from './config.js?v=20261102y';

const PLATFORM = {
  // 자막: 각 플랫폼 플레이어의 공식 설정으로 켠다(한국어 우선). 자막 파일을 만들거나 플레이어 위에 덮지 않는다.
  youtube: {name: 'YouTube', embed: id => `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&hl=ko&cc_load_policy=1&cc_lang_pref=ko`,
    thumb: id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`},
  vimeo: {name: 'Vimeo', embed: id => `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1&title=0&byline=0`},
  ted: {name: 'TED', embed: id => `https://embed.ted.com/talks/lang/ko/${id}`},
  dailymotion: {name: 'Dailymotion', embed: id => `https://geo.dailymotion.com/player.html?video=${id}`},
  niconico: {name: 'ニコニコ', embed: id => `https://embed.nicovideo.jp/watch/${id}?autoplay=1`},
  bilibili: {name: 'bilibili', embed: id => `https://player.bilibili.com/player.html?bvid=${id}&autoplay=1&high_quality=1&danmaku=0`},
  tiktok: {name: 'TikTok', embed: id => `https://www.tiktok.com/player/v1/${id}?autoplay=1`, tall: true},
  rumble: {name: 'Rumble', embed: id => `https://rumble.com/embed/${id}/?autoplay=2`},
  twitch: {name: 'Twitch', embed: id => `https://clips.twitch.tv/embed?clip=${id}&parent=${location.hostname}`},
};
const pname = p => PLATFORM[p]?.name || p;
const thumbOf = w => w.thumb || PLATFORM[w.platform]?.thumb?.(w.id) || '';
// 액자는 크게 걸리므로 고화질 썸네일을 먼저 쓴다. 없으면(404) 기본 썸네일로 돌아간다.
const bigThumb = w => w.platform === 'youtube' ? `https://i.ytimg.com/vi/${w.id}/maxresdefault.jpg`
  : w.platform === 'vimeo' ? (w.thumb || '').replace(/-d_\d+(x\d+)?/, '-d_1280x720') : thumbOf(w);
const minutes = s => s ? `${Math.max(1, Math.round(s / 60))}분` : '';
// 자막 표시: ko=한국어 자막 · yes=자막 있음(자동 번역으로 한국어) · auto=자동 자막만 · 그 외=표시 없음
const CC = {ko: ['한국어 자막', ''], yes: ['자막 · 한국어 자동 번역', '자막이 다른 언어로 나오면 플레이어 톱니 ⚙ → 자막 → 자동 번역 → 한국어'], auto: ['자동 자막', '플레이어 톱니 ⚙ → 자막 → 자동 번역 → 한국어'],
  tr: ['골라봄 번역 자막', '데스크톱 Chrome 에서는 플레이어 아래에 한국어 번역이 뜹니다(기계 번역). 다른 브라우저에서는 플레이어의 원문 자막만 나옵니다']};
const esc0 = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
// 확인된 「말」 정보(speech)가 있으면 그것을 보여 준다. YouTube 의 언어 값은 올린 사람이 적은 것이라 틀릴 때가 많다.
const ccBadge = w => w.speech ? `<span class="gxcc">${esc0(w.speech)}</span>` : CC[w.cc] ? `<span class="gxcc" title="${esc0(CC[w.cc][1])}">${CC[w.cc][0]}</span>` : '';
const byLine = w => w.tier === 'licensed' && w.rights                  // 2급 출처: 올린 이와 권리자를 나눠 적는다(SCOUT_BRIEF §0.5)
  ? `업로드 ${esc0(w.channel || '')} · 권리 ${esc0(w.rights)}` : esc0(w.channel || '');
const ccHint = w => {
  if (w.speech) return /^(일본어|영어)/.test(w.speech) && !/화면에/.test(w.speech) && w.platform === 'youtube'
    ? `<p class="gxcchint">한국어로 보려면 플레이어 톱니 ⚙ → 자막 → 자동 번역 → 한국어</p>` : '';
  return CC[w.cc]?.[1] ? `<p class="gxcchint">${esc0(CC[w.cc][1])}</p>` : '';
};
const two = n => String(n).padStart(2, '0');

// 갈래: 층별 안내에서 전시관을 묶는 순서와 안내문
const GENRES = [
  ['스포츠', '스포츠', '이기고 지는 것 너머, 몸과 사람이 움직이는 자리.'],
  ['음악', '음악', '목소리와 악기가 무대를 채우는 순간.'],
  ['가족과 관계', '가족과 관계', '부모와 스승, 다시 만난 사람, 낯선 이웃.'],
  ['용기와 도전', '용기와 도전', '처음 해 본 사람, 끝까지 버틴 사람.'],
  ['늙음과 죽음', '늙음과 죽음', '끝 앞에서 삶을 다시 묻는 이야기.'],
  ['자연과 우주', '자연과 우주', '지구와 동물과 별.'],
  ['과학의 원리', '과학의 원리', '몸과 숫자와 부엌에 숨은 이치.'],
  ['기술', '기술', '기계가 배우고, 알아듣고, 대신 고르는 법.'],
  ['손과 기술', '손과 기술', '장인과 거장, 물건이 만들어지는 과정.'],
  ['생각과 말', '생각과 말', '묻고 의심하고 말로 붙잡는 연습.'],
  ['역사와 사회', '역사와 사회', '사람이 맺은 약속과 세상을 바꾼 순간, 그리고 지금의 쟁점.'],
  ['보는 예술', '보는 예술', '춤과 영화와 공간, 눈으로 듣는 것들.'],
  ['어학', '어학', '다른 말의 소리에 귀를 여는 시간.'],
  ['19', '19', '몸과 금기, 검열. 미술관과 영화제의 공식 자료로만, 19세 이상만.'],
];
// 문(門): 육하원칙 여섯 가지 지도. 누가·언제·무엇을·왜는 관을, 어디서·어떻게는 작품을 묶는다(data/facets.json). 기본은 무엇을.
const DOORS = [['who', '누가'], ['when', '언제'], ['where', '어디서'], ['genre', '무엇을'], ['how', '어떻게'], ['why', '왜'], ['stuff', '무엇으로'], ['era', '몇 년대']];   // 뒤 둘은 랑가나탄 PMEST 의 M(재료)·T(시대)   // 육하원칙 표준 순서 · 처음 열리는 문은 무엇을
const doorOf = () => { try { const d = localStorage.getItem('glb_gx_door'); return DOORS.some(([k]) => k === d) ? d : 'genre'; } catch { return 'genre'; } };
const roomCard = (g, esc) => `
        <a class="gxroom${g.adult ? ' adult' : ''}" href="#/g/${esc(g.id)}">
          <span class="gxcov" style="background-image:url('${esc(g.adult && !adultOk() ? '' : g.cover || '')}')">${g.adult ? '<b class="gx19">19</b>' : ''}</span>
          <span class="gxno">No.${two(g.no)}</span>
          <span class="gxname">${esc(g.title)}</span>
          <span class="gxsub">${esc(g.sub)}</span>
          <span class="gxmeta">${g.count}점 · ${(g.platforms || []).map(pname).join(' · ')}${g.status ? ` · <b class="gxstat">${esc(g.status)}</b>` : ''}</span>
        </a>`;

// ── 층별 안내: 전시관 목록 ─────────────────────────────────────────
export async function galleryIndex(app, {esc, track, load}) {
  const [idx, F] = await Promise.all([load('data/gallery/index.json'), load('data/facets.json')]);
  document.body.className = 'gx';
  track('gallery-index');
  const list = idx?.galleries || [];
  const D = idx?.doors || {};
  const byId = Object.fromEntries(list.map(g => [g.id, g]));
  const halls = ids => (ids || []).map(i => byId[i]).filter(Boolean);
  // 문마다 칸(세부 주제) 목록: {name, lead, gs(관), ws(작품), kick}. 빈 칸은 뺀다
  const S = (name, lead, gs, kick = '') => ({name, lead, gs, kick});
  const W = x => ({name: x.name, lead: x.sub, gs: [], ws: x.items});
  const views = {
    genre: () => [...GENRES.map(([k, name, lead]) => S(name, lead, list.filter(g => g.genre === k))),
      // 「이럴 때」 관(잠들기 전·가는 길에…)은 왜·언제 문에만 둔다
      S('그 밖의 관', '', list.filter(g => g.genre !== '이럴 때' && !GENRES.some(([k]) => k === g.genre)))],
    why: () => (D.uses || []).filter(u => u.door === 'why').map(u => S(u.name, u.sub, halls(u.halls))),
    when: () => (D.uses || []).filter(u => u.door === 'when').map(u => S(u.name, u.sub, halls(u.halls))),
    how: () => (F?.how || []).map(W),
    where: () => (F?.where || []).map(W),
    stuff: () => (F?.stuff || []).map(W),
    era: () => (F?.era || []).map(W),
    who: () => (D.electives?.groups || []).map(x => S(x.name, x.sub, halls(x.halls))),
  };
  const LEAD = {how: '만든 방식으로 고릅니다. 관을 넘나들며 이어 봅니다.', where: '영상이 만들어진 곳으로 고릅니다. 관을 넘나들며 이어 봅니다.', stuff: '영상이 무엇으로 만들어졌는지로 고릅니다. 관을 넘나들며 이어 봅니다.', era: '화면 속 장면이 찍힌 때로 고릅니다. 관을 넘나들며 이어 봅니다.'};
  const STRIP = 12;                                          // 작품 칸: 앞 12편만 보이고, 끝 칸에서 이어 본다
  const thumb = it => it[3] || (it[4] ? `https://i.ytimg.com/vi/${it[4]}/mqdefault.jpg` : '');
  const sec = (x, n) => x.ws ? `
      <section class="gxgenre" id="gxs${n}"><h2>${esc(x.name)}</h2>${x.lead ? `<p>${esc(x.lead)}</p>` : ''}
      <button class="gxplay gxfxall" data-fx="${n}:0">▶ 이어 보기 · ${x.ws.length}편</button>
      <ol class="gxweekl">${x.ws.slice(0, STRIP).map((it, j) => `
        <li><button data-fx="${n}:${j}" aria-label="재생: ${esc(it[2])}"><span class="gxweekc" style="background-image:url('${esc(thumb(it))}')"></span><span class="gxweekt">${esc(it[2])}</span></button>
          <a class="gxweeka" href="#/g/${esc(it[0])}">${esc(byId[it[0]]?.title || '')}</a></li>`).join('')}${x.ws.length > STRIP ? `
        <li><button class="gxfxmore" data-fx="${n}:${STRIP}">＋${x.ws.length - STRIP}편 이어서</button></li>` : ''}</ol></section>` : `
      <section class="gxgenre" id="gxs${n}">${x.kick ? `<p class="gxkick">${esc(x.kick)}</p>` : ''}<h2>${esc(x.name)}</h2><p>${esc(x.lead)}</p>
      <div class="gxhalls">${x.gs.map(g => roomCard(g, esc)).join('')}</div></section>`;
  let spy = null, XS = [], DOOR = '';
  const paint = door => {
    DOOR = door;
    try { localStorage.setItem('glb_gx_door', door); } catch {}
    app.querySelectorAll('.gxdoor button').forEach(b => b.classList.toggle('on', b.dataset.door === door));
    const xs = XS = (views[door] || views.genre)().filter(x => (x.ws || x.gs).length);
    // 세부 주제 바로가기: 문 바로 아래 한 줄. 누르면 그 칸으로 내려가고, 스크롤하면 지금 칸이 밝아진다
    const chips = xs.map((x, n) => `<button type="button" data-jump="${n}">${esc(x.name)}<small>${(x.ws || x.gs).length}</small></button>`).join('');
    app.querySelector('#gxjump').innerHTML = chips;                     // 문 바로 아래: 전부 펼쳐 보인다
    app.querySelector('#gxjumpbar').innerHTML = chips;                  // 내려가면: 위에 붙는 한 줄
    app.querySelector('#gxrooms').innerHTML = xs.length
      ? (LEAD[door] ? `<p class="gxlead">${esc(LEAD[door])}</p>` : '') + xs.map(sec).join('')
      : '<p class="gxlead">전시를 준비하고 있습니다.</p>';
    spy?.disconnect();
    if ('IntersectionObserver' in window) {
      const jump = app.querySelector('#gxjumpbar');
      spy = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        const n = e.target.id.slice(3);
        app.querySelectorAll('[data-jump]').forEach(b => b.classList.toggle('on', b.dataset.jump === n));
        jump.querySelector('.on')?.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'});
      }), {rootMargin: '-140px 0px -60% 0px'});
      app.querySelectorAll('.gxgenre').forEach(x => spy.observe(x));
    }
  };
  app.innerHTML = `
    <div class="gxwrap">
      <header class="gxhall">
        <p class="gxkick">GOLABOM MAISON</p>
        <h1>명품관</h1>
        <p class="gxlead">다시 볼 이유가 있는 영상만 걸었습니다.</p>
      </header>
      <nav class="gxdoor">${DOORS.map(([k, n]) => `<button type="button" data-door="${k}">${esc(n)}</button>`).join('')}</nav>
      <nav class="gxjump" id="gxjump" aria-label="세부 주제"></nav>
      <nav class="gxjump bar" id="gxjumpbar" aria-hidden="true" hidden></nav>
      <div id="gxrooms"></div>
      <p class="gxfoot">골라봄은 영상을 내려받지 않습니다. 모든 작품은 각 플랫폼의 공식 플레이어로 재생됩니다.</p>
    </div>`;
  app.querySelector('.gxdoor').addEventListener('click', e => {
    const b = e.target.closest('button[data-door]');
    if (b) { paint(b.dataset.door); track('gallery-door-' + b.dataset.door); }
  });
  // 펼친 바로가기가 화면 위로 사라지면 한 줄짜리를 위에 붙인다
  const full = app.querySelector('#gxjump'), bar = app.querySelector('#gxjumpbar');
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { bar.hidden = e.isIntersecting || e.boundingClientRect.top > 0; }, {rootMargin: '-52px 0px 0px 0px'}).observe(full);
  [full, bar].forEach(nav => nav.addEventListener('click', e => {
    const b = e.target.closest('button[data-jump]');
    const x = b && app.querySelector('#gxs' + b.dataset.jump);           // 위에 붙은 메뉴·바로가기 줄 아래에 칸 제목이 오게
    if (x) scrollTo({top: x.getBoundingClientRect().top + scrollY - 52 - 58 - 12, behavior: 'smooth'});   // 52 = #topnav · 58 = 붙는 한 줄
  }));
  // 어떻게·어디: 작품을 누르면 그 칸의 작품들을 관을 넘나들며 이어 본다(필요한 관 파일만 받는다)
  app.querySelector('#gxrooms').addEventListener('click', async e => {
    const b = e.target.closest('button[data-fx]');
    if (!b) return;
    const [n, j] = b.dataset.fx.split(':').map(Number), x = XS[n];
    if (!x?.ws) return;
    b.disabled = true;
    const ids = [...new Set(x.ws.map(it => it[0]))];
    const got = Object.fromEntries((await Promise.all(ids.map(id => load(`data/gallery/${id}.json`)))).filter(Boolean).map(g => [g.id, g]));
    b.disabled = false;
    const works = x.ws.map(it => got[it[0]]?.works?.[it[1]]).filter(Boolean);
    if (!works.length) return;
    if (b.classList.contains('gxfxall')) setAuto(true);
    track('gallery-facet', `${DOOR}:${x.name}:${j + 1}`);
    theater(works, Math.min(j, works.length - 1), {id: `fx-${DOOR}-${x.name}`, title: x.name, outro: '이 칸의 작품을 모두 보았습니다.'}, {esc, track});
  });
  paint(doorOf());
}

// 막(幕): g.acts = [{start: 작품 번호(0부터), title, lead}] — 그 작품 앞에 머리글을 둔다
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
function actHead(g, i, esc) {
  const k = (g.acts || []).findIndex(a => a.start === i);
  if (k < 0) return '';
  const a = g.acts[k];
  return `<li class="gxact"><span class="gxkick">${ROMAN[k] || k + 1}</span><h3>${esc(a.title)}</h3>${a.lead ? `<p>${esc(a.lead)}</p>` : ''}${i ? `<button class="gxactplay" data-all="${i}">▶ 이 막부터 이어 보기</button>` : ''}</li>`;
}

// ── 전시관 하나 ───────────────────────────────────────────────────
// 성인 전시관: 들어가기 전에 19세 이상임을 스스로 확인한다(이 기기에 기억). 작품은 미술관·영화제 공식 채널의 것뿐이다.
const adultOk = () => { try { return localStorage.getItem('glb_adult') === '1'; } catch { return false; } };
function adultGate(app, g, {esc, track}, proceed) {
  track('gallery-gate', g.id);
  app.innerHTML = `
    <div class="gxwrap">
      <a class="gxback" href="#/g">← 명품관</a>
      <header class="gxcover gxgate">
        <p class="gxkick">GOLABOM MAISON · No.${two(g.no)} · 19</p>
        <h1>${esc(g.title)}</h1>
        <p class="gxsubt">${esc(g.sub)}</p>
        <p class="gxlead">이 전시관은 몸, 욕망, 금기, 검열을 다룬 작품을 겁니다. 모두 미술관과 영화제, 방송사의 공식 채널에서 가져온 것이지만, 불편할 수 있는 장면이 있습니다.<br><b>19세 이상만 입장합니다.</b></p>
        <div class="gxacts"><button class="gxplay" id="gateYes">19세 이상입니다 · 입장</button><a class="gxshare" href="#/g">다른 전시관으로</a></div>
      </header>
    </div>`;
  app.querySelector('#gateYes').onclick = () => { try { localStorage.setItem('glb_adult', '1'); } catch {} track('gallery-gate-ok', g.id); proceed(); };
}

export async function gallery(app, id, {esc, track, load, store}) {
  const g = await load(`data/gallery/${id}.json`);
  if (!g) { location.hash = '#/g'; return; }
  document.body.className = 'gx';
  if (g.adult && !adultOk()) return adultGate(app, g, {esc, track}, () => gallery(app, id, {esc, track, load, store}));
  const works = g.works || [];
  const platforms = [...new Set(works.map(w => w.platform))];
  const total = works.reduce((s, w) => s + (w.sec || 0), 0), pos = posGet(id) < works.length ? posGet(id) : 0;
  // 재방문: 이 전시관을 「다른 날」 다시 열었는가(리저브 링크로 들어온 날은 빼고 센다)
  const today = new Date().toISOString().slice(0, 10), seen = store.get('gx_seen', {});
  if (seen[id] && seen[id] !== today && !location.search.includes('src=r')) track('gallery-return', id);
  seen[id] = today; store.set('gx_seen', seen);
  track('gallery-open', id);

  app.innerHTML = `
    <div class="gxwrap">
      <a class="gxback" href="#/g">← 명품관</a>
      <header class="gxcover">
        <p class="gxkick">GOLABOM MAISON · No.${two(g.no)}</p>
        <h1>${esc(g.title)}</h1>
        <p class="gxsubt">${esc(g.sub)}</p>
        ${g.thesis ? `<p class="gxthesis">${esc(g.thesis)}</p>` : ''}
        ${g.asof ? `<p class="gxmeta">이슈관 · 기준일 ${esc(g.asof)} · 서로 다른 쪽의 목소리를 나란히 걸었습니다. 결론은 관람객의 몫입니다.</p>` : ''}
        <p class="gxlead">${esc(g.intro)}</p>
        <p class="gxmeta">${works.length}점 · ${platforms.map(pname).join(' · ')}${g.curator ? ` · 큐레이션 ${esc(g.curator)}` : ''}</p>
        <div class="gxacts"><button class="gxplay" data-all="0">▶ 전관 이어 보기 · ${works.length}편 · ${hm(total)}</button>${pos ? `<button class="gxshare" data-all="${pos}">${two(pos + 1)}번부터 이어서</button>` : ''}${g.tour ? `<a class="gxshare" href="#/o/${esc(g.tour.id)}">하이라이트로 관람 · 약 ${g.tour.minutes}분</a>` : ''}<button class="gxshare" id="gxKeep">${isHallKept(g.id) ? '♥ 깊이 파기에 담아 둠' : '♡ 이 관 담기'}</button><button class="gxshare" id="gxShare">전시 공유하기</button></div>
        <p class="gxtourhint">한 편이 끝나면 다음 작품이 이어 재생됩니다. 화면을 닫을 때까지 한 관이 한 편의 방송처럼 흐릅니다.</p>
      </header>
      ${g.omnibus ? `<a class="gxomni" href="#/o/${esc(g.omnibus.id)}"><span class="gxkick">OMNIBUS · 이어 보는 이야기</span><span><b>${esc(g.omnibus.title)}</b><small>${esc(g.omnibus.sub)}</small></span><span class="arrow">→</span></a>` : ''}
      <ol class="gxworks">${works.map((w, i) => `${actHead(g, i, esc)}
        <li class="gxwork${i === 0 ? ' first' : ''}">
          <button class="gxframe" data-w="${i}" aria-label="재생: ${esc(w.ko || w.title)}">
            <img src="${esc(bigThumb(w))}" data-fallback="${esc(thumbOf(w))}" alt="" loading="lazy" referrerpolicy="no-referrer">
            <span class="gxplat">${esc(pname(w.platform))}</span>
          </button>
          <div class="gxcard">
            <span class="gxn">${two(i + 1)}</span>
            <div>
              <h2 class="gxt"><button data-w="${i}">${esc(w.ko || w.title)}</button>${w.stance === 'counter' ? ' <span class="gxcounter">다른 시각</span>' : ''}</h2>
              ${w.ko ? `<p class="gxorig">${esc(w.title)}</p>` : ''}
              <p class="gxby">${byLine(w)}${w.sec ? ` · ${minutes(w.sec)}` : ''} · ${esc(pname(w.platform))} ${ccBadge(w)}</p>
              ${w.note ? `<p class="gxnote">${esc(w.note)}</p>` : ''}
            </div>
          </div>
        </li>`).join('')}
      </ol>
      ${g.outro ? `<div class="gxoutro"><p class="gxkick">나가며</p><p>${esc(g.outro)}</p></div>` : ''}
      <p class="gxfoot">모든 작품은 각 플랫폼의 공식 플레이어로 재생됩니다. 저작권은 원작자에게 있습니다.</p>
      <div class="gxbar" hidden><button data-all="${pos}">▶ ${pos ? `${two(pos + 1)}번부터 이어서` : '전관 이어 보기'}</button><span>${works.length}편 · ${hm(total)}</span></div>
    </div>`;
  app.querySelectorAll('img[data-fallback]').forEach(img => img.onerror = () => { if (img.src !== img.dataset.fallback) img.src = img.dataset.fallback; });
  // YouTube 는 고화질이 없을 때 404 대신 회색 120px 그림을 줄 때가 있다
  app.querySelectorAll('img[data-fallback]').forEach(img => img.onload = () => { if (img.naturalWidth <= 120 && img.src !== img.dataset.fallback) img.src = img.dataset.fallback; });
  app.querySelectorAll('[data-w]').forEach(b => b.onclick = () => theater(works, +b.dataset.w, g, {esc, track}));
  app.querySelectorAll('[data-all]').forEach(b => b.onclick = () => { setAuto(true); track('gallery-playall', `${id}:${+b.dataset.all + 1}`); theater(works, +b.dataset.all, g, {esc, track}); });
  // 표지의 재생 단추가 화면에서 사라지면 아래에 「전관 이어 보기」 띠를 띄운다
  const bar = app.querySelector('.gxbar'), acts = app.querySelector('.gxacts');
  if (bar && acts && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => { bar.hidden = e.isIntersecting || e.boundingClientRect.top > 0; }).observe(acts);
  bindShare(app, g, {track});
}

// 관 공유 주소: 메신저 미리보기가 관마다 다른 정적 쪽(s/<관>.html, build_gallery.py 가 만든다) — 열면 골라보셈의 그 관으로
const shareUrl = g => new URL(`s/${g.id}.html`, location.href.split('#')[0]).href;
async function shareHall(g, btn, track) {
  const url = shareUrl(g);
  track('gallery-share', g.id);
  try {
    if (navigator.share) await navigator.share({title: `골라보셈 명품관 · ${g.title}`, url});
    else { await navigator.clipboard.writeText(url); if (btn) btn.textContent = '주소를 복사했어요'; }
  } catch { /* 사용자가 공유 창을 닫음 */ }
}
function bindShare(app, g, {track}) {
  // 관을 통째로 깊이 파기에 담는다(깊이 파기 첫 화면 「담아 둔 관」)
  const keep = app.querySelector('#gxKeep');
  keep.onclick = () => { const on = toggleHall(g, g.works || []); keep.textContent = on ? '♥ 깊이 파기에 담아 둠' : '♡ 이 관 담기'; track('gallery-keep', `${g.id}:${on ? 'on' : 'off'}`); };
  const btn = app.querySelector('#gxShare');
  btn.onclick = async () => {
    const url = shareUrl(g);
    track('gallery-share', g.id);
    try {
      if (navigator.share) await navigator.share({title: `골라보셈 명품관 · ${g.title}`, url});
      else { await navigator.clipboard.writeText(url); btn.textContent = '주소를 복사했어요'; }
    } catch { /* 사용자가 공유 창을 닫음 */ }
  };
}

// ── 해설 자막: 큐레이터의 말을 재생 시간에 맞춰 플레이어 「아래」에 띄운다 ─────────
//   글자는 전부 골라봄이 쓴 것(받아쓰기·번역 아님). 시간은 YouTube IFrame API(getCurrentTime) · Vimeo player 메시지(timeupdate)로 받는다.
let ytApi = null;
const loadYT = () => ytApi ||= new Promise(res => {
  if (window.YT?.Player) return res(window.YT);
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT); };
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) { const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.append(s); }
});
let cueStop = null;                 // 지금 관람실의 플레이어 연결(시간·끝·자막)을 끊는 함수
let vmApi = null;
const loadVimeo = () => vmApi ||= new Promise((res, rej) => {
  if (window.Vimeo?.Player) return res(window.Vimeo);
  const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@vimeo/player@2.20.1/dist/player.min.js';
  s.onload = () => res(window.Vimeo); s.onerror = rej; document.head.append(s);
});
// 골라봄 자막기: 플레이어가 공식으로 넘겨 주는 자막 줄을, 브라우저 안 번역기(Chrome Translator)로 한국어로 옮겨 플레이어 「아래」에 띄운다.
//   자막을 내려받거나 저장하지 않는다(줄이 바뀔 때 받은 글을 그 자리에서 옮기고 버린다). 번역기가 없으면 플레이어 자막만 쓴다.
const TR = {};
const translator = async from => {
  if (!('Translator' in self) || !from || from.startsWith('ko')) return null;
  const src = from.split('-')[0];
  try {
    if (await Translator.availability({sourceLanguage: src, targetLanguage: 'ko'}) === 'unavailable') return null;
    return TR[src] ||= await Translator.create({sourceLanguage: src, targetLanguage: 'ko'});
  } catch { return null; }
};
// 자막 고르기: 한국어 → 사람이 넣은 자막 → 자동 자막
const bestTrack = tracks => tracks.find(t => t.language.startsWith('ko')) || tracks.find(t => !t.language.includes('autogen')) || tracks[0];

// 플레이어에 붙기: 해설 자막(cues) 시간 맞추기 · 끝(onEnd) · 재생 불가(onError) · 자동 재생 막힘(onBlocked) · 자막기.
//   YouTube 는 관람실에 플레이어 하나를 두고 다음 작품도 그 플레이어로 이어 튼다(loadVideoById).
//   새 플레이어를 만들면 손으로 누르지 않은 재생이라 모바일에서 자동 재생이 막힌다.
let YTWANT = null;
let YTP = null;
let ytOn = {};                                  // 지금 작품의 신호 처리기
const ytKill = () => { try { YTP?.destroy(); } catch {} YTP = null; ytOn = {}; };
globalThis.__gxYT = () => YTP;                  // 이어 보기 시험(tools/e2e_autoplay.mjs)용
const BLOCK_MS = 6000;
// YouTube 플레이어는 화면 안 자기 층(.gxyt)에 산다. 다른 플랫폼 작품을 트는 동안에는 멈춰 숨겨 두었다가, 다시 YouTube 차례가 오면 그대로 이어 튼다
const ytLayer = screen => screen.querySelector('.gxyt') || screen.appendChild(Object.assign(document.createElement('div'), {className: 'gxyt'}));                          // 이 안에 재생이 시작되지 않으면 자동 재생이 막힌 것으로 본다
function mountPlayer(stage, w, esc, {onEnd, onError, onBlocked}) {
  cueStop?.(); cueStop = null;
  const box = stage.querySelector('.gxcue'), cues = w.cues || [];
  let cur = -1;
  const show = t => {
    if (!box || !cues.length) return;
    box.dataset.t = Math.floor(t);                       // 동기화 확인용(현재 초)
    // 확인된 지점에서 잠깐(기본 40초)만 띄운다. 다음 줄까지 남겨 두면 다른 장면 위에 걸려 어긋나 보인다.
    let k = -1; for (let i = 0; i < cues.length; i++) if (t >= cues[i][0] && t < cues[i][0] + (cues[i][2] || 40)) k = i;
    if (k === cur) return; cur = k;
    box.innerHTML = k < 0 ? '' : `<span class="gxcuet">${mmss(cues[k][0])}</span>${esc(cues[k][1])}`;
    box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
  };
  show(0);
  const screen = stage.querySelector('.gxscreen');
  let alive = true;
  if (w.platform === 'youtube') {
    let timer = null, guard = null, started = false;
    // 막히면 소리를 끄고 다시 튼다(소리 없는 자동 재생은 브라우저가 허용한다) → 「소리 켜기」를 띄운다. 그래도 안 되면 「눌러서 재생」
    const arm = () => { clearTimeout(guard); guard = setTimeout(() => {
      if (!alive || started) return;
      try { YTP.mute(); YTP.playVideo(); } catch {}
      guard = setTimeout(() => { if (alive) onBlocked(started ? () => { YTP?.unMute(); YTP?.playVideo(); } : () => YTP?.playVideo(), started); }, 3000);
    }, BLOCK_MS); };
    ytOn = {
      ready: () => { clearInterval(timer); if (cues.length) timer = setInterval(() => { try { show(YTP.getCurrentTime()); } catch {} }, 500); },
      state: s => { if (s === 1 || s === 3) { started = true; clearTimeout(guard); } if (s === 0) onEnd(); },
      error: code => onError(code),
    };
    if (YTP && screen.contains(YTP.getIframe?.())) {     // 같은 플레이어로 다음 작품
      if (typeof YTP.loadVideoById === 'function') { YTP.loadVideoById(w.id); ytOn.ready(); }
      else YTWANT = w.id;                                 // 플레이어가 아직 준비 중(빠르게 넘겼을 때) → 준비되면 이 작품을 튼다
      arm();
    } else {
      try { YTP?.destroy(); } catch {} YTP = null; YTWANT = null;         // (ytKill 은 방금 단 신호 처리기까지 지운다)
      const layer = ytLayer(screen), host = document.createElement('div'); layer.innerHTML = ''; layer.append(host);
      loadYT().then(YT => {
        if (!alive) return;
        YTP = new YT.Player(host, {host: 'https://www.youtube.com', videoId: w.id,
          playerVars: {autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, hl: 'ko', cc_load_policy: 1, cc_lang_pref: 'ko'},
          events: {onReady: () => { if (YTWANT) { YTP.loadVideoById(YTWANT); YTWANT = null; } ytOn.ready?.(); }, onStateChange: e => ytOn.state?.(e.data), onError: e => ytOn.error?.(e.data)}});
        arm();
      });
    }
    const mine = ytOn;
    cueStop = () => { alive = false; clearInterval(timer); clearTimeout(guard); if (ytOn === mine) ytOn = {}; };
  } else if (w.platform === 'vimeo') {
    const sub = stage.querySelector('.gxccbox');
    let player = null, guard = null, started = false;
    loadVimeo().then(async V => {
      if (!alive) return;
      player = new V.Player(screen.querySelector('.gxother'));
      // 올린 사람이 「반복 재생」으로 둔 작품은 끝 신호 없이 처음으로 돌아간다 → 끝 근처에서 처음으로 되감기면 끝으로 본다
      let last = 0, done = false;
      const end = () => { if (!done) { done = true; onEnd(); } };
      player.on('timeupdate', d => { show(d.seconds); if (d.duration && last > d.duration - 2 && d.seconds < 1) end(); last = d.seconds; });
      player.on('ended', end);
      player.on('play', () => { started = true; clearTimeout(guard); });
      player.on('error', () => alive && onError('vimeo'));
      guard = setTimeout(() => {
        if (!alive || started) return;
        player.setMuted(true).then(() => player.play()).catch(() => {});
        guard = setTimeout(() => { if (alive) onBlocked(started ? () => player.setMuted(false).then(() => player.play()).catch(() => {}) : () => player.play().catch(() => {}), started); }, 3000);
      }, BLOCK_MS);
      // 자막기
      const tracks = await player.getTextTracks().catch(() => []);
      const t = bestTrack(tracks);
      if (!t || !sub) return;
      // 재생 전에 켜면 재생이 시작될 때 꺼진다. 재생 시간이 흐르기 시작한 뒤(그리고 다시 재생할 때마다) 켠다.
      let armed = true;
      const on = () => player.enableTextTrack(t.language, t.kind).catch(() => {});
      player.on('timeupdate', d => { if (armed && d.seconds > 0.5) { armed = false; on(); } });
      player.on('play', () => { armed = true; });
      const tr = await translator(t.language.replace('-x-autogen', ''));
      if (!tr) return;                                     // 한국어 자막이거나 번역기가 없으면 플레이어 자막 그대로
      sub.hidden = false;
      const line = sub.querySelector('.gxsubko');
      // Vimeo 는 자막 줄과 같은 순간에 빈 신호를 한 번 더 보낸다 → 빈 신호는 무시하고, 글 길이만큼 보여 준 뒤 지운다
      let seq = 0, clear = null;
      player.on('cuechange', async d => {
        const txt = (d.cues || []).map(c => c.text).join(' ').trim();
        if (!txt) return;
        const my = ++seq;
        const ko = await tr.translate(txt).catch(() => '');
        if (my !== seq || !alive) return;
        line.textContent = ko;
        clearTimeout(clear); clear = setTimeout(() => { if (my === seq) line.textContent = ''; }, Math.max(3500, txt.length * 90));
      });
    }).catch(() => {});
    cueStop = () => { alive = false; clearTimeout(guard); try { ['timeupdate', 'ended', 'cuechange', 'play', 'error'].forEach(e => player?.off(e)); } catch {} };
  } else {
    // TED · 니코니코 · bilibili 는 끝 신호를 주지 않는다 → 작품 길이 + 20초가 지나면 끝난 것으로 보고 넘어갈 준비를 한다
    const t = w.sec ? setTimeout(() => alive && onEnd({guess: true}), (w.sec + 20) * 1000) : null;
    cueStop = () => { alive = false; clearTimeout(t); };
  }
}
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const hm = s => { const m = Math.max(1, Math.round(s / 60)); return m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`; };

// ── 관람실: 한 관을 한 편의 긴 방송처럼. 끝나면 다음 작품으로 이어 튼다 ─────────────
const autoOn = () => { try { return localStorage.getItem('glb_gx_auto') !== '0'; } catch { return true; } };   // 기본 켬
const setAuto = v => { try { localStorage.setItem('glb_gx_auto', v ? '1' : '0'); } catch {} };
// 어디까지 봤는지(관마다 번호). 다시 들어오면 「N번부터 이어서」를 보여 준다
const posGet = id => { try { return JSON.parse(localStorage.getItem('glb_gx_pos') || '{}')[id] || 0; } catch { return 0; } };
const posSet = (id, i) => { try { const p = JSON.parse(localStorage.getItem('glb_gx_pos') || '{}'); if (i) p[id] = i; else delete p[id]; localStorage.setItem('glb_gx_pos', JSON.stringify(p)); } catch {} };
let wait = null;      // 이어 보기 카운트다운(관람실이 바뀌면 지운다)
let PLAYED = 0;        // 이번 방문에서 재생한 작품 수(3편 이상이면 「둘러보는 즐거움」 신호)
let offKey = null;     // 지금 열린 관람실의 키 처리기를 지우는 함수
let T = null;          // 열린 관람실 {el, g, lock}
function theater(works, i, g, {esc, track}) {
  offKey?.(); cueStop?.(); cueStop = null; clearInterval(wait);
  const w = works[i], P = PLATFORM[w.platform];
  if (++PLAYED === 3) track('gallery-3plays', g.id);
  track('gallery-play', `${g.id}:${w.platform}:${w.id}`);
  if (T?.g !== g) {                                         // 관람실을 처음 연다(이후 작품은 같은 관람실 안에서 바꾼다)
    document.querySelector('.gxtheater')?.remove(); ytKill();
    const el = document.createElement('div');
    el.className = 'gxtheater';
    el.innerHTML = `<div class="gxstage" role="dialog" aria-modal="true"><div class="gxscreen"></div><div class="gxnext" hidden></div><div class="gxbody"></div></div>`;
    document.body.append(el);
    T = {el, g, lock: null};
    navigator.wakeLock?.request('screen').then(l => { if (T?.el === el) T.lock = l; else l.release(); }).catch(() => {});   // 작품 사이 카운트다운에도 화면이 꺼지지 않게
  }
  const el = T.el, screen = el.querySelector('.gxscreen'), nextBox = el.querySelector('.gxnext');
  el.querySelector('.gxstage').setAttribute('aria-label', w.title);
  nextBox.hidden = true; nextBox.innerHTML = '';
  screen.className = `gxscreen${P?.tall ? ' tall' : ''}`;
  screen.querySelector('.gxother')?.remove();
  const layer = ytLayer(screen);
  layer.hidden = w.platform !== 'youtube';
  if (w.platform !== 'youtube') {                           // YouTube 플레이어는 멈춰 숨겨 둔다(다음 YouTube 차례에 그대로 이어 튼다)
    try { YTP?.pauseVideo(); } catch {}
    if (P) screen.insertAdjacentHTML('beforeend', `<iframe class="gxother" src="${esc(P.embed(w.id))}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="${esc(w.title)}"></iframe>`);
  }
  const rest = works.slice(i).reduce((s, x) => s + (x.sec || 0), 0);
  el.querySelector('.gxbody').innerHTML = `
      ${w.platform === 'vimeo' ? `<div class="gxccbox" hidden><p class="gxsubko" aria-live="polite"></p><p class="gxcuelbl">골라봄 자막기 · 플레이어 자막을 이 브라우저 안에서 한국어로 옮깁니다(기계 번역)</p></div>` : ''}
      ${w.cues?.length ? `<div class="gxcue" aria-live="polite"></div><p class="gxcuelbl">골라봄 해설 자막 · 큐레이터의 말을 재생 시간에 맞춰 띄웁니다</p>` : ''}
      <div class="gxprog" role="group" aria-label="전시 순서">${works.map((x, k) => `<button data-go="${k}" class="${k < i ? 'done' : k === i ? 'on' : ''}" title="${two(k + 1)} ${esc(x.ko || x.title)}" aria-label="${k + 1}번 작품"></button>`).join('')}</div>
      <p class="gxprogt"><span><b>${two(i + 1)}</b> / ${two(works.length)}${rest ? ` · 끝까지 약 ${hm(rest)}` : ''}</span><button class="gxauto" data-auto aria-pressed="${autoOn()}">이어 보기 ${autoOn() ? '켬' : '끔'}</button></p>
      <div class="gxplacard">
        <span class="gxn">${two(i + 1)}<small>/${two(works.length)}</small></span>
        <div>
          <p class="gxt">${esc(w.ko || w.title)}</p>
          ${w.ko ? `<p class="gxorig">${esc(w.title)}</p>` : ''}
          <p class="gxby">${byLine(w)}${w.sec ? ` · ${minutes(w.sec)}` : ''} · <span class="gxplat inline">${esc(pname(w.platform))}</span> ${ccBadge(w)}</p>
          ${w.note ? `<p class="gxnote">${esc(w.note)}</p>` : ''}${ccHint(w)}
        </div>
      </div>
      <div class="gxnav">
        <button data-go="${i - 1}" ${i ? '' : 'disabled'}>← 이전 작품</button>
        <button data-go="${i + 1}" ${i + 1 < works.length ? '' : 'disabled'}>다음 작품 →</button>
        <button class="gxclose" data-close>전시실로 ✕</button>
      </div>
      ${digBlock(w, i, g, esc)}`;
  posSet(g.id, i);
  const go = j => theater(works, j, g, {esc, track});
  // 다음 작품 안내: 명판을 보여 주고 n초 뒤 넘어간다. 마지막 작품 뒤에는 나가는 말에서 멈춘다(다음 관으로 넘어가지 않는다).
  const countdown = (sec, head) => {
    const n = works[i + 1];
    let left = sec;
    nextBox.innerHTML = `<p class="gxnk">${head} · <b>${left}</b>초 뒤 다음 작품</p><p class="gxnt">${two(i + 2)} ${esc(n.ko || n.title)}</p>${n.note ? `<p class="gxnn">${esc(n.note)}</p>` : ''}
      <div class="gxnb"><button data-go="${i + 1}">바로 보기</button><button data-stay>여기서 멈추기</button></div>`;
    nextBox.hidden = false;
    clearInterval(wait);
    wait = setInterval(() => { left -= 1; const b = nextBox.querySelector('.gxnk b'); if (b) b.textContent = left; if (left <= 0) { clearInterval(wait); go(i + 1); } }, 1000);
  };
  const finish = () => {
    posSet(g.id, 0);
    nextBox.innerHTML = `<p class="gxnk">관람을 마쳤습니다</p>${g.outro ? `<p class="gxnn">${esc(g.outro)}</p>` : ''}<div class="gxnb"><button data-go="0">처음부터 다시</button><button data-close>전시실로</button></div>`;
    nextBox.hidden = false;
  };
  const onEnd = ({guess} = {}) => {
    if (!autoOn()) return;
    track('gallery-ended', `${g.id}:${i + 1}`);
    if (i + 1 >= works.length) return finish();
    guess ? countdown(15, '작품 길이가 다 되었습니다') : countdown(8, '끝');
  };
  const onError = code => {
    track('gallery-error', `${g.id}:${w.id}:${code}`);
    if (w.platform === 'youtube') markBad(w.id);
    const link = w.platform === 'youtube' ? `<a class="gxnlink" href="https://www.youtube.com/watch?v=${esc(w.id)}" target="_blank" rel="noopener">YouTube 에서 보기 ↗</a>` : '';
    if (autoOn() && i + 1 < works.length) { countdown(5, '이 작품은 지금 여기서 재생되지 않습니다'); nextBox.insertAdjacentHTML('beforeend', link); }
    else { nextBox.innerHTML = `<p class="gxnk">이 작품은 지금 여기서 재생되지 않습니다</p>${link}`; nextBox.hidden = false; }
  };
  let resume = null;
  const onBlocked = (play, muted) => {
    resume = play;
    nextBox.innerHTML = muted
      ? `<p class="gxnk">브라우저 규칙 때문에 소리 없이 재생하고 있습니다</p><div class="gxnb"><button data-resume>🔊 소리 켜기</button></div>`
      : `<p class="gxnk">재생이 시작되지 않았습니다</p><p class="gxnn">브라우저가 자동 재생을 막았거나, 올린 사람·저작권자가 다른 사이트에서의 재생을 막아 둔 영상일 수 있습니다.</p><div class="gxnb"><button data-resume>▶ 눌러서 재생</button></div>${ytLink(w)}`;
    nextBox.hidden = false;
    track('gallery-blocked', `${g.id}:${i + 1}:${muted ? 'muted' : 'stopped'}`);
  };
  mountPlayer(el, w, esc, {onEnd, onError, onBlocked});
  const close = () => {
    clearInterval(wait); cueStop?.(); cueStop = null; ytKill(); T?.lock?.release().catch(() => {}); el.remove(); T = null; offKey?.(); offKey = null;
    if (location.hash.startsWith('#/d')) dispatchEvent(new HashChangeEvent('hashchange'));   // 깊이 파기 화면: 담은 영상 · 지나온 길을 새로 그린다
  };
  const onKey = e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' && i + 1 < works.length) go(i + 1);
    else if (e.key === 'ArrowLeft' && i > 0) go(i - 1);
  };
  document.addEventListener('keydown', onKey);
  offKey = () => document.removeEventListener('keydown', onKey);
  el.onclick = e => {
    if (e.target === el || e.target.closest('[data-close]')) return close();
    if (e.target.closest('[data-stay]')) { clearInterval(wait); nextBox.hidden = true; return; }
    if (e.target.closest('[data-resume]')) {
      resume?.(); nextBox.hidden = true;
      // 눌러도 5초 안에 시작하지 않으면: 다른 사이트 재생이 막힌 영상 → 알리고, 실타래 갈래에서 다음부터 뺀다
      if (w.platform === 'youtube') setTimeout(() => { try { if (T?.el === el && YTP?.getVideoData?.().video_id === w.id && ![1, 3].includes(YTP.getPlayerState())) {
        markBad(w.id); track('gallery-unplayable', w.id);
        nextBox.innerHTML = `<p class="gxnk">이 영상은 골라봄에서 재생할 수 없습니다</p><p class="gxnn">올린 사람이나 저작권자가 다른 사이트에서의 재생을 막아 둔 영상입니다.</p>${ytLink(w)}`; nextBox.hidden = false;
      } } catch {} }, 5000);
      return;
    }
    const a = e.target.closest('[data-auto]');
    if (a) { setAuto(!autoOn()); a.setAttribute('aria-pressed', autoOn()); a.textContent = `이어 보기 ${autoOn() ? '켬' : '끔'}`; if (!autoOn()) { clearInterval(wait); nextBox.hidden = true; } track('gallery-auto', String(autoOn())); return; }
    if (e.target.closest('[data-dig]')) return digOpen(el.querySelector('.gxdigbox'), w, esc, track);
    if (e.target.closest('[data-digmore]')) return digPage(el.querySelector('.gxdigbox'), w, esc, 1);
    if (e.target.closest('[data-home]')) { clearInterval(wait); const h = DIG.home; track('dig-home', `${DIG.works.length}`); return h ? theater(h.works, h.i, h.g, {esc, track}) : close(); }
    const hs = e.target.closest('[data-hshare]');
    if (hs) return shareHall(g, hs, track);
    const sv = e.target.closest('[data-save]');
    if (sv) { const on = toggleSaved(w); sv.setAttribute('aria-pressed', on); sv.textContent = on ? '♥ 담아 둠' : '♡ 담기'; track(on ? 'dig-save' : 'dig-unsave', w.id); return; }
    const pk = e.target.closest('[data-pick]');
    if (pk) {
      clearInterval(wait);
      const v = DIGVIEW.list[+pk.dataset.pick];
      if (g !== DIG?.g) DIG = {g: {id: 'dig', title: '실타래', outro: '더 파고들려면 아래 「🧶 여기서 더 파기」를 누르세요.'}, works: [w], home: g.id === 'deep' ? null : {works, i, g}, from: g.title, key: Date.now()};
      else DIG.works = DIG.works.slice(0, i + 1);           // 지나온 길 중간에서 새 갈래를 고르면 그 뒤는 버린다
      DIG.works.push({platform: 'youtube', id: v.id, title: v.title, channel: v.channel, sec: v.sec, thumb: v.thumb,
        note: `실타래 · 같은 채널 · 「${w.ko || w.title}」에서 이어짐`});
      track('dig-pick', `${w.id}>${v.id}:${DIG.works.length}`);
      savePath();
      return theater(DIG.works, DIG.works.length - 1, DIG.g, {esc, track});
    }
    const b = e.target.closest('[data-go]');
    if (b && !b.disabled) { clearInterval(wait); go(+b.dataset.go); }
  };
}

// ── 실타래 파기(시범 · 11-01): 보던 영상에서 갈래를 열고, 고르면 그 자리에서 이어 본다 ─────────
//   첫 갈래만: 같은 채널의 다른 영상(Worker /thread · 검색 없이 4단위). 지나온 길은 관람실 위 진행 막대와 「지나온 길」 줄에 남는다.
let DIG = null;                                            // {g, works: 지나온 길, home: {works, i, g} 출발한 관}
let DIGVIEW = {id: '', list: [], page: 0};
const DIGCACHE = {};
function digBlock(w, i, g, esc) {
  const inDig = DIG && g === DIG.g;
  const path = inDig ? `<p class="gxpath"><span>🧶 지나온 길</span>${DIG.works.map((x, k) => k === i ? `<b>${esc(x.ko || x.title)}</b>` : `<button data-go="${k}">${esc(x.ko || x.title)}</button>`).join('<i>→</i>')}
      <button class="gxhome" data-home>「${esc(DIG.home ? DIG.home.g.title : '깊이 파기')}」로 돌아가기</button></p>` : '';
  const can = w.platform === 'youtube' && CONFIG.searchApi, on = isSaved(w);
  return `<div class="gxdig">${path}<div class="gxdigrow">${can ? `<button class="gxdigbtn" data-dig>🧶 여기서 더 파기</button>` : ''}<button class="gxsave" data-save aria-pressed="${on}">${on ? '♥ 담아 둠' : '♡ 담기'}</button>${g.no ? '<button class="gxsave" data-hshare>↗ 이 관 공유</button>' : ''}</div>${can ? '<div class="gxdigbox" hidden></div>' : ''}</div>`;
}
async function digOpen(box, w, esc, track) {
  if (!box) return;
  box.hidden = false;
  track('dig-open', w.id);
  if (!DIGCACHE[w.id]) {
    box.innerHTML = '<p class="gxdigs">갈래를 찾고 있어요…</p>';
    try {
      const r = await fetch(`${CONFIG.searchApi}/thread?v=${encodeURIComponent(w.id)}`);
      const d = await r.json();
      if (!r.ok) { box.innerHTML = `<p class="gxdigs">${esc(d.message || (r.status === 404 ? '실타래 파기는 아직 준비 중이에요.' : '지금은 갈래를 열 수 없어요. 잠시 뒤 다시 눌러 주세요.'))}</p>`; return; }
      DIGCACHE[w.id] = d;
    } catch { box.innerHTML = '<p class="gxdigs">지금은 갈래를 열 수 없어요. 잠시 뒤 다시 눌러 주세요.</p>'; return; }
  }
  const bad = badSet();
  DIGVIEW = {id: w.id, list: (DIGCACHE[w.id].videos || []).filter(v => !bad.has(v.id)), page: 0};
  digPage(box, w, esc, 0);
  box.scrollIntoView({block: 'nearest', behavior: 'smooth'});   // 맨 아래에서 열리므로 세 편이 화면에 들어오게
}
// 재생이 막힌 YouTube 영상: 이 브라우저에 기억해 두고 실타래 갈래에서 뺀다(서버가 미리 알 방법이 없다)
const BAD_KEY = 'glb_bad_yt';
export const badSet = () => { try { return new Set(JSON.parse(localStorage.getItem(BAD_KEY)) || []); } catch { return new Set(); } };
export function markBad(id) { const b = badSet(); b.add(id); try { localStorage.setItem(BAD_KEY, JSON.stringify([...b].slice(-300))); } catch {} }
const ytLink = w => w.platform === 'youtube' ? `<a class="gxnlink" href="https://www.youtube.com/watch?v=${esc0(w.id)}" target="_blank" rel="noopener">YouTube 에서 보기 ↗</a>` : '';
const WHY = {linked: '설명란에서 이음', series: '같은 시리즈', near: '같은 대상', meaning: '뜻이 가까움', channel: '같은 채널'};
const short = n => n >= 1e4 ? `${Math.round(n / 1e3) / 10}만` : n >= 1e3 ? `${Math.round(n / 100) / 10}천` : String(n);
function digPage(box, w, esc, step) {
  const d = DIGCACHE[w.id], L = DIGVIEW.list;
  if (!d || !box) return;
  if (!L.length) { box.innerHTML = `<p class="gxdigs">이 영상과 이어진 영상을 찾지 못했어요. 관계 없는 영상으로 채우지는 않습니다.</p>`; return; }
  const pages = Math.ceil(L.length / 3);
  DIGVIEW.page = (DIGVIEW.page + step) % pages;
  const k0 = DIGVIEW.page * 3;
  box.innerHTML = `
    <p class="gxdigh">이어진 영상 ${L.length}편 · 출발 ${esc(d.channel)}${d.subs ? ` · 구독자 ${short(d.subs)}` : ''}</p>
    <p class="gxdigs">이 영상과 관계가 있는 것만 냅니다. 만든 사람이 이은 것, 같은 시리즈, 같은 대상, 뜻이 가까운 것 순서입니다.</p>
    <ol class="gxdigl">${L.slice(k0, k0 + 3).map((v, n) => `<li><button data-pick="${k0 + n}">
      <span class="gxweekc" style="background-image:url('${esc(v.thumb)}')"></span>
      <span class="gxweekt">${esc(v.title)}</span>
      ${WHY[v.why] ? `<span class="gxwhy" title="${esc(v.series || '')}">${WHY[v.why]}</span>` : ''}
      <span class="gxweeka">${minutes(v.sec)}${v.likeRatio ? ` · 좋아요 ${(v.likeRatio * 100).toFixed(1)}%` : ''}</span></button></li>`).join('')}</ol>
    <div class="gxdigf">${pages > 1 ? `<button data-digmore>다른 3편 (${DIGVIEW.page + 1}/${pages})</button>` : ''}</div>`;
}


// ── 실타래의 집(깊이 파기 메뉴)과 잇기: 담아 둔 영상 · 지나온 길을 이 브라우저에 남긴다 ──────────
const LS = {get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }};
const slim = w => ({platform: w.platform, id: w.id, title: w.ko || w.title, channel: w.channel || '', sec: w.sec || 0, thumb: thumbOf(w)});
export const digSaved = () => LS.get('glb_dig_saved', []);
const isSaved = w => digSaved().some(x => x.platform === w.platform && x.id === w.id);
function toggleSaved(w) {
  const L = digSaved(), on = !isSaved(w);
  LS.set('glb_dig_saved', on ? [{...slim(w), at: Date.now()}, ...L].slice(0, 100) : L.filter(x => !(x.platform === w.platform && x.id === w.id)));
  return on;
}
export const digPaths = () => LS.get('glb_dig_paths', []);
function savePath() {                                      // 두 편 이상 이어 본 길만 남긴다(최근 20개)
  if (!DIG || DIG.works.length < 2) return;
  const rest = digPaths().filter(p => p.key !== DIG.key);
  LS.set('glb_dig_paths', [{key: DIG.key, at: Date.now(), from: DIG.from || '', works: DIG.works.map(slim)}, ...rest].slice(0, 20));
}
export const digHalls = () => LS.get('glb_dig_halls', []);
const isHallKept = id => digHalls().some(h => h.id === id);
function toggleHall(g, works) {
  const L = digHalls(), on = !isHallKept(g.id);
  LS.set('glb_dig_halls', on ? [{id: g.id, no: g.no, title: g.title, sub: g.sub || '', count: works.length, cover: thumbOf(works[0] || {}), at: Date.now()}, ...L].slice(0, 60) : L.filter(h => h.id !== g.id));
  return on;
}
export function digForget(kind, key) {
  if (kind === 'hall') return LS.set('glb_dig_halls', digHalls().filter(h => h.id !== key));
  if (kind === 'path') LS.set('glb_dig_paths', digPaths().filter(p => String(p.key) !== String(key)));
  else LS.set('glb_dig_saved', digSaved().filter(x => `${x.platform}:${x.id}` !== key));
}
// 깊이 파기 화면에서 관람실 열기: 영상 하나(담은 영상 · 보석)에서 시작하거나, 지나온 길의 끝에서 이어 판다
export function openDig(works, i, {esc, track, path, open}) {   // open: 갈래를 바로 펼친다(트렌드·찾기 플레이어의 「여기서 더 파기」)
  if (path) {
    DIG = {g: {id: 'dig', title: '실타래', outro: '더 파고들려면 아래 「🧶 여기서 더 파기」를 누르세요.'}, works: path.works, home: null, from: path.from, key: path.key};
    theater(DIG.works, DIG.works.length - 1, DIG.g, {esc, track});
    const box = T?.el.querySelector('.gxdigbox');
    if (box) digOpen(box, DIG.works.at(-1), esc, track);    // 이어 파기: 마지막 영상의 갈래를 열어 둔 채로
    return;
  }
  theater(works, i, {id: 'deep', title: '깊이 파기', outro: '마음에 들었다면 아래 「♡ 담기」나 「🧶 여기서 더 파기」를 눌러 보세요.'}, {esc, track});
  if (open) { const box = T?.el.querySelector('.gxdigbox'); if (box) digOpen(box, works[i], esc, track); }
}
