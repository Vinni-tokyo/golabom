#!/usr/bin/env python3
"""골라봄 매일 자동 작업 — 토픽별 영상과 리저브 영상 정보를 받아 app/data/gen/ 에 쓴다.

  YT_API_KEY=... python3 tools/fetch_videos.py      # 공식 YouTube Data API v3
  python3 tools/fetch_videos.py --sample             # 키 없이 화면 확인용 자리 데이터 → app/data/sample/(커밋함)
  YT_API_KEY=... python3 tools/fetch_videos.py --only-trend   # 1시간마다: 지금 뜨는 영상만(나라·분야 15곳 × 1단위)

⚠ gen/ 은 커밋하지 않는다(.gitignore). API 데이터는 30일 넘게 보관할 수 없어서,
   매일 새로 받아 Pages 배포본으로만 올린다(docs/PLAN_v0.3 §5).

사용량(하루): 토픽 20 × 101 ≈ 2,020 · 깊이 파기 키워드 30 × ~102 ≈ 3,060 · 트렌드 6 × 1 = 6 → 약 5,100 단위(한도 10,000).
"""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'app' / 'data'
GEN = DATA / 'gen'
API = 'https://www.googleapis.com/youtube/v3/'

KEEP = 12                 # 토픽당 보관 개수(길이 칩으로 걸러도 남도록 10보다 조금 많이)
RECENT_DAYS = 183         # 최근 6개월
MIN_VIEWS = 100           # 이보다 적으면 좋아요 비율이 흔들린다
SHORTS_MAX = 60           # 60초 이하 = 쇼츠로 보고 뺀다
AD_WORDS = ['광고', '협찬', '유료 광고', '#ad', 'sponsored', '#PR', '제공받아']
BAIT_WORDS = ['충격', '경악', '소름', '레전드', '실화냐', '결국', '난리', '대박', 'ㄷㄷ', '미쳤다']   # 트렌드에서 자극적 제목 빼기
GEM_DAYS = 730            # 깊이 파기: 최근 2년
GEM_MIN_SEC = 8 * 60      # 깊이 파기: 내용이 충분한 길이
BIG_CHANNEL = 1_000_000   # 깊이 파기: 구독자 100만 넘는 채널은 보석 목록에서 뺀다


def get(endpoint, **params):
    """429(짧은 시간에 너무 많이) 는 기다렸다가 다시 시도한다. 검색은 1번에 100단위라 사이에 1초 쉰다."""
    params['key'] = os.environ['YT_API_KEY']
    url = API + endpoint + '?' + urllib.parse.urlencode(params)
    for wait in (20, 60, 0):
        if endpoint == 'search':
            time.sleep(1)
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 or not wait:
                raise
            print(f'  429 — {wait}초 기다렸다가 다시 시도')
            time.sleep(wait)


def seconds(iso):
    """PT1H2M3S → 3723"""
    m = re.fullmatch(r'P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', iso or '')
    if not m:
        return 0
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def details(ids):
    out = []
    for i in range(0, len(ids), 50):
        r = get('videos', part='snippet,contentDetails,statistics,status', id=','.join(ids[i:i + 50]))
        out += r.get('items', [])
    return out


def card(v):
    sn, cd, st = v['snippet'], v['contentDetails'], v.get('statistics', {})
    views = int(st.get('viewCount', 0))
    likes = int(st['likeCount']) if 'likeCount' in st else None
    th = sn.get('thumbnails', {})
    return {
        'id': v['id'],
        'title': sn['title'],
        'channel': sn['channelTitle'],
        'published': sn['publishedAt'][:10],
        'sec': seconds(cd.get('duration')),
        'caption': cd.get('caption') == 'true',
        'views': views,
        'likeRatio': round(likes / views, 4) if likes is not None and views >= MIN_VIEWS else None,
        'thumb': (th.get('medium') or th.get('high') or th.get('default') or {}).get('url', ''),
        'tags': sn.get('tags', [])[:10],          # 지금 뜨는 키워드를 뽑는 재료(앱이 계산)
    }


def reason(c, rank_pct):
    bits = [f"{max(1, round(c['sec'] / 60))}분"]
    if c['caption']:
        bits.append('자막')
    if rank_pct is not None and rank_pct <= 30:
        bits.append(f'좋아요 비율 상위 {max(1, rank_pct)}%')
    return ' · '.join(bits)


def topic_videos(t):
    after = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=RECENT_DAYS)).strftime('%Y-%m-%dT%H:%M:%SZ')
    s = get('search', part='snippet', type='video', q=t['query'], maxResults=25, regionCode='KR',
            relevanceLanguage='ko', videoEmbeddable='true', safeSearch='moderate', publishedAfter=after)
    ids = [it['id']['videoId'] for it in s.get('items', [])]
    removed = {'shorts': 0, 'ad': 0}
    cards = []
    for v in details(ids):
        if not v.get('status', {}).get('embeddable', False) or v['snippet'].get('liveBroadcastContent') != 'none':
            continue
        c = card(v)
        title = c['title'].lower()
        if c['sec'] <= SHORTS_MAX or '#shorts' in title:
            removed['shorts'] += 1
            continue
        if any(w.lower() in title for w in AD_WORDS + t.get('exclude', [])):
            removed['ad'] += 1
            continue
        cards.append(c)
    # 조회수 순이 아니라 좋아요 비율 순. 비율을 모르는 것은 뒤로.
    cards.sort(key=lambda c: (c['likeRatio'] is None, -(c['likeRatio'] or 0), -c['views']))
    rated = [c for c in cards if c['likeRatio'] is not None]
    for i, c in enumerate(cards):
        pct = round((rated.index(c) + 1) / len(rated) * 100) if c in rated else None
        c['reason'] = reason(c, pct)
    return {'topic': t['id'], 'removed': removed, 'videos': cards[:KEEP]}


def trend_videos(cat, region='KR', keep=KEEP):
    """인기 급상승(chart=mostPopular, 1단위). 쇼츠·자극적 제목·광고를 빼고 10편."""
    params = dict(part='snippet,contentDetails,statistics,status', chart='mostPopular', regionCode=region, maxResults=50)
    if cat.get('category'):
        params['videoCategoryId'] = cat['category']
    try:
        items = get('videos', **params).get('items', [])
    except urllib.error.HTTPError as e:      # 지역에 없는 분류는 404 — 빈 목록으로 둔다. 한도 초과(403)는 위로 올린다
        if e.code != 404:
            raise
        print(f"trend {cat['id']}: HTTP 404 (이 지역에 없는 분류)")
        items = []
    removed = {'shorts': 0, 'bait': 0, 'ad': 0}
    cards = []
    for v in items:
        if not v.get('status', {}).get('embeddable', False):
            continue
        c = card(v)
        title = c['title'].lower()
        if c['sec'] <= SHORTS_MAX or '#shorts' in title:
            removed['shorts'] += 1
        elif any(w.lower() in title for w in BAIT_WORDS):
            removed['bait'] += 1
        elif any(w.lower() in title for w in AD_WORDS):
            removed['ad'] += 1
        else:
            c['reason'] = f"인기 급상승 {len(cards) + 1}위 · {max(1, round(c['sec'] / 60))}분 · 조회수 {c['views']:,}"
            cards.append(c)
    return {'category': cat['id'], 'region': region, 'removed': removed, 'videos': cards[:keep]}


def subscribers(channel_ids):
    out = {}
    ids = list(dict.fromkeys(channel_ids))
    for i in range(0, len(ids), 50):
        for ch in get('channels', part='statistics', id=','.join(ids[i:i + 50])).get('items', []):
            st = ch.get('statistics', {})
            out[ch['id']] = None if st.get('hiddenSubscriberCount') else int(st.get('subscriberCount', 0))
    return out


def gem_score(c):
    """숨은 보석 점수 — 좋아요 비율 + 작은 채널 우대 + 길이. 0~1 근처."""
    s = (c['likeRatio'] or 0) * 10                      # 좋아요 비율 4% ≈ 0.4
    subs = c.get('subs')
    if subs is not None:
        s += 0.3 if 1_000 <= subs <= 100_000 else 0.1 if subs < 1_000 else 0
        if subs > BIG_CHANNEL:                          # 이미 알고리즘이 밀어주는 큰 채널은 「숨은」 보석이 아니다
            s -= 1
    s += 0.1 if c['sec'] >= 20 * 60 else 0
    return round(s, 4)


def short_num(n):
    return f'{n / 10000:.1f}만'.replace('.0만', '만') if n >= 10000 else f'{n / 1000:.0f}천' if n >= 1000 else str(n)


def deep_field(field):
    """깊이 파기: 키워드마다 검색 → 숨은 보석 점수로 줄 세우기. 분야 전체 = 키워드 결과를 합친 상위."""
    after = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=GEM_DAYS)).strftime('%Y-%m-%dT%H:%M:%SZ')
    by_kw, removed = {}, {'shorts': 0, 'short': 0, 'ad': 0}   # ad = 광고 표시 + 자극적 제목
    for kw in field['keywords']:
        s = get('search', part='snippet', type='video', q=kw, maxResults=25, regionCode='KR', relevanceLanguage='ko',
                videoEmbeddable='true', safeSearch='moderate', publishedAfter=after)
        vids = details([it['id']['videoId'] for it in s.get('items', [])])
        subs = subscribers([v['snippet']['channelId'] for v in vids])
        cards = []
        for v in vids:
            if not v.get('status', {}).get('embeddable', False):
                continue
            c = card(v)
            c['subs'] = subs.get(v['snippet']['channelId'])
            title = c['title'].lower()
            if c['sec'] <= SHORTS_MAX or '#shorts' in title:
                removed['shorts'] += 1
            elif c['sec'] < GEM_MIN_SEC:
                removed['short'] += 1
            elif any(w.lower() in title for w in AD_WORDS + BAIT_WORDS):
                removed['ad'] += 1
            elif c['likeRatio'] is not None and (c['subs'] or 0) <= BIG_CHANNEL:
                c['gem'] = gem_score(c)
                cards.append(c)
        cards.sort(key=lambda c: -c['gem'])
        by_like = sorted(cards, key=lambda c: -c['likeRatio'])     # 「좋아요 비율 상위」는 점수 순위가 아니라 비율 순위
        for c in cards:
            pct = max(1, round((by_like.index(c) + 1) / len(cards) * 100))
            bits = [f"구독자 {short_num(c['subs'])}"] if c['subs'] is not None else []
            if pct <= 30:
                bits.append(f'좋아요 비율 상위 {pct}%')
            bits.append(f"{round(c['sec'] / 60)}분")
            c['reason'] = '💎 ' + ' · '.join(bits)
            c['kw'] = kw
        by_kw[kw] = cards[:KEEP]
    seen, top = set(), []
    for c in sorted((c for cs in by_kw.values() for c in cs), key=lambda c: -c['gem']):
        if c['id'] not in seen:
            seen.add(c['id']); top.append(c)
    return {'field': field['id'], 'removed': removed, 'all': top[:KEEP], 'byKeyword': by_kw}


def reserve_issue(path):
    issue = json.loads(path.read_text(encoding='utf-8'))
    ids = [p['videoId'] for p in issue['picks'] if p.get('videoId')]
    info = {v['id']: card(v) for v in details(ids)} if ids else {}
    for p in issue['picks']:
        p['video'] = info.get(p.get('videoId'))
    return issue


# ── 키 없이 화면을 확인하기 위한 자리 데이터 ────────────────────────────────
def sample_topic(t, n):
    secs = [8 * 60 + 42, 6 * 60 + 15, 14 * 60 + 5, 4 * 60 + 50, 19 * 60 + 30, 27 * 60 + 10, 9 * 60 + 12, 3 * 60 + 40, 12 * 60, 35 * 60]
    vids = []
    for i, s in enumerate(secs):
        c = {'id': '', 'title': f"[샘플] {t['name']} 영상 {i + 1}", 'channel': '샘플 채널', 'published': '2026-10-01',
             'sec': s, 'caption': i % 2 == 0, 'views': 1000 * (10 - i), 'likeRatio': None, 'thumb': '', 'sample': True}
        c['reason'] = reason(c, (i + 1) * 10)
        vids.append(c)
    return {'topic': t['id'], 'removed': {'shorts': 4 + n % 3, 'ad': 1 + n % 2}, 'videos': vids}


SAMPLE_HOT = ['금리 동결', '신형 폰 발열', '첫눈 예보', '월드 챔피언십', '단풍 절정']


def sample_trend(cat, n):
    out = sample_topic({'id': cat['id'], 'name': f"인기 급상승 · {cat['name']}"}, n)
    for i, c in enumerate(out['videos']):
        kw = SAMPLE_HOT[(i + n) % len(SAMPLE_HOT)]
        c['title'] = f'[샘플] {kw} 영상 {i + 1}'
        c['channel'] = f'샘플 채널 {(i * 7 + n) % 9}'
        c['tags'] = [kw]
        c['reason'] = f"인기 급상승 {i + 1}위 · {max(1, round(c['sec'] / 60))}분 · 조회수 {c['views']:,}"
    return {'category': cat['id'], 'removed': {'shorts': 6 + n, 'bait': 3, 'ad': 1}, 'videos': out['videos']}


SAMPLE_WORLD = {'US': ['Election Night', 'NBA Finals', 'Taylor Swift'], 'JP': ['紅白歌合戦', 'ポケモン', '大谷翔平'],
                'TW': ['颱風', '五月天', '金馬獎'], 'HK': ['天文台', '演唱會', '港股'], 'GB': ['Premier League', 'Bake Off', 'Budget'],
                'IN': ['IPL', 'Diwali', 'Bollywood'], 'FR': ['Ligue 1', 'Paris', 'Rugby'], 'BR': ['Flamengo', 'Novela', 'Copa']}


def sample_country(c, n):
    out = sample_topic({'id': c['id'], 'name': c['name']}, n)
    kws = SAMPLE_WORLD.get(c['id'], ['Sample'])
    for i, v in enumerate(out['videos']):
        kw = kws[i % len(kws)]
        v['title'] = f'[샘플] {kw} {i + 1}'
        v['channel'] = f"sample {c['id']} {(i * 5 + n) % 7}"
        v['tags'] = [kw]
        v['reason'] = f"{c['name']} 인기 급상승 {i + 1}위 · {max(1, round(v['sec'] / 60))}분"
    return {'category': f"country-{c['id']}", 'region': c['id'], 'removed': {'shorts': 3, 'bait': 1, 'ad': 0}, 'videos': out['videos']}


def sample_deep(field, n):
    by_kw = {}
    for k, kw in enumerate(field['keywords']):
        vids = sample_topic({'id': field['id'], 'name': kw}, n + k)['videos'][:6]
        for i, c in enumerate(vids):
            c['sec'] = max(c['sec'], GEM_MIN_SEC + i * 90)
            c['subs'] = [3200, 8100, 21000, 640, 47000, 12000][i % 6]
            c['reason'] = f"💎 구독자 {short_num(c['subs'])} · 좋아요 비율 상위 {(i + 1) * 5}% · {round(c['sec'] / 60)}분"
            c['kw'] = kw
        by_kw[kw] = vids
    top = [by_kw[kw][0] for kw in field['keywords']] + [by_kw[kw][1] for kw in field['keywords']]
    return {'field': field['id'], 'removed': {'shorts': 9, 'short': 14, 'ad': 2}, 'all': top[:KEEP], 'byKeyword': by_kw}


def sample_reserve(path):
    issue = json.loads(path.read_text(encoding='utf-8'))
    secs = [8 * 60 + 40, 12 * 60 + 5, 9 * 60 + 30, 7 * 60 + 10, 40 * 60]
    for i, p in enumerate(issue['picks']):
        p['video'] = {'id': '', 'title': f'[샘플] 리저브 No.{i + 1:02d}', 'channel': '샘플 채널', 'sec': secs[i % 5],
                      'caption': True, 'views': 3000, 'likeRatio': None, 'thumb': '', 'sample': True}
    return issue


def main():
    sample = '--sample' in sys.argv
    only_trend = '--only-trend' in sys.argv     # 1시간마다: 트렌드만(나라·분야당 1단위)
    if not sample and not os.environ.get('YT_API_KEY'):
        sys.exit('YT_API_KEY 가 없습니다. 키 없이 화면만 보려면 --sample 을 붙이세요.')
    OUT = DATA / 'sample' if sample else GEN       # 샘플은 API 데이터가 아니라 커밋해도 됨 → 키 없이도 사이트에서 화면 확인
    conf = json.loads((DATA / 'topics.json').read_text(encoding='utf-8'))
    for d in ('videos', 'reserve', 'trend', 'deep'):
        (OUT / d).mkdir(parents=True, exist_ok=True)
    jobs = (
        [('trend', c['id'], (lambda c=c, n=n: sample_trend(c, n) if sample else trend_videos(c))) for n, c in enumerate(conf.get('trendCategories', []))]
        # 나라별 지금 뜨는 영상(한국 외) — 키워드를 뽑을 재료가 되도록 30편까지 둔다
        + [('trend', f"country-{c['id']}", (lambda c=c, n=n: sample_country(c, n) if sample else trend_videos({'id': f"country-{c['id']}"}, c['id'], 30)))
           for n, c in enumerate(conf.get('trendCountries', [])) if c['id'] != 'KR']
        + [('deep', f['id'], (lambda f=f, n=n: sample_deep(f, n) if sample else deep_field(f))) for n, f in enumerate(conf.get('deepFields', []))]
        + [('videos', t['id'], (lambda t=t, n=n: sample_topic(t, n) if sample else topic_videos(t))) for n, t in enumerate(conf['topics'])]
        + [('reserve', p.stem, (lambda p=p: sample_reserve(p) if sample else reserve_issue(p))) for p in sorted((DATA / 'reserve').glob('*.json'))]
    )
    if only_trend:
        jobs = [j for j in jobs if j[0] == 'trend']
    done, failed = 0, []
    for kind, name, run in jobs:
        try:
            out = run()
        except urllib.error.HTTPError as e:
            # 한도 초과(403 quotaExceeded) 등 — 그 항목만 건너뛴다. 앱은 파일이 없으면 「아직 데이터가 없어요」를 보여 준다.
            failed.append(f'{kind}/{name}: HTTP {e.code}')
            print(f'⚠ {kind} {name}: HTTP {e.code} — 건너뜀')
            if e.code == 403:
                print('⚠ 한도 초과로 보고 나머지 API 호출을 멈춥니다.')
                break
            continue
        (OUT / kind / f'{name}.json').write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
        done += 1
        print(f'{kind} {name}: ok')
    now = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    old = {}
    if only_trend and (OUT / 'meta.json').exists():
        old = json.loads((OUT / 'meta.json').read_text(encoding='utf-8'))
    meta = {**old, 'sample': sample, 'trendAt': now}
    if only_trend:
        meta['trendFailed'] = failed
    else:
        meta.update(generatedAt=now, failed=failed)
    (OUT / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False), encoding='utf-8')
    if not done:
        sys.exit('받은 데이터가 하나도 없습니다.')


if __name__ == '__main__':
    main()
