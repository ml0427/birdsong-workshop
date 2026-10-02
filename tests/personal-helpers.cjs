'use strict';
const assert=require('node:assert/strict'),W=require('../engine.js');
const {play}=require('./campaign.cjs'),{actor}=require('./audit-helpers.cjs');
let cached;
// Existing campaign uses only public actions. Extension is frozen and replayed;
// no item/ability/completion flags are injected for the positive route.
function personalRoute(){
 if(!cached){
  const seed=play(false,{journey:true,stopAtNine:false,turns:15,capture:true});
  assert.equal(seed.g.s.content.events.length,9);assert.equal(W.roadState(seed.g.s),'restored');assert(W.characterProgress(seed.g.s,'cen').completed);assert(!W.characterProgress(seed.g.s,'shu').completed);
  const raw=W.exportSave(seed.g.s),g=actor(raw),old=W.inventory(g.state).find(i=>i.returned&&i.recipe==='amulet');assert(old);
  g.act({type:'smelt',itemId:old.id});g.next();
  const snapshots=[];
  function supply(recipe){
   for(let n=0;n<8;n++){
    g.at('shu');const v=W.activeVisit(g.state);assert.equal(v.phase,'request');if(!v.asked)g.customer('talk');
    g.customer('accept-commission',{requestId:`personal-${g.state.revision}`});const c=g.state.commissions.at(-1);assert.equal(c.status,'crafting');
    while(g.state.items[c.itemId].status==='crafting')g.next();g.at('shu');g.deliver();snapshots.push(W.importSave(W.exportSave(g.state)));
    if(c.recipe===recipe)return c.itemId;g.customer('leave');g.next();
   }throw Error('target commission not requested');
  }
  const amulet=supply('amulet');g.customer('leave');g.next();const bell=supply('bell'),before=W.importSave(W.exportSave(g.state));
  assert.equal(g.state.items[amulet].legacy,old.id);assert(g.state.items[amulet].traits.includes('solid'));assert(!W.characterProgress(g.state,'shu').completed);
  g.next();assert(W.characterProgress(g.state,'shu').completed);g.replay();
  cached={raw,actions:g.actions,seed:seed.g.s,frames:seed.trace.snapshots,snapshots,before,state:g.state,amulet,bell,legacy:old.id};
 }
 return JSON.parse(JSON.stringify(cached));
}
module.exports={personalRoute};
