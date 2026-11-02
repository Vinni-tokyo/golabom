"""TED 작품 길이 채우기: 걸린 TED 작품 중 길이(sec)가 빈 것을 ted.com 강연 페이지의 "duration" 으로 채워 data/ted_sec.json 에 둔다(빌드가 읽음)."""
import json, re, glob, time, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
out = ROOT / 'data' / 'ted_sec.json'
have = json.loads(out.read_text(encoding='utf-8')) if out.exists() else {}
need = sorted({w['id'] for f in glob.glob(str(ROOT / 'app/data/gallery/*.json')) if not f.endswith('index.json')
               for w in json.load(open(f))['works'] if w['platform'] == 'ted' and not w.get('sec') and w['id'] not in have})
for i in need:
    try:
        html = urllib.request.urlopen(urllib.request.Request(f'https://www.ted.com/talks/{i}', headers={'User-Agent': 'Mozilla/5.0'}), timeout=20).read().decode('utf-8', 'ignore')
        m = re.search(r'"duration":(\d+)', html)
        if m: have[i] = int(m.group(1))
        print(i, have.get(i))
    except Exception as e:
        print(i, 'ERR', e)
    time.sleep(1)
out.write_text(json.dumps(dict(sorted(have.items())), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(len(have), '편 →', out.name)
