'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js');
const {game,craft,intro,explore,next,at,depart}=require('./helpers.cjs'),{personalRoute}=require('./personal-helpers.cjs'),{actor,completeDelayedRoute}=require('./audit-helpers.cjs');
const plain=s=>Object.fromEntries(Object.keys(W.PEOPLE).map(id=>{const p=W.characterProgress(s,id);return [id,[p.level,p.ability,p.completed]];}));
test('首次相識在閱完月結才記，排隊未接待者不提前相識，關店重載保留',()=>{
 let s=W.initialState();assert.deepEqual(W.knownPeople(s),[]);s=W.dispatch(s,{type:'open'}).state;assert.deepEqual(W.knownPeople(s),[]);s=W.dispatch(s,{type:'review-next',month:1,cursor:0}).state;assert.deepEqual(W.knownPeople(s),['cen']);s=W.dispatch(s,{type:'close'}).state;assert.deepEqual(W.knownPeople(W.importSave(W.exportSave(s))),['cen']);
 const g=game();intro(g);explore(g);next(g);assert.deepEqual(W.knownPeople(g.s),['cen','he']);assert(g.s.visits.some(v=>v.npc==='he'&&v.metMonth===2));g.do({type:'close'});assert.deepEqual(W.knownPeople(W.importSave(W.exportSave(g.s))),['cen','he']);
});
test('不採購仍有新客、使用鳥信、人物、配方與鑑定；教學旗標保持真實',()=>{
 const g=game();intro(g);g.npc({type:'leave'});next(g);assert.equal(W.activeVisit(g.s).npc,'he');assert.equal(W.activeVisit(g.s).kind,'normal');assert.equal(g.s.tutorial.ordered,false);assert.equal(g.s.tutorial.delivered,false);assert(g.s.news.some(n=>n.id.startsWith('use-')));g.npc({type:'talk'});assert(W.canAppraise(g.s));assert(W.unlocked(g.s,'shield'));assert(W.canScout(g.s));at(g,'cen');assert.notEqual(W.activeVisit(g.s).kind,'intro');assert.doesNotMatch(W.requestDetail(W.activeVisit(g.s)),/兩件武器都收好了/);next(g);assert.equal(g.s.tutorial.delivered,false);
});
test('三人成長只取不同可靠經歷：售出不加，重複使用／探索／回報不刷級',()=>{
 const g=game();intro(g);for(const id of Object.keys(W.PEOPLE)){assert.equal(W.characterProgress(g.s,id).ability,0);assert.equal(W.characterProgress(g.s,id).level,1);}explore(g);next(g);assert.equal(W.characterProgress(g.s,'cen').ability,2);assert.equal(W.characterProgress(g.s,'cen').level,2);at(g,'cen');explore(g,'second-cen');next(g);assert.equal(W.characterProgress(g.s,'cen').ability,2);assert.equal(W.characterProgress(g.s,'he').ability,0);
 const r=personalRoute();for(const id of Object.keys(W.PEOPLE)){const p=W.characterProgress(r.state,id);assert.equal(p.ability,3);assert.equal(p.level,2);assert(p.completed);}assert.equal(W.characterProgress(r.state,'cen').history.find(e=>e.id==='cen-cross').grows,false);assert.equal(W.characterProgress(r.state,'he').history.find(e=>e.id==='he-replacement').grows,false);
 const h=game();h.s=W.importSave(W.exportSave(r.state));const before=plain(h.s);for(let n=0;n<8;n++)next(h);assert.deepEqual(plain(h.s),before);assert.equal(h.s.personal.events.length,2);
});
test('兩條個人線正常可達：既有九事件、本人委託與耐久傳承，未交貨不作證',()=>{
 const r=personalRoute();assert.equal(r.state.content.events.length,9);assert.equal(W.roadState(r.state),'restored');assert.equal(r.before.items[r.bell].episodes.at(-1).uses,0);assert(!W.characterProgress(r.before,'shu').completed);assert.equal(r.before.commissions.find(c=>c.itemId===r.bell).status,'delivered');
 for(const e of r.state.personal.events){assert(e.roadMonth<e.month);assert(e.ability>=2);assert.equal(e.gear.length,2);for(const gear of e.gear){const i=r.state.items[gear.itemId],ep=i.episodes.find(p=>p.id===gear.episodeId);assert.equal(ep.npc,e.npc);assert(ep.since<e.month);assert(gear.after>=4);assert.equal(gear.before-gear.after,W.useResult({...i,durability:gear.before}).wear);assert(i.history.some(h=>h.month===e.month&&h.text.includes(`耐久 ${gear.before}→${gear.after}／`)));}assert.equal(r.state.news.filter(n=>n.id===e.newsId).length,1);}W.validate(r.state);
});
test('缺裝備先給合理需求，原故事優先公平輪替，不被新目標餓死',()=>{
 const r=personalRoute();assert(!W.characterProgress(r.seed,'shu').completed);assert.match(W.characterProgress(r.seed,'shu').hint,/細緻|耐用|磨耗/);assert(r.snapshots.some(s=>s.commissions.some(c=>c.recipe==='amulet'&&c.minQuality===1&&c.traitRequired==='guard')));assert(r.snapshots.some(s=>s.commissions.some(c=>c.recipe==='bell'&&c.minQuality===1&&c.traitRequired==='light')));assert.equal(r.frames.find(s=>s.content.events.length===9).content.events.length,9);
});
test('小禾通路不依賴阿岑／望舒完成；未完成者不能冒領採集',()=>{
 const {g}=completeDelayedRoute();assert.equal(W.roadState(g.state),'restored');assert.equal(g.state.personal.events.length,0);assert(W.canGather(g.state,'he'));assert(!W.canGather(g.state,'cen'));assert(!W.canGather(g.state,'shu'));g.at('cen');const before=W.exportSave(g.state);assert.throws(()=>g.customer('gather-route',{material:'木頭',requestId:'too-early-personal'}),/本人.*目標/);assert.equal(W.exportSave(g.state),before);
});
test('個人完成真正解鎖本人採集：兩人各付6、次月各交3、去重與任務互斥',()=>{
 const r=personalRoute(),g=actor(W.exportSave(r.state));g.at('cen');const wood=g.state.materials.木頭,net=g.state.coins-g.state.debt;g.customer('gather-route',{material:'木頭',requestId:'cen-gather'});const raw=W.exportSave(g.state);assert.throws(()=>g.customer('order',{material:'鐵',quantity:1,requestId:'cen-overlap'}),/未完成委託/);assert.equal(W.exportSave(g.state),raw);g.customer(W.activeVisit(g.state).phase==='service'?'leave':'decline');g.at('shu');g.customer('gather-route',{material:'木頭',requestId:'shu-gather'});assert.equal(g.state.coins-g.state.debt,net-12);const dup=W.exportSave(g.state);assert.throws(()=>g.customer('gather-route',{material:'木頭',requestId:'shu-gather'}),/已接受/);assert.equal(W.exportSave(g.state),dup);g.next();assert.equal(g.state.materials.木頭,wood+6);assert.equal(g.state.journey.outings.filter(o=>['cen','shu'].includes(o.npc)&&o.status==='delivered').length,2);for(const npc of ['cen','shu'])assert(g.state.news.some(n=>n.id.startsWith('outing-')&&n.text.startsWith(W.PEOPLE[npc].name)));g.next();assert.equal(g.state.materials.木頭,wood+6);g.replay();
});
test('真實v0.13舊檔推導能力但不補發新目標或首次相識事件',()=>{
 const Old=require('./fixtures/engine-v13.cjs'),route=completeDelayedRoute();let old=Old.initialState();for(const row of route.g.actions)old=Old.dispatch(old,row.action).state;assert.equal(old.personal,undefined);const s=W.importSave(Old.exportSave(old));assert.deepEqual(s,old);assert.equal(W.characterProgress(s,'cen').ability,2);assert.equal(W.characterProgress(s,'he').ability,3);assert.equal(W.characterProgress(s,'shu').ability,0);assert.equal(W.characterProgress(s,'cen').completed,false);assert.equal(W.characterProgress(s,'shu').completed,false);assert.deepEqual(s.news,old.news);assert.deepEqual(W.knownPeople(s),['cen','he']);assert.equal(W.roadState(s),'restored');
});
test('個人結果偽造能力、世界／使用前置、他人或重複物件、磨耗與鳥信均拒絕',()=>{
 const saved=W.exportSave(personalRoute().state);
 for(const mutate of [s=>s.personal.events[1].ability=1,s=>s.personal.events[1].month=s.personal.events[1].roadMonth,s=>s.personal.events[1].source='cen-shield',s=>s.personal.events[1].gear[0].itemId=s.personal.events[0].gear[0].itemId,s=>s.personal.events[1].gear[1]=s.personal.events[1].gear[0],s=>s.personal.events[1].gear[0].after=3,s=>s.personal.events[1].gear[0].before--,s=>s.personal.events[1].gear[0].episodeId=999,s=>s.personal.events.push(s.personal.events[1]),s=>s.news=s.news.filter(n=>n.id!=='personal-shu-watch'),s=>s.personal.events.pop(),s=>delete s.personal,s=>s.visits[0].metMonth=s.month+1]){const d=JSON.parse(saved);mutate(d.state);assert.throws(()=>W.importSave(JSON.stringify(d)),/存檔/);}
});

test('不熔鍊也能並行準備新護符與鈴，再正常逐件交易完成目標',()=>{
 const r=personalRoute(),g=actor(W.exportSave(r.seed));const amulet=g.craft('amulet'),bell=g.craft('bell'),staff=g.craft('staff');
 for(let n=0;n<8&&!W.characterProgress(g.state,'shu').completed;n++){
  g.next();if(W.characterProgress(g.state,'shu').completed)break;g.at('shu');const v=W.activeVisit(g.state);
  if(v.phase==='request'){const i=W.inventory(g.state).find(i=>[amulet,bell,staff].includes(i.id)&&W.suitable(g.state,i,v));assert(i,'prepared suitable piece');g.customer('sell',{itemId:i.id});}g.customer('leave');
 }
 assert(W.characterProgress(g.state,'shu').completed);const done=g.state.personal.events.find(e=>e.npc==='shu');assert.deepEqual(done.gear.map(g=>g.itemId),[amulet,bell]);assert.equal(g.state.items[amulet].legacy,null);assert.equal(g.state.items[bell].legacy,null);g.replay();
});
test('新可選欄位畸形存檔在驗證入口拒絕，沒有型別錯誤或補造事件',()=>{
 const saved=W.exportSave(personalRoute().state);for(const value of [null,[],{events:4},{events:[null]},{events:[[],{}]}]){const d=JSON.parse(saved);d.state.personal=value;assert.throws(()=>W.importSave(JSON.stringify(d)),/存檔格式不正確：個人目標表/);}
});
