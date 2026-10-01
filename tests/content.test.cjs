'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js');
const {game,craft,intro,order,explore,next,depart}=require('./helpers.cjs');
function play(inherit=false){
 const g=game();intro(g);explore(g);craft(g,'staff');let source=null;
 for(let turn=0;turn<35;turn++){
  next(g);
  for(const c of g.s.commissions.filter(c=>c.status==='accepted'))if(W.canStartCommission(g.s,c))g.do({type:'craft',commissionId:c.id});
  while(W.activeVisit(g.s)){
   let v=W.activeVisit(g.s);if(!v.asked)g.npc({type:'talk'});
   for(const o of g.s.returns.filter(o=>o.status==='offered'&&o.npc===v.npc)){
    g.npc({type:'reclaim',itemId:o.itemId});
    if(o.itemId==='item-1')g.do({type:'repair',itemId:o.itemId});
    if(inherit&&!source&&g.s.items[o.itemId].recipe==='bracer'){source=o.itemId;g.do({type:'smelt',itemId:o.itemId});}
   }
   v=W.activeVisit(g.s);
   if(v.phase==='request'){
    const choices=W.inventory(g.s).filter(i=>W.suitable(g.s,i,v));
    const i=(v.npc==='shu'?choices.find(i=>i.id==='item-1'):null)||choices[0];
    if(i)g.npc({type:v.kind==='delivery'?'deliver':'sell',itemId:i.id});
    else if(!W.pendingTasks(g.s,v.npc).some(t=>t.id!==v.id)){
     g.npc({type:'accept-commission',requestId:`customer-${g.s.revision}`});
     const c=g.s.commissions.at(-1);
     if(c.status==='accepted')g.npc({type:'cancel-commission',commissionId:c.id});
    }
   }
   v=W.activeVisit(g.s);
   if(!W.pendingTasks(g.s,v.npc).length){
    if(W.nextUnknown(g.s)&&!g.s.explorations.some(e=>e.status==='pending'))explore(g,`frontier-${g.s.revision}`);
    else {const m=W.knownMaterials(g.s).find(m=>g.s.materials[m]<3&&!g.s.orders.some(o=>o.material===m&&o.status==='pending'));if(m)order(g,m,12,`supply-${g.s.revision}`);}
   }
   depart(g);
  }
  W.validate(g.s);
  if(g.s.content.events.length===9)return {g,source};
 }
 return {g,source};
}
test('九個原創節點每人三個，有真實前置、分支保底',()=>{assert.equal(W.CONTENT.EVENTS.length,9);for(const npc of Object.keys(W.PEOPLE))assert.equal(W.CONTENT.EVENTS.filter(d=>d.npc===npc).length,3);for(const d of W.CONTENT.EVENTS){assert(W.RECIPES[d.recipe]);assert(!d.branches.at(-1).trait&&d.branches.at(-1).strong===undefined);if(d.requires)assert(W.CONTENT.EVENTS.some(e=>e.id===d.requires));}});
test('新製作月份制完整實玩，九節點與跨主舊杖都可達成',()=>{const {g}=play();assert.equal(g.s.content.events.length,9,JSON.stringify(g.s.content.events.map(e=>e.key)));const cross=g.s.content.events.find(e=>e.key==='cen-cross');assert.equal(cross.itemId,'item-1');assert.equal(cross.actor,'shu');assert.equal(cross.episodeId,2);for(const e of g.s.content.events){const i=g.s.items[e.itemId],episode=i.episodes.find(x=>x.id===e.episodeId);assert(e.month>episode.since);assert(e.month>i.finishedMonth);assert.equal(e.before-e.after,e.wear);assert(g.s.news.some(n=>n.id===e.newsId));}assert.deepEqual(W.importSave(W.exportSave(g.s)),g.s);});
test('普通新護腕與熔鍊傳承分支結果不同，綁定真實磨耗',()=>{const plain=play(false),inherited=play(true);const a=plain.g.s.content.events.find(e=>e.key==='he-replacement'),b=inherited.g.s.content.events.find(e=>e.key==='he-replacement');assert(a);assert(b);assert.equal(a.branch,'familiar');assert.equal(a.wear,2);assert.equal(b.branch,'reinforced');assert.equal(b.wear,1);assert.equal(inherited.g.s.items[b.itemId].legacy,inherited.source);assert.equal(inherited.g.s.items[inherited.source].status,'smelted');});
test('已完成節點、使用與鳥信不因重載或雙擊再發',()=>{const {g}=play(true);const count=g.s.content.events.length;const saved=W.exportSave(g.s);assert.throws(()=>g.do({type:'open'}),/已經營業/);assert.equal(W.exportSave(g.s),saved);g.s=W.importSave(saved);next(g);assert.equal(g.s.content.events.length,count);assert.equal(new Set(g.s.news.map(n=>n.id)).size,g.s.news.length);});
test('偽造內容分支、引用、月份、磨耗或拒單紀錄拒絕',()=>{const {g}=play();for(const mutate of [s=>s.content.events.push(s.content.events[0]),s=>s.content.events[0].actor='he',s=>s.content.events[0].branch='missing',s=>s.content.events[0].wear=0,s=>s.content.events[0].month=0,s=>s.content.declined.he.bracer=s.month+1]){const d=JSON.parse(W.exportSave(g.s));mutate(d.state);assert.throws(()=>W.importSave(JSON.stringify(d)),/存檔/);}});
module.exports={play};
