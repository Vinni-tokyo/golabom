#!/usr/bin/env node
// 명품관 이어 보기 시험 — 실제 브라우저(Chromium)로 관을 열고, 작품 끝을 만들어 다음 작품이 「손대지 않고」 이어 재생되는지 본다.
//   python3 -m http.server 8765 &   (저장소 맨 위에서)
//   NODE_PATH=<playwright 가 있는 node_modules> node tools/e2e_autoplay.cjs [http://localhost:8765/app/]
//   진짜 Chrome: chrome --headless=new --remote-debugging-port=9333 --autoplay-policy=document-user-activation-required --user-data-dir=<임시> 를 띄우고 CDP=http://127.0.0.1:9333
// 자동 재생 규칙은 가장 엄격한 것(--autoplay-policy=document-user-activation-required, 모바일과 같은 조건)으로 둔다.
const {chromium, devices} = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765/app/';
const results = [];
const ok = (name, pass, info = '') => { results.push({name, pass, info}); console.log(`${pass ? '✅' : '❌'} ${name}${info ? ' — ' + info : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function until(fn, ms = 20000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch {} await sleep(step); }
  return null;
}
// 지금 YouTube 플레이어: [영상 id, 상태(1=재생)]
const yt = page => page.evaluate(() => { const p = globalThis.__gxYT?.(); return p?.getVideoData ? [p.getVideoData().video_id, p.getPlayerState()] : null; });
// 재생 중인 플랫폼 iframe 의 <video> 를 끝 3초 앞으로 보낸다(시험에서만)
async function seekEnd(page, host) {
  if (host.includes('youtube')) return page.evaluate(() => { const p = globalThis.__gxYT?.(); const d = p?.getDuration?.(); if (!d) return false; p.seekTo(d - 3, true); return true; });
  const f = page.frames().find(f => f.url().includes(host));
  if (!f) return false;
  return f.evaluate(() => { const v = document.querySelector('video'); if (!v || !v.duration) return false; v.currentTime = v.duration - 3; v.play(); return true; });
}
async function playing(page, host) {
  const f = page.frames().find(f => f.url().includes(host));
  return f ? f.evaluate(() => { const v = document.querySelector('video'); return !!v && !v.paused && v.currentTime > 0.3; }) : false;
}
async function startAll(page, hall, at = 0) {
  await page.goto(`${BASE}?r=${Date.now()}#/g/${hall}`); await page.waitForSelector('.gxplay');
  if (at) await page.click(`.gxact [data-all="${at}"]`); else await page.click('.gxacts [data-all="0"]');
  // 첫 작품: 사람이 누른 재생이므로 막히면 안 된다
  const blocked = await until(async () => (await page.locator('.gxnext:not([hidden]) [data-resume]').count()) ? 'blocked' : null, 8000);
  if (blocked) await page.click('.gxnext:not([hidden]) [data-resume]');           // 사람이 한 번 더 누른 것과 같다
  return blocked;
}

(async () => {
  // CDP=http://127.0.0.1:9333 이면 이미 띄운 진짜 Chrome 에 붙는다(Vimeo 는 H.264 가 없는 Playwright Chromium 에서 재생되지 않는다)
  const browser = process.env.CDP ? await chromium.connectOverCDP(process.env.CDP)
    : await chromium.launch({headless: true, args: ['--autoplay-policy=document-user-activation-required']});
  const ctx = await browser.newContext({...devices['Pixel 7']});
  const page = await ctx.newPage();
  const G = await (await page.request.get(`${BASE}data/gallery/guitar.json`)).json();
  const ids = G.works.map(w => w.id);

  // 1) 전관 이어 보기 → 1번 재생 → 끝 → 8초 안내 → 2번이 손대지 않고 재생 → 다시 끝 → 3번
  const b0 = await startAll(page, 'guitar');
  const s0 = await until(async () => { const s = await yt(page); return s && s[0] === ids[0] && s[1] === 1; });
  ok('1번 작품 재생', !!s0, b0 ? '첫 재생이 막혀 「눌러서 재생」을 한 번 더 누름' : '누른 즉시 재생');
  for (const k of [1, 2]) {
    await until(() => seekEnd(page, 'youtube.com/embed'));
    const panel = await until(async () => (await page.locator('.gxnext:not([hidden]) .gxnk').textContent()).includes('초 뒤'), 15000);
    ok(`${k}번 끝 → 다음 작품 안내`, !!panel);
    const s = await until(async () => { const s = await yt(page); return s && s[0] === ids[k] && s[1] === 1 && s; }, 25000);
    const blocked = await page.locator('.gxnext:not([hidden]) [data-resume]').count();
    ok(`${k + 1}번이 손대지 않고 이어 재생`, !!s && !blocked, s ? `video ${s[0]}` : `막힘 ${blocked}`);
    ok(`${k + 1}번 진행 띠·번호`, (await page.locator('.gxprog button.on').getAttribute('aria-label')) === `${k + 1}번 작품`);
  }
  // 2) 어디까지 봤는지 기억 → 다시 들어오면 「03번부터 이어서」
  await page.click('[data-close]');
  await page.goto(`${BASE}?r=${Date.now()}#/g/guitar`); await page.waitForSelector('.gxplay');
  ok('다시 들어오면 이어서 단추', (await page.locator('.gxacts [data-all="2"]').count()) === 1, await page.locator('.gxacts').innerText());

  // 3) 재생이 안 되는 작품(없는 id)은 5초 안내 뒤 건너뛴다
  await page.route('**/data/gallery/guitar.json', r => r.fulfill({json: {...G, works: G.works.map((w, i) => i === 1 ? {...w, id: 'zzzzzzzzzzz'} : w)}}));
    await startAll(page, 'guitar');
  await until(async () => (await yt(page))?.[1] === 1);
  await until(() => seekEnd(page, 'youtube.com/embed'));
  const err = await until(async () => (await page.locator('.gxnext .gxnk').textContent()).includes('재생되지 않습니다'), 30000);
  ok('없는 작품 → 안내', !!err);
  const s3 = await until(async () => { const s = await yt(page); return s && s[0] === ids[2] && s[1] === 1 && s; }, 25000);
  ok('없는 작품을 건너뛰고 3번 재생', !!s3);
  await page.click('[data-close]'); await page.unroute('**/data/gallery/guitar.json');

  // 4) 플랫폼이 바뀌는 자리: stage 9번(YouTube) → 10번(Vimeo) → 11번(YouTube)
  const S = await (await page.request.get(`${BASE}data/gallery/stage.json`)).json();
  const vi = S.works.findIndex((w, i) => w.platform === 'vimeo' && S.works[i - 1]?.platform === 'youtube' && S.works[i + 1]?.platform === 'youtube');
  if (vi > 0) {
    await page.route('**/data/gallery/stage.json', r => r.fulfill({json: {...S, acts: [{start: 0, title: 'a', lead: ''}, {start: vi - 1, title: 'b', lead: ''}]}}));
    await startAll(page, 'stage', vi - 1);
    await until(async () => (await yt(page))?.[1] === 1);
    await until(() => seekEnd(page, 'youtube.com/embed'));
    const vplay = await until(() => playing(page, 'player.vimeo.com'), 30000);
    const vmuted = await (page.frames().find(f => f.url().includes('player.vimeo.com'))?.evaluate(() => document.querySelector('video')?.muted));
    ok('YouTube → Vimeo 손대지 않고 이어 재생', !!vplay, vmuted ? '소리 없이(브라우저 규칙) → 「소리 켜기」 단추' : '소리 있게');
    if (vmuted) {
      await until(async () => (await page.locator('.gxnext:not([hidden]) [data-resume]').count()), 10000);
      await page.click('.gxnext:not([hidden]) [data-resume]'); await sleep(2500);
      const f = page.frames().find(f => f.url().includes('player.vimeo.com'));
      const v = await f.evaluate(() => { const v = document.querySelector('video'); return [v.muted, v.paused]; });
      ok('「소리 켜기」 → 소리 나며 계속 재생', !v[0] && !v[1], `muted ${v[0]} paused ${v[1]}`);
    }
    await until(() => seekEnd(page, 'player.vimeo.com'));
    const back = await until(async () => { const s = await yt(page); return s && s[0] === S.works[vi + 1].id && s[1] === 1 && s; }, 40000);
    const ytm = await page.evaluate(() => globalThis.__gxYT?.()?.isMuted?.());
    ok('Vimeo → YouTube 손대지 않고 이어 재생', !!back, back ? (ytm ? '소리 없이' : '소리 있게') : `상태 ${(await yt(page))?.[1]}`);
    await page.click('[data-close]'); await page.unroute('**/data/gallery/stage.json');
  }

  // 5) 끝 신호가 없는 플랫폼(TED): 길이 + 20초 뒤 15초 안내
  const tedHall = S.works.findIndex(w => w.platform === 'ted');
  if (tedHall >= 0) {
    const works = [{...S.works[tedHall], sec: 2}, S.works.find(w => w.platform === 'youtube')];
    await page.route('**/data/gallery/stage.json', r => r.fulfill({json: {...S, acts: [], works}}));
    await startAll(page, 'stage');
    const g5 = await until(async () => (await page.locator('.gxnext .gxnk').textContent()).includes('작품 길이가'), 40000);
    ok('TED: 길이 + 20초 뒤 다음 안내', !!g5);
    const s5 = await until(async () => { const s = await yt(page); return s && s[0] === works[1].id && s; }, 25000);
    ok('TED → YouTube 넘어감', !!s5);
    // 6) 마지막 작품 → 「관람을 마쳤습니다」
    await until(async () => (await yt(page))?.[1] === 1, 15000);
    await until(() => seekEnd(page, 'youtube.com/embed'));
    ok('마지막 → 관람을 마쳤습니다', !!(await until(async () => (await page.locator('.gxnext .gxnk').textContent()).includes('마쳤습니다'), 20000)));
    await page.unroute('**/data/gallery/stage.json');
  }

  // 7) 화면: 표지 · 아래 띠 · 관람실 (모바일)
  await page.goto(`${BASE}?r=${Date.now()}#/g/guitar`); await page.waitForSelector('.gxplay');
  await page.screenshot({path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/cover.png` : 'cover.png'});
  await page.mouse.wheel(0, 1600); await sleep(800);
  ok('스크롤하면 아래 재생 띠', await page.locator('.gxbar').isVisible());
  await page.screenshot({path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/bar.png` : 'bar.png'});
  await page.click('.gxbar button'); await sleep(4000);
  await page.screenshot({path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/theater.png` : 'theater.png'});

  await browser.close();
  const bad = results.filter(r => !r.pass);
  console.log(`\n${results.length - bad.length}/${results.length} 통과`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
