(function(global){
  const images=new Map();
  async function load(src){if(images.has(src))return images.get(src);const image=new Image();image.src=src;await image.decode();images.set(src,image);return image;}
  async function ready(root=''){await Promise.all([document.fonts.load('700 80px SourceHan'),document.fonts.load('400 40px SourceHan')]);return root;}
  function cover(ctx,image,x,y,w,h,scale=1){const k=Math.max(w/image.width,h/image.height)*scale;ctx.drawImage(image,x+(w-image.width*k)/2,y+(h-image.height*k)/2,image.width*k,image.height*k);}
  function contain(ctx,image,x,y,w,h){const k=Math.min(w/image.width,h/image.height);ctx.drawImage(image,x+(w-image.width*k)/2,y+(h-image.height*k)/2,image.width*k,image.height*k);}
  function text(ctx,shot,only=false){
    const side=shot.textSide||'left';const x=side==='right'?1040:116;const y=shot.id==='10'?240:270;
    ctx.save();ctx.textBaseline='top';ctx.letterSpacing='2px';ctx.fillStyle='#e9be72';ctx.font='400 27px SourceHan';ctx.fillText('更迭 / ITERATION',x,100);ctx.fillRect(x,220,76,3);
    ctx.font=`700 ${shot.id==='10'?118:74}px SourceHan`;ctx.fillStyle='#f5edd9';ctx.shadowColor='rgba(6,14,28,.6)';ctx.shadowBlur=12;
    shot.lines.forEach((line,i)=>{ctx.fillStyle=i===shot.lines.length-1?'#e9be72':'#f5edd9';ctx.fillText(line,x,y+i*(shot.id==='10'?150:108));});
    ctx.shadowBlur=0;ctx.font='400 25px SourceHan';ctx.fillStyle='#f5edd9';ctx.fillText(shot.footer,x,945);
    if(shot.id==='10'){ctx.font='400 21px SourceHan';ctx.fillStyle='#bcc6d5';ctx.fillText('测试版',x,997);}
    ctx.restore();
  }
  async function render(canvas,shot,opts={}){
    await ready();const ctx=canvas.getContext('2d');const w=canvas.width,h=canvas.height;const p=opts.progress??.6;
    ctx.clearRect(0,0,w,h);ctx.save();ctx.scale(w/1920,h/1080);
    if(opts.textOnly){text(ctx,shot,true);ctx.restore();return;}
    const isProduct=shot.id==='05'||shot.id==='10';const base=shot.scenePath;
    const g=ctx.createLinearGradient(0,0,1920,1080);g.addColorStop(0,'#172b43');g.addColorStop(1,'#0c1625');ctx.fillStyle=g;ctx.fillRect(0,0,1920,1080);
    if(base){cover(ctx,await load(base),0,0,1920,1080,1+p*.022);}
    if(!base&&!isProduct){ctx.fillStyle='#e9be72';ctx.font='400 25px SourceHan';ctx.fillText('场景制作中 · '+shot.name,1100,150);}
    if(isProduct){
      const board=await load(shot.board);ctx.save();ctx.globalAlpha=shot.id==='05'?.95:.84;contain(ctx,board,760,150,1000,850);ctx.restore();
      const positions=shot.id==='05'?[[680,680,166,280],[870,710,166,280],[1060,720,166,280],[1410,540,226,370]]:[[1010,570,180,310],[1220,550,180,310],[1430,580,180,310]];
      for(let i=0;i<shot.cards.length;i++){const image=await load(shot.cards[i]);const a=positions[i%positions.length];const o=PromoEffects.cardOffset(i,p);ctx.save();ctx.globalAlpha=o.alpha;ctx.shadowColor='#060e1be0';ctx.shadowBlur=24;ctx.shadowOffsetY=12;contain(ctx,image,a[0]+o.x,a[1]+o.y,a[2],a[3]);ctx.restore();}
      if(shot.backs){for(let i=0;i<shot.backs.length;i++){const image=await load(shot.backs[i]);ctx.save();ctx.globalAlpha=.85;contain(ctx,image,1570+i*42,210+i*20,130,210);ctx.restore();}}
    }
    const side=shot.textSide||'left';const shade=ctx.createLinearGradient(side==='right'?1920:0,0,side==='right'?800:1120,0);shade.addColorStop(0,'rgba(9,18,32,.82)');shade.addColorStop(1,'rgba(9,18,32,0)');ctx.fillStyle=shade;ctx.fillRect(0,0,1920,1080);
    const bottom=ctx.createLinearGradient(0,1080,0,820);bottom.addColorStop(0,'rgba(9,18,32,.75)');bottom.addColorStop(1,'rgba(9,18,32,0)');ctx.fillStyle=bottom;ctx.fillRect(0,820,1920,260);
    if(!isProduct&&shot.cards&&shot.cards.length&&opts.showCards!==false){const cardW=shot.cards.length>1?170:210;const cardH=shot.cards.length>1?285:350;const right=side!=='right';for(let i=0;i<shot.cards.length;i++){const image=await load(shot.cards[i]);ctx.save();ctx.shadowColor='#08111dd9';ctx.shadowBlur=25;contain(ctx,image,right?1680-i*(cardW+16):120+i*(cardW+16),shot.id==='08'?100:690,cardW,cardH);ctx.restore();}}
    if(opts.effects!==false&&shot.effect){PromoEffects.render(ctx,1920,1080,shot.effect,p,20261009);}
    text(ctx,shot);ctx.restore();
  }
  global.PromoFrame={render,ready,load,cover,contain,text};
})(window);
