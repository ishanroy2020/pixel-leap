"use strict";
function BackdropRoot(p){return Anim.scarfRoot(p,p.facing,false).x;}
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),Game=require("../game.js");
function load(file,key){const s={};s.globalThis=s;vm.runInNewContext(fs.readFileSync(require.resolve("../"+file),"utf8"),s);return s[key];}
const Backdrop=load("backdrop.js","PixelBackdrop"),Tiles=load("tiles.js","PixelTiles"),Props=load("props.js","PixelProps"),Anim=load("anim.js","PixelAnim");
test("hill row widths increase from top to base",()=>{const rows=Array.from({length:20},(_,i)=>Backdrop.hillRowWidth(80,20,i));assert.ok(rows[0]<rows[1]);assert.ok(rows[19]>rows[0]);assert.ok(rows.slice(1).every((v,i)=>v>=rows[i]));});
test("hill spans exclude every pit column",()=>{for(const pit of [2,5])for(const span of Backdrop.visibleSpans(8,[2,5]))assert.ok(!(span[0]<=pit&&pit<span[1]));});
test("cloud placements vary in height and shape",()=>{const c=Array.from({length:20},(_,i)=>Backdrop.cloudAt(i,122));assert.ok(new Set(c.map(x=>x.y)).size>=4);assert.ok(new Set(c.map(x=>x.shape)).size>=2);});
test("cloud colours match each theme",()=>{assert.equal(Backdrop.cloudColors("meadow").join(","),"#ffffff,#dff0ff");assert.ok(Backdrop.cloudColors("sky").some(c=>c==="#ffc2a0"));assert.ok(Backdrop.cloudColors("sky").some(c=>c==="#f08ba5"));assert.equal(Backdrop.cloudColors("caverns"),null);});
test("foreground eligibility requires low placement on clear grass",()=>{assert.equal(Backdrop.frontEligible("#",false,100,93),true);for(const ch of ["?","B","P","U"])assert.equal(Backdrop.frontEligible(ch,false,100,93),false);assert.equal(Backdrop.frontEligible("#",true,100,93),false);assert.equal(Backdrop.frontEligible("#",false,100,92),false);});
test("prop plans cover all three levels without entity or gem overlap",()=>{for(const l of Game.LEVELS){const parsed=Game.parseLevel(l.rows),props=Props.plan(parsed.tiles,l.theme,parsed.enemies,parsed.gems);assert.ok(props.length>=6,`${l.name}: ${props.length}`);for(const p of props){const x=p.x;assert.ok(!parsed.enemies.some(e=>x<e.x+e.w&&x+32>e.x));assert.ok(!parsed.gems.some(g=>x<g.x+8&&x+32>g.x-8));}}});
test("tile draw uses four pixel bake margin",()=>{assert.equal(Tiles.tileBakeOffset(64),60);});
test("pit fill reaches view bottom",()=>{const r=Tiles.pitFillRect(32,120,240);assert.equal(r.y+r.h,240);assert.equal(r.x,32);});
test("scarf trails opposite facing at rest and while rising",()=>{for(const [seconds,vy] of [[1,0],[.3,-180]]){const a=Anim.createPipAnimator(()=>0),p={x:100,y:100,vx:0,vy,onGround:vy===0,facing:1};for(let i=0;i<Math.round(seconds*60);i++)a.advanceScarf(p,null,1/60);const tail=a.update(p,0,0,[],null).scarf[5];assert.ok(tail.x<BackdropRoot(p),`${tail.x}`);}});
