/* Shared flow helpers: never skip an available strategic choice. */
const Flow = (() => {
 const Rules = typeof module !== 'undefined' ? require('./game_engine.js') : {PATENTS};
 function optional(g,i){const t=g.s.turn,p=g.p(i),v=g.totals(p.hand);return t.tradeOpen||[['T3-01',2],['T3-11',0],['T4-07',1]].some(([id,k])=>p.tech.includes(id)&&(t.converts[id]||0)<3&&v[k]>=2);}
 function patentAvailable(g){const s=g.s,t=s.turn;return g.p().tech.some(id=>!t.usedPatents.includes(id)&&(Rules.PATENTS[id]||[]).some(e=>t.dice.filter((n,j)=>n===e[0]&&!t.usedDice.includes(j)).length>=(e[3]||1)));}
 function modifiers(g){const s=g.s,t=s.turn,i=s.active;return (!t.modifier&&(g.wonder(i,'W01',true)||g.wonder(i,'W02',true)))||(g.has(i,'T5-09')&&t.dice.some((n,j)=>n<=3&&!t.steady.includes(j)));}
 function buyAvailable(g){const s=g.s,i=s.active,t=s.turn,{normal,extra}=g.purchaseSlot(i);if(!normal&&!extra)return false;
  if(extra)return [...s.shop,...s.basics].some(id=>g.techAvailable(i,id));
  return [...s.shop,...s.basics].some(id=>g.card(id).kind==='final'?normal&&g.p().rp>=g.finalFee(i,id,3):g.techAvailable(i,id)&&g.afford(i,g.cost(i,id)))||(!t.purchaseStarted&&g.wonder(i,'W07')?.uses<2&&s.shop.some(id=>g.card(id).kind==='patent'&&!g.card(id).gate));
 }
 function advance(g,{pauseDice=true,pausePurchase=true}={}){const start=g.s.serial,era=g.s.era,skipped=[];for(let guard=0;guard<15;guard++){
  const s=g.s,t=s.turn,i=s.active,p=g.p();if(s.pending||s.queue.length||s.winners.length||s.serial>start+1||s.era!==era)break;
  if(optional(g,i))break;let skip=false;
  switch(s.phase){
   case 2:skip=t.eventUsed||!p.events.some(id=>g.eventLegal(i,id));break;
   case 3:skip=!t.drawLeft||!g.canDraw();break;
   case 4:if(!t.dice)return skipped;if(!t.diceLocked){if(modifiers(g))return skipped;g.command(i,'lockDice');continue;}skip=!pauseDice&&!patentAvailable(g);break;
   case 5:{const slot=g.purchaseSlot(i);skip=(t.purchases||0)>0&&!(pausePurchase&&!slot.normal&&!slot.extra)&&!buyAvailable(g);break;}
   case 6:skip=!s.currentWonder||((!p.hand.length||t.deposited>=(g.wonder(i,'W03')?5:3))&&!(t.deposited&&g.afford(i,g.wonderCost(s.currentWonder),s.deposits[i])));break;
   case 7:skip=t.eventBought||p.boughtEvents>=g.rules().eventBuyLimit||!s.eventDeck.length||p.rp<g.eventPrice(i);break;
   case 8:skip=true;break;
   case 9:skip=g.totals(p.hand).every(n=>n<(g.has(i,'T4-04')&&!t.darwin?Math.min(2,g.ratio(i)):g.ratio(i)));break;
  }
  if(!skip)break;skipped.push(s.phase);g.command(i,'next');
 }return skipped;}
 // Only read helpers run on a private projection; no server state is fabricated in the browser.
 function remote(data,view,quotes){const facade={data,cards:Object.fromEntries([...data.tech,...data.events,...data.wonders].map(c=>[c.id,c])),s:view,view:()=>view,card(id){return this.cards[id];},p(i=view.active){return view.players[i];},research(i,id){return quotes.research[id];},eventLegal(i,id){return quotes.events[id];},techAvailable(i,id){return quotes.available.includes(id);}};
  const proto=(typeof module!=='undefined'?require('./game_engine.js').HistoryGame:HistoryGame).prototype;
  for(const name of ['has','wonder','wonderEra','wonderCost','totals','afford','rules','ratio','cost','finalFee','eventPrice','purchaseSlot'])facade[name]=proto[name];return facade;
 }
 function quotes(g,i){return {research:Object.fromEntries(g.data.tech.map(c=>[c.id,g.research(i,c.id)])),events:Object.fromEntries(g.data.events.map(c=>[c.id,g.eventLegal(i,c.id)])),available:g.data.tech.filter(c=>g.techAvailable(i,c.id)).map(c=>c.id)};}
 function command(g,actor,type,args={}){if(type!=='drawAll')return g.command(actor,type,args);const q=g.s.pending;if(!q||q.op!=='drawChoice'||q.actor!==actor||q.id!==args.id)throw Error('请由指定玩家完成当前抽牌');const count=q.left;for(let j=0;j<count&&g.s.pending?.op==='drawChoice'&&g.s.pending.actor===actor;j++)g.command(actor,'answer',{id:g.s.pending.id});return g.view(actor);}
 return {advance,remote,quotes,buyAvailable,patentAvailable,command};
})();
if(typeof module!=='undefined')module.exports=Flow;
