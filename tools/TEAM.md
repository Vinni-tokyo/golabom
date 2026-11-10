# 골라보셈 에이전트 팀 명단 (2026-11-10)

정의 파일은 모두 전역 `~/.claude/agents/<이름>.md`. 공통 규칙은 콘텐츠 = `tools/CURATOR_RULES.md`, 개발 = `tools/DEV_RULES.md`. 개인 메모 = `tools/curator_notes/<이름>.md`.
리드 = 메인 세션(일 나누기 · 합치기 · 커밋 · 푸시). 모든 에이전트는 커밋·푸시·배포를 하지 않는다.

## 개발 팀 (11-10 신설 · 3)
| 이름 | 맡는 것 | 쓰기 |
|---|---|---|
| golabom-frontend | app/*.js · css · html, 캐시 버전, 390px 스크린샷 | O |
| golabom-backend | build_gallery · catalog · lint · facets · work_*.json · worker/ · workflows | O |
| golabom-ux-reviewer | 폰으로 사용자처럼 써 보고 지적 · 옛 링크 회귀 | 읽기 전용 |

정책 감사(오버레이·출처·30일·금지어·비밀값)는 에이전트를 두지 않고 `DEV_RULES.md §5` 체크리스트와 린트로 한다(PM 권고 11-10: 셀 수 있는 규칙은 코드가 거르는 쪽이 확실).

## 콘텐츠 팀 (10)
| 이름 | 맡는 것 |
|---|---|
| golabom-editor | 편집장 · 다음 묶음 주제 고르기(mode topics) |
| golabom-learn-science | 학습관 과학 |
| golabom-learn-society | 학습관 사회·역사 · 지금 읽기 시사 |
| golabom-tech-philo | 기술·철학 |
| golabom-skills-coach | 학습관 실용 기술 |
| golabom-music | 음악관 |
| golabom-visual-art | 영상 예술 |
| golabom-people | 사람 이야기관 |
| golabom-sports-life | 스포츠관 · 이럴 때 |
| golabom-film | 영화(규칙 예외 §3-1) |

## 협업 흐름 (기본)
1. 사용자 요청 → 리드가 나눔(화면 = frontend · 데이터/서버 = backend · 내용 = 큐레이터)
2. 두 쪽이 다 필요하면 backend 먼저(데이터 모양 확정) → frontend
3. 화면이 바뀌면 ux-reviewer 검수 → 리드가 §5 체크리스트 → 커밋·푸시
4. 각 에이전트는 끝날 때 자기 메모에 한두 줄
