'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js'),{view}=require('./ui-harness.cjs');
const {ready,next,at}=require('./helpers.cjs'),{checkpoint,routeCampaign,stateGame,oldV4}=require('./journey-helpers.cjs');
const text=s=>s.replace(/<[^>]*>/g,'');
test('首屏沒有隱藏任務表，首次小禾對話只給近程方向及可選委託',async()=>{
 const fresh=view({raw:null});assert.doesNotMatch(text(fresh.html()),/驛道|辨路|勘路|世界任務/);const g=ready(),v=view({state:g.s});assert.doesNotMatch(text(v.html()),/驛道|辨路 ≥|效能 ≥|勘路節點/);await v.clickAction('talk');assert.match(text(v.html()),/熟悉近程路線/);await v.clickTab('purchase');assert(v.button('scout'));assert.doesNotMatch(text(v.html()),/舊驛道|金鈴|銀護符/);
});
test('近程勘路真實按鈕保存／共用任務／雙點去重，關店重載次月交付',async()=>{
 const g=ready(),v=view({state:g.s}),wood=g.s.materials.木頭;await v.clickTab('purchase');const b=v.button('scout'),copy={dataset:{...b.dataset},disabled:false};await v.click(b);const saved=v.raw();await v.click(b);await v.click(copy);assert.equal(v.raw(),saved);assert.equal(v.state().journey.outings.length,1);assert(v.button('order-form').disabled);assert(v.button('explore').disabled);assert.match(text(v.html()),/玩家請對方近程勘路/);await v.clickAction('close');assert(!v.buttons().some(b=>b.action?.type==='scout'));const reload=view({raw:v.raw()});await reload.clickAction('open');assert.equal(reload.state().materials.木頭,wood+1);assert.equal(W.journeyProgress(reload.state()).stage,1);await reload.clickTab('people');assert.match(text(reload.html()),/等級 1.*辨路 1/);assert.doesNotMatch(text(reload.html()),/等級 ≥|辨路 ≥|效能 ≥|路標已確認/);
});
test('已有線索與能力缺口出現在人物頁，沒有先宣稱個人／世界完成',async()=>{
 const g=checkpoint(s=>s.month===5&&W.journeyProgress(s).stage===2),v=view({state:g.s});await v.clickTab('people');assert.match(text(v.html()),/等級 2.*辨路 2/);assert.match(text(v.html()),/舊驛道的路標.*親自試過飛石防護/);assert.doesNotMatch(text(v.html()),/驛道已重通|路標已確認|效能 ≥|耐久 ≥/);
});
test('補裝備需求用既有委託 UI，接受與完工仍保留節點，不假稱已冒險',async()=>{
 const g=checkpoint(s=>s.month===6&&W.journeyProgress(s).pathfinding===3);at(g,'he');const v=view({state:g.s});assert.match(text(v.html()),/細緻以上.*護腕/);await v.clickAction('accept-commission');assert.equal(W.journeyProgress(v.state()).stage,2);const c=v.state().commissions.at(-1);assert.equal(c.recipe,'bracer');assert.equal(c.traitRequired,'guard');assert.equal(c.status,'crafting');await v.clickAction('close');await v.clickAction('open');assert.equal(W.journeyProgress(v.state()).stage,2);assert.equal(v.state().commissions.at(-1).status,'ready');
});
test('通路恢復後選已知材料的採集表單有效，未恢復前沒有入口',async()=>{
 const before=checkpoint(s=>W.journeyProgress(s).stage===3);at(before,'he');const unopened=view({state:before.s});await unopened.clickTab('purchase');assert(!unopened.buttons().some(b=>b.action?.type==='gather-route-form'));const g=stateGame(routeCampaign().g.s);next(g);at(g,'he');const v=view({state:g.s});await v.clickTab('purchase');assert.match(text(v.html()),/舊驛道已重通.*新探索多帶一份材料/);assert.match(text(v.html()),/下月帶回新材料 3 個/);v.input('order-material','銅');const b=v.button('gather-route-form'),qty=g.s.materials.銅;await v.click(b);assert.equal(v.state().journey.outings.at(-1).material,'銅');assert.equal(v.state().journey.outings.at(-1).quantity,3);assert(v.button('order-form').disabled);assert(v.button('gather-route-form').disabled);await v.clickAction('close');await v.clickAction('open');assert.equal(v.state().materials.銅,qty+3);assert.equal(v.state().journey.events.length,4);
});
test('真實 schema4 檔經匯入確認才遷移，能力可推導但不提前宣稱新任務',async()=>{
 const {Old,s:old}=oldV4(),raw=Old.exportSave(old),v=view(),before=v.raw();await v.clickTab('settings');const p=v.importRaw(raw);await v.idle();assert.equal(v.raw(),before);await v.answer(true);await p;assert.equal(v.state().schema,5);assert.equal(v.state().journey.events.length,0);assert.deepEqual(v.state().journey.growth.he,{level:2,pathfinding:3});assert.equal(W.roadState(v.state()),'unknown');assert.equal(v.state().month,old.month);assert.equal(v.state().coins,old.coins);await v.clickTab('people');assert.doesNotMatch(text(v.html()),/路標已確認|驛道已重通/);
});
test('偽造世界完成匯入被拒絕，不覆蓋正常新任務進度',async()=>{
 const state=routeCampaign().g.s,v=view({state}),raw=v.raw(),forged=JSON.parse(raw);forged.state.journey.events.pop();await v.importRaw(JSON.stringify(forged));assert.match(v.notice(),/匯入失敗.*存檔/);assert.equal(v.raw(),raw);assert.equal(W.journeyProgress(v.state()).stage,4);assert.equal(v.element('confirm-dialog').open,false);
});
