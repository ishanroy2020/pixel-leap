/* Pixel Leap — render camera. No DOM, no canvas, no timers. */
(function (root) {
  "use strict";

  const LOOK_RATIO = 0.12; // lookahead as a fraction of view width
  const LOOK_RATE = 3; // 1/s
  const CAM_RATE = 8; // 1/s

  function createCamera() {
    return { x: 0, look: 0 };
  }

  function clampTo(v, view, levelW) {
    const hi = Math.max(0, levelW - view.w);
    if (v < 0) return 0;
    if (v > hi) return hi;
    return v;
  }

  function targetFor(cam, p, view, levelW) {
    const goal = p.x + p.w / 2 - 0.42 * view.w + cam.look;
    return clampTo(goal, view, levelW);
  }

  function reset(cam, p, view, levelW) {
    cam.look = p.facing * LOOK_RATIO * view.w;
    cam.x = targetFor(cam, p, view, levelW);
    return cam;
  }

  function update(cam, p, view, levelW, dt) {
    const lookGoal = p.facing * LOOK_RATIO * view.w;
    cam.look += (lookGoal - cam.look) * (1 - Math.exp(-LOOK_RATE * dt));
    const target = targetFor(cam, p, view, levelW);
    cam.x += (target - cam.x) * (1 - Math.exp(-CAM_RATE * dt));
    cam.x = clampTo(cam.x, view, levelW);
    return cam;
  }

  function capture(state) {
    return {
      player: { x: state.player.x, y: state.player.y },
      enemies: state.enemies.map(function (e) {
        return { x: e.x, y: e.y };
      }),
      items: state.items.map(function (it) {
        return { x: it.x, y: it.y };
      }),
    };
  }

  function blendPair(a, b, alpha) {
    return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
  }

  function blendList(a, b, alpha) {
    const bb = b || [];
    if (!a || a.length !== bb.length) {
      return bb.map(function (v) {
        return { x: v.x, y: v.y };
      });
    }
    return a.map(function (v, i) {
      return blendPair(v, bb[i], alpha);
    });
  }

  function blend(a, b, alpha) {
    return {
      player: blendPair(a.player, b.player, alpha),
      enemies: blendList(a.enemies, b.enemies, alpha),
      items: blendList(a.items, b.items, alpha),
    };
  }

  function snap(v, S) {
    return Math.round(v * S) / S;
  }

  const PixelCamera = {
    createCamera,
    reset,
    update,
    capture,
    blend,
    snap,
  };

  root.PixelCamera = PixelCamera;
  if (typeof module === "object" && module.exports) {
    module.exports = PixelCamera;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);