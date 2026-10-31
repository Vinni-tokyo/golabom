# 골라봄 전시관 조사 브리프 (SCOUT_BRIEF)

새 전시관을 지을 때 조사 에이전트에게 이 파일을 그대로 건넨다. 출력 경로는 매번 스크래치패드의 `set<N>/` 로 바꾼다.

## 0. 조사 방법 — YouTube 검색 할당량을 쓰지 않는다 (10-31 고정)

골라봄 Worker(`golabom-search…/search`)와 YouTube Data API `search.list` 는 **쓰지 않는다**. 하루 100회뿐인 검색 몫은 사람(사용자)의 것이다. Worker 는 브라우저가 아닌 요청을 403 으로 거절한다.

| 할 일 | 쓰는 길 | 할당량 |
|---|---|---|
| 후보 찾기 | 에이전트의 웹 검색(「공식 채널명 + 주제」, `site:youtube.com` · `site:vimeo.com` · `site:ted.com`) | 0 |
| 공식 채널의 영상 훑기 | 채널 RSS `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>` (최신 15편) | 0 |
| 존재·공식 채널·퍼가기 확인 | YouTube `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<ID>&format=json` (200 + author_name) · Vimeo `https://vimeo.com/api/oembed.json?url=https://vimeo.com/<ID>` · TED `https://www.ted.com/services/v1/oembed.json?url=<강연 URL>` | 0 |
| 길이 | 시청 페이지 `lengthSeconds`(막히면 비워 둔다. 빌드 때 공식 데이터로 채워진다) | 0 |
| 이미 받아 둔 영상 | `app/data/gen/`·`app/data/sample/` 의 깊이 파기·토픽 데이터 | 0 |

YouTube 시청 페이지가 429 로 막히면 멈추고, oEmbed 까지만 확인했다고 보고한다. 비공식 자막·검색 주소, 영상 내려받기, 리액션·재업로드는 쓰지 않는다.

## 0.5 출처 2급 — 「권리자 묵인」 영상 허용 (11-01 결정 B)

공식 채널(1급)이 기본이다. 다만 **권리자가 내리지 않고 수익화를 택한 비공식 업로드**는 2급으로 걸 수 있다.
- 조건 ①: 시청 페이지 설명란 아래 **「Licensed to YouTube by …」** 또는 **Music 크레딧(곡·아티스트·레이블)** 이 있다 → 권리자가 Content ID 로 수익화 중.
- 조건 ②: 올린 날이 **3년 이상 전**(publishDate ≤ 2023-11)이고 아직 살아 있다.
- 조건 ③: 원본 그대로의 실황 1편. 재편집·컴필레이션·리액션·자막 덧씌움·속도 변경은 2급이어도 ✗.
- 후보 항목에 `"tier":"licensed"`, `"rights":"<Licensed to YouTube by 에 적힌 권리자>"`, `"uploaded":"YYYY-MM-DD"` 를 넣는다. 1급은 `"tier":"official"`.
- 한 관에 2급은 **절반(7편) 이하**. 11번(정점)과 1번(문턱)은 가능하면 1급.
- 시청 페이지가 429 로 막혀 설명란을 못 보면 2급 판정을 **보류**하고 `"tier":"unknown"` 으로 적는다.

---

## Read first
- /home/kim-h/work/golabom/docs/CURATION_PRINCIPLES_2026-10-30.md (all; esp. §3 레시피, §4 명판 공식·금지어, §5, §7)
- One finished hall for format/tone: /home/kim-h/work/golabom/app/data/gallery/oneday.json and /home/kim-h/work/golabom/app/data/gallery/seeing.json

## Entry standard (all must hold)
- Official sources only: original creator channel, broadcaster/institution/university/festival/label official, "- Topic" auto channels (score ≤7). No reuploads, no compilations/"top 10", no reaction, no clickbait, no AI slop, no fan lyric videos. Educational channels count as official when they are the creator (3Blue1Brown, Kurzgesagt, TED-Ed, Veritasium, Royal Institution, Numberphile, CrashCourse, 세바시, EBS, KBS, BBC, NHK WORLD, Louisiana Channel, Big Think, MasterClass official trailers are NOT enough — need full lessons).
- Timeless, high craft, 3–30 min preferred (one longer piece allowed at 9–10).
- Diversity: countries, forms, creators; one channel ≤2 per hall. Mix platforms where real (YouTube, Vimeo, TED). Dailymotion is NOT embeddable — skip.
- Verify EVERY item; never invent IDs: YouTube oEmbed `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=ID&format=json` (200 + official author_name) and, when feasible, watch-page `playableInEmbed:true` / not age-restricted; Vimeo oEmbed `https://vimeo.com/api/oembed.json?url=https://vimeo.com/ID`; TED `https://www.ted.com/services/v1/oembed.json?url=<talk url>`. Fetch durations where possible (`lengthSeconds`). Do not use the golabom search proxy.

## Design per hall (principles)
thesis(25–45자) · sub · intro(≤200자: 주장+왜 지금+보는 순서, 큐레이터의 솔직한 동기 한 줄 허용) · order(12–14 ids; 1=짧고 밝은 문턱 ≤6분, 7=쉼(가장 조용), 9–10=가장 긴 것, 11=정점(유대가 깊어지는 순간/경외), 14=코다; no 3 consecutive same platform/country/channel) · acts[{first:<id>, title, lead}] (2–4 story turns) · peak(id) · notes{id: 40–70자, one job: 보는 법 하나 or 틈 하나; no forbidden words 감동적·눈물·소름·충격·명작·레전드·최고의·필수·강추·전설·미쳤다·압도적·경이로운; no numbers/awards; NEVER invent moments you have not verified — open a gap instead} · outro(답 없는 질문 + 다음 관 한 줄 + "— 골라봄") · titles{id: 한국어 작품명}.

## Output (write nothing to the repo)
- `/home/kim-h/.claude-tmp/claude-1000/-home-kim-h-work-skillpath/e4a3f810-2654-4a02-96c9-2d875f35f975/scratchpad/set<N>/gallery_candidates_<BATCH>.json` = `{"<hallid>":[...]}` items `{"platform","id","url","title","channel","sec","thumb","country","stance?","note","license":"yt-api|nc-only|commercial-ok","verified","score":1-10}` (include alternates with `"alt":true`)
- `/home/kim-h/.claude-tmp/claude-1000/-home-kim-h-work-skillpath/e4a3f810-2654-4a02-96c9-2d875f35f975/scratchpad/set<N>/hall_design_<BATCH>.json` = `{"<hallid>":{no, kind:"theme", title, sub, thesis, intro, order, acts, peak, notes, outro, titles}}`
Return a short Korean summary per hall: counts/platforms, thesis, act titles, 1/7/9-10/11/14 choices, exclusions, gaps. Be honest about anything unverified.

## set5 additions (from PM + Korean writer review — these OVERRIDE anything above)
- Program context: halls now sit in a life curriculum 「사람 공부」 (7 terms: 경이 · 몸과 마음 · 생각하는 법 · 세상이 굴러가는 법 · 만들고 표현하기 · 함께 살기 · 끝과 의미) or are 기능관 (when/why to watch). Add `"term": "<term name>"` or `"use": "<기능>"` to each hall design.
- Diversity targets per hall: ≥2 works whose spoken language is neither English nor Korean (Japanese, French, German, Spanish, Chinese, Arabic, Hindi… official sources), ≥1 work that is a genuinely different view — mark it `"stance":"다른 시각"` in candidates. One channel ≤2 per hall. Avoid KBS 가요톱10 and TED-Ed (already overused); TED talks allowed but ≤3 per hall.
- Copy rules (Korean writer):
  1. 「~보라 / 들어 보라 / 찾아보라」 endings: at most 3 notes per hall. Use observation statements, questions, or a first-person line instead.
  2. Never expose programming terms in notes: no 쉼·정점·끝맛·가장 조용한 자리·다른 시각·숨을 고르자. Position shows it.
  3. intro opens with the curator's honest motive, NOT a restatement of the thesis; route: name only the first and last work (no 「~에서 시작해 ~를 지나」 formula).
  4. outro: question form must differ from 「당신은 ~입니까」 — ask about a scene or invite an act. Keep the next-hall line + 「— 골라봄」.
  5. thesis must NOT use 「A가 아니라 B」. At most one comma-noun-list opening in act leads per hall.
- Next-hall line in outro: just point to the next hall named in your batch, or 「다음 관」 generically for the last.
