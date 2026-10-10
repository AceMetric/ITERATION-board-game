import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {shots,TOTAL} from '../src/story.js';const edit=JSON.parse(fs.readFileSync('src/edit.json'));const transitionFor=(a,b)=>{const j=edit.joins.find(j=>j.pair===a.id+'-'+b.id);return {...j,frames:j.pre+j.post}};
const handles=JSON.parse(fs.readFileSync('记录/双侧转场素材.json')).handles,joins=[];
for(let i=1;i<shots.length;i++){
 const a=shots[i-1],b=shots[i],j=transitionFor(a,b);assert(j.pre>0&&j.post>0);assert(j.frames===j.pre+j.post);assert(b.start-j.pre>a.start);assert(b.start+j.post<b.start+b.frames);
 assert(['into','out','light','paper','material','mist'].includes(j.type));
 const recipe=(id,edge)=>handles.find(h=>h.shot===id&&h.edge===edge);
 const used=j.type==='into'?[recipe(a.id,'tail')]:j.type==='out'?[recipe(b.id,'head')]:[a.kind==='ai'?recipe(a.id,'tail'):null,b.kind==='ai'?recipe(b.id,'head'):null].filter(Boolean);
 for(const h of used){assert(h&&h.outputFrames===j.frames);const files=fs.readdirSync(h.path).filter(x=>/^\d{3}\.jpg$/.test(x)).sort();assert(files.length===j.frames);const unique=new Set(files.map(x=>crypto.createHash('sha256').update(fs.readFileSync(h.path+'/'+x)).digest('hex')));assert(unique.size>=j.frames*.8,'moving frames, not endpoint hold');}
 joins.push({pair:j.pair,type:j.type,start:(b.start-j.pre)/30,edit:b.start/30,end:(b.start+j.post)/30,movingHandles:used.map(h=>h.path)});
}
assert(TOTAL===2700);assert(joins.length===11);fs.writeFileSync('记录/剪辑衔接核对.json',JSON.stringify({passed:true,joins,totalSeconds:90,scope:'all 11 joins cross their edit; generated moving-handle counts and distinct frames checked; individual durations, source windows and unique moving frames checked; visual quality must be reviewed separately at normal and half speed'},null,2)+'\n');console.log('Edit verified: 11 two-sided joins, moving handles, unchanged 90-second duration.');
