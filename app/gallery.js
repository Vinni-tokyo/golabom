// 골라봄 명작 갤러리 — 「영상의 명품관」. 여러 플랫폼에서 고른 영상을 테마 전시관으로 건다.
// 원칙: 영상을 내려받거나 다시 올리지 않는다. 각 플랫폼의 공식 퍼가기로만 재생한다.
//      카드마다 출처 플랫폼을 따로 표시한다(YouTube 개발자 정책 III.F.2).
// 데이터: data/gallery/index.json(층별 안내) · data/gallery/<id>.json(전시관 하나)
//   작품: {platform, id, title, channel, sec, thumb, note, license}  license = commercial-ok | nc-only | yt-api

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
const ccHint = w => {
  if (w.speech) return /^(일본어|영어)/.test(w.speech) && !/화면에/.test(w.speech) && w.platform === 'youtube'
    ? `<p class="gxcchint">한국어로 보려면 플레이어 톱니 ⚙ → 자막 → 자동 번역 → 한국어</p>` : '';
  return CC[w.cc]?.[1] ? `<p class="gxcchint">${esc0(CC[w.cc][1])}</p>` : '';
};
const two = n => String(n).padStart(2, '0');

// 갈래: 층별 안내에서 전시관을 묶는 순서와 안내문
const GENRES = [
  ['감동', '마음이 움직이는 전시관', '유대가 깊어지는 순간을 모았습니다. 재회, 헌신, 스승, 부모, 마지막.'],
  ['학습', '배우는 전시관', '거장의 수업과 원리의 설명. 한 번 알고 나면 다시는 예전처럼 보이지 않는 것들.'],
  ['발견', '처음 보는 전시관', '손과 지구와 무대와 공간. 어디서도 모아 보지 못한 것들.'],
  ['인물·시대', '한 사람, 한 시대', '이미 사랑하는 것을 더 깊이.'],
  ['책', '책관', '한 권의 줄기를 따라 영상으로 사유합니다.'],
  ['기능', '이럴 때 보는 전시관', '잠들기 전, 가는 길에, 아이와 함께. 시간과 자리에 맞춰 고른 관.'],
  ['이슈', '세상 이슈', '한 문제를 여러 쪽에서 비춥니다. 결론 대신 질문을 겁니다.'],
  ['19', '19', '몸과 금기, 검열. 미술관과 영화제의 공식 자료로만, 19세 이상만.'],
];
// 문(門): 같은 관을 네 가지 지도로 묶어 보여 준다. 기본은 갈래.
const DOORS = [['genre', '갈래'], ['term', '사람 공부'], ['use', '지금 기분·상황'], ['issue', '세상 이슈']];
const doorOf = () => { try { return localStorage.getItem('glb_gx_door') || 'genre'; } catch { return 'genre'; } };
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
  const idx = await load('data/gallery/index.json');
  document.body.className = 'gx';
  track('gallery-index');
  const list = idx?.galleries || [];
  const D = idx?.doors || {};
  const byId = Object.fromEntries(list.map(g => [g.id, g]));
  const halls = ids => (ids || []).map(i => byId[i]).filter(Boolean);
  const sec = (name, lead, gs, kick = '') => gs.length ? `
      <section class="gxgenre">${kick ? `<p class="gxkick">${esc(kick)}</p>` : ''}<h2>${esc(name)}</h2><p>${esc(lead)}</p>
      <div class="gxhalls">${gs.map(g => roomCard(g, esc)).join('')}</div></section>` : '';
  const views = {
    genre: () => GENRES.map(([k, name, lead]) => sec(name, lead, list.filter(g => g.genre === k))).join('')
      + sec('그 밖의 관', '', list.filter(g => !GENRES.some(([k]) => k === g.genre))),
    term: () => `<p class="gxlead">${esc(D.program?.sub || '')}</p>`
      + (D.terms || []).map((t, n) => sec(t.name, t.sub, halls(t.halls), `${n + 1}학기`)).join('')
      + (D.electives ? sec(D.electives.name, D.electives.sub, halls(D.electives.halls)) : ''),
    use: () => (D.uses || []).map(u => sec(u.name, u.sub, halls(u.halls))).join(''),
    issue: () => `<p class="gxlead">결론 대신 여러 목소리를 나란히 겁니다.</p>`
      + (D.issues || []).map(i => sec(i.name, i.sub, halls(i.halls))).join(''),
  };
  const paint = door => {
    try { localStorage.setItem('glb_gx_door', door); } catch {}
    app.querySelectorAll('.gxdoor button').forEach(b => b.classList.toggle('on', b.dataset.door === door));
    app.querySelector('#gxrooms').innerHTML = (views[door] || views.genre)() || '<p class="gxlead">전시를 준비하고 있습니다.</p>';
  };
  app.innerHTML = `
    <div class="gxwrap">
      <header class="gxhall">
        <p class="gxkick">GOLABOM MAISON</p>
        <h1>명품관</h1>
        <p class="gxlead">다시 볼 이유가 있는 영상만 걸었습니다.</p>
      </header>
      <nav class="gxdoor">${DOORS.map(([k, n]) => `<button type="button" data-door="${k}">${esc(n)}</button>`).join('')}</nav>
      <div id="gxrooms"></div>
      <p class="gxfoot">골라봄은 영상을 내려받지 않습니다. 모든 작품은 각 플랫폼의 공식 플레이어로 재생됩니다.</p>
    </div>`;
  app.querySelector('.gxdoor').addEventListener('click', e => {
    const b = e.target.closest('button[data-door]');
    if (b) { paint(b.dataset.door); track('gallery-door-' + b.dataset.door); }
  });
  paint(doorOf());
}

// 막(幕): g.acts = [{start: 작품 번호(0부터), title, lead}] — 그 작품 앞에 머리글을 둔다
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
function actHead(g, i, esc) {
  const k = (g.acts || []).findIndex(a => a.start === i);
  if (k < 0) return '';
  const a = g.acts[k];
  return `<li class="gxact"><span class="gxkick">${ROMAN[k] || k + 1}</span><h3>${esc(a.title)}</h3>${a.lead ? `<p>${esc(a.lead)}</p>` : ''}</li>`;
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
        <div class="gxacts">${g.tour ? `<a class="gxplay" href="#/o/${esc(g.tour.id)}">▶ 하이라이트로 관람 · 약 ${g.tour.minutes}분</a><button class="gxshare" data-w="0">전편으로 처음부터</button>` : '<button class="gxplay" data-w="0">▶ 처음부터 관람하기</button>'}<button class="gxshare" id="gxShare">전시 공유하기</button></div>
        ${g.tour ? `<p class="gxtourhint">${g.tour.stops}장면만 골라 이어 봅니다. 마음에 남는 작품은 아래 목록에서 전편으로.</p>` : ''}
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
              <p class="gxby">${esc(w.channel || '')}${w.sec ? ` · ${minutes(w.sec)}` : ''} · ${esc(pname(w.platform))} ${ccBadge(w)}</p>
              ${w.note ? `<p class="gxnote">${esc(w.note)}</p>` : ''}
            </div>
          </div>
        </li>`).join('')}
      </ol>
      ${g.outro ? `<div class="gxoutro"><p class="gxkick">나가며</p><p>${esc(g.outro)}</p></div>` : ''}
      <p class="gxfoot">모든 작품은 각 플랫폼의 공식 플레이어로 재생됩니다. 저작권은 원작자에게 있습니다.</p>
    </div>`;
  app.querySelectorAll('img[data-fallback]').forEach(img => img.onerror = () => { if (img.src !== img.dataset.fallback) img.src = img.dataset.fallback; });
  // YouTube 는 고화질이 없을 때 404 대신 회색 120px 그림을 줄 때가 있다
  app.querySelectorAll('img[data-fallback]').forEach(img => img.onload = () => { if (img.naturalWidth <= 120 && img.src !== img.dataset.fallback) img.src = img.dataset.fallback; });
  app.querySelectorAll('[data-w]').forEach(b => b.onclick = () => theater(works, +b.dataset.w, g, {esc, track}));
  bindShare(app, g, {track});
}

function bindShare(app, g, {track}) {
  const btn = app.querySelector('#gxShare');
  btn.onclick = async () => {
    const url = location.origin + location.pathname + '#/g/' + g.id;
    track('gallery-share', g.id);
    try {
      if (navigator.share) await navigator.share({title: `골라봄 명품관 · ${g.title}`, url});
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

// 플레이어에 붙기: 해설 자막(cues) 시간 맞추기 · 끝났을 때 알리기(onEnd) · 자막기. YouTube·Vimeo 만 신호를 준다.
function mountPlayer(stage, w, esc, {onEnd}) {
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
    const host = document.createElement('div'); screen.innerHTML = ''; screen.append(host);
    let player = null, timer = null;
    loadYT().then(YT => {
      if (!alive) return;
      player = new YT.Player(host, {host: 'https://www.youtube.com', videoId: w.id,
        playerVars: {autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, hl: 'ko', cc_load_policy: 1, cc_lang_pref: 'ko'},
        events: {onReady: () => { if (cues.length) timer = setInterval(() => { try { show(player.getCurrentTime()); } catch {} }, 500); },
                 onStateChange: e => { if (e.data === 0) onEnd(); }}});
    });
    cueStop = () => { alive = false; clearInterval(timer); try { player?.destroy(); } catch {} };
  } else if (w.platform === 'vimeo') {
    const sub = stage.querySelector('.gxccbox');
    let player = null;
    loadVimeo().then(async V => {
      if (!alive) return;
      player = new V.Player(screen.querySelector('iframe'));
      // 올린 사람이 「반복 재생」으로 둔 작품은 끝 신호 없이 처음으로 돌아간다 → 끝 근처에서 처음으로 되감기면 끝으로 본다
      let last = 0, done = false;
      const end = () => { if (!done) { done = true; onEnd(); } };
      player.on('timeupdate', d => { show(d.seconds); if (d.duration && last > d.duration - 2 && d.seconds < 1) end(); last = d.seconds; });
      player.on('ended', end);
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
    cueStop = () => { alive = false; try { player?.off('timeupdate'); player?.off('ended'); player?.off('cuechange'); player?.off('play'); } catch {} };
  }
}
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ── 관람실: 한 작품씩 크게. 이전·다음으로 이어 본다 ─────────────────────
const autoOn = () => { try { return localStorage.getItem('glb_gx_auto') !== '0'; } catch { return true; } };   // 기본 켬
const setAuto = v => { try { localStorage.setItem('glb_gx_auto', v ? '1' : '0'); } catch {} };
let wait = null;      // 이어 보기 카운트다운(관람실이 바뀌면 지운다)
let PLAYED = 0;        // 이번 방문에서 재생한 작품 수(3편 이상이면 「둘러보는 즐거움」 신호)
let offKey = null;     // 지금 열린 관람실의 키 처리기를 지우는 함수
function theater(works, i, g, {esc, track}) {
  document.querySelector('.gxtheater')?.remove(); offKey?.(); cueStop?.(); cueStop = null; clearInterval(wait);
  const w = works[i], P = PLATFORM[w.platform];
  if (++PLAYED === 3) track('gallery-3plays', g.id);
  track('gallery-play', `${g.id}:${w.platform}:${w.id}`);
  const el = document.createElement('div');
  el.className = 'gxtheater';
  el.innerHTML = `
    <div class="gxstage" role="dialog" aria-modal="true" aria-label="${esc(w.title)}">
      <div class="gxscreen${P?.tall ? ' tall' : ''}">${P ? `<iframe src="${esc(P.embed(w.id))}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="${esc(w.title)}"></iframe>` : ''}</div>
      <div class="gxnext" hidden></div>
      ${w.platform === 'vimeo' ? `<div class="gxccbox" hidden><p class="gxsubko" aria-live="polite"></p><p class="gxcuelbl">골라봄 자막기 · 플레이어 자막을 이 브라우저 안에서 한국어로 옮깁니다(기계 번역)</p></div>` : ''}
      ${w.cues?.length ? `<div class="gxcue" aria-live="polite"></div><p class="gxcuelbl">골라봄 해설 자막 · 큐레이터의 말을 재생 시간에 맞춰 띄웁니다</p>` : ''}

      <div class="gxplacard">
        <span class="gxn">${two(i + 1)}<small>/${two(works.length)}</small></span>
        <div>
          <p class="gxt">${esc(w.ko || w.title)}</p>
          ${w.ko ? `<p class="gxorig">${esc(w.title)}</p>` : ''}
          <p class="gxby">${esc(w.channel || '')}${w.sec ? ` · ${minutes(w.sec)}` : ''} · <span class="gxplat inline">${esc(pname(w.platform))}</span> ${ccBadge(w)}</p>
          ${w.note ? `<p class="gxnote">${esc(w.note)}</p>` : ''}${ccHint(w)}
        </div>
      </div>
      <div class="gxnav">
        <button data-go="${i - 1}" ${i ? '' : 'disabled'}>← 이전 작품</button>
        <button class="gxclose" data-close>전시실로 ✕</button>
        <button class="gxauto" data-auto aria-pressed="${autoOn()}">이어 보기 ${autoOn() ? '켬' : '끔'}</button>
        <button data-go="${i + 1}" ${i + 1 < works.length ? '' : 'disabled'}>다음 작품 →</button>
      </div>
    </div>`;
  document.body.append(el);
  const go = j => theater(works, j, g, {esc, track});
  // 이어 보기: 끝나면 다음 작품의 명판을 8초 보여 준 뒤 넘어간다. 마지막 작품 뒤에는 나가는 말에서 멈춘다(다음 관으로 넘어가지 않는다).
  const nextBox = el.querySelector('.gxnext');
  const onEnd = () => {
    if (!autoOn()) return;
    track('gallery-ended', `${g.id}:${i + 1}`);
    if (i + 1 >= works.length) {
      nextBox.innerHTML = `<p class="gxnk">관람을 마쳤습니다</p>${g.outro ? `<p class="gxnn">${esc(g.outro)}</p>` : ''}<div class="gxnb"><button data-close>전시실로</button></div>`;
      nextBox.hidden = false; return;
    }
    const n = works[i + 1];
    let left = 8;
    nextBox.innerHTML = `<p class="gxnk">다음 작품 · <b>${left}</b>초 뒤</p><p class="gxnt">${two(i + 2)} ${esc(n.ko || n.title)}</p>${n.note ? `<p class="gxnn">${esc(n.note)}</p>` : ''}
      <div class="gxnb"><button data-go="${i + 1}">바로 보기</button><button data-stay>여기서 멈추기</button></div>`;
    nextBox.hidden = false;
    wait = setInterval(() => { left -= 1; const b = nextBox.querySelector('.gxnk b'); if (b) b.textContent = left; if (left <= 0) { clearInterval(wait); go(i + 1); } }, 1000);
  };
  mountPlayer(el, w, esc, {onEnd});
  const close = () => { clearInterval(wait); cueStop?.(); cueStop = null; el.remove(); offKey?.(); offKey = null; };
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
    const a = e.target.closest('[data-auto]');
    if (a) { setAuto(!autoOn()); a.setAttribute('aria-pressed', autoOn()); a.textContent = `이어 보기 ${autoOn() ? '켬' : '끔'}`; if (!autoOn()) { clearInterval(wait); nextBox.hidden = true; } track('gallery-auto', String(autoOn())); return; }
    const b = e.target.closest('[data-go]');
    if (b && !b.disabled) { clearInterval(wait); go(+b.dataset.go); }
  };
}
