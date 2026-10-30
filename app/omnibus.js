// 골라봄 옴니버스 · 하이라이트 투어 — 한 테마의 작품들에서 구간을 골라 이야기 카드와 함께 이어서 튼다.
// 지키는 것: 영상을 내려받거나 자르거나 합치지 않는다. 각 플랫폼의 공식 플레이어로 「그 구간만」 차례로 재생한다.
//            카드는 플레이어 위에 덮지 않고, 플레이어와 플레이어 사이에만 둔다. 장면마다 원작과 「전편 보기」를 붙인다.
// 전환: 다음 장면을 보이지 않는 플레이어에 미리 받아 두었다가(YouTube IFrame API cue · Vimeo 정지 상태) 순간에 바꿔 튼다.
//       그래서 장면 사이의 검은 공백이 없다. 이전 플레이어는 장면이 끝나면 지운다.
// 데이터: data/omnibus/<id>.json  chapters = [{card:{kick,title,text,voice?,end?,bridge?,breath?}} | {platform,id,start,end,ko,title,channel,thumb?}]

const PNAME = {youtube: 'YouTube', vimeo: 'Vimeo'};
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const thumbOf = c => c.platform === 'youtube' ? `https://i.ytimg.com/vi/${c.id}/maxresdefault.jpg` : (c.thumb || '');
const readMs = t => Math.min(10000, Math.max(5500, t.replace(/\s/g, '').length * 120 + 2600));   // 읽는 속도로 머무는 시간

export async function omnibus(app, id, {esc, track, load}) {
  const o = await load(`data/omnibus/${id}.json`);
  if (!o) { location.hash = '#/g'; return; }
  document.body.className = 'gx';
  track('omnibus-open', id);
  const scenes = o.chapters.filter(c => !c.card);
  app.innerHTML = `
    <div class="gxwrap">
      <a class="gxback" href="#/g/${esc(o.gallery)}">← ${esc(o.sub.split(' · ')[0])} 전시실</a>
      <header class="gxcover">
        <p class="gxkick">GOLABOM OMNIBUS</p>
        <h1>${esc(o.title)}</h1>
        <p class="gxsubt">${esc(o.sub)}</p>
        <p class="gxlead">${esc(o.intro)}</p>
        <p class="gxmeta">${scenes.length}장면 · 약 ${Math.round(o.runtime / 60)}분 · ${[...new Set(scenes.map(s => PNAME[s.platform]))].join(' · ')}</p>
        <div class="gxacts"><button class="gxplay" id="obStart">▶ 이야기 시작하기</button></div>
      </header>
      <ol class="obline">${o.chapters.map((c, i) => c.card
        ? (c.card.bridge ? '' : `<li class="obcard"><span class="obk">${esc(c.card.kick)}</span><b>${esc(c.card.title)}</b></li>`)
        : `<li class="obscene"><button data-ob="${i}"><span class="obt">${esc(c.ko)}</span><span class="obm">${esc(c.channel)} · ${esc(PNAME[c.platform])} · ${mmss(c.start)}–${mmss(c.end)}</span></button></li>`).join('')}
      </ol>
      <p class="gxfoot">${esc(o.method)}<br>모든 장면은 원작의 공식 플레이어로 재생되며, 조회는 원작자에게 돌아갑니다.</p>
    </div>`;
  app.querySelector('#obStart').onclick = () => stage(o, 0, {esc, track});
  app.querySelectorAll('[data-ob]').forEach(b => b.onclick = () => stage(o, +b.dataset.ob, {esc, track}));
}

// ── 소리: 해설 음성(기기의 한국어 음성) · 배경음(브라우저가 그 자리에서 만드는 소리 — 음원 파일·저작권 없음) ──
const pref = (k, d) => { try { return JSON.parse(localStorage.getItem('glb_ob_' + k)) ?? d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem('glb_ob_' + k, JSON.stringify(v)); } catch {} };
const SND = {voice: pref('voice', true), music: pref('music', true)};
function speak(text, done) {
  if (!SND.voice || !('speechSynthesis' in window)) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\n/g, ' '));
  u.lang = 'ko-KR'; u.rate = 0.9; u.pitch = 0.95;
  const v = speechSynthesis.getVoices().find(v => v.lang.startsWith('ko'));
  if (v) u.voice = v;
  u.onend = () => setTimeout(done, 900);
  speechSynthesis.speak(u);
  return true;
}
let actx = null, pad = null;
function padOn(k = 0) {
  if (!SND.music) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (pad) return;
    const roots = [220, 196, 174.6, 207.7, 185, 233.1];
    const r = roots[k % roots.length], g = actx.createGain(), f = actx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0; f.connect(g); g.connect(actx.destination);
    const osc = [1, 1.2, 1.5, 0.5].map((m, n) => { const o = actx.createOscillator(); o.type = n === 3 ? 'triangle' : 'sine'; o.frequency.value = r * m; o.detune.value = (n - 1.5) * 4; const og = actx.createGain(); og.gain.value = n === 3 ? 0.5 : 0.28; o.connect(og); og.connect(f); o.start(); return o; });
    g.gain.linearRampToValueAtTime(0.0001, actx.currentTime); g.gain.linearRampToValueAtTime(0.09, actx.currentTime + 2.2);
    pad = {g, osc};
  } catch {}
}
function padOff() {
  if (!pad || !actx) return;
  const {g, osc} = pad; pad = null;
  g.gain.cancelScheduledValues(actx.currentTime); g.gain.setValueAtTime(g.gain.value, actx.currentTime); g.gain.linearRampToValueAtTime(0.0001, actx.currentTime + 1.6);
  setTimeout(() => osc.forEach(o => { try { o.stop(); } catch {} }), 1800);
}

// ── 플레이어 덱: 장면마다 플레이어를 미리 만들어 둔다 ─────────────────────────────
let ytApi = null;
const loadYT = () => ytApi ||= new Promise(res => {
  if (window.YT?.Player) return res(window.YT);
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT); };
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) { const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.append(s); }
});
const deck = {slots: new Map(), el: null, onEnd: null, onTime: null};
function deckEl() {
  if (!deck.el) { deck.el = document.createElement('div'); deck.el.className = 'obdeck hid'; }
  return deck.el;
}
function prepare(o, i) {                    // i 번째 장면의 플레이어를 숨겨 둔 채 만든다(이미 있으면 그대로)
  const c = o.chapters[i];
  if (!c || c.card || deck.slots.has(i)) return;
  const slot = document.createElement('div'); slot.className = 'obslot'; slot.dataset.i = i;
  deckEl().append(slot);
  const s = {el: slot, c, kind: c.platform, ready: false, player: null, active: false};
  deck.slots.set(i, s);
  if (c.platform === 'youtube') {
    const host = document.createElement('div'); slot.append(host);
    loadYT().then(YT => {
      s.player = new YT.Player(host, {host: 'https://www.youtube-nocookie.com', videoId: c.id,
        playerVars: {autoplay: 0, controls: 0, playsinline: 1, rel: 0, modestbranding: 1, hl: 'ko', cc_load_policy: 1, cc_lang_pref: 'ko', start: c.start, end: c.end, disablekb: 1},
        events: {
          onReady: () => { s.ready = true; },
          onStateChange: e => { if (e.data === YT.PlayerState.ENDED && deck.onEnd && s.active) deck.onEnd(i); },
        }});
    });
  } else if (c.platform === 'vimeo') {
    const f = document.createElement('iframe');
    f.src = `https://player.vimeo.com/video/${c.id}?autoplay=0&dnt=1&title=0&byline=0&portrait=0&texttrack=ko#t=${c.start}s`;
    f.allow = 'autoplay; fullscreen; encrypted-media'; f.referrerPolicy = 'strict-origin-when-cross-origin'; f.title = c.ko;
    slot.append(f); s.player = f;
    f.addEventListener('load', () => { s.ready = true; f.contentWindow.postMessage(JSON.stringify({method: 'addEventListener', value: 'playProgress'}), 'https://player.vimeo.com'); });
  }
}
function play(i) {
  const s = deck.slots.get(i); if (!s) return;
  s.active = true;
  if (s.kind === 'youtube') { try { s.player.seekTo(s.c.start, true); s.player.playVideo(); } catch {} }
  else if (s.kind === 'vimeo') { try { s.player.contentWindow.postMessage(JSON.stringify({method: 'play'}), 'https://player.vimeo.com'); } catch {} }
}
function dropOthers(keep) {               // 지금 장면과 다음 장면만 남긴다
  for (const [k, s] of deck.slots) if (!keep.includes(k)) { try { s.player?.destroy?.(); } catch {} s.el.remove(); deck.slots.delete(k); }
}
addEventListener('message', e => {        // Vimeo: 구간 끝에 닿으면 다음으로
  if (e.origin !== 'https://player.vimeo.com') return;
  let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
  if (d.event !== 'playProgress' || !deck.onTime) return;
  for (const [i, s] of deck.slots) if (s.active && s.kind === 'vimeo' && e.source === s.player.contentWindow) deck.onTime(i, d.data.seconds);
});

// ── 무대 ─────────────────────────────────────────────────────────
let timer = null, offKey = null;
function stage(o, i, ctx) {
  const {esc, track} = ctx;
  clearTimeout(timer); offKey?.(); try { speechSynthesis.cancel(); } catch {}
  let el = document.querySelector('.obtheater');
  if (deck.el && !document.contains(deck.el)) { dropOthers([]); deck.el = null; }   // 길 안내로 무대가 지워졌으면 덱도 비운다
  if (!el) {
    el = document.createElement('div'); el.className = 'obtheater';
    el.innerHTML = `<div class="obbg"></div><div class="gxstage"><div class="obprog"></div><div class="obscreen"></div><div class="obunder"></div></div>`;
    el.querySelector('.obscreen').append(deckEl());
    document.body.append(el);
  }
  const c = o.chapters[i];
  if (!c) return close();
  const next = () => stage(o, i + 1, ctx), prev = () => stage(o, Math.max(0, i - 1), ctx);
  function close() { clearTimeout(timer); offKey?.(); offKey = null; padOff(); try { speechSynthesis.cancel(); } catch {} deck.onEnd = deck.onTime = null; dropOthers([]); deck.el = null; el.remove(); }
  const nextSceneIdx = o.chapters.findIndex((x, k) => k > i && !x.card);
  const scenes = o.chapters.filter(x => !x.card), sn = o.chapters.slice(0, i + 1).filter(x => !x.card).length;
  el.querySelector('.obprog').innerHTML = `<span>${sn ? `장면 ${sn} / ${scenes.length}` : esc(o.title)}</span><i style="width:${Math.round(i / (o.chapters.length - 1) * 100)}%"></i>`;
  const toggles = `<span class="obsnd"><button data-snd="voice" aria-pressed="${SND.voice}">해설 음성</button><button data-snd="music" aria-pressed="${SND.music}">배경음</button></span>`;
  const nav = `<div class="gxnav"><button data-prev ${i ? '' : 'disabled'}>← 이전</button>${toggles}<button class="gxclose" data-close>나가기 ✕</button>${c.card?.end ? `<a class="obgo" href="#/g/${esc(o.gallery)}">전시실로 →</a>` : '<button data-next>다음 →</button>'}</div>`;
  const under = el.querySelector('.obunder'), screen = el.querySelector('.obscreen'), bg = el.querySelector('.obbg');
  deck.onEnd = k => { if (k === i) next(); };
  deck.onTime = (k, t) => { if (k === i && t >= (o.chapters[k].end - 0.4)) next(); };

  if (c.card) {
    track('omnibus-card', `${o.id}:${c.card.kick || 'bridge'}`);
    const after = o.chapters[nextSceneIdx];
    const lines = (c.card.bridge ? c.card.text : [c.card.title, c.card.text].join('\n')).split('\n');
    const text = c.card.voice || lines.join('\n');
    const ms = c.card.end ? 0 : readMs(lines.join('\n'));
    deckEl().classList.add('hid'); screen.classList.add('hid');
    bg.style.backgroundImage = after ? `url('${thumbOf(after)}')` : ''; bg.style.animationDuration = `${(ms || 8000) / 1000 + 2}s`; bg.classList.toggle('on', !!after);
    under.innerHTML = `${c.card.bridge
      ? `<div class="obbridge${c.card.breath ? ' breath' : ''}">${lines.map((l, n) => `<span style="animation-delay:${0.4 + n * 1.1}s">${esc(l)}</span>`).join('')}</div>`
      : `<div class="obcardbig"><p class="gxkick">${esc(c.card.kick)}</p><h2>${esc(c.card.title)}</h2><p>${esc(c.card.text).replace(/\n/g, '<br>')}</p></div>`}
      ${ms ? `<div class="obwait"><span style="animation-duration:${ms / 1000}s"></span></div>` : ''}${nav}`;
    padOn(i);
    if (nextSceneIdx > 0) { prepare(o, nextSceneIdx); dropOthers([nextSceneIdx]); }     // 글이 떠 있는 동안 다음 장면을 받아 둔다
    if (!c.card.end) {
      let moved = false, minDone = false, voiceDone = false;
      const go = () => { if (!moved && minDone && voiceDone) { moved = true; next(); } };
      const spoke = speak(text, () => { voiceDone = true; go(); });
      if (!spoke) voiceDone = true;
      timer = setTimeout(() => { minDone = true; go(); }, ms);
      setTimeout(() => { voiceDone = minDone = true; go(); }, ms + 7000);
    } else speak(text, () => {});
    under.querySelector('.obbridge, .obcardbig').onclick = () => { if (!c.card.end) next(); };
  } else {
    track('omnibus-scene', `${o.id}:${c.platform}:${c.id}`);
    padOff(); bg.classList.remove('on');
    prepare(o, i);                                              // (바로 뛰어든 경우) 아직 없으면 지금 만든다
    const nextI = nextSceneIdx > 0 ? nextSceneIdx : null;
    if (nextI) prepare(o, nextI);
    dropOthers([i, nextI].filter(x => x !== null));
    for (const [k, s] of deck.slots) { s.el.classList.toggle('on', k === i); s.active = k === i; }
    deckEl().classList.remove('hid'); screen.classList.remove('hid');
    const before = o.chapters[i - 1]?.card?.bridge ? o.chapters[i - 1].card.text.split('\n').at(-1) : '';
    under.innerHTML = `${before ? `<div class="gxcue on obcarry">${esc(before)}</div>` : ''}
      <div class="gxplacard"><span class="gxn">${String(sn).padStart(2, '0')}</span>
        <div><p class="gxt">${esc(c.ko)}</p><p class="gxorig">${esc(c.title)}</p>
        <p class="gxby">${esc(c.channel)} · <span class="gxplat inline">${esc(PNAME[c.platform])}</span> · 원작 ${mmss(c.start)}–${mmss(c.end)} · <a class="obfull" href="#/g/${esc(o.gallery)}">전편 보기</a></p></div></div>
      <div class="obbar"><span style="animation-duration:${c.end - c.start}s"></span></div>
      <button class="obtap" hidden>▶ 재생</button>${nav}`;
    const carry = under.querySelector('.obcarry'); if (carry) setTimeout(() => carry.classList.add('out'), 8000);
    // 준비됐으면 바로, 아니면 준비되는 대로 튼다. 기기 정책으로 자동 재생이 막히면 「재생」 단추를 보인다.
    const s = deck.slots.get(i);
    const tryPlay = () => { play(i); setTimeout(() => { if (s.kind === 'youtube' && s.player?.getPlayerState && s.player.getPlayerState() !== 1) under.querySelector('.obtap').hidden = false; }, 1800); };
    const waitReady = () => (s.ready ? tryPlay() : setTimeout(waitReady, 120));
    waitReady();
    under.querySelector('.obtap').onclick = () => { play(i); under.querySelector('.obtap').hidden = true; };
    timer = setTimeout(next, (c.end - c.start + 6) * 1000);   // 끝 신호가 안 올 때의 안전장치
  }
  const onKey = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); };
  document.addEventListener('keydown', onKey); offKey = () => document.removeEventListener('keydown', onKey);
  el.onclick = e => {
    const sb = e.target.closest('[data-snd]');
    if (sb) {
      const k = sb.dataset.snd; SND[k] = !SND[k]; setPref(k, SND[k]); sb.setAttribute('aria-pressed', SND[k]);
      if (k === 'music') (SND.music && c.card ? padOn(i) : padOff());
      if (k === 'voice' && !SND.voice) try { speechSynthesis.cancel(); } catch {}
      return;
    }
    if (e.target === el || e.target.closest('[data-close]')) return close();
    if (e.target.closest('[data-next]')) next(); else if (e.target.closest('[data-prev]')) prev();
  };
}
