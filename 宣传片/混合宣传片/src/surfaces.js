import * as T from 'three';
// Surface relief is separate from every original print image. All noise is seeded
// and mipmapped, so re-rendering or viewing at a distance cannot change the grain.
let fields;
function dataFields(){if(fields)return fields;const n=512,random=(()=>{let s=28743;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}})(),paper=new Float32Array(n*n),cloth=new Float32Array(n*n),edge=new Float32Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x,wx=2*Math.PI*x/8,wy=2*Math.PI*y/8,over=((Math.floor(x/8)+Math.floor(y/8))%2)*2-1;paper[i]=.45*random()+.14*Math.sin(x*.19+y*.31)+.09*Math.sin(x*.062-y*.043);cloth[i]=.22*(Math.cos(wx)+Math.cos(wy))+.12*over*(Math.cos(wx)-Math.cos(wy))+.035*random();edge[i]=.55+.07*Math.sin(y*1.3)+.035*random();}
 function maps(h,kind){const normal=new Uint8Array(n*n*4),rough=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x,j=i*4,dx=h[y*n+(x+1)%n]-h[y*n+(x+n-1)%n],dy=h[((y+1)%n)*n+x]-h[((y+n-1)%n)*n+x],v=new T.Vector3(-dx,-dy,1).normalize();normal[j]=Math.round((v.x*.5+.5)*255);normal[j+1]=Math.round((v.y*.5+.5)*255);normal[j+2]=Math.round((v.z*.5+.5)*255);normal[j+3]=255;const value=kind==='cloth'?218+h[i]*19:kind==='paper'?202+h[i]*24:231+h[i]*8;rough[j]=rough[j+1]=rough[j+2]=Math.round(value);rough[j+3]=255;}return{normal,rough};}
 fields={paper:maps(paper,'paper'),cloth:maps(cloth,'cloth'),edge:maps(edge,'edge')};return fields;
}
export function createSurfaces(){const source=dataFields(),owned=[];function tex(bytes,repeat){const t=new T.DataTexture(bytes,512,512,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=16;t.needsUpdate=true;owned.push(t);return t;}
 const pair=(key,repeat)=>({normalMap:tex(source[key].normal,repeat),roughnessMap:tex(source[key].rough,repeat)}),paper=pair('paper',[2,3]),cloth=pair('cloth',[8,8]),playerCloth=pair('cloth',[7.2,1.36]),edge=pair('edge',[1,1]);
 return{paper,cloth,playerCloth,edge,dispose:()=>owned.forEach(t=>t.dispose())};
}
let fallback;
export const defaultSurfaces=()=>fallback??=createSurfaces();
export function cardSurface(map,surfaces){return new T.MeshPhysicalMaterial({map,...surfaces.paper,normalScale:new T.Vector2(.14,.14),roughness:1,metalness:0,ior:1.45,specularIntensity:.32,clearcoat:0,envMapIntensity:.42,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-3});}
export function clothSurface(map,color,surfaces,player=false){return new T.MeshPhysicalMaterial({map,color,...(player?surfaces.playerCloth:surfaces.cloth),normalScale:new T.Vector2(.38,.38),roughness:1,metalness:0,specularIntensity:.24,envMapIntensity:.3,sheen:.28,sheenColor:new T.Color('#b9c1ca'),sheenRoughness:.9});}
