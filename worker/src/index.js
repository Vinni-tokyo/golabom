// 골라봄 검색 중계(Cloudflare Worker) — API 키를 숨긴 채 YouTube 를 대신 검색한다.
//   GET /search?q=캠핑 의자 후기 -리액션&dur=long&after=year&cap=1  →  {q, cached, removed, videos:[...]}
//     q 는 골라봄이 버튼으로 조립한 검색문(-뺄 말 · "꼭 들어갈 말" 포함), dur·after·cap 은 YouTube 검색 조건
//   GET /thread?v=<YouTube id> →  {v, channel, subs, videos:[...]}  실타래 파기 첫 갈래: 같은 채널의 다른 영상(검색 없이 4단위)
//   GET /trends              →  {trendAt, kr:{분야:{removed,videos}}, countries:{나라:{...}}}  (1시간마다 Cron 이 KV 에 채움)
// 지키는 것
//   · 키는 Worker 비밀값(YT_API_KEY)에만 둔다. 브라우저는 검색어만 보낸다.
//   · 골라봄 주소(ALLOWED_ORIGINS)에서 온 요청만 받는다.
//   · 같은 검색은 7일 동안 KV 에 저장해 다시 쓴다(API 데이터 30일 규정 안).
//   · 새 검색은 하루 DAILY_CAP 번까지만 — search.list 하루 100회 중 매일 아침 자동 작업(약 50회)이 쓸 몫을 남긴다.
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
    if (new URL(req.url).pathname === '/videos') return videoInfo(req, env);     // 운영자 전용(갤러리 큐레이션용)
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
    if (url.pathname !== '/search' && url.pathname !== '/thread') return json({error: 'not found'}, 404);
    // 새 검색은 사람의 브라우저에서 온 것만 받는다. 조사 에이전트·스크립트(curl·python)가 하루 한도를 쓰지 못하게 막는다(10-31).
    //   브라우저는 fetch 에 Sec-Fetch-Mode 를 붙이고, 명령줄 도구는 붙이지 않는다. 조사는 웹 검색·채널 RSS·oEmbed 로 한다(tools/SCOUT_BRIEF.md).
    if (!req.headers.get('Sec-Fetch-Mode') || !/Mozilla\//.test(req.headers.get('User-Agent') || '')) return json({error: 'browser only', message: '골라봄 화면에서만 찾을 수 있어요.'}, 403);
    if (url.pathname === '/thread') return thread(url, req, env, json);

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
    if (used >= Number(env.DAILY_CAP || 70)) return json({error: 'daily cap', message: '오늘 새로 찾을 수 있는 횟수를 다 썼어요. 내일 다시 찾아 주세요.'}, 429);
    // 한 사람(IP)이 하루 몫을 다 쓰지 못하게: 새 검색은 한 사람당 하루 PER_USER 번까지(IP 는 해시로만 남긴다)
    const ipHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode((req.headers.get('CF-Connecting-IP') || '') + day)))].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
    const userKey = `u:${day}:${ipHash}`;
    const mine = Number(await env.SEARCH_CACHE.get(userKey)) || 0;
    if (mine >= Number(env.PER_USER || 10)) return json({error: 'daily cap', message: '오늘 새로 찾을 수 있는 횟수를 다 썼어요. 내일 다시 찾아 주세요.'}, 429);
    await env.SEARCH_CACHE.put(countKey, String(used + 1), {expirationTtl: 2 * 86400});
    await env.SEARCH_CACHE.put(userKey, String(mine + 1), {expirationTtl: 2 * 86400});

    try {
      const body = await search(env.YT_API_KEY, q, {dur, after, cap, def, lang, order});
      const out = {q, dur, after, cap, def, lang, order, ...body, at: new Date().toISOString()};
      await env.SEARCH_CACHE.put(key, JSON.stringify(out), {expirationTtl: 7 * 86400});   // 같은 검색은 7일 동안 다시 쓴다(API 데이터 30일 규정 안)
      return json({...out, cached: false});
    } catch (e) {
      return json({error: 'youtube', status: e.status || 500}, e.status === 403 ? 429 : 502);
    }
  },
};

// 실타래 파기(시범 · 11-01): 이 영상을 올린 채널의 최근 50편 중, 3분 넘고 광고·자극적 제목이 아닌 것을 「본 사람이 만족한」 순으로.
//   videos 1 + channels 1 + (playlistItems 1 + videos 1) × 최대 3쪽 + 시리즈 찾기 최대 12 ≈ 19단위(검색 100단위를 쓰지 않는다). 같은 영상은 3일 동안 다시 쓴다.
//   갈래(11-01 사용자 정정): 관련 있는 것만 — 같은 시리즈 · 가까운 이야기. 「다른 이야기 · 오래전 영상」은 너무 벗어나서 뺐다.
async function thread(url, req, env, json) {
  const v = url.searchParams.get('v') || '';
  if (!/^[\w-]{11}$/.test(v)) return json({error: 'bad query'}, 400);
  const key = `t8:${v}`;
  const hit = await env.SEARCH_CACHE.get(key, 'json');
  if (hit) return json({...hit, cached: true});
  const day = new Date(Date.now() - 8 * 3600e3).toISOString().slice(0, 10);
  const used = Number(await env.SEARCH_CACHE.get(`tn:${day}`)) || 0;
  const ipHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode((req.headers.get('CF-Connecting-IP') || '') + day)))].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
  const mine = Number(await env.SEARCH_CACHE.get(`tu:${day}:${ipHash}`)) || 0;
  if (used >= Number(env.THREAD_CAP || 800) || mine >= Number(env.THREAD_PER_USER || 60)) return json({error: 'daily cap', message: '오늘 더 파고들 수 있는 횟수를 다 썼어요. 내일 다시 이어 주세요.'}, 429);
  await env.SEARCH_CACHE.put(`tn:${day}`, String(used + 1), {expirationTtl: 2 * 86400});
  await env.SEARCH_CACHE.put(`tu:${day}:${ipHash}`, String(mine + 1), {expirationTtl: 2 * 86400});
  try {
    const me = (await get(env.YT_API_KEY, 'videos', {part: 'snippet', id: v})).items?.[0];
    if (!me) return json({error: 'not found'}, 404);
    const ch = (await get(env.YT_API_KEY, 'channels', {part: 'contentDetails,statistics', id: me.snippet.channelId})).items?.[0];
    const subs = !ch || ch.statistics?.hiddenSubscriberCount ? null : Number(ch.statistics?.subscriberCount || 0);
    const up = ch?.contentDetails?.relatedPlaylists?.uploads;
    // 업로드 목록을 최근 150편까지(50편씩 3쪽) — 오래된 영상도 후보에 들게
    const items = [];
    let page = '';
    for (let n = 0; up && n < 3; n++) {
      const pl = await get(env.YT_API_KEY, 'playlistItems', {part: 'contentDetails', playlistId: up, maxResults: 50, ...(page ? {pageToken: page} : {})});
      const ids = (pl.items || []).map(x => x.contentDetails.videoId).filter(x => x !== v);
      if (ids.length) items.push(...((await get(env.YT_API_KEY, 'videos', {part: 'snippet,contentDetails,statistics,status', id: ids.join(',')})).items || []));
      page = pl.nextPageToken;
      if (!page) break;
    }
    // 같은 시리즈(11-01 사용자: 「비슷하면서 관련된 것」만): 이 채널 재생목록 중 지금 영상이 든 목록을 찾아 다음 편 · 앞 편을 낸다.
    //   playlists 1 + 목록 10개 첫 쪽 × 1 = 최대 11단위. 업로드 150편에 없던 편은 videos 1단위로 더 받는다.
    const series = [];
    const pls = (await get(env.YT_API_KEY, 'playlists', {part: 'snippet,contentDetails', channelId: me.snippet.channelId, maxResults: 50})).items || [];
    // 재생목록이 많은 채널: 목록 이름이 지금 영상의 제목 · 설명 · 태그와 겹치는 것부터 뒤진다(CNA 「Remarkable Living」 사례)
    const meText = [me.snippet.title, me.snippet.description, ...(me.snippet.tags || [])].join(' ').toLowerCase();
    const plScore = p => [...words(p.snippet.title)].filter(w => meText.includes(w)).length;
    const scan = pls.filter(p => p.contentDetails.itemCount >= 2 && p.contentDetails.itemCount <= 500).sort((a, b) => plScore(b) - plScore(a)).slice(0, 10);
    const found = await Promise.all(scan.map(p => get(env.YT_API_KEY, 'playlistItems', {part: 'contentDetails', playlistId: p.id, maxResults: 50})
      .then(r => ({title: p.snippet.title, ids: (r.items || []).map(x => x.contentDetails.videoId)})).catch(() => null)));
    for (const f of found) {
      const k = f ? f.ids.indexOf(v) : -1;
      if (k >= 0) series.push({title: f.title, ids: [...f.ids.slice(k + 1), ...f.ids.slice(0, k).reverse()]});   // 다음 편부터, 그다음 앞 편
    }
    series.sort((a, b) => a.ids.length - b.ids.length);   // 작은 목록일수록 「시리즈」에 가깝다(큰 목록은 「전체 영상」류)
    const have = new Set(items.map(it => it.id));
    const need = [...new Set(series.flatMap(s => s.ids))].filter(id => id !== v && !have.has(id)).slice(0, 50);
    if (need.length) items.push(...((await get(env.YT_API_KEY, 'videos', {part: 'snippet,contentDetails,statistics,status', id: need.join(',')})).items || []));
    const videos = [];
    for (const it of items) {
      if (!it.status?.embeddable || it.snippet.liveBroadcastContent !== 'none') continue;
      const c = card(it, subs), lower = c.title.toLowerCase();
      if (c.sec < 180 || lower.includes('#shorts') || AD_WORDS.some(w => lower.includes(w)) || BAIT_WORDS.some(w => lower.includes(w))) continue;
      videos.push(c);
    }
    const sat = c => (c.likeRatio ?? 0.01) * Math.log10(c.views + 10);     // 본 사람의 만족: 좋아요 비율을 앞에, 조회수는 조금만
    const skip = words(me.snippet.channelTitle);                           // 채널 이름은 어느 영상에나 붙으니 겹침으로 세지 않는다
    const src = new Set([...words(me.snippet.title), ...(me.snippet.tags || []).flatMap(words)].filter(w => !skip.has(w)));
    // 겹침은 「이 채널에서 드문 말」만 센다 — 뉴스 채널의 year·make 같은 말이 겹쳐 엉뚱한 영상이 「가까운 이야기」가 되지 않게
    const bag = c => c._w ||= [...new Set([...words(c.title), ...(c.tags || []).flatMap(words)])];
    const df = {};
    for (const c of videos) for (const w of bag(c)) df[w] = (df[w] || 0) + 1;
    const rare = Math.max(2, Math.ceil(videos.length * 0.05));
    const hits = c => bag(c).filter(w => src.has(w) && df[w] <= rare);
    const near = c => hits(c).length;                        // 「가까운 이야기」는 드문 낱말이 두 개 이상 겹칠 때만(하나는 우연 · 11-01 CNA 사례)
    const byId = Object.fromEntries(videos.map(c => [c.id, c]));
    const ser = [];
    for (const sr of series) for (const id of sr.ids) if (byId[id] && !ser.some(x => x.id === id)) ser.push({...byId[id], series: sr.title});
    const nearList = videos.filter(c => !ser.some(x => x.id === c.id) && (near(c) >= 2 || hits(c).some(w => w.length >= 4 && !COMMON.has(w))))
      .sort((a, b) => near(b) - near(a) || sat(b) - sat(a));
    // 관련 있는 것만: 같은 시리즈와 가까운 이야기를 번갈아. 관련 영상이 없으면 채우지 않는다(엉뚱한 영상보다 「없음」이 낫다).
    const picked = [];
    for (let k = 0; picked.length < 12 && (k < ser.length || k < nearList.length); k++) {
      if (ser[k]) picked.push({...ser[k], why: 'series'});
      if (nearList[k] && picked.length < 12) picked.push({...nearList[k], why: 'near', hit: hits(nearList[k])});
    }
    picked.forEach(c => delete c._w);
    const out = {v, channel: me.snippet.channelTitle, subs, videos: picked, at: new Date().toISOString()};
    await env.SEARCH_CACHE.put(key, JSON.stringify(out), {expirationTtl: 3 * 86400});
    return json({...out, cached: false});
  } catch (e) {
    return json({error: 'youtube', status: e.status || 500}, e.status === 403 ? 429 : 502);
  }
}

// 겹침을 재는 낱말: 소문자 · 두 글자 이상 · 흔한 말 빼기 · 한국어 끝의 조사 떼기(「시계를」 → 「시계」)
// 흔한 영어 낱말: 하나만 겹쳐서는 「가까운 이야기」로 치지 않는다(CNA 사례: living · make · year)
const COMMON = new Set(('year years make made makes work works working living life world people time times first last best good great more most much many make '
  + 'high near long short over under after before still back home house city country state public open free real true love know think want need help '
  + 'take takes come comes goes going look looks find found give gives keep left right next week month today tonight says said talk talks show shows '
  + 'story stories inside behind across around against during without through change future power money family music song songs world day days night '
  + 'version audio acoustic remastered lyrics excerpt interview speech lecture documentary trailer music').split(' '));
const STOP = new Set('the a an and or of to in on for with from by is are was be how why what who this that your you my our it its at as into about vs ep episode full official video videos news live part new the'.split(' '));
function words(t) {
  return new Set(String(t || '').toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .map(w => /[가-힣]/.test(w) ? w.replace(/(으로|에서|에게|까지|부터|이라|라는|하는|하기|은|는|이|가|을|를|의|에|와|과|도|로|만)$/, '') : w)
    .filter(w => w.length >= 2 && !STOP.has(w)));
}

// 운영자 전용: 설명란·챕터·태그 등 큐레이션 재료. GET /videos?ids=a,b,c + Bearer REFRESH_TOKEN. 50편까지 한 번에(1단위).
async function videoInfo(req, env) {
  if (!env.REFRESH_TOKEN || req.headers.get('Authorization') !== `Bearer ${env.REFRESH_TOKEN}`) return new Response('{"error":"forbidden"}', {status: 403});
  const ids = (new URL(req.url).searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 50);
  const v = await get(env.YT_API_KEY, 'videos', {part: 'snippet,contentDetails,statistics', id: ids.join(',')});
  const out = (v.items || []).map(it => ({id: it.id, title: it.snippet.title, channel: it.snippet.channelTitle, sec: seconds(it.contentDetails.duration),
    lang: it.snippet.defaultAudioLanguage || it.snippet.defaultLanguage || null, caption: it.contentDetails.caption === 'true',
    description: it.snippet.description, tags: it.snippet.tags || [],
    chapters: [...it.snippet.description.matchAll(/^\s*(?:\(?(\d{1,2}):(\d{2})(?::(\d{2}))?\)?)\s*[-–—:|]?\s*(.+?)\s*$/gm)]
      .map(m => ({at: m[3] !== undefined ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]), title: m[4]}))}));
  return new Response(JSON.stringify(out), {headers: {'Content-Type': 'application/json; charset=utf-8'}});
}

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
