"""emb_check 결과(「id | 플레이어 글자」 줄) → data/embed_blocked.json {id: {checked, msg, country}}. 오류 문구가 없는 영상은 목록에서 뺀다.

  python3 tools/embed_sweep_apply.py all.txt --country KR            # 로컬 PC 점검(정본) 반영 · 출구 나라를 기록에 남긴다
  python3 tools/embed_sweep_apply.py all.txt --country US --report r.md   # 보고만(파일을 고치지 않음 · GitHub Action)
  새 막힘이 LIMIT 편을 넘으면 쓰지 않고 멈춘다(--force 로만 넘김 · 11-10 미국 점검기 거짓 막힘 52편 사고).
"""
import argparse, json, re, sys, datetime
from pathlib import Path
# 11-10: 한국어 「이 동영상은 볼 수 없습니다」 · 「오류가 발생했습니다」 · 영어 「An error occurred」 를 놓쳐 7편이 「풀림」 처리됐다
BAD = re.compile(r'再生できません|視聴できません|unavailable|エラー|無効|利用できません|Video unavailable|재생할 수 없|볼 수 없습니다|오류가 발생했습니다|An error occurred')
LIMIT = 15
ROOT = Path(__file__).resolve().parent.parent
out = ROOT / 'data' / 'embed_blocked.json'
ap = argparse.ArgumentParser()
ap.add_argument('result')
ap.add_argument('--country', choices=['KR', 'JP', 'US'], required=True, help='점검한 PC 의 출구 나라')
ap.add_argument('--report', help='이 파일에 새 막힘·풀림 후보만 적고 embed_blocked.json 은 그대로 둔다')
ap.add_argument('--force', action='store_true', help=f'새 막힘 {LIMIT}편 초과여도 반영')
a = ap.parse_args()
old = json.loads(out.read_text(encoding='utf-8')) if out.exists() else {}
pf = ROOT / 'data' / 'embed_partial.json'                         # 한 나라에서만 막힌 것으로 확인된 영상(11-10 ① 「둘 다」): 그 나라 판정으로는 빼지 않는다
partial = json.loads(pf.read_text(encoding='utf-8')) if pf.exists() else {}
today = datetime.date.today().isoformat()
seen, new = set(), {}
for line in Path(a.result).read_text(encoding='utf-8').splitlines():
    if ' | ' not in line:
        continue
    vid, msg = line.split(' | ', 1)
    vid = vid.strip(); seen.add(vid)
    if a.country in partial.get(vid, {}).get('blocked', []):
        continue
    if BAD.search(msg) and 'frame err' not in msg:
        new[vid] = {'checked': today, 'msg': msg.strip()[:80], 'country': a.country}
kept = {k: v for k, v in old.items() if k not in seen}        # 이번에 못 본 것은 이전 판정 유지
res = dict(sorted({**kept, **new}.items()))
added = [k for k in new if k not in old]
freed = [k for k in old if k in seen and k not in new]
head = f'점검 {len(seen)}편 ({a.country}) · 막힘 {len(new)}편(새 판정) · 새 막힘 {len(added)} · 풀림 {len(freed)} · 목록 {len(old)} → {len(res)}편'
if a.report:
    where = {}
    gdir = ROOT / 'app' / 'data' / 'gallery'
    for f in sorted(gdir.glob('*.json')) if gdir.exists() else []:
        if f.name == 'index.json': continue
        g = json.loads(f.read_text(encoding='utf-8'))
        for i, w in enumerate(g.get('works', [])):
            where.setdefault(w['id'], []).append(f"{g['id']}#{i + 1}" + ('' if i < (g.get('main') or 0) else '(더 보기)'))
    lines = [f'# 재생 점검 보고 {today} · 출구 {a.country} · 보고만(반영은 로컬 확인 뒤 · DEV_RULES §5-1)', '', head, '',
             f'## 새 막힘 후보 {len(added)}편' + (f' — {LIMIT}편 초과: 대량 거짓 판정 의심' if len(added) > LIMIT else ''), '']
    lines += [f"- {k} | {', '.join(where.get(k, [])) or '묶음 밖'} | {new[k]['msg']}" for k in added]
    lines += ['', f'## 풀림 후보 {len(freed)}편', '']
    lines += [f"- {k} | 지난 판정 {old[k].get('checked', '')} {old[k].get('country', '')} | {old[k].get('msg', '')}" for k in freed]
    Path(a.report).write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(head + f' · 보고만 → {a.report}')
    sys.exit(0)
if len(added) > LIMIT and not a.force:
    print(head + f'\n멈춤: 새 막힘 {len(added)}편 > {LIMIT}편 — 쓰지 않았다. 표본을 다른 출구에서 다시 확인하고, 맞으면 --force')
    sys.exit(2)
out.write_text(json.dumps(res, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(head + f' → {out.name}')
