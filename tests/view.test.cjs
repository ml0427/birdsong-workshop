'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = require('../engine.js');

// Legacy UI regressions use the same actual-app harness and read monthly cards
// as setup. The dedicated monthly UI tests inspect each card without auto-read.
const {view:actualView}=require('./ui-harness.cjs');
function view(state){const v=actualView({state});return {...v,ledger:()=>v.element('ledger').innerHTML,click:dataset=>v.click({dataset,disabled:false})};}


const { game, craft, intro, order, explore, ready, next, at, returnedStaff } = require('./helpers.cjs');
const cards = html => (html.match(/class="recipe"/g) || []).length;
const text = html => html.replace(/<[^>]*>/g, '');
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function action(v,type) { const found=[...v.html().matchAll(/data-action="([^"]+)"/g)].map(m=>decode(m[1])).find(s=>JSON.parse(s).type===type);assert(found,`missing ${type}`);return found; }
function customer() { const g=ready();g.npc({type:'talk'});g.npc({type:'accept-commission',requestId:'view-customer'});return g; }
test('首屏只兩配方三分頁；關店櫃臺留開店控制，不顯人物',()=>{
 const v=view(W.initialState());assert.equal(cards(v.html()),2);assert.equal((v.html().match(/data-tab=/g)||[]).length,3);assert.match(v.html(),/class="counter door-only"/);assert.match(v.html(),/id="door"/);assert.doesNotMatch(v.html(),/class="visitor"|目前顧客|counter-scroll/);assert.match(action(v,'open'),/expectedRevision/);assert.doesNotMatch(text(v.html()),/銅|銀|金鈴|護腕|護符|工時/);assert.match(v.html(),/木頭 <strong>3/);
});
test('開始後UI顯示一月工期；實際按鈕保存，重載與關店不完成',async()=>{
 const v=view(W.initialState());await v.click({action:action(v,'craft')});assert.equal(v.state().month,0);assert.equal(W.inventory(v.state()).length,0);assert.match(v.html(),/製作中|尚需 1 個月/);let reload=view(v.state());assert.match(reload.html(),/第 1 月開店完工/);await reload.click({action:action(reload,'open')});assert.equal(W.inventory(reload.state()).length,1);assert.equal(reload.state().xp.craft,1);await reload.click({action:action(reload,'close')});assert.match(reload.html(),/door-only/);assert.doesNotMatch(reload.html(),/目前顧客/);assert.match(action(reload,'open'),/open/);
});
test('開場成交後引導材料委託，只有木鐵選單與未知探索',async()=>{
 const g=game();intro(g);const v=view(g.s);await v.click({tab:'purchase'});assert.match(v.html(),/order-quantity/);assert.doesNotMatch(v.html(),/max="|value="銅"|value="銀"|value="金"/);assert.match(text(v.html()),/探索未辨識材料/);assert.doesNotMatch(text(v.html()),/銅|銀|金鈴/);const a=JSON.parse(action(v,'explore'));assert.equal(a.visitId,'intro-cen');assert.equal(a.counterId,'intro-cen@1');
});
test('人物忙碌顯示任務方向，材料按鈕禁用，關店不交代新任務',async()=>{
 const g=customer(),v=view(g.s);await v.click({tab:'purchase'});assert.match(text(v.html()),/對方請工坊製作/);assert.match(v.html(),/disabled[^>]+data-action="[^"]+order-form/);assert.match(v.html(),/disabled[^>]+data-action="[^"]+explore/);await v.click({action:action(v,'close')});assert.doesNotMatch(v.html(),/order-form|id="order-quantity"|目前顧客/);assert.match(v.html(),/id="door"/);
});
test('沒現貨顯示接製作委託，開始與完工後保留，不提供一般售出',async()=>{
 const g=ready(),v=view(g.s);assert.match(v.html(),/沒現貨，接製作委託/);await v.click({action:action(v,'accept-commission')});assert.equal(v.state().commissions[0].status,'crafting');await v.click({tab:'craft'});assert.match(text(v.html()),/保留給小禾/);await v.click({action:action(v,'close')});await v.click({action:action(v,'open')});while(W.activeVisit(v.state())?.npc!=='he')await v.click({action:action(v,W.activeVisit(v.state()).phase==='service'?'leave':'decline')});assert.equal(W.activeVisit(v.state()).kind,'delivery');assert.match(v.html(),/當面交貨後再付款|交付委託/);assert.doesNotMatch(v.html(),/data-action="[^"]+&quot;sell&quot;/);await v.click({action:action(v,'deliver')});assert.equal(v.state().commissions[0].status,'delivered');assert.equal(v.state().items[v.state().commissions[0].itemId].owner,'he');assert.match(text(v.html()),/等真正用過/);
});
test('缺材料製作委託待開工，可在本人櫃臺取消',async()=>{
 const g=ready();g.s.materials.銅=0;g.npc({type:'accept-commission',requestId:'missing'});const v=view(g.s);assert.match(v.html(),/當面取消未開工委託/);assert.match(v.html(),/disabled[^>]+data-action="[^"]+commissionId/);await v.click({action:action(v,'cancel-commission')});assert.equal(v.state().commissions[0].status,'cancelled');
});
test('探索實際按鈕去重、新材料下月才顯示與對話學配方',async()=>{
 const g=game();intro(g);const v=view(g.s);await v.click({tab:'purchase'});const a=action(v,'explore');await v.click({action:a});const before=v.state();await v.click({action:a});assert.deepEqual(v.state(),before);assert.match(v.notice(),/已處理/);assert.doesNotMatch(text(v.html()),/銅|銀|金鈴/);await v.click({action:action(v,'close')});await v.click({action:action(v,'open')});assert(v.state().knownMaterials.includes('銅'));await v.click({tab:'craft'});assert.equal(cards(v.html()),2);await v.click({action:action(v,'talk')});assert.equal(cards(v.html()),3);assert.match(v.html(),/銅護腕/);assert.doesNotMatch(text(v.html()),/銀護符|金鈴/);
});
test('實際採購表單一萬合法，小數拒絕且保留狀態',async()=>{
 const g=game();intro(g);const v=view(g.s);await v.click({tab:'purchase'});v.element('order-material').value='木頭';v.element('order-quantity').value='1.5';await v.click({action:action(v,'order-form')});assert.equal(v.state().orders.length,0);assert.match(v.notice(),/安全整數/);v.element('order-quantity').value='10000';await v.click({action:action(v,'order-form')});assert.equal(v.state().orders[0].quantity,10000);assert.doesNotMatch(text(v.html()),/尚無材料委託/);
});
test('舊畫面動作拒絕，關店仍能開工且保存製作進度',async()=>{
 const g=ready(),v=view(g.s),talk=action(v,'talk');await v.click({action:action(v,'close')});await v.click({action:talk});assert.match(v.notice(),/已處理/);await v.click({action:JSON.stringify({type:'craft',recipe:'staff',expectedRevision:v.state().revision})});assert.equal(Object.values(v.state().items).at(-1).status,'crafting');assert.equal(v.state().month,2);assert.deepEqual(view(v.state()).state(),v.state());
});
test('收藏熔鍊物只顯已消耗，不建議修復再售，保留故事',async()=>{
 const {g,item}=returnedStaff();g.do({type:'smelt',itemId:item.id});const v=view(g.s);await v.click({tab:'collection'});const fragment=v.html().split('<article class="item">').find(x=>x.includes('已熔鍊／拆解'));assert(fragment);assert.match(text(fragment),/實物已消耗.*不能修復或出售/);assert.doesNotMatch(text(fragment),/磨損，修復後才能推薦/);assert.match(fragment,/物品故事/);
});
test('語言、載入順序、單一櫃臺開關店與版本一致',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.match(html,/lang="zh-Hant"/);assert.doesNotMatch(html,/id="door"/);assert(html.indexOf('src="content.js')<html.indexOf('src="engine.js'));assert(html.indexOf('src="engine.js')<html.indexOf('src="app.js'));assert.match(html,/v0.20/);assert.equal((html.match(/\?v=0\.20/g)||[]).length,5);assert.match(fs.readFileSync(path.join(__dirname,'../server.cjs'),'utf8'),/'\/content\.js'.*'text\/javascript'/);
});
