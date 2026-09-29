/* Lightweight test support: only public results and explicit experiment drafts. */
(function(root){
'use strict';
const labels={finalDiePrice:'最终挑战每骰科研',patentDice:'默认专利骰数量',techBuys:'科技购买名额',resourceModules:'资源模组数',handLimit:'手牌上限',voidRatio:'虚空兑换比例',eventBuyLimit:'事件购买上限',eventDisplayLimit:'明置事件上限'};
function differences(r,defaults,data){
 const rows=[],add=(label,value,base)=>{if(JSON.stringify(value)!==JSON.stringify(base))rows.push({label,value,base});};
 for(const key of Object.keys(labels))add(labels[key],r[key],defaults[key]);
 for(const key of ['drawPerEra','researchTargets','moduleCards','eventPrices','fixedWonders']){
  if(key==='eventPrices'){add('事件价格阶梯',r[key].join(' / '),defaults[key].join(' / '));continue;}
  r[key].forEach((value,i)=>{
   if(key==='moduleCards')value.forEach((n,j)=>add(['金币','人力','矿物'][i]+[1,2,5,10][j]+'点牌张数',n,defaults[key][i][j]));
   else if(key==='fixedWonders'){const name=id=>data.wonders.find(w=>w.id===id)?.name||'随机';add('时代 '+(i+1)+' 奇观',name(value),name(defaults[key][i]));}
   else add(key==='drawPerEra'?'时代 '+(i+1)+' 抽牌':(i+2)+'人科研目标',value,defaults[key][i]);
  });
 }
 return rows;
}
function observe(previous,view,startedAt=null,now=Date.now()){
 const start=Number.isFinite(startedAt)?startedAt:Date.parse(startedAt),next={startedAt:previous?.startedAt??(Number.isFinite(start)?start:null),endedAt:previous?.endedAt??null};
 if(view.winners.length&&!next.endedAt)next.endedAt=now;
 return next;
}
function summarize(view,metrics={},now=Date.now()){
 const eras=[];
 for(const entry of view.log||[]){let era=eras.find(x=>x.era===entry.era);if(!era){era={era:entry.era,firstTurn:entry.turn,lastTurn:entry.turn};eras.push(era);}era.lastTurn=Math.max(era.lastTurn,entry.turn);}
 return {finished:!!view.winners.length,durationMs:Number.isFinite(metrics.startedAt)?Math.max(0,(metrics.endedAt??now)-metrics.startedAt):null,totalTurns:view.serial,eras:eras.map(x=>({...x,turns:Math.max(0,x.lastTurn-Math.max(1,x.firstTurn)+1)})),players:view.players.map(p=>({name:p.name,turns:p.turn,research:p.rp,tech:p.tech.length,wonders:p.wonders.length})),winners:view.winners.map(i=>view.players[i].name),reason:view.reason||''};
}
function duration(ms){if(ms===null)return '未记录';const s=Math.floor(ms/1000);return Math.floor(s/3600)+'时 '+Math.floor(s%3600/60)+'分 '+s%60+'秒';}
const api={differences,observe,summarize,duration};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TabletopTesting=api;
})(typeof window==='undefined'?globalThis:window);
