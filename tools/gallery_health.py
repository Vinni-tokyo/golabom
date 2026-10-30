#!/usr/bin/env python3
"""전시 작품 생존 검사 — 걸린 작품이 아직 공식 퍼가기로 열리는지 oEmbed 로 확인한다.

  python3 tools/gallery_health.py              # 전 관
  python3 tools/gallery_health.py craft slow   # 일부만

결과: data/health.json ({플랫폼:id → {ok, code, checked}}) + 화면에 죽은 작품 목록.
YouTube oEmbed 는 삭제·비공개·퍼가기 끔이면 401/403/404 를 준다. bilibili·niconico 는 공개 oEmbed 가 없어 건너뛴다.
"""
import concurrent.futures as cf
import datetime as dt
import glob
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAL = ROOT / 'app' / 'data' / 'gallery'
OUT = ROOT / 'data' / 'health.json'
UA = {'User-Agent': 'golabom-curation/0.1'}


def oembed(w):
    p, i = w['platform'], w['id']
    if p == 'youtube':
        return 'https://www.youtube.com/oembed?format=json&url=' + urllib.parse.quote(f'https://www.youtube.com/watch?v={i}')
    if p == 'vimeo':
        return 'https://vimeo.com/api/oembed.json?url=' + urllib.parse.quote(f'https://vimeo.com/{i}')
    if p == 'ted':
        return 'https://www.ted.com/services/v1/oembed.json?url=' + urllib.parse.quote(f'https://www.ted.com/talks/{i}')
    return None


def check(w):
    url = oembed(w)
    if not url:
        return None
    try:
        urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=15).read()
        return 200
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0                                                   # 연결 실패: 죽음으로 보지 않는다


ids = sys.argv[1:] or [Path(f).stem for f in sorted(glob.glob(str(GAL / '*.json'))) if not f.endswith('index.json')]
works = {}
for tid in ids:
    for w in json.loads((GAL / f'{tid}.json').read_text(encoding='utf-8'))['works']:
        works.setdefault((w['platform'], w['id']), (w, []))[1].append(tid)
prev = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
today = dt.date.today().isoformat()
with cf.ThreadPoolExecutor(8) as ex:
    codes = dict(zip(works, ex.map(lambda k: check(works[k][0]), works)))
dead = []
for (p, i), code in codes.items():
    if code is None:
        continue
    ok = code in (200, 0)
    prev[f'{p}:{i}'] = {'ok': ok, 'code': code, 'checked': today}
    if not ok:
        dead.append((p, i, code, works[(p, i)][1], works[(p, i)][0].get('ko') or works[(p, i)][0].get('title')))
OUT.write_text(json.dumps(prev, ensure_ascii=False, indent=1, sort_keys=True) + '\n', encoding='utf-8')
skipped = sum(c is None for c in codes.values())
print(f'{len(codes)}점 검사 · 살아 있음 {len(codes) - len(dead) - skipped} · 열리지 않음 {len(dead)} · oEmbed 없어 건너뜀 {skipped}')
for p, i, code, halls, title in sorted(dead, key=lambda d: d[3]):
    print(f'  ✗ {code} {p}:{i}  [{", ".join(halls)}]  {title}')
