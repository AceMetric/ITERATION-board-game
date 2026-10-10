import {PIXEL_SCALE,RENDER_WIDTH,RENDER_HEIGHT} from './renderQuality.js';
import * as T from 'three';
import {actionTime} from './rhythm.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {ContactAO} from './ContactAO.js';
import {makeScene,updateScene,layout} from './scene.js';
import {stateAt,ramp,shots} from './story.js';
export function createEngine(textures,metadata){const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setSize(RENDER_WIDTH,RENDER_HEIGHT);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 const camera=new T.PerspectiveCamera(44,16/9,.08,100),rig=makeScene(textures,metadata),canvas=document.createElement('canvas');canvas.width=RENDER_WIDTH;canvas.height=RENDER_HEIGHT;const ctx=canvas.getContext('2d',{alpha:false});ctx.scale(PIXEL_SCALE,PIXEL_SCALE);
 const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.05);rig.scene.environment=environment.texture;rig.scene.environmentIntensity=.35;room.dispose();pmrem.dispose();
 const target=new T.WebGLRenderTarget(RENDER_WIDTH,RENDER_HEIGHT,{type:T.HalfFloatType,samples:4}),composer=new EffectComposer(renderer,target),beauty=new RenderPass(rig.scene,camera),ao=new ContactAO(rig.scene,camera,RENDER_WIDTH,RENDER_HEIGHT,16),output=new OutputPass();ao.kernelRadius=.28;ao.minDistance=.000005;ao.maxDistance=.003;ao.ssaoMaterial.fragmentShader=ao.ssaoMaterial.fragmentShader.replace('1.0 - occlusion','1.0 - occlusion * 0.28');composer.addPass(beauty);composer.addPass(ao);composer.addPass(output);
 const altered=new Map(),ink=document.createElement("canvas"),inkCtx=ink.getContext("2d");let inkTex,baseAnchor;
 const exposure=document.createElement("canvas");exposure.width=RENDER_WIDTH;exposure.height=RENDER_HEIGHT;const exposureCtx=exposure.getContext("2d");
 const project=p=>{const v=new T.Vector3(...p).project(camera);return[(v.x+1)*960,(1-v.y)*540]};
 function text(s,x,y,size=27,color='#f1ead9',weight=400,align='left'){ctx.font=`${weight} ${size}px SourceHan`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(s,x,y)}
 function panel(x,y,w,h,alpha=.85){ctx.fillStyle=`rgba(8,23,40,${alpha})`;ctx.beginPath();ctx.roundRect(x,y,w,h,12);ctx.fill();}
 function label(s,p,color='#d6c6a5',size=22){const[x,y]=project(p);ctx.font=`400 ${size}px SourceHan`;const w=ctx.measureText(s).width;if(x<80||x>1840||y<180||y>940)return;panel(x-w/2-13,y-24,w+26,35,.8);text(s,x,y,size,color,400,'center')}
 function render(kind,frame,annotationOpacity=1,framing=null,approach=null){
  for(const[face,map]of altered)face.material.map=map;altered.clear();
  let viewTransforms=null;camera.clearViewOffset();const rawTime=frame/30,t=actionTime(kind,rawTime),shot=shots.find(s=>s.kind===kind),r=updateScene(rig,kind,rawTime,camera),state=stateAt(kind,t);
  if(framing){
   const target=anchorPoints(kind,framing.key,framing.uv),source=framing.points;baseAnchor=target;
   const face=r.cards[framing.key].children[1],original=face.material.map,clean=textures['clean_'+framing.subject];
   if(clean){
    const image=original.image;ink.width=image.width;ink.height=image.height;inkCtx.globalAlpha=1;inkCtx.drawImage(clean.image,0,0);inkCtx.globalAlpha=framing.print;inkCtx.drawImage(image,0,0);inkCtx.globalAlpha=1;
    if(!inkTex){inkTex=new T.CanvasTexture(ink);inkTex.colorSpace=T.SRGBColorSpace;inkTex.anisotropy=16;inkTex.minFilter=T.LinearMipmapLinearFilter;inkTex.magFilter=T.LinearFilter;}
    inkTex.offset.copy(original.offset);inkTex.repeat.copy(original.repeat);inkTex.needsUpdate=true;altered.set(face,original);face.material.map=inkTex;
   }
   const center=p=>p.reduce((s,v)=>[s[0]+v[0]/p.length,s[1]+v[1]/p.length],[0,0]);
   const c=center(target),d=center(source),radius=(p,c)=>Math.sqrt(p.reduce((s,v)=>s+(v[0]-c[0])**2+(v[1]-c[1])**2,0)/p.length);
   const view=(points,f)=>{const dc=center(points),z=Math.exp(Math.log(radius(points,dc)/Math.max(1,radius(target,c)))*f),at=c.map((n,i)=>n+(dc[i]-n)*f);return{z,tx:at[0]-c[0]*z,ty:at[1]-c[1]*z}};viewTransforms=(framing.shutterViews??[{points:source,factor:framing.factor}]).map(v=>view(v.points,v.factor));const {z,tx,ty}=viewTransforms[0],at=[tx+c[0]*z,ty+c[1]*z];
   camera.setViewOffset(1920,1080,c[0]-at[0]/z,c[1]-at[1]/z,1920/z,1080/z);camera.updateProjectionMatrix();
  }
  if(approach){const point=anchorPoints(kind,approach.key,[approach.uv])[0],view=p=>{const z=Math.exp(Math.log(approach.zoom)*p),at=point.map((n,i)=>n+([960,540][i]-n)*p);return{z,tx:at[0]-point[0]*z,ty:at[1]-point[1]*z}};viewTransforms=(approach.previousProgress??[approach.progress]).map(view);const{z,tx,ty}=viewTransforms[0];camera.setViewOffset(1920,1080,-tx/z,-ty/z,1920/z,1080/z);camera.updateProjectionMatrix();}
  ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);ao.ssaoMaterial.uniforms.cameraNear.value=camera.near;ao.ssaoMaterial.uniforms.cameraFar.value=camera.far;composer.render(0);ctx.globalAlpha=1;ctx.drawImage(renderer.domElement,0,0,1920,1080);
  if(viewTransforms?.length>1){const current=viewTransforms[0];exposureCtx.setTransform(1,0,0,1,0,0);exposureCtx.clearRect(0,0,RENDER_WIDTH,RENDER_HEIGHT);exposureCtx.globalCompositeOperation='lighter';exposureCtx.globalAlpha=1/viewTransforms.length;for(const v of viewTransforms){const z=v.z/current.z;exposureCtx.setTransform(z,0,0,z,(v.tx-current.tx*z)*PIXEL_SCALE,(v.ty-current.ty*z)*PIXEL_SCALE);exposureCtx.drawImage(renderer.domElement,0,0)}exposureCtx.setTransform(1,0,0,1,0,0);ctx.drawImage(exposure,0,0,1920,1080);}
  ctx.globalAlpha=annotationOpacity;
  // All explanatory labels are post-production overlays, not newly invented printed components.
  const grad=ctx.createLinearGradient(0,0,0,240);grad.addColorStop(0,'rgba(5,15,29,.96)');grad.addColorStop(1,'rgba(5,15,29,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,1920,240);
  if(kind==='calibration'){
   text('桌垫与卡牌 · 实拍比例校准',88,100,43,'#f2dfb2',700);
   panel(60,230,430,330,.9);text('标准卡宽固定为 1.78',88,289,26);text('桌垫边长调整为 20.00',88,340,26);text('边长约等于 11.24 个卡宽',88,391,24);text('卡牌长边 ≈ 参照栏窄边的 88%',88,442,23);text('卡牌尺寸固定；特写通过移动相机',88,505,21,'#a8bed2');
   text('尺寸依实拍校准 · 待建奇观位于版图右下角斜框',960,1025,25,'#d6c49f',400,'center');return canvas;
  }
  if(kind==='product')return canvas;
  text(shot.era,88,75,24,'#d8bb80');text(shot.title.replace(/。$/,''),88,142,48,'#f5ecd7',700);text('更迭 ITERATION',1832,74,24,'#d0bc94',400,'right');
  label('A · 暗置手牌',[-1.7,.12,11.6],'#8fd1f6');label('B · 暗置手牌',[5,.12,-15.2],'#f3d58b');
  label('商店牌堆',[layout.techPile[0],.5,layout.techPile[2]+1.8],'#d5c5a5',19);label('事件牌堆',[layout.eventPile[0],.9,layout.eventPile[2]-1.7],'#d5c5a5',19);label('奇观牌库',[layout.wonderPile[0],.4,layout.wonderPile[2]-1.9],'#d5c5a5',19);
  ['金币','矿物','人力'].forEach((k,i)=>{label(k+'牌堆',[layout.bank[i][0],.4,layout.bank[i][2]-1.8],'#d5c5a5',19);label(k+'弃牌',[layout.discard[i][0],.1,layout.discard[i][2]-1.8],'#a5b1bd',18)});
  if(kind==='purchase'){
   if(t<1.2||t>8.5)label('公共商店 · '+state.market+' 张',[0,.3,8.6]);if(t>7.3)label('公共基础区 · A 已学习',[layout.basic[0],.3,-8.5],'#9cd5f1');
   panel(1310,190,520,250);text('驯火与热加工',1342,248,35,'#f7e5bf',700);text('费用  2 金币 + 3 矿物',1342,302,30);text(t<8?'科研点   0':'科研点   0 → 3',1342,362,35,t<8?'#bfccd9':'#a8d9ed',700);text('首次学习 · 收益 3',1342,409,23,'#b7c6d6');
   const paid=['金币 2','矿物 2','矿物 1'];panel(88,833,620,91,.9);text('支付：'+paid.slice(0,state.paid).join(' + ')+(state.paid===0?'从 A 手牌区打出资源':''),112,889,28);
  }
  if(kind==='patent'){
   panel(1310,190,520,145);text('文字与计数',1342,248,35,'#f7e5bf',700);text('投中 6 点 → 增加 1 金币',1342,309,28);
   label('A · 专利区',[layout.patent[0],.1,11.6],'#8fd1f6');if(t>=5.1){for(let i=0;i<2;i++)label(i===0?'6 · 触发':'3',[i*1.65-.8,.5,-1.5],i===0?'#f8d380':'#ccd6df',25);const a=project([-.8,.48,0]),b=project(layout.patent);ctx.strokeStyle='rgba(240,205,126,.7)';ctx.lineWidth=3;ctx.setLineDash([9,10]);ctx.beginPath();ctx.moveTo(a[0]-27,a[1]+36);ctx.lineTo(b[0]+60,b[1]-60);ctx.stroke();ctx.setLineDash([]);}
  }
  if(kind==='wonder'){
   panel(88,470,520,145);text(t>=10.43?'A 的投入 · 已结算':'A 的投入',112,523,29,'#8fd1f6',700);text(`金币 4   矿物 6   人力 ${state.A.people}`,112,578,30);
   panel(88,190,520,220);text('金字塔',112,245,35,'#f7e5bf',700);text('条件  4 金币 · 6 矿物 · 6 人力',112,296,25);text('B 的投入：矿物 2',112,347,26,'#f2d68e');text(t<3.8?'':t<7.3?'另有一张暗置牌':'翻开暗置牌：金币 2',112,387,24,'#d5c7a7');
   label('A · 投入',[14,.12,11.8],'#8fd1f6',21);label('B · 投入',[13,.12,-1.2],'#f1d18b',21);
   if(t>=2.7&&t<7.7)label('待建奇观',[layout.wonder[0],.15,layout.wonder[2]+2],'#eacd8e',21);if(t>=7.7)label('A · 奇观区',[layout.ownedWonder[0],.12,11.6],'#8fd1f6');if(t>=6.5)text('宣布取得后，翻开全部暗置投入',112,705,23,'#d7c493');if(t>=9)text('重投能力从 A 下个回合起生效',112,747,23,'#d7c493');
  }
  if(kind==='final'){
   panel(1310,190,520,195);text('宇宙航行',1342,248,35,'#f7e5bf',700);text('5 枚骰子 × 6 = 30 科研点',1342,302,28);text(t<3.4?'科研点   100':'科研点   100 → 70',1342,362,35,'#a8d9ed',700);
   if(t>=6.4){[1,4,1,6,1].forEach((f,i)=>{const p=[i*1.75-3.5,.5,-1.5];label(String(f),p,f===1?'#f7d082':'#a6b7ca',29);if(f===1){const[x,y]=project([i*1.75-3.5,.52,0]);ctx.strokeStyle='#eaca7f';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,48,37,0,0,Math.PI*2);ctx.stroke();}});}
   panel(430,835,1060,84,.92);text('出现三个相同的 1、2 或 3，即挑战成功',960,889,31,'#f1dfb3',400,'center');
  }
  panel(370,965,1180,66,.94);text(state.stage,960,1008,30,'#efe7d3',700,'center');
  text('不同阶段的规则示例 · 科研点与说明为后期标注',1832,1058,17,'#9aaabf',400,'right');return canvas;
 }
 function anchorPoints(kind,key,uv){const card=rig.rigs[kind].cards[key==='ring'?'final':key];card.updateWorldMatrix(true,false);const[w,h]=[card.userData.w,card.userData.h];return uv.map(([x,y])=>{const v=new T.Vector3((x-.5)*w,(.5-y)*h,.009).applyMatrix4(card.matrixWorld);return project(v.toArray())})}
 function anchor(kind,key,uv=[.15,.1,.72,.36]){const[x0,y0,x1,y1]=uv;return anchorPoints(kind,key,[[x0,y0],[x1,y0],[x1,y1],[x0,y1]])}

 return{render,anchor,anchorPoints,getBaseAnchor:()=>baseAnchor,rig,camera,renderer,project,dispose(){inkTex?.dispose();ao.dispose();output.dispose();composer.dispose();environment.dispose();rig.surfaces.dispose();rig.scene.traverse(o=>{o.geometry?.dispose();if(o.material?.dispose)o.material.dispose()});renderer.dispose();renderer.forceContextLoss()}};
}
