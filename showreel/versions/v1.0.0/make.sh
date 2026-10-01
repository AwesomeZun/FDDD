#!/usr/bin/env bash
# FDDD 쇼릴 전체 빌드: 데이터 → HTML → 이벤트 → 음악 → 최종 HTML → MP4 + 썸네일
# 사용법: FDDD_DIR=/path/to/FDDD ./make.sh 1.0.0 [데이터 재생성 여부: data]
set -euo pipefail
cd "$(dirname "$0")"
VER="${1:-1.0.0}"
if [[ "${2:-}" == "data" ]]; then
  node --max-old-space-size=8192 build/sim.mjs
  python3 build/prep.py
fi
mkdir -p build/.tmp
python3 build/build.py --no-audio --out build/.tmp/stage.html
python3 build/events.py build/.tmp/stage.html
python3 build/audio.py 30 15
python3 build/build.py --version "$VER"
python3 build/render.py "dist/fddd-showreel-v$VER.html" --version "$VER"
