'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js');
const {game,ready,next,at,craft,explore,order,depart}=require('./helpers.cjs'),{request}=require('./regression-helpers.cjs');
const {play}=require('./campaign.cjs'),{routeCampaign,stateGame,checkpoint,oldV4}=require('./journey-helpers.cjs');
const scoped=(g,a)=>{const v=W.activeVisit(g.s);return {visitId:v?.id,counterId:v?.counterId,...a};};
function rejection(g,a,match){const saved=W.exportSave(g.s);assert.throws(()=>g.do(a),match);assert.equal(W.exportSave(g.s),saved);}
const level=s=>W.journeyProgress(s),event=(s,key)=>s.journey.events.find(e=>e.key===key);

test('全新正常操作完成個人線再重通驛道，每月一節點且引用真實使用',()=>{
 const {g,trace}=routeCampaign();assert.equal(g.s.month,9);assert.deepEqual(g.s.journey.events.map(e=>e.key),['he-near','he-clue','he-survey','road-open']);assert.deepEqual(g.s.journey.events.map(e=>e.month),[4,5,8,9]);assert.deepEqual(level(g.s),{level:2,pathfinding:3,stage:4});assert.equal(W.roadState(g.s),'restored');assert.deepEqual(g.s.knownMaterials,['木頭','鐵','銅']);
 for(const r of g.s.journey.events){assert.equal(g.s.news.filter(n=>n.id===r.newsId).length,1);for(const proof of r.gear){const i=g.s.items[proof.itemId],e=i.episodes.find(e=>e.id===proof.episodeId);assert.equal(e.npc,'he');assert(e.since<r.month);assert(proof.after>=4);}}
 for(const s of trace.snapshots)W.validate(s);
});
test('缺辨路經驗保留線索，不把有材料或製作完成當作能力',()=>{
 const g=checkpoint(s=>s.month===5&&level(s).stage===2);assert.equal(level(g.s).pathfinding,2);assert.match(W.journeyHint(g.s),/親自試過飛石防護/);assert.equal(event(g.s,'he-survey'),undefined);const before=level(g.s);for(const i of W.inventory(g.s))assert.equal(i.owner,null);g.do({type:'close'});g.s=W.importSave(W.exportSave(g.s));assert.deepEqual(level(g.s),before);assert.equal(W.roadState(g.s),'unknown');
});
test('能力已足但缺可用護腕不能勘查；委託補裝備而保留進度',()=>{
 const g=checkpoint(s=>s.month===6&&level(s).pathfinding===3);assert.equal(level(g.s).stage,2);assert.match(W.journeyHint(g.s),/細緻以上.*耐久充足/);assert.equal(W.roadState(g.s),'unknown');at(g,'he');const v=W.activeVisit(g.s);assert.equal(v.needs[0],'bracer');assert.equal(v.minQuality,1);assert.equal(v.traitRequired,'guard');g.npc({type:'accept-commission',requestId:'repair-gap'});const c=g.s.commissions.at(-1);assert.equal(c.status,'crafting');assert.equal(level(g.s).stage,2);next(g);assert.equal(c.itemId,g.s.commissions.at(-1).itemId);assert.equal(g.s.commissions.at(-1).status,'ready');assert.equal(level(g.s).stage,2);
});
test('成品仍在庫存或保留本人均不冒險；當月交貨不立即推節點',()=>{
 const g=checkpoint(s=>s.month===7&&s.commissions.some(c=>c.npc==='he'&&c.status==='ready'));assert.equal(level(g.s).stage,2);const c=g.s.commissions.find(c=>c.npc==='he'&&c.status==='ready');assert.equal(g.s.items[c.itemId].status,'inventory');assert.equal(g.s.items[c.itemId].episodes.length,0);at(g,'he');g.npc({type:'deliver',itemId:c.itemId});assert.equal(level(g.s).stage,2);assert.equal(g.s.items[c.itemId].episodes[0].uses,0);next(g);assert.equal(level(g.s).stage,3);assert.equal(event(g.s,'he-survey').gear[0].itemId,c.itemId);
});
test('路標確認後缺木盾保留世界前置，補裝備再通路，不死亡或倒退',()=>{
 const g=checkpoint(s=>level(s).stage===3);const shields=W.owned(g.s,'he').filter(i=>i.recipe==='shield');assert(shields.length);const shield=shields[0];shield.durability=3;W.validate(g.s);assert.match(W.journeyHint(g.s),/木盾/);next(g);assert.equal(level(g.s).stage,3);assert.equal(W.roadState(g.s),'marked');assert(!event(g.s,'road-open'));at(g,'he');const v=W.activeVisit(g.s);assert(['bracer','shield'].includes(v.needs[0]));const resumed=play(false,{state:g.s,journey:true,stopAtRoad:true,stopAtNine:false,materialLimit:3,turns:12}).g;assert.equal(W.roadState(resumed.s),'restored');assert.deepEqual(resumed.s.journey.events.slice(0,3),g.s.journey.events);assert.equal(resumed.s.journey.events.length,4);
});
test('足條件才完成，世界節點沿用普通使用，不重複磨耗',()=>{
 const g=checkpoint(s=>s.month===8&&level(s).stage===3,true);const gear=W.owned(g.s,'he').filter(i=>['bracer','shield'].includes(i.recipe));const before=Object.fromEntries(gear.map(i=>[i.id,{uses:i.episodes.at(-1).uses,durability:i.durability,wear:W.useResult(i).wear}]));next(g);assert.equal(W.roadState(g.s),'restored');const r=event(g.s,'road-open');assert.equal(r.gear.length,2);for(const p of r.gear){const i=g.s.items[p.itemId];assert.equal(i.episodes.at(-1).uses,before[i.id].uses+1);assert.equal(i.durability,before[i.id].durability-before[i.id].wear);assert.equal(p.after,i.durability);}
});
test('重載、同月重複開店與長時間繼續不重發節點或世界獎勵',()=>{
 const {g:source}=routeCampaign(),g=stateGame(source.s),news=g.s.news.filter(n=>n.id.startsWith('journey-'));const before=W.exportSave(g.s);assert.throws(()=>g.do({type:'open'}),/營業中/);assert.equal(W.exportSave(g.s),before);for(let n=0;n<8;n++){next(g);g.s=W.importSave(W.exportSave(g.s));}assert.deepEqual(g.s.journey.events,source.s.journey.events);assert.deepEqual(g.s.news.filter(n=>n.id.startsWith('journey-')),news);assert.equal(g.s.journey.events.length,4);assert.deepEqual(g.s.journey.growth,source.s.journey.growth);
});
test('世界效果真的多交一份；既接探索不追補，後接份量鎖定及一次交付',()=>{
 const g=checkpoint(s=>s.month===8&&level(s).stage===3,true);request(g,'cen','shield');explore(g,'before-road');assert.equal(g.s.explorations.at(-1).quantity,2);const silver=g.s.materials.銀;next(g);assert.equal(W.roadState(g.s),'restored');assert.equal(g.s.materials.銀,silver+2);at(g,'cen');explore(g,'after-road');const e=g.s.explorations.at(-1);assert.equal(e.quantity,3);const gold=g.s.materials.金;g.do({type:'close'});g.s=W.importSave(W.exportSave(g.s));g.do({type:'open'});assert.equal(g.s.materials.金,gold+3);assert.equal(g.s.explorations.at(-1).status,'delivered');assert.match(g.s.news.find(n=>n.id==='exploration-'+e.id).text,/金 3 個/);next(g);assert.equal(g.s.materials.金,gold+3);assert.equal(g.s.news.filter(n=>n.id==='exploration-'+e.id).length,1);
});
test('已知材料驛道採集真實扣六、可欠、下月三個、去重且不刷能力',()=>{
 const {g:source}=routeCampaign(),g=stateGame(source.s);next(g);at(g,'he');g.s.coins=0;W.validate(g.s);const debt=g.s.debt,qty=g.s.materials.銅,ability=g.s.journey.growth.he;const a=scoped(g,{type:'gather-route',material:'銅',requestId:'gather-copper'});g.do(a);assert.equal(g.s.debt,debt+6);const saved=W.exportSave(g.s);assert.throws(()=>g.do(a),/已接受/);assert.equal(W.exportSave(g.s),saved);assert.equal(W.pendingTasks(g.s,'he')[0].label,'玩家請對方驛道採集');next(g);assert.equal(g.s.materials.銅,qty+3);assert.deepEqual(g.s.journey.growth.he,ability);next(g);assert.equal(g.s.materials.銅,qty+3);
});
test('近程勘路關店／離場／保存不中斷，只交一次，同人任務與 ID 共用',()=>{
 const g=ready(),qty=g.s.materials.木頭,net=g.s.coins-g.s.debt;const a=scoped(g,{type:'scout',requestId:'shared-outing'});g.do(a);assert.equal(g.s.coins-g.s.debt,net-6);assert.equal(level(g.s).pathfinding,0);rejection(g,scoped(g,{type:'order',material:'木頭',quantity:1,requestId:'shared-outing'}),/已接受/);rejection(g,scoped(g,{type:'explore',requestId:'another'}),/未完成委託/);depart(g);g.do({type:'close'});g.s=W.importSave(W.exportSave(g.s));assert.equal(level(g.s).stage,0);g.do({type:'open'});assert.equal(g.s.materials.木頭,qty+1);assert.equal(level(g.s).stage,1);assert.equal(level(g.s).pathfinding,1);next(g);at(g,'he');rejection(g,scoped(g,{type:'scout',requestId:'another-scout'}),/行動紀錄/);next(g);assert.equal(g.s.materials.木頭,qty+1);assert.equal(g.s.news.filter(n=>n.id.startsWith('outing-')).length,1);
});
test('同月勘路與首次護腕使用兩個可靠經歷，只推進一個新任務節點',()=>{
 const g=checkpoint(s=>s.month===4&&level(s).stage===1);assert.equal(level(g.s).pathfinding,2);assert.equal(g.s.journey.events.filter(e=>e.month===4).length,1);assert(g.s.content.events.some(e=>e.key==='he-wrist'&&e.month===4));assert.equal(event(g.s,'he-clue'),undefined);
});
test('純過月或反覆買賣不刷辨路／等級，已有的同類經歷只算一次',()=>{
 const g=ready();order(g,'木頭',10);next(g);for(let n=0;n<4;n++){const i=craft(g,'staff');next(g);request(g,'he','staff');g.npc({type:'sell',itemId:i.id});}assert.equal(W.owned(g.s,'he').length,4);assert.deepEqual(g.s.journey.growth.he,{level:1,pathfinding:0});for(let n=0;n<8;n++)next(g);assert.deepEqual(level(g.s),{level:1,pathfinding:0,stage:0});const completed=stateGame(routeCampaign().g.s);for(let n=0;n<10;n++)next(completed);assert.deepEqual(completed.s.journey.growth.he,{level:2,pathfinding:3});
});
test('略過支線仍能銅銀金、完整九節點與交易，沒變售價',()=>{
 const {g,trace}=play(false,{stopAtNine:false,turns:24,skipHeExploration:true});assert.equal(g.s.content.events.length,9);assert.deepEqual(g.s.knownMaterials,W.MATERIALS);assert.equal(W.roadState(g.s),'unknown');assert.equal(g.s.journey.outings.length,0);assert.equal(level(g.s).stage,0);for(const t of trace.transactions)assert.equal(t.amount,t.price+(t.bonus?12:0));
});
test('提前採集、錯人物、未知材料及材料預留溢位都原子拒絕',()=>{
 const g=ready();rejection(g,scoped(g,{type:'gather-route',material:'木頭',requestId:'early'}),/通路/);at(g,'cen');rejection(g,scoped(g,{type:'scout',requestId:'wrong'}),/小禾/);const h=stateGame(routeCampaign().g.s);next(h);at(h,'he');rejection(h,scoped(h,{type:'gather-route',material:'銀',requestId:'unknown'}),/已辨識/);h.s.materials.木頭=Number.MAX_SAFE_INTEGER;W.validate(h.s);rejection(h,scoped(h,{type:'gather-route',material:'木頭',requestId:'overflow'}),/安全整數/);
});
test('真實 schema4 遷移只推導可靠經歷，不補發個人／世界完成或款項',()=>{
 const {Old,s:old}=oldV4(),s=W.importSave(Old.exportSave(old));assert.equal(s.schema,5);assert.equal(s.coins,old.coins);assert.equal(s.debt,old.debt);assert.equal(s.month,old.month);assert.deepEqual(s.items,old.items);assert.deepEqual(s.npcs,old.npcs);assert.deepEqual(s.content,old.content);assert.deepEqual(s.news,old.news);assert.deepEqual(s.journey.growth.he,{level:2,pathfinding:3});assert.equal(s.journey.events.length,0);assert.equal(W.roadState(s),'unknown');assert.equal(W.canScout(s),false);assert(s.explorations.every(e=>e.quantity===2));assert.deepEqual(W.importSave(W.exportSave(s)),s);
});
test('舊全材料檔沒有近程可靠證據仍可勘路；泛用故事不假認成新任務',()=>{
 const {Old,s:old}=oldV4();old.news=old.news.filter(n=>!n.id.startsWith('exploration-'));const s=W.importSave(Old.exportSave(old));assert.deepEqual(s.journey.growth.he,{level:2,pathfinding:2});assert(W.canScout(s));assert.equal(s.journey.events.length,0);assert.deepEqual(s.knownMaterials,W.MATERIALS);const g=stateGame(s);at(g,'he');g.npc({type:'scout',requestId:'old-recovery'});next(g);assert.equal(level(g.s).stage,1);assert.equal(level(g.s).pathfinding,3);assert.equal(W.roadState(g.s),'unknown');
});
test('人物級別／能力、節點月份／來源、裝備快照、鳥信與採集前置偽造拒絕',()=>{
 const {g}=routeCampaign(),saved=W.exportSave(g.s);for(const mutate of [s=>s.journey.growth.he.level=1,s=>s.journey.growth.he.pathfinding=2,s=>s.journey.events[1].month=s.journey.events[0].month,s=>s.journey.events[0].source.id='missing',s=>s.journey.events[2].gear[0].score++,s=>s.journey.events[3].gear[1].after=3,s=>s.journey.events[3].gear[0].episodeId=999,s=>s.news=s.news.filter(n=>n.id!=='journey-road-open'),s=>s.journey.events.reverse(),s=>s.journey.events.pop(),s=>s.journey.outings[0].quantity=3,s=>s.journey.outings[0].npc='cen']){const d=JSON.parse(saved);mutate(d.state);assert.throws(()=>W.importSave(JSON.stringify(d)),/存檔/);}
});

test('合用護腕已真正佩戴且使用，仍缺辨路能力時不觸發個人完成',()=>{
 const g=checkpoint(s=>s.month===5&&level(s).stage===2),i=craft(g,'bracer');next(g);request(g,'he','bracer',{minQuality:1,traitRequired:'guard'});g.npc({type:'sell',itemId:i.id});next(g);const gear=g.s.items[i.id];assert.equal(gear.owner,'he');assert(W.performance(gear)>=8);assert(gear.durability>=4);assert(gear.traits.includes('guard'));assert.equal(gear.episodes.at(-1).lastUsedMonth,g.s.month);assert.deepEqual(level(g.s),{level:2,pathfinding:2,stage:2});assert.equal(event(g.s,'he-survey'),undefined);assert.match(W.journeyHint(g.s),/辨路經驗/);
});
test('原本小禾材料探索可銜接近程節點，多條同類探索不刷能力或多給勘路獎',()=>{
 const g=ready(),wood=g.s.materials.木頭;explore(g,'he-first');next(g);assert.deepEqual(level(g.s),{level:1,pathfinding:1,stage:1});assert.equal(g.s.journey.outings.length,0);assert.equal(g.s.materials.木頭,wood);assert.equal(event(g.s,'he-near').source.type,'exploration');at(g,'he');explore(g,'he-second');next(g);assert.deepEqual(level(g.s),{level:1,pathfinding:1,stage:1});assert.equal(g.s.journey.outings.length,0);assert.equal(W.canScout(g.s),false);assert.equal(g.s.materials.木頭,wood);
});
for(const version of [1,2])test(`schema${version} 泛用舊使用／固定故事不推導新勘路能力，材料全知仍可補路線`,()=>{
 const Old=require(`./fixtures/engine-v${version}.cjs`);let s=Old.initialState();const act=a=>{s=Old.dispatch(s,a).state;},npc=a=>{const v=Old.activeVisit(s);act({visitId:v?.id,counterId:v?.counterId,...a});},advance=()=>{act({type:'close'});act({type:'open'});};
 for(const recipe of ['staff','sword'])act({type:'craft',recipe});act({type:'open'});npc({type:'talk'});for(const itemId of ['item-1','item-2'])npc({type:'sell',itemId});const purchase={type:'order',material:'銅',quantity:2,requestId:'old-supply'};if(version===1)act(purchase);else npc(purchase);advance();while(Old.activeVisit(s)?.npc!=='he'){const v=Old.activeVisit(s);assert(v);npc({type:v.phase==='service'?'leave':'decline'});}npc({type:'talk'});act({type:'craft',recipe:version===1?'watering':'bracer'});npc({type:'sell',itemId:Object.values(s.items).at(-1).id});advance();const migrated=W.importSave(Old.exportSave(s));assert.equal(migrated.month,s.month);assert.deepEqual(migrated.knownMaterials,W.MATERIALS);assert.deepEqual(migrated.journey.growth.he,{level:1,pathfinding:0});assert.equal(migrated.journey.events.length,0);assert.equal(W.roadState(migrated),'unknown');assert.equal(W.canScout(migrated),true);
});

test('schema4 未完工兩月作品及待探索重載完整保留，不提前完成或重扣交付',()=>{
 const {Old,s:old}=oldV4(false);let state=old;const act=a=>{state=Old.dispatch(state,a).state;};const v=Old.activeVisit(state);assert.equal(v.npc,'he');act({type:'explore',visitId:v.id,counterId:v.counterId,requestId:'pending-old-gold'});act({type:'craft',recipe:'amulet'});const id=Object.values(state.items).at(-1).id,coins=state.coins,debt=state.debt,xp=state.xp.craft,g=stateGame(W.importSave(Old.exportSave(state)));assert.equal(g.s.coins,coins);assert.equal(g.s.debt,debt);assert.equal(g.s.items[id].status,'crafting');assert.deepEqual(g.s.items[id],state.items[id]);assert.equal(g.s.explorations.at(-1).quantity,2);assert.deepEqual(g.s.knownMaterials,state.knownMaterials);assert.equal(g.s.journey.events.length,0);next(g);assert.equal(g.s.materials.金,state.materials.金+2);assert.equal(g.s.items[id].status,'crafting');assert.equal(g.s.xp.craft,xp);g.s=W.importSave(W.exportSave(g.s));next(g);assert.equal(g.s.items[id].status,'inventory');assert.equal(g.s.xp.craft,xp+1);assert.equal(g.s.materials.金,state.materials.金+2);assert.equal(g.s.news.filter(n=>n.id==='exploration-'+state.explorations.at(-1).id).length,1);
});
