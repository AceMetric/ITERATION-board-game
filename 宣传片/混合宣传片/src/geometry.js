import * as T from 'three';
import {cardSurface,defaultSurfaces} from './surfaces.js';
import {PHYSICAL} from './physical.js';
import {diceFaces,ramp,lerp,vecLerp} from './story.js';
export const PAPER=new T.MeshStandardMaterial({color:'#e5dcc6',roughness:.94});
export function mesh(parent,g,m,p=[0,0,0],r=[0,0,0]){const o=new T.Mesh(g,m);o.position.set(...p);o.rotation.set(...r);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
export const box=(p,s,m,v)=>mesh(p,new T.BoxGeometry(...s),m,v);
export function rounded(w,h,r){const s=new T.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
export function cropped(tex,meta){const t=tex.clone(),[x,y,w,h]=meta.rect;t.offset.set(x/meta.size[0],1-(y+h)/meta.size[1]);t.repeat.set(w/meta.size[0],h/meta.size[1]);t.needsUpdate=true;return t}
export function makeCard(textures,metadata,key,surfaces=defaultSurfaces()){const meta=metadata[key];if(!meta?.back||!metadata[meta.back]||!textures[key]||!textures[meta.back])throw new Error('Missing explicit face/back pair: '+key);const w=PHYSICAL.cardWidth,h=w*meta.rect[3]/meta.rect[2],d=.012,r=.09,g=new T.Group();
 const shape=rounded(w,h,r),body=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSegments:3,bevelSize:.004,bevelThickness:.002,curveSegments:10});body.translate(0,0,-d/2);mesh(g,body,new T.MeshStandardMaterial({color:'#e2dbc9',...surfaces.edge,roughness:1,normalScale:new T.Vector2(.07,.07),envMapIntensity:.2}));
 for(const [k,z,rot] of [[key,.009,0],[meta.back,-.009,Math.PI]]){
  const geom=new T.ShapeGeometry(shape,10),pos=geom.attributes.position,uv=geom.attributes.uv;
  for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+w/2)/w,(pos.getY(i)+h/2)/h);
  const face=mesh(g,geom,cardSurface(cropped(textures[k],metadata[k]),surfaces),[0,0,z],[0,rot,0]);face.castShadow=false;
 }

 g.userData={key,w,h,backKey:meta.back,source:meta.source,backSource:metadata[meta.back].source};return g;
}
// Back print remains head-to-head with the face, including diagonal slots.
export const cardRotation=(yaw=0,faceUp=true)=>faceUp?[-Math.PI/2,0,yaw]:[Math.PI/2,0,Math.PI-yaw];
export function pose(o,p,rotation=[-Math.PI/2,0,0],scale=1){o.visible=true;o.position.set(...p);o.rotation.set(...rotation);o.scale.setScalar(scale)}
export function move(o,a,b,start,end,t,{flip=false,scaleA=1,scaleB=1,rotA=[-Math.PI/2,0,0],rotB=[-Math.PI/2,0,0],arc=.8}={}){const p=ramp(start,end,t),pos=vecLerp(a,b,p);pos[1]+=Math.sin(p*Math.PI)*arc;pose(o,pos,vecLerp(rotA,rotB,p),lerp(scaleA,scaleB,p));const qa=new T.Quaternion().setFromEuler(new T.Euler(...rotA)),qb=new T.Quaternion().setFromEuler(new T.Euler(...rotB));if(flip)qa.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI));o.quaternion.copy(qa).slerp(qb,p);return p}
export function marker(parent,color){const g=new T.Group();mesh(g,new T.CylinderGeometry(.21,.23,.085,36),new T.MeshStandardMaterial({color,roughness:.66}),[0,0,0]);mesh(g,new T.TorusGeometry(.16,.014,6,32),new T.MeshStandardMaterial({color:'#eee0b8',roughness:.7}),[0,.047,0],[-Math.PI/2,0,0]);parent.add(g);return g;}
const patterns={1:[[0,0]],2:[[-1,1],[1,-1]],3:[[-1,1],[0,0],[1,-1]],4:[[-1,1],[1,1],[-1,-1],[1,-1]],5:[[-1,1],[1,1],[0,0],[-1,-1],[1,-1]],6:[[-1,1],[-1,0],[-1,-1],[1,1],[1,0],[1,-1]]};
export function makeDie(parent){const g=new T.Group(),ivory=new T.MeshStandardMaterial({color:'#f1e6cf',roughness:.65}),dark=new T.MeshStandardMaterial({color:'#162c48',roughness:.85,side:T.DoubleSide});box(g,[.73,.73,.73],ivory,[0,0,0]);
 for(const [face,normal]of Object.entries(diceFaces)){const shell=new T.Group();shell.position.set(...normal.map(x=>x*.45));shell.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...normal));g.add(shell);const shape=rounded(.9,.9,.075);
  for(const [x,y]of patterns[face]){const hole=new T.Path();hole.absarc(x*.205,y*.205,.075,0,Math.PI*2,true);shape.holes.push(hole);
   // A genuine opening over a concave, recessed hemispherical cup, not a painted face texture.
   mesh(shell,new T.SphereGeometry(.079,16,10,0,Math.PI*2,Math.PI/2,Math.PI/2),dark,[x*.205,y*.205,.002],[Math.PI/2,0,0]);
  }
  const geo=new T.ExtrudeGeometry(shape,{depth:.058,bevelEnabled:true,bevelSize:.007,bevelThickness:.006,bevelSegments:2,curveSegments:16});geo.translate(0,0,-.058);mesh(shell,geo,ivory);
 }
 parent.add(g);return g;
}
export function settledQuaternion(face,yaw=0){const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(...diceFaces[face]),new T.Vector3(0,1,0));return new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw).multiply(q)}
export function rollDie(o,t,start,end,face,index,landing){const p=ramp(start,end,t),q=settledQuaternion(face,.18+index*.41);o.visible=t>=start;
 const from=[landing[0]-1.7,.48,landing[2]-2.8],pos=vecLerp(from,landing,p);if(t>start&&t<end)pos[1]+=(1-p)*1.8*Math.abs(Math.sin(p*Math.PI*5))+.5*Math.sin(p*Math.PI);o.position.set(...pos);
 // Analytic deterministic tumble continuously converges to the selected face. Once settled the quaternion is unchanged.
 const wobble=new T.Quaternion().setFromEuler(new T.Euler((1-p)*Math.PI*(6+index),(1-p)*Math.PI*(4+index),(1-p)*Math.PI*(5-index*.3)));o.quaternion.copy(q).multiply(wobble);if(t<end){const m=new T.Matrix4().makeRotationFromQuaternion(o.quaternion).elements;const support=.457*(Math.abs(m[1])+Math.abs(m[5])+Math.abs(m[9]));o.position.y=Math.max(o.position.y,.036+support)}return p;
}
