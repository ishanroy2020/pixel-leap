"use strict";

/*
 * Pixel Leap asset generator: app icons and the social share image, drawn with
 * Node built-ins only (no canvas, no npm). Sprites come from character maps
 * scaled up nearest-neighbour so the assets read like the in-game art.
 *
 *   node tools/make-assets.js [dir]     default: the repo root
 */

const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

/* ---------- PNG encoding ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = ~0;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "latin1");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

/** 8-bit RGBA PNG: every scanline uses filter 0, the rows deflate into one IDAT. */
function encodePNG(width, height, rgba) {
  if (!(width > 0) || !(height > 0)) throw new Error("encodePNG: bad dimensions");
  const stride = width * 4;
  if (!rgba || rgba.length !== stride * height) {
    throw new Error("encodePNG: rgba must be width*height*4 bytes");
  }
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    for (let i = 0; i < stride; i++) raw[rowStart + 1 + i] = rgba[y * stride + i] & 0xff;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; /* bit depth */
  ihdr[9] = 6; /* colour type: truecolour + alpha */
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- paint helpers over a raw RGBA buffer ---------- */

function hex(text) {
  return [
    parseInt(text.slice(1, 3), 16),
    parseInt(text.slice(3, 5), 16),
    parseInt(text.slice(5, 7), 16),
  ];
}

const TEAL = hex("#2ad4c4");
const TEAL_DARK = hex("#0f7f7a");
const ORANGE = hex("#ff8a2a");

function canvas(width, height) {
  return { width, height, data: new Uint8Array(width * height * 4) };
}
function setPx(c, x, y, color) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const i = (y * c.width + x) * 4;
  c.data[i] = color[0];
  c.data[i + 1] = color[1];
  c.data[i + 2] = color[2];
  c.data[i + 3] = 255;
}
function fillRect(c, x, y, w, h, color) {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  for (let r = 0; r < h; r++) {
    for (let col = 0; col < w; col++) setPx(c, x + col, y + r, color);
  }
}
/** Top-to-bottom gradient across a full-width band. */
function fillGradient(c, y0, y1, top, bottom) {
  const span = Math.max(1, y1 - y0 - 1);
  for (let y = y0; y < y1; y++) {
    const t = Math.min(1, Math.max(0, (y - y0) / span));
    const mix = top.map((v, k) => Math.round(v + (bottom[k] - v) * t));
    fillRect(c, 0, y, c.width, 1, mix);
  }
}
function blitMap(c, map, palette, x, y, scale) {
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let col = 0; col < row.length; col++) {
      const color = palette[row.charAt(col)];
      if (!color) continue;
      fillRect(c, x + col * scale, y + r * scale, scale, scale, color);
    }
  }
}
function mapWidth(map) {
  return map[0].length;
}
/** Darker ground under a sprite's feet so it never looks like it floats. */
function feetShadow(c, x, w, groundTop) {
  fillRect(c, x, groundTop, w, Math.max(1, Math.round(w * 0.06)), hex("#1f6f1f"));
}

/** Paint the ground strip: turf, bright top edge and a darker footprint band. */
function paintGround(c, groundTop) {
  fillRect(c, 0, groundTop, c.width, c.height - groundTop, hex("#4fc240"));
  fillRect(c, 0, groundTop, c.width, Math.max(2, Math.round(c.width * 0.01)) + 1, hex("#8ee06a"));
  const footH = Math.max(3, Math.round(c.height * 0.06));
  fillRect(c, 0, c.height - footH, c.width, footH, hex("#2f8f3a"));
}

/* ---------- sprites ---------- */

/* Pip: round teal body with a darker outline, big white eyes with dark pupils,
   a long orange scarf across the chest. */
const PIP = [
  "....TTTT....",
  ".DDTTTTTTDD.",
  "DTTTTTTTTTTD",
  "DTTWWTTWWTTD",
  "DTTWWTTWWTTD",
  "DTTBWTTTBWTD",
  "DOOOOOOOOOOD",
  "DYOOOOOOOOYD",
  ".DTTTTTTTTD.",
  "DTTTTTTTTTTD",
  "DTTTTTTTTTTD",
  "DOOOOOOOOOOD",
  "DDTTDDDDTTDD",
  ".DDD.DD.DDD.",
];
const PIP_PALETTE = {
  T: TEAL,
  D: TEAL_DARK,
  W: [255, 255, 255],
  B: hex("#101623"),
  O: ORANGE,
  Y: hex("#c95f12"),
};

/* Goal beacon: a grey pole on a plinth topped by a yellow star. */
const BEACON_STAR = [
  "...YY...",
  "...YW...",
  "YYYYYYYY",
  ".YYYYYY.",
  "..YYYY..",
  ".YY..YY.",
  "YY....YY",
];
const BEACON_PALETTE = { Y: hex("#f5d43c"), W: hex("#fffce8") };

/** Feet planted on `groundTop`; offsetX shifts Pip away from the centre line. */
function drawPip(c, scale, groundTop, offsetX) {
  const cols = mapWidth(PIP);
  const w = cols * scale;
  const h = PIP.length * scale;
  const x = Math.round((c.width - w) / 2 + (offsetX || 0));
  const y = groundTop - h;
  feetShadow(c, x + scale, w - scale * 2, groundTop);
  blitMap(c, PIP, PIP_PALETTE, x, y, scale);
}

function drawBeacon(c, x, groundTop, scale) {
  const cols = mapWidth(BEACON_STAR);
  const rows = BEACON_STAR.length;
  const poleW = Math.max(2, scale);
  const poleH = Math.round(rows * scale * 2.4);
  const poleTop = groundTop - poleH;
  feetShadow(c, x - poleW * 2, poleW * 4, groundTop);
  fillRect(c, x - poleW / 2, poleTop, poleW, poleH, hex("#4a5568"));
  fillRect(c, x - poleW / 2, poleTop, Math.max(1, poleW >> 1), poleH, hex("#8fa3c0"));
  const barW = cols * scale + scale * 2;
  fillRect(c, x - barW / 2, poleTop - scale, barW, scale, hex("#3a4458"));
  blitMap(c, BEACON_STAR, BEACON_PALETTE, x - (cols * scale) / 2, poleTop - scale - rows * scale, scale);
}

/* ---------- 5x7 bitmap font for the share-image title ---------- */

const FONT5x7 = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};
const GLYPH_W = 5;
const GLYPH_H = 7;
const GLYPH_GAP = 1;

function textWidth(text, scale) {
  return text.length * (GLYPH_W + GLYPH_GAP) * scale - GLYPH_GAP * scale;
}
/** Top-left anchored, `scale` device pixels per font pixel, with a drop shadow. */
function drawText(c, text, x, y, scale, color, shadow) {
  const step = (GLYPH_W + GLYPH_GAP) * scale;
  for (let pass = 0; pass < 2; pass++) {
    const ox = pass === 0 ? scale : 0;
    const fill = pass === 0 ? shadow : color;
    if (!fill) continue;
    for (let i = 0; i < text.length; i++) {
      const glyph = FONT5x7[text.charAt(i)];
      if (!glyph) continue;
      for (let r = 0; r < GLYPH_H; r++) {
        for (let col = 0; col < GLYPH_W; col++) {
          if (glyph[r].charAt(col) === "1") {
            fillRect(c, x + i * step + col * scale + ox, y + r * scale + ox, scale, scale, fill);
          }
        }
      }
    }
  }
}

/* ---------- public renders ---------- */

function renderIcon(size) {
  const c = canvas(size, size);
  const groundTop = size - Math.max(6, Math.round(size * 0.18));
  fillGradient(c, 0, groundTop, hex("#3aa7f0"), hex("#a8e0ff"));
  paintGround(c, groundTop);
  /* Under two thirds of the tile tall, so a rounded mask never clips a limb. */
  drawPip(c, Math.max(1, Math.floor((size * 0.64) / PIP.length)), groundTop, 0);
  return { width: c.width, height: c.height, data: c.data };
}

function renderOg() {
  const width = 1200;
  const height = 630;
  const c = canvas(width, height);
  const groundTop = height - 120;
  fillGradient(c, 0, groundTop, hex("#1f7fd0"), hex("#a8e0ff"));
  paintGround(c, groundTop);

  const titleScale = 15;
  const title = "PIXEL LEAP";
  drawText(
    c,
    title,
    Math.round((width - textWidth(title, titleScale)) / 2),
    70,
    titleScale,
    hex("#ffe66a"),
    hex("#123055")
  );
  drawBeacon(c, Math.round(width * 0.82), groundTop, 9);
  const pipScale = Math.max(1, Math.floor((groundTop - 230) / PIP.length));
  drawPip(c, pipScale, groundTop, Math.round(width * 0.26 - (mapWidth(PIP) * pipScale) / 2 - (width - mapWidth(PIP) * pipScale) / 2));
  return { width, height, data: c.data };
}

function writeAll(dir) {
  const targets = [
    ["icon-180.png", () => renderIcon(180)],
    ["icon-192.png", () => renderIcon(192)],
    ["icon-512.png", () => renderIcon(512)],
    ["og.png", () => renderOg()],
  ];
  fs.mkdirSync(dir, { recursive: true });
  return targets.map(([name, render]) => {
    const img = render();
    const file = path.join(dir, name);
    fs.writeFileSync(file, encodePNG(img.width, img.height, img.data));
    return file;
  });
}

if (require.main === module) {
  const dir = process.argv[2] || path.join(__dirname, "..");
  for (const file of writeAll(dir)) console.log(file);
}

module.exports = { encodePNG, renderIcon, renderOg, writeAll };
