/* Deterministic decorative props, placed only on safe grass ledges. */
(function (root) {
  "use strict";
  function hash(n) {
    n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    return (n ^ (n >>> 16)) >>> 0;
  }
  function plan(levelTiles, seed, entities, gems) {
    var rows = levelTiles || [],
      h = rows.length,
      w = rows.reduce(function (m, r) {
        return Math.max(m, r.length);
      }, 0),
      occupied = Object.create(null),
      pits = Object.create(null),
      haz = Object.create(null),
      out = [],
      theme = typeof seed === "string" ? seed : "meadow",
      num = typeof seed === "number" ? seed : 1;
    function markSpan(px, width, margin) {var a=Math.floor(px/16)-margin,b=Math.floor((px+width-1)/16)+margin;for(var c=a;c<=b;c++)occupied[c]=1;}
    if (Array.isArray(entities)) entities.forEach(function (e) {
      var width=+e.w||16;markSpan(+e.x||0,width,1);
      if(e.kind==="grumble"||e.type==="grumble"||e.patrol){var foot=Math.floor(((+e.y||0)+(+e.h||16))/16),lo=Math.floor((+e.x||0)/16),hi=Math.floor(((+e.x||0)+width-1)/16);while(lo>0&&rows[foot]&&rows[foot][lo-1]==="#")lo--;while(hi+1<w&&rows[foot]&&rows[foot][hi+1]==="#")hi++;for(var c=lo-1;c<=hi+1;c++)occupied[c]=1;}
    });
    (gems||[]).forEach(function(g){if(!g.taken)markSpan(+g.x||0,16,1);});
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = rows[y][x] || ".";
        if (ch === "^") haz[x] = 1;
        if (ch === "#" && (!rows[y - 1] || rows[y - 1][x] === ".")) {}
      }
    }
    for (var x = 0; x < w; x++) {
      var floor = -1;
      for (var y = 0; y < h; y++) {
        if (rows[y] && rows[y][x] === "#") {
          floor = y;
          break;
        }
      }
      if (floor < 0) pits[x] = 1;
    }
    var kinds = theme === "caverns"
      ? ["mushroom", "crystal", "stalactite"]
      : theme === "sky"
      ? ["cloud", "pennant"]
      : ["flower", "bush", "fence", "signpost"];
    for (var x = 2; x < w - 2; x++) {
      var top = -1;
      for (var y = 0; y < h; y++) {
        if (rows[y] && rows[y][x] === "#") {
          top = y;
          break;
        }
      }
      if (
        top < 1 || rows[top - 1][x] !== "." || occupied[x]
      ) continue;
      if(occupied[x])continue;
      var safe = true;
      for (var d = -2; d <= 2; d++) if (pits[x + d] || haz[x + d]) safe = false;
      if (!safe || hash(num + x * 977 + top * 31) % 3 !== 0) continue;
      var allowed=kinds.filter(function(kind){return kind!=="stalactite";});
      var k = hash(num * 13 + x * 43 + top) % allowed.length, kind = allowed[k];
      out.push({ kind: kind, x: x * 16, y: top * 16 - 24, col:x, floor:top*16 });
      x += 2;
    }
    return out;
  }
  var colors = {
    meadow: {
      flower: "#ffd84a",
      bush: "#3f9a3a",
      fence: "#b98152",
      signpost: "#8b5539",
    },
    caverns: { mushroom: "#c07bff", crystal: "#6ef0ff", stalactite: "#5866b8" },
    sky: { cloud: "#ffc2a0", pennant: "#fbe0ff" },
  };
  function bake(kind, theme, makeCanvas) {
    var c = (makeCanvas || function () {
      return document.createElement("canvas");
    })();
    c.width = 32;
    c.height = 24;
    var x = c.getContext("2d"),
      co = (colors[theme] || colors.meadow)[kind] || "#b6f27a";
    x.save();
    x.fillStyle = co;
    if (kind === "flower") {
      x.fillRect(15, 10, 2, 12);
      x.fillRect(12, 7, 3, 3);
      x.fillRect(17, 7, 3, 3);
      x.fillRect(14, 4, 4, 4);
      x.fillStyle = "#ffd84a";
      x.fillRect(15, 7, 2, 2);
    } else if (kind === "bush") {
      x.fillRect(3, 15, 26, 8);
      x.fillRect(7, 9, 18, 8);
      x.fillRect(12, 5, 9, 6);
    } else if (kind === "fence") {
      x.fillRect(4, 7, 3, 17);
      x.fillRect(25, 7, 3, 17);
      x.fillRect(4, 10, 24, 3);
      x.fillRect(4, 17, 24, 3);
    } else if (kind === "signpost") {
      x.fillRect(14, 8, 4, 16);
      x.fillRect(5, 3, 22, 9);
      x.fillStyle = "#fff0c0";
      x.fillRect(8, 6, 13, 2);
    } else if (kind === "mushroom") {
      x.fillRect(14, 12, 5, 12);
      x.fillRect(8, 7, 18, 6);
      x.fillStyle = "#fff";
      x.fillRect(12, 8, 2, 2);
      x.fillRect(20, 9, 2, 2);
    } else if (kind === "crystal") {
      x.fillRect(12, 3, 7, 20);
      x.fillRect(9, 9, 13, 13);
      x.fillStyle = "#d9ffff";
      x.fillRect(13, 4, 2, 11);
    } else if (kind === "stalactite") {
      x.fillRect(11, 0, 10, 7);
      x.fillRect(13, 7, 6, 7);
      x.fillRect(15, 14, 2, 7);
    } else if (kind === "cloud") {
      x.fillRect(5, 12, 23, 7);
      x.fillRect(10, 7, 14, 6);
      x.fillRect(16, 4, 6, 5);
    } else if (kind === "pennant") {
      x.fillRect(6, 2, 2, 22);
      x.fillRect(8, 3, 16, 9);
      x.fillStyle = "#c77aa0";
      x.fillRect(8, 10, 12, 2);
    }
    x.restore();
    return c;
  }
  root.PixelProps = { plan: plan, bake: bake };
})(typeof window !== "undefined" ? window : globalThis);
