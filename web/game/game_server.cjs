'use strict';
// Same-origin, server-authoritative turn transport. No third-party runtime dependencies.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {HistoryGame}=require('./game_engine.js'),Flow=require('./game_flow.js'),Config=require('./game_config.js');
function createServer(options={}){
 const base=options.base||__dirname,data=options.data||JSON.parse(fs.readFileSync(path.join(base,'game_data.json'),'utf8'));
 const saveDir=options.saveDir||process.env.GAME_SAVE_DIR||path.join(base,'rooms');fs.mkdirSync(saveDir,{recursive:true,mode:0o700});
 const html=options.html||path.resolve(base,'../科技史桌游.html'),rooms=new Map(),limits=new Map(),maxRooms=Number(process.env.MAX_ROOMS||200);
 const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
 const token=()=>crypto.randomBytes(32).toString('base64url');
 // Online randomness is deterministic for saved games, but not reconstructible from public dice.
 function secureRandom(g){g.rand=function(n){const r=this.s.onlineRandom||(this.s.onlineRandom={key:crypto.randomBytes(32).toString('hex'),counter:0});const limit=Math.floor(0x100000000/n)*n;let x;do{x=crypto.createHmac('sha256',Buffer.from(r.key,'hex')).update(String(r.counter++)).digest().readUInt32LE(0);}while(x>=limit);return x%n;};return g;}
 function restoreGame(value){const g=HistoryGame.restore(data,JSON.stringify(value));return g.s.onlineRandom?secureRandom(g):g;}
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
 const filename=id=>path.join(saveDir,id+'.json');
 for(const f of fs.readdirSync(saveDir).filter(f=>/^[A-F0-9]{10}\.json$/.test(f))){const r=JSON.parse(fs.readFileSync(path.join(saveDir,f),'utf8'));if(r.game){r.game=restoreGame(r.game);}r.experimental=typeof r.experimental==='boolean'?r.experimental:(r.game?!!r.game.view().experimental:!Config.isDefault(Config.normalize(r.rules||{},data,r.capacity)));r.seats.forEach(s=>s.seen=0);rooms.set(r.id,r);}
 function persist(r){const value={...r,game:r.game?JSON.parse(r.game.export()):null},file=filename(r.id),tmp=file+'.tmp';const fd=fs.openSync(tmp,'w',0o600);try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,file);}
 function transaction(r,fn){const before=JSON.stringify({...r,game:r.game?JSON.parse(r.game.export()):null});try{fn();persist(r);}catch(e){const old=JSON.parse(before);if(old.game)old.game=restoreGame(old.game);rooms.set(r.id,old);throw e;}}
 function snapshot(r,seat){return {quick:!!r.quick,legend:!!r.legend,allowSpectators:r.allowSpectators===true,spectator:seat===null,room:r.id,experimental:!!r.experimental,roomName:r.roomName||r.seats[0].name+'的房间',listed:!!r.listed,createdAt:r.createdAt,startedAt:r.startedAt||null,seat,host:seat===0,capacity:r.capacity,version:r.version,started:!!r.game,rulesVersion:r.rulesVersion||0,rules:r.game?r.game.rules():(r.legend?Config.legendRules():r.experimental?r.rules:Config.defaults()),preferences:{pauseDice:r.seats[seat]?.pauseDice!==false,pausePurchase:r.seats[seat]?.pausePurchase!==false},seats:r.seats.map((s,i)=>({name:s.name,seat:i,ready:s.ready,online:Date.now()-s.seen<15000})),...(r.game?{view:r.game.view(seat),quotes:seat===null?{research:{},events:{},available:[]}:Flow.quotes(r.game,seat)}:{})};}
 function auth(req,id){const r=rooms.get(id);if(!r)fail('房间不存在，请核对房间码',404);const t=(req.headers.authorization||'').replace(/^Bearer /,'');if(!/^[\w-]{43}$/.test(t))fail('需要有效的玩家身份',401);const h=digest(t),seat=r.seats.findIndex(s=>s.hash===h);if(seat<0)fail('玩家身份已失效',401);r.seats[seat].seen=Date.now();return {r,seat};}
 function roomName(x){if(typeof x!=='string'||!x.trim()||x.trim().length>40)fail('房间名需要1至40个字符');return x.trim();}
 function name(x){if(typeof x!=='string'||!x.trim()||x.trim().length>24)fail('昵称需要1至24个字符');return x.trim();}
 function rate(req,kind,max){const key=req.socket.remoteAddress+':'+kind,now=Date.now();let n=limits.get(key);if(!n||now-n.time>60000){n={time:now,count:0};limits.set(key,n);}if(++n.count>max)fail('操作过于频繁，请稍后重试',429);if(limits.size>10000)for(const [k,v]of limits)if(now-v.time>60000)limits.delete(k);}
 async function body(req){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))fail('需要JSON请求',415);let b='',size=0;for await(const c of req){size+=c.length;if(size>32768)fail('请求过大',413);b+=c;}try{const v=JSON.parse(b);if(!v||Array.isArray(v)||typeof v!=='object')fail('请求格式错误');return v;}catch{fail('请求格式错误');}}
 function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try{const u=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});fs.createReadStream(html).on('error',()=>res.destroy()).pipe(res);return;}
   if(req.method==='GET'&&u.pathname==='/health'){send(res,200,{ok:true});return;}
   if(!u.pathname.startsWith('/api/'))fail('页面不存在',404);
   // No CORS: browsers may only submit authenticated JSON requests from this origin.
   if(req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host)fail('不接受跨站请求',403);}
   rate(req,'all',options.rateLimit||600);
   if(req.method==='GET'&&u.pathname==='/api/state'){const {r,seat}=auth(req,u.searchParams.get('room'));send(res,200,snapshot(r,seat));return;}
   if(req.method==='GET'&&u.pathname==='/api/watch'){const r=rooms.get(String(u.searchParams.get('room')).toUpperCase());if(!r)fail('房间不存在',404);if(r.allowSpectators!==true)fail('房主未允许观战或已关闭观战',403);send(res,200,snapshot(r,null));return;}
   if(req.method==='GET'&&u.pathname==='/api/rooms'){send(res,200,{rooms:[...rooms.values()].filter(r=>r.listed&&(!r.game||r.allowSpectators===true)&&Date.now()-r.seats[0].seen<15000).map(r=>({room:r.id,name:r.roomName||r.seats[0].name+'的房间',quick:!!r.quick,legend:!!r.legend,watchable:r.allowSpectators===true,started:!!r.game,experimental:!!r.experimental,players:r.seats.length,capacity:r.capacity,joinable:!r.game&&r.seats.length<r.capacity})).sort((a,b)=>a.name.localeCompare(b.name))});return;}
   if(req.method!=='POST')fail('不支持的请求',405);const a=await body(req);
   if(u.pathname==='/api/create'){
    rate(req,'create',10);if(a.legend!==undefined&&typeof a.legend!=='boolean')fail('一战封神开关无效');if(a.legend&&(a.quick||a.experimental))fail('一战封神不能与疾速或实验规则叠加');if(a.quick!==undefined&&typeof a.quick!=='boolean')fail('疾速模式开关无效');if(a.allowSpectators!==undefined&&typeof a.allowSpectators!=='boolean')fail('观战开关无效');if(a.experimental!==undefined&&typeof a.experimental!=='boolean')fail('实验模式开关无效');if(rooms.size>=maxRooms)fail('服务器房间已满，请联系管理员',503);if(!Number.isInteger(a.capacity)||a.capacity<2||a.capacity>4)fail('支持2至4人');
    let id;do{id=crypto.randomBytes(5).toString('hex').toUpperCase();}while(rooms.has(id));const t=token(),r={id,legend:a.legend===true,quick:a.quick===true,allowSpectators:a.allowSpectators!==false,roomName:roomName(a.roomName===undefined?name(a.name)+'的房间':a.roomName),listed:a.listed===true,experimental:a.experimental===true,rules:Config.normalize(a.legend?Config.legendRules():a.experimental===true?(a.rules||{}):{},data,a.capacity),capacity:a.capacity,version:1,seats:[{name:name(a.name),hash:digest(t),ready:true,seen:Date.now()}],game:null,receipts:[],createdAt:new Date().toISOString()};persist(r);rooms.set(id,r);send(res,200,{...snapshot(r,0),token:t});return;
   }
   if(u.pathname==='/api/join'){
    rate(req,'join',30);const r=rooms.get(String(a.room).toUpperCase());if(!r)fail('房间不存在',404);if(r.game||r.seats.length>=r.capacity)fail('房间已开始或已满');const n=name(a.name);if(r.seats.some(s=>s.name===n))fail('该昵称已在房间，请更换昵称或使用身份凭证续接');const t=token();transaction(r,()=>{r.seats.push({name:n,hash:digest(t),ready:false,seen:Date.now()});r.version++;});send(res,200,{...snapshot(r,r.seats.length-1),token:t});return;
   }
   const {r,seat}=auth(req,a.room);
   if(u.pathname==='/api/mode'){if(seat!==0)fail('仅房主可切换模式',403);if(r.game)fail('已开局，不能切换模式');if(typeof a.experimental!=='boolean')fail('实验模式开关无效');if(a.quick!==undefined&&typeof a.quick!=='boolean')fail('疾速模式开关无效');if(a.legend!==undefined&&typeof a.legend!=='boolean')fail('一战封神开关无效');const legend=a.legend===undefined?!!r.legend:a.legend;if(legend&&(a.experimental||(a.quick===undefined?r.quick:a.quick)))fail('一战封神不能与疾速或实验规则叠加');if(a.version!==(r.rulesVersion||0))fail('房间规则已有更新，请重试',409);transaction(r,()=>{if(r.experimental)r.experimentalRules=r.rules;r.experimental=a.experimental;r.legend=legend;if(a.quick!==undefined)r.quick=a.quick;r.rules=r.legend?Config.legendRules():r.experimental?Config.normalize(r.experimentalRules||{},data,r.capacity):Config.defaults();r.rulesVersion=(r.rulesVersion||0)+1;r.seats.forEach(s=>s.ready=false);r.version++;});send(res,200,snapshot(r,seat));return;}
   if(u.pathname==='/api/rules'){if(seat!==0)fail('仅房主可修改实验规则',403);if(r.game)fail('已开局，实验规则不能中途修改');if(!r.experimental)fail('请先勾选启用实验性模式');if(a.version!==(r.rulesVersion||0))fail('房间规则已有更新，请重新打开实验设置',409);const rules=Config.normalize(a.rules,data,r.capacity);transaction(r,()=>{r.rules=rules;r.rulesVersion=(r.rulesVersion||0)+1;r.seats.forEach(s=>s.ready=false);r.version++;});send(res,200,snapshot(r,seat));return;}
   if(u.pathname==='/api/rename'){if(seat!==0)fail('仅房主可修改房间名称',403);const n=roomName(a.roomName);if(a.allowSpectators!==undefined&&typeof a.allowSpectators!=='boolean')fail('观战开关无效');if(typeof a.listed!=='boolean')fail('大厅展示设置无效');transaction(r,()=>{r.roomName=n;r.listed=a.listed;if(a.allowSpectators!==undefined)r.allowSpectators=a.allowSpectators;r.version++;});send(res,200,snapshot(r,seat));return;}
   if(u.pathname==='/api/preferences'){if(typeof a.pauseDice!=='boolean'||(a.pausePurchase!==undefined&&typeof a.pausePurchase!=='boolean'))fail('设置值无效');transaction(r,()=>{r.seats[seat].pauseDice=a.pauseDice;if(a.pausePurchase!==undefined)r.seats[seat].pausePurchase=a.pausePurchase;r.version++;});send(res,200,snapshot(r,seat));return;}
   if(u.pathname==='/api/ready'){if(r.game)fail('本局已经开始');transaction(r,()=>{r.seats[seat].ready=!!a.ready;r.version++;});send(res,200,snapshot(r,seat));return;}
   if(u.pathname==='/api/start'){if(seat!==0)fail('仅房主可开始',403);if(r.game)fail('本局已经开始');if(r.seats.length!==r.capacity||r.seats.some(s=>!s.ready||Date.now()-s.seen>=15000))fail('请等待所有玩家到齐、在线并准备');transaction(r,()=>{r.game=secureRandom(new HistoryGame(data));r.game.newGame(r.seats.map(s=>s.name),crypto.randomBytes(4).readUInt32LE(),r.experimental?r.rules:Config.defaults(),{quick:!!r.quick,legend:!!r.legend});r.game.s.experimental=!!r.experimental;r.startedAt=new Date().toISOString();r.game.s.historyId='online-'+r.id;Flow.advance(r.game);r.version++;});send(res,200,snapshot(r,seat));return;}
   if(u.pathname==='/api/command'){
    if(!r.game)fail('对局尚未开始');if(typeof a.id!=='string'||!/^[\w-]{16,80}$/.test(a.id))fail('操作编号无效');const signature=digest(JSON.stringify({type:a.type,args:a.args,revision:a.revision})),prior=r.receipts.find(x=>x.id===a.id&&x.seat===seat);
    if(prior){if(prior.signature!==signature)fail('操作编号已使用',409);send(res,200,snapshot(r,seat));return;}
    if(a.revision!==r.game.s.revision)fail('桌面已有更新，请重试当前操作',409);
    if(!a.args||Array.isArray(a.args)||typeof a.args!=='object')fail('操作参数错误');
    transaction(r,()=>{Flow.command(r.game,seat,a.type,a.args);Flow.advance(r.game,{pauseDice:r.seats[r.game.s.active].pauseDice!==false,pausePurchase:r.seats[r.game.s.active].pausePurchase!==false});r.version++;r.receipts.push({id:a.id,seat,signature});if(r.receipts.length>1000)r.receipts.shift();});send(res,200,snapshot(r,seat));return;
   }
   fail('接口不存在',404);
  }catch(e){if(!res.headersSent)send(res,e.status||400,{error:e.code?'服务器读写失败，请联系管理员':e.message});else res.end();}
 });server.requestTimeout=15000;server.headersTimeout=10000;return server;
}
if(require.main===module){const server=createServer();const port=Number(process.env.PORT||8787),host=process.env.HOST||'127.0.0.1';server.listen(port,host,()=>console.log('科技史桌游联机服务已启动：http://'+host+':'+port+'（公网使用请配置HTTPS）'));}
module.exports={createServer};
