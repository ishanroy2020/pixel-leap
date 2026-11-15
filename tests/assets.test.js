"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const MODULE = path.join(ROOT, "tools", "make-assets.js");
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COMMITTED = {
  "icon-180.png": [180, 180],
  "icon-192.png": [192, 192],
  "icon-512.png": [512, 512],
  "og.png": [1200, 630],
};
const TEAL = [0x2a, 0xd4, 0xc4];
const ORANGE = [0xff, 0x8a, 0x2a];

/* The test decodes with its own CRC32 so a broken encoder cannot agree with itself. */
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
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

/** Split a PNG into chunks, verifying signature, chunk order and every CRC. */
function parsePNG(buffer) {
  assert.equal(buffer.subarray(0, 8).toString("hex"), SIGNATURE.toString("hex"), "PNG signature");
  const chunks = [];
  let pos = 8;
  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString("latin1", pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    const storedCrc = buffer.readUInt32BE(pos + 8 + length);
    assert.equal(
      storedCrc,
      crc32(Buffer.concat([Buffer.from(type, "latin1"), Buffer.from(data)])),
      "CRC of the " + type + " chunk"
    );
    chunks.push({ type, data: Buffer.from(data), length });
    pos += 12 + length;
  }
  assert.equal(pos, buffer.length, "no trailing bytes");
  return chunks;
}

function ihdrOf(chunks) {
  const ihdr = chunks.find((c) => c.type === "IHDR");
  assert.ok(ihdr, "IHDR chunk");
  assert.equal(ihdr.length, 13, "IHDR is 13 bytes");
  return {
    width: ihdr.data.readUInt32BE(0),
    height: ihdr.data.readUInt32BE(4),
    bitDepth: ihdr.data[8],
    colorType: ihdr.data[9],
  };
}

/** Inflate IDAT and return one {filter, pixels} record per scanline. */
function scanlines(chunks, width, height) {
  const idat = chunks.filter((c) => c.type === "IDAT");
  assert.ok(idat.length >= 1, "at least one IDAT chunk");
  const raw = zlib.inflateSync(Buffer.concat(idat.map((c) => c.data)));
  const stride = width * 4;
  assert.equal(raw.length, height * (1 + stride), "IDAT inflates to h*(1+w*4)");
  const rows = [];
  for (let y = 0; y < height; y++) {
    const line = raw.subarray(y * (1 + stride), (y + 1) * (1 + stride));
    rows.push({ filter: line[0], pixels: line.subarray(1) });
  }
  return rows;
}

function decodeFile(file) {
  const chunks = parsePNG(fs.readFileSync(file));
  const header = ihdrOf(chunks);
  return { chunks, header, rows: scanlines(chunks, header.width, header.height) };
}

function coloursOf(rows) {
  const colours = new Map();
  for (const row of rows) {
    for (let i = 0; i < row.pixels.length; i += 4) {
      const key = row.pixels[i] + "," + row.pixels[i + 1] + "," + row.pixels[i + 2];
      colours.set(key, (colours.get(key) || 0) + 1);
    }
  }
  return colours;
}

function hasColour(colours, rgb) {
  return colours.has(rgb[0] + "," + rgb[1] + "," + rgb[2]);
}

test("encodePNG writes a signature, IHDR, IDAT and IEND with correct CRCs", () => {
  const A = require(MODULE);
  const buffer = A.encodePNG(3, 2, new Uint8Array(3 * 2 * 4));
  const chunks = parsePNG(buffer);
  assert.deepEqual(
    chunks.map((c) => c.type),
    ["IHDR", "IDAT", "IEND"]
  );
  const header = ihdrOf(chunks);
  assert.deepEqual(header, { width: 3, height: 2, bitDepth: 8, colorType: 6 });
  assert.equal(chunks[chunks.length - 1].length, 0, "IEND carries no data");
  const rows = scanlines(chunks, 3, 2);
  for (const row of rows) assert.equal(row.filter, 0, "filter byte 0 on every scanline");
});

test("encodePNG round-trips pixel data and rejects bad input", () => {
  const A = require(MODULE);
  const rgba = new Uint8Array(4 * 1 * 4);
  const want = [
    [10, 20, 30, 255],
    [200, 0, 100, 255],
    [0, 255, 0, 255],
    [1, 2, 3, 0],
  ];
  want.forEach((px, i) => rgba.set(px, i * 4));
  const rows = scanlines(parsePNG(A.encodePNG(4, 1, rgba)), 4, 1);
  assert.equal(rows.length, 1);
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(Array.from(rows[0].pixels.subarray(i * 4, i * 4 + 4)), want[i]);
  }
  assert.throws(() => A.encodePNG(0, 1, new Uint8Array(4)), /dimensions/);
  assert.throws(() => A.encodePNG(2, 1, new Uint8Array(4)), /width\*height\*4/);
});

test("writeAll(dir) produces four PNGs with the right IHDR sizes", () => {
  const A = require(MODULE);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pixel-leap-assets-"));
  try {
    const before = fs.readdirSync(dir);
    const files = A.writeAll(dir);
    assert.equal(files.length, 4, "four files");
    assert.deepEqual(
      files.map((f) => path.basename(f)).sort(),
      ["icon-180.png", "icon-192.png", "icon-512.png", "og.png"]
    );
    for (const file of files) {
      assert.ok(path.isAbsolute(file), "writeAll returns paths");
      assert.ok(!before.includes(path.basename(file)), "freshly written: " + file);
      const { header, rows } = decodeFile(file);
      const [w, h] = COMMITTED[path.basename(file)];
      assert.equal(header.width, w, path.basename(file) + " width");
      assert.equal(header.height, h, path.basename(file) + " height");
      for (const row of rows) assert.equal(row.filter, 0);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writeAll creates a missing directory", () => {
  const A = require(MODULE);
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pixel-leap-nested-")), "a", "b");
  try {
    A.writeAll(dir);
    assert.ok(fs.existsSync(path.join(dir, "og.png")));
  } finally {
    fs.rmSync(path.dirname(path.dirname(dir)), { recursive: true, force: true });
  }
});

for (const [name, [width, height]] of Object.entries(COMMITTED)) {
  test(name + " is a valid, opaque, multi-colour icon", () => {
    const file = path.join(ROOT, name);
    assert.ok(fs.existsSync(file), name + " is committed");
    const { chunks, header, rows } = decodeFile(file);
    assert.equal(header.width, width, "IHDR width");
    assert.equal(header.height, height, "IHDR height");
    assert.equal(header.bitDepth, 8);
    assert.equal(header.colorType, 6);
    for (const row of rows) {
      assert.equal(row.filter, 0, "filter byte 0");
      for (let i = 3; i < row.pixels.length; i += 4) {
        assert.equal(row.pixels[i], 255, name + " must be fully opaque");
      }
    }
    const colours = coloursOf(rows);
    assert.ok(colours.size >= 4, "at least 4 distinct colours, saw " + colours.size);
    assert.ok(hasColour(colours, TEAL), name + " contains teal (#2ad4c4)");
    assert.ok(hasColour(colours, ORANGE), name + " contains orange (#ff8a2a)");
    /* The chunks must be the ones a decoder expects, in order, nothing else. */
    assert.deepEqual(
      chunks.map((c) => c.type),
      ["IHDR", "IDAT", "IEND"]
    );
  });
}

test("renderIcon and renderOg return buffers matching their dimensions", () => {
  const A = require(MODULE);
  for (const size of [180, 192, 512]) {
    const icon = A.renderIcon(size);
    assert.equal(icon.width, size);
    assert.equal(icon.height, size);
    assert.equal(icon.data.length, size * size * 4);
    assert.ok(icon.data instanceof Uint8Array);
  }
  const og = A.renderOg();
  assert.equal(og.width, 1200);
  assert.equal(og.height, 630);
  assert.equal(og.data.length, 1200 * 630 * 4);
});

test("requiring tools/make-assets.js writes nothing", () => {
  const before = snapshotTree(ROOT);
  /* A fresh process: earlier tests in this file already cached the module. */
  const probe = childProcess.spawnSync(
    process.execPath,
    ["-e", "const A = require(process.argv[1]); A.renderIcon(180); A.renderOg();", MODULE],
    { cwd: ROOT, encoding: "utf8" }
  );
  assert.equal(probe.status, 0, "require + render in a child process: " + probe.stderr);
  assert.deepEqual(snapshotTree(ROOT), before, "no new, removed or modified files");

  const A = require(MODULE);
  for (const fn of ["encodePNG", "renderIcon", "renderOg", "writeAll"]) {
    assert.equal(typeof A[fn], "function", fn + " is exported");
  }
});

test("manifest.webmanifest is valid and its icons exist", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "Pixel Leap");
  assert.equal(manifest.short_name, "Pixel Leap");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "fullscreen");
  assert.equal(manifest.orientation, "any");
  assert.equal(manifest.background_color, "#000000");
  assert.equal(manifest.theme_color, "#3aa7f0");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "icons array");
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes("192x192"), "a 192x192 icon");
  assert.ok(sizes.includes("512x512"), "a 512x512 icon");
  for (const icon of manifest.icons) {
    assert.equal(icon.type, "image/png");
    assert.match(icon.sizes, /^\d+x\d+$/);
    assert.ok(!path.isAbsolute(icon.src) && !icon.src.includes(".."), "relative icon src");
    const file = path.join(ROOT, icon.src);
    assert.ok(fs.existsSync(file), icon.src + " exists");
    const header = ihdrOf(parsePNG(fs.readFileSync(file)));
    assert.equal(header.width + "x" + header.height, icon.sizes, icon.src + " matches its sizes");
  }
});

test("index.html head references the assets", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const head = html.slice(0, html.indexOf("</head>"));
  assert.match(head, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(head, /<link rel="apple-touch-icon" href="icon-180\.png">/);
  assert.match(head, /<link rel="icon" type="image\/png" href="icon-192\.png">/);
  assert.match(head, /<meta name="theme-color" content="#3aa7f0">/);
  assert.match(head, /<meta property="og:type" content="website">/);
  assert.match(head, /<meta property="og:image" content="https:\/\/ishanroy2020\.github\.io\/pixel-leap\/og\.png">/);
  assert.match(head, /<meta property="og:image:width" content="1200">/);
  assert.match(head, /<meta property="og:image:height" content="630">/);
  assert.match(head, /<meta name="twitter:card" content="summary_large_image">/);
  assert.ok(html.indexOf("</head>") > 0, "index.html has a head");
});

test("README credits the team and links the game", () => {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.match(readme, /^# Pixel Leap$/m);
  assert.ok(readme.includes("https://ishanroy2020.github.io/pixel-leap/"), "play URL");
  for (const needle of ["Qwen", "Codex", "Claude", "Press Start 2P"]) {
    assert.ok(readme.includes(needle), "README mentions " + needle);
  }
  assert.match(readme, /SIL Open Font License/i);
});

/** Relative paths + sizes + mtimes for every tracked-ish file, so writes are detectable. */
function snapshotTree(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const st = fs.statSync(full);
        out.push(path.relative(dir, full) + "|" + st.size + "|" + Number(st.mtimeMs));
      }
    }
  };
  walk(dir);
  return out.sort();
}
