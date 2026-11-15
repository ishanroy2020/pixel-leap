/* Original, cached pixel tiles. Canvas creation is deferred until bake/draw. */
(function (root) {
  "use strict";
  var palettes = {
    meadow: {
      dirt: ["#7a5233", "#70482d", "#825a38", "#68452d"],
      dark: "#4e321f",
      deep: "#2e1d12",
      top: "#3f9a3a",
      hi: "#6fd650",
      light: "#b6f27a",
      spike: "#547b37",
      tip: "#ff718b",
      brick: "#a85a34",
    },
    caverns: {
      dirt: ["#2a3160", "#30396b", "#252d58", "#343d70"],
      dark: "#171c3a",
      deep: "#10152d",
      top: "#5866b8",
      hi: "#9aa8f0",
      light: "#c6d1ff",
      spike: "#56d9e8",
      tip: "#ff718b",
      brick: "#5666a8",
    },
    sky: {
      dirt: ["#6f5a8e", "#765f98", "#685482", "#80669e"],
      dark: "#3f3160",
      deep: "#2d2348",
      top: "#e0a8ff",
      hi: "#fbe0ff",
      light: "#fff0ff",
      spike: "#bd9c45",
      tip: "#ff718b",
      brick: "#a77ab8",
    },
  };
  function hash(x, y) {
    var n = (x | 0) * 374761393 + (y | 0) * 668265263;
    n = (n ^ (n >>> 13)) * 1274126177;
    return (n ^ (n >>> 16)) >>> 0;
  }
  function factory(make) {
    return make || function () {
      return document.createElement("canvas");
    };
  }
  function bake(ch, theme, variant, neighbours, makeCanvas) {
    var c = factory(makeCanvas)();
    c.width = 16;
    c.height = 20;
    var x = c.getContext("2d"),
      p = palettes[theme] || palettes.meadow,
      n = neighbours || {};
    x.save();
    if (x.translate) x.translate(0, 4);
    if (ch === "#") {
      var v = (variant === undefined ? 0 : variant) >>> 0,
        seed = v % 4,
        sway = (v >>> 4) % 3;
      x.fillStyle = p.dirt[seed];
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = p.dark;
      for (var i = 0; i < 4; i++) {
        var h = hash(seed + i * 13, i + 7);
        x.fillRect(
          h % 14,
          5 + (h >>> 8) % 10,
          1 + (h >>> 16) % 3,
          1 + (h >>> 20) % 2,
        );
      }
      x.fillStyle = p.deep;
      x.fillRect(0, 14, 16, 2);
      var top = !n.up, left = !n.left, right = !n.right, above = !!n.solidAbove;
      if (top) {
        x.fillStyle = p.top;
        x.fillRect(0, 0, 16, 3);
        x.fillStyle = p.hi;
        x.fillRect(0, 0, 16, 1);
        if (theme === "meadow") {
          x.fillStyle = p.light;
          for (var b = 0; b < 4; b++) {
            var bx = hash(seed, b * 19) % 15,
              lean = sway === 0 ? -1 : sway === 2 ? 1 : 0;
            x.fillRect(bx + lean, -1, 1, 3);
            x.fillRect(bx + 1 + lean, 0, 1, 2);
          }
        }
        if (left) {
          x.clearRect(0, 0, 2, 2);
          x.fillStyle = p.top;
          x.fillRect(2, 0, 14, 1);
          x.fillRect(1, 1, 15, 1);
          x.fillStyle = p.hi;
          x.fillRect(2, 0, 14, 1);
        }
        if (right) {
          x.clearRect(14, 0, 2, 2);
          x.fillStyle = p.top;
          x.fillRect(0, 0, 14, 1);
          x.fillRect(0, 1, 15, 1);
          x.fillStyle = p.hi;
          x.fillRect(0, 0, 14, 1);
        }
      }
      if (left) {
        x.fillStyle = p.hi;
        x.fillRect(0, top ? 3 : 0, 1, 13);
      }
      if (right) {
        x.fillStyle = p.dark;
        x.fillRect(15, top ? 3 : 0, 1, 13);
      }
      x.fillStyle = p.dirt[seed];
      if (top && left) x.fillRect(0, 0, 2, 1);
      if (top && right) x.fillRect(14, 0, 2, 1);
      if (above) {
        /* The tile below an overhang carries its own top shadow. */
      }
    } else if (ch === "B") {
      x.fillStyle = p.brick;
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = p.hi;
      x.fillRect(0, 0, 16, 1);
      x.fillStyle = p.dark;
      x.fillRect(0, 7, 16, 1);
      x.fillRect(0, 15, 16, 1);
      x.fillRect(7, 1, 1, 6);
      x.fillRect(3, 8, 1, 7);
      x.fillRect(12, 8, 1, 7);
    } else if (ch === "?" || ch === "P") {
      x.fillStyle = "#986915";
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = "#f2c43b";
      x.fillRect(1, 1, 14, 14);
      x.fillStyle = "#fff0a0";
      x.fillRect(1, 1, 14, 2);
      x.fillStyle = "#805216";
      x.fillRect(2, 12, 12, 2);
      x.fillStyle = "#fff9d0";
      var f = (variant || 0) % 4;
      if (f === 0 || f === 2) {
        x.fillRect(5, 4, 2, 2);
        x.fillRect(9, 8, 2, 2);
      } else {
        x.fillRect(8, 4, 2, 2);
        x.fillRect(5, 8, 2, 2);
      }
    } else if (ch === "U") {
      x.fillStyle = "#796537";
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = "#a38d54";
      x.fillRect(1, 1, 14, 13);
      x.fillStyle = "#554728";
      x.fillRect(3, 3, 3, 3);
      x.fillRect(10, 8, 3, 3);
    } else if (ch === "^") {
      x.fillStyle = p.deep;
      x.fillRect(0, 14, 16, 2);
      for (var s = 0; s < 3; s++) {
        var sx = 1 + s * 5;
        x.fillStyle = p.spike;
        if (theme === "meadow") {
          x.fillRect(sx + 1, 5, 2, 9);
          x.fillRect(sx, 9, 4, 5);
          x.fillStyle = p.hi;
          x.fillRect(sx + 1, 5, 1, 5);
          x.fillRect(sx + 2, 3, 1, 2);
        } else if (theme === "caverns") {
          x.fillRect(sx + 1, 3, 2, 11);
          x.fillRect(sx, 8, 4, 6);
          x.fillStyle = p.hi;
          x.fillRect(sx + 1, 3, 1, 8);
          x.fillRect(sx + 2, 2, 1, 1);
        } else {
          x.fillRect(sx, 6, 4, 8);
          x.fillRect(sx + 1, 4, 2, 2);
          x.fillStyle = p.hi;
          x.fillRect(sx + 1, 4, 1, 7);
          x.fillRect(sx + 2, 3, 1, 1);
        }
        x.fillStyle = p.tip;
        x.fillRect(sx + 1, 3, 1, 1);
      }
    } else if (ch === "F") {
      x.fillStyle = "#5866b8";
      x.fillRect(2, 5, 3, 15);
      x.fillRect(11, 5, 3, 15);
      x.fillRect(1, 3, 14, 3);
      x.fillStyle = "#9aa8f0";
      x.fillRect(2, 4, 1, 15);
      x.fillRect(2, 3, 12, 1);
      x.fillStyle = "#fff1c0";
      x.fillRect(6, 0, 4, 4);
      x.fillRect(4, 2, 8, 1);
    } else if (ch === "pit") {
      var g = x.createLinearGradient(0, 0, 0, 16);
      var end = theme === "meadow"
        ? "#1a0f0a"
        : theme === "caverns"
        ? "#05061a"
        : "rgba(58,36,80,.85)";
      g.addColorStop(0, p.dark);
      g.addColorStop(1, end);
      x.fillStyle = g;
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = p.hi;
      x.fillRect(0, 0, 16, 1);
    }
    x.restore();
    return c;
  }
  function draw(ctx, ch, x, y, tx, ty, theme, t, solidFn, bump, makeCanvas) {
    var p = palettes[theme] || palettes.meadow,
      above = !!(solidFn && solidFn(tx, ty - 1)),
      ne = {
        up: !!(solidFn && solidFn(tx, ty - 1)),
        left: !!(solidFn && solidFn(tx - 1, ty)),
        right: !!(solidFn && solidFn(tx + 1, ty)),
        solidAbove: above,
      };
    var v = ch === "#"
      ? (hash(tx, ty) % 4) |
        ((Math.round(Math.sin((t || 0) + tx) + 1) % 3) << 4)
      : ch === "?" || ch === "P"
      ? Math.floor((t || 0) * 8) % 4
      : 0;
    var mask=(ne.up?1:0)|(ne.left?2:0)|(ne.right?4:0)|(above?8:0),chCode=ch.charCodeAt(0)||0;
    var key = theme + ":" + chCode + ":" + v + ":" + mask;
    var cache = draw.cache || (draw.cache = Object.create(null));
    if (!cache[key]) cache[key] = bake(ch, theme, v, ne, makeCanvas);
    ctx.drawImage(cache[key], x, y - 4);
  }
  draw.clearCache = function () {
    draw.cache = Object.create(null);
  };
  root.PixelTiles = {
    bakeTile: bake,
    draw: draw,
    hash: hash,
    palettes: palettes,
    clearCache: draw.clearCache,
  };
})(typeof window !== "undefined" ? window : globalThis);
