import { integer, primaryKey, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const gameRooms=sqliteTable('game_rooms',{
  id:text('id').primaryKey(),
  version:integer('version').notNull(),
  payload:text('payload').notNull(),
  listed:integer('listed').notNull(),
  started:integer('started').notNull(),
  allowSpectators:integer('allow_spectators').notNull(),
  hostSeen:integer('host_seen').notNull(),
  updatedAt:integer('updated_at').notNull(),
},table=>[index('idx_game_rooms_listed').on(table.listed)]);

export const gamePresence=sqliteTable('game_presence',{
  roomId:text('room_id').notNull().references(()=>gameRooms.id,{onDelete:'cascade'}),
  seat:integer('seat').notNull(),
  seen:integer('seen').notNull(),
},table=>[primaryKey({columns:[table.roomId,table.seat]})]);

export const gameRateLimits=sqliteTable('game_rate_limits',{
  key:text('key').primaryKey(),
  window:integer('window').notNull(),
  count:integer('count').notNull(),
});
