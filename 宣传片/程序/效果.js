/* Frame-driven, deterministic overlays. No wall-clock reads or mutable randomness. */
(function (global) {
  function random(seed) { let n = seed >>> 0; return () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return (n >>> 0) / 4294967296; }; }
  function particles(seed, count) { const r = random(seed); return Array.from({length:count}, () => ({x:r(),y:r(),s:r(),v:r(),phase:r()})); }
  function glow(ctx, x, y, radius, color, alpha) { const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,`rgba(${color},${alpha})`);g.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2); }
  function render(ctx, w, h, kind, progress, seed=20261009) {
    const p=Math.max(0,Math.min(1,progress)); const ps=particles(seed,kind==='stars'?54:26);
    ctx.save();
    if(kind==='fire') {
      glow(ctx,w*.66,h*.7,h*.26,'240,157,60',.075+.025*Math.sin(p*Math.PI*12));
      ps.forEach(a=>{const t=(p*(.35+a.v*.5)+a.phase)%1;ctx.globalAlpha=Math.sin(t*Math.PI)*.65;ctx.fillStyle=a.s>.5?'#f7d197':'#e69643';ctx.beginPath();ctx.ellipse(w*(.6+a.x*.12)+Math.sin(t*9+a.phase*10)*9,h*(.8-t*.35),1+a.s*2,2+a.s*3,0,0,Math.PI*2);ctx.fill();});
    } else if(kind==='atmosphere') {
      ps.slice(0,8).forEach(a=>{glow(ctx,w*((a.x+p*.04)%1),h*(.25+a.y*.6),h*(.15+a.s*.18),'206,214,228',.012+.015*a.s);});
      glow(ctx,w*.8,h*.16,h*.48,'233,190,114',.06);
    } else if(kind==='network') {
      const nodes=particles(seed,12).map(a=>({x:w*(.50+a.x*.40),y:h*(.08+a.y*.20)}));
      ctx.lineWidth=Math.max(1,w/1200);ctx.strokeStyle='rgba(141,214,230,.32)';
      nodes.forEach((n,i)=>{if(i===0)return;const o=nodes[Math.floor((i-1)/2)];const t=Math.min(1,p*1.6);ctx.beginPath();ctx.moveTo(o.x,o.y);ctx.lineTo(o.x+(n.x-o.x)*t,o.y+(n.y-o.y)*t);ctx.stroke();});
      nodes.forEach((n,i)=>{glow(ctx,n.x,n.y,w*.008,'168,222,239',.5*(.7+.3*Math.sin(p*10+i)));ctx.globalAlpha=.8;ctx.fillStyle='#b9e4eb';ctx.beginPath();ctx.arc(n.x,n.y,w*.0014,0,Math.PI*2);ctx.fill();});
    } else if(kind==='stars') {
      ps.forEach(a=>{ctx.globalAlpha=.1+.45*(.5+.5*Math.sin(p*8+a.phase*12));ctx.fillStyle=a.s>.7?'#e9be72':'#f5edd9';ctx.beginPath();ctx.arc(w*a.x,h*a.y,.6+a.s*1.3,0,Math.PI*2);ctx.fill();});
      ctx.globalAlpha=.38;const g=ctx.createLinearGradient(w*.45,h*.60,w*.64,h*.48);g.addColorStop(0,'rgba(233,190,114,0)');g.addColorStop(1,'rgba(233,190,114,.65)');ctx.strokeStyle=g;ctx.lineWidth=h*.002;ctx.shadowColor='#e9be72';ctx.shadowBlur=h*.008;ctx.beginPath();ctx.moveTo(w*(.45+p*.003),h*.60);ctx.lineTo(w*(.64+p*.003),h*.48);ctx.stroke();
    } else if(kind==='cards') {
      ctx.strokeStyle='rgba(233,190,114,.45)';ctx.lineWidth=w*.001;ctx.setLineDash([w*.006,w*.01]);
      ctx.beginPath();ctx.moveTo(w*.19,h*.82);ctx.bezierCurveTo(w*.28,h*.72,w*.37,h*.72,w*.47,h*.61);ctx.stroke();
      const t=p*p*(3-2*p);glow(ctx,w*(.19+t*.28),h*(.82-t*.21),w*.026,'233,190,114',.12);
    }
    ctx.restore();
  }
  function cardOffset(index, progress) { const t=Math.max(0,Math.min(1,progress*1.4-index*.06));const e=1-Math.pow(1-t,3);return {x:(1-e)*-70,y:(1-e)*28,alpha:e,rotation:(1-e)*-.035}; }
  global.PromoEffects={render,cardOffset,particles};
  if(typeof module!=='undefined')module.exports=global.PromoEffects;
})(typeof window!=='undefined'?window:globalThis);
