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
KEEP = ('platform', 'id', 'ko', 'title', 'channel', 'sec', 'thumb', 'note', 'license', 'stance', 'section', 'tier', 'rights')   # tier=licensed: 권리자 묵인 업로드(SCOUT_BRIEF §0.5)
CC_FILE = ROOT / 'data' / 'captions.json'                     # tools/annotate_captions.py 가 만든 YouTube 자막 유무
CC = json.loads(CC_FILE.read_text(encoding='utf-8')) if CC_FILE.exists() else {}
CATALOG = json.loads((ROOT / 'tools' / 'gallery_catalog.json').read_text(encoding='utf-8'))   # 학기·기능·이슈 지도
HEALTH_FILE = ROOT / 'data' / 'health.json'                  # tools/gallery_health.py 가 만든 생존 검사 결과
HEALTH = json.loads(HEALTH_FILE.read_text(encoding='utf-8')) if HEALTH_FILE.exists() else {}
VT_FILE = ROOT / 'data' / 'vimeo_tracks.json'                # Vimeo 자막 목록(Player SDK 조사)
VT = json.loads(VT_FILE.read_text(encoding='utf-8')) if VT_FILE.exists() else {}
def cc_of(w):
    if w['platform'] == 'ted': return 'ko'                      # TED 는 한국어 번역 자막판으로 불러온다
    if w['platform'] == 'vimeo':                                 # 자막이 있으면 골라봄 자막기가 플레이어 아래에 한국어로 옮긴다
        t = VT.get(w['id']) or []
        return 'ko' if any(x.startswith('ko') for x in t) else ('tr' if t else None)
    if w['platform'] == 'youtube':
        c = CC.get(w['id'])
        if not c: return None
        if c['caption'] and (c['lang'] or '').startswith('ko'): return 'ko'
        return 'yes' if c['caption'] else 'auto'               # 올린 자막 있음 / 자동 자막만
    return None


def pick(cands, cap=True):
    cands = sorted((c for c in cands if (c.get('score') or 0) >= MIN_SCORE), key=lambda c: -(c.get('score') or 0))
    out, per_ch, seen = [], {}, set()

    def take(c):
        key = (c['platform'], c['id'])
        ch = (c.get('channel') or '').lower()
        if key in seen or (cap and per_ch.get(ch, 0) >= PER_CHANNEL) or len(out) >= MAX:
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
        if tid.startswith('_'): continue
        t = THEMES[tid]
        skip = set(TITLES.get('_exclude', {}).get(tid, []))          # 다른 관과 겹치는 작품 등
        off = set(TITLES.get('_offline_platforms', []))              # 지금 우리 화면에서 재생이 안 되는 플랫폼(Dailymotion: Player ID 필요)
        cands = [c for c in cands if c['platform'] not in off]
        # 큐레이터가 뺀 작품(drop)은 고르기 전에 빼고, 순서(order)를 정했으면 채널당 2편 제한은 큐레이터 판단에 맡긴다
        skip |= set(t.get('drop', []))
        pool = [c for c in cands if c['id'] not in skip]
        if t.get('order'):                                            # 순서가 있으면 그 목록이 전부(점수·채널·편수 제한 없음)
            byid = {c['id']: c for c in pool}
            chosen = [byid[i] for i in t['order'] if i in byid]
        else:
            chosen = pick(pool)
        works = [{k: c.get(k) for k in KEEP} | {'ko': TITLES.get(tid, {}).get(c['id'])} for c in chosen]
        for w in works:
            w['cc'] = cc_of(w)
            if w['platform'] == 'youtube' and not w.get('sec') and CC.get(w['id'], {}).get('sec'):
                w['sec'] = CC[w['id']]['sec']                     # 길이가 비어 있던 작품은 공식 정보로 채운다
        for w in works:                                               # 큐레이터가 고쳐 쓴 명판(notes: id → 글) · 해설 자막(cues: id → [[초, 글], …])
            if w['id'] in t.get('notes', {}):
                w['note'] = t['notes'][w['id']]
            if w['id'] in t.get('cues', {}):
                w['cues'] = t['cues'][w['id']]
            if w['id'] in t.get('speech', {}):                       # 실제 말하는 언어 · 화면에 박힌 자막(확인한 것만)
                w['speech'] = t['speech'][w['id']]
        # 큐레이터가 순서를 정했으면(order: id 목록) 그 순서로, 그 작품들만 건다
        if t.get('order'):
            by_id = {w['id']: w for w in works}
            ordered = [by_id.pop(i) for i in t['order'] if i in by_id]
            missing = [i for i in t['order'] if i not in {w['id'] for w in ordered}]
            if missing:
                print(f'   ⚠ {tid}: order 에 있지만 후보에 없음 → {missing}')
            works = ordered                                      # 순서에 없는 작품은 걸지 않는다(큐레이터의 선택이 전부)
        # 막(acts): first = 그 막의 첫 작품 id → 화면용 start(번호)로 바꾼다
        idx = {w['id']: i for i, w in enumerate(works)}
        acts = [{'start': idx[a['first']], 'title': a['title'], 'lead': a.get('lead', '')} for a in t.get('acts', []) if a['first'] in idx]
        meta = {k: v for k, v in t.items() if k not in ('order', 'acts', 'notes', 'drop', 'cues', 'speech')}
        (OUT / f'{tid}.json').write_text(json.dumps({'id': tid, **meta, 'acts': acts, 'works': works}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
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
        tid = g['id']
        h = [HEALTH.get(f"{w['platform']}:{w['id']}") for w in g['works']]
        dead = sum(1 for x in h if x and not x['ok'])
        # 상태: 카탈로그가 정하면 그대로, 아니면 생존 검사에서 열리는 작품이 11편 밑이면 정비 중
        status = CATALOG['status'].get(tid) or ('정비 중' if len(g['works']) - dead < 11 and g.get('kind') not in ('era', 'person') else '')
        checked = max((x['checked'] for x in h if x), default='')
        rooms.append({'id': tid, 'no': g['no'], 'title': g['title'], 'sub': g['sub'], 'cover': cover, 'adult': bool(g.get('adult')), 'genre': g.get('genre', ''),
                      'count': len(g['works']), 'platforms': list(dict.fromkeys(w['platform'] for w in g['works'])),
                      'term': next((t['id'] for t in CATALOG['terms'] if tid in t['halls']), ''),
                      'uses': [u['name'] for u in CATALOG['uses'] if tid in u['halls']],
                      'issue': next((i['name'] for i in CATALOG['issues'] if tid in i['halls']), ''),
                      'status': status, 'checked': checked})
    rooms = [r for r in rooms if r['status'] != '수장고']             # 수장고: 파일과 주소는 두고 목록에서만 뺀다
    rooms.sort(key=lambda r: r['no'])
    doors = {k: CATALOG[k] for k in ('program', 'terms', 'uses', 'issues', 'electives')}
    (OUT / 'index.json').write_text(json.dumps({'galleries': rooms, 'doors': doors}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'index.json: {len(rooms)}관')


if __name__ == '__main__':
    main()
