"""빌드한 HTML에서 장면·효과음 이벤트를 뽑아 data/events_{15,30}.json으로 저장합니다.

영상과 음악이 같은 이벤트 목록을 쓰므로 박자·컷·임팩트가 프레임 단위로 맞습니다.
사용법: python3 build/events.py dist/파일.html
"""
import asyncio
import json
import os
import sys

from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")


async def main(html):
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 1920, "height": 1080})
        await pg.goto("file://" + os.path.abspath(html) + "?render")
        await pg.wait_for_function("window.__ready === true", timeout=60000)
        for cut in (15, 30):
            ev = await pg.evaluate(f"REEL.events({cut})")
            path = os.path.join(DATA, f"events_{cut}.json")
            json.dump(ev, open(path, "w"), ensure_ascii=False, indent=1)
            print(cut, "events", len(ev["events"]), "dur", ev["dur"], "->", path)
        await b.close()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
