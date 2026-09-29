/* Serializable, per-game rules. Missing settings in old saves mean official defaults. */
const GameConfig=(()=>{
 const defaults=()=>({finalDiePrice:14,patentDice:2,drawPerEra:[2,3,4,5,6],techBuys:1,resourceModules:0,moduleCards:[[12,5,2,1],[12,5,2,1],[12,5,2,1]],researchTargets:[220,160,125],handLimit:12,voidRatio:5,eventPrices:[5,10,15,20,25],eventBuyLimit:5,eventDisplayLimit:2,fixedWonders:[null,null,null,null,null]});
 const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
 const integer=(x,min,max,label)=>{requireValue(Number.isInteger(x)&&x>=min&&x<=max,label+'须为 '+min+'～'+max+' 的整数');return x;};
 function normalize(raw={},data,players=null){requireValue(raw&&typeof raw==='object'&&!Array.isArray(raw),'实验参数格式错误');const d=defaults(),c={};for(const k of Object.keys(d))c[k]=raw[k]===undefined?d[k]:JSON.parse(JSON.stringify(raw[k]));
  for(const [key,min,max,label]of [['finalDiePrice',1,5000,'每枚最终挑战骰价格'],['patentDice',1,12,'默认专利骰数量'],['techBuys',1,10,'每回合科技购买名额'],['resourceModules',0,10,'资源模组数'],['handLimit',0,100,'基础手牌上限'],['voidRatio',1,20,'基础虚空兑换比率'],['eventBuyLimit',0,14,'个人付费事件上限'],['eventDisplayLimit',0,14,'明置事件上限']])integer(c[key],min,max,label);
  const array=(a,length,min,max,label)=>{requireValue(Array.isArray(a)&&a.length===length,label+'数量错误');a.forEach(x=>integer(x,min,max,label));};
  array(c.drawPerEra,5,0,30,'各时代基础抽牌');array(c.researchTargets,3,1,5000,'科研胜利目标');requireValue(Array.isArray(c.moduleCards)&&c.moduleCards.length===3,'资源模组需要三种资源');c.moduleCards.forEach(row=>array(row,4,0,100,'每面额资源牌张数'));
  requireValue(Array.isArray(c.eventPrices)&&c.eventPrices.length>=1&&c.eventPrices.length<=14,'事件价格阶梯须填写1～14个价格');c.eventPrices.forEach(x=>integer(x,0,5000,'事件价格'));
  requireValue(Array.isArray(c.fixedWonders)&&c.fixedWonders.length===5,'每个时代需选择随机或固定奇观');const used=new Set();c.fixedWonders.forEach((id,i)=>{if(id===null)return;const w=data?.wonders.find(w=>w.id===id);requireValue(w&&w.eras.includes(i+1),'固定奇观不属于指定时代');requireValue(!used.has(id),'同一奇观不能在多个时代重复出现');used.add(id);});
  if(players!==null){integer(players,2,4,'玩家人数');const modules=c.resourceModules||(players===2?1:2);c.moduleCards.forEach((row,i)=>requireValue(row.reduce((a,b)=>a+b,0)*modules>=players*2,['金币','人力','矿物'][i]+'抽牌数量不足以每人发2张开局牌，请增加模组或牌数'));}
  return c;
 }
 const isDefault=c=>[defaults(),{...defaults(),finalDiePrice:8}].some(d=>JSON.stringify(c)===JSON.stringify(d));
 const legendRules=()=>({...defaults(),moduleCards:[[8,5,4,3],[8,5,4,3],[8,5,4,3]]});
 return {defaults,normalize,isDefault,legendRules};
})();
if(typeof module!=='undefined')module.exports=GameConfig;
