// 골라봄 검색 중계(Cloudflare Worker) — API 키를 숨긴 채 YouTube 를 대신 검색한다.
//   GET /search?q=캠핑 의자&kind=후기  →  {q, kind, cached, removed, videos:[...]}
// 지키는 것
//   · 키는 Worker 비밀값(YT_API_KEY)에만 둔다. 브라우저는 검색어만 보낸다.
//   · 골라봄 주소(ALLOWED_ORIGINS)에서 온 요청만 받는다.
//   · 같은 검색은 하루 동안 KV 에 저장해 다시 쓴다(API 데이터 30일 규정 안).
//   · 새 검색은 하루 DAILY_CAP 번까지만 — 매일 자동 작업(약 5,100단위)이 쓸 한도를 남긴다.
const API = 'https://www.googleapis.com/youtube/v3/';
const SHORTS_MAX = 60;
const AD_WORDS = ['광고', '협찬', '유료 광고', '#ad', 'sponsored', '#pr', '제공받아'];
const KINDS = {'': '', 후기: '후기', 비교: '비교', '고르는 법': '고르는 법', 설명: '설명', 브이로그: '브이로그'};

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const ok = allowed.some(a => a === origin || (a.endsWith('*') && origin.startsWith(a.slice(0, -1))));
    const cors = ok ? {'Access-Control-Allow-Origin': origin, 'Vary': 'Origin'} : {};
    const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json; charset=utf-8', ...cors}});

    if (req.method === 'OPTIONS') return new Response(null, {status: ok ? 204 : 403, headers: {...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400'}});
    if (!ok) return json({error: 'origin'}, 403);
    const url = new URL(req.url);
    if (url.pathname !== '/search') return json({error: 'not found'}, 404);

    const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
    const kind = url.searchParams.get('kind') || '';
    if (!q || !(kind in KINDS)) return json({error: 'bad query'}, 400);

    const key = `s:${q.toLowerCase()}|${kind}`;
    const hit = await env.SEARCH_CACHE.get(key, 'json');
    if (hit) return json({...hit, cached: true});

    // 하루 새 검색 상한(미국 태평양 시간 기준 날짜 — YouTube 한도가 초기화되는 기준)
    const day = new Date(Date.now() - 8 * 3600e3).toISOString().slice(0, 10);
    const countKey = `n:${day}`;
    const used = Number(await env.SEARCH_CACHE.get(countKey)) || 0;
    if (used >= Number(env.DAILY_CAP || 40)) return json({error: 'daily cap', message: '오늘 새로 찾을 수 있는 횟수를 다 썼어요. 내일 다시 찾아 주세요.'}, 429);
    await env.SEARCH_CACHE.put(countKey, String(used + 1), {expirationTtl: 2 * 86400});

    try {
      const body = await search(env.YT_API_KEY, [q, KINDS[kind]].filter(Boolean).join(' '));
      const out = {q, kind, ...body, at: new Date().toISOString()};
      await env.SEARCH_CACHE.put(key, JSON.stringify(out), {expirationTtl: 86400});
      return json({...out, cached: false});
    } catch (e) {
      return json({error: 'youtube', status: e.status || 500}, e.status === 403 ? 429 : 502);
    }
  },
};

async function get(apiKey, endpoint, params) {
  const r = await fetch(API + endpoint + '?' + new URLSearchParams({...params, key: apiKey}));
  if (!r.ok) { const e = new Error('youtube ' + r.status); e.status = r.status; throw e; }
  return r.json();
}

function seconds(iso) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : 0;
}

async function search(apiKey, query) {
  // 한 번에 50편 — 길이·시기·빼기·순서 버튼은 브라우저에서 이 안에서 거른다(API 를 더 쓰지 않음)
  const s = await get(apiKey, 'search', {part: 'snippet', type: 'video', q: query, maxResults: 50, regionCode: 'KR',
    relevanceLanguage: 'ko', videoEmbeddable: 'true', safeSearch: 'moderate'});
  const ids = (s.items || []).map(it => it.id.videoId);
  if (!ids.length) return {removed: {shorts: 0, ad: 0}, videos: []};
  const v = await get(apiKey, 'videos', {part: 'snippet,contentDetails,statistics,status', id: ids.join(',')});
  const chIds = [...new Set((v.items || []).map(x => x.snippet.channelId))];
  const ch = chIds.length ? await get(apiKey, 'channels', {part: 'statistics', id: chIds.join(',')}) : {items: []};
  const subs = Object.fromEntries((ch.items || []).map(c => [c.id, c.statistics?.hiddenSubscriberCount ? null : Number(c.statistics?.subscriberCount || 0)]));
  const order = Object.fromEntries(ids.map((id, i) => [id, i]));
  const removed = {shorts: 0, ad: 0};
  const videos = [];
  for (const it of (v.items || []).sort((a, b) => order[a.id] - order[b.id])) {
    if (!it.status?.embeddable || it.snippet.liveBroadcastContent !== 'none') continue;
    const sec = seconds(it.contentDetails.duration);
    const title = it.snippet.title;
    const lower = title.toLowerCase();
    if (sec <= SHORTS_MAX || lower.includes('#shorts')) { removed.shorts++; continue; }
    if (AD_WORDS.some(w => lower.includes(w))) { removed.ad++; continue; }
    const st = it.statistics || {};
    const views = Number(st.viewCount || 0);
    const likes = st.likeCount !== undefined ? Number(st.likeCount) : null;
    const th = it.snippet.thumbnails || {};
    videos.push({
      id: it.id, title, channel: it.snippet.channelTitle, published: it.snippet.publishedAt.slice(0, 10), sec,
      caption: it.contentDetails.caption === 'true', views,
      likeRatio: likes !== null && views >= 100 ? Math.round(likes / views * 1e4) / 1e4 : null,
      thumb: (th.medium || th.high || th.default || {}).url || '', tags: (it.snippet.tags || []).slice(0, 10),
      subs: subs[it.snippet.channelId] ?? null, rel: order[it.id],
    });
  }
  return {removed, videos};
}
