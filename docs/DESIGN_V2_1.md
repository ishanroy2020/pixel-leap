# Pixel Leap DESIGN_V2.1 delta (game-designer, 2026-11-15)

Adds what docs/DESIGN_V2.md lacks after docs/REVIEW_2026-11-15_expert.md. Everything not listed here stays as in V2.
Builder for this round: **Codex** (Ishan, 2026-11-15); reviewer: **Claude** (code, security, originality); the
game-tester re-scores. All music and art must be ORIGINAL (public repo): never reproduce any existing game's music,
sound effects, characters, art or level layouts.

## 1. Audio lane
Modules (node-testable, no DOM): **music.js** (`PixelMusic`: song data -> timed notes), **songs.js** (`PixelSongs`:
data only), **audio.js** (keeps the `createAudio` API, becomes the engine).

Graph: voice -> laneGain -> musicBus | sfxBus -> master -> DynamicsCompressor (threshold -12, knee 6, ratio 4,
attack 0.003, release 0.15) -> destination. Ducking: each SFX ramps musicBus to x0.708 (-3 dB) with
setTargetAtTime(..., 0.015), restoring after the SFX length + 0.08 s (time constant 0.08). New API: setMusicMuted(b),
setSfxMuted(b), isMusicMuted(), isSfxMuted(); setMuted/toggleMute remain the master mute.

Voices: pulse waves via createPeriodicWave (32 harmonics, built once at unlock for duty 0.125, 0.25, 0.5:
real[n] = 2*sin(n*PI*d)/(n*PI), imag[n] = 0). Noise: one 1 s white-noise AudioBuffer made at unlock; each hit is a
looping BufferSource at a random offset -> BiquadFilter -> gain. Every voice has an envelope {a,d,s,r} and a gate
(sounding fraction of the note); rests are real silence. Music lanes are monophonic (a new note cuts the previous).
MAX_VOICES 32. Stinger events (die, goal, won, gameover) stop the music and play a one-shot song.

Song format (songs.js):
```js
meadow: { bpm:150, swing:0.58, bars:24,
  voices:{ lead:{wave:"pulse25",env:[.005,.08,.6,.03],gate:.7,vol:.16,vib:[.15,5.5,.18]},
           harm:{wave:"pulse12",env:[.003,.05,.4,.02],gate:.5,vol:.09,echo:null},
           bass:{wave:"triangle",env:[.002,0,1,.015],gate:.8,vol:.34},
           drums:{vol:1} },
  patterns:{ lead:{A:"C5:2 E5:2 r:2 G5:2 | ...", A2:"..."}, harm:{...}, bass:{...}, drums:{A:"k:2 h:2 s:2 h:2 | ..."} },
  order:[ {lead:"A",harm:"A",bass:"A",drums:"A"}, {lead:"A2", ...}, ... ] }   // each order entry = one 4-bar section
```
Tokens: `NOTE[:len]` with len in 16th steps (default 2), NOTE like C5, F#4, Bb3; `r` rest; `-` extends the previous
note; `|` ends a bar; every bar sums to exactly 16 steps. Drums: k kick, s snare, h closed hat, o open hat, r rest.
Swing: a note starting on a 16th index with index % 4 == 2 starts (swing - 0.5) beat late. Echo {steps:3, gain:.35}
replays the lead 3 sixteenths late on the harmony lane (Caverns). `compile(song)` -> {len, notes:[{t,dur,lane,midi|drum,vol}]};
a malformed bar throws an error naming lane, pattern and bar.

Drum kit: kick = triangle 150->50 Hz exponential over 0.09 s + noise click (300 Hz low-pass, 0.02 s); snare = noise
band-pass 1.8 kHz Q1 0.12 s + triangle 200 Hz 0.04 s; hat = noise high-pass 7 kHz 0.03 s vol 0.12; open hat = 6 kHz
high-pass 0.12 s.

Phone-speaker ranges: lead MIDI 67-86 (never above D6); harmony 60-79; triangle bass 43-62 at vol >= 0.34; no
sawtooth leads.

"Bouncy" rules for every theme: lead gate ~0.7 (short, detached); at least one syncopated push per 4 bars (a note on
the "and" of 4 tied over the bar line); bass walks root-octave-fifth-octave in 8ths; drums kick 1 and 3, snare 2 and 4,
hats on 8ths; call-and-response melody (2-bar question, 2-bar answer ending on the tonic); the second pass varies
harmony and drum fills.

| Song | Tempo / key | Progression | Structure / length | Character |
|---|---|---|---|---|
| Meadow | 150, F major, swing .58 | A: I-vi-IV-V; B: ii-V-iii-vi-ii-V-I | A A' B A'' C (drums+bass breakdown) A''' = 24 bars, ~38 s | sunny hop, arp in harmony |
| Caverns | 120, D Dorian, straight | i-VI-VII-V (Dm Bb C A) | A A' B A' = 16 bars, ~32 s | sparse staccato, echo lead, hats and rim only |
| Sky Isles | 160, G major with a Lydian II | A: I-II-IV-I; B: vi-IV-I-V | A A' B A'' C A = 24 bars, ~36 s | airy, pulse50 lead with vibrato, 16th arps on pulse12 |
| Title | 132, Bb major | I-iii-IV-V | A A' B A = 16 bars, ~29 s | welcoming, lighter drums |
| Level-clear | 170, C major | rising I-IV-V arpeggio, then I held on all lanes with a snare roll | ~2.0 s, no loop | triumphant |
| Death | 180 | 3 falling lead notes, short trill, bass falling an octave | ~1.5 s | comic, not sad |
| Game over | 90, A minor | i-iv-V-i | ~8 s, plays once | gentle |

Originality procedure: build melodies from motifs invented for this game; never start from a remembered tune; no phrase
may open with a well-known game or film motif; avoid the famous coin interval and power-up shapes. The reviewer and the
tester each answer "does any phrase resemble a known theme?" as part of acceptance.

SFX (f -> f2 = pitch sweep; vol ~0.2 unless noted):
| Event | Parts |
|---|---|
| jump | pulse25 300->720 Hz exponential 0.13 s; big Pip (play("jump",{big:true})) 240->600 Hz 0.16 s |
| gem | pulse12 A5 0.05 s -> C#6 0.05 s -> A6 0.28 s ringing decay |
| sprout | pulse12 392->784 Hz linear 0.4 s, 6 Hz vibrato |
| powerup | 8-note Cmaj7 arpeggio C5 E5 G5 B5 C6 E6 G6 C7, 0.035 s each, pulse25 doubled by triangle |
| stomp | noise 900 Hz low-pass 0.08 s + pulse50 220->90 Hz 0.1 s |
| bump | triangle 160->90 Hz 0.08 s + noise 600 Hz low-pass 0.04 s |
| break | noise band-pass 1.2 kHz 0.22 s + noise low-pass 0.12 s + triangle 120->50 Hz |
| hurt | pulse50 440->220 Hz 0.15 s + noise high-pass 0.06 s |
| life | pulse25 E6 G6 C7 E7, 0.05 s each |
| select / pause | pulse12 1047 Hz 0.04 s |
| land (vy > 300 only) | noise 400 Hz low-pass 0.04 s, vol 0.08 |
| die / goal / won / gameover | stingers: death jingle, 2 s fanfare (goal and won), game-over song |

## 2. Other gaps from the review
- **view.js** (`PixelView.compute(pxW,pxH,dpr,insets)` -> {S,w,h,offX,offY,bandPx,portrait}): node tests at 320x568,
  375x667, 390x844, 430x932, 844x390, 932x430, 768x1024, 1024x768, 1280x800, 1920x1080 at dpr 1, 2, 3: S integer >= 1,
  band + panel cover the whole screen, every tile edge on a whole device pixel. Playtest counts pure-black (#000000)
  pixels: must be 0 on every shot.
- **Pits and hazards:** pit columns filled from the floor line down with a gradient from the theme's dark dirt to deep
  (Meadow #1a0f0a, Caverns #05061a, Sky cloud abyss #3a2450 alpha 0.85); 1-px lit rim; backdrop hills masked out of pit
  columns. Spikes 16x16, 3 points, left highlight: Meadow bramble thorns, Caverns crystal shards, Sky brass; red-pink tips.
- **Goal gate:** the F tile is a 32x48 stone arch with a pulsing lantern star that lights up and casts rays on touch.
- **props.js** `plan(levelTiles, seed)` -> [{kind,x,y}]: only on grass tops with no entity, >= 2 tiles from pits and
  spikes, <= 1 per 3 tiles, no collisions. Meadow: flowers, bushes, fence, start signpost. Caverns: glowing mushrooms,
  stalactites, crystals. Sky: cloud puffs, pennants.
- **HUD text:** baked 8-direction 1-px #10142a outline; panel alpha 0.55; text >= 8 game px; white or yellow only.
- **Touch buttons (controls.js):** rounded 2-tone buttons >= 44 pt, alpha 0.5 at rest / 0.85 pressed, 2 px down when
  pressed; chevron icons and an up-chevron for jump; in portrait they sit on the underground panel;
  navigator.vibrate(10) only where it exists.
- **Enemies (original):** Grumble = round moss-backed pebble bug: body #d0683a, shade #8e3d22, outline #4a1d10, moss cap
  #6fbf4a with 2 tufts, angry brow #3a1608, alternating stub feet; Caverns tint slate #5866b8 with eyes #ffe36a; Sky
  lavender #b48ad8 with a cloud cap. Buzzer = oval pod-fly: body #ff6fa8, shade #b03a72, belly #ffd0e2, wings #dff6ff
  alpha 0.6, antenna with a #fff27a bulb. Gem: 6 hand-drawn frames (no row scaling).
- **Debug URL:** only index.html reads ?level=0|1|2 (and &big=1), clamps it and applies it at game start; game.js unchanged.
- **Visual gate (V-gate)** at 3 viewports, all three worlds (screens: title, mid-level, pit, goal, portrait HUD):
  1 no black pixels; 2 no seams; 3 Pip readable at 1x (eyes high, legs visible); 4 6-frame run in the burst;
  5 enemies readable on every backdrop; 6 pits read as danger; 7 3 parallax layers + foreground; 8 no hills inside pits;
  9 HUD readable over the brightest sky, no overlap; 10 buttons do not cover Pip in landscape; 11 goal gate visible
  from 1 screen away; 12 music has drums, loops with no gap, SFX duck audible; 13 60 fps under 4x CPU throttle.

## 3. Ordered tasks (this round: Codex builds, Claude reviews; index.html tasks strictly serial)
| batch | tasks | owned files | acceptance |
|---|---|---|---|
| C1 "fill + smooth" | D1, D2, T2a, T2 | index.html, tools/playtest.mjs, view.js, tests/view.test.js | ?level= works and clamps; playtest shoots all 3 worlds + black-pixel count; view tests above; 0 black pixels at 3 sizes; interpolated, camera-smoothed motion |
| C2 "Pip" | T3, T4, T5 | sprites.js, anim.js, tests, index.html | V2 sprite/animation specs; 6-frame run visible; scarf trails |
| C3 "music" | A1, A2, A3, A4, A5, A6, A7 | music.js, songs.js, audio.js, tests, index.html | format rules enforced; graph/buses/compressor/duck/mutes; all 7 songs per briefs (bar-exact, in range, stinger lengths +-10%); SFX table; mute cycles all / music off / all off |
| C4 "world" | T11, T12, T13, P1 | backdrop.js, tiles.js, props.js, tests, index.html | V-gate 6-8; pit void; 3 spike themes; 3-4 dirt variants; corner caps; props rules |
| C5 "cast" | T6, T7, T8, T9 | sprites.js, fx.js, tests, index.html | new enemies, 6-frame gem, goal gate, fx (dust, shards, pop-ups, shake, hit-stop) |
| C6 "polish" | T10, T14, B1, T15, T16 | game.js + tests + SPEC.md, hud.js, controls.js, screens.js, index.html | feel tuning; HUD; buttons; title/menus; full V-gate in all three worlds |
Tests A2/A3 must update by name: "every EVENT plays: one oscillator per part, sane times, gain envelope" (noise parts use
buffer sources: count per part), "setMusic schedules only within 0.25 s of currentTime" and "muting stops scheduled melody
notes and mutes the master gain" (behaviour kept, internals change).

## Risks
Originality of composed melodies (motif-first procedure + resemblance checks); iOS silent switch mutes Web Audio
(test with it off); PeriodicWave/noise CPU cost (32-voice cap, monophonic lanes mandatory); controls layout maths after
the view change.
