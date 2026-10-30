# 골라봄 입점 조사 — 영상 플랫폼 15곳

- 작성: 2026-10-30
- 목적: 「영상의 ABC마트」(여러 플랫폼의 좋은 영상을 한 곳에서 고르고 보기)를 만들 수 있는지, 플랫폼마다 **검색 · 퍼가기 · 정보 · 규정**을 확인합니다.
- 조사 방법: 조사 에이전트 2개가 공식 개발자 문서·약관을 읽고, 일부는 인증 없이 직접 호출해 확인했습니다. 근거를 찾지 못한 내용은 **미확인**으로 적었습니다.
- 함께 볼 문서: [기획 v0.3](PLAN_v0.3_2026-10-30.html)

---

## 0. 쉽게 읽는 요약

**예시.** "캠핑 의자 후기"를 골라봄에서 찾으면 지금은 YouTube 영상만 나옵니다. ABC마트처럼 여러 브랜드를 갖추려면 Vimeo · 틱톡 · 네이버의 영상도 같은 화면에 나와야 합니다.

**알아낸 것.** 플랫폼마다 문이 열린 정도가 크게 다릅니다.

- **검색까지 되는 곳은 셋뿐입니다.** YouTube, Dailymotion, 니코니코입니다. 그나마 니코니코는 **영리 목적이 금지**되어 있고, Dailymotion 은 검색 기능이 새 문서에서 빠져 **언제 막힐지 모릅니다**.
- **퍼가기(우리 화면에서 재생)는 대부분 됩니다.** TikTok · Instagram · Vimeo · TED · Bilibili · Twitch 가 여기에 해당합니다. 사람이 영상을 직접 골라 넣는 **진열**은 할 수 있다는 뜻입니다.
- **국내 플랫폼은 막혀 있습니다.** 네이버TV(2026-09-30)와 카카오TV(2026-03)는 서비스를 끝냈고, 네이버 클립 · 치지직 · SOOP 은 공개 검색 API 가 없습니다.
- **비슷한 서비스는 찾지 못했습니다.** 여러 플랫폼을 함께 찾는 검색은 예전부터 있었지만, 대부분 원본 사이트로 보내고 상당수는 문을 닫았습니다. **"버튼으로 만드는 정밀 검색 + 골라 준 영상 + 한 화면 재생"** 조합은 찾지 못했습니다.

**뜻하는 것.** 「모든 플랫폼을 검색」하는 ABC마트는 지금 만들 수 없습니다. 반면 **「사람이 골라 진열」하는 ABC마트(명작 갤러리)는 지금 바로 만들 수 있습니다.** 퍼가기만 있으면 되기 때문입니다.

**지금 골라봄에 바로 영향이 있는 것.** YouTube 검색 할당량 계산 방식이 바뀌었습니다(2026-10-15). 검색은 **별도 몫으로 하루 100회**입니다. Worker 의 하루 상한 40회는 그 안이라 문제는 없지만, 설명 근거를 고쳐야 합니다.

---

## 1. 한눈에 보는 판정

- **A** = 검색 + 퍼가기 모두 가능 (바로 입점)
- **B** = 퍼가기만 가능 (사람이 골라 진열)
- **C** = 어려움

| 플랫폼 | 검색 API | 퍼가기 | 영상 정보 | 규정 주의 | 판정 |
|---|---|---|---|---|---|
| **YouTube** | ✅ 공식 · 무료 · 검색 하루 100회(별도 몫) | ✅ iframe | 전부 | 다른 출처와 섞을 때 **카드마다 YouTube 표기** · 30일 갱신 · 광고 제한 | **A** |
| **Dailymotion** | ✅ 키 없이 동작(실측) · 새 문서엔 없음 | ✅ 단 계정에서 **Player ID** 만들어야 함 | 전부 | 검색 기능 수명 불확실 | **A (위험 있음)** |
| **니코니코** | ✅ 공식 스냅샷 검색 · 키 없음 · 하루 1회 갱신 | ✅ embed(로그인해야 재생된다는 보고 있음) | 전부 | **영리 목적 금지** · 일본어 위주 | **A (비영리일 때만)** |
| **Twitch** | ❌ 키워드 검색 없음 · 게임/채널로 고르기만 | ✅ 우리 도메인을 `parent` 로 지정 · 최소 400×300 | 제목·길이·조회수·날짜·썸네일 | 클립 약 1,000건 · VOD 500건 한도 | **A−** (검색 대신 고르기) |
| **Vimeo** | ⚠️ 토큰 필요 · 공식 문서 미확인 | ✅ oEmbed 인증 없이 됨 | 제목·작성자·길이·썸네일·날짜 | 일부 영상은 도메인 제한(미확인) | **B** (토큰 실험 후 A 가능) |
| **TikTok** | ❌ 소비자 앱용 없음(연구용 API 는 학술 기관만) | ✅ oEmbed | **제목·작성자 안 옴** | 기존 퍼가기 곧 폐지 공지 | **B** |
| **Instagram / Facebook** | ❌ 해시태그 검색만(7일 30개 · 비즈니스 계정) | ✅ oEmbed (공식 조건: 앱 심사 + **사업자 인증**) | 썸네일·작성자 빠짐 | 개인 프로젝트엔 부담 | **B / C** |
| **TED** | ❌ | ✅ oEmbed | 제목·연사·썸네일(길이 없음) | **비상업 사이트만** 퍼가기 · 출처 표기 | **B** |
| **Bilibili** | ❌ 비공식만 | ✅ iframe(관례) | 비공식으로만 | 대량 수집 금지 | **B** |
| **Rumble** | ⭕ 있음 · 키는 담당자 발급 | ✅ iframe | 미확인 | 약관 미확인 | **B** (키 받으면 A) |
| **SOOP** | ❌ 공식 API 는 파트너 전용으로 보임(미확인) | 미확인 | — | 비공식 의존 | **B / C** |
| **치지직** | ❌ 라이브·채널 API 만 | 미확인 | 라이브 정보만 | — | **C** |
| **네이버 클립** | ❌ 공식 검색 API 에 동영상 없음 | 미확인 | — | — | **C** |
| **네이버TV · 카카오TV** | — | — | — | **서비스 종료** | **C** |
| **X** | 💰 유료만(게시물 1건 $0.005) | ✅ 게시물 카드 형태 | 게시물 정보 | 삭제 게시물 24시간 안에 내려야 함 | **C** |

---

## 2. 골라봄 설계에 바로 반영할 규정

### YouTube (Developer Policies · 할당량 문서, 2026-10-15 갱신)

- **할당량:** `search.list` 는 별도 몫으로 **하루 100회**(회당 1)입니다. 나머지(`videos.list` 등)는 합쳐서 하루 10,000 단위입니다. → Worker 의 상한 설명을 「1번 ≈ 102단위」에서 바꿔야 합니다.
- **30일 규칙:** 저장한 API 데이터는 30일 안에 새로 받거나 지웁니다. 지금 골라봄이 이미 지키고 있습니다(검색 하루 캐시 · gen/ 은 저장소에 올리지 않음).
- **다른 출처와 섞어 보여 줄 때:**
  - 다른 출처 결과를 「YouTube 검색 결과처럼」 보이게 하면 안 됩니다. YouTube 결과의 글자·이미지를 바꿔서도 안 됩니다(III.C.5).
  - **결과 카드마다 YouTube 출처를 따로 표시**해야 합니다. 출처를 한데 묶어 표시하면 안 됩니다(III.F.2).
  - YouTube 를 계속 불리하게 노출하면 안 됩니다(III.C.8).
  - 순위를 매기거나 거르는 것을 명시적으로 금지하는 조항은 찾지 못했습니다(미확인).
- **광고:** API 데이터가 있는 페이지에 광고를 팔면 안 됩니다. 같은 페이지에 독립된 콘텐츠가 있으면 예외입니다.

### 비영리 조건이 붙은 곳

- **니코니코 검색 API**, **TED 퍼가기**는 **비영리일 때만** 쓸 수 있습니다.
- 나중에 RESERVE 를 유료로 하거나 광고를 붙이면, 이 두 곳은 그 화면에서 빼야 합니다.

### 퍼가기 기술 조건

- **Twitch:** iframe 에 `parent=vinni-tokyo.github.io` 를 넣어야 하고, 최소 400×300 입니다.
- **Dailymotion:** 예전 퍼가기 주소는 2026-02-03 에 끝났습니다. 계정에서 Player ID 를 만들어야 합니다. 무료 계정으로 되는지는 미확인입니다.
- **TikTok:** oEmbed 응답에 제목·작성자가 없어서, 진열할 때 사람이 직접 적어야 합니다.

---

## 3. 비슷한 기존 서비스

| 서비스 | 다루는 플랫폼 | 앱 안 재생 | 상태 | 골라봄과 차이 |
|---|---|---|---|---|
| Bing 동영상 검색 | YouTube · Vimeo 등 웹 전반 | 미리보기(미확인) | 운영 중 | 범용 검색창 · 버튼식 정밀 검색·큐레이션 없음 |
| Yandex Video | YouTube · Vimeo · Dailymotion 등 | 미확인 | 운영 중 | 범용 수집 · 한국어 큐레이션 없음 |
| Petey Vid | 40~70개 플랫폼 | 원본으로 이동 | 중단 추정 | 링크 모음 |
| Jayhap | YouTube · Vimeo · Dailymotion | 미확인 | 생존 미확인 | 3곳 동시 검색만 |
| AllTube Player (크롬 확장) | YouTube · Dailymotion · Vimeo · SoundCloud | 확장 안에서 | 미확인 | 설치형 · 정밀 검색 없음 |
| BibiGPT | YouTube · Bilibili · TikTok | 미확인 | 운영 중 | AI 요약 중심 |
| blinkx | 웹 영상 전반 | — | 2013년 이후 광고 회사로 전환 | 검색 사업 철수 |
| JustWatch (비유) | OTT 수십 곳 | ❌ 해당 OTT 로 이동 | 운영 중 | 「어디서 볼 수 있나」 안내만 |

한국에서 YouTube · 네이버 · 카카오를 묶어 한 번에 찾는 제3자 서비스는 찾지 못했습니다(미확인).

---

## 4. 출처

**YouTube**
- 할당량: https://developers.google.com/youtube/v3/determine_quota_cost (2026-10-15 갱신 · 직접 확인)
- 개발자 정책: https://developers.google.com/youtube/terms/developer-policies

**해외 플랫폼**
- Vimeo oEmbed: https://vimeo.com/api/oembed.json?url=https://vimeo.com/76979871 · 구 API 폐지: https://help.vimeo.com/hc/en-us/articles/12427942328209
- Dailymotion: https://developers.dailymotion.com/docs/migrating-from-legacy-api-to-api-v2 · https://developers.dailymotion.com/reference/sunset · https://developers.dailymotion.com/docs/create-a-player
- Twitch: https://dev.twitch.tv/docs/api/reference/ · https://dev.twitch.tv/docs/embed/video-and-clips/
- TikTok: https://developers.tiktok.com/doc/display-api-overview · https://developers.tiktok.com/products/research-api · https://developers.tiktok.com/doc/embed-videos
- Meta: https://developers.facebook.com/docs/features-reference/meta-oembed-read · https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag-search
- X: https://docs.x.com/x-api/getting-started/pricing · https://docs.x.com/developer-terms/agreement-and-policy

**아시아·한국 플랫폼**
- 네이버 API 목록: https://api.ncloud-docs.com/docs/naver-api-hub-overview.md
- 네이버TV 종료: https://biz.sbs.co.kr/amp/article/20000337616 · https://m.etnews.com/20260730000281
- 카카오TV 종료: https://www.segye.com/newsView/20260305514357
- 치지직: https://chzzk.gitbook.io/chzzk
- 니코니코 검색 API: https://site.nicovideo.jp/search-api-docs/snapshot
- TED 이용 정책: https://www.ted.com/about/our-organization/our-policies-terms/ted-talks-usage-policy
- Rumble: https://player.rumble.com/developers/Rumble-Platform-API.html (직접 열람 실패 · 검색 결과로 확인)
- Bilibili: https://github.com/liuts/bilibiliapidocs (공식 문서 미러)

**비슷한 서비스**
- https://explore.microsoft.com/en-us/bing/features/video-search
- https://alternativeto.net/software/petey-vid/about
- https://bibigpt.co/features/free-video-search-youtube-bilibili-tiktok
- https://en.wikipedia.org/wiki/RhythmOne
