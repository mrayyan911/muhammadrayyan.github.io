# Arcade: design and implementation plan

Two playable 3D games, a Rubik's cube and chess against a bot, on a new `/arcade/` section of rayyandev.tech. Built with Three.js, keeping the site's paper, ink, and vermilion look and its no-build static setup.

Reference studied: jerrychendesigns.framer.website/arcade. Here is what it does and how each part carries over:

| Reference does | We do |
| --- | --- |
| An arcade index with a short headline and one-line subtitle | Same structure, written in this site's type and voice |
| Each game shown as a framed "machine" illustration card | Each game sits on a tinted panel, tilted like the site's project covers, straightening on hover |
| The preview is the machine itself, so the game is visible before you click | The preview is the real 3D scene in "attract mode": the cube turns itself and the board replays a famous game |
| Cards link to one page per game (`/jerryman`, `/scratch`) | `/arcade/cube/` and `/arcade/chess/` |
| The game page has a title, a one-line instruction, and the game centred inside its machine | Title, one-line instruction, a stage panel for the game, and a controls panel |
| A "More coming soon… have an idea? email me" line | "More games are on the way. Have an idea for one? Write me a note" |
| The same header and footer as the rest of the site | The site header (with a new Arcade link) and the site footer |
| Hand-drawn, playful, low-chrome | Playful through motion and material rather than doodles. The drawing style belongs to Jerry; the tilted paper panels belong to this site. |

---

## 1. Design direction

### Principles

1. **The game is the hero.** On the arcade page, the previews are live scenes. On a game page, the stage is the largest thing on screen and the controls stay quiet.
2. **Printed in the site's inks.** The cube and chess set use the site palette, so they look like they belong to this portfolio rather than looking like stock 3D assets.
3. **One orchestrated moment.** Clicking a card morphs the preview into the game stage with a cross-document View Transition. The pages don't use any other entrance animation.
4. **Motion answers the player.** Layers follow your finger and snap into place. Pieces lift when picked up and hop when they move. Nothing moves by itself on a game page.
5. **Draw only when something changes.** Scenes render on demand, never in a constant loop.

### Palette (existing tokens plus game inks)

| Token | Hex | Use |
| --- | --- | --- |
| `--paper` | `#f3f0e9` | Page, white cube face, ivory pieces (tinted to `#ece6d8`) |
| `--ink` | `#25251f` | Text, cubie bodies, dark pieces (`#2c2b25`) |
| `--muted` | `#68685f` | Secondary copy |
| `--line` | `#cccac1` | Hairlines |
| `--red` | `#b93422` | Accent, red cube face, selection, legal-move dots, check |
| `--cube-panel` | `#d9dee0` | Cube preview/stage panel (a cool grey, new) |
| `--chess-panel` | `#e3dccf` | Chess preview/stage panel (warm stone, new) |

Cube sticker inks are muted to match the site but kept distinguishable from each other:

| Face | Hex |
| --- | --- |
| U white | `#f3f0e9` |
| D yellow | `#e3be45` |
| F green | `#4f7a52` |
| B blue | `#2f5d8a` |
| R red | `#b93422` |
| L orange | `#e0843a` |

Chess board: light squares `#e9e3d6`, dark squares `#bdb4a1`, frame `#d3cbbb`. The last move is tinted ochre (`#e3be45` at 45%), selection and legal moves use vermilion, and a king in check sits on a vermilion square.

**Contrast checks before shipping:** orange against red and yellow against white must read as different colours under the scene lighting. Verify this in a screenshot at 360 px, and under a colour-blindness simulation in Chrome's rendering panel. The optional "Show face letters" toggle covers what the colours alone can't.

### Type (existing families, no additions)

- DM Sans 550–650, tight tracking: page titles (`h1` uses the site's `h2` scale on game pages) and card titles.
- Instrument Serif italic: one phrase in the arcade statement, matching the site's existing pattern.
- DM Mono 11 px: toplines, timer digits (tabular), move lists, keyboard hints, scramble notation. On this site, monospace is the language of the machine, so it's used for real data here.
- Space Grotesk: move numbers in the chess move list (a real sequence, so numbering is justified).

### Layout wireframes

**Arcade index, desktop (≥1000 px)**, reusing `.wrap`, `.site-header`, and the `.project-pair` grid:

```
rayyan.   A portfolio of…                  Work 03   Arcade   About   Let’s talk
────────────────────────────────────────────────────────────────────────────────
ARCADE / TWO GAMES                                             Lahore, Pakistan
Arcade.                                        (giant, h1 scale like hero name)
Two small 3D games,                 A Rubik’s cube and a chess board, rendered
built between commits. (serif)      in your browser with Three.js. Pick one.
────────────────────────────────────────────────────────────────────────────────
┌───────────────────────────────┐   ┌───────────────────────────────┐
│ RUBIK’S CUBE / 3 × 3 PUZZLE   │   │ CHESS / YOU AGAINST A BOT     │
│                               │   │                               │
│        [ live cube ]          │   │      [ live board, angled ]   │  offset
│   tilted −3°, flat on hover   │   │                               │  down 95px
│ DRAG A LAYER TO TURN IT  Play │   │ REPLAYING THE OPERA GAME  Play│  (.project-offset)
└───────────────────────────────┘   └───────────────────────────────┘
Rubik’s cube                        Chess
Scramble it, then solve it…         Play white or black against…
THREE.JS / INSTANCED RENDERING      THREE.JS / WEB WORKER SEARCH
Best time 1:12.40 (if stored)       Game in progress: resume (if stored)
────────────────────────────────────────────────────────────────────────────────
More games are on the way. Have an idea for one? Write me a note
footer
```

**Arcade index, mobile (<700 px):** the cards stack in a single column, the offset is removed, and each preview uses `aspect-ratio: 1` at full width. The headline drops to 15.4vw, like the site hero.

**Game page, desktop:**

```
header
← All games                                                         (text-link)
Rubik’s cube.                                     Scramble it, then bring every
                                                  face back to one colour.
┌──────────────────────────────────────────────────┐ ┌──────────────────────┐
│                                                  │ │ TIME        1:02.33  │
│                                                  │ │ MOVES            41  │
│               stage (canvas)                     │ │ BEST        0:58.10  │
│      min(72svh, 760px) tall, tinted panel        │ │──────────────────────│
│                                                  │ │ [ Scramble ]         │
│                                                  │ │ Undo   Reset cube    │
│ status line (mono, aria-live)                    │ │──────────────────────│
└──────────────────────────────────────────────────┘ │ Scramble  R U2 F’ …  │
DRAG A STICKER TO TURN ITS LAYER / DRAG THE          │ + Keyboard controls  │
BACKGROUND TO ROTATE / U D L R F B, SHIFT FOR PRIME  └──────────────────────┘
footer
```

Grid: `grid-template-columns: minmax(0, 1fr) 320px; gap: 45px`. Left aligned, like the rest of the site. The panel is `position: sticky; top: 30px`.

**Game page, mobile:** the stage runs full bleed (`margin-inline: calc(var(--gutter) * -1)`) with `height: min(100vw, 62svh)`. Directly under it, a sticky bottom action bar holds the three primary buttons at a 48 px minimum height. Stats sit in a row of three above the bar. Secondary content (scramble, move list, keyboard help) lives in `<details>` below.

```
header
← All games
Chess.
Play against a bot.
┌─────────────────────┐
│   board (square)    │  full bleed
└─────────────────────┘
Your move.     +2 ♟♟
[ Undo ] [ New game ] [ ⋯ ]   ← sticky bottom bar
+ Moves (12)
+ Level and side
```

### Plan review against the brief (what I changed and why)

- First draft: a dark "arcade cabinet" page with neon accents. **Cut.** It ignores the site and it's the generic arcade look. The panels and paper keep it on-brand.
- First draft: standard bright Rubik's colours. **Changed** to the site inks above. Saturated primaries on this paper would look like a stock asset.
- First draft: numbered cards "01 / 02". **Cut.** Two games aren't a sequence. The toplines name the game instead.
- First draft: a GLTF chess set download. **Changed** to procedural lathe geometry. It weighs about 3 KB instead of 1–3 MB, and it matches the flat, printed material.
- First draft: fade-up reveals on the cards. **Cut** in favour of a single View Transition morph into the game.

---

## 2. Architecture

### No build step, native ES modules

The README promises no framework, package manager, or build step. Keep that promise:

- Vendor pinned libraries into `assets/vendor/` and load them with an import map. Self-hosting them avoids a third-party request at play time and lets the service worker cache them as immutable files.
- Every page includes the same import map:

```html
<script type="importmap">
{
  "imports": {
    "three": "/assets/vendor/three@0.186.0/three.module.min.js",
    "three/addons/": "/assets/vendor/three@0.186.0/addons/",
    "chess.js": "/assets/vendor/chess.js@1.4.0/chess.js"
  }
}
</script>
<link rel="modulepreload" href="/assets/vendor/three@0.186.0/three.module.min.js" />
<link rel="modulepreload" href="/assets/vendor/three@0.186.0/three.core.min.js" />
```

Since r171, `three.module.min.js` imports `three.core.min.js` relatively, so vendor both files. Verify this against the downloaded 0.186.0 package.

The addons needed are `controls/OrbitControls.js`, `geometries/RoundedBoxGeometry.js`, `environments/RoomEnvironment.js`, and `utils/BufferGeometryUtils.js`. Copy only those four files, rewriting their `from 'three'` imports to nothing (the import map resolves `three`).

Add `scripts/vendor_libs.py`, standard library only like the other scripts. It downloads the npm tarballs (`https://registry.npmjs.org/three/-/three-0.186.0.tgz`, `chess.js-1.4.0.tgz`) and copies out just the needed files. This makes upgrades one command.

### File structure

```
arcade/
  index.html                     arcade listing
  cube/index.html                Rubik’s cube page
  chess/index.html               chess page
assets/
  arcade/
    arcade.css                   arcade + game page styles (imports nothing; loaded after portfolio.css)
    posters/cube.webp            static preview posters (≈ 25 KB each, 900×690)
    posters/chess.webp
    core/stage.js                renderer, sizing, DPR, on-demand loop, visibility, context loss, dispose
    core/tween.js                tiny tween/spring manager driven by the stage loop
    core/storage.js              try/catch-wrapped localStorage helpers
    core/sound.js                optional synthesized ticks (WebAudio, off by default)
    core/support.js              WebGL + capability checks, quality tier
    cube/model.js                pure logic: cubies, moves, notation, scramble, solved check (no three import)
    cube/view.js                 instanced meshes, layer animation
    cube/input.js                pointer/keyboard → moves and orbit
    cube/page.js                 UI wiring, timer, best time, states
    chess/pieces.js              procedural piece geometries
    chess/view.js                board, instanced pieces, markers, animations
    chess/input.js               raycast-to-square, drag, keyboard cursor
    chess/engine.worker.js       bot search (module worker)
    chess/book.js                tiny opening book
    chess/page.js                game flow, UI, persistence
    preview.js                   attract-mode previews on the arcade index
  vendor/
    three@0.186.0/…
    chess.js@1.4.0/chess.js
scripts/vendor_libs.py
scripts/capture_posters.md       how to regenerate posters (see §6)
tests/
  cube-model.test.mjs            node --test
  chess-engine.test.mjs
```

### Shared stage (`core/stage.js`)

```js
export function createStage(canvas, { onRender, quality }) → {
  renderer, scene, camera,
  invalidate(),        // request one frame
  animate(fn),         // register per-frame fn; frames continue while any fn returns true
  resize(), dispose()
}
```

- `new WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' })`. With `alpha: true`, the CSS panel colour shows through, so no clear colour needs syncing.
- `renderer.outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping` at exposure 1.0. Check that the stickers still match the hex values after tone mapping. If they drift, use `NeutralToneMapping`.
- **Render on demand:** each `invalidate()` schedules at most one `requestAnimationFrame`. The loop only runs while tweens, drags, damping, or animations are active, so an idle stage costs no GPU time.
- **DPR:** `setPixelRatio(Math.min(devicePixelRatio, quality.maxDpr))`, with `maxDpr` 2 on high tier and 1.5 on low. Adaptive quality: track a rolling average frame time over 30 active frames. Above 22 ms, step DPR down by 0.25 (never below 1). Below 12 ms for 120 frames, step back up.
- **Size:** a `ResizeObserver` on the canvas parent sets the renderer size (with `updateStyle` false) and updates the camera aspect, then calls invalidate.
- **Visibility:** on `visibilitychange` when hidden, cancel the rAF and pause tweens. An `IntersectionObserver` does the same when the stage scrolls off screen.
- **Context loss:** on `webglcontextlost`, call `preventDefault()`, show the poster with the message "The 3D view stopped. Reload the game", and add a button. On `webglcontextrestored`, rebuild.
- **Dispose:** on `pagehide` (without `persisted`), dispose geometries, materials, textures, and the renderer.
- **Lighting:** one `PMREMGenerator.fromScene(new RoomEnvironment())` as `scene.environment` on high tier, generated once and disposed after. Low tier uses a `HemisphereLight` plus one `DirectionalLight` with `MeshLambertMaterial`.
- **No shadow maps.** Contact shadows come from a single plane with a radial-gradient `CanvasTexture` (generated at runtime at 128 px). Chess pieces get instanced blob shadows.

### Capability tiers (`core/support.js`)

```
webgl = !!canvas.getContext('webgl2')                       // WebGL2 required
lowTier = navigator.hardwareConcurrency <= 4
       || navigator.deviceMemory <= 4
       || matchMedia('(pointer: coarse)').matches && screen.width < 400
reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
saveData = navigator.connection?.saveData
```

- Without WebGL2, the stage keeps its poster and shows: "This game needs WebGL, which your browser has turned off or doesn’t support. Try another browser, or go back to the arcade." Include a back link.
- `<noscript>` shows: "This game needs JavaScript to run."

### Service worker

- Bump `CACHE` to `rayyan-portfolio-v10`.
- Extend the fetch filter to cache `assets/vendor/**` (`.js`) cache-first. The paths are versioned, so they're immutable.
- `assets/arcade/**` JavaScript and CSS stay network-first, like the site's other code, so edits show up without a cache bump.
- Posters (`.webp`) are already covered by the image rule.

### Performance budgets

| Metric | Target |
| --- | --- |
| Arcade index JS before interaction | 0 KB of three (posters only). Previews are lazy. |
| Arcade index LCP | Under 1.8 s on Fast 4G (the poster or headline is the LCP) |
| Game page transfer, gzip | three ≈ 170 KB, app ≈ 25 KB, chess.js ≈ 15 KB |
| Time to first 3D frame | Under 1.5 s on Fast 4G, mid-tier Android |
| Frame rate while interacting | 60 fps on a mid-tier Android, a 2019 MacBook Air, and an iPhone 12 |
| Draw calls | Cube 3, chess ≤ 12 |
| Idle GPU | 0 frames/s when nothing is changing |
| Lighthouse (arcade index) | Performance ≥ 95, accessibility 100 |

---

## 3. Arcade index (`/arcade/`)

### Markup

Copy the site header and footer from `index.html` with a few changes:

- Links point to `/#projects`, `/#about`, and `/#contact`.
- Add `<a href="/arcade/" aria-current="page">Arcade</a>` to the nav. Also add this link on the homepage nav and in its footer links.
- Keep the skip link.

```html
<main id="main">
  <section class="arcade-hero wrap" aria-labelledby="arcade-title">
    <div class="hero-topline mono"><span>Arcade / Two games</span><span>Lahore, Pakistan</span></div>
    <h1 id="arcade-title">Arcade<span class="accent">.</span></h1>
    <div class="hero-bottom">
      <p class="hero-statement">Two small 3D games,<br><em>built between commits.</em></p>
      <div class="hero-intro"><p>A Rubik’s cube and a chess board, rendered in your browser with Three.js. Pick one and play.</p></div>
    </div>
  </section>

  <section class="arcade-games wrap section-space" aria-label="Games">
    <div class="project-pair">
      <article class="project game-card" data-game="cube">
        <a class="project-visual game-visual cube-visual" href="/arcade/cube/"
           aria-label="Play Rubik’s cube">
          <div class="visual-topline mono"><span>Rubik’s cube / 3 × 3 puzzle</span></div>
          <div class="game-stage-preview">
            <img src="/assets/arcade/posters/cube.webp" width="900" height="690"
                 alt="" loading="eager" decoding="async">
            <!-- preview.js inserts <canvas aria-hidden="true"> here -->
          </div>
          <div class="visual-bottomline mono">
            <span>Drag a layer to turn it</span><span class="visual-action">Play</span>
          </div>
        </a>
        <div class="project-info">…h3 "Rubik’s cube", copy, stack, stored best time…</div>
      </article>
      <article class="project project-offset game-card" data-game="chess">…</article>
    </div>
    <p class="arcade-more">More games are on the way. Have an idea for one?
      <a class="text-link" href="mailto:rayyan.scale@gmail.com?subject=Arcade%20idea">Write me a note</a></p>
  </section>
</main>
```

The whole preview is one link, as with the site's project visuals. The canvas uses `pointer-events: none`, so clicks and focus stay on the `<a>`.

### Card behaviour

- `.game-stage-preview` gets `aspect-ratio: 1.3` (1 on mobile) and `transform: rotate(-3deg)` (cube) or `rotate(2deg)` (chess), with a `transition: transform .35s`. On `:hover`/`:focus-visible` it goes to `rotate(0)`. This mirrors `.browser-frame`.
- Panel shadow: `0 15px 30px #25251f1f`. Radius 0, matching the site panels.
- Under the info block, show a per-device line from storage when present: "Best time 1:12.40" for the cube, and "Game in progress. Resume it" for chess (a text-link to `/arcade/chess/`).

### Attract mode (`preview.js`)

**Load strategy**

1. HTML shows the posters, so there's no layout shift and it works without JS.
2. After `load`, run `requestIdleCallback` (falling back to `setTimeout(…, 1200)`). If WebGL2 is available and the visitor has neither reduced motion nor Save-Data, attach an `IntersectionObserver` (`rootMargin: 200px`) to each card.
3. When the first card intersects, `import('/assets/arcade/preview.js')`, which pulls in three and the game view modules. Nothing loads for visitors who never scroll near the cards.
4. Create a small stage per card (two WebGL contexts is fine). Render the first frame, then crossfade the canvas in over the poster (`opacity` 0 to 1, 250 ms). The poster stays underneath as the fallback.

**Cube preview**

- Idle: a slow Y rotation at 8°/s, but only while the card is on screen. This is the page's only non-user motion, and it stops under reduced motion.
- Hover or focus: play a 6-move random scramble at 160 ms per move, pause 600 ms, then play the inverse back to solved. Loop while hovered. On leave, finish the current move and settle at solved.

**Chess preview**

- Static angled board in the starting position.
- Hover or focus: replay Morphy's Opera Game (Paris, 1858), 17 moves ending in mate, at 700 ms per move with the full move animation. The bottomline reads "Replaying the Opera Game, 1858". After mate, hold 1.5 s, then reset.

  PGN: `1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#`

**Budget:** each preview renders at a max DPR of 1.5 and a canvas size equal to its box. When neither card is hovered, the frame loop only runs the idle cube spin, throttled to 30 fps.

### View Transition into the game

In `arcade.css` (the index and the game pages both load it):

```css
@view-transition { navigation: auto; }
.cube-visual .game-stage-preview, .cube-page .stage { view-transition-name: cube-stage; }
.chess-visual .game-stage-preview, .chess-page .stage { view-transition-name: chess-stage; }
::view-transition-group(*) { animation-duration: 420ms; animation-timing-function: cubic-bezier(.2,.7,.2,1); }
@media (prefers-reduced-motion: reduce) { @view-transition { navigation: none; } }
```

The tilted panel grows and straightens into the stage. Browsers without support navigate normally. On the game page, the poster is shown in the stage until the first 3D frame, so the transition has pixels to land on.

---

## 4. Rubik's cube (`/arcade/cube/`)

### Logic model (`cube/model.js`, no three import, testable in Node)

- 26 cubies, each `{ id, pos: [x,y,z] ∈ {-1,0,1}³, rot: 3×3 integer matrix, stickers: [{ localNormal, color }] }`. The hidden core cubie is omitted.
- A **move** is `{ axis: 'x'|'y'|'z', layers: Set<-1|0|1>, turns: 1|2|-1 }`, one quarter turn being clockwise when looking at that face.
- Notation table (standard WCA orientation, white top, green front):

| Move | Axis | Layer | Clockwise sign |
| --- | --- | --- | --- |
| U / D | y | +1 / −1 | − / + |
| R / L | x | +1 / −1 | − / + |
| F / B | z | +1 / −1 | − / + |
| M / E / S | x / y / z | 0 | follows L / D / F |
| x / y / z | whole cube | all | follows R / U / F |

  Suffixes: `'` means prime (inverse) and `2` means a half turn. The model exposes `parse("R U2 F'")` and `format(moves)`.
- `apply(move)` rotates `pos` and `rot` by the integer rotation matrix, so no floating-point drift builds up.
- `isSolved()`: for each of the 6 world directions, collect the stickers whose world normal (`rot · localNormal`) points that way. Solved means every set has a single colour. This ignores whole-cube orientation, which is correct.
- `scramble(n = 25)`: random face moves from `U D L R F B` with suffixes `'' ' 2`. Never repeat a face back to back, and never make three moves on one axis in a row (rules out `R L R`). Use `crypto.getRandomValues`. Returns the move list for display.
- `invert(moves)` supports undo and the preview's un-scramble.

### View (`cube/view.js`)

- **Bodies:** one `InstancedMesh(RoundedBoxGeometry(0.96, 0.96, 0.96, 3, 0.09), bodyMat, 26)`. `bodyMat` is a `MeshStandardMaterial` in ink with roughness 0.55.
- **Stickers:** one `InstancedMesh(stickerGeo, stickerMat, 54)` with `instanceColor`.
  - `stickerGeo` is a `ShapeGeometry` rounded square, 0.80 across with a 0.12 corner radius.
  - Each sticker's matrix is `cubieMatrix × faceOffset`, offset 0.483 along the local normal.
  - `stickerMat` is `MeshStandardMaterial` with roughness 0.35 and `polygonOffset` (-1, -1) to prevent z-fighting.
- **Face letters (optional toggle):** a third instanced mesh with a 6-letter atlas `CanvasTexture` in DM Mono, drawn after `document.fonts.ready`.
- **Contact shadow:** a plane under the cube.
- That's 3 draw calls, or 4 with letters.
- **Layer animation:** when a move starts, record the cubie ids in that layer and their base matrices. Each frame, set each instance to `R(axis, angle) × base`, then write its 2–3 stickers, and set `instanceMatrix.needsUpdate` (about 9 bodies and 21 stickers per frame). When the move finishes, commit it to the model and rebuild the matrices from integer state. This snaps them exactly.
- **Timing:** a user turn takes 170 ms `easeOutCubic`, a half turn 240 ms, and a scramble move 65 ms. Under reduced motion, turns take 60 ms and the scramble applies instantly with one 200 ms fade.
- **Queueing:** moves go into a queue. Keyboard input can queue up to 4 moves, and the animation speeds up to 90 ms while the queue is longer than 1.
- **Camera:** `PerspectiveCamera(30°)` at distance 9.5, looking at the origin. The default view shows U, F, and R with a slight tilt: rotate the cube group by −30° on Y and 25° on X.

### Input (`cube/input.js`)

Use pointer events on the canvas with `touch-action: none`, and call `setPointerCapture` on down.

1. **Pointer down:** raycast against the sticker and body meshes. Use a single `Raycaster`, and only on down, not on move.
   - **Hit:** store the cubie id, the world-space face normal `n` (snapped to the nearest axis), and the hit point. Mode is `pending-turn`.
   - **Miss:** mode is `orbit`.
2. **Pointer move in `pending-turn`:** project the pointer delta onto the face plane.
   - Unproject the screen points onto the plane through the hit point with normal `n`, giving `d` in world space.
   - Once `|d|` exceeds 0.12 world units (about 8 px), pick the tangent axis `t` (of the two perpendicular to `n`) with the larger `|d·t|`. The rotation axis is `a = n × t`, snapped to a world axis and then converted into the cube group's local frame.
   - The layer is the cubie's coordinate along `a`. The sign is `sign(d·t)` combined with the handedness of `n × t`.
   - Enter `turning`. The layer angle follows the drag live: `angle = (d·t) / 1.6 × (π/2)`, clamped to ±π.
3. **Pointer up in `turning`:** snap to the nearest quarter. Release velocity over 0.9 rad/s carries it to the next quarter in the drag direction. A spring (stiffness 320, damping 28) animates the remainder. The result may be a zero turn, which changes nothing and costs no move.
4. **Orbit:** rotate the cube group with a trackball.
   - The pointer delta maps to a quaternion around the screen-space axis perpendicular to the drag, at 0.008 rad/px.
   - On release, apply inertia that decays by 0.92 per frame and stops below 0.0005.
   - Clamp nothing, so the cube can be viewed from any side. Double-click or double-tap the background to animate back to the default view (350 ms).
5. **Esc during a drag** animates the layer back to 0.
6. **Pinch:** ignored. The stage is fixed size, and zoom adds nothing to a cube.

**Keyboard** (while the stage or the page has focus and no input field is focused):

- `U D L R F B M E S`: turn that layer. Add Shift for prime. `x y z` rotate the whole cube.
- Arrow keys orbit by 15°. `Home` resets the view.
- `Ctrl`/`Cmd`+`Z` undoes.
- A `<details>` in the panel lists all of this.

**On-screen move pad** (inside `<details>` "Move buttons"): 18 buttons (U, U′, U2 … B2) for keyboard, switch, and screen-reader users. Each is a real `<button>`, labelled like "Turn the top layer clockwise".

### Game states

| State | Stage | Panel | Status line (aria-live polite) |
| --- | --- | --- | --- |
| `solved-idle` (first load) | Solved cube | Scramble enabled; Undo and Reset disabled | "Press Scramble to start." |
| `scrambling` | Fast turns | All controls disabled | "Scrambling…" |
| `ready` | Scrambled | Timer 0:00.00, scramble notation shown | "The timer starts on your first turn." |
| `solving` | Player turning | Timer running (rAF-updated text, 10 ms precision, `font-variant-numeric: tabular-nums`) | Nothing announced every tick. Moves are announced only via the move pad. |
| `solved` | One celebration: the cube lifts 0.3, does one 360° Y turn over 900 ms, and settles. Nothing else. | Timer turns vermilion. Best time updated. | "Solved in 1:12.40 with 64 moves." plus " New best time." when it is one. |

- A turn made in `solved-idle` just turns and moves to a free-play state with no timer. "Scramble" is always available outside `scrambling`.
- **Reset cube** jumps to solved instantly (with a 150 ms fade) and clears the timer. If a timed solve is running, it asks first with an inline confirm: "Reset and lose this solve?" with buttons **Reset** and **Keep solving**.
- **Undo** pops the last player move and animates its inverse. It does count as a move, which is shown honestly. Undo is disabled in `ready`, so the scramble itself can't be undone.
- **Persistence** (`storage.js`, all wrapped in try/catch):
  - `arcade.cube.best` stores `{ ms, moves, date }`.
  - `arcade.cube.state` stores cubie state, history, timer start, and state name, saved on `pagehide`. A timed solve resumes on return with the elapsed time preserved, since the timer measures real time.
- **Sound (optional):** a 12 ms filtered noise click on each quarter turn. It's synthesized, off by default, and toggled by "Sound: off/on".

---

## 5. Chess (`/arcade/chess/`)

### Rules

`chess.js` 1.4.0 (BSD-2-Clause) is the source of truth on the main thread. It handles legal moves, SAN, check, checkmate, stalemate, threefold repetition, insufficient material, the fifty-move rule, and FEN/PGN.

### Board and pieces (`chess/view.js`, `chess/pieces.js`)

- **Board:** one `InstancedMesh(BoxGeometry(1, 0.12, 1), boardMat, 64)` with `instanceColor`.
  - Square highlight changes are just instance colour writes.
  - Frame: one mesh, a beveled box 9.0 × 0.25 × 9.0.
  - Coordinates `a–h` and `1–8` are baked once into the frame's top `CanvasTexture` (1024², DM Mono after `document.fonts.ready`) and flip with the board.
- **Pieces:** procedural, built once.
  - Pawn, rook, bishop, queen, and king are `LatheGeometry(points, 32)` from hand-tuned 2D profiles. Radius and height are in square units: a king is 1.05 tall and 0.36 in base radius, and a pawn is 0.55 tall.
  - Details: the rook gets 4 crenel notches, cut by merging 4 small boxes subtracted visually (stacked darker boxes, not CSG). The bishop gets a mitre slit (a thin dark box at 30°). The king gets a cross (two boxes). All are merged with `mergeGeometries`.
  - The knight is a lathe base plus an `ExtrudeGeometry` of a horse-head `Shape` (about 20 points, depth 0.22, bevel 0.03), centred and merged.
  - Call `computeVertexNormals()` and keep each piece under 1,500 triangles.
- **Instancing:** one `InstancedMesh` per type (6 meshes) with `instanceColor` for ivory or ink. That's 6 draw calls for up to 32 pieces.
  - Capacity: pawns 16, knights, bishops, and rooks 20 each (promotions), queens 18, kings 2.
  - `mesh.count` shrinks as pieces are captured.
  - A stable `pieceId → (mesh, index)` map is rebuilt on capture with a swap-remove.
- **Markers:** one instanced disc mesh for legal-move dots (radius 0.14) and one instanced ring mesh for capture targets (inner 0.36, outer 0.44). Both are vermilion, `transparent`, opacity 0.85, `depthWrite: false`. A keyboard cursor ring is a single mesh with a 2 px-equivalent outline.
- **Blob shadows:** one instanced plane with a radial-gradient texture, one instance per piece, following the pieces.
- **Materials:** ivory `MeshStandardMaterial` (roughness 0.5) and ink (roughness 0.45) share one material through `instanceColor`. On low tier, use `MeshLambertMaterial`.
- **Camera:** `PerspectiveCamera(35°)`.
  - Desktop: 50° elevation, distance 13, looking from the player's side.
  - Mobile (portrait): 68° elevation, so taps land accurately.
  - `OrbitControls` settings: `enablePan: false`, `enableDamping: true` with `dampingFactor: 0.08`, `minPolarAngle: 0.25` / `maxPolarAngle: 1.15`, and `minDistance: 9` / `maxDistance: 18`. `rotateSpeed` is 0.6.
  - The controls' `change` event calls `stage.invalidate()`.
  - Orbit only starts when the drag begins off a piece, or with a right-click or two fingers. See input below.
  - **Top view** animates to straight down (polar 0.001) over 400 ms. **Flip board** animates the azimuth 180° over 600 ms.

### Input (`chess/input.js`)

- **Picking:** raycast only against an invisible `Plane(y = 0.06)`, then map the hit point to `file = floor(x + 4)` and `rank = floor(z + 4)`. There's no per-mesh raycasting at all, and the math inverts correctly when the board is flipped.
- **Click to move:**
  1. Tapping your own piece selects it. The piece lifts 0.25 (spring, 140 ms), its square tints, and its legal targets appear.
  2. Tapping a target moves it.
  3. Tapping another of your pieces reselects. Tapping elsewhere deselects.
- **Drag to move:**
  - Pointer down on your own piece, then moving more than 6 px, starts a drag. The piece follows the plane point at a height of 0.45. Its shadow stays on the board and grows softer.
  - The hovered target square gets a light vermilion tint.
  - Dropping on a legal square moves the piece. Dropping anywhere else springs it back (220 ms).
- **Orbit:** a drag that starts on an empty square or an opponent's piece orbits the camera. Pass the event to `OrbitControls` only in that case, by toggling `controls.enabled` on pointerdown.
- **Keyboard:**
  - The canvas is focusable with `tabindex="0"`, `role="application"`, and `aria-label="Chess board. Use arrow keys to move the cursor, Enter to pick up or place a piece."`
  - Arrow keys move the cursor ring. Enter or Space selects or places, and Esc cancels.
  - The cursor starts on e2 (e7 when playing black).
  - Each cursor move updates a visually hidden live region, for example "e4, white pawn" or "f6, empty, legal move".
- **Typed moves:** an `<input>` in the panel, labelled "Type a move", with the placeholder "e4 or Nf3". It accepts SAN or coordinates (`e2e4`) through `chess.move(text, { strict: false })`. On error it shows "That move isn’t legal here. Legal moves for this piece: …" when a piece is identifiable, and otherwise "That move isn’t legal here."
- **Promotion:** a popover anchored over the stage offers Queen, Rook, Bishop, and Knight as buttons, with Queen focused by default. Esc cancels the move.
- **Pre-moves:** out of scope. Input is blocked while the bot thinks. You can still select pieces to look at their moves; tapping a target does nothing.

### Move animation

- **Standard moves:** slide along the board with `easeInOutCubic` over 260 ms. The piece rises 0.08 mid-slide so it clears the square edges.
- **Knight:** a parabolic hop with an apex of 0.6, over 320 ms.
- **Capture:** the captured piece shrinks to scale 0.6 and slides to the captured tray beside the board over 300 ms, starting 120 ms into the capturer's move.
- **Castling:** king and rook animate at the same time. En passant removes the pawn behind the target square.
- **Promotion:** the pawn arrives, then scales down, then the new piece scales up (180 ms each).
- **Check:** the king's square flashes vermilion twice over 400 ms, then stays tinted.
- **Reduced motion:** all durations become 0–80 ms and nothing hops.

### Bot (`chess/engine.worker.js`, module worker)

Launch it with `new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' })`. It imports `chess.js` through a relative vendor path, since import maps don't apply in workers.

**Protocol:**

```
→ { type: 'search', id, fen, level }
← { type: 'best', id, move: { from, to, promotion }, depth, nodes, score }
→ { type: 'stop' }
```

**Search:**

- Negamax with alpha-beta and iterative deepening. The time budget is checked every 1,024 nodes.
- Quiescence search over captures, with stand-pat. Depth is capped at 6 plies of captures.
- **Move ordering:** hash move first, then MVV-LVA captures, promotions, 2 killer moves per ply, and a history heuristic.
- **Transposition table:** a `Map` keyed by the first four FEN fields, capped at 200k entries with clear-on-overflow. It stores depth, score, flag, and best move.
- **Evaluation:** PeSTO tapered middlegame and endgame piece-square tables with material values (a well-known public-domain table set). Add +10 for the side to move. Include simple mate-distance scoring.

**Levels:**

| Level | Search | Randomness | Rough strength |
| --- | --- | --- | --- |
| Easy | depth 1 plus quiescence | Softmax over root moves with a temperature of 120 cp. A 15% chance to pick a random non-blunder. | Beginner |
| Medium | Iterative deepening to depth 3, 600 ms cap | Among moves within 20 cp of the best | Casual club |
| Hard | Iterative deepening, 1,500 ms budget (depth 4–5 typical) | None | Solid casual |

- **Opening book** (`book.js`): about 40 short lines (4–8 plies) of main openings, keyed by FEN, with random choice among them. This gives variety in the first moves at every level, and they're played instantly.
- **Feel:** a minimum think time of 350 ms, so bot moves don't snap in inhumanly. The status shows "Bot is thinking…".
- **Failure:** if the worker errors or takes over 5 s, terminate it, play a random legal move, and show "The bot had trouble thinking, so it made a quick move."
- **Stockfish (optional, not default):** a later "Very hard" level could load the single-thread lite Stockfish WASM on demand (several MB, so only after an explicit opt-in). It isn't part of v1.

### Game flow and UI (`chess/page.js`)

**Panel, top to bottom:**

1. **Status line** (aria-live polite):

   | Situation | Text |
   | --- | --- |
   | Your turn | "Your move." |
   | Bot's turn | "Bot is thinking…" |
   | You're in check | "Check. Your king is under attack." |
   | You deliver mate | "Checkmate. You win." |
   | The bot delivers mate | "Checkmate. The bot wins." |
   | Stalemate | "Draw by stalemate." |
   | Threefold repetition | "Draw by repetition." |
   | Insufficient material | "Draw. Neither side can checkmate." |
   | Fifty-move rule | "Draw by the fifty-move rule." |
   | You resign | "You resigned." |

   Announce the bot's move too: "Bot played knight to f6."
2. **Captured pieces:** a small row for each side, with the material difference shown as "+2".
3. **Move list:** an `<ol>` in two columns (white, black), with move numbers in Space Grotesk. It scrolls within a 240 px max height and auto-scrolls to the latest move.
4. **Buttons:**
   - **Undo move** takes back your last move and the bot's reply. It's disabled while the bot thinks or at move 0.
   - **New game**
   - **Resign** asks for confirmation inline: "Resign this game?" with buttons **Resign** and **Keep playing**.
   - **Flip board** and **Top view**
5. **Game setup** (`<details open>` before the first move, collapsed after): side is White, Black, or Random (a radio group), and level is Easy, Medium, or Hard (a radio group). Changing the level mid-game takes effect from the bot's next move. Changing sides requires a new game.
6. **Typed move input** and a **Keyboard controls** disclosure.

**Other behaviour:**

- **New game** opens a small `<dialog>` with side and level, and a **Start game** button. The default is White, Medium.
- **Game over:** an overlay inside the stage, sized to the panel and not a full modal. It shows the result sentence and buttons **Play again** and **Review moves**. Review closes the overlay and keeps the final position.
- **Persistence:** `arcade.chess.game` stores `{ pgn, side, level, updatedAt }`, saved after every move. On load, restore it by replaying the PGN (no animation). A game older than 14 days is dropped. The arcade index reads this key for the "Resume" line.

---

## 6. Posters

Posters are static WebP images of the default scenes, used on the index and as stage placeholders.

- **Generate them from the real renderer:** add `?poster` handling in `preview.js`. It renders at 1800×1380 with `preserveDrawingBuffer: true`, then `canvas.toBlob(…, 'image/webp', 0.82)` downloads the file. Save the results as `assets/arcade/posters/{cube,chess}.webp`, downscaled to 900×690.
- Document the steps in `scripts/capture_posters.md`.
- The posters render against transparency, so the CSS panel tint shows behind them. Check that the WebP alpha is preserved.

---

## 7. Accessibility checklist

- Every control is a native `<button>`, `<input>`, `<details>`, or `<dialog>`, with visible focus using the site's `outline: 2px solid var(--red); outline-offset: 6px`. Inside the tinted stage, use an `outline-offset` of 3 px.
- Game state is fully available outside the canvas:
  - Cube: status, timer, moves, the move pad, and a "Show face letters" option.
  - Chess: status, move list, typed moves, and the keyboard cursor with announcements.
- `prefers-reduced-motion` affects:
  - Animation durations
  - The idle spin and attract modes (off)
  - The View Transition (off)
  - The solve celebration (replaced by the timer colour alone)
- Target size is at least 44×44 px for all buttons, and 48 px in the mobile action bar.
- `lang="en"` and a unique `<title>` and `<h1>` per page. The canvases have accessible names.
- Colour is never the only signal:
  - Legal captures use a ring, not just colour.
  - Check is also announced in text.
  - The cube offers the letter overlay.

---

## 8. Metadata and site integration

- **Titles and descriptions:**

  | Page | Title | Description |
  | --- | --- | --- |
  | `/arcade/` | "Arcade \| Muhammad Rayyan" | "Two small 3D games by Muhammad Rayyan, built with Three.js: a Rubik’s cube you can scramble and solve, and chess against a bot." |
  | `/arcade/cube/` | "Rubik’s cube \| Arcade \| Muhammad Rayyan" | none specified |
  | `/arcade/chess/` | "Chess \| Arcade \| Muhammad Rayyan" | none specified |

- Each page gets a canonical URL, OG and Twitter tags (the poster as `og:image`), and `theme-color` `#f3f0e9`. Add JSON-LD `VideoGame` for each game (`gamePlatform: "Web browser"`, `author` referencing `#person`), and a `CollectionPage` for the index.
- Add all three URLs to `sitemap.xml`. Add an "Arcade" section to `llms.txt`.
- Homepage: add an Arcade nav link and a footer link. Update the README's structure table and "What's inside" section.
- Include `favicon.js` and the favicon links on the new pages for consistency. `portfolio.js` is only needed for the year and service-worker registration, so it also loads on the new pages.

---

## 9. Build order and acceptance criteria

1. **Vendor and scaffold.**
   - Work: `scripts/vendor_libs.py`, the import map, three empty pages with the header and footer, `arcade.css` with the layout from §1, and the service worker update.
   - Done when: all three pages render correctly at 360, 768, 1280, and 1600 px, without JS, and the nav links work.
2. **Stage core.**
   - Work: `stage.js`, `tween.js`, `support.js`, `storage.js`.
   - Done when: a test cube spins on demand, idle frames drop to 0 (check in DevTools Performance), resizing works, the stage pauses in hidden tabs, and a forced `WEBGL_lose_context` shows the recovery message.
3. **Cube model and tests.**
   - Work: `model.js` plus `tests/cube-model.test.mjs`.
   - Tests: `R×4` is identity, `(R U R' U')×6` is identity, `scramble + invert(scramble)` is solved, every move followed by its prime is identity, `parse(format(x))` equals `x`, and the scramble rules hold over 10k samples.
   - Run with `node --test tests/`.
4. **Cube view and input.**
   - Done when: 3 draw calls (`renderer.info.render.calls`); drag turns work on every visible face from any orbit angle, including upside down; snapping and inertia feel right; keyboard and move pad work; the frame rate holds 60 fps under 6× CPU throttling on the turn animation.
5. **Cube page states.**
   - Done when: the timer, best time, persistence, reset confirmation, solved celebration, and reduced-motion variants all work, and every status sentence appears.
6. **Chess pieces and board.**
   - Done when: all 12 piece and colour combinations are recognisable from the default and top views at 360 px, there are ≤ 12 draw calls, and pieces stay under 1,500 triangles each.
7. **Chess interaction.**
   - Done when: click, drag, keyboard, typed moves, promotion, castling, en passant, and all animations work, and orbit only starts off your own pieces.
8. **Engine and tests.**
   - Tests:
     - The engine returns a legal move for 200 random positions (generated by playing random moves from the start).
     - It finds mate in 1 on 10 test FENs at every level except Easy.
     - It finds mate in 2 on 5 test FENs at Hard.
     - Hard stays within its time budget ±150 ms.
     - A worker failure falls back to a random move.
9. **Chess page flow.**
   - Done when: new game, undo, resign, flip, top view, all game-over states (checked with test FENs through `?fen=` in dev only), persistence and resume, and the index "Resume" line all work.
10. **Arcade index previews.**
    - Done when:
      - No three.js request happens before the cards near the viewport (check the Network panel).
      - The poster-to-canvas crossfade shows no layout shift (CLS 0).
      - The hover attract modes work.
      - The View Transition morph works in Chrome and Safari 18.2+, and navigation stays clean in Firefox.
11. **Posters, metadata, and docs.** Capture the posters and fill in the sitemap, llms.txt, README, and homepage links.
12. **QA pass.**
    - Browsers: Chrome, Edge, and Firefox on Windows; Safari on macOS and iOS; Chrome on Android (mid-tier device or 4× throttle).
    - Lighthouse on all three pages.
    - Heap snapshot after navigating index → cube → index → chess, 5 times each: no growing detached WebGL contexts.
    - Keyboard-only full games of both. VoiceOver/NVDA spot-check of status announcements.
    - `node --check` on all new JS, and `git diff --check`.

## 10. Out of scope for v1

- Cube: a solver or hint button, sizes other than 3×3, and random-state scrambles (these need a two-phase solver).
- Chess: online play, pre-moves, clocks, PGN import or export UI, analysis mode, and Stockfish.
- Sound effects beyond the optional cube click.
