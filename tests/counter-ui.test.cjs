'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js');
const {view}=require('./ui-harness.cjs'),{game,intro,ready,next,at,craft}=require('./helpers.cjs');
const actions=['order-form','explore','scout','gather-route-form'];
function hidden(v){assert.doesNotMatch(v.html(),/的材料委託|id="order-material"|id="order-quantity"/);assert(!v.buttons().some(b=>actions.includes(b.action?.type)));assert.match(v.html(),/材料委託已交代.*開店回報/);assert(v.button('leave'));}
function count(v){const m=v.html().match(/等候 (\d+) 位/);assert(m,'waiting label');return Number(m[1]);}
test('開場賣完兩件再交代探索：收起入口表單，不送客不取消，重載次月只交一次',async()=>{
 const g=game();intro(g);const v=view({state:g.s});assert.match(v.html(),/阿岑的材料委託/);await v.clickTab('purchase');const explore=v.button('explore'),copy={dataset:{...explore.dataset},disabled:false};await v.click(explore);hidden(v);assert.equal(W.activeVisit(v.state()).npc,'cen');assert.equal(v.state().explorations[0].status,'pending');const raw=v.raw();await v.click(copy);assert.equal(v.raw(),raw);const reload=view({raw});hidden(reload);await reload.clickTab('purchase');hidden(reload);await reload.clickAction('close');assert.doesNotMatch(reload.html(),/等候|材料委託已交代|的材料委託/);assert.equal(reload.state().explorations[0].status,'pending');await reload.clickAction('open');assert.equal(reload.state().materials.銅,2);assert.equal(reload.state().explorations[0].status,'delivered');await reload.clickAction('close');await reload.clickAction('open');assert.equal(reload.state().materials.銅,2);
});
test('成交後採購表單收起：過期複本在讀取消失欄位前拒絕，不重扣款',async()=>{
 const g=game();intro(g);const v=view({state:g.s});await v.clickTab('purchase');v.input('order-material','木頭');v.input('order-quantity','2');const b=v.button('order-form'),copy={dataset:{...b.dataset},disabled:false};await v.click(b);hidden(v);assert.equal(v.state().orders[0].quantity,2);const raw=v.raw();Object.defineProperty(v.element('order-material'),'value',{get(){throw new Error('消失表單不得讀取');}});await v.click(copy);assert.match(v.notice(),/已處理/);assert.equal(v.raw(),raw);const reload=view({raw});await reload.clickAction('leave');assert.equal(W.activeVisit(reload.state()),null);await reload.clickAction('close');await reload.clickAction('open');assert.equal(reload.state().materials.木頭,4);assert.equal(reload.state().orders[0].status,'delivered');
});
test('本人領製作成品再勘路：本次委託與表單收起，派遣和裝備保留',async()=>{
 const g=ready();g.npc({type:'talk'});g.npc({type:'accept-commission',requestId:'counter-brace'});next(g);at(g,'he');const v=view({state:g.s});await v.clickAction('deliver');const c=v.state().commissions.at(-1);assert.equal(c.status,'delivered');assert.match(v.html(),/小禾的材料委託/);await v.clickTab('purchase');await v.clickAction('scout');hidden(v);assert.equal(W.activeVisit(v.state()).npc,'he');assert.equal(v.state().items[c.itemId].owner,'he');assert.equal(v.state().journey.outings.at(-1).status,'pending');assert.doesNotMatch(v.html(),/沒現貨，接製作委託|當面交貨後再付款/);await v.clickAction('leave');await v.clickAction('close');await v.clickAction('open');assert.equal(v.state().journey.outings.at(-1).status,'delivered');assert.equal(v.state().items[c.itemId].episodes.at(-1).uses,1);
});
test('未完成購物不誤收起：背景忙碌提示及可售現貨仍在',async()=>{
 const g=ready(),item=craft(g,'bracer');next(g);at(g,'he');const v=view({state:g.s});await v.clickTab('purchase');await v.clickAction('explore');assert.equal(W.activeVisit(v.state()).phase,'request');assert.match(v.html(),/小禾的材料委託/);assert(v.button('order-form').disabled);assert.equal(v.state().items[item.id].status,'inventory');

});
test('等候只計下一位：多位、送客、最後一位、關店及空櫃臺都不含目前客人',async()=>{
 const g=ready(),v=view({state:g.s});let expected=v.state().visits.filter(r=>r.status==='waiting').length-1;assert.equal(count(v),expected);while(W.activeVisit(v.state())){const current=W.activeVisit(v.state());await v.clickAction(current.phase==='service'?'leave':'decline');expected=Math.max(0,v.state().visits.filter(r=>r.status==='waiting').length-(W.activeVisit(v.state())?1:0));assert.equal(count(v),expected);}assert.equal(count(v),0);await v.clickAction('close');assert.doesNotMatch(v.html(),/等候/);await v.clickAction('open');assert.equal(count(v),v.state().visits.filter(r=>r.status==='waiting').length-1);
 const opening=game();intro(opening);const one=view({state:opening.s});assert.equal(count(one),0);await one.clickTab('purchase');await one.clickAction('explore');assert.equal(count(one),0);await one.clickAction('leave');assert.equal(count(one),0);
});
