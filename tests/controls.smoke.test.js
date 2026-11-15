"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../controls.js");

const KEYS = ["left", "right", "jump", "pause", "mute"];
const CENTER = (rect) => [rect.x + rect.w / 2, rect.y + rect.h / 2];

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function assertLayout(layout, w, h, safe) {
  const s = { top: 0, right: 0, bottom: 0, left: 0, ...(safe || {}) };
  const box = { x: s.left, y: s.top, w, h };
  for (const key of KEYS) {
    const r = layout[key];
    assert.ok(r, `missing ${key}`);
    assert.ok(r.w > 0 && r.h > 0, `${key} has no size`);
    assert.ok(r.x >= box.x - 1e-9 && r.y >= box.y - 1e-9, `${key} outside safe area top-left`);
    assert.ok(
      r.x + r.w <= box.x + box.w + 1e-9 && r.y + r.h <= box.y + box.h + 1e-9,
      `${key} outside safe area bottom-right`,
    );
  }
  assert.ok(layout.left.w >= 64 && layout.left.h >= 64, "left >= 64x64");
  assert.ok(layout.right.w >= 64 && layout.right.h >= 64, "right >= 64x64");
  assert.ok(layout.jump.w >= 88 && layout.jump.h >= 88, "jump >= 88x88");
  for (const key of ["pause", "mute"]) {
    assert.ok(layout[key].w >= 44 && layout[key].h >= 44, `${key} >= 44x44`);
  }
  for (let i = 0; i < KEYS.length; i++) {
    for (let j = i + 1; j < KEYS.length; j++) {
      assert.ok(
        !overlaps(layout[KEYS[i]], layout[KEYS[j]]),
        `${KEYS[i]} overlaps ${KEYS[j]}`,
      );
    }
  }
}

test("layout 390x844 (portrait) is inside bounds, sized and non-overlapping", () => {
  assertLayout(C.layout(390, 844), 390, 844);
  const l = C.layout(390, 844);
  // Thumb buttons live in the lower part of a tall screen.
  for (const key of ["left", "right", "jump"]) {
    assert.ok(l[key].y > 844 / 2, `${key} not in the lower half`);
  }
  assert.ok(l.pause.x > l.mute.x, "mute sits left of pause");
  assert.ok(l.left.x < l.right.x, "left sits left of right");
  assert.ok(l.jump.x > l.right.x, "jump is on the right");
});

test("layout 844x390 (landscape) is inside bounds, sized and non-overlapping", () => {
  assertLayout(C.layout(844, 390), 844, 390);
});

test("layout respects a safe area", () => {
  const safe = { top: 47, right: 12, bottom: 34, left: 12 };
  assertLayout(C.layout(390, 844, safe), 390, 844, safe);
  const plain = C.layout(390, 844);
  const inset = C.layout(390, 844, safe);
  assert.ok(inset.pause.y >= plain.pause.y, "notch pushes pause down");
  assert.ok(inset.jump.y + inset.jump.h <= plain.jump.y + plain.jump.h + 1e-9, "home bar lifts jump");
  assertLayout(C.layout(390, 844, { top: -10, bottom: "x" }), 390, 844);
});

test("hitTest hits button centres and misses the middle of the screen", () => {
  const l = C.layout(390, 844);
  for (const key of KEYS) {
    const [x, y] = CENTER(l[key]);
    assert.equal(C.hitTest(l, x, y), key);
  }
  assert.equal(C.hitTest(l, 195, 422), null);
  assert.equal(C.hitTest(l, -5, -5), null);
  assert.equal(C.hitTest(l, 4000, 4000), null);
  assert.equal(C.hitTest(null, 0, 0), null);
});

test("multi-touch: left + jump, releasing one keeps the other", () => {
  const l = C.layout(390, 844);
  const ctl = C.createControls(l);
  const [lx, ly] = CENTER(l.left);
  const [jx, jy] = CENTER(l.jump);

  ctl.pointerDown(1, lx, ly, "touch");
  ctl.pointerDown(2, jx, jy, "touch");
  assert.deepEqual(ctl.input(), { left: true, right: false, jump: true });
  assert.equal(ctl.touchActive(), true);

  ctl.pointerUp(2);
  assert.deepEqual(ctl.input(), { left: true, right: false, jump: false });

  // The same finger sliding across the pad switches direction.
  const [rx, ry] = CENTER(l.right);
  ctl.pointerMove(1, rx, ry);
  assert.deepEqual(ctl.input(), { left: false, right: true, jump: false });

  ctl.pointerUp(1);
  assert.deepEqual(ctl.input(), { left: false, right: false, jump: false });
  assert.deepEqual(ctl.pressed(), {
    left: false,
    right: false,
    jump: false,
    pause: false,
    mute: false,
  });
});

test("a pointer released outside any button clears it", () => {
  const l = C.layout(390, 844);
  const ctl = C.createControls(l);
  const [lx, ly] = CENTER(l.left);
  ctl.pointerDown(7, lx, ly, "touch");
  assert.equal(ctl.input().left, true);
  ctl.pointerMove(7, 195, 422);
  assert.deepEqual(ctl.input(), { left: false, right: false, jump: false });
  ctl.pointerMove(7, lx, ly);
  assert.equal(ctl.input().left, true);
  ctl.pointerUp(7);
  ctl.pointerUp(7);
  assert.equal(ctl.input().left, false);
});

test("keyboard input, unknown codes, and keys OR touches", () => {
  const l = C.layout(390, 844);
  const ctl = C.createControls(l);
  for (const code of Object.keys(C.KEYMAP)) {
    assert.equal(ctl.keyDown(code), true, `${code} handled on down`);
    assert.equal(ctl.keyUp(code), true, `${code} handled on up`);
  }
  assert.equal(ctl.keyDown("KeyZ"), false);
  assert.equal(ctl.keyUp("KeyZ"), false);
  assert.deepEqual(ctl.input(), { left: false, right: false, jump: false });

  assert.equal(ctl.keyDown("ArrowRight"), true);
  assert.deepEqual(ctl.input(), { left: false, right: true, jump: false });
  const [jx, jy] = CENTER(l.jump);
  ctl.pointerDown(3, jx, jy, "mouse");
  assert.deepEqual(ctl.input(), { left: false, right: true, jump: true });
  assert.equal(ctl.touchActive(), false, "a mouse pointer is not touch");
  ctl.keyUp("ArrowRight");
  ctl.pointerUp(3);
  assert.deepEqual(ctl.input(), { left: false, right: false, jump: false });
});

test("consume* fires once per press", () => {
  const l = C.layout(390, 844);
  const ctl = C.createControls(l);

  assert.equal(ctl.consumeAction(), false);
  assert.equal(ctl.keyDown("Enter"), true);
  assert.equal(ctl.consumeAction(), true);
  assert.equal(ctl.consumeAction(), false);
  ctl.keyUp("Enter");

  assert.equal(ctl.keyDown("Space"), true);
  assert.equal(ctl.consumeAction(), true, "Space also confirms");
  assert.equal(ctl.consumeAction(), false);
  ctl.keyUp("Space");

  assert.equal(ctl.keyDown("KeyP"), true);
  assert.equal(ctl.consumePause(), true);
  assert.equal(ctl.consumePause(), false);
  ctl.keyUp("KeyP");

  assert.equal(ctl.keyDown("KeyM"), true);
  assert.equal(ctl.consumeMute(), true);
  assert.equal(ctl.consumeMute(), false);
  ctl.keyUp("KeyM");

  // Held keys do not repeat; a tap on the pad confirms without pause/mute.
  assert.equal(ctl.keyDown("Enter"), true);
  assert.equal(ctl.keyDown("Enter"), true);
  assert.equal(ctl.consumeAction(), true);
  assert.equal(ctl.consumeAction(), false);
  ctl.keyUp("Enter");

  const [lx, ly] = CENTER(l.left);
  ctl.pointerDown(4, lx, ly, "touch");
  assert.equal(ctl.consumeAction(), true, "tap on a move button confirms");
  assert.equal(ctl.consumePause(), false);
  ctl.pointerUp(4);

  const [px, py] = CENTER(l.pause);
  ctl.pointerDown(5, px, py, "touch");
  assert.equal(ctl.consumePause(), true);
  assert.equal(ctl.consumeAction(), false);
  assert.equal(ctl.pressed().pause, true);
  ctl.pointerUp(5);
});

test("reset clears keys, pointers and edges", () => {
  const l = C.layout(390, 844);
  const ctl = C.createControls(l);
  const [lx, ly] = CENTER(l.left);
  ctl.keyDown("ArrowRight");
  ctl.pointerDown(1, lx, ly, "touch");
  ctl.keyDown("KeyP");
  ctl.reset();
  assert.deepEqual(ctl.input(), { left: false, right: false, jump: false });
  assert.equal(ctl.consumePause(), false);
  assert.equal(ctl.consumeAction(), false);
  // Pointers released before the reset must not resurrect input.
  ctl.pointerUp(1);
  assert.deepEqual(ctl.input(), { left: false, right: false, jump: false });
});

test("drawButtons fills, restores and only uses simple ctx calls", () => {
  const l = C.layout(390, 844);
  const log = [];
  let depth = 0;
  const ctx = {
    fillStyle: "",
    globalAlpha: 1,
    save() {
      depth += 1;
      log.push("save");
    },
    restore() {
      depth -= 1;
      log.push("restore");
    },
    beginPath() {
      log.push("beginPath");
    },
    arc() {
      log.push("arc");
    },
    rect() {
      log.push("rect");
    },
    fill() {
      log.push("fill");
    },
    fillRect() {
      log.push("fillRect");
    },
  };

  const idle = { left: false, right: false, jump: false, pause: false, mute: false };
  C.drawButtons(ctx, l, idle);
  assert.equal(depth, 0, "save/restore balanced");
  assert.ok(
    log.filter((name) => name === "fill" || name === "fillRect").length >= 4,
    "at least four fills",
  );
  assert.deepEqual(
    [...new Set(log)].sort(),
    ["arc", "beginPath", "fill", "fillRect", "restore", "save"],
    "only the allowed ctx calls",
  );

  const pressed = { ...idle, left: true, pause: true };
  C.drawButtons(ctx, l, pressed);
  assert.equal(depth, 0, "save/restore balanced when pressed");
  C.drawButtons(ctx, l, null);
  C.drawButtons(null, l, pressed);
  C.drawButtons(ctx, null, pressed);
  C.drawButtons(ctx, C.layout(0, 0), pressed);
  assert.equal(depth, 0, "degenerate input still balanced");
});

test("controls works without a layout argument and follows setLayout", () => {
  const ctl = C.createControls();
  const l = C.layout(390, 844);
  const [lx, ly] = CENTER(l.left);
  ctl.pointerDown(1, lx, ly, "touch");
  assert.equal(ctl.input().left, false, "default layout is empty");
  ctl.pointerUp(1);
  ctl.setLayout(l);
  ctl.pointerDown(2, lx, ly, "touch");
  assert.equal(ctl.input().left, true);
  assert.equal(ctl.touchActive(), true);
});

