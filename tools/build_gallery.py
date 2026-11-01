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
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app' / 'data' / 'gallery'
THEMES = json.loads((ROOT / 'tools' / 'gallery_themes.json').read_text(encoding='utf-8'))
TITLES = json.loads((ROOT / 'tools' / 'gallery_titles.json').read_text(encoding='utf-8'))   # 큐레이터가 붙인 한국어 작품명
MAX, MIN_SCORE, PER_CHANNEL = 16, 6, 2
KEEP = ('platform', 'id', 'ko', 'title', 'channel', 'sec', 'thumb', 'note', 'license', 'stance', 'section', 'tier', 'rights', 'country')   # tier=licensed: 권리자 묵인 업로드(SCOUT_BRIEF §0.5)
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


# ── 「어디」·「어떻게」 문: 작품마다 나라(조사 때 적은 country)와 형식(tools/work_format.json)을 붙여 facets.json 에 모은다 ──
NAME2ISO = {'미국': 'US', 'usa': 'US', 'uk': 'GB', '영국': 'GB', '한국': 'KR', 'south korea': 'KR', '일본': 'JP', 'japan': 'JP', '중국': 'CN', '대만': 'TW',
            '프랑스': 'FR', 'france': 'FR', '독일': 'DE', 'germany': 'DE', '캐나다': 'CA', 'canada': 'CA', '호주': 'AU', 'australia': 'AU',
            '이탈리아': 'IT', '네덜란드': 'NL', 'netherlands': 'NL', '오스트리아': 'AT', 'austria': 'AT', '이스라엘': 'IL', '인도': 'IN',
            '페루': 'PE', '우크라이나': 'UA', '나이지리아': 'NG', 'nigeria': 'NG', '세네갈': 'SN', '브라질': 'BR', 'brazil': 'BR',
            'norway': 'NO', 'sweden': 'SE', 'denmark': 'DK', 'spain': 'ES', 'switzerland': 'CH', 'greece': 'GR', 'latvia': 'LV',
            'croatia': 'HR', 'bulgaria': 'BG', 'czechia': 'CZ', 'new zealand': 'NZ'}
REGIONS = [   # (이름, 안내, 나라 코드) — 위에서부터 먼저 맞는 곳
    ('한국', '', {'KR'}), ('일본', '', {'JP'}), ('중화권', '중국·대만·홍콩', {'CN', 'TW', 'HK'}),
    ('미국', '', {'US'}), ('영국·아일랜드', '', {'GB', 'IE'}), ('프랑스', '', {'FR'}), ('독일어권', '독일·오스트리아·스위스', {'DE', 'AT', 'CH'}),
    ('북유럽', '덴마크·노르웨이·스웨덴·아이슬란드', {'DK', 'NO', 'SE', 'IS', 'FI'}),
    ('유럽의 다른 나라', '이탈리아·스페인·네덜란드·동유럽…', {'IT', 'ES', 'NL', 'BE', 'PL', 'GR', 'HU', 'RS', 'HR', 'BG', 'CZ', 'LV', 'UA', 'RU', 'PT'}),
    ('캐나다·호주·뉴질랜드', '', {'CA', 'AU', 'NZ'}),
    ('중남미', '', {'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'EC', 'CU', 'FK'}),
    ('아시아의 다른 나라', '인도·동남아·몽골·중앙아시아…', {'IN', 'BD', 'NP', 'LK', 'PH', 'SG', 'TH', 'VN', 'ID', 'MN', 'KI', 'TV'}),
    ('아프리카·중동', '', {'NG', 'ZA', 'KE', 'TZ', 'EG', 'ML', 'MG', 'CG', 'NE', 'SN', 'BF', 'IR', 'IL', 'LB', 'SA', 'SY', 'TR'}),
]
def iso_of(raw):
    """조사 때 적은 나라 표기(ISO·한국어·영어·「JP/US」 공동 제작)를 첫 나라의 ISO 코드로. 모르면 ''."""
    first = re.split(r'[/·,]', (raw or '').strip())[0].strip().rstrip('?')
    if re.fullmatch(r'[A-Z]{2}', first):
        return 'GB' if first == 'UK' else first
    return NAME2ISO.get(first.lower(), NAME2ISO.get(first, ''))


def facets(halls):
    """halls: [(관, 작품들)] → {'where': [...], 'how': [...]} — 칸마다 [관 id, 작품 번호, 제목, 썸네일] 목록(관 번호·작품 순서대로).
    YouTube 썸네일은 id 로 만들 수 있어 비워 둔다(파일 크기)."""
    fmt_path = ROOT / 'tools' / 'work_format.json'
    FMT = json.loads(fmt_path.read_text(encoding='utf-8')) if fmt_path.exists() else {}
    f2_path = ROOT / 'tools' / 'work_facets2.json'                 # 랑가나탄 PMEST 의 T·M: 몇 년대(찍힌 때) · 무엇으로(재료)
    F2 = json.loads(f2_path.read_text(encoding='utf-8')) if f2_path.exists() else {}
    where = {r[0]: [] for r in REGIONS}
    how = {f[0]: [] for f in FORMATS}
    era = {e[0]: [] for e in ERAS}
    stuff = {m[0]: [] for m in STUFFS}
    for g, works in halls:
        for i, w in enumerate(works):
            cc = iso_of(w.get('country'))
            reg = next((r[0] for r in REGIONS if cc in r[2]), '')
            it = [g['id'], i, w.get('ko') or w.get('title') or '', '' if w['platform'] == 'youtube' else (w.get('thumb') or ''), w['id'] if w['platform'] == 'youtube' else '']
            if reg:
                where[reg].append(it)
            f = FMT.get(f"{w['platform']}:{w['id']}")
            if f in how:
                how[f].append(it)
            t = F2.get(f"{w['platform']}:{w['id']}", {})
            if t.get('era') in era:
                era[t['era']].append(it)
            if t.get('stuff') in stuff:
                stuff[t['stuff']].append(it)
    def mix(items):                      # 한 관이 앞을 다 차지하지 않게 관을 번갈아(각 관 안의 순서는 그대로)
        by = {}
        for it in items:
            by.setdefault(it[0], []).append(it)
        out, qs = [], list(by.values())
        while qs:
            out += [q.pop(0) for q in qs]
            qs = [q for q in qs if q]
        return out
    where = {k: mix(v) for k, v in where.items()}
    how = {k: mix(v) for k, v in how.items()}
    era = {k: mix(v) for k, v in era.items()}
    stuff = {k: mix(v) for k, v in stuff.items()}
    return {'where': [{'name': n, 'sub': sub, 'items': where[n]} for n, sub, _ in REGIONS if where[n]],
            'how': [{'name': n, 'sub': sub, 'items': how[n]} for n, sub in FORMATS if how[n]],
            'era': [{'name': n, 'sub': sub, 'items': era[n]} for n, sub in ERAS if era[n]],
            'stuff': [{'name': n, 'sub': sub, 'items': stuff[n]} for n, sub in STUFFS if stuff[n]]}


ERAS = [('1960년대 이전', '흑백 필름과 오래된 테이프'), ('1970년대', ''), ('1980년대', ''), ('1990년대', ''), ('2000년대', ''), ('2010년대', ''), ('2020년대', ''),
        ('여러 시대', '옛 화면과 지금 화면을 잇대어 만든 영상')]
STUFFS = [('몸', '춤추고 뛰고 버티는 몸'), ('목소리', '노래하고 말하는 목소리'), ('악기', '말 없이 악기가 하는 이야기'), ('손과 도구', '손과 도구로 만드는 일'),
          ('흙과 나무', '흙·나무·돌, 그리고 그것으로 지은 곳'), ('쇠와 기계', '기계와 발명, 컴퓨터'), ('물', '바다와 강과 얼음, 물에 뛰어드는 사람'),
          ('하늘과 별', '하늘과 날씨와 우주'), ('동물과 식물', '살아 있는 것들'), ('음식', '먹고 만드는 일'), ('그림과 빛', '그림·사진·영화, 빛으로 만든 것'),
          ('글과 말', '글로 쓰고 말로 나누는 이야기'), ('숫자와 생각', '수학과 과학, 철학의 생각')]
FORMATS = [('무대', '노래와 춤과 연주, 그 자리의 실황'), ('경기', '이기고 지는 순간을 그대로'), ('다큐', '실제 사람과 장소를 따라간 기록'),
           ('강연', '한 사람이 청중 앞에서 하는 이야기'), ('해설', '그림과 말로 하나의 생각을 풀어 주는 영상'), ('이야기', '단편 영화와 애니메이션, 지어낸 이야기'),
           ('과정', '무언가가 만들어지는 손과 시간'), ('대화', '마주 앉아 묻고 답하는 시간'), ('풍경', '말없이 바라보는 자연과 우주')]


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
    rooms, FHALLS = [], []
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
        if not g.get('adult'): FHALLS.append((g, g['works']))
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
    # 관 공유 주소: app/s/<관>.html — 메신저 미리보기(제목·표지)는 관마다 다르게, 열면 골라보셈의 그 관으로(YouTube 로 바로 가지 않는다)
    import html as H
    SH = OUT.parent.parent / 's'
    SH.mkdir(exist_ok=True)
    base = 'https://vinni-tokyo.github.io/golabom/app/'
    for r in rooms:
        if r['adult']:
            continue
        g = json.loads((OUT / f"{r['id']}.json").read_text(encoding='utf-8'))
        cover = r['cover'].replace('/mqdefault.', '/hqdefault.')
        title = f"No.{r['no']:02d} {r['title']} — 골라보셈 명품관"
        desc = g.get('thesis') or r['sub']
        (SH / f"{r['id']}.html").write_text(f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{H.escape(title)}</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="골라보셈">
<meta property="og:title" content="{H.escape(title)}"><meta property="og:description" content="{H.escape(desc)} · {r['count']}편">
<meta property="og:image" content="{H.escape(cover)}"><meta property="og:url" content="{base}s/{r['id']}.html">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{base}#/g/{r['id']}">
<script>location.replace('../#/g/{r['id']}')</script>
</head><body style="background:#0d0c0b;color:#eee;font:16px sans-serif;padding:24px"><a style="color:#e8c37a" href="../#/g/{r['id']}">{H.escape(title)} 보러 가기</a></body></html>
""", encoding='utf-8')
    live = {r['id'] for r in rooms}
    fc = facets(sorted(((g, w) for g, w in FHALLS if g['id'] in live), key=lambda x: x[0]['no']))
    (OUT.parent / 'facets.json').write_text(json.dumps(fc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print('facets.json: ' + ' · '.join(f"{k} {sum(len(x['items']) for x in v)}편" for k, v in fc.items()))


if __name__ == '__main__':
    main()
