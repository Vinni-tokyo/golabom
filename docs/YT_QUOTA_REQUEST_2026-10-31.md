# YouTube API 할당량 증설 신청 — 준비와 초안 (2026-10-31)

- 작성: 2026-10-31
- 함께 볼 문서: [자막기와 이어 보기](SUBTITLES_2026-10-31.html) · [사람 공부 · 56관](CURRICULUM_56_2026-10-31.html)

---

## 0. 쉽게 읽는 요약

**예시.** 10월 31일 낮에 「아자부다이힐즈」를 찾자 「오늘 새로 찾을 수 있는 횟수를 다 썼어요」가 떴습니다.

**원인.** YouTube 검색(search.list)은 프로젝트 전체가 하루 100회입니다. 매일 아침 자동 작업이 그중 약 50회를 썼고, 조사 에이전트가 Worker를 거쳐 사용자 몫을 상당 부분 써 버렸습니다.

**한 것(오늘 적용).**

| 한 일 | 내용 | 효과 |
|---|---|---|
| 조사 에이전트 차단 | Worker가 브라우저 요청만 받음(curl·python은 403) · 조사 방법은 `tools/SCOUT_BRIEF.md`로 고정(웹 검색·채널 RSS·oEmbed) | 에이전트가 쓰는 몫 0 |
| 아침 작업 나눠 받기 | 깊이 파기 키워드는 사흘에 한 번, 토픽은 이틀에 한 번 | 하루 약 50회 → 17~24회 |
| 사용자 몫 상향 | 하루 50회 → 70회 | — |
| 같은 검색 재사용 | 결과 보관을 1일 → 7일로 늘림 | 같은 검색어는 한도를 다시 쓰지 않음 |
| 한 사람 상한 | 하루 10회(IP는 해시로만 저장) | 한 사람이 하루 몫을 다 쓰지 못함 |
| 한도가 찼을 때 | 갤러리 588편과 모아 둔 영상 안에서 대신 찾음 | 0편으로 끝나지 않음 |

**결정할 것.** 증설 신청을 낼지 정해 주세요. 신청은 개인 Google 계정으로 하셔야 하고, 그 전에 개인정보 처리방침 페이지가 하나 필요합니다.

---

## 1. 신청 전에 갖출 것

1. **개인정보 처리방침 페이지**: 골라봄이 무엇을 모으는지 적습니다. 브라우저 안 저장(관심 토픽·좋아요), 검색어(캐시 7일), IP 해시(하루 상한용, 2일 뒤 삭제), YouTube API 데이터 보관 30일 규정을 담습니다.
2. **YouTube 이용약관 연결**: 사이트 아래에 「YouTube 서비스 약관」과 「Google 개인정보처리방침」 링크를 둡니다.
3. **준수 점검**: 아래 항목은 모두 이미 지키고 있습니다.
   - 플레이어 위에 덧씌우지 않기
   - 작품마다 출처 표시
   - API 데이터 30일 보관 규정
   - API 데이터를 보여 주는 화면에 광고 없음

## 2. 신청서 초안 (영문 양식에 옮길 내용)

- **Project**: Golabom (personal, non-commercial). https://vinni-tokyo.github.io/golabom/app/
- **Use case**: A curated video gallery and a search tool that lets users compose a precise YouTube query (length, period, captions, language) instead of following recommendation feeds. Results are played only through the official embedded player.
- **APIs used**: search.list (user searches + one daily job), videos.list (durations, captions, embeddability), channels.list (subscriber counts for "hidden gem" ranking).
- **Why more quota**: Since the search.list daily limit (100 calls) took effect, a handful of users exhaust it before noon. We already cache identical queries for 7 days, rotate the daily job (≈20 calls), and cap each user at 10 new searches per day.
- **Requested**: search.list 1,000 calls/day.
- **Data handling**: No downloads, no re-uploads, no overlays. API data is stored at most 30 days (KV cache 7 days; daily job output is not committed). No ads.

## 3. 하지 않는 것

- Google 프로젝트를 여러 개 만들어 키를 나눠 쓰는 것: 약관이 금지하는 「한도 우회」입니다.
- 화면 긁어 오기나 비공식 검색 서비스.
