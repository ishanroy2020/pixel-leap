"use strict";
const test=require("node:test"); const assert=require("node:assert/strict"); const fs=require("node:fs"); const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
test("page has the required mobile metadata, assets, scripts and rendering rules",()=>{
  assert.match(html,/name=["']viewport["'][^>]*viewport-fit=cover[^>]*user-scalable=no|name=["']viewport["'][^>]*user-scalable=no[^>]*viewport-fit=cover/i);
  assert.match(html,/<link\s+rel=["']manifest["'][^>]*href=["']manifest\.webmanifest/i);
  assert.match(html,/<link\s+rel=["']apple-touch-icon["'][^>]*icon-180\.png/i);
  assert.match(html,/<meta\s+property=["']og:image["']\s+content=["']https:\/\/ishanroy2020\.github\.io\/pixel-leap\/og\.png/i);
  const scripts=[...html.matchAll(/<script\s+src=["']([^"']+)["']/g)].map(x=>x[1]);
  const expected=["game.js","audio.js","controls.js","screens.js","camera.js","view.js"];
  let prior=-1;
  for(const f of expected){ const i=scripts.indexOf(f); assert.ok(i>prior,`${f} is loaded in required order`); assert.ok(fs.existsSync(path.join(__dirname,"..",f)),`${f} exists`); prior=i; }
  assert.ok(html.indexOf("<script>")>html.indexOf('src="view.js"'));
  assert.match(html,/touch-action\s*:\s*none/i); assert.match(html,/image-rendering\s*:\s*pixelated/i);
  assert.match(html,/@font-face[\s\S]*?fonts\/press-start-2p\.woff2/i);
  assert.doesNotMatch(html,/(?:src|href)\s*=\s*["']https?:/i);
  assert.doesNotMatch(html,/\bfetch\s*\(|\bXMLHttpRequest\b|\beval\s*\(|\bnew\s+Function\b|\.innerHTML\s*=/);
});
