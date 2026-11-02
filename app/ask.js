// 물어보기(11-03): 사람에게 먼저 묻고, 큐레이터 셋(길잡이·되묻는 이·쉼)이 서로 다른 답을 낸다.
// 전부 이 브라우저 안에서 고른다 — 서버로 보내는 것이 없다(기획안 §6.1 결정: 저장하지 않는다). 목표 문장과 기억은 localStorage(glb_ask)에만.
// 지금은 규칙으로 고른다(LLM 은 §10 결정 뒤 같은 자리에 끼운다).
import {CONFIG} from './config.js?v=20261104y';
let D = null;                                   // data/ask.json: {halls, uses, terms}
const KEY = 'glb_ask';
const mem = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const remember = m => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch {} };
const seen = () => { try { return JSON.parse(localStorage.getItem('glb_gx_seen')) || {}; } catch { return {}; } };

// 글 맞추기: 글자 두 개씩(2-gram) 겹침 + 낱말 그대로 들어 있으면 가산. 한국어라 형태소 없이 이 정도로 간다.
const STOP = new Set('한국 우리나라 상황 최근 오늘 올해 지금 이번 요즈음 어떻게 알고 싶다 싶어 싶어요 싶은 요즘 공부 보고 하고 있다 없다 어렵다 어려워 어려워요 것 때 안 온다 되는 되다 좀 너무 정말 가장 무엇 뭐 뭔가 왜 언제 어디 누가 어떤 대해 대한 관해 하는 하기 하면 해서 그리고 그런데 조금 많이 더 잘 못 안돼 안되 궁금 궁금해 궁금해요 알려 알려줘 보여 보여줘 영상 추천 해줘 주세요 해 주세요'.split(' '));
const PART = /(에서|으로|부터|까지|한테|에게|이랑|와|과|이|가|은|는|을|를|의|에|도|로|랑)$/;
const words = s => String(s || '').toLowerCase().split(/[\s\p{P}]+/u).filter(Boolean).map(t => t.length >= 3 ? t.replace(PART, '') : t).filter(t => t && !STOP.has(t));   // 낱말 → 조사 떼고 기능어 빼기
const norm = s => String(s || '').toLowerCase().replace(/[\s\p{P}]/gu, '');
const grams = s => { const g = new Set(); for (const w of words(s)) for (let i = 0; i < w.length - 1; i++) g.add(w.slice(i, i + 2)); return g; };
const HINTS = [['ai', '기계 인공지능 배우는'], ['인공지능', '기계 ai'], ['잠', '잠들기 전 밤 느리게'], ['아버지', '부모 아버지 어머니 가족'], ['아빠', '부모 아버지 가족'], ['어머니', '부모 가족'], ['엄마', '부모 어머니 가족'],
  ['죽음', '죽음 늙음 끝'], ['늙', '늙음 죽음 부모'], ['영어', '영어 어학 귀'], ['일본어', '일본어 어학'], ['중국어', '중국어 어학'], ['돈', '돈의 원리 공정'], ['우울', '마음이 지칠 때 위로 천천히'], ['외로', '누군가 그리울 때 위로 다시 만난'],
  ['불안', '위로 마음 감정'], ['아이', '아이와 함께 아이가 배우는 법'], ['용기', '용기 처음 끝까지'], ['대화', '대화 거리 저녁 식탁 말'], ['음악', '음악 무대 노래'], ['추천', '추천 알고리즘 다음은 누가'], ['축구', '공 한편'], ['야구', '공 손들'],
  ['우주', '우주 별 코스모스'], ['요리', '요리 과학 부엌'], ['글', '글쓰기 비밀'], ['신앙', '말씀 믿음 성경'], ['성경', '말씀 믿음'], ['믿', '믿음 말씀'], ['여행', '낯선 사람 지도에 없는 탐험'], ['역사', '역사 세상을 바꾼']];
const expand = q => { const l = q.toLowerCase(); return q + ' ' + HINTS.filter(([k]) => l.includes(k)).map(([, v]) => v).join(' '); };
const hit = (lt, t) => new RegExp(`(^|[^\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${/^[a-z0-9]+$/.test(t) ? '(?![\\p{L}\\p{N}])' : ''}`, 'iu').test(lt);   // 낱말 첫머리에서만(「의자」≠「공리주의자」, 「ai」≠「repair」)
function score(h, q, raw) {
  if (!q) return 0;
  const G = grams(q), toks = words(raw).filter(t => t.length >= 2);   // 「그대로 들어 있음」 가산은 사람이 적은 낱말만(힌트 X)
  const f = (txt, w, tw = .5) => { const g = new Set([...grams(txt)].concat([...norm(txt)].map((_, i, a) => a.slice(i, i + 2).join('')))); let n = 0; for (const x of G) if (g.has(x)) n++; const lt = String(txt || '').toLowerCase(); return w * (n / Math.max(4, G.size)) + (toks.some(t => hit(lt, t)) ? w * tw : 0); };
  return f(h.title, 3, 1) + f(h.sub, 2) + f(h.thesis, 2) + f(h.uses.join(' ') + ' ' + h.genre, 2, .25) + f(h.intro, 1);
}
const by = (list, q, raw, boost = {}) => list.map(h => ({h, s: score(h, q, raw) + (boost[h.id] || 0)})).sort((a, b) => b.s - a.s);
const useHalls = name => D.uses.find(u => u.name === name)?.halls || [];
const hall = id => D.halls.find(h => h.id === id);
const nextIn = h => { const t = D.terms.find(t => t.id === h.term); if (!t) return null; const i = t.halls.indexOf(h.id); return i >= 0 ? hall(t.halls[i + 1]) : null; };
const mins = s => `${Math.max(1, Math.round(s / 60))}분`;

// 셋의 답. q = 목표 문장(없어도 됨) · use = 「이럴 때」 칸(없어도 됨) · 둘 다 없으면 「모르겠어요」
export function curate(q, use) {
  const M = mem(), S = seen(), late = (h => h >= 23 || h < 5)(new Date().getHours());
  const qq = q ? expand(q) : '';
  const boost = {}; for (const id of useHalls(use)) boost[id] = 3;
  const avoid = new Set([M.answer === '그대로' ? M.hall : null].filter(Boolean));
  let ranked = by(D.halls.filter(h => !avoid.has(h.id)), qq, q, boost);
  const blind = !q && !use;
  if (blind) ranked = D.halls.filter(h => !S[h.id]).map(h => ({h, s: 0}));          // 아직 안 본 관 가운데 학기 순서대로
  const guide = ranked[0]?.h || D.halls[0];
  const next = nextIn(guide);
  // 되묻는 이: 같은 목표를 다른 장르에서. 점수가 너무 낮으면 「왜」 칸(위로·그리울·용기·대화) 가운데 하나로
  let doubt = ranked.find(r => r.h.genre !== guide.genre && r.s > 0)?.h;
  if (!doubt) { const whys = D.uses.filter(u => u.door === 'why').flatMap(u => u.halls).map(hall).filter(h => h && h.id !== guide.id && h.genre !== guide.genre); doubt = whys[([...(q + use)].reduce((a, c) => a + c.charCodeAt(0), Date.now() / 864e5 | 0)) % whys.length]; }
  const counter = guide.counter[0];
  // 쉼: 한 편만. 늦은 밤이면 「오늘은 보지 마세요」가 먼저
  const near = new Set([guide.id, doubt.id]);                     // 쉼: 두 사람이 고른 관의 짧은 작품을 먼저, 없으면 「마음이 지칠 때」에서
  const pool = (late ? useHalls('잠들기 전') : [guide.id, doubt.id, ...useHalls('마음이 지칠 때')]).map(hall).filter(Boolean);
  const quiet = pool.flatMap(h => h.quiet.map(w => ({h, w}))).sort((a, b) => (near.has(b.h.id) - near.has(a.h.id)) || (['풍경', '무대'].includes(b.w.fmt) - ['풍경', '무대'].includes(a.w.fmt)) || a.w.sec - b.w.sec)[0];
  const last2 = (M.history || []).slice(-2).map(x => x.chosen);
  const C = {
    guide: {name: '길잡이', role: '목표로 곧게', hall: guide,
      why: `${guide.thesis || guide.sub}` + (next ? ` 이 묶음 다음엔 『${next.title}』로 이어집니다.` : guide.min <= 70 ? ` 한 시간이면 끝까지 봅니다(약 ${guide.min}분).` : ` 한 번에 다 보지 않아도 됩니다(약 ${guide.min}분).`),
      memo: M.answer === '그대로' ? `지난번 『${hall(M.hall)?.title || ''}』로는 그대로였다고 하셨지요. 이번엔 다른 길을 냈습니다.` : blind ? '목표를 적지 않으셨으니, 아직 안 본 묶음 가운데 첫 학기부터 권합니다.' : `되묻는 이의 『${doubt.title}』도 좋지만, 먼저 한 묶음을 끝까지 보시길 권합니다.`},
    doubt: {name: '되묻는 이', role: '그 목표가 맞나요?', hall: doubt,
      why: `그 목표를 옆에서 비추면 『${doubt.title}』가 보입니다. ${doubt.thesis || doubt.sub}`,
      memo: M.answer === '생각이 바뀜' ? '지난번에 생각이 바뀌셨다고 했지요. 이번에도 제가 먼저 말하겠습니다.' : last2.length === 2 && last2.every(c => c === 'guide') ? '지난번엔 두 번 다 길잡이를 고르셨으니 이번엔 저를 한 번 믿어 보세요.'
        : counter ? `길잡이의 『${guide.title}』 안에서도 ${counter.i + 1}번째 「${counter.title}」은 반대편에 섭니다. 거기서부터 보셔도 됩니다.` : `길잡이의 『${guide.title}』는 답을 줍니다. 저는 먼저 물음을 바꿔 보자고 하겠습니다.`},
    rest: {name: '쉼', role: late ? '오늘은 여기까지' : '오늘은 한 편만', hall: quiet?.h || guide, work: quiet?.w || null, late,
      why: late ? `지금은 늦은 시간입니다. 오늘은 보지 않는 것도 고르는 일입니다. 그래도 하나만 틀고 싶다면 ${quiet ? `『${quiet.h.title}』의 「${quiet.w.title}」 ${mins(quiet.w.sec)}` : '잠들기 전 관'}이 좋겠습니다.`
        : quiet ? `『${quiet.h.title}』 가운데 「${quiet.w.title}」 한 편, ${mins(quiet.w.sec)}입니다. 다 보고 나면 거기서 멈추셔도 됩니다.` : '오늘은 짧은 것 하나만 보셔도 됩니다.',
      memo: `길잡이의 한 시간은 내일도 있습니다.`},
  };
  const order = M.answer === '생각이 바뀜' ? ['doubt', 'guide', 'rest'] : late ? ['rest', 'guide', 'doubt'] : ['guide', 'doubt', 'rest'];
  return {order, C, blind, late, top: blind ? 9 : (ranked[0]?.s || 0)};
}

const GROUPS = [['쉬고 싶을 때', ['잠들기 전', '가는 길에', '마음이 지칠 때', '한 저녁을 통째로 맡기고 싶을 때']], ['마음이 필요할 때', ['위로가 필요할 때', '누군가 그리울 때', '용기가 필요할 때', '영감이 필요할 때']],
  ['함께 볼 때', ['아이와 함께', '대화 거리가 필요할 때']], ['궁금할 때', ['그냥 신기한 게 보고 싶을 때', '음악에 젖고 싶을 때']]];
const ST = {q: '', use: '', asked: false, open: false};   // open: 세부 조건(이럴 때 칸) 펼침 — 처음엔 접어 둔다(11-03)

// 영상 고르기: 받아 둔 인기 급상승·구글 검색어 영상 + 명품관 작품(제목)에서 글 맞추기. API 0.
const VTH = 1.2;
function rankVideos(q, pools, works) {
  if (!q) return {trend: [], works: []};
  const qq = q, tok = words(q);                                   // 영상은 힌트(관 이름용) 없이 적은 말 그대로
  const sv = v => score({title: v.title, sub: v.channel || '', thesis: (v.tags || []).join(' '), uses: [], genre: '', intro: ''}, qq, q);
  // 트렌드 영상은 적은 낱말이 제목·태그에 그대로 있어야 한다(글자 겹침만으론 X)
  const trend = [...new Map([...pools.trend, ...pools.gt].map(v => [v.id || v.title, v])).values()].map(v => ({v, s: sv(v)}))
    .filter(x => x.s >= VTH && tok.some(t => t.length >= 2 && hit((x.v.title + ' ' + (x.v.tags || []).join(' ')).toLowerCase(), t)))
    .sort((a, b) => b.s - a.s).slice(0, 6).map(x => x.v);
  const ws = works.map(w => { const h = hall(w.hall); return {w, s: score({title: w.title, sub: h?.title || '', thesis: h?.thesis || '', uses: [], genre: '', intro: ''}, qq, q)}; })
    .filter(x => x.s >= VTH).sort((a, b) => b.s - a.s).slice(0, 6).map(x => x.w);
  return {trend, works: ws, tok};
}

export async function askRender(el, {esc, track, load, initQ, onDirect, pools, works, rowHTML, bindRowIn}) {
  const WORKS = (await works) || [];
  if (initQ) { ST.q = initQ; ST.use = ''; ST.asked = true; ST.ask = null; }
  D ||= await load('data/ask.json');
  if (!D || !el) return;
  const M = mem();
  el.innerHTML = `

    <h2 class="askq">지금 무엇이 필요한가요?</h2>
    <form class="askform" id="askForm"><div class="bigsearch"><span class="ic" aria-hidden="true">✎</span><input id="askQ" type="search" placeholder="예) 요즘 아버지와 대화가 어렵다 · AI 가 어떻게 배우는지 · 잠이 안 온다" value="${esc(ST.q)}" autocomplete="off" aria-label="지금 필요한 것"><button type="submit" title="뜻을 읽고 검색문을 지어 새로 찾아요">물어보기</button><button type="button" class="asklit" data-literal title="적은 글자 그대로 YouTube 에서 찾아요">글자 그대로</button></div></form>
    <button type="button" class="asktog" data-tog aria-expanded="${!!ST.open}">${ST.open ? '세부 조건 접기 ▴' : '세부 조건 펼치기 ▾'} <small>글 대신 「이럴 때」 칸을 고르거나, 그냥 맡길 수 있어요</small></button>
    <div class="askgroups" ${ST.open ? '' : 'hidden'}>${GROUPS.map(([g, us]) => `<div class="askg"><span>${g}</span>${us.map(u => `<button class="chip" data-use="${esc(u)}" aria-pressed="${ST.use === u}">${esc(u)}</button>`).join('')}</div>`).join('')}
      <button class="askblind" data-blind>모르겠어요 — 셋이 먼저 고릅니다</button></div>
    <p class="asknote">「물어보기」는 뜻을 읽고 검색문을 지어 찾고, 「글자 그대로」는 적은 말 그대로 찾아요. 적은 말은 찾는 데만 쓰고 서버에 남기지 않아요. 사적인 고민은 쓰지 않아도 됩니다 — 위의 칸을 고르셔도 돼요.</p>
    <div class="askcards" id="askCards"></div>`;
  const draw = () => {
    const box = el.querySelector('#askCards');
    if (!ST.asked) { box.innerHTML = ''; return; }
    const {order, C, late, top} = curate(ST.q, ST.use);
    const A = ST.q ? ST.ask : null;
    const V = pools ? rankVideos(ST.q, pools(), WORKS) : {trend: [], works: []};
    if (A?.videos?.length) { const got = new Set(A.videos.map(v => v.id)); V.trend = V.trend.filter(v => !got.has(v.id)); }   // 새로 찾은 것과 겹치면 뺀다                                     // /ask 결과(의도·검색문·새 영상) · null 이면 아직 · {error} 면 실패
    const hallsOk = !ST.q ? true : top >= 2.0;                           // 글을 적었으면 관은 아주 가까울 때 하나만(사용자 11-03: 기존 관은 최대한 권하지 않는다)
    const none = ST.q && A && A.error && !V.trend.length && !V.works.length && !hallsOk;
    const newBlock = !ST.q ? '' : !A ? `<p class="askwait">질문의 뜻을 읽고 검색문을 지어 YouTube 에서 새로 찾는 중…</p>`
      : A.error ? `<p class="askwait err">${esc(A.message || '지금은 새로 찾지 못했어요.')}</p>`
      : `<div class="askintent"><p><b>이렇게 이해했어요</b> — ${esc(A.intent)}</p><p class="askqs">검색문 ${A.queries.map(x => `<button class="chip" data-askq="${esc(x.q)}" title="이 검색문으로 직접 찾기">${esc(x.q)}<small>${x.lang}${x.after !== 'any' ? ' · ' + {week: '1주', month: '1달', year: '1년'}[x.after] : ''}</small></button>`).join('')}<small class="askqn">누르면 그 검색문으로 직접 찾기 — 고쳐 쓸 수 있어요</small></p></div>
        ${A.videos?.length ? `<div class="rowlist grid" id="askNew">${rowHTML(A.videos)}</div>` : `<p class="askwait">${esc(A.note || '맞는 영상을 찾지 못했어요.')}</p>`}${A.note && A.videos?.length ? `<p class="asknote">${esc(A.note)}</p>` : ''}`;
    const vids = ST.q && (V.trend.length || V.works.length) ? `<h3 class="askvh">골라보셈 안에서 <small>이미 받아 둔 인기 영상과 명품관 작품 가운데 맞는 것</small></h3>
      ${V.trend.length ? `<div class="rowlist grid" id="askVids">${rowHTML(V.trend)}</div>` : ''}
      ${V.works.length ? `<div class="askworks">${V.works.map(w => `<a class="askv" href="#/g/${esc(w.hall)}" data-hw="${esc(w.hall)}|${w.i}"><span class="askvt" style="background-image:url('${esc(w.thumb)}')"></span><span class="askvn">${esc(w.title)}</span><small>『${esc(hall(w.hall)?.title || w.hall)}』 ${w.i + 1}번째</small></a>`).join('')}</div>` : ''}` : '';
    box.innerHTML = (ST.q ? `<h3 class="askvh">새로 찾은 영상 <small>「${esc(ST.q)}」</small></h3>` + newBlock : '') + (none ? `<div class="asknone"><p><b>골라보셈 안에는 「${esc(ST.q)}」에 맞는 영상이 아직 없어요.</b> 받아 둔 인기 영상과 명품관 작품을 다 보았지만 가까운 것이 없었습니다.</p>${onDirect ? `<button class="askgobtn" data-direct>YouTube 에서 직접 찾기 →</button>` : ''}<p class="asknote">이 주제를 적어 두면 다음 관의 씨앗이 됩니다.</p></div>` : vids) +
      (hallsOk ? `<h3 class="askvh">${ST.q ? '가까운 묶음 하나' : '묶음'} <small>${ST.q ? '한 시간짜리 묶음 · 아주 가까울 때만' : '한 시간짜리 묶음 · 세 사람이 하나씩'}</small></h3><p class="askhead">${[ST.q, ST.use].filter(Boolean).map(x => `「${esc(x)}」`).join(' · ') || '목표 없이'} — 세 사람의 답입니다. 고르는 것은 당신입니다.</p>` + (ST.q ? ['guide'] : order).map(k => { const c = C[k]; return `
      <article class="askc askc-${k}">
        <header><b>${c.name}</b><small>${c.role}</small></header>
        <a class="askcover" href="#/g/${esc(c.hall.id)}" data-go="${k}" style="background-image:url('${esc(c.hall.cover)}')"><span>No.${String(c.hall.no).padStart(2, '0')}</span></a>
        <h3>${esc(c.hall.title)}</h3><p class="asksub">${esc(c.hall.sub)}</p>
        <p class="askwhy">${esc(c.why)}</p>
        <p class="askmemo">${esc(c.memo)}</p>
        <div class="askgo">${k === 'rest' && late ? `<button data-close-day>오늘은 닫기</button>` : ''}<button class="askgobtn" data-go="${k}">${k === 'rest' && c.work ? `이 한 편만 →` : '이 묶음으로 →'}</button></div>
      </article>`; }).join('') : '') + `${ST.q && onDirect && !none ? `<p class="askdirect">셋의 답이 아니라 영상을 바로 보고 싶다면 — <button data-direct>「${esc(ST.q)}」로 직접 찾기 →</button></p>` : ''}${hallsOk ? `<p class="asknote">묶음은 골라보셈이 가진 ${D.halls.length}개 안에서 규칙으로 고릅니다.</p>` : ''}`;
    box.querySelector('[data-direct]')?.addEventListener('click', () => onDirect(ST.q));
    if (V.trend.length && bindRowIn) bindRowIn('#askVids', V.trend);
    if (A?.videos?.length && bindRowIn) bindRowIn('#askNew', A.videos);
    box.querySelectorAll('[data-askq]').forEach(b => b.onclick = () => onDirect?.(b.dataset.askq));
    box.querySelectorAll('[data-hw]').forEach(a => a.onclick = e => { e.preventDefault(); const [h, i] = a.dataset.hw.split('|'); try { const p = JSON.parse(localStorage.getItem('glb_gx_pos') || '{}'); p[h] = +i; localStorage.setItem('glb_gx_pos', JSON.stringify(p)); } catch {} track('ask-work', `${h}:${i}`); location.hash = `#/g/${h}`; });
    box.querySelectorAll('[data-go]').forEach(b => b.onclick = e => {
      e.preventDefault();
      const k = b.dataset.go, c = C[k], m = mem();
      remember({...m, goal: ST.q, use: ST.use, chosen: k, by: c.name, hall: c.hall.id, at: Date.now(), answer: '', history: [...(m.history || []).slice(-9), {chosen: k, at: Date.now()}]});
      sessionStorage.setItem('glb_ask_hall', c.hall.id);
      if (k === 'rest' && c.work) { try { const p = JSON.parse(localStorage.getItem('glb_gx_pos') || '{}'); p[c.hall.id] = c.work.i; localStorage.setItem('glb_gx_pos', JSON.stringify(p)); } catch {} }
      track('ask-go', `${k}:${c.hall.id}`);
      location.hash = `#/g/${c.hall.id}`;
    });
    box.querySelector('[data-close-day]')?.addEventListener('click', () => { track('ask-close-day'); remember({...mem(), closed: Date.now()}); location.hash = '#/'; });
  };
  const askServer = async q => {                                       // 질문은 서버에 저장되지 않는다(답을 만들고 버린다 · privacy.html)
    ST.ask = null; draw();
    try { const r = await fetch(`${CONFIG.searchApi}/ask?` + new URLSearchParams({q})); const d = await r.json(); ST.ask = r.ok ? d : {error: d.error || 'ask', message: d.message}; }
    catch { ST.ask = {error: 'net', message: '지금은 새로 찾지 못했어요(네트워크).'}; }
    if (ST.q === q) draw();
  };
  el.querySelector('[data-literal]').onclick = () => { const q = el.querySelector('#askQ').value.trim(); if (!q) return el.querySelector('#askQ').focus(); track('ask', 'literal'); onDirect?.(q); setTimeout(() => document.getElementById('qSec')?.scrollIntoView({behavior: 'smooth', block: 'start'}), 50); };   // 글자 그대로(11-03): 에이전트 해석 없이 적은 말로 바로 검색
  el.querySelector('#askForm').onsubmit = e => { e.preventDefault(); ST.q = el.querySelector('#askQ').value.trim(); ST.use = ''; ST.asked = true; track('ask', ST.q ? 'text' : 'empty'); if (ST.q && CONFIG.searchApi) askServer(ST.q); else draw(); el.querySelector('#askCards').scrollIntoView({behavior: 'smooth', block: 'start'}); };
  el.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { ST.use = ST.use === b.dataset.use ? '' : b.dataset.use; ST.q = ''; ST.ask = null; el.querySelector('#askQ').value = ''; el.querySelectorAll('[data-use]').forEach(x => x.setAttribute('aria-pressed', x.dataset.use === ST.use)); ST.asked = true; track('ask', 'use:' + ST.use); draw(); });
  el.querySelector('[data-tog]').onclick = () => { ST.open = !ST.open; const b = el.querySelector('[data-tog]'); b.setAttribute('aria-expanded', ST.open); b.firstChild.textContent = ST.open ? '세부 조건 접기 ▴ ' : '세부 조건 펼치기 ▾ '; el.querySelector('.askgroups').hidden = !ST.open; track('ask-toggle', String(ST.open)); };
  el.querySelector('[data-blind]').onclick = () => { ST.q = ''; ST.use = ''; el.querySelector('#askQ').value = ''; ST.asked = true; track('ask', 'blind'); draw(); };
  if (ST.asked) { if (ST.q && !ST.ask && CONFIG.searchApi) askServer(ST.q); else draw(); }
}
