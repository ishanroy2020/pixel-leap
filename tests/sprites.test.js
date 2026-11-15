"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),S=require('../sprites.js');
test('all Pip frames have expected dimensions and palette keys',()=>{
 for(const [name,count] of Object.entries(S.FRAMES))for(let i=0;i<count;i++)for(const big of [false,true]){const rows=S.pip(name,i,big);assert.equal(rows.length,big?28:18);assert.ok(rows.every(r=>r.length===16));for(const r of rows)for(const k of r)assert.ok(Object.hasOwn(S.PAL,k),`unknown key ${k}`);}
});
test('frame counts match the Pip table',()=>assert.deepEqual(S.FRAMES,{idle:2,blink:1,run:6,rise:1,apex:1,fall:2,land:1,skid:1,hurt:1,dead:2,win:2}));
test('cache bakes each key once',()=>{let n=0;const c=S.createCache((w,h)=>{n++;return {w,h,getContext(){return {fillRect(){}}}}});c.get('run',2,false);c.get('run',2,false);c.get('run',2,true);assert.equal(n,2);});
test('eyes stay in upper half of each head',()=>{for(const [name,count] of Object.entries(S.FRAMES))for(let i=0;i<count;i++){const rows=S.pip(name,i,false), eyeRows=[];rows.forEach((r,y)=>{if(y<9&&(/[WP]/.test(r)||name==='blink'&&/[O]/.test(r.slice(4,12))))eyeRows.push(y)});assert.ok(eyeRows.length,`${name} ${i} has eyes in upper half`);}});
