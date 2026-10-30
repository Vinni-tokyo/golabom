// 골라봄 옴니버스 — 한 테마의 작품들에서 구간을 골라 이야기 카드와 함께 이어서 튼다.
// 지키는 것: 영상을 내려받거나 자르거나 합치지 않는다. 각 플랫폼의 공식 플레이어로 「그 구간만」 차례로 재생한다.
//            카드는 플레이어 위에 덮지 않고, 플레이어와 플레이어 사이에만 둔다. 장면마다 원작과 「전편 보기」를 붙인다.
// 구간을 정하는 법(tools/omnibus_scout.py): 설명란 챕터 → 25·50·75% 공개 장면 → 설명란 글. 자막·내려받기는 쓰지 않는다.
// 데이터: data/omnibus/<id>.json  chapters = [{card:{kick,title,text,end?}} | {platform,id,start,end,ko,title,channel,why}]

const EMBED = {
  youtube: (id, s, e) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&start=${s}&end=${e}`,
  vimeo: (id, s) => `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1&title=0&byline=0#t=${s}s`,
  dailymotion: (id, s) => `https://geo.dailymotion.com/player.html?video=${id}&startTime=${s}`,
};
const PNAME = {youtube: 'YouTube', vimeo: 'Vimeo', dailymotion: 'Dailymotion'};
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const CARD_MS = 4200;      // 이야기 카드가 떠 있는 시간

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
function stage(o, i, ctx) {
  const {esc, track} = ctx;
  clearTimeout(timer); offKey?.();
  let el = document.querySelector('.obtheater');
  if (!el) { el = document.createElement('div'); el.className = 'obtheater'; document.body.append(el); }
  const c = o.chapters[i];
  if (!c) return close();
  const next = () => stage(o, i + 1, ctx), prev = () => stage(o, Math.max(0, i - 1), ctx);
  const close = () => { clearTimeout(timer); offKey?.(); offKey = null; el.remove(); };
  const nav = `<div class="gxnav"><button data-prev ${i ? '' : 'disabled'}>← 이전</button><button class="gxclose" data-close>나가기 ✕</button>${c.card?.end ? `<a class="obgo" href="#/g/${esc(o.gallery)}">전시실로 →</a>` : '<button data-next>다음 →</button>'}</div>`;
  if (c.card) {
    track('omnibus-card', `${o.id}:${c.card.kick}`);
    el.innerHTML = `<div class="gxstage obcardstage"><div class="obcardbig"><p class="gxkick">${esc(c.card.kick)}</p><h2>${esc(c.card.title)}</h2><p>${esc(c.card.text)}</p></div>${nav}</div>`;
    if (!c.card.end) timer = setTimeout(next, CARD_MS);
  } else {
    track('omnibus-scene', `${o.id}:${c.platform}:${c.id}`);
    el.innerHTML = `<div class="gxstage">
      <div class="gxscreen"><iframe src="${esc(EMBED[c.platform](c.id, c.start, c.end))}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="${esc(c.ko)}"></iframe></div>
      <div class="gxplacard"><span class="gxn">${String(o.chapters.slice(0, i).filter(x => !x.card).length + 1).padStart(2, '0')}</span>
        <div><p class="gxt">${esc(c.ko)}</p><p class="gxorig">${esc(c.title)}</p>
        <p class="gxby">${esc(c.channel)} · <span class="gxplat inline">${esc(PNAME[c.platform])}</span> · 원작 ${mmss(c.start)}–${mmss(c.end)} · <a class="obfull" href="#/g/${esc(o.gallery)}">전편 보기</a></p></div></div>
      <div class="obbar"><span style="animation-duration:${c.end - c.start}s"></span></div>${nav}</div>`;
    // YouTube 는 end 로 스스로 멈추고, 다른 플랫폼은 시간이 되면 넘어간다(불러오는 데 걸리는 2초를 더한다)
    timer = setTimeout(next, (c.end - c.start + 2) * 1000);
  }
  const onKey = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); };
  document.addEventListener('keydown', onKey); offKey = () => document.removeEventListener('keydown', onKey);
  el.onclick = e => {
    if (e.target === el || e.target.closest('[data-close]')) return close();
    if (e.target.closest('[data-next]')) next(); else if (e.target.closest('[data-prev]')) prev();
  };
}
