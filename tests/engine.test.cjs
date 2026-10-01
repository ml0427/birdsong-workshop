'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const W = require('../engine.js');
const game = () => ({ s: W.initialState(), do(a) { const result = W.dispatch(this.s, a); this.s = result.state; return result; } });
function craft(g, recipe) { g.do({ type: 'craft', recipe }); return Object.values(g.s.items).at(-1); }
function sell(g, item) { g.do({ type: 'sell', itemId: item.id, visitId: W.activeVisit(g.s).id }); }
function order(g, material, quantity = 1, id = `test-${g.s.seq}`) { g.do({ type: 'order', material, quantity, requestId: id }); }
function intro(g, interrupt = false) {
  const staff = craft(g, 'staff'), sword = craft(g, 'sword'); g.do({ type: 'open' });
  g.do({ type: 'talk', visitId: W.activeVisit(g.s).id }); sell(g, staff);
  if (interrupt) { g.do({ type: 'close' }); g.s = W.importSave(W.exportSave(g.s)); g.do({ type: 'open' }); }
  sell(g, sword); return { staff, sword };
}
function nextMonth(g) { if (g.s.open) g.do({ type: 'close' }); g.do({ type: 'open' }); }
function rejectWithoutMutation(g, action, pattern) { const before = W.exportSave(g.s); assert.throws(() => g.do(action), pattern); assert.equal(W.exportSave(g.s), before); }

test('初始材料正好製作兩種武器；製作必成且不換月，材料不足原子拒絕', () => {
  const g = game(); assert.equal(g.s.month, 0); assert.equal(g.s.open, false);
  craft(g, 'staff'); craft(g, 'sword'); assert.equal(g.s.month, 0);
  assert.equal(W.inventory(g.s).length, 2); assert.equal(g.s.materials.木頭, 0); assert.equal(g.s.materials.鐵, 0);
  rejectWithoutMutation(g, { type: 'craft', recipe: 'staff' }, /需要/);
  rejectWithoutMutation(g, { type: 'craft', recipe: 'unknown' }, /尚未/);
  rejectWithoutMutation(g, { type: 'craft', recipe: 'bell' }, /尚未/);
});
test('首次開店第 1 月；重複開店不換月不扣費；關店不結算', () => {
  const g = game(); g.do({ type: 'open' }); assert.equal(g.s.month, 1); assert.equal(g.s.coins, 12);
  rejectWithoutMutation(g, { type: 'open' }, /已經營業/);
  const news = g.s.news.length; g.do({ type: 'close' }); assert.equal(g.s.month, 1); assert.equal(g.s.coins, 12); assert.equal(g.s.news.length, news);
  rejectWithoutMutation(g, { type: 'close' }, /已經關店/);
  craft(g, 'staff'); assert.equal(g.s.month, 1); g.do({ type: 'open' }); assert.equal(g.s.month, 2); assert.equal(g.s.coins, 4);
});
test('熟客可持有兩件；出售移出庫存；需求順序、對話與出售均去重', () => {
  const g = game(); const { staff, sword } = intro(g);
  assert.equal(W.inventory(g.s).length, 0); assert.equal(W.owned(g.s, 'cen').length, 2); assert.equal(W.activeVisit(g.s), null);
  assert.equal(g.s.coins, 40); assert.equal(g.s.npcs.cen.trust, 3); assert.equal(g.s.reputation, 2);
  rejectWithoutMutation(g, { type: 'sell', itemId: staff.id, visitId: 'intro-cen' }, /已處理/);
  assert.equal(g.s.items[sword.id].owner, 'cen');
});
test('提早開店、教學中關店、存檔重載與跨月都保留需求，不另生熟客', () => {
  const g = game(); g.do({ type: 'open' }); g.do({ type: 'close' });
  const staff = craft(g, 'staff'), sword = craft(g, 'sword'); g.do({ type: 'open' }); sell(g, staff);
  g.do({ type: 'close' }); g.s = W.importSave(W.exportSave(g.s)); g.do({ type: 'open' });
  assert.deepEqual(W.activeVisit(g.s).needs, ['sword']); sell(g, sword); assert.equal(W.openingDone(g.s), true);
  assert.equal(g.s.visits.filter(v => v.kind === 'intro').length, 1);
});
test('自然教學完整：兩件→熟客→採購→下月交貨情報→新需求', () => {
  const g = game(); assert.equal(W.tutorialStep(g.s).step, 1); intro(g); assert.equal(W.tutorialStep(g.s).step, 3);
  order(g, '銅'); assert.equal(W.tutorialStep(g.s).step, 4); assert.equal(g.s.coins, 30); assert.equal(g.s.materials.銅, 0);
  nextMonth(g); assert.equal(g.s.month, 2); assert.equal(g.s.materials.銅, 1); assert.equal(W.tutorialStep(g.s).step, 5);
  assert.equal(W.activeVisit(g.s).npc, 'he'); const watering = craft(g, 'watering'); sell(g, watering);
  assert.equal(W.activeVisit(g.s).npc, 'cen'); assert.equal(W.owned(g.s, 'he').length, 1);
});
test('教學中斷使交貨落在奇數月，首次新需求仍是銅澆水壺', () => {
  const g = game(); intro(g, true); order(g, '銅'); nextMonth(g);
  assert.equal(g.s.month, 3); assert.deepEqual(W.activeVisit(g.s).needs, ['watering']);
  sell(g, craft(g, 'watering')); assert.equal(W.owned(g.s, 'he').length, 1);
});
test('採購立即扣款、重複 request ID／過期畫面不扣款、交付僅一次', () => {
  const g = game(); intro(g); const rev = g.s.revision; order(g, '鐵', 2, 'same');
  rejectWithoutMutation(g, { type: 'order', material: '鐵', quantity: 2, requestId: 'same' }, /已委託/);
  rejectWithoutMutation(g, { type: 'order', material: '鐵', quantity: 2, requestId: 'new', expectedRevision: rev }, /已處理/);
  nextMonth(g); assert.equal(g.s.materials.鐵, 2); nextMonth(g); assert.equal(g.s.materials.鐵, 2);
  assert.equal(g.s.news.filter(n => n.id.startsWith('delivery-')).length, 1);
});
test('無效採購材料／小數／負數／零／過量不修改任何狀態', () => {
  const g = game(); intro(g);
  for (const quantity of [-1, 0, 1.1, 10, NaN, Infinity, '1']) rejectWithoutMutation(g, { type: 'order', material: '木頭', quantity, requestId: 'bad' }, /整數/);
  rejectWithoutMutation(g, { type: 'order', material: '鑽石', quantity: 1, requestId: 'bad' }, /整數/);
});
test('對話一次增信任、不合用途不成交，未處理下一人不能先交易', () => {
  const g = game(); intro(g); order(g, '木頭', 2); nextMonth(g); const staff = craft(g, 'staff');
  const v = W.activeVisit(g.s); g.do({ type: 'talk', visitId: v.id });
  rejectWithoutMutation(g, { type: 'talk', visitId: v.id }, /已經聽/);
  rejectWithoutMutation(g, { type: 'sell', visitId: v.id, itemId: staff.id }, /不符合/);
  const later = g.s.visits.find(x => x.status === 'waiting' && x.npc === 'cen');
  rejectWithoutMutation(g, { type: 'sell', visitId: later.id, itemId: staff.id }, /已處理/);
  g.do({ type: 'decline', visitId: v.id }); sell(g, staff); assert.equal(W.owned(g.s, 'cen').length, 3);
});
test('持有者使用信、月情報及退役贈還各一次；沒有未經同意取得', () => {
  const g = game(); const { staff } = intro(g); order(g, '銅'); nextMonth(g); nextMonth(g); nextMonth(g);
  assert.equal(g.s.news.filter(n => n.id === `use-${staff.id}`).length, 1);
  assert.equal(g.s.news.filter(n => n.id === `retire-${staff.id}`).length, 1);
  assert.equal(g.s.items[staff.id].status, 'owned'); g.do({ type: 'reclaim', itemId: staff.id });
  assert.equal(g.s.items[staff.id].status, 'inventory'); assert.equal(W.owned(g.s, 'cen').length, 1);
  rejectWithoutMutation(g, { type: 'reclaim', itemId: staff.id }, /已領回/);
  nextMonth(g); assert.equal(g.s.returns.filter(o => o.itemId === staff.id).length, 1);
});
test('熔鍊防重複、禁止熔鍊買家持有物；同材質傳承消耗一次且保存舊檔', () => {
  const g = game(); const { staff, sword } = intro(g); order(g, '木頭', 2); nextMonth(g); nextMonth(g); nextMonth(g);
  rejectWithoutMutation(g, { type: 'smelt', itemId: sword.id }, /舊物/);
  g.do({ type: 'reclaim', itemId: staff.id }); const before = g.s.materials.木頭;
  g.do({ type: 'smelt', itemId: staff.id }); assert.equal(g.s.materials.木頭, before + 1);
  rejectWithoutMutation(g, { type: 'smelt', itemId: staff.id }, /舊物/);
  const inherited = craft(g, 'stool'), plain = craft(g, 'staff');
  assert.equal(inherited.legacy, staff.id); assert.equal(plain.legacy, null); assert.equal(g.s.legacies[0].usedBy, inherited.id);
  assert.equal(g.s.items[staff.id].status, 'smelted'); assert.equal(W.inventory(g.s).some(i => i.id === staff.id), false);
});
test('舊物合理贈還後可再售、同一物保留原先持有者與使用紀錄', () => {
  const g = game(); const { staff } = intro(g); order(g, '銅'); nextMonth(g); nextMonth(g); nextMonth(g);
  g.do({ type: 'reclaim', itemId: staff.id });
  while (W.activeVisit(g.s) && W.activeVisit(g.s).npc !== 'cen') g.do({ type: 'decline', visitId: W.activeVisit(g.s).id });
  // An old pending request from month 2 remains the same staff request.
  sell(g, g.s.items[staff.id]); assert.equal(g.s.items[staff.id].status, 'owned');
  assert.equal(g.s.items[staff.id].history.filter(h => h.text.includes('買下')).length, 2);
  rejectWithoutMutation(g, { type: 'reclaim', itemId: staff.id }, /已領回/);
});
test('鑑定每件一次、成長配方與品質確定，不耗月', () => {
  const g = game(); intro(g); order(g, '木頭', 5); nextMonth(g); const item = craft(g, 'stool');
  g.do({ type: 'talk', visitId: W.activeVisit(g.s).id });
  g.do({ type: 'appraise', itemId: item.id }); assert.equal(g.s.xp.appraisal, 1); assert.equal(g.s.month, 2);
  rejectWithoutMutation(g, { type: 'appraise', itemId: item.id }, /已鑑定/);
  const second = craft(g, 'staff'); assert.equal(second.quality, 1); assert.equal(W.unlocked(g.s, 'lamp'), true);
});
test('同品質同售價，不因配方或材料加價；熟客保持中性身分', () => {
  for (let quality = 0; quality <= 2; quality++) {
    for (const recipe of Object.keys(W.RECIPES)) assert.equal(W.price({ recipe, quality }), W.QUALITY_PRICE[quality]);
  }
  assert.equal(W.PEOPLE.cen.role, '熟客');
});
test('第一次交貨不一次揭露配方或鑑定，需求對話才新增合用配方', () => {
  const g = game(); intro(g); order(g, '銅'); nextMonth(g);
  assert.deepEqual(W.visibleRecipes(g.s), ['staff', 'sword']); assert.equal(W.canAppraise(g.s), false);
  const v = W.activeVisit(g.s); assert.equal(v.npc, 'he');
  rejectWithoutMutation(g, { type: 'appraise', itemId: 'item-1' }, /品質需求/);
  const detail = g.do({ type: 'talk', visitId: v.id }).message;
  assert.match(detail, /接縫與品質/); assert.deepEqual(W.visibleRecipes(g.s), ['staff', 'sword', 'watering']);
  assert.equal(W.canAppraise(g.s), true); assert.equal(W.visibleRecipes(g.s).includes('bell'), false);
});
test('採購教學依開關店狀態指示，舊格式存檔仍可重載接續', () => {
  const g = game(); intro(g); order(g, '銅');
  assert.match(W.tutorialStep(g.s).text, /先關店/); g.do({ type: 'close' });
  assert.equal(W.tutorialStep(g.s).title, '開店收取材料'); assert.doesNotMatch(W.tutorialStep(g.s).text, /先關店/);
  g.s = W.importSave(W.exportSave(g.s)); g.do({ type: 'open' }); W.validate(g.s);
});
test('新月只有具體事件，沒有事件則一筆簡短消息，不重複氣氛敘述', () => {
  const g = game(); intro(g); order(g, '銅'); nextMonth(g);
  assert.equal(g.s.news.some(n => n.month === 2 && n.id === 'month-2'), false);
  nextMonth(g); assert.equal(g.s.news.find(n => n.id === 'month-3').text, '本月沒有新消息。');
});
test('欠款不結束或軟鎖；可記帳採購，銷售先還欠款', () => {
  const g = game(); intro(g); for (let n = 0; n < 8; n++) nextMonth(g);
  assert(g.s.debt > 0); assert.equal(g.s.coins, 0); const debt = g.s.debt;
  order(g, '銅'); assert.equal(g.s.debt, debt + 10); nextMonth(g); assert.equal(g.s.materials.銅, 1);
  const item = craft(g, 'watering'); const prior = g.s.debt; sell(g, item); assert(g.s.debt < prior);
  assert.equal(g.s.month, 10);
});
test('匯出／匯入往返保留教學、隊列、訂單、所有權與事件', () => {
  const g = game(); intro(g, true); order(g, '銀', 2); g.do({ type: 'close' });
  const encoded = W.exportSave(g.s); assert.deepEqual(W.importSave(encoded), g.s);
  g.s = W.importSave(encoded); g.do({ type: 'open' }); assert.equal(g.s.materials.銀, 2);
  const before = W.exportSave(g.s); assert.throws(() => W.importSave('{broken')); assert.equal(W.exportSave(g.s), before);
});
test('匯入拒絕負材料、錯誤持有者、重複訂單／熔鍊、錯誤傳承、超前月結', () => {
  const g = game(); const { staff } = intro(g); order(g, '銅');
  const mutations = [s => s.materials.鐵 = -1, s => s.items[staff.id].owner = 'fake', s => s.orders.push(s.orders[0]), s => s.lastSettled++, s => s.seq = 0, s => s.items[staff.id].legacy = staff.id];
  for (const mutate of mutations) { const s = JSON.parse(JSON.stringify(g.s)); mutate(s); assert.throws(() => W.importSave(JSON.stringify({ game: '鳥信工坊', schema: 1, state: s })), /存檔/); }
});
test('持續經營能解鎖金鈴信任委託及人物故事，完成後不再重發', () => {
  const g = game(); intro(g); order(g, '木頭', 9); order(g, '鐵', 9); order(g, '銅', 9); order(g, '銀', 9); order(g, '金', 9);
  let commissions = 0;
  for (let month = 0; month < 8; month++) {
    nextMonth(g);
    while (W.activeVisit(g.s)) {
      const v = W.activeVisit(g.s); g.do({ type: 'talk', visitId: v.id });
      const item = craft(g, v.needs[0]); if (v.kind === 'commission') commissions++;
      sell(g, item);
    }
  }
  assert.equal(commissions, 1); assert.equal(g.s.npcs.shu.goldDone, true); assert.equal(g.s.npcs.he.story, true); assert.equal(g.s.npcs.shu.story, true);
  assert.equal(new Set(g.s.news.map(n => n.id)).size, g.s.news.length); W.validate(g.s);
});
