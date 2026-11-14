# Pixel Leap: game contract

An ORIGINAL retro side-scrolling platformer for phone and desktop browsers, hosted as a static site
on GitHub Pages (like ../Space_Invader, "Pixel Siege"). Never use names, characters, art, music or
level layouts from any existing commercial game. Everything is drawn in code (no image files), with
original sound effects and music made with the Web Audio API.

## World and characters (original)

- Hero: **Pip**, a small round teal sprite-creature with a long orange scarf and big white eyes.
- Enemies: **Grumble** (a grey rolling rock with angry eyebrows; walks and turns at walls and ledges),
  **Buzzer** (a yellow-striped flying beetle; bobs up and down on a sine path, no gravity).
- Items: **gems** (spinning cyan diamonds), **spark blocks** (gold blocks with a white sparkle; bumped
  from below they give a gem or a **Sprout**), **Sprout** (a green leaf power-up that slides along the
  ground; makes Pip big, which means one extra hit).
- Goal: a tall **beacon** (a glowing pole with a star on top) at the end of each level.
- Three levels: 1 Meadow (green hills, day sky), 2 Caverns (dark blue cave, glowing crystals),
  3 Sky Isles (sunset sky, floating islands with gaps).

## Files

| File | Who | What |
| --- | --- | --- |
| `game.js` | stage 1 | All game rules. No DOM, no canvas, no audio, no timers. Runs in a browser and in Node. |
| `tests/game.test.js` | stage 1 | `node --test` acceptance tests for game.js (Node built-in `node:test` and `node:assert/strict` only). |
| `index.html` | stage 2 | Canvas renderer, input, screens, HUD, audio, storage. Loads `game.js` with `<script src="game.js">`. |
| `manifest.webmanifest`, `README.md` | stage 3 | Installable web app manifest and the project README. |

## game.js interface (exact)

Wrap in `(function (root) { ... })(typeof globalThis !== "undefined" ? globalThis : this);`
Export one object `PixelLeap` as `root.PixelLeap = PixelLeap` and, when `typeof module === "object" && module.exports`,
`module.exports = PixelLeap`.

```
PixelLeap.TILE = 16;                       // pixels per tile
PixelLeap.VIEW_TILES_H = 15;               // every level is exactly 15 rows tall
PixelLeap.LEVELS = [ {name, theme, rows: [15 strings, all the same length >= 120]} x 3 ];
PixelLeap.parseLevel(rows) -> {width, height, tiles: string[][], start: {x, y}, enemies: [...], gems: [...]}
PixelLeap.createGame(options?) -> state      // options: {level: 0, lives: 3}
PixelLeap.step(state, input, dt)             // input {left, right, jump} booleans; dt seconds
PixelLeap.nextLevel(state)                   // after "levelclear": load the next level or set mode "won"
PixelLeap.restart(state)                     // after "gameover"/"won": new game, same object
PixelLeap.solidAt(state, tx, ty) -> boolean  // tile coordinates; outside the left/right/top edge is solid, below the bottom is not
```

Level legend (one character per tile): `.` empty, `#` ground, `B` brick, `?` spark block with a gem,
`P` spark block with a Sprout, `U` used block, `o` gem, `g` Grumble, `b` Buzzer, `^` spikes, `S` start
(exactly one per level), `F` beacon (exactly one per level). `S`, `o`, `g`, `b` become `.` in `tiles`
after parsing; `F` stays `F` (not solid). Solid tiles: `#`, `B`, `?`, `P`, `U`.

State (plain object, the renderer reads it):
```
state.mode      "playing" | "dying" | "levelclear" | "gameover" | "won"
state.level     index into LEVELS;  state.lives;  state.score;  state.gems;  state.time (seconds left, starts 300)
state.player    {x, y, w: 12, h: 14 (small) or 24 (big), vx, vy, onGround, big, facing: 1|-1, invuln (seconds), dead}
state.enemies   [{kind: "grumble"|"buzzer", x, y, w: 14, h: 14, vx, vy, alive, baseY, t}]
state.items     [{kind: "sprout", x, y, w: 14, h: 14, vx, vy}]
state.gemList   [{x, y, taken}]           // world-space pixel positions of level gems
state.tiles     the live tile grid (blocks change when bumped)
state.camera    {x}  (left edge in pixels; clamp(player.x - 0.4 * viewWidth, 0, width*TILE - viewWidth); viewWidth = state.viewWidth, default 320)
state.events    array of strings appended during step; the renderer reads then clears it
```

Physics (pixels, seconds; integrate in fixed substeps of at most 1/120 s inside step):
gravity 1800, max fall speed 600, run acceleration 900, ground friction 1100 when no direction is held,
max run speed 150, jump velocity 520 (vy = -520), releasing jump while rising sets vy = max(vy, -520 * 0.45) once,
coyote time 0.1 s after leaving ground, jump buffer 0.12 s before landing. Collide per axis against solid tiles (x then y).

Rules:
1. Bumping a block from below (player moving up, head hits it): `?` becomes `U`, +1 gem, +100 score, event "gem";
   `P` becomes `U` and spawns a Sprout on top of it, event "sprout"; `B` breaks to `.` (+50, event "break") if the
   player is big, otherwise event "bump". `U` and `#` do nothing.
2. Gem touched: taken, +1 gem, +100, event "gem". Every 100 gems: +1 life, event "life".
3. Sprout touched: player.big = true (h 24, keep feet position), +1000, event "powerup". A Sprout moves at vx 60, turns at walls, falls with gravity.
4. Grumble: walks at speed 40 (starts moving left), gravity, turns at walls and at ledges (no solid tile below its leading foot).
   Buzzer: x fixed, y = baseY + 24 * sin(2*pi*t/2), no gravity.
5. Stomp: player overlaps an enemy while player.vy > 0 and player's bottom was above the enemy's vertical centre in the
   previous substep -> enemy.alive = false, player.vy = -360, +200, event "stomp".
6. Any other enemy overlap, or touching `^`: if player.invuln > 0 nothing; else if big -> big = false (h 14, keep feet),
   invuln = 1.5, event "hurt"; else die.
7. Die (also when the player falls below the level bottom or time reaches 0): event "die", mode "dying" for 1.2 s,
   then lives -= 1; if lives == 0 -> mode "gameover", event "gameover"; else reload the same level (tiles, enemies, gems,
   time 300) with the player small at the start; score and gem count are kept.
8. Touching `F`: mode "levelclear", score += floor(time) * 10, event "goal". step does nothing else in "levelclear",
   "gameover" or "won".
9. nextLevel: level + 1, reload; after the last level mode "won", event "won".
10. Enemies only update when within 2 view widths of the camera (so far enemies wait).

Levels: each level must be completable (the start is on ground; every gap is at most 4 tiles wide and every step up at most
3 tiles; there is ground under the beacon). Level 1 is gentle (2-tile gaps, 6+ enemies), level 2 has low ceilings and
spikes, level 3 has many 3-4 tile gaps and Buzzers. Each has at least 6 `?`, 2 `P`, 30 `o`.

## Tests (tests/game.test.js), at least these
- parseLevel on a tiny 15-row fixture: start position, enemy and gem lists, `S/o/g/b` cleared, `F` kept.
- every LEVELS entry: 15 rows, equal widths >= 120, exactly one S and one F, solid ground under S and under F,
  no gap wider than 4 tiles in the bottom row.
- standing still on ground stays on ground; holding right accelerates to max 150 and not beyond.
- jump: from ground with jump held the player rises at least 3 tiles; a tapped jump (released after 1 frame) rises less.
- coyote time and jump buffer each work (and fail after their windows).
- head-bump `?` -> `U`, gems +1, score +100, event "gem"; `B` small -> event "bump", tile unchanged; big -> `.`.
- Sprout spawn from `P` and pickup makes the player big; hurt when big makes small with invuln.
- stomp kills a Grumble and bounces; side contact when small leads to "dying" then lives - 1 and a reload.
- falling below the level kills; time running out kills; lives reaching 0 gives "gameover".
- touching F gives "levelclear" with the time bonus; nextLevel loads level 2; after level 3 mode "won".
- a scripted "bot" run that holds right and jumps at fixed intervals finishes at least level 1 without dying is NOT required
  (levels need human timing).

## index.html (stage 2)
- One `<canvas>` filling the screen; game area scaled so the 15 tile rows fill the height (integer-ish crisp pixels,
  `image-rendering: pixelated`, devicePixelRatio aware); `viewWidth` follows the aspect ratio; works portrait and landscape;
  respects `env(safe-area-inset-*)`; no page scroll or zoom (`touch-action: none`, viewport meta like ../Space_Invader/index.html).
- Pixel-art sprites drawn procedurally with fillRect from small character-map arrays (Pip small and big with a 2-frame run
  cycle, jump pose, Grumble, Buzzer with flapping wings, gem spin, spark block shimmer, brick, ground with grass top per theme,
  spikes, beacon). Parallax backdrop per theme (hills/clouds, cave crystals, sunset islands).
- HUD: score, gems, lives, level name, time. Screens: title (tap / press to start, best score), pause, level clear, game over, won.
- Controls: on touch devices on-screen buttons (left and right arrows at bottom-left, a large JUMP button at bottom-right,
  pause at top-right), multi-touch so run + jump work together; keyboard arrows / A D to move, Space / W / Up to jump, P / Esc pause.
- Fixed-timestep loop with requestAnimationFrame (call PixelLeap.step with dt <= 1/30 per frame); pause when the tab is hidden.
- Web Audio: short original chiptune sound effects for every event name above and a simple original looping melody per theme;
  audio starts only after the first user gesture; a mute toggle; never throws if audio is unavailable.
- Best score in localStorage inside try/catch. No external network requests except the bundled font file `fonts/press-start-2p.woff2`.
- No console errors. Works in iPhone Safari (Add to Home Screen, standalone) and desktop Chrome.
