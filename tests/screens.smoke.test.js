"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../screens.js");

function mapStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

const throwing = {
  getItem() {
    throw new Error("denied");
  },
  setItem() {
    throw new Error("denied");
  },
};

function fakeCtx() {
  const calls = [];
  const ctx = {
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    globalAlpha: 1,
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    fillRect: (...a) => calls.push(["fillRect", ...a]),
    fillText: (s, ...a) => calls.push(["fillText", String(s), ...a]),
  };
  return { ctx, calls, texts: () => calls.filter((c) => Array.isArray(c) && c[0] === "fillText").map((c) => c[1]) };
}

test("exports match the interface", () => {
  assert.equal(S.KEY_BEST, "pixelLeap.best");
  assert.equal(S.KEY_MUTED, "pixelLeap.muted");
  assert.equal(S.ACTION_DELAY, 0.6);
  for (const fn of ["loadBest", "saveBest", "loadMuted", "saveMuted", "createFlow", "drawScreen"]) {
    assert.equal(typeof S[fn], "function", fn);
  }
});

test("best score round trip", () => {
  const store = mapStorage();
  assert.equal(S.loadBest(store), 0);
  assert.equal(S.saveBest(120, store), 120);
  assert.equal(S.loadBest(store), 120);
  assert.equal(store.map.get(S.KEY_BEST), "120");
  assert.equal(S.saveBest(50, store), 120, "lower score not written");
  assert.equal(store.map.get(S.KEY_BEST), "120");
  assert.equal(S.saveBest(200, store), 200);
  assert.equal(S.loadBest(store), 200);
});

test("best score rejects bad values", () => {
  const store = mapStorage({ [S.KEY_BEST]: "abc" });
  assert.equal(S.loadBest(store), 0);
  store.map.set(S.KEY_BEST, "-5");
  assert.equal(S.loadBest(store), 0);
  store.map.set(S.KEY_BEST, "12.5");
  assert.equal(S.loadBest(store), 0);
});

test("muted round trip", () => {
  const store = mapStorage();
  assert.equal(S.loadMuted(store), false);
  assert.equal(S.saveMuted(true, store), true);
  assert.equal(S.loadMuted(store), true);
  assert.equal(S.saveMuted(false, store), false);
  assert.equal(S.loadMuted(store), false);
});

test("throwing or missing storage gives 0 / false and never throws", () => {
  assert.equal(S.loadBest(throwing), 0);
  assert.equal(S.saveBest(10, throwing), 0);
  assert.equal(S.loadMuted(throwing), false);
  assert.equal(S.saveMuted(true, throwing), false);
  assert.equal(S.loadBest(null), 0);
  assert.equal(S.loadMuted(null), false);
});

test("flow: title -> playing -> paused -> playing -> levelclear -> nextLevel", () => {
  const flow = S.createFlow();
  assert.equal(flow.screen, "title");
  assert.equal(flow.update("playing", 1 / 60, {}), "none");

  assert.equal(flow.update("playing", 1 / 60, { action: true }), "restart");
  assert.equal(flow.screen, "playing");
  assert.equal(flow.entered, "playing", "entered set in the update where the screen changed");
  assert.equal(flow.update("playing", 1 / 60, {}), "step");
  assert.equal(flow.entered, null, "entered cleared when nothing changed");

  assert.equal(flow.update("playing", 1 / 60, { pause: true }), "none");
  assert.equal(flow.screen, "paused");
  assert.equal(flow.entered, "paused");
  assert.equal(flow.update("paused", 1 / 60, {}), "none");
  assert.equal(flow.update("playing", 1 / 60, { pause: true }), "step");
  assert.equal(flow.screen, "playing");
  assert.equal(flow.entered, "playing");

  assert.equal(flow.update("levelclear", 1 / 60, {}), "none");
  assert.equal(flow.screen, "levelclear");
  assert.equal(flow.update("playing", 1 / 60, {}), "none", "mode is ignored once the screen is set");

  assert.equal(flow.update("levelclear", 0.3, { action: true }), "none", "action before ACTION_DELAY");
  assert.equal(flow.screen, "levelclear");
  assert.equal(flow.update("levelclear", 0.4, { action: true }), "nextLevel");
  assert.equal(flow.screen, "playing");
  assert.equal(flow.entered, "playing");
  assert.equal(flow.update("won", 1 / 60, {}), "none", "won on the next update");
  assert.equal(flow.screen, "won");
});

test("flow: ACTION_DELAY also gates gameover and won", () => {
  const flow = S.createFlow();
  flow.update("playing", 1 / 60, { action: true });
  flow.update("gameover", 1 / 60, {});
  assert.equal(flow.update("gameover", 0.3, { action: true }), "none");
  assert.equal(flow.screen, "gameover");
  assert.equal(flow.update("gameover", 0.5, { action: true }), "none");
  assert.equal(flow.screen, "title");

  flow.update("playing", 1 / 60, { action: true });
  flow.update("won", 1 / 60, {});
  assert.equal(flow.update("won", 0.7, { action: true }), "none");
  assert.equal(flow.screen, "title");
});

test("flow: dying keeps stepping, pause() only when playing", () => {
  const flow = S.createFlow();
  flow.update("playing", 1 / 60, { action: true });
  assert.equal(flow.update("dying", 1 / 60, {}), "step", "dying is still playing");
  assert.equal(flow.screen, "playing");

  flow.pause();
  assert.equal(flow.screen, "paused");
  flow.pause();
  assert.equal(flow.screen, "paused", "pause() while paused is a no-op");
  flow.update("playing", 1 / 60, { action: true });
  assert.equal(flow.screen, "playing");
  flow.update("gameover", 1 / 60, {});
  flow.pause();
  assert.equal(flow.screen, "gameover", "pause() while gameover is a no-op");
});

test("drawScreen: texts, panel, prompt word, balanced save/restore", () => {
  const info = { score: 420, best: 900, gems: 3, lives: 2, levelName: "Meadant Hills", muted: false };
  const cases = {
    title: ["PIXEL LEAP", "BEST 900"],
    paused: ["PAUSED"],
    levelclear: ["Meadant Hills CLEAR!", "SCORE 420"],
    gameover: ["GAME OVER", "SCORE 420"],
    won: ["YOU WON!", "SCORE 420", "Meadant Hills"],
  };
  for (const screen of Object.keys(cases)) {
    for (const touch of [true, false]) {
      const f = fakeCtx();
      S.drawScreen(f.ctx, screen, { ...info, touch }, 256, 240, 0.1);
      const texts = f.texts();
      for (const want of cases[screen]) {
        assert.ok(texts.some((s) => s.includes(want)), `${screen}: ${want} in ${JSON.stringify(texts)}`);
      }
      const promptWord = touch ? "TAP" : "SPACE";
      assert.ok(
        texts.some((s) => s.includes(promptWord) && !s.includes(touch ? "SPACE" : "TAP")),
        `${screen}: prompt says ${promptWord} in ${JSON.stringify(texts)}`,
      );
      assert.equal(f.ctx.font, "8px 'Press Start 2P', monospace");
      assert.equal(f.ctx.textAlign, "center");
      const fills = f.calls.filter((c) => Array.isArray(c) && c[0] === "fillRect");
      assert.ok(fills.length >= 1, `${screen}: panel fillRect`);
      const [x, y, w, h] = fills[0].slice(1);
      assert.ok(x >= 0 && y >= 0 && x + w <= 256 && y + h <= 240, `${screen}: panel inside the view`);
      assert.equal(f.calls.filter((c) => c === "save").length, f.calls.filter((c) => c === "restore").length);
    }
  }
});

test("drawScreen: playing draws nothing", () => {
  const f = fakeCtx();
  S.drawScreen(f.ctx, "playing", { score: 1, best: 1, touch: true }, 256, 240, 0.5);
  assert.deepEqual(f.calls, []);
});


