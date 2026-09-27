#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="${1:-$HERE/cache}"
mkdir -p "$CACHE"
curl -L --fail --retry 2 https://ndownloader.figshare.com/files/35948138 -o "$CACHE/dockstring-dataset.tsv"
curl -L --fail --retry 2 https://ndownloader.figshare.com/files/35948123 -o "$CACHE/cluster_split.tsv"
node "$HERE/build.mjs" --cache "$CACHE"
