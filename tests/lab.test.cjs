'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const W=require('../engine.js'),L=require('../lab-core.js'),S=require('../lab-scenarios.js');
const {view,KEY}=require('./ui-harness.cjs');
function lab(key){const x=L.create(S);x.select(key);return x;}
const act=(x,type,extra={})=>x.act(x.action({type,...extra}));
const next=x=>{if(x.state.open)act(x,'close');act(x,'open');};
const current=x=>W.activeVisit(x.state);
const depart=x=>act(x,current(x).phase==='service'?'leave':'decline');
const at=(x,npc)=>{let n=0;while(current(x)?.npc!==npc){assert(current(x));assert(n++<15);depart(x);}};
const craft=(x,recipe)=>{act(x,'craft',{recipe});return Object.values(x.state.items).at(-1);};

test('所有測試種子合法；九子情境對應六入口，劇情狀態尚未完成，正式引擎初始資料未改',()=>{
 assert.equal(Object.keys(S).length,9);assert.equal(new Set(Object.values(S).map(s=>s.mode)).size,6);
 for(const scene of Object.values(S))W.validate(scene.state);
 for(const key of ['growth-cen','growth-he','growth-shu','growth-gap'])assert.equal(W.characterProgress(S[key].state,S[key].npc).completed,false);
 assert.equal(W.initialState().month,0);assert.equal(W.initialState().knownMaterials.length,2);
});
test('情境切換／重置／返回彼此隔離；狀態快照不洩漏可變參照',()=>{
 const x=lab('equipment'),original=JSON.stringify(x.state);craft(x,'staff');const progressed=JSON.stringify(x.state);x.select('materials');act(x,'explore');const materials=JSON.stringify(x.state);x.select('equipment');assert.equal(JSON.stringify(x.state),progressed);x.reset();assert.equal(JSON.stringify(x.state),original);x.select('materials');assert.equal(JSON.stringify(x.state),materials);const copy=x.state;copy.month=999;assert.notEqual(x.state.month,999);x.menu();assert.equal(x.state,null);x.select('materials');assert.equal(JSON.stringify(x.state),materials);
});
test('裝備整理保留正式一月／兩月；關店不前進，開店重複拒絕，完成不重加經驗',()=>{
 const x=lab('equipment'),month=x.state.month,xp=x.state.xp.craft;const a=craft(x,'staff'),b=craft(x,'amulet');assert.equal(a.dueMonth,month+1);assert.equal(b.dueMonth,month+2);assert.equal(x.state.items[a.id].status,'crafting');act(x,'open');assert.equal(x.state.items[a.id].status,'inventory');assert.equal(x.state.items[b.id].status,'crafting');const before=JSON.stringify(x.state);assert.throws(()=>act(x,'open'),/營業/);assert.equal(JSON.stringify(x.state),before);act(x,'close');assert.equal(x.state.month,month+1);act(x,'open');assert.equal(x.state.items[b.id].status,'inventory');assert.equal(x.state.xp.craft,xp+2);next(x);assert.equal(x.state.xp.craft,xp+2);
});
test('鍛造拒絕舊開關店和固定引擎製作；其他場景材料及revision驗證保留',()=>{
 const x=lab('forge'),before=JSON.stringify(x.state);for(const type of ['open','close','craft'])assert.throws(()=>act(x,type,{recipe:'staff'}),/不在目前/);assert.equal(JSON.stringify(x.state),before);x.select('equipment');const action=x.action({type:'craft',recipe:'staff'});x.act(action);const after=JSON.stringify(x.state);assert.throws(()=>x.act(action),/已處理/);assert.equal(JSON.stringify(x.state),after);assert(x.state.materials.木頭<20);x.select('materials');assert.equal(x.state.materials.木頭,20);
});
test('裝備修復一次、熔鍊一次，傳承只有下一件同材質使用，成品仍待月',()=>{
 const x=lab('equipment'),old=W.inventory(x.state).find(i=>i.returned&&!i.repaired&&i.recipe==='sword');act(x,'repair',{itemId:old.id});assert.equal(x.state.items[old.id].durability,old.maxDurability);assert.throws(()=>act(x,'repair',{itemId:old.id}));const wood=W.inventory(x.state).find(i=>i.returned&&!i.repaired&&i.recipe==='staff');const stock=x.state.materials.木頭;act(x,'smelt',{itemId:wood.id});assert.equal(x.state.materials.木頭,stock+1);assert.throws(()=>act(x,'smelt',{itemId:wood.id}));const a=craft(x,'bracer'),b=craft(x,'bracer');assert(a.legacy);assert.equal(b.legacy,null);assert.equal(x.state.items[a.id].status,'crafting');act(x,'open');assert.equal(x.state.items[a.id].status,'inventory');assert.equal(x.state.legacies.filter(l=>l.usedBy===a.id).length,1);
});
test('鑑定真實增加一次經驗，不能重刷；正式收藏與舊物歷史保留',()=>{
 const x=lab('equipment'),i=W.inventory(x.state).find(i=>!i.appraised),xp=x.state.xp.appraisal;act(x,'appraise',{itemId:i.id});assert.equal(x.state.xp.appraisal,xp+1);assert.throws(()=>act(x,'appraise',{itemId:i.id}));assert.equal(x.state.xp.appraisal,xp+1);assert(x.state.items[i.id].episodes.length);
});
test('櫃臺交貨本人持有、收入與排隊；重送同件及舊token失敗',()=>{
 const x=lab('trade'),v=current(x),i=W.inventory(x.state).find(i=>W.suitable(x.state,i)),cash=x.state.coins,token=x.action({type:'deliver',itemId:i.id});x.act(token);assert.equal(x.state.items[i.id].owner,v.npc);assert.equal(x.state.items[i.id].status,'owned');assert.equal(x.state.coins,cash+W.price(i));assert.equal(current(x).id,v.id);assert.equal(current(x).phase,'service');const after=JSON.stringify(x.state);assert.throws(()=>x.act(token));assert.equal(JSON.stringify(x.state),after);depart(x);assert.notEqual(current(x)?.id,v.id);assert.throws(()=>x.act({...token,expectedRevision:x.state.revision}));
});
test('普通推薦真實轉移所有權',()=>{
 const x=lab('trade');next(x);let n=0,done=false;while(current(x)&&n++<12){const v=current(x),items=W.inventory(x.state).filter(i=>W.suitable(x.state,i,v));if(v.kind!=='delivery'&&items.length){act(x,'sell',{itemId:items[0].id});assert.equal(x.state.items[items[0].id].owner,v.npc);done=true;break;}depart(x);}assert(done,'normal stock sale exists in earned trade scenario');
});
test('測試頁正常領貨與送客後接另一人製作委託，固定操作列保留',async()=>{
 const v=view({lab:true,autoReview:false});await v.click(v.buttons().find(b=>b.dataset.scene==='trade'));const buyer=current({state:v.state()}),item=v.button('deliver').action.itemId;const footer=v.html().slice(v.html().indexOf('class="counter-actions"'));assert.match(footer,/deliver/);assert.match(footer,/decline/);await v.clickAction('deliver');assert.equal(v.state().items[item].owner,buyer.npc);await v.clickAction('leave');assert.equal(W.activeVisit(v.state()).npc,'cen');await v.clickAction('accept-commission');const c=v.state().commissions.at(-1);assert.equal(c.npc,'cen');assert.equal(c.status,'crafting');assert.equal(v.state().items[c.itemId].dueMonth,v.state().month+1);
});
test('測試頁採購表單依正式數量驗證、留待次月交付；存檔仍隔離',async()=>{
 const v=view({lab:true,autoReview:false});await v.click(v.buttons().find(b=>b.dataset.scene==='materials'));v.element('lab-material').value='鐵';v.element('lab-quantity').value='0';await v.clickAction('order-form');assert.equal(v.state().orders.length,0);v.element('lab-material').value='鐵';v.element('lab-quantity').value='2';await v.clickAction('order-form');assert.equal(v.state().orders[0].quantity,2);assert.equal(v.state().orders[0].status,'pending');assert(v.buttons().find(b=>b.action?.type==='explore').disabled);await v.clickAction('close');await v.clickAction('open');assert.equal(v.state().materials.鐵,22);assert.match(v.html(),/已交付/);
});
test('測試頁熔鍊實物消失並承接同材料新作，鑑定不重複',async()=>{
 const v=view({lab:true,autoReview:false});await v.click(v.buttons().find(b=>b.dataset.scene==='equipment'));const b=v.button('smelt'),id=b.action.itemId,material=v.state().items[id].material;await v.click(b);assert.equal(v.state().items[id].status,'smelted');assert(!v.buttons().some(b=>b.action?.type==='smelt'&&b.action.itemId===id));const recipe=Object.keys(W.RECIPES).find(r=>W.RECIPES[r].material===material);await v.change('lab-recipe',recipe);await v.clickAction('craft',{recipe});const item=Object.values(v.state().items).at(-1);assert.equal(item.legacy,id);assert.equal(item.status,'crafting');
});
test('成長專頁實際顯示缺口、按開店才完成目標，可返回另一角色未修改狀態',async()=>{
 const v=view({lab:true,autoReview:false});await v.click(v.buttons().find(b=>b.dataset.scene==='growth-cen'));assert.match(v.html(),/下次親自使用/);await v.clickAction('open');assert(W.characterProgress(v.state(),'cen').completed);await v.click(v.buttons().find(b=>b.dataset.scene==='growth-gap'));assert.match(v.html(),/木盾|耐久/);assert(!W.characterProgress(v.state(),'he').completed);await v.clickAction('open');assert(!W.characterProgress(v.state(),'he').completed);
});
test('正式入口導向獨立測試而不另存正式進度，lab資產均在本機允許清單',async()=>{
 const v=view(),before=v.raw();await v.click({disabled:false,dataset:{tool:'lab'}});assert.equal(v.window.location.href,'lab.html');assert.equal(v.raw(),before);const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),server=fs.readFileSync(path.join(__dirname,'../server.cjs'),'utf8');assert.match(index,/data-tool="lab">獨立測試/);for(const file of ['lab.html','lab.css','lab-core.js','lab.js','lab-scenarios.js'])assert(server.includes(file));
});
test('材料採購即時扣款、背景共限、次月只交付一次，數量不合法無變更',()=>{
 const x=lab('materials'),cash=x.state.coins,before=JSON.stringify(x.state);assert.throws(()=>act(x,'order',{material:'木頭',quantity:1.5}));assert.equal(JSON.stringify(x.state),before);const order=x.action({type:'order',material:'木頭',quantity:2,requestId:'once'});x.act(order);assert.equal(x.state.coins,cash-6);assert.throws(()=>act(x,'explore'),/未完成/);const stock=x.state.materials.木頭;next(x);assert.equal(x.state.materials.木頭,stock+2);assert.equal(x.state.orders[0].status,'delivered');assert.throws(()=>x.act(order));next(x);assert.equal(x.state.materials.木頭,stock+2);
});
test('探索交付才解鎖銅與本人經歷；一人不能同月再接採購',()=>{
 const x=lab('materials');act(x,'explore');assert(!x.state.knownMaterials.includes('銅'));assert.throws(()=>act(x,'order',{material:'鐵',quantity:2}));next(x);assert(x.state.knownMaterials.includes('銅'));assert.equal(x.state.materials.銅,2);assert(W.characterProgress(x.state,'cen').history.some(h=>h.id==='exploration'));assert.equal(x.state.explorations.length,1);
});
test('採購欠款仍正常交付與接客，沒有金錢軟鎖',()=>{
 const x=lab('materials');act(x,'order',{material:'鐵',quantity:100});assert.equal(x.state.coins,0);assert.equal(x.state.debt,400);next(x);assert.equal(x.state.materials.鐵,120);assert(current(x));assert.equal(x.state.debt,408);
});
for(const [key,npc] of [['growth-cen','cen'],['growth-he','he'],['growth-shu','shu']])test(`${key} 真實次月本人使用才完成，重複開店不重發`,()=>{
 const x=lab(key),p=W.characterProgress(x.state,npc),month=x.state.month;assert(!p.completed);act(x,'open');assert.equal(x.state.month,month+1);assert(W.characterProgress(x.state,npc).completed);const events=JSON.stringify({j:x.state.journey.events,p:x.state.personal.events});assert.throws(()=>act(x,'open'));assert.equal(JSON.stringify({j:x.state.journey.events,p:x.state.personal.events}),events);assert.equal(W.characterProgress(x.state,npc).ability,p.ability);
});
test('缺裝備的實際提示與正常補裝續玩，不靠換月冒造完成',()=>{
 const x=lab('growth-gap');assert.match(W.characterProgress(x.state,'he').hint,/木盾|耐久/);act(x,'open');assert(!W.characterProgress(x.state,'he').completed);at(x,'he');act(x,'accept-commission');let c=x.state.commissions.at(-1);assert.equal(c.recipe,'shield');next(x);at(x,'he');act(x,'deliver',{itemId:c.itemId});next(x);at(x,'he');act(x,'accept-commission');c=x.state.commissions.at(-1);assert.equal(c.recipe,'bracer');next(x);at(x,'he');act(x,'deliver',{itemId:c.itemId});next(x);assert(W.characterProgress(x.state,'he').completed);
});
test('營運逐卡閱覽保留工期；關店與過期閱覽不重結算；收入先抵債',()=>{
 const x=lab('operations'),start=x.state.month,ids=Object.values(x.state.items).filter(i=>i.createdMonth===start&&i.status==='crafting').map(i=>i.id);act(x,'open');assert.equal(x.state.coins,0);assert.equal(x.state.debt,4);assert(W.pendingReview(x.state));assert.equal(x.state.monthReview.entries[0].kind,'money');assert.throws(()=>act(x,'close'),/月結/);const action=x.action({type:'review-next',month:x.state.month,cursor:0});x.act(action);assert.equal(x.state.monthReview.entries[1].kind,'finished');assert.throws(()=>x.act(action));while(W.pendingReview(x.state))act(x,'review-next',{month:x.state.month,cursor:x.state.monthReview.cursor});const i=W.inventory(x.state).find(i=>W.suitable(x.state,i));assert(i);const cost=W.price(i);act(x,'deliver',{itemId:i.id});assert.equal(x.state.debt,0);assert.equal(x.state.coins,cost-4);act(x,'close');assert.equal(x.state.month,start+1);assert(ids.some(id=>x.state.items[id].status==='crafting'));act(x,'open');assert(ids.every(id=>x.state.items[id].status==='inventory'));
});

test('六入口的即時鍛造與月結情境各自保留資料，重置/返回不寫正式storage',async()=>{
 const raw=W.exportSave(W.initialState()),storage=new Map([[KEY,raw],[KEY+'-previous','backup']]),v=view({lab:true,storage,failGet:true,failSet:true,autoReview:false});assert.equal(v.buttons().filter(b=>b.dataset.scene).length,6);await v.click(v.buttons().find(b=>b.dataset.scene==='forge'));v.element('trial-q-0').value='2';await v.click(v.buttons().find(b=>b.dataset.trial==='forge'));assert.equal(v.trial.state.items.length,1);await v.clickTool('menu');await v.click(v.buttons().find(b=>b.dataset.scene==='materials'));await v.clickAction('explore');await v.clickTool('menu');await v.click(v.buttons().find(b=>b.dataset.scene==='forge'));assert.equal(v.trial.state.items.length,1);await v.clickTool('reset');assert.equal(v.trial.state.items.length,0);await v.clickTool('menu');await v.click(v.buttons().find(b=>b.dataset.scene==='operations'));await v.clickAction('open');assert.match(v.html(),/生活費 8 枚/);await v.clickAction('review-next');assert.match(v.html(),/木杖/);assert.equal(storage.get(KEY),raw);assert.equal(storage.get(KEY+'-previous'),'backup');
});
test('鍛造只顯示即時材料/武器/技能/估值，不混入月份與營運',async()=>{
 const v=view({lab:true,autoReview:false});await v.click(v.buttons().find(b=>b.dataset.scene==='forge'));assert.doesNotMatch(v.html(),/櫃臺|阿岑|小禾|望舒|生活費|欠款|鳥信|故事|等候|開店|關店/);assert.match(v.html(),/品質強化/);assert.match(v.html(),/交易強化/);assert.equal(v.buttons().filter(b=>b.dataset.trial==='forge').length,1);
});
test('所有真實專頁可渲染並走核心操作，特性提示只查閱不改狀態',async()=>{
 const v=view({lab:true,autoReview:false});for(const key of Object.keys(S)){await v.clickTool('menu').catch(()=>{});const b=v.buttons().find(b=>b.dataset.scene===key);if(b)await v.click(b);else{await v.click(v.buttons().find(b=>b.dataset.scene==='growth-cen'));await v.click(v.buttons().find(b=>b.dataset.scene===key));}assert.equal(v.lab.key,key);assert.doesNotMatch(v.notice(),/undefined|TypeError/);const trait=v.buttons().find(b=>b.dataset.trait);if(trait){const before=JSON.stringify(v.state());await v.click(trait);assert(!v.element('trait-tooltip').hidden);assert.equal(JSON.stringify(v.state()),before);v.emit('keydown',trait,{key:'Escape'});}}
});
test('營運月結轉場防連點仍保留；正式返回及版本資產正確',async()=>{
 let now=10;const v=view({lab:true,autoReview:false,now:()=>now});await v.click(v.buttons().find(b=>b.dataset.scene==='operations'));await v.clickEvent(v.button('open'),{detail:1});const before=JSON.stringify(v.state());await v.clickEvent(v.button('review-next'),{detail:1});assert.equal(JSON.stringify(v.state()),before);now=1000;await v.clickEvent(v.button('review-next'),{detail:1});assert.notEqual(JSON.stringify(v.state()),before);const html=fs.readFileSync(path.join(__dirname,'../lab.html'),'utf8');assert.match(html,/href="index.html">返回正式遊戲/);assert.match(html,/lang="zh-Hant"/);assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'../lab.js'),'utf8'),/localStorage|sessionStorage/);assert.equal((html.match(/\?v=0\.21/g)||[]).length,9);
});
