import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import * as T from 'three';
import {makeCard,cardRotation,pose}from'../src/geometry.js';import{makeScene,updateScene,layout,invA,invB}from'../src/scene.js';import{BOARD_ZONES,PHYSICAL}from'../src/physical.js';
const root=path.resolve(import.meta.dirname,'..'),meta=JSON.parse(fs.readFileSync(path.join(root,'src/assets.json'))),textures={},pairs=[];let checks=0;const ok=(x,m)=>{assert(x,m);checks++};
for(const[k,m]of Object.entries(meta)){if(!m.size)continue;const tex=new T.Texture({width:m.size[0],height:m.size[1]});tex.name=k;textures[k]=tex;}
for(const[k,m]of Object.entries(meta)){if(!m.back)continue;
 const expected=path.posix.join(path.posix.dirname(m.source),'卡背.png');ok(meta[m.back]?.source===expected,`${k}: same category and era directory`);
 const card=makeCard(textures,meta,k);ok(card.children[1].material.map.name===k,`${k}: actual front material`);ok(card.children[2].material.map.name===m.back,`${k}: actual reverse material`);
 for(const yaw of[0,Math.PI,-Math.PI/4]){pose(card,[0,0,0],cardRotation(yaw,true));card.updateMatrixWorld(true);const frontTop=new T.Vector3(0,1,0).transformDirection(card.children[1].matrixWorld);pose(card,[0,0,0],cardRotation(yaw,false));card.updateMatrixWorld(true);const backTop=new T.Vector3(0,1,0).transformDirection(card.children[2].matrixWorld),normal=new T.Vector3(0,0,1).transformDirection(card.children[2].matrixWorld);ok(frontTop.distanceTo(backTop)<1e-8,`${k}: reverse heading matches front at ${yaw}`);ok(normal.y>.999,`${k}: reverse points upwards`);}
 pairs.push({key:k,face:m.source,back:expected,backKey:m.back});
}
assert.throws(()=>makeCard(textures,{...meta,fire:{...meta.fire,back:null}},'fire'),/explicit face\/back/);checks++;
const rig=makeScene(textures,meta),camera=new T.PerspectiveCamera();const at=(kind,t)=>{const r=updateScene(rig,kind,t,camera);rig.scene.updateMatrixWorld(true);return r.cards};
// Board lettering independently checked in original image crops. These anchors
// deliberately do not compare only to the same implementation configuration.
ok(Math.abs(layout.eventPile[0]+5)<.1&&Math.abs(layout.eventPile[2]+6.72)<.1,'event pile: printed upper-left event slot');
ok(Math.abs(layout.techPile[0]+5.82)<.1&&Math.abs(layout.techPile[2]-6.62)<.1,'technology pile: printed lower-left shop slot');
ok(layout.wonderPile[0]-PHYSICAL.cardWidth/2>10,'wonder library outside board');
const faceUp=o=>new T.Vector3(0,0,1).applyQuaternion(o.quaternion).y>.999;
for(const kind of['purchase','patent','wonder','final','product']){const cards=at(kind,0);for(const[id,o]of Object.entries(cards)){
 if(id.startsWith('eventStack')){ok(o.userData.backKey==='eventBack','event pile uses event reverses');ok(!faceUp(o),'event pile hidden');ok(o.position.x===layout.eventPile[0]&&o.position.z===layout.eventPile[2],'events inside event slot');}
 if(id.startsWith('techStack')){ok(o.position.x===layout.techPile[0]&&o.position.z===layout.techPile[2],'technology in shop pile');ok(!faceUp(o),'technology draw pile hidden');}
 if(id.startsWith('wonderStack')){ok(o.userData.source.includes('/奇观/'),'wonder library contains wonders');ok(o.position.x>10,'wonder library not in shop slot');ok(!faceUp(o),'wonder draw pile hidden');}
 }
 for(const prefix of ['eventStack','techStack','wonderStack']){const keys=Object.entries(cards).filter(([id])=>id.startsWith(prefix)).map(([,o])=>o.userData.key);ok(new Set(keys).size===keys.length,`${kind}: unique physical cards in ${prefix}`);}
}
function inside(o,bounds){const v=o.children[0].geometry.attributes.position;for(let i=0;i<v.count;i++){const p=new T.Vector3().fromBufferAttribute(v,i).applyMatrix4(o.children[0].matrixWorld),u=p.x/20+.5,w=p.z/20+.5;if(u<bounds[0]||u>bounds[2]||w<bounds[1]||w>bounds[3])return false;}return true;}
let c=at('purchase',10.3);for(const k of['weave','stone','agri','wheel'])ok(inside(c[k],BOARD_ZONES.market.bounds),'market card wholly inside printed shop: '+k);ok(inside(c.fire,BOARD_ZONES.basic.bounds),'learned basic wholly inside printed basic area');
c=at('wonder',4);for(let i=0;i<6;i++)ok(c['A'+i].position.x-PHYSICAL.cardWidth/2>10,'A investment outside center counting disk');for(const id of ['B0','B1'])ok(c[id].position.x-PHYSICAL.cardWidth/2>10,'B investment next to wonder');
c=at('product',0);ok(c.fast.userData.backKey==='wonderBackV'&&faceUp(c.fast),'era V pending wonder has era V reverse');ok(c.pyramid.position.z>12&&c.letters.position.z>12&&c.final.position.z>12,'owned wonder, patent and won final technology in player area');
const report={passed:true,assertions:checks,faceBackPairs:pairs,boardAuthority:'原版图逐区域裁切核对：左上事件牌、左下商店牌堆、下方商店长栏、上/右基础科技L栏、右下奇观；左侧长栏由用户确认为冗余区域，保持留空。',placement:{eventDeck:layout.eventPile,technologyDeck:layout.techPile,wonderLibrary:layout.wonderPile,activeWonder:layout.wonder,investmentsA:invA,investmentsB:invB},scope:'Actual front/reverse material bindings, matching category/era source directories, duplex heading, pile identities and settled card footprints. Visual readability and motion checked separately.'};fs.writeFileSync(path.join(root,'记录/卡背与牌位核对.json'),JSON.stringify(report,null,2)+'\n');console.log('Card backs and printed slots:',checks,'checks;',pairs.length,'explicit pairs');
