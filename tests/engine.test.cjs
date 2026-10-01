'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('../engine.js');
const Old = require('./fixtures/engine-v1.cjs');
function game() { return { s: W.initialState(), do(a) { const r = W.dispatch(this.s, a); this.s = r.state; return r; }, npc(a) { const v = W.activeVisit(this.s); return this.do({ visitId: v?.id, counterId: v?.counterId, ...a }); } }; }
function craft(g, recipe) { g.do({ type: 'craft', recipe }); return Object.values(g.s.items).at(-1); }
function intro(g) {
  const staff = craft(g, 'staff'), sword = craft(g, 'sword'); g.do({ type: 'open' });
  g.npc({ type: 'talk' }); g.npc({ type: 'sell', itemId: staff.id }); g.npc({ type: 'sell', itemId: sword.id }); return { staff, sword };
}
function order(g, material, quantity = 1, requestId = `test-${g.s.seq}`) { return g.npc({ type: 'order', material, quantity, requestId }); }
function next(g) { if (g.s.open) g.do({ type: 'close' }); g.do({ type: 'open' }); }
function depart(g) { const v = W.activeVisit(g.s); if (v) g.npc({ type: v.phase === 'service' ? 'leave' : 'decline' }); }
function at(g, npc) { while (W.activeVisit(g.s) && W.activeVisit(g.s).npc !== npc) depart(g); assert.equal(W.activeVisit(g.s)?.npc, npc); }
function rejection(g, a, regex) { const before = W.exportSave(g.s); assert.throws(() => g.do(a), regex); assert.equal(W.exportSave(g.s), before); }
function scoped(g, a) { const v = W.activeVisit(g.s); return { visitId: v?.id, counterId: v?.counterId, ...a }; }
function returnedStaff() { const g = game(); const { staff } = intro(g); order(g, '銅'); next(g); next(g); at(g, 'cen'); g.npc({ type: 'reclaim', itemId: staff.id }); return { g, item: g.s.items[staff.id] }; }
function oldGame() {
  let s = Old.initialState(); const act = a => { s = Old.dispatch(s, a).state; };
  act({ type: 'craft', recipe: 'staff' }); act({ type: 'craft', recipe: 'sword' }); act({ type: 'open' });
  act({ type: 'talk', visitId: 'intro-cen' }); for (const itemId of ['item-1', 'item-2']) act({ type: 'sell', itemId, visitId: 'intro-cen' });
  return { act, get s() { return s; } };
}

test('初始兩份材料必成兩種武器；製作不換月、不磨耗，不足原子拒絕', () => {
  const g = game(); const a = craft(g, 'staff'), b = craft(g, 'sword');
  assert.equal(g.s.month, 0); assert.equal(g.s.open, false); assert.equal(W.inventory(g.s).length, 2);
  assert.equal(a.durability, 9); assert.equal(b.durability, 9);
  rejection(g, { type: 'craft', recipe: 'staff' }, /需要/); rejection(g, { type: 'craft', recipe: 'bell' }, /尚未/);
});
test('首次開店月1且只扣一次費，雙擊開店與關店皆不重複结算', () => {
  const g = game(); g.do({ type: 'open' }); assert.equal(g.s.month, 1); assert.equal(g.s.coins, 12);
  rejection(g, { type: 'open' }, /已經營業/); const encoded = W.exportSave(g.s);
  g.do({ type: 'close' }); assert.equal(g.s.month, 1); assert.equal(g.s.coins, 12); assert.equal(g.s.news.length, JSON.parse(encoded).state.news.length);
  rejection(g, { type: 'close' }, /已經關店/);
});
test('開場同一熟客持有兩件，成交後留櫃臺等採購，不生未使用故事', () => {
  const g = game(); intro(g); assert.equal(W.owned(g.s, 'cen').length, 2); assert.equal(W.inventory(g.s).length, 0);
  assert.equal(W.activeVisit(g.s).phase, 'service'); assert.equal(W.activeVisit(g.s).npc, 'cen'); assert.equal(g.s.npcs.cen.trust, 3);
  assert.equal(g.s.npcs.cen.story, false); assert.equal(g.s.news.some(n => n.id.startsWith('story')), false);
  rejection(g, scoped(g, { type: 'leave' }), /採購清單/); order(g, '銅'); g.npc({ type: 'leave' }); assert.equal(W.activeVisit(g.s), null);
});
test('開場售一件中斷與售兩件未採購關店重載均可續接', () => {
  const g = game(); g.do({ type: 'open' }); g.do({ type: 'close' }); const a = craft(g, 'staff'), b = craft(g, 'sword');
  g.do({ type: 'open' }); g.npc({ type: 'sell', itemId: a.id }); const stale = scoped(g, { type: 'talk' });
  g.do({ type: 'close' }); g.s = W.importSave(W.exportSave(g.s)); g.do({ type: 'open' });
  rejection(g, stale, /不在櫃臺/); assert.deepEqual(W.activeVisit(g.s).needs, ['sword']); g.npc({ type: 'sell', itemId: b.id });
  next(g); assert.equal(W.activeVisit(g.s).phase, 'service'); order(g, '銅'); next(g); assert.equal(g.s.materials.銅, 1);
  assert.equal(W.activeVisit(g.s).npc, 'he'); assert.deepEqual(W.activeVisit(g.s).needs, ['bracer']); assert.equal(g.s.visits.filter(v => v.kind === 'intro').length, 1);
});
test('自然教學兩件→熟客→採購→下月交付→護腕新需求→鑑定與送客', () => {
  const g = game(); intro(g); assert.equal(W.tutorialStep(g.s).step, 3); order(g, '銅'); assert.equal(W.tutorialStep(g.s).step, 4);
  next(g); assert.equal(W.tutorialStep(g.s).step, 5); assert.equal(g.s.materials.銅, 1); assert.deepEqual(W.visibleRecipes(g.s), ['staff', 'sword']);
  assert.equal(W.canAppraise(g.s), false); g.npc({ type: 'talk' }); assert.match(W.requestDetail(W.activeVisit(g.s)), /接縫與品質/);
  assert.deepEqual(W.visibleRecipes(g.s), ['staff', 'sword', 'bracer']); const i = craft(g, 'bracer'); g.do({ type: 'appraise', itemId: i.id });
  g.npc({ type: 'sell', itemId: i.id }); assert.equal(W.activeVisit(g.s).npc, 'he'); assert.equal(W.activeVisit(g.s).phase, 'service');
  order(g, '銀'); assert.equal(g.s.orders.at(-1).npc, 'he'); g.npc({ type: 'leave' }); assert.equal(W.activeVisit(g.s).npc, 'cen');
});
test('顧客在場範圍：下一人、送客後、關店後、跨月舊畫面全部拒絕', () => {
  const g = game(); intro(g); order(g, '銅'); next(g); const he = W.activeVisit(g.s), cen = g.s.visits.find(v => v.npc === 'cen' && v.status === 'waiting');
  rejection(g, { type: 'talk', visitId: cen.id, counterId: cen.counterId }, /不在櫃臺/);
  const stale = scoped(g, { type: 'order', material: '鐵', quantity: 1, requestId: 'stale' }); depart(g); rejection(g, stale, /不在櫃臺/);
  const current = scoped(g, { type: 'talk' }); g.do({ type: 'close' }); rejection(g, current, /不在櫃臺/);
  g.do({ type: 'open' }); rejection(g, current, /不在櫃臺/); assert.notEqual(W.activeVisit(g.s).counterId, current.counterId); assert.equal(he.npc, 'he');
});
test('重複對話、出售同一物、過期 revision 都拒絕且不改狀態', () => {
  const g = game(); intro(g); rejection(g, scoped(g, { type: 'talk' }), /已經聽/);
  rejection(g, scoped(g, { type: 'sell', itemId: 'item-1' }), /不在工坊庫存/);
  rejection(g, { type: 'close', expectedRevision: g.s.revision - 1 }, /已處理/);
});
test('採購立即扣款、request ID 去重、顧客離開後仍交付一次', () => {
  const g = game(); intro(g); order(g, '鐵', 2, 'same'); assert.equal(g.s.coins, 28);
  rejection(g, scoped(g, { type: 'order', material: '鐵', quantity: 2, requestId: 'same' }), /已委託/);
  g.npc({ type: 'leave' }); next(g); assert.equal(g.s.materials.鐵, 2); next(g); assert.equal(g.s.materials.鐵, 2);
  assert.equal(g.s.news.filter(n => n.id.startsWith('delivery-')).length, 1);
});
test('採購沒有9個上限：10000個精確計價交付', () => {
  const g = game(); intro(g); order(g, '木頭', 10000); assert.equal(g.s.orders[0].quantity, 10000); assert.equal(g.s.orders[0].cost, 30000);
  assert.equal(g.s.debt, 29960); next(g); assert.equal(g.s.materials.木頭, 10000); W.validate(g.s);
});
test('非數字、負數、零、小數、非安全整數與總價溢位原子拒絕、不截斷', () => {
  const g = game(); intro(g);
  for (const quantity of [NaN, Infinity, -1, 0, 1.1, '1', Number.MAX_SAFE_INTEGER + 1]) rejection(g, scoped(g, { type: 'order', material: '木頭', quantity, requestId: 'bad' }), /安全整數/);
  rejection(g, scoped(g, { type: 'order', material: '金', quantity: Number.MAX_SAFE_INTEGER, requestId: 'overflow' }), /安全整數/);
  rejection(g, scoped(g, { type: 'order', material: '鑽石', quantity: 1, requestId: 'bad' }), /清單/);
});
test('欠款及待交付材料相加溢位也原子拒絕', () => {
  const g = game(); intro(g); g.s.debt = Number.MAX_SAFE_INTEGER; g.s.coins = 0;
  rejection(g, scoped(g, { type: 'order', material: '木頭', quantity: 1, requestId: 'debt-over' }), /安全整數/);
  g.s.debt = 0; g.s.materials.木頭 = Number.MAX_SAFE_INTEGER;
  rejection(g, scoped(g, { type: 'order', material: '木頭', quantity: 1, requestId: 'material-over' }), /安全整數/);
});
test('品質售價獨立於材料、類型與特性；六類全部是真正裝備', () => {
  for (let quality = 0; quality < 3; quality++) for (const recipe of Object.keys(W.RECIPES)) assert.equal(W.price({ recipe, quality, traits: ['solid', 'guard'] }), W.QUALITY_PRICE[quality]);
  assert.deepEqual(Object.values(W.RECIPES).map(r => r.name), ['木杖', '鐵劍', '木盾', '銅護腕', '銀護符', '金鈴']);
  assert.equal(W.PEOPLE.cen.role, '熟客');
});
test('效能與護身改變實際使用結果、堅固減磨耗，最高品質仍有差異', () => {
  const i = { recipe: 'shield', quality: 0, traits: ['solid'], durability: 9 };
  const weak = W.useResult(i), guarded = W.useResult({ ...i, traits: ['solid', 'guard'] });
  assert.equal(weak.strong, false); assert.equal(guarded.strong, true); assert.notEqual(weak.text, guarded.text); assert(guarded.wear < weak.wear);
  const plain = { ...i, quality: 2, traits: ['light'] }, inherited = { ...plain, traits: ['light', 'solid'] };
  assert.equal(W.performance(plain), 7); assert(W.useResult(inherited).wear < W.useResult(plain).wear); assert.equal(W.price(plain), W.price(inherited));
  assert.notEqual(W.useResult({ ...i, quality: 2 }).text, W.useResult({ ...i, quality: 2, traits: ['solid', 'light'] }).text);
});
test('使用才耗耐久：出售當月、製作、關店、重載都不耗，重開只新月一次', () => {
  const g = game(); intro(g); const id = 'item-1'; assert.equal(g.s.items[id].durability, 9); order(g, '銅'); next(g);
  assert.equal(g.s.items[id].durability, 6); const e = g.s.items[id].episodes[0]; assert.equal(e.uses, 1);
  g.npc({ type: 'talk' }); craft(g, 'bracer'); assert.equal(g.s.items[id].durability, 6);
  g.do({ type: 'close' }); g.s = W.importSave(W.exportSave(g.s)); assert.equal(g.s.items[id].durability, 6);
  g.do({ type: 'open' }); assert.equal(g.s.items[id].durability, 3); assert.equal(g.s.items[id].episodes[0].uses, 2);
  rejection(g, { type: 'open' }, /已經營業/); assert.equal(g.s.news.filter(n => n.id === `use-${id}-1-3`).length, 1);
});
test('信任足夠但未買裝備的小禾只有關係，不捏造使用故事', () => {
  const g = game(); intro(g); order(g, '銅'); next(g);
  for (let n = 0; n < 8; n++) { while (W.activeVisit(g.s)) { const v = W.activeVisit(g.s); if (v.npc === 'he' && !v.asked) g.npc({ type: 'talk' }); depart(g); } next(g); }
  assert(g.s.npcs.he.trust >= 3); assert.equal(g.s.npcs.he.story, false); assert.equal(g.s.npcs.he.storyItem, null);
  assert.equal(g.s.news.some(n => n.id === 'story-v2-he'), false); assert.equal(W.owned(g.s, 'he').length, 0);
});
test('故事在較早實際使用後才發生，綁定同人物同物件', () => {
  const g = game(); intro(g); order(g, '銅'); next(g); assert.equal(g.s.npcs.cen.story, false);
  next(g); assert.equal(g.s.npcs.cen.story, true); const source = g.s.items[g.s.npcs.cen.storyItem];
  assert(source.episodes.some(e => e.npc === 'cen' && e.firstUsedMonth < 3)); assert.match(g.s.news.find(n => n.id === 'story-v2-cen').text, /木杖/);
});
test('退役依真實磨損而非固定售出三月；本人同意且到櫃臺才取得', () => {
  const g = game(); intro(g); order(g, '銅'); next(g); assert.equal(g.s.returns.length, 0); next(g);
  assert.equal(g.s.items['item-1'].durability, 3); assert.equal(g.s.items['item-1'].status, 'owned');
  rejection(g, scoped(g, { type: 'reclaim', itemId: 'item-1' }), /目前顧客/);
  at(g, 'cen'); g.npc({ type: 'reclaim', itemId: 'item-1' }); assert.equal(g.s.items['item-1'].status, 'inventory');
  assert.equal(g.s.items['item-1'].episodes[0].until, 3); rejection(g, scoped(g, { type: 'reclaim', itemId: 'item-1' }), /只能當面/);
});
test('磨損舊物不符合需求，修復才可跨人再售，原退役者不能買回同一件', () => {
  const { g, item } = returnedStaff(); const cen = { ...W.activeVisit(g.s), phase: 'request', needs: ['staff'] };
  const other = { ...cen, npc: 'he', minQuality: 0 }; assert.equal(W.suitable(g.s, item, other), false);
  g.do({ type: 'repair', itemId: item.id }); const repaired = g.s.items[item.id]; assert.equal(repaired.durability, 9);
  assert.equal(W.suitable(g.s, repaired, cen), false); assert.equal(W.suitable(g.s, repaired, other), true);
  rejection(g, { type: 'repair', itemId: item.id }, /尚未修復/);
});
test('新持有者獨立使用事件並磨耗，保留舊持有者歷史與贈還不重複', () => {
  const { g, item } = returnedStaff(); g.do({ type: 'repair', itemId: item.id });
  // Simulate an explicit compatible ordinary request after the current person departs.
  depart(g); g.s.visits.push({ id: 'cross-owner', month: g.s.month, npc: 'he', needs: ['staff'], kind: 'normal', asked: true, status: 'waiting', phase: 'request', counterId: `cross-owner@${g.s.month}`, reason: '想用木杖照路。', minQuality: 0, traitRequired: null, contentKey: null, contextText: '' });
  at(g, 'he'); g.npc({ type: 'sell', itemId: item.id }); next(g); const current = g.s.items[item.id];
  assert.equal(current.owner, 'he'); assert.equal(current.episodes.length, 2); assert.equal(current.episodes[1].uses, 1); assert.equal(current.durability, 6);
  assert(current.history.some(h => h.text.startsWith('阿岑使用'))); assert(current.history.some(h => h.text.startsWith('小禾使用')));
  assert.equal(g.s.returns.filter(o => o.itemId === item.id).length, 1); assert(g.s.news.some(n => n.id === `use-${item.id}-2-4`));
});
test('熔鍊永久消耗原物防重複，只移交一次材料與特性', () => {
  const { g, item } = returnedStaff(); const amount = g.s.materials.木頭; g.do({ type: 'smelt', itemId: item.id });
  assert.equal(g.s.materials.木頭, amount + 1); rejection(g, { type: 'smelt', itemId: item.id }, /舊物/);
  const newItem = craft(g, 'shield'); assert.equal(newItem.legacy, item.id); assert(newItem.traits.includes('light')); assert(newItem.traits.includes('solid'));
  assert.equal(g.s.legacies[0].usedBy, newItem.id); assert.equal(g.s.items[item.id].status, 'smelted');
});
test('精良品質傳承仍有具體特性效用，不依賴品質升級', () => {
  const { g, item } = returnedStaff(); g.s.xp.craft = 9; g.do({ type: 'smelt', itemId: item.id }); const i = craft(g, 'staff');
  assert.equal(i.quality, 2); assert.deepEqual(i.traits, ['light', 'solid']);
  const plain = { ...i, traits: ['light'] }; assert.equal(W.price(i), W.price(plain)); assert(W.useResult(i).wear < W.useResult(plain).wear);
});
test('需求篩選品質、特性、耐久；用途重疊有跨角色再售途徑', () => {
  const g = game(); intro(g); order(g, '木頭', 2); next(g); const i = craft(g, 'staff');
  const demand = { ...W.activeVisit(g.s), needs: ['staff'], minQuality: 1, traitRequired: 'solid' };
  assert.equal(W.suitable(g.s, i, demand), false); assert.equal(W.suitable(g.s, { ...i, quality: 1, traits: ['light', 'solid'] }, demand), true);
  assert.equal(W.suitable(g.s, { ...i, quality: 1, traits: ['light', 'solid'], durability: 3 }, demand), false);
});
test('最後才補無消息：周轉材料事件與無消息不會同月矛盾', () => {
  const g = game(); intro(g); order(g, '銅'); next(g); g.npc({ type: 'talk' }); const b = craft(g, 'bracer'); g.npc({ type: 'sell', itemId: b.id });
  next(g); const current = g.s.news.filter(n => n.month === g.s.month); assert(current.some(n => n.id.startsWith('relief-'))); assert(!current.some(n => n.text === '本月沒有新消息。'));
  for (let n = 0; n < 10; n++) next(g); const latest = g.s.news.filter(n => n.month === g.s.month); assert.equal(latest.length, 1); assert.equal(latest[0].text, '本月沒有新消息。');
});
test('欠款不中止：在場顧客可記帳採購，交付後售出優先償還', () => {
  const g = game(); intro(g); order(g, '銅'); next(g); for (let n = 0; n < 8; n++) next(g);
  at(g, 'he'); const before = g.s.debt; order(g, '銅', 10); assert.equal(g.s.debt, before + 100); next(g);
  at(g, 'he'); const i = craft(g, 'bracer'); const debt = g.s.debt; g.npc({ type: 'sell', itemId: i.id }); assert(g.s.debt < debt); assert.equal(g.s.coins, 0);
});
test('schema2 往返完整保留隊列、訂單、參數、持有期與故事證據', () => {
  const { g } = returnedStaff(); order(g, '金', 12); const text = W.exportSave(g.s); assert.deepEqual(W.importSave(text), g.s);
  assert.throws(() => W.importSave('{broken')); g.s = W.importSave(text); next(g); assert.equal(g.s.materials.金, 12);
});
test('schema1 開場未採購存檔遷移恢復阿岑等待，資金與物品不重置', () => {
  const old = oldGame(); const s = W.importSave(Old.exportSave(old.s)); assert.equal(s.schema, 3); assert.equal(s.coins, old.s.coins);
  assert.equal(W.activeVisit(s).npc, 'cen'); assert.equal(W.activeVisit(s).phase, 'service'); assert.equal(s.npcs.cen.story, false);
  assert.equal(s.items['item-1'].episodes[0].uses, 0); assert.equal(s.items['item-1'].owner, 'cen'); W.validate(s);
});
test('schema1 雜務裝備、事件及固定故事遷移為裝備內容，保留原交易金額', () => {
  const old = oldGame(); old.act({ type: 'order', material: '銅', quantity: 3, requestId: 'old' }); old.act({ type: 'close' }); old.act({ type: 'open' });
  old.act({ type: 'talk', visitId: Old.activeVisit(old.s).id }); old.act({ type: 'craft', recipe: 'watering' }); const id = Old.inventory(old.s)[0].id;
  old.act({ type: 'sell', itemId: id, visitId: Old.activeVisit(old.s).id }); old.act({ type: 'close' }); old.act({ type: 'open' });
  const before = old.s.items[id].history.find(h => h.text.includes('成交')); const s = W.importSave(Old.exportSave(old.s));
  assert.equal(s.items[id].recipe, 'bracer'); assert.equal(s.items[id].history.find(h => h.text.includes('成交')).text, before.text);
  assert.equal(s.items[id].episodes[0].uses, 1); assert.equal(s.npcs.he.story, false); assert.equal(s.month, old.s.month);
  assert.doesNotMatch(JSON.stringify(s), /澆水壺|木凳|銀燈|嫩芽|還書的孩子/);
});
test('schema1 熔鍊與轉手舊物遷移保持來源和真正的新持有期', () => {
  const old = oldGame(); old.act({ type: 'order', material: '木頭', quantity: 2, requestId: 'old' });
  for (let n = 0; n < 3; n++) { old.act({ type: 'close' }); old.act({ type: 'open' }); }
  old.act({ type: 'reclaim', itemId: 'item-1' }); old.act({ type: 'smelt', itemId: 'item-1' }); old.act({ type: 'craft', recipe: 'stool' });
  const s = W.importSave(Old.exportSave(old.s)), i = W.inventory(s)[0]; assert.equal(i.recipe, 'shield'); assert.equal(i.legacy, 'item-1'); assert.equal(i.traits.length, 2);
  assert.equal(s.items['item-1'].status, 'smelted'); assert.equal(s.items['item-1'].episodes[0].until, 4); W.validate(s);
});
test('匯入拒絕負材料、錯持有者、重複訂單、損壞傳承、偽造故事/持有期', () => {
  const g = game(); intro(g); order(g, '銅');
  for (const mutate of [s => s.materials.鐵 = -1, s => s.items['item-1'].owner = 'fake', s => s.orders.push(s.orders[0]), s => s.lastSettled++, s => s.items['item-1'].legacy = 'item-1', s => { s.npcs.he.story = true; s.npcs.he.storyItem = 'item-1'; }, s => s.items['item-1'].episodes[0].npc = 'he']) {
    const d = JSON.parse(W.exportSave(g.s)); mutate(d.state); assert.throws(() => W.importSave(JSON.stringify(d)), /存檔/);
  }
});
test('可持續經營、同用途再購有理由、金鈴一次委託與日常需求分離', () => {
  const g = game(); intro(g); for (const m of W.MATERIALS) order(g, m, 50); let commissions = 0, regularRings = 0, repeated = 0;
  for (let n = 0; n < 14; n++) {
    next(g);
    while (W.activeVisit(g.s)) {
      const v = W.activeVisit(g.s);
      for (const o of g.s.returns.filter(o => o.npc === v.npc && o.status === 'offered')) g.npc({ type: 'reclaim', itemId: o.itemId });
      if (v.phase === 'request') {
        if (!v.asked) g.npc({ type: 'talk' });
        if (W.owned(g.s, v.npc).some(i => v.needs.includes(i.recipe))) { repeated++; assert.match(v.reason, /備用|替換|升級|磨損|一次委託/); }
        const i = W.inventory(g.s).find(i => W.suitable(g.s, i)) || craft(g, v.needs[0]);
        if (v.kind === 'commission') commissions++; else if (i.recipe === 'bell') regularRings++;
        g.npc({ type: 'sell', itemId: i.id });
      }
      g.npc({ type: 'leave' });
    }
  }
  assert.equal(commissions, 1); assert(regularRings > 0); assert(repeated > 0); assert(g.s.npcs.shu.goldDone); assert(g.s.npcs.shu.story);
  assert.equal(new Set(g.s.news.map(n => n.id)).size, g.s.news.length); W.validate(g.s);
  const returnedRing = W.inventory(g.s).find(i => i.recipe === 'bell' && i.returned); assert(returnedRing);
  g.do({ type: 'repair', itemId: returnedRing.id });
  const original = g.s.returns.find(o => o.itemId === returnedRing.id).npc, buyer = original === 'shu' ? 'he' : 'shu';
  const v = { id: 'ring-resale', month: g.s.month, npc: buyer, needs: ['bell'], kind: 'normal', asked: true, status: 'waiting', phase: 'request', counterId: `ring-resale@${g.s.month}`, reason: '這次另備一件佩戴警示裝備。', minQuality: 0, traitRequired: null, contentKey: null, contextText: '' };
  g.s.visits.push(v); const debt = g.s.debt, coins = g.s.coins; g.npc({ type: 'sell', itemId: returnedRing.id });
  assert.equal((g.s.coins - coins) + (debt - g.s.debt), W.price(returnedRing)); next(g);
  assert.equal(g.s.items[returnedRing.id].episodes.at(-1).uses, 1); assert.equal(g.s.items[returnedRing.id].owner, buyer);
});

test('schema1 已再售物品不被終身使用旗標鎖住，遷移後新持有期會真實使用', () => {
  const old = oldGame(); old.act({ type: 'order', material: '銅', quantity: 1, requestId: 'old' });
  for (let n = 0; n < 3; n++) { old.act({ type: 'close' }); old.act({ type: 'open' }); }
  old.act({ type: 'reclaim', itemId: 'item-1' });
  while (Old.activeVisit(old.s)?.npc !== 'cen') old.act({ type: 'decline', visitId: Old.activeVisit(old.s).id });
  old.act({ type: 'sell', itemId: 'item-1', visitId: Old.activeVisit(old.s).id });
  const g = game(); g.s = W.importSave(Old.exportSave(old.s));
  assert.equal(g.s.items['item-1'].episodes.length, 2); assert.equal(g.s.items['item-1'].episodes[1].uses, 0); assert.equal(g.s.items['item-1'].durability, 9);
  next(g); assert.equal(g.s.items['item-1'].episodes[1].uses, 1); assert.equal(g.s.items['item-1'].durability, 6);
});
test('既有同類裝備磨損退役後的新需求明說替換，不假裝第一次買', () => {
  const g = game(); intro(g); order(g, '銅'); next(g); while (W.activeVisit(g.s)) depart(g);
  next(g); while (W.activeVisit(g.s)) depart(g); next(g); at(g, 'cen'); const v = W.activeVisit(g.s); assert.deepEqual(v.needs, ['staff']); assert.match(v.reason, /退役|替換/);
});
test('傳承特性需求實際產生、能推薦繼承品而拒絕無特性同類', () => {
  const { g, item } = returnedStaff(); g.s.npcs.shu.trust = 3; g.s.xp.craft = 9; g.do({ type: 'smelt', itemId: item.id }); const inherited = craft(g, 'staff');
  // Existing inventory is kept; remove all pending visits so new monthly requests are generated.
  while (W.activeVisit(g.s)) depart(g);
  // Give shu the other unlocked preferred types, making the next missing kind a staff.
  for (const r of ['amulet', 'bell']) {
    g.s.materials[W.RECIPES[r].material] = 1;
    if (r === 'bell') g.s.reputation = 5;
    const i = craft(g, r); i.status = 'owned'; i.owner = 'shu'; i.soldMonth = g.s.month;
    i.episodes = [{ id: 1, npc: 'shu', since: g.s.month, until: null, firstUsedMonth: null, lastUsedMonth: null, uses: 0 }];
  }
  g.s.npcs.shu.goldDone = true; next(g); at(g, 'shu'); const v = W.activeVisit(g.s);
  assert.deepEqual(v.needs, ['staff']); assert.equal(v.traitRequired, 'solid'); assert.match(W.requestDetail(v), /堅固/);
  assert(W.suitable(g.s, g.s.items[inherited.id], v)); assert(!W.suitable(g.s, { ...g.s.items[inherited.id], traits: ['light'] }, v));
});
