'use strict';
// Test-only policy. No opponent automation is included in the delivered HTML.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {HistoryGame,PATENTS}=require('../../game/game_engine.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'game_data.json'),'utf8'));
const den=n=>{const a=[];for(const d of [10,5,2,1])while(n>=d){a.push(d);n-=d;}return a;};
const add=a=>a.reduce((s,n)=>s+n,0);
function target(g,i){const totals=g.totals(g.p(i).hand);const ids=[...g.s.shop,...g.s.basics].filter(id=>g.techAvailable(i,id));return ids.sort((a,b)=>{const rank=id=>{const c=g.card(id),cost=g.cost(i,id),def=add(cost.map((n,k)=>Math.max(0,n-totals[k])));return def*10+add(cost)*.3-g.research(i,id)*.2-(c.gate?6:0)-(g.s.shop.includes(id)?4:0)+(c.wrong?15:0);};return rank(a)-rank(b);})[0];}
function autoAnswer(g,mode){const q=g.s.pending,i=q.actor,p=g.p(i),a={id:q.id};switch(q.op){
case 'choice':{let index=q.options.findIndex(o=>/支付并推进|立即使用/.test(o.label));if(index<0)index=q.options.findIndex(o=>/暂停|不参与/.test(o.label));a.index=index<0?0:index;break;}
case 'reward':{let val=q.amount;if(q.any){const tar=target(g,i),cost=tar?g.cost(i,tar):[1,1,1],tot=g.totals(p.hand);val=[0,0,0];for(let n=0;n<q.any;n++){const k=q.single?cost.map((x,k)=>x-tot[k]).indexOf(Math.max(...cost.map((x,k)=>x-tot[k]))):cost.map((x,k)=>x-tot[k]-val[k]).indexOf(Math.max(...cost.map((x,k)=>x-tot[k]-val[k])));val[k]++;}}a.groups=val.map(den);break;}
case 'pay':{const h=q.source==='deposit'?g.s.deposits[i]:p.hand;a.cards=(q.source==='deposit'?h:h.filter(c=>q.cost[c.type]>0)).map(c=>c.id);const tot=g.totals(h.filter(c=>a.cards.includes(c.id)));a.groups=tot.map((n,k)=>den(n-q.cost[k]));break;}
case 'drawChoice':break;
case 'selectCards':{const h=q.purpose==='refund'?g.s.deposits[i]:p.hand;const sorted=h.filter(c=>q.cards.includes(c.id)).sort((a,b)=>a.value-b.value);a.cards=q.purpose==='refund'?sorted.slice(-q.max).map(c=>c.id):sorted.slice(0,q.min).map(c=>c.id);break;}
case 'privateView':a.confirm=true;break;
case 'fastPick':a.cards=q.cards.slice().sort((a,b)=>g.research(i,b)-g.research(i,a)).slice(0,q.min);break;
case 'genePick':a.own=q.own[0];a.cards=q.candidates.slice(0,2);break;
case 'tradeOffer':case 'tradeReturn':a.cards=[];break;
case 'tradeConfirm':a.confirm=true;break;
default:throw Error('unknown prompt '+q.op);
}g.command(i,'answer',a);}
function run(n,seed,mode,max=30000,options={}){const g=new HistoryGame(data);g.newGame(Array.from({length:n},(_,i)=>'玩家'+(i+1)),seed,{},options);let actions=0;const turns=[];let turn=0;while(!g.s.winners.length&&actions++<max){if(turn!==g.s.serial){turn=g.s.serial;turns.push({serial:turn,era:g.s.era,player:g.s.active,points:g.s.players.map(p=>p.rp)});}if(g.s.pending){autoAnswer(g,mode);continue;}const s=g.s,i=s.active,p=g.p(),t=s.turn;switch(s.phase){
case 2:{const event=p.events.find(id=>g.eventLegal(i,id));if(event&&!t.eventUsed)g.command(i,'useEvent',{card:event});else g.command(i,'next');break;}
case 3:g.command(i,'next');break;
case 4:{if(!t.dice){g.command(i,'roll');break;}if(!t.diceLocked){const idx=t.dice.findIndex((n,j)=>n<=3&&!t.steady.includes(j));if(g.has(i,'T5-09')&&idx>=0){g.command(i,'steady',{index:idx});break;}g.command(i,'lockDice');break;}
 let found=false;for(const id of p.tech){if(!PATENTS[id]||t.usedPatents.includes(id))continue;for(let k=0;k<PATENTS[id].length;k++){const ef=PATENTS[id][k],ds=t.dice.map((n,j)=>n===ef[0]&&!t.usedDice.includes(j)?j:-1).filter(j=>j>=0).slice(0,ef[3]||1);if(ds.length===(ef[3]||1)){g.command(i,'patent',{card:id,effect:k,dice:ds});found=true;break;}}if(found)break;}if(!found)g.command(i,'next');break;}
case 5:{const final=s.shop.find(id=>g.card(id).kind==='final');if(mode==='final'&&final&&t.purchases===0){const dice=[8,7,6,5,4,3].find(k=>p.rp>=g.finalFee(i,final,k));if(dice){g.command(i,'final',{card:final,count:dice});break;}}
 const buy=target(g,i);if(buy&&t.purchases===0&&g.afford(i,g.cost(i,buy)))g.command(i,'buy',{card:buy});else g.command(i,'next');break;}
case 6:{if(s.currentWonder){const cost=g.card(s.currentWonder).costs[s.era],have=g.totals(s.deposits[i]);if(t.deposited&&g.afford(i,cost,s.deposits[i])){g.command(i,'build');break;}if(t.deposited===0){const need=cost.map((n,k)=>Math.max(0,n-have[k])),pool=p.hand.slice().sort((a,b)=>b.value-a.value),cards=[];for(const c of pool){if(cards.length>=(g.wonder(i,'W03')?5:3))break;if(need[c.type]>0&&((g.s.era<=2&&g.totals(p.hand)[c.type]>3)||g.s.era>2)){cards.push(c.id);need[c.type]=Math.max(0,need[c.type]-c.value);}}if(cards.length){g.command(i,'deposit',{cards,hidden:cards.filter((_,j)=>j%2)});break;}}}g.command(i,'next');break;}
case 7:{const fee=(p.boughtEvents+1)*5*(s.era>=4?2:1);if(!t.eventBought&&p.boughtEvents<5&&s.eventDeck.length&&p.rp>=fee&&(mode==='final'||p.boughtEvents<1))g.command(i,'buyEvent');else g.command(i,'next');break;}
case 8:g.command(i,'next');break;
case 9:{let converted=false;if(mode==='research')for(const [id,k]of [['T3-01',2],['T3-11',0],['T4-07',1]])if(g.has(i,id)&&(t.converts[id]||0)<3&&g.totals(p.hand)[k]>=2){g.command(i,'convert',{card:id});converted=true;break;}if(converted)break;const tar=target(g,i),cost=tar?g.cost(i,tar):[0,0,0],tot=g.totals(p.hand),to=cost.findIndex((n,k)=>n>tot[k]),from=tot.findIndex((n,k)=>k!==to&&n-cost[k]>=g.ratio(i));if(to>=0&&from>=0){g.command(i,'void',{from,to,count:1});break;}g.command(i,'next');break;}
default:throw Error('stuck phase '+s.phase);
}if(actions%137===0){const h=HistoryGame.restore(data,g.export());assert.equal(h.export(),g.export());} }
assert.ok(g.s.winners.length,`${n}p seed${seed} no end at ${g.s.serial} turns era${g.s.era}`);g.validate();return {players:n,seed,mode,commands:actions,turns:g.s.serial,era:g.s.era,winners:g.s.winners,reason:g.s.reason,score:g.s.players.map(p=>p.rp),sha256:crypto.createHash('sha256').update(g.export()).digest('hex'),state:g.export(),log:g.s.log,turnSnapshots:turns};}
if(require.main===module){const results=[];for(const n of [2,3,4])for(const mode of ['research','final']){let result;for(const seed of [20260918,20260919,20260920,20260921]){result=run(n,seed,mode);if((mode==='final')===result.reason.startsWith('最终'))break;}const replay=run(n,result.seed,mode);assert.equal(result.sha256,replay.sha256);results.push(result);console.log(JSON.stringify({...result,state:undefined,log:undefined,turnSnapshots:undefined}));}
fs.writeFileSync(path.join(__dirname,'game_playthrough_report.json'),JSON.stringify(results.map(r=>({...r,state:undefined})),null,2));
fs.writeFileSync(path.join(__dirname,'game_completed_fixture.json'),results[0].state);
assert.ok(results.some(r=>r.reason.startsWith('最终')),'final route not reached');assert.ok(results.some(r=>r.reason==='科研胜利'),'research route not reached');}
module.exports={run,autoAnswer};
