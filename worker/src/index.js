// 골라봄 검색 중계(Cloudflare Worker) — API 키를 숨긴 채 YouTube 를 대신 검색한다.
//   GET /search?q=캠핑 의자 후기 -리액션&dur=long&after=year&cap=1  →  {q, cached, removed, videos:[...]}
//     q 는 골라봄이 버튼으로 조립한 검색문(-뺄 말 · "꼭 들어갈 말" 포함), dur·after·cap 은 YouTube 검색 조건
//   GET /trends              →  {trendAt, kr:{분야:{removed,videos}}, countries:{나라:{...}}}  (1시간마다 Cron 이 KV 에 채움)
// 지키는 것
//   · 키는 Worker 비밀값(YT_API_KEY)에만 둔다. 브라우저는 검색어만 보낸다.
//   · 골라봄 주소(ALLOWED_ORIGINS)에서 온 요청만 받는다.
//   · 같은 검색은 하루 동안 KV 에 저장해 다시 쓴다(API 데이터 30일 규정 안).
//   · 새 검색은 하루 DAILY_CAP 번까지만 — 매일 자동 작업(약 5,100단위)이 쓸 한도를 남긴다.
const API = 'https://www.googleapis.com/youtube/v3/';
const SHORTS_MAX = 60;
const AD_WORDS = ['광고', '협찬', '유료 광고', '#ad', 'sponsored', '#pr', '제공받아'];
const DURS = ['any', 'short', 'medium', 'long'];            // YouTube videoDuration: 4분 미만 · 4~20분 · 20분 초과
const AFTER = {any: 0, week: 7, month: 31, year: 365};      // 며칠 안에 올라온 것만
const LANGS = {ko: 'KR', en: 'US', ja: 'JP'};                // 영상 언어 → 검색 지역
const ORDERS = ['relevance', 'date', 'viewCount', 'rating'];
const BAIT_WORDS = ['충격', '경악', '소름', '레전드', '실화냐', '결국', '난리', '대박', 'ㄷㄷ', '미쳤다'];
const TOPICS_URL = 'https://vinni-tokyo.github.io/golabom/app/data/topics.json';   // 분야·나라 목록은 앱과 같은 파일을 쓴다

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshTrends(env));
  },
  async fetch(req, env) {
    // 운영자 전용 「지금 갱신」: POST /refresh + Authorization: Bearer <REFRESH_TOKEN(비밀값)>. 5분에 한 번까지.
    if (new URL(req.url).pathname === '/refresh') return refreshNow(req, env);
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const ok = allowed.some(a => a === origin || (a.endsWith('*') && origin.startsWith(a.slice(0, -1))));
    const cors = ok ? {'Access-Control-Allow-Origin': origin, 'Vary': 'Origin'} : {};
    const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json; charset=utf-8', ...cors}});

    if (req.method === 'OPTIONS') return new Response(null, {status: ok ? 204 : 403, headers: {...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400'}});
    if (!ok) return json({error: 'origin'}, 403);
    const url = new URL(req.url);
    if (url.pathname === '/trends') {
      const t = await env.SEARCH_CACHE.get('trends', 'json');
      return t ? json(t) : json({error: 'no trends yet'}, 404);
    }
    if (url.pathname !== '/search') return json({error: 'not found'}, 404);

    const q = (url.searchParams.get('q') || '').trim().replace(/\s+/g, ' ').slice(0, 250);
    const dur = url.searchParams.get('dur') || 'any';
    const after = url.searchParams.get('after') || 'any';
    const cap = url.searchParams.get('cap') === '1';
    const def = url.searchParams.get('def') === 'high' ? 'high' : 'any';
    const lang = url.searchParams.get('lang') || 'ko';
    const order = url.searchParams.get('order') || 'relevance';
    if (!q || !DURS.includes(dur) || !(after in AFTER) || !(lang in LANGS) || !ORDERS.includes(order)) return json({error: 'bad query'}, 400);

    const key = `s:${q.toLowerCase()}|${dur}|${after}|${cap ? 1 : 0}|${def}|${lang}|${order}`;
    const hit = await env.SEARCH_CACHE.get(key, 'json');
    if (hit) return json({...hit, cached: true});

    // 하루 새 검색 상한(미국 태평양 시간 기준 날짜 — YouTube 한도가 초기화되는 기준)
    const day = new Date(Date.now() - 8 * 3600e3).toISOString().slice(0, 10);
    const countKey = `n:${day}`;
    const used = Number(await env.SEARCH_CACHE.get(countKey)) || 0;
    if (used >= Number(env.DAILY_CAP || 40)) return json({error: 'daily cap', message: '오늘 새로 찾을 수 있는 횟수를 다 썼어요. 내일 다시 찾아 주세요.'}, 429);
    await env.SEARCH_CACHE.put(countKey, String(used + 1), {expirationTtl: 2 * 86400});

    try {
      const body = await search(env.YT_API_KEY, q, {dur, after, cap, def, lang, order});
      const out = {q, dur, after, cap, def, lang, order, ...body, at: new Date().toISOString()};
      await env.SEARCH_CACHE.put(key, JSON.stringify(out), {expirationTtl: 86400});
      return json({...out, cached: false});
    } catch (e) {
      return json({error: 'youtube', status: e.status || 500}, e.status === 403 ? 429 : 502);
    }
  },
};

async function refreshNow(req, env) {
  const bad = (status, error) => new Response(JSON.stringify({error}), {status, headers: {'Content-Type': 'application/json'}});
  if (req.method !== 'POST' || !env.REFRESH_TOKEN || req.headers.get('Authorization') !== `Bearer ${env.REFRESH_TOKEN}`) return bad(403, 'forbidden');
  const last = await env.SEARCH_CACHE.get('trends', 'json');
  if (last && Date.now() - Date.parse(last.trendAt) < 5 * 60e3) return bad(429, 'too soon');
  const out = await refreshTrends(env);
  const count = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.videos.length]));
  return new Response(JSON.stringify({trendAt: out.trendAt, failed: out.failed, kr: count(out.kr), countries: count(out.countries)}), {headers: {'Content-Type': 'application/json'}});
}

// 1시간마다(wrangler.toml 의 crons): 한국 분야별 + 나라별 인기 급상승을 받아 KV 'trends' 에 둔다.
// 호출 = 분야 11 + 나라 8 = 19번 × 1단위. 받은 50편을 모두 둔다(키워드 후보를 늘리려고 · 10-30). GitHub 정기 실행이 제때 돌지 않아 Cloudflare 로 옮겼다(10-30).
async function refreshTrends(env) {
  const conf = await (await fetch(TOPICS_URL, {cf: {cacheTtl: 300}})).json();
  const out = {trendAt: new Date().toISOString(), kr: {}, countries: {}, failed: []};
  const jobs = [
    ...conf.trendCategories.map(c => ({where: 'kr', id: c.id, region: 'KR', cat: c.category, keep: 50})),
    ...conf.trendCountries.filter(c => c.id !== 'KR').map(c => ({where: 'countries', id: c.id, region: c.id, cat: null, keep: 50})),
  ];
  await Promise.all(jobs.map(async j => {
    try { out[j.where][j.id] = await trend(env.YT_API_KEY, j.region, j.cat, j.keep); }
    catch (e) { out.failed.push(`${j.region}/${j.id}: ${e.status || e.message}`); }
  }));
  // 하나도 못 받았으면(한도 초과 등) 지난 것을 지우지 않는다
  if (Object.keys(out.kr).length + Object.keys(out.countries).length) await env.SEARCH_CACHE.put('trends', JSON.stringify(out));
  return out;
}

async function trend(apiKey, region, cat, keep) {
  const params = {part: 'snippet,contentDetails,statistics,status', chart: 'mostPopular', regionCode: region, maxResults: 50};
  if (cat) params.videoCategoryId = cat;
  let items = [];
  try { items = (await get(apiKey, 'videos', params)).items || []; }
  catch (e) { if (e.status !== 404) throw e; }               // 그 지역에 없는 분류는 빈 목록
  const removed = {shorts: 0, bait: 0, ad: 0};
  const videos = [];
  for (const it of items) {
    if (!it.status?.embeddable) continue;
    const c = card(it, null);
    const lower = c.title.toLowerCase();
    if (c.sec <= SHORTS_MAX || lower.includes('#shorts')) removed.shorts++;
    else if (BAIT_WORDS.some(w => lower.includes(w))) removed.bait++;
    else if (AD_WORDS.some(w => lower.includes(w))) removed.ad++;
    else { c.reason = `인기 급상승 ${videos.length + 1}위 · ${Math.max(1, Math.round(c.sec / 60))}분 · 조회수 ${c.views.toLocaleString('en-US')}`; videos.push(c); }
  }
  return {removed, videos: videos.slice(0, keep)};
}

function card(it, subs) {
  const st = it.statistics || {};
  const views = Number(st.viewCount || 0);
  const likes = st.likeCount !== undefined ? Number(st.likeCount) : null;
  const th = it.snippet.thumbnails || {};
  return {
    id: it.id, title: it.snippet.title, channel: it.snippet.channelTitle, published: it.snippet.publishedAt.slice(0, 10),
    sec: seconds(it.contentDetails.duration), caption: it.contentDetails.caption === 'true', views,
    likeRatio: likes !== null && views >= 100 ? Math.round(likes / views * 1e4) / 1e4 : null,
    thumb: (th.medium || th.high || th.default || {}).url || '', tags: (it.snippet.tags || []).slice(0, 10), subs,
  };
}

async function get(apiKey, endpoint, params) {
  const r = await fetch(API + endpoint + '?' + new URLSearchParams({...params, key: apiKey}));
  if (!r.ok) { const e = new Error('youtube ' + r.status); e.status = r.status; throw e; }
  return r.json();
}

function seconds(iso) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : 0;
}

async function search(apiKey, query, {dur, after, cap, def, lang, order}) {
  // 한 번에 50편 — 조건(길이·시기·자막)은 YouTube 가 찾을 때 걸고, 세부 주제·순서는 브라우저가 이 안에서 고른다
  const params = {part: 'snippet', type: 'video', q: query, maxResults: 50, regionCode: LANGS[lang],
    relevanceLanguage: lang, videoEmbeddable: 'true', safeSearch: 'moderate', order};
  if (dur !== 'any') params.videoDuration = dur;
  if (AFTER[after]) params.publishedAfter = new Date(Date.now() - AFTER[after] * 864e5).toISOString().slice(0, 10) + 'T00:00:00Z';
  if (cap) params.videoCaption = 'closedCaption';
  if (def === 'high') params.videoDefinition = 'high';
  const s = await get(apiKey, 'search', params);
  const ids = (s.items || []).map(it => it.id.videoId);
  if (!ids.length) return {removed: {shorts: 0, ad: 0}, videos: []};
  const v = await get(apiKey, 'videos', {part: 'snippet,contentDetails,statistics,status', id: ids.join(',')});
  const chIds = [...new Set((v.items || []).map(x => x.snippet.channelId))];
  const ch = chIds.length ? await get(apiKey, 'channels', {part: 'statistics', id: chIds.join(',')}) : {items: []};
  const subs = Object.fromEntries((ch.items || []).map(c => [c.id, c.statistics?.hiddenSubscriberCount ? null : Number(c.statistics?.subscriberCount || 0)]));
  const rank = Object.fromEntries(ids.map((id, i) => [id, i]));
  const removed = {shorts: 0, ad: 0};
  const videos = [];
  for (const it of (v.items || []).sort((a, b) => rank[a.id] - rank[b.id])) {
    if (!it.status?.embeddable || it.snippet.liveBroadcastContent !== 'none') continue;
    const sec = seconds(it.contentDetails.duration);
    const title = it.snippet.title;
    const lower = title.toLowerCase();
    if (sec <= SHORTS_MAX || lower.includes('#shorts')) { removed.shorts++; continue; }
    if (AD_WORDS.some(w => lower.includes(w))) { removed.ad++; continue; }
    videos.push({...card(it, subs[it.snippet.channelId] ?? null), rel: rank[it.id]});
  }
  return {removed, videos};
}
