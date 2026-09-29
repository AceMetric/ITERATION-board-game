// D1 is the authority; no room state or player presence is cached in Worker memory.
export class RoomStore {
  constructor(db){this.db=db.withSession?db.withSession('first-primary'):db;}
  async get(id){
    const row=await this.db.prepare('SELECT version, payload FROM game_rooms WHERE id = ?').bind(id).first();
    if(!row)return null;
    const r=JSON.parse(row.payload);
    if(r.version!==row.version)throw new Error('房间数据版本不一致');
    const presence=await this.db.prepare('SELECT seat, seen FROM game_presence WHERE room_id = ?').bind(id).all();
    for(const p of presence.results||[])if(r.seats[p.seat])r.seats[p.seat].seen=Math.max(r.seats[p.seat].seen||0,p.seen);
    return r;
  }
  async insert(r,maxRooms){
    const result=await this.db.prepare('INSERT INTO game_rooms (id, version, payload, listed, started, allow_spectators, host_seen, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM game_rooms) < ? ON CONFLICT(id) DO NOTHING')
      .bind(r.id,r.version,JSON.stringify(r),+!!r.listed,+!!r.game,+!!r.allowSpectators,r.seats[0].seen,Date.now(),maxRooms).run();
    return result.meta.changes===1;
  }
  async save(r,version){
    const result=await this.db.prepare('UPDATE game_rooms SET version = ?, payload = ?, listed = ?, started = ?, allow_spectators = ?, host_seen = ?, updated_at = ? WHERE id = ? AND version = ?')
      .bind(r.version,JSON.stringify(r),+!!r.listed,+!!r.game,+!!r.allowSpectators,r.seats[0].seen,Date.now(),r.id,version).run();
    return result.meta.changes===1;
  }
  async touch(id,seat,seen){
    await this.db.prepare('INSERT INTO game_presence (room_id, seat, seen) VALUES (?, ?, ?) ON CONFLICT(room_id, seat) DO UPDATE SET seen = MAX(seen, excluded.seen)').bind(id,seat,seen).run();
  }
  async list(){
    const rows=await this.db.prepare('SELECT r.payload FROM game_rooms r LEFT JOIN game_presence p ON p.room_id = r.id AND p.seat = 0 WHERE r.listed = 1 AND (r.started = 0 OR r.allow_spectators = 1) AND MAX(r.host_seen, COALESCE(p.seen, 0)) > ?').bind(Date.now()-15000).all();
    return (rows.results||[]).map(x=>JSON.parse(x.payload));
  }
  async rate(key,window,max){
    const row=await this.db.prepare('INSERT INTO game_rate_limits (key, window, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window = excluded.window, count = CASE WHEN window = excluded.window THEN count + 1 ELSE 1 END RETURNING count').bind(key,window).first();
    return row.count<=max;
  }
}
