"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../audio.js");

const LONG_SFX = { die: 2.5, gameover: 2.5, won: 2.5 };

function harness(overrides) {
  const opts = overrides || {};
  const h = { ctxs: [], nodes: [], oscs: [], gains: [], time: 0 };
  function param() {
    return {
      automation: [],
      setValueAtTime(value, t) { this.automation.push({ kind: "set", value, t }); },
      linearRampToValueAtTime(value, t) { this.automation.push({ kind: "ramp", value, t }); },
      cancelScheduledValues() {},
    };
  }
  function node(kind, ctx) {
    const n = {
      kind, ctx, type: "", starts: [], stops: [], connects: [], disconnects: 0,
      frequency: param(), gain: param(),
      connect(target) { n.connects.push(target); },
      disconnect() { n.disconnects += 1; },
    };
    n.start = (t) => {
      if (kind === "oscillator" && opts.startThrows) throw new Error("start refused");
      n.starts.push(t);
    };
    n.stop = (t) => {
      if (kind === "oscillator" && opts.stopThrows) throw new Error("stop refused");
      n.stops.push(t);
    };
    h.nodes.push(n);
    if (kind === "oscillator") h.oscs.push(n);
    if (kind === "gain") h.gains.push(n);
    return n;
  }
  function FakeAudioContext() {
    if (opts.ctorThrows) throw new Error("no Web Audio here");
    this.currentTime = h.time;
    this.sampleRate = 48000;
    this.state = "suspended";
    this.resumeCalls = 0;
    this.suspendCalls = 0;
    this.destination = node("destination", this);
    h.ctxs.push(this);
  }
  FakeAudioContext.prototype.createGain = function () {
    if (opts.gainThrows) throw new Error("gain refused");
    return node("gain", this);
  };
  FakeAudioContext.prototype.createOscillator = function () {
    if (opts.oscThrows) throw new Error("osc refused");
    return node("oscillator", this);
  };
  FakeAudioContext.prototype.resume = function () {
    this.resumeCalls += 1;
    if (opts.resumeRejects) return Promise.reject(new Error("resume refused"));
    this.state = "running";
    return Promise.resolve();
  };
  FakeAudioContext.prototype.suspend = function () {
    this.suspendCalls += 1;
    if (opts.suspendRejects) return Promise.reject(new Error("suspend refused"));
    this.state = "suspended";
    return Promise.resolve();
  };
  h.Ctx = FakeAudioContext;
  h.tick = (seconds) => {
    h.time = +(h.time + seconds).toFixed(9);
    for (const c of h.ctxs) c.currentTime = h.time;
  };
  h.live = () => h.oscs.filter((o) => o.starts.length > 0 && lastStop(o) > h.time).length;
  h.reset = () => { h.nodes.length = 0; h.oscs.length = 0; h.gains.length = 0; };
  return h;
}

function lastStop(o) {
  return o.stops.length ? o.stops[o.stops.length - 1] : -Infinity;
}

// The gain node an oscillator is wired to carries the volume envelope.
function gainNodeOf(o) {
  return o.connects.find((n) => n.kind === "gain") || null;
}

function envelopeOf(o) {
  const g = gainNodeOf(o);
  return g ? g.gain.automation : [];
}

function make(overrides) {
  const h = harness(overrides);
  const audio = A.createAudio({ AudioContext: h.Ctx });
  return { h, audio };
}

test("no Web Audio object is created before unlock()", () => {
  const { h, audio } = make();
  assert.equal(h.ctxs.length, 0);
  audio.play("gem");
  audio.playEvents(A.EVENTS);
  audio.setMusic("meadow");
  audio.update();
  audio.setMuted(true);
  audio.toggleMute();
  audio.suspend();
  audio.resume();
  assert.equal(h.ctxs.length, 0, "still no context");
  assert.equal(h.nodes.length, 0, "no nodes either");
  assert.equal(audio.available(), false);
});

test("a missing constructor: unlock, available and play all say no, nothing throws", () => {
  const audio = A.createAudio({ AudioContext: undefined });
  assert.equal(audio.unlock(), false);
  assert.equal(audio.available(), false);
  for (const name of A.EVENTS) assert.equal(audio.play(name), false, name);
  assert.equal(audio.playEvents(["gem", "gem"]), 0);
  assert.equal(audio.playEvents(undefined), 0);
  audio.setMusic("meadow");
  audio.update();
  audio.setMuted(true);
  assert.equal(typeof audio.toggleMute(), "boolean");
  audio.suspend();
  audio.resume();
  const bare = A.createAudio();
  assert.equal(bare.unlock(), false);
  assert.equal(bare.available(), false);
  assert.equal(bare.play("jump"), false);
});

test("unlock twice: one context, resume called", async () => {
  const { h, audio } = make();
  assert.equal(audio.unlock(), true);
  assert.equal(audio.available(), true);
  assert.equal(h.ctxs.length, 1);
  assert.equal(h.ctxs[0].resumeCalls, 1);
  assert.equal(audio.unlock(), true);
  assert.equal(h.ctxs.length, 1, "double unlock makes no second context");
  assert.equal(h.ctxs[0].resumeCalls, 2, "unlock resumes again");
  audio.suspend();
  audio.resume();
  assert.equal(h.ctxs[0].suspendCalls, 1);
  await Promise.resolve();
});

test("every EVENT plays: one oscillator per part, sane times, gain envelope", () => {
  const { h, audio } = make();
  audio.unlock();
  const seen = new Set();
  for (const name of A.EVENTS) {
    h.reset();
    const before = h.time;
    assert.equal(audio.play(name), true, `${name} plays`);
    const parts = A.SFX[name];
    assert.ok(Array.isArray(parts) && parts.length > 0, `${name} has SFX data`);
    assert.equal(h.oscs.length, parts.length, `${name} one oscillator per part`);
    const limit = LONG_SFX[name] || 1.5;
    for (let i = 0; i < h.oscs.length; i++) {
      const o = h.oscs[i];
      const p = parts[i];
      assert.ok(["square", "triangle", "sawtooth"].includes(o.type), `${name} wave ${o.type}`);
      assert.equal(o.type, p.wave, `${name} wave comes from data`);
      assert.equal(o.starts.length, 1, `${name} started once`);
      assert.ok(o.stops.length >= 1, `${name} stopped`);
      const start = o.starts[0];
      const stop = o.stops[0];
      assert.ok(start >= before - 1e-9, `${name} starts >= currentTime`);
      assert.ok(Math.abs(start - (before + p.at)) < 1e-6, `${name} onset comes from data`);
      assert.ok(stop > start, `${name} stop > start`);
      assert.ok(stop - start <= limit, `${name} duration <= ${limit}s`);
      assert.ok(Math.abs(stop - start - p.dur) < 0.05, `${name} duration comes from data`);
      const env = envelopeOf(o);
      assert.ok(env.length >= 2, `${name} has a gain envelope`);
      assert.equal(env[0].value, 0, `${name} envelope opens silent`);
      assert.ok(Math.max.apply(null, env.map((a) => a.value)) > 0, `${name} envelope opens up`);
      assert.equal(env[env.length - 1].value, 0, `${name} envelope closes silent`);
      for (const a of env) {
        assert.ok(a.t >= start - 1e-9 && a.t <= stop + 1e-9, `${name} envelope inside the voice`);
      }
      assert.ok(Math.abs(o.frequency.automation[0].value - p.f) < 1e-6, `${name} pitch from data`);
      if (p.f2) {
        assert.ok(o.frequency.automation.some((a) => Math.abs(a.value - p.f2) < 1e-6), `${name} glides to f2`);
      }
      assert.equal(o.connects.length, 1, `${name} osc feeds one gain`);
      const g = o.connects[0];
      assert.equal(g.kind, "gain", `${name} osc -> gain`);
      assert.equal(g.connects.length, 1, `${name} gain -> master`);
      assert.equal(g.connects[0].connects[0], h.ctxs[0].destination, `${name} master -> destination`);
    }
    const sig = parts.map((p) => [p.wave, p.f, p.f2 || 0, p.at, p.dur, p.vol].join(":")).join("|");
    assert.ok(!seen.has(sig), `${name} is not identical to another SFX`);
    seen.add(sig);
    h.tick(3);
  }
  assert.equal(seen.size, A.EVENTS.length, "all SFX are distinct");
});
test("unknown events never play", () => {
  const { h, audio } = make();
  audio.unlock();
  h.reset();
  for (const bad of ["nope", "", null, undefined, 7, "toString", "hasOwnProperty", {}, []]) {
    assert.equal(audio.play(bad), false, `play(${JSON.stringify(bad)})`);
  }
  assert.equal(h.oscs.length, 0);
});

test("muted: play is false, no oscillators; toggleMute returns the new state", () => {
  const { h, audio } = make();
  audio.unlock();
  audio.setMuted(true);
  assert.equal(audio.isMuted(), true);
  h.reset();
  for (const name of A.EVENTS) assert.equal(audio.play(name), false, name);
  assert.equal(audio.playEvents(A.EVENTS), 0);
  assert.equal(h.oscs.length, 0, "muted creates no oscillators");
  audio.setMusic("sky");
  for (let i = 0; i < 120; i++) { audio.update(); h.tick(1 / 60); }
  assert.equal(h.oscs.length, 0, "muted creates no music voices");
  assert.equal(audio.toggleMute(), false, "toggleMute returns the new muted state");
  assert.equal(audio.isMuted(), false);
  assert.equal(audio.play("gem"), true, "unmuted plays again");
  assert.equal(audio.toggleMute(), true);
  assert.equal(audio.isMuted(), true);
  const pre = A.createAudio({ AudioContext: harness().Ctx, muted: true });
  assert.equal(pre.isMuted(), true, "opts.muted starts muted");
  assert.equal(pre.play("gem"), false);
});

test("throwing node calls: nothing throws and play() is false", () => {
  const brokenCtor = make({ ctorThrows: true });
  assert.equal(brokenCtor.audio.unlock(), false);
  assert.equal(brokenCtor.audio.available(), false);
  assert.equal(brokenCtor.audio.play("gem"), false);
  assert.equal(brokenCtor.audio.playEvents(["gem", "jump"]), 0);
  brokenCtor.audio.setMusic("meadow");
  brokenCtor.audio.update();
  brokenCtor.audio.suspend();
  brokenCtor.audio.resume();

  const badStart = make({ startThrows: true });
  assert.equal(badStart.audio.unlock(), true, "the context itself was fine");
  assert.equal(badStart.audio.play("gem"), false, "osc.start throwing -> play false");
  assert.equal(badStart.audio.playEvents(A.EVENTS), 0);
  badStart.audio.setMusic("caverns");
  for (let i = 0; i < 60; i++) { badStart.audio.update(); badStart.h.tick(1 / 60); }

  const badOsc = make({ oscThrows: true });
  assert.equal(badOsc.audio.unlock(), true, "context and master gain are fine");
  assert.equal(badOsc.audio.play("jump"), false, "createOscillator throwing -> play false");
  assert.equal(badOsc.audio.playEvents(["jump", "gem"]), 0);

  const badGain = make({ gainThrows: true });
  assert.equal(badGain.audio.unlock(), false);
  assert.equal(badGain.audio.play("jump"), false);

  const badStop = make({ stopThrows: true });
  assert.equal(badStop.audio.unlock(), true);
  assert.equal(badStop.audio.play("gem"), false);
});

test("rejected resume/suspend promises are caught (no unhandledRejection)", async () => {
  const seen = [];
  const onRejection = (err) => seen.push(err);
  process.on("unhandledRejection", onRejection);
  try {
    const { h, audio } = make({ resumeRejects: true, suspendRejects: true });
    assert.equal(audio.unlock(), true, "unlock still reports audio works");
    audio.resume();
    audio.suspend();
    audio.play("die");
    audio.setMusic("meadow");
    audio.update();
    assert.equal(h.ctxs.length, 1);
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 2));
  } finally {
    process.off("unhandledRejection", onRejection);
  }
  assert.deepEqual(seen, [], "no unhandled promise rejection escaped");
});
test("100 x play(gem) keeps live voices <= MAX_VOICES", () => {
  const { h, audio } = make();
  audio.unlock();
  let peak = 0;
  for (let i = 0; i < 100; i++) {
    assert.equal(typeof audio.play("gem"), "boolean");
    peak = Math.max(peak, h.live());
  }
  assert.ok(peak <= A.MAX_VOICES, `peak live voices ${peak} <= ${A.MAX_VOICES}`);
  assert.ok(h.oscs.length >= A.MAX_VOICES, "it really did schedule voices");
  assert.ok(h.oscs.length < 100 * 2, "extra sounds were dropped, not queued");
  // The cap is a budget over time, not a permanent shutdown.
  h.tick(2);
  assert.equal(h.live(), 0, "voices retire when their envelope ends");
  assert.equal(audio.play("gem"), true, "the budget recovers");
  for (let i = 0; i < 40; i++) audio.playEvents(A.EVENTS);
  assert.ok(h.live() <= A.MAX_VOICES, `burst peak ${h.live()} <= ${A.MAX_VOICES}`);
  h.tick(5);
  audio.setMusic("meadow");
  for (let i = 0; i < 600; i++) { audio.update(); h.tick(1 / 60); }
  assert.ok(h.live() <= A.MAX_VOICES, `music + sfx stay under the cap`);
});

test("playEvents counts what it schedules and never mutates the array", () => {
  const { h, audio } = make();
  audio.unlock();
  h.reset();
  const events = ["gem", "nope"];
  assert.equal(audio.playEvents(events), 1);
  assert.deepEqual(events, ["gem", "nope"], "the caller array is untouched");
  assert.equal(audio.playEvents([]), 0);
  assert.equal(audio.playEvents(["nope", "also-nope"]), 0);
  h.tick(3);
  const many = ["gem", "jump", "gem", "break", "gem"];
  assert.equal(audio.playEvents(many), 5);
  assert.deepEqual(many, ["gem", "jump", "gem", "break", "gem"]);
  assert.equal(audio.playEvents(null), 0);
  assert.equal(audio.playEvents("gem"), 0);
  assert.equal(audio.playEvents(undefined), 0);
  assert.equal(audio.playEvents({ length: 1, 0: "gem" }), 0);
  const muted = make();
  muted.audio.unlock();
  muted.audio.setMuted(true);
  assert.equal(muted.audio.playEvents(["gem", "gem"]), 0);
  assert.equal(muted.h.oscs.length, 0);
});

test("setMusic schedules only within 0.25 s of currentTime", () => {
  const { h, audio } = make();
  audio.unlock();
  h.reset();
  audio.setMusic("meadow");
  audio.update();
  const now = h.time;
  assert.ok(h.oscs.length > 0, "the loop starts scheduling right away");
  for (const o of h.oscs) {
    assert.ok(o.starts[0] >= now - 1e-9, `note start ${o.starts[0]} is not in the past`);
    assert.ok(o.starts[0] < now + 0.3, `note start ${o.starts[0]} is inside the lookahead`);
  }
  // Every later frame too: never more than the lookahead window ahead.
  let seenStarts = 0;
  for (let i = 0; i < 900; i++) {
    audio.update();
    h.tick(1 / 60);
    for (const o of h.oscs) {
      if (!o.starts.length) continue;
      assert.ok(o.starts[0] <= h.time + 0.3 + 1e-9, "a note was scheduled too far ahead");
      seenStarts += 0;
    }
  }
  assert.ok(h.oscs.length > 50, `the loop kept going (${h.oscs.length} notes)`);
  assert.ok(seenStarts === 0);
});
