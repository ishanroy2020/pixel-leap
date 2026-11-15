/* Pixel Leap — screen flow + persisted best/muted. No DOM, no canvas, no timers. */
(function (root) {
  "use strict";

  const KEY_BEST = "pixelLeap.best";
  const KEY_MUTED = "pixelLeap.muted";
  const ACTION_DELAY = 0.6;

  const FONT = "8px 'Press Start 2P', monospace";
  const PANEL = "#0b0b12";
  const INK = "#ffffff";
  const DIM = "#9ad1ff";

  function pick(storage) {
    return storage || (root && root.localStorage) || null;
  }

  function read(storage, key) {
    try {
      const store = pick(storage);
      if (!store || typeof store.getItem !== "function") return null;
      return store.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function write(storage, key, value) {
    try {
      const store = pick(storage);
      if (!store || typeof store.setItem !== "function") return false;
      store.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function loadBest(storage) {
    const raw = read(storage, KEY_BEST);
    if (raw === null || raw === undefined || raw === "") return 0;
    const n = Number(raw);
    if (!isFinite(n) || n < 0 || Math.floor(n) !== n) return 0;
    return n;
  }

  function saveBest(score, storage) {
    const best = loadBest(storage);
    const n = Number(score);
    if (!isFinite(n) || n < 0 || Math.floor(n) !== n || n <= best) return best;
    return write(storage, KEY_BEST, String(n)) ? n : best;
  }

  function loadMuted(storage) {
    const raw = read(storage, KEY_MUTED);
    return raw === "1" || raw === "true";
  }

  function saveMuted(muted, storage) {
    const value = muted ? "1" : "0";
    const ok = write(storage, KEY_MUTED, value);
    return !!(muted && ok);
  }

  function createFlow() {
    const flow = {
      screen: "title",
      entered: null,
      timer: 0,
      update: update,
      pause: pause,
    };

    function go(next) {
      if (flow.screen === next) {
        flow.entered = null;
        return;
      }
      flow.screen = next;
      flow.entered = next;
      flow.timer = 0;
    }

    function pause() {
      if (flow.screen === "playing") go("paused");
    }

    function update(mode, dt, act) {
      const step = dt > 0 ? dt : 0;
      flow.entered = null;
      const action = !!(act && act.action);
      const hitPause = !!(act && act.pause);
      flow.timer += step;
      const settled = action && flow.timer >= ACTION_DELAY;

      switch (flow.screen) {
        case "title":
          if (action) {
            go("playing");
            return "restart";
          }
          return "none";
        case "playing":
          if (hitPause) {
            go("paused");
            return "none";
          }
          if (mode === "levelclear" || mode === "gameover" || mode === "won") {
            go(mode);
            return "none";
          }
          return "step";
        case "paused":
          if (hitPause || action) {
            go("playing");
            return "step";
          }
          return "none";
        case "levelclear":
          if (settled) {
            go("playing");
            return "nextLevel";
          }
          return "none";
        case "gameover":
        case "won":
          if (settled) {
            go("title");
            return "none";
          }
          return "none";
        default:
          return "step";
      }
    }

    return flow;
  }

  function text(ctx, str, x, y, color) {
    ctx.fillStyle = color || INK;
    ctx.fillText(str, Math.round(x), Math.round(y));
  }

  function panel(ctx, x, y, w, h) {
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = PANEL;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    ctx.globalAlpha = 1;
  }

  function prompt(ctx, info, cx, y, time) {
    const word = info.touch ? "TAP" : "SPACE";
    ctx.globalAlpha = Math.floor(time * 3) % 2 === 0 ? 1 : 0.35;
    text(ctx, word + " TO START", cx, y, DIM);
    ctx.globalAlpha = 1;
  }

  // Draws in game pixels over a translucent panel. Only the listed ctx calls.
  function drawScreen(ctx, screen, info, w, h, t) {
    if (!ctx || screen === "playing") return;
    const data = info || {};
    const time = typeof t === "number" && t > 0 ? t : 0;
    const score = "SCORE " + (data.score | 0);
    const best = "BEST " + (data.best | 0);
    const name = data.levelName || "LEVEL";

    let rows;
    if (screen === "title") {
      rows = [["PIXEL LEAP", INK], [best, DIM]];
    } else if (screen === "paused") {
      rows = [["PAUSED", INK]];
    } else if (screen === "levelclear") {
      rows = [[name + " CLEAR!", INK], [score, DIM]];
    } else if (screen === "gameover") {
      rows = [["GAME OVER", INK], [score, DIM], [best, DIM]];
    } else if (screen === "won") {
      rows = [["YOU WON!", INK], [score, DIM], [name, DIM]];
    } else {
      return;
    }

    const cx = w / 2;
    const pw = Math.min(w - 8, 180);
    const ph = Math.max(52, rows.length * 20 + 34);
    const px = cx - pw / 2;
    const py = h / 2 - ph / 2;

    ctx.save();
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    panel(ctx, px, py, pw, ph);
    for (let i = 0; i < rows.length; i++) {
      text(ctx, rows[i][0], cx, py + 16 + i * 16, rows[i][1]);
    }
    prompt(ctx, data, cx, py + ph - 14, time);
    ctx.restore();
  }

  const PixelScreens = {
    KEY_BEST,
    KEY_MUTED,
    ACTION_DELAY,
    loadBest,
    saveBest,
    loadMuted,
    saveMuted,
    createFlow,
    drawScreen,
  };

  root.PixelScreens = PixelScreens;
  if (typeof module === "object" && module.exports) {
    module.exports = PixelScreens;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
