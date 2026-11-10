# golabom-frontend 메모

- 11-10 S3: 영상으로 찾기는 #gxjump 만 비우면 안 된다 — #gxjumpbar 는 IntersectionObserver 가 다시 켠다. 숨김은 관찰 콜백에서도 막아야 한다(DOOR === 'find').
- 11-10 S3: 「첫 영상 y ≤ 400」은 빈 칸의 margin 도 잡아먹는다(#askCards 빈 채 22px). 접기만으로 392 → 빈 칸 숨김으로 370.
- 11-10: 학습관 칸 앵커 = #/l?at=<칸 이름>(.gxgroup[data-group]). 옛 s/t-*.html 정적 쪽은 build_gallery.py 산출물이라 at 을 못 붙인다 → backend 몫.
- 11-10 S4: #/l?at= 스크롤은 글꼴이 들어오며 19px 밀려 칸 제목이 메뉴 밑에 깔렸다 → document.fonts.ready 뒤에 잰다. 「칸으로 갔다」는 scrollY 가 아니라 제목 top ≥ 52 로 확인.
- 11-10 S4: 이름 뒤 조사는 josa(w, '을/를') 로(ask.js·gallery.js 각자 한 줄). 생성기(build_gallery.py)만 고쳐 두면 backend 빌드가 app/s 를 같이 갱신한다.
- 11-10 S4 후속: 비동기로 그리는 화면은 await 뒤 `location.hash !== h0` 면 버린다(now→학습관 0.15초 경쟁). 학습관 카드 숫자는 index.json 의 main(본편) — build_gallery.py rooms 에 main 을 실어야 보인다.
