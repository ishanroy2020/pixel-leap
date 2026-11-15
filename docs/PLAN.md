# Pixel Leap: build plan and module interfaces (design 2026-11-15)

Builders: Qwen (branch `qwen-build`, folder `Pixel_Leap`) and Codex (branch `codex-build`, folder `Pixel_Leap-codex`).
Only Claude merges into `main`, one branch at a time, after review (Codex reviews Qwen; Claude reviews Codex) and a security check.

| # | Builder | Owned files | Depends on | Reviewer |
|---|---|---|---|---|
| Q2a | Qwen | index.html | – | Codex |
| C1 | Codex | tests/controls.test.js, tests/screens.test.js, tests/page.test.js, tests/originality.test.js, tools/smoke.mjs | interfaces below | Claude |
| C2 | Codex | audio.js, tests/audio.test.js, game.js (one line: push "jump"), tests/jump-event.test.js | – | Claude |
| C3 | Codex | tools/make-assets.js, icon-180/192/512.png, og.png, manifest.webmanifest, README.md, tests/assets.test.js | – | Claude |
| Q3 | Qwen | controls.js | C1 tests | Codex |
| Q4 | Qwen | screens.js | C1 tests | Codex |
| Q5a | Qwen | index.html: head metas, script tags, PixelControls + Pointer Events + buttons, safe areas, reset on blur | 2a, Q3, C3 | Codex |
| Q5b | Qwen | index.html: PixelScreens flow + best score, PixelAudio wiring, mute, hidden-tab pause, `window.__pixelLeap = {state, flow}` | Q5a, Q4, C2 | Codex |

C1's test files are acceptance inputs; each lands on main together with its module (controls/screens tests with Q3/Q4,
page test and smoke tool with Q5b), so main stays green. Final checks on the Q5b commit: full `node --test tests/`,
`node tools/smoke.mjs` at 390x844, 844x390 (mobile, touch, dpr 3) and 1280x800, security pass, then publish.

## audio.js (global `PixelAudio`)
```
PixelAudio.EVENTS   = ["jump","gem","sprout","break","bump","powerup","stomp","hurt","die","gameover","goal","won","life"]
PixelAudio.THEMES   = ["meadow","caverns","sky"]
PixelAudio.SFX      = { [event]: [{wave, f, f2?, at, dur, vol}] }        // data only
PixelAudio.MELODIES = { [theme]: {bpm, lead: [[midi|0, beats]], bass: [[midi|0, beats]], wave} }
PixelAudio.MAX_VOICES = 24
PixelAudio.createAudio(opts?) -> audio      // opts {AudioContext?: ctor (default root.AudioContext || root.webkitAudioContext), muted?: false}
audio.unlock() -> boolean     // in a user gesture: create the context once, resume; true if audio works
audio.available() -> boolean
audio.play(name) -> boolean   // false when muted / unavailable / unknown
audio.playEvents(events) -> number   // count scheduled; never mutates the array
audio.setMusic(theme | null)  // switch / stop the loop; unknown theme = silence
audio.update()                // once per frame; schedules music up to 0.25 s ahead of ctx.currentTime; no timers
audio.setMuted(bool); audio.isMuted(); audio.toggleMute() -> new muted state
audio.suspend(); audio.resume()   // promise rejections caught
```
Never throws: every Web Audio call is inside try/catch. Melodies are composed from scratch (no known tunes).

## controls.js (global `PixelControls`)
CSS px relative to the canvas bounding box; buttons drawn with `ctx.setTransform(dpr,0,0,dpr,0,0)` after the game.
```
PixelControls.KEYMAP = {ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right",Space:"jump",KeyW:"jump",ArrowUp:"jump",
                        KeyP:"pause",Escape:"pause",KeyM:"mute",Enter:"action"}
PixelControls.layout(w, h, safe?) -> {left, right, jump, pause, mute}   // each {x,y,w,h}; safe {top,right,bottom,left}
   // left/right bottom-left >= 64x64; jump bottom-right >= 88x88; pause top-right, mute left of it; all >= 44x44, inside safe area, no overlaps
PixelControls.hitTest(layout, x, y) -> "left"|"right"|"jump"|"pause"|"mute"|null
PixelControls.createControls(layout?) -> ctl
ctl.setLayout(layout)
ctl.pointerDown(id, x, y, pointerType); ctl.pointerMove(id, x, y); ctl.pointerUp(id)   // pointercancel -> pointerUp
ctl.keyDown(code) -> handled; ctl.keyUp(code) -> handled
ctl.input() -> {left, right, jump}       // keys OR touches; a finger sliding between buttons updates
ctl.consumePause(); ctl.consumeMute(); ctl.consumeAction()   // true once per press; action = tap not on pause/mute, or Space/Enter
ctl.touchActive() -> boolean             // true once any pointerType "touch" seen
ctl.pressed() -> {left, right, jump, pause, mute}
ctl.reset()
PixelControls.drawButtons(ctx, layout, pressed)   // fillRect/arc/fill only; save/restore balanced
```

## screens.js (global `PixelScreens`)
```
PixelScreens.KEY_BEST = "pixelLeap.best"; PixelScreens.KEY_MUTED = "pixelLeap.muted"; PixelScreens.ACTION_DELAY = 0.6
PixelScreens.loadBest(storage?) -> number          // default root.localStorage; 0 on error / bad / negative
PixelScreens.saveBest(score, storage?) -> number   // writes only if higher; returns best; never throws
PixelScreens.loadMuted(storage?) -> boolean; PixelScreens.saveMuted(bool, storage?)
PixelScreens.createFlow() -> flow
flow.screen  "title"|"playing"|"paused"|"levelclear"|"gameover"|"won";  flow.entered  screen entered in the last update, else null
flow.update(mode, dt, act) -> "none"|"step"|"restart"|"nextLevel"     // act {action, pause}; mode = state.mode
   // title + action -> playing, "restart"; playing: pause -> paused; mode levelclear/gameover/won -> that screen; else "step" (also while dying)
   // paused: pause or action -> playing; levelclear + action (after ACTION_DELAY) -> "nextLevel", playing (won on next update if mode won)
   // gameover/won + action (after delay) -> title
flow.pause()                              // only when playing
PixelScreens.drawScreen(ctx, screen, info, w, h, t)   // game px; info {score, best, gems, lives, levelName, muted, touch}; "playing" draws nothing
```

## tools/make-assets.js (Node only; fs + zlib; writes nothing on require)
```
encodePNG(width, height, rgba: Uint8Array) -> Buffer   // RGBA8, filter 0, deflate, correct CRCs
renderIcon(size) -> {width, height, data}               // Pip (teal body, orange scarf, white eyes) on an opaque backdrop
renderOg() -> {width: 1200, height: 630, data}          // Pip, beacon, "PIXEL LEAP" in its own bitmap font
writeAll(dir) -> string[]                               // icon-180/192/512.png, og.png
// node tools/make-assets.js [dir]
```
Manifest like ../Space_Invader: name/short_name "Pixel Leap", start_url/scope "./", display "fullscreen", orientation "any", icons 192/512.
README: play link https://ishanroy2020.github.io/pixel-leap/, how to play (touch + keyboard), iOS silent switch mutes audio,
credits (Qwen built the game; Codex built audio, assets and tests; Claude designed and reviewed; Ishan Roy owner; Press Start 2P by CodeMan38, SIL OFL 1.1).

## tools/smoke.mjs (Node 22+, no npm deps)
Serves the repo on 127.0.0.1 (random port); launches Chrome (`CHROME` env or the macOS default) `--headless=new --remote-debugging-port=0`
with a temp profile and reads DevToolsActivePort; for 390x844 and 844x390 (mobile, touch, dpr 3) and 1280x800: load, wait 1.5 s; fail on any
exception, console.error, failed request or request to another host; check no scroll (scrollWidth <= innerWidth, scrollHeight <= innerHeight),
canvas size > 0, >= 4 distinct sampled colours; tap to start, hold touches on right + jump for 1 s and check `__pixelLeap.state.player.x`
increased and y dipped (multi-touch); repeat with keyboard; print a JSON report, exit 0/1. Generous waits, one retry.

## Acceptance tests (no browser)
- **audio** (fake AudioContext recording nodes, settable currentTime, state "suspended", promise resume/suspend): no ctor -> unlock/available
  false, play false, nothing throws; no context before unlock; double unlock = one context + resume; every EVENT plays, starts >= currentTime,
  stop > start, durations <= 1.5 s (2.5 s die/gameover/won), no two SFX identical; muted -> false and no oscillators; toggleMute returns new
  state; ctor throws / osc.start throws -> no throw, play false; rejected resume -> no unhandledRejection; 100 x play("gem") keeps live voices
  <= MAX_VOICES; music: setMusic("meadow") + update schedules only before currentTime + 0.3, 10 s at 1/60 keeps looping with no duplicate
  start per voice, setMusic(null) stops, unknown theme silent; MELODIES 3 themes, >= 16 steps, bpm 80-200, midi 36-96 or 0, all different;
  playEvents(["gem","nope"]) === 1 and the array is unchanged.
- **jump-event**: jumping from ground pushes "jump" exactly once; holding jump in the air pushes none.
- **controls**: layout(390,844), (844,390) and a safe-area case: inside safe area, minimum sizes, no overlaps; hitTest centres hit, screen
  middle misses; multi-touch left + jump, release keeps left, slide left -> right; every KEYMAP code, unknown not handled, key OR touch;
  consume* once per press; reset clears; touchActive only after a touch pointer; drawButtons on a fake ctx: no throw, >= 4 fills, balanced save/restore.
- **screens** (Map storage, throwing storage, missing localStorage): best round-trip, lower not written, "abc"/-5 -> 0, throwing -> 0; the full
  flow table incl. ACTION_DELAY (0.3 s ignored, 0.7 s accepted), levelclear -> nextLevel -> won, pause() only when playing, entered set once;
  drawScreen fillText: title "PIXEL LEAP" + "BEST" + number, "PAUSED", "GAME OVER" + score, level name on won/levelclear, "TAP" on touch else
  "SPACE", playing draws nothing.
- **assets**: encodePNG(3,2) signature, IHDR, every CRC (own CRC32 in the test), IDAT inflates to h*(1+w*4) with filter 0; writeAll(tmp) 4 files
  with right IHDR sizes; committed files right sizes; icons opaque, >= 4 colours, include teal and orange; require writes nothing; manifest valid
  with required fields and existing icons; README has the play URL, "Qwen", "Codex", "Claude", "Press Start 2P".
- **originality**: no tracked text file matches banned franchise names (pattern built from char codes).
- **page** (static index.html): viewport-fit=cover + user-scalable=no; manifest link, apple-touch-icon icon-180.png, og:image
  https://ishanroy2020.github.io/pixel-leap/og.png; scripts in order game.js, audio.js, controls.js, screens.js before the inline script, files
  exist; touch-action none, image-rendering pixelated, @font-face fonts/press-start-2p.woff2; no http(s) src/href, fetch(, XMLHttpRequest, eval(,
  new Function, innerHTML =.
