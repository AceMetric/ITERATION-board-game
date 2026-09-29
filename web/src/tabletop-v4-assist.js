/* Client-side suggestions only; the shared engine validates every submission. */
(function(root){
  'use strict';
  function totals(cards){
    return cards.reduce((out,card)=>{
      if(Number.isInteger(card.type)&&card.type>=0&&card.type<3&&Number.isFinite(card.value))out[card.type]+=card.value;
      return out;
    },[0,0,0]);
  }
  function payment(cards,cost){
    const paid=totals(cards),missing=cost.map((n,i)=>Math.max(0,n-paid[i]));
    const unused=paid.map((n,i)=>cost[i]===0?n:0);
    return {paid,missing,unused,change:paid.map((n,i)=>Math.max(0,n-cost[i])),ready:!missing.some(Boolean)&&!unused.some(Boolean)};
  }
  function suggestPayment(cards,cost){
    const ids=[];
    for(let type=0;type<3;type++){
      if(!cost[type])continue;
      const options=cards.filter(c=>c.type===type),states=new Map([[0,[]]]);
      // Prefer the least overpayment, then the fewest physical cards.
      for(const card of options)for(const [value,path] of [...states]){
        const next=value+card.value;
        if(value>=cost[type])continue;
        if(!states.has(next)||states.get(next).length>path.length+1)states.set(next,[...path,card.id]);
      }
      const value=[...states.keys()].filter(n=>n>=cost[type]).sort((a,b)=>a-b)[0];
      ids.push(...(value===undefined?options.map(c=>c.id):states.get(value)));
    }
    return ids;
  }
  const api={totals,payment,suggestPayment};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.TabletopAssist=api;
})(typeof window==='undefined'?globalThis:window);
