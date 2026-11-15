# Pixel Leap: expert ("savage") review, 2026-11-15

Requested by Ishan (Telegram voice note): the game still looks bad, graphics weak, music not right; thorough review of
graphics, pixel art and sound. Reviewer: game-tester agent, playtest evidence pt3 (3 viewports + 4x CPU; Meadow only).

## Verdict
Looks like a 2013 tutorial game, not a 2020s retro platformer: flat gradient sky with a square sun, 3-rectangle clouds,
two identical brown slabs for ground; 54% of a portrait phone screen is black; Pip reads as a teal ghost blob; the
enemy is a grey tin can. Music is a ~6 s pentatonic square loop whose bass drops out every cycle, with no percussion.
Frame pacing (60 fps everywhere, also under 4x CPU) and the jump code are good. Art and audio need a rebuild.

## Scores (1-10)
Art direction 3 · Pixel craft 3 · Character design/animation 3 · Environment 3 · UI/HUD 4 · Game feel 5 ·
Music 2 · Sound effects 3 · Mobile 3.

## Top 15 problems (most "cheap" first)
1. Black void under the portrait view and letterbox bars on all sides elsewhere (fill everything; themed panel).
2. Hero silhouette: eyes low, orange band at the neck, no readable legs (index.html:169-212).
3. No juice: no hit-stop, shake, dust, shards, pop-ups, squash/stretch.
4. Music has no drums or rhythm section: no noise source in audio.js.
5. Loops structurally broken (audio.js:69-111): meadow lead 14.5 beats vs bass 11; sky bass 8 vs lead 15; caverns 15 vs 16;
   not bar-aligned. Write every lane as whole 4/4 bars (8-16 bars, 30-60 s).
6. Rests act as ties (compileLane, audio.js:305-332): no silence, no staccato or syncopation.
7. One envelope for everything (audio.js:178-200): need per-voice envelopes and duty cycles.
8. Melody: one repeated C-E-G-C arpeggio, no answer phrase or dynamics; sky saw lead up to G6 is harsh on phones;
   caverns sine bass at gain 0.13 is inaudible on phone speakers.
9. SFX: thin identical jump sweep; gem not a bright chime; break/stomp lack noise (buzz, not thud); death is a
   slide-whistle; level-clear 0.4 s is too short.
10. Enemies: grey tin-can Grumble, 2-frame Buzzer (index.html:215-250).
11. Gem spin faked by per-row scaling (index.html:475-493): ragged shimmering edges.
12. Square sun, 3-rect clouds (index.html:422, 442).
13. Flat tiles: no corner caps, ledge shadow, grass overhang or variants.
14. HUD: no panel, four competing colours, no icons or pop animation; hearts overlap a cloud.
15. Title: flat navy box, dim prompt, no logo, hero or title music (index.html:690-705).
Bugs: fractional portrait scale 4.875 (index.html:129) causes seams between dirt tiles; hill shapes poke into pits;
pits show light sky so they read as scenery, not danger.

## What great looks like
Graphics: 20-32 colour game palette; self-colour dark outlines, light from the upper left; readable 16x18 hero with
6-frame run, rise/apex/fall, scarf physics, squash and stretch; tiles with 3-4 dirt variants, corner caps, grass overhang,
2-px ledge shadow; 3 parallax layers with haze, drifting clouds, foreground layer; props (flowers, bushes, signs, goal
gate); pits as dark void or hazard; no black anywhere; integer scale only; sprites baked once.
Audio (original, never copied from any existing game): 140-160 bpm, major key, bright bouncy swung eighths; 4 channels
(lead square 25/50% duty, harmony/arp square 12.5%, triangle bass, noise drums); I-vi-IV-V in an 8-16 bar A-A-B-A loop;
call-and-response lead (2-bar question, 2-bar answer); syncopated octave-walking bass; hi-hat 8ths, snare 2 and 4, kick
1 and 3; 30-45 s before repeat with a varied second pass; separate title theme, ~2 s level-clear fanfare, ~1.5 s falling
death jingle, game-over theme; SFX: rising jump sweep scaled to jump height, ringing two-note coin chime, stomp = noise
thud + short down-sweep, 8-note power-up arpeggio, noise components for hurt/bump/break; mix with separate music/SFX
gain, master compressor/limiter, ~3 dB ducking under SFX; separate music and SFX volume/mute.

## Gaps in docs/DESIGN_V2.md
Audio is entirely missing (biggest gap). Also: explicit no-seam acceptance at every viewport; pit/hazard, goal flag,
checkpoint and decor art; HUD text readability (outline or shadow); touch-button art and haptics; the final gate checks
pacing, not looks: add a visual acceptance checklist and screenshots of all three worlds.
