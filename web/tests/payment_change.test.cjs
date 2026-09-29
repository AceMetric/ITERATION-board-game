const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {HistoryGame} = require('../game/game_engine.js');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../game/game_data.json'), 'utf8'));

function purchaseSetup(card, hand) {
  const game = new HistoryGame(data);
  game.newGame(['甲', '乙'], 12345);
  const state = game.s;
  state.pending = null;
  state.queue = [];
  state.active = 0;
  state.phase = 5;
  state.turn = {purchases: 0, ordinaryPurchases: 0, purchaseStarted: false};
  state.shop = [card, ...state.shop.filter(id => id !== card)].slice(0, 4);
  state.players[0].hand = hand.map(([type, value]) => game.make(type, value));
  game.command(0, 'buy', {card, discount: [0, 0, 0]});
  assert.equal(state.pending.op, 'pay');
  return game;
}

test('overpaid minerals return as minerals, not coins', () => {
  const game = purchaseSetup('T1-01', [[0, 2], [2, 5]]);
  const pending = game.s.pending;
  assert.deepEqual(pending.cost, [2, 0, 3]);
  const cards = game.p(0).hand.map(card => card.id);
  assert.throws(() => game.command(0, 'answer', {
    id: pending.id,
    cards,
    groups: [[2], [], []],
  }), /面额合计不正确/);
  assert.deepEqual(game.totals(game.p(0).hand), [2, 0, 5]);
  game.command(0, 'answer', {
    id: pending.id,
    cards,
    groups: [[], [], [2]],
  });
  assert.deepEqual(game.totals(game.p(0).hand), [0, 0, 2]);
});

test('textile card accepts a chosen mineral change combination before its separate four-coin reward', () => {
  const game = purchaseSetup('T1-05', [[0, 2], [0, 1], [2, 10]]);
  const pending = game.s.pending;
  assert.deepEqual(pending.cost, [3, 0, 2]);
  game.command(0, 'answer', {
    id: pending.id,
    cards: game.p(0).hand.map(card => card.id),
    groups: [[], [], [2, 2, 2, 2]],
  });
  assert.deepEqual(game.totals(game.p(0).hand), [0, 0, 8]);
  assert.deepEqual(game.p(0).hand.filter(card => card.type === 2).map(card => card.value), [2, 2, 2, 2]);
  assert.equal(game.s.pending.op, 'reward');
  assert.equal(game.s.pending.title, '纺织与编织立即奖励');
  assert.deepEqual(game.s.pending.amount, [4, 0, 0]);
  game.command(0, 'answer', {id: game.s.pending.id, groups: [[2, 2], [], []]});
  assert.deepEqual(game.totals(game.p(0).hand), [4, 0, 8]);
});
