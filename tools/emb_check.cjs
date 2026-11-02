// 퍼 가기 실재생 확인: 주소가 있는 페이지(127.0.0.1)에 iframe 을 띄워 플레이어 안 글자를 읽는다(빈 페이지는 리퍼러가 없어 전부 오류 153).
// 쓰는 법: NODE_PATH=/home/kim-h/work/BadgeLens_Frost/workspace/node_modules node tools/emb_check.cjs ID1 ID2 …  (한 번에 10개 이하)
// 「再生できません · unavailable · エラー · 無効 · 利用できません」 이 보이면 막힌 영상.
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']}); const p = await b.newPage({viewport: {width: 640, height: 400}});
  await p.route('http://127.0.0.1:8766/t*', r => r.fulfill({contentType: 'text/html', body: `<!doctype html><meta name="referrer" content="strict-origin-when-cross-origin"><iframe width=600 height=338 src="https://www.youtube.com/embed/${new URL(r.request().url()).searchParams.get('id')}?autoplay=1&playsinline=1" allow="autoplay; encrypted-media" referrerpolicy="strict-origin-when-cross-origin"></iframe>`}));
  for (const id of process.argv.slice(2)) {
    try { await p.goto('http://127.0.0.1:8766/t?id=' + id, {waitUntil: 'domcontentloaded', timeout: 45000}); } catch { console.log(id, '|', 'frame err goto timeout'); continue; }   // 한 편이 막혀도 나머지는 계속
    await p.waitForTimeout(7000);
    let txt = ''; try { txt = (await p.frames()[1].evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 140); } catch { txt = 'frame err'; }
    console.log(id, '|', txt);
  }
  await b.close();
})();
