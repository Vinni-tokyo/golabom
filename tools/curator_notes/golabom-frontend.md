# golabom-frontend 메모

- 11-10 S3: 영상으로 찾기는 #gxjump 만 비우면 안 된다 — #gxjumpbar 는 IntersectionObserver 가 다시 켠다. 숨김은 관찰 콜백에서도 막아야 한다(DOOR === 'find').
- 11-10 S3: 「첫 영상 y ≤ 400」은 빈 칸의 margin 도 잡아먹는다(#askCards 빈 채 22px). 접기만으로 392 → 빈 칸 숨김으로 370.
- 11-10: 학습관 칸 앵커 = #/l?at=<칸 이름>(.gxgroup[data-group]). 옛 s/t-*.html 정적 쪽은 build_gallery.py 산출물이라 at 을 못 붙인다 → backend 몫.
