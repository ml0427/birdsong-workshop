'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js');
const {game,craft,intro,order,ready,next,depart,at,returnedStaff}=require('./helpers.cjs');
const {request,twoMonthCustomer}=require('./regression-helpers.cjs'),{play}=require('./campaign.cjs');
const scope=(g,a)=>({visitId:W.activeVisit(g.s)?.id,counterId:W.activeVisit(g.s)?.counterId,...a});
function rejected(g,a,re){const before=W.exportSave(g.s);assert.throws(()=>g.do(a),re);assert.equal(W.exportSave(g.s),before);}
test('普通拒單隔一月再提，不阻擋其他人採購；保留普通需求與 token 更新',()=>{
 const g=ready();g.npc({type:'decline'});at(g,'cen');const persistent=W.activeVisit(g.s).id,token=W.activeVisit(g.s).counterId;order(g,'銅',3,'other-person');next(g);assert.equal(g.s.materials.銅,5);assert.equal(W.activeVisit(g.s).id,persistent);assert.notEqual(W.activeVisit(g.s).counterId,token);assert(!g.s.visits.some(v=>v.month===3&&v.npc==='he'&&v.phase==='request'));while(W.activeVisit(g.s))depart(g);next(g);at(g,'he');assert.deepEqual(W.activeVisit(g.s).needs,['bracer']);assert.equal(g.s.content.declined.he.bracer,2);
});
test('普通缺料需求下採購，跨關店／重載／製作工期續接同需求，不提前敘述使用',()=>{
 const g=ready();g.npc({type:'talk'});const id=W.activeVisit(g.s).id;g.s.materials.銅=0;rejected(g,{type:'craft',recipe:'bracer'},/需要/);order(g,'銅',1);g.do({type:'close'});g.s=W.importSave(W.exportSave(g.s));next(g);assert.equal(W.activeVisit(g.s).id,id);assert.equal(W.activeVisit(g.s).asked,true);const i=craft(g,'bracer');next(g);assert.equal(W.activeVisit(g.s).id,id);g.npc({type:'sell',itemId:i.id});assert(!g.s.content.events.some(e=>e.key==='he-wrist'));next(g);assert(g.s.content.events.some(e=>e.key==='he-wrist'&&e.itemId===i.id));
});
test('健康在用裝備存在非購物回訪，不因每月自動添購',()=>{
 const {g,trace}=play(false,{turns:24,stopAtNine:false});assert.equal(g.s.content.events.length,9);assert(trace.social.some(v=>v.healthy&&/沒有|先繼續/.test(v.text)));const repeats=trace.requests.filter(v=>v.same&&v.kind!=='delivery');assert(repeats.length>0);for(const v of repeats)assert.match(v.reason,/替換|升級|磨損/);const emptyMonths=new Set(trace.social.filter(v=>v.npc==='he').map(v=>v.month));assert(emptyMonths.size>0);
});
test('金鈴自然信任委託只一次加價，後續普通金鈴按普通價',()=>{
 const {g,trace}=play(false,{turns:24,stopAtNine:false});const bells=trace.transactions.filter(t=>t.recipe==='bell'),special=bells.filter(t=>t.bonus),ordinary=bells.filter(t=>!t.bonus);assert.equal(special.length,1);assert(ordinary.length>0);assert.equal(special[0].amount,special[0].price+12);for(const t of ordinary)assert.equal(t.amount,t.price);assert(g.s.npcs.shu.goldDone);assert(g.s.npcs.shu.story);
});
test('贈還金鈴修復跨主再售沒有再次加價，使用新持有期且保留舊史',()=>{
 const {g}=play(false,{turns:24,stopAtNine:false});const ring=W.inventory(g.s).find(i=>i.recipe==='bell'&&i.returned&&!i.repaired);assert(ring);g.do({type:'repair',itemId:ring.id});const prior=g.s.items[ring.id].history.slice(),original=g.s.returns.find(o=>o.itemId===ring.id).npc,buyer=original==='shu'?'he':'shu';request(g,buyer,'bell');const net=g.s.coins-g.s.debt;g.npc({type:'sell',itemId:ring.id});assert.equal(g.s.coins-g.s.debt-net,W.price(ring));next(g);assert.equal(g.s.items[ring.id].episodes.at(-1).uses,1);assert.equal(g.s.items[ring.id].owner,buyer);assert.deepEqual(g.s.items[ring.id].history.slice(0,prior.length),prior);assert.equal(g.s.returns.filter(o=>o.itemId===ring.id).length,1);
});
test('最高品質傳承仍減磨耗，兩件同價，來源永久消耗且只移交一次',()=>{
 const {g,item}=returnedStaff();g.s.xp.craft=9;g.do({type:'smelt',itemId:item.id});const inherited=craft(g,'staff'),plain=craft(g,'staff');assert.equal(inherited.quality,2);assert.equal(plain.quality,2);assert.equal(W.price(inherited),W.price(plain));assert.deepEqual(inherited.traits,['light','solid']);assert.equal(plain.legacy,null);assert(W.useResult(inherited).wear<W.useResult(plain).wear);next(g);assert.equal(g.s.items[item.id].status,'smelted');assert.equal(g.s.legacies[0].usedBy,inherited.id);
});
test('傳承庫存讓自然新需求指定特性，普通同類被拒絕，符合者可出售',()=>{
 const {g,item}=returnedStaff();g.s.xp.craft=9;g.do({type:'smelt',itemId:item.id});const inherited=craft(g,'staff'),plain=craft(g,'staff');while(W.activeVisit(g.s))depart(g);next(g);at(g,'cen');const v=W.activeVisit(g.s);assert.deepEqual(v.needs,['staff']);assert.equal(v.traitRequired,'solid');assert.match(W.requestDetail(v),/堅固/);assert(W.suitable(g.s,g.s.items[inherited.id],v));assert.match(W.recommendationReason(g.s,g.s.items[plain.id],v),/堅固.*沒有/);rejected(g,scope(g,{type:'sell',itemId:plain.id}),/不符合需求/);g.npc({type:'sell',itemId:inherited.id});assert.equal(g.s.items[inherited.id].owner,'cen');
});
test('用途／品質／特性／磨損／原退役者拒絕理由分開，錯售不改狀態',()=>{
 const {g,item}=returnedStaff();const base={...W.activeVisit(g.s),phase:'request',needs:['staff'],npc:'shu',minQuality:0,traitRequired:null};assert.match(W.recommendationReason(g.s,item,base),/耐久.*修復/);g.do({type:'repair',itemId:item.id});const i=g.s.items[item.id];assert.match(W.recommendationReason(g.s,i,{...base,npc:'cen'}),/已退役.*不再買回/);assert.match(W.recommendationReason(g.s,i,{...base,needs:['sword']}),/鐵劍.*用途不同/);assert.match(W.recommendationReason(g.s,i,{...base,minQuality:1}),/細緻.*樸實/);assert.match(W.recommendationReason(g.s,i,{...base,traitRequired:'solid'}),/堅固.*沒有/);request(g,'shu','staff',{minQuality:1});rejected(g,scope(g,{type:'sell',itemId:i.id}),/品質|細緻/);
});
test('最高品質輕巧效能與堅固／護身仍有實際差異，普通價格不因特性變',()=>{
 const i={recipe:'shield',quality:2,traits:['solid'],durability:9};assert(W.performance({...i,traits:['solid','light']})>W.performance(i));assert.notEqual(W.useResult(i).text,W.useResult({...i,traits:['solid','light']}).text);const guard={...i,quality:0,traits:['solid','guard']};assert(W.useResult(guard).strong);assert(!W.useResult({...guard,traits:['solid']}).strong);assert.equal(W.price(i),W.price({...i,traits:['solid','light']}));
});
test('周轉補料與無消息互斥，待兩月製作中不提早補料',()=>{
 const g=ready();for(const m of W.MATERIALS)g.s.materials[m]=0;next(g);assert.equal(g.s.materials.木頭,1);assert.equal(g.s.materials.鐵,1);assert(g.s.news.some(n=>n.id===`relief-${g.s.month}`));assert(!g.s.news.some(n=>n.month===g.s.month&&n.text==='本月沒有新消息。'));const h=twoMonthCustomer();for(const m of W.MATERIALS)h.s.materials[m]=0;next(h);assert.equal(h.s.commissions[0].status,'crafting');assert(!h.s.news.some(n=>n.id===`relief-${h.s.month}`));
});
test('普通後續磨耗只留歷史而少報鳥信，最後無消息不是每月無條件追加',()=>{
 const g=ready();g.npc({type:'talk'});const i=craft(g,'bracer');next(g);g.npc({type:'sell',itemId:i.id});next(g);assert(g.s.news.some(n=>n.id===`use-${i.id}-1-4`));const history=g.s.items[i.id].history.length;next(g);assert.equal(g.s.items[i.id].history.length,history+1);assert(!g.s.news.some(n=>n.id===`use-${i.id}-1-5`));const {g:h}=play(false,{turns:24,stopAtNine:false});for(let n=0;n<10;n++)next(h);const letters=h.s.news.filter(n=>n.month===h.s.month);assert.equal(letters.length,1);assert.equal(letters[0].text,'本月沒有新消息。');
});
test('兩月委託：離場、關店、重載與快速重複操作不變工期或重扣料',()=>{
 const g=twoMonthCustomer(),c=g.s.commissions[0],i=g.s.items[c.itemId],due=i.dueMonth,material=g.s.materials.銀;g.npc({type:'leave'});rejected(g,{type:'cancel-commission',commissionId:c.id},/不在櫃臺/);rejected(g,{type:'craft',commissionId:c.id},/已開始/);g.do({type:'close'});g.s=W.importSave(W.exportSave(g.s));assert.equal(g.s.items[i.id].dueMonth,due);assert.equal(g.s.materials.銀,material);const rev=g.s.revision;g.do({type:'open',expectedRevision:rev});rejected(g,{type:'open',expectedRevision:rev},/已處理/);assert.equal(g.s.items[i.id].status,'crafting');g.do({type:'close'});assert.equal(g.s.items[i.id].status,'crafting');g.s=W.importSave(W.exportSave(g.s));next(g);assert.equal(g.s.items[i.id].status,'inventory');assert.equal(g.s.items[i.id].finishedMonth,due);assert.equal(g.s.xp.craft,5);assert.equal(g.s.items[i.id].episodes.length,0);
});
test('兩月成品取貨延期再重載，錯人／關店交付拒絕，本人交付一次才收款',()=>{
 const g=twoMonthCustomer(),c=g.s.commissions[0],id=c.itemId;next(g);next(g);at(g,'shu');const stale=scope(g,{type:'deliver',itemId:id});g.npc({type:'decline'});rejected(g,stale,/不在櫃臺/);next(g);at(g,'shu');assert.equal(W.activeVisit(g.s).kind,'delivery');assert.equal(g.s.items[id].episodes.length,0);g.do({type:'close'});g.s=W.importSave(W.exportSave(g.s));rejected(g,stale,/不在櫃臺/);next(g);at(g,'shu');const net=g.s.coins-g.s.debt;g.npc({type:'deliver',itemId:id});assert.equal(g.s.coins-g.s.debt-net,W.price(g.s.items[id]));assert.equal(g.s.items[id].episodes[0].uses,0);rejected(g,scope(g,{type:'deliver',itemId:id}),/不是目前/);next(g);assert.equal(g.s.items[id].episodes[0].uses,1);
});
test('待開工指定特性不足不扣材料，可當面取消；不是本人不可取消',()=>{
 const g=ready();request(g,'he','bracer',{traitRequired:'solid'});g.npc({type:'accept-commission',requestId:'specific-trait'});const c=g.s.commissions[0],materials=g.s.materials.銅;assert.equal(c.status,'accepted');rejected(g,{type:'craft',commissionId:c.id},/未達/);assert.equal(g.s.materials.銅,materials);const stale=scope(g,{type:'cancel-commission',commissionId:c.id});g.npc({type:'leave'});rejected(g,stale,/不在櫃臺/);next(g);at(g,'he');g.npc({type:'cancel-commission',commissionId:c.id});assert.equal(g.s.commissions[0].status,'cancelled');assert.equal(g.s.materials.銅,materials);order(g,'銅',2,'after-cancel');
});
test('採購未交付預留量也防溢位，拒絕不動款項／訂單／舊物',()=>{
 const {g,item}=returnedStaff();g.s.materials.木頭=Number.MAX_SAFE_INTEGER-1;order(g,'木頭',1,'reserve');rejected(g,scope(g,{type:'order',material:'木頭',quantity:1,requestId:'overflow'}),/未完成委託/);rejected(g,{type:'smelt',itemId:item.id},/安全整數/);assert.equal(g.s.items[item.id].status,'inventory');assert.equal(g.s.orders.length,1);assert.equal(g.s.orders[0].quantity,1);
});
