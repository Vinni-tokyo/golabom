# golabom-learn-science 메모

일하면서 알게 된 것(막힌 채널 · 좋은 출처 · 다음에 피할 것). 최신이 아래.

- 2026-11-02 공통: Big Think 퍼 가기 전부 막힘 · KBS 가요톱10·EBS 다수 막힘 · bilibili 내림(재생 불가)
- 2026-11-02 set14 recut: EBS클래스e(이명현 코스모스)도 퍼 가기 막힘 · 한국어 과학 출처로 「사이언스프렌즈」(과학창의재단, 국립기상과학원 감수) 재생 OK · 에크먼 반대 시각은 Paul Ekman Group 공식 채널(짧음)·KQED QUEST 가 쓸 만함
- TED 길이는 ted.com 페이지의 "duration":"PT..M..S" 로 얻는다 · 옛 묶음은 carlsagandotcom·TED 처럼 한 채널 쏠림이 많아 본편 2편 이하로 자르고 나머지는 더 보기로 뺀다
- 2026-11-03 set16 stats: 웹 검색은 `allowed_domains:["youtube.com"]` 를 줘야 YouTube 주소가 나온다 · 시청 페이지가 429 로 막히면 퍼 가기 플레이어의 `/youtubei/v1/player` 응답을 가로채 길이·설명·자막을 얻는다(`.scout/set16/stats/meta.cjs`)
- 한국어 통계 출처 재생 OK: 한국은행(BOK클래스) · KPF한국언론진흥재단 · KDI 경제교육·정보센터 · Sprouts 한국 · 아시아경제 · 고려대 DS플러스 / 막힘: KBS News 일부 · EBS Learning · EBS 클립뱅크 · EBS BOOK STORY
- 통계청(국가데이터처) 채널은 홍보물 위주라 강좌감이 없고, 한국통계진흥원 「통통배」는 퍼 가기 꺼짐 · 박경미TV 는 정치인 채널이라 뺐다
- 2026-11-03 set16 energy: 막힘 — KBS News(2026 리포트)·MBC 뉴스·YTN·YTN 사이언스 투데이·연합뉴스TV 일부·한수원·「당신이 몰랐던 원자력 이야기」(산업통상부·EBS 지식 업로드 대부분, 단 g6pdJW0oTL8 은 재생) / 재생 OK — SBS 뉴스·스브스뉴스·JTBC News·MBN·KDI·국가과학기술연구회(nst)·한국에너지기술연구원·NBS투데이플러스·東京電力·Terra X Lesch & Co·Practical Engineering
- emb_check 가 빈 글자를 내면 막힘이 아닐 수 있다 → 플레이어 안 video.duration·.ytp-error 를 읽는 `.scout/set16/energy/dur.cjs` 나 스크린샷으로 다시 본다 · 자막 몇 군데 엿보기는 `peek.cjs`(cc_load_policy=1)로 명판 근거를 얻는다
- 에너지 균형 짜기: 원자력 쪽 Kurzgesagt(한국어 자막)·SBS 「사실은」 비용 검증, 반대 쪽 Mycle Schneider(Right Livelihood 공식) · KAIST 정용훈 교수 강의는 EBS 계열이라 대부분 막힘
