/* Pixel Leap — on-screen controls + input state. No DOM, no listeners. */
(function (root) {
  "use strict";

  const KEYMAP = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    Space: "jump",
    KeyW: "jump",
    ArrowUp: "jump",
    KeyP: "pause",
    Escape: "pause",
    KeyM: "mute",
    Enter: "action",
  };

  const MARGIN = 12;
  const GAP = 8;
  const PAD_MIN = 44;
  const DIR_MIN = 64;
  const JUMP_MIN = 88;
  const BUTTON_KEYS = ["left", "right", "jump", "pause", "mute"];

  function positive(value) {
    return typeof value === "number" && isFinite(value) && value > 0 ? value : 0;
  }

  function safeParts(safe) {
    const s = safe || {};
    return {
      top: positive(s.top),
      right: positive(s.right),
      bottom: positive(s.bottom),
      left: positive(s.left),
    };
  }

  // Clip-only guard: a rectangle may shrink to stay inside the safe area but
  // is never moved, so disjoint rectangles stay disjoint.
  function clip(rect, area) {
    const x = Math.max(rect.x, area.x);
    const y = Math.max(rect.y, area.y);
    const right = Math.min(rect.x + rect.w, area.x + area.w);
    const bottom = Math.min(rect.y + rect.h, area.y + area.h);
    return { x: x, y: y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
  }

  // Uniform scale for a row of square buttons: keeps every button square,
  // inside the band height, and the whole row (gaps included) inside its
  // width, which is what makes overlaps impossible by construction.
  function rowScale(sizes, band) {
    const gaps = GAP * Math.max(0, sizes.length - 1);
    let sum = 0;
    let biggest = 0;
    for (const size of sizes) {
      sum += size;
      if (size > biggest) biggest = size;
    }
    if (sum <= 0 || biggest <= 0 || band.w <= gaps || band.h <= 0) return 0;
    return Math.max(0, Math.min(1, band.h / biggest, (band.w - gaps) / sum));
  }

  const TOP_WANT = PAD_MIN;
  const BOTTOM_WANT = JUMP_MIN;

  // Split the safe area into a top strip for pause / mute and a bottom strip
  // for the thumb controls, sharing the height when both cannot fit.
  function bands(area) {
    const need = TOP_WANT + BOTTOM_WANT;
    let topH = Math.min(TOP_WANT, area.h);
    let bottomH = Math.min(BOTTOM_WANT, area.h - topH);
    if (area.h < need) {
      topH = Math.floor((area.h * TOP_WANT) / need);
      bottomH = Math.max(0, area.h - topH);
    }
    return {
      top: { x: area.x, y: area.y, w: area.w, h: topH },
      bottom: { x: area.x, y: area.y + area.h - bottomH, w: area.w, h: bottomH },
    };
  }

  function layout(w, h, safe) {
    const width = positive(w);
    const height = positive(h);
    const s = safeParts(safe);
    const area = {
      x: s.left + MARGIN,
      y: s.top + MARGIN,
      w: Math.max(0, width - s.left - s.right - MARGIN * 2),
      h: Math.max(0, height - s.top - s.bottom - MARGIN * 2),
    };
    const strip = bands(area);
    const top = strip.top;
    const bottom = strip.bottom;

    // Direction pad bottom-left, jump bottom-right: on a tall screen both
    // groups already sit in the lower part, leaving the view unobstructed.
    const thumb = rowScale([DIR_MIN, DIR_MIN, JUMP_MIN], bottom);
    const dirSize = Math.floor(DIR_MIN * thumb);
    const jumpSize = Math.floor(JUMP_MIN * thumb);
    const padY = bottom.y + bottom.h - dirSize;
    const left = clip({ x: bottom.x, y: padY, w: dirSize, h: dirSize }, area);
    const right = clip(
      { x: left.x + left.w + GAP, y: padY, w: dirSize, h: dirSize },
      area,
    );
    const jump = clip(
      { x: bottom.x + bottom.w - jumpSize, y: bottom.y + bottom.h - jumpSize, w: jumpSize, h: jumpSize },
      area,
    );

    // Pause hugs the top-right corner with mute just to its left.
    const sys = rowScale([PAD_MIN, PAD_MIN], top);
    const sysSize = Math.floor(PAD_MIN * sys);
    const pause = clip(
      { x: top.x + top.w - sysSize, y: top.y, w: sysSize, h: sysSize },
      area,
    );
    const mute = clip(
      { x: pause.x - GAP - sysSize, y: top.y, w: sysSize, h: sysSize },
      area,
    );

    return { left: left, right: right, jump: jump, pause: pause, mute: mute };
  }

  function inside(rect, x, y) {
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
  }

  function hitTest(layoutIn, x, y) {
    if (!layoutIn) return null;
    for (let i = 0; i < BUTTON_KEYS.length; i++) {
      const key = BUTTON_KEYS[i];
      const rect = layoutIn[key];
      if (rect && inside(rect, x, y)) return key;
    }
    return null;
  }

  const HELD_KEYS = ["left", "right", "jump", "pause", "mute", "action"];

  function freshFlags() {
    const flags = {};
    for (let i = 0; i < HELD_KEYS.length; i++) flags[HELD_KEYS[i]] = false;
    return flags;
  }

  function createControls(initialLayout) {
    let current = initialLayout || layout(0, 0);
    const keyFlags = freshFlags();
    // One entry per pointer id so two thumbs work independently.
    const pointers = new Map();
    let touchSeen = false;
    let pauseEdge = false;
    let muteEdge = false;
    let actionEdge = false;

    function heldFor(key) {
      if (keyFlags[key]) return true;
      const entries = pointers.values();
      for (const entry of entries) {
        if (entry.button === key) return true;
      }
      return false;
    }

    function fireEdge(key) {
      if (key === "pause") pauseEdge = true;
      else if (key === "mute") muteEdge = true;
      else if (key === "action") actionEdge = true;
    }

    return {
      setLayout: function (next) {
        if (next) current = next;
      },

      pointerDown: function (id, x, y, pointerType) {
        if (pointerType === "touch") touchSeen = true;
        const button = hitTest(current, x, y);
        pointers.set(id, { button: button, type: pointerType });
        // Any press that is not a system button counts as a confirm tap.
        if (button === "pause" || button === "mute") fireEdge(button);
        else fireEdge("action");
      },

      pointerMove: function (id, x, y) {
        const entry = pointers.get(id);
        if (!entry) return;
        entry.button = hitTest(current, x, y);
      },

      pointerUp: function (id) {
        pointers.delete(id);
      },

      keyDown: function (code) {
        const key = KEYMAP[code];
        if (!key) return false;
        if (!keyFlags[key]) {
          fireEdge(key);
          // Space doubles as the confirm key alongside Enter.
          if (code === "Space") fireEdge("action");
        }
        keyFlags[key] = true;
        return true;
      },

      keyUp: function (code) {
        const key = KEYMAP[code];
        if (!key) return false;
        keyFlags[key] = false;
        return true;
      },

      input: function () {
        return {
          left: heldFor("left"),
          right: heldFor("right"),
          jump: heldFor("jump"),
        };
      },

      pressed: function () {
        return {
          left: heldFor("left"),
          right: heldFor("right"),
          jump: heldFor("jump"),
          pause: heldFor("pause"),
          mute: heldFor("mute"),
        };
      },

      consumePause: function () {
        const value = pauseEdge;
        pauseEdge = false;
        return value;
      },

      consumeMute: function () {
        const value = muteEdge;
        muteEdge = false;
        return value;
      },

      consumeAction: function () {
        const value = actionEdge;
        actionEdge = false;
        return value;
      },

      touchActive: function () {
        return touchSeen;
      },

      reset: function () {
        pointers.clear();
        for (let i = 0; i < HELD_KEYS.length; i++) keyFlags[HELD_KEYS[i]] = false;
        pauseEdge = false;
        muteEdge = false;
        actionEdge = false;
      },
    };
  }

  // 7x7 pixel glyphs, drawn cell by cell so the buttons keep the game's pixel
  // style without smoothed paths.
  const GLYPHS = {
    left: ["1000000", "1100000", "1110000", "1111000", "1110000", "1100000", "1000000"],
    right: ["0000001", "0000011", "0000111", "0001111", "0000111", "0000011", "0000001"],
    jump: ["0001000", "0011100", "0111110", "1111111", "0001000", "0001000", "0001000"],
    pause: ["1100110", "1100110", "1100110", "1100110", "1100110", "1100110", "1100110"],
    mute: ["0000000", "0110010", "0111010", "1111101", "0111010", "0110010", "0000000"],
  };

  const ALPHA = 0.25;
  const ALPHA_PRESSED = 0.45;
  const RADIUS = 10;
  const QUARTER = Math.PI / 2;

  function corner(ctx, cx, cy, r, from) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, from, from + QUARTER);
    ctx.fill();
  }

  // Rounded body without clip() or roundRect(): four quarter discs in the
  // corner squares plus the strips between them, never overlapping so the
  // button keeps a single flat alpha.
  function buttonShape(ctx, x, y, w, h) {
    const r = Math.min(RADIUS, w / 2, h / 2);
    ctx.fillRect(x + r, y, w - r * 2, h);
    ctx.fillRect(x, y + r, r, h - r * 2);
    ctx.fillRect(x + w - r, y + r, r, h - r * 2);
    corner(ctx, x + r, y + r, r, Math.PI);
    corner(ctx, x + w - r, y + r, r, -QUARTER);
    corner(ctx, x + r, y + h - r, r, QUARTER);
    corner(ctx, x + w - r, y + h - r, r, 0);
  }

  function glyph(ctx, rows, x, y, cell) {
    for (let row = 0; row < rows.length; row++) {
      const line = rows[row];
      for (let col = 0; col < line.length; col++) {
        if (line.charAt(col) === "1") {
          ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
        }
      }
    }
  }

  function drawButton(ctx, rect, active, rows) {
    if (!rect || rect.w <= 0 || rect.h <= 0) return;
    const x = Math.round(rect.x);
    const y = Math.round(rect.y);
    const w = Math.round(rect.w);
    const h = Math.round(rect.h);
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = active ? ALPHA_PRESSED : ALPHA;
    buttonShape(ctx, x, y, w, h);

    const cell = Math.max(2, Math.floor((Math.min(w, h) * 0.45) / 7));
    const span = cell * 7;
    ctx.globalAlpha = active ? 0.9 : 0.75;
    glyph(ctx, rows, x + Math.round((w - span) / 2), y + Math.round((h - span) / 2), cell);
    ctx.restore();
  }

  function drawButtons(ctx, layoutIn, pressed) {
    if (!ctx || !layoutIn) return;
    const on = pressed || {};
    drawButton(ctx, layoutIn.left, !!on.left, GLYPHS.left);
    drawButton(ctx, layoutIn.right, !!on.right, GLYPHS.right);
    drawButton(ctx, layoutIn.jump, !!on.jump, GLYPHS.jump);
    drawButton(ctx, layoutIn.pause, !!on.pause, GLYPHS.pause);
    drawButton(ctx, layoutIn.mute, !!on.mute, GLYPHS.mute);
  }

  const PixelControls = {
    KEYMAP: KEYMAP,
    MARGIN: MARGIN,
    GAP: GAP,
    PAD_MIN: PAD_MIN,
    DIR_MIN: DIR_MIN,
    JUMP_MIN: JUMP_MIN,
    layout: layout,
    hitTest: hitTest,
    createControls: createControls,
    drawButtons: drawButtons,
  };

  root.PixelControls = PixelControls;
  if (typeof module === "object" && module.exports) {
    module.exports = PixelControls;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

