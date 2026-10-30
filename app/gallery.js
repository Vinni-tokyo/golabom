// 골라봄 명작 갤러리 — 「영상의 명품관」. 여러 플랫폼에서 고른 영상을 테마 전시관으로 건다.
// 원칙: 영상을 내려받거나 다시 올리지 않는다. 각 플랫폼의 공식 퍼가기로만 재생한다.
//      카드마다 출처 플랫폼을 따로 표시한다(YouTube 개발자 정책 III.F.2).
// 데이터: data/gallery/index.json(층별 안내) · data/gallery/<id>.json(전시관 하나)
//   작품: {platform, id, title, channel, sec, thumb, note, license}  license = commercial-ok | nc-only | yt-api

const PLATFORM = {
  // 자막: 각 플랫폼 플레이어의 공식 설정으로 켠다(한국어 우선). 자막 파일을 만들거나 플레이어 위에 덮지 않는다.
  youtube: {name: 'YouTube', embed: id => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&hl=ko&cc_load_policy=1&cc_lang_pref=ko`,
    thumb: id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`},
  vimeo: {name: 'Vimeo', embed: id => `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1&title=0&byline=0&texttrack=ko`},
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
const CC = {ko: ['한국어 자막', ''], yes: ['자막 · 한국어 자동 번역', '자막이 다른 언어로 나오면 플레이어 톱니 ⚙ → 자막 → 자동 번역 → 한국어'], auto: ['자동 자막', '플레이어 톱니 ⚙ → 자막 → 자동 번역 → 한국어']};
const esc0 = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const ccBadge = w => CC[w.cc] ? `<span class="gxcc" title="${esc0(CC[w.cc][1])}">${CC[w.cc][0]}</span>` : '';
const ccHint = w => CC[w.cc]?.[1] ? `<p class="gxcchint">${esc0(CC[w.cc][1])}</p>` : '';
const two = n => String(n).padStart(2, '0');

// ── 층별 안내: 전시관 목록 ─────────────────────────────────────────
export async function galleryIndex(app, {esc, track, load}) {
  const idx = await load('data/gallery/index.json');
  document.body.className = 'gx';
  track('gallery-index');
  const list = idx?.galleries || [];
  app.innerHTML = `
    <div class="gxwrap">
      <a class="gxback" href="#/">← 골라봄</a>
      <header class="gxhall">
        <p class="gxkick">GOLABOM GALLERY</p>
        <h1>명작 갤러리</h1>
        <p class="gxlead">수백억 편의 영상 가운데, 다시 볼 이유가 있는 것만 걸었습니다.<br>플랫폼은 가리지 않습니다. 기준은 하나, 명작인가.</p>
      </header>
      <div class="gxhalls">${list.map(g => `
        <a class="gxroom" href="#/g/${esc(g.id)}">
          <span class="gxcov" style="background-image:url('${esc(g.cover || '')}')"></span>
          <span class="gxno">No.${two(g.no)}</span>
          <span class="gxname">${esc(g.title)}</span>
          <span class="gxsub">${esc(g.sub)}</span>
          <span class="gxmeta">${g.count}점 · ${(g.platforms || []).map(pname).join(' · ')}</span>
        </a>`).join('') || '<p class="gxlead">전시를 준비하고 있습니다.</p>'}
      </div>
      <p class="gxfoot">골라봄은 영상을 내려받지 않습니다. 모든 작품은 각 플랫폼의 공식 플레이어로 재생됩니다.</p>
    </div>`;
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
export async function gallery(app, id, {esc, track, load, store}) {
  const g = await load(`data/gallery/${id}.json`);
  if (!g) { location.hash = '#/g'; return; }
  document.body.className = 'gx';
  const works = g.works || [];
  const platforms = [...new Set(works.map(w => w.platform))];
  // 재방문: 이 전시관을 「다른 날」 다시 열었는가(리저브 링크로 들어온 날은 빼고 센다)
  const today = new Date().toISOString().slice(0, 10), seen = store.get('gx_seen', {});
  if (seen[id] && seen[id] !== today && !location.search.includes('src=r')) track('gallery-return', id);
  seen[id] = today; store.set('gx_seen', seen);
  track('gallery-open', id);

  app.innerHTML = `
    <div class="gxwrap">
      <a class="gxback" href="#/g">← 명작 갤러리</a>
      <header class="gxcover">
        <p class="gxkick">GOLABOM GALLERY · No.${two(g.no)}</p>
        <h1>${esc(g.title)}</h1>
        <p class="gxsubt">${esc(g.sub)}</p>
        ${g.thesis ? `<p class="gxthesis">${esc(g.thesis)}</p>` : ''}
        <p class="gxlead">${esc(g.intro)}</p>
        <p class="gxmeta">${works.length}점 · ${platforms.map(pname).join(' · ')}${g.curator ? ` · 큐레이션 ${esc(g.curator)}` : ''}</p>
        <div class="gxacts"><button class="gxplay" data-w="0">▶ 처음부터 관람하기</button><button class="gxshare" id="gxShare">전시 공유하기</button></div>
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
      if (navigator.share) await navigator.share({title: `골라봄 명작 갤러리 · ${g.title}`, url});
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
let cueStop = null;                 // 지금 관람실의 자막 동기화를 멈추는 함수
function mountCues(stage, w, esc) {
  cueStop?.(); cueStop = null;
  const box = stage.querySelector('.gxcue'), cues = w.cues;
  if (!box || !cues?.length) return;
  let cur = -1;
  const show = t => {
    box.dataset.t = Math.floor(t);                       // 동기화 확인용(현재 초)
    let k = -1; for (let i = 0; i < cues.length; i++) if (t >= cues[i][0]) k = i;
    if (k === cur) return; cur = k;
    box.innerHTML = k < 0 ? '' : `<span class="gxcuet">${mmss(cues[k][0])}</span>${esc(cues[k][1])}`;
    box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
  };
  show(0);
  const screen = stage.querySelector('.gxscreen');
  if (w.platform === 'youtube') {
    const host = document.createElement('div'); screen.innerHTML = ''; screen.append(host);
    let player = null, timer = null;
    loadYT().then(YT => {
      player = new YT.Player(host, {host: 'https://www.youtube-nocookie.com', videoId: w.id,
        playerVars: {autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, hl: 'ko', cc_load_policy: 1, cc_lang_pref: 'ko'},
        events: {onReady: () => { timer = setInterval(() => { try { show(player.getCurrentTime()); } catch {} }, 500); }}});
    });
    cueStop = () => { clearInterval(timer); try { player?.destroy(); } catch {} };
  } else if (w.platform === 'vimeo') {
    const iframe = screen.querySelector('iframe');
    const onMsg = e => {
      if (e.origin !== 'https://player.vimeo.com') return;
      let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      if (d.event === 'ready') sub();
      if ((d.event === 'timeupdate' || d.event === 'playProgress') && d.data?.seconds !== undefined) show(d.data.seconds);   // 플레이어 판에 따라 이름이 다르다
    };
    const sub = () => ['timeupdate', 'playProgress'].forEach(v => iframe.contentWindow.postMessage(JSON.stringify({method: 'addEventListener', value: v}), 'https://player.vimeo.com'));
    addEventListener('message', onMsg);
    iframe.addEventListener('load', sub); sub();
    cueStop = () => removeEventListener('message', onMsg);
  }
}
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ── 관람실: 한 작품씩 크게. 이전·다음으로 이어 본다 ─────────────────────
let PLAYED = 0;        // 이번 방문에서 재생한 작품 수(3편 이상이면 「둘러보는 즐거움」 신호)
let offKey = null;     // 지금 열린 관람실의 키 처리기를 지우는 함수
function theater(works, i, g, {esc, track}) {
  document.querySelector('.gxtheater')?.remove(); offKey?.(); cueStop?.(); cueStop = null;
  const w = works[i], P = PLATFORM[w.platform];
  if (++PLAYED === 3) track('gallery-3plays', g.id);
  track('gallery-play', `${g.id}:${w.platform}:${w.id}`);
  const el = document.createElement('div');
  el.className = 'gxtheater';
  el.innerHTML = `
    <div class="gxstage" role="dialog" aria-modal="true" aria-label="${esc(w.title)}">
      <div class="gxscreen${P?.tall ? ' tall' : ''}">${P ? `<iframe src="${esc(P.embed(w.id))}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="${esc(w.title)}"></iframe>` : ''}</div>
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
        <button data-go="${i + 1}" ${i + 1 < works.length ? '' : 'disabled'}>다음 작품 →</button>
      </div>
    </div>`;
  document.body.append(el);
  mountCues(el, w, esc);
  const go = j => theater(works, j, g, {esc, track});
  const close = () => { cueStop?.(); cueStop = null; el.remove(); offKey?.(); offKey = null; };
  const onKey = e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' && i + 1 < works.length) go(i + 1);
    else if (e.key === 'ArrowLeft' && i > 0) go(i - 1);
  };
  document.addEventListener('keydown', onKey);
  offKey = () => document.removeEventListener('keydown', onKey);
  el.onclick = e => {
    if (e.target === el || e.target.closest('[data-close]')) return close();
    const b = e.target.closest('[data-go]');
    if (b && !b.disabled) go(+b.dataset.go);
  };
}

// ── 홈의 「명작 갤러리」 띠 ─────────────────────────────────────────
export async function galleryBand(box, {esc, load}) {
  const idx = await load('data/gallery/index.json');
  const list = idx?.galleries || [];
  if (!list.length) { box.hidden = true; return; }
  box.innerHTML = `
    <div class="gxbhead"><span class="gxkick">GOLABOM GALLERY</span><a class="gxball" href="#/g">전체 ${list.length}관 보기 →</a></div>
    <p class="gxbtitle">명작 갤러리 <small>다시 볼 이유가 있는 영상만 걸었습니다</small></p>
    <div class="gxbrow">${list.map(g => `
      <a class="gxbcard" href="#/g/${esc(g.id)}">
        <span class="gxcov" style="background-image:url('${esc(g.cover || '')}')"></span>
        <span class="gxno">No.${two(g.no)}</span>
        <span class="gxname">${esc(g.title)}</span>
        <span class="gxmeta">${g.count}점 · 플랫폼 ${(g.platforms || []).length}곳</span>
      </a>`).join('')}
    </div>`;
}
