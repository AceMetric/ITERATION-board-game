const test=require('node:test'),assert=require('node:assert/strict');
const Connection=require('../src/tabletop-v4-network.js');
const Testing=require('../src/tabletop-v4-testing.js');
const Config=require('../game/game_config.js'),data=require('../game/game_data.json');
function fixture(request,id={room:'ABC123ABCD',seat:0,token:'test-only'}){const snapshots=[],saved=[],statuses=[],errors=[];const c=new Connection(id,{request,save:x=>saved.push(structuredClone(x)),onSnapshot:x=>snapshots.push(x),onStatus:x=>statuses.push(x),onError:x=>errors.push(x),schedule:()=>1,cancel:()=>{}});return {c,snapshots,saved,statuses,errors};}
test('lost acknowledgement and refresh retry the exact command; double clicks are rejected',async()=>{
 let called=0,body;const f=fixture(async(path,args)=>{called++;body=args;throw Error('connection dropped after commit');});f.c.accept({version:1});await f.c.command('drawAll',{id:7},2);assert.ok(f.c.pending);await assert.rejects(()=>f.c.command('drawAll',{id:7},2),/仍在确认/);assert.equal(called,1);
 const g=fixture(async(path,args)=>{assert.deepEqual(args,body);return {version:2};},f.saved.at(-1));await g.c.poll();assert.equal(g.c.pending,null);assert.equal(g.c.status,'已连接');assert.equal(g.saved.at(-1).pending,null);
});
test('late old snapshot cannot undo a newer action, and leaving ignores in-flight responses',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>resolve=r));f.c.accept({version:4});f.c.accept({version:3});assert.equal(f.snapshots.length,1);
 const poll=f.c.poll();f.c.close();resolve({version:9});await poll;assert.equal(f.snapshots.length,1);assert.equal(f.saved.length,0);
});
test('rate limiting retains the pending command instead of losing uncertain results',async()=>{
 const f=fixture(async()=>{throw Object.assign(Error('busy'),{status:429});});f.c.accept({version:1});await f.c.command('next',{},1);assert.ok(f.c.pending);
});
test('stale revision rejects the action and resynchronizes without replaying a different command',async()=>{
 const f=fixture(async path=>{if(path==='command')throw Object.assign(Error('stale'),{status:409});return {version:8};});f.c.accept({version:1});await assert.rejects(()=>f.c.command('next',{},1),/stale/);assert.equal(f.c.pending,null);assert.equal(f.c.version,8);
});
test('offline refresh keeps trying, then recovers the same identity',async()=>{
 let online=false;const f=fixture(async()=>{if(!online)throw Error('offline');return {version:7,seat:0};});await f.c.poll();assert.match(f.c.status,/重连/);online=true;await f.c.poll();assert.equal(f.c.status,'已连接');assert.equal(f.snapshots.at(-1).seat,0);
});
test('statistics freeze on victory, survive serialization, and contain no hands or hidden deposits',()=>{
 const view={serial:10,era:2,winners:[],log:[{era:1,turn:0},{era:1,turn:4},{era:2,turn:4},{era:2,turn:10}],players:[{name:'甲',turn:5,rp:80,tech:['a'],wonders:[],hand:[{secret:1}]}],deposits:[[{hidden:true,value:10}]]};
 let m=Testing.observe(null,view,1000,2000);assert.equal(Testing.summarize(view,m,6000).durationMs,5000);
 view.winners=[0];m=Testing.observe(m,view,1000,7000);m=Testing.observe(JSON.parse(JSON.stringify(m)),view,1000,9000);const report=Testing.summarize(view,m,10000);assert.equal(report.durationMs,6000);assert.deepEqual(report.eras.map(x=>x.turns),[4,7]);assert.equal(JSON.stringify(report).includes('secret'),false);assert.equal(JSON.stringify(report).includes('deposits'),false);assert.equal(Testing.summarize(view,{}).durationMs,null);
});
test('rule comparisons enumerate nested differences and do not modify defaults',()=>{
 const base=Config.defaults(),draft=Config.defaults();draft.handLimit=18;draft.moduleCards[2][1]=9;draft.fixedWonders[0]='W01';const rows=Testing.differences(draft,base,data);assert.equal(rows.length,3);assert.equal(base.handLimit,12);assert.equal(rows[2].value,'金字塔');
});
