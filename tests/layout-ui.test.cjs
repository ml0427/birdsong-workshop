'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),W=require('../engine.js');
const {view}=require('./ui-harness.cjs'),{game,craft,intro,ready,next,at}=require('./helpers.cjs'),{personalRoute}=require('./personal-helpers.cjs');
// Structural checks run actual app.js. Browser geometry is accepted by the
// source conversation; these checks do not claim viewport measurements.
const scroll=v=>v.html().split('<div class="counter-scroll">')[1]?.split('</section></div>')[0]||'';
const fixed=v=>v.html().split('<div class="counter-actions"')[1]?.split('<div class="counter-tools">')[0]||'';
const summaries=v=>[...v.html().matchAll(/<details class="person-details"><summary>([\s\S]*?)<\/summary>/g)].map(m=>m[1]);
test('成交後長任務提示仍只有一個固定送客，敘事區沒有送客，可未採購離開',async()=>{
 const g=game();intro(g);const v=view({state:g.s});assert.match(fixed(v),/&quot;leave&quot;/);assert.doesNotMatch(scroll(v),/&quot;leave&quot;|&quot;decline&quot;/);assert.equal(v.buttons().filter(b=>b.action?.type==='leave').length,1);await v.clickAction('leave');assert.equal(W.activeVisit(v.state()),null);assert.doesNotMatch(v.html(),/class="counter-actions"/);assert.equal(v.state().tutorial.ordered,false);
});
test('有現貨時交易與婉拒都在固定列；選擇更新、特性不折疊、實售一致',async()=>{
 const g=game(),staff=craft(g,'staff'),sword=craft(g,'sword');next(g);const v=view({state:g.s});assert.match(fixed(v),/&quot;sell&quot;/);assert.match(fixed(v),/&quot;decline&quot;/);assert.doesNotMatch(scroll(v),/&quot;sell&quot;|&quot;decline&quot;/);assert(scroll(v).includes(W.traitDetails(['light'])));assert.doesNotMatch(scroll(v),/<details/);await v.change('recommend-item',sword.id,{visit:W.activeVisit(v.state()).id});assert.match(fixed(v),new RegExp('&quot;itemId&quot;:&quot;'+sword.id));assert(scroll(v).includes(W.traitDetails(['solid'])));await v.clickAction('sell',{itemId:sword.id});assert.equal(v.state().items[sword.id].owner,'cen');assert.equal(v.state().items[staff.id].status,'inventory');assert.match(fixed(v),new RegExp('&quot;itemId&quot;:&quot;'+staff.id));
});
test('接製作與本人交貨在固定列，背景與所有權規則不變，交貨後改送客',async()=>{
 const g=ready(),v=view({state:g.s});assert.match(fixed(v),/&quot;accept-commission&quot;/);assert.doesNotMatch(scroll(v),/&quot;accept-commission&quot;/);await v.clickAction('accept-commission');const c=v.state().commissions.at(-1);assert.match(fixed(v),/&quot;leave&quot;/);await v.clickAction('close');assert.doesNotMatch(v.html(),/class="counter-actions"/);await v.clickAction('open');while(W.activeVisit(v.state())?.npc!=='he'){const p=W.activeVisit(v.state());await v.clickAction(p.phase==='service'?'leave':'decline');}assert.match(fixed(v),/&quot;deliver&quot;/);assert.doesNotMatch(scroll(v),/&quot;deliver&quot;/);await v.clickAction('deliver');assert.equal(v.state().items[c.itemId].owner,'he');assert.match(fixed(v),/&quot;leave&quot;/);assert.doesNotMatch(fixed(v),/&quot;deliver&quot;/);
});
test('未閱月結、無客與關店不顯示錯誤固定交易列',async()=>{
 const v=view({raw:null,autoReview:false});assert.doesNotMatch(v.html(),/class="counter-actions"/);await v.clickAction('open');assert.doesNotMatch(v.html(),/class="counter-actions"/);await v.reviewAll();assert.match(fixed(v),/&quot;decline&quot;/);await v.clickAction('decline');assert.doesNotMatch(v.html(),/class="counter-actions"/);await v.clickAction('close');assert.doesNotMatch(v.html(),/class="counter-actions"/);
});
test('三人預設緊湊摘要先見姓名等級能力目標，共同規則只一次且詳細史可展開',async()=>{
 const r=personalRoute(),v=view({state:r.state});const before=v.raw();await v.clickTab('people');const summariesHTML=summaries(v);assert.equal(summariesHTML.length,3);for(const [n,s] of summariesHTML.entries()){const npc=W.knownPeople(r.state)[n],p=W.characterProgress(r.state,npc);assert(s.includes(W.PEOPLE[npc].name));assert(s.includes(`等級 ${p.level} · ${p.abilityName} ${p.ability}`));assert(s.includes(`目前目標：${p.goalTitle}`));assert.doesNotMatch(s,/已完成經歷|持有裝備|每種新的可靠/);}assert.doesNotMatch(v.html(),/<details class="(?:person-details|growth-rules)"[^>]*\bopen/);assert.equal((v.html().match(/每種新的可靠經歷增加1點能力/g)||[]).length,1);assert.match(v.html(),/person-content[\s\S]*已完成經歷/);assert.match(v.html(),/持有裝備[\s\S]*trait-effects/);for(const id of W.knownPeople(r.state))for(const i of W.owned(r.state,id))assert(v.html().includes(W.traitDetails(i)));assert.equal(v.raw(),before);
});
test('CSS把操作列排除敘事捲動、保留按鈕與字級，摘要只減留白',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');assert.match(css,/\.counter-scroll\{[^}]*min-height:0[^}]*flex:1[^}]*overflow:auto/);assert.match(css,/\.counter-actions\{[^}]*flex-shrink:0/);assert.match(css,/\.people-list \.person\{padding:6px 12px\}/);assert.match(css,/\.person-name\{font-size:18px/);assert.match(css,/\.person-goal\{[^}]*font-size:16px/);assert.doesNotMatch(css,/\.counter-actions[^}]*font-size:(?:1[0-3]|[0-9])px/);assert.match(css,/min-height:44px/);
});
