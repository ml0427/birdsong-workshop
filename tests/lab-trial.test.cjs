'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('../lab-trial.js'),W=require('../engine.js'),{view,KEY}=require('./ui-harness.cjs');
const inputs=[[3,0,0,0,0],[1,3,0,0,0],[3,2,1,0,0],[2,0,0,2,1]],weapons=['staff','sword','spear','focus'];
const mixture=q=>Object.fromEntries(W.MATERIALS.map((m,n)=>[m,q[n]||0]));
function rng(){let queue=[];return {set(xs){queue=xs.slice();},draw(){return queue.shift()??0;}};}
const forge=(x,q)=>x.forge(mixture(q),x.state.revision);
function trained(level,branch='quality',random=()=>0){const x=T.create({random});for(let i=0;i<level*3;i++)forge(x,[2]);for(let i=0;i<level;i++)x.allocate(branch,x.state.revision);return x;}
async function free(options={}){const v=view({lab:true,autoReview:false,...options});await v.click(v.buttons().find(b=>b.dataset.scene==='forge'));return v;}
function fill(v,q){W.MATERIALS.forEach((m,n)=>{v.element('trial-q-'+n).value=String(q[n]||0);});}
const make=v=>v.click(v.buttons().find(b=>b.dataset.trial==='forge'));
const skill=(v,branch)=>v.click(v.buttons().find(b=>b.dataset.trial==='skill'&&b.dataset.branch===branch));

test('最佳優於同武器偏離：基礎、同星級效能和判定均嚴格較好，最大特性差也不能抵銷',()=>{
 for(const [k,input]of inputs.entries()){const r=rng(),x=T.create({random:()=>r.draw()});r.set([0,0,0.9]);const best=forge(x,input);const near=input.slice();near[k===2?2:k===3?4:k]--;r.set([0,0.9,0,0.9]);const off=forge(x,near);assert.equal(best.weapon,weapons[k]);assert.equal(off.weapon,best.weapon);assert.equal(best.fit,100);assert(off.fit<100);assert(best.basePower>off.basePower);assert(best.baseDurability>off.baseDurability);assert.equal(best.stars,off.stars);assert(T.effect(best).power>T.effect(off).power);assert(T.effect(best).score>T.effect(off).score);}
});
test('亂加材料和同比例放大不能超最佳；完全偏離的三星仍不能壓過最佳一星',()=>{
 for(const input of inputs){const x=T.create({random:()=>0.99}),best=T.measure(mixture(input)),scaled=T.measure(mixture(input.map(n=>n*2)));assert.equal(best.weapon,scaled.weapon);assert(scaled.basePower<best.basePower);assert(scaled.baseDurability<best.baseDurability);const extra=input.slice();extra[4]+=10;const bad=forge(x,extra);const good=T.create({random:()=>0}).forge(mixture(inputs[weapons.indexOf(bad.weapon)]),0);assert.equal(bad.stars,3);assert(T.effect(bad).score<T.effect(good).score);}
});
test('所有材料安全邊界拒絕且不產物、不給點、不抽RNG，40材料仍合法立即成功',()=>{
 let calls=0;const x=T.create({random:()=>{calls++;return 0;}}),before=JSON.stringify(x.state);for(const input of [{},{木頭:0},{木頭:-1},{木頭:1.5},{木頭:NaN},{木頭:Infinity},{木頭:'1'},{木頭:21},{木頭:20,鐵:20,銅:1},{木頭:1,其他:1},null,[]]){assert.throws(()=>x.forge(input,0));assert.equal(JSON.stringify(x.state),before);}assert.equal(calls,0);const i=x.forge({木頭:20,鐵:20},0);assert.equal(i.status,'inventory');assert(i.basePower<=24&&i.baseDurability<=18);assert.equal(x.state.crafted,1);assert.equal(x.state.points,0);
});
test('242個合法非零組合全部立即產武器、有限參數、沒有月份／等待或非武器',()=>{
 const found=new Set();for(let n=1;n<243;n++){let k=n;const q=W.MATERIALS.map(()=>{const v=k%3;k=Math.floor(k/3);return v;}),x=T.create({random:()=>0.9}),i=forge(x,q);found.add(i.weapon);assert.equal(i.status,'inventory');assert(!('dueMonth'in i));assert(i.basePower>=1&&i.basePower<=24);assert(i.baseDurability>=3&&i.baseDurability<=18);assert(i.fit>=0&&i.fit<=100);assert(i.stars>=1&&i.stars<=3);assert(!/盾|護腕|護符|鈴/.test(i.name));assert.equal(new Set(i.traits).size,i.traits.length);assert(i.traits.length===1||i.traits.length===2);assert(!i.traits.includes('guard')||i.pool==='physical');}assert.equal(found.size,4);
});
test('星級機率實抽100個均勻格點逐級等於70/25/5、55/35/10、40/45/15、25/55/20',()=>{
 const expected=[[70,25,5],[55,35,10],[40,45,15],[25,55,20]];for(let level=0;level<=3;level++){const r=rng(),x=trained(level,'quality',()=>r.draw()),counts=[0,0,0];for(let k=0;k<100;k++){r.set([(k+0.5)/100,0,0]);counts[forge(x,[3]).stars-1]++;}assert.deepEqual(counts,expected[level]);assert.deepEqual(T.probabilities(level).stars,expected[level]);}assert.throws(()=>T.probabilities(4));
});
test('特性數量實抽60/40；均勻不放回的最終出現率為70%或46又2/3%，排除無效護身',()=>{
 const r=rng(),x=T.create({random:()=>r.draw()}),counts=[0,0];for(let k=0;k<100;k++){r.set([0,(k+0.5)/100,0,0]);counts[forge(x,[3]).traits.length-1]++;}assert.deepEqual(counts,[60,40]);
 for(const [input,n]of [[inputs[0],2],[inputs[1],3]]){const weights={light:0,solid:0,guard:0};for(const count of [1,2])for(let first=0;first<n;first++)for(let second=0;second<(count===1?1:n-1);second++){const r=rng(),x=T.create({random:()=>r.draw()});r.set([0,count===1?0:0.9,(first+0.5)/n,(second+0.5)/(n-1)]);const i=forge(x,input),weight=(count===1?0.6/n:0.4/(n*(n-1)));for(const t of i.traits)weights[t]+=weight*100;}const reported=T.probabilities().pools[n===2?'magic':'physical'];for(const [key,value]of Object.entries(reported))assert(Math.abs(weights[key]-value)<1e-10);if(n===2)assert.equal(weights.guard,0);}
});
test('星級固定+0/+2/+4、三特性實效是+1效能/-1磨耗/+2防身判定',()=>{
 const item={basePower:12,stars:1,traits:[],pool:'physical'};assert.equal(T.effect(item).power,12);assert.equal(T.effect({...item,stars:2}).power,14);assert.equal(T.effect({...item,stars:3}).power,16);assert.equal(T.effect({...item,traits:['light']}).power,13);assert.equal(T.effect({...item,traits:['solid']}).wear,1);assert.equal(T.effect({...item,traits:['guard']}).score,14);assert.equal(T.effect({...item,pool:'magic',traits:['guard']}).score,12);
});
test('技能點每3件取得、最多6，各分支花1且最多3，錯誤操作不修改資料',()=>{
 const x=T.create({random:()=>0});assert.throws(()=>x.allocate('quality',0),/無技能點/);for(let k=1;k<=21;k++){forge(x,[2]);assert.equal(x.state.earnedPoints,Math.min(6,Math.floor(k/3)));}assert.equal(x.state.points,6);for(const branch of ['quality','trade'])for(let k=0;k<3;k++)x.allocate(branch,x.state.revision);assert.equal(x.state.points,0);assert.deepEqual(x.state.skills,{quality:3,trade:3});const before=JSON.stringify(x.state);assert.throws(()=>x.allocate('quality',x.state.revision),/3級/);assert.throws(()=>x.allocate('other',x.state.revision));assert.equal(JSON.stringify(x.state),before);x.reset();assert.equal(x.state.points,0);assert.deepEqual(x.state.skills,{quality:0,trade:0});
});
test('交易強化真估值+5/級，出售當級實收記錄、實物只能售一次',()=>{
 const x=trained(1,'trade'),i=forge(x,[3]),base=T.effect(i).power*2+i.baseDurability;assert.equal(x.quote(i.id),base+5);const result=x.sell(i.id,x.state.revision);assert.equal(result.amount,base+5);assert.equal(result.item.soldTradeLevel,1);assert.equal(x.state.income,base+5);const before=JSON.stringify(x.state);assert.throws(()=>x.sell(i.id,x.state.revision));assert.equal(JSON.stringify(x.state),before);assert.equal(x.quote(i.id),result.amount);
});
test('同配料星級與特性可不同、開工即固定；分點和復用不重抽舊成品',()=>{
 const r=rng(),x=T.create({random:()=>r.draw()});r.set([0,0,0]);const a=forge(x,[3]);r.set([0.99,0.9,0.99,0]);const b=forge(x,[3]);assert.equal(a.weapon,b.weapon);assert.notEqual(a.stars,b.stars);assert.notDeepEqual(a.traits,b.traits);forge(x,[3]);const saved=x.state.items.slice(0,2);x.allocate('quality',x.state.revision);x.reuse(a.key);assert.deepEqual(x.state.items.slice(0,2),saved);const copy=x.state;copy.items[0].stars=3;assert.equal(x.state.items[0].stars,1);
});
test('配料簿未發現不列，初始未知、鍛造後已知，精確配料復用且不加額外狀態',()=>{
 const x=T.create();assert.equal(x.state.book.length,2);assert(x.state.book.every(b=>b.name===null));const m=T.measure({木頭:3});assert(!x.state.book.some(b=>b.key===m.key));const item=x.forge(m.input,0);assert.equal(x.state.book.find(b=>b.key===m.key).name,item.name);assert.deepEqual(Object.keys(x.state.book[0]).sort(),['input','key','name']);const data=x.reuse(item.key);data.木頭=20;assert.equal(x.reuse(item.key).木頭,3);forge(x,[3]);assert.equal(x.state.book.length,3);
});
test('真鍛造UI沒有開關店／等待／NPC，五材料立即產星級武器並分欄比較',async()=>{
 const v=await free({trialRandom:()=>0}),formal=JSON.stringify(v.state());assert.equal(v.buttons().filter(b=>b.dataset.trial==='forge').length,1);assert.equal((v.html().match(/type="number"/g)||[]).length,5);assert.doesNotMatch(v.html(),/第 [0-9]+ 月|開店|關店|排程|阿岑|小禾|望舒|生活費/);fill(v,[3]);await make(v);assert.equal(v.trial.state.items[0].status,'inventory');assert.match(v.html(),/木杖/);assert.match(v.html(),/100%/);assert.match(v.html(),/基礎效能／耐久/);assert.match(v.html(),/★ \+0/);assert.doesNotMatch(v.html(),/樸實|細緻|精良|盾|護腕|護符|金鈴/);assert.equal(JSON.stringify(v.state()),formal);
});
test('真UI技能取得/分配改機率和實際估值，出售收入記入獨立資料',async()=>{
 const v=await free({trialRandom:()=>0});fill(v,[3]);for(let i=0;i<3;i++)await make(v);assert.equal(v.trial.state.points,1);await skill(v,'quality');assert.equal(v.trial.state.skills.quality,1);assert.match(v.html(),/★55%／★★35%／★★★10%/);for(let i=0;i<3;i++)await make(v);const id=v.trial.state.items.at(-1).id,before=v.trial.quote(id);await skill(v,'trade');assert.equal(v.trial.quote(id),before+5);await v.click(v.buttons().find(b=>b.dataset.trial==='sell'&&b.dataset.item===id));assert.equal(v.trial.state.income,before+5);assert.match(v.html(),/已售/);assert.match(v.html(),/1個60%／2個40%/);assert.match(v.html(),/各70%/);assert.match(v.html(),/各46.67%/);
});
test('未發現最佳模板不洩漏，零/超量不加技能或抽結果；過期鍛造按鈕不重抽',async()=>{
 let calls=0;const v=await free({trialRandom:()=>{calls++;return 0;}});for(const name of ['木杖','鐵劍','長槍','法杖'])assert(!v.html().includes(name));await make(v);assert.match(v.notice(),/至少1/);fill(v,[20,20,1]);await make(v);assert.match(v.notice(),/最多投入40/);assert.equal(calls,0);fill(v,[3]);const b=v.buttons().find(b=>b.dataset.trial==='forge');await v.click(b);const saved=JSON.stringify(v.trial.state),count=calls;b.disabled=false;await v.click(b);assert.match(v.notice(),/已處理/);assert.equal(JSON.stringify(v.trial.state),saved);assert.equal(calls,count);assert(!v.html().includes('鐵劍'));
});
test('正式storage及其他情境隔離、重繪/切頁不重抽，重置技能和試售資料',async()=>{
 const storage=new Map([[KEY,W.exportSave(W.initialState())],[KEY+'-previous','backup']]),saved=JSON.stringify([...storage]),v=await free({storage,failGet:true,failSet:true,trialRandom:()=>0.9});fill(v,[3]);for(let i=0;i<3;i++)await make(v);await skill(v,'trade');const id=v.trial.state.items[0].id;await v.click(v.buttons().find(b=>b.dataset.trial==='sell'&&b.dataset.item===id));const trialSaved=JSON.stringify(v.trial.state);await v.clickTool('menu');await v.click(v.buttons().find(b=>b.dataset.scene==='materials'));await v.clickAction('explore');await v.clickAction('close');await v.clickAction('open');assert.equal(JSON.stringify(v.trial.state),trialSaved);await v.clickTool('menu');await v.click(v.buttons().find(b=>b.dataset.scene==='forge'));assert.equal(JSON.stringify(v.trial.state),trialSaved);await v.clickTool('reset');assert.equal(v.trial.state.items.length,0);assert.equal(v.trial.state.income,0);assert.equal(v.trial.state.skills.trade,0);assert.equal(JSON.stringify([...storage]),saved);
});
