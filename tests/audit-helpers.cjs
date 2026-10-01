'use strict';
const assert=require('node:assert/strict'),W=require('../engine.js');
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function actor(raw=null){
 let state=freeze(raw?W.importSave(raw):W.initialState());const actions=[],months=[];
 return {actions,months,get state(){return state;},act(action){const before=state,result=W.dispatch(before,action);state=freeze(result.state);actions.push({month:before.month,actor:W.activeVisit(before)?.npc||null,action:JSON.parse(JSON.stringify(action)),netChange:state.coins-state.debt-before.coins+before.debt,message:result.message});if(action.type==='open')months.push({month:state.month,progress:W.journeyProgress(state),road:W.roadState(state),gear:W.owned(state,'he').map(i=>({id:i.id,recipe:i.recipe,quality:i.quality,performance:W.performance(i),durability:i.durability,uses:i.episodes.at(-1).uses}))});return result;},customer(type,fields={}){const v=W.activeVisit(state);assert(v,'no current customer');return this.act({type,visitId:v.id,counterId:v.counterId,...fields});},next(){if(state.open)this.act({type:'close'});this.act({type:'open'});},at(npc){let n=0;while(W.activeVisit(state)?.npc!==npc){assert(n++<20,'customer not arriving');const v=W.activeVisit(state);assert(v,'no '+npc);this.customer(v.phase==='service'?'leave':'decline');}},craft(recipe){this.act({type:'craft',recipe});return Object.values(state.items).at(-1).id;},deliver(){const v=W.activeVisit(state),c=state.commissions.find(c=>c.id===v?.commissionId);assert(c?.status==='ready');this.customer('deliver',{itemId:c.itemId});return c.itemId;},replay(){let replay=freeze(raw?W.importSave(raw):W.initialState());for(const row of actions)replay=freeze(W.dispatch(replay,row.action).state);assert.deepEqual(replay,state);return replay;}};
}
function delayedRoute(){
 const g=actor(),staff=g.craft('staff'),sword=g.craft('sword');g.next();g.customer('talk');g.customer('sell',{itemId:staff});g.customer('sell',{itemId:sword});g.customer('explore',{requestId:'audit-copper'});g.craft('staff');
 g.next();g.at('he');g.customer('talk');g.customer('accept-commission',{requestId:'audit-bracer-1'});
 g.next();g.at('he');const bracer=g.deliver();g.customer('scout',{requestId:'audit-scout'});const shield=g.craft('shield');
 g.next();g.at('he');g.customer('talk');g.customer('sell',{itemId:shield});
 g.next();g.next();g.at('he');g.customer('accept-commission',{requestId:'audit-bracer-2'});
 g.next();g.at('he');g.customer('decline');g.next();g.at('he');const fresh=g.deliver();g.next();assert.equal(W.journeyProgress(g.state).stage,3);assert.equal(g.state.items[shield].durability,4);g.replay();return {g,staff,sword,bracer,shield,fresh};
}
function completeDelayedRoute(recycle='smelt'){
 const route=delayedRoute(),{g,shield}=route;
 g.at('he');g.customer('accept-commission',{requestId:'audit-shield-2'});
 g.at('cen');g.customer('order',{material:'銅',quantity:3,requestId:'audit-copper-stock'});
 g.next();g.at('he');route.newShield=g.deliver();
 g.customer('reclaim',{itemId:shield});g.act({type:recycle,itemId:shield});
 g.next();g.at('he');g.customer('accept-commission',{requestId:'audit-bracer-3'});
 g.next();if(recycle==='repair'){g.at('cen');g.customer('talk');g.customer('sell',{itemId:shield});}g.at('he');route.newBracer=g.deliver();
 g.next();assert.equal(W.roadState(g.state),'restored');
 g.replay();return route;
}
module.exports={actor,delayedRoute,completeDelayedRoute};
