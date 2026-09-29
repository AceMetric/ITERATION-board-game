import { readFile, writeFile, mkdir, copyFile, cp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const output=resolve(root,'dist');
const python=process.env.PYTHON||'python3';
const build=spawnSync(python,[resolve(root,'scripts/build-standalone.py')],{cwd:root,stdio:'inherit'});
if(build.status!==0)throw Error('HTML build failed');
await rm(output,{recursive:true,force:true});
await mkdir(resolve(output,'server'),{recursive:true});
await mkdir(resolve(output,'client','source'),{recursive:true});
await mkdir(resolve(output,'.openai'),{recursive:true});
await copyFile(resolve(root,'standalone.html'),resolve(output,'client/index.html'));
for(const name of ['tabletop-v4.css','tabletop-v4-controller.js','tabletop-v4-board.js','tabletop-v4-assist.js','tabletop-v4-testing.js','tabletop-v4-network.js']){
  await copyFile(resolve(root,'src/'+name),resolve(output,'client/source/'+name));
}
await cp(resolve(root,'assets'),resolve(output,'client/assets'),{recursive:true});
await copyFile(resolve(root,'.openai/hosting.json'),resolve(output,'.openai/hosting.json'));
await cp(resolve(root,'drizzle'),resolve(output,'.openai/drizzle'),{recursive:true});
const workerBuild=spawnSync(process.execPath,[resolve(root,'cloud/scripts/build.mjs'),resolve(output,'server/index.js')],{cwd:resolve(root,'cloud'),stdio:'inherit'});
if(workerBuild.status!==0)throw Error('Worker build failed');
const source=await readFile(resolve(output,'server/index.js'),'utf8');
const result=source.replace('if(env.ASSETS?.fetch)return env.ASSETS.fetch(request);','if(env.ASSETS?.fetch)return env.ASSETS.fetch(request);');
await writeFile(resolve(output,'server/index.js'),result);
console.log('Sites build complete: Worker, designed cards, independent tabletop page, and D1 migrations.');
