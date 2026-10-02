'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),W=require('../engine.js'),Tips=require('../trait-tips.js');
const {view}=require('./ui-harness.cjs'),{game,craft,intro}=require('./helpers.cjs');
const text=(v,key)=>assert.equal(v.element('trait-tooltip').textContent,`${W.TRAITS[key].name}：${W.TRAITS[key].text}`);
test('名稱預設沒有效果，點擊固定、再點關閉，外部非按鈕點擊也關閉且不寫存檔',async()=>{
 const v=view({raw:null}),b=v.trait('light'),raw=v.raw();assert(v.element('trait-tooltip').hidden);assert(!v.html().includes(W.TRAITS.light.text));assert.match(v.html(),/aria-describedby="trait-help-light"/);await v.click(b);assert(!v.element('trait-tooltip').hidden);text(v,'light');await v.click(b);assert(v.element('trait-tooltip').hidden);await v.click(b);v.emit('click',v.element('panel'));assert(v.element('trait-tooltip').hidden);assert.equal(v.raw(),raw);
});
test('懸停可移入提示閱讀，離開收起；點擊固定後離開保留，換名稱只一個',async()=>{
 const v=view({raw:null}),b=v.trait('light'),c=v.trait('solid'),tip=v.element('trait-tooltip');v.emit('pointerover',b);text(v,'light');v.emit('pointerout',b,{relatedTarget:tip});assert(!tip.hidden);v.emit('pointerover',tip);v.emit('pointerout',tip,{relatedTarget:null});assert(tip.hidden);v.emit('pointerover',b);await v.click(b);v.emit('pointerout',b,{relatedTarget:null});assert(!tip.hidden);v.emit('pointerover',c);text(v,'solid');assert.equal(b.attributes['aria-expanded'],'false');assert.equal(c.attributes['aria-expanded'],'true');v.emit('pointerout',c,{relatedTarget:null});assert(tip.hidden);
});
test('focus／Enter／Escape／失焦可用，按住Enter不多次切換，說明由共用數值生成',()=>{
 const v=view({raw:null}),b=v.trait('solid');v.emit('focusin',b);text(v,'solid');assert(v.emit('keydown',b,{key:'Enter'}));v.emit('focusout',b);assert(!v.element('trait-tooltip').hidden);v.emit('keydown',b,{key:'Enter',repeat:true});assert(!v.element('trait-tooltip').hidden);v.emit('keydown',b,{key:'Enter'});assert(v.element('trait-tooltip').hidden);v.emit('keydown',b,{key:'Enter'});assert(!v.element('trait-tooltip').hidden);assert(v.emit('keydown',b,{key:'Escape'}));assert(v.element('trait-tooltip').hidden);v.emit('focusin',b);v.emit('focusout',b);assert(v.element('trait-tooltip').hidden);assert(v.element('trait-descriptions').innerHTML.includes(W.TRAITS.solid.text));
});
test('介面重繪、外部捲動、resize、人物收合與視覺viewport移動都收起；提示自捲不收',async()=>{
 const v=view({raw:null,viewport:{width:500,height:420,offsetLeft:90,offsetTop:60}}),b=v.trait('light');for(const name of ['scroll','toggle']){await v.click(b);v.emit(name,v.element('panel'));assert(v.element('trait-tooltip').hidden);}await v.click(b);v.emit('scroll',v.element('trait-tooltip'));assert(!v.element('trait-tooltip').hidden);v.windowEvent('resize');assert(v.element('trait-tooltip').hidden);await v.click(b);v.viewportEvent('scroll');assert(v.element('trait-tooltip').hidden);await v.click(b);await v.clickTab('inventory');assert(v.element('trait-tooltip').hidden);
});
test('月結提示不推月、不翻卡、不鑑定；原本正常下一筆仍可用',async()=>{
 const g=game();craft(g,'staff');const v=view({state:g.s,autoReview:false});await v.clickAction('open');await v.clickAction('review-next');const raw=v.raw(),b=v.trait('light');await v.click(b);text(v,'light');v.emit('keydown',b,{key:'Escape'});assert.equal(v.raw(),raw);assert.equal(v.state().monthReview.cursor,1);assert.equal(v.state().xp.appraisal,0);await v.clickAction('review-next');assert(v.element('trait-tooltip').hidden);assert(!W.pendingReview(v.state()));
});
test('提示外部交易按鈕照常成交／送客，沒有攔截或改變引擎流程',async()=>{
 const g=game();intro(g);const v=view({state:g.s});await v.clickTab('craft');await v.click(v.trait('light'));await v.clickAction('leave');assert.equal(W.activeVisit(v.state()),null);assert(v.element('trait-tooltip').hidden);assert.equal(v.state().tutorial.ordered,false);
});
test('定位在四角、小視窗與視覺viewport內，避開固定控制；空間不足會限制尺寸',()=>{
 const viewport={left:0,top:0,width:1180,height:760},footer={left:16,right:356,top:590,bottom:704};for(const anchor of [{left:20,right:70,top:10,bottom:34},{left:1110,right:1160,top:710,bottom:734},{left:20,right:70,top:580,bottom:604}]){const p=Tips.place(anchor,{width:320,height:112},viewport,footer);assert(p);assert(p.x>=8&&p.y>=8&&p.x+p.width<=1172&&p.y+p.height<=752);assert(!(p.x<footer.right&&p.x+p.width>footer.left&&p.y<footer.bottom&&p.y+p.height>footer.top));}
 const p=Tips.place({left:110,right:150,top:200,bottom:224},{width:320,height:300},{left:90,top:60,width:220,height:180},{left:90,right:310,top:150,bottom:240});assert(p);assert(p.x>=98&&p.x+p.width<=302);assert(p.y+p.height<=142);assert(p.height<300);assert.equal(Tips.place({left:20,right:30,top:40,bottom:50},{width:200,height:100},{width:200,height:120},{left:0,right:200,top:0,bottom:120}),null);
});
test('真正controller在窄viewport避開底部按鈕，不受app捲動容器裁切',async()=>{
 const g=game();intro(g);const v=view({state:g.s,width:360,height:480,anchorRect:{left:40,top:350,width:50,height:24},counterRect:{left:0,top:360,width:360,height:120},tooltipRect:{width:320,height:180}});await v.clickTab('craft');await v.click(v.trait('solid'));const tip=v.element('trait-tooltip'),r=tip.getBoundingClientRect();assert(!tip.hidden);assert(r.bottom<=352);assert(r.left>=8&&r.right<=352);const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert(html.indexOf('id="trait-tooltip"')>html.indexOf('</main>'));assert.match(html,/id="trait-descriptions" hidden/);assert.match(fs.readFileSync(path.join(__dirname,'../style.css'),'utf8'),/\.trait-tooltip\{position:fixed/);
});
