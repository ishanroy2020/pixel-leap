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
  function hash(n) { n = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); return (n ^ (n >>> 16)) >>> 0; }
  function hillRowWidth(w,h,i) { var u=(h-1-i)/Math.max(1,h-1); return Math.max(1,Math.round(w*Math.sqrt(Math.max(0,1-u*u)))); }
  function cloudAt(cell,step) { var n=hash(cell),x=cell*step+((n>>>8)%61-30)*step/100; return {cell:cell,x:x,y:20+(n%41),scale:.7+((n>>>16)%61)/100,shape:(n>>>24)%3,visible:(n>>>5)%10>=3}; }
  function cloudColors(theme) { return theme==='meadow'?['#ffffff','#dff0ff']:theme==='sky'?['#ffc2a0','#f08ba5']:null; }
  function frontEligible(surface,occupied,floorY,topY){return surface==='#'&&!occupied&&floorY!=null&&topY>=floorY-7&&topY<=floorY;}
  function hill(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    for (var i = 0; i < h; i++) {
      var u = (h - 1 - i) / Math.max(1, h - 1), half = Math.round(w / 2 * Math.sqrt(Math.max(0, 1 - u * u)));
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
    var layers = [.1, .25, .45], base = H * .67,
      visible = spans(Math.ceil(W / 16) + 4, (pitColumns || []).map(function(c){return Array.isArray(c)?c:[c,c+1];}).map(function(c){return [c[0]-Math.floor(camX/16)+1,c[1]-Math.floor(camX/16)+1];}));
    layers.forEach(function (rate, layer) {
      var step = layer === 0 ? 122 : layer === 1 ? 102 : 86,
        off = -((camX * rate) % step);
      ctx.save();
      var alpha = [.28, .45, .62][layer];
      ctx.globalAlpha = alpha;
      for (var sx = off - step; sx < W + step; sx += step) {
        var wx = sx + camX * rate;
        var hw=step*1.6+(Math.floor(wx/step)%3-1)*9,hh=36+layer*10+(Math.floor(wx/step)%3)*4,hy=base+(theme==='caverns'?layer*11:layer*13);
        visible.forEach(function(v){var vx0=(Math.floor(camX/16)-1+v[0])*16-camX,vx1=(Math.floor(camX/16)-1+v[1])*16-camX;ctx.save();ctx.beginPath();ctx.rect(vx0,hy,vx1-vx0,hh);ctx.clip();hill(ctx,sx,hy,hw,hh,p.h[layer]);ctx.restore();});
        if (theme === "caverns") {
          ctx.fillStyle = layer === 0 ? "#31447b" : p.h[layer];
          circle(ctx, sx + 20, base + layer * 18, 12 + layer * 4, p.h[layer]);
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
          if (layer === 0) {
            /* Clouds are drawn in the independent opaque pass below. */
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
    ctx.restore();
    var cc=cloudColors(theme);
    if(cc){ctx.save();ctx.globalAlpha=1;var first=Math.floor((camX*.1-122)/122)-1,last=Math.ceil((W+camX*.1)/122)+1;for(var cell=first;cell<=last;cell++){var cl=cloudAt(cell,122);if(!cl.visible)continue;var x=cl.x-camX*.1,s=cl.scale,baseY=cl.y,shape=cl.shape;ctx.fillStyle=cc[0];ctx.fillRect(x,baseY+5*s,30*s,5*s);circle(ctx,x+8*s,baseY+5*s,5*s,cc[0]);circle(ctx,x+17*s,baseY+2*s,7*s,cc[0]);circle(ctx,x+25*s,baseY+5*s,5*s,cc[0]);if(shape===1)circle(ctx,x+3*s,baseY+6*s,3*s,cc[0]);if(shape===2)circle(ctx,x+29*s,baseY+6*s,4*s,cc[0]);ctx.fillStyle=cc[1];ctx.fillRect(x+2*s,baseY+9*s,27*s,2*s);}ctx.restore();}
  }
  function drawFront(ctx, theme, camX, view, t, floorHeights, pitColumns, occupancy, surfaceChars) {
    var p = P[theme] || P.meadow,
      W = view.w || view.width,
      H = view.h || view.height,
      y = H - 43;
    ctx.save();
    for (var sx = -16 - (camX % 64); sx < W + 16; sx += 64) {
      var worldX=Math.floor((sx+camX)/16), floorY=typeof floorHeights==="function"?floorHeights(worldX):null;
      if(pitColumns&&pitColumns.indexOf(worldX)>=0){y=H-43;continue;}
      if(floorY==null){y=H-43;continue;} y=floorY-7;
      if(!frontEligible(surfaceChars?surfaceChars(worldX):'#',occupancy?occupancy(worldX):false,floorY,floorY-7))continue;
      if (theme === "caverns") {
        ctx.fillStyle = p.front;
        for (var i = 0; i < 4; i++) {
            var h = 4 + (i * 7 % 4);
          ctx.fillRect(sx + i * 11, floorY - h, 3, h);
          ctx.fillRect(sx + i * 11 - 1, floorY - h + 4, 5, 2);
        }
      } else if (theme === "sky") {
        ctx.fillStyle = "rgba(255,235,255,.72)";
        for (var c = 0; c < 3; c++) {
          circle(
            ctx,
            sx + 15 + c * 12,
            floorY - 4 + Math.sin(t * 1.4 + sx * .03 + c),
            3,
            "rgba(255,235,255,.72)",
          );
        }
        ctx.fillStyle = p.front;
        ctx.fillRect(sx + 8, floorY - 2, 29, 2);
      } else {
        ctx.fillStyle = p.front;
        for (var b = 0; b < 4; b++) {
          var bx = sx + b * 8, col=Math.floor((bx+camX)/16), fy=typeof floorHeights==="function"?floorHeights(col):null,
            sway = Math.round(Math.sin(t * 2 + bx * .08) * 1), by=fy==null?y:fy-20;
          if(pitColumns&&pitColumns.indexOf(col)>=0)continue;
          ctx.fillRect(bx, by + 18 + sway, 2, 6);
          ctx.fillRect(bx - 2, by + 16 + sway, 3, 2);
          ctx.fillRect(bx + 1, by + 14 + sway, 3, 2);
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
    hillRowWidth: hillRowWidth, cloudAt: cloudAt, cloudColors: cloudColors, frontEligible: frontEligible,
    clearCache: draw.clearCache,
  };
})(typeof window !== "undefined" ? window : globalThis);
