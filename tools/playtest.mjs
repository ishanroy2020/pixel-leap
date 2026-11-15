// Pixel Leap playtest harness (no npm deps; Node 22+ and local Google Chrome).
// node tools/playtest.mjs OUT_DIR [URL]  -> OUT_DIR/report.json + screenshots
// Measures frame pacing (normal and 4x CPU throttle), runs a scripted play session per viewport,
// captures stills and short animation bursts, and records errors and network hosts.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os"; import { join, resolve } from "node:path";
const out = resolve(process.argv[2] || "playtest-out"); mkdirSync(out, { recursive: true });
const url = process.argv[3] || "file://" + resolve(new URL(".", import.meta.url).pathname, "..", "index.html");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "pl-pt-"))}`,
  "--no-first-run", "--no-sandbox", "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws; for (let i = 0; i < 60; i++) { try { const t = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const p = t.find(x => x.type === "page"); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {} await sleep(200); }
if (!ws) { chrome.kill(); throw new Error("Chrome did not expose a DevTools page on the local debugging port"); }
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0; const pending = new Map(); const errors = [], hosts = new Set(), blackPixels = {};
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console.error: " + m.params.args.map(a => a.value ?? a.description).join(" "));
  if (m.method === "Network.requestWillBeSent") { const u = m.params.request.url; hosts.add(u.startsWith("file:") ? "file" : u.split("/")[2]); }
  if (m.method === "Network.loadingFailed") errors.push("failed load: " + m.params.errorText); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const key = (type, k, code) => send("Input.dispatchKeyEvent", { type, key: k, code });
const tap = async (k, code, ms = 60) => { await key("keyDown", k, code); await sleep(ms); await key("keyUp", k, code); };
const shot = async name => {
  const count = await ev(`(() => { const c=document.getElementById("game"); if(!c) return -1; const d=c.getContext("2d",{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i]===0&&d[i+1]===0&&d[i+2]===0) n++; return n; })()`);
  blackPixels[name] = Number(count ?? -1);
  const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(out, name), Buffer.from(r.result.data, "base64")); return name;
};
// rAF interval recorder, installed before any page script runs.
const PROBE = `window.__pt = { d: [], last: 0, on: false };
  (function loop(t) { const p = window.__pt; if (p.on && p.last) p.d.push(t - p.last); p.last = t; requestAnimationFrame(loop); })(0);`;
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Page.addScriptToEvaluateOnNewDocument", { source: PROBE });
const stats = d => { if (!d.length) return null; const s = [...d].sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  return { frames: d.length, fps: +(1000 / mean).toFixed(1), meanMs: +mean.toFixed(2), p95Ms: +q(0.95).toFixed(2), maxMs: +s[s.length - 1].toFixed(2),
    jankPct: +(100 * d.filter(x => x > 20).length / d.length).toFixed(1), stdevMs: +Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length).toFixed(2) }; };
const state = () => ev(`(() => { const s = window.__pixelLeap && window.__pixelLeap.state; return s ? {mode: s.mode, level: s.level, x: Math.round(s.player.x), y: Math.round(s.player.y), big: s.player.big, score: s.score, lives: s.lives} : null; })()`);
async function playSession(label, level) {
  const target = new URL(url); target.searchParams.set("level", String(level));
  await send("Page.navigate", { url: target.toString() }); await sleep(1500);
  const shots = [await shot(`${label}-01-title.png`)];
  await tap("Enter", "Enter"); await sleep(400);
  await ev(`window.__pt.d = []; window.__pt.on = true`);
  await key("keyDown", "ArrowRight", "ArrowRight");
  const burst = [];
  for (let i = 0; i < 24; i++) {
    if (i % 4 === 0) await key("keyDown", " ", "Space");
    if (i % 4 === 2) await key("keyUp", " ", "Space");
    await sleep(120);
    if (i >= 4 && i < 10) burst.push(await shot(`${label}-burst-${String(i - 3).padStart(2, "0")}.png`));
    if (i === 16) shots.push(await shot(`${label}-02-play.png`));
  }
  await key("keyUp", "ArrowRight", "ArrowRight"); await key("keyUp", " ", "Space");
  const pacing = stats(await ev(`(window.__pt.on = false, window.__pt.d)`));
  const st = await state();
  if (st && st.level !== level) errors.push(`${label}: requested world ${level}, observed level ${st.level}`);
  await sleep(1300); shots.push(await shot(`${label}-03-after.png`));
  return { pacing, state: st, shots, burst };
}
const report = { url, at: new Date().toISOString(), viewports: {}, blackPixels };
for (const [label, w, h, mob] of [["iphone-portrait", 390, 844, true], ["iphone-landscape", 844, 390, true], ["desktop", 1280, 800, false]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: mob ? 3 : 1, mobile: mob });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mob, maxTouchPoints: 5 });
  await send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const worlds = [];
  let slow;
  for (const [level, world] of [[0,"meadow"],[1,"caverns"],[2,"sky-isles"]]) {
    const normal = await playSession(`${label}-${world}`, level);
    await send("Emulation.setCPUThrottlingRate", { rate: 4 });
    slow = await playSession(`${label}-cpu4x-${world}`, level);
    await send("Emulation.setCPUThrottlingRate", { rate: 1 });
    worlds.push({ world, normal, cpu4x: { pacing: slow.pacing, state: slow.state } });
  }
  report.viewports[label] = { worlds };
}
report.errors = errors; report.hosts = [...hosts];
report.blackPixels = blackPixels;
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 1));
const blackFailures = Object.entries(blackPixels).filter(([, n]) => n !== 0);
const summary = { out, errors, hosts: report.hosts, blackPixelFailures: blackFailures,
  pacing: Object.fromEntries(Object.entries(report.viewports).map(([k, v]) => [k, v.worlds.map(w => ({ world:w.world, normal:w.normal.pacing, cpu4x:w.cpu4x.pacing }))])) };
console.log(JSON.stringify(summary, null, 1));
ws.close(); chrome.kill();
if (blackFailures.length || errors.length) process.exit(1);
