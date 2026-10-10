import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import * as T from 'three';
import {PHYSICAL,PHOTO_CALIBRATION,surfaceAt,BOARD_ZONES} from '../src/physical.js';
import {shots,TOTAL,examples,stateAt,diceFaces} from '../src/story.js';import {makeCard,rollDie,settledQuaternion} from '../src/geometry.js';import {makeScene,updateScene,layout} from '../src/scene.js';
const root=path.resolve(import.meta.dirname,'..'),project=path.resolve(root,'../..'),meta=JSON.parse(fs.readFileSync(path.join(root,'src/assets.json'))),tex={};let count=0;const ok=(v,m)=>{assert(v,m);count++};
ok(TOTAL===2700,'90 seconds at 30fps');ok(shots.filter(s=>s.kind==='ai').reduce((n,s)=>n+s.seconds,0)===39,'AI 39 seconds');ok(shots.filter(s=>!['ai','intro'].includes(s.kind)).reduce((n,s)=>n+s.seconds,0)===47,'3D 47 seconds');
for(const [k,m]of Object.entries(meta)){const source=fs.readFileSync(path.join(project,m.source)),copy=fs.readFileSync(path.join(root,'public',m.file));ok(crypto.createHash('sha256').update(source).digest('hex')===m.sha256,'source hash '+k);ok(source.equals(copy),'unchanged copied image '+k);if(m.size){const t=new T.Texture({width:m.size[0],height:m.size[1]});tex[k]=t;ok(m.rect[0]>=0&&m.rect[1]>=0&&m.rect[0]+m.rect[2]<=m.size[0]&&m.rect[1]+m.rect[3]<=m.size[1],'valid crop '+k);}}
const p=examples.purchase,paid=p.paid.reduce((a,[k,v])=>({...a,[k]:(a[k]||0)+v}),{});assert.deepEqual(paid,p.cost);ok(p.destination==='publicBasic','basic public');ok(stateAt('purchase',11).research===3&&stateAt('purchase',11).market===4,'research and refill');
const pat=examples.patent;ok(pat.dice.some(d=>d===pat.trigger)&&pat.retained&&pat.income.gold===1,'separate die trigger');ok(![2,4].some(d=>d===6),'sum 6 cannot trigger patent');
const w=examples.wonder;for(const k of ['gold','mineral','people'])ok(w.A.before[k]+(w.A.add[k]||0)===w.cost[k],'A alone pays '+k);ok(w.B.returned===2&&w.B.cards.length===2,'B recovers own two');ok(w.pyramidStarts==='next-own-turn','no premature reroll');
const f=examples.final;ok(f.dice.length*f.costPerDie-f.discount===30&&f.research[0]-f.research[1]===30,'challenge cost');const wins=a=>[1,2,3].some(face=>a.filter(x=>x===face).length>=3);ok(wins(f.dice),'scripted success');ok(!wins([4,4,4,6,5]),'triple4 fails');ok(!wins([1,2,3,4,5]),'mixed123 fails');ok(wins([2,2,2,5,6]),'triple2 succeeds');
for(const face of[1,2,3,4,5,6]){const normal=new T.Vector3(...diceFaces[face]).applyQuaternion(settledQuaternion(face,.5));ok(normal.distanceTo(new T.Vector3(0,1,0))<1e-9,'upper face '+face);}
const rig=makeScene(tex,meta),camera=new T.PerspectiveCamera(44,16/9,.08,100);let cardsChecked=0,diceChecked=0;
for(const s of shots.filter(s=>!['ai','intro'].includes(s.kind)))for(let frame=0;frame<s.frames;frame++){
 const r=updateScene(rig,s.kind,frame/30,camera);rig.scene.updateMatrixWorld(true);
 for(const o of Object.values(r.cards).filter(o=>o.visible)){
  // Exact transformed extruded card vertices, including rounded bevel, must clear the board or tabletop.
  const body=o.children[0],pos=body.geometry.attributes.position;let min=Infinity;
  for(let i=0;i<pos.count;i++){const v=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(body.matrixWorld);const floor=surfaceAt(v.x,v.z);min=Math.min(min,v.y-floor)}
  ok(min>=-.002,`${s.id} frame${frame} ${o.userData.key}: card through table (${min})`);ok(o.scale.equals(new T.Vector3(1,1,1)),'physical card scale fixed');cardsChecked++;
 }
 for(const o of r.dice.filter(o=>o.visible)){const mat=new T.Matrix4().makeRotationFromQuaternion(o.quaternion).elements;const support=.457*(Math.abs(mat[1])+Math.abs(mat[5])+Math.abs(mat[9]));ok(o.position.y-support>=.033,`${s.id} frame${frame}: die support`);diceChecked++;}
 if(s.kind==='wonder'&&frame===315){ok(Object.entries(r.cards).filter(([k])=>k.startsWith('A')).every(([,o])=>Math.abs(o.position.x+11.8)<1e-9),'all A resources discarded');ok(Math.abs(r.cards.B0.position.z+13.5)<1e-9&&Math.abs(r.cards.B1.position.z+13.5)<1e-9,'B returned to B hand');}
}
const faceY=o=>new T.Vector3(0,0,1).applyQuaternion(o.quaternion).y;
const at=(kind,t)=>updateScene(rig,kind,t,camera).cards;
let c=at('purchase',0);for(let i=0;i<3;i++)ok(faceY(c['pay'+i])<-.999,'resource hand face down');
c=at('purchase',6);for(let i=0;i<3;i++)ok(faceY(c['pay'+i])>.999,'public payment face up');
c=at('wonder',4);for(let i=0;i<6;i++)ok(faceY(c['A'+i])>.999,'A chose face-up investment');ok(faceY(c.B0)>.999,'B prior investment face up');ok(faceY(c.B1)<-.999,'B chose face-down investment');ok(faceY(c.A6)<-.999,'A unplayed hand face down');
c=at('wonder',6.3);ok(faceY(c.A6)>.999,'A new investment explicitly face up');ok(faceY(c.B1)<-.999,'hidden investment stays hidden before declaration');
c=at('wonder',7.4);ok(faceY(c.B1)>.999,'reveal hidden investment after declaration');
c=at('wonder',10.5);ok(faceY(c.B0)<-.999&&faceY(c.B1)<-.999,'recovered cards become hidden hand');
c=at('patent',8);ok(faceY(c.income)<-.999,'patent income enters hidden hand');
c=at('product',0);for(const k of ['gold2','min2','people2'])ok(faceY(c[k])<-.999,'product hand face down');
for(const kind of ['patent','wonder','product','calibration']){const card=at(kind,kind==='wonder'?4:0)[kind==='calibration'?'eiffel':kind==='product'?'fast':'pyramid'];ok(Math.abs(card.position.x-layout.wonder[0])<1e-9&&Math.abs(card.position.z-layout.wonder[2])<1e-9,'active wonder in lower-right printed slot: '+kind);ok(Math.abs(card.rotation.z-BOARD_ZONES.wonder.rotation)<1e-9,'wonder aligned with printed diagonal frame: '+kind)}
ok(layout.wonder[0]>6&&layout.wonder[2]>4,'wonder lower-right, never left discard strip');ok(layout.techPile[0]<-5&&layout.techPile[2]>5,'technology deck in lower-left shop slot');ok(layout.eventPile[0]<-4&&layout.eventPile[2]<-5,'event deck upper-left');ok(layout.wonderPile[0]>10,'wonder library outside the printed board');
const eiffelHeight=PHYSICAL.cardWidth*meta.eiffel.rect[3]/meta.eiffel.rect[2],slotWidth=PHYSICAL.boardSide*PHOTO_CALIBRATION.referenceStripUV[2],ratio=eiffelHeight/slotWidth;
ok(ratio>=PHOTO_CALIBRATION.observedLongEdgeToSlotWidth[0]&&ratio<=PHOTO_CALIBRATION.observedLongEdgeToSlotWidth[1],'photo calibration matches slot/card ratio');
for(const[face,index]of f.dice.map((face,i)=>[face,i])){const o=new T.Object3D();rollDie(o,6.4,4,6.4,face,index,[0,.51,0]);const q=o.quaternion.clone();rollDie(o,9,4,6.4,face,index,[0,.51,0]);ok(q.equals(o.quaternion),'settled die cannot change');}
const report={passed:true,assertions:count,cardFrames:cardsChecked,diceFrames:diceChecked,sourceHashes:'all unchanged',rules:'purchase / patent / wonder / final checked; rulebook sections 5, 9.2, 9.3: hidden hands, per-card open/hidden investment, reveal on declaration',photoCalibrationRatio:ratio,activeWonderZone:{position:layout.wonder,printed:'右下角 · 奇观',rotation:BOARD_ZONES.wonder.rotation},scope:'逐帧检查卡牌几何相对桌面和版图的高度、骰子支撑面；尚需渲染画面检查可读性、组件间遮挡与接触阴影。'};fs.writeFileSync(path.join(root,'记录/规则与几何核对.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
