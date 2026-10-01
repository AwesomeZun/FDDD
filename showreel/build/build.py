"""Assemble the English FDDD showreel as one self-contained HTML file.

Embed subset WOFF2 fonts, gzip/base64 data, optional AAC audio, and JavaScript.
Usage: python3 build/build.py [--version 1.1.1] [--no-audio]
"""
import argparse
import base64
import io
import json
import os
import re

from fontTools import subset

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
SRC = os.path.join(ROOT, "src")
DATA = os.path.join(ROOT, "data")
DIST = os.path.join(ROOT, "dist")
FONTS = os.path.expanduser("~/Library/Fonts")


def b64(path):
    return base64.b64encode(open(path, "rb").read()).decode()


def subset_woff2(path, text):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    font = subset.load_font(path, opts)
    s = subset.Subsetter(opts)
    s.populate(text=text)
    s.subset(font)
    buf = io.BytesIO()
    subset.save_font(font, buf, opts)
    return base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="1.1.0")
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    tpl = open(os.path.join(SRC, "template.html"), encoding="utf-8").read()
    js = open(os.path.join(SRC, "reel.js"), encoding="utf-8").read()
    edl = open(os.path.join(SRC, "edl.json"), encoding="utf-8").read()
    mol = open(os.path.join(DATA, "molecules.json"), encoding="utf-8").read()

    # 화면에 나올 수 있는 모든 글자를 모아 서브셋을 만듭니다.
    ascii_all = "".join(chr(c) for c in range(32, 127))
    extra = "·×→−–—…ÅαβΔ°±≥≤%●▶❚←↗✓"
    chars = set(js + edl + tpl + ascii_all + extra)
    for m in json.loads(mol)["combinations"]:
        chars |= set(m["name"])
    text = "".join(sorted(c for c in chars if c >= " "))
    kr_b64, kr_n = subset_woff2(os.path.join(FONTS, "PretendardVariable.ttf"), text)
    mono_text = ascii_all + extra
    faces = [f'@font-face{{font-family:"PretendardV";src:url(data:font/woff2;base64,{kr_b64}) format("woff2");font-weight:45 930;font-display:block;}}']
    mono_sizes = 0
    for weight, name in [(500, "Medium"), (600, "SemiBold"), (700, "Bold")]:
        mb, mn = subset_woff2(os.path.join(FONTS, f"JetBrainsMonoNLNerdFontMono-{name}.ttf"), mono_text)
        mono_sizes += mn
        faces.append(f'@font-face{{font-family:"JBMono";src:url(data:font/woff2;base64,{mb}) format("woff2");font-weight:{weight};font-display:block;}}')
    print(f"fonts: Pretendard subset {kr_n/1024:.0f} KB ({len(text)} chars), mono {mono_sizes/1024:.0f} KB")

    blobs = []
    for bid, fn in [("d-atlas", "atlas.bin.gz"), ("d-hero", "spikes_hero.bin.gz"), ("d-tiles", "spikes_tiles.bin.gz"), ("d-edges", "edges.bin.gz"), ("d-fly", "fly.bin.gz")]:
        blobs.append(f'<script id="{bid}" type="application/octet-stream">{b64(os.path.join(DATA, fn))}</script>')
    blobs.append(f'<script id="d-meta" type="application/json">{open(os.path.join(DATA, "sim_meta.json"), encoding="utf-8").read()}</script>')
    blobs.append(f'<script id="d-mol" type="application/json">{mol}</script>')
    if not args.no_audio:
        for cut in ("15", "30"):
            p = os.path.join(DATA, f"audio_{cut}.m4a")
            if os.path.exists(p):
                blobs.append(f'<audio id="a{cut}" src="data:audio/mp4;base64,{b64(p)}"></audio>')
            else:
                print("Warning: audio file is missing:", p)

    html = tpl.replace("/*__FONTFACE__*/", "\n".join(faces))
    html = html.replace("<!--__DATA__-->", "\n".join(blobs))
    html = html.replace("/*__EDL__*/", "window.__EDL = " + json.dumps(json.loads(edl), ensure_ascii=False) + ";")
    html = html.replace("/*__JS__*/", js)
    os.makedirs(DIST, exist_ok=True)
    out = args.out or os.path.join(DIST, f"fddd-showreel-en-v{args.version}.html")
    open(out, "w", encoding="utf-8").write(html)
    print(f"built {out} ({os.path.getsize(out)/1024/1024:.2f} MB)")


if __name__ == "__main__":
    main()
