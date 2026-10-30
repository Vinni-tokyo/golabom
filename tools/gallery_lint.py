#!/usr/bin/env python3
"""전시관 공개 전 검사 — docs/CURATION_PRINCIPLES §7 체크리스트 중 기계로 잴 수 있는 것.

  python3 tools/gallery_lint.py            # app/data/gallery/*.json 전부
  python3 tools/gallery_lint.py craft slow  # 일부만

잰다: 작품 수 12~14 · 명판 40~70자 · 금지어 · 수치/수상 표현 · 1번 길이(4분 안팎·가장 강한 작품 아님) ·
      가장 긴 작품 9~10번 · 가장 강한 작품(후보 점수) 11번 · 같은 플랫폼 3연속 · 주장·들어가는 말·나가는 말(질문·서명) 유무.
사람이 봐야 하는 것(7번이 가장 조용한가 · 완급이 느껴지는가)은 재지 않는다.
"""
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAL = ROOT / 'app' / 'data' / 'gallery'
BAN = ['감동적', '눈물', '소름', '충격', '명작', '레전드', '최고의', '필수 시청', '꼭 보세요', '강추', '전설', '미쳤다', '압도적', '경이로운']
NUMS = re.compile(r'(조회수|수상|오스카|아카데미|후보|\d+만|\d+억|\d+%|\d+위)')

SCORE = {}
for f in (ROOT / 'data' / 'gallery_candidates').glob('*.json'):
    d = json.loads(f.read_text(encoding='utf-8'))
    for items in (d.values() if isinstance(d, dict) else [d]):
        for c in items:
            SCORE[(c['platform'], c['id'])] = c.get('score') or 0


def lint(g):
    out = []
    w = g['works']
    n = len(w)
    lo = 10 if g.get('kind') in ('era', 'person') else 12
    if not lo <= n <= 14:
        out.append(f'작품 수 {n} ({lo}~14)')
    peak = 11 if n >= 12 else n - 2
    deep = (9, 10) if n >= 12 else (n - 3, n - 2)
    if not g.get('thesis'):
        out.append('주장(thesis) 없음')
    if not g.get('intro') or len(g['intro']) > 200:
        out.append(f"들어가는 말 {len(g.get('intro') or '')}자 (≤200)")
    o = g.get('outro') or ''
    if not o:
        out.append('나가는 말 없음')
    else:
        if '?' not in o and '까' not in o:
            out.append('나가는 말에 질문이 없음')
        if '골라봄' not in o:
            out.append('나가는 말에 서명 없음')
    for s in [g.get('sub', ''), g.get('thesis', ''), g.get('intro', ''), o] + [a.get('title', '') + a.get('lead', '') for a in g.get('acts', [])]:
        for b in BAN:
            if b in s:
                out.append(f'금지어 「{b}」: {s[:30]}…')
    for i, x in enumerate(w, 1):
        note = x.get('note') or ''
        L = len(note)
        if not 40 <= L <= 70:
            out.append(f'{i:2}. 명판 {L}자: {note[:28]}…')
        for b in BAN:
            if b in note:
                out.append(f'{i:2}. 금지어 「{b}」: {note[:28]}…')
        if NUMS.search(note):
            out.append(f'{i:2}. 수치/수상 표현: {note[:28]}…')
    book = g.get('kind') == 'book'          # 책관: 막이 곧 줄기라 정점·최장 자리 규칙을 면제한다
    secs = [(x.get('sec') or 0) for x in w]
    if secs[0] > 360:
        out.append(f'1번이 {secs[0] // 60}분 (4분 안팎 권장)')
    scores = [SCORE.get((x['platform'], x['id']), 0) for x in w]
    top = max(scores)
    tops = [i + 1 for i, s in enumerate(scores) if s == top]
    if g.get('peak'):                                   # 큐레이터가 정점을 명시(유대·경외의 순간은 점수로 안 잡힌다)
        tops = [i + 1 for i, x in enumerate(w) if x['id'] == g['peak']]
        top = '큐레이터 지정'
    longest = max(range(n), key=lambda i: secs[i]) + 1
    if not book and longest not in deep and secs[longest - 1] > 0 and longest not in tops:
        out.append(f'가장 긴 작품({secs[longest - 1] // 60}분)이 {longest}번 ({deep[0]}~{deep[1]} 권장)')
    if not book and peak not in tops:
        out.append(f'가장 강한 작품(점수 {top})이 {tops}번 ({peak} 권장)')
    if scores[0] == top and len(tops) == 1:
        out.append('1번이 가장 강한 작품')
    for i in range(n - 2):
        dominant = max(sum(x['platform'] == p for x in w) for p in {x['platform'] for x in w}) >= 0.8 * n   # 한 플랫폼이 8할이면 면제
        if w[i]['platform'] == w[i + 1]['platform'] == w[i + 2]['platform'] and len({x['platform'] for x in w}) > 1 and not dominant:
            out.append(f'같은 플랫폼 3연속: {i + 1}~{i + 3}번 {w[i]["platform"]}')
            break
    if not g.get('acts'):
        out.append('막(acts) 없음')
    return out


ids = sys.argv[1:] or [Path(f).stem for f in sorted(glob.glob(str(GAL / '*.json'))) if not f.endswith('index.json')]
bad = 0
for tid in ids:
    g = json.loads((GAL / f'{tid}.json').read_text(encoding='utf-8'))
    probs = lint(g)
    total = sum((x.get('sec') or 0) for x in g['works']) // 60
    print(f"{'✅' if not probs else '❌'} {g['no']:>2} {tid:<8} {len(g['works'])}편 · {total}분 · 문제 {len(probs)}")
    for p in probs:
        print('     ', p)
    bad += bool(probs)
print(f'\n{len(ids) - bad}/{len(ids)} 통과')
