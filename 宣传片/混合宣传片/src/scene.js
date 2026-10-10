import * as T from 'three';
import {actionTime} from './rhythm.js';
import {createSurfaces,clothSurface} from './surfaces.js';
import {rounded} from './geometry.js';
import {makeCard,mesh,box,pose,move,marker,makeDie,rollDie,cardRotation} from './geometry.js';
import {ramp,vecLerp} from './story.js';
import {PHYSICAL,CAMERAS,surfaceAt,BOARD_ZONES,zonePosition} from './physical.js';
const up=[-Math.PI/2,0,0],wonderRotation=[-Math.PI/2,0,BOARD_ZONES.wonder.rotation],hero=[-.77,0,-.045];
export const layout={
 market:[[-3,.064,6.6],[-1,.064,6.6],[1,.064,6.6],[3,.064,6.6]],
 basic:[-1.7,.064,-6.7],wonder:zonePosition(BOARD_ZONES.wonder),techPile:zonePosition(BOARD_ZONES.shopDeck),eventPile:zonePosition(BOARD_ZONES.eventDeck),wonderPile:[13.8,-.06,-7],
 A:[-4.7,.064,13.5],B:[-4.7,.064,-13.5],patent:[-7.2,.064,13.5],ownedWonder:[5.3,.064,13.5],
 bank:[[-14.4,.03,-4],[-14.4,.03,0],[-14.4,.03,4]],discard:[[-11.8,-.06,-4],[-11.8,-.06,0],[-11.8,-.06,4]],
};
export function makeScene(textures,metadata){
 const surfaces=createSurfaces(),scene=new T.Scene();scene.background=new T.Color('#101e31');scene.add(new T.HemisphereLight('#e7f1ff','#23364d',.85));
 const key=new T.DirectionalLight('#fff0d4',2.8);key.position.set(-14,26,12);key.castShadow=true;key.shadow.mapSize.set(4096,4096);Object.assign(key.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:.1,far:75});key.shadow.bias=-.0001;key.shadow.normalBias=.004;key.shadow.radius=3;scene.add(key);
 const fill=new T.DirectionalLight('#bdd8ff',.75);fill.position.set(12,17,-16);scene.add(fill);
 const table=new T.Group();scene.add(table);box(table,[44,.32,36],new T.MeshStandardMaterial({color:'#1d3043',roughness:.98}),[0,-.25,0]);
 const rubber=new T.MeshStandardMaterial({color:'#101820',roughness:.97});
 const base=new T.ExtrudeGeometry(rounded(PHYSICAL.boardSide-.014,PHYSICAL.boardSide-.014,.07),{depth:.106,bevelEnabled:true,bevelSize:.007,bevelThickness:.007,bevelSegments:3,curveSegments:10});base.translate(0,0,-.053);mesh(table,base,rubber,[0,-.03,0],up);
 mesh(table,new T.PlaneGeometry(PHYSICAL.boardSide,PHYSICAL.boardSide),clothSurface(textures.board,'#ffffff',surfaces),[0,PHYSICAL.boardSurface,0],up);
 for(const [z,col]of [[13.5,'#203e59'],[-13.5,'#494534']])box(table,[PHYSICAL.playerMatWidth,.055,PHYSICAL.playerMatDepth],clothSurface(null,col,surfaces,true),[PHYSICAL.playerMatX,.005,z]);
 const resourceBanks=[[],[],[]];for(let j=0;j<3;j++)for(let n=0;n<6;n++){const c=makeCard(textures,metadata,['gold','min','people'][j]+[10,5,2,2,1,1][n],surfaces);resourceBanks[j].push(c);table.add(c);pose(c,[layout.bank[j][0]+(n%2)*.012,-.081+n*.018,layout.bank[j][2]],cardRotation(0,false));}
 const rigs={};const card=(r,id,key)=>{const o=makeCard(textures,metadata,key,surfaces);r.group.add(o);r.cards[id]=o;return o};
 for(const kind of['purchase','patent','wonder','final','product','calibration']){const r={group:new T.Group(),cards:{},markers:{},dice:[]};scene.add(r.group);rigs[kind]=r;
  if(kind==='purchase'){['fire','stone','agri','wheel','weave'].forEach(k=>card(r,k,k));['gold2','min2','min1'].forEach((k,i)=>card(r,'pay'+i,k));r.markers.A=marker(r.group,'#65b7e8');}
  if(kind==='patent'){card(r,'letters','letters');card(r,'pyramid','pyramid');card(r,'income','gold1');r.dice=[makeDie(r.group),makeDie(r.group)];}
  if(kind==='wonder'){card(r,'pyramid','pyramid');['gold2','gold2','min5','min1','people2','people2','people2'].forEach((k,i)=>card(r,'A'+i,k));card(r,'B0','min2');card(r,'B1','gold2');r.markers.A=marker(r.group,'#65b7e8');r.markers.B=marker(r.group,'#e7be68');}
  if(kind==='final'){card(r,'final','final');['semiconductor','ic','internet'].forEach(k=>card(r,k,k));r.dice=Array.from({length:5},()=>makeDie(r.group));}
  if(kind==='product'){['letters','pyramid','fast','final','semiconductor','ic','internet','gold2','min2','people2'].forEach(k=>card(r,k,k));r.markers.A=marker(r.group,'#65b7e8');r.markers.B=marker(r.group,'#e7be68');}
  if(kind==='calibration')card(r,'eiffel','eiffel');
  const wonderKeys=kind==='calibration'?['forbidden','suez','eniac','daqing','rail']:['patent','wonder','purchase'].includes(kind)?['henge','terracotta','gardens','temple','mogao']:['genome','center'];
  wonderKeys.forEach((key,i)=>card(r,'wonderStack'+i,key));
  const techKeys=['final','product'].includes(kind)?['bci','agi','steady','addiction','diecasting','evolution','information']:(kind==='patent'?['waterworks','bronze','astronomy','elements','science','pottery']:['letters','waterworks','bronze','astronomy','elements','science','pottery']);
  techKeys.forEach((key,i)=>card(r,'techStack'+i,key));
  r.deckSize=techKeys.length;
  const eventKeys=Object.keys(metadata).filter(k=>/^event[0-9]+$/.test(k));eventKeys.forEach((key,i)=>card(r,'eventStack'+i,key));

 }
 return {scene,table,rigs,resourceBanks,surfaces};
}
export const invA=[[11.8,-.06,4.5],[13.9,-.06,4.5],[11.8,-.06,7.5],[13.9,-.06,7.5],[16,-.06,4.5],[16,-.06,7.5],[11.8,-.06,10.5]];
export const invB=[[11.8,-.06,.5],[13.9,-.06,.5]];
function cameraBlend(camera,position,target,p){camera.position.set(...vecLerp(CAMERAS.wide.position,position,p));camera.lookAt(...vecLerp(CAMERAS.wide.target,target,p))}
function heroCamera(camera,t,focus,start,arrive,leave,end){const p=ramp(start,arrive,t)*(1-ramp(leave,end,t));cameraBlend(camera,[focus[0]+.35,focus[1]+4.1,focus[2]+4.8],focus,p)}
export function updateScene(rig,kind,t,camera){
 t=actionTime(kind,t);
 rig.resourceBanks.forEach((bank,j)=>bank.forEach((o,n)=>o.visible=!(kind==='patent'&&j===0&&n===5&&t>=6.1)));
 for(const[k,r]of Object.entries(rig.rigs)){r.group.visible=k===kind;for(const o of [...Object.values(r.cards),...Object.values(r.markers),...r.dice])o.visible=false;}const r=rig.rigs[kind],c=r.cards;
 camera.fov=44;camera.near=.08;camera.far=150;camera.position.set(...CAMERAS.wide.position);camera.lookAt(...CAMERAS.wide.target);
 for(const [id,o]of Object.entries(c)){
  const n=Number(id.match(/[0-9]+$/)?.[0]??0);
  if(id.startsWith('techStack'))pose(o,[layout.techPile[0],.064+n*.018,layout.techPile[2]],cardRotation(BOARD_ZONES.shopDeck.rotation,false));
  if(id.startsWith('wonderStack'))pose(o,[layout.wonderPile[0],-.06+n*.018,layout.wonderPile[2]],cardRotation(0,false));
  if(id.startsWith('eventStack'))pose(o,[layout.eventPile[0],.064+n*.018,layout.eventPile[2]],cardRotation(BOARD_ZONES.eventDeck.rotation,false));
 }
 if(kind==='purchase'){
  ['stone','agri','wheel'].forEach((k,i)=>pose(c[k],layout.market[i+1]));const hp=[-1,2,5.6];
  if(t<2.6)pose(c.fire,hp,hero);
  else if(t<6.3)move(c.fire,hp,layout.market[0],2.6,3.2,t,{rotA:hero,arc:.5});
  else move(c.fire,layout.market[0],layout.basic,6.3,7.6,t,{arc:1.8});
  heroCamera(camera,t,hp,-1,0,2.6,3.2);
  for(let i=0;i<3;i++){const a=[-4.6+i*2.05,.064,13.5],b=[...layout.discard[i===0?0:1]];b[1]+=(i===2?.018:0);move(c['pay'+i],a,b,3.2+i*.9,4+i*.9,t,{flip:true,arc:2});}
  if(t>=7.7)pose(r.markers.A,[layout.basic[0]+.65,.14+(1-ramp(7.7,8.25,t))*1.2,layout.basic[2]+.9],[0,0,0]);
  move(c.weave,[layout.techPile[0],.064+r.deckSize*.018,layout.techPile[2]],layout.market[0],9.2,10.2,t,{flip:true,arc:1.8});
 }
 if(kind==='patent'){
  pose(c.pyramid,layout.wonder,wonderRotation);const hp=[-1.4,2,2];if(t<2.2)pose(c.letters,hp,hero);else move(c.letters,hp,layout.patent,2.2,3.25,t,{rotA:hero,arc:1.5});
  heroCamera(camera,t,hp,-1,0,2.2,3.25);
  [6,3].forEach((f,i)=>rollDie(r.dice[i],t,2.7,5.1,f,i,[i*1.65-.8,.492,0]));
  if(t>=6.1)move(c.income,layout.bank[0],[-2,.064,13.5],6.1,7.5,t,{rotA:cardRotation(0,false),rotB:cardRotation(0,false),arc:2});
  const p=ramp(3.25,4.6,t)*(1-ramp(6.1,7.5,t));if(t>=3.25)cameraBlend(camera,CAMERAS.dice.position,CAMERAS.dice.target,p);
 }
 if(kind==='wonder'){
  const hp=[layout.wonder[0],2,layout.wonder[2]];if(t<1.5)pose(c.pyramid,hp,hero);else if(t<7.7)move(c.pyramid,hp,layout.wonder,1.5,2.7,t,{rotA:hero,rotB:wonderRotation,arc:.8});else move(c.pyramid,layout.wonder,layout.ownedWonder,7.7,9,t,{rotA:wonderRotation,arc:2});
  const p=1-ramp(1.5,2.7,t);cameraBlend(camera,[hp[0]+.35,hp[1]+4.1,hp[2]+4.8],hp,p);
  for(let i=0;i<6;i++){const dest=i<2?0:i<4?1:2;move(c['A'+i],invA[i],[layout.discard[dest][0],-.06+(i%2)*.018,layout.discard[dest][2]],8.45+i*.18,9.35+i*.18,t,{arc:1.8});}
  if(t<8.7)move(c.A6,[1,.064,13.5],invA[6],4.7,6.2,t,{flip:true,arc:1.8});else move(c.A6,invA[6],[layout.discard[2][0],-.024,layout.discard[2][2]],9.53,10.43,t,{arc:1.8});
  move(c.B0,invB[0],[-2,.064,-13.5],8.7,10.15,t,{rotA:cardRotation(Math.PI,true),rotB:cardRotation(Math.PI,false),arc:1.8});
  if(t<6.5)move(c.B1,[-2,.064,-13.5],invB[1],2.8,3.8,t,{rotA:cardRotation(Math.PI,false),rotB:cardRotation(Math.PI,false),arc:1.8});
  else if(t<8.7)move(c.B1,invB[1],invB[1],6.5,7.3,t,{rotA:cardRotation(Math.PI,false),rotB:cardRotation(Math.PI,true),arc:1.8});
  else move(c.B1,invB[1],[.1,.064,-13.5],8.7,10.15,t,{rotA:cardRotation(Math.PI,true),rotB:cardRotation(Math.PI,false),arc:1.8});
  pose(r.markers.A,[10.7,-.045,6.2],[0,0,0]);pose(r.markers.B,[10.7,-.045,.5],[0,0,0]);
 }
 if(kind==='final'){
  ['semiconductor','ic','internet'].forEach((k,i)=>pose(c[k],layout.market[i+1]));const hp=[-1.5,2,5.6];
  if(t<2.7)pose(c.final,hp,hero);else if(t<7.5)move(c.final,hp,layout.market[0],2.7,3.8,t,{rotA:hero,arc:.8});else move(c.final,layout.market[0],[-3,.064,13.5],7.5,8.8,t,{arc:1.8});
  heroCamera(camera,t,hp,-1,0,2.7,3.8);[1,4,1,6,1].forEach((f,i)=>rollDie(r.dice[i],t,4,6.4,f,i,[i*1.75-3.5,.492,0]));
  const p=ramp(3.8,5.6,t)*(1-ramp(7.5,8.8,t));if(t>=3.8)cameraBlend(camera,CAMERAS.dice.position,CAMERAS.dice.target,p);
  if(t>=8){const q=ramp(8,9.2,t);camera.position.lerp(new T.Vector3(-2.65,5.5,18.7),q);camera.lookAt(...vecLerp(vecLerp(CAMERAS.wide.target,CAMERAS.dice.target,p),[-3,.064,13.5],q));}
 }
 if(kind==='product'){
  camera.position.set(0,29,27);camera.lookAt(0,0,4);
  ['semiconductor','ic','internet'].forEach((k,i)=>pose(c[k],layout.market[i+1]));
  pose(c.letters,layout.patent);pose(c.final,[2,.064,13.5]);pose(c.pyramid,layout.ownedWonder);pose(c.fast,layout.wonder,wonderRotation);
  ['gold2','min2','people2'].forEach((k,i)=>pose(c[k],[-4.9+i*2.1,.064,13.5],cardRotation(0,false)));pose(r.markers.A,[-9,.078,13.5],[0,0,0]);pose(r.markers.B,[7.2,.078,13.5],[0,0,0]);
 }
 if(kind==='calibration'){camera.fov=50;camera.position.set(0,30,.001);camera.lookAt(0,0,0);pose(c.eiffel,layout.wonder,wonderRotation);}
 // A physical card never changes its world scale. Closeups come solely from the camera.
 for(const o of Object.values(c).filter(o=>o.visible)){o.position.y-=.021;o.updateMatrixWorld(true);const body=o.children[0],v=body.geometry.attributes.position;let lift=0;for(let i=0;i<v.count;i++){const p=new T.Vector3().fromBufferAttribute(v,i).applyMatrix4(body.matrixWorld);lift=Math.max(lift,surfaceAt(p.x,p.z)+.001-p.y)}o.position.y+=lift;}
 camera.updateProjectionMatrix();camera.updateMatrixWorld();return r;
}
