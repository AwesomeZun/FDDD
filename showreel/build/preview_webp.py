"""Convert a rendered MP4 into a silent animated WebP for the README.

Uses FFmpeg for decoding and Pillow for WebP encoding, so FFmpeg does not
need the optional libwebp encoder. Existing previews are never overwritten.
"""
import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, default=960)
    parser.add_argument("--fps", type=int, default=20)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output exists; choose a new versioned filename.")
    if args.width < 2 or not 1 <= args.fps <= 60:
        parser.error("Width must be at least 2; fps must be between 1 and 60.")
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height", "-of", "json", str(args.video),
    ]))["streams"][0]
    height = max(2, round(args.width * probe["height"] / probe["width"] / 2) * 2)
    size = args.width * height * 3
    frames = []
    with subprocess.Popen([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(args.video),
        "-map", "0:v:0", "-vf", f"fps={args.fps},scale={args.width}:{height}:flags=lanczos",
        "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ], stdout=subprocess.PIPE) as decoder:
        while True:
            raw = decoder.stdout.read(size)
            if not raw:
                break
            if len(raw) != size:
                raise RuntimeError("Incomplete decoded frame")
            frames.append(Image.frombytes("RGB", (args.width, height), raw))
        if decoder.wait() != 0 or not frames:
            raise RuntimeError("FFmpeg could not decode the video")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("xb") as destination:
        frames[0].save(
            destination, format="WEBP", save_all=True, append_images=frames[1:],
            duration=1000 / args.fps, loop=0, quality=65, method=6,
        )
    print(f"Saved {len(frames)} frames at {args.fps} fps: {args.output}")


if __name__ == "__main__":
    main()
