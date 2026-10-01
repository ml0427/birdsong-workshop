'use strict';
const assert=require('node:assert/strict'),W=require('../engine.js');
const {game,craft,intro,order,explore,next,depart}=require('./helpers.cjs');
function play(inherit=false, options={}){
 const g=game();if(options.state)g.s=W.importSave(W.exportSave(options.state));else {intro(g);explore(g);craft(g,'staff');}let source=null; const trace={transactions:[],requests:[],social:[]};
 const capture=()=>{if(options.capture)(trace.snapshots ||= []).push(W.importSave(W.exportSave(g.s)));};
 for(let turn=0;turn<(options.turns || 35);turn++){
  next(g);capture();
  for(const c of g.s.commissions.filter(c=>c.status==='accepted'))if(W.canStartCommission(g.s,c))g.do({type:'craft',commissionId:c.id});
  while(W.activeVisit(g.s)){
   let v=W.activeVisit(g.s);if(v.phase==='service' && !W.pendingTasks(g.s,v.npc).length)trace.social.push({month:g.s.month,npc:v.npc,text:v.contextText,healthy:W.owned(g.s,v.npc).some(i=>i.durability>3)});if(!v.asked)g.npc({type:'talk'});
   for(const o of g.s.returns.filter(o=>o.status==='offered'&&o.npc===v.npc)){
    g.npc({type:'reclaim',itemId:o.itemId});
    if(o.itemId==='item-1')g.do({type:'repair',itemId:o.itemId});
    if(inherit&&!source&&g.s.items[o.itemId].recipe==='bracer'){source=o.itemId;g.do({type:'smelt',itemId:o.itemId});}
   }
   v=W.activeVisit(g.s);
   if(v.phase==='request'){trace.requests.push({month:g.s.month,npc:v.npc,recipe:v.needs[0],kind:v.kind,reason:v.reason,same:W.owned(g.s,v.npc).some(i=>i.recipe===v.needs[0])});
    const choices=W.inventory(g.s).filter(i=>W.suitable(g.s,i,v));
    const i=(v.npc==='shu'?choices.find(i=>i.id==='item-1'):null)||choices[0];
    if(i){const net=g.s.coins-g.s.debt;const c=g.s.commissions.find(c=>c.id===v.commissionId);g.npc({type:v.kind==='delivery'?'deliver':'sell',itemId:i.id});capture();trace.transactions.push({month:g.s.month,npc:v.npc,itemId:i.id,recipe:i.recipe,bonus:v.kind==='commission'||c?.kind==='commission',amount:g.s.coins-g.s.debt-net,price:W.price(i)});}
    else if(!W.pendingTasks(g.s,v.npc).some(t=>t.id!==v.id)){
     g.npc({type:'accept-commission',requestId:`customer-${g.s.revision}`});
     const c=g.s.commissions.at(-1);
     if(c.status==='accepted')g.npc({type:'cancel-commission',commissionId:c.id});
    }
   }
   v=W.activeVisit(g.s);
   if(!W.pendingTasks(g.s,v.npc).length){
    if(options.journey && v.npc==='he' && W.canScout(g.s))g.npc({type:'scout',requestId:`scout-${g.s.revision}`});
    else if(W.nextUnknown(g.s)&&(!options.skipHeExploration||v.npc!=='he')&&W.knownMaterials(g.s).length<(options.materialLimit||5)&&!g.s.explorations.some(e=>e.status==='pending'))explore(g,`frontier-${g.s.revision}`);
    else {const m=W.knownMaterials(g.s).find(m=>g.s.materials[m]<3&&!g.s.orders.some(o=>o.material===m&&o.status==='pending'));if(m)order(g,m,12,`supply-${g.s.revision}`);}
   }
   capture();depart(g);
  }
  W.validate(g.s);capture();
  if(options.stopAtRoad && W.roadState(g.s)==='restored')return {g,source,trace};
  if(options.stopAtNine!==false && g.s.content.events.length===9)return {g,source,trace};
 }
 return {g,source,trace};
}
module.exports={play};
