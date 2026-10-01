"""HTML 쇼릴을 60fps 프레임 단위로 렌더해 MP4를 만들고, 썸네일(커버·공유용)을 함께 넣습니다.

순서: 여러 페이지가 프레임을 나눠 렌더 → 순서대로 ffmpeg(H.264)에 파이프 → 음량 정규화한 음악과 합치기
     → 커버 이미지를 attached_pic(covr)으로 삽입 → faststart.
사용법: python3 build/render.py dist/fddd-showreel-v1.0.0.html --version 1.0.0 [--cuts 30,15] [--pages 4]
"""
import argparse
import asyncio
import base64
import json
import os
import subprocess
import time

from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
DATA = os.path.join(ROOT, "data")
DIST = os.path.join(ROOT, "dist")
ARGS = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"]


def run(cmd, **kw):
    print("$", " ".join(cmd)[:220])
    return subprocess.run(cmd, check=True, **kw)


async def open_page(browser, html, cut, w=1920, h=1080):
    pg = await browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
    await pg.goto("file://" + os.path.abspath(html) + f"?render&cut={cut}")
    await pg.wait_for_function("window.__ready === true || window.__error", timeout=90000)
    err = await pg.evaluate("window.__error || null")
    if err:
        raise RuntimeError(err)
    cdp = await pg.context.new_cdp_session(pg)
    return pg, cdp


async def shot(cdp, w=1920, h=1080):
    r = await cdp.send("Page.captureScreenshot", {"format": "png", "clip": {"x": 0, "y": 0, "width": w, "height": h, "scale": 1}, "optimizeForSpeed": True})
    return base64.b64decode(r["data"])


async def render_video(html, cut, out_path, pages=4, fps=60):
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=ARGS)
        workers = [await open_page(browser, html, cut) for _ in range(pages)]
        dur = await workers[0][0].evaluate(f"REEL.duration({cut})")
        n = int(round(dur * fps))
        ff = await asyncio.create_subprocess_exec(
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "image2pipe", "-framerate", str(fps), "-c:v", "png", "-i", "-",
            "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
            "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-maxrate", "30M", "-bufsize", "60M", "-profile:v", "high", "-level:v", "4.2",
            "-g", str(fps * 2), "-bf", "3", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-color_range", "tv", "-movflags", "+faststart", "-an", out_path,
            stdin=asyncio.subprocess.PIPE)
        frames = {}
        cond = asyncio.Condition()
        t_start = time.time()

        async def worker(k):
            pg, cdp = workers[k]
            for i in range(k, n, pages):
                # 버퍼가 너무 앞서 나가지 않도록 기다립니다.
                async with cond:
                    await cond.wait_for(lambda: i - next_i[0] < pages * 6)
                await pg.evaluate(f"REEL.render({i / fps}, {cut})")
                data = await shot(cdp)
                async with cond:
                    frames[i] = data
                    cond.notify_all()

        next_i = [0]

        async def writer():
            while next_i[0] < n:
                async with cond:
                    await cond.wait_for(lambda: next_i[0] in frames)
                    data = frames.pop(next_i[0])
                ff.stdin.write(data)
                await ff.stdin.drain()
                async with cond:
                    next_i[0] += 1
                    cond.notify_all()
                if next_i[0] % 120 == 0:
                    el = time.time() - t_start
                    print(f"  {cut}s: {next_i[0]}/{n} frames, {el:.0f}s elapsed, eta {el / next_i[0] * (n - next_i[0]):.0f}s", flush=True)

        await asyncio.gather(writer(), *[worker(k) for k in range(pages)])
        ff.stdin.close()
        await ff.wait()
        await browser.close()
        print(f"  video done: {out_path} ({n} frames, {time.time() - t_start:.0f}s)")
        return dur


async def render_stills(html, version):
    """썸네일: 커버(1920×1080, 재생 표시+길이), 공유 카드(1200×630)."""
    os.makedirs(os.path.join(DIST, "thumbnails"), exist_ok=True)
    outs = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=ARGS)
        specs = [
            ("cover", 30, 1920, 1080), ("cover", 15, 1920, 1080),
            ("og", 30, 1200, 630), ("og", 15, 1200, 630),
        ]
        for variant, cut, w, h in specs:
            pg, cdp = await open_page(browser, html, cut, w, h)
            await pg.evaluate(f"REEL.poster({{w:{w}, h:{h}, variant:'{variant}', cut:{cut}, t:0}})")
            png = await shot(cdp, w, h)
            name = f"fddd-showreel-{cut}s-{'cover' if variant == 'cover' else 'share'}-{w}x{h}-v{version}"
            png_path = os.path.join(DIST, "thumbnails", name + ".png")
            open(png_path, "wb").write(png)
            jpg_path = os.path.join(DIST, "thumbnails", name + ".jpg")
            run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", png_path, "-q:v", "2", jpg_path])
            outs[(variant, cut)] = jpg_path
            await pg.close()
        await browser.close()
    return outs


def loudnorm(src, dst, target=-14.0, tp=-2.0):
    """2패스 EBU R128 정규화."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", f"loudnorm=I={target}:TP={tp}:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1]
    m = json.loads(txt)
    af = (f"loudnorm=I={target}:TP={tp}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000")
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-af", af, "-c:a", "pcm_s24le", dst])
    return m


def mux(video, audio, cover, out, cut, version, dur):
    title = f"FDDD 모션 쇼릴 · {cut}초 편집본"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-i", video, "-i", audio, "-i", cover,
         "-map", "0:v", "-map", "1:a", "-map", "2:v",
         "-c:v:0", "copy", "-bsf:v:0", "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0",
         # ffmpeg 내장 AAC는 트랜지언트에서 +4.7 dB 오버슈트(클릭)를 만들어 Apple AAC(AudioToolbox) VBR 최고 품질을 씁니다.
         "-c:a", "aac_at", "-aac_at_mode", "vbr", "-q:a", "0", "-ar", "48000",
         "-c:v:1", "mjpeg", "-disposition:v:1", "attached_pic",
         "-metadata", f"title={title}",
         "-metadata", "artist=FDDD · flybrain.kr",
         "-metadata", "album=FDDD Fly-Driven Drug Development",
         "-metadata", f"comment=초파리 뇌가 이끄는 신약 개발 · flybrain.kr · github.com/AwesomeZun/FDDD · v{version}",
         "-metadata", "description=MaleCNS v1.0 커넥톰 실제 스파이크, AutoDock Vina 실제 도킹 점수로 만든 모션 그래픽 쇼릴입니다.",
         "-metadata", "date=2026",
         "-t", f"{dur:.3f}", "-movflags", "+faststart", out])


def share_encode(video, audio, cover, out, cut, version, dur):
    """메신저 공유용 경량본(약 10 Mbps). 마스터와 같은 프레임·음악·커버를 씁니다."""
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-i", video, "-i", audio, "-i", cover,
         "-map", "0:v", "-map", "1:a", "-map", "2:v",
         "-c:v:0", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", "10M", "-bufsize", "20M",
         "-profile:v:0", "high", "-level:v:0", "4.2", "-pix_fmt:v:0", "yuv420p", "-g", "120",
         "-colorspace:v:0", "bt709", "-color_primaries:v:0", "bt709", "-color_trc:v:0", "bt709", "-color_range:v:0", "tv",
         "-c:a", "aac_at", "-b:a", "192k", "-ar", "48000",
         "-c:v:1", "mjpeg", "-disposition:v:1", "attached_pic",
         "-metadata", f"title=FDDD 모션 쇼릴 · {cut}초 편집본 (공유용)",
         "-metadata", "artist=FDDD · flybrain.kr",
         "-metadata", f"comment=초파리 뇌가 이끄는 신약 개발 · flybrain.kr · github.com/AwesomeZun/FDDD · v{version}",
         "-t", f"{dur:.3f}", "-movflags", "+faststart", out])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("--version", default="1.0.0")
    ap.add_argument("--cuts", default="30,15")
    ap.add_argument("--pages", type=int, default=4)
    ap.add_argument("--skip-video", action="store_true")
    a = ap.parse_args()
    tmp = os.path.join(ROOT, "build", ".tmp")
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(DIST, exist_ok=True)
    stills = asyncio.run(render_stills(a.html, a.version))
    print("stills:", stills)
    for cut in [int(c) for c in a.cuts.split(",")]:
        vid = os.path.join(tmp, f"video_{cut}.mp4")
        if not a.skip_video:
            asyncio.run(render_video(a.html, cut, vid, pages=a.pages))
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", vid], capture_output=True, text=True).stdout.strip())
        norm = os.path.join(tmp, f"audio_{cut}_norm.wav")
        m = loudnorm(os.path.join(DATA, f"audio_{cut}.wav"), norm)
        print(f"  loudness in {m['input_i']} LUFS → -14")
        out = os.path.join(DIST, f"fddd-showreel-{cut}s-ko-v{a.version}.mp4")
        mux(vid, norm, stills[("cover", cut)], out, cut, a.version, dur)
        print("  →", out, f"{os.path.getsize(out) / 1e6:.1f} MB")
        share = os.path.join(DIST, f"fddd-showreel-{cut}s-ko-share-v{a.version}.mp4")
        share_encode(vid, norm, stills[("cover", cut)], share, cut, a.version, dur)
        print("  →", share, f"{os.path.getsize(share) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
