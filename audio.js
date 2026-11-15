/* Pixel Leap - chiptune audio. No DOM, no canvas, no timers, no Web Audio objects
 * before unlock(). All effects and melodies are original compositions written for
 * this game by Codex; nothing is sampled or copied from any existing tune. */
(function (root) {
  "use strict";

  const EVENTS = ["jump", "gem", "sprout", "break", "bump", "powerup", "stomp", "hurt", "die", "gameover", "goal", "won", "life"];
  const THEMES = ["meadow", "caverns", "sky"];
  const MAX_VOICES = 24;
  const LOOKAHEAD = 0.25;
  const MASTER_GAIN = 0.8;

  // One-shot effects: short oscillator voices with gain envelopes (data only).
  const SFX = {
    jump: [{ wave: "square", f: 330, f2: 660, at: 0, dur: 0.12, vol: 0.24 }],
    gem: [
      { wave: "square", f: 880, f2: 1320, at: 0, dur: 0.07, vol: 0.22 },
      { wave: "triangle", f: 1320, at: 0.06, dur: 0.12, vol: 0.16 },
    ],
    sprout: [
      { wave: "triangle", f: 392, f2: 784, at: 0, dur: 0.18, vol: 0.22 },
      { wave: "square", f: 588, at: 0.1, dur: 0.1, vol: 0.14 },
    ],
    break: [
      { wave: "sawtooth", f: 220, f2: 55, at: 0, dur: 0.18, vol: 0.26 },
      { wave: "square", f: 165, at: 0.02, dur: 0.1, vol: 0.16 },
    ],
    bump: [{ wave: "square", f: 140, f2: 98, at: 0, dur: 0.07, vol: 0.2 }],
    powerup: [
      { wave: "square", f: 523, at: 0, dur: 0.06, vol: 0.2 },
      { wave: "square", f: 659, at: 0.06, dur: 0.06, vol: 0.2 },
      { wave: "square", f: 784, at: 0.12, dur: 0.06, vol: 0.2 },
      { wave: "triangle", f: 1047, at: 0.18, dur: 0.22, vol: 0.22 },
    ],
    stomp: [
      { wave: "triangle", f: 180, f2: 60, at: 0, dur: 0.12, vol: 0.26 },
      { wave: "square", f: 90, at: 0.01, dur: 0.08, vol: 0.16 },
    ],
    hurt: [{ wave: "sawtooth", f: 300, f2: 120, at: 0, dur: 0.22, vol: 0.24 }],
    die: [
      { wave: "square", f: 600, f2: 80, at: 0, dur: 1.0, vol: 0.24 },
      { wave: "triangle", f: 300, f2: 60, at: 0.2, dur: 0.9, vol: 0.16 },
    ],
    gameover: [
      { wave: "triangle", f: 392, at: 0, dur: 0.3, vol: 0.22 },
      { wave: "triangle", f: 330, at: 0.32, dur: 0.3, vol: 0.22 },
      { wave: "triangle", f: 262, at: 0.64, dur: 0.6, vol: 0.22 },
    ],
    goal: [
      { wave: "square", f: 587, at: 0, dur: 0.08, vol: 0.22 },
      { wave: "square", f: 880, at: 0.08, dur: 0.08, vol: 0.22 },
      { wave: "square", f: 1175, at: 0.16, dur: 0.08, vol: 0.22 },
      { wave: "triangle", f: 1568, at: 0.24, dur: 0.18, vol: 0.2 },
    ],
    won: [
      { wave: "square", f: 523, at: 0, dur: 0.24, vol: 0.24 },
      { wave: "square", f: 659, at: 0.26, dur: 0.24, vol: 0.24 },
      { wave: "square", f: 784, at: 0.52, dur: 0.24, vol: 0.24 },
      { wave: "triangle", f: 1047, at: 0.78, dur: 1.1, vol: 0.22 },
    ],
    life: [
      { wave: "square", f: 1047, at: 0, dur: 0.06, vol: 0.2 },
      { wave: "square", f: 1319, at: 0.06, dur: 0.14, vol: 0.2 },
    ],
  };

  // Original looping tunes, one per theme. lead/bass are [midi, beats] steps
  // (midi 0 = rest). Composed for this game; no existing tune is quoted.
  const MELODIES = {
    // Meadow: bright C-major pentatonic hop, 140 bpm, square lead.
    meadow: {
      bpm: 140,
      wave: "square",
      lead: [
        [72, 0.5], [76, 0.5], [79, 0.5], [84, 1.0], [81, 0.5], [79, 0.5], [76, 0.5], [79, 0.5],
        [72, 0.5], [76, 0.5], [79, 0.5], [84, 0.5], [86, 1.0], [84, 1.0], [79, 0.5], [81, 0.5],
        [84, 1.0], [0, 0.5], [84, 0.5], [81, 0.5], [79, 0.5], [76, 1.0], [79, 1.0],
      ],
      bass: [
        [48, 1.0], [55, 0.5], [55, 0.5], [53, 1.0], [55, 0.5], [60, 0.5], [48, 1.0], [55, 0.5],
        [55, 0.5], [57, 1.0], [60, 0.5], [62, 0.5], [48, 1.0], [53, 0.5], [55, 0.5], [60, 1.0],
      ],
    },
    // Caverns: slow A-minor drone, 84 bpm, triangle lead.
    caverns: {
      bpm: 84,
      wave: "triangle",
      lead: [
        [69, 1.0], [0, 0.5], [72, 0.5], [76, 1.0], [74, 0.5], [72, 0.5], [69, 1.0], [67, 1.0],
        [69, 0.5], [72, 0.5], [76, 1.0], [79, 1.0], [77, 0.5], [76, 0.5], [74, 1.0], [72, 1.0],
        [69, 2.0], [0, 1.0],
      ],
      bass: [
        [45, 1.0], [45, 1.0], [0, 1.0], [45, 1.0], [48, 1.0], [48, 1.0], [45, 1.0], [43, 1.0],
        [43, 1.0], [0, 1.0], [43, 1.0], [45, 1.0], [41, 1.0], [41, 1.0], [45, 1.0], [45, 1.0],
      ],
    },
    // Sky: fast G-major climb, 158 bpm, sawtooth lead.
    sky: {
      bpm: 158,
      wave: "sawtooth",
      lead: [
        [79, 0.5], [84, 0.5], [86, 0.5], [91, 1.0], [89, 0.5], [86, 0.5], [84, 0.5], [86, 0.5],
        [88, 0.5], [89, 0.5], [91, 1.0], [88, 0.5], [86, 0.5], [84, 0.5], [81, 0.5], [83, 0.5],
        [84, 1.0], [0, 0.5], [84, 0.5], [86, 1.0], [89, 1.0], [91, 1.5], [0, 0.5],
      ],
      bass: [
        [43, 0.5], [50, 0.5], [43, 0.5], [50, 0.5], [45, 0.5], [52, 0.5], [45, 0.5], [52, 0.5],
        [48, 0.5], [55, 0.5], [48, 0.5], [55, 0.5], [43, 0.5], [50, 0.5], [47, 0.5], [54, 0.5],
      ],
    },
  };

  function midiToHz(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // Bass runs one octave warmer than the lead; triangles keep it soft.
  function bassWave(leadWave) {
    return leadWave === "triangle" ? "sine" : "triangle";
  }

  function isMelodyStep(v) {
    return Array.isArray(v) && typeof v[0] === "number" && typeof v[1] === "number";
  }

  function stepsOf(v) {
    return Array.isArray(v) ? v.filter(isMelodyStep) : [];
  }

  function createAudio(options) {
    const opts = options || {};
    const Ctor = opts.AudioContext !== undefined
      ? opts.AudioContext
      : root.AudioContext || root.webkitAudioContext;
    let muted = opts.muted === true;

    let ctx = null;
    let master = null;
    let broken = false;
    const voices = [];
    let theme = null;
    let music = null;

    function now() {
      if (!ctx) return 0;
      const t = ctx.currentTime;
      return typeof t === "number" && isFinite(t) ? t : 0;
    }

    // Drop voices whose envelope has finished so the live count stays bounded.
    function pruneVoices() {
      const t = now();
      for (let i = voices.length - 1; i >= 0; i--) {
        const v = voices[i];
        if (v.end > t) continue;
        release(v);
        voices.splice(i, 1);
      }
    }

    function release(v) {
      try {
        if (v.osc && v.osc.disconnect) v.osc.disconnect();
      } catch (e) {
        /* ignore */
      }
      try {
        if (v.gain && v.gain.disconnect) v.gain.disconnect();
      } catch (e) {
        /* ignore */
      }
      v.released = true;
    }

    // One oscillator + one gain envelope. Returns null when the voice budget is
    // full or a node call throws, so callers just drop the sound.
    function spawn(wave, freq, glide, start, dur, vol, isMusic) {
      if (!ctx || !master) return null;
      if (!(dur > 0)) return null;
      if (voices.length >= MAX_VOICES) return null;
      if (!isMusic && dur > 2.5) return null;
      if (isMusic && dur > 3) return null;
      let osc = null;
      let gain = null;
      const end = start + dur;
      try {
        gain = ctx.createGain();
        osc = ctx.createOscillator();
        osc.type = wave;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(vol, start + Math.min(0.012, dur * 0.3));
        gain.gain.setValueAtTime(vol, start + dur * 0.6);
        gain.gain.linearRampToValueAtTime(0, end);
        osc.frequency.setValueAtTime(freq, start);
        if (glide) osc.frequency.linearRampToValueAtTime(glide, end);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(end + 0.002);
      } catch (e) {
        if (osc) {
          try {
            if (osc.disconnect) osc.disconnect();
          } catch (e2) {
            /* ignore */
          }
        }
        try {
          if (gain && gain.disconnect) gain.disconnect();
        } catch (e2) {
          /* ignore */
        }
        return null;
      }
      const v = { osc, gain, start, end, stopped: true, released: false, music: !!isMusic };
      voices.push(v);
      return v;
    }

    function stopVoice(v) {
      if (!v.stopped) {
        try {
          // Never stop earlier than the scheduled onset.
          if (v.osc && v.osc.stop) v.osc.stop(Math.max(now(), v.start + 0.005));
        } catch (e) {
          /* ignore */
        }
        v.stopped = true;
      }
      release(v);
      const i = voices.indexOf(v);
      if (i >= 0) voices.splice(i, 1);
    }

    function ensureContext() {
      if (ctx) return true;
      if (broken || typeof Ctor !== "function") return false;
      try {
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.setValueAtTime(MASTER_GAIN, now());
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
        master = null;
        broken = true;
        return false;
      }
      return true;
    }

    function chain(promise) {
      if (!promise || typeof promise.then !== "function") return;
      try {
        promise.then(nop, nop);
      } catch (e) {
        /* ignore */
      }
    }

    function nop() {}

    function callMethod(name) {
      if (!ctx || typeof ctx[name] !== "function") return;
      try {
        chain(ctx[name]());
      } catch (e) {
        /* ignore */
      }
    }

    function playEvent(name) {
      const parts = Object.prototype.hasOwnProperty.call(SFX, name) ? SFX[name] : null;
      if (!parts || parts.length === 0) return false;
      if (muted || !ctx || !master) return false;
      pruneVoices();
      if (voices.length >= MAX_VOICES) return false;
      const base = now();
      let scheduled = 0;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const start = base + (p.at > 0 ? p.at : 0);
        const v = spawn(p.wave, p.f, p.f2, start, p.dur, p.vol, false);
        if (!v) break;
        scheduled += 1;
      }
      return scheduled > 0;
    }

    // Flatten [midi, beats] steps into notes with cycle-relative onsets. A note
    // is held across following rests so rests act as ties, not gaps.
    function compileLane(steps, spb, wave, vol) {
      const onsets = [];
      let t = 0;
      for (let i = 0; i < steps.length; i++) {
        onsets.push(t);
        const beats = steps[i][1];
        t += beats > 0 ? beats * spb : 0;
      }
      const total = t;
      const notes = [];
      for (let i = 0; i < steps.length; i++) {
        const midi = steps[i][0];
        if (!(midi > 0)) continue;
        let end = onsets[i] + (steps[i][1] > 0 ? steps[i][1] * spb : 0);
        for (let j = i + 1; j < steps.length; j++) {
          if (steps[j][0] > 0) {
            end = onsets[j];
            break;
          }
          if (j === steps.length - 1) end = total;
        }
        const dur = end - onsets[i];
        if (dur > 0) notes.push({ start: onsets[i], dur, hz: midiToHz(midi), wave, vol });
      }
      return { notes, total };
    }

    function melodyFor(name) {
      if (typeof name !== "string") return null;
      const raw = MELODIES[name];
      if (!raw) return null;
      const bpm = typeof raw.bpm === "number" && raw.bpm > 0 ? raw.bpm : 120;
      const spb = 60 / bpm;
      const wave = raw.wave || "square";
      const lanes = [];
      const lead = compileLane(stepsOf(raw.lead), spb, wave, 0.17);
      const bass = compileLane(stepsOf(raw.bass), spb, bassWave(wave), 0.13);
      if (lead.notes.length > 0) lanes.push(lead);
      if (bass.notes.length > 0) lanes.push(bass);
      if (lanes.length === 0) return null;
      let len = 0;
      for (const l of lanes) len = Math.max(len, l.total);
      if (!(len > 0)) return null;
      return { lanes, len };
    }

    function newTrack(melody) {
      return { melody, cycle: 0, next: [0, 0], origin: null };
    }

    // Schedule notes whose start falls inside [currentTime, currentTime + 0.25).
    // Called once per frame; no timers are involved.
    function scheduleTrack(track, time, horizon) {
      const lanes = track.melody.lanes;
      if (track.origin === null) track.origin = time;
      let guard = 0;
      while (guard++ < 64) {
        const base = track.origin + track.cycle * track.melody.len;
        let scheduled = false;
        if (base < horizon) {
          for (let l = 0; l < lanes.length; l++) {
            const notes = lanes[l].notes;
            let i = track.next[l];
            while (i < notes.length) {
              const n = notes[i];
              const start = base + n.start;
              if (start >= horizon) break;
              const v = spawn(n.wave, n.hz, 0, start, n.dur, n.vol, true);
              if (!v) {
                track.next[l] = i;
                return;
              }
              i += 1;
              scheduled = true;
            }
            track.next[l] = i;
          }
        }
        // Wrap only once every lane has been drained inside this cycle. The check
        // below lets a fully-queued cycle advance even when its base has slid past
        // the horizon; without the wrap the loop stalls after its first bar.
        let drained = true;
        for (let l = 0; l < lanes.length; l++) {
          if (track.next[l] < lanes[l].notes.length) {
            drained = false;
            break;
          }
        }
        if (!drained) break;
        track.cycle += 1;
        track.next = [0, 0];
        if (!scheduled) break;
      }
    }

    function stopMusic() {
      if (!music) return;
      for (let i = voices.length - 1; i >= 0; i--) {
        if (voices[i].music) stopVoice(voices[i]);
      }
      music = null;
    }

    const audio = {
      // Must be called from a user gesture: creates the context once and resumes.
      unlock() {
        try {
          if (!ensureContext()) return false;
          callMethod("resume");
          return true;
        } catch (e) {
          broken = true;
          return false;
        }
      },
      available() {
        try {
          return !broken && !!ctx;
        } catch (e) {
          return false;
        }
      },
      play(name) {
        try {
          return playEvent(name);
        } catch (e) {
          return false;
        }
      },
      playEvents(events) {
        try {
          if (!Array.isArray(events)) return 0;
          let n = 0;
          for (let i = 0; i < events.length; i++) {
            if (playEvent(events[i])) n += 1;
          }
          return n;
        } catch (e) {
          return 0;
        }
      },
      setMusic(name) {
        try {
          const next = typeof name === "string" && name !== "" ? name : null;
          if (next !== null && !MELODIES[next]) {
            stopMusic();
            theme = null;
            return;
          }
          if (next === theme) return;
          stopMusic();
          theme = next;
        } catch (e) {
          music = null;
        }
      },
      update() {
        try {
          if (!theme || muted || !ctx) return;
          if (!music) {
            const melody = melodyFor(theme);
            if (!melody) {
              theme = null;
              return;
            }
            music = newTrack(melody);
          }
          const time = now();
          // Music voices are never released by a callback, so retire them here
          // once their envelope has finished; otherwise the voice budget fills and
          // the loop goes silent for good.
          pruneVoices();
          scheduleTrack(music, time, time + LOOKAHEAD);
        } catch (e) {
          /* ignore */
        }
      },
      setMuted(value) {
        try {
          muted = !!value;
          if (muted) {
            for (let i = voices.length - 1; i >= 0; i--) {
              if (!voices[i].music) stopVoice(voices[i]);
            }
          } else {
            // Unmuting re-arms the loop; the next update() resumes scheduling.
            stopMusic();
          }
        } catch (e) {
          /* ignore */
        }
      },
      isMuted() {
        return muted;
      },
      toggleMute() {
        try {
          audio.setMuted(!muted);
        } catch (e) {
          /* ignore */
        }
        return muted;
      },
      suspend() {
        try {
          callMethod("suspend");
        } catch (e) {
          /* ignore */
        }
      },
      resume() {
        try {
          callMethod("resume");
        } catch (e) {
          /* ignore */
        }
      },
    };

    return audio;
  }

  const PixelAudio = {
    EVENTS,
    THEMES,
    SFX,
    MELODIES,
    MAX_VOICES,
    LOOKAHEAD,
    createAudio,
  };

  root.PixelAudio = PixelAudio;
  if (typeof module === "object" && module.exports) {
    module.exports = PixelAudio;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);


