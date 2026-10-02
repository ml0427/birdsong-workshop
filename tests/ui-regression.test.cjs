'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js'),{view,KEY}=require('./ui-harness.cjs');
const {game,craft,intro,order,explore,ready,next,at,returnedStaff}=require('./helpers.cjs'),{request,twoMonthCustomer}=require('./regression-helpers.cjs');
const text=s=>s.replace(/<[^>]*>/g,'');
test('未知內容在保存規則也隱藏；教學明示開始、工期與完工後交易',async()=>{
 const v=view({raw:null});assert.doesNotMatch(text(v.html()),/銅|銀|金鈴|護腕|護符/);await v.clickTab('settings');assert.doesNotMatch(text(v.html()),/銅|銀|金鈴|護腕|護符/);assert.match(text(v.html()),/基本作品 1 個月、複雜作品 2 個月/);await v.clickTab('craft');assert.match(text(v.html()),/開始木杖.*下次開店完工/);await v.clickAction('craft',{recipe:'staff'});assert.match(text(v.html()),/製作中.*尚需 1 個月/);
});
test('鑑定前藏完整數值，對話學配方，鑑定後顯示品質／階級／效能／耐久且一次',async()=>{
 const g=ready();g.npc({type:'talk'});const i=craft(g,'bracer');next(g);const v=view({state:g.s});await v.clickTab('inventory');assert.doesNotMatch(text(v.html().match(/<article class="item">[\s\S]*?<\/article>/)[0]),/第 3 階|效能 6|耐久 9／9|樸實/);await v.clickAction('appraise',{itemId:i.id});assert.match(text(v.html()),/銅第 3 階.*效能 6.*耐久 9／9/);assert.match(text(v.html()),/樸實/);const xp=v.state().xp.appraisal;assert(v.button('appraise',{itemId:i.id}).disabled);await v.clickAction('appraise',{itemId:i.id});assert.equal(v.state().xp.appraisal,xp);
});
test('同名同價作品推薦用件序／特性／耐久／來源辨識，切換保持當前 visit',async()=>{
 const g=ready();g.npc({type:'talk'});next(g);at(g,'cen');g.npc({type:'reclaim',itemId:'item-1'});const item=g.s.items['item-1'];g.s.xp.craft=9;g.do({type:'smelt',itemId:item.id});const a=craft(g,'staff'),b=craft(g,'staff');next(g);request(g,'shu','staff');const visit=W.activeVisit(g.s);const v=view({state:g.s});assert.match(v.html(),/輕巧、堅固/);assert.match(v.html(),/傳承自木杖/);assert.match(v.html(),/第 1 件/);assert.match(v.html(),/第 2 件/);assert.equal(W.price(g.s.items[a.id]),W.price(g.s.items[b.id]));assert.match(v.html(),new RegExp('data-visit="'+visit.id+'"'));v.change('recommend-item',b.id,{visit:visit.id});assert.equal(v.button('sell').action.itemId,b.id);await v.clickAction('sell');assert.equal(v.state().items[b.id].owner,'shu');assert.equal(v.state().items[a.id].status,'inventory');
});
test('長庫存及收藏能往返分頁，不一次輸出全部，最後一頁物品與歷史可達',async()=>{
 const {g}=returnedStaff();order(g,'木頭',12);next(g);for(let n=0;n<12;n++)craft(g,'staff');next(g);const v=view({state:g.s});await v.clickTab('inventory');const count=()=>((v.html().match(/class="item"/g)||[]).length);assert.equal(count(),6);assert.match(v.html(),/第 1／3 頁/);await v.click(v.buttons().find(b=>b.dataset.page==='inventory'&&b.dataset.number==='2'));assert.equal(count(),6);await v.click(v.buttons().find(b=>b.dataset.page==='inventory'&&b.dataset.number==='3'));assert.equal(count(),1);await v.click(v.buttons().find(b=>b.dataset.page==='inventory'&&b.dataset.number==='2'));assert.equal(count(),6);await v.clickTab('collection');assert.equal(count(),4);assert.match(v.html(),/第 1／4 頁/);for(const n of ['2','3','4'])await v.click(v.buttons().find(b=>b.dataset.page==='collection'&&b.dataset.number===n));assert.equal(count(),2);assert.match(v.html(),/item-1/);assert.match(text(v.html()),/物品故事/);
});
test('原退役者拒絕在作品卡說明，鳥信只有通知，本人櫃臺才有贈還按鈕',async()=>{
 const g=ready();next(g);let v=view({state:g.s});await v.clickTab('mail');assert.doesNotMatch(v.html().split('id="panel"')[1],/data-action="[^"]+reclaim/);at(g,'cen');v=view({state:g.s});assert(v.button('reclaim',{itemId:'item-1'}));await v.clickAction('reclaim',{itemId:'item-1'});await v.clickTab('inventory');await v.clickAction('repair',{itemId:'item-1'});assert.match(text(v.html()),/阿岑已退役並贈還.*不再買回/);assert(!v.buttons().some(b=>b.action?.type==='sell'&&b.action.itemId==='item-1'));
});
test('主存檔損壞復原上一筆，下一操作重建主檔，工期與先前備份保留',async()=>{
 const g=game();craft(g,'staff');const backup=W.exportSave(g.s);const v=view({raw:'{bad',previous:backup,autoReview:false});assert.match(v.notice(),/上一筆自動備份/);assert.match(text(v.html()),/製作中/);assert.equal(v.raw(),'{bad');await v.clickAction('open');assert.equal(v.state().month,1);assert.equal(v.state().items['item-1'].status,'inventory');assert.equal(v.storage.get(KEY+'-previous'),backup);await v.reviewAll();assert.equal(v.state().items['item-1'].status,'inventory');
});
test('沒有可用備份的壞檔不被操作覆蓋，可取消重新開始保留原始檔',async()=>{
 const v=view({raw:'{bad'});assert.match(v.notice(),/既有存檔無法讀取/);await v.clickAction('craft',{recipe:'staff'});assert.equal(v.raw(),'{bad');await v.clickTab('settings');const p=v.clickTool('new');await v.idle();assert(v.element('confirm-dialog').open);await v.answer(false);await p;assert.equal(v.raw(),'{bad');
});
test('備份匯出用真正 Blob，檔名與 JSON 完整可讀，不改進度',async()=>{
 const g=twoMonthCustomer(),v=view({state:g.s}),before=v.raw();await v.clickTab('settings');await v.clickTool('export');assert.equal(v.downloads.length,1);assert.equal(v.downloads[0].name,`鳥信工坊-第${g.s.month}月.json`);const exported=await v.downloads[0].blob.text();assert.deepEqual(W.importSave(exported),g.s);assert.equal(v.raw(),before);
});
test('有效匯入先預覽確認，取消不動主檔／備份；確認保留兩月委託及工期',async()=>{
 const imported=twoMonthCustomer().s,v=view(),before=v.raw(),previous=v.storage.get(KEY+'-previous');const pending=v.importRaw(W.exportSave(imported));await v.idle();assert(v.element('confirm-dialog').open);assert.equal(v.raw(),before);await v.answer(false);await pending;assert.equal(v.raw(),before);assert.equal(v.storage.get(KEY+'-previous'),previous);const p=v.importRaw(W.exportSave(imported));await v.idle();await v.answer(true);await p;assert.deepEqual(v.state(),imported);assert.equal(v.storage.get(KEY+'-previous'),before);assert.match(v.notice(),/備份已匯入/);
});
test('壞 JSON／偽造引用／超過上限匯入均拒絕且不覆蓋，不開確認框',async()=>{
 const v=view({state:twoMonthCustomer().s}),before=v.raw();await v.importRaw('{bad');assert.match(v.notice(),/匯入失敗/);assert.equal(v.raw(),before);const forged=JSON.parse(before);forged.state.items[forged.state.commissions[0].itemId].reservedFor='missing';await v.importRaw(JSON.stringify(forged));assert.match(v.notice(),/存檔/);assert.equal(v.raw(),before);let read=false;await v.importFile({size:8*1024*1024+1,async text(){read=true;return before;}});assert.equal(read,false);assert.match(v.notice(),/超過 8 MB/);assert.equal(v.raw(),before);assert.equal(v.element('confirm-dialog').open,false);
});
test('透過實際匯入事件遷移 schema1，確認前不動資料，完成後能續玩',async()=>{
 const Old=require('./fixtures/engine-v1.cjs');let old=Old.initialState();old=Old.dispatch(old,{type:'craft',recipe:'staff'}).state;old=Old.dispatch(old,{type:'open'}).state;const raw=Old.exportSave(old),expected=W.importSave(raw),v=view(),before=v.raw();const p=v.importRaw(raw);await v.idle();assert.equal(v.raw(),before);await v.answer(true);await p;assert.deepEqual(v.state(),expected);await v.clickAction('close');await v.clickAction('craft',{recipe:'sword'});assert.equal(Object.values(v.state().items).at(-1).status,'crafting');
});
test('雙視窗外部更新時舊畫面操作同步並拒絕；storage 事件更新與壞事件保留畫面',async()=>{
 const v=view(),stale=v.button('open');const external=W.dispatch(W.initialState(),{type:'craft',recipe:'staff'}).state;const raw=W.exportSave(external);v.storage.set(KEY,raw);await v.click(stale);assert.match(v.notice(),/另一個視窗已更新/);assert.deepEqual(v.state(),external);const nextState=W.dispatch(external,{type:'open'}).state;v.storageEvent(W.exportSave(nextState));assert.deepEqual(v.state(),nextState);assert.match(text(v.html()),/第 1 月/);const shown=v.html();v.storageEvent('{bad');assert.equal(v.html(),shown);assert.match(v.notice(),/無法讀取/);
});
test('保存失敗或無法使用 localStorage 仍可遊玩與匯出，明示失敗不假稱已保存',async()=>{
 const v=view({raw:null,failSet:true});await v.clickAction('craft',{recipe:'staff'});assert.equal(v.raw(),undefined);assert.match(v.element('save-status').textContent,/本機保存失敗/);await v.clickTab('settings');await v.clickTool('export');assert.equal(W.importSave(await v.downloads[0].blob.text()).items['item-1'].status,'crafting');const denied=view({failGet:true});assert.match(denied.notice(),/無法使用本機保存/);await denied.clickAction('craft',{recipe:'staff'});await denied.clickTab('settings');await denied.clickTool('export');assert.equal(W.importSave(await denied.downloads[0].blob.text()).month,0);
});
test('兩月委託實際 UI：同按鈕雙點／過期複製不重扣，關店重載不變工期',async()=>{
 const g=twoMonthCustomer(),v=view({state:g.s});const close=v.button('close');await v.click(close);const open=v.button('open'),oldCopy={dataset:{...open.dataset},disabled:false};await v.click(open);const saved=v.raw();await v.click(open);await v.click(oldCopy);assert.equal(v.raw(),saved);assert.match(v.notice(),/已處理/);assert.equal(v.state().commissions[0].status,'crafting');await v.clickAction('close');const reload=view({raw:v.raw(),previous:v.storage.get(KEY+'-previous')});assert.equal(reload.state().items[g.s.commissions[0].itemId].dueMonth,g.s.items[g.s.commissions[0].itemId].dueMonth);await reload.clickAction('open');assert.equal(reload.state().commissions[0].status,'ready');assert.equal(reload.state().items[g.s.commissions[0].itemId].episodes.length,0);
});
test('待開工取消 UI 確實釋放人物任務，開始後取消不可用',async()=>{
 const g=ready();g.s.materials.銅=0;g.npc({type:'accept-commission',requestId:'waiting'});const v=view({state:g.s}),cancel=v.button('cancel-commission');await v.click(cancel);const raw=v.raw();await v.click({dataset:{...cancel.dataset},disabled:false});assert.equal(v.raw(),raw);assert.equal(v.state().commissions[0].status,'cancelled');await v.clickTab('purchase');assert.equal(v.button('order-form').disabled,false);const h=twoMonthCustomer(),other=view({state:h.s});assert(!other.buttons().some(b=>b.action?.type==='cancel-commission'));
});
test('熔鍊確認可取消且不扣料／傳承，確認才消耗；重新開始確認亦可取消',async()=>{
 const {g,item}=returnedStaff(),v=view({state:g.s});await v.clickTab('inventory');const before=v.raw();const p=v.clickAction('smelt',{itemId:item.id});await v.idle();await v.answer(false);await p;assert.equal(v.raw(),before);const q=v.clickAction('smelt',{itemId:item.id});await v.idle();await v.answer(true);await q;assert.equal(v.state().items[item.id].status,'smelted');await v.clickTab('settings');const raw=v.raw(),n=v.clickTool('new');await v.idle();await v.answer(false);await n;assert.equal(v.raw(),raw);const m=v.clickTool('new');await v.idle();await v.answer(true);await m;assert.deepEqual(v.state(),W.initialState());
});
