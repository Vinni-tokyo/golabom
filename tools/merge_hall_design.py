#!/usr/bin/env python3
"""전시 설계(hall_design_*.json: 에이전트·큐레이터가 쓴 주장·순서·막·명판·나가는 말)를 gallery_themes.json 에 합친다.
  python3 tools/merge_hall_design.py <design.json> ...
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
T = ROOT / 'tools' / 'gallery_themes.json'
themes = json.loads(T.read_text(encoding='utf-8'))
for f in sys.argv[1:]:
    for tid, d in json.loads(Path(f).read_text(encoding='utf-8')).items():
        if tid not in themes:
            print('모르는 전시관', tid); continue
        t = themes[tid]
        for k in ('thesis', 'sub', 'intro', 'outro', 'order', 'acts', 'notes'):
            if d.get(k):
                t[k] = d[k]
        t['drop'] = [x['id'] if isinstance(x, dict) else x for x in d.get('drop', [])]
        print(f"{tid:<8} 주장 {'O' if t.get('thesis') else '-'} · 순서 {len(t.get('order', []))} · 막 {len(t.get('acts', []))} · 명판 {len(t.get('notes', {}))} · 뺌 {len(t['drop'])}")
T.write_text(json.dumps(themes, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
