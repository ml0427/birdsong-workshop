'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js');
const {game,craft,intro,order,ready,next,at}=require('./helpers.cjs');
const scoped=(g,type,extra={})=>({type,visitId:W.activeVisit(g.s)?.id,counterId:W.activeVisit(g.s)?.counterId,...extra});
function customer(){const g=ready();g.npc({type:'talk'});g.npc({type:'accept-commission',requestId:'optional-delivery'});const c=g.s.commissions.at(-1);next(g);at(g,'he');g.npc({type:'deliver',itemId:c.itemId});return {g,c};}
test('開場售完未採購可送客，舊派遣token同月與下月均無效',()=>{
 const g=game();intro(g);const stale=scoped(g,'order',{material:'木頭',quantity:1,requestId:'departed'}),sold=W.owned(g.s,'cen').map(i=>i.id);g.npc({type:'leave'});assert.equal(W.activeVisit(g.s),null);assert.equal(g.s.tutorial.ordered,false);const raw=W.exportSave(g.s);assert.throws(()=>g.do(stale),/不在櫃臺/);assert.equal(W.exportSave(g.s),raw);next(g);assert.equal(W.activeVisit(g.s).phase,'service');assert.notEqual(W.activeVisit(g.s).counterId,stale.counterId);assert.throws(()=>g.do(stale),/不在櫃臺/);assert.deepEqual(W.owned(g.s,'cen').map(i=>i.id),sold);assert.equal(g.s.visits.filter(v=>v.kind==='intro').length,1);
});
test('跳過材料可關店換月重載，之後採購交付一次且新需求可達',()=>{
 const g=game();intro(g);g.npc({type:'leave'});next(g);g.npc({type:'leave'});g.s=W.importSave(W.exportSave(g.s));next(g);assert.equal(g.s.month,3);const wood=g.s.materials.木頭;order(g,'木頭',2,'later-learning');g.npc({type:'leave'});next(g);assert.equal(g.s.materials.木頭,wood+2);assert(g.s.tutorial.delivered);assert.equal(W.activeVisit(g.s).npc,'he');const id=g.s.orders[0].id;next(g);assert.equal(g.s.materials.木頭,wood+2);assert.equal(g.s.news.filter(n=>n.id===`delivery-${id}`).length,1);
});
test('未採購便關店結束已處理服務，不扣費；下月復訪不重售',()=>{
 const g=game();intro(g);const wallet=[g.s.coins,g.s.debt],month=g.s.month;g.do({type:'close'});assert.equal(g.s.visits[0].status,'done');assert.equal(g.s.visits[0].counterId,null);assert.deepEqual([g.s.coins,g.s.debt],wallet);assert.equal(g.s.month,month);g.s=W.importSave(W.exportSave(g.s));next(g);assert.equal(W.activeVisit(g.s).phase,'service');assert.deepEqual(W.activeVisit(g.s).needs,[]);assert.equal(W.owned(g.s,'cen').length,2);
});
test('未成交需求可婉拒，部分成交後下月只恢復未售部分',()=>{
 const g=game(),staff=craft(g,'staff'),sword=craft(g,'sword');next(g);const raw=W.exportSave(g.s);assert.throws(()=>g.npc({type:'leave'}),/婉拒/);assert.equal(W.exportSave(g.s),raw);g.npc({type:'sell',itemId:staff.id});g.npc({type:'decline'});assert.equal(W.activeVisit(g.s),null);next(g);assert.deepEqual(W.activeVisit(g.s).needs,['sword']);g.npc({type:'sell',itemId:sword.id});g.npc({type:'leave'});assert.equal(W.owned(g.s,'cen').length,2);
});
test('本人交貨未派遣也能送客，指定成品所有權與已交付任務保留',()=>{
 const {g,c}=customer();assert.equal(W.activeVisit(g.s).phase,'service');assert.equal(W.pendingTasks(g.s,'he').length,0);g.npc({type:'leave'});assert.equal(g.s.commissions.find(x=>x.id===c.id).status,'delivered');assert.equal(g.s.items[c.itemId].owner,'he');assert.notEqual(W.activeVisit(g.s)?.npc,'he');
});
test('派遣後送客照常交付；接受製作後送客仍可關店開工與領貨',()=>{
 const g=game();intro(g);order(g,'鐵',2,'depart-order');const before=g.s.materials.鐵;g.npc({type:'leave'});next(g);assert.equal(g.s.materials.鐵,before+2);g.npc({type:'talk'});g.npc({type:'explore',requestId:'leave-copper'});g.npc({type:'leave'});next(g);at(g,'he');g.npc({type:'talk'});g.npc({type:'accept-commission',requestId:'depart-craft'});const c=g.s.commissions.at(-1);g.npc({type:'leave'});g.do({type:'close'});next(g);at(g,'he');assert.equal(W.activeVisit(g.s).kind,'delivery');g.npc({type:'deliver',itemId:c.itemId});assert.equal(g.s.items[c.itemId].owner,'he');
});
