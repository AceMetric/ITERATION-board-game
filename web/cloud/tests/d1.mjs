import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export class TestD1 {
  constructor(){this.sqlite=new DatabaseSync(':memory:');this.sqlite.exec(readFileSync(new URL('../db/test-schema.sql',import.meta.url),'utf8'));this.beforeSave=null;this.saves=0;}
  withSession(value){if(value!=='first-primary')throw Error('Requests must read primary');return this;}
  prepare(sql){
    const db=this;let values=[];
    return {bind(...args){values=args;return this;},async first(){await Promise.resolve();return db.sqlite.prepare(sql).get(...values)||null;},async all(){await Promise.resolve();return {results:db.sqlite.prepare(sql).all(...values)};},async run(){if(sql.startsWith('UPDATE game_rooms')){db.saves++;if(db.beforeSave)await db.beforeSave();}await Promise.resolve();const result=db.sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(result.changes)}};}};
  }
  row(id){return JSON.parse(this.sqlite.prepare('SELECT payload FROM game_rooms WHERE id = ?').get(id).payload);}
  patch(id,fn){const r=this.row(id);fn(r);this.sqlite.prepare('UPDATE game_rooms SET payload = ? WHERE id = ?').run(JSON.stringify(r),id);return r;}
}
