"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createCamera,
  reset,
  update,
  capture,
  blend,
  snap,
} = require("../camera.js");

const VIEW = { w: 195, h: 253 };
const LEVEL_W = 2000;

function playerAt(x, facing = 1, w = 12) {
  return { x, w, facing };
}

function run(cam, p, view, levelW, dt, n) {
  for (let i = 0; i < n; i += 1) update(cam, p, view, levelW, dt);
  return cam;
}

function steadyTarget(p, view, levelW) {
  const look = p.facing * 0.12 * view.w;
  return Math.max(
    0,
    Math.min(levelW - view.w, p.x + p.w / 2 - 0.42 * view.w + look),
  );
}

test("createCamera starts at rest", () => {
  assert.deepEqual(createCamera(), { x: 0, look: 0 });
});

test("reset snaps x to the clamped target", () => {
  const cam = createCamera();
  const p = playerAt(500);
  reset(cam, p, VIEW, LEVEL_W);
  assert.equal(cam.look, 0.12 * VIEW.w);
  assert.equal(cam.x, steadyTarget(p, VIEW, LEVEL_W));
});

test("reset clamps at the left edge", () => {
  const cam = createCamera();
  reset(cam, playerAt(10, -1), VIEW, LEVEL_W);
  assert.equal(cam.x, 0);
});

test("reset clamps at the right edge", () => {
  const cam = createCamera();
  reset(cam, playerAt(LEVEL_W - 20, 1), VIEW, LEVEL_W);
  assert.equal(cam.x, LEVEL_W - VIEW.w);
});

// Target for a camera whose lookahead is still at rest (createCamera look = 0).
function restingTarget(p, view, levelW) {
  return Math.max(0, Math.min(levelW - view.w, p.x + p.w / 2 - 0.42 * view.w));
}

test("eases toward a distant target instead of jumping to it", () => {
  // Created at rest (x = 0) and never reset(), so the target stays ~424 px away
  // and update() has to close the gap itself. Facing left keeps the lookahead
  // easing negative, so the target recedes by less than the chase closes per
  // step and the 0.5 s check measures convergence rather than a moving goal.
  const cam = createCamera();
  const p = playerAt(500, -1);
  const goal = steadyTarget(p, VIEW, LEVEL_W);
  assert.ok(
    restingTarget(p, VIEW, LEVEL_W) - cam.x >= 100,
    "player is not far enough right to test easing",
  );

  update(cam, p, VIEW, LEVEL_W, 1 / 60);
  assert.ok(
    cam.x > 0 && cam.x < restingTarget(p, VIEW, LEVEL_W),
    `first step did not move towards the target: ${cam.x}`,
  );
  assert.ok(
    Math.abs(goal - cam.x) > 50,
    `first step jumped within 50 px of the target: ${cam.x}`,
  );

  run(cam, p, VIEW, LEVEL_W, 1 / 60, 29);
  assert.ok(Math.abs(cam.x - goal) < 2, `off by ${Math.abs(cam.x - goal)}`);
});

test("never overshoots a target ahead of it", () => {
  const cam = createCamera();
  const p = playerAt(800);
  const goal = steadyTarget(p, VIEW, LEVEL_W);
  let prev = cam.x;
  for (let i = 0; i < 120; i += 1) {
    update(cam, p, VIEW, LEVEL_W, 1 / 60);
    assert.ok(cam.x >= prev - 1e-12, "camera moved backwards");
    assert.ok(cam.x <= goal + 1e-12, "camera overshot the target");
    prev = cam.x;
  }
});

test("never undershoots when the target is behind it", () => {
  const cam = createCamera();
  reset(cam, playerAt(800), VIEW, LEVEL_W);
  const p = playerAt(200);
  const goal = steadyTarget(p, VIEW, LEVEL_W);
  let prev = cam.x;
  for (let i = 0; i < 120; i += 1) {
    update(cam, p, VIEW, LEVEL_W, 1 / 60);
    assert.ok(cam.x <= prev + 1e-12, "camera moved forwards");
    assert.ok(cam.x >= goal - 1e-12, "camera undershot the target");
    prev = cam.x;
  }
});

test("clamps to [0, levelW - view.w]", () => {
  const cam = createCamera();
  run(cam, playerAt(0, -1), VIEW, LEVEL_W, 1 / 60, 180);
  assert.equal(cam.x, 0);
  run(cam, playerAt(LEVEL_W, 1), VIEW, LEVEL_W, 1 / 60, 180);
  const hi = LEVEL_W - VIEW.w;
  assert.ok(cam.x <= hi, `passed the right edge: ${cam.x}`);
  assert.ok(hi - cam.x < 1e-6, `never reached the edge: ${cam.x}`);
  // Exponential easing alone is asymptotic: the explicit clamp must pin x.
  reset(cam, playerAt(LEVEL_W - 6, 1), VIEW, LEVEL_W);
  assert.equal(cam.x, hi);
});

test("clamps when the level is shorter than the view", () => {
  const cam = createCamera();
  run(cam, playerAt(10), { w: 300, h: 253 }, 120, 1 / 60, 120);
  assert.equal(cam.x, 0);
});

test("60 steps of 1/60 and 120 steps of 1/120 end within 0.5 px", () => {
  const a = run(createCamera(), playerAt(640), VIEW, LEVEL_W, 1 / 60, 60);
  const b = run(createCamera(), playerAt(640), VIEW, LEVEL_W, 1 / 120, 120);
  assert.ok(Math.abs(a.x - b.x) < 0.5, `gap ${Math.abs(a.x - b.x)}`);
});

test("capture copies positions as plain data", () => {
  const state = {
    player: { x: 10, y: 20, vx: 5 },
    enemies: [{ x: 30, y: 40, alive: true }],
    items: [{ x: 50, y: 60, gem: true }],
  };
  const snapA = capture(state);
  assert.deepEqual(snapA, {
    player: { x: 10, y: 20 },
    enemies: [{ x: 30, y: 40 }],
    items: [{ x: 50, y: 60 }],
  });
  state.player.x = 999;
  state.enemies[0].x = 999;
  state.items[0].x = 999;
  assert.equal(snapA.player.x, 10);
  assert.equal(snapA.enemies[0].x, 30);
  assert.equal(snapA.items[0].x, 50);
});

test("blend at 0, 0.5 and 1", () => {
  const a = capture({
    player: { x: 0, y: 0 },
    enemies: [{ x: 10, y: 20 }],
    items: [{ x: 2, y: 4 }],
  });
  const b = capture({
    player: { x: 100, y: 200 },
    enemies: [{ x: 30, y: 60 }],
    items: [{ x: 6, y: 8 }],
  });
  assert.deepEqual(blend(a, b, 0), a);
  assert.deepEqual(blend(a, b, 1), b);
  assert.deepEqual(blend(a, b, 0.5), {
    player: { x: 50, y: 100 },
    enemies: [{ x: 20, y: 40 }],
    items: [{ x: 4, y: 6 }],
  });
});

test("blend uses b unchanged when array lengths differ", () => {
  const a = capture({
    player: { x: 0, y: 0 },
    enemies: [{ x: 10, y: 20 }, { x: 70, y: 80 }],
    items: [],
  });
  const b = capture({
    player: { x: 100, y: 200 },
    enemies: [{ x: 30, y: 60 }],
    items: [{ x: 6, y: 8 }],
  });
  const out = blend(a, b, 0.25);
  assert.deepEqual(out.enemies, [{ x: 30, y: 60 }]);
  assert.deepEqual(out.items, [{ x: 6, y: 8 }]);
  assert.deepEqual(out.player, { x: 25, y: 50 });
});

test("snap rounds to the 1/S grid", () => {
  assert.equal(snap(1.2345, 6), Math.round(1.2345 * 6) / 6);
  assert.equal(snap(7 / 3, 3), 2 + 1 / 3);
  assert.equal(snap(-1.2345, 6), Math.round(-1.2345 * 6) / 6);
});
