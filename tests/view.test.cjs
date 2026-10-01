'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const W = require('../engine.js');

// Render the actual UI script without launching a browser. These checks cover
// state-driven text and controls, not CSS geometry or browser interaction.
function view(state) {
  const elements = new Map(), listeners = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', classList: { toggle() {} }, addEventListener() {}, scrollTo() {}, focus() {} });
    return elements.get(id);
  };
  const storage = new Map([['birdsong-workshop-save-v1', W.exportSave(state)]]);
  const document = { getElementById: element, querySelector: () => null, addEventListener: (name, cb) => listeners.set(name, cb) };
  const context = { window: { Workshop: W, addEventListener() {} }, document, localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) }, setTimeout, URL, Blob };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), context);
  return { element, state: () => W.importSave(storage.get('birdsong-workshop-save-v1')), notice: () => element('notice').textContent, html: () => element('app').innerHTML, ledger: () => element('ledger').innerHTML, async click(dataset) { const b = { dataset, disabled: false }; await listeners.get('click')({ target: { closest: () => b } }); } };
}

const { game, craft, intro, order, next, depart, at, returnedStaff } = require('./helpers.cjs');
const cards = html => (html.match(/class="recipe"/g) || []).length;
const itemCards = html => (html.match(/class="item"/g) || []).length;
const text = html => html.replace(/<[^>]*>/g, '');
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function action(v, type) {
  const found = [...v.html().matchAll(/data-action="([^"]+)"/g)].map(m => decode(m[1])).find(s => JSON.parse(s).type === type);
  assert(found, `missing ${type}`); return found;
}
function ready() { const g = game(); intro(g); order(g, '銅'); next(g); return g; }
test('首屏兩份配方與基本頁籤；關店完全沒有櫃臺，工作區擴展', () => {
  const v = view(W.initialState()); assert.equal(cards(v.html()), 2); assert.equal((v.html().match(/data-tab=/g) || []).length, 3);
  assert.match(v.html(), /class="layout closed"/); assert.doesNotMatch(v.html(), /<aside|目前顧客|櫃臺暫休/);
  assert.match(v.html(), /工坊記事|工坊簡介/); assert.match(v.ledger(), /20/);
  assert.doesNotMatch(text(v.html()), /效能|耐久|品質|特性|銀護符|金鈴/);
});
test('開場兩件售出後阿岑仍在場，送客禁用，採購表無max限制', async () => {
  const g = game(); intro(g); const v = view(g.s); assert.match(v.html(), /兩件武器都收好了/);
  assert.match(v.html(), /disabled[^>]+data-action="[^"]+leave/);
  await v.click({ tab: 'purchase' }); assert.match(v.html(), /委託阿岑採購/); assert.doesNotMatch(v.html(), /max="9"|1 至 9/);
  const a = JSON.parse(action(v, 'order-form')); assert.equal(a.visitId, 'intro-cen'); assert.equal(a.counterId, 'intro-cen@1');
});
test('首次對話才新增護腕配方與鑑定；鑑定前隱藏完整數值', async () => {
  const g = ready(); let v = view(g.s); assert.equal(cards(v.html()), 2); assert.doesNotMatch(v.html(), /鑑定物品|data-tab="people"|data-tab="collection"/);
  g.npc({ type: 'talk' }); const i = craft(g, 'bracer'); v = view(g.s); assert.equal(cards(v.html()), 3); assert.match(v.html(), /接縫與品質/);
  await v.click({ tab: 'inventory' }); assert.match(text(v.html()), /鑑定物品|護身/); assert.doesNotMatch(text(v.html()), /樸實|第 3 階|效能 6|item-\d/);
  g.do({ type: 'appraise', itemId: i.id }); v = view(g.s); await v.click({ tab: 'inventory' }); assert.match(text(v.html()), /樸實|第 3 階|效能 6|耐久 9／9/);
});
test('採購對象隨櫃臺改變，關店只留紀錄與既有訂單，不保留新採購操作', async () => {
  const g = ready(); let v = view(g.s); await v.click({ tab: 'purchase' }); assert.match(v.html(), /委託小禾採購/);
  g.npc({ type: 'order', material: '銀', quantity: 100, requestId: 'he' }); g.do({ type: 'close' }); v = view(g.s);
  await v.click({ tab: 'purchase' }); assert.doesNotMatch(v.html(), /order-form|id="order-quantity"|<aside/);
  assert.match(v.html(), /小禾 · 銀 100 個/); assert.match(v.html(), /已接受的訂單仍會按時交付/);
});
test('實際UI按鈕保存進度、關店再製作，陳舊NPC動作被拒絕', async () => {
  const g = ready(), v = view(g.s); const talk = action(v, 'talk');
  await v.click({ action: talk }); assert.equal(v.state().visits.find(x => x.id === W.activeVisit(g.s).id).asked, true);
  await v.click({ action: JSON.stringify({ type: 'close', expectedRevision: v.state().revision }) }); assert.equal(v.state().open, false);
  await v.click({ action: talk }); assert.match(v.notice(), /已處理/); assert.doesNotMatch(v.html(), /<aside/);
  await v.click({ action: JSON.stringify({ type: 'craft', recipe: 'bracer', expectedRevision: v.state().revision }) });
  assert.equal(W.inventory(v.state())[0].recipe, 'bracer'); assert.equal(v.state().month, 2);
});
test('實際採購表輸入10000個可保存，非安全值拒絕且保持狀態', async () => {
  const g = game(); intro(g); const v = view(g.s); await v.click({ tab: 'purchase' });
  v.element('order-material').value = '木頭'; v.element('order-quantity').value = '10000'; await v.click({ action: action(v, 'order-form') });
  assert.equal(v.state().orders[0].quantity, 10000); const before = v.state();
  v.element('order-material').value = '金'; v.element('order-quantity').value = '1.5'; await v.click({ action: action(v, 'order-form') });
  assert.deepEqual(v.state(), before); assert.match(v.notice(), /安全整數/);
});
test('長庫存與收藏分頁仍可到達，沒有一次輸出全部', async () => {
  const g = ready(); order(g, '木頭', 12); next(g); for (let n = 0; n < 12; n++) craft(g, 'shield');
  const v = view(g.s); await v.click({ tab: 'inventory' }); assert.equal(itemCards(v.html()), 6); assert.match(v.html(), /第 1／2 頁/);
  await v.click({ page: 'inventory', number: '2' }); assert.equal(itemCards(v.html()), 6); assert.match(v.html(), /第 2／2 頁/);
});
test('鳥信僅提供通知，領回只在本人櫃臺，修復與收藏在實物回來後出現', async () => {
  const g = ready(); next(g); let v = view(g.s); await v.click({ tab: 'mail' });
  assert.match(v.html(), /當面收下才取得實物/); assert.doesNotMatch(v.html(), /"reclaim"|data-tab="collection"/);
  at(g, 'cen'); v = view(g.s); assert.match(v.html(), /收下贈還木杖/);
  g.npc({ type: 'reclaim', itemId: 'item-1' }); v = view(g.s); assert.match(v.html(), /data-tab="collection"/);
  await v.click({ tab: 'inventory' }); assert.match(v.html(), /練習修復（免費一次）|熔鍊／拆解/);
});
test('同名同價推薦能從特性、耐久與傳承來源辨識，選項visit識別正確', () => {
  const { g, item } = returnedStaff(); g.s.visits.find(v => v.npc === 'he').asked = true; g.s.xp.craft = 9;
  g.do({ type: 'smelt', itemId: item.id }); const inherited = craft(g, 'staff'); g.s.materials.木頭++; const plain = craft(g, 'staff');
  const current = W.activeVisit(g.s); current.needs = ['staff']; current.npc = 'shu'; current.minQuality = 0;
  // Remove other waiting shu visits before this focused render fixture.
  for (const v of g.s.visits) if (v !== current && v.status === 'waiting' && v.npc === 'shu') v.status = 'done';
  const v = view(g.s); assert.match(v.html(), /輕巧、堅固/); assert.match(v.html(), /傳承自木杖/); assert.match(v.html(), /第 1 件/); assert.match(v.html(), /第 2 件/);
  assert.equal(W.price(inherited), W.price(plain)); assert.match(v.html(), new RegExp(`data-visit="${current.id}"`));
});
test('原退役者不買回的真正原因顯示於作品卡，不泛稱品質或用途不符', async () => {
  const { g, item } = returnedStaff(); g.do({ type: 'repair', itemId: item.id }); const v = view(g.s); await v.click({ tab: 'inventory' });
  assert.match(text(v.html()), /阿岑已退役並贈還這一件，不再買回同一舊物/);
  assert.match(text(v.html()), /其他使用者/); assert.doesNotMatch(v.html(), /data-action="[^"]+sell[^"]+item-1/);
});
test('成交後短對話說等待實際使用，沒有新購物操作，採購仍可辦理', () => {
  const g = ready(); g.npc({ type: 'talk' }); const item = craft(g, 'bracer'); g.npc({ type: 'sell', itemId: item.id });
  const v = view(g.s); assert.match(text(v.html()), /等真正用過再告訴你結果/); assert.doesNotMatch(v.html(), /id="recommend-item"/);
  assert.match(v.html(), /委託小禾採購/); assert.equal(g.s.content.events.some(e => e.key === 'he-wrist'), false);
});
