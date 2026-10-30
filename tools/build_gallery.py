#!/usr/bin/env python3
"""명작 갤러리 데이터 만들기: 후보(JSON) → app/data/gallery/<id>.json + index.json

  python3 tools/build_gallery.py 후보1.json 후보2.json ...

후보 파일은 {테마id: [작품, ...]} 또는 [작품, ...](이때는 --theme 로 테마 지정).
1차 고르기(사람이 최종 확인한다):
  - 점수(score) 높은 순 · 6점 미만은 걸지 않는다
  - 한 채널은 2편까지
  - 플랫폼을 최대한 섞는다: 7점 이상인 플랫폼은 먼저 하나씩 자리를 준다
  - 전시관당 12~16편
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app' / 'data' / 'gallery'
THEMES = json.loads((ROOT / 'tools' / 'gallery_themes.json').read_text(encoding='utf-8'))
TITLES = json.loads((ROOT / 'tools' / 'gallery_titles.json').read_text(encoding='utf-8'))   # 큐레이터가 붙인 한국어 작품명
MAX, MIN_SCORE, PER_CHANNEL = 16, 6, 2
KEEP = ('platform', 'id', 'ko', 'title', 'channel', 'sec', 'thumb', 'note', 'license')


def pick(cands):
    cands = sorted((c for c in cands if (c.get('score') or 0) >= MIN_SCORE), key=lambda c: -(c.get('score') or 0))
    out, per_ch, seen = [], {}, set()

    def take(c):
        key = (c['platform'], c['id'])
        ch = (c.get('channel') or '').lower()
        if key in seen or per_ch.get(ch, 0) >= PER_CHANNEL or len(out) >= MAX:
            return
        seen.add(key); per_ch[ch] = per_ch.get(ch, 0) + 1; out.append(c)

    for p in dict.fromkeys(c['platform'] for c in cands):          # 플랫폼마다 가장 좋은 한 편(7점 이상)
        best = next((c for c in cands if c['platform'] == p and c['score'] >= 7), None)
        if best:
            take(best)
    for c in cands:
        take(c)
    # 첫 작품은 가장 높은 점수, 나머지는 같은 플랫폼이 연달아 오지 않게 섞는다
    out.sort(key=lambda c: -c['score'])
    head, rest = out[:1], out[1:]
    while rest:
        last = head[-1]['platform']
        nxt = next((c for c in rest if c['platform'] != last), rest[0])
        rest.remove(nxt); head.append(nxt)
    return head


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('--theme')
    a = ap.parse_args()
    by_theme = {}
    for f in a.files:
        d = json.loads(Path(f).read_text(encoding='utf-8'))
        if isinstance(d, list):
            d = {a.theme: d}
        for k, v in d.items():
            by_theme.setdefault(k, []).extend(v)
    OUT.mkdir(parents=True, exist_ok=True)
    for tid, cands in by_theme.items():
        t = THEMES[tid]
        skip = set(TITLES.get('_exclude', {}).get(tid, []))          # 다른 관과 겹치는 작품 등
        works = [{k: c.get(k) for k in KEEP} | {'ko': TITLES.get(tid, {}).get(c['id'])} for c in pick([c for c in cands if c['id'] not in skip])]
        (OUT / f'{tid}.json').write_text(json.dumps({'id': tid, **t, 'works': works}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f"{t['no']:>2} {tid:<8} {len(cands):>3}편 후보 → {len(works):>2}편 걸기 · " +
              ', '.join(f"{p} {sum(w['platform'] == p for w in works)}" for p in dict.fromkeys(w['platform'] for w in works)))
    # 층별 안내: 지금 있는 전시관 전부(번호순)
    rooms = []
    for f in sorted(OUT.glob('*.json')):
        if f.name == 'index.json':
            continue
        g = json.loads(f.read_text(encoding='utf-8'))
        if not g.get('works'):
            continue
        w0 = g['works'][0]
        cover = w0.get('thumb') or (f"https://i.ytimg.com/vi/{w0['id']}/hqdefault.jpg" if w0['platform'] == 'youtube' else '')
        rooms.append({'id': g['id'], 'no': g['no'], 'title': g['title'], 'sub': g['sub'], 'cover': cover,
                      'count': len(g['works']), 'platforms': list(dict.fromkeys(w['platform'] for w in g['works']))})
    rooms.sort(key=lambda r: r['no'])
    (OUT / 'index.json').write_text(json.dumps({'galleries': rooms}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'index.json: {len(rooms)}관')


if __name__ == '__main__':
    main()
