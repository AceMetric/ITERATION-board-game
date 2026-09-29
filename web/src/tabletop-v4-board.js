/* Independent state-driven tabletop preview. Rules and online commands stay authoritative. */
(() => {
  'use strict';
  const api=window.TableController;
  if(!api)return;
  const data=api.data;
  const assets=api.assets;
  const assist=window.TabletopAssist;
  const cards=new Map([...data.tech,...data.events,...data.wonders].map(card=>[card.id,card]));
  const resourceNames=['金币','人力','矿物'];
  const eras=['','I','II','III','IV','V'];
  const phases=['','回合开始','使用事件','抽取资源','专利骰','购买科技','建设奇观','购买事件','处理事件','回合整理'];
  let selectedTech=null;
  let selectedEvent=null;
  let handSorted=false;
  let rewardDraft=new Map();
  let selectedPay=new Set();
  let changeDraft=[[],[],[]];
  let changeKey='';
  let selectedDice=new Set();
  let selectedPending=new Set();
  let selectedPalace=new Set();
  let palaceMode=false;
  let depositDraft=new Map();
  let activeCard=null;
  let stateKey='';
  let root=null;
  let shownHand=new Set();
  let shownSeat='';
  let drawnHand=new Set();
  let shownRoll=0;
  let voidFrom=0,voidTo=1,voidCount=1,finalCount=3,discountDraft=[0,0,0];
  let paymentReceipt=null;
  let handPreview=null;
  let milestoneSnapshot=null;
  let milestoneQueue=[];
  let milestoneTimer=null;
  let milestoneOverlay=null;

  function clearMilestones(){
    clearTimeout(milestoneTimer);
    milestoneOverlay?.remove();
    milestoneOverlay=null;
    milestoneQueue=[];
    milestoneSnapshot=null;
  }
  window.clearTableMilestones=clearMilestones;

  function playMilestone(){
    if(milestoneOverlay||!milestoneQueue.length)return;
    const event=milestoneQueue.shift();
    const overlay=el('div','v4-milestone v4-milestone-'+event.kind);
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    overlay.append(el('div','v4-milestone-halo'));
    const content=el('div','v4-milestone-content');
    content.append(el('span','v4-milestone-kicker',event.kicker));
    if(event.card){
      const card=el('img','v4-milestone-card');
      card.src='/'+event.card;
      card.alt=event.title;
      content.append(card);
    }
    content.append(el('strong','v4-milestone-title',event.title),el('span','v4-milestone-note',event.note));
    if(event.kind==='victory')for(let i=0;i<18;i++){
      const spark=el('i','v4-milestone-spark');
      spark.style.setProperty('--i',String(i));
      spark.style.left=(7+i*4.9)+'%';
      spark.style.animationDelay=(i*65)+'ms';
      overlay.append(spark);
    }
    overlay.append(content);
    document.body.append(overlay);
    milestoneOverlay=overlay;
    requestAnimationFrame(()=>overlay.classList.add('is-visible'));
    milestoneTimer=setTimeout(()=>{
      overlay.classList.remove('is-visible');
      milestoneTimer=setTimeout(()=>{
        overlay.remove();
        if(milestoneOverlay===overlay)milestoneOverlay=null;
        playMilestone();
      },450);
    },event.kind==='victory'?3600:2800);
  }
  function noteMilestones(s){
    const view=s.view;
    const current={game:s.room||'local',revision:view.revision,era:view.era,
      players:view.players.map(player=>({name:player.name,wonders:player.wonders.filter(w=>!w.buff).map(w=>w.id+'@'+(w.builtEra??w.era))})),
      winners:view.winners.join(',')};
    const prior=milestoneSnapshot;
    milestoneSnapshot=current;
    if(!prior||prior.game!==current.game||current.revision<=prior.revision)return;
    for(const [index,player] of current.players.entries()){
      const older=new Set(prior.players[index]?.wonders||[]);
      for(const key of player.wonders)if(!older.has(key)){
        const [id,era]=key.split('@'),card=cards.get(id);
        milestoneQueue.push({kind:'wonder',kicker:'文明里程碑 · 奇观建成',title:card?.name||'奇观建成',note:player.name+' 完成建设',card:assets[id+'-'+era]||assets[artKey(id,view.era)]});
      }
    }
    if(current.era>prior.era)milestoneQueue.push({kind:'era',kicker:'历史翻开新篇章',title:'进入时代 '+eras[current.era],note:'新的科技与奇观已经登场'});
    if(current.winners&&!prior.winners)milestoneQueue.push({kind:'victory',kicker:'对局结束',title:view.winners.map(i=>view.players[i].name).join('、')+' 获胜',note:view.reason||'胜利'});
  }
  function previewMilestone(kind){
    if(!api.showcase)return;
    const s=api.snapshot();if(!s)return;
    clearTimeout(milestoneTimer);
    milestoneOverlay?.remove();milestoneOverlay=null;milestoneQueue=[];
    if(kind==='wonder'){
      const id=s.view.currentWonder||'W04',card=cards.get(id),key=artKey(id,s.view.era);
      milestoneQueue.push({kind,kicker:'文明里程碑 · 奇观建成',title:card?.name||'奇观建成',note:s.view.players[0].name+' 完成建设',card:assets[key]});
    }else if(kind==='era')milestoneQueue.push({kind,kicker:'历史翻开新篇章',title:'进入时代 II',note:'新的科技与奇观已经登场'});
    else if(kind==='victory')milestoneQueue.push({kind,kicker:'对局结束',title:s.view.players[0].name+' 获胜',note:'科研胜利'});
    playMilestone();
  }

  function showcaseBar(){
    const bar=el('aside','v4-showcase-bar');
    const text=el('div','v4-showcase-copy');
    text.append(el('strong','','本地视觉演示'),el('span','','使用真实卡面与当前桌面样式；以下动画不会改变对局。'));
    bar.append(text);
    for(const [kind,label] of [['wonder','奇观建成'],['era','进入新时代'],['victory','玩家获胜']]){
      const button=action(label,'showcase-milestone');button.dataset.showcase=kind;bar.append(button);
    }
    const exit=action('返回普通预览','showcase-exit');exit.dataset.showcase='exit';bar.append(exit);
    return bar;
  }

  function el(tag,cls,text){
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  }
  function append(parent,...children){for(const child of children)if(child)parent.append(child);return parent;}
  function action(label,name,extra={},cls=''){
    const node=el('button',cls,label);
    node.type='button';
    node.dataset.v3Action=name;
    for(const [key,value] of Object.entries(extra))node.dataset[key]=String(value);
    return node;
  }
  function image(key,alt){
    const src=assets[key];
    if(!src)return null;
    const img=el('img');
    img.src='/'+src;
    img.alt=alt;
    img.loading='lazy';
    img.decoding='async';
    img.draggable=false;
    return img;
  }
  function artKey(id,era){
    if(id.startsWith('W'))return assets[id+'-'+era]?id+'-'+era:Object.keys(assets).find(key=>key.startsWith(id+'-'));
    return assets[id]?id:assets[id+'-art']?id+'-art':null;
  }
  function cardTile(id,kind,era,enabled){
    const card=cards.get(id);
    const node=el('div','v3-card v3-'+kind);
    node.dataset.card=id;
    if(enabled){node.classList.add('is-actionable');node.dataset.v3Action='select-tech';node.draggable=true;node.setAttribute('role','button');node.tabIndex=0;node.setAttribute('aria-label','选择'+(card?.name||id));}
    const picture=image(artKey(id,era),card?.name||id);
    if(picture)node.append(picture);
    else node.append(el('span','v3-card-fallback',card?.name||id));
    if(id==='T2-06')node.append(el('span','v3-art-warning','仅有原画 · 完整卡面缺失'));
    node.append(el('span','v3-card-name',card?.name||id));
    const detail=action('查看卡牌','detail',{card:id},'v3-card-detail');
    detail.setAttribute('aria-label','查看'+(card?.name||id)+'的完整卡面');
    node.append(detail);
    if(selectedTech===id)node.classList.add('is-selected');
    return node;
  }
  function resourceTile(card,place){
    const hidden=card.hidden&&card.value===undefined;
    const key=hidden?'back-resource':'R'+card.type+'-'+card.value;
    const node=el(['hand','draft','picked'].includes(place)?'button':'span','v3-resource'+(card.hidden?' is-hidden':'')+(card.id&&activeCard===card.id?' is-active':''));
    if(node.tagName==='BUTTON')node.type='button';
    node.dataset.v3Action=place==='hand'?'select-resource':place==='draft'?'remove-deposit':place==='picked'?'remove-pay':'';
    if(card.id)node.dataset.resourceId=card.id;
    node.draggable=place==='hand'&&!!card.id;
    const label=hidden?'暗置资源':resourceNames[card.type]+' '+card.value+'点';
    const picture=image(key,label);
    if(picture)node.append(picture);
    else node.append(el('span','v3-card-fallback',label));
    if(card.hidden)node.append(el('span','v3-card-flag','当时暗置'));
    if(place==='hand'&&(selectedPay.has(card.id)||depositDraft.has(card.id))){node.classList.add('is-picked');node.append(el('small','v4-staged-label',depositDraft.has(card.id)?'暂放投入':'暂放支付'));}
    if(place==='hand'&&drawnHand.has(card.id))node.classList.add('v4-drawn');
    node.setAttribute('aria-label',label+(place==='hand'?'，点击选择':''));
    return node;
  }
  function amount(values,empty='无资源费用'){return values.map((value,i)=>value?resourceNames[i]+value:'').filter(Boolean).join(' · ')||empty;}
  function count(cards){return assist.totals(cards);}
  function denominations(value){const out=[];for(const size of [10,5,2,1])while(value>=size){out.push(size);value-=size;}return out;}
  function currentHand(s){return s.viewer===null?[]:s.view.players[s.viewer]?.hand||[];}
  function expectedPlayer(s){return s.view.players[s.expected]?.name||'指定玩家';}
  function modeName(s){return s.view.legend?'一战封神':s.view.quick?'疾速模式':s.view.experimental?'实验模式':'标准模式';}

  function resourceSummary(required,owned,label='手中可用'){
    const row=el('div','v4-resource-summary');
    resourceNames.forEach((name,i)=>{
      const part=el('div','v4-resource-meter'+(owned[i]<required[i]?' is-short':''));
      append(part,el('strong','',name),el('span','',label+' '+owned[i]+' / 需要 '+required[i]),el('small','',owned[i]<required[i]?'还差 '+(required[i]-owned[i])+' 点':'已满足'));
      row.append(part);
    });
    return row;
  }
  function buyReason(s,id,discount=discountDraft,n=finalCount){
    const me=s.view.players[s.viewer],card=cards.get(id),slot=api.purchaseSlot();
    if(!me||s.viewer!==s.view.active||s.view.pending||s.view.phase!==5)return '当前不是购买阶段';
    if(card.kind==='final'){
      if(!slot?.normal)return '最终挑战需要一个普通购买名额';
      const fee=api.finalFee(id,n);return me.rp<fee?'还差 '+(fee-me.rp)+' 科研':'';
    }
    if(me.tech.includes(id))return '你已经持有这张科技';
    if(!api.available(id))return '这张科技当前不可取得';
    if(!slot?.normal&&!slot?.extra)return '本回合购买名额已用完';
    const need=api.cost(id,discount),have=count(currentHand(s));
    const missing=need.map((v,i)=>Math.max(0,v-have[i]));
    return missing.some(Boolean)?'还差 '+amount(missing):'';
  }
  function flyResource(source,destination){
    if(!source||!destination||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const picture=source.querySelector('img');if(!picture)return;
    const from=picture.getBoundingClientRect(),to=destination.getBoundingClientRect();
    const flight=picture.cloneNode();flight.className='v4-resource-flight';flight.setAttribute('aria-hidden','true');
    Object.assign(flight.style,{left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px'});
    document.body.append(flight);
    const animation=flight.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${to.left+to.width/2-from.left-from.width/2}px,${to.top+to.height/2-from.top-from.height/2}px) scale(.7)`,opacity:.15}],{duration:330,easing:'ease-out'});
    animation.finished.catch(()=>{}).finally(()=>flight.remove());
  }
  function stageGuide(s){
    const guide=el('section','v4-stage-guide');guide.setAttribute('aria-label','当前行动指引');
    const q=s.view.pending,own=s.expected===s.viewer&&!s.spectator;
    let title=phases[s.view.phase]||'回合结算',hint='按桌面提示完成当前步骤。';
    if(s.view.winners.length){title='本局已结束';hint='可以查看公开卡牌、行动记录或导出当前存档。';}
    else if(!own){title='等待 '+expectedPlayer(s);hint='当前由对方操作；你的手牌和暂存选择不会提交。';}
    else if(q){title=q.title||'完成当前选择';hint=({pay:'把资源暂放到支付区，可推荐选牌、点牌撤回，预览同类型找零后确认。',drawChoice:'点击右侧资源牌堆逐张抽牌，也可以一次抽完。',reward:'先选择资源与面额，合计满足要求后确认领取。',selectCards:'点选需要交出或取回的牌，确认前可反复调整。',choice:'先阅读选项，再决定这次结算。'})[q.op]||'完成下方选择后，对局会继续推进。';}
    else hint=({2:'先查看事件效果，再确认使用；也可以直接进入下一阶段。',4:'投骰 → 调整骰面 → 确认骰面 → 分配专利收益。',5:'点选桌面科技查看实际费用和收益；确认锁定前可换牌或撤回。',6:'从手牌向左侧奇观暂放资源，选择明置或暗置，检查进度后确认投入。',7:'先检查科研花费和剩余名额，再从事件牌堆抽取。',9:'可以兑换资源、使用个人能力；结束回合时按手牌上限整理。'})[s.view.phase]||hint;
    if(own&&!q&&s.view.phase===4&&s.view.turn.diceLocked)hint='骰面已确认；可分配专利收益，完成后进入科技购买。';
    const copy=el('div');append(copy,el('small','',s.view.winners.length?'对局结果':own?'轮到你操作':'等待对方'),el('strong','',title),el('p','',hint));guide.append(copy);
    const steps=el('ol','v4-phase-track');
    for(const phase of [2,3,4,5,6,7,9]){const item=el('li',phase===s.view.phase?'is-current':phase<s.view.phase?'is-past':'',phases[phase]);if(phase===s.view.phase)item.setAttribute('aria-current','step');steps.append(item);}
    guide.append(steps);const next=nextControl(s);if(next)guide.append(next);return guide;
  }

  function playerStrip(s){
    const line=el('div','v3-seats');
    for(const [i,p] of s.view.players.entries()){
      const seat=el('div','v3-seat'+(i===s.view.active?' is-turn':'')+(i===s.viewer?' is-self':''));
      append(seat,el('strong','',p.name+(i===s.viewer?' · 我':'')+(s.online&&!s.seats[i]?.online?' · 离线':'')),el('span','',p.rp+' / '+s.view.target+' 科研'),el('span','',p.handCount+' 张手牌'),action('公开卡牌','player-cards',{player:i},'v3-seat-link'));
      line.append(seat);
    }
    return line;
  }
  function gameTools(s){
    const bar=el('nav','v3-tools');
    bar.setAttribute('aria-label','本局工具');
    const tool=(label,name,mark)=>{
      const button=action(label,name,{},'v4-header-tool');
      button.replaceChildren(el('span','v4-tool-mark',mark),el('span','',label));
      button.querySelector('.v4-tool-mark').setAttribute('aria-hidden','true');
      return button;
    };
    if(s.viewer!==null)bar.append(tool('我的科技','owned-tech','✦'));
    bar.append(tool('对局统计','game-stats','▥'),tool('掷骰记录','dice-history','⚄'),tool('本局规则','game-rules','▤'),tool('操作设置','preferences','⚙'),tool('外观','appearance','◐'));
    if(s.online)bar.append(tool('房间与续接','room-info','◇'));
    else bar.append(tool('导出存档','export-save','⇩'),tool('交接遮挡','lock-screen','◫'));
    bar.append(tool('返回首页','home','⌂'));
    return bar;
  }
  function publicLog(s){
    const details=el('details','v3-public-log');
    details.append(el('summary','','公共行动记录 · '+s.view.log.length+' 条'));
    const entries=el('ol');
    for(const entry of s.view.log.slice(-30).reverse())entries.append(el('li','','时代 '+eras[entry.era]+' · '+entry.turn+' · '+entry.text));
    details.append(entries);
    return details;
  }
  function techZone(s){
    const area=el('section','v3-tech-zones');
    const market=el('div','v3-market');
    append(market,el('h2','','公共科技商店'),el('p','v3-caption','四张当代科技 · 购买后按规则补位'));
    const cardsLine=el('div','v3-market-cards');
    for(const id of s.view.shop)cardsLine.append(cardTile(id,'market-card',s.view.era,s.view.phase===5&&!s.view.pending&&s.viewer===s.view.active));
    if(s.view.phase===5&&!s.view.pending&&s.viewer===s.view.active)for(const tile of cardsLine.children){const why=buyReason(s,tile.dataset.card,[0,0,0],3);tile.append(el('small','v4-card-availability'+(why?' is-blocked':''),why||'可选择 · 查看费用'));}
    market.append(cardsLine);
    const basics=el('div','v3-basics');
    append(basics,el('h2','','公共基础科技'),el('p','v3-caption','已进入公共区的基础科技可按规则继续学习'));
    const basicCards=el('div','v3-basic-cards');
    for(const id of s.view.basics)basicCards.append(cardTile(id,'basic-card',s.view.era,s.view.phase===5&&!s.view.pending&&s.viewer===s.view.active));
    if(!s.view.basics.length)basicCards.append(el('p','v3-empty','目前为空 · 首次取得的基础科技会移到这里'));
    if(s.view.phase===5&&!s.view.pending&&s.viewer===s.view.active)for(const tile of basicCards.querySelectorAll('[data-card]')){const why=buyReason(s,tile.dataset.card,[0,0,0]);tile.append(el('small','v4-card-availability',why||'可学习'));}
    basics.append(basicCards);
    return append(area,market,basics);
  }
  function wonderZone(s){
    const area=el('section','v3-wonder');
    area.append(el('h2','','当前奇观'));
    if(!s.view.currentWonder){area.append(el('p','v3-empty','本时代暂无待建奇观'));return area;}
    const id=s.view.currentWonder;
    const card=cards.get(id);
    area.append(cardTile(id,'wonder-card',s.view.era,false));
    area.append(el('p','v3-wonder-cost','建成要求 · '+amount(api.wonderCost(id))));
    const contributions=el('div','v3-contributions');
    for(const [i,pile] of s.view.deposits.entries()){
      const row=el('div','v3-contribution-row');
      row.append(el('strong','',s.view.players[i].name+' · '+pile.length+' 张'));
      if(i===s.viewer)row.append(el('small','v4-private-note','你的投入合计：'+amount(count(pile),'0 点')+'（含暗置，仅你可见）'));
      else row.append(el('small','v4-private-note','明置：'+amount(count(pile.filter(c=>!c.hidden)),'0 点')+' · 暗置 '+pile.filter(c=>c.hidden).length+' 张'));
      const pileCards=el('div','v3-mini-cards');
      for(const c of pile)pileCards.append(resourceTile(c,'contribution'));
      row.append(pileCards);
      contributions.append(row);
    }
    area.append(contributions);
    if(s.view.phase===6&&!s.view.pending&&s.viewer===s.view.active){
      const stagedCards=currentHand(s).filter(c=>depositDraft.has(c.id)),deposited=s.view.deposits[s.viewer],need=api.wonderCost(id);
      const together=count([...deposited,...stagedCards]),limit=s.view.players[s.viewer].wonders.some(w=>w.id==='W03')?5:3;
      area.append(el('p','v4-action-note','本回合已投入 '+s.view.turn.deposited+' / '+limit+' 张 · 暂放 '+depositDraft.size+' 张'));
      area.append(resourceSummary(need,together,'含暂放'));
      const zones=el('div','v3-deposit-zones');
      for(const [hidden,label] of [['false','明置投入'],['true','暗置投入']]){
        const zone=el('div','v3-deposit-zone');zone.dataset.hidden=hidden;
        const target=action(label,'stage-deposit',{hidden},'v3-deposit-target');
        target.append(el('small','',hidden==='true'?'其他玩家只看牌背':'所有人可看牌面'));
        zone.append(target);
        const staged=el('div','v3-mini-cards');
        for(const [cid,secret] of depositDraft)if(String(secret)===hidden){const c=currentHand(s).find(x=>x.id===cid);if(c)staged.append(resourceTile(c,'draft'));}
        zone.append(staged);zones.append(zone);
      }
      area.append(zones);
      const controls=el('div','v3-wonder-controls');
      const confirm=action('确认投入 '+depositDraft.size+' 张','commit-deposit',{},'v3-primary');confirm.disabled=!depositDraft.size;
      controls.append(confirm);const reset=action('撤回暂放','clear-deposit');reset.disabled=!depositDraft.size;controls.append(reset);
      const available=count(deposited),enough=available.every((n,i)=>n>=need[i]);
      const build=action('宣告建成，预览找零','build-wonder');build.disabled=!enough||s.view.turn.deposited<1||depositDraft.size>0;controls.append(build);
      area.append(el('p','v4-action-note',depositDraft.size?'暂放尚未提交，可以点牌撤回；确认投入后本回合不能取回。':!enough?'你的已投入资源尚未足额。':s.view.turn.deposited<1?'资源已足额，本回合还需至少投入1张才能宣告建成。':'已满足建成条件，可进入找零确认。'));
      area.append(controls);
    }
    return area;
  }
  function deckZone(s){
    const area=el('aside','v3-decks');
    const tech=el('div','v3-deck');
    append(tech,image('back-tech-'+s.view.era,'科技牌背'),el('strong','','科技牌堆'),el('span','',s.view.remaining+' 张未购买'));
    area.append(tech);
    const resource=el('button','v3-deck'+(s.view.pending?.op==='drawChoice'&&s.view.pending.actor===s.viewer?' is-actionable':''));
    resource.type='button';resource.dataset.v3Action='draw-resource';resource.disabled=!(s.view.pending?.op==='drawChoice'&&s.view.pending.actor===s.viewer);resource.title=resource.disabled?'等待抽牌阶段':'点击抽取一张资源牌';
    append(resource,image('back-resource','资源牌背'),el('strong','','资源牌堆'),el('span','',s.view.resourceCount+' 张'));
    area.append(resource);
    const event=el('button','v3-deck'+(s.view.phase===7&&!s.view.pending&&s.viewer===s.view.active?' is-actionable':''));
    event.type='button';event.dataset.v3Action='preview-event';event.disabled=!(s.view.phase===7&&!s.view.pending&&s.viewer===s.view.active);event.title=event.disabled?'等待购买事件阶段':'查看费用后确认抽取事件';
    append(event,image('back-event','事件牌背'),el('strong','','事件牌堆'),el('span','',s.view.eventCount+' 张'));
    area.append(event);
    return area;
  }
  function payZone(s){
    const q=s.view.pending,me=s.view.players[s.viewer];
    const source=q.source==='deposit'?s.view.deposits[s.viewer]:me.hand;
    const picked=q.source==='deposit'?source:source.filter(card=>selectedPay.has(card.id));
    const {paid:given,change,missing,unused,ready}=assist.payment(picked,q.cost);
    const key=q.id+'|'+picked.map(card=>card.id).sort().join(',');
    if(key!==changeKey){
      changeDraft=change.map(value=>{
        const defaults=denominations(value);
        return [10,5,2,1].map(size=>defaults.filter(n=>n===size).length);
      });
      changeKey=key;
    }
    const chosen=changeDraft.map(row=>row.reduce((total,n,index)=>total+n*[10,5,2,1][index],0));
    const exact=chosen.every((value,type)=>value===change[type]);
    const area=el('section','v3-action v3-pay');
    append(area,el('h2','','预览支付与找零'),el('p','v3-caption',q.title||'把手牌放入对应资源区，确认后结算'));
    if(q.source!=='deposit'){const tools=el('div','v4-action-row');tools.append(action('推荐选牌','suggest-pay'),action('全部撤回','clear-pay'));area.append(tools);}
    area.append(el('p','v4-action-note','当前事项已锁定；可以调整支付牌和找零面额，不能取消已进行的购买或随机判定。'));
    const lanes=el('div','v3-pay-lanes');
    for(let i=0;i<3;i++){
      const lane=el('div','v3-pay-lane');
      lane.dataset.resourceType=String(i);lane.classList.add(missing[i]||unused[i]?'is-short':'is-ready');
      append(lane,el('strong','',resourceNames[i]),el('span','',given[i]+' / '+q.cost[i]+' 点'));
      const row=el('div','v3-mini-cards');
      for(const card of picked.filter(card=>card.type===i))row.append(resourceTile(card,q.source==='deposit'?'contribution':'picked'));
      lane.append(el('small','',unused[i]?'此项无需支付，请撤回':missing[i]?'还差 '+missing[i]+' 点':change[i]?'将找零 '+change[i]+' 点':'恰好足额'));
      lane.append(row);lanes.append(lane);
    }
    area.append(lanes);
    if(q.source==='deposit')area.append(el('p','v3-caption','建成奇观时，自己的全部投入牌一并交出，多余点数按规则找零。'));
    area.append(el('p','v3-change','本次同类型找零：'+(change.some(Boolean)?amount(change):'无需找零')+'。可自行选择找零牌的面额组合。'));
    if(change.some(Boolean)){
      const picker=el('div','v4-change-picker');
      for(let type=0;type<3;type++){
        if(!change[type])continue;
        const group=el('div','v4-change-group');
        const header=el('div','v4-change-heading');
        append(header,el('strong','',resourceNames[type]+' · 应找 '+change[type]+' 点'),el('span',chosen[type]===change[type]?'is-exact':'is-inexact','已选 '+chosen[type]+' 点'));
        group.append(header);
        const options=el('div','v4-change-options');
        [10,5,2,1].forEach((value,index)=>{
          const item=el('div','v4-change-option');
          const card=el('button','v4-reward-card');card.type='button';card.setAttribute('aria-label','放大查看'+resourceNames[type]+value+'点资源牌');
          card.append(image('R'+type+'-'+value,resourceNames[type]+value+'点'));
          item.append(card);
          const controls=el('div','v4-change-controls');
          const minus=action('−','change-adjust',{type,index,delta:-1});
          minus.disabled=changeDraft[type][index]===0;
          const plus=action('+','change-adjust',{type,index,delta:1});
          plus.disabled=chosen[type]+value>change[type];
          append(controls,minus,el('b','',changeDraft[type][index]),plus);
          item.append(controls);options.append(item);
        });
        group.append(options);picker.append(group);
      }
      area.append(picker);
    }
    const confirm=action('确认支付与找零','commit-pay',{},'v3-primary');
    confirm.disabled=!ready||!exact;
    if(!ready)area.append(el('p','v4-action-warning',unused.some(Boolean)?'请撤回不需要的资源类型。':'尚缺：'+amount(missing)));
    if(ready&&!exact)area.append(el('p','v4-action-warning','找零面额尚未凑齐，请检查各类资源的已选点数。'));
    if(q.source!=='deposit')area.append(el('p','v4-action-note','结算后手中资源：'+amount(count(source).map((n,i)=>n-q.cost[i]),'0 点')));
    area.append(confirm);
    return area;
  }
  function purchaseZone(s){
    const area=el('section','v3-action v3-purchase');
    if(s.view.phase!==5||s.view.pending||s.viewer!==s.view.active){
      append(area,el('h2','','桌面行动'),el('p','v3-caption',phases[s.view.phase]||'等待结算'));
      return area;
    }
    append(area,el('h2','','选择一张科技'),el('p','v3-caption','从商店或公共基础科技区挑选，费用将按本局规则计算'));
    const palace=s.view.players[s.viewer].wonders.find(w=>w.id==='W07');
    if(palace&&!s.view.turn.purchaseStarted&&palace.uses<2){
      area.append(action(palaceMode?'关闭更换区':'紫禁城：更换商店专利','toggle-palace'));
      if(palaceMode){
        const row=el('div','v3-pending-gallery');
        for(const id of s.view.shop.filter(id=>cards.get(id)?.kind==='patent'&&!cards.get(id)?.gate)){
          const item=el('div','v3-pending-card'+(selectedPalace.has(id)?' is-selected':''));
          item.append(cardTile(id,'pending-card',s.view.era,false));
          item.append(action(selectedPalace.has(id)?'取消选择':'选择更换','select-palace',{card:id}));
          row.append(item);
        }
        area.append(row);
        const confirm=action('更换所选 '+selectedPalace.size+' 张','commit-palace',{},'v3-primary');
        confirm.disabled=selectedPalace.size<1||selectedPalace.size>2;
        area.append(confirm);
      }
    }
    if(!selectedTech){area.append(el('p','v3-empty','点击桌上的科技卡牌，查看并确认本次学习'));return area;}
    const card=cards.get(selectedTech);
    if(!card){selectedTech=null;return area;}
    const panel=el('div','v3-purchase-choice');
    panel.append(cardTile(selectedTech,'choice-card',s.view.era,false));
    const info=el('div','v3-purchase-info');
    append(info,el('strong','',card.name),el('p','',card.kind==='final'?'最终科技挑战':'费用：'+amount(api.cost(selectedTech,discountDraft))));
    if(card.kind==='final'){
      const tray=el('div','v4-final-dice');
      for(let n=3;n<=8;n++)tray.append(action(n+' 枚 · '+api.finalFee(selectedTech,n)+' 科研','set-final-count',{count:n},'v4-count-chip'+(n===finalCount?' is-selected':'')));
      info.append(tray);
    }else{
      info.append(el('p','', '基础科研收益：'+api.research(selectedTech)));
      const slot=api.purchaseSlot();
      const eniac=s.view.players[s.viewer].wonders.find(w=>w.id==='W10');
      if(slot?.extra&&eniac){
        const discount=el('div','v3-discount');
        discount.append(el('span','','ENIAC 额外购买折扣：共可分配 '+(eniac.era===3?2:3)+' 点'));
        for(let type=0;type<3;type++){
          if(!card.cost?.[type])continue;
          const piece=el('div','v4-discount-piece');
          piece.append(el('span','',resourceNames[type]));
          const input=el('input');input.type='hidden';input.value=String(discountDraft[type]);input.dataset.discountType=String(type);
          piece.append(input,action('−','adjust-discount',{type,delta:-1}),el('b','',discountDraft[type]),action('+','adjust-discount',{type,delta:1}));
          discount.append(piece);
        }
        info.append(discount);
      }
    }
    info.append(el('p','v4-effect-copy',card.effect||''));
    if(card.kind!=='final'){info.append(resourceSummary(api.cost(selectedTech,discountDraft),count(currentHand(s))));if(s.view.players[s.viewer].tech.includes('T2-04'))info.append(el('p','v4-action-note','以上为确定性折扣后的费用；锁定后进行代数学判定，支付区以实际结果为准。'));}
    else info.append(el('p','v4-action-note','将支付 '+api.finalFee(selectedTech,finalCount)+' 科研。投骰后不可撤回，挑战失败不退款。'));
    const reason=buyReason(s,selectedTech);
    const confirm=action(card.kind==='final'?'确认支付科研并投骰':'确认锁定，进入支付','commit-buy',{},'v3-primary');
    confirm.disabled=!!reason;if(reason)info.append(el('p','v4-action-warning',reason));
    const controls=el('div','v4-action-row');controls.append(action('撤回选择','cancel-tech'),confirm);info.append(controls);
    panel.append(info);area.append(panel);
    return area;
  }
  function diceZone(s){
    const area=el('section','v3-action v3-dice');
    if(s.view.phase!==4||s.view.pending||s.viewer!==s.view.active)return area;
    append(area,el('h2','','专利骰'),el('p','v3-caption','先投骰并完成改骰，再确认最终骰面；每枚骰只可分配一次。'));
    const turn=s.view.turn;
    if(!turn.dice){
      area.append(action('投掷 '+s.view.rules.patentDice+' 枚专利骰','roll-dice',{count:s.view.rules.patentDice},'v3-primary'));
      if(s.view.players[s.viewer].tech.includes('T4-06'))area.append(action('内燃机：额外投 1 枚','roll-dice',{count:s.view.rules.patentDice+1}));
      return area;
    }
    const row=el('div','v3-dice-row');
    for(const [i,value] of turn.dice.entries()){
      const die=action(value,'toggle-die',{die:i},'v3-die'+(selectedDice.has(i)?' is-selected':'')+(turn.usedDice.includes(i)?' is-used':''));
      if(shownRoll!==turn.rollId)die.classList.add('v4-rolled');
      die.disabled=turn.usedDice.includes(i);
      row.append(die);
    }
    area.append(row);
    if(!turn.diceLocked){
      const modifiers=el('div','v3-dice-modifiers');
      const wonders=s.view.players[s.viewer].wonders;
      const one=[...selectedDice][0];
      if(wonders.some(w=>w.id==='W01')){
        const reroll=action('金字塔：重投所选骰','reroll-dice');
        reroll.disabled=!!turn.modifier||selectedDice.size<1||selectedDice.size>2;
        modifiers.append(reroll);
      }
      if(wonders.some(w=>w.id==='W02'))for(const delta of [-1,1]){
        const shift=action('巨石阵：'+(delta<0?'−1':'+1'),'shift-die',{delta});
        shift.disabled=!!turn.modifier||selectedDice.size!==1||turn.dice[one]+delta<1||turn.dice[one]+delta>6;
        modifiers.append(shift);
      }
      if(s.view.players[s.viewer].tech.includes('T5-09')){
        const steady=action('稳态宇宙论：转换所选骰','steady-die');
        steady.disabled=selectedDice.size!==1||turn.dice[one]>3||turn.steady.includes(one);
        modifiers.append(steady);
      }
      area.append(modifiers,action('确认最终骰面','lock-dice',{},'v3-primary'));
    }
    const patents=el('div','v3-patents');
    for(const id of s.view.players[s.viewer].tech){
      const effects=api.patentEffects[id];
      if(!effects)continue;
      const card=cards.get(id),entry=el('div','v3-patent');
      append(entry,image(artKey(id,s.view.era),card.name),el('strong','',card.name));
      effects.forEach((effect,index)=>{
        const required=effect[3]||1;
        const label=required+' 枚 '+effect[0]+' 点骰';
        const use=action(label,'use-patent',{card:id,effect:index},'v3-patent-action');
        use.disabled=!turn.diceLocked||turn.usedPatents.includes(id)||turn.dice.filter((n,j)=>n===effect[0]&&!turn.usedDice.includes(j)).length<required;
        entry.append(use);
      });
      patents.append(entry);
    }
    area.append(patents);
    return area;
  }
  function eventZone(s){
    const area=el('section','v3-action v3-events');
    const active=s.viewer===s.view.active&&!s.view.pending;
    if(s.view.phase===7){
      append(area,el('h2','','购买事件'),el('p','v3-caption','从事件牌堆抽取后，按本局规则决定立即使用或明置。'));
      if(active){
        const price=api.eventPrice();
        const button=action('支付 '+price+' 科研并抽取事件','buy-event',{},'v3-primary');
        const me=s.view.players[s.viewer];
        const reason=s.view.turn.eventBought?'本回合已购买事件':me.boughtEvents>=s.view.rules.eventBuyLimit?'整局付费事件购买名额已用完':!s.view.eventCount?'事件牌堆已空':me.rp<price?'还差 '+(price-me.rp)+' 科研':'';
        button.disabled=!!reason;area.append(el('p','v4-action-note','持有 '+me.rp+' 科研 · 本次花费 '+price+' · 已付费购买 '+me.boughtEvents+' / '+s.view.rules.eventBuyLimit+' 张'));
        if(reason)area.append(el('p','v4-action-warning',reason));else area.append(el('p','v4-action-note','确认后支付科研并抽牌；抽取后不能撤回。'));
        area.append(button);
      }
      return area;
    }
    append(area,el('h2','','使用明置事件'),el('p','v3-caption','每回合最多使用一张；点击卡面查看原设计，点击操作按钮结算。'));
    const row=el('div','v3-event-cards');
    for(const id of s.view.players[s.viewer]?.events||[]){
      const item=el('div','v3-event-item');
      item.append(cardTile(id,'event-card',s.view.era,false));
      item.querySelector('.v3-card').draggable=active&&!s.view.turn.eventUsed&&!!api.eventLegal(id);
      const use=action('查看使用效果','preview-use-event',{card:id},'v3-primary');
      use.disabled=!active||s.view.turn.eventUsed||!api.eventLegal(id);
      item.append(use);if(!api.eventLegal(id))item.append(el('p','v4-action-warning','当前没有符合条件的目标'));else if(s.view.turn.eventUsed)item.append(el('p','v4-action-note','本回合已使用事件'));row.append(item);
    }
    area.append(row);
    if(!row.children.length)area.append(el('p','v3-empty','当前没有明置事件'));
    if(selectedEvent&&active){const card=cards.get(selectedEvent),review=el('div','v4-event-review');append(review,el('strong','',card.name),el('p','v4-effect-copy',card.effect||''),action('撤回选择','cancel-event'),action('确认使用','use-event',{card:selectedEvent},'v3-primary'));area.append(review);}
    return area;
  }
  function pendingCards(source,selection=true){
    const row=el('div','v3-pending-resources');
    for(const card of source){
      const wrap=el('div','v3-pending-resource'+(selectedPending.has(card.id)?' is-selected':''));
      wrap.append(resourceTile(card,selection?'hand':'contribution'));
      if(selection)wrap.querySelector('.v3-resource').dataset.v3Action='select-pending';
      row.append(wrap);
    }
    if(!source.length)row.append(el('p','v3-empty','没有可选资源牌'));
    return row;
  }
  function pendingZone(s){
    const q=s.view.pending,area=el('section','v3-action v3-pending');
    if(!q||q.actor!==s.viewer){append(area,el('h2','','等待选择'),el('p','v3-caption','当前由 '+expectedPlayer(s)+' 完成私人结算'));return area;}
    append(area,el('h2','',q.title||'完成当前选择'));
    if(q.revealCard){
      area.append(cardTile(q.revealCard,'pending-card',s.view.era,false));
      area.append(el('p','v3-caption',cards.get(q.revealCard)?.effect||''));
    }
    if(q.op==='drawChoice'){
      area.append(el('p','v3-caption','从混合资源牌堆随机抽取，还需 '+q.left+' 张。只有你能看见抽到的类型与面额。'));
      const controls=el('div','v3-pending-choices');
      controls.append(action('抽取 1 张','draw-resource',{},'v3-primary'));
      controls.append(action('抽完剩余 '+q.left+' 张','draw-all'));
      area.append(controls);
    }else if(q.op==='choice'){
      const choices=el('div','v3-pending-choices');
      q.options.forEach((option,index)=>choices.append(action(option.label,'answer-choice',{index},'v3-primary')));
      area.append(choices);
    }else if(q.op==='legendPick'){
      area.append(el('p','v3-caption','五选一奇观开局能力；其他玩家可以选择同一奇观。'));
      const row=el('div','v3-pending-gallery');
      for(const id of q.cards){
        const item=el('div','v3-pending-card');
        item.append(cardTile(id,'legend-card',5,false));
        item.append(el('p','',api.legendBuffs[id]||''));
        item.append(action('选择这座奇观','choose-legend',{card:id},'v3-primary'));
        row.append(item);
      }
      area.append(row);
    }else if(q.op==='legendEvents'){
      area.append(el('p','v3-caption','已免费明置两张事件。确认后继续。'));
      const row=el('div','v3-pending-gallery');
      for(const id of q.cards)row.append(cardTile(id,'pending-card',5,false));
      area.append(row);
      area.append(action('已了解，继续','confirm-pending',{},'v3-primary'));
    }else if(q.op==='reward'){
      if(q.title?.includes('立即奖励'))area.append(el('p','v3-caption','这是卡牌效果的额外奖励，不是支付找零。'));
      area.append(el('p','v3-caption',q.any?'自选合计 '+q.any+' 点'+(q.single?'，限一种资源':''):'分别领取 '+amount(q.amount)));
      const grid=el('div','v4-reward-cards');
      for(let type=0;type<3;type++){
        const initial=denominations(q.any?(type===0?q.any:0):q.amount[type]);
        for(const value of [10,5,2,1]){
          const item=el('div','v4-reward-piece');
          const card=el('button','v4-reward-card');card.type='button';card.setAttribute('aria-label','放大查看'+resourceNames[type]+value+'点资源牌');
          card.append(image('R'+type+'-'+value,resourceNames[type]+value+'点'));
          item.append(card,el('span','v4-reward-label',resourceNames[type]+' '+value+'点'));
          const input=el('input');input.type='hidden';input.min='0';input.max='1000';
          const draftKey=type+':'+value;if(!rewardDraft.has(draftKey))rewardDraft.set(draftKey,initial.filter(n=>n===value).length);
          input.value=String(rewardDraft.get(draftKey));
          input.dataset.rewardType=String(type);input.dataset.rewardValue=String(value);
          input.setAttribute('aria-label',resourceNames[type]+value+'点牌张数');
          const controls=el('div','v4-reward-controls');
          controls.append(action('−','reward-adjust',{delta:-1}),el('b','',input.value),action('+','reward-adjust',{delta:1}));
          item.append(input,controls);grid.append(item);
        }
      }
      const presets=el('div','v4-action-row');if(q.any&&q.single)resourceNames.forEach((name,type)=>presets.append(action('全部领取'+name,'reward-type',{type})));presets.append(action('清空选择','clear-reward'));
      const summary=el('p','v4-reward-summary');summary.setAttribute('aria-live','polite');
      area.append(presets,grid,summary,action('确认领取','claim-reward',{},'v3-primary'));syncReward(area,q);
    }else if(['selectCards','tradeOffer','tradeReturn'].includes(q.op)){
      const source=q.purpose==='refund'?s.view.deposits[s.viewer]:currentHand(s);
      const allowed=q.op==='selectCards'?source.filter(card=>q.cards.includes(card.id)):source;
      if(q.op==='tradeReturn'){
        area.append(el('p','v3-caption','对方愿意交出：'));
        area.append(pendingCards(q.offerCards,false));
      }
      area.append(el('p','v3-caption',q.op==='selectCards'?'请选择 '+q.min+' 至 '+q.max+' 张资源牌':q.op==='tradeOffer'?'选择愿意交给对方的资源牌':'选择你愿意交出的资源牌'));
      area.append(pendingCards(allowed));
      area.append(action('确认所选 '+selectedPending.size+' 张','submit-pending-cards',{},'v3-primary'));
      if(q.op==='tradeReturn')area.append(action('拒绝交易','reject-trade'));
    }else if(q.op==='tradeConfirm'){
      area.append(el('p','v3-caption','你交出：'),pendingCards(q.ownCards,false));
      area.append(el('p','v3-caption','你收到：'),pendingCards(q.offerCards,false));
      area.append(action('确认双方同时交割','confirm-pending',{},'v3-primary'),action('取消交易','cancel-trade'));
    }else if(q.op==='privateView'){
      for(const player of q.hands.filter(Boolean)){
        area.append(el('h3','',player.name));
        area.append(pendingCards(player.hand,false));
      }
      area.append(action('查看完毕，关闭','confirm-pending',{},'v3-primary'));
    }else if(q.op==='genePick'){
      area.append(el('p','v3-caption','选择自己交出的 1 张专利，再选对方 1 至 2 张候选专利。'));
      const own=el('div','v3-pending-gallery');
      for(const id of q.own){const button=action(cards.get(id)?.name||id,'gene-own',{card:id},'v3-primary');if(selectedTech===id)button.classList.add('is-selected');own.append(button);}
      area.append(own);
      const candidates=el('div','v3-pending-gallery');
      for(const id of q.candidates){const button=action(cards.get(id)?.name||id,'select-pending-tech',{card:id},'v3-primary');if(selectedPending.has(id))button.classList.add('is-selected');candidates.append(button);}
      area.append(candidates,action('提出交换','submit-gene',{},'v3-primary'),action('跳过交换','skip-gene'));
    }else if(q.op==='fastPick'){
      area.append(el('p','v3-caption','选择 '+q.min+' 张科技；本次选择中商店不会补位。'));
      const row=el('div','v3-pending-gallery');
      for(const id of q.cards){
        const item=el('div','v3-pending-card'+(selectedPending.has(id)?' is-selected':''));
        item.append(cardTile(id,'pending-card',s.view.era,false));
        item.append(action(selectedPending.has(id)?'取消选择':'选择科技','select-pending-tech',{card:id}));
        row.append(item);
      }
      area.append(row,action('确认取得 '+selectedPending.size+' 张科技','submit-fast',{},'v3-primary'));
    }else area.append(el('p','v3-caption','正在处理当前结算，请等待桌面同步。'));
    return area;
  }
  function syncReward(area,q){
    const chosen=[0,0,0];
    for(const input of area.querySelectorAll('[data-reward-type]'))chosen[Number(input.dataset.rewardType)]+=Number(input.value)*Number(input.dataset.rewardValue);
    const sum=chosen.reduce((a,b)=>a+b,0),valid=q.any?sum===q.any&&(!q.single||chosen.filter(Boolean).length===1):chosen.every((n,i)=>n===q.amount[i]);
    area.querySelector('.v4-reward-summary').textContent='已选择：'+amount(chosen,'0 点')+' · '+(valid?'已满足领取要求':q.any?'需要合计 '+q.any+' 点'+(q.single?'，且只能选一种资源':''):'需分别满足：'+amount(q.amount));
    area.querySelector('[data-v3-action="claim-reward"]').disabled=!valid;
  }
  function nextControl(s){
    if(s.viewer!==s.view.active||s.view.pending||s.view.winners.length)return null;
    const label=({2:'结束事件使用',3:'结束抽牌',4:'结束专利结算',5:'结束科技购买',6:'结束奇观建设',7:'结束事件购买',8:'继续回合',9:'结束回合并整理手牌'})[s.view.phase]||'继续';
    const button=action(label,'next-phase',{},'v3-primary');
    const reason=s.view.phase===4&&(!s.view.turn.dice||!s.view.turn.diceLocked)?'请先投骰并确认最终骰面':s.view.phase===6&&depositDraft.size?'请先确认投入或撤回暂放':'';
    button.disabled=!!reason;if(reason){button.title=reason;button.textContent=reason;}
    return button;
  }
  function cleanupZone(s){
    const area=el('section','v3-action v3-cleanup');
    append(area,el('h2','','回合整理'),el('p','v3-caption','虚空兑换按当前比例支付资源；特殊科技的转换可在下方个人能力区使用。'));
    if(s.viewer!==s.view.active||s.view.pending)return area;
    area.append(el('p','v3-caption','当前兑换比例：'+api.ratio()+' 点换 1 点'));
    const form=el('div','v4-void-tray');
    for(const [role,label,value] of [['from','付出',voidFrom],['to','换得',voidTo]]){
      const row=el('div','v4-void-options');row.append(el('strong','',label));
      for(let type=0;type<3;type++)row.append(action(resourceNames[type],role==='from'?'void-from':'void-to',{type},'v4-count-chip'+(type===value?' is-selected':'')));
      form.append(row);
    }
    const count=el('div','v4-void-counter');count.append(el('strong','','所得点数'),action('−','void-count',{delta:-1}),el('b','',voidCount),action('+','void-count',{delta:1}));
    append(form,count,action('选择资源支付','commit-void',{},'v3-primary'));
    area.append(form);
    return area;
  }
  function actionZone(s){
    if(s.view.pending?.op==='pay'&&s.view.pending.actor===s.viewer)return payZone(s);
    if(s.view.pending)return pendingZone(s);
    if(s.view.phase===4)return diceZone(s);
    if(s.view.phase===2||s.view.phase===7)return eventZone(s);
    if(s.view.phase===9)return cleanupZone(s);
    if(s.view.phase===6){const area=el('section','v3-action');append(area,el('h2','','建设奇观'),el('p','v3-caption',s.viewer===s.view.active?'在左侧奇观区暂放资源；确认前可以点牌撤回或清空。每种资源分别满足要求后才能建成。':'等待当前玩家完成奇观投入。'));if(s.viewer===s.view.active&&s.view.currentWonder)area.append(action('前往奇观投入区','focus-wonder'));return area;}
    return purchaseZone(s);
  }
  function personalAbilities(s){
    if(s.viewer!==s.view.active||s.view.pending||s.view.phase<2||s.view.phase>9)return null;
    const me=s.view.players[s.viewer],mapping=[['T3-01','人力转科研'],['T3-11','矿物转科研'],['T4-07','金币转科研']];
    const buttons=mapping.filter(([id])=>me.tech.includes(id));
    if(!buttons.length&&!s.view.turn.tradeOpen)return null;
    const area=el('div','v3-personal');
    area.append(el('strong','','个人能力'));
    for(const [id,label] of buttons){
      const button=action(label+' · '+(s.view.turn.converts[id]||0)+'/3','convert',{card:id});
      button.disabled=(s.view.turn.converts[id]||0)>=3;
      area.append(button);
    }
    if(s.view.turn.tradeOpen)area.append(action('发起资源交易','start-trade'));
    return area;
  }
  function handZone(s){
    const area=el('section','v3-hand');
    const me=s.viewer===null?null:s.view.players[s.viewer];
    const heading=el('div','v4-hand-heading');
    heading.append(el('h2','',me?'我的资源手牌 · '+me.handCount+' / '+me.cap:'公开桌面'));
    if(me){
      const totals=count(currentHand(s)),stats=el('div','v4-hand-stats');
      totals.forEach((value,type)=>stats.append(el('span','v4-hand-stat',resourceNames[type]+' '+value)));
      heading.append(stats,action(handSorted?'恢复原顺序':'整理手牌','sort-hand',{},'v4-hand-sort'));
    }
    area.append(heading);
    const row=el('div','v3-hand-cards');
    const hand=currentHand(s).slice();if(handSorted)hand.sort((a,b)=>a.type-b.type||a.value-b.value);
    for(const card of hand)row.append(resourceTile(card,'hand'));
    if(!row.children.length)row.append(el('p','v3-empty','当前无可见手牌'));
    area.append(row);
    if(me)area.append(el('p','v3-hand-hint',s.view.pending?.op==='pay'?'点选或拖动资源进入支付区':s.view.phase===6?'先点选资源，再点明置或暗置区域；也可直接拖放':'点击卡牌查看或等待当前步骤'));
    return area;
  }
  function clearHandPreview(){
    handPreview?.node.remove();
    handPreview=null;
  }
  function showHandPreview(card){
    if(handPreview?.source===card)return;
    clearHandPreview();
    const preview=el('div','v4-hand-preview'+(card.classList.contains('v4-reward-card')?' v4-reward-preview':''));
    preview.setAttribute('aria-hidden','true');
    const picture=card.querySelector('img');
    preview.append(picture?picture.cloneNode(true):el('span','',card.getAttribute('aria-label')));
    document.body.append(preview);
    const source=card.getBoundingClientRect(),size=preview.getBoundingClientRect();
    preview.style.left=Math.max(8,Math.min(window.innerWidth-size.width-8,source.left+(source.width-size.width)/2))+'px';
    preview.style.top=Math.max(8,Math.min(window.innerHeight-size.height-8,source.top-size.height-12))+'px';
    handPreview={source:card,node:preview};
  }
  function footer(s){
    const bar=el('div','v3-footer');
    const status=s.view.pending?'等待 '+expectedPlayer(s)+' 完成选择':'时代 '+eras[s.view.era]+' · '+phases[s.view.phase]+' · '+modeName(s);
    bar.append(el('span','',status));
    const next=nextControl(s);if(next)bar.append(next);
    bar.append(action('查看规则','game-rules'));
    return bar;
  }
  function paymentReceiptView(s){
    if(!paymentReceipt||paymentReceipt.viewer!==s.viewer||paymentReceipt.room!==s.room)return null;
    const box=el('aside','v4-payment-receipt');
    append(box,el('strong','','上一笔支付已结算'),el('span','','支付 '+amount(paymentReceipt.cost)+'；同类型找零 '+(paymentReceipt.change.some(Boolean)?amount(paymentReceipt.change):'无需找零')+'。'));
    if(paymentReceipt.change.some(Boolean)){
      const returned=el('div','v4-payment-return');
      paymentReceipt.groups.forEach((values,type)=>values.forEach(value=>returned.append(resourceTile({type,value},'receipt'))));
      box.append(returned);
    }
    const q=s.view.pending;
    if(q?.op==='reward'&&q.actor===s.viewer){
      const reward=q.any?`自选 ${q.any} 点`:amount(q.amount);
      box.append(el('small','','下方「'+q.title+'」是额外奖励（'+reward+'），不是找零。'));
    }
    return box;
  }
  function render(){
    clearHandPreview();
    const main=document.getElementById('table-root'),s=api.snapshot();
    if(!main||!s){root=null;stateKey='';paymentReceipt=null;return;}
    noteMilestones(s);
    if(paymentReceipt&&(paymentReceipt.viewer!==s.viewer||paymentReceipt.room!==s.room||s.view.revision!==paymentReceipt.revision))paymentReceipt=null;
    if(api.isLocked()){
      const expected=s.view.pending?.actor??s.view.active;
      const curtain=el('div','v4-curtain'),card=el('div','v4-curtain-card');
      card.append(el('span','','更迭 · ITERATION'),el('h1','','请交接桌面'),el('p','','现在轮到 '+s.view.players[expected].name+'。请其他玩家移开视线后揭示私人手牌。'));
      const reveal=action('我是 '+s.view.players[expected].name+'，揭示桌面','reveal');reveal.id='v4-reveal';reveal.onclick=api.reveal;
      const home=action('返回首页','home');home.id='v4-home';home.onclick=api.home;
      card.append(reveal,home);curtain.append(card);main.replaceChildren(curtain);return;
    }
    const key=[s.room||'local',s.view.revision,s.view.pending?.id||'',s.viewer].join(':');
    if(key!==stateKey){selectedPay=new Set();changeDraft=[[],[],[]];changeKey='';selectedDice=new Set();selectedPending=new Set();selectedPalace=new Set();palaceMode=false;depositDraft=new Map();activeCard=null;selectedTech=null;voidFrom=0;voidTo=1;voidCount=1;finalCount=3;discountDraft=[0,0,0];selectedEvent=null;rewardDraft=new Map();stateKey=key;if(s.view.pending?.op==='pay'&&s.view.pending.actor===s.viewer&&s.view.pending.source!=='deposit')selectedPay=new Set(assist.suggestPayment(currentHand(s),s.view.pending.cost));}
    const seatKey=(s.room||'local')+':'+s.viewer;
    const handIds=new Set(currentHand(s).map(card=>card.id));
    drawnHand=seatKey===shownSeat?new Set([...handIds].filter(id=>!shownHand.has(id))):new Set();
    root=main.querySelector(':scope > .v3-game');
    if(!root){root=el('div','v3-game');main.replaceChildren(root);}
    const heading=el('header','v4-game-header');
    const mast=el('div','v4-game-mast');
    const brand=el('div','v4-game-brand');
    const seal=el('span','v4-seal','史');seal.setAttribute('aria-hidden','true');
    const brandText=el('div');append(brandText,el('small','','ITERATION · HISTORY OF TECHNOLOGY'),el('strong','','更迭 · 科技史桌游'));
    append(brand,seal,brandText);
    append(mast,brand,gameTools(s));
    const status=el('div','v4-game-status');if(s.online){const net=el('span','v4-network-status',s.status);net.dataset.connectionStatus='';status.append(net);}
    append(status,el('span','v3-turn','时代 '+eras[s.view.era]+' · '+s.view.players[s.view.active].name+'的回合'),el('span','v3-mode',modeName(s)));
    append(heading,mast,status);
    const board=el('div','v3-board'),actionArea=actionZone(s),receipt=paymentReceiptView(s);
    if(receipt)actionArea.insertBefore(receipt,actionArea.children[1]||null);
    append(board,wonderZone(s),append(el('div','v3-center'),actionArea,techZone(s)),deckZone(s));
    const content=el('div','v3-content');
    append(content,heading,playerStrip(s),stageGuide(s),board,personalAbilities(s),handZone(s),footer(s),publicLog(s));
    if(s.view.winners.length){const result=el('div','v3-winner',s.view.winners.map(i=>s.view.players[i].name).join('、')+'获胜 · '+s.view.reason);result.append(action('查看赛后统计','game-stats'));content.prepend(result);}
    if(api.showcase){
      content.prepend(showcaseBar());
      const comparison=el('div');comparison.innerHTML=api.visualStripHTML('table');
      content.prepend(comparison.firstElementChild);
    }
    root.replaceChildren(content);
    shownHand=handIds;shownSeat=seatKey;drawnHand=new Set();shownRoll=s.view.turn?.rollId??null;
    playMilestone();
  }
  function stageDeposit(s,id,hidden){
    const card=currentHand(s).find(c=>c.id===id);
    if(!card)return;
    const limit=s.view.players[s.viewer].wonders.some(w=>w.id==='W03')?5:3;
    if(!depositDraft.has(id)&&s.view.turn.deposited+depositDraft.size>=limit){api.notify('本回合奇观投入已达到张数上限');return;}
    const source=[...root.querySelectorAll('.v3-hand-cards [data-resource-id]')].find(n=>n.dataset.resourceId===id);flyResource(source,root.querySelector('.v3-deposit-zone[data-hidden="'+hidden+'"]'));depositDraft.set(id,hidden);activeCard=null;render();
  }
  async function commitPay(s){
    const q=s.view.pending,source=q.source==='deposit'?s.view.deposits[s.viewer]:currentHand(s);
    const selected=q.source==='deposit'?source:source.filter(c=>selectedPay.has(c.id));
    const paid=count(selected);
    if(!paid.every((n,i)=>n>=q.cost[i]&&(q.cost[i]>0||n===0))){api.notify('请选择足够的对应资源牌');return;}
    const change=paid.map((n,i)=>n-q.cost[i]);
    const groups=changeDraft.map(row=>row.flatMap((count,index)=>Array(count).fill([10,5,2,1][index])));
    if(!groups.every((values,type)=>values.reduce((total,value)=>total+value,0)===change[type])){
      api.notify('请按每种资源应找的点数选择找零牌组合');return;
    }
    await api.act('answer',{id:q.id,cards:selected.map(c=>c.id),groups});
    const after=api.snapshot();
    if(after?.view.revision!==s.view.revision&&after?.viewer===s.viewer){
      paymentReceipt={viewer:s.viewer,room:after.room,revision:after.view.revision,cost:q.cost.slice(),change,groups};
      render();
    }
  }
  root=document.querySelector('.v3-game');
  document.addEventListener('pointerover',event=>{
    if(event.pointerType==='touch')return;
    const card=event.target.closest?.('.v3-hand-cards .v3-resource,.v4-reward-card');
    if(card)showHandPreview(card);
  });
  document.addEventListener('pointerout',event=>{
    if(event.pointerType==='touch')return;
    const card=event.target.closest?.('.v3-hand-cards .v3-resource,.v4-reward-card');
    if(card&&!card.contains(event.relatedTarget))clearHandPreview();
  });
  document.addEventListener('focusin',event=>{
    const card=event.target.closest?.('.v3-hand-cards .v3-resource,.v4-reward-card');
    if(card)showHandPreview(card);
  });
  document.addEventListener('focusout',event=>{
    const card=event.target.closest?.('.v3-hand-cards .v3-resource,.v4-reward-card');
    if(card)clearHandPreview();
  });
  document.addEventListener('click',async event=>{
    const previewCard=event.target.closest('.v4-reward-card');
    if(previewCard){showHandPreview(previewCard);return;}
    if(handPreview?.source?.classList.contains('v4-reward-card'))clearHandPreview();
    const target=event.target.closest('[data-v3-action]');
    if(!target||!target.closest('.v3-game'))return;
    if(api.showcase&&target.dataset.showcase){if(target.dataset.showcase==='exit')location.assign('/preview-v4');else previewMilestone(target.dataset.showcase);return;}
    if(api.showcase&&target.dataset.v3Action!=='appearance')return;
    const s=api.snapshot();
    if(!s)return;
    const name=target.dataset.v3Action;
    try{
      if(name==='select-tech'){if(selectedTech!==target.dataset.card){finalCount=3;discountDraft=[0,0,0];}selectedTech=target.dataset.card;render();}
      else if(name==='detail')api.open('detail',{id:target.dataset.card});
      else if(name==='player-cards')api.open('playerCards',{player:Number(target.dataset.player)});
      else if(name==='owned-tech')api.open('ownedTech');
      else if(name==='dice-history')api.open('diceHistory');
      else if(name==='game-rules')api.openRules();
      else if(name==='appearance')api.open('appearance');
      else if(name==='game-stats'){api.open('stats');return;}
      else if(name==='preferences')api.open('preferences');
      else if(name==='sort-hand'){handSorted=!handSorted;render();}
      else if(name==='cancel-tech'){selectedTech=null;discountDraft=[0,0,0];render();}
      else if(name==='focus-wonder')root.querySelector('.v3-wonder')?.scrollIntoView({behavior:'smooth',block:'center'});
      else if(name==='clear-deposit'){depositDraft.clear();activeCard=null;render();}
      else if(name==='suggest-pay'){selectedPay=new Set(assist.suggestPayment(currentHand(s),s.view.pending.cost));render();}
      else if(name==='clear-pay'){selectedPay.clear();render();}
      else if(name==='remove-pay'){selectedPay.delete(target.dataset.resourceId);render();}
      else if(name==='room-info')api.open('roomInfo');
      else if(name==='export-save')api.exportSave();
      else if(name==='lock-screen')api.lock();
      else if(name==='home')api.home();
      else if(name==='select-resource'){
        const id=target.dataset.resourceId;
        if(s.view.pending?.op==='pay'&&s.view.pending.actor===s.viewer&&s.view.pending.source!=='deposit'){const card=currentHand(s).find(c=>c.id===id);if(!s.view.pending.cost[card.type]){api.notify('本次无需支付'+resourceNames[card.type]);return;}if(!selectedPay.has(id))flyResource(target,root.querySelector('[data-resource-type="'+card.type+'"]'));selectedPay.has(id)?selectedPay.delete(id):selectedPay.add(id);render();}
        else{activeCard=activeCard===id?null:id;render();}
      }
      else if(name==='remove-deposit'){depositDraft.delete(target.dataset.resourceId);render();}
      else if(name==='answer-choice')await api.act('answer',{id:s.view.pending.id,index:Number(target.dataset.index)});
      else if(name==='choose-legend')await api.act('answer',{id:s.view.pending.id,card:target.dataset.card});
      else if(name==='confirm-pending')await api.act('answer',{id:s.view.pending.id,confirm:true});
      else if(name==='cancel-trade')await api.act('answer',{id:s.view.pending.id,confirm:false});
      else if(name==='reject-trade')await api.act('answer',{id:s.view.pending.id,reject:true});
      else if(name==='select-pending'){const id=target.dataset.resourceId;selectedPending.has(id)?selectedPending.delete(id):selectedPending.add(id);render();}
      else if(name==='gene-own'){selectedTech=target.dataset.card;render();}
      else if(name==='submit-gene'){if(!selectedTech||selectedPending.size<1||selectedPending.size>2)throw Error('请选择自己的1张与对方1至2张专利');await api.act('answer',{id:s.view.pending.id,own:selectedTech,cards:[...selectedPending]});}
      else if(name==='skip-gene')await api.act('answer',{id:s.view.pending.id,skip:true});
      else if(name==='select-pending-tech'){const id=target.dataset.card;selectedPending.has(id)?selectedPending.delete(id):selectedPending.add(id);render();}
      else if(name==='toggle-palace'){palaceMode=!palaceMode;selectedPalace=new Set();render();}
      else if(name==='select-palace'){const id=target.dataset.card;selectedPalace.has(id)?selectedPalace.delete(id):selectedPalace.add(id);render();}
      else if(name==='commit-palace')await api.act('palace',{cards:[...selectedPalace]});
      else if(name==='submit-pending-cards')await api.act('answer',{id:s.view.pending.id,cards:[...selectedPending]});
      else if(name==='submit-fast')await api.act('answer',{id:s.view.pending.id,cards:[...selectedPending]});
      else if(name==='claim-reward'){
        const groups=[[],[],[]];
        for(const input of root.querySelectorAll('[data-reward-type]')){
          const type=Number(input.dataset.rewardType),value=Number(input.dataset.rewardValue),count=Number(input.value);
          if(!Number.isInteger(count)||count<0||count>1000)throw Error('资源牌张数须为 0 至 1000 的整数');
          for(let i=0;i<count;i++)groups[type].push(value);
        }
        await api.act('answer',{id:s.view.pending.id,groups});
      }
      else if(name==='reward-adjust'){
        const piece=target.closest('.v4-reward-piece'),input=piece.querySelector('input');
        input.value=String(Math.max(0,Math.min(1000,Number(input.value)+Number(target.dataset.delta))));
        piece.querySelector('b').textContent=input.value;rewardDraft.set(input.dataset.rewardType+':'+input.dataset.rewardValue,Number(input.value));syncReward(target.closest('.v3-pending'),s.view.pending);
      }
      else if(name==='clear-reward'){for(const key of rewardDraft.keys())rewardDraft.set(key,0);render();}
      else if(name==='reward-type'){const type=Number(target.dataset.type),values=denominations(s.view.pending.any);for(const key of rewardDraft.keys()){const [t,v]=key.split(':').map(Number);rewardDraft.set(key,t===type?values.filter(n=>n===v).length:0);}render();}
      else if(name==='preview-event')root.querySelector('.v3-events')?.scrollIntoView({behavior:'smooth',block:'center'});
      else if(name==='preview-use-event'){selectedEvent=target.dataset.card;render();}
      else if(name==='cancel-event'){selectedEvent=null;render();}
      else if(name==='change-adjust'){
        const type=Number(target.dataset.type),index=Number(target.dataset.index),delta=Number(target.dataset.delta);
        const pending=s.view.pending;
        if(pending?.op!=='pay')return;
        const selected=pending.source==='deposit'?s.view.deposits[s.viewer]:currentHand(s).filter(card=>selectedPay.has(card.id));
        const paid=count(selected),change=paid.map((value,i)=>Math.max(0,value-pending.cost[i]));
        if(!change||!changeDraft[type]||![0,1,2,3].includes(index))return;
        const value=[10,5,2,1][index],current=changeDraft[type].reduce((total,n,i)=>total+n*[10,5,2,1][i],0);
        if(delta===-1&&changeDraft[type][index]>0)changeDraft[type][index]--;
        else if(delta===1&&current+value<=change[type])changeDraft[type][index]++;
        render();
      }
      else if(name==='stage-deposit'){if(activeCard)stageDeposit(s,activeCard,target.dataset.hidden==='true');else api.notify('先点选一张手牌，再选择明置或暗置；也可以直接拖入。');}
      else if(name==='commit-deposit'&&depositDraft.size){await api.act('deposit',{cards:[...depositDraft.keys()],hidden:[...depositDraft].filter(([,v])=>v).map(([id])=>id)});}
      else if(name==='build-wonder')await api.act('build');
      else if(name==='commit-buy'&&selectedTech){
        const card=cards.get(selectedTech);
        if(card.kind==='final')await api.act('final',{card:selectedTech,count:finalCount});
        else{
          const discount=[0,0,0];
          for(const input of root.querySelectorAll('[data-discount-type]'))discount[Number(input.dataset.discountType)]=Number(input.value);
          if(discount.some(n=>!Number.isInteger(n)||n<0))throw Error('折扣须为非负整数');
          await api.act('buy',{card:selectedTech,discount});
        }
      }
      else if(name==='pay-lane'&&activeCard){selectedPay.add(activeCard);activeCard=null;render();}
      else if(name==='set-final-count'){finalCount=Number(target.dataset.count);render();}
      else if(name==='adjust-discount'){
        const type=Number(target.dataset.type),delta=Number(target.dataset.delta),limit=s.view.players[s.viewer].wonders.find(w=>w.id==='W10')?.era===3?2:3;
        const value=discountDraft[type]+delta;
        if(value>=0&&value<=limit&&discountDraft.reduce((a,b)=>a+b,0)+delta<=limit){discountDraft[type]=value;render();}
      }
      else if(name==='commit-pay')await commitPay(s);
      else if(name==='void-from'){voidFrom=Number(target.dataset.type);render();}
      else if(name==='void-to'){voidTo=Number(target.dataset.type);render();}
      else if(name==='void-count'){voidCount=Math.max(1,Math.min(1000,voidCount+Number(target.dataset.delta)));render();}
      else if(name==='commit-void'){
        const from=voidFrom,to=voidTo,count=voidCount;
        if(from===to)throw Error('请选择不同的资源类型');
        if(!Number.isInteger(count)||count<1||count>1000)throw Error('兑换点数须为 1 至 1000 的整数');
        await api.act('void',{from,to,count});
      }
      else if(name==='convert')await api.act('convert',{card:target.dataset.card});
      else if(name==='start-trade')await api.act('trade');
      else if(name==='draw-resource'&&s.view.pending?.op==='drawChoice'&&s.view.pending.actor===s.viewer)await api.act('answer',{id:s.view.pending.id});
      else if(name==='draw-all'&&s.view.pending?.op==='drawChoice'&&s.view.pending.actor===s.viewer)await api.act('drawAll',{id:s.view.pending.id});
      else if(name==='buy-event'&&s.view.phase===7&&!s.view.pending)await api.act('buyEvent');
      else if(name==='use-event'&&s.view.phase===2&&!s.view.pending)await api.act('useEvent',{card:target.dataset.card});
      else if(name==='roll-dice')await api.act('roll',{count:Number(target.dataset.count)});
      else if(name==='toggle-die'){const i=Number(target.dataset.die);selectedDice.has(i)?selectedDice.delete(i):selectedDice.add(i);render();}
      else if(name==='reroll-dice')await api.act('reroll',{dice:[...selectedDice]});
      else if(name==='shift-die')await api.act('shift',{index:[...selectedDice][0],delta:Number(target.dataset.delta)});
      else if(name==='steady-die')await api.act('steady',{index:[...selectedDice][0]});
      else if(name==='lock-dice')await api.act('lockDice');
      else if(name==='use-patent'){
        const id=target.dataset.card,index=Number(target.dataset.effect),effect=api.patentEffects[id][index],turn=s.view.turn;
        const dice=selectedDice.size?[...selectedDice]:turn.dice.map((n,i)=>n===effect[0]&&!turn.usedDice.includes(i)?i:-1).filter(i=>i>=0).slice(0,effect[3]||1);
        await api.act('patent',{card:id,effect:index,dice});
      }
      else if(name==='next-phase'){if(s.view.phase===5&&!s.view.turn.purchases)api.skip();else await api.act('next');}

    }catch(error){api.notify(error.message);}
  });
  document.addEventListener('dragstart',event=>{
    const card=event.target.closest('.v3-hand-cards .v3-resource');
    if(card?.dataset.resourceId)event.dataTransfer.setData('text/plain',card.dataset.resourceId);
    const tech=event.target.closest('.v3-market-cards .v3-card.is-actionable,.v3-basic-cards .v3-card.is-actionable');
    if(tech?.dataset.card)event.dataTransfer.setData('application/x-iteration-tech',tech.dataset.card);
    const activeEvent=event.target.closest('.v3-event-item .v3-card[draggable="true"]');
    if(activeEvent?.dataset.card)event.dataTransfer.setData('application/x-iteration-event',activeEvent.dataset.card);
  });
  document.addEventListener('dragover',event=>{if(event.target.closest('.v3-deposit-zone,.v3-pay-lane,.v3-purchase,.v3-events'))event.preventDefault();});
  document.addEventListener('drop',event=>{
    const zone=event.target.closest('.v3-deposit-zone,.v3-pay-lane,.v3-purchase,.v3-events');
    if(!zone)return;
    event.preventDefault();
    const id=event.dataTransfer.getData('text/plain'),s=api.snapshot();
    if(!s)return;
    if(zone.classList.contains('v3-purchase')){const tech=event.dataTransfer.getData('application/x-iteration-tech');if(tech){selectedTech=tech;render();}return;}
    if(zone.classList.contains('v3-events')){const card=event.dataTransfer.getData('application/x-iteration-event');if(card&&s.view.phase===2&&s.viewer===s.view.active){selectedEvent=card;render();}return;}
    if(!id)return;
    if(zone.classList.contains('v3-deposit-zone')&&s.view.phase===6&&!s.view.pending&&s.viewer===s.view.active)stageDeposit(s,id,zone.dataset.hidden==='true');
    else if(s.view.pending?.op==='pay'&&s.view.pending.actor===s.viewer&&s.view.pending.source!=='deposit'){const card=currentHand(s).find(c=>c.id===id);if(!card||card.type!==Number(zone.dataset.resourceType)||!s.view.pending.cost[card.type]){api.notify('请把资源放入对应的支付区域');return;}selectedPay.add(id);render();}
  });
  document.addEventListener('keydown',event=>{
    if(!['Enter',' '].includes(event.key))return;
    const target=event.target.closest('.v3-pay-lane,[data-v3-action="select-tech"]');
    if(!target)return;
    event.preventDefault();target.click();
  });
  window.renderTable=render;
  render();
})();
