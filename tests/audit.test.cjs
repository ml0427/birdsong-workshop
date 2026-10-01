'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js');
const {actor,delayedRoute,completeDelayedRoute}=require('./audit-helpers.cjs'),{oldV4}=require('./journey-helpers.cjs');
const {view}=require('./ui-harness.cjs');
function rejected(g,type,fields,pattern){const before=W.exportSave(g.state);assert.throws(()=>g.customer(type,fields),pattern);assert.equal(W.exportSave(g.state),before);}
test('公開操作重現盾剩四點：下次磨耗不夠時不說備好，而提出換盾需求',()=>{
 const {g,shield}=delayedRoute();assert.equal(g.state.items[shield].durability,4);assert.equal(W.journeyProgress(g.state).stage,3);assert.doesNotMatch(W.journeyHint(g.state),/護腕和木盾已備好/);assert.match(W.journeyHint(g.state),/木盾/);g.at('he');assert.equal(W.activeVisit(g.state).needs[0],'shield');assert.equal(W.activeVisit(g.state).minQuality,1);assert(Object.isFrozen(g.state));g.replay();
});
test('全新凍結狀態公開重播：延期取貨、補盾、熔鍊舊盾及再補護腕後真正通路',()=>{
 const {g,shield,newShield,newBracer}=completeDelayedRoute();assert.equal(g.state.month,13);assert.equal(g.state.items[shield].status,'smelted');assert.deepEqual(g.state.journey.events.map(e=>[e.key,e.month]),[['he-near',4],['he-clue',5],['he-survey',9],['road-open',13]]);const proof=g.state.journey.events.at(-1);assert.deepEqual(proof.gear.map(i=>i.itemId),[newBracer,newShield]);assert.deepEqual(proof.gear.map(i=>i.after),[7,6]);const ten=g.months.find(m=>m.month===10);assert.equal(ten.road,'marked');assert(!ten.gear.some(i=>i.id===newShield));assert.equal(g.state.items[newShield].episodes.at(-1).firstUsedMonth,11);assert.equal(g.state.items[newBracer].episodes.at(-1).firstUsedMonth,13);const raw=W.exportSave(g.state);assert.throws(()=>g.act({type:'smelt',itemId:shield}),/合理領回/);assert.equal(W.exportSave(g.state),raw);g.replay();
});
test('全新公開流程舊盾修復及跨主再售：本人通路引用新持有裝備，舊盾不重複給物',()=>{
 const {g,shield,newShield}=completeDelayedRoute('repair');assert.equal(g.state.items[shield].owner,'cen');assert.equal(g.state.items[shield].episodes.length,2);assert.equal(g.state.items[shield].episodes.at(-1).uses,1);assert.equal(g.state.returns.filter(r=>r.itemId===shield).length,1);assert.equal(g.state.journey.events.at(-1).gear[1].itemId,newShield);g.next();assert.equal(g.state.items[shield].episodes.at(-1).uses,2);assert.equal(g.state.journey.events.length,4);g.replay();
});
test('真實舊檔保留普通護腕需求：線索到裝備階段後升級要求，拒收舊樸實庫存',()=>{
 const {Old,s:old}=oldV4(true,true),g=actor(Old.exportSave(old)),oldVisit=W.activeVisit(g.state);assert.equal(oldVisit.npc,'he');assert.equal(oldVisit.minQuality,0);const stock=W.inventory(g.state).find(i=>i.recipe==='bracer'&&i.quality===0);assert(stock);g.next();g.next();g.at('he');assert.equal(W.journeyProgress(g.state).stage,2);const current=W.activeVisit(g.state);assert.equal(current.id,oldVisit.id);assert.equal(current.minQuality,1);assert.equal(current.traitRequired,'guard');assert.match(W.recommendationReason(g.state,stock,current),/細緻/);rejected(g,'sell',{itemId:stock.id},/品質/);g.replay();
});
test('公開操作同人任務排他：製作及勘路各自占任務，不阻擋玩家製作',()=>{
 const g=actor(),staff=g.craft('staff'),sword=g.craft('sword');g.next();g.customer('talk');for(const itemId of [staff,sword])g.customer('sell',{itemId});g.customer('explore',{requestId:'busy-copper'});g.next();g.at('he');g.customer('talk');g.customer('accept-commission',{requestId:'busy-brace'});
 for(const type of ['scout','explore','order'])rejected(g,type,{material:'木頭',quantity:1,requestId:'busy-'+type},/未完成委託/);
 g.next();g.at('he');g.deliver();g.customer('scout',{requestId:'busy-scout-valid'});rejected(g,'explore',{requestId:'busy-scout-explore'},/未完成委託/);rejected(g,'order',{material:'銅',quantity:1,requestId:'busy-scout-order'},/未完成委託/);g.craft('shield');g.next();assert.equal(W.journeyProgress(g.state).stage,1);g.replay();
});
test('全新公共通路後每次採集付六、次月交三，重載雙開及舊請求不加材料',()=>{
 const {g}=completeDelayedRoute();g.at('he');const before=g.state.materials.銅,net=g.state.coins-g.state.debt,ability=W.journeyProgress(g.state);g.customer('gather-route',{material:'銅',requestId:'audit-gather-1'});assert.equal(g.state.coins-g.state.debt,net-6);
 for(const type of ['order','explore','gather-route'])rejected(g,type,{material:'銅',quantity:1,requestId:'audit-busy-'+type},/未完成委託/);
 const reload=actor(W.exportSave(g.state));reload.next();assert.equal(reload.state.materials.銅,before+3);const saved=W.exportSave(reload.state);assert.throws(()=>reload.act({type:'open'}),/已經營業/);assert.equal(W.exportSave(reload.state),saved);reload.at('he');rejected(reload,'gather-route',{material:'銅',requestId:'audit-gather-1'},/已接受/);const net2=reload.state.coins-reload.state.debt;reload.customer('gather-route',{material:'銅',requestId:'audit-gather-2'});assert.equal(reload.state.coins-reload.state.debt,net2-6);reload.next();assert.equal(reload.state.materials.銅,before+6);reload.next();assert.equal(reload.state.materials.銅,before+6);assert.deepEqual(W.journeyProgress(reload.state),ability);assert.equal(reload.state.news.filter(n=>n.id==='journey-road-open').length,1);reload.replay();g.replay();
});
test('實際UI對耐久四木盾提示補盾，製作委託保留到本人領貨',async()=>{
 const {g}=delayedRoute();g.at('he');const v=view({state:g.state});assert.match(v.html(),/細緻以上、堅固且耐久充足的木盾/);assert.doesNotMatch(v.html(),/護腕和木盾已備好/);await v.clickAction('accept-commission');const c=v.state().commissions.at(-1);assert.equal(c.recipe,'shield');assert.equal(c.status,'crafting');await v.clickAction('close');await v.clickAction('open');assert.equal(v.state().commissions.at(-1).status,'ready');assert.equal(W.roadState(v.state()),'marked');
});
test('實際UI舊檔需求升級後樸實護腕明示品質不足',async()=>{
 const {Old,s}=oldV4(true,true),g=actor(Old.exportSave(s));g.next();g.next();g.at('he');const v=view({state:g.state});assert.match(v.html(),/細緻/);assert.match(v.html(),/品質/);assert.equal(W.activeVisit(v.state()).minQuality,1);assert.doesNotMatch(v.html(),/勘查裝備備好了/);
});
