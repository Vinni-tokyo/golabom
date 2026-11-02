# golabom-learn-society 메모

일하면서 알게 된 것(막힌 채널 · 좋은 출처 · 다음에 피할 것). 최신이 아래.

- 2026-11-02 공통: Big Think 퍼 가기 전부 막힘 · KBS 가요톱10·EBS 다수 막힘 · bilibili 내림(재생 불가)
- 2026-11-02 set14 recut(money·commons·sapiens·history·ideas·language): 한국은행 「청소년 경제 아카데미」·BOJchannel·국립국어원은 퍼 가기 OK, EBS 교양(지식채널e·EBSX한국은행)은 막힘. CrashCourse 「Globalization II」는 연령 제한으로 퍼 가기 불가.
- 좋은 짧은 문턱: BBC 「200 Countries, 200 Years」(287초)·TED 데릭 시버스(172초) · 웹 검색으로는 YouTube ID 가 잘 안 잡혀 알려진 ID → oEmbed·시청 페이지(captionTracks 로 한국어 자막 확인)가 빠름.
- 역사·이념 묶음은 「다른 시각」 감이 부족하다 → 다음엔 처음부터 반대편 해설(예: 세계화 비판·공식 기록 비판)을 먼저 찾을 것. 작업 스크립트 .scout/set14/_work/learn-society/oe.py 재사용 가능.
- 2026-11-03 set16 geopolitics(build): 한국어 강의는 채널 내 검색 페이지(`/@handle/search?query=`)로 잘 잡힌다 — 사피엔스 스튜디오(@sapiens_studio 『지리의 힘』 EP29)·서울대 샤로잡다(@SeoulNationalUniversity)·고려대 고대백과(@KoreaUniv)·KBS 다큐(@KBSDocumentary 이슈픽)·스브스뉴스·ARTE 「Le Dessous des cartes」(@LeDessousdesCartesARTE, 3:33 짧은 편 많음)·이코노미스트(한국어 자막) 모두 퍼 가기 OK. 작업 스크립트 .scout/set16/geopolitics/chs.py·ply.py.
- 막힘: KBS 「부국의 조건」 로빈슨 특강(r_OKUbiit_Y)·KBS 골든아시아 말라카(r4eie4chOHU, 퍼 가기 꺼짐). 시청 페이지는 여러 번 부르면 429 — 설명란은 아껴 부를 것.
- 2026-11-03 set16 fx(build): **KBS News 「핫클립」(경제콘서트) 퍼 가기 막힘**(G7HksMi4y2Y·SHvulgFmX70) · SBS 「친절한 경제」·한국은행·KDI 경제교육·정보센터(@kdieiec, 환율 시리즈 1~3화 2~3분)·Banque de France(@banquedefrance, 3분 개념 영상)·BOJ·Economist·INET 는 OK.
- 채널 /videos 를 continuation 으로 여러 채널 훑으면 시청 페이지가 곧 429 → 설명란·길이·날짜는 youtubei player(WEB) 로 받으면 됐다(자막 목록은 안 나옴, 한국어 자막은 미확인으로 남김). 스크립트 .scout/set16/fx/yi.py·more.py(token 없는 continuation 버그 고침).
- 2026-11-03 set16 nowiran(build): **YTN·KBS News·연합뉴스TV 뉴스초점은 퍼 가기 막힘(일본 기준)** — 한국어 시사는 MBCNEWS·JTBC News·SBS 뉴스·CBS노컷뉴스·한국은행이 재생 OK. 채널 ID 검색(`channel/UC…/search?query=`, MBC UCF4Wxdo3inmxP-Y59wXDsFw · JTBC UCsU-I-vHLiaMfV_ceaYz5rQ · SBS UCkinYTS9IHqOEwR1Sze2JTw · KBS UCcQTRi69dsVYHN3exePtZ1A)이 잘 잡힌다(@kbsnews 핸들은 엉뚱한 채널).
- 시청 페이지 429 때는 `youtubei/v1/player` POST(WEB client)로 길이·게시일·설명란을 받을 수 있다(.scout/set16/nowiran/ip.py·desc.py). emb_check 결과가 빈 칸이면 재생 중(스크린샷으로 확인함)이다. Economist·Wendover 는 한국어 자동 더빙 트랙이 있다.
- 같은 SET 의 형제 묶음(fx 등)과 이미 걸린 영상을 먼저 대조할 것: 한국은행 「국제유가 완벽 가이드」·Economist 「인플레이션 급등」은 fx 가 먼저 씀.
