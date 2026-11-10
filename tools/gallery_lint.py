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

JARGON = ['정점', '끝맛', '가장 조용한 자리', '다른 시각', '숨을 고르']   # 편성 용어는 자리로만 보여 준다(명판에 쓰지 않는다)
CAT = json.loads((ROOT / 'tools' / 'gallery_catalog.json').read_text(encoding='utf-8'))
MAPPED = {h for k in ('terms', 'uses', 'issues') for t in CAT[k] for h in t['halls']} | set(CAT['electives']['halls'])
SUBJ = {}                                                          # v3(11-03): 묶음마다 자리 하나 — 명품관 관 · 학습관 · 이럴 때 (지금 읽기는 type now)
for w in CAT.get('wings', []):
    for grp in w['groups']:
        for h in grp['halls']:
            SUBJ.setdefault(h, []).append(f"{w['name']}›{grp['name']}")
for t in CAT.get('learn', {}).get('tracks', []):
    for grp in t['groups']:
        for h in grp['halls']:
            SUBJ.setdefault(h, []).append(f"학습관›{grp['name']}")
for h in CAT.get('situations', []):
    SUBJ.setdefault(h, []).append('이럴 때')

THEMES = json.loads((ROOT / 'tools' / 'gallery_themes.json').read_text(encoding='utf-8'))
TITLES = json.loads((ROOT / 'tools' / 'gallery_titles.json').read_text(encoding='utf-8'))
PLACES = {'더 보기'} | {t.get('title', '') for t in THEMES.values() if isinstance(t, dict)}   # 다른 묶음·관·칸 이름을 짚는 「…」 는 영상 언급이 아니다
for _w in CAT.get('wings', []) + CAT.get('learn', {}).get('tracks', []):
    PLACES |= {_w.get('name', '')} | {_g.get('name', '') for _g in _w.get('groups', [])}
PLACES |= {x.get('name', '') for k in ('uses', 'issues', 'features', 'terms') for x in CAT.get(k, [])}


def core(name):
    """작품명 「난춘 · 새소년 (2020)」 → 「난춘」: 가운데점 앞 · 괄호 뺀 부분."""
    return re.sub(r'\s*[(\[].*?[)\]]', '', (name or '').split(' · ')[0]).strip()


def text_refs(g):
    """소개글·막 소개(11-10 S2): 설계(themes)의 글이 묶음에 실제로 없는 영상을 말하는지.
    오류 = 설계 order 에 있었지만 빠진 영상(막힘 등)의 이름이 글에 나옴 · 첫 작품이 빠져 막이 통째 사라짐.
    표시 = 「더 보기」(본편 밖) 영상을 들어가는 말·나가는 말·막 소개가 말함 · 「…」 로 짚은 이름이 어느 작품에도 없음(오탐 있음 — 사람이 본다)."""
    t = THEMES.get(g['id'], {})
    texts = [('sub', t.get('sub', '')), ('thesis', t.get('thesis', '')), ('intro', t.get('intro', '')), ('outro', t.get('outro', ''))] + \
            [(f"막 「{a.get('title', '')}」", a.get('title', '') + ' ' + a.get('lead', '')) for a in t.get('acts', [])]
    built = {x['id']: k for k, x in enumerate(g['works'])}
    names = TITLES.get(g['id'], {})
    err, soft = [], []
    for i in t.get('order', []):
        if i in built:
            continue
        nm = core(names.get(i, ''))
        for where, s in texts:
            if len(nm) >= 2 and nm in s:
                err.append(f'소개글: {where} 가 빠진 영상 「{nm}」({i})을 말함')
    for a in t.get('acts', []):
        if a['first'] not in built:
            err.append(f"소개글: 막 「{a.get('title', '')}」 첫 작품({a['first']})이 빠져 막이 화면에 없음")
    main = g.get('main') or len(g['works'])
    for k, x in enumerate(g['works']):
        nm = core(x.get('ko') or '')
        if k >= main and len(nm) >= 2:
            for where, s in texts:
                if where not in ('sub', 'thesis') and nm in s:
                    soft.append(f'{where} 가 「더 보기」({k + 1}번) 영상 「{nm}」을 말함')
    have = ' '.join((x.get('ko') or '') + ' ' + (x.get('title') or '') + ' ' + (x.get('note') or '') for x in g['works']).lower()
    for where, s in texts:
        for q in re.findall(r'[「『]([^」』]{2,40})[」』]', s):
            if q.lower() not in have and q not in PLACES:
                soft.append(f'{where} 의 「{q}」 가 어느 작품명·명판에도 없음')
    return err, soft


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
    peaks = {11} if n >= 13 else ({9, 10, 11} if n == 12 else {n - 2})   # 12편은 레시피 보정(§3): 정점 9~11
    deep = (9, 10) if n >= 13 else ((8, 10) if n == 12 else (n - 4, n - 3))
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
        if '골라보셈' not in o:
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
    if g['id'] not in MAPPED:
        out.append('카탈로그(학기·기능·이슈·특별전) 어디에도 없음')
    if len(SUBJ.get(g['id'], [])) + (g.get('type') == 'now') != 1:
        out.append(f"자리 {len(SUBJ.get(g['id'], [])) + (g.get('type') == 'now')}개 (하나여야 함): {', '.join(SUBJ.get(g['id'], []))}")
    if g['no'] >= 44:                                    # set5 부터: 한국어 라이터 규칙
        boras = sum(bool(re.search(r'보라\W*$', x.get('note') or '')) for x in w)
        if boras > 3:
            out.append(f'「~보라」 종결 {boras}개 (≤3)')
        for i, x in enumerate(w, 1):
            for j in JARGON:
                if j in (x.get('note') or ''):
                    out.append(f'{i:2}. 편성 용어 「{j}」: {x["note"][:28]}…')
        if '아니라' in g.get('thesis', ''):
            out.append('주장에 「A가 아니라 B」')
    if g.get('kind') == 'issue':
        if sum(x.get('stance') == '다른 시각' for x in w) < 2:
            out.append('이슈관: 다른 시각 2편 미만')
        if not g.get('asof'):
            out.append('이슈관: 기준일(asof) 없음')
    if g.get('use') == '가는 길에' and any((x.get('sec') or 0) > 600 for x in w):
        out.append('가는 길에: 10분 넘는 작품 있음')
    book = g.get('kind') == 'book' or g.get('use') == '잠들기 전'   # 책관·잠들기 전: 정점·최장 자리 규칙을 면제한다
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
    if not book and not (deep[0] <= longest <= deep[1]) and secs[longest - 1] > 0 and longest not in tops:
        out.append(f'가장 긴 작품({secs[longest - 1] // 60}분)이 {longest}번 ({deep[0]}~{deep[1]} 권장)')
    if not book and not (peaks & set(tops)):
        out.append(f'가장 강한 작품(점수 {top})이 {tops}번 ({sorted(peaks)} 권장)')
    if scores[0] == top and len(tops) == 1:
        out.append('1번이 가장 강한 작품')
    for i in range(n - 2):
        dominant = max(sum(x['platform'] == p for x in w) for p in {x['platform'] for x in w}) >= 0.8 * n   # 한 플랫폼이 8할이면 면제
        if w[i]['platform'] == w[i + 1]['platform'] == w[i + 2]['platform'] and len({x['platform'] for x in w}) > 1 and not dominant:
            out.append(f'같은 플랫폼 3연속: {i + 1}~{i + 3}번 {w[i]["platform"]}')
            break
    if not g.get('acts'):
        out.append('막(acts) 없음')
    out += text_refs(g)[0]
    return out


ids = sys.argv[1:] or [Path(f).stem for f in sorted(glob.glob(str(GAL / '*.json'))) if not f.endswith('index.json')]
bad = seat = text = flag = 0
for tid in ids:
    g = json.loads((GAL / f'{tid}.json').read_text(encoding='utf-8'))
    probs = lint(g)
    soft = text_refs(g)[1]
    total = sum((x.get('sec') or 0) for x in g['works']) // 60
    print(f"{'✅' if not probs else '❌'} {g['no']:>2} {tid:<8} {len(g['works'])}편 · {total}분 · 문제 {len(probs)}")
    for p in probs:
        print('     ', p)
    for p in soft:
        print('      · 표시:', p)
    bad += bool(probs)
    seat += sum(p.startswith('자리 ') for p in probs)
    text += sum(p.startswith('소개글:') for p in probs)
    flag += len(soft)
print(f'\n「자리」 오류 {seat} · 소개글↔영상 오류 {text} · 소개글 표시(사람 확인) {flag}')
print(f'{len(ids) - bad}/{len(ids)} 통과')
