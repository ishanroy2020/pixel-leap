"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const moduleFiles = [
  "game.js", "camera.js", "view.js", "sprites.js", "anim.js", "tiles.js",
  "backdrop.js", "props.js", "controls.js", "screens.js", "audio.js",
];
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const inlineScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((source) => source.includes("function resize()"));

function makeContext() {
  const gradient = { addColorStop() {} };
  return new Proxy({
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    save() {},
    restore() {},
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    measureText(text) { return { width: String(text).length * 8 }; },
  }, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key === "string") return () => {};
      return undefined;
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
}

function makeCanvas(width = 390, height = 844) {
  const ctx = makeContext();
  return {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    getContext() { return ctx; },
    addEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width, height }; },
  };
}

function runPage(level) {
  const callbacks = [];
  const windowListeners = Object.create(null);
  const canvas = makeCanvas();
  const safeArea = { style: {}, getBoundingClientRect() { return {}; } };
  const elements = { game: canvas, "safe-area": safeArea };
  const document = {
    hidden: false,
    getElementById(id) { return elements[id]; },
    createElement(name) { return name === "canvas" ? makeCanvas(1, 1) : {}; },
    addEventListener() {},
  };
  const storage = { getItem() { return null; }, setItem() {} };
  const window = {
    devicePixelRatio: 1,
    innerWidth: 390,
    innerHeight: 844,
    getComputedStyle() {
      return { paddingTop: "0px", paddingRight: "0px", paddingBottom: "0px", paddingLeft: "0px" };
    },
    addEventListener(type, callback) { windowListeners[type] = callback; },
    matchMedia() { return { matches: false }; },
    localStorage: storage,
  };
  const context = vm.createContext({
    console,
    document,
    window,
    location: { search: `?level=${level}` },
    navigator: { maxTouchPoints: 0, userAgent: "node" },
    requestAnimationFrame(callback) { callbacks.push(callback); },
    setTimeout(callback) { callback(); },
    URLSearchParams,
    Math,
    WeakMap,
    Object,
    Array,
    Number,
    String,
    JSON,
    isFinite,
  });
  Object.assign(context, window);
  context.window = context;
  context.document = document;
  context.localStorage = storage;

  for (const file of moduleFiles) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  assert.ok(inlineScript, "index.html contains the game inline script");
  vm.runInContext(inlineScript, context, { filename: "index.html:inline" });
  assert.equal(typeof windowListeners.resize, "function", "resize listener is registered");
  assert.doesNotThrow(() => windowListeners.resize(), "explicit resize call");

  assert.equal(callbacks.length, 1, "page schedules its first animation frame");
  for (let frame = 0; frame < 120; frame++) {
    const callback = callbacks.shift();
    assert.equal(typeof callback, "function", `frame ${frame + 1} was scheduled`);
    assert.doesNotThrow(() => callback((frame + 1) * (1000 / 60)), `frame ${frame + 1}`);
    assert.equal(callbacks.length, 1, `frame ${frame + 1} schedules a successor`);
  }

}

test("inline game script initializes and renders 120 frames for every world", () => {
  for (const level of [0, 1, 2]) {
    assert.doesNotThrow(() => runPage(level), `level ${level}`);
  }
});
