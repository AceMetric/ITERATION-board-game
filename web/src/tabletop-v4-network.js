/* Retry the same persisted command ID; never apply stale or closed responses. */
(function(root){
'use strict';
class RoomConnection{
 constructor(id,{request,save,onSnapshot,onStatus,onError=()=>{},schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}){Object.assign(this,{id,request,save,onSnapshot,onStatus,onError,schedule,cancel});this.closed=false;this.busy=false;this.polling=false;this.pending=id.pending||null;this.version=-1;this.timer=null;this.status='正在连接';}
 setStatus(value){if(this.closed)return;this.status=value;this.onStatus(value);}
 store(){if(!this.closed&&!this.id.spectator)this.save({...this.id,pending:this.pending});}
 accept(snapshot){if(this.closed||snapshot.version<this.version)return;this.version=snapshot.version;this.status=this.pending?'正在确认操作':'已连接';this.onSnapshot(snapshot);this.onStatus(this.status);}
 async poll(){if(this.closed||this.polling)return;this.cancel(this.timer);this.polling=true;try{if(this.pending&&!this.busy)await this.retry();else if(!this.busy)this.accept(await this.request((this.id.spectator?'watch':'state')+'?room='+encodeURIComponent(this.id.room),null,this.id.token));}catch(e){if(this.closed)return;this.setStatus(e.status===401?'身份凭证已失效':e.status===403||e.status===404?e.message:'连接中断，正在重连');this.onError(e);}finally{this.polling=false;if(!this.closed)this.timer=this.schedule(()=>this.poll(),1600);}}
 async retry(){if(this.closed||this.busy||!this.pending)return;this.busy=true;this.setStatus('正在确认操作');try{const snap=await this.request('command',this.pending,this.id.token);if(this.closed)return;this.pending=null;this.store();this.accept(snap);}catch(e){if(this.closed)return;if(e.status&&e.status<500&&e.status!==429){this.pending=null;this.store();this.setStatus('正在重新同步');const fresh=await this.request('state?room='+encodeURIComponent(this.id.room),null,this.id.token);this.accept(fresh);throw e;}this.setStatus('操作结果待确认，正在重连；请勿重复提交');}finally{this.busy=false;}}
 async command(type,args,revision){if(this.closed)throw Error('房间连接已关闭');if(this.id.spectator)throw Error('观战者不能操作');if(this.pending||this.busy)throw Error('上一项操作仍在确认');if(this.status!=='已连接')throw Error('正在重新连接，请等待同步完成');const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);this.pending={room:this.id.room,type,args,revision,id:Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('')};this.store();await this.retry();}
 async lobby(route,args={}){if(this.closed||this.busy||this.pending)throw Error('正在提交上一项操作');this.busy=true;try{this.accept(await this.request(route,{room:this.id.room,...args},this.id.token));}finally{this.busy=false;}}
 close(){this.closed=true;this.cancel(this.timer);}
}
if(typeof module!=='undefined'&&module.exports)module.exports=RoomConnection;else root.TabletopRoomConnection=RoomConnection;
})(typeof window==='undefined'?globalThis:window);
