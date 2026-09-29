import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, createHmac, randomBytes as nodeRandom } from 'node:crypto';
import Engine from '../../game/game_engine.js';
import Flow from '../../game/game_flow.js';
import Config from '../../game/game_config.js';
import { createWorker } from '../worker/api.mjs';
import { digest, hmac, hex, secureRandom } from '../worker/crypto.mjs';
import { TestD1 } from './d1.mjs';
const data=JSON.parse(await readFile(new URL('../vendor/game_data.json',import.meta.url),'utf8'));
function setup(){
  const DB=new TestD1();let worker=createWorker(data,{...Engine,Flow,Config},{rateLimit:100000});
  const call=async(path,body,token,headers={})=>{
    const req=new Request('https://game.example'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',origin:'https://game.example','cf-connecting-ip':'127.0.0.1',...(token?{authorization:'Bearer '+token}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const res=await worker.fetch(req,{DB},{});return {status:res.status,...await res.json()};
  };
  return {DB,call,restart:()=>worker=createWorker(data,{...Engine,Flow,Config},{rateLimit:100000})};
}
async function startGame(api,options={}){
  const host=await api.call('/api/create',{name:'甲',capacity:2,listed:true,...options});assert.equal(host.status,200);
  const guest=await api.call('/api/join',{room:host.room,name:'乙'});assert.equal(guest.status,200);
  assert.equal((await api.call('/api/ready',{room:host.room,ready:true},guest.token)).status,200);
  const started=await api.call('/api/start',{room:host.room},host.token);assert.equal(started.status,200,JSON.stringify(started));return {host,guest,started};
}
function nextCommand(snap){
  const q=snap.view.pending;
  if(q){if(q.op==='drawChoice')return {type:'drawAll',args:{id:q.id}};if(q.op==='choice')return {type:'answer',args:{id:q.id,index:0}};if(q.op==='reward'){const amount=q.any?[q.any,0,0]:q.amount;return {type:'answer',args:{id:q.id,groups:amount.map(n=>Array(n).fill(1))}};}return {type:'answer',args:{id:q.id}};}
  return {type:'next',args:{}};
}
test('SHA-256 and HMAC match Node, including Unicode and long messages',()=>{
  for(const value of ['', 'abc','科技史桌游','x'.repeat(10000)])assert.equal(digest(value),createHash('sha256').update(value).digest('hex'));
  for(const length of [1,32,64,120])for(const message of ['0','1','9999','汉字']){const key=nodeRandom(length);assert.equal(hex(hmac(key,message)),createHmac('sha256',key).update(message).digest('hex'));}
});
test('saved random stream exactly matches original HMAC little-endian rejection sampling',()=>{
  const key=nodeRandom(32),g=secureRandom({s:{onlineRandom:{key:key.toString('hex'),counter:0}}});let counter=0;
  for(let i=0;i<200;i++){const n=[6,4,100,2147483649][i%4],limit=Math.floor(0x100000000/n)*n;let x;do{x=createHmac('sha256',key).update(String(counter++)).digest().readUInt32LE(0);}while(x>=limit);assert.equal(g.rand(n),x%n);assert.equal(g.s.onlineRandom.counter,counter);}
});
test('lobby, rules, modes, readiness, preferences, spectator toggle and reconnect',async()=>{
  const api=setup(),host=await api.call('/api/create',{name:'甲',capacity:2,listed:true}),guest=await api.call('/api/join',{room:host.room,name:'乙'});
  assert.equal(host.token.length,43);assert.equal((await api.call('/api/rooms')).rooms.length,1);
  assert.equal((await api.call('/api/mode',{room:host.room,experimental:true,version:0},guest.token)).status,403);
  let r=await api.call('/api/mode',{room:host.room,experimental:true,quick:true,legend:false,version:0},host.token);assert.equal(r.status,200);assert.ok(r.seats.every(s=>!s.ready));
  r=await api.call('/api/rules',{room:host.room,version:r.rulesVersion,rules:{handLimit:18,researchTargets:[120,110,100]}},host.token);assert.equal(r.rules.handLimit,18);
  assert.equal((await api.call('/api/rules',{room:host.room,version:0,rules:{}},host.token)).status,409);
  r=await api.call('/api/mode',{room:host.room,experimental:false,quick:false,legend:true,version:r.rulesVersion},host.token);assert.equal(r.legend,true);assert.equal(r.rules.finalDiePrice,14);
  r=await api.call('/api/mode',{room:host.room,experimental:true,quick:true,legend:false,version:r.rulesVersion},host.token);assert.equal(r.rules.handLimit,18);
  r=await api.call('/api/preferences',{room:host.room,pauseDice:false,pausePurchase:false},guest.token);assert.deepEqual(r.preferences,{pauseDice:false,pausePurchase:false});
  r=await api.call('/api/rename',{room:host.room,roomName:'实验室',listed:true,allowSpectators:false},host.token);assert.equal(r.roomName,'实验室');assert.equal((await api.call('/api/watch?room='+host.room)).status,403);
  api.restart();r=await api.call('/api/state?room='+host.room,undefined,guest.token);assert.equal(r.seat,1);assert.equal(r.rules.handLimit,18);assert.equal(r.preferences.pausePurchase,false);
});
test('standard, quick, and legend start with confirmed rules and modes',async()=>{
  for(const options of [{},{quick:true},{legend:true},{quick:true,experimental:true,rules:{handLimit:18}}]){
    const api=setup(),{started,host}=await startGame(api,options);
    assert.equal(started.view.era,options.legend?5:options.quick?3:1);assert.equal(started.legend,!!options.legend);assert.equal(started.quick,!!options.quick);
    assert.equal(started.rules.finalDiePrice,14);
    if(options.legend){assert.equal(api.DB.row(host.room).game.state.pending.op,'legendPick');}
    if(options.experimental)assert.equal(started.rules.handLimit,18);
    const saved=api.DB.row(host.room);assert.ok(saved.game.state.onlineRandom.key);assert.equal(saved.game.state.onlineRandom.key.length,64);
    assert.equal(JSON.stringify(started).includes(saved.game.state.onlineRandom.key),false);
  }
});
test('private hands and hidden deposits remain private to seat and spectators',async()=>{
  const api=setup(),{host,guest}=await startGame(api);
  const patched=api.DB.patch(host.room,r=>{const c=r.game.state.players[0].hand.pop();c.hidden=true;r.game.state.deposits[0]=[c];});const hiddenId=patched.game.state.deposits[0][0].id;
  const self=await api.call('/api/state?room='+host.room,undefined,host.token),other=await api.call('/api/state?room='+host.room,undefined,guest.token),watch=await api.call('/api/watch?room='+host.room);
  assert.ok(self.view.players[0].hand);assert.equal(self.view.players[1].hand,undefined);assert.equal(other.view.players[0].hand,undefined);
  assert.equal(self.view.deposits[0][0].id,hiddenId);assert.deepEqual(other.view.deposits[0][0],{hidden:true});assert.deepEqual(watch.view.deposits[0][0],{hidden:true});
  assert.ok(watch.view.players.every(p=>!p.hand&&!p.wall));assert.deepEqual(watch.quotes,{research:{},events:{},available:[]});
  for(const key of ['onlineRandom','resourceDeck','techDeck','eventDeck','hash','receipts'])assert.equal(Object.hasOwn(watch,key),false);
});
test('concurrent duplicate commands execute once and survive Worker restart',async()=>{
  const api=setup(),{host,guest,started}=await startGame(api),actor=started.view.pending?.actor??started.view.active,t=actor===0?host.token:guest.token;
  const current=await api.call('/api/state?room='+host.room,undefined,t),cmd={room:host.room,id:'duplicate_command_0001',revision:current.view.revision,...nextCommand(current)},before=api.DB.row(host.room);
  const results=await Promise.all([api.call('/api/command',cmd,t),api.call('/api/command',cmd,t)]);
  assert.deepEqual(results.map(x=>x.status),[200,200],JSON.stringify(results));const after=api.DB.row(host.room);assert.equal(after.version,before.version+1);assert.equal(after.receipts.filter(r=>r.id===cmd.id).length,1);assert.ok(api.DB.saves>=4);
  api.restart();const replay=await api.call('/api/command',cmd,t);assert.equal(replay.status,200);assert.equal(api.DB.row(host.room).version,after.version);
  assert.equal((await api.call('/api/command',{...cmd,args:{forged:true}},t)).status,409);
});
test('concurrent different commands from same revision reject stale second action',async()=>{
  const api=setup(),{host,guest,started}=await startGame(api),actor=started.view.pending?.actor??started.view.active,t=actor===0?host.token:guest.token,current=await api.call('/api/state?room='+host.room,undefined,t),cmd={room:host.room,revision:current.view.revision,...nextCommand(current)};
  const results=await Promise.all([api.call('/api/command',{...cmd,id:'distinct_command_0001'},t),api.call('/api/command',{...cmd,id:'distinct_command_0002'},t)]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
});
test('concurrent joins cannot exceed capacity',async()=>{
  const api=setup(),host=await api.call('/api/create',{name:'甲',capacity:2});
  const results=await Promise.all(['乙','丙'].map(name=>api.call('/api/join',{room:host.room,name})));assert.deepEqual(results.map(x=>x.status).sort(),[200,400]);assert.equal(api.DB.row(host.room).seats.length,2);
});
test('rejects wrong token, cross-origin JSON, bad bodies and oversized requests',async()=>{
  const api=setup(),host=await api.call('/api/create',{name:'甲',capacity:2});
  assert.equal((await api.call('/api/state?room='+host.room)).status,401);
  assert.equal((await api.call('/api/state?room='+host.room,undefined,'a'.repeat(43))).status,401);
  assert.equal((await api.call('/api/create',{name:'甲',capacity:2},undefined,{origin:'https://attacker.example'})).status,403);
  assert.equal((await api.call('/api/create',{name:'甲',capacity:2},undefined,{'content-type':'text/plain'})).status,415);
  assert.equal((await api.call('/api/create',{name:'甲',capacity:2,garbage:'x'.repeat(32768)})).status,413);
});

test('full 2/3/4-player standard and quick games replay with identical final engine state',async()=>{
  const {run}=await import('../vendor/game_playthrough.cjs').then(m=>m.default),original=Engine.HistoryGame.prototype.command;
  for(const [n,mode,quick] of [[2,'research',false],[3,'research',false],[4,'final',false],[2,'research',true],[3,'research',true],[4,'research',true]]){
    const commands=[];let nesting=false,result;
    Engine.HistoryGame.prototype.command=function(actor,type,args={}){
      if(nesting)return original.call(this,actor,type,args);
      const revision=this.s.revision,value=original.call(this,actor,type,args);commands.push({actor,type,args,revision});
      nesting=true;try{Flow.advance(this);}finally{nesting=false;}return value;
    };
    try{result=run(n,20260918,mode,30000,{quick});}finally{Engine.HistoryGame.prototype.command=original;}
    const api=setup(),g=new Engine.HistoryGame(data);g.newGame(Array.from({length:n},(_,i)=>'玩家'+(i+1)),result.seed,{}, {quick});
    const id='ABCDEF1234',tokens=Array.from({length:n},()=>nodeRandom(32).toString('base64url'));
    const r={id,capacity:n,version:1,seats:tokens.map((t,i)=>({name:'玩家'+(i+1),hash:digest(t),ready:true,seen:Date.now()})),game:JSON.parse(g.export()),receipts:[],quick,allowSpectators:true,experimental:false,rules:Config.defaults(),createdAt:new Date().toISOString()};
    api.DB.sqlite.prepare('INSERT INTO game_rooms (id,version,payload,listed,started,allow_spectators,host_seen,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id,1,JSON.stringify(r),0,1,1,Date.now(),Date.now());
    let last;
    for(let j=0;j<commands.length;j++){
      const c=commands[j];last=await api.call('/api/command',{room:id,id:'playthrough_'+String(j).padStart(8,'0'),type:c.type,args:c.args,revision:c.revision},tokens[c.actor]);
      assert.equal(last.status,200,JSON.stringify({n,mode,quick,j,c,error:last.error}));
      if(j%37===0)api.restart();
    }
    assert.deepEqual(last.view.winners,result.winners);assert.equal(last.view.reason,result.reason);assert.deepEqual(api.DB.row(id).game,JSON.parse(result.state));assert.equal(digest(JSON.stringify(api.DB.row(id).game)),result.sha256);
    console.log(JSON.stringify({players:n,mode,quick,commands:commands.length,winner:last.view.reason,exactReplay:true}));
  }
});

test('legend opening choices, private event reveal and public wonder use the same command API',async()=>{
  const api=setup(),{host,guest}=await startGame(api,{legend:true});let last;
  for(let i=0;i<4;i++){
    const raw=api.DB.row(host.room).game.state,q=raw.pending,t=q.actor===0?host.token:guest.token;
    const own=await api.call('/api/state?room='+host.room,undefined,t),other=await api.call('/api/state?room='+host.room,undefined,q.actor===0?guest.token:host.token);
    assert.equal(other.view.pending.op,undefined);
    const args=q.op==='legendPick'?{id:q.id,card:q.cards[0]}:{id:q.id,confirm:true};
    last=await api.call('/api/command',{room:host.room,id:'legend_opening_'+String(i).padStart(4,'0'),revision:own.view.revision,type:'answer',args},t);assert.equal(last.status,200,JSON.stringify(last));
  }
  assert.equal(last.view.wonderShown,1);assert.ok(last.view.currentWonder);assert.ok(last.view.players.every(p=>p.events.length===2&&p.wonders.length===1));
});

test('host disconnect does not close the room; guest plays, host reconnects, statistics persist',async()=>{
 const api=setup(),{host,guest}=await startGame(api);
 api.DB.patch(host.room,r=>{r.seats[0].seen=0;r.game.state.pending=null;r.game.state.queue=[];r.game.state.active=1;r.game.state.phase=9;});
 api.DB.sqlite.prepare('DELETE FROM game_presence WHERE room_id = ? AND seat = 0').run(host.room);
 const guestState=await api.call('/api/state?room='+host.room,undefined,guest.token);assert.equal(guestState.seats[0].online,false);
 const cmd={room:host.room,id:'host_offline_guest_0001',revision:guestState.view.revision,type:'next',args:{}};
 assert.equal((await api.call('/api/command',cmd,guest.token)).status,200);
 api.restart();const resumed=await api.call('/api/state?room='+host.room,undefined,host.token);assert.equal(resumed.status,200);assert.equal(resumed.seat,0);assert.equal(resumed.seats[0].online,true);assert.ok(resumed.metrics.startedAt);assert.equal(resumed.metrics.endedAt,null);
 const metrics=resumed.metrics;assert.equal(JSON.stringify(metrics).includes('hand'),false);
});
