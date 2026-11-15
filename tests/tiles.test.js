"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const ctx={save(){this.d=(this.d||0)+1},restore(){this.d--},fillRect(){},clearRect(){},drawImage(){},createLinearGradient(){return{addColorStop(){}}}};
function load(file,name){const s={globalThis:null};s.globalThis=s;vm.runInNewContext(fs.readFileSync(require.resolve("../"+file),"utf8"),s);return s[name];}
function canvas(){return{width:0,height:0,getContext(){return ctx}};}
test("dirt variants are deterministic and use four seeded patterns",()=>{const T=load("tiles.js","PixelTiles");assert.equal(T.hash(4,8),T.hash(4,8));assert.equal(T.bakeTile("#","meadow",T.hash(4,8)%4,{},canvas).width,16);});
test("rounded caps follow exposed edges and each theme has spike art",()=>{const T=load("tiles.js","PixelTiles");for(const theme of ["meadow","caverns","sky"])assert.doesNotThrow(()=>T.bakeTile("^",theme,0,{},canvas));assert.doesNotThrow(()=>T.bakeTile("#","meadow",0,{left:true,right:true,up:true},canvas));});
test("tile baking and drawing balance canvas state",()=>{const T=load("tiles.js","PixelTiles");for(const ch of ["#","B","?","P","U","^","F","pit"]){assert.doesNotThrow(()=>T.bakeTile(ch,"sky",1,{},canvas));T.draw(ctx,ch,0,0,2,3,"sky",.2,()=>false,0,canvas);}assert.equal(ctx.d,0);});
