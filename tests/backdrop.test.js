"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require.resolve("../backdrop.js"),"utf8"),scope={};scope.globalThis=scope;vm.runInNewContext(source,scope);
function context(){return{depth:0,save(){this.depth++},restore(){this.depth--},fillRect(){},drawImage(){},createLinearGradient(){return{addColorStop(){}}}};}
test("backdrop draws every theme and balances canvas state",()=>{for(const theme of ["meadow","caverns","sky"]){const c=context();assert.doesNotThrow(()=>scope.PixelBackdrop.draw(c,theme,0,{w:180,h:240},1,[4],()=>({width:0,height:0,getContext(){return c}})));scope.PixelBackdrop.drawFront(c,theme,0,{w:180,h:240},1);assert.equal(c.depth,0);}});
test("pit span helper removes pit columns",()=>{assert.equal(JSON.stringify(scope.PixelBackdrop.visibleSpans(10,[3,4])),JSON.stringify([[0,3],[5,10]]));});
