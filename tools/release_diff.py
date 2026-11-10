#!/usr/bin/env python3
"""배포 전 차이표(DEV_RULES §5 7·8·10): git ref 의 빌드 결과(app/data/gallery) ↔ 지금 작업 트리.

  python3 tools/release_diff.py origin/main        # 직전 배포 대비
  python3 tools/release_diff.py 042d678^           # 특정 커밋 대비

보는 것: 관 수 · 사라진/새 관 · 묶음별 본편 수(main) · 「정비 중」 목록 · 본편 60분 초과(영화 제외).
사라진 관이 있거나 본편이 3편 이상 준 묶음이 있으면 「멈춤」을 찍고 종료 코드 1.
"""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GDIR = 'app/data/gallery'
DROP = 3


def git(*a):
    return subprocess.run(['git', '-C', str(ROOT), *a], capture_output=True, text=True, check=True).stdout


def load_ref(ref):
    names = git('ls-tree', '--name-only', ref, f'{GDIR}/').split()
    return {Path(p).stem: json.loads(git('show', f'{ref}:{p}')) for p in names if p.endswith('.json')}


def load_tree():
    return {p.stem: json.loads(p.read_text(encoding='utf-8')) for p in (ROOT / GDIR).glob('*.json')}


def summary(files):
    idx = files.pop('index', {'galleries': []})['galleries']
    halls = {r['id']: r for r in idx}
    out = {}
    for gid, r in halls.items():
        g = files.get(gid, {})
        works = g.get('works', [])
        main = min(g.get('main') or 0, len(works))
        out[gid] = {'title': r['title'], 'works': len(works), 'main': main, 'status': r.get('status', ''), 'kind': g.get('kind'),
                    'main_min': round(sum(w.get('sec') or 0 for w in works[:main]) / 60)}
    return out


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    ref = sys.argv[1]
    a, b = summary(load_ref(ref)), summary(load_tree())
    gone, new = sorted(set(a) - set(b)), sorted(set(b) - set(a))
    stop = []
    print(f'# 차이표: {ref} ({git("rev-parse", "--short", ref).strip()}) → 작업 트리')
    print(f'\n관 수: {len(a)} → {len(b)}' + (f'  (사라짐 {", ".join(gone)})' if gone else '') + (f'  (새로 {", ".join(new)})' if new else ''))
    if gone:
        stop.append(f'사라진 관 {len(gone)}')
    print('\n## 본편 수가 바뀐 묶음 (본편 · 전체 · 본편 분)')
    rows = []
    for gid in sorted(set(a) & set(b), key=lambda k: (b[k]['main'] - a[k]['main'], k)):
        x, y = a[gid], b[gid]
        if (x['main'], x['works']) != (y['main'], y['works']):
            d = y['main'] - x['main']
            flag = '  ← 멈춤' if d <= -DROP else ''
            if d <= -DROP:
                stop.append(f'{gid} 본편 {d}')
            rows.append(f"- {gid:<10} 본편 {x['main']:>2} → {y['main']:>2} ({d:+d}) · 전체 {x['works']:>2} → {y['works']:>2} · {x['main_min']} → {y['main_min']}분{flag}")
    print('\n'.join(rows) or '- 없음')
    for name, s in (('직전', a), ('지금', b)):
        fix = sorted(k for k, v in s.items() if v['status'] == '정비 중')
        print(f"\n「정비 중」 {name} {len(fix)}개: {', '.join(fix)}")
    over = sorted((k for k, v in b.items() if v['main_min'] > 60 and v['kind'] != 'film'), key=lambda k: -b[k]['main_min'])
    print(f"\n본편 60분 초과(영화 제외) 지금 {len(over)}개: " + ', '.join(f"{k} {b[k]['main_min']}분" for k in over))
    print('\n' + (f"멈춤: {' · '.join(stop)}" if stop else '통과: 사라진 관 없음 · 본편 3편 이상 준 묶음 없음'))
    sys.exit(1 if stop else 0)


if __name__ == '__main__':
    main()
