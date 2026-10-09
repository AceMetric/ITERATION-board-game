import * as THREE from './vendor/three.module.js';
import {SETTINGS as S} from './参数.js';
const W=S.width,H=S.height,D=S.camera.distance;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const curve=(t,a,b)=>ease((t-a)/(b-a));
const rand=seed=>()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
const r=rand(S.seed),dust=Array.from({length:64},()=>({x:r(),y:r(),phase:r(),speed:r(),size:r()}));
const paths={fireBG:'素材/火光/背景.png',people:'素材/火光/人物与器物.png',near:'素材/火光/近景.png',flame:'素材/火光/火焰.png',pyramidBG:'素材/金字塔/环境.png',pyramids:'素材/金字塔/建筑.png',spaceBG:'../素材/图层/BG-09/L-09-BG.png',earth:'../素材/图层/BG-09/L-09-EARTH.png',ship:'../素材/图层/BG-09/L-09-SHIP.png',pyramidOriginal:'../素材/正式场景/BG-04A-金字塔.png',card:'../../卡牌/奇观/时代1/金字塔.jpg',board:'../../版图/版图.png',back:'../../卡牌/奇观/时代1/卡背.png',gold:'../../卡牌/资源/金币1.png',labor:'../../卡牌/资源/人力1.png',ore:'../../卡牌/资源/矿物1.png'};
const tex={},imgs={};let renderer,camera,scene,out,ctx,groups={},nodes={},oldCanvas;
const frag=`uniform sampler2D map;uniform float opacity;uniform float lightGain;uniform vec2 lightUV;uniform vec3 lightColor;uniform vec2 uvScale;uniform float printedMask;varying vec2 vUv;void main(){vec4 c=texture2D(map,(vUv-.5)*uvScale+.5);if(printedMask>.5){bool art=vUv.x>.10&&vUv.x<.90&&vUv.y>.51&&vUv.y<.90;bool badge=false;for(int i=0;i<3;i++){vec2 d=(vUv-vec2(.778,.857-float(i)*.088))*vec2(.613,1.);if(length(d)<.038)badge=true;}if(art&&!badge)c.a=0.;}if(c.a<.008)discard;vec2 delta=(vUv-lightUV)*vec2(1.7778,1.);float light=exp(-dot(delta,delta)*10.)*lightGain;c.rgb+=lightColor*light*(.25+.75*c.rgb);gl_FragColor=vec4(c.rgb,c.a*opacity);#include <colorspace_fragment>}`.replace(';#include',';\n#include');
const vertex=`varying vec2 vUv;uniform float time;uniform float deform;void main(){vUv=uv;vec3 p=position;float a=pow(uv.y,1.5)*deform;p.x+=sin(uv.y*12.+time*8.)*a;p.y+=sin(uv.x*10.+time*11.)*a*.55;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
function material(texture){return new THREE.ShaderMaterial({uniforms:{map:{value:texture},opacity:{value:1},lightGain:{value:0},lightUV:{value:new THREE.Vector2(.68,.24)},lightColor:{value:new THREE.Vector3(1,.35,.06)},uvScale:{value:new THREE.Vector2(1,1)},printedMask:{value:0},time:{value:0},deform:{value:0}},vertexShader:vertex,fragmentShader:frag,transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide});}
function plane(texture,w,h,z,order,group){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h,24,24),material(texture));mesh.position.z=z;mesh.renderOrder=order;if(group)group.add(mesh);return mesh;}
function registered(texture,z,order,group,overscan=1){const f=(D-z)/D;return plane(texture,W*f*overscan,H*f*overscan,z,order,group);}
function screenPoint(mesh,u,v){const p=new THREE.Vector3((u-.5)*mesh.geometry.parameters.width,(.5-v)*mesh.geometry.parameters.height,0);mesh.updateWorldMatrix(true,false);p.applyMatrix4(mesh.matrixWorld).project(camera);return{x:(p.x*.5+.5)*W,y:(-.5*p.y+.5)*H};}
function alpha(mesh,a){mesh.material.uniforms.opacity.value=clamp(a);mesh.visible=a>.0001;}
function glow(x,y,rx,ry,color,a){ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(${color},${a})`);g.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();}
function cover2(image,x,y,w,h){const k=Math.max(w/image.width,h/image.height);ctx.drawImage(image,x+(w-image.width*k)/2,y+(h-image.height*k)/2,image.width*k,image.height*k);}
function resetCamera(){camera.position.set(0,0,D);camera.rotation.set(0,0,0);camera.updateProjectionMatrix();}
function makeCard(texture,height,order,group){return plane(texture,height*texture.image.width/texture.image.height,height,0,order,group);}
export async function init(canvas){out=canvas;out.width=W;out.height=H;ctx=out.getContext('2d',{alpha:false});await Promise.all([document.fonts.load('700 70px SourceHan'),document.fonts.load('400 24px SourceHan')]);
 renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor('#0a1322',1);
 camera=new THREE.PerspectiveCamera(2*Math.atan(H/2/D)*180/Math.PI,W/H,1,6000);resetCamera();scene=new THREE.Scene();
 const loader=new THREE.TextureLoader();await Promise.all(Object.entries(paths).map(async([key,url])=>{const t=await loader.loadAsync(url);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;tex[key]=t;imgs[key]=t.image;}));
 for(const key of ['fire','choice','space']){groups[key]=new THREE.Group();scene.add(groups[key]);}
 nodes.fireBG=registered(tex.fireBG,-330,0,groups.fire,1.16);
 nodes.people=plane(tex.people,S.fire.people.width,S.fire.people.width*imgs.people.height/imgs.people.width,0,2,groups.fire);nodes.people.position.set(S.fire.people.x-W/2,H/2-S.fire.people.y,0);
 nodes.near=registered(tex.near,150,5,groups.fire,1.04);
 nodes.flame=plane(tex.flame,S.fire.flame.width,S.fire.flame.height,15,4,groups.fire);nodes.flame.position.set(S.fire.source.x-W/2,H/2-S.fire.source.y+S.fire.flame.height/2,15);
 nodes.pyramidBG=registered(tex.pyramidBG,-280,0,groups.choice,1.12);nodes.pyramids=registered(tex.pyramids,-30,1,groups.choice);
 nodes.board=plane(tex.board,960,960,-130,2,groups.choice);nodes.board.position.set(280,-20,-130);nodes.board.rotation.x=-.23;
 nodes.card=makeCard(tex.card,900,5,groups.choice);
 nodes.printed=makeCard(tex.card,900,7,groups.choice);nodes.printed.material.uniforms.printedMask.value=1;
 // A scene-bearing plane meets the actual card's illustration window during the pullback.
 nodes.window=plane(tex.pyramidOriginal,1920,1080,5,6,groups.choice);
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=128;const sc=shadowCanvas.getContext('2d');sc.scale(1,.5);const sg=sc.createRadialGradient(128,128,0,128,128,120);sg.addColorStop(0,'rgba(0,0,0,.65)');sg.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=sg;sc.fillRect(0,0,256,256);const st=new THREE.CanvasTexture(shadowCanvas);st.colorSpace=THREE.SRGBColorSpace;
 nodes.shadow=plane(st,600,260,-100,3,groups.choice);nodes.resources=[];nodes.resourceShadows=[];
 for(const [i,key]of ['gold','labor','ore'].entries()){nodes.resources.push(makeCard(tex[key],330,8+i*2,groups.choice));nodes.resourceShadows.push(plane(st,310,180,-95,7+i*2,groups.choice));}
 nodes.spaceBG=registered(tex.spaceBG,-500,0,groups.space,1.18);nodes.earth=registered(tex.earth,-90,2,groups.space,1.07);nodes.ship=registered(tex.ship,60,4,groups.space);
 oldCanvas=document.createElement('canvas');oldCanvas.width=W;oldCanvas.height=H;
 window.promoMovie={render,settings:S,canvas:out,diagnostics:()=>({renderer:renderer.info.render,webgl:renderer.capabilities.isWebGL2,three:THREE.REVISION,paths,fonts:document.fonts.check('700 70px SourceHan')})};
 await render(0);return window.promoMovie;
}
function fireMotion(t){const p=ease(t/5.6);camera.position.set(mix(S.fire.cameraStart.x,S.fire.cameraEnd.x,p),mix(S.fire.cameraStart.y,S.fire.cameraEnd.y,p),mix(S.fire.cameraStart.z,S.fire.cameraEnd.z,p));
 const f=.55+.22*Math.sin(t*15.2)+.14*Math.sin(t*23.7+.5)+.09*Math.sin(t*8.3);
 nodes.people.material.uniforms.lightGain.value=.14+f*.14;nodes.people.material.uniforms.lightUV.value.set(.57,.23);
 nodes.near.material.uniforms.lightGain.value=.035+f*.035;nodes.fireBG.material.uniforms.lightGain.value=.025+f*.025;
 nodes.flame.material.uniforms.time.value=t;nodes.flame.material.uniforms.deform.value=10;nodes.flame.scale.set(1+.025*Math.sin(t*9),1+.045*Math.sin(t*12.3),1);
 return{p,f};}
function choiceMotion(t){resetCamera();const reveal=curve(t,...S.choice.reveal),land=curve(t,...S.choice.land),pull=curve(t,0,1.3);camera.position.z=mix(1435,1500,pull);
 alpha(nodes.pyramidBG,1-reveal);alpha(nodes.pyramids,1-reveal);nodes.pyramids.position.x=mix(40,28,pull);nodes.pyramids.position.y=58;
 alpha(nodes.board,curve(t,1.8,3.1));nodes.board.rotation.z=mix(-.09,0,land);
 const height=mix(3920,S.choice.cardEnd.height,reveal),x=mix(960,S.choice.cardEnd.x,reveal),y=mix(1324,S.choice.cardEnd.y,reveal)-Math.sin(land*Math.PI)*65;
 nodes.card.scale.setScalar(height/900);nodes.card.position.set(x-W/2,H/2-y,mix(90,0,land));nodes.card.rotation.set(mix(.0,-.035,land),Math.sin(land*Math.PI)*-.42,mix(-.03,.035,land));alpha(nodes.card,curve(t,.95,1.5));
 // Original card art window: x 12–88%, y 19–62%. As it reaches the window,
 // blend back to the unmodified original artwork; never regenerate its printed face.
 const cardWidth=height*imgs.card.width/imgs.card.height;
 const targetW=cardWidth*.80,targetH=height*.38;
 nodes.window.scale.set(targetW/1920,targetH/1080,1);
 nodes.window.material.uniforms.uvScale.value.set((targetW/targetH)/(imgs.pyramidOriginal.width/imgs.pyramidOriginal.height),1);
 nodes.window.position.copy(nodes.card.position).add(new THREE.Vector3(0,height*.20,1).applyEuler(nodes.card.rotation));
 nodes.window.rotation.copy(nodes.card.rotation);alpha(nodes.window,curve(t,.7,.95)*(1-curve(t,2.3,2.7)));
 nodes.printed.position.copy(nodes.card.position);nodes.printed.rotation.copy(nodes.card.rotation);nodes.printed.scale.copy(nodes.card.scale);alpha(nodes.printed,curve(t,.95,1.5));

 nodes.shadow.position.set(x-W/2+mix(55,9,land),H/2-y-height*.38,-100);nodes.shadow.scale.setScalar(mix(1.3,.72,land));alpha(nodes.shadow,curve(t,1.8,2.8)*mix(.25,.75,land));
 for(let i=0;i<3;i++){const a=curve(t,3.2+i*.35,3.95+i*.35);const m=nodes.resources[i],destX=760+i*210,destY=810;
 alpha(m,a);m.position.set(mix(-580,destX-W/2,a),mix(-420,H/2-destY,a)+Math.sin(a*Math.PI)*150,mix(180,15,a));m.rotation.set(mix(.25,-.025,a),mix(.65,0,a),mix(-.35,.03*(i-1),a));
 const sh=nodes.resourceShadows[i];sh.position.set(m.position.x+mix(60,8,a),m.position.y-120,-95);sh.rotation.z=m.rotation.z*.3;sh.scale.setScalar(mix(1.3,.7,a));alpha(sh,a*.65);}
 return{reveal,land};}
function spaceMotion(t){const p=ease(t/6);camera.position.set(mix(-28,15,p),mix(10,-6,p),mix(1500,1435,p));nodes.ship.position.x=mix(...S.space.shipTravel,p);nodes.ship.position.y=mix(...S.space.shipRise,p);nodes.ship.rotation.z=.006*Math.sin(t*.8);
 nodes.earth.scale.setScalar(mix(1,.97,p));nodes.earth.position.y=mix(0,-20,p);nodes.earth.position.x=mix(0,-25,p);
 const power=.55+.45*curve(t,.6,3.2)+.06*Math.sin(t*12);nodes.ship.material.uniforms.lightGain.value=.08+power*.09;nodes.ship.material.uniforms.lightUV.value.set(.617,.505);nodes.ship.material.uniforms.lightColor.value.set(1,.6,.15);
 return{p,power};}
function fireFX(t,state){const a=screenPoint(nodes.flame,.5,.85);ctx.save();ctx.globalCompositeOperation='screen';glow(a.x,a.y-70,280,270,'246,132,30',.09+state.f*.06);glow(a.x,a.y-80,70,150,'255,208,92',.1);ctx.restore();
 // Smoke has an age, rises, spreads, then disappears; particles are anchored to the fire.
 for(const d of dust.slice(0,13)){const age=(t*(.13+d.speed*.06)+d.phase)%1;const x=a.x+Math.sin(age*5+d.phase*8)*(20+age*70),y=a.y-110-age*390;glow(x,y,18+age*75,30+age*85,'157,170,192',Math.sin(age*Math.PI)*.026);}
 ctx.save();ctx.globalCompositeOperation='screen';for(const d of dust.slice(0,34)){const age=(t*(.28+d.speed*.25)+d.phase)%1;ctx.globalAlpha=Math.sin(age*Math.PI)*.65;ctx.fillStyle=d.size>.5?'#ffd990':'#df742e';ctx.beginPath();ctx.ellipse(a.x+(d.x-.5)*120+Math.sin(age*9+d.phase*12)*18,a.y-40-age*(200+d.y*100),.8+d.size,2+d.size*2,age*.2,0,Math.PI*2);ctx.fill();}ctx.restore();}
function choiceFX(t){if(t<1.8){ctx.save();ctx.globalCompositeOperation='screen';glow(700,570,320,100,'255,193,87',.06);ctx.restore();}}
function spaceFX(t,state){const e=screenPoint(nodes.ship,...S.space.engineUV);ctx.save();ctx.globalCompositeOperation='screen';
 // Exhaust follows the engine and points away from the ship's nose.
 const len=220+state.power*85;const g=ctx.createLinearGradient(e.x-len,e.y+len*.34,e.x,e.y);g.addColorStop(0,'rgba(90,172,239,0)');g.addColorStop(.65,'rgba(112,196,248,.10)');g.addColorStop(1,`rgba(255,217,123,${.2+state.power*.15})`);ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(e.x,e.y-9);ctx.lineTo(e.x-len,e.y+len*.34+12);ctx.lineTo(e.x-len*.72,e.y+len*.34-10);ctx.closePath();ctx.fill();glow(e.x,e.y,45,33,'255,199,87',.15+state.power*.12);
 const sun=screenPoint(nodes.earth,.74,.68);glow(sun.x,sun.y,150,62,'255,209,139',.06+.1*curve(t,.8,4.4));
 for(const d of dust.slice(0,42)){ctx.globalAlpha=.12+.22*(.5+.5*Math.sin(t*1.5+d.phase*10));ctx.fillStyle='#d5e7f5';ctx.beginPath();ctx.arc(d.x*W-t*(1+d.speed*3),d.y*H,.5+d.size*.75,0,Math.PI*2);ctx.fill();}ctx.restore();}
function titles(id,t){let lines,foot,start,fade;
 if(id==='fire'){lines=['从一簇火光，','到文明的曙光。'];foot='创造 · 文明的起点';start=1;fade=1-curve(t,5.4,5.85);}
 if(id==='choice'){lines=['配置资源，','选择文明的方向。'];foot='金币 · 人力 · 矿物';start=2.7;fade=1-curve(t,5.65,5.95);}
 if(id==='space'){lines=['文明的下一章，','由你参与。'];foot='更迭 / 科技史实体策略桌游';start=.85;fade=1-curve(t,5.8,6);}
 const a=curve(t,start,start+.7)*fade;if(a<=0)return;ctx.save();const shade=ctx.createLinearGradient(0,0,980,0);shade.addColorStop(0,`rgba(5,13,26,${.48*a})`);shade.addColorStop(1,'rgba(5,13,26,0)');ctx.fillStyle=shade;ctx.fillRect(0,0,1100,H);
 ctx.textBaseline='top';ctx.letterSpacing='3px';ctx.font='400 22px SourceHan';ctx.globalAlpha=a*.8;ctx.fillStyle='#e9be72';ctx.fillText('更迭  /  ITERATION',108,100);
 lines.forEach((line,i)=>{const f=curve(t,start+i*.3,start+.7+i*.3)*fade;ctx.save();ctx.globalAlpha=f;ctx.beginPath();ctx.rect(105,310+i*106,800,100);ctx.clip();ctx.font='700 70px SourceHan';ctx.fillStyle=i?'#e9be72':'#f5edd9';ctx.shadowColor='#020a16';ctx.shadowBlur=16;ctx.fillText(line,108,310+i*106+(1-f)*30);ctx.restore();});
 ctx.globalAlpha=a*.8;ctx.fillStyle='#f5edd9';ctx.font='400 24px SourceHan';ctx.letterSpacing='2px';ctx.fillText(foot,110,932);ctx.restore();}
async function baseline(t,showText){const i=Math.min(2,Math.floor(t/6)),local=t-i*6;let id=['01','04','09'][i];if(i===1&&local>3)id='05';const s={...window.PROMO_PACK.shots.find(s=>s.id===id)};s.scenePath=s.scenePath?'../'+s.scenePath:null;s.cards=s.cards.map(p=>'../'+p);s.board='../'+s.board;if(s.backs)s.backs=s.backs.map(p=>'../'+p);
 await window.PromoFrame.render(oldCanvas,s,{progress:local/6,effects:true,showText:showText});ctx.drawImage(oldCanvas,0,0);}
export async function render(seconds,options={}){const time=clamp(Number(seconds)||0,0,S.duration-1/S.fps),segment=Math.min(2,Math.floor(time/6)),local=time-segment*6,id=S.segments[segment].id;
 if(options.mode==='baseline'){await baseline(time,options.text!==false);return{time,segment:id,local};}
 resetCamera();for(const[k,g]of Object.entries(groups))g.visible=k===id;let state;if(id==='fire')state=fireMotion(local);if(id==='choice')state=choiceMotion(local);if(id==='space')state=spaceMotion(local);camera.updateMatrixWorld();renderer.render(scene,camera);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(renderer.domElement,0,0);
 if(options.effects!==false){if(id==='fire')fireFX(local,state);if(id==='choice')choiceFX(local);if(id==='space')spaceFX(local,state);}
 if(options.text!==false)titles(id,local);
 const black=Math.max(1-curve(local,0,.14),curve(local,5.86,6));if(black>0){ctx.fillStyle=`rgba(4,10,20,${black})`;ctx.fillRect(0,0,W,H);}return{time,segment:id,local,state};}
