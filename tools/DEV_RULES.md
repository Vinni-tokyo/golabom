# 골라보셈 개발 팀 공통 규칙 (정본 · 2026-11-10)

개발 에이전트(golabom-frontend · golabom-backend · golabom-ux-reviewer)는 일을 시작하기 전에 이 파일과 자기 메모 `tools/curator_notes/<에이전트>.md` 를 읽는다. 콘텐츠(묶음·명판·영상 고르기) 규칙은 `tools/CURATOR_RULES.md` 가 정본이다. 팀 명단은 `tools/TEAM.md`.

## 1. 역할과 권한
- **리드 = 메인 세션.** 일을 나누고, 결과를 합치고, 커밋·`git push origin main`(= Pages 배포)을 한다.
- 개발 에이전트는 **커밋·푸시·`wrangler deploy`·`wrangler secret`·`gh` CLI 를 쓰지 않는다.** 작업 트리에 고치고, 증거를 붙여 리드에게 돌려준다.
- `wrangler deploy` 는 사용자가 그 자리에서 명시적으로 말할 때만 리드가 한다.
- 비밀값(YT_API_KEY · REFRESH_TOKEN)은 GitHub·Cloudflare secret 에만 있다. 파일·로그·채팅·git URL 에 적지 않는다.

## 2. 지켜야 할 서비스 규칙 (어기면 배포 불가)
- 영상을 내려받거나 다시 올리지 않는다. 재생은 각 플랫폼의 공식 플레이어(iframe)로만.
- 플레이어 위에 아무것도 덮지 않는다(오버레이 금지).
- 모든 카드에 출처(채널·플랫폼)를 보인다.
- YouTube API 로 받은 데이터는 30일 넘게 두지 않는다(일일 빌드가 새로 받는다).
- 광고 없음. 사용자 추적은 GoatCounter 수준까지만, 개인정보 수집 없음.
- 명판 금지어(CURATOR_RULES §금지어)를 화면 문구에도 쓰지 않는다.

## 3. 화면 원칙 (사용자 피드백 누적)
- **폰(390px) 먼저.** 사용자는 폰 스크린샷으로 검수한다.
- **설명글을 늘리지 않는다.** 사람은 직관으로 안다. 안내문·부제·「~하면 ~됩니다」 문장은 빼는 쪽이 기본(11-03).
- **공간을 아낀다.** 한 번에 하나만 펼치고 나머지는 토글로 접는다. 가로로 넘치는 줄은 두 줄 알약으로 감싼다.
- 어두운 카드를 밝은 화면에 그대로 쓰지 않는다(읽히지 않음).
- 기존 기능·옵션을 임의로 빼지 않는다. 요청받은 것만.
- 옛 공유 링크(`#/g?door=…` · `s/t-*.html` · `s/f-*.html` · `s/w-*.html`)는 빈 화면 없이 새 자리로 보낸다.

## 4. 작업 절차와 제출물
- **frontend**: 고친 뒤 `app/*` 의 `?v=` 캐시 버전을 한 단계 올린다(모든 파일에서 같은 값). 로컬 서버 `python3 -m http.server 8765`(저장소 루트) → `http://127.0.0.1:8765/app/` 에서 Playwright 390×800 스크린샷 + `pageerror` 0 확인. 스크립트·스크린샷은 스크래치패드에 둔다.
  - Playwright: `NODE_PATH=/home/kim-h/work/BadgeLens_Frost/workspace/node_modules node <script>.cjs`
- **backend**: `python3 tools/build_gallery.py --theme craft data/gallery_candidates/*.json` → `python3 tools/gallery_lint.py` 출력 마지막 줄을 붙인다(「N/107 통과」는 오래된 형식 검사 포함 — 「자리 N개」 오류가 0인지가 핵심). Worker 는 `worker/` 에서 `npx wrangler dev` 로만 시험한다.
- **ux-reviewer**: 읽기 전용. 고치지 않고 「화면 → 문제 → 근거(스크린샷 경로) → 고칠 방향」 표를 돌려준다.
- 모두: 바꾼 파일 목록 · 확인 방법 · 확인 못 한 것을 보고 끝에 적는다. 결과는 한국어, 짧은 bullet.

## 5. 배포 전 체크리스트 (리드가 푸시 전에)
1. `?v=` 캐시 버전이 모든 `app/*` 에서 같은가
2. 390px 스크린샷에서 가로 넘침·잘림이 없는가, `pageerror` 0
3. 빌드·린트에 「자리」 오류 0, 막힌 영상(`data/embed_blocked.json`)이 묶음에 다시 들어가지 않았는가
4. 새 화면 문구에 금지어·설명 과잉이 없는가
5. 비밀값·토큰이 diff 에 없는가 (`git diff | grep -iE 'key|token|secret'`)
6. 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## 6. 주요 파일
- 화면: `app/app.js`(메뉴·지금·찾기·깊이 파기) · `app/gallery.js`(명품관·학습관·묶음 화면) · `app/ask.js`(물어보기) · `app/styles.css` · `app/config.js`
- 데이터: `tools/gallery_catalog.json`(관·칸 배치 정본, indent=1 유지) · `tools/gallery_themes.json` · `tools/work_*.json`(형식·연대·재료·들리는 말) · `data/embed_blocked.json`
- 빌드: `tools/build_gallery.py` → `app/data/gallery/*.json` · `index.json` · `facets.json` · `app/s/*.html`
- 서버: `worker/src/index.js`(검색·물어보기·트렌드 cron) · `worker/wrangler.toml`
- 자동화: `.github/workflows/daily.yml`(매일 배포) · `weekly-embed.yml`(월요일 재생 점검)
