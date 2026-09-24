# Arcade posters

`assets/arcade/posters/cube.webp` and `chess.webp` are static 900 × 690 renders of the default scenes. The arcade index and game pages show them until the 3D view draws its first frame, and they serve as the fallback when WebGL is unavailable.

To regenerate them after changing the scenes:

1. Serve the site locally: `python -m http.server 8000 --bind 127.0.0.1`.
2. Open a Chromium browser with the window's viewport set to exactly 900 × 690 at a device pixel ratio of 1. In DevTools, device toolbar → Responsive → 900 × 690, DPR 1.
3. Visit `http://127.0.0.1:8000/arcade/?poster=cube`. Poster mode pins that scene to the top-left corner at poster size, without tilt or animation.
4. Wait for the scene to appear, then capture the viewport as WebP (quality about 82). In DevTools: Command menu → "Capture screenshot", then convert, or use the DevTools protocol's `Page.captureScreenshot` with `format: "webp"`.
5. Repeat with `?poster=chess`, after the board coordinates have drawn.
6. Save the files over the existing ones and bump `CACHE` in `sw.js` so returning visitors get the new images.
