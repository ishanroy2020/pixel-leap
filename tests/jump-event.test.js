"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../game.js");

const NO_INPUT = { left: false, right: false, jump: false };
const HELD = { left: false, right: false, jump: true };

function countEvents(state, name) {
  return state.events.filter((e) => e === name).length;
}

function settled() {
  const s = G.createGame({ level: 0 });
  for (let i = 0; i < 4; i++) G.step(s, NO_INPUT, 1 / 60);
  s.events.length = 0;
  return s;
}

test("jumping from the ground pushes jump exactly once", () => {
  const s = settled();
  assert.equal(s.player.onGround, true);
  G.step(s, HELD, 1 / 60);
  assert.equal(countEvents(s, "jump"), 1);
  assert.ok(s.player.y < s.start.y, "the player actually left the ground");
  for (let i = 0; i < 240; i++) G.step(s, HELD, 1 / 60);
  assert.equal(countEvents(s, "jump"), 1, "holding jump in the air pushes none");
});

test("a plain jump adds only the jump event", () => {
  const s = settled();
  G.step(s, HELD, 1 / 60);
  assert.deepEqual(s.events, ["jump"]);
});

test("holding jump from the very first step pushes one jump", () => {
  const s = G.createGame({ level: 0 });
  for (let i = 0; i < 200; i++) G.step(s, HELD, 1 / 60);
  assert.equal(countEvents(s, "jump"), 1);
});

test("no jump while airborne, none on landing, one on the next tap", () => {
  const s = settled();
  G.step(s, HELD, 1 / 60);
  assert.equal(countEvents(s, "jump"), 1);
  for (let i = 0; i < 20; i++) {
    G.step(s, HELD, 1 / 60);
    if (!s.player.onGround) assert.equal(countEvents(s, "jump"), 1);
  }
  for (let i = 0; i < 140; i++) G.step(s, HELD, 1 / 60);
  assert.equal(s.player.onGround, true);
  assert.equal(countEvents(s, "jump"), 1, "landing with the button held does not re-jump");
  G.step(s, NO_INPUT, 1 / 60);
  G.step(s, HELD, 1 / 60);
  assert.equal(countEvents(s, "jump"), 2);
});

test("jump works on every level and never doubles up", () => {
  for (const level of [0, 1, 2]) {
    const s = G.createGame({ level });
    for (let i = 0; i < 4; i++) G.step(s, NO_INPUT, 1 / 60);
    s.events.length = 0;
    G.step(s, HELD, 1 / 60);
    assert.equal(countEvents(s, "jump"), 1, `level ${level} first jump`);
    // Wait for the landing before releasing and tapping again.
    for (let i = 0; i < 200 && !s.player.onGround; i++) G.step(s, HELD, 1 / 60);
    assert.equal(countEvents(s, "jump"), 1, `level ${level} no extra jump in the air`);
    G.step(s, NO_INPUT, 1 / 60);
    G.step(s, HELD, 1 / 60);
    assert.equal(countEvents(s, "jump"), 2, `level ${level} second jump`);
  }
});
