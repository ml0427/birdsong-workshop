'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js');
const {game,intro,order,ready}=require('./helpers.cjs'),{twoMonthCustomer}=require('./regression-helpers.cjs');
function raw(state=W.initialState()){let s=W.importSave(W.exportSave(state));return {get s(){return s;},act(a){s=W.dispatch(s,a).state;return s;},next(){const r=s.monthReview;return this.act({type:'review-next',month:r.month,cursor:r.cursor});},read(){while(W.pendingReview(s))this.next();},reject(a,re=/月結/){const before=W.exportSave(s);assert.throws(()=>this.act(a),re);assert.equal(W.exportSave(s),before);}};}
test('單件：先真實生活費再本次成品，閱完前交易及換月原子拒絕',()=>{
 const g=raw();g.act({type:'craft',recipe:'staff'});g.act({type:'open'});assert.deepEqual(g.s.monthReview.entries,[{kind:'money',source:'living',amount:8,cashPaid:8,debtAdded:0},{kind:'finished',itemId:'item-1'}]);assert.equal(g.s.coins,12);assert.equal(g.s.xp.craft,1);const v=W.activeVisit(g.s);for(const type of ['talk','sell','order','craft','close','open'])g.reject({type,recipe:'sword',itemId:'item-1',material:'木頭',quantity:1,requestId:'pending',visitId:v.id,counterId:v.counterId});g.next();assert.equal(g.s.monthReview.cursor,1);g.next();assert(!W.pendingReview(g.s));assert.equal(g.s.coins,12);assert.equal(g.s.xp.craft,1);assert.equal(g.s.items['item-1'].appraised,false);g.act({type:'sell',itemId:'item-1',visitId:v.id,counterId:v.counterId});assert.equal(g.s.items['item-1'].owner,'cen');
});
test('多件與中途重載：依真實完成順序，過期下一筆不能跳卡或重產',()=>{
 const g=raw();for(const recipe of ['staff','sword','staff'])g.act({type:'craft',recipe});g.act({type:'open'});assert.deepEqual(g.s.monthReview.entries.slice(1).map(e=>e.itemId),['item-1','item-2','item-3']);const old={type:'review-next',month:1,cursor:0};g.act(old);g.reject(old,/已閱過/);const reload=raw(g.s);assert.equal(reload.s.monthReview.cursor,1);assert.equal(reload.s.coins,12);assert.equal(reload.s.xp.craft,3);reload.read();assert.equal(Object.values(reload.s.items).filter(i=>i.finishedMonth===1).length,3);reload.reject(old,/已閱過/);assert.equal(reload.s.month,1);
});
test('現金不足與全欠款用自然連續月份：只列實付及新增欠款',()=>{
 const g=raw();for(let month=1;month<=4;month++){g.act({type:'open'});const fee=g.s.monthReview.entries[0];assert.equal(fee.cashPaid,month<=2?8:month===3?4:0);assert.equal(fee.debtAdded,month<=2?0:month===3?4:8);assert.equal(fee.amount,8);assert.equal(g.s.monthReview.entries.length,1);g.read();g.act({type:'close'});}assert.equal(g.s.coins,0);assert.equal(g.s.debt,12);
});
test('前月採購已支付：下月交貨不重列扣款、不捏造收款或完工',()=>{
 const setup=game();intro(setup);order(setup,'木頭',2,'monthly-paid');const paid=setup.s.coins,g=raw(setup.s);g.act({type:'close'});g.act({type:'open'});assert.equal(g.s.coins,paid-8);assert.equal(g.s.orders[0].status,'delivered');assert.deepEqual(g.s.monthReview.entries,[{kind:'money',source:'living',amount:8,cashPaid:8,debtAdded:0}]);assert.equal(g.s.materials.木頭,4);g.read();g.act({type:'close'});g.act({type:'open'});assert.equal(g.s.materials.木頭,4);
});
test('未交貨的客人製作不當收入：完工保留本人，交貨後才收一次',()=>{
 const setup=ready();setup.npc({type:'talk'});setup.npc({type:'accept-commission',requestId:'monthly-reserved'});const c=setup.s.commissions.at(-1),before=setup.s.coins,g=raw(setup.s);g.act({type:'close'});g.act({type:'open'});assert.equal(g.s.coins,before-8);assert.equal(g.s.commissions.at(-1).status,'ready');assert.deepEqual(g.s.monthReview.entries.map(e=>e.kind),['money','finished']);assert.equal(g.s.monthReview.entries[1].itemId,c.itemId);assert.equal(g.s.items[c.itemId].owner,null);assert.equal(g.s.items[c.itemId].episodes.length,0);g.read();while(W.activeVisit(g.s)?.npc!=='he'){const v=W.activeVisit(g.s);g.act({type:v.phase==='service'?'leave':'decline',visitId:v.id,counterId:v.counterId});}const v=W.activeVisit(g.s);g.act({type:'deliver',itemId:c.itemId,visitId:v.id,counterId:v.counterId});assert.equal(g.s.coins,before-8+W.price(g.s.items[c.itemId]));assert.equal(g.s.items[c.itemId].owner,'he');
});
test('兩月作品：第一月無假完工卡、第二月只列此次成品',()=>{
 const setup=twoMonthCustomer(),c=setup.s.commissions.at(-1),g=raw(setup.s);g.act({type:'close'});g.act({type:'open'});assert.equal(g.s.monthReview.entries.length,1);assert.equal(g.s.items[c.itemId].status,'crafting');g.read();g.act({type:'close'});g.act({type:'open'});assert.deepEqual(g.s.monthReview.entries.slice(1),[{kind:'finished',itemId:c.itemId}]);assert.equal(g.s.items[c.itemId].status,'inventory');assert.equal(g.s.commissions.at(-1).status,'ready');
});
test('雙擊開店與跨月舊游標：沒有多月、多扣款或漏看第一卡',()=>{
 const g=raw();g.act({type:'open'});g.reject({type:'open'},/已經營業/);const token={type:'review-next',month:1,cursor:0,expectedRevision:g.s.revision};g.act(token);g.reject(token,/已處理/);g.reject({type:'open'},/已經營業/);g.act({type:'close'});g.act({type:'open'});g.reject({type:'review-next',month:1,cursor:0},/已閱過/);assert.equal(g.s.monthReview.cursor,0);assert.equal(g.s.month,2);assert.equal(g.s.coins,4);
});
test('真正舊 schema5 檔：不補造當前月結，下次開店才生成',()=>{
 const Old=require('./fixtures/engine-v5.cjs');let old=Old.initialState();old=Old.dispatch(old,{type:'craft',recipe:'staff'}).state;old=Old.dispatch(old,{type:'open'}).state;const imported=W.importSave(Old.exportSave(old));assert.equal(imported.monthReview,undefined);assert(!W.pendingReview(imported));assert.deepEqual(imported,old);const g=raw(imported);g.act({type:'close'});g.act({type:'open'});assert.equal(g.s.monthReview.month,2);assert.equal(g.s.monthReview.entries.length,1);assert.equal(g.s.coins,4);
});
test('月結偽造：額外收入、重複成品、錯月份、現金欠款及越界游標拒絕',()=>{
 const g=raw();g.act({type:'craft',recipe:'staff'});g.act({type:'open'});const saved=W.exportSave(g.s);for(const mutate of [s=>s.monthReview.entries[0].amount=7,s=>s.monthReview.entries[0].cashPaid=4,s=>s.monthReview.entries[0].debtAdded=8,s=>s.monthReview.month=2,s=>s.monthReview.cursor=3,s=>s.monthReview.entries.push(s.monthReview.entries[1]),s=>s.monthReview.entries[1].itemId='missing',s=>s.monthReview.entries.push({kind:'money',source:'income',amount:20}),s=>s.monthReview.wallet.coins=19]){const d=JSON.parse(saved);mutate(d.state);assert.throws(()=>W.importSave(JSON.stringify(d)),/存檔月結/);}
});
test('初始無結算、沒有作品的月份沒有空完工卡；重載不自動翻閱',()=>{
 const g=raw();assert.equal(g.s.monthReview,null);assert(!W.pendingReview(g.s));g.act({type:'open'});assert.equal(g.s.monthReview.entries.length,1);const restored=raw(g.s);assert.equal(restored.s.monthReview.cursor,0);assert(W.pendingReview(restored.s));assert.equal(restored.s.coins,12);
});
