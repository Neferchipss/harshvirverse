# harshvirverse

Portfolio site for Harshvir Wankhade — static, hosted on GitHub Pages. Placeholder design.

- `index.html`, `assets/` — the site. Everything it shows comes from `content/content.json`.
- `admin/` — content editor. Open `/admin/`, sign in with a fine-grained GitHub token
  (this repo only, **Contents: Read and write**), edit, then **Save & publish**. The site updates in ~1 minute.
  Uploaded images/videos go to `assets/uploads/`.

## Hero video
Set Landing → Background type to `video`. Cursor X scrubs the clip: left edge = first frame, right edge = last.
So the clip should be him turning from looking left to looking right, with no cuts. For smooth scrubbing, encode every frame as a keyframe:

```
ffmpeg -i in.mp4 -an -c:v libx264 -g 1 -crf 23 -pix_fmt yuv420p -movflags +faststart hero.mp4
```
