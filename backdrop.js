/* Pixel Leap original parallax scenery. No DOM work happens until draw(). */
(function (root) {
  "use strict";
  var P = {
    meadow: {
      sky: ["#4aa8ff", "#cdeeff"],
      h: ["#8fb8e0", "#5cbf6a", "#3a9a4e"],
      horizon: "#cdeeff",
      sun: "#fff5c2",
      front: "#3a9a4e",
    },
    caverns: {
      sky: ["#070b22", "#1a2350"],
      h: ["#1c2550", "#252d68", "#303b78"],
      horizon: "#222c58",
      sun: "#b9c5ff",
      front: "#5866b8",
    },
    sky: {
      sky: ["#2b2d6e", "#ff7a59", "#ffd38a"],
      h: ["#8a5f9e", "#a875a3", "#bc87a9"],
      horizon: "#ffd38a",
      sun: "#fff1c0",
      front: "#e0a8ff",
    },
  };
  function fac(make) {
    return make || function () {
      return document.createElement("canvas");
    };
  }
  function spans(width, pits) {
    var cuts = (pits || []).map(function (c) {
        return Array.isArray(c) ? c : [c, c + 1];
      }).sort(function (a, b) {
        return a[0] - b[0];
      }),
      out = [],
      at = 0;
    cuts.forEach(function (c) {
      var a = Math.max(0, c[0]), b = Math.min(width, c[1]);
      if (a > at) out.push([at, a]);
      at = Math.max(at, b);
    });
    if (at < width) out.push([at, width]);
    return out;
  }
  function circle(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    for (var yy = -r; yy <= r; yy++) {
      var w = Math.floor(Math.sqrt(r * r - yy * yy));
      ctx.fillRect(Math.round(x) - w, Math.round(y + yy), w * 2 + 1, 1);
    }
  }
  function hill(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    for (var i = 0; i < h; i++) {
      var half = Math.round(w / 2 * (1 - (i / h) * (i / h)));
      ctx.fillRect(
        Math.round(x + w / 2 - half),
        Math.round(y + i),
        Math.max(1, half * 2),
        1,
      );
    }
  }
  function draw(ctx, theme, camX, view, t, pitColumns, makeCanvas) {
    var p = P[theme] || P.meadow,
      W = Math.ceil(view.w || view.width),
      H = Math.ceil(view.h || view.height),
      mk = fac(makeCanvas),
      key = theme + ":" + W + ":" + H,
      cache = draw.cache || (draw.cache = Object.create(null)),
      sky = cache[key];
    if (!sky) {
      sky = mk();
      sky.width = W;
      sky.height = H;
      var s = sky.getContext("2d"), g = s.createLinearGradient(0, 0, 0, H);
      p.sky.forEach(function (c, i) {
        g.addColorStop(i / (p.sky.length - 1), c);
      });
      s.fillStyle = g;
      s.fillRect(0, 0, W, H);
      var sx = Math.round(W * .72), sy = Math.round(H * .24);
      for (var r = 19; r > 10; r -= 3) {
        circle(
          s,
          sx,
          sy,
          r,
          "rgba(255,241,192," + (r === 19 ? .08 : r === 16 ? .12 : .2) + ")",
        );
      }
      circle(s, sx, sy, 9, p.sun);
      cache[key] = sky;
    }
    ctx.save();
    ctx.drawImage(sky, 0, 0);
    var layers = [.1, .25, .45], base = H * .67;
    layers.forEach(function (rate, layer) {
      var step = layer === 0 ? 122 : layer === 1 ? 102 : 86,
        off = -((camX * rate) % step);
      ctx.save();
      var alpha = [.28, .45, .62][layer];
      ctx.globalAlpha = alpha;
      for (var sx = off - step; sx < W + step; sx += step) {
        var wx = sx + camX * rate;
        if (theme === "caverns") {
          ctx.fillStyle = layer === 0 ? "#31447b" : p.h[layer];
          circle(ctx, sx + 20, base + layer * 18, 12 + layer * 4, p.h[layer]);
          hill(ctx, sx, base + layer * 11, step, 36 + layer * 10, p.h[layer]);
          if (layer === 0) {
            var pulse = .5 + .5 * Math.sin(t * 2 + wx * .05);
            ctx.fillStyle = "rgba(110,240,255," + (pulse * .7) + ")";
            ctx.fillRect(
              sx + 31,
              32 + ((Math.floor(wx / step) % 3) * 25),
              2,
              10,
            );
            ctx.fillRect(
              sx + 30,
              37 + ((Math.floor(wx / step) % 3) * 25),
              4,
              5,
            );
          }
        } else {
          hill(ctx, sx, base + layer * 13, step, 36 + layer * 10, p.h[layer]);
          if (layer === 0) {
            var drift = (t * 3 + wx * .03) % 25;
            circle(
              ctx,
              sx + 27 + drift,
              38 + (Math.floor(wx / step) % 3) * 16,
              8,
              "rgba(255,255,255,.8)",
            );
            circle(
              ctx,
              sx + 38 + drift,
              42 + (Math.floor(wx / step) % 3) * 16,
              10,
              "rgba(199,122,160,.85)",
            );
          }
          if (
            theme === "sky" && layer === 0 &&
            Math.floor((wx + t * 18) / step) % 5 === 0
          ) {
            ctx.fillStyle = "#433c67";
            ctx.fillRect(sx + 55, 62, 5, 1);
            ctx.fillRect(sx + 61, 60, 5, 1);
          }
        }
      }
      ctx.restore();
    });
    // Mask landscape layers by world columns; gaps in the floor are absolute pit columns.
    if (pitColumns && pitColumns.length) {
      ctx.save();
      ctx.fillStyle = theme === "meadow"
        ? "#1a0f0a"
        : theme === "caverns"
        ? "#05061a"
        : "rgba(58,36,80,.85)";
      pitColumns.forEach(function (c) {
        var a = Array.isArray(c) ? c[0] : c,
          b = Array.isArray(c) ? c[1] : c + 1;
        var x0 = a * 16 - camX, x1 = b * 16 - camX;
        ctx.fillRect(x0, base, Math.max(0, x1 - x0), H - base);
        ctx.fillStyle = p.h[1];
        ctx.fillRect(x0, base, Math.max(0, x1 - x0), 1);
      });
      ctx.restore();
    }
    ctx.restore();
  }
  function drawFront(ctx, theme, camX, view, t) {
    var p = P[theme] || P.meadow,
      W = view.w || view.width,
      H = view.h || view.height,
      y = H - 43;
    ctx.save();
    for (var sx = -16 - (camX * 1.15 % 64); sx < W + 16; sx += 64) {
      if (theme === "caverns") {
        ctx.fillStyle = p.front;
        for (var i = 0; i < 4; i++) {
          var h = 13 + (i * 7 % 18);
          ctx.fillRect(sx + i * 11, y + 27 - h, 3, h);
          ctx.fillRect(sx + i * 11 - 1, y + 27 - h + 4, 5, 2);
        }
      } else if (theme === "sky") {
        ctx.fillStyle = "rgba(255,235,255,.72)";
        for (var c = 0; c < 3; c++) {
          circle(
            ctx,
            sx + 15 + c * 12,
            y + 16 + Math.sin(t * 1.4 + sx * .03 + c) * 2,
            7,
            "rgba(255,235,255,.72)",
          );
        }
        ctx.fillStyle = p.front;
        ctx.fillRect(sx + 8, y + 19, 29, 2);
      } else {
        ctx.fillStyle = p.front;
        for (var b = 0; b < 4; b++) {
          var bx = sx + b * 8,
            sway = Math.round(Math.sin(t * 2 + bx * .08) * 2);
          ctx.fillRect(bx, y + 18 + sway, 2, 10);
          ctx.fillRect(bx - 2, y + 16 + sway, 3, 2);
          ctx.fillRect(bx + 1, y + 14 + sway, 3, 2);
        }
      }
    }
    ctx.restore();
  }
  draw.clearCache = function () {
    draw.cache = Object.create(null);
  };
  root.PixelBackdrop = {
    draw: draw,
    drawFront: drawFront,
    visibleSpans: spans,
    palettes: P,
    clearCache: draw.clearCache,
  };
})(typeof window !== "undefined" ? window : globalThis);
