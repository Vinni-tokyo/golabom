#!/usr/bin/env bash
# 퍼 가기 실재생 전수 점검(주 1회): 걸린 YouTube 영상 전부를 4 갈래로 emb_check.cjs 에 돌려
# 「재생할 수 없음 · 오류」가 뜬 영상을 data/embed_blocked.json 에 적는다 → build_gallery.py 가 걸지 않는다.
# 주의: 판정은 출구 나라 기준이다. 출구를 인자로 적는다: bash tools/embed_sweep.sh --country KR (이 PC 출구 = 한국 · 11-10 확인)
#       인자는 embed_sweep_apply.py 로 그대로 넘긴다(--report 파일 = 보고만 · --force = 새 막힘 15편 초과 반영).
set -e
cd "$(dirname "$0")/.."
W=.scout/sweep; mkdir -p $W
python3 - <<'PY'
import json
idx = json.load(open('app/data/gallery/index.json'))['galleries']
ids = []
for g in idx:
    for w in json.load(open(f"app/data/gallery/{g['id']}.json"))['works']:
        if w['platform'] == 'youtube' and w['id'] not in ids:
            ids.append(w['id'])
old = json.load(open('data/embed_blocked.json')) if __import__('os').path.exists('data/embed_blocked.json') else {}
ids += [i for i in old if i not in ids]                      # 이미 막힌 것도 다시 본다(풀렸으면 돌려놓는다)
for k in range(4):
    open(f'.scout/sweep/ids_{k}.txt', 'w').write('\n'.join(ids[k::4]))
print(len(ids), '편 점검')
PY
export NODE_PATH=${NODE_PATH:-/home/kim-h/work/BadgeLens_Frost/workspace/node_modules}
for k in 0 1 2 3; do
  ( : > $W/out_$k.txt; xargs -n 10 < $W/ids_$k.txt node tools/emb_check.cjs >> $W/out_$k.txt 2>&1 ) &
done
wait
cat $W/out_*.txt > $W/all.txt
python3 tools/embed_sweep_apply.py $W/all.txt "$@"
