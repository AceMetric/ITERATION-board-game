import Testing from '../../src/tabletop-v4-testing.js';
import { digest, hex, randomBytes, secureRandom, token } from './crypto.mjs';
import { RoomStore } from './storage.mjs';

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const playerName=x=>{if(typeof x!=='string'||!x.trim()||x.trim().length>24)fail('昵称需要1至24个字符');return x.trim();};
const roomName=x=>{if(typeof x!=='string'||!x.trim()||x.trim().length>40)fail('房间名需要1至40个字符');return x.trim();};
const storage=async fn=>{try{return await fn();}catch(error){console.error('Game storage failure:',error?.name||'Error');fail('联机存储暂时不可用，请稍后重试；已保存的对局会保留',503);}};
const response=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
async function readBody(request){
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))fail('需要JSON请求',415);
  if(Number(request.headers.get('content-length'))>32768)fail('请求过大',413);
  const reader=request.body?.getReader();let size=0;const chunks=[];
  if(reader)for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();fail('请求过大',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||Array.isArray(value)||typeof value!=='object')fail('请求格式错误');return value;}catch{fail('请求格式错误');}
}

export function createWorker(data,{HistoryGame,Flow,Config},options={}) {
  // JSON persistence loses object identity. Preserve the original engine's shared
  // lastRoll / rolls entry so later confirmations update both views as in Node.
  const serialize=r=>({...r,rollAlias:!!(r.game?.s.lastRoll&&r.game.s.lastRoll===r.game.s.rolls?.find(x=>x.id===r.game.s.lastRoll.id)),game:r.game?JSON.parse(r.game.export()):null});
  const restore=r=>{if(r?.game){r.game=HistoryGame.restore(data,JSON.stringify(r.game));if(r.rollAlias&&r.game.s.lastRoll){const roll=r.game.s.rolls?.find(x=>x.id===r.game.s.lastRoll.id);if(roll)r.game.s.lastRoll=roll;}if(r.game.s.onlineRandom)secureRandom(r.game);}return r;};
  const snapshot=(r,seat)=>({quick:!!r.quick,legend:!!r.legend,allowSpectators:r.allowSpectators===true,spectator:seat===null,room:r.id,experimental:!!r.experimental,roomName:r.roomName||r.seats[0].name+'的房间',listed:!!r.listed,createdAt:r.createdAt,startedAt:r.startedAt||null,metrics:r.metrics||null,seat,host:seat===0,capacity:r.capacity,version:r.version,started:!!r.game,rulesVersion:r.rulesVersion||0,rules:r.game?r.game.rules():(r.legend?Config.legendRules():r.experimental?r.rules:Config.defaults()),preferences:{pauseDice:r.seats[seat]?.pauseDice!==false,pausePurchase:r.seats[seat]?.pausePurchase!==false},seats:r.seats.map((s,i)=>({name:s.name,seat:i,ready:s.ready,online:Date.now()-s.seen<15000})),...(r.game?{view:r.game.view(seat),quotes:seat===null?{research:{},events:{},available:[]}:Flow.quotes(r.game,seat)}:{})});
  function authenticate(request,r){
    if(!r)fail('房间不存在，请核对房间码',404);
    const t=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
    if(!/^[\w-]{43}$/.test(t))fail('需要有效的玩家身份',401);
    const hash=digest(t),seat=r.seats.findIndex(s=>s.hash===hash);
    if(seat<0)fail('玩家身份已失效',401);r.seats[seat].seen=Date.now();return seat;
  }
  async function mutate(store,id,change){
    for(let attempt=0;attempt<8;attempt++){
      const r=restore(await storage(()=>store.get(id)));if(!r)fail('房间不存在',404);
      const version=r.version,result=await change(r);
      if(result.unchanged)return result.value;
      if(await storage(()=>store.save(serialize(r),version)))return result.value;
    }
    fail('房间正在同步其他玩家的操作，请稍后重试',409);
  }
  return {async fetch(request,env,ctx){
    void ctx;
    try{
      const u=new URL(request.url);
      if(request.method==='GET'&&u.pathname==='/health')return response(200,{ok:true});
      if(!u.pathname.startsWith('/api/')){
        if(env.ASSETS?.fetch)return env.ASSETS.fetch(request);
        return new Response('Not found',{status:404});
      }
      const origin=request.headers.get('origin');if(origin){let originUrl;try{originUrl=new URL(origin);}catch{fail('不接受跨站请求',403);}if(originUrl.origin!==u.origin)fail('不接受跨站请求',403);}
      if(!env.DB)fail('联机服务尚未完成数据库配置',503);
      const store=new RoomStore(env.DB),now=Date.now(),caller=digest(request.headers.get('cf-connecting-ip')||'local-client');
      const rate=async(kind,max)=>{if(!await storage(()=>store.rate(caller+':'+kind,Math.floor(now/60000),max)))fail('操作过于频繁，请稍后重试',429);};
      await rate('all',options.rateLimit||600);
      if(request.method==='GET'&&u.pathname==='/api/state'){
        const r=restore(await storage(()=>store.get(u.searchParams.get('room')))),seat=authenticate(request,r);
        await storage(()=>store.touch(r.id,seat,r.seats[seat].seen));return response(200,snapshot(r,seat));
      }
      if(request.method==='GET'&&u.pathname==='/api/watch'){
        const r=restore(await storage(()=>store.get(String(u.searchParams.get('room')).toUpperCase())));
        if(!r)fail('房间不存在',404);if(r.allowSpectators!==true)fail('房主未允许观战或已关闭观战',403);return response(200,snapshot(r,null));
      }
      if(request.method==='GET'&&u.pathname==='/api/rooms'){
        const rooms=(await storage(()=>store.list())).map(r=>({room:r.id,name:r.roomName||r.seats[0].name+'的房间',quick:!!r.quick,legend:!!r.legend,watchable:r.allowSpectators===true,started:!!r.game,experimental:!!r.experimental,players:r.seats.length,capacity:r.capacity,joinable:!r.game&&r.seats.length<r.capacity})).sort((a,b)=>a.name.localeCompare(b.name));
        return response(200,{rooms});
      }
      if(request.method!=='POST')fail('不支持的请求',405);const a=await readBody(request);
      if(u.pathname==='/api/create'){
        await rate('create',10);
        if(a.legend!==undefined&&typeof a.legend!=='boolean')fail('一战封神开关无效');if(a.legend&&(a.quick||a.experimental))fail('一战封神不能与疾速或实验规则叠加');
        if(a.quick!==undefined&&typeof a.quick!=='boolean')fail('疾速模式开关无效');if(a.allowSpectators!==undefined&&typeof a.allowSpectators!=='boolean')fail('观战开关无效');if(a.experimental!==undefined&&typeof a.experimental!=='boolean')fail('实验模式开关无效');
        if(!Number.isInteger(a.capacity)||a.capacity<2||a.capacity>4)fail('支持2至4人');
        const id=hex(randomBytes(5)).toUpperCase(),t=token();
        const r={id,legend:a.legend===true,quick:a.quick===true,allowSpectators:a.allowSpectators!==false,roomName:roomName(a.roomName===undefined?playerName(a.name)+'的房间':a.roomName),listed:a.listed===true,experimental:a.experimental===true,rules:Config.normalize(a.legend?Config.legendRules():a.experimental===true?(a.rules||{}):{},data,a.capacity),capacity:a.capacity,version:1,seats:[{name:playerName(a.name),hash:digest(t),ready:true,seen:now}],game:null,receipts:[],createdAt:new Date(now).toISOString()};
        if(!await storage(()=>store.insert(r,options.maxRooms||200)))fail('服务器房间已满，请联系管理员',503);
        return response(200,{...snapshot(r,0),token:t});
      }
      if(u.pathname==='/api/join'){
        await rate('join',30);const t=token(),n=playerName(a.name);
        const result=await mutate(store,String(a.room).toUpperCase(),r=>{
          if(r.game||r.seats.length>=r.capacity)fail('房间已开始或已满');if(r.seats.some(s=>s.name===n))fail('该昵称已在房间，请更换昵称或使用身份凭证续接');
          r.seats.push({name:n,hash:digest(t),ready:false,seen:Date.now()});r.version++;
          return {value:{...snapshot(r,r.seats.length-1),token:t}};
        });return response(200,result);
      }
      // Every mutation reloads and validates inside its compare-and-swap loop.
      // Concurrent duplicate commands converge on the persisted receipt.
      const result=await mutate(store,a.room,async r=>{
        const seat=authenticate(request,r);await storage(()=>store.touch(r.id,seat,r.seats[seat].seen));
        if(u.pathname==='/api/mode'){
          if(seat!==0)fail('仅房主可切换模式',403);if(r.game)fail('已开局，不能切换模式');if(typeof a.experimental!=='boolean')fail('实验模式开关无效');if(a.quick!==undefined&&typeof a.quick!=='boolean')fail('疾速模式开关无效');if(a.legend!==undefined&&typeof a.legend!=='boolean')fail('一战封神开关无效');
          const legend=a.legend===undefined?!!r.legend:a.legend;if(legend&&(a.experimental||(a.quick===undefined?r.quick:a.quick)))fail('一战封神不能与疾速或实验规则叠加');if(a.version!==(r.rulesVersion||0))fail('房间规则已有更新，请重试',409);
          if(r.experimental)r.experimentalRules=r.rules;r.experimental=a.experimental;r.legend=legend;if(a.quick!==undefined)r.quick=a.quick;r.rules=r.legend?Config.legendRules():r.experimental?Config.normalize(r.experimentalRules||{},data,r.capacity):Config.defaults();r.rulesVersion=(r.rulesVersion||0)+1;r.seats.forEach(s=>s.ready=false);
        }else if(u.pathname==='/api/rules'){
          if(seat!==0)fail('仅房主可修改实验规则',403);if(r.game)fail('已开局，实验规则不能中途修改');if(!r.experimental)fail('请先勾选启用实验性模式');if(a.version!==(r.rulesVersion||0))fail('房间规则已有更新，请重新打开实验设置',409);
          r.rules=Config.normalize(a.rules,data,r.capacity);r.rulesVersion=(r.rulesVersion||0)+1;r.seats.forEach(s=>s.ready=false);
        }else if(u.pathname==='/api/rename'){
          if(seat!==0)fail('仅房主可修改房间名称',403);const n=roomName(a.roomName);if(a.allowSpectators!==undefined&&typeof a.allowSpectators!=='boolean')fail('观战开关无效');if(typeof a.listed!=='boolean')fail('大厅展示设置无效');
          r.roomName=n;r.listed=a.listed;if(a.allowSpectators!==undefined)r.allowSpectators=a.allowSpectators;
        }else if(u.pathname==='/api/preferences'){
          if(typeof a.pauseDice!=='boolean'||(a.pausePurchase!==undefined&&typeof a.pausePurchase!=='boolean'))fail('设置值无效');r.seats[seat].pauseDice=a.pauseDice;if(a.pausePurchase!==undefined)r.seats[seat].pausePurchase=a.pausePurchase;
        }else if(u.pathname==='/api/ready'){
          if(r.game)fail('本局已经开始');r.seats[seat].ready=!!a.ready;
        }else if(u.pathname==='/api/start'){
          if(seat!==0)fail('仅房主可开始',403);if(r.game)fail('本局已经开始');if(r.seats.length!==r.capacity||r.seats.some(s=>!s.ready||Date.now()-s.seen>=15000))fail('请等待所有玩家到齐、在线并准备');
          r.game=secureRandom(new HistoryGame(data));const bytes=randomBytes(4);r.game.newGame(r.seats.map(s=>s.name),new DataView(bytes.buffer).getUint32(0,true),r.experimental?r.rules:Config.defaults(),{quick:!!r.quick,legend:!!r.legend});r.game.s.experimental=!!r.experimental;r.startedAt=new Date().toISOString();r.game.s.historyId='online-'+r.id;Flow.advance(r.game);
        }else if(u.pathname==='/api/command'){
          if(!r.game)fail('对局尚未开始');if(typeof a.id!=='string'||!/^[\w-]{16,80}$/.test(a.id))fail('操作编号无效');
          const signature=digest(JSON.stringify({type:a.type,args:a.args,revision:a.revision})),prior=r.receipts.find(x=>x.id===a.id&&x.seat===seat);
          if(prior){if(prior.signature!==signature)fail('操作编号已使用',409);return {unchanged:true,value:snapshot(r,seat)};}
          if(a.revision!==r.game.s.revision)fail('桌面已有更新，请重试当前操作',409);if(!a.args||Array.isArray(a.args)||typeof a.args!=='object')fail('操作参数错误');
          Flow.command(r.game,seat,a.type,a.args);Flow.advance(r.game,{pauseDice:r.seats[r.game.s.active].pauseDice!==false,pausePurchase:r.seats[r.game.s.active].pausePurchase!==false});
          r.receipts.push({id:a.id,seat,signature});if(r.receipts.length>1000)r.receipts.shift();
        }else fail('接口不存在',404);
        if(r.game)r.metrics=Testing.observe(r.metrics,r.game.view(),r.startedAt);
        r.version++;return {value:snapshot(r,seat)};
      });return response(200,result);
    }catch(error){return response(error.status||400,{error:error.message});}
  }};
}
