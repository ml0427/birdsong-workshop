'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = require('../engine.js'), V2 = require('./fixtures/engine-v2.cjs');
const { game, craft, intro, order, next, depart, at, returnedStaff } = require('./helpers.cjs');
const event = (g, key) => g.s.content.events.find(e => e.key === key);

// Plays the real engine as a user would: all arrivals, scoped actions and monthly
// uses. No item, trust, quality, durability or content flags are fabricated.
function branchRun(inherit = false, reuseStaff = false) {
  const g = game(); intro(g);
  for (const [material, quantity] of Object.entries({ 木頭: 6, 鐵: 4, 銅: 3, 銀: 2, 金: 2 })) order(g, material, quantity);
  const sold = []; let retiredBracer = null;
  for (let month = 2; month <= 5; month++) {
    next(g);
    while (W.activeVisit(g.s)) {
      const v = W.activeVisit(g.s);
      for (const offer of g.s.returns.filter(o => o.status === 'offered' && o.npc === v.npc)) {
        g.npc({ type: 'reclaim', itemId: offer.itemId });
        if (reuseStaff && offer.itemId === 'item-1') g.do({ type: 'repair', itemId: offer.itemId });
        if (v.npc === 'he' && g.s.items[offer.itemId].recipe === 'bracer' && month === 5) {
          retiredBracer = offer.itemId;
          if (inherit) g.do({ type: 'smelt', itemId: offer.itemId });
        }
      }
      if (v.phase === 'request') {
        if (!v.asked) g.npc({ type: 'talk' });
        const item = W.inventory(g.s).find(i => W.suitable(g.s, i)) || craft(g, v.needs[0]);
        assert(W.suitable(g.s, item), W.recommendationReason(g.s, item));
        sold.push({ month, npc: v.npc, recipe: item.recipe, itemId: item.id });
        g.npc({ type: 'sell', itemId: item.id });
      }
      g.npc({ type: 'leave' });
    }
  }
  return { g, sold, retiredBracer };
}

test('九個節點每人三個，所有分支有可查驗條件與保底', () => {
  assert.equal(W.CONTENT.EVENTS.length, 9);
  for (const npc of Object.keys(W.PEOPLE)) assert.equal(W.CONTENT.EVENTS.filter(d => d.npc === npc).length, 3);
  for (const def of W.CONTENT.EVENTS) {
    assert(W.RECIPES[def.recipe]); assert.equal(new Set(def.branches.map(b => b.id)).size, def.branches.length);
    assert(!def.branches.at(-1).trait && def.branches.at(-1).strong === undefined);
    if (def.requires) assert(W.CONTENT.EVENTS.some(e => e.id === def.requires));
  }
});
test('未持有和未使用不敘述：成交當月不觸發，真正下月使用才記分支', () => {
  const g = game(); intro(g); order(g, '銅'); assert.equal(g.s.content.events.length, 0);
  next(g); assert(event(g, 'cen-path')); assert(!event(g, 'he-wrist')); assert(!event(g, 'shu-amulet'));
  g.npc({ type: 'talk' }); const i = craft(g, 'bracer'); g.npc({ type: 'sell', itemId: i.id });
  assert(!event(g, 'he-wrist')); assert.match(W.requestDetail(W.activeVisit(g.s)), /真正用過/);
  next(g); const record = event(g, 'he-wrist'); assert.equal(record.itemId, i.id); assert.equal(record.month, 3); assert.equal(record.actor, 'he'); assert.equal(record.branch, 'protected');
});
test('新事件／使用／磨耗同月一次，存讀檔不重發，後續普通磨耗只記歷史', () => {
  const { g } = branchRun(false); next(g); const record = event(g, 'he-replacement'); assert(record);
  const before = W.exportSave(g.s); assert.throws(() => g.do({ type: 'open' }), /已經營業/); assert.equal(W.exportSave(g.s), before);
  g.s = W.importSave(before); assert.equal(g.s.content.events.filter(e => e.key === 'he-replacement').length, 1);
  const item = g.s.items[record.itemId], history = item.history.length; next(g);
  assert.equal(g.s.items[item.id].history.length, history + 1); assert.equal(g.s.news.some(n => n.id === `use-${item.id}-1-7`), false);
  assert.equal(g.s.content.events.filter(e => e.key === 'he-replacement').length, 1);
});
test('代表分支 A：新普通護腕恢復防護，結果說明無堅固、真實磨耗2', () => {
  const { g, retiredBracer, sold } = branchRun(false); assert(retiredBracer); assert(!event(g, 'he-replacement'));
  const fresh = sold.find(x => x.npc === 'he' && x.recipe === 'bracer' && x.month === 5); assert(fresh);
  assert.equal(g.s.items[fresh.itemId].quality, 2); assert.deepEqual(g.s.items[fresh.itemId].traits, ['guard']);
  next(g); const record = event(g, 'he-replacement'); assert.equal(record.branch, 'familiar'); assert.equal(record.itemId, fresh.itemId);
  assert.equal(record.wear, 2); assert.equal(record.after, 7); assert.match(record.text, /沒有額外堅固/); assert.equal(g.s.items[retiredBracer].status, 'inventory');
});
test('代表分支 B：磨損護腕熔鍊傳承到精良新作，堅固使實際磨耗1', () => {
  const { g, retiredBracer, sold } = branchRun(true); assert(!event(g, 'he-replacement'));
  const fresh = sold.find(x => x.npc === 'he' && x.recipe === 'bracer' && x.month === 5); const item = g.s.items[fresh.itemId];
  assert.equal(item.legacy, retiredBracer); assert.equal(item.quality, 2); assert.deepEqual(item.traits, ['guard', 'solid']);
  next(g); const record = event(g, 'he-replacement'); assert.equal(record.branch, 'reinforced'); assert.equal(record.wear, 1); assert.equal(record.after, 8);
  assert.match(record.text, /堅固接縫/); assert.equal(g.s.items[retiredBracer].status, 'smelted'); W.validate(g.s);
});
test('實際前置事件決定後續用途：護腕使用後才要盾，金鈴使用後才做魔力對照', () => {
  const { g, sold } = branchRun(false);
  const shield = sold.find(x => x.npc === 'he' && x.recipe === 'shield'); assert(shield); assert(event(g, 'he-wrist').month <= shield.month);
  const staff = sold.find(x => x.npc === 'shu' && x.recipe === 'staff'); assert(staff); assert(event(g, 'shu-bell').month <= staff.month);
  assert(!event(g, 'shu-focus')); next(g); assert(event(g, 'shu-focus')); assert.equal(event(g, 'shu-focus').itemId, staff.itemId);
});
test('舊杖跨主使用才完成舊杖新路，綁定新持有期並保留限制', () => {
  const { g, sold } = branchRun(false, true); const resale = sold.find(x => x.npc === 'shu' && x.recipe === 'staff');
  assert(resale); assert.equal(resale.itemId, 'item-1'); assert(!event(g, 'cen-cross')); next(g);
  const record = event(g, 'cen-cross'); assert.equal(record.actor, 'shu'); assert.equal(record.episodeId, 2); assert.equal(record.branch, 'careful');
  assert.match(record.text, /望舒|光仍較淡/); assert.equal(g.s.items['item-1'].episodes[1].uses, 1); assert.equal(g.s.items['item-1'].history.filter(h => h.text.includes('買下')).length, 2);
  assert.equal(g.s.content.events.length, 9); assert.equal(new Set(g.s.content.events.map(e => e.key)).size, 9);
});
test('無新用途有非購物回訪，不每月自動買同類；採購仍可在場辦理', () => {
  const { g } = branchRun(false); const service = g.s.visits.filter(v => v.month === 4 && v.npc === 'he' && !v.needs.length);
  // Month 4 need not include he at all; no unconditional monthly transaction.
  assert.equal(g.s.visits.some(v => v.month === 4 && v.npc === 'he' && v.phase === 'request'), false);
  assert(service.length === 0 || service.every(v => v.phase === 'service'));
  next(g); assert(g.s.visits.some(v => v.month === 6 && v.needs.length === 0));
  while (W.activeVisit(g.s) && W.activeVisit(g.s).phase !== 'service') depart(g);
  assert(W.activeVisit(g.s)); assert.match(W.requestDetail(W.activeVisit(g.s)), /沒有|先繼續/);
  const npc = W.activeVisit(g.s).npc; order(g, '木頭', 12); assert.equal(g.s.orders.at(-1).npc, npc);
});
test('拒單冷卻一個月再提、不鎖材料採購或其他人，未處理需求仍可跨月', () => {
  const g = game(); intro(g); order(g, '銅'); next(g); at(g, 'he'); g.npc({ type: 'decline' });
  at(g, 'cen'); order(g, '銅', 12); const persistent = W.activeVisit(g.s).id; next(g);
  assert.equal(g.s.materials.銅, 13); assert(!g.s.visits.some(v => v.month === 3 && v.npc === 'he' && v.phase === 'request'));
  assert.equal(W.activeVisit(g.s).id, persistent); while (W.activeVisit(g.s)) depart(g); next(g);
  at(g, 'he'); assert.deepEqual(W.activeVisit(g.s).needs, ['bracer']); const i = craft(g, 'bracer'); g.npc({ type: 'sell', itemId: i.id }); assert.equal(g.s.items[i.id].owner, 'he');
});
test('缺材料時需求保留，記帳採購與下月交付後能完成，不假裝事件先成功', () => {
  const g = game(); intro(g); order(g, '木頭'); next(g); at(g, 'he');
  const before = W.exportSave(g.s); assert.throws(() => craft(g, 'bracer'), /需要/); assert.equal(W.exportSave(g.s), before); assert(!event(g, 'he-wrist'));
  order(g, '銅', 10000); const id = W.activeVisit(g.s).id; next(g); assert.equal(W.activeVisit(g.s).id, id);
  const i = craft(g, 'bracer'); g.npc({ type: 'sell', itemId: i.id }); assert(!event(g, 'he-wrist')); next(g); assert(event(g, 'he-wrist'));
});
test('schema2 遷移保留事件／款項／待辦與參數，不虛構已完成新內容', () => {
  let s = V2.initialState(); const oldAct = a => { s = V2.dispatch(s, a).state; };
  oldAct({ type: 'craft', recipe: 'staff' }); oldAct({ type: 'craft', recipe: 'sword' }); oldAct({ type: 'open' });
  for (const itemId of ['item-1', 'item-2']) { const v = V2.activeVisit(s); oldAct({ type: 'sell', itemId, visitId: v.id, counterId: v.counterId }); }
  const v = V2.activeVisit(s); oldAct({ type: 'order', material: '銅', quantity: 12, requestId: 'v2', visitId: v.id, counterId: v.counterId });
  oldAct({ type: 'close' }); oldAct({ type: 'open' });
  const g = game(); g.s = W.importSave(V2.exportSave(s)); assert.equal(g.s.schema, 3); assert.equal(g.s.content.events.length, 0);
  assert.deepEqual(g.s.items, s.items); assert.deepEqual(g.s.orders, s.orders); assert.equal(g.s.coins, s.coins); assert.equal(W.activeVisit(g.s).id, V2.activeVisit(s).id);
  assert.equal(g.s.news.length, s.news.length); next(g); assert(event(g, 'cen-path')); assert.equal(event(g, 'cen-path').month, 3);
});
test('schema3 重載精確保留一次性旗標／拒單與分支，偽造引用或結果拒絕', () => {
  const { g } = branchRun(true, true); next(g); assert.deepEqual(W.importSave(W.exportSave(g.s)), g.s);
  for (const mutate of [s => s.content.events.push(s.content.events[0]), s => s.content.events[0].actor = 'he', s => s.content.events[0].branch = 'steady', s => s.content.events[0].wear = 0, s => s.content.events[0].month = 0, s => s.content.declined.he.bracer = s.month + 1]) {
    const d = JSON.parse(W.exportSave(g.s)); mutate(d.state); assert.throws(() => W.importSave(JSON.stringify(d)), /存檔/);
  }
});
test('原主人、磨損、用途、品質與特性各有具體拒絕原因，拒絕不改所有權', () => {
  const { g, item } = returnedStaff(); const v = { ...W.activeVisit(g.s), needs: ['staff'], minQuality: 0 };
  assert.match(W.recommendationReason(g.s, item, v), /已退役並贈還.*不再買回/);
  const other = { ...v, npc: 'shu' }; assert.match(W.recommendationReason(g.s, item, other), /耐久.*修復/);
  g.do({ type: 'repair', itemId: item.id }); const repaired = g.s.items[item.id];
  assert.match(W.recommendationReason(g.s, repaired, { ...other, needs: ['bell'] }), /金鈴.*用途不同/);
  assert.match(W.recommendationReason(g.s, repaired, { ...other, minQuality: 1 }), /細緻.*樸實/);
  assert.match(W.recommendationReason(g.s, repaired, { ...other, traitRequired: 'solid' }), /堅固.*沒有/);
  const before = W.exportSave(g.s); assert.throws(() => g.npc({ type: 'sell', itemId: item.id }), /已退役並贈還/); assert.equal(W.exportSave(g.s), before);
});
test('新增內容資產在瀏覽器載入順序及本機允許清單，無需啟動服務驗證', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert(html.indexOf('src="content.js') < html.indexOf('src="engine.js')); assert(html.indexOf('src="engine.js') < html.indexOf('src="app.js'));
  assert.match(fs.readFileSync(path.join(__dirname, '../server.cjs'), 'utf8'), /'\/content\.js'.*'text\/javascript'/);
});

module.exports = { branchRun };
