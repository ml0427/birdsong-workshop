'use strict';
const assert=require('node:assert/strict'),W=require('../engine.js'),{play}=require('./campaign.cjs'),{game}=require('./helpers.cjs');
let cached;
function routeCampaign(){
 if(!cached)cached=play(false,{journey:true,capture:true,stopAtNine:false,stopAtRoad:true,materialLimit:3});
 return JSON.parse(JSON.stringify(cached));
}
function stateGame(state){const g=game();g.s=W.importSave(W.exportSave(state));return g;}
function checkpoint(predicate,last=false){const frames=routeCampaign().trace.snapshots;const s=last?frames.findLast(predicate):frames.find(predicate);assert(s,'missing checkpoint');return stateGame(s);}
function oldV4(allMaterials=true,extraLowBrace=false){
 const Old=require('./fixtures/engine-v4.cjs'),g={s:Old.initialState(),act(a){this.s=Old.dispatch(this.s,a).state;},npc(a){const v=Old.activeVisit(this.s);this.act({visitId:v?.id,counterId:v?.counterId,...a});},next(){this.act({type:'close'});this.act({type:'open'});},at(npc){while(Old.activeVisit(this.s)?.npc!==npc){const v=Old.activeVisit(this.s);assert(v);this.npc({type:v.phase==='service'?'leave':'decline'});}}};
 for(const recipe of ['staff','sword'])g.act({type:'craft',recipe});g.act({type:'open'});g.npc({type:'talk'});for(const itemId of ['item-1','item-2'])g.npc({type:'sell',itemId});g.npc({type:'explore',requestId:'old-copper'});g.next();g.at('he');g.npc({type:'talk'});g.act({type:'craft',recipe:'bracer'});const bracer=Object.values(g.s.items).at(-1).id;if(extraLowBrace)g.act({type:'craft',recipe:'bracer'});g.npc({type:'explore',requestId:'old-silver'});g.next();g.at('he');g.npc({type:'sell',itemId:bracer});g.next();g.at('he');g.act({type:'craft',recipe:'shield'});const shield=Object.values(g.s.items).at(-1).id;g.next();g.at('he');g.npc({type:'sell',itemId:shield});g.next();g.at('he');if(allMaterials){g.npc({type:'explore',requestId:'old-gold'});g.next();}Old.validate(g.s);return {Old,s:g.s};
}
module.exports={routeCampaign,stateGame,checkpoint,oldV4};
