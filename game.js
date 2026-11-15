/* Pixel Leap — game rules only. No DOM, no canvas, no audio, no timers. */
(function (root) {
  "use strict";

  const TILE = 16;
  const VIEW_TILES_H = 15;

  const GRAVITY = 1800;
  const MAX_FALL = 600;
  const RUN_ACCEL = 900;
  const GROUND_FRICTION = 1100;
  const MAX_RUN = 150;
  const JUMP_V = 520;
  const JUMP_CUT = 0.45;
  const COYOTE = 0.1;
  const JUMP_BUFFER = 0.12;
  const STOMP_BOUNCE = -360;
  const GRUMBLE_SPEED = 40;
  const SPROUT_SPEED = 60;
  const SUBSTEP = 1 / 120;
  const DYING_TIME = 1.2;
  const INVULN_TIME = 1.5;
  const START_TIME = 300;
  const PLAYER_W = 12;
  const PLAYER_H_SMALL = 14;
  const PLAYER_H_BIG = 24;
  const ENEMY_SIZE = 14;

  const SOLID = { "#": true, B: true, "?": true, P: true, U: true };

  // Construction limits from the "Levels" section of SPEC.md.
  const MAX_GAP = 4;
  const MAX_STEP = 3;
  const MAX_SPIKES = 3;
  const BLOCKS_ABOVE = 4; // spark blocks sit 4 rows above the floor they are reached from
  const FLOOR_MIN = 3;
  const FLOOR_MAX = VIEW_TILES_H - 2; // floor 13 leaves ground tiles in rows 13 and 14

  // Deterministic level builder: start with empty sky, then apply the segments
  // left to right with a running column cursor and a current floor row.
  function buildRows(width, segments) {
    const rows = [];
    for (let y = 0; y < VIEW_TILES_H; y++) rows.push(new Array(width).fill("."));
    const set = (x, y, ch) => {
      if (x < 0 || x >= width || y < 0 || y >= VIEW_TILES_H) return;
      rows[y][x] = ch;
    };
    const at = (seg) => seg.at || 0;

    let cursor = 0;
    let floor = FLOOR_MAX;
    for (const seg of segments) {
      if (seg.start) {
        set(cursor + at(seg), floor - 1, "S");
      } else if (seg.beacon) {
        set(cursor + at(seg), floor - 1, "F");
      } else if (seg.flat !== undefined) {
        for (let x = cursor; x < cursor + seg.flat; x++) {
          for (let y = floor; y < VIEW_TILES_H; y++) set(x, y, "#");
        }
        cursor += seg.flat;
      } else if (seg.gap !== undefined) {
        cursor += Math.min(seg.gap, MAX_GAP);
      } else if (seg.step !== undefined) {
        const d = Math.max(-MAX_STEP, Math.min(MAX_STEP, seg.step));
        floor = Math.max(FLOOR_MIN, Math.min(FLOOR_MAX, floor + d));
      } else if (seg.blocks !== undefined) {
        const y = floor - BLOCKS_ABOVE;
        for (let i = 0; i < seg.blocks.length; i++) {
          if (seg.blocks[i] !== ".") set(cursor + at(seg) + i, y, seg.blocks[i]);
        }
      } else if (seg.gems !== undefined) {
        const y = seg.row === undefined ? floor - 1 : seg.row;
        for (let i = 0; i < seg.gems; i++) set(cursor + at(seg) + i, y, "o");
      } else if (seg.enemy !== undefined) {
        const flyer = seg.enemy === "b";
        set(cursor + at(seg), flyer ? floor - 3 : floor - 1, flyer ? "b" : "g");
      } else if (seg.spikes !== undefined) {
        const n = Math.min(seg.spikes, MAX_SPIKES);
        for (let i = 0; i < n; i++) set(cursor + at(seg) + i, floor - 1, "^");
      } else if (seg.platform !== undefined) {
        for (let i = 0; i < seg.platform; i++) set(cursor + at(seg) + i, seg.row, "#");
      } else if (seg.ceiling !== undefined) {
        for (let x = cursor; x < cursor + seg.ceiling; x++) {
          for (let y = 0; y <= seg.row; y++) set(x, y, "#");
        }
      }
    }
    return rows.map((r) => r.join(""));
  }

  // Level 1, Meadow: gentle. Only 2-tile gaps, two low plateaus, no spikes.
  // Each region lists its decorations first (offsets from the region's left
  // edge) and then the ground run they stand on.
  const MEADOW_SEGMENTS = [
    { start: true, at: 2 },
    { gems: 3, at: 5 },
    { flat: 12 }, // 12
    { gap: 2 },
    { enemy: "g", at: 6 },
    { gems: 4, at: 10 },
    { blocks: "??", at: 14 },
    { flat: 16 }, // 30
    { gap: 2 },
    { step: -2 },
    { gems: 5, at: 1 },
    { enemy: "b", at: 9 },
    { enemy: "g", at: 12 },
    { flat: 14 }, // 46
    { step: 2 },
    { blocks: "P?", at: 2 },
    { gems: 4, at: 5 },
    { enemy: "g", at: 11 },
    { flat: 14 }, // 60
    { gap: 2 },
    { enemy: "g", at: 3 },
    { gems: 3, at: 6 },
    { blocks: "?", at: 5 },
    { platform: 4, row: 9, at: 10 },
    { gems: 4, row: 8, at: 10 },
    { flat: 16 }, // 78
    { gap: 2 },
    { gems: 4, at: 1 },
    { blocks: "?P", at: 6 },
    { enemy: "b", at: 11 },
    { flat: 14 }, // 94
    { gap: 2 },
    { enemy: "g", at: 3 },
    { gems: 5, at: 6 },
    { flat: 14 }, // 110
    { gap: 2 },
    { step: -3 },
    { gems: 5, at: 0, row: 9 },
    { blocks: "?", at: 7 },
    { enemy: "b", at: 10 },
    { flat: 12 }, // 124
    { step: 3 },
    { gap: 2 },
    { enemy: "g", at: 3 },
    { gems: 4, at: 6 },
    { blocks: "?", at: 12 },
    { flat: 16 }, // 142
    { gap: 2 },
    { gems: 5, at: 0 },
    { enemy: "b", at: 6 },
    { blocks: "P", at: 5 },
    { platform: 5, row: 9, at: 8 },
    { gems: 3, row: 8, at: 9 },
    { flat: 14 }, // 158
    { gap: 2 },
    { enemy: "g", at: 3 },
    { gems: 4, at: 6 },
    { flat: 14 }, // 174
    { gap: 2 },
    { gems: 5, at: 0 },
    { enemy: "g", at: 8 },
    { beacon: true, at: 12 },
    { flat: 16 }, // 192
  ];

  // Level 2, Caverns: low rock ceilings overhead and spike beds on the cave
  // floor (never more than three in a row, and never under a low ceiling that
  // would cap the jump, so every bed is clearable).
  const CAVERN_SEGMENTS = [
    { start: true, at: 2 },
    { gems: 3, at: 5 },
    { flat: 12 }, // 12
    { gap: 2 },
    { ceiling: 16, row: 7 },
    { enemy: "g", at: 3 },
    { spikes: 3, at: 7 },
    { gems: 2, at: 12, row: 11 },
    { flat: 16 }, // 30
    { gap: 3 },
    { blocks: "??", at: 1 },
    { enemy: "g", at: 6 },
    { gems: 5, at: 8 },
    { flat: 16 }, // 49
    { gap: 2 },
    { enemy: "g", at: 2 },
    { blocks: "P?", at: 5 },
    { gems: 4, at: 9 },
    { flat: 14 }, // 65
    { gap: 2 },
    { step: -3 },
    { gems: 4, at: 0 },
    { blocks: "?", at: 6 },
    { enemy: "g", at: 9 },
    { flat: 14 }, // 81
    { step: 3 },
    { gap: 3 },
    { ceiling: 18, row: 8 },
    { enemy: "g", at: 2 },
    { gems: 3, at: 9, row: 11 },
    { flat: 18 }, // 102
    { gap: 2 },
    { blocks: "?P", at: 2 },
    { enemy: "g", at: 5 },
    { gems: 5, at: 7 },
    { flat: 16 }, // 120
    { gap: 3 },
    { enemy: "b", at: 2 },
    { gems: 4, at: 4 },
    { spikes: 2, at: 9 },
    { flat: 16 }, // 139
    { gap: 2 },
    { ceiling: 14, row: 7 },
    { spikes: 3, at: 2 },
    { enemy: "g", at: 8 },
    { gems: 3, at: 11, row: 11 },
    { flat: 14 }, // 155
    { gap: 2 },
    { enemy: "g", at: 3 },
    { blocks: "??", at: 6 },
    { gems: 5, at: 9 },
    { flat: 18 }, // 175
    { gap: 2 },
    { gems: 4, at: 0 },
    { enemy: "b", at: 5 },
    { beacon: true, at: 9 },
    { flat: 15 }, // 192
  ];

  // Level 3, Sky Isles: long floating runs separated by 3 and 4 tile gaps with
  // one-tile-thick platforms and a lot of Buzzers.
  const SKY_SEGMENTS = [
    { start: true, at: 2 },
    { gems: 3, at: 5 },
    { flat: 12 }, // 12
    { gap: 3 },
    { enemy: "b", at: 1 },
    { gems: 4, at: 3 },
    { platform: 5, row: 9, at: 8 },
    { gems: 4, row: 8, at: 8 },
    { flat: 14 }, // 29
    { gap: 4 },
    { platform: 6, row: 9, at: 0 },
    { gems: 3, row: 8, at: 1 },
    { enemy: "b", at: 8 },
    { flat: 12 }, // 45
    { gap: 3 },
    { step: -2 },
    { enemy: "g", at: 2 },
    { blocks: "??", at: 5 },
    { gems: 4, at: 8 },
    { flat: 14 }, // 62
    { gap: 4 },
    { step: 2 },
    { enemy: "b", at: 2 },
    { gems: 5, at: 4 },
    { blocks: "?P", at: 9 },
    { flat: 14 }, // 80
    { gap: 4 },
    { enemy: "g", at: 1 },
    { platform: 5, row: 9, at: 4 },
    { gems: 4, row: 8, at: 4 },
    { enemy: "b", at: 9 },
    { blocks: "?", at: 12 },
    { flat: 14 }, // 98
    { gap: 2 },
    { step: -3 },
    { gems: 4, at: 0 },
    { enemy: "g", at: 5 },
    { flat: 14 }, // 114
    { step: 3 },
    { gap: 4 },
    { enemy: "b", at: 1 },
    { gems: 5, at: 3 },
    { platform: 6, row: 9, at: 9 },
    { gems: 3, row: 8, at: 10 },
    { flat: 18 }, // 136
    { gap: 4 },
    { platform: 4, row: 9, at: 0 },
    { gems: 3, row: 8, at: 0 },
    { enemy: "b", at: 6 },
    { blocks: "P", at: 9 },
    { flat: 14 }, // 154
    { gap: 3 },
    { blocks: "??", at: 2 },
    { enemy: "g", at: 6 },
    { gems: 5, at: 8 },
    { flat: 18 }, // 175
    { gap: 3 },
    { gems: 4, at: 0 },
    { enemy: "b", at: 5 },
    { beacon: true, at: 9 },
    { flat: 16 }, // 194
  ];

  const LEVELS = [
    { name: "Meadow", theme: "meadow", rows: buildRows(192, MEADOW_SEGMENTS) },
    { name: "Caverns", theme: "caverns", rows: buildRows(192, CAVERN_SEGMENTS) },
    { name: "Sky Isles", theme: "sky", rows: buildRows(194, SKY_SEGMENTS) },
  ];

  function parseLevel(rows) {
    const height = rows.length;
    const width = rows[0].length;
    const tiles = [];
    let start = null;
    const enemies = [];
    const gems = [];
    for (let y = 0; y < height; y++) {
      const row = rows[y];
      const out = [];
      for (let x = 0; x < width; x++) {
        const ch = row[x];
        switch (ch) {
          case "S": {
            start = { x: x * TILE + (TILE - PLAYER_W) / 2, y: (y + 1) * TILE - PLAYER_H_SMALL };
            out.push(".");
            break;
          }
          case "o": {
            gems.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });
            out.push(".");
            break;
          }
          case "g": {
            enemies.push({ kind: "grumble", x: x * TILE + (TILE - ENEMY_SIZE) / 2, y: (y + 1) * TILE - ENEMY_SIZE, w: ENEMY_SIZE, h: ENEMY_SIZE, vx: -GRUMBLE_SPEED, vy: 0, alive: true, baseY: 0, t: 0 });
            out.push(".");
            break;
          }
          case "b": {
            const by = y * TILE + (TILE - ENEMY_SIZE) / 2;
            enemies.push({ kind: "buzzer", x: x * TILE + (TILE - ENEMY_SIZE) / 2, y: by, w: ENEMY_SIZE, h: ENEMY_SIZE, vx: 0, vy: 0, alive: true, baseY: by, t: 0 });
            out.push(".");
            break;
          }
          default:
            out.push(ch);
        }
      }
      tiles.push(out);
    }
    return { width, height, tiles, start, enemies, gems };
  }

  function tileAt(state, tx, ty) {
    if (ty >= state.height) return ".";
    if (tx < 0 || tx >= state.width || ty < 0) return "#";
    return state.tiles[ty][tx];
  }

  function solidAt(state, tx, ty) {
    return SOLID[tileAt(state, tx, ty)] === true;
  }

  function makePlayer(start) {
    return {
      x: start.x,
      y: start.y,
      w: PLAYER_W,
      h: PLAYER_H_SMALL,
      vx: 0,
      vy: 0,
      onGround: true,
      big: false,
      facing: 1,
      invuln: 0,
      dead: false,
    };
  }

  function loadLevel(state) {
    const rows = state.rows || LEVELS[state.level].rows;
    const parsed = parseLevel(rows);
    state.width = parsed.width;
    state.height = parsed.height;
    state.tiles = parsed.tiles;
    state.start = parsed.start;
    state.player = makePlayer(parsed.start);
    state.enemies = parsed.enemies;
    state.gemList = parsed.gems.map((g) => ({ x: g.x, y: g.y, taken: false }));
    state.items = [];
    state.time = START_TIME;
    state.camera = { x: 0 };
    state.mode = "playing";
    state.dyingT = 0;
    state.coyote = 0;
    state.jumpBuffer = 0;
    state.prevJump = false;
    updateCamera(state);
  }

  function createGame(options) {
    const opts = options || {};
    const state = {
      level: opts.level || 0,
      lives: typeof opts.lives === "number" ? opts.lives : 3,
      score: 0,
      gems: 0,
      rows: opts.rows || null,
      viewWidth: opts.viewWidth || 320,
      events: [],
    };
    loadLevel(state);
    return state;
  }

  function restart(state) {
    state.level = 0;
    state.lives = 3;
    state.score = 0;
    state.gems = 0;
    state.events.length = 0;
    loadLevel(state);
    return state;
  }

  function updateCamera(state) {
    const p = state.player;
    const maxX = state.width * TILE - state.viewWidth;
    let x = p.x - 0.4 * state.viewWidth;
    if (x < 0) x = 0;
    if (x > maxX) x = maxX;
    state.camera.x = Math.round(x);
  }

  const EPS = 1e-6;

  function collideX(state, p, dx) {
    if (dx === 0) return;
    p.x += dx;
    const top = Math.floor(p.y / TILE);
    const bottom = Math.floor((p.y + p.h - EPS) / TILE);
    if (dx > 0) {
      const tx = Math.floor((p.x + p.w - EPS) / TILE);
      for (let ty = top; ty <= bottom; ty++) {
        if (solidAt(state, tx, ty)) {
          p.x = tx * TILE - p.w;
          p.vx = 0;
          return;
        }
      }
    } else {
      const tx = Math.floor(p.x / TILE);
      for (let ty = top; ty <= bottom; ty++) {
        if (solidAt(state, tx, ty)) {
          p.x = (tx + 1) * TILE;
          p.vx = 0;
          return;
        }
      }
    }
  }

  // returns the tile bumped on a head-hit, or null
  function collideY(state, p, dy) {
    p.y += dy;
    const left = Math.floor(p.x / TILE);
    const right = Math.floor((p.x + p.w - EPS) / TILE);
    if (dy > 0) {
      const ty = Math.floor((p.y + p.h - EPS) / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (solidAt(state, tx, ty)) {
          p.y = ty * TILE - p.h;
          p.vy = 0;
          p.onGround = true;
          return null;
        }
      }
    } else if (dy < 0) {
      const ty = Math.floor(p.y / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (solidAt(state, tx, ty)) {
          p.y = (ty + 1) * TILE;
          p.vy = 0;
          return { tx, ty };
        }
      }
    }
    return null;
  }

  function physicsStep(state, input, h) {
    const p = state.player;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      p.vx += dir * RUN_ACCEL * h;
      p.facing = dir;
    } else if (p.onGround) {
      const stop = GROUND_FRICTION * h;
      if (Math.abs(p.vx) <= stop) p.vx = 0;
      else p.vx -= Math.sign(p.vx) * stop;
    }
    if (p.vx > MAX_RUN) p.vx = MAX_RUN;
    if (p.vx < -MAX_RUN) p.vx = -MAX_RUN;

    if (p.onGround) state.coyote = COYOTE;
    else state.coyote -= h;
    state.jumpBuffer -= h;
    if (input.jump && !state.prevJump) state.jumpBuffer = JUMP_BUFFER;
    if (state.jumpBuffer > 0 && state.coyote > 0) {
      p.vy = -JUMP_V;
      p.onGround = false;
      state.coyote = 0;
      state.jumpBuffer = 0;
      state.events.push("jump");
    }
    if (state.prevJump && !input.jump && p.vy < 0) {
      p.vy = Math.max(p.vy, -JUMP_V * JUMP_CUT);
    }
    state.prevJump = !!input.jump;

    p.vy += GRAVITY * h;
    if (p.vy > MAX_FALL) p.vy = MAX_FALL;

    collideX(state, p, p.vx * h);
    p.onGround = false;
    return collideY(state, p, p.vy * h);
  }

  // rules that run once the player is in its final position for the substep
  function checkSpikes(state, p) {
    if (p.invuln > 0) return false;
    const left = Math.floor(p.x / TILE);
    const right = Math.floor((p.x + p.w - EPS) / TILE);
    const top = Math.floor(p.y / TILE);
    const bottom = Math.floor((p.y + p.h - EPS) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (tileAt(state, tx, ty) === "^") return true;
      }
    }
    return false;
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function setTile(state, tx, ty, ch) {
    state.tiles[ty][tx] = ch;
  }

  function addGem(state) {
    state.gems += 1;
    state.score += 100;
    state.events.push("gem");
    if (state.gems % 100 === 0) {
      state.lives += 1;
      state.events.push("life");
    }
  }

  function bumpBlock(state, tx, ty) {
    const p = state.player;
    switch (state.tiles[ty][tx]) {
      case "?":
        setTile(state, tx, ty, "U");
        addGem(state);
        break;
      case "P":
        setTile(state, tx, ty, "U");
        state.items.push({
          kind: "sprout",
          x: tx * TILE + (TILE - ENEMY_SIZE) / 2,
          y: ty * TILE - ENEMY_SIZE,
          w: ENEMY_SIZE,
          h: ENEMY_SIZE,
          vx: SPROUT_SPEED,
          vy: 0,
        });
        state.events.push("sprout");
        break;
      case "B":
        if (p.big) {
          setTile(state, tx, ty, ".");
          state.score += 50;
          state.events.push("break");
        } else {
          state.events.push("bump");
        }
        break;
      default:
        break;
    }
  }

  function growPlayer(p) {
    if (p.big) return;
    const feet = p.y + p.h;
    p.big = true;
    p.h = PLAYER_H_BIG;
    p.y = feet - p.h;
  }

  function shrinkPlayer(p) {
    if (!p.big) return;
    const feet = p.y + p.h;
    p.big = false;
    p.h = PLAYER_H_SMALL;
    p.y = feet - p.h;
  }

  function killPlayer(state) {
    if (state.mode !== "playing") return;
    state.player.dead = true;
    state.mode = "dying";
    state.dyingT = 0;
    state.events.push("die");
  }

  function hurtPlayer(state) {
    const p = state.player;
    if (p.invuln > 0) return;
    if (p.big) {
      shrinkPlayer(p);
      p.invuln = INVULN_TIME;
      state.events.push("hurt");
    } else {
      killPlayer(state);
    }
  }

  function boxMoveX(state, b, dx) {
    const s = { x: b.x, y: b.y, w: b.w, h: b.h, vx: b.vx, vy: b.vy, onGround: false };
    collideX(state, s, dx);
    b.x = s.x;
    b.vx = s.vx;
  }

  function boxMoveY(state, b, dy) {
    const s = { x: b.x, y: b.y, w: b.w, h: b.h, vx: b.vx, vy: b.vy, onGround: false };
    collideY(state, s, dy);
    b.y = s.y;
    b.vy = s.vy;
    return s.onGround;
  }

  function restingOnGround(state, b) {
    const ty = Math.floor((b.y + b.h + 0.5) / TILE);
    const left = Math.floor((b.x + 1) / TILE);
    const right = Math.floor((b.x + b.w - 1 - EPS) / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (solidAt(state, tx, ty)) return true;
    }
    return false;
  }

  function leadingEdgeHasGround(state, b, dir) {
    const ty = Math.floor((b.y + b.h + 0.5) / TILE);
    const fx = dir > 0 ? b.x + b.w + 0.5 : b.x - 0.5;
    return solidAt(state, Math.floor(fx / TILE), ty);
  }

  function updateEnemies(state, h) {
    const near = state.camera.x - 2 * state.viewWidth;
    const far = state.camera.x + state.viewWidth + 2 * state.viewWidth;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.x < near || e.x > far) continue;
      if (e.kind === "buzzer") {
        e.t += h;
        e.y = e.baseY + 24 * Math.sin((2 * Math.PI * e.t) / 2);
        continue;
      }
      if (e.vx === 0) e.vx = -GRUMBLE_SPEED;
      const dir = Math.sign(e.vx) || -1;
      boxMoveX(state, e, e.vx * h);
      if (e.vx === 0) {
        e.vx = -dir * GRUMBLE_SPEED;
      } else if (restingOnGround(state, e) && !leadingEdgeHasGround(state, e, dir)) {
        e.vx = -dir * GRUMBLE_SPEED;
      }
      e.vy += GRAVITY * h;
      if (e.vy > MAX_FALL) e.vy = MAX_FALL;
      boxMoveY(state, e, e.vy * h);
    }
  }

  function updateItems(state, h) {
    for (const it of state.items) {
      const dir = Math.sign(it.vx) || 1;
      boxMoveX(state, it, it.vx * h);
      if (it.vx === 0) it.vx = -dir * SPROUT_SPEED;
      it.vy += GRAVITY * h;
      if (it.vy > MAX_FALL) it.vy = MAX_FALL;
      boxMoveY(state, it, it.vy * h);
    }
  }

  function collectGems(state) {
    const p = state.player;
    for (const g of state.gemList) {
      if (g.taken) continue;
      if (Math.abs(g.x - (p.x + p.w / 2)) < 12 && Math.abs(g.y - (p.y + p.h / 2)) < 14) {
        g.taken = true;
        addGem(state);
      }
    }
  }

  function collectItems(state) {
    const p = state.player;
    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      if (!overlaps(p, it)) continue;
      state.items.splice(i, 1);
      growPlayer(p);
      state.score += 1000;
      state.events.push("powerup");
    }
  }

  function enemyContacts(state, prevFeet) {
    const p = state.player;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (!overlaps(p, e)) continue;
      if (p.vy > 0 && prevFeet <= e.y + e.h / 2) {
        e.alive = false;
        p.vy = STOMP_BOUNCE;
        state.score += 200;
        state.events.push("stomp");
      } else {
        hurtPlayer(state);
      }
    }
  }

  function touchesBeacon(state) {
    const p = state.player;
    const left = Math.floor(p.x / TILE);
    const right = Math.floor((p.x + p.w - EPS) / TILE);
    const top = Math.floor(p.y / TILE);
    const bottom = Math.floor((p.y + p.h - EPS) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (tileAt(state, tx, ty) === "F") return true;
      }
    }
    return false;
  }

  function substep(state, input, h) {
    const p = state.player;
    const prevFeet = p.y + p.h;
    const bumped = physicsStep(state, input, h);
    if (bumped) bumpBlock(state, bumped.tx, bumped.ty);
    if (p.y > state.height * TILE) {
      killPlayer(state);
      return;
    }
    collectGems(state);
    collectItems(state);
    if (state.mode !== "playing") return;
    enemyContacts(state, prevFeet);
    if (state.mode !== "playing") return;
    if (checkSpikes(state, p)) killPlayer(state);
    if (state.mode !== "playing") return;
    if (p.invuln > 0) p.invuln -= h;
    state.time -= h;
    if (state.time <= 0) {
      state.time = 0;
      killPlayer(state);
      return;
    }
    if (touchesBeacon(state)) {
      state.mode = "levelclear";
      state.score += Math.floor(state.time) * 10;
      state.events.push("goal");
    }
  }

  function step(state, input, dt) {
    if (state.mode === "levelclear" || state.mode === "gameover" || state.mode === "won") return;
    if (state.mode === "dying") {
      state.dyingT += dt;
      if (state.dyingT >= DYING_TIME) {
        state.lives -= 1;
        if (state.lives <= 0) {
          state.lives = 0;
          state.mode = "gameover";
          state.events.push("gameover");
        } else {
          loadLevel(state);
        }
      }
      return;
    }
    const inp = input || { left: false, right: false, jump: false };
    let remaining = Math.min(Math.max(dt || 0, 0), 1 / 30);
    while (remaining > 0 && state.mode === "playing") {
      const h = Math.min(remaining, SUBSTEP);
      remaining -= h;
      substep(state, inp, h);
      if (state.mode !== "playing") break;
      updateEnemies(state, h);
      updateItems(state, h);
    }
    updateCamera(state);
  }

  function nextLevel(state) {
    if (state.mode !== "levelclear") return state;
    state.level += 1;
    if (state.level >= LEVELS.length) {
      state.level = LEVELS.length - 1;
      state.events.push("won");
      state.mode = "won";
      return state;
    }
    loadLevel(state);
    return state;
  }

  const PixelLeap = {
    TILE,
    VIEW_TILES_H,
    LEVELS,
    parseLevel,
    createGame,
    restart,
    step,
    nextLevel,
    solidAt,
  };

  root.PixelLeap = PixelLeap;
  if (typeof module === "object" && module.exports) {
    module.exports = PixelLeap;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
