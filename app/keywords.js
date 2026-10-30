// 지금 뜨는 키워드 — 인기 급상승 영상의 제목·태그에서 「여러 채널이 함께 말하는 말」을 뽑는다.
// API 를 더 부르지 않고 이미 받은 목록만 쓴다. 한 채널이 여러 번 말한 것은 한 번으로 센다.
const STOP = new Set(('샘플 영상 공식 예고편 티저 뮤직비디오 official mv m/v live 라이브 full ver 풀버전 하이라이트 highlights ' +
  'vs ep 화 편 회 탄 1부 2부 리뷰 브이로그 vlog shorts 쇼츠 news 뉴스 자막뉴스 sbs kbs mbc jtbc 채널a tvn ' +
  '오늘 지금 진짜 정말 완전 이유 방법 모든 그냥 이번 결국 사람 우리 한국 the a of and in to for with on ' +
  '인기 급상승 전체 topic 영화 드라마 최초 공개 단독 ft feat 설명하기 50초 안에 ' +
  '가장 세상 선물 논란 사건 사람들 순간 최후 비밀 정리 총정리 분석 사용기 언박싱 실험 후기 레시피 감동 사연 만나 생기는일 ' +
  '엄마 아빠 아들 딸 여자 남자 남편 아내 며느리 시어머니 친구 동생 언니 오빠 ' +
  // 영어·일본어·중국어에서 흔한 말
  'video trailer music episode new how what why my your you is are this that from at by be it its we our all ' +
  'season part game games full official audio lyric lyrics visualizer reaction react best top day news update ' +
  // 나라별 흔한 말(영상 종류·기능어) — 영어·프랑스어·포르투갈어·힌디 제목에서 키워드를 가리던 것들
  'film films gaming gameplay launch animated short shorts song songs movie movies video videos clip clips music hindi tamil telugu ' +
  'officiel oficial clipe bande annonce album performance anime japan チャンネル ゲーム 遊戲 中文 片尾曲 片頭曲 ' +
  'les des une pour avec dans sur pas qui monde ' + 'here big funny latest special entertainment rock ' + 'que com para uma por mais desse ser dia jogo ' + 'and the for with feat ' +
  '예상 이슈 근황 내리 만들 채널 구독 채널에 teaser action cinema stage 公式 予告 予告編 切り抜き 配信 生配信 ライブ 動画 第 話 最新 中字 官方 預告 完整版 直播 精華').split(' '));
const PARTICLES = ['에서', '으로', '까지', '이랑', '하고', '처럼', '이', '가', '은', '는', '을', '를', '의', '와', '과', '도', '에', '로', '만'];

function stem(w) {
  for (const p of PARTICLES) {
    if (w.length >= p.length + 2 && w.endsWith(p) && /[가-힣]$/.test(w)) return w.slice(0, -p.length);
  }
  return w;
}
// 낱말 하나로 후보가 되려면 「강한 낱말」이어야 한다(2글자 이상·숫자 아님·흔한 말 아님).
// 「듄 파트 3」처럼 한 글자·숫자는 이어 붙은 말 안에서만 살린다.
// 로마자 낱말은 3글자 이상이어야 혼자 키워드가 된다(al·me·de·et 같은 기능어를 막는다)
const strong = w => w.length >= (/^[a-zà-ÿ]+$/.test(w) ? 3 : 2) && !STOP.has(w) && !/^\d+$/.test(w) && !/^\d+(년|월|일|시|분|만원|원|세|위)$/.test(w);
const CJK = '\u3040-\u30ff\u3400-\u9fff\uac00-\ud7a3';
function words(text) {
  const t = text.toLowerCase().replace(/['’`]/g, '').replace(/([가-힣])x([가-힣])/g, '$1 $2');
  return (t.match(new RegExp(`[${CJK}a-z0-9à-ÿ]+`, 'g')) || []).map(stem);
}
// 띄어쓰기가 없는 일본어·중국어를 위해: 태그 통째로, 괄호【】「」『』《》[] 안의 말, 해시태그를 그대로 후보로 쓴다
function phrases(v) {
  const out = new Set();
  for (const t of (v.tags || []).slice(0, 10)) { const x = stem(t.toLowerCase().trim()); if (x.length >= 2 && x.length <= 24 && !STOP.has(x)) out.add(x); }
  for (const m of v.title.matchAll(/[【「『《\[]([^】」』》\]]{2,24})[】」』》\]]/g)) out.add(m[1].toLowerCase().trim());
  for (const m of v.title.matchAll(/#([^\s#]{2,24})/g)) out.add(stem(m[1].toLowerCase()));
  // 낱말이 모두 흔한 말인 구절(official music video · bande annonce)은 버린다
  return [...out].filter(x => !STOP.has(x) && !/^\d+$/.test(x) && !x.split(/\s+/).every(w => STOP.has(w) || w.length < 3));
}

// videos: [{id, title, channel, tags?}] → [{kw, ids:[...] }] 상위 n 개
export function hotKeywords(videos, n = 8) {
  const seen = new Map();                         // 후보 → {channels:Set, ids:Set}
  for (const v of videos) {
    const ws = words(v.title + ' ' + (v.tags || []).slice(0, 10).join(' '));
    const inTitle = v.title.toLowerCase();
    const grams = new Set();
    for (let i = 0; i < ws.length; i++) {
      if (strong(ws[i])) grams.add(ws[i]);
      for (const k of [2, 3]) {
        const g = ws.slice(i, i + k);
        // 이어 붙은 말: 강한 낱말이 하나 이상, 흔한 말로 시작·끝나지 않음
        if (g.length === k && g.some(strong) && !STOP.has(g[0]) && !STOP.has(g[k - 1]) && new Set(g).size === k) grams.add(g.join(' '));   // 「minecraft minecraft」 같은 되풀이는 뺀다
      }
    }
    for (const p of phrases(v)) grams.add(p);
    for (const g of grams) {
      const e = seen.get(g) || {channels: new Set(), ids: new Set(), titles: 0};
      e.channels.add(v.channel); e.ids.add(v.id || v.title); seen.set(g, e);
      if (inTitle.includes(g)) e.titles++;                       // 제목에 실제로 나온 말을 태그에만 있는 말보다 앞에 둔다
    }
  }
  // 채널 이름(매일신문·방송사)은 화제가 아니다: 그 말을 쓴 채널의 절반 이상이 이름에 그 말을 갖고 있으면 뺀다
  const flat = x => x.toLowerCase().replace(/\s/g, '');
  const isChannel = (kw, e) => [...e.channels].filter(c => flat(c).includes(flat(kw))).length * 2 >= e.channels.size;
  let cands = [...seen].filter(([kw, e]) => e.channels.size >= 2 && !isChannel(kw, e))
    .map(([kw, e]) => ({kw, ch: e.channels.size, ids: [...e.ids], titles: e.titles, words: kw.split(' ').length}));
  // 더 긴 말이 거의 같은 채널 수(1 차이까지)를 가지면 짧은 말을 버린다(「아이폰」 대신 「아이폰 듀오」)
  cands = cands.filter(c => !cands.some(o => o !== c && o.words > c.words && o.ch >= Math.max(2, c.ch - 1) && (' ' + o.kw + ' ').includes(' ' + c.kw + ' ')));
  cands.sort((a, b) => b.ch - a.ch || b.titles - a.titles || b.words - a.words || a.kw.localeCompare(b.kw));
  const out = [];
  for (const c of cands) {
    if (out.some(o => o.ids.join() === c.ids.join())) continue;      // 같은 영상 묶음을 가리키는 말은 하나만
    out.push(c);
    if (out.length >= n) break;
  }
  // 영어 낱말은 첫 글자를 대문자로(「youre under arrest」 → 「Youre Under Arrest」)
  const show = kw => kw.replace(/(^|\s)[a-z]/g, c => c.toUpperCase());
  return out.map(({kw, ids, ch}) => ({kw: show(kw), ids, channels: ch}));
}
