#!/usr/bin/env bash
# Build a hero rig frame set from hand-picked source frames, bridging cuts
# (e.g. blinks) with motion-interpolated in-betweens.
#
#   tools/rig-assemble.sh <clip.mp4> <folder-name> <height> <spec...>
#
# spec items:  A-B   keep source frames A..B (inclusive, 0-based at clip fps)
#              ~A-B  bridge from frame A to frame B with 3 interpolated frames
#                    (list them as ~76-85 between "60-76" and "85-105")
# Output: assets/hero/<folder-name>/f_NNN.webp (renumbered from 0)
set -euo pipefail
clip=$1; name=$2; height=$3; shift 3
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/assets/hero/$name"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp:?}"' EXIT
mkdir -p "$out" "$tmp/src" "$tmp/seq"
rm -f "${out:?}"/*.webp
ffmpeg -loglevel error -i "$clip" -vf "scale=-2:$height:flags=lanczos" -start_number 0 "$tmp/src/%04d.png"
k=0
put() { cp "$1" "$tmp/seq/$(printf %04d $k).png"; k=$((k+1)); }
for s in "$@"; do
  if [[ $s == ~* ]]; then
    a=${s#\~}; b=${a#*-}; a=${a%-*}
    mkdir -p "$tmp/g"; rm -f "$tmp"/g/*
    cp "$tmp/src/$(printf %04d $a).png" "$tmp/g/p1.png"
    cp "$tmp/src/$(printf %04d $b).png" "$tmp/g/p2.png"
    cp "$tmp/g/p2.png" "$tmp/g/p3.png"
    ffmpeg -loglevel error -framerate 1 -i "$tmp/g/p%d.png" \
      -vf "minterpolate=fps=8:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" -frames:v 9 "$tmp/g/i_%02d.png"
    for i in 03 05 07; do put "$tmp/g/i_$i.png"; done
  else
    a=${s%-*}; b=${s#*-}
    for ((i=a; i<=b; i++)); do put "$tmp/src/$(printf %04d $i).png"; done
  fi
done
ffmpeg -loglevel error -i "$tmp/seq/%04d.png" -c:v libwebp -quality 76 -start_number 0 "$out/f_%03d.webp"
echo "$k frames → assets/hero/$name"; du -sh "$out"
