(function(root){
  "use strict";
  var PAL={ '.':null,T:'#35d6c4',D:'#178a86',H:'#9ff5e6',O:'#0b3d45',W:'#ffffff',P:'#12203a',C:'#ff8fa0',F:'#0f6d6a',S:'#ff8a2b',Q:'#c9541a' };
  var FRAMES={idle:2,blink:1,run:6,rise:1,apex:1,fall:2,land:1,skid:1,hurt:1,dead:2,win:2};
  var RUN=[0,1,2,0,1,2], BOB=[0,1,-1,0,1,-1];
  function pip(name,i,big){
    var h=big?28:18,w=16, rows=Array.from({length:h},function(){return Array(w).fill('.');});
    if(!FRAMES[name]) name='idle'; i=(i|0)%FRAMES[name]; if(i<0)i+=FRAMES[name];
    var bob=name==='run'?BOB[i]:name==='idle'&&i?1:0, y0=big?3:1;
    function put(x,y,c){if(x>=0&&x<w&&y>=0&&y<h)rows[y][x]=c;}
    // Two wide feet and clear legs, tucked only in airborne poses.
    var legs=[[2,0],[10,0]];
    if(name==='run'){var poses=[[[1,0],[11,0]],[[3,0],[9,0]],[[2,0],[10,0]],[[0,0],[12,0]],[[4,0],[8,0]],[[2,-1],[10,1]]];legs=poses[i];}
    if(name==='rise'||name==='apex'||name==='fall'){legs=[[2,-1],[10,-1]];}
    if(name==='land'){legs=[[1,0],[11,0]];}
    if(name==='skid'){legs=[[2,0],[10,-1]];}
    if(name==='dead'&&i===1)legs=[[2,0],[10,0]];
    for(var l=0;l<2;l++){var lx=legs[l][0],ly=h-2+legs[l][1];put(lx,ly,'F');put(lx+1,ly,'F');put(lx+2,ly,'D');put(lx+3,ly,'F');put(lx,ly+1,'O');put(lx+1,ly+1,'F');put(lx+2,ly+1,'F');put(lx+3,ly+1,'O');}
    var top=y0+bob+(name==='skid'?1:name==='hurt'?-1:0), bottom=top+(big?19:11);
    if(name==='land')bottom-=1;
    for(var y=top;y<=bottom;y++)for(var x=2;x<=13;x++){
      var dx=(x-7.5)/6,dy=(y-(top+bottom)/2)/((bottom-top+1)/2);
      if(dx*dx+dy*dy<=1.03){var c=(y===top||x===2&&y<top+4)?'H':(y>=bottom-1||x>=12&&y>top+4)?'D':'T'; put(x,y,c); if(x===2||x===13||y===top||y===bottom)put(x,y,'O');}
    }
    // Narrow legs join the rounded body continuously to the feet.
    for(l=0;l<2;l++){var legX=legs[l][0]+(legs[l][0]>7?1:0);for(y=bottom+1;y<h-2+legs[l][1];y++){put(legX,y,'F');put(legX+1,y,'D');}}
    // Distinct neck wrap, separate tail and arm nubs.
    var neck=top+(big?17:9); for(var x=4;x<=11;x++)put(x,neck,x===4||x===11?'O':'S'); put(4,neck+1,'Q');put(5,neck+1,'S');put(5,neck+2,'S');put(6,neck+2,'Q');
    var armY=top+(big?13:7); var swing=name==='run'?[1,0,-1,-1,0,1][i]:0,armShift=name==='run'?[0,0,0,1,-1,2][i]:0; for(x=0;x<2;x++){put(x,armY+swing+armShift,'O');put(x+1,armY+1+swing+armShift,'T');put(14+x,armY-swing-armShift,'O');put(13+x,armY+1-swing-armShift,'D');}
    // Eyes sit in the upper third of the head on every pose.
    var ey=top+3; if(name==='blink'){for(x=4;x<=6;x++)put(x,ey+1,'O');for(x=9;x<=11;x++)put(x,ey+1,'O');}
    else if(name==='hurt'){for(x=0;x<3;x++){put(4+x,ey+x,'P');put(6-x,ey+x,'P');put(9+x,ey+x,'P');put(11-x,ey+x,'P');}}
    else {for(x=4;x<=6;x++)for(y=ey;y<ey+4;y++)put(x,y,'W');for(x=9;x<=11;x++)for(y=ey;y<ey+4;y++)put(x,y,'W'); put(5,ey+1,'P');put(5,ey+2,'P');put(10,ey+1,'P');put(10,ey+2,'P');put(4,ey,'H');put(9,ey,'H');}
    put(3,ey+4,'C');put(12,ey+4,'C');
    if(name==='win'){put(1,top+8,'O');put(1,top+7,'T');put(14,top+8,'O');put(14,top+7,'T');}
    return rows.map(function(r){return r.join('');});
  }
  function bake(rows,pal,makeCanvas){var c=makeCanvas(rows[0].length,rows.length),x=c.getContext('2d'); for(var y=0;y<rows.length;y++)for(var xx=0;xx<rows[y].length;xx++){var col=pal[rows[y][xx]];if(col){x.fillStyle=col;x.fillRect(xx,y,1,1);}}return c;}
  function createCache(makeCanvas){var cache=Object.create(null);return {get:function(name,i,big){var n=FRAMES[name]||2,idx=((i|0)%n+n)%n,key=(big?'b':'s')+name+idx;if(!cache[key])cache[key]=bake(pip(name,idx,big),PAL,makeCanvas);return cache[key];}};}
  var api={PAL:PAL,FRAMES:FRAMES,pip:pip,bake:bake,createCache:createCache}; root.PixelSprites=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
