"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../view.js");
const sizes = [[320,568],[375,667],[390,844],[430,932],[844,390],[932,430],[768,1024],[1024,768],[1280,800],[1920,1080]];
test("view sizing covers band and panel with integer device-pixel tile edges", () => {
  for (const [w,h] of sizes) for (const dpr of [1,2,3]) {
    const v = V.compute(w*dpr,h*dpr,dpr,{});
    assert.ok(Number.isInteger(v.S) && v.S >= 1);
    assert.equal(v.bandPx + (h*dpr-v.bandPx),h*dpr);
    assert.ok(Math.abs(v.offX) < v.S);
    for (let gp=0; gp<=Math.ceil(v.w); gp++) assert.ok(Number.isInteger(Math.round((v.offX+gp*v.S))));
    if (v.portrait) assert.ok(v.w >= 176);
    else assert.ok(v.h >= 224);
  }
});
