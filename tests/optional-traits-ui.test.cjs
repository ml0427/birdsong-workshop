'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js');
const {view}=require('./ui-harness.cjs');const {game,craft,intro,ready,next,at,returnedStaff}=require('./helpers.cjs');
const panel=v=>v.html().split('id="panel"')[1];
test('開場成交UI送客可按，委託選用，離場後不再顯材料表單',async()=>{
 const g=game();intro(g);const v=view({state:g.s});assert.equal(v.button('leave').disabled,false);assert.match(v.html(),/也可以先離開|也可直接送客/);await v.clickTab('purchase');const old=v.button('explore');await v.clickAction('leave');assert.equal(W.activeVisit(v.state()),null);assert.doesNotMatch(v.html(),/id="order-quantity"/);const before=v.raw();await v.click(old);assert.equal(v.raw(),before);assert.match(v.html(),/稍後.*補學/);await v.clickAction('close');await v.clickAction('open');assert.equal(W.activeVisit(v.state()).phase,'service');assert.equal(v.button('leave').disabled,false);assert(v.button('explore'));
});
test('交貨後未派遣UI直接送客；初訪未成交也有婉拒',async()=>{
 const g=ready();g.npc({type:'talk'});g.npc({type:'accept-commission',requestId:'ui-delivered-leave'});next(g);at(g,'he');const v=view({state:g.s});await v.clickAction('deliver');assert.equal(v.button('leave').disabled,false);await v.clickAction('leave');assert.notEqual(W.activeVisit(v.state())?.npc,'he');assert.equal(v.state().commissions[0].status,'delivered');const fresh=game();craft(fresh,'staff');craft(fresh,'sword');next(fresh);const u=view({state:fresh.s});await u.clickAction('decline');assert.equal(W.activeVisit(u.state()),null);
});
test('首屏配方直接說明已知特性，不需鑑定且不暴露未知配方',()=>{
 const v=view({raw:null});const p=panel(v);assert(p.includes(W.traitDetails(['light'])));assert(p.includes(W.traitDetails(['solid'])));assert.match(p,/trait-effects/);assert.doesNotMatch(p,/護腕|護符|護身|銅|銀|金鈴|title=/);
});
test('完工報告逐件直接說明特性，閱讀不增加鑑定經驗',async()=>{
 const g=game();craft(g,'staff');craft(g,'sword');const v=view({state:g.s,autoReview:false});await v.clickAction('open');await v.clickAction('review-next');assert(v.html().includes(W.traitDetails(['light'])));await v.clickAction('review-next');assert(v.html().includes(W.traitDetails(['solid'])));await v.clickAction('review-next');assert.equal(v.state().xp.appraisal,0);assert(Object.values(v.state().items).every(i=>!i.appraised));
});
test('推薦所選物品與未鑑定庫存都有當前特性說明，切換推薦即更新',async()=>{
 const g=game(),staff=craft(g,'staff'),sword=craft(g,'sword');next(g);const v=view({state:g.s});const selected=()=>v.html().match(/<p class="help trait-effects">特性：([^<]+)<\/p>/)[1];assert(selected().includes(W.traitDetails(['light'])));await v.change('recommend-item',sword.id,{visit:W.activeVisit(g.s).id});assert(selected().includes(W.traitDetails(['solid'])));assert(!selected().includes(W.traitDetails(['light'])));await v.clickTab('inventory');assert(panel(v).includes(W.traitDetails(g.s.items[staff.id])));assert(panel(v).includes(W.traitDetails(g.s.items[sword.id])));assert.doesNotMatch(panel(v),/效能 3|耐久 9／9/);assert.equal(v.state().xp.appraisal,0);
});
test('傳承預覽可見來源與兩特性，開工後下一件不再重複傳承',async()=>{
 const {g,item}=returnedStaff();g.do({type:'smelt',itemId:item.id});const v=view({state:g.s});await v.clickTab('craft');const preview=W.productionTraits(g.s,'staff');assert(panel(v).includes(W.traitDetails(preview)));assert.match(panel(v),/下一件自動承接木杖的傳承/);await v.clickAction('craft',{recipe:'staff'});const created=Object.values(v.state().items).at(-1);assert.deepEqual(created.traits,preview);assert.doesNotMatch(panel(v),/下一件自動承接/);await v.clickTab('collection');assert(panel(v).includes(W.traitDetails(created)));
});
test('人物持有裝備與規則頁顯示共用適用範圍和數值',async()=>{
 const g=ready();g.npc({type:'talk'});next(g);const v=view({state:g.s});await v.clickTab('people');const p=panel(v);for(const i of W.owned(g.s,'cen'))assert(p.includes(`${W.RECIPES[i.recipe].name}：效能 ${W.performance(i)} · 耐久 ${i.durability}／${i.maxDurability}；${W.traitDetails(i)}`));await v.clickTab('settings');for(const t of Object.keys(W.TRAITS))assert(panel(v).includes(W.traitDetails([t])));assert.match(panel(v),/護身.*限鐵劍／木盾／護腕／護符使用判定＋2，面板效能不變/);
});
