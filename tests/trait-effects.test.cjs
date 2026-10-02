'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js');
const {game,craft,returnedStaff}=require('./helpers.cjs');
test('共用特性數值與逐用途效果一致：效能、適用判定、磨耗下限及售價',()=>{
 for(const recipe of Object.keys(W.RECIPES)){
  const base={recipe,quality:0,traits:[],durability:9};
  assert.equal(W.performance({...base,traits:['light']})-W.performance(base),W.TRAITS.light.powerBonus);
  const guarded={...base,traits:['guard']},applicable=W.TRAITS.guard.appliesTo.includes(recipe);
  assert.equal(W.performance(guarded),W.performance(base));
  assert.equal(W.useResult(guarded).score-W.useResult(base).score,applicable?W.TRAITS.guard.useBonus:0);
  assert.equal(W.useResult({...base,traits:['solid']}).wear,W.useResult(base).wear-W.TRAITS.solid.wearReduction);
  assert.equal(W.useResult({...base,quality:1,traits:['solid']}).wear,1);
  assert.equal(W.useResult({...base,quality:1,traits:['solid'],durability:0}).wear,0);
  assert.equal(W.price(guarded),W.price(base));
 }
 assert.match(W.traitDetails(['light']),new RegExp(`效能＋${W.TRAITS.light.powerBonus}`));assert.match(W.traitDetails(['guard']),/限鐵劍／木盾／護腕／護符使用判定＋2，面板效能不變/);assert.match(W.traitDetails(['solid']),/最低1點（不超過剩餘耐久）/);
});
test('配方預覽與實際開工／傳承使用相同特性計算且只承接一次',()=>{
 const initial=game();for(const r of ['staff','sword']){const preview=W.productionTraits(initial.s,r);const i=craft(initial,r);assert.deepEqual(i.traits,preview);}
 const {g,item}=returnedStaff();g.do({type:'smelt',itemId:item.id});const preview=W.productionTraits(g.s,'staff');assert.deepEqual(preview,['light','solid']);const i=craft(g,'staff');assert.deepEqual(i.traits,preview);assert.equal(i.legacy,item.id);assert.deepEqual(W.productionTraits(g.s,'staff'),['light']);assert.equal(g.s.legacies[0].usedBy,i.id);W.validate(g.s);
});
