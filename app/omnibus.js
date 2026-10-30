// 골라봄 옴니버스 — 한 테마의 작품들에서 구간을 골라 이야기 카드와 함께 이어서 튼다.
// 지키는 것: 영상을 내려받거나 자르거나 합치지 않는다. 각 플랫폼의 공식 플레이어로 「그 구간만」 차례로 재생한다.
//            카드는 플레이어 위에 덮지 않고, 플레이어와 플레이어 사이에만 둔다. 장면마다 원작과 「전편 보기」를 붙인다.
// 구간을 정하는 법(tools/omnibus_scout.py): 설명란 챕터 → 25·50·75% 공개 장면 → 설명란 글. 자막·내려받기는 쓰지 않는다.
// 데이터: data/omnibus/<id>.json  chapters = [{card:{kick,title,text,end?}} | {platform,id,start,end,ko,title,channel,why}]

const EMBED = {
  youtube: (id, s, e) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&hl=ko&cc_load_policy=1&cc_lang_pref=ko&start=${s}&end=${e}`,
  vimeo: (id, s) => `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1&title=0&byline=0&texttrack=ko#t=${s}s`,
  dailymotion: (id, s) => `https://geo.dailymotion.com/player.html?video=${id}&startTime=${s}`,
};
const PNAME = {youtube: 'YouTube', vimeo: 'Vimeo', dailymotion: 'Dailymotion'};
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const CARD_MS = 4200;      // 이야기 카드가 떠 있는 시간
const BRIDGE_MS = 3600;    // 장면과 장면 사이 경첩 글(두 줄 이하)

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
        ? `<li class="obcard"><span class="obk">${esc(c.kick)}</span><b>${esc(c.title)}</b></li>`
        : `<li class="obscene"><button data-ob="${i}"><span class="obt">${esc(c.ko)}</span><span class="obm">${esc(c.channel)} · ${esc(PNAME[c.platform])} · ${mmss(c.start)}–${mmss(c.end)}</span></button></li>`).join('')}
      </ol>
      <p class="gxfoot">${esc(o.method)}<br>모든 장면은 원작의 공식 플레이어로 재생되며, 조회는 원작자에게 돌아갑니다.</p>
    </div>`;
  app.querySelector('#obStart').onclick = () => stage(o, 0, {esc, track});
  app.querySelectorAll('[data-ob]').forEach(b => b.onclick = () => stage(o, +b.dataset.ob, {esc, track}));
}

let timer = null, offKey = null;

// ── 소리: 해설 음성(기기의 한국어 음성) · 배경음(브라우저가 그 자리에서 만드는 소리 — 음원 파일·저작권 없음) ──
const pref = (k, d) => { try { return JSON.parse(localStorage.getItem('glb_ob_' + k)) ?? d; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem('glb_ob_' + k, JSON.stringify(v)); } catch {} };
const SND = {voice: pref('voice', true), music: pref('music', true)};
function speak(text, done) {
  if (!SND.voice || !('speechSynthesis' in window)) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\n/g, ' '));
  u.lang = 'ko-KR'; u.rate = 0.92; u.pitch = 0.95;
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
    // 장면마다 조금씩 다른 화음(라·도·미 계열을 옮겨 가며) — 낮고 부드러운 사인파 셋 + 저역 필터
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
const readMs = t => Math.min(10000, Math.max(5500, t.replace(/\s/g, '').length * 120 + 2600));   // 읽는 속도로 머무는 시간
const thumbOf = c => c.platform === 'youtube' ? `https://i.ytimg.com/vi/${c.id}/maxresdefault.jpg` : (c.thumb || '');

function stage(o, i, ctx) {
  const {esc, track} = ctx;
  clearTimeout(timer); offKey?.(); try { speechSynthesis.cancel(); } catch {}
  let el = document.querySelector('.obtheater');
  if (!el) { el = document.createElement('div'); el.className = 'obtheater'; document.body.append(el); }
  const c = o.chapters[i];
  if (!c) return close();
  const next = () => stage(o, i + 1, ctx), prev = () => stage(o, Math.max(0, i - 1), ctx);
  function close() { clearTimeout(timer); offKey?.(); offKey = null; padOff(); try { speechSynthesis.cancel(); } catch {} el.remove(); }
  // 전체 진행: 장면 몇 번째인지 + 얇은 줄(투어의 호흡이 보이게)
  const scenes = o.chapters.filter(x => !x.card), sn = o.chapters.slice(0, i + 1).filter(x => !x.card).length;
  const progress = `<div class="obprog"><span>${sn ? `장면 ${sn} / ${scenes.length}` : esc(o.title)}</span><i style="width:${Math.round(i / (o.chapters.length - 1) * 100)}%"></i></div>`;
  const toggles = `<span class="obsnd"><button data-snd="voice" aria-pressed="${SND.voice}">해설 음성</button><button data-snd="music" aria-pressed="${SND.music}">배경음</button></span>`;
  const nav = `<div class="gxnav"><button data-prev ${i ? '' : 'disabled'}>← 이전</button>${toggles}<button class="gxclose" data-close>나가기 ✕</button>${c.card?.end ? `<a class="obgo" href="#/g/${esc(o.gallery)}">전시실로 →</a>` : '<button data-next>다음 →</button>'}</div>`;
  if (c.card) {
    track('omnibus-card', `${o.id}:${c.card.kick || 'bridge'}`);
    const after = o.chapters.slice(i + 1).find(x => !x.card);          // 다음 장면 — 글 뒤에 미리 비친다
    const lines = (c.card.bridge ? c.card.text : [c.card.title, c.card.text].join('\n')).split('\n');
    const text = lines.join('\n');
    const body = c.card.bridge
      ? `<div class="obbridge">${lines.map((l, n) => `<span style="animation-delay:${0.4 + n * 1.1}s">${esc(l)}</span>`).join('')}</div>`
      : `<div class="obcardbig"><p class="gxkick">${esc(c.card.kick)}</p><h2>${esc(c.card.title)}</h2><p>${esc(c.card.text).replace(/\n/g, '<br>')}</p></div>`;
    const ms = c.card.end ? 0 : readMs(text);
    el.innerHTML = `${after ? `<div class="obbg" style="background-image:url('${esc(thumbOf(after))}');animation-duration:${(ms || 8000) / 1000 + 2}s"></div>` : ''}
      <div class="gxstage obcardstage">${progress}${body}${ms ? `<div class="obwait"><span style="animation-duration:${ms / 1000}s"></span></div>` : ''}${nav}</div>`;
    padOn(i);
    if (!c.card.end) {
      // 음성이 켜져 있으면 다 읽은 뒤에, 아니면 읽는 시간만큼 머문 뒤에 넘어간다
      // 「읽는 시간을 다 채웠고, 음성도 끝났을 때」 넘어간다(음성이 없는 기기는 끝 신호가 바로 와도 읽는 시간은 지킨다)
      let moved = false, minDone = false, voiceDone = false;
      const go = () => { if (!moved && minDone && voiceDone) { moved = true; next(); } };
      const spoke = speak(text, () => { voiceDone = true; go(); });
      if (!spoke) voiceDone = true;
      timer = setTimeout(() => { minDone = true; go(); }, ms);
      setTimeout(() => { voiceDone = true; minDone = true; go(); }, ms + 7000);   // 음성이 멈춰 버린 경우의 안전장치
    } else speak(text, () => {});
    el.querySelector('.obbridge, .obcardbig').onclick = () => { if (!c.card.end) next(); };   // 탭하면 바로 다음
  } else {
    track('omnibus-scene', `${o.id}:${c.platform}:${c.id}`);
    padOff();
    const before = o.chapters[i - 1]?.card?.bridge ? o.chapters[i - 1].card.text.split('\n').at(-1) : '';
    el.innerHTML = `<div class="gxstage">${progress}
      <div class="gxscreen obfadein" style="background-image:url('${esc(thumbOf(c))}')"><iframe src="${esc(EMBED[c.platform](c.id, c.start, c.end))}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="${esc(c.ko)}"></iframe></div>
      ${before ? `<div class="gxcue on obcarry">${esc(before)}</div>` : ''}
      <div class="gxplacard"><span class="gxn">${String(sn).padStart(2, '0')}</span>
        <div><p class="gxt">${esc(c.ko)}</p><p class="gxorig">${esc(c.title)}</p>
        <p class="gxby">${esc(c.channel)} · <span class="gxplat inline">${esc(PNAME[c.platform])}</span> · 원작 ${mmss(c.start)}–${mmss(c.end)} · <a class="obfull" href="#/g/${esc(o.gallery)}">전편 보기</a></p></div></div>
      <div class="obbar"><span style="animation-duration:${c.end - c.start}s"></span></div>${nav}</div>`;
    // 앞 경첩 글의 마지막 줄은 영상 아래에 8초 남았다가 사라진다(글이 영상 안으로 이어지게)
    const carry = el.querySelector('.obcarry'); if (carry) setTimeout(() => carry.classList.add('out'), 8000);
    // 영상이 뜨면 미리 비치던 그림을 걷는다(양옆 검은 띠 자리에 그림이 남지 않게)
    const scr = el.querySelector('.obfadein'); scr.querySelector('iframe').addEventListener('load', () => setTimeout(() => scr.classList.add('loaded'), 1200));
    // YouTube 는 end 로 스스로 멈추고, 다른 플랫폼은 시간이 되면 넘어간다(불러오는 데 걸리는 2초를 더한다)
    timer = setTimeout(next, (c.end - c.start + 2) * 1000);
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

