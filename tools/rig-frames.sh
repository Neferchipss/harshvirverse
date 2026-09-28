#!/usr/bin/env bash
# Cut the hero "rig" clip into frames for the landing page.
#
#   tools/rig-frames.sh <clip.mp4> <folder-name> [fps=15]
#
# Use a NEW folder name for every new clip (sweep-2, sweep-3, ...): browsers
# cache frames for ~10 min, and reusing file names would mix two clips.
#
# Output: assets/hero/<folder-name>/f_NNN.webp — then in content.json set
#   "hero": { "mediaType": "rig", "rig": {
#     "path": "assets/hero/<folder-name>/", "frames": <count>, "fps": <fps>,
#     "sweep": [leftSec, rightSec]   // where the left → right turn sits in the clip
#   } }
set -euo pipefail
clip=$1; name=$2; fps=${3:-15}
out="$(dirname "$0")/../assets/hero/$name"
mkdir -p "$out"
rm -f "$out"/*.webp
ffmpeg -loglevel error -i "$clip" -vf "fps=$fps,scale=1280:-2" -c:v libwebp -quality 76 -start_number 0 "$out/f_%03d.webp"
echo "$(ls "$out"/f_*.webp | wc -l) frames at ${fps}fps"
du -sh "$out"
