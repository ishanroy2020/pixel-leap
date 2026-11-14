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

  const LEVELS = [
    {
      name: "Meadow",
      theme: "meadow",
      rows: [
        "........................................................................................................................",
        "........................................................................................................................",
        "........................................................................................................................",
        "........................................................................................................................",
        "........................................................................................................................",
        ".....................................................................................b..................................",
        ".......o......................o.....................o...................................................................",
        "............................................................?...........................................................",
        "........................................................................................................................",
        ".......?..............?...P...?...............BBB...?......o..o...............?...................?.....................",
        "...............o.........................o................######...o.........................o..........................",
        "...S......o.o....o.og...oo.......o.o.........o....g....o..######.......o..o.......o.o...o.......o....o...o.o...o..o.F...",
        "##############..########################..########################..########################..##########################",
        "##############..########################..########################..########################..##########################",
        "##############..########################..########################..########################..##########################",
      ],
    },
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
