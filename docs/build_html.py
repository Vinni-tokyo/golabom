#!/usr/bin/env python3
"""docs/*.md → docs/*.html (pandoc). md 안의 <!-- MOCKUPS --> 자리에 mockups_v0.2.html 을 끼운다."""
import subprocess
import sys
from pathlib import Path

DOCS = Path(__file__).resolve().parent

CSS = """
:root{--bg:#f3f4f8;--surface:#fff;--ink:#1d2233;--ink-2:#4a5068;--ink-3:#8a90a6;--line:#e3e5ee;--brand:#3b4a7a;--brand-soft:#e8ebf6;--accent:#e2574c;--ok:#2f8f5b;--gem:#7a4fb8;--t1:#c9d3e8;--t2:#d8cfe6;--t3:#cfe3d8}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#14161d;--surface:#1e212b;--ink:#eceef5;--ink-2:#b5bacb;--ink-3:#7c8297;--line:#2e3240;--brand:#8fa2e6;--brand-soft:#262c42;--accent:#f07a70;--ok:#5cc28a;--gem:#b896ea;--t1:#2c3550;--t2:#3a3150;--t3:#2b4438}}
:root[data-theme="dark"]{--bg:#14161d;--surface:#1e212b;--ink:#eceef5;--ink-2:#b5bacb;--ink-3:#7c8297;--line:#2e3240;--brand:#8fa2e6;--brand-soft:#262c42;--accent:#f07a70;--ok:#5cc28a;--gem:#b896ea;--t1:#2c3550;--t2:#3a3150;--t3:#2b4438}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;line-height:1.65}
main{max-width:1040px;margin:0 auto;padding:28px 16px 70px}
h1{font-size:28px;margin:0 0 10px}
h2{font-size:21px;margin:30px 0 10px}
h3{font-size:16px;margin:22px 0 6px}
blockquote{margin:12px 0;padding:10px 16px;background:var(--brand-soft);border-left:4px solid var(--brand);border-radius:8px}
blockquote p{margin:0}
table{border-collapse:collapse;width:100%;margin:10px 0;font-size:14px;display:block;overflow-x:auto}
th,td{border-bottom:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{color:var(--ink-3);font-size:13px}
code{background:var(--brand-soft);padding:1px 5px;border-radius:5px;font-size:.9em}
hr{border:0;border-top:1px solid var(--line);margin:26px 0}
/* 목업 */
.mock{margin:22px 0;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px}
.mock-t{margin:0 0 12px;font-size:13px;color:var(--ink-3)}
.row{display:flex;gap:16px;flex-wrap:wrap;justify-content:center}
.col{display:flex;flex-direction:column;align-items:center;flex:none}
.phone{width:250px;border:7px solid #2a2e3a;border-radius:26px;background:var(--bg);overflow:hidden}
.scr{padding:12px 10px 14px;min-height:500px;font-size:12.5px;line-height:1.45}
.cap{font-size:12px;color:var(--ink-3);margin-top:6px}
.brandbar{font-weight:800;font-size:14px;margin-bottom:8px}
.hello{font-size:17px;font-weight:800;margin-bottom:10px}
.again{display:block;border:1.5px dashed var(--brand);border-radius:12px;padding:8px 10px;margin-bottom:10px;color:var(--brand);font-weight:700}
.again small,.mode small{display:block;font-weight:400;color:var(--ink-3);font-size:11.5px}
.mode{display:block;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:8px;font-size:14px}
.mode.m3{background:var(--brand-soft);border-color:var(--brand)}
.mini{font-size:12px;color:var(--ink-2);margin-top:10px}
.crumb{font-size:11.5px;color:var(--ink-3);margin-bottom:8px}
.q{font-size:16px;font-weight:800;margin:2px 0 6px}
.q2{font-size:12.5px;font-weight:700;margin:10px 0 3px;color:var(--ink-2)}
.qs{font-size:11.5px;color:var(--ink-3);margin-bottom:10px}
.chip{display:inline-block;border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:4px 10px;margin:2px 1px;font-size:12px}
.chip.on{background:var(--brand);border-color:var(--brand);color:#fff}
.chip.hot{border-color:var(--accent);color:var(--accent)}
.btn{display:block;text-align:center;background:var(--brand);color:#fff;border-radius:12px;padding:10px;font-weight:700;margin-top:14px}
.ghost{display:block;text-align:center;color:var(--ink-3);font-size:11.5px;margin-top:8px}
.sent{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:9px 10px;margin:10px 0;font-size:13px;line-height:1.9}
.blank{color:var(--brand);font-weight:800;border-bottom:2px solid var(--brand)}
.blank.x{color:var(--accent);border-color:var(--accent)}
.v{display:flex;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:6px;margin-bottom:6px}
.th{width:80px;height:46px;border-radius:7px;flex:none;position:relative;background:var(--t1)}
.th.b{background:var(--t2)}.th.c{background:var(--t3)}
.th i{position:absolute;right:3px;bottom:3px;font-style:normal;font-size:9.5px;background:rgba(0,0,0,.72);color:#fff;border-radius:4px;padding:0 4px}
.vt{font-size:11.5px;font-weight:600;line-height:1.3}
.gem{font-size:10.5px;color:var(--gem);margin-top:2px}
.cm{font-size:10.5px;color:var(--ink-2);margin-top:2px}
.prog{display:flex;gap:3px;margin-bottom:12px}.prog span{flex:1;height:4px;border-radius:9px;background:var(--line)}.prog span.on{background:var(--brand)}
.ab{background:var(--surface);border:1.5px solid var(--line);border-radius:14px;padding:8px;text-align:center;font-size:13px}
.ab .th.big1{width:100%;height:96px;margin-bottom:6px}
.vs{text-align:center;color:var(--ink-3);font-size:11.5px;margin:6px 0}
.card{background:var(--brand-soft);border-radius:12px;padding:9px 10px;margin-bottom:6px}
.ct{font-weight:800;font-size:13.5px;margin-bottom:4px}
.bar{font-size:11.5px;color:var(--ink-2);display:flex;justify-content:space-between}
.bar span{color:var(--brand);letter-spacing:1px}
.fb3{display:flex;gap:4px;margin-top:6px}.fb3 span{flex:1;text-align:center;border:1px solid var(--line);border-radius:8px;padding:4px 0;font-size:11px;background:var(--surface)}
.chip.x{border-color:var(--accent);color:var(--accent)}
.why{font-size:10.5px;color:var(--ok);margin-top:2px}
.g9{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:4px 0}
.g9 .th{width:100%;height:58px;outline:0}
.g9 .th.on{outline:3px solid var(--brand);outline-offset:-3px}
.g9.wide{grid-template-columns:repeat(9,1fr)}
.sub2{font-size:11px;color:var(--ink-3);border-top:1px dashed var(--line);margin-top:10px;padding-top:6px}
.trendbar{display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:11.5px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:6px 8px;margin-bottom:10px}
.trendbar b{color:var(--accent);margin-right:4px}
.trendbar span{background:var(--bg);border-radius:99px;padding:1px 8px}
.tr{display:flex;gap:8px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:6px 8px;margin-bottom:5px}
.tr>b{color:var(--accent);font-size:14px;width:14px}
.tr.on{border-color:var(--brand)}
.cm i{font-style:normal;font-size:9.5px;border:1px solid var(--line);border-radius:4px;padding:0 3px;color:var(--ink-3)}
/* 리저브 — 어두운 바탕 + 금색 (모드 전용 톤, 다크 모드와 무관하게 고정) */
.lux{--lx-bg:#15140f;--lx-ink:#f1ead8;--lx-dim:#a99f86;--lx-gold:#c9a45a;background:var(--lx-bg)!important;color:var(--lx-ink)}
.mode.lux,.mcard.lux{border-color:var(--lx-gold)!important}
.mode.lux b,.mcard.lux b{letter-spacing:2px;color:var(--lx-gold)}
.lux em{font-style:normal;color:var(--lx-ink);letter-spacing:0;margin-left:4px}
.lux small{color:var(--lx-dim)!important}
.lx-k{font-size:10px;letter-spacing:3px;color:var(--lx-gold)}
.lx-t{font-family:Georgia,"Times New Roman",serif;font-size:26px;color:var(--lx-ink)}
.lx-s{font-size:11px;color:var(--lx-dim);margin-bottom:12px;font-family:system-ui,sans-serif}
.lx-hero .th{width:100%;height:120px;border-radius:4px}
.lx-no{font-family:Georgia,serif;color:var(--lx-gold);font-size:12px;letter-spacing:1px;margin-top:8px}
.lx-vt{font-size:15px;font-weight:700;margin:2px 0 4px}
.lx-why{font-size:10.5px;color:var(--lx-gold)}
.lx-cm{font-size:11.5px;color:var(--lx-dim);margin-top:8px;font-style:italic}
.lx-sign{font-size:11px;color:var(--lx-gold);text-align:right;margin-top:4px}
.lx-dots{display:flex;gap:5px;justify-content:center;margin-top:14px}.lx-dots *{width:6px;height:6px;border-radius:50%;background:#4a4536}.lx-dots b{background:var(--lx-gold)}
.pc.lux .vc{background:#201e17;border-color:#3a3528}
.pc.lux .vt{color:var(--lx-ink)}.pc.lux .cm{color:var(--lx-dim)}
.pc.lux .card{background:#201e17}.pc.lux .ct{color:var(--lx-gold)}.pc.lux .bar{color:var(--lx-dim)}.pc.lux .bar span{color:var(--lx-gold)}
.pc.lux .panel{background:#201e17;border-color:#3a3528}.pc.lux .q2{color:var(--lx-dim)}
.pc.lux .tabs span{color:var(--lx-dim)}.pc.lux .tabs span.on{background:var(--lx-gold);color:#15140f}.pc.lux .brandbar{color:var(--lx-ink)}
.pc.lux .g9 .th.on{outline-color:var(--lx-gold)}
.onto .e{stroke:var(--ink-3);stroke-width:1.6}.onto .e.next{stroke:var(--brand);stroke-width:2.2}.onto .e.tr{stroke:var(--accent);stroke-dasharray:4 3}
.onto .ah{fill:var(--ink-3)}
.onto .el{font-size:11.5px;fill:var(--ink-2)}.onto .el.nx{fill:var(--brand);font-weight:700}.onto .el.trl{fill:var(--accent)}
.onto .lb{fill:var(--surface)}
.onto .n rect{fill:var(--surface);stroke:var(--line);stroke-width:1.5}.onto .n text{font-size:13px;fill:var(--ink);text-anchor:middle;font-weight:600}
.onto .n.me rect{fill:var(--brand);stroke:var(--brand)}.onto .n.me text{fill:#fff;font-weight:800}
.onto .n.sit rect{stroke:var(--ok);stroke-dasharray:5 3}.onto .n.hot rect{stroke:var(--accent)}
.onto .f rect{fill:var(--brand-soft)}.onto .f text{font-size:11px;fill:var(--brand);text-anchor:middle}
.onto .fl{font-size:11.5px;fill:var(--ink-3)}
/* PC 목업 */
.pcm{margin:22px 0}
.win{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--bg);margin-bottom:8px}
.win-bar{display:flex;align-items:center;gap:6px;background:var(--surface);border-bottom:1px solid var(--line);padding:7px 10px;font-size:11px;color:var(--ink-3)}
.win-bar i{width:9px;height:9px;border-radius:50%;background:var(--line);display:inline-block}
.win-bar .url{margin-left:10px;background:var(--bg);border-radius:6px;padding:1px 10px}
.pc{padding:14px 16px 16px;font-size:12.5px;line-height:1.45}
.pc .top{display:flex;align-items:center;gap:14px;margin-bottom:12px}
.pc .top .brandbar{margin:0}
.tabs span{display:inline-block;padding:4px 12px;border-radius:99px;font-size:12px;color:var(--ink-2)}
.tabs span.on{background:var(--brand);color:#fff}
.wcap{font-size:12px;color:var(--ink-3);text-align:center;margin:0 0 22px}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.split{display:grid;grid-template-columns:250px 1fr;gap:14px;align-items:start}
.split3{display:grid;grid-template-columns:1fr 230px;gap:14px;align-items:start}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.panel .q2:first-child{margin-top:0}
.cols{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.cols .panel div{padding:4px 8px;border-radius:7px;margin:1px 0}
.cols .panel div.on{background:var(--brand);color:#fff}
.cols .panel div.sub{color:var(--ink-3);font-size:11px;padding:0 0 4px}
.mcard{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 14px;font-size:14px}
.mcard small{display:block;color:var(--ink-3);font-size:12px;margin-top:3px}
.mcard.m3{background:var(--brand-soft);border-color:var(--brand)}
.strip{display:flex;gap:8px;margin-top:10px}
.strip .th{width:120px;height:68px}
.vc .th{width:100%;height:92px;margin-bottom:5px}
.vc{background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:6px}
.player{background:#11131a;border-radius:11px;height:190px;display:flex;align-items:center;justify-content:center;color:#cfd3e2;font-size:12px;margin-bottom:8px}
.queue div{display:flex;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid var(--line);font-size:11.5px}
.queue div.on{font-weight:700;color:var(--brand)}
.queue .th{width:56px;height:32px}
.keys{font-size:11px;color:var(--ink-3);margin-top:6px}
.keys b{border:1px solid var(--line);border-radius:4px;padding:0 4px;background:var(--surface);font-weight:600}
.ab2{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center}
.ab2 .ab .th.big1{height:150px}
.feat{display:grid;grid-template-columns:1.4fr 1fr;gap:10px}
.feat .th{width:100%;height:150px}
"""


def build(md: Path) -> Path:
    body = subprocess.run(["pandoc", "-f", "gfm", "-t", "html", str(md)],
                          check=True, capture_output=True, text=True).stdout
    for marker, name in (("<!-- MOCKUPS -->", "mockups_v0.2.html"),
                         ("<!-- PC_MOCKUPS -->", "pc_mockups_v0.2.html"),
                         ("<!-- DIAGRAM -->", "ontology_diagram.html")):
        mock = DOCS / name
        if marker in body and mock.exists():
            body = body.replace(marker, mock.read_text(encoding="utf-8"))
    title = md.read_text(encoding="utf-8").splitlines()[0].lstrip("# ").strip()
    out = md.with_suffix(".html")
    out.write_text(
        f'<!doctype html>\n<html lang="ko"><head><meta charset="utf-8">'
        f'<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<meta name="robots" content="noindex, nofollow"><title>{title}</title>'
        f'<style>{CSS}</style></head><body><main>\n{body}</main></body></html>\n',
        encoding="utf-8")
    return out


if __name__ == "__main__":
    for arg in sys.argv[1:] or sorted(str(p) for p in DOCS.glob("*_v0.*.md")):
        print(build(Path(arg)))
