'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('../engine.js');
const {view}=require('./ui-harness.cjs'),{play}=require('./campaign.cjs');
let cached;
function workshop(){
 if(!cached){const {trace}=play(false,{capture:true,stopAtNine:false,turns:16});for(const s of trace.snapshots.slice().reverse()){if(!s.open||s.materials.銀<1||!W.visibleRecipes(s).includes('amulet'))continue;const upcoming=W.dispatch(W.dispatch(s,{type:'close'}).state,{type:'open'}).state;if(upcoming.monthReview.entries.length===1&&!upcoming.returns.some(o=>o.status==='offered')){cached=W.exportSave(s);break;}}assert(cached,'real empty month with silver recipe');}
 return W.importSave(cached);
}
async function emptyReview(){let time=0;const v=view({state:workshop(),autoReview:false,now:()=>time});await v.clickAction('close');await v.clickAction('open');assert.equal(v.state().monthReview.entries.length,1);return {v,month:v.state().month,setTime:t=>{time=t;}};}
test('月結最後一頁真事件重定向：第二下命中新銀護符按鈕不耗銀，之後單擊可用',async()=>{
 const {v,setTime,month}=await emptyReview();setTime(100);await v.clickEvent(v.button('review-next'),{detail:1,pointerType:'mouse'});const before=v.raw(),silver=v.state().materials.銀,items=Object.keys(v.state().items).length;setTime(160);const fresh=v.button('craft',{recipe:'amulet'});assert.equal(fresh.action.expectedRevision,v.state().revision);await v.clickEvent(fresh,{detail:2,pointerType:'mouse'});assert.equal(v.raw(),before);assert.equal(v.state().materials.銀,silver);assert.equal(Object.keys(v.state().items).length,items);assert(!v.button('craft',{recipe:'amulet'}).disabled);setTime(900);await v.clickEvent(v.button('craft',{recipe:'amulet'}),{detail:1,pointerType:'mouse'});assert.equal(v.state().materials.銀,silver-1);assert.equal(Object.values(v.state().items).at(-1).recipe,'amulet');assert.equal(v.state().month,month);
});
test('多張報告真正重新渲染的第二下不跳卡；下一次單擊才展示第二件',async()=>{
 let time=0;const v=view({raw:null,autoReview:false,now:()=>time});for(const recipe of ['sword','staff'])await v.clickAction('craft',{recipe});await v.clickAction('open');time=100;await v.clickEvent(v.button('review-next'),{detail:1,pointerType:'mouse'});assert.equal(v.state().monthReview.cursor,1);assert.match(v.html(),/鐵劍 · 樸實/);const before=v.raw();time=180;await v.clickEvent(v.button('review-next'),{detail:2,pointerType:'mouse'});assert.equal(v.raw(),before);assert.equal(v.state().monthReview.cursor,1);assert.match(v.html(),/鐵劍 · 樸實/);time=900;await v.clickEvent(v.button('review-next'),{detail:1,pointerType:'mouse'});assert.equal(v.state().monthReview.cursor,2);assert.match(v.html(),/木杖 · 樸實/);assert.equal(v.state().coins,12);assert.equal(v.state().xp.craft,2);
});
test('新DOM把第二下detail重置為一也攔截：不能僅依賴dblclick計數',async()=>{
 const {v,setTime}=await emptyReview();await v.clickEvent(v.button('review-next'),{detail:1,pointerType:'mouse'});const before=v.raw();setTime(80);await v.clickEvent(v.button('craft',{recipe:'amulet'}),{detail:1,pointerType:'mouse'});assert.equal(v.raw(),before);setTime(800);await v.clickEvent(v.button('craft',{recipe:'amulet'}),{detail:1,pointerType:'mouse'});assert.notEqual(v.raw(),before);
});
test('較慢的雙擊計數仍攔截，停止連點後正常指標操作恢復',async()=>{
 const {v,setTime}=await emptyReview();await v.clickEvent(v.button('review-next'),{detail:1,pointerType:'mouse'});const before=v.raw();setTime(1000);await v.clickEvent(v.button('craft',{recipe:'amulet'}),{detail:2,pointerType:'mouse'});assert.equal(v.raw(),before);setTime(1700);await v.clickEvent(v.button('craft',{recipe:'amulet'}),{detail:1,pointerType:'mouse'});assert.notEqual(v.raw(),before);
});
test('鍵盤／程式單次操作不被指標防護鎖住，也不增加月份',async()=>{
 const {v,month}=await emptyReview();await v.clickEvent(v.button('review-next'),{detail:1,pointerType:'mouse'});const silver=v.state().materials.銀;await v.clickEvent(v.button('craft',{recipe:'amulet'}),{detail:0});assert.equal(v.state().materials.銀,silver-1);assert.equal(v.state().month,month);
});
test('觸控detail零但有pointerType仍防穿透，停下後可正常製作',async()=>{
 const {v,setTime}=await emptyReview();await v.clickEvent(v.button('review-next'),{detail:0,pointerType:'touch'});const before=v.raw();setTime(100);await v.clickEvent(v.button('craft',{recipe:'amulet'}),{detail:0,pointerType:'touch'});assert.equal(v.raw(),before);setTime(800);await v.clickEvent(v.button('craft',{recipe:'amulet'}),{detail:0,pointerType:'touch'});assert.notEqual(v.raw(),before);
});
test('指標雙擊開店也不能穿入新月結下一筆，首張收支仍待閱',async()=>{
 let time=0;const v=view({raw:null,autoReview:false,now:()=>time});for(const recipe of ['sword','staff'])await v.clickAction('craft',{recipe});await v.clickEvent(v.button('open'),{detail:1,pointerType:'mouse'});const before=v.raw();time=100;await v.clickEvent(v.button('review-next'),{detail:2,pointerType:'mouse'});assert.equal(v.raw(),before);assert.equal(v.state().monthReview.cursor,0);assert.equal(v.state().month,1);assert.equal(v.state().coins,12);time=900;await v.clickEvent(v.button('review-next'),{detail:1,pointerType:'mouse'});assert.equal(v.state().monthReview.cursor,1);assert.match(v.html(),/鐵劍 · 樸實/);
});
