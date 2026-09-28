#!/usr/bin/env bash
# Cut the hero "rig" clip into frames for the landing page.
#
#   tools/rig-frames.sh <clip.mp4> [fps=15]
#
# Output: assets/hero/rig/f_NNN.webp — then in content.json set
#   "hero": { "mediaType": "rig", "rig": {
#     "path": "assets/hero/rig/", "frames": <count>, "fps": <fps>,
#     "columns": [[topSec, bottomSec], ...]   // where each column's up→down sweep sits in the clip
#   } }
set -euo pipefail
clip=$1; fps=${2:-15}
out="$(dirname "$0")/../assets/hero/rig"
mkdir -p "$out"
rm -f "$out"/*.webp
ffmpeg -loglevel error -i "$clip" -vf "fps=$fps,scale=1280:-2" -c:v libwebp -quality 76 -start_number 0 "$out/f_%03d.webp"
echo "$(ls "$out"/f_*.webp | wc -l) frames at ${fps}fps"
du -sh "$out"
