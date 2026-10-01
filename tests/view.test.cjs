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
  return { html: () => element('app').innerHTML, ledger: () => element('ledger').innerHTML, async click(dataset) { const b = { dataset, disabled: false }; await listeners.get('click')({ target: { closest: () => b } }); } };
}
function game() { return { s: W.initialState(), do(a) { this.s = W.dispatch(this.s, a).state; } }; }
function intro(g) {
  g.do({ type: 'craft', recipe: 'staff' }); g.do({ type: 'craft', recipe: 'sword' }); g.do({ type: 'open' });
  for (const itemId of ['item-1', 'item-2']) g.do({ type: 'sell', itemId, visitId: W.activeVisit(g.s).id });
  g.do({ type: 'order', material: '銅', quantity: 1, requestId: 'first' });
  g.do({ type: 'close' }); g.do({ type: 'open' });
}
const cards = html => (html.match(/class="recipe"/g) || []).length;
const itemCards = html => (html.match(/class="item"/g) || []).length;
const visibleText = html => html.replace(/<[^>]*>/g, '');
test('開場只兩份配方與基本頁籤；帳本集中頂欄，沒有常駐介紹或成長公式', () => {
  const v = view(W.initialState()); assert.equal(cards(v.html()), 2);
  assert.equal((v.html().match(/data-tab=/g) || []).length, 3);
  assert.match(v.ledger(), /硬幣/); assert.match(v.ledger(), /20/);
  assert.doesNotMatch(v.html(), /class="intro"|日常已展開|鑑定物品|銀燈|金鈴|每 3 點/);
});
test('交貨後不一次揭露全部功能；對話新增配方，鑑定前不揭露品質', async () => {
  const g = game(); intro(g); let v = view(g.s);
  assert.equal(cards(v.html()), 2); assert.doesNotMatch(v.html(), /data-tab="people"|data-tab="collection"|鑑定物品/);
  g.do({ type: 'talk', visitId: W.activeVisit(g.s).id }); g.do({ type: 'craft', recipe: 'watering' }); v = view(g.s);
  assert.equal(cards(v.html()), 3); assert.match(v.html(), /接縫與品質/);
  await v.click({ tab: 'inventory' }); assert.match(v.html(), /鑑定物品/);
  assert.doesNotMatch(visibleText(v.html()), /樸實|第 3 階|item-\d|order-\d/);
  const item = W.inventory(g.s)[0]; g.do({ type: 'appraise', itemId: item.id }); v = view(g.s);
  await v.click({ tab: 'inventory' }); assert.match(visibleText(v.html()), /樸實/); assert.match(visibleText(v.html()), /第 3 階/);
});
test('完成第一個新需求後不保留完成教學；收藏僅取得舊物後出現', () => {
  const g = game(); intro(g); g.do({ type: 'talk', visitId: W.activeVisit(g.s).id }); g.do({ type: 'craft', recipe: 'watering' });
  const item = W.inventory(g.s)[0]; g.do({ type: 'sell', itemId: item.id, visitId: W.activeVisit(g.s).id });
  let v = view(g.s); assert.doesNotMatch(v.html(), /aria-label="目前目標"/); assert.doesNotMatch(v.html(), /data-tab="collection"/);
  for (let n = 0; n < 2; n++) { g.do({ type: 'close' }); g.do({ type: 'open' }); }
  v = view(g.s); assert.doesNotMatch(v.html(), /data-tab="collection"/);
  g.do({ type: 'reclaim', itemId: 'item-1' }); v = view(g.s);
  assert.match(v.html(), /data-tab="collection"/); assert.match(v.html(), /舊物回到工坊/);
});
test('長庫存分頁，第二頁可到達，沒有一次輸出所有物品', async () => {
  const g = game(); intro(g); g.do({ type: 'order', material: '木頭', quantity: 9, requestId: 'bulk' });
  g.do({ type: 'close' }); g.do({ type: 'open' });
  for (let n = 0; n < 9; n++) g.do({ type: 'craft', recipe: 'stool' });
  const v = view(g.s); await v.click({ tab: 'inventory' });
  assert.equal(itemCards(v.html()), 6); assert.match(v.html(), /第 1／2 頁/);
  await v.click({ page: 'inventory', number: '2' }); assert.equal(itemCards(v.html()), 3); assert.match(v.html(), /第 2／2 頁/);
});
test('鳥信預設本月，歷史月份經選擇查看；採購時間只寫一次', async () => {
  const g = game(); intro(g); const v = view(g.s); await v.click({ tab: 'mail' });
  assert.match(v.html(), /id="mail-month"/); assert.doesNotMatch(v.html(), /第一批作品/);
  await v.click({ tab: 'purchase' }); assert.equal((visibleText(v.html()).match(/第 3 月開店時交貨/g) || []).length, 1);
});
test('舊存檔中的已製作配方與鑑定紀錄仍保留，不重置進度', async () => {
  const g = game(); intro(g); g.do({ type: 'order', material: '木頭', quantity: 6, requestId: 'practice' });
  g.do({ type: 'close' }); g.do({ type: 'open' });
  for (let n = 0; n < 4; n++) g.do({ type: 'craft', recipe: 'stool' });
  const old = JSON.parse(W.exportSave(g.s)); const first = W.inventory(old.state)[0];
  first.appraised = true; old.state.xp.appraisal = 1;
  const restored = W.importSave(JSON.stringify(old)); const v = view(restored);
  assert(W.visibleRecipes(restored).includes('stool')); await v.click({ tab: 'inventory' }); assert.match(v.html(), /細緻|樸實|精良/);
  assert.equal(restored.schema, 1); assert.equal(restored.xp.appraisal, 1);
});
