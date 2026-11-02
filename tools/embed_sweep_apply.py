"""emb_check 결과(「id | 플레이어 글자」 줄) → data/embed_blocked.json {id: {checked, msg}}. 오류 문구가 없는 영상은 목록에서 뺀다."""
import json, re, sys, datetime
from pathlib import Path
BAD = re.compile(r'再生できません|unavailable|エラー|無効|利用できません|Video unavailable|재생할 수 없')
out = Path(__file__).resolve().parent.parent / 'data' / 'embed_blocked.json'
old = json.loads(out.read_text(encoding='utf-8')) if out.exists() else {}
today = datetime.date.today().isoformat()
seen, new = set(), {}
for line in Path(sys.argv[1]).read_text(encoding='utf-8').splitlines():
    if ' | ' not in line:
        continue
    vid, msg = line.split(' | ', 1)
    vid = vid.strip(); seen.add(vid)
    if BAD.search(msg) and 'frame err' not in msg:
        new[vid] = {'checked': today, 'msg': msg.strip()[:80]}
kept = {k: v for k, v in old.items() if k not in seen}        # 이번에 못 본 것은 이전 판정 유지
res = dict(sorted({**kept, **new}.items()))
out.write_text(json.dumps(res, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'점검 {len(seen)}편 · 막힘 {len(new)}편(새 판정) · 목록 {len(res)}편 → {out.name}')
