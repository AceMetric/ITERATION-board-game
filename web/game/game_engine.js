/* Deterministic rules. UI issues commands; it never mutates state. */
'use strict';
const CONFIG=typeof module!=='undefined'?require('./game_config.js'):GameConfig;
const RES=['金币','人力','矿物'], DEN=[1,2,5,10], ERA=['','I','II','III','IV','V'];
const clone=x=>x===undefined?null:JSON.parse(JSON.stringify(x));
const sum=a=>a.reduce((x,y)=>x+y,0);
const check=(v,m)=>{if(!v)throw Error(m);};
const whole=(v,min=0,max=10000)=>Number.isInteger(v)&&v>=min&&v<=max;
const vec=()=>[0,0,0];
const PATENTS={
 'T1-06':[[6,[1,0,0],0]],'T1-07':[[5,[0,0,1],0]],'T1-09':[[6,[0,1,0],0]],'T1-11':[[6,[0,1,0],0],[4,[1,0,0],0]],
 'T2-03':[[5,[0,1,0],0]],'T2-06':[[6,[2,0,0],0],[4,[1,0,0],0]],'T2-07':[[4,[0,1,0],0]],'T2-08':[[5,[0,0,2],0],[4,[0,0,1],0]],'T2-09':[[6,[0,0,1],0]],'T2-10':[[4,[1,0,0],0]],
 'T3-02':[[5,vec(),2]],'T3-03':[[6,vec(),3]],'T3-06':[[6,[3,0,0],0]],'T3-07':[[4,vec(),3]],'T3-10':[[4,[0,0,3],0]],
 'T4-02':[[4,[0,0,8],0,2]],'T4-08':[[6,vec(),5]],'T4-09':[[6,vec(),5]],
 'T5-01':[[4,vec(),4],[6,[4,0,0],0]],'T5-03':[[6,vec(),6]],'T5-04':[[5,vec(),4],[6,[0,0,4],0]],'T5-07':[[2,[0,2,0],0],[6,[0,3,0],2]]
};
class HistoryGame {
 constructor(data,state){this.data=data;this.cards=Object.fromEntries([...data.tech,...data.events,...data.wonders].map(c=>[c.id,c]));if(state)this.s=clone(state);}
 wonderEra(id){return this.s.legend?Math.max(...this.card(id).eras):this.s.era;}
 wonderCost(id){return this.card(id).costs[this.wonderEra(id)];}
 legendRefill(){const s=this.s;if(!s.legend||s.currentWonder||s.wonderShown>=3||!s.legendWonderPool?.length)return;s.currentWonder=s.legendWonderPool.shift();s.wonderShown++;s.deposits=s.players.map(()=>[]);this.log('公共奇观 '+s.wonderShown+'/3：'+this.card(s.currentWonder).name+'（最高时代档）');}
 card(id){check(this.cards[id],'不存在的卡牌');return this.cards[id];}
 p(i=this.s.active){return this.s.players[i];}
 has(i,id){return this.p(i).tech.includes(id);}
 wonder(i,id,ready=false){const w=this.p(i).wonders.find(w=>w.id===id);return w&&(!ready||this.p(i).turn>w.turn)?w:null;}
 totals(cards){return cards.reduce((v,c)=>(v[c.type]+=c.value,v),vec());}
 afford(i,cost,cards=this.p(i).hand){return cost.every((n,k)=>this.totals(cards)[k]>=n);}
 rules(){return {...CONFIG.defaults(),...this.s.rules,finalDiePrice:this.s.rules?.finalDiePrice??6};}
 cap(i){return this.rules().handLimit+(this.has(i,'T2-02')?2:0)+(this.has(i,'T3-08')?3:0)+(this.wonder(i,'W03')?4:0);}
 ratio(i){return Math.max(1,this.rules().voidRatio-['T1-10','T2-01','T3-09'].filter(id=>this.has(i,id)).length);}
 eventPrice(i){const prices=this.rules().eventPrices;return prices[Math.min(this.p(i).boughtEvents,prices.length-1)]*(this.s.era>=4?2:1);}
 purchaseSlot(i){const t=this.s.turn,w=this.wonder(i,'W10'),limit=this.rules().techBuys;return {normal:t.purchases<limit,extra:t.purchases===limit&&!!w&&w.uses<2};}
 log(msg){this.s.log.push({turn:this.s.serial,era:this.s.era,text:msg});}
 rand(n){let x=this.s.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;this.s.rng=x>>>0;return Math.floor(this.s.rng/4294967296*n);}
 shuffle(a){for(let i=a.length-1;i>0;i--){const j=this.rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
 dice(n,label,detail={}){const d=Array.from({length:n},()=>1+this.rand(6));const record={id:(this.s.rollSerial||0)+1,label,values:d.slice(),actor:detail.actor??this.s.active,turn:this.s.serial,era:this.s.era,kind:detail.kind||'judgment',effects:[],...detail};this.s.rollSerial=record.id;(this.s.rolls??=[]).push(record);this.s.lastRoll=record;this.log(label+'：'+d.join('、'));return d;}
 rollEffect(text,record=this.s.lastRoll){if(!record)return;(record.effects??=[]).push(text);this.log(record.label+'结果：'+text);}
 patentReport(){const t=this.s.turn,r=(this.s.rolls||[]).find(r=>r.id===t?.rollId);if(!r||!t.dice)return;r.currentValues=t.dice.slice();r.confirmed=!!t.diceLocked;r.usedDice=t.usedDice.slice();r.effects=[t.diceLocked?'最终骰面已确认；强制效果照常结算，可选专利收益须由玩家分配。':'尚未确认最终骰面；如有改骰能力可先使用，当前匹配不代表已经领取收益。'];r.options=[];
  for(const id of this.p().tech)for(const [effect,e]of (PATENTS[id]||[]).entries())if(t.dice.filter(n=>n===e[0]).length>=(e[3]||1)){const gain=[...(e[2]?[e[2]+'科研']:[]),...e[1].flatMap((n,k)=>n?[n+RES[k]]:[])].join('、');r.options.push({card:id,effect,label:this.card(id).name+'：'+(e[3]||1)+'枚'+e[0]+'点骰 → '+gain,available:t.dice.filter((n,j)=>n===e[0]&&!t.usedDice.includes(j)).length>=(e[3]||1)&&!t.usedPatents.includes(id)});}
  if(!r.options.length)r.effects.push('这些点数没有匹配的可选专利收益。');
  if(this.has(this.s.active,'T1-12')&&t.dice.includes(5))r.effects.push(this.has(this.s.active,'T5-09')?'四元素说：稳态宇宙论免疫强制占骰。':'四元素说：必须占用一枚5点骰，该枚骰不获得收益。');
  for(const id of ['T3-04','T4-03'])if(this.has(this.s.active,id)&&t.dice.includes(1))r.effects.push(this.card(id).name+'：1点触发失去4科研及2矿物（资源不足按现有数量处理）。');
  if(this.has(this.s.active,'T4-09')&&t.dice.filter(n=>n===1).length>=2)r.effects.push('核能：至少两个1触发独立保护判定，详见对应判定结果。');
 }
 make(type,value,origin='reserve',virtual=false){return {id:'R'+(++this.s.uid),type,value,origin,virtual};}
 give(i,groups){groups.forEach((vs,t)=>vs.forEach(v=>{const list=this.s.reserve[t],j=list.findIndex(c=>c.value===v);this.p(i).hand.push(j>=0?list.splice(j,1)[0]:this.make(t,v,'reserve',true));}));}
 recycle(cards){for(const c of cards){delete c.hidden; (c.origin==='draw'?this.s.resourceDiscard:this.s.reserve[c.type]).push(c);}}
 combineResourceDecks(){const s=this.s;s.resourceDeck=this.shuffle(s.decks.flat());s.resourceDiscard=s.discard.flat();delete s.decks;delete s.discard;s.version=2;if(s.pending?.op==='drawChoice'&&!s.pending.extra)s.pending.title='从混合资源牌堆抽牌';}
 canDraw(){return this.s.resourceDeck.length+this.s.resourceDiscard.length>0;}
 draw(i){if(!this.s.resourceDeck.length)this.s.resourceDeck=this.shuffle(this.s.resourceDiscard.splice(0));if(!this.s.resourceDeck.length)return false;this.p(i).hand.push(this.s.resourceDeck.shift());return true;}
 push(...tasks){this.s.queue.unshift(...tasks.filter(Boolean));}
 reward(i,amount,title='领取资源',extra={}){return {op:'reward',actor:i,amount,title,...extra};}
 pay(i,cost,title='支付资源',extra={}){return {op:'pay',actor:i,cost,title,...extra};}
 choices(actor,title,options,extra={}){return {op:'choice',actor,title,options,...extra};}
 rp(i,n){if(n>0&&this.s.fast&&this.s.fast.actor===i){n=Math.min(n,this.s.fast.remaining);this.s.fast.remaining-=n;}this.p(i).rp=Math.max(0,this.p(i).rp+n);if(n)this.log(this.p(i).name+(n>0?'获得':'失去')+Math.abs(n)+'科研点');this.winCheck();}
 winCheck(){const w=this.s.players.map((p,i)=>p.rp>=this.s.target?i:-1).filter(i=>i>=0);if(w.length)this.win(w,'科研胜利');}
 win(w,reason){this.s.winners=w;this.s.reason=reason;this.s.queue=[];this.s.pending=null;this.log(w.map(i=>this.p(i).name).join('、')+'：'+reason);}
 newGame(names,seed=Date.now()>>>0,settings={},options={}){check(names.length>=2&&names.length<=4,'支持2至4人');const legend=options.legend===true;check(!(legend&&options.quick),'模式不能同时启用');const rules=CONFIG.normalize(legend?CONFIG.legendRules():settings,this.data,names.length);const quick=options.quick===true,initial=quick?3:2;const modulesCount=rules.resourceModules||(names.length===2?1:2);check(rules.moduleCards.every(row=>row.reduce((a,b)=>a+b,0)*modulesCount>=names.length*initial),'每种资源牌数量不足以发放开局每人'+initial+'张');this.s={quick,...(legend?{legend:true,experimental:false,wonderShown:0}:{}),version:1,rules,rng:(seed>>>0)||1,uid:0,qid:0,revision:0,serial:0,era:legend?5:quick?3:1,starter:0,active:0,phase:0,target:Math.max(1,Math.floor(rules.researchTargets[names.length-2]*(legend?.46:quick?.75:1))),players:names.map((name,i)=>({name:String(name||'玩家'+(i+1)).slice(0,24),hand:[],tech:[],wonders:[],events:[],boughtEvents:0,rp:0,turn:0,skip:0,wall:[],drugs:[],bubbles:[]})),decks:[[],[],[]],discard:[[],[],[]],reserve:[[],[],[]],techDeck:[],shop:[],basics:[],learned:{},gate:false,eventDeck:[],eventDiscard:[],wonderPools:[[],[],[]],currentWonder:null,deposits:names.map(()=>[]),plague:null,queue:[],pending:null,log:[],winners:[],lastRoll:null};
   const s=this.s,modules=rules.resourceModules||(names.length===2?1:2);
   for(let t=0;t<3;t++)for(let m=0;m<=modules;m++)for(let d=0;d<4;d++)for(let j=0;j<rules.moduleCards[t][d];j++)(m===modules?s.reserve[t]:s.decks[t]).push(this.make(t,DEN[d],m===modules?'reserve':'draw'));
   s.decks.forEach(d=>this.shuffle(d));s.eventDeck=this.shuffle(this.data.events.map(c=>c.id));s.wonderPools=[this.shuffle(this.data.wonders.slice(0,6).map(c=>c.id)),this.shuffle(this.data.wonders.slice(6,12).map(c=>c.id)),this.shuffle(this.data.wonders.slice(12).map(c=>c.id))];s.starter=this.rand(names.length);s.active=s.starter;
   for(let i=0;i<names.length;i++){const extra=legend?this.rand(3):-1;for(let t=0;t<3;t++)for(let k=0;k<initial+(t===extra?1:0);k++)this.p(i).hand.push(s.decks[t].shift());}
   this.combineResourceDecks();
   this.setupEra();
   if(legend){s.currentWonder=null;for(let offset=0;offset<names.length;offset++){const actor=(s.starter+offset)%names.length;this.p(actor).events=s.eventDeck.splice(0,2);s.queue.push({op:'legendPick',actor,title:'一战封神：选择开局奇观buff',cards:this.shuffle(['W01','W02','W03','W04','W05','W06','W07','W09','W10','W15']).slice(0,5)},{op:'legendEvents',actor,title:'你的两张初始明置事件',cards:this.p(actor).events.slice()});}s.queue.push({op:'legendPublicWonder'});}
   for(let offset=1;offset<names.length;offset++){const actor=(s.starter+offset)%names.length,n=names.length===2||offset===3?2:1;s.queue.push(this.reward(actor,null,'后手补偿：自选一种资源'+n+'点',{any:n,single:true}));}
   s.queue.push({op:'start'});this.log('新游戏开始，'+this.p(s.starter).name+'为时代'+ERA[s.era]+'起始玩家'+(legend?'（一战封神）':quick?'（疾速模式）':''));this.drain();return s;
 }
 setupEra(){const s=this.s,all=this.data.tech.filter(t=>t.era===s.era);if(s.legend)all.push(...this.shuffle(this.data.tech.filter(t=>t.era===3||t.era===4).slice()).slice(0,11));if(s.era===5){const ordinary=this.shuffle(all.filter(t=>t.kind!=='final').map(t=>t.id));s.techDeck=[...ordinary.slice(0,-3),...this.shuffle([...ordinary.slice(-3),...all.filter(t=>t.kind==='final').map(t=>t.id)])];}else s.techDeck=this.shuffle(all.map(t=>t.id));s.shop=[];s.basics=[];s.gate=false;this.refill();const pool=s.wonderPools[s.era<3?0:s.era<5?1:2],fixed=this.rules().fixedWonders[s.era-1],reserved=this.rules().fixedWonders.slice(s.era);const wi=fixed?pool.indexOf(fixed):pool.findIndex(id=>!reserved.includes(id));s.currentWonder=wi>=0?pool.splice(wi,1)[0]:null;s.deposits=s.players.map(()=>[]);for(const p of s.players)for(const w of p.wonders){w.uses=0;}}
 refill(){if(this.s.fast)return;while(this.s.shop.length<4&&this.s.techDeck.length)this.s.shop.push(this.s.techDeck.shift());}
 eraCheck(){const s=this.s;if(s.era<5&&s.gate&&s.shop.length+s.techDeck.length<=4){s.players.forEach((p,i)=>{p.hand.push(...s.deposits[i].map(c=>{delete c.hidden;return c;}),...p.wall);p.wall=[];});s.era++;s.starter=(s.starter+1)%s.players.length;s.active=s.starter;s.plague=null;s.queue=[];s.pending=null;s.fast=null;this.setupEra();this.log('立即进入时代'+ERA[s.era]+'；余下回合动作取消');this.push({op:'start'});return true;}return false;}
 request(task){this.s.pending={...task,id:++this.s.qid};}
 drain(){let guard=0;while(!this.s.pending&&!this.s.winners.length&&this.s.queue.length){check(++guard<500,'结算队列异常');this.execute(this.s.queue.shift());}}
 execute(t){const s=this.s,i=t.actor??s.active,p=this.p(i);switch(t.op){
 case 'legendPick':case 'legendEvents':this.request(t);break;
 case 'legendPublicWonder':{const excluded=new Set(s.players.flatMap(p=>p.wonders.map(w=>w.id)));s.legendWonderPool=this.shuffle(this.data.wonders.filter(w=>!excluded.has(w.id)).map(w=>w.id));this.legendRefill();break;}
 case 'legendRefill':this.legendRefill();break;
 case 'choice':if(t.options.length)this.request(t);break;
 case 'reward':if(t.any||t.amount.some(n=>n>0))this.request(t);break;
 case 'pay':{let c=t.cost.slice();if(t.loss)c=c.map((n,k)=>Math.min(n,this.totals(p.hand)[k]));check(this.afford(i,c,t.source==='deposit'?s.deposits[i]:p.hand),'资源不足');if(c.some(n=>n>0))this.request({...t,cost:c});break;}
 case 'rp':this.rp(i,t.n);break;
 case 'phase':s.phase=t.n;if(t.n===3)this.prepareDraw();if(t.n===5)s.turn.purchaseStarted=false;break;
 case 'start':{
   s.serial++;p.turn++;s.phase=1;s.turn={lockedEvents:p.events.length,purchases:0,ordinaryPurchases:0,eventUsed:false,eventBought:false,deposited:0,converts:{},darwin:false,dice:null,usedDice:[],usedPatents:[],modifier:null,steady:[],diceLocked:false,purchaseStarted:false,tradeOpen:false,skipped:p.skip>0};if(p.skip)p.skip--;
   this.log(p.name+'的第'+p.turn+'个回合');const effects=[];
   if(s.plague&&!s.plague.cured.includes(i)&&!this.has(i,'T4-11'))effects.push({op:'plagueCheck',actor:i});
   p.drugs.filter(d=>d.left>0).forEach(d=>effects.push({op:'drug',actor:i,key:d.key}));
   const w=this.wonder(i,'W15',true);if(w&&!w.done)effects.push({op:'project',actor:i});
   this.push({op:'startEffects',actor:i,effects});break;
 }
 case 'startEffects':if(t.effects.length>1)this.push(this.choices(i,'选择下一项回合开始效果',t.effects.map((x,j)=>({label:x.op==='drug'?'堕落社会':x.op==='plagueCheck'?'鼠疫判定':'知春创新中心',tasks:[x,{...t,effects:t.effects.filter((_,k)=>k!==j)}]}))));else if(t.effects.length)this.push(t.effects[0],{...t,effects:[]});else this.push(s.turn.skipped?{op:'cleanup',actor:i}:{op:'phase',n:2});break;
 case 'plagueCheck':{const d=this.dice(3,p.name+'的鼠疫解除判定',{actor:i}),ok=d.filter(x=>x===6).length>=2||(s.plague.initiator===i&&d.filter(x=>x===5).length>=2);this.rollEffect((s.plague.initiator===i?'解除条件：至少两个5或至少两个6。':'解除条件：至少两个6。')+(ok?'判定成功，只解除该玩家的鼠疫。':'判定失败，需失去1人力（不足按现有数量处理）。'));if(ok){s.plague.cured.push(i);this.log(p.name+'个人解除鼠疫');}else this.push(this.pay(i,[0,1,0],'鼠疫：失去1人力',{loss:true}));break;}
 case 'drug':{const d=p.drugs.find(x=>x.key===t.key);if(!d||d.left<=0)break;d.left--;const after=d.left===0?[this.pay(i,[0,6,0],'堕落社会最终清算',{loss:true})]:[];if(this.totals(p.hand)[1]>=2)this.push(this.pay(i,[0,2,0],'堕落社会：支付2人力'),this.reward(i,[5,0,0],'堕落社会：获得5金币'),...after);else{const cards=p.hand.filter(c=>c.type!==1);this.push({op:'selectCards',actor:i,title:'堕落社会：弃置2张其他资源牌（不足则全部）',cards:cards.map(c=>c.id),min:Math.min(2,cards.length),max:Math.min(2,cards.length),purpose:'discard'},...after);}break;}
 case 'project':{if(!this.wonder(i,'W15'))break;this.push(this.choices(i,'知春创新中心：支付2金币、2人力、2矿物推进项目？',[...(this.afford(i,[2,2,2])?[{label:'支付并推进',tasks:[this.pay(i,[2,2,2],'推进知春项目'),{op:'projectProgress',actor:i}]}]:[]),{label:'本次暂停，保留进度',tasks:[]}]));break;}
 case 'projectProgress':{const w=this.wonder(i,'W15');if(w){w.progress=(w.progress||0)+1;if(w.progress===3){w.done=true;this.rp(i,54);}}break;}
 case 'drawExtra':if(this.canDraw())this.request({op:'drawChoice',actor:i,title:t.title||'从混合牌堆额外抽取资源',left:t.n,extra:true});else this.log('混合资源牌堆与弃牌堆均耗尽，无法额外抽牌');break;
 case 'dicePenalty':{
   const d=s.turn.dice;if(this.has(i,'T1-12')&&!this.has(i,'T5-09')&&d.includes(5))this.push(this.choices(i,'四元素说：必须占用一枚5点骰',d.flatMap((n,j)=>n===5?[{label:'占用第'+(j+1)+'枚骰',tasks:[{op:'consumeDie',index:j}]}]:[])));
   const penalties=[];for(const id of ['T3-04','T4-03'])if(this.has(i,id)&&d.includes(1))penalties.push({op:'wrongPenalty',actor:i,id});
   if(this.has(i,'T4-09')&&d.filter(x=>x===1).length>=2)penalties.push({op:'nuclearRisk',actor:i});
   // All continuations are serializable, including nested penalty order choices.
   const insertion=s.queue[0]?.op==='choice'?1:0;s.queue.splice(insertion,0,{op:'penaltyOrder',actor:i,effects:penalties});break;
 }
 case 'penaltyOrder':if(t.effects.length>1)this.push(this.choices(i,'选择强制效果的结算顺序',t.effects.map((e,j)=>({label:e.id?this.card(e.id).name:'核能风险',tasks:[e,{...t,effects:t.effects.filter((_,k)=>k!==j)}]}))));else this.push(...t.effects);break;
 case 'wrongPenalty':this.rp(i,-4);this.push(this.pay(i,[0,0,2],this.card(t.id).name+'：失去2矿物',{loss:true}));break;
 case 'nuclearRisk':{const d=this.dice(1,'核能保护判定',{actor:i})[0];this.rollEffect(d<=2?'1～2点：发生核能事故，失去全部人力。':'3～6点：保护成功，不发生核能事故。');if(d<=2)this.push(this.pay(i,[0,this.totals(p.hand)[1],0],'核能事故：失去全部人力',{loss:true}));break;}
 case 'consumeDie':{const r=(s.rolls||[]).find(r=>r.id===s.turn.rollId);if(r)(r.resolutions??=[]).push({label:'四元素说：强制占用第'+(t.index+1)+'枚5点骰，无收益。'});}s.turn.usedDice.push(t.index);s.turn.usedPatents.push('T1-12');this.patentReport();break;
 case 'purchase':this.purchaseCommit(t);break;
 case 'acquire':this.acquire(t);break;
 case 'acquireEnd':if(t.refill!==false)this.refill();this.eraCheck();break;
 case 'eventDraw':if(s.eventDeck.length){const id=s.eventDeck.shift();this.log(p.name+'取得一张'+(t.free?'免费':'购买的')+'事件牌');this.push({op:'eventOffer',actor:i,event:id});}else this.log('事件牌堆已耗尽');break;
 case 'eventOffer':{const options=[];if(this.eventLegal(i,t.event))options.push({label:'立即使用',tasks:[{op:'event',actor:i,event:t.event}]});if(p.events.length<this.rules().eventDisplayLimit)options.push({label:s.legend?'明置保留（本模式不减少抽牌）':'明置保留（从下回合起少抽2张）',tasks:[{op:'eventDisplay',actor:i,event:t.event}]});if(!options.length){s.eventDiscard.push(t.event);this.log(p.name+'新事件无法合法使用且明置已满，弃置（不退款）');}else this.push(this.choices(i,'新事件：'+this.card(t.event).name,options,{revealCard:t.event}));break;}
 case 'eventDisplay':p.events.push(t.event);this.log(p.name+'明置了'+this.card(t.event).name);break;
 case 'event':this.runEvent(i,t.event);break;
 case 'discardPatent':p.tech=p.tech.filter(id=>id!==t.id);if(t.id==='T5-11')s.players.forEach(q=>q.drugs=q.drugs.filter(d=>d.card!==t.id));this.log(p.name+'弃置专利'+this.card(t.id).name);break;
 case 'plague':s.plague={initiator:i,cured:[]};break;
 case 'bubble':p.bubbles.push(p.turn);break;
 case 'wall':p.wall.push(...p.hand.filter(c=>c.type===1));p.hand=p.hand.filter(c=>c.type!==1);this.log(p.name+'暂存全部人力至下一时代');break;
 case 'satellite':this.request({op:'privateView',actor:i,title:'卫星：仅供你查看的其他玩家手牌'});break;
 case 'versailles':{const d=this.dice(2,'凡尔赛条约判定',{actor:i}),a=d[0]+(t.plus===t.a?1:0),b=d[1]+(t.plus===t.b?1:0);this.rollEffect(this.p(t.a).name+'：原始'+d[0]+(t.plus===t.a?' + 1':'')+' = '+a+'；'+this.p(t.b).name+'：原始'+d[1]+(t.plus===t.b?' + 1':'')+' = '+b+'。'+(a===b?'平局，无人跳过回合。':this.p(a<b?t.a:t.b).name+'下个回合跳过步骤2至8。'));if(a!==b){const j=a<b?t.a:t.b;this.p(j).skip++;this.log(this.p(j).name+'跳过下一自身回合的步骤2至8');}else this.log('凡尔赛条约加值后平局');break;}
 case 'destroy':{const w=p.wonders.shift();this.log(p.name+'最早建成的'+this.card(w.id).name+'被摧毁，持续能力终止');break;}
 case 'tradeOpen':s.turn.tradeOpen=true;this.log('本回合允许'+p.name+'与其他玩家自愿交换资源牌');break;
 case 'zheng':{const order=Array.from({length:s.players.length},(_,k)=>(i+k)%s.players.length);this.push(...order.map(j=>({op:'zhengInvite',actor:j,initiator:i})));break;}
 case 'zhengInvite':this.push(this.choices(i,'郑和下西洋：是否参与一次交易？',[...((i===t.initiator||p.hand.length)?[{label:i===t.initiator?'发起一次交易':'支付1点任意资源并参与',tasks:i===t.initiator?[{op:'tradePick',actor:i,once:true}]:[{op:'tribute',actor:i,initiator:t.initiator}]}]:[]),{label:'不参与',tasks:[]}]));break;
 case 'tribute':this.push(this.choices(i,'选择上交的1点资源',RES.flatMap((n,k)=>this.totals(p.hand)[k]?[{label:n+'1点',tasks:[this.pay(i,vec().map((_,j)=>j===k?1:0),'郑和参与费用'),this.reward(t.initiator,vec().map((_,j)=>j===k?1:0),'收到郑和参与费用'),{op:'tradePick',actor:i,once:true}]}]:[])));break;
 case 'tradePick':this.push(this.choices(i,'选择交易对象',[...s.players.flatMap((q,j)=>j!==i?[{label:q.name,tasks:[{op:'tradeOffer',actor:i,other:j,once:!!t.once}]}]:[]),{label:'放弃本次交易',tasks:[]}]));break;
 case 'tradeOffer':this.request({...t,title:'选择你愿意交出的资源牌（可为零张）'});break;
 case 'tradeReturn':this.request({...t,title:'选择你愿意换出的资源牌，或拒绝交易'});break;
 case 'tradeConfirm':this.request({...t,title:'确认双方完整交换内容；确认后同时转移'});break;
 case 'buildDone':this.buildDone(t);break;
 case 'selectCards':if(t.max===0)this.selectCards(t,[]);else this.request(t);break;
 case 'fast':{const ids=s.shop.filter(id=>this.card(id).kind!=='final'&&!p.tech.includes(id)),n=Math.min(2,ids.length);if(!n){s.fast={actor:i,remaining:40};this.push({op:'rp',actor:i,n:36},{op:'fastEnd'});}else this.request({op:'fastPick',actor:i,title:'FAST：从当前商店选择'+n+'张科技（选完后才补位）',cards:ids,min:n,max:n});break;}
 case 'fastEnd':s.fast=null;this.refill();this.eraCheck();break;
 case 'gene':{const other=(i+1)%s.players.length,a=p.tech.filter(id=>this.geneEligible(id)),b=this.p(other).tech.filter(id=>this.geneEligible(id));if(a.length&&b.length)this.request({op:'genePick',actor:i,other,title:'基因组：指定对方1至2张候选专利，并选择自己交出的1张',own:a,candidates:b});break;}
 case 'geneChoose':this.push(this.choices(i,'基因组交换：选择交出的专利',t.candidates.map(id=>({label:this.card(id).name,tasks:[{op:'geneSwap',actor:t.builder,other:i,own:t.own,theirs:id}]}))));break;
 case 'geneSwap':{const q=this.p(t.other);p.tech[p.tech.indexOf(t.own)]=t.theirs;q.tech[q.tech.indexOf(t.theirs)]=t.own;this.log(p.name+'与'+q.name+'交换专利；不重复科研及立即奖励');break;}
 case 'cleanup':{s.phase=10;const n=p.hand.length-this.cap(i);if(n>0)this.push({op:'selectCards',actor:i,title:'整理手牌：弃置'+n+'张至上限'+this.cap(i),cards:p.hand.map(c=>c.id),min:n,max:n,purpose:'discard'},{op:'end'});else this.push({op:'end'});break;}
 case 'end':s.active=(s.active+1)%s.players.length;this.push({op:'start'});break;
 default:throw Error('未知结算 '+t.op);
 }}
 prepareDraw(){const s=this.s,p=this.p(),i=s.active,no=p.bubbles.some(turn=>p.turn===turn+2),bonus=p.bubbles.filter(turn=>p.turn===turn+1).length*2,w=this.wonder(i,'W03',true);p.bubbles=p.bubbles.filter(turn=>p.turn<=turn+2);let n=no?0:Math.max(0,this.rules().drawPerEra[s.era-1]+bonus+(this.has(i,'T5-02')?1:0)+(w&&w.draws>0?1:0)-(this.has(i,'T5-09')?2:0)-(s.legend?0:2*s.turn.lockedEvents));s.turn.drawLeft=n;s.turn.gardenDraw=!!(n&&w&&w.draws>0&&!no);if(n&&this.canDraw())this.request({op:'drawChoice',actor:i,title:'从混合资源牌堆抽牌',left:n});}
 geneEligible(id){const c=this.card(id);return c.kind==='patent'&&!c.gate&&!c.wrong;}
 techAvailable(i,id,old=false){const c=this.card(id);return c.kind!=='final'&&!this.has(i,id)&&(this.s.shop.includes(id)||this.s.basics.includes(id)||(old&&c.kind==='basic'&&(this.s.learned[id]||[]).some(j=>j!==i)));}
 research(i,id){const c=this.card(id);return c.research[c.kind==='basic'?Math.min(3,(this.s.learned[id]||[]).length):0]||0;}
 cost(i,id,{extraDiscount=[0,0,0],algebra=false}={}){const c=this.card(id),v=c.cost.slice(),off=vec(),t=this.s.turn||{purchases:0};
   if(this.has(i,'T1-01')&&['T1-04','T1-09'].includes(id)){off[0]++;off[2]++;}
   if(this.has(i,'T1-02')&&['T1-03','T1-09'].includes(id)){off[0]++;off[2]++;}
   if(id==='T2-09'&&this.has(i,'T2-05'))v[1]+=3;
   if(id==='T2-10'&&this.has(i,'T2-11'))off[1]+=4;
   if(this.has(i,'T3-05')&&['T3-06','T3-08'].includes(id))off[2]+=4;
   if((t.ordinaryPurchases||0)===0)for(const [w,k] of [['W04',1],['W05',2],['W06',0]])if(this.wonder(i,w,true))off[k]+=2;
   if(algebra){off[0]++;off[1]++;}
   return v.map((n,k)=>c.cost[k]?Math.max(1,n-off[k]-(extraDiscount[k]||0)):0);
 }
 finalFee(i,id,n){const c=this.card(id),count=this.p(i).tech.filter(x=>this.card(x).kind==='patent'&&this.card(x).category===c.category).length;return Math.max(8,this.rules().finalDiePrice*n-Math.min(12,count*(c.category==='科学理论'?1:2)));}
 purchaseCommit(t){const s=this.s,i=t.actor;let cost=this.cost(i,t.card,{extraDiscount:t.discount});if(this.has(i,'T2-04')){const d=this.dice(1,'代数学购买折扣判定',{actor:i})[0];if(d===6)cost=this.cost(i,t.card,{extraDiscount:t.discount,algebra:true});this.rollEffect((d===6?'6点触发金币、人力各减1，各原有费用最低1。':'非6点，不触发额外折扣。')+'购买'+this.card(t.card).name+'实际费用：'+cost.map((n,k)=>n+RES[k]).join('、')+'。');}this.log(this.p(i).name+'锁定购买'+this.card(t.card).name+'，等待完成支付');s.turn.purchases++;s.turn.ordinaryPurchases=(s.turn.ordinaryPurchases||0)+1;s.turn.purchaseStarted=true;if(t.extra)this.wonder(i,'W10').uses++;this.push(this.pay(i,cost,'购买'+this.card(t.card).name),{op:'acquire',actor:i,card:t.card,bought:true});}
 acquire(t){const s=this.s,i=t.actor,p=this.p(i),c=this.card(t.card);check(this.techAvailable(i,c.id,!!t.old)||(t.fastSelected&&s.fast?.actor===i&&s.fast.reserved.includes(c.id)&&!this.has(i,c.id)),'该科技已持有或不在可取得区域');if(t.fastSelected)s.fast.reserved=s.fast.reserved.filter(id=>id!==c.id);const rp=this.research(i,c.id);p.tech.push(c.id);if(c.kind==='basic'){(s.learned[c.id]??=[]).push(i);if((s.legend||c.era===s.era)&&!s.basics.includes(c.id))s.basics.push(c.id);}s.shop=s.shop.filter(id=>id!==c.id);if(t.refill!==false)this.refill();if(c.gate&&c.era===s.era)s.gate=true;this.log(p.name+(t.bought?'购买':'取得')+c.name);this.rp(i,rp);if(s.winners.length)return;
   const tasks=[];const imm={ 'T1-03':[0,4,0],'T1-05':[4,0,0],'T1-12':[0,0,12],'T2-05':[6,0,6],'T3-04':[0,0,20],'T4-01':[0,0,8],'T4-03':[26,0,0],'T4-11':[0,4,0]};
   if(imm[c.id])tasks.push(this.reward(i,imm[c.id],c.name+'立即奖励'));
   if(c.id==='T1-08'){const d=this.dice(1,'天文观测判定',{actor:i})[0];this.rollEffect(d>=4?'4～6点：获得6金币，接下来选择奖励面额。':'1～3点：不获得额外奖励。');if(d>=4)tasks.push(this.reward(i,[6,0,0],'天文观测奖励'));}
   if(['T2-09','T4-02'].includes(c.id))tasks.push({op:'eventDraw',actor:i,free:true});
   if(c.id==='T2-11'&&this.has(i,'T2-10'))tasks.push(this.reward(i,[0,4,0],'机械钟：已拥有伽利略运动学'));
   if(c.id==='T3-08')tasks.push({op:'drawExtra',actor:i,n:1,title:'机械化工业：立即抽1张资源'});
   if(c.id==='T4-05'){const others=s.players.map((_,j)=>j).filter(j=>j!==i),j=others[this.rand(others.length)],h=this.p(j).hand;for(let k=0;k<2&&h.length;k++)p.hand.push(h.splice(this.rand(h.length),1)[0]);this.log(p.name+'通过航空从'+this.p(j).name+'随机取得最多2张资源牌');}
   if(c.id==='T5-05')for(let k=0;k<s.players.length;k++)tasks.push(this.reward((i+k)%s.players.length,null,'互联网：自选5点资源',{any:5}));
   if(c.id==='T5-11')p.drugs.push({key:++s.uid,card:c.id,left:3});
   const tower=this.wonder(i,'W09');if(t.bought&&c.kind==='patent'&&tower&&(tower.builtEra??tower.era)===s.era&&tower.count<4){tower.count++;tasks.push({op:'rp',actor:i,n:tower.era===3?3:4});}
   tasks.push({op:'acquireEnd',refill:t.refill});this.push(...tasks);
 }
 eventLegal(i,id){if(id==='E01')return this.s.shop.some(x=>this.techAvailable(i,x));if(id==='E14')return this.data.tech.some(c=>c.kind==='basic'&&!this.has(i,c.id)&&(this.s.learned[c.id]||[]).some(j=>j!==i));return true;}
 runEvent(i,id){const s=this.s,p=this.p(i);check(this.eventLegal(i,id),'没有合法目标');this.log(p.name+'使用'+this.card(id).name);s.eventDiscard.push(id);let tasks=[];
   switch(id){
   case 'E01':tasks=[this.choices(i,'尤里卡：选择商店中的非最终科技',s.shop.filter(x=>this.techAvailable(i,x)).map(card=>({label:this.card(card).name,tasks:[{op:'acquire',actor:i,card}]})))];break;
   case 'E02':tasks=[this.reward(i,[6,0,2],'都江堰奖励'),this.pay(i,[0,3,0],'都江堰失去3人力',{loss:true})];break;
   case 'E03':{tasks=[this.reward(i,[5,0,0],'统一度量衡奖励')];const d=this.dice(1,'统一度量衡判定',{actor:i})[0];this.rollEffect('获得5金币；'+(d===1?'1点额外触发失去2人力（不足按现有数量处理）。':'非1点，不失去人力。'));if(d===1)tasks.push(this.pay(i,[0,2,0],'失去2人力',{loss:true}));break;}
   case 'E04':tasks=[{op:'tradeOpen',actor:i}];break;
   case 'E05':tasks=[this.reward(i,[4,0,2],'盐铁之议奖励')];break;
   case 'E06':tasks=[{op:'plague',actor:i}];break;
   case 'E07':tasks=[{op:'zheng',actor:i}];break;
   case 'E08':{const opts=[];for(let a=0;a<s.players.length;a++)for(let b=a+1;b<s.players.length;b++)for(const plus of [a,b])opts.push({label:this.p(a).name+' 对 '+this.p(b).name+'；'+this.p(plus).name+' +1',tasks:[{op:'versailles',a,b,plus}]});tasks=[this.choices(i,'凡尔赛：先指定双方与加1对象，再掷骰',opts)];break;}
   case 'E09':{const opts=s.players.flatMap((q,j)=>q.wonders.length>=2?[{label:q.name+'：摧毁'+this.card(q.wonders[0].id).name,tasks:[{op:'destroy',actor:j}]}]:[]);if(opts.length)tasks=[this.choices(i,'火烧大图书馆：选择目标',opts)];break;}
   case 'E10':tasks=[{op:'bubble',actor:i}];break;
   case 'E11':tasks=[{op:'wall',actor:i}];break;
   case 'E12':tasks=[this.choices(i,'文艺复兴',[{label:'获得5科研点',tasks:[{op:'rp',actor:i,n:5}]},...p.tech.filter(x=>this.card(x).kind==='patent').map(id=>({label:'弃置'+this.card(id).name,tasks:[{op:'discardPatent',actor:i,id}]}))])];break;
   case 'E13':tasks=[{op:'satellite',actor:i}];break;
   case 'E14':tasks=[this.choices(i,'月光社：学习他人已掌握的基础科技',this.data.tech.filter(c=>c.kind==='basic'&&!this.has(i,c.id)&&(s.learned[c.id]||[]).some(j=>j!==i)).map(c=>({label:c.name+'（'+this.research(i,c.id)+'科研）',tasks:[{op:'acquire',actor:i,card:c.id,old:true}]})))];break;
   }this.push(...tasks);
 }
 buildDone(t){const s=this.s,i=t.actor,p=this.p(i),id=t.wonder,e=this.wonderEra(id);const w={id,era:e,...(s.legend?{builtEra:s.era}:{}),turn:p.turn,uses:0,count:0,draws:id==='W03'?(e===1?3:4):0,progress:0,done:false};p.wonders.push(w);s.currentWonder=null;this.log(p.name+'建成'+this.card(id).name);const tasks=[],refunds=[];
   // Losing players make private refund choices, clockwise from builder.
   for(let k=1;k<s.players.length;k++){const j=(i+k)%s.players.length,h=s.deposits[j];if(h.length)refunds.push({op:'selectCards',actor:j,title:'奇观落成：取回至多2张投入牌，其余弃置',cards:h.map(c=>c.id),min:0,max:Math.min(2,h.length),purpose:'refund'});}
   const base={W01:[6,10],W02:[6,10],W03:[6,10],W04:[6,10],W05:[6,10],W06:[6,10],W07:[16,24],W08:[6,10],W09:[18,26],W10:[14,20],W11:[8,12],W12:[8,12],W13:[34,34],W15:[12,12]};
   if(base[id])tasks.unshift({op:'rp',actor:i,n:base[id][(e===2||e===4)?1:0]});
   if(id==='W08')tasks.push(this.reward(i,[e===3?32:42,0,0],'苏伊士运河奖励'));
   if(id==='W11')tasks.push(this.reward(i,[Math.min(e===3?36:46,12+this.totals(p.hand)[0]),0,0],'青藏铁路奖励'));
   if(id==='W12')tasks.push(this.reward(i,[0,0,Math.min(e===3?36:46,12+this.totals(p.hand)[1])],'大庆油田奖励'));
   if(id==='W13')tasks.push({op:'gene',actor:i});if(id==='W14')tasks.push({op:'fast',actor:i});this.push(...tasks,...refunds,...(s.legend?[{op:'legendRefill'}]:[]));
 }
 selectCards(q,ids){const p=this.p(q.actor);check(Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.length>=q.min&&ids.length<=q.max&&ids.every(id=>q.cards.includes(id)),'所选牌张数或目标不合法');if(q.purpose==='refund'){const all=this.s.deposits[q.actor];p.hand.push(...all.filter(c=>ids.includes(c.id)).map(c=>{delete c.hidden;return c;}));this.recycle(all.filter(c=>!ids.includes(c.id)));this.s.deposits[q.actor]=[];this.log(p.name+'取回'+ids.length+'张投入牌，其余弃置');}else{const cards=p.hand.filter(c=>ids.includes(c.id));p.hand=p.hand.filter(c=>!ids.includes(c.id));this.recycle(cards);this.log(p.name+'弃置'+ids.length+'张资源牌');}}
 validateGroups(groups,amount,any=0,single=false){check(Array.isArray(groups)&&groups.length===3&&groups.every(a=>Array.isArray(a)&&a.length<=1000&&a.every(n=>DEN.includes(n))),'面额仅可为1、2、5、10');const v=groups.map(sum);check(any?sum(v)===any:v.every((n,k)=>n===amount[k]),'所选资源面额合计不正确');if(single)check(v.filter(n=>n>0).length===1,'此奖励请选择一种资源');}
 answer(actor,a){const s=this.s,q=s.pending;check(q&&q.actor===actor&&a.id===q.id,'请由指定玩家完成当前选择；重复确认无效');s.pending=null;const p=this.p(actor);
   switch(q.op){
   case 'legendPick':{check(s.legend&&q.cards.includes(a.card)&&p.wonders.length===0,'请选择当前提供的一个奇观buff');p.wonders.push({id:a.card,era:this.wonderEra(a.card),builtEra:5,buff:true,turn:0,uses:0,count:0,draws:a.card==='W03'?4:0,progress:0,done:false});this.log(p.name+'选择开局奇观buff：'+this.card(a.card).name+'（不发建成奖励）');break;}
   case 'legendEvents':check(a.confirm===true,'请确认初始事件');this.log(p.name+'确认初始明置事件：'+p.events.map(id=>this.card(id).name).join('、'));break;
   case 'choice':check(whole(a.index,0,q.options.length-1),'请选择合法选项');this.push(...q.options[a.index].tasks);break;
   case 'reward':this.validateGroups(a.groups,q.amount,q.any,q.single);this.give(actor,a.groups);this.log(p.name+'领取资源奖励（面额保密）');break;
   case 'pay':{const source=q.source==='deposit'?s.deposits[actor]:p.hand,ids=a.cards;check(Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.every(id=>source.some(c=>c.id===id)),'请选择自己可支付的牌');const cards=source.filter(c=>ids.includes(c.id)),v=this.totals(cards);check(v.every((n,k)=>n>=q.cost[k]&&(q.cost[k]>0||n===0)),'所选牌不足，或支付了不需要的资源类型');const change=v.map((n,k)=>n-q.cost[k]);this.validateGroups(a.groups,change);if(q.source==='deposit'){this.recycle(source);s.deposits[actor]=[];const unspent=source.filter(c=>!ids.includes(c.id)); // All deposited cards are exposed and paid; include all in build payments.
       check(!unspent.length,'建成奇观时须交出自己的全部投入牌并找零');
     }else{p.hand=p.hand.filter(c=>!ids.includes(c.id));this.recycle(cards);}this.give(actor,a.groups);this.log(p.name+'支付'+q.cost.map((n,k)=>n?RES[k]+n:'').filter(Boolean).join('、'));break;}
   case 'drawChoice':{check(a.type===undefined,'混合资源抽牌不能指定资源类型');check(this.draw(actor),'混合资源牌堆与弃牌堆均为空');q.left--;this.log(p.name+'从混合资源牌堆抽取1张牌（类型与面额保密）');if(!q.extra){s.turn.drawLeft=q.left;if(s.turn.gardenDraw&&q.left===0){const w=this.wonder(actor,'W03');if(w)w.draws--;s.turn.gardenDraw=false;}}if(q.left>0){if(this.canDraw())this.request({...q,id:undefined});else this.log('混合资源牌堆与弃牌堆均耗尽，本次剩余抽牌无法执行');}break;}
   case 'selectCards':this.selectCards(q,a.cards);break;
   case 'privateView':check(a.confirm===true,'请确认关闭私人查看');break;
   case 'fastPick':{check(Array.isArray(a.cards)&&new Set(a.cards).size===a.cards.length&&a.cards.length===q.min&&a.cards.every(id=>q.cards.includes(id)),'请选够FAST科技');s.fast={actor,remaining:40,reserved:a.cards.slice()};s.shop=s.shop.filter(id=>!a.cards.includes(id));this.push(...a.cards.map(card=>({op:'acquire',actor,card,refill:false,fastSelected:true})),...(a.cards.length<2?[{op:'rp',actor,n:18*(2-a.cards.length)}]:[]),{op:'fastEnd'});break;}
   case 'genePick':{if(a.skip===true){this.log(p.name+'选择不进行基因组专利交换');break;}check(q.own.includes(a.own)&&Array.isArray(a.cards)&&a.cards.length>=1&&a.cards.length<=2&&new Set(a.cards).size===a.cards.length&&a.cards.every(id=>q.candidates.includes(id)),'请选择合法的交换专利');this.push({op:'geneChoose',actor:q.other,builder:actor,own:a.own,candidates:a.cards});break;}
   case 'tradeOffer':{this.validateHandIds(actor,a.cards);this.push({op:'tradeReturn',actor:q.other,other:actor,offered:a.cards,once:q.once});break;}
   case 'tradeReturn':{if(a.reject){this.log('对方拒绝本次交易');break;}this.validateHandIds(actor,a.cards);this.push({op:'tradeConfirm',actor:q.other,other:actor,offered:q.offered,returned:a.cards});break;}
   case 'tradeConfirm':if(a.confirm){this.validateHandIds(actor,q.offered);this.validateHandIds(q.other,q.returned);const h=p.hand,other=this.p(q.other),b=other.hand;p.hand=[...h.filter(c=>!q.offered.includes(c.id)),...b.filter(c=>q.returned.includes(c.id))];other.hand=[...b.filter(c=>!q.returned.includes(c.id)),...h.filter(c=>q.offered.includes(c.id))];this.log(p.name+'与'+other.name+'完成一笔自愿交易');}else this.log('交易发起人取消交易');break;
   default:throw Error('不支持的选择');
   }
 }
 validateHandIds(i,ids){check(Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.every(id=>this.p(i).hand.some(c=>c.id===id)),'只能选择自己的资源手牌');}
 command(actor,type,a={}){check(this.s,'尚未开始');const old=clone(this.s);try{const s=this.s;check(!s.winners.length,'本局已经结束');if(type==='answer'){this.answer(actor,a);}else{check(!s.pending&&!s.queue.length,'请先完成当前结算');check(actor===s.active,'现在不是你的回合');const p=this.p(actor),t=s.turn;
   switch(type){
   case 'next':{check([2,3,4,5,6,7,8,9].includes(s.phase),'当前阶段不能继续');if(s.phase===3)check(!t.drawLeft||!this.canDraw(),'请先抽完资源');if(s.phase===4){check(t.dice&&t.diceLocked,'请先投骰并确认最终骰面');const r=(s.rolls||[]).find(r=>r.id===t.rollId);if(r)r.closed=true;}if(s.phase===9)this.push({op:'cleanup',actor});else this.push({op:'phase',n:s.phase+1});break;}
   case 'roll':{check(s.phase===4&&!t.dice,'此阶段已经投骰或不能投骰');const base=this.rules().patentDice,n=a.count??(base+(this.has(actor,'T4-06')?1:0));check(n===base||(n===base+1&&this.has(actor,'T4-06')),'专利骰数量应为基础数量，内燃机可额外增加1枚');t.dice=this.dice(n,p.name+'专利骰',{kind:'patent',actor});t.rollId=s.lastRoll?.id;this.patentReport();break;}
   case 'reroll':{check(s.phase===4&&t.dice&&!t.diceLocked&&!t.modifier&&this.wonder(actor,'W01',true),'不能使用金字塔');const ids=a.dice;check(Array.isArray(ids)&&ids.length>=1&&ids.length<=2&&new Set(ids).size===ids.length&&ids.every(j=>whole(j,0,t.dice.length-1)),'选择1至2枚骰');const values=this.dice(ids.length,'金字塔重投',{kind:'reroll',actor});ids.forEach((j,k)=>t.dice[j]=values[k]);t.modifier='W01';this.rollEffect(ids.map((j,k)=>'第'+(j+1)+'枚骰改投为'+values[k]).join('、')+'；本回合金字塔/巨石阵共享改骰次数已使用，确认最终骰面后结算。');this.patentReport();break;}
   case 'shift':check(s.phase===4&&t.dice&&!t.diceLocked&&!t.modifier&&this.wonder(actor,'W02',true),'不能使用巨石阵');check(whole(a.index,0,t.dice.length-1)&&[-1,1].includes(a.delta)&&whole(t.dice[a.index]+a.delta,1,6),'修改后必须为1至6');t.dice[a.index]+=a.delta;t.modifier='W02';this.log('巨石阵修改专利骰：第'+(a.index+1)+'枚变为'+t.dice[a.index]);this.patentReport();break;
   case 'steady':check(s.phase===4&&t.dice&&!t.diceLocked&&this.has(actor,'T5-09'),'不能使用稳态宇宙论');check(whole(a.index,0,t.dice.length-1)&&t.dice[a.index]<=3&&!t.steady.includes(a.index),'该骰不能转换');t.dice[a.index]=7-t.dice[a.index];t.steady.push(a.index);this.log('稳态宇宙论转换专利骰：第'+(a.index+1)+'枚变为'+t.dice[a.index]);this.patentReport();break;
   case 'lockDice':check(s.phase===4&&t.dice&&!t.diceLocked,'骰面已确认或尚未投骰');t.diceLocked=true;this.log('最终专利骰面：'+t.dice.join('、'));this.patentReport();this.push({op:'dicePenalty',actor});break;
   case 'patent':{check(s.phase===4&&t.diceLocked&&this.has(actor,a.card)&&!t.usedPatents.includes(a.card),'专利不能再次结算');const ef=PATENTS[a.card]?.[a.effect];check(ef,'该词条不是骰子收益');const ds=a.dice;check(Array.isArray(ds)&&new Set(ds).size===ds.length&&ds.length===(ef[3]||1)&&ds.every(j=>whole(j,0,t.dice.length-1)&&!t.usedDice.includes(j)&&t.dice[j]===ef[0]),'骰子必须匹配且只能使用一次');t.usedDice.push(...ds);t.usedPatents.push(a.card);const report=(s.rolls||[]).find(r=>r.id===t.rollId);if(report)(report.resolutions??=[]).push({card:a.card,effect:a.effect,dice:ds.slice(),label:this.card(a.card).name+'：使用第'+ds.map(j=>j+1).join('、')+'枚骰，结算'+[...(ef[2]?[ef[2]+'科研']:[]),...ef[1].flatMap((n,k)=>n?[n+RES[k]]:[])].join('、')});this.patentReport();this.log(p.name+'结算'+this.card(a.card).name);this.push({op:'rp',actor,n:ef[2]},this.reward(actor,ef[1],this.card(a.card).name+'收益'));break;}
   case 'buy':{check(s.phase===5&&this.techAvailable(actor,a.card),'当前不能购买这张科技');const {normal,extra}=this.purchaseSlot(actor),w=this.wonder(actor,'W10');check(normal||extra,'本回合购买名额已用完');const discount=a.discount||vec();check(Array.isArray(discount)&&discount.length===3&&discount.every(n=>whole(n,0,3)),'折扣分配不正确');if(extra){check(sum(discount)<= (w.era===3?2:3)&&discount.every((n,k)=>!n||this.card(a.card).cost[k]>0),'ENIAC折扣不合法');}else check(sum(discount)===0,'普通购买无ENIAC折扣');check(this.afford(actor,this.cost(actor,a.card,{extraDiscount:discount})),'须先足额支付确定性折扣后的费用，才可进行代数学判定');this.push({op:'purchase',actor,card:a.card,discount,extra});break;}
   case 'final':{check(s.phase===5&&this.purchaseSlot(actor).normal&&s.shop.includes(a.card)&&this.card(a.card).kind==='final','最终挑战不可占用额外购买名额');check(whole(a.count,3,8),'最终挑战需3至8枚骰');const fee=this.finalFee(actor,a.card,a.count);check(p.rp>=fee,'科研点不足');p.rp-=fee;t.purchases++;t.purchaseStarted=true;const d=this.dice(a.count,p.name+'挑战'+this.card(a.card).name,{kind:'final',actor});this.rollEffect('已支付'+fee+'科研点。'+([1,2,3].some(n=>d.filter(x=>x===n).length>=3)?'至少三个1、三个2或三个3，挑战成功并取得胜利。':'未满足至少三个1、三个2或三个3，挑战失败；科研不退，最终科技留在商店。'));this.log('本次挑战花费'+fee+'科研点');if([1,2,3].some(n=>d.filter(x=>x===n).length>=3))this.win([actor],'最终科技胜利：'+this.card(a.card).name);else this.log('挑战失败，最终科技留在商店');break;}
   case 'palace':{const w=this.wonder(actor,'W07');check(s.phase===5&&!t.purchaseStarted&&w&&w.uses<2,'紫禁城仅在购买阶段开始时可用，每时代2次');const ids=a.cards;check(Array.isArray(ids)&&ids.length>=1&&ids.length<=2&&new Set(ids).size===ids.length&&ids.every(id=>s.shop.includes(id)&&this.card(id).kind==='patent'&&!this.card(id).gate),'请选择1至2张非门槛专利');s.shop=s.shop.filter(id=>!ids.includes(id));s.techDeck.push(...ids);w.uses++;this.refill();this.log(p.name+'使用紫禁城更换商店专利');break;}
   case 'deposit':{check(s.phase===6&&s.currentWonder,'当前没有可投入的奇观');this.validateHandIds(actor,a.cards);check(a.cards.length>0&&t.deposited+a.cards.length<=(this.wonder(actor,'W03')?5:3),'超过本回合投入张数');check(Array.isArray(a.hidden)&&a.hidden.every(id=>a.cards.includes(id)),'暗置目标不合法');const cards=p.hand.filter(c=>a.cards.includes(c.id));p.hand=p.hand.filter(c=>!a.cards.includes(c.id));cards.forEach(c=>c.hidden=a.hidden.includes(c.id));s.deposits[actor].push(...cards);t.deposited+=cards.length;this.log(p.name+'投入'+cards.length+'张资源牌（'+cards.filter(c=>c.hidden).length+'张暗置）');break;}
   case 'build':{check(s.phase===6&&s.currentWonder&&t.deposited>=1,'本回合至少投入1张才能宣告建成');const id=s.currentWonder,cost=this.wonderCost(id);check(this.afford(actor,cost,s.deposits[actor]),'自己的三类投入尚未分别达到费用');this.push(this.pay(actor,cost,'建成'+this.card(id).name+'：全部投入找零',{source:'deposit'}),{op:'buildDone',actor,wonder:id});break;}
   case 'buyEvent':{check(s.phase===7&&!t.eventBought&&p.boughtEvents<this.rules().eventBuyLimit&&s.eventDeck.length,'不能再购买事件');const fee=this.eventPrice(actor);check(p.rp>=fee,'科研点不足');p.rp-=fee;p.boughtEvents++;t.eventBought=true;this.push({op:'eventDraw',actor,free:false});break;}
   case 'useEvent':check(s.phase===2&&!t.eventUsed&&p.events.includes(a.card)&&this.eventLegal(actor,a.card),'事件不能在此时使用或没有合法目标');p.events=p.events.filter(id=>id!==a.card);t.eventUsed=true;this.push({op:'event',actor,event:a.card});break;
   case 'void':{check(s.phase===9,'虚空兑换仅在回合末');check(whole(a.from,0,2)&&whole(a.to,0,2)&&a.from!==a.to&&whole(a.count,1,1000),'兑换类型或数量不合法');let fee=a.count*this.ratio(actor);if(this.has(actor,'T4-04')&&!t.darwin){fee=Math.min(2,this.ratio(actor))+(a.count-1)*this.ratio(actor);t.darwin=true;}const cost=vec();cost[a.from]=fee;check(this.afford(actor,cost),'资源不足');const gain=vec();gain[a.to]=a.count;this.push(this.pay(actor,cost,'虚空兑换支付'),this.reward(actor,gain,'虚空兑换所得'));break;}
   case 'convert':{check(s.phase>=2&&s.phase<=9,'现在不是自主操作时点');const map={'T3-01':2,'T3-11':0,'T4-07':1},k=map[a.card];check(k!==undefined&&this.has(actor,a.card)&&(t.converts[a.card]||0)<3,'该卡转科研每回合最多3次');const cost=vec();cost[k]=2;check(this.afford(actor,cost),'资源不足');t.converts[a.card]=(t.converts[a.card]||0)+1;this.push(this.pay(actor,cost,'资源转科研'),{op:'rp',actor,n:1});break;}
   case 'trade':check(t.tradeOpen&&s.phase>=2&&s.phase<=9,'当前没有开放交易');this.push({op:'tradePick',actor});break;
   default:throw Error('不支持的操作');
   }}this.drain();this.s.revision++;this.validate();return this.view(actor);}catch(e){this.s=old;throw e;}}
 validate(){const s=this.s;if(s.legend){check(s.era===5&&!s.quick&&whole(s.wonderShown,0,3),'一战封神状态不合法');check(s.target===Math.floor(CONFIG.defaults().researchTargets[s.players.length-2]*.46),'一战封神目标不正确');}if(s.rules)CONFIG.normalize(s.rules,this.data,s.players.length);check(whole(s.era,1,5)&&whole(s.active,0,s.players.length-1),'存档时代或玩家不合法');check(s.version===2&&Array.isArray(s.resourceDeck)&&Array.isArray(s.resourceDiscard),'资源牌堆格式不正确');const ids=[];for(const p of s.players){check(whole(p.rp)&&whole(p.boughtEvents,0,this.rules().eventBuyLimit)&&p.events.length<=this.rules().eventDisplayLimit&&new Set(p.tech).size===p.tech.length,'玩家状态不合法');p.tech.forEach(id=>this.card(id));ids.push(...p.hand,...p.wall);}ids.push(...s.resourceDeck,...s.resourceDiscard);s.reserve.forEach(h=>ids.push(...h));s.deposits.forEach(h=>ids.push(...h));check(new Set(ids.map(c=>c.id)).size===ids.length,'资源牌重复');check(ids.every(c=>whole(c.type,0,2)&&DEN.includes(c.value)&&['draw','reserve'].includes(c.origin)),'资源牌数据不合法');}
 export(){return JSON.stringify({format:'科技史桌游存档',version:4,state:this.s});}
 static restore(data,text){const x=JSON.parse(text);check(x.format==='科技史桌游存档'&&[1,2,3,4].includes(x.version),'不支持的存档格式');const g=new HistoryGame(data,x.state);if(x.version<4&&g.s.rules?.finalDiePrice===undefined){const legacy=CONFIG.normalize(g.s.rules||{},data);g.s.experimental??=!CONFIG.isDefault(legacy);g.s.rules={...legacy,finalDiePrice:6};}if(x.version===1){g.combineResourceDecks();g.log('资源抽牌规则更新：剩余三类牌堆合并洗匀，后续从混合牌堆随机抽取');}g.validate();check(g.s.players.length>=2&&g.s.players.length<=4&&Array.isArray(g.s.queue),'存档结构不正确');return g;}
 view(actor=null){const s=this.s,q=s.pending;return {quick:!!s.quick,...(s.legend?{legend:true,wonderShown:s.wonderShown}:{}),experimental:s.experimental??!CONFIG.isDefault(this.rules()),rolls:clone(s.rolls||[]),historyId:s.historyId||null,rules:clone(this.rules()),era:s.era,active:s.active,starter:s.starter,phase:s.phase,target:s.target,serial:s.serial,revision:s.revision,shop:s.shop.slice(),basics:s.basics.slice(),remaining:s.techDeck.length+s.shop.length,gate:s.gate,currentWonder:s.currentWonder,players:s.players.map((p,i)=>({name:p.name,rp:p.rp,tech:p.tech.slice(),wonders:clone(p.wonders),events:p.events.slice(),boughtEvents:p.boughtEvents,turn:p.turn,skip:p.skip,handCount:p.hand.length,cap:this.cap(i),wallCount:p.wall.length,drugs:clone(p.drugs),bubbles:p.bubbles.slice(),...(i===actor?{hand:clone(p.hand),wall:clone(p.wall)}:{})})),deposits:s.deposits.map((h,i)=>h.map(c=>i===actor||!c.hidden?clone(c):{hidden:true})),resourceCount:s.resourceDeck.length,resourceDiscardCount:s.resourceDiscard.length,eventCount:s.eventDeck.length,plague:clone(s.plague),log:clone(s.log),winners:s.winners.slice(),reason:s.reason,lastRoll:clone(s.lastRoll),turn:clone(s.turn),pending:q?(q.actor===actor?this.promptView(q,actor):{actor:q.actor,title:'等待指定玩家完成私人选择',id:q.id}):null};}
 promptView(q,actor){const v=clone(q);delete v.options;if(q.options)v.options=q.options.map(o=>({label:o.label}));if(q.op==='privateView')v.hands=this.s.players.map((p,i)=>i===actor?null:{name:p.name,hand:clone(p.hand)});if(['tradeReturn','tradeConfirm'].includes(q.op)){v.offerCards=this.p(q.other).hand.filter(c=>(q.op==='tradeReturn'?q.offered:q.returned).includes(c.id)).map(clone);if(q.op==='tradeConfirm')v.ownCards=this.p(actor).hand.filter(c=>q.offered.includes(c.id)).map(clone);}return v;}
}
if(typeof module!=='undefined')module.exports={HistoryGame,PATENTS,RES,DEN,ERA};
