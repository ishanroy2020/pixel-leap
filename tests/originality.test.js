"use strict";
const test=require("node:test"); const assert=require("node:assert/strict"); const cp=require("node:child_process"); const fs=require("node:fs");
// Assemble forbidden names from code points so this acceptance test does not match itself.
const banned=[ [80,111,107,195,169,109,111,110], [77,97,114,105,111], [83,111,110,105,99], [77,105,110,101,99,114,97,102,116], [90,101,108,100,97] ].map(a=>String.fromCharCode(...a));
test("tracked text files do not contain banned franchise names",()=>{
  const files=cp.execFileSync("git",["ls-files"],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
  const found=[];
  for(const f of files){ try { const b=fs.readFileSync(f); if(b.includes(0)) continue; const s=b.toString("utf8"); for(const n of banned) if(new RegExp(n,"i").test(s)) found.push(`${f}: ${n}`); } catch {} }
  assert.deepEqual(found,[]);
});
