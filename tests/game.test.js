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

test("LEVELS holds the three spec levels with their names and themes", () => {
  assert.equal(P.LEVELS.length, 3, "three levels");
  assert.deepEqual(
    P.LEVELS.map((l) => [l.name, l.theme]),
    [
      ["Meadow", "meadow"],
      ["Caverns", "caverns"],
      ["Sky Isles", "sky"],
    ]
  );
});

// The seven solid legend characters, and the biggest step up the spec allows.
const SOLID_CHARS = new Set(["#", "B", "?", "P", "U"]);
const MAX_STEP_UP = 3;

// The topmost solid row of a column, considering only ground rows (the builder
// puts floating platforms higher up, at row 9).
function groundTop(rows, x) {
  for (let y = 10; y < ROWS; y++) {
    if (SOLID_CHARS.has(rows[y][x])) return y;
  }
  return null;
}

// Contiguous runs of columns that have ground, as {from, to, top}.
function groundRuns(rows) {
  const width = rows[0].length;
  const runs = [];
  let run = null;
  for (let x = 0; x < width; x++) {
    const top = groundTop(rows, x);
    if (top === null) {
      if (run) runs.push(run);
      run = null;
      continue;
    }
    if (run && run.top === top && run.to === x - 1) run.to = x;
    else {
      if (run) runs.push(run);
      run = { from: x, to: x, top };
    }
  }
  if (run) runs.push(run);
  return runs;
}

test("every LEVELS entry is well formed", () => {
  assert.equal(P.TILE, 16);
  assert.equal(P.LEVELS.length, 3);
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

test("every level carries the required items, gems and enemies", () => {
  for (const level of P.LEVELS) {
    const flat = level.rows.join("");
    const count = (ch) => flat.split(ch).length - 1;
    assert.ok(count("?") >= 6, level.name + ": " + count("?") + " spark blocks < 6");
    assert.ok(count("P") >= 2, level.name + ": " + count("P") + " Sprout blocks < 2");
    assert.ok(count("o") >= 30, level.name + ": " + count("o") + " gems < 30");
    assert.ok(
      count("g") + count("b") >= 6,
      level.name + ": " + (count("g") + count("b")) + " enemies < 6"
    );
  }

  // The characters used anywhere are only the documented legend.
  const LEGEND = new Set([".", "#", "B", "?", "P", "U", "o", "g", "b", "^", "S", "F"]);
  for (const level of P.LEVELS) {
    for (const ch of level.rows.join("")) {
      assert.equal(LEGEND.has(ch), true, level.name + ": illegal tile '" + ch + "'");
    }
  }
});

test("level difficulties follow the spec", () => {
  const rowsOf = (i) => P.LEVELS[i].rows;
  const countIn = (rows, ch) => rows.join("").split(ch).length - 1;

  // Level 1 is gentle: only 2-tile gaps and no spikes.
  const bottomRow = (rows) => rows[ROWS - 1];
  const maxBottomGap = (rows) => {
    let best = 0;
    let streak = 0;
    for (const ch of bottomRow(rows)) {
      streak = ch === "." ? streak + 1 : 0;
      best = Math.max(best, streak);
    }
    return best;
  };
  assert.equal(maxBottomGap(rowsOf(0)), 2, "Meadow sticks to 2-tile gaps");
  assert.equal(countIn(rowsOf(0), "^"), 0, "Meadow has no spikes");

  // Level 2 has a low ceiling and ground spikes, never more than 3 in a row.
  assert.ok(countIn(rowsOf(1), "^") > 0, "Caverns has spikes");
  assert.ok(countIn(rowsOf(1), "#") > 0);
  let spikeRun = 0;
  let worstSpikeRun = 0;
  for (const ch of rowsOf(1).join("")) {
    spikeRun = ch === "^" ? spikeRun + 1 : 0;
    worstSpikeRun = Math.max(worstSpikeRun, spikeRun);
  }
  assert.ok(worstSpikeRun <= 3, "Caverns spike bed " + worstSpikeRun + " > 3 (not jumpable)");
  // A low ceiling exists: solid tiles in the upper half of the map.
  assert.ok(
    rowsOf(1)
      .slice(0, 9)
      .some((r) => r.includes("#")),
    "Caverns has a low ceiling"
  );

  // Level 3 has many wide gaps and a swarm of Buzzers.
  const wideGaps = [];
  let gap = 0;
  for (const ch of bottomRow(rowsOf(2))) {
    if (ch === ".") gap += 1;
    else {
      if (gap >= 3) wideGaps.push(gap);
      gap = 0;
    }
  }
  if (gap >= 3) wideGaps.push(gap);
  assert.ok(wideGaps.length >= 8, "Sky Isles has " + wideGaps.length + " wide gaps");
  assert.ok(countIn(rowsOf(2), "b") >= 5, "Sky Isles Buzzers " + countIn(rowsOf(2), "b"));
  assert.ok(
    rowsOf(2)
      .slice(9, 12)
      .some((r) => r.includes("#")),
    "Sky Isles has floating platforms"
  );
});

test("no level steps up more than 3 tiles between neighbouring ground runs", () => {
  for (const level of P.LEVELS) {
    const runs = groundRuns(level.rows);
    for (let i = 1; i < runs.length; i++) {
      const prev = runs[i - 1];
      const next = runs[i];
      const gapWidth = next.from - prev.to - 1;
      // Only a reachable neighbour counts as a step: beyond a jumpable gap the
      // level designer is free to change height.
      if (gapWidth > 4) continue;
      const up = prev.top - next.top;
      assert.ok(up <= MAX_STEP_UP, level.name + ": step up " + up + " at column " + next.from);
    }
  }
});

test("every Grumble stands on a solid tile and nothing sits inside solid rock", () => {
  for (const level of P.LEVELS) {
    const rows = level.rows;
    const width = rows[0].length;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < width; x++) {
        const ch = rows[y][x];
        if (ch === "g") {
          const below = y + 1 < ROWS ? rows[y + 1][x] : ".";
          assert.equal(SOLID_CHARS.has(below), true, level.name + ": unsupported Grumble at " + x + "," + y);
        }
        if (ch === "^") {
          const below = y + 1 < ROWS ? rows[y + 1][x] : ".";
          assert.equal(SOLID_CHARS.has(below), true, level.name + ": floating spikes at " + x + "," + y);
        }
        if ("S Fogb^o".includes(ch)) {
          assert.equal(SOLID_CHARS.has(ch), false, level.name + ": solid legend clash");
        }
      }
    }
  }
});

test("spark blocks sit 4 tiles above the floor they are reached from", () => {
  for (const level of P.LEVELS) {
    const rows = level.rows;
    const width = rows[0].length;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < width; x++) {
        const ch = rows[y][x];
        if (ch !== "?" && ch !== "P") continue;
        // The tile directly below a block must be empty (nothing to stand on
        // inside the rock) and the block must be high enough to bump from.
        assert.equal(rows[y + 1][x], ".", level.name + ": block at " + x + "," + y + " is buried");
        assert.ok(y >= 1 && y <= ROWS - 6, level.name + ": block row " + y + " is unreachable");
        // Somewhere under the block there is a floor to jump from.
        let floor = null;
        for (let yy = y + 1; yy < ROWS; yy++) {
          if (SOLID_CHARS.has(rows[yy][x])) {
            floor = yy;
            break;
          }
        }
        assert.ok(floor !== null, level.name + ": no floor under the block at " + x + "," + y);
        assert.equal(floor - y, 4, level.name + ": block at " + x + "," + y + " is " + (floor - y) + " above its floor");
      }
    }
  }
});

test("nextLevel walks 0 -> 1 -> 2 and then reports won", () => {
  const st = P.createGame({ level: 0, lives: 3 });
  assert.equal(st.level, 0);
  assert.equal(st.mode, "playing");
  const seen = [];
  for (let expected = 1; expected < P.LEVELS.length; expected++) {
    st.mode = "levelclear";
    const log = [];
    P.nextLevel(st);
    log.push(...st.events.splice(0, st.events.length));
    assert.equal(st.level, expected, "advanced to level " + expected);
    assert.equal(st.mode, "playing", "level " + expected + " is playing");
    assert.equal(st.time, 300, "fresh clock for level " + expected);
    assert.equal(log.length, 0, "no event when a real level loads");
    assert.equal(st.player.big, false);
    seen.push(P.LEVELS[st.level].name);
  }
  assert.deepEqual(seen, ["Caverns", "Sky Isles"]);

  // Clearing the last level ends the game.
  st.mode = "levelclear";
  const log = [];
  P.nextLevel(st);
  log.push(...st.events.splice(0, st.events.length));
  assert.equal(st.mode, "won");
  assert.equal(st.level, P.LEVELS.length - 1, "the index stays on the last level");
  assert.ok(log.includes("won"), "the won event fired");
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
