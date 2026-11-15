(function(root){
  "use strict";
  function findFloor(state,x,y){var tiles=state&&state.tiles;if(!tiles||!tiles.length)return null;var col=Math.floor(x/16),start=Math.max(0,Math.floor(y/16));for(var r=start;r<tiles.length;r++){var row=tiles[r];if(row&&'#B?PU'.indexOf(row[col])>=0&&row[col]!=='.')return r*16;}return null;}
  function createPipAnimator(rng){rng=rng||Math.random;var timer=0,blinkAt=2.5+rng()*2,blinkLeft=0,hurt=0,stretch=0,squash=0,runClock=0,prevGround=true,prevMode='',phase=0,scarf=Array.from({length:6},function(_,i){return {x:0,y:i*2.5};}),out={name:'idle',frame:0,sx:1,sy:1,scarf:scarf};
    function update(p,input,dt,events,mode,drawPos){dt=Math.max(0,Math.min(.05,+dt||0));events=events||[];timer+=dt;
      if(events.indexOf('jump')>=0)stretch=.12;if(events.indexOf('hurt')>=0)hurt=.3;
      var vx=+p.vx||0,vy=+p.vy||0,ground=!!p.onGround,name,frame=0,speed=Math.abs(vx),iv=input&&typeof input==='object'?(+input.x||(+input.right||0)-(+input.left||0)):+input||0;
      if(ground&&!prevGround){if(Math.abs(lastAirVy)>200)squash=.09;}if(!ground)lastAirVy=vy;
      if(stretch>0)stretch=Math.max(0,stretch-dt);if(squash>0)squash=Math.max(0,squash-dt);if(hurt>0)hurt=Math.max(0,hurt-dt);
      var mapped=mode==='dying'||mode==='dead'||mode==='gameover'?'dead':mode==='levelclear'||mode==='won'||mode==='win'?'win':mode;
      if(mapped==='dead'||mapped==='win'){name=mapped;frame=Math.floor(timer/(name==='win'?.25:.15))%2;}
      else if(hurt>0)name='hurt';else if(ground&&speed>60&&iv*vx<0)name='skid';else if(ground&&squash>0)name='land';
      else if(!ground)name=vy < -120?'rise':vy>120?'fall':'apex';
      else if(speed>8){name='run';runClock+=dt*Math.max(.25,Math.min(1,speed/150))/.065;frame=Math.floor(runClock+1e-8)%6;}
      else {name='idle';frame=Math.floor(timer/.6)%2;if(blinkLeft>0){name='blink';blinkLeft=Math.max(0,blinkLeft-dt);}else if(timer>=blinkAt){name='blink';blinkLeft=.12;timer=0;blinkAt=2.5+rng()*2;}}
      if(name==='fall')frame=Math.floor(timer/.1)%2;
      if(mapped!==prevMode){timer=0;prevMode=mapped;}
      out.name=name;out.frame=frame;out.sx=stretch>0?.8+(1-.8)*(1-stretch/.12):squash>0?1.25-(.25*squash/.09):1;out.sy=stretch>0?1.2-.2*(1-stretch/.12):squash>0?.75+.25*(squash/.09):1;
      var facing=p.facing||1,t=phase,rootX=drawPos?drawPos.x:(+p.x||0),rootY=drawPos?drawPos.y:(+p.y||0),neckX=rootX+(facing>0?-1:13),neckY=rootY+(p.big?19:11);phase+=dt*9;
      scarf[0].x=neckX;scarf[0].y=neckY;
      for(var j=1;j<6;j++){var q=scarf[j],prev=scarf[j-1],dx=q.x-prev.x,dy=q.y-prev.y,len=Math.hypot(dx,dy)||1,back=-Math.sign(vx)*Math.min(2.4,speed/150*2.4);dx=dx/len*2.5;dy=dy/len*2.5;q.x=prev.x+dx+back*.35;q.y=prev.y+dy+.28+Math.sin(phase-j*.55)*.6;}
      for(j=0;j<6;j++)if(!Number.isFinite(scarf[j].x)||!Number.isFinite(scarf[j].y)){scarf[j].x=neckX;scarf[j].y=neckY+j*2.5;}
      prevGround=ground;return out;
    }
    var lastAirVy=0;return {update:update};
  }
  var api={createPipAnimator:createPipAnimator,findFloor:findFloor};root.PixelAnim=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
