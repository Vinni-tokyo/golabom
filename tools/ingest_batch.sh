#!/usr/bin/env bash
# 설계 묶음 받기: scratchpad/set4/{gallery_candidates,hall_design}_<X>.json → 저장소 → 병합 → 빌드 → 검사
set -e
S=/home/kim-h/.claude-tmp/claude-1000/-home-kim-h-work-skillpath/e4a3f810-2654-4a02-96c9-2d875f35f975/scratchpad/set4
cd "$(dirname "$0")/.."
for X in "$@"; do
  cp "$S/gallery_candidates_$X.json" "data/gallery_candidates/gallery_candidates_set4$X.json"
  cp "$S/hall_design_$X.json" "data/hall_designs/hall_design_set4$X.json"
  python3 tools/merge_hall_design.py "data/hall_designs/hall_design_set4$X.json"
done
python3 tools/build_gallery.py --theme craft data/gallery_candidates/*.json | grep -E "⚠|index"
