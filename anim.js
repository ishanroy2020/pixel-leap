(function(root){
  "use strict";
  function createPipAnimator(rng){rng=rng||Math.random;var timer=0,blinkAt=2.5+rng()*2,blinkLeft=0,hurt=0,stretch=0,squash=0,runClock=0,prevGround=true,prevMode='',phase=0,scarf=Array.from({length:6},function(_,i){return {x:0,y:i*2.5};}),out={name:'idle',frame:0,sx:1,sy:1,scarf:scarf};
    function update(p,input,dt,events,mode){dt=Math.max(0,Math.min(.1,+dt||0));events=events||[];timer+=dt;
      if(events.indexOf('jump')>=0)stretch=.12;if(events.indexOf('hurt')>=0)hurt=.3;if(events.indexOf('land')>=0&&Math.abs(p.vy||0)>200)squash=.09;
      if(stretch>0)stretch=Math.max(0,stretch-dt);if(squash>0)squash=Math.max(0,squash-dt);if(hurt>0)hurt=Math.max(0,hurt-dt);
      var vx=+p.vx||0,vy=+p.vy||0,ground=!!p.onGround,name,frame=0,speed=Math.abs(vx),iv=input&&typeof input==='object'?(+input.x||(+input.right||0)-(+input.left||0)):+input||0;
      if(mode==='dead'||mode==='gameover'||mode==='won'){name=mode==='won'?'win':'dead';frame=Math.floor(timer/(name==='win'?.25:.15))%2;}
      else if(hurt>0)name='hurt';else if(ground&&speed>60&&iv*vx<0)name='skid';else if(ground&&squash>0)name='land';
      else if(!ground)name=vy < -120?'rise':vy>120?'fall':'apex';
      else if(speed>8){name='run';runClock+=dt*Math.max(.25,Math.min(1,speed/220))/.065;frame=(Math.floor(runClock)-1+6)%6;}
      else {name='idle';if(blinkLeft>0){name='blink';blinkLeft=Math.max(0,blinkLeft-dt);}else if(timer>=blinkAt){name='blink';blinkLeft=.12;timer=0;blinkAt=2.5+rng()*2;}}
      if(name==='fall')frame=Math.floor(timer/.1)%2;
      if(mode!==prevMode){timer=0;prevMode=mode;}
      out.name=name;out.frame=frame;out.sx=stretch>0?.8+(1-.8)*(1-stretch/.12):squash>0?1.25-(.25*squash/.09):1;out.sy=stretch>0?1.2-.2*(1-stretch/.12):squash>0?.75+.25*(squash/.09):1;
      var facing=p.facing||1, t=phase;phase+=dt*9;
      scarf[0].x=(+p.x||0)+facing*2;scarf[0].y=(+p.y||0)+7;
      for(var j=1;j<6;j++){var q=scarf[j],prev=scarf[j-1],dx=q.x-prev.x,dy=q.y-prev.y,len=Math.hypot(dx,dy)||1;dx=dx/len*2.5;dy=dy/len*2.5;q.x=prev.x+dx+(vx? -Math.sign(vx)*.08:0);q.y=prev.y+Math.max(.12,dy)+Math.sin(t-j*.55)*.6;}
      for(j=0;j<6;j++)if(!Number.isFinite(scarf[j].x)||!Number.isFinite(scarf[j].y)){scarf[j].x=0;scarf[j].y=j*2.5;}
      prevGround=ground;return out;
    }
    return {update:update};
  }
  var api={createPipAnimator:createPipAnimator};root.PixelAnim=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
