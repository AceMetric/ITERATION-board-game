/* Independent tabletop application controller. The rule engine and room API own all game state. */
(()=>{'use strict';
const DATA=JSON.parse(document.getElementById('card-data').textContent);
const ASSETS=JSON.parse(document.getElementById('tabletop-assets').textContent);
const MODE_KEY='iteration-table-v4-active-mode';
const KEY='iteration-table-v4-seat',SAVE='iteration-table-v4-save',PREF='iteration-table-v4-preferences';
const LOCAL_PREVIEW=['127.0.0.1','localhost'].includes(location.hostname);
const SHOWCASE=LOCAL_PREVIEW&&new URLSearchParams(location.search).has('showcase');
const VISUAL_KEY='iteration-table-v4-visual-comparison';
const root=document.getElementById('table-root'),dialogs=document.getElementById('table-dialogs'),toast=document.getElementById('table-toast');
let game=null,connection=null,room=null,viewer=null,identity=null,modal=null,locked=false,lastRevision='',status='',homeWonderIndex=0,homeWonderPaused=false,homeWonderState=null,localDraft={count:2,names:['','','',''],mode:'normal'},localOptions={quick:false,legend:false,experimental:false,rules:GameConfig.defaults()};
const visuals={home:'light',table:'studio'};
try{const saved=JSON.parse(localStorage.getItem(VISUAL_KEY)||'{}');if(['light','dark'].includes(saved.home))visuals.home=saved.home;if(['classic','atelier','studio'].includes(saved.table))visuals.table=saved.table;}catch{}
function applyVisuals(){document.documentElement.dataset.homeTone=visuals.home;document.documentElement.dataset.tableStyle=visuals.table;document.querySelectorAll('[data-visual]').forEach(button=>button.setAttribute('aria-pressed',String(visuals[button.dataset.visual]===button.dataset.value)));}
function setVisual(part,value){if(!((part==='home'&&['light','dark'].includes(value))||(part==='table'&&['classic','atelier','studio'].includes(value))))return;visuals[part]=value;applyVisuals();try{localStorage.setItem(VISUAL_KEY,JSON.stringify(visuals));}catch{}}
function visualStripHTML(screen){if(!SHOWCASE)return '';const choice=(part,value,label)=>`<button type="button" data-app="visual-set" data-visual="${part}" data-value="${value}" aria-pressed="${visuals[part]===value}">${label}</button>`;return `<div class="v4-visual-strip" aria-label="视觉方案对照"><strong>视觉对照</strong><div class="v4-visual-choice"><span>首页</span>${choice('home','light','米白墨绿')}${choice('home','dark','深蓝金色')}</div><div class="v4-visual-choice"><span>桌面</span>${choice('table','classic','经典绿毡')}${choice('table','atelier','暖灰亚麻')}${choice('table','studio','蓝毡胡桃木')}</div><button type="button" class="v4-visual-jump" data-app="${screen==='home'?'visual-table':'visual-home'}">${screen==='home'?'查看桌面':'查看首页'} →</button></div>`;}
applyVisuals();
const cards=new Map([...DATA.tech,...DATA.events,...DATA.wonders].map(c=>[c.id,c]));
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove('show'),4500);}
function render(){unmountHomeWonder();if(game){root.dataset.screen='game';window.renderTable?.();}else{window.clearTableMilestones?.();root.dataset.screen=room?'lobby':'home';root.innerHTML=room?lobbyHTML():connection?'<main class="v4-reconnecting"><h1>正在恢复联机对局</h1><p data-connection-status>'+escape(status)+'</p><p>网络恢复后将继续同步，已提交的操作不会重复执行。</p><button data-app="network-retry">立即重连</button><button data-app="leave">返回首页</button></main>':homeHTML();if(!room&&!connection)mountHomeWonder();}if(!modal||!dialogs.querySelector('[role="dialog"]'))renderModal();applyVisuals();}
function prefs(){try{return {...{pauseDice:true,pausePurchase:true},...JSON.parse(localStorage.getItem(PREF)||'{}')};}catch{return {pauseDice:true,pausePurchase:true};}}
function stored(){try{return JSON.parse(sessionStorage.getItem(KEY)||localStorage.getItem(KEY)||'null');}catch{return null;}}
async function request(route,body,token){const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),12000);try{const response=await fetch('/api/'+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:ac.signal,cache:'no-store'});const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'网络请求失败'),{status:response.status});return value;}finally{clearTimeout(timer);}}
function saveIdentity(id){sessionStorage.setItem(KEY,JSON.stringify(id));localStorage.setItem(KEY+':'+id.room+':'+id.seat,JSON.stringify(id));localStorage.setItem(KEY,JSON.stringify(id));}
function connect(id,snapshot){
 sessionStorage.setItem(MODE_KEY,'online');
 connection?.close();identity=id;room=null;game=null;viewer=id.seat;status='正在连接';
 const current=new TabletopRoomConnection(id,{request,save:saveIdentity,onSnapshot:value=>{if(connection!==current)return;const changed=!room||room.version!==value.version||room.view?.revision!==value.view?.revision||JSON.stringify(room.seats)!==JSON.stringify(value.seats)||status!=='已连接';room=value;viewer=value.seat;game=value.view?Flow.remote(DATA,value.view,value.quotes):null;status=current.status;if(changed)render();},onStatus:value=>{if(connection!==current)return;status=value;const node=document.querySelector('[data-connection-status]');if(node)node.textContent=value;},onError:e=>notify(e.status===401?'请用已导出的续接凭证恢复身份':e.status?e.message:'连接中断，正在自动重试')});
 connection=current;current.store();if(snapshot)current.accept(snapshot);else render();void current.poll();
}
function localNew(names,options){sessionStorage.setItem(MODE_KEY,'local');connection?.close();connection=null;room=null;identity=null;localStorage.removeItem(KEY);sessionStorage.removeItem(KEY);game=new HistoryGame(DATA);game.newGame(names,Date.now()>>>0,options.experimental?options.rules:GameConfig.defaults(),{quick:options.quick,legend:options.legend});game.s.experimental=options.experimental;game.s.tableMetrics={startedAt:Date.now(),endedAt:null};Flow.advance(game,prefs());viewer=null;locked=true;save();render();}
function openShowcaseTable(){if(!SHOWCASE)return;game=new HistoryGame(DATA);game.newGame(['玩家1','玩家2'],24092026,GameConfig.defaults());Flow.advance(game,prefs());viewer=game.s.pending?.actor??game.s.active;locked=false;status='本地视觉演示';render();}
function save(){if(game&&!connection&&!SHOWCASE)try{game.s.tableMetrics=TabletopTesting.observe(game.s.tableMetrics,game.view(),null);localStorage.setItem(SAVE,game.export());}catch{notify('本机存储不可用，请导出存档');}}
async function act(type,args={}){if(SHOWCASE)throw Error('这是视觉演示，不会修改真实对局');if(!game)throw Error('请先开始对局');const view=game.view(viewer);if(connection){await connection.command(type,args,view.revision);return;}if(locked||viewer===null)throw Error('请先揭示当前玩家桌面');const actingSeat=viewer;Flow.command(game,actingSeat,type,args);Flow.advance(game,prefs());const nextSeat=game.s.pending?.actor??game.s.active;if(nextSeat!==actingSeat){viewer=null;locked=true;}else{viewer=actingSeat;locked=false;}save();render();}
function snapshot(){if(!game)return null;return {view:game.view(viewer),viewer,online:!!connection,spectator:!!identity?.spectator,seats:room?.seats||[],room:room?.room||null,expected:game.s.pending?.actor??game.s.active,status};}
function model(){return game;}
const legendBuffs={W01:'每回合专利结算前，可重投最多2枚骰子1次。',W02:'每回合专利结算前，可将1枚骰子加1或减1。',W03:'手牌上限+4，每回合奇观投入上限为5张。',W04:'每回合首次购买非最终科技时，人力费用减2。',W05:'每回合首次购买非最终科技时，矿物费用减2。',W06:'每回合首次购买非最终科技时，金币费用减2。',W07:'本时代2次：更换商店最多2张非门槛专利。',W09:'本时代购买非最终专利，额外获得4科研，最多4次。',W10:'本时代2次：可额外购买1张非最终科技并减免费用。',W15:'每回合开始可支付三类资源各2点推进项目；累计3次获得54科研。'};
const api={data:DATA,assets:ASSETS,cards,snapshot,notify,act,prefs,showcase:SHOWCASE,visuals,setVisual,visualStripHTML,openShowcaseTable,modeName:v=>v.legend?'一战封神':v.quick?'疾速模式':v.experimental?'实验模式':'标准模式',patentEffects:PATENTS,legendBuffs,
 card:id=>cards.get(id),cost:(id,discount=[0,0,0])=>model()?.cost(viewer,id,{extraDiscount:discount}),purchaseSlot:()=>model()?.purchaseSlot(viewer),ratio:()=>model()?.ratio(viewer),wonderCost:id=>model()?.wonderCost(id),research:id=>connection?room?.quotes?.research?.[id]:model()?.research(viewer,id),available:id=>connection?room?.quotes?.available?.includes(id):model()?.techAvailable(viewer,id),eventLegal:id=>connection?room?.quotes?.events?.[id]:model()?.eventLegal(viewer,id),eventPrice:()=>model()?.eventPrice(viewer),finalFee:(id,n)=>model()?.finalFee(viewer,id,n),open,openRules:()=>open('rules'),exportSave,lock:()=>{if(!connection){viewer=null;locked=true;render();}},render};
window.TableController=api;
function assetFor(id,era){if(id.startsWith('W'))return ASSETS[id+'-'+era]||ASSETS[Object.keys(ASSETS).find(k=>k.startsWith(id+'-'))];return ASSETS[id]||ASSETS[id+'-art'];}
function cardHTML(id,era){const c=cards.get(id);return '<img src="/'+escape(assetFor(id,era)||'')+'" alt="'+escape(c?.name||id)+'"><b>'+escape(c?.name||id)+'</b>'+(id==='T2-06'?'<small>仅有原画</small>':'');}
const reducedWonderMotion=matchMedia('(prefers-reduced-motion: reduce)');
function wonderIndex(index){return (index+DATA.wonders.length)%DATA.wonders.length;}
function wonderImage(index){return '/assets/home-wonder-'+DATA.wonders[wonderIndex(index)].id+'.png';}
function homeWonder(offset,role){
 const card=DATA.wonders[wonderIndex(homeWonderIndex+offset)];
 return `<figure class="v4-exhibit-figure" data-role="${role}"><img src="${wonderImage(homeWonderIndex+offset)}" width="1254" height="1254" alt="${escape(card.name)}" draggable="false"><figcaption><b>${escape(card.name)}</b><small>时代 ${card.eras.join(' / ')}</small></figcaption></figure>`;
}
function unmountHomeWonder(){
 const state=homeWonderState;if(!state)return;
 state.dead=true;clearTimeout(state.timer);state.abort.abort();
 for(const animation of state.animations)animation.cancel();
 state.animations.clear();state.preloads.clear();homeWonderState=null;
}
function mountHomeWonder(){
 const panel=root.querySelector('.v4-home-wonders');if(!panel)return;
 const state={panel,abort:new AbortController(),timer:null,busy:false,dead:false,ready:false,hover:false,focus:false,manual:false,animations:new Set(),preloads:new Map()};
 homeWonderState=state;
 const signal=state.abort.signal;
 const preload=index=>{
  const key=wonderIndex(index);
  if(!state.preloads.has(key)){
   const picture=new Image();picture.src=wonderImage(key);
   state.preloads.set(key,picture.decode().catch(()=>null));
  }
  return state.preloads.get(key);
 };
 const suspended=()=>document.hidden||(!state.manual&&(homeWonderPaused||state.hover||state.focus));
 const sync=()=>{
  if(state.dead)return;
  clearTimeout(state.timer);state.timer=null;
  for(const animation of state.animations){if(animation.playState==='finished')continue;suspended()?animation.pause():animation.play();}
  if(state.ready&&!state.busy&&!suspended())state.timer=setTimeout(()=>advanceHomeWonder(false),4200);
  panel.querySelector('[data-app="wonder-toggle"]')?.setAttribute('aria-pressed',String(homeWonderPaused));
 };
 state.sync=sync;state.preload=preload;
 panel.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch'){state.hover=true;sync();}},{signal});
 panel.addEventListener('pointerleave',()=>{state.hover=false;sync();},{signal});
 panel.addEventListener('focusin',()=>{state.focus=panel.contains(document.activeElement)&&document.activeElement.matches(':focus-visible');sync();},{signal});
 panel.addEventListener('focusout',()=>queueMicrotask(()=>{if(!state.dead){state.focus=panel.contains(document.activeElement)&&document.activeElement.matches(':focus-visible');sync();}}),{signal});
 document.addEventListener('visibilitychange',sync,{signal});
 reducedWonderMotion.addEventListener('change',sync,{signal});
 Promise.all([-1,0,1,2].map(preload)).then(()=>{if(state.dead)return;state.ready=true;sync();});
 sync();
}
async function advanceHomeWonder(manual=true){
 const state=homeWonderState;if(!state||state.dead||!state.ready||state.busy||document.hidden)return;
 if(!manual&&(homeWonderPaused||state.hover||state.focus))return;
 state.busy=true;state.manual=manual;state.sync();
 const next=wonderIndex(homeWonderIndex+1);
 await state.preload(next+1);
 if(state.dead)return;
 const figures=[...state.panel.querySelectorAll('.v4-exhibit-figure')];
 const left=figures.find(figure=>figure.dataset.role==='left'),center=figures.find(figure=>figure.dataset.role==='center'),right=figures.find(figure=>figure.dataset.role==='right');
 if(reducedWonderMotion.matches){
  const paint=(figure,index)=>{const card=DATA.wonders[wonderIndex(index)],picture=figure.querySelector('img');picture.src=wonderImage(index);picture.alt=card.name;figure.querySelector('b').textContent=card.name;figure.querySelector('small').textContent='时代 '+card.eras.join(' / ');};
  paint(left,next-1);paint(center,next);paint(right,next+1);
 }else{
  const animate=(figure,frames,duration)=>{
   const animation=figure.animate(frames,{duration,easing:'cubic-bezier(.22,.61,.36,1)',fill:'forwards'});
   state.animations.add(animation);animation.finished.catch(()=>{});return animation;
  };
  const towardLeft=animate(center,[{left:'50%',transform:'translateX(-50%) scale(1)'},{left:'18%',transform:'translateX(-50%) scale(.625)'}],850);
  const towardCenter=animate(right,[{left:'82%',transform:'translateX(-50%) scale(.625)'},{left:'50%',transform:'translateX(-50%) scale(1)'}],850);
  const exiting=animate(left,[{left:'18%',opacity:1},{left:'-14%',opacity:0}],240);
  center.dataset.role='left';right.dataset.role='center';left.dataset.role='outgoing';
  try{
   await exiting.finished;if(state.dead)return;
   left.style.visibility='hidden';
   const card=DATA.wonders[wonderIndex(next+1)],picture=left.querySelector('img');
   picture.src=wonderImage(next+1);picture.alt=card.name;
   left.querySelector('b').textContent=card.name;left.querySelector('small').textContent='时代 '+card.eras.join(' / ');
   left.dataset.role='right';
   const entering=animate(left,[{left:'112%',opacity:0},{left:'82%',opacity:1}],610);
   left.style.visibility='';
   await Promise.all([towardLeft.finished,towardCenter.finished,entering.finished]);
  }catch{return;}
  if(state.dead)return;
  for(const animation of state.animations)animation.cancel();state.animations.clear();
 }
 homeWonderIndex=next;
 state.panel.querySelector('.v4-exhibit-count').textContent=String(next+1).padStart(2,'0')+' / '+DATA.wonders.length;
 state.busy=false;state.manual=false;
 void state.preload(next+2);state.sync();
}
function homeHTML(){
 return `${visualStripHTML('home')}<div class="v4-entry">
  <header class="v4-entry-header"><div class="v4-brand"><small>ITERATION · HISTORY OF TECHNOLOGY</small><strong>更迭 · 科技史桌游</strong></div><nav aria-label="首页导航"><button data-app="catalog">卡牌大全</button><button data-app="rules">规则说明</button><button data-app="appearance">外观</button><button data-app="preferences">设置</button><button data-app="experiment">实验模式设置</button><button data-app="import-save">导入存档</button><button data-app="scroll-online">联机对局</button></nav></header>
  <main class="v4-entry-main"><section class="v4-hero"><p class="v4-eyebrow">离线 · 联机</p><h1>从驯火<br>到宇宙航行</h1><p class="v4-hero-copy">积累资源，掌握科技，建设奇观。<br>率先达到科研目标，或赢得最终科技。</p>
   <div class="v4-home-wonders" aria-label="文明奇观轮播"><div class="v4-exhibit-heading"><span>文明的足迹</span><span class="v4-exhibit-count">${String(homeWonderIndex+1).padStart(2,'0')} / ${DATA.wonders.length}</span></div><div class="v4-exhibit-stage">${homeWonder(-1,'left')}${homeWonder(0,'center')}${homeWonder(1,'right')}</div><div class="v4-exhibit-controls"><span>15座奇观 · 悬停可停留</span><div><button data-app="wonder-toggle" aria-label="${homeWonderPaused?'播放':'暂停'}奇观轮播">${homeWonderPaused?'播放':'暂停'}</button><button data-app="wonder-next">下一座 →</button></div></div></div>
   <div class="v4-hero-stats"><span><b>60</b>科技牌</span><span><b>14</b>事件牌</span><span><b>15</b>奇观牌</span><span><b>2–4</b>位玩家</span></div>
  </section><section class="v4-registration"><h2>单机 · 同机对局</h2><p class="v4-form-intro">请按顺时针座次填写。起始玩家随机决定。</p><label class="v4-count-label">游戏人数<select id="local-count"><option value="2">2人</option><option value="3">3人</option><option value="4">4人</option></select></label><div class="v4-home-names">${Array.from({length:4},(_,i)=>`<label data-local-player="${i}"${i>=2?' hidden':''}><span class="v4-sr-only">玩家${i+1}</span><input id="local-name-${i}" maxlength="24" placeholder="玩家${i+1}" aria-label="玩家${i+1}"></label>`).join('')}</div>
   <section class="v4-mode-card"><p class="v4-mode-kicker">推荐 · 标准规则</p><h3>标准对局</h3><p>始终使用官方默认参数，不受实验设置影响。科研目标：2人220／3人160／4人125。</p><button class="v4-original-primary" data-app="start-local" data-mode="normal">开始标准对局</button></section>
   <section class="v4-mode-card v4-mode-experiment"><p class="v4-mode-kicker">自由调参</p><h3>实验对局</h3><p>使用自定义参数，便于测试与调整数值。</p><div class="v4-mode-actions"><button data-app="experiment">配置实验规则</button><button class="v4-original-primary" data-app="start-local" data-mode="experimental">开始实验对局</button></div></section>
   <section class="v4-mode-card v4-mode-workshop"><p class="v4-mode-kicker">特殊玩法</p><h3>疾速模式 · 一战封神</h3><p>保留已实现的两种特别模式及其专属开局规则。</p><div class="v4-mode-actions"><button data-app="start-local" data-mode="quick">开始疾速模式</button><button data-app="start-local" data-mode="legend">开始一战封神</button></div></section>
   <button class="v4-resume-local" data-app="resume-local">继续上次对局</button><p class="v4-home-privacy">交接设备时会遮挡私人手牌。无需联网。</p>
  </section></main>
  <section class="v4-online-entry" id="v4-online-entry"><div class="v4-online-heading"><p class="v4-eyebrow">各自设备 · 2–4人 · 私人手牌</p><h2>邀请朋友，在线同桌</h2><p>使用昵称和房间码加入，无需注册。电脑与手机可以一起玩。</p></div><div class="v4-online-fields"><label>你的昵称<input id="entry-name" maxlength="24" placeholder="请输入昵称"></label><label>房间名称<input id="entry-room-name" maxlength="40" placeholder="例如：周五测试局"></label><label>玩家人数<select id="entry-capacity"><option>2</option><option>3</option><option>4</option></select></label><label>对局模式<select id="entry-mode"><option value="normal">标准模式</option><option value="quick">疾速模式</option><option value="legend">一战封神</option><option value="experimental">实验模式</option></select></label></div><div class="v4-home-checks"><label class="check"><input id="entry-listed" type="checkbox" checked>在大厅显示</label><label class="check"><input id="entry-spectators" type="checkbox" checked>允许观战</label></div><div class="v4-online-actions"><button class="v4-original-primary" data-app="create">创建联机房间</button><button data-app="rooms">浏览房间大厅</button><button data-app="resume-online">续接联机身份</button></div><div class="v4-home-join"><input id="entry-code" maxlength="10" placeholder="朋友提供的房间码" aria-label="房间码"><button data-app="join">加入房间</button><button data-app="watch">按房间码观战</button></div></section>
 </div>`;
}
function lobbyHTML(){return '<div class="v4-lobby"><header><div class="v4-mark">更迭 <span>ITERATION</span></div><button data-app="leave">返回首页</button></header><main><div class="v4-lobby-top"><div><small>联机房间 · '+escape(status)+'</small><h1>'+escape(room.roomName)+'</h1><p>房间码 <strong class="code">'+escape(room.room)+'</strong> <button data-app="copy-code">复制</button></p></div><div class="v4-mode-pill">'+escape(room.legend?'一战封神':room.quick?'疾速模式':room.experimental?'实验模式':'标准模式')+'</div></div><div class="v4-lobby-layout"><section><h2>玩家席位 '+room.seats.length+' / '+room.capacity+'</h2><div class="v4-seat-grid">'+Array.from({length:room.capacity},(_,i)=>'<div class="v4-seat-card">'+(room.seats[i]?'<b>'+escape(room.seats[i].name)+'</b><span>'+((room.seats[i].ready?'已准备':'未准备')+' · '+(room.seats[i].online?'在线':'离线'))+'</span>':'<b>等待加入</b>')+'</div>').join('')+'</div><div class="v4-lobby-actions">'+(room.spectator?'':room.host?'<button class="primary" data-app="start-room">全部到齐后开始</button>':'<button class="primary" data-app="ready">'+(room.seats[room.seat]?.ready?'取消准备':'准备')+'</button>')+'<button data-app="copy-invite">复制邀请链接</button>'+(room.spectator?'':'<button data-app="export-seat">导出续接凭证</button>')+'</div></section><section><h2>房间设置</h2>'+(!room.host?'<p>由房主设置模式和实验参数。</p>':'<label>模式<select id="lobby-mode"><option value="normal"'+(!room.quick&&!room.legend&&!room.experimental?' selected':'')+'>标准模式</option><option value="quick"'+(room.quick?' selected':'')+'>疾速模式</option><option value="legend"'+(room.legend?' selected':'')+'>一战封神</option><option value="experimental"'+(room.experimental?' selected':'')+'>实验模式</option></select></label><button data-app="save-mode">切换模式</button><label>房间名称<input id="lobby-name" value="'+escape(room.roomName)+'"></label><label class="check"><input id="lobby-listed" type="checkbox"'+(room.listed?' checked':'')+'>在大厅显示</label><label class="check"><input id="lobby-spectators" type="checkbox"'+(room.allowSpectators?' checked':'')+'>允许观战</label><button data-app="save-room">保存房间设置</button>')+(!room.spectator&&room.experimental?'<button data-app="experiment">调整本局实验数值</button>':'')+(room.spectator?'':'<button data-app="preferences">个人操作偏好</button>')+'<p class="v4-rule-tag">最终挑战：每骰 '+room.rules.finalDiePrice+' 科研 · 资源：混合牌堆</p></section></div></main></div>';}
function download(name,data){const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportSave(){if(!game||connection)return notify('联机对局由房间自动保存；请导出续接凭证');download('更迭-桌游存档.json',game.export());}
function fileInput(callback){const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{if(input.files?.[0])try{await callback(JSON.parse(await input.files[0].text()));}catch(e){notify(e.message);}};input.click();}
function open(type,args={}){if(type==='experiment')args={...args,rulesVersion:room?.rulesVersion,draft:JSON.parse(JSON.stringify(room?.rules||localOptions.rules))};modal={type,args};renderModal();}
function close(){const previous=modal;modal=previous?.args?.returnTo?{type:previous.args.returnTo,args:{}}:null;renderModal();}
function experimentForm(r,editable){
 const number=(key,label,value,min,max)=>'<label class="v4-experiment-field"><span>'+label+'</span><input data-rule="'+key+'" type="number" min="'+min+'" max="'+max+'" step="1" value="'+value+'"></label>';
 const section=(name,caption,content,expanded=false)=>'<details class="v4-experiment-section"'+(expanded?' open':'')+'><summary><span><strong>'+name+'</strong><small>'+caption+'</small></span><span class="v4-experiment-chevron" aria-hidden="true"></span></summary><div class="v4-experiment-section-body">'+content+'</div></details>';
 const turn='<div class="v4-experiment-grid">'+number('finalDiePrice','最终挑战每骰科研',r.finalDiePrice,1,5000)+number('patentDice','默认专利骰数量',r.patentDice,1,12)+number('techBuys','每回合科技购买名额',r.techBuys,1,10)+number('handLimit','基础手牌上限',r.handLimit,0,100)+number('voidRatio','虚空兑换比例',r.voidRatio,1,20)+'</div><h4>每回合基础抽牌数</h4><div class="v4-experiment-grid v4-experiment-eras">'+r.drawPerEra.map((n,i)=>'<label class="v4-experiment-field"><span>时代 '+(i+1)+'</span><input data-array="drawPerEra" data-index="'+i+'" type="number" min="0" max="30" step="1" value="'+n+'"></label>').join('')+'</div><p class="v4-experiment-hint">明置事件和卡牌能力造成的抽牌增减仍会正常生效。</p><h4>科研胜利目标</h4><div class="v4-experiment-grid">'+r.researchTargets.map((n,i)=>'<label class="v4-experiment-field"><span>'+(i+2)+'人所需科研</span><input data-array="researchTargets" data-index="'+i+'" type="number" min="1" max="5000" step="1" value="'+n+'"></label>').join('')+'</div>';
 const module='<div class="v4-experiment-grid">'+number('resourceModules','资源模组数（0 为自动）',r.resourceModules,0,10)+'</div><p class="v4-experiment-hint">自动配置：2人1个模组，3～4人2个模组。下表表示每个模组中各类资源牌的张数。</p><div class="v4-experiment-module"><span>每模组</span>'+[1,2,5,10].map(n=>'<b>'+n+'点</b>').join('')+r.moduleCards.map((row,t)=>'<b>'+['金币','人力','矿物'][t]+'</b>'+row.map((n,i)=>'<input data-module="'+t+'" data-index="'+i+'" type="number" min="0" max="100" step="1" value="'+n+'" aria-label="'+['金币','人力','矿物'][t]+[1,2,5,10][i]+'点牌每模组张数">').join('')).join('')+'</div><p class="v4-experiment-hint">奖励储备单独保留一个同配置模组；开局发牌所需的资源牌必须充足。</p>';
 const events='<label class="v4-experiment-field v4-experiment-prices"><span>个人第1、2、3…次购买价格（科研）</span><input id="experiment-prices" type="text" value="'+escape(r.eventPrices.join(' / '))+'" placeholder="5 / 10 / 15 / 20 / 25" aria-label="事件价格阶梯"></label><p class="v4-experiment-hint">用斜线、逗号或空格分隔，填写1～14档非负整数；超出已填档位时沿用最后一档。时代 IV、V 的事件价格仍翻倍。</p><div class="v4-experiment-grid">'+number('eventBuyLimit','每人付费购买事件上限',r.eventBuyLimit,0,14)+number('eventDisplayLimit','同时明置事件上限',r.eventDisplayLimit,0,14)+'</div>';
 const wonders='<div class="v4-experiment-grid v4-experiment-eras">'+r.fixedWonders.map((id,i)=>'<label class="v4-experiment-field"><span>时代 '+(i+1)+'</span><select data-wonder="'+i+'"><option value="">随机出现</option>'+DATA.wonders.filter(w=>w.eras.includes(i+1)).map(w=>'<option value="'+escape(w.id)+'"'+(w.id===id?' selected':'')+'>'+escape(w.name)+'</option>').join('')+'</select></label>').join('')+'</div><p class="v4-experiment-hint">可以只固定部分时代。每个时代仍只出现一张奇观，同一奇观不能重复指定。</p>';
 return '<div class="v4-experiment-intro"><strong>'+(editable?'设置下一局的实验规则':'实验规则（只读）')+'</strong><p>'+(connection?(editable?'仅房主可在开局前修改；保存后所有玩家需重新准备。':'由房主在开局前设置。'):'仅用于实验模式对局；标准模式仍使用默认规则。')+' 卡牌能力的加减效果照常生效。</p></div><fieldset class="v4-experiment-fields"'+(editable?'':' disabled')+'>'+section('回合与胜利','挑战、抽牌、购买与科研目标',turn,true)+section('资源牌模组','模组数量与三类资源面额',module)+section('事件牌','购买价格阶梯与上限',events)+section('固定奇观','五个时代的奇观选择',wonders)+'</fieldset>'+(editable?'<div class="v4-experiment-actions"><button class="primary" data-app="save-experiment">保存实验参数</button><button data-app="reset-experiment">恢复默认值</button></div>':'');
}
const TEST_KEY='iteration-table-v4-test-presets',DRAFT_KEY='iteration-table-v4-experiment-draft';
try{const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(draft)localOptions.rules=GameConfig.normalize(draft,DATA);}catch{}
function getPresets(){try{return JSON.parse(localStorage.getItem(TEST_KEY)||'[]').filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&p.rules);}catch{return [];}}
function writePresets(list){localStorage.setItem(TEST_KEY,JSON.stringify(list));}
function experimentEditable(){return !connection||!!room?.host&&!room.started;}
function readExperiment(){
 const r=JSON.parse(JSON.stringify(modal?.args?.draft||room?.rules||localOptions.rules));
 r.eventPrices=document.getElementById('experiment-prices').value.trim().split(/[\s,，、/／;；]+/).filter(Boolean).map(Number);
 dialogs.querySelectorAll('[data-rule]').forEach(el=>r[el.dataset.rule]=el.value.trim()===''?NaN:Number(el.value));
 dialogs.querySelectorAll('[data-array]').forEach(el=>r[el.dataset.array][Number(el.dataset.index)]=el.value.trim()===''?NaN:Number(el.value));
 dialogs.querySelectorAll('[data-module]').forEach(el=>r.moduleCards[Number(el.dataset.module)][Number(el.dataset.index)]=el.value.trim()===''?NaN:Number(el.value));
 dialogs.querySelectorAll('[data-wonder]').forEach(el=>r.fixedWonders[Number(el.dataset.wonder)]=el.value||null);
 return GameConfig.normalize(r,DATA,room?.capacity||null);
}
function compareHTML(r){const rows=TabletopTesting.differences(r,GameConfig.defaults(),DATA);return rows.length?'<p>共 '+rows.length+' 项与标准默认值不同</p><div class="v4-test-table"><table><thead><tr><th>参数</th><th>默认值</th><th>当前草稿</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+escape(x.label)+'</td><td>'+escape(x.base)+'</td><td>'+escape(x.value)+'</td></tr>').join('')+'</tbody></table></div>':'<p>当前参数与标准默认值完全一致。</p>';}
function presetHTML(editable){return '<details class="v4-preset-panel"><summary>实验方案 · 保存、载入与分享</summary><p>方案保存在本机。载入只更改草稿，点击“保存实验参数”后才应用于下一局或房间。</p><div class="v4-preset-row"><label>已存方案<select id="test-preset"><option value="">选择一个方案</option>'+getPresets().map(p=>'<option value="'+escape(p.id)+'">'+escape(p.name)+'</option>').join('')+'</select></label>'+(editable?'<button data-app="preset-load">载入草稿</button><button data-app="preset-copy">复制方案</button>':'')+'</div><div class="v4-preset-row"><label>新方案名称<input id="test-preset-name" maxlength="40" placeholder="例如：低成本奇观测试"></label><button data-app="preset-save">将当前参数另存为方案</button></div><div class="v4-preset-row"><button data-app="preset-export">导出当前方案</button>'+(editable?'<button data-app="preset-import">导入方案</button>':'')+'</div></details><details class="v4-test-diff"><summary>与默认值对照</summary><div id="test-diff">'+compareHTML(modal.args.draft||room?.rules||localOptions.rules)+'</div><button data-app="preset-compare">更新对照</button></details>';}
function statsHTML(){const v=game?.view(viewer);if(!v)return '<p>请先开始对局。</p>';const m=connection?room.metrics:game.s.tableMetrics,s=TabletopTesting.summarize(v,m||{});return '<p>'+(s.finished?'本局已结束':'本局进行中')+' · '+escape(api.modeName(v))+'</p><div class="v4-stat-summary"><div><small>对局时长</small><strong>'+TabletopTesting.duration(s.durationMs)+'</strong></div><div><small>玩家回合总数</small><strong>'+s.totalTurns+'</strong></div><div><small>当前时代</small><strong>'+v.era+'</strong></div></div><p class="v4-experiment-hint">时长从开局到结束，包含等待与离线时间。每位玩家的一次行动计一个回合。旧存档没有起始时间时显示“未记录”。</p><h3>时代推进</h3><div class="v4-test-table"><table><thead><tr><th>时代</th><th>首次出现</th><th>涉及玩家回合</th></tr></thead><tbody>'+s.eras.map(e=>'<tr><td>'+e.era+'</td><td>'+(e.firstTurn===0?'开局':'第 '+e.firstTurn+' 回合')+'</td><td>'+e.turns+'</td></tr>').join('')+'</tbody></table></div><p class="v4-experiment-hint">时代可能在回合中途切换，因此两个时代可能涉及同一回合。</p><h3>玩家表现</h3><div class="v4-test-table"><table><thead><tr><th>玩家</th><th>回合</th><th>科研</th><th>科技</th><th>奇观</th></tr></thead><tbody>'+s.players.map(p=>'<tr><td>'+escape(p.name)+'</td><td>'+p.turns+'</td><td>'+p.research+'</td><td>'+p.tech+'</td><td>'+p.wonders+'</td></tr>').join('')+'</tbody></table></div>'+(s.finished?'<p>'+escape(s.winners.join('、')+' · '+s.reason)+'</p>':'')+'<button data-app="game-stats">更新统计</button> <button data-app="export-stats">导出统计摘要</button>';}
async function testingAction(name){
 if(name==='game-stats'){open('stats');return;}
 if(name==='export-stats'){const v=game.view(viewer);download('更迭-对局统计.json',JSON.stringify({format:'更迭对局统计',version:1,mode:api.modeName(v),rules:game.rules(),...TabletopTesting.summarize(v,(connection?room.metrics:game.s.tableMetrics)||{})},null,2));return;}
 if(!name.startsWith('preset-'))return false;
 const list=getPresets(),selected=list.find(p=>p.id===document.getElementById('test-preset')?.value);
 if(['preset-load','preset-copy','preset-import'].includes(name)&&!experimentEditable())throw Error('当前实验参数只读');
 if(name==='preset-load'){if(!selected)throw Error('请先选择方案');modal.args.draft=GameConfig.normalize(selected.rules,DATA,room?.capacity||null);renderModal();notify('已载入草稿，保存实验参数后生效');return;}
 if(name==='preset-import'){fileInput(value=>{if(value?.format!=='更迭实验方案'||value.version!==1)throw Error('不是可用的实验方案');const rules=GameConfig.normalize(value.rules,DATA,room?.capacity||null);modal.args.draft=rules;renderModal();document.getElementById('test-preset-name').value=String(value.name||'导入方案').slice(0,40);notify('已导入草稿，可另存为本机方案');});return;}
 const rules=name==='preset-copy'?(selected?GameConfig.normalize(selected.rules,DATA):null):readExperiment();
 if(name==='preset-copy'&&!rules)throw Error('请先选择方案');
 if(name==='preset-save'||name==='preset-copy'){const title=document.getElementById('test-preset-name').value.trim()||(name==='preset-copy'?selected.name+' 副本':'');if(!title)throw Error('请填写新方案名称');list.push({id:crypto.randomUUID(),name:title.slice(0,40),rules,createdAt:new Date().toISOString()});writePresets(list);modal.args.draft=readExperiment();renderModal();notify('方案已保存到本机');}
 else if(name==='preset-export')download('更迭-实验方案.json',JSON.stringify({format:'更迭实验方案',version:1,name:document.getElementById('test-preset-name').value.trim()||'实验方案',rules},null,2));
 else if(name==='preset-compare')document.getElementById('test-diff').innerHTML=compareHTML(rules);
}

function renderModal(){if(!modal){dialogs.innerHTML='';return;}const {type,args}=modal;let title='',body='';
 if(type==='detail'){const c=cards.get(args.id);if(!c){close();return;}title=c.name;body='<div class="v4-card-detail">'+cardHTML(c.id,game?.s.era||c.era||c.eras?.[0]||1)+'<div><p>'+escape(c.effect||'')+'</p><p>'+escape(c.history||'')+'</p></div></div>';}
 else if(type==='catalog'){title='卡牌与说明书';const resources=[0,1,2].flatMap(t=>[1,2,5,10].map(value=>({id:'R'+t+'-'+value,name:['金币','人力','矿物'][t]+' '+value+'点'})));body='<div class="v4-catalog"><p>卡面均取自《桌游》文件夹；光学与透镜暂以现有原画展示。</p><div class="v4-catalog-cards">'+[...DATA.tech,...DATA.events,...DATA.wonders].map(c=>'<button data-app="card-detail" data-id="'+c.id+'">'+cardHTML(c.id,c.era||c.eras?.[0]||1)+'</button>').join('')+resources.map(c=>'<button data-app="resource-detail" data-id="'+c.id+'"><img src="/'+escape(ASSETS[c.id])+'" alt="'+c.name+'"><b>'+c.name+'</b></button>').join('')+'</div><details><summary>网页内嵌说明书</summary>'+DATA.manual.map(line=>'<p>'+escape(line.text)+'</p>').join('')+'</details></div>';}
 else if(type==='resourceDetail'){const id=args.id,match=/^R([0-2])-(1|2|5|10)$/.exec(id);if(!match){close();return;}title=['金币','人力','矿物'][Number(match[1])]+' '+match[2]+'点';body='<div class="v4-resource-detail"><img src="/'+escape(ASSETS[id])+'" alt="'+escape(title)+'"></div>';}
 else if(type==='rules'){title='本局规则';const rules=game?.rules()||room?.rules||GameConfig.defaults();body='<p>以网页内嵌说明书与正式卡牌为依据。本局资源从混合牌堆抽取。</p><p>最终挑战每骰 '+rules.finalDiePrice+' 科研 · 初始专利骰 '+rules.patentDice+' 枚 · 手牌上限 '+rules.handLimit+' 张</p><button data-app="catalog">查看完整卡牌与说明书</button>';}
 else if(type==='ownedTech'){title='我的科技与奇观';const p=game?.view(viewer).players[viewer];body=p?'<div class="v4-catalog-cards">'+[...p.tech,...p.wonders.map(w=>w.id)].map(id=>'<button data-app="card-detail" data-id="'+id+'">'+cardHTML(id,game.s.era)+'</button>').join('')+'</div>':'<p>当前没有可查看的私人卡牌。</p>';}
 else if(type==='playerCards'){const p=game?.view(viewer).players[args.player];title=p?.name||'玩家公开卡牌';body=p?'<p>科研 '+p.rp+' · 手牌 '+p.handCount+' 张</p><div class="v4-catalog-cards">'+[...p.tech,...p.wonders.map(w=>w.id),...p.events].map(id=>'<button data-app="card-detail" data-id="'+id+'">'+cardHTML(id,game.s.era)+'</button>').join('')+'</div>':'';}
 else if(type==='diceHistory'){title='投骰记录';body=(game?.view(viewer).rolls||[]).slice().reverse().map(r=>'<p><b>'+escape(r.label)+'</b> · '+r.values.join('、')+'<br>'+escape((r.effects||[]).join('；'))+'</p>').join('')||'<p>尚无投骰记录。</p>';}
 else if(type==='roomInfo'){title='联机房间';body='<p data-connection-status>'+escape(status)+'</p><p>房主离开不会关闭房间；轮到离线玩家时会等待其续接。</p><button data-app="network-retry">立即重连</button><p>房间码 '+escape(room.room)+' · '+escape(room.roomName)+'</p><button data-app="copy-invite">复制邀请链接</button>'+(identity?.spectator?'':'<button data-app="export-seat">导出续接凭证</button><button data-app="preferences">个人偏好</button>');}
 else if(type==='preferences'){title='个人操作偏好';const p=connection?room.preferences:prefs();body='<label class="check"><input id="pref-dice" type="checkbox"'+(p.pauseDice?' checked':'')+'>投骰后停留，手动确认收益</label><label class="check"><input id="pref-buy" type="checkbox"'+(p.pausePurchase?' checked':'')+'>科技购买后停留</label><button class="primary" data-app="save-preferences">保存</button>';}
 else if(type==='appearance'){title='外观';const choice=(part,value,label,preview)=>'<button type="button" data-app="visual-set" data-visual="'+part+'" data-value="'+value+'" aria-pressed="'+(visuals[part]===value)+'"><span class="v4-appearance-swatch '+preview+'" aria-hidden="true"></span><span>'+label+'</span></button>';body='<p>只改变你当前设备上的画面，不影响房间内其他玩家。</p><div class="v4-appearance-group"><h3>首页配色</h3><div>'+choice('home','light','米白墨绿','is-home-light')+choice('home','dark','深蓝金色','is-home-dark')+'</div></div><div class="v4-appearance-group"><h3>对局桌面</h3><div>'+choice('table','classic','经典绿毡','is-table-classic')+choice('table','atelier','暖灰亚麻','is-table-atelier')+choice('table','studio','蓝毡胡桃木','is-table-studio')+'</div></div>';}
 else if(type==='experiment'){title='配置实验规则';body=presetHTML(experimentEditable())+experimentForm(args.draft||room?.rules||localOptions.rules,experimentEditable());}
 else if(type==='stats'){title='对局统计';body=statsHTML();}
 else if(type==='localSetup'){title='同机对局设置';body='<label>玩家人数<select id="local-count">'+[2,3,4].map(n=>'<option'+(n===localDraft.count?' selected':'')+'>'+n+'</option>').join('')+'</select></label>'+Array.from({length:4},(_,i)=>'<label>玩家 '+(i+1)+'<input id="local-name-'+i+'" value="'+escape(localDraft.names[i])+'" placeholder="玩家'+(i+1)+'"></label>').join('')+'<label>模式<select id="local-mode">'+[['normal','标准模式'],['quick','疾速模式'],['legend','一战封神'],['experimental','实验模式']].map(([v,label])=>'<option value="'+v+'"'+(v===localDraft.mode?' selected':'')+'>'+label+'</option>').join('')+'</select></label><button data-app="experiment">设置实验数值</button><button class="primary" data-app="start-local">开始同机对局</button>';}
 else if(type==='rooms'){title='公开房间大厅';body='<p>正在加载…</p>';request('rooms').then(x=>{if(modal?.type!=='rooms')return;dialogs.querySelector('.v4-modal-body').innerHTML=x.rooms.map(r=>'<div class="v4-room-row"><b>'+escape(r.name)+'</b><span>'+r.players+'/'+r.capacity+' · '+(r.legend?'一战封神':r.quick?'疾速模式':r.experimental?'实验模式':'标准')+'</span><button data-app="room-select" data-room="'+r.room+'">'+(r.joinable?'加入':r.watchable?'观战':'已满')+'</button></div>').join('')||'<p>目前没有公开房间。</p>';}).catch(e=>notify(e.message));}
 else if(type==='confirmSkip'){title='确认跳过购买';body='<p>本阶段尚未购买科技。确认结束购买阶段？</p><button class="primary" data-app="confirm-skip">确认继续</button>';}
 dialogs.innerHTML='<div class="v4-modal-cover" data-app="close-modal"><section class="v4-modal'+(type==='appearance'?' v4-appearance-modal':type==='experiment'?' v4-experiment-modal':'')+'" role="dialog" aria-modal="true"><header><h2>'+escape(title)+'</h2><button data-app="close-modal" aria-label="关闭">×</button></header><div class="v4-modal-body">'+body+'</div></section></div>';}
async function dispatch(name,target){if(name.startsWith('preset-')||['game-stats','export-stats'].includes(name))return testingAction(name);switch(name){
 case 'network-retry':await connection?.poll();break;
 case 'visual-set':setVisual(target.dataset.visual,target.dataset.value);break;
 case 'visual-home':if(SHOWCASE)window.TableController.home();break;
 case 'visual-table':openShowcaseTable();break;
 case 'close-modal':close();break;case 'wonder-next':void advanceHomeWonder(true);break;case 'wonder-toggle':homeWonderPaused=!homeWonderPaused;target.textContent=homeWonderPaused?'播放':'暂停';target.setAttribute('aria-label',(homeWonderPaused?'播放':'暂停')+'奇观轮播');homeWonderState?.sync();break;case 'scroll-online':document.getElementById('v4-online-entry')?.scrollIntoView({behavior:'smooth'});break;case 'rules':open('rules');break;case 'catalog':open('catalog');break;case 'appearance':open('appearance');break;case 'card-detail':open('detail',{id:target.dataset.id});break;case 'resource-detail':open('resourceDetail',{id:target.dataset.id});break;case 'local-setup':open('localSetup');break;case 'rooms':open('rooms');break;
 case 'create':{const name=document.getElementById('entry-name').value.trim(),mode=document.getElementById('entry-mode').value;const result=await request('create',{name,roomName:document.getElementById('entry-room-name').value.trim()||name+'的房间',capacity:Number(document.getElementById('entry-capacity').value),listed:document.getElementById('entry-listed').checked,allowSpectators:document.getElementById('entry-spectators').checked,quick:mode==='quick',legend:mode==='legend',experimental:mode==='experimental'});connect({room:result.room,token:result.token,seat:result.seat},result);if(mode==='experimental')open('experiment');break;}
 case 'join':case 'watch':{const code=document.getElementById('entry-code')?.value.trim().toUpperCase()||target.dataset.room;if(!code)throw Error('请输入房间码');if(name==='watch'){const result=await request('watch?room='+encodeURIComponent(code));connect({room:code,spectator:true,seat:null},result);}else{const nick=document.getElementById('entry-name')?.value.trim()||prompt('你的昵称');if(!nick)throw Error('请输入昵称');const result=await request('join',{room:code,name:nick});connect({room:code,token:result.token,seat:result.seat},result);}close();break;}
 case 'room-select':{const code=target.dataset.room;const item=await request('rooms');const r=item.rooms.find(x=>x.room===code);if(!r)return;if(r.joinable){const nick=prompt('你的昵称');if(!nick)return;const result=await request('join',{room:code,name:nick});connect({room:code,token:result.token,seat:result.seat},result);}else if(r.watchable){const result=await request('watch?room='+code);connect({room:code,spectator:true,seat:null},result);}close();break;}
 case 'resume-online':{const id=stored();if(!id)throw Error('本机没有联机身份');const result=await request('state?room='+encodeURIComponent(id.room),null,id.token);connect(id,result);break;}
 case 'resume-local':{sessionStorage.setItem(MODE_KEY,'local');const raw=localStorage.getItem(SAVE);if(!raw)throw Error('本机没有存档');game=HistoryGame.restore(DATA,raw);connection?.close();connection=null;room=null;viewer=null;locked=true;render();break;}
 case 'import-save':fileInput(async value=>{if(value?.format==='科技史桌游玩家续接凭证'){if(value.server!==location.origin)throw Error('请在凭证对应的网址使用');const result=await request('state?room='+value.room,null,value.token);connect({room:value.room,token:value.token,seat:result.seat},result);}else{game=HistoryGame.restore(DATA,JSON.stringify(value));connection?.close();connection=null;room=null;viewer=null;locked=true;save();render();}});break;
 case 'start-local':{const count=Number(document.getElementById('local-count').value),names=Array.from({length:count},(_,i)=>document.getElementById('local-name-'+i).value.trim()||'玩家'+(i+1)),mode=target.dataset.mode||document.getElementById('local-mode')?.value||'normal';localNew(names,{quick:mode==='quick',legend:mode==='legend',experimental:mode==='experimental',rules:localOptions.rules});close();break;}
 case 'copy-code':await navigator.clipboard.writeText(room.room);notify('房间码已复制');break;case 'copy-invite':await navigator.clipboard.writeText(location.origin+'/?room='+room.room);notify('邀请链接已复制');break;
 case 'export-seat':{if(!identity?.token)throw Error('观战者没有玩家凭证');download('更迭-玩家续接凭证.json',JSON.stringify({format:'科技史桌游玩家续接凭证',room:identity.room,token:identity.token,server:location.origin}));break;}
 case 'leave':sessionStorage.setItem(MODE_KEY,'home');connection?.close();connection=null;room=null;game=null;viewer=null;render();break;
 case 'ready':await connection.lobby('ready',{ready:!room.seats[room.seat].ready});break;case 'start-room':await connection.lobby('start');break;
 case 'save-mode':{const mode=document.getElementById('lobby-mode').value;await connection.lobby('mode',{quick:mode==='quick',legend:mode==='legend',experimental:mode==='experimental',version:room.rulesVersion});break;}
 case 'save-room':await connection.lobby('rename',{roomName:document.getElementById('lobby-name').value,listed:document.getElementById('lobby-listed').checked,allowSpectators:document.getElementById('lobby-spectators').checked});break;
 case 'preferences':open('preferences');break;case 'save-preferences':{const p={pauseDice:document.getElementById('pref-dice').checked,pausePurchase:document.getElementById('pref-buy').checked};if(connection)await connection.lobby('preferences',p);else localStorage.setItem(PREF,JSON.stringify(p));close();break;}
 case 'experiment':{const returnTo=modal?.type==='localSetup'?'localSetup':null;if(returnTo)localDraft={count:Number(document.getElementById('local-count').value),names:Array.from({length:4},(_,i)=>document.getElementById('local-name-'+i).value),mode:document.getElementById('local-mode').value};open('experiment',{returnTo});break;}
 case 'reset-experiment':{if(!experimentEditable())throw Error('当前实验参数只读');modal.args.draft=GameConfig.defaults();renderModal();notify('草稿已恢复默认值，保存后生效');break;}
 case 'save-experiment':{if(!experimentEditable())throw Error('当前实验参数只读');const r=readExperiment();if(connection)await connection.lobby('rules',{rules:r,version:modal.args.rulesVersion});else{localStorage.setItem(DRAFT_KEY,JSON.stringify(r));localOptions.rules=r;}close();notify('实验参数已保存');break;}
 case 'confirm-skip':close();await act('next');break;
 }}
document.addEventListener('click',async e=>{const target=e.target.closest('[data-app]');if(!target)return;if(target.dataset.app==='close-modal'&&e.target!==target&&target.classList.contains('v4-modal-cover'))return;try{await dispatch(target.dataset.app,target);}catch(error){notify(error.message);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal)close();});
document.addEventListener('change',e=>{if(e.target.id==='local-count')document.querySelectorAll('[data-local-player]').forEach(node=>node.hidden=Number(node.dataset.localPlayer)>=Number(e.target.value));});
window.TableController.reveal=()=>{if(!game||connection)return;viewer=game.s.pending?.actor??game.s.active;locked=false;render();};
window.TableController.isLocked=()=>locked&&!connection;
window.TableController.skip=()=>open('confirmSkip');
window.TableController.home=()=>{sessionStorage.setItem(MODE_KEY,'home');connection?.close();connection=null;room=null;game=null;viewer=null;locked=false;modal=null;render();};
if(SHOWCASE){
 document.body.classList.add('v4-showcase-mode');
 openShowcaseTable();
}else{
 try{const raw=localStorage.getItem(SAVE);if(raw){game=HistoryGame.restore(DATA,raw);viewer=null;locked=true;}}catch{}
 const previous=stored(),invitedRoom=new URLSearchParams(location.search).get('room')?.toUpperCase();
 if(invitedRoom&&previous?.room!==invitedRoom){game=null;render();document.getElementById('entry-code').value=invitedRoom;}
 else if(sessionStorage.getItem(MODE_KEY)==='home'){game=null;render();}
 else if(sessionStorage.getItem(MODE_KEY)==='local'&&game)render();
 else if(previous?.room&&previous?.token)connect(previous);
 else if(invitedRoom){game=null;render();document.getElementById('entry-code').value=invitedRoom;}
 else render();
}
})();
