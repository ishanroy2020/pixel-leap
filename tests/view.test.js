"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../view.js");
// Inputs are backing-store device pixels. Portrait uses 60% of height for play;
// S is the largest integer scale satisfying >=176 gp width (portrait) and
// >=224 gp play height. Width/height are game pixels.
const sizes = [[320,568,1],[375,667,2],[390,844,3],[430,932,3],[844,390,3],[932,430,2],[768,1024,1],[1024,768,2],[1280,800,1],[1920,1080,1]];
test("view sizing matches the documented contract and maximal scale", () => {
  assert.deepEqual(((v)=>[v.S,v.w,v.bandPx])(V.compute(390*3,844*3,3)), [6,195,1519]);
  assert.equal(V.compute(844*3,390*3,3).S, 5);
  assert.equal(V.compute(1280,800,1).S, 3);
  for (const [cw,ch,dpr] of sizes) {
    const pxW=cw*dpr, pxH=ch*dpr, v=V.compute(pxW,pxH,dpr,{});
    assert.ok(Number.isInteger(v.S) && v.S >= 1);
    assert.equal(v.bandPx, v.portrait ? Math.round(pxH*0.6) : pxH);
    assert.ok(Number.isInteger(v.offX));
    assert.equal(v.offY + v.h * v.S, v.offY + v.bandPx, "bottom game row meets the play-band bottom");
    if (v.portrait) assert.ok((pxW/(v.S+1)) < 176 || (v.bandPx/(v.S+1)) < 224);
    else assert.ok(pxH/(v.S+1) < 224);
    assert.equal(v.offY + v.bandPx, v.offY + v.bandPx); // band starts after top inset
  }
});
test("safe insets offset the band and preserve HUD usable width", () => {
  const dpr=3, safe={top:17,left:12,right:8};
  const v=V.compute(390*dpr,844*dpr,dpr,safe);
  assert.equal(v.offY, Math.ceil(safe.top*dpr/v.S)*v.S);
  assert.equal(v.offX, safe.left*dpr);
  assert.ok(v.offX + v.w*v.S <= 390*dpr-safe.right*dpr);
  assert.equal(v.bandPx, Math.round((844*dpr-v.offY)*0.6));
});
