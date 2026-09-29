const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createServer}=require('../server.cjs');
test('local clients share one authoritative state and metrics survive restart without private data',async()=>{
 const saveDir=fs.mkdtempSync(path.join(os.tmpdir(),'iteration-network-'));let server,base;
 async function start(){server=createServer({saveDir});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
 const stop=()=>new Promise(r=>server.close(r));
 async function call(route,body,token){const r=await fetch(base+'/api/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
 try{await start();const host=await call('create',{name:'测试甲',capacity:2,allowSpectators:true}),guest=await call('join',{room:host.room,name:'测试乙'});
 await call('ready',{room:host.room,ready:true},guest.token);const s=await call('start',{room:host.room},host.token);assert.equal(s.status,200);assert.ok(s.metrics.startedAt);
 const actor=s.view.pending?.actor??s.view.active,token=actor===0?host.token:guest.token,state=await call('state?room='+host.room,null,token),q=state.view.pending;
 const cmd={room:host.room,id:'local_duplicate_0001',revision:state.view.revision,type:q.op==='drawChoice'?'drawAll':'answer',args:q.op==='drawChoice'?{id:q.id}:{id:q.id,groups:(q.any?[q.any,0,0]:q.amount).map(n=>Array(n).fill(1))}};
 const results=await Promise.all([call('command',cmd,token),call('command',cmd,token)]);assert.deepEqual(results.map(x=>x.status),[200,200]);assert.equal(results[0].view.revision,results[1].view.revision);
 const watch=await call('watch?room='+host.room);assert.ok(watch.view.players.every(p=>!p.hand));assert.deepEqual(Object.keys(watch.metrics).sort(),['endedAt','startedAt']);
 await stop();await start();const resumed=await call('state?room='+host.room,null,guest.token);assert.equal(resumed.status,200);assert.deepEqual(resumed.metrics,s.metrics);assert.equal(resumed.seat,1);
 const replay=await call('command',cmd,token);assert.equal(replay.view.revision,results[0].view.revision);
 }finally{if(server?.listening)await stop();fs.rmSync(saveDir,{recursive:true,force:true});}
});
