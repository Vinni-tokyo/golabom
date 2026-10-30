#!/usr/bin/env python3
"""YouTube 작품의 자막 유무를 공식 API 로 확인해 data/captions.json 에 적는다(50편당 1단위 · 운영자 토큰 필요).
  python3 tools/annotate_captions.py --token <REFRESH_TOKEN 파일>
caption=true 는 「올린 사람이 넣은 자막」이 있다는 뜻(언어는 API 가 알려 주지 않는다). false 여도 자동 자막·자동 번역은 플레이어에서 대개 켤 수 있다.
"""
import argparse, glob, json, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'captions.json'
API = 'https://golabom-search.golabom.workers.dev/videos'
a = argparse.ArgumentParser(); a.add_argument('--token', required=True); a = a.parse_args()
tok = Path(a.token).read_text().strip()
ids = sorted({w['id'] for f in glob.glob(str(ROOT / 'app/data/gallery/*.json')) if not f.endswith('index.json') for w in json.load(open(f))['works'] if w['platform'] == 'youtube'})
cc = json.loads(OUT.read_text()) if OUT.exists() else {}
todo = [i for i in ids if i not in cc]
for k in range(0, len(todo), 50):
    req = urllib.request.Request(f"{API}?ids={','.join(todo[k:k+50])}", headers={'Authorization': f'Bearer {tok}', 'User-Agent': 'golabom-curation/0.1'})
    for v in json.loads(urllib.request.urlopen(req).read()):
        cc[v['id']] = {'caption': v['caption'], 'lang': v['lang'], 'sec': v['sec']}
OUT.write_text(json.dumps(cc, ensure_ascii=False, indent=0) + '\n')
print(f'{len(ids)}편 중 자막 있음 {sum(cc[i]["caption"] for i in ids if i in cc)} · 새로 확인 {len(todo)}')
