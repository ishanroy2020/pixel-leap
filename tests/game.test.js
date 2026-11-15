"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../game.js");

const DT = 1 / 60;
const W = 40;
const ROWS = P.VIEW_TILES_H;

// Build a 15-row fixture from a few rows of content sitting directly above a
// solid ground row: every row is padded with dots to 40 columns and any spare
// rows are added as empty sky at the top.
function fixture(content, ground) {
  const pad = (r) => (r + ".".repeat(W)).slice(0, W);
  const body = content.map(pad);
  const rows = [];
  for (let i = 0; i < ROWS - 1 - body.length; i++) rows.push(".".repeat(W));
  for (const r of body) rows.push(r);
  rows.push(pad(ground === undefined ? "#".repeat(W) : ground));
  return rows;
}

function game(content, options) {
  const opts = options || {};
  return P.createGame({
    rows: fixture(content, opts.ground),
    level: opts.level || 0,
    lives: typeof opts.lives === "number" ? opts.lives : 3,
    viewWidth: opts.viewWidth,
  });
}

function run(state, input, seconds) {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) P.step(state, input, DT);
  return state;
}

const STILL = { left: false, right: false, jump: false };
const RIGHT = { left: false, right: true, jump: false };
const JUMP = { left: false, right: false, jump: true };

test("parseLevel: start, enemy and gem lists, S/o/g/b cleared, F kept", () => {
  const parsed = P.parseLevel(fixture(["...o..g...b.......F..S"]));
  assert.equal(parsed.height, ROWS);
  assert.equal(parsed.width, W);
  const row = ROWS - 2;
  assert.deepEqual(parsed.start, {
    x: 21 * P.TILE + (P.TILE - 12) / 2,
    y: (row + 1) * P.TILE - 14,
  });
  assert.deepEqual(parsed.gems, [{ x: 3 * P.TILE + 8, y: row * P.TILE + 8 }]);
  assert.equal(parsed.enemies.length, 2);
  assert.equal(parsed.enemies[0].kind, "grumble");
  assert.deepEqual(
    { w: parsed.enemies[0].w, h: parsed.enemies[0].h },
    { w: 14, h: 14 }
  );
  assert.equal(parsed.enemies[1].kind, "buzzer");
  assert.equal(parsed.enemies[1].baseY, parsed.enemies[1].y);
  const flat = parsed.tiles.map((r) => r.join("")).join("");
  for (const ch of "Sogb") {
    assert.equal(flat.includes(ch), false, ch + " cleared");
  }
  assert.equal(parsed.tiles[row][18], "F");
  const st = { width: parsed.width, height: parsed.height, tiles: parsed.tiles };
  assert.equal(P.solidAt(st, 18, row), false, "F is not solid");
});

test("a held jump rises at least 3 tiles, a tapped jump rises less", () => {
  const held = game(["...................S...."]);
  const y0 = held.player.y;
  let heldRise = 0;
  for (let i = 0; i < 120; i++) {
    P.step(held, JUMP, DT);
    heldRise = Math.max(heldRise, y0 - held.player.y);
  }
  assert.ok(heldRise >= 3 * P.TILE, "held jump rises " + heldRise.toFixed(1) + "px");

  const tapped = game(["...................S...."]);
  const ty0 = tapped.player.y;
  let tappedRise = 0;
  for (let i = 0; i < 180; i++) {
    P.step(tapped, { left: false, right: false, jump: i === 0 }, DT);
    tappedRise = Math.max(tappedRise, ty0 - tapped.player.y);
  }
  assert.ok(tappedRise < heldRise, "tapped jump is shorter");
  assert.ok(tappedRise < 2 * P.TILE, "tapped jump stays under 2 tiles");
});

// A 4-tile-high brick platform to walk off; used for coyote and buffer timing.
const LEDGE = [
  ".....S..................................",
  ".....BBBB...............................",
  ".....BBBB...............................",
  ".....BBBB...............................",
  ".....BBBB...............................",
];

// Run right until the player leaves the platform; returns the game state.
function walkOffLedge() {
  const st = game(LEDGE);
  assert.equal(st.player.onGround, true);
  for (let i = 0; i < 240 && st.player.onGround; i++) P.step(st, RIGHT, DT);
  assert.equal(st.player.onGround, false, "player walked off the ledge");
  return st;
}

test("coyote time: jumping shortly after leaving the ledge still jumps", () => {
  const st = walkOffLedge();
  const y0 = st.player.y;
  let rose = false;
  // 5 frames (about 0.08s) of pure fall, then hold jump.
  run(st, STILL, 5 * DT);
  for (let i = 0; i < 30; i++) {
    P.step(st, JUMP, DT);
    if (st.player.vy < 0) rose = true;
  }
  assert.equal(rose, true, "coyote jump fired mid-air");
  assert.ok(st.player.y < y0, "player climbed back above the ledge level");
});

test("coyote time: after the 0.1s window the same late press does not jump", () => {
  const st = walkOffLedge();
  const y0 = st.player.y;
  run(st, STILL, 8 * DT); // 0.133s of fall: coyote and buffer windows both closed
  let rose = false;
  for (let i = 0; i < 30; i++) {
    P.step(st, { left: false, right: false, jump: i < 2 }, DT);
    if (st.player.vy < 0) rose = true;
  }
  assert.equal(rose, false, "no jump outside the coyote window");
  assert.ok(st.player.y > y0, "the player kept falling");
  assert.equal(st.player.onGround, true, "landed on the floor");
});

// A tall brick pillar: running off its top gives a long fall, which separates
// the coyote window (0.1s) from the jump buffer (0.12s) cleanly.
const TOWER = ["..........S........."].concat(
  Array.from({ length: ROWS - 2 }, () => "..........BBBB......")
);

// Run off the top of the pillar; measure the fall, then press jump
// framesBeforeLanding frames before touchdown (after the coyote window closed).
function towerPress(framesBeforeLanding, holdFrames) {
  const ref = game(TOWER);
  for (let i = 0; i < 240 && ref.player.onGround; i++) P.step(ref, RIGHT, DT);
  let fall = 0;
  while (!ref.player.onGround && fall < 400) {
    P.step(ref, STILL, DT);
    fall += 1;
  }

  const st = game(TOWER);
  for (let i = 0; i < 240 && st.player.onGround; i++) P.step(st, RIGHT, DT);
  const pressAt = fall - framesBeforeLanding;
  let jumped = false;
  for (let i = 0; i < fall + 60; i++) {
    const press = i >= pressAt && i < pressAt + holdFrames;
    P.step(st, { left: false, right: false, jump: press }, DT);
    if (st.player.vy < -400) jumped = true;
  }
  return { st, jumped, fall };
}

test("jump buffer: pressing jump just before landing still jumps on touchdown", () => {
  const { st, jumped, fall } = towerPress(4, 1);
  assert.ok(fall > 12, "the pillar fall is long enough to isolate the buffer");
  assert.equal(jumped, true, "buffered jump released on landing");
  assert.equal(st.mode, "playing");
});

test("jump buffer: a press outside the 0.12s window does not jump", () => {
  const { st, jumped, fall } = towerPress(12, 1); // pressed about 0.2s early
  assert.ok(fall > 12, "the pillar fall is long enough to isolate the buffer");
  assert.equal(jumped, false, "buffer expired before landing");
  assert.equal(st.mode, "playing");
});

test("head-bump a ? block: becomes U, +1 gem, +100 score, event gem", () => {
  const st = game([
    "...................?..........................",
    "..........................................",
    "..........................................",
    "...................S..........................",
  ]);
  const log = [];
  for (let i = 0; i < 60; i++) {
    P.step(st, JUMP, DT);
    log.push(...st.events.splice(0, st.events.length));
  }
  assert.deepEqual(log, ["gem"]);
  assert.equal(st.tiles[10][19], "U");
  assert.equal(st.gems, 1);
  assert.equal(st.score, 100);
  assert.equal(st.player.onGround, true, "the player landed back down");
});

test("brick: small gives event bump with the tile intact, big breaks it for 50", () => {
  const rows = [
    "...................B..........................",
    "..........................................",
    "...................S..........................",
  ];
  const small = game(rows);
  const smallLog = [];
  for (let i = 0; i < 60; i++) {
    P.step(small, JUMP, DT);
    smallLog.push(...small.events.splice(0, small.events.length));
  }
  assert.deepEqual(smallLog, ["bump"]);
  assert.equal(small.tiles[11][19], "B", "small Pip cannot break a brick");
  assert.equal(small.score, 0);

  const big = game(rows);
  big.player.big = true;
  big.player.h = 24;
  big.player.y -= 24 - 14; // keep the feet on the floor
  const bigLog = [];
  for (let i = 0; i < 60; i++) {
    P.step(big, JUMP, DT);
    bigLog.push(...big.events.splice(0, big.events.length));
  }
  assert.deepEqual(bigLog, ["break"]);
  assert.equal(big.tiles[11][19], ".");
  assert.equal(big.score, 50);
});

test("a P block spawns a Sprout that makes Pip big when collected", () => {
  const st = game([
    "...................P..........................",
    "..........................................",
    "..........................................",
    "...................S..........................",
  ]);
  const log = [];
  for (let i = 0; i < 40; i++) {
    P.step(st, JUMP, DT);
    log.push(...st.events.splice(0, st.events.length));
  }
  assert.deepEqual(log, ["sprout"], "bumping P only spawns the Sprout");
  assert.equal(st.tiles[10][19], "U");
  assert.equal(st.items.length, 1);
  assert.equal(st.items[0].kind, "sprout");
  assert.equal(st.player.big, false, "still small until the Sprout is touched");

  // Chase the sliding Sprout along the floor.
  let frames = 0;
  while (st.items.length && frames < 600) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    frames += 1;
  }
  assert.equal(st.items.length, 0, "the Sprout was collected");
  assert.deepEqual(log, ["sprout", "powerup"]);
  assert.equal(st.player.big, true);
  assert.equal(st.player.h, 24);
  assert.equal(st.player.y + st.player.h, 14 * P.TILE, "feet stay on the floor");
  assert.equal(st.score, 1000);
});

test("hurt while big makes Pip small with invulnerability, not death", () => {
  const st = game([
    "...................P..........................",
    "..........................................",
    "..........................................",
    "...................S..........................",
    "....................................g.......",
  ]);
  const log = [];
  for (let i = 0; i < 40; i++) {
    P.step(st, JUMP, DT);
    log.push(...st.events.splice(0, st.events.length));
  }
  let frames = 0;
  while (st.items.length && frames < 600) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    frames += 1;
  }
  assert.equal(st.player.big, true, "big before the hit");
  const feetBefore = st.player.y + st.player.h;

  // Run into the Grumble from the side.
  for (let i = 0; i < 400; i++) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    if (log.includes("hurt") || st.mode !== "playing") break;
  }
  assert.ok(log.includes("hurt"), "took a hit instead of dying");
  assert.equal(st.mode, "playing", "big Pip survives the hit");
  assert.equal(st.player.big, false);
  assert.equal(st.player.h, 14);
  assert.equal(st.player.y + st.player.h, feetBefore, "feet kept their position");
  assert.ok(st.player.invuln > 0, "invulnerability started");
  assert.ok(st.player.invuln <= 1.5, "invulnerability lasts 1.5s");

  // Contact during invulnerability is ignored.
  const enemy = st.enemies[0];
  enemy.alive = true;
  enemy.vx = 0;
  enemy.x = st.player.x;
  enemy.y = st.player.y + st.player.h - 14;
  P.step(st, STILL, DT);
  assert.equal(st.mode, "playing", "still alive during invulnerability");
});

// Pip stands on a 4-tile pillar and walks off it onto a Grumble below: a stomp.
const STOMP_ROWS = [
  ".....S........................................",
  ".....BBBB.....................................",
  ".....BBBB.....................................",
  ".....BBBB.....................................",
  ".....BBBB....g................................",
];

test("stomping a Grumble from above kills it and bounces Pip", () => {
  const st = game(STOMP_ROWS);
  const log = [];
  for (let i = 0; i < 300; i++) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    if (log.length) break;
  }
  assert.deepEqual(log, ["stomp"]);
  assert.equal(st.enemies[0].alive, false);
  assert.equal(st.score, 200);
  assert.ok(st.player.vy < 0, "Pip bounces upward");
  assert.equal(st.mode, "playing");
});

// A Grumble three tiles to the right on the floor: small Pip runs into its side.
const SIDE_ROWS = [
  "..........................................",
  "..........................................",
  "..........................................",
  "...................S........g.............",
];

// Step through the "dying" pause and report what happened.
function waitOutDying(st, log) {
  let frames = 0;
  while (st.mode === "dying" && frames < 400) {
    P.step(st, STILL, DT);
    log.push(...st.events.splice(0, st.events.length));
    frames += 1;
  }
  return frames;
}

test("side contact when small: dying, then a life is lost and the level reloads", () => {
  const st = game(SIDE_ROWS);
  st.gems = 3;
  st.score = 500;
  const log = [];
  for (let i = 0; i < 400; i++) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    if (st.mode !== "playing") break;
  }
  assert.deepEqual(log, ["die"], "small Pip dies on side contact");
  assert.equal(st.mode, "dying");
  const livesBefore = st.lives;

  const frames = waitOutDying(st, log);
  assert.ok(frames >= Math.round(1.2 / DT) - 2, "the death animation lasts about 1.2s");
  assert.equal(st.lives, livesBefore - 1, "one life was lost");
  assert.equal(st.mode, "playing", "the level reloaded");
  assert.equal(st.player.big, false);
  assert.equal(st.time, 300, "the clock was reset");
  assert.equal(st.score, 500, "score is kept");
  assert.equal(st.gems, 3, "gem count is kept");
  assert.equal(st.player.x, st.start.x, "Pip is back at the start");
  assert.equal(st.player.y, st.start.y, "Pip is back at the start");
  assert.equal(st.gemList.every((g) => g.taken === false), true, "gems respawned");
});

test("touching spikes kills Pip", () => {
  const rows = ["..........................................", "..........................................", "..........................................", "...................S........^............."];
  const st = game(rows);
  const log = [];
  for (let i = 0; i < 400; i++) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    if (st.mode !== "playing") break;
  }
  assert.deepEqual(log, ["die"]);
  assert.equal(st.mode, "dying");
});

test("falling below the bottom of the level kills Pip", () => {
  // A hole in the ground row just ahead of the start tile.
  const ground = "#".repeat(20) + ".".repeat(20);
  const st = game(["...................S.........................."], { ground });
  const log = [];
  for (let i = 0; i < 400; i++) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    if (st.mode !== "playing") break;
  }
  assert.ok(log.includes("die"), "falling into the pit is fatal");
  assert.equal(st.mode, "dying");
  assert.ok(st.player.y > st.height * P.TILE, "Pip fell past the bottom row");
});

test("the clock counting down to zero kills Pip", () => {
  const st = game(["...................S.........................."]);
  st.time = 0.2;
  const log = [];
  for (let i = 0; i < 200; i++) {
    P.step(st, STILL, DT);
    log.push(...st.events.splice(0, st.events.length));
    if (st.mode !== "playing") break;
  }
  assert.ok(log.includes("die"), "time running out is fatal");
  assert.equal(st.mode, "dying");
  assert.equal(st.time, 0);
});

test("losing the last life gives mode gameover with the gameover event", () => {
  const st = game(SIDE_ROWS, { lives: 1 });
  const log = [];
  for (let i = 0; i < 400; i++) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    if (st.mode !== "playing") break;
  }
  assert.equal(st.mode, "dying");
  waitOutDying(st, log);
  assert.equal(st.lives, 0);
  assert.equal(st.mode, "gameover");
  assert.ok(log.includes("gameover"), "the gameover event fired");

  // step does nothing in gameover.
  const timeBefore = st.time;
  run(st, RIGHT, 0.5);
  assert.equal(st.mode, "gameover");
  assert.equal(st.time, timeBefore);
  assert.equal(st.events.length, 0);
});

test("restart starts a fresh game on the same object", () => {
  const st = game(SIDE_ROWS, { lives: 1 });
  const log = [];
  for (let i = 0; i < 400; i++) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    if (st.mode !== "playing") break;
  }
  waitOutDying(st, log);
  assert.equal(st.mode, "gameover");
  P.restart(st);
  assert.equal(st.mode, "playing");
  assert.equal(st.lives, 3);
  assert.equal(st.score, 0);
  assert.equal(st.gems, 0);
  assert.equal(st.time, 300);
  assert.equal(st.player.big, false);
});

test("reaching the beacon clears the level with a time bonus", () => {
  const st = game(["...................S.......o......F..........."]);
  st.time = 30;
  const log = [];
  for (let i = 0; i < 400; i++) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    if (st.mode !== "playing") break;
  }
  assert.equal(st.mode, "levelclear");
  assert.ok(log.includes("gem"), "the gem on the way was collected");
  assert.ok(log.includes("goal"), "the beacon fired the goal event");
  assert.equal(st.score, 100 + Math.floor(st.time) * 10, "time bonus applied");

  // step does nothing else once the level is cleared.
  const score = st.score;
  const x = st.player.x;
  run(st, RIGHT, 0.5);
  assert.equal(st.score, score);
  assert.equal(st.player.x, x);
});

test("nextLevel advances after a clear and wins after the final level", () => {
  const st = game(["...................S.......o......F..........."]);
  const log = [];
  for (let i = 0; i < 400; i++) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    if (st.mode !== "playing") break;
  }
  assert.equal(st.mode, "levelclear");

  // nextLevel only acts on a cleared level.
  const still = game(["...................S.........................."]);
  P.nextLevel(still);
  assert.equal(still.mode, "playing", "a playing level is left alone");
  assert.equal(still.level, 0);

  const last = P.LEVELS.length - 1;
  P.nextLevel(st);
  if (last >= 1) {
    assert.equal(st.level, 1, "the next level was loaded");
    assert.equal(st.mode, "playing", "the next level starts playing");
    assert.equal(st.time, 300, "a fresh clock");
  } else {
    // Only one level exists for now: clearing it ends the game.
    assert.equal(st.mode, "won");
  }

  // Clearing the final level ends the game.
  const final = P.createGame({ level: last, lives: 3 });
  final.mode = "levelclear";
  const finalLog = [];
  P.nextLevel(final);
  finalLog.push(...final.events.splice(0, final.events.length));
  assert.equal(final.level, last, "the level index stops at the last level");
  assert.equal(final.mode, "won");
  assert.ok(finalLog.includes("won"), "the won event fired");

  // step does nothing once the game is won.
  const score = final.score;
  run(final, RIGHT, 0.5);
  assert.equal(final.mode, "won");
  assert.equal(final.score, score);
});

test("solidAt treats the left, right and top edges as solid and the bottom as open", () => {
  const parsed = P.parseLevel(fixture(["...................S.........................."]));
  const st = { width: parsed.width, height: parsed.height, tiles: parsed.tiles };
  assert.equal(P.solidAt(st, 5, 14), true, "the ground row is solid");
  assert.equal(P.solidAt(st, 5, 13), false, "the row above the ground is empty");
  assert.equal(P.solidAt(st, -1, 13), true, "outside the left edge");
  assert.equal(P.solidAt(st, W, 13), true, "outside the right edge");
  assert.equal(P.solidAt(st, 5, -1), true, "above the top edge");
  assert.equal(P.solidAt(st, 5, ROWS), false, "below the bottom is not solid");
  assert.equal(P.solidAt(st, 3, 0), false, "empty sky is not solid");
});

test("a touched gem scores 100 and every 100 gems awards a life", () => {
  const st = game(["...................S.........o.................."]);
  st.gems = 99;
  const log = [];
  for (let i = 0; i < 200; i++) {
    P.step(st, RIGHT, DT);
    log.push(...st.events.splice(0, st.events.length));
    if (st.lives > 3) break;
  }
  assert.deepEqual(log, ["gem", "life"]);
  assert.equal(st.gems, 100);
  assert.equal(st.lives, 4, "the 100th gem awarded a life");
  assert.equal(st.gemList[0].taken, true, "the gem is gone");
  assert.equal(st.score, 100, "only the gem score was added");
});

test("every LEVELS entry is well formed", () => {
  assert.equal(P.TILE, 16);
  assert.ok(P.LEVELS.length >= 1);
  for (const level of P.LEVELS) {
    assert.equal(level.rows.length, ROWS, level.name + " rows");
    assert.equal(new Set(level.rows.map((r) => r.length)).size, 1, level.name + " widths");
    const width = level.rows[0].length;
    assert.ok(width >= 120, level.name + " width >= 120");
    const marks = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < width; x++) marks.push([x, y, level.rows[y][x]]);
    }
    const s = marks.filter((m) => m[2] === "S");
    const f = marks.filter((m) => m[2] === "F");
    assert.equal(s.length, 1, level.name + ": exactly one S");
    assert.equal(f.length, 1, level.name + ": exactly one F");
    const st = { width, height: ROWS, tiles: level.rows.map((r) => r.split("")) };
    assert.equal(P.solidAt(st, s[0][0], s[0][1] + 1), true, level.name + ": ground under S");
    assert.equal(P.solidAt(st, f[0][0], f[0][1] + 1), true, level.name + ": ground under F");
    let streak = 0;
    let maxStreak = 0;
    for (const ch of level.rows[ROWS - 1]) {
      streak = ch === "." ? streak + 1 : 0;
      maxStreak = Math.max(maxStreak, streak);
    }
    assert.ok(maxStreak <= 4, level.name + ": bottom gap " + maxStreak + " > 4");
  }
});

test("standing still on ground stays on ground", () => {
  const st = game(["...................S...."]);
  const y0 = st.player.y;
  const x0 = st.player.x;
  run(st, STILL, 1);
  assert.equal(st.player.y, y0);
  assert.equal(st.player.x, x0);
  assert.equal(st.player.vy, 0);
  assert.equal(st.player.vx, 0);
  assert.equal(st.player.onGround, true);
  assert.equal(st.mode, "playing");
});

test("holding right accelerates to max 150 and not beyond", () => {
  const st = game(["...................S...."]);
  let peak = 0;
  for (let i = 0; i < 40; i++) {
    P.step(st, RIGHT, DT);
    peak = Math.max(peak, st.player.vx);
  }
  assert.ok(peak <= 150 + 1e-9, "never exceeds max run speed");
  assert.ok(st.player.vx > 149.999, "reaches 150");
  assert.equal(st.player.facing, 1);
  const x1 = st.player.x;
  run(st, RIGHT, 0.2);
  assert.ok(st.player.x > x1, "keeps moving right");
});
