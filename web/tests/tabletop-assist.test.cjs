const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {suggestPayment,payment,totals}=require('../src/tabletop-v4-assist.js');
const {HistoryGame}=require('../game/game_engine.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../game/game_data.json'),'utf8'));

test('payment suggestions minimize overpayment and then card count, independently per resource',()=>{
  let seed=17;const rand=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};
  for(let trial=0;trial<120;trial++){
    const cards=Array.from({length:9},(_,i)=>({id:'c'+i,type:rand(3),value:[1,2,5,10][rand(4)]}));
    const cost=[rand(15),rand(15),rand(15)];
    const ids=suggestPayment(cards,cost),selected=cards.filter(c=>ids.includes(c.id));
    assert.equal(new Set(ids).size,ids.length);
    for(let type=0;type<3;type++){
      const group=cards.filter(c=>c.type===type),picked=selected.filter(c=>c.type===type);
      if(cost[type]===0){assert.equal(picked.length,0);continue;}
      const valid=[];
      for(let mask=0;mask<2**group.length;mask++){
        const subset=group.filter((_,i)=>mask&(1<<i)),sum=subset.reduce((n,c)=>n+c.value,0);
        if(sum>=cost[type])valid.push([sum,subset.length]);
      }
      if(!valid.length)assert.equal(picked.length,group.length);
      else {valid.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);assert.deepEqual([totals(picked)[type],picked.length],valid[0]);}
    }
  }
});

test('preview flags forbidden resource types and never infers hidden resources',()=>{
  assert.deepEqual(totals([{hidden:true},{type:2,value:5,hidden:true}]),[0,0,5]);
  const preview=payment([{id:'a',type:0,value:2},{id:'b',type:1,value:5}],[2,0,3]);
  assert.deepEqual(preview.missing,[0,0,3]);
  assert.deepEqual(preview.unused,[0,5,0]);
  assert.equal(preview.ready,false);
});

test('recommended payment agrees with actual engine mineral change and supports custom denominations',()=>{
  const game=new HistoryGame(data);game.newGame(['甲','乙'],91);
  const s=game.s;s.pending=null;s.queue=[];s.active=0;s.phase=5;
  s.turn={purchases:0,ordinaryPurchases:0,purchaseStarted:false};
  s.shop=['T1-01',...s.shop.filter(id=>id!=='T1-01')].slice(0,4);
  s.players[0].hand=[[0,2],[2,5],[1,10]].map(([type,value])=>game.make(type,value));
  game.command(0,'buy',{card:'T1-01',discount:[0,0,0]});
  const q=s.pending,ids=suggestPayment(game.p(0).hand,q.cost),preview=payment(game.p(0).hand.filter(c=>ids.includes(c.id)),q.cost);
  assert.equal(preview.ready,true);assert.deepEqual(preview.change,[0,0,2]);
  game.command(0,'answer',{id:q.id,cards:ids,groups:[[],[],[1,1]]});
  assert.deepEqual(game.totals(game.p(0).hand),[0,10,2]);
  assert(game.p(0).tech.includes('T1-01'));
});
