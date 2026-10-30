#!/usr/bin/env python3
"""옴니버스 구간 정하기 재료 모으기 — 규정 안의 공개 정보만 쓴다.

  REFRESH_TOKEN 파일을 가리키고: python3 tools/omnibus_scout.py --token ~/.golabom_refresh_token ybb-HhSrtxA lhb7vLQTYwY ...

영상마다 만드는 것(스크래치패드 out/ 아래):
  <id>.json   설명란 · 태그 · 챕터(설명란의 「3:12 제목」 줄) · 길이 · 자막 유무(공식 API, 1단위)
  <id>_strip.png   YouTube 가 공개하는 25%·50%·75% 지점 장면(1.jpg 2.jpg 3.jpg)을 한 줄로 이어 붙인 그림
큐레이터(사람 또는 모델)는 챕터 → 장면 그림 → 설명란 순으로 보고 60~90초 구간을 고른다.
쓰지 않는 것: 자막 내려받기(공식 API 는 영상 주인만 가능), 영상·소리 내려받기, 비공식 엔드포인트.
"""
import argparse
import json
import urllib.request
from pathlib import Path

API = 'https://golabom-search.golabom.workers.dev/videos'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--token', required=True, help='REFRESH_TOKEN 이 든 파일')
    ap.add_argument('--out', default='out')
    ap.add_argument('ids', nargs='+')
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    tok = Path(a.token).read_text().strip()
    req = urllib.request.Request(f"{API}?ids={','.join(a.ids)}", headers={'Authorization': f'Bearer {tok}'})
    info = json.loads(urllib.request.urlopen(req).read())
    try:
        from PIL import Image
    except ImportError:
        Image = None
    for v in info:
        (out / f"{v['id']}.json").write_text(json.dumps(v, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f"{v['id']}  {v['sec']}s  자막 {'있음' if v['caption'] else '없음'}  챕터 {len(v['chapters'])}개")
        for c in v['chapters'][:20]:
            print(f"    {c['at'] // 60}:{c['at'] % 60:02d}  {c['title'][:60]}")
        frames = []
        for n in (1, 2, 3):
            p = out / f"{v['id']}_{n}.jpg"
            try:
                urllib.request.urlretrieve(f"https://i.ytimg.com/vi/{v['id']}/{n}.jpg", p); frames.append(p)
            except Exception as e:
                print('   frame', n, e)
        if Image and len(frames) == 3:
            ims = [Image.open(p) for p in frames]
            strip = Image.new('RGB', (sum(i.width for i in ims), max(i.height for i in ims)))
            x = 0
            for i in ims:
                strip.paste(i, (x, 0)); x += i.width
            strip = strip.resize((strip.width * 3, strip.height * 3))
            strip.save(out / f"{v['id']}_strip.png")
            print(f"    장면: {out / (v['id'] + '_strip.png')}  (25% = {v['sec'] // 4}s · 50% = {v['sec'] // 2}s · 75% = {v['sec'] * 3 // 4}s)")


if __name__ == '__main__':
    main()
