"""지정한 시각의 프레임을 PNG로 뽑고 접촉 인화(contact sheet)를 만듭니다.

사용법: python3 build/preview.py dist/파일.html --cut 30 --times 0,0.5,1.2 --out /tmp/sheet.png [--cols 3] [--scale 0.5]
"""
import argparse
import asyncio
import os
import time

from PIL import Image
from playwright.async_api import async_playwright

ARGS = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-background-timer-throttling"]


async def run(a):
    times = [float(x) for x in a.times.split(",")] if a.times else []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        pg = await b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        logs = []
        pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
        await pg.goto("file://" + os.path.abspath(a.html) + f"?render&cut={a.cut}")
        try:
            await pg.wait_for_function("window.__ready === true || window.__error", timeout=60000)
        except Exception:
            pass
        err = await pg.evaluate("window.__error || null")
        if err:
            print("ERROR:", err)
        for l in logs[-20:]:
            print(l)
        if err:
            await b.close()
            return
        frames = []
        for t in times:
            t0 = time.time()
            await pg.evaluate(f"REEL.render({t}, {a.cut})")
            t1 = time.time()
            path = os.path.join(a.dir, f"f_{a.cut}_{t:07.3f}.png")
            await pg.screenshot(path=path, clip={"x": 0, "y": 0, "width": 1920, "height": 1080})
            frames.append(path)
            print(f"t={t:.3f} render {1000*(t1-t0):.0f} ms, total {1000*(time.time()-t0):.0f} ms")
        for l in logs[-10:]:
            print(l)
        await b.close()
    if frames and a.out:
        cols = a.cols
        tw, th = int(1920 * a.scale), int(1080 * a.scale)
        rows = (len(frames) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tw + (cols - 1) * 6, rows * th + (rows - 1) * 6), (40, 40, 40))
        for i, f in enumerate(frames):
            im = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
            sheet.paste(im, ((i % cols) * (tw + 6), (i // cols) * (th + 6)))
        sheet.save(a.out)
        print("sheet", a.out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("--cut", type=int, default=30)
    ap.add_argument("--times", default="")
    ap.add_argument("--out", default="")
    ap.add_argument("--dir", default="/tmp")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--scale", type=float, default=0.5)
    a = ap.parse_args()
    os.makedirs(a.dir, exist_ok=True)
    asyncio.run(run(a))
