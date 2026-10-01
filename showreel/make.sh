#!/usr/bin/env bash
# Build the English FDDD showreel: data → HTML → events → audio → MP4 + covers.
# Usage: FDDD_DIR=/path/to/FDDD ./make.sh 1.1.1 [data]
set -euo pipefail
cd "$(dirname "$0")"
VER="${1:-1.1.0}"
export FDDD_DIR="${FDDD_DIR:-$(cd .. && pwd)}"
if [[ "${2:-}" == "data" ]]; then
  node --max-old-space-size=8192 build/sim.mjs
  python3 build/prep.py
fi
mkdir -p build/.tmp
python3 build/build.py --no-audio --out build/.tmp/stage.html
python3 build/events.py build/.tmp/stage.html
python3 build/audio.py 30 15
python3 build/build.py --version "$VER"
python3 build/render.py "dist/fddd-showreel-en-v$VER.html" --version "$VER"
