# Pixel Leap v2: visual and feel design (game-designer, 2026-11-15)

Goal (Ishan): smoother motion and speed; modern 2020s look with the classic retro platformer feel; much better animated characters. All original.

## Decisions
**Resolution.** Keep art at 1 art px = 1 game px (gp). The canvas is in device pixels; draw with S integer device px per gp (S about 3-7) and snap positions to 1/S gp, not whole gp. Effects (gradients, glow, soft shadows, particles) may use the 1/S grid. Every sprite frame is baked once into an offscreen canvas and placed with drawImage, imageSmoothingEnabled = false.

**View sizing (one rule).** S = largest integer giving a landscape play height >= 224 gp (at most one top row cropped). Portrait: play band = 60% of screen height and the view is at least 176 gp wide. view.h = playPx / S, view.w = pxW / S. The level's bottom row sits at the bottom of the play band; extra height above is sky. 390x844 -> S=6, view 195x253, band 506 CSS px; 844x390 -> S=5; 1280x800 at dpr 1 -> S=3. No black anywhere: in portrait the area under the band is a themed "underground" panel (theme dirt darkening downward, lit top edge) and the controls sit on it.

**Motion.** Keep the 1/60 fixed step. Before each step store prev positions of player, enemies, items; draw at lerp(prev, curr, acc/STEP); on level load, respawn or entity-count change set prev = curr. Render camera lives in the page (state.camera still decides enemy activation): x += (target - x) * (1 - e^(-8*dt)); target = player centre - 0.42*view.w + lookahead; lookahead eases to facing*0.12*view.w at 3/s; clamp to level. No vertical scroll: camY = 240 - view.h. Hit-stop (skip steps): stomp 0.06 s, hurt 0.08 s, death 0.12 s.

**Feel tuning (game.js, tests updated by name).** Fall gravity x1.35; apex gravity x0.55 when |vy| < 70 and jump held; run accel 900 -> 1300; turnaround accel 2200; max speeds unchanged (level-1 jump still covers ~84 px vs 64 px gaps). Add state.lastBump = {tx, ty, kind}.

**Art rules.** Light from the upper left: 1-px highlight top/left, shade bottom/right. Characters: dark self-colour outline (never black), highest contrast. Backgrounds: no outline, haze with distance, lower contrast. 4-5 tones per sprite. Soft ellipse shadow under characters (alpha 0.25, shrinks with height).

**Palettes.**
- Meadow: sky #4aa8ff->#cdeeff; hills far->near #8fb8e0 / #5cbf6a / #3a9a4e; grass #6fd650, light #b6f27a, shade #3f9a3a; dirt #7a5233, dark #4e321f, ledge shadow #2e1d12; flowers #ffd84a, #ff7aa8.
- Caverns: #070b22->#1a2350; far rock #1c2550; crystals #6ef0ff, #c07bff, glow #3b7bff; stone top #5866b8, highlight #9aa8f0; dirt #2a3160 / #171c3a; fog #2a3a7a low alpha.
- Sky Isles: sunset #2b2d6e->#ff7a59->#ffd38a; sun #fff1c0 + glow; far isles #8a5f9e; clouds #ffc2a0, shade #c77aa0; grass #e0a8ff / #fbe0ff; dirt #6f5a8e / #3f3160.

**Pip.** Frames 16x18 small, 16x28 big; frame bottom-centre on hitbox bottom-centre (hitboxes unchanged 12x14 / 12x24). Body #35d6c4, shade #178a86, highlight #9ff5e6, outline #0b3d45; eyes 3x4 white, 2x2 #12203a pupils, 1-px glint; cheeks #ff8fa0; feet 4x2 #0f6d6a; 2-px arm nubs; scarf wrap #ff8a2b, underside #c9541a. Scarf tail drawn procedurally: 6-point chain, 2.5 gp links, gravity, pushed back by velocity, flutter amplitude 0.6 at 9 rad/s, 2 px narrowing to 1 px, snapped to whole gp.

| Animation | Frames | Timing / trigger |
|---|---|---|
| idle breathe | 2 | 0.6 s each |
| blink | 1 | 0.12 s, every 2.5-4.5 s random |
| run | 6 (contact, down, pass x2 legs, arms opposite; body bob 0,+1,-1,0,+1,-1) | 0.065 s at max speed, slower at lower speed |
| rise / apex / fall | 1 / 1 / 2 | vy < -120 / abs(vy) <= 120 / vy > 120 (fall 0.1 s each) |
| take-off stretch | scale | on jump: sx 0.8, sy 1.2 easing to 1 over 0.12 s (also stomp bounce) |
| land squash | 1 | sx 1.25, sy 0.75 for 0.09 s when landing at vy > 200 |
| skid | 1 | 0.18 s when abs(vx) > 60 and input opposes vx; dust |
| hurt | 1 (X eyes) | 0.3 s |
| dead | 2 | 0.15 s each, pop up then fall |
| win | 2 (arms up, hop) | 0.25 s each |
Squash/stretch is applied about the feet, quantised to 1/16.

**Enemies and items.** Grumble 16x16: 4-frame waddle-roll 0.12 s scaled by speed, pupils track Pip (-1/0/+1), brow tilt; stomped: flat 16x6 frame for 0.35 s then poof (page detects alive true->false). Buzzer 16x14: 3 wing frames at 0.04 s, wings alpha 0.6, 1-px lean with vy, eyes track Pip. Gem: 6-frame spin 0.08 s, glint every 2 s, 1-px bob, glow from a baked radial-gradient canvas. Sprout 2-frame wiggle. Spark block 4-frame shimmer, 4-px bump bounce. Beacon star pulse.

**Effects.** Dust (jump, land, skid); gem sparkles; stomp: 10 shards + ring; brick debris with gravity; "+100" pop-ups rising 16 gp over 0.6 s; shake 2 gp hurt / 3 gp death decaying over 0.25 s; particle pool cap 256; no shadowBlur.

**Backdrop.** Cached gradient sky; sun/moon with glow; soft 2-tone pixel-circle clouds; 3 parallax layers at 0.1 / 0.25 / 0.45 hazed toward the horizon colour; foreground layer at 1.15 (grass and leaves) drawn after tiles; moving details (drifting clouds, pulsing crystals, sunset birds).

**Tiles.** Grass blades overhang the top edge and sway with sin(t + tx); rounded exposed corners from neighbours; 2-px shadow band under tiles that have a solid tile above; top-left highlights.

**HUD and screens.** Soft rounded panel, 6-px padding; heart and gem icons pop to 1.3x for 0.15 s on change; no overlap with clouds. Animated logo (per-letter bob), idle Pip on the title, pulsing start prompt, 0.25 s fades, 1.2 s level intro card.

## Tasks (Qwen builds; Codex reviews; game-tester re-tests after each W task and T10)
| id | owned files | depends | interface / acceptance |
|---|---|---|---|
| T1 | camera.js, tests/camera.test.js | - | PixelCamera: createCamera(), reset(cam,p,view,levelW), update(cam,p,view,levelW,dt), capture(state), blend(a,b,alpha), snap(v,S). Tests: within 2 px of target after 0.5 s; no overshoot; clamps to level; 60 steps of 1/60 vs 120 of 1/120 end within 0.5 px; snap maths. |
| T2 | index.html (W1) | T1 | View rule, interpolated drawing, PixelCamera, 1/S snapping, portrait underground panel, script tag. Suite green; playtest shows no black at 390x844, 844x390, 1280x800. |
| T3 | sprites.js part 1, tests/sprites.test.js | - | PixelSprites: PAL, pip(name,i,big) -> rows (16x18 / 16x28), FRAMES, bake(rows,pal,makeCanvas), createCache(makeCanvas). Tests: sizes, palette keys only, FRAMES counts per the table, cache bakes each key once. |
| T4 | anim.js, tests/anim.test.js | T3 interface | PixelAnim.createPipAnimator(rng).update(p,input,dt,events,mode) -> {name, frame, sx, sy, scarf}. Tests: run 0-5 and slows with speed; skid/land/blink fire; scarf points finite and trail motion. |
| T5 | index.html (W2) | T2-T4 | Pip from cache + animator, scarf, soft shadow. |
| T6 | sprites.js part 2 (Grumble, flat Grumble, Buzzer) | T3 | sizes and palette-key tests. |
| T7 | sprites.js part 3 (gem, sprout, block, beacon) | T6 | same. |
| T8 | fx.js, tests/fx.test.js | - | PixelFx.createFx(rng): event(name,x,y), update(dt), draw(ctx,camX,camY), shake(), hitstop(), popup(text,x,y). Tests: pool <= 256, particles expire, shake decays to 0, hit-stop counts down. |
| T9 | index.html (W3) | T5-T8 | Enemy/item animation, stomp detection, fx, hit-stop, shake. |
| T10 | game.js + named tests in tests/game.test.js + SPEC.md Physics | - | Feel tuning + lastBump. Tests: jump still >= 3 tiles; gravity values; lastBump per bump kind. Levels stay completable. |
| T11 | backdrop.js | - | PixelBackdrop.draw(ctx,theme,camX,view,t), drawFront(...). Fake-ctx test: no throw, balanced save/restore. |
| T12 | tiles.js | T10 | PixelTiles.draw(ctx,ch,x,y,tx,ty,theme,t,solidFn,bump). Same test style. |
| T13 | index.html (W4) | T11, T12 | Wire backdrop + tiles; remove old drawing code. |
| T14 | hud.js | - | PixelHud.draw(ctx,info,view,safeRect,t), pop animations. |
| T15 | screens.js | T3 | Logo, title Pip, fades, intro card; tests/screens.smoke.test.js stays green. |
| T16 | index.html (W5) | T14, T15 | Wire hud + screens; final playtest at 3 sizes with 4x CPU throttle. |

## Risks
iPhone performance (baking mandatory, cache gradients/glows, no shadowBlur, particles as rects; the 4x CPU playtest is the gate). index.html is a bottleneck: modules run in parallel between W tasks. sprites.js parts may exceed 150-line edits: compose from shared parts (body + leg overlays + offsets). Squash makes some doubled pixels: keep timings short. Landscape may crop up to 16 gp of row 0: no gameplay there. Keep window.__pixelLeap.state (tests and playtest read it). T10 changes rules: levels must stay completable.
