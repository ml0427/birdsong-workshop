(() => {
 'use strict';
 const W=window.Workshop,S=window.WorkshopLabScenarios,lab=window.WorkshopLab.create(S);
 const tips=window.WorkshopTraitTips.create(document,window,W.TRAITS,key=>lab.scene?.mode==='forge'&&key==='guard'?`使用判定＋${W.TRAITS.guard.useBonus}（適用本件作品），面板效能不變`:W.TRAITS[key].text);
 const $=id=>document.getElementById(id),escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let pointerUntil=0,pointerGuard=false;
 const selections={};
 const trial=window.WorkshopTrial.create();let bookSelection=null,bookOpen=false;
 let draft=Object.fromEntries(W.MATERIALS.map(m=>[m,0]));
 const equipmentSamples=new Set(['staff','sword'].map(recipe=>W.inventory(S.equipment.state).find(i=>i.returned&&i.recipe===recipe)?.id).filter(Boolean));
 const modes=[['forge','鍛造','立即製作武器、比較配料、分配品質與交易技能。'],['equipment','裝備整理','退役舊物、鑑定、修復、熔鍊與傳承。'],['trade','櫃臺交易','本人領貨、推薦、製作委託與排隊。'],['materials','材料取得','採購、探索、交付與每人一件任務。'],['growth-cen','客人成長與劇情','三位角色目標前與缺裝備情境。'],['operations','店舖營運','生活費、欠款、逐卡月結與工期。']];
 function button(label,fields,disabled=false){return `<button ${disabled?'disabled':''} data-action="${escape(JSON.stringify(lab.action(fields)))}">${escape(label)}</button>`;}
 function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
 function section(title,body,extra=''){return `<section class="lab-section ${extra}"><h2>${escape(title)}</h2>${body}</section>`;}
 function itemCard(i,actions=''){return `<article class="lab-card"><h3>${escape(W.RECIPES[i.recipe].name)} <small>${escape(i.id)}</small></h3><p>${W.QUALITY[i.quality]}・效能 ${W.performance(i)}・耐久 ${i.durability}／${i.maxDurability}</p><p>${tips.labels(i)}${i.legacy?'・承接舊物 '+escape(i.legacy):''}</p>${actions}</article>`;}
 function materials(infinite=false){return `<div class="lab-materials">${W.knownMaterials(lab.state).map(m=>`<span>${m} <strong>${infinite?'∞':lab.state.materials[m]}</strong></span>`).join('')}</div>`;}
 function mixture(input){return W.MATERIALS.filter(m=>input[m]>0).map(m=>`${m}${input[m]}`).join('＋');}
 function prototypeButton(label,type,data={},disabled=false){return `<button ${disabled?'disabled':''} data-trial="${type}" data-revision="${trial.state.revision}" ${Object.entries(data).map(([k,v])=>`data-${k}="${escape(v)}"`).join(' ')}>${escape(label)}</button>`;}
 function pct(n){return Number(n.toFixed(2))+'%';}
 function starOdds(p){return p.map((n,k)=>'★'.repeat(k+1)+pct(n)).join('／');}
 function weaponOdds(){const t=trial.state,q=t.skills.quality,trade=t.skills.trade,p=window.WorkshopTrial.probabilities(q),next=q<3?window.WorkshopTrial.probabilities(q+1):null;
  return `<section class="weapon-odds" aria-label="機率及技能增益"><div><p>品質${q}級：${starOdds(p.stars)}</p><p>${next?'下級：'+starOdds(next.stars):'品質已達3級上限'}</p><p>星級效能加成：+0／+2／+4</p></div><div><p>特性：1個${p.counts[0]}%／2個${p.counts[1]}%</p><p>施法：輕巧、堅固各${pct(p.pools.magic.light)}</p><p>防身：輕巧、堅固、護身各${pct(p.pools.physical.guard)}（約）</p></div><div><p>每鍛造3件得1點；累計最多6點。已完成${t.crafted}件</p><p>交易${trade}級：估值+${trade*5}；${trade<3?'下級+'+(trade+1)*5:'已達上限'}</p><p>升級耗1點，各支線3級。特性率是最終出現率，可同時出現。</p></div></section>`;
 }
 function weaponScreen(){const t=trial.state,book=t.book,chosen=book.find(b=>b.key===bookSelection)||book[0];bookSelection=chosen.key;
  const controls=`<div class="trial-builder"><div class="trial-fields">${W.MATERIALS.map((m,n)=>`<label for="trial-q-${n}">${m}<input id="trial-q-${n}" type="number" min="0" max="20" step="1" value="${escape(draft[m])}"></label>`).join('')}</div><p id="trial-total" class="trial-total">每種0–20，總量1–40。接近配方決定基礎參數。</p>${prototypeButton('鍛造','forge')}<details class="trial-book" id="trial-book-panel"${bookOpen?' open':''}><summary>配料簿（${book.length}）</summary><div class="trial-book-actions"><select id="trial-book" aria-label="配料簿">${book.map(b=>`<option value="${b.key}" ${b.key===chosen.key?'selected':''}>${mixture(b.input)} → ${escape(b.name||'成品未知')}</option>`).join('')}</select><button id="trial-reuse" data-trial="reuse" data-key="${chosen.key}">${chosen.name?'重用配料':'套用配料'}</button></div></details></div>`;
  const recent=t.items.slice(-4).reverse(),comparison=recent.length?`<table class="trial-results weapon-results" aria-label="最近成品比較"><thead><tr><th scope="col">配料</th><th scope="col">武器／契合</th><th scope="col">基礎效能／耐久</th><th scope="col">星級＋加成</th><th scope="col">效能／判定</th><th scope="col">特性</th><th scope="col">估值／出售</th></tr></thead><tbody>${recent.map(i=>{const e=window.WorkshopTrial.effect(i);return `<tr><td>${mixture(i.input)}</td><td>${i.name} ${i.fit}%</td><td>${i.basePower}／${i.baseDurability}</td><td>${'★'.repeat(i.stars)} +${e.starBonus}</td><td>${e.power}／${e.score}</td><td>${tips.labels(i)}</td><td>${i.status==='sold'?'已售 '+i.soldFor:prototypeButton('售 '+trial.quote(i.id),'sell',{item:i.id})}</td></tr>`;}).join('')}</tbody></table>`:'<p>鍛造後立即顯示武器、契合、基礎參數、星級及特性。配料簿只顯示已提供或已完成的配料。</p>';
  return `<div class="lab-grid lab-forge lab-weapon-board">${section('武器鍛造',controls)}${section('最近 '+recent.length+' 件成品',`<div class="lab-list">${comparison}</div>`)}</div>${weaponOdds()}`;
 }
 function readTrial(){draft=Object.fromEntries(W.MATERIALS.map((m,n)=>[m,Number($('trial-q-'+n).value)]));return draft;}
 function recipes(compact=false){const s=lab.state,ids=W.visibleRecipes(s);
  if(compact){const selected=ids.includes(selections[lab.key])?selections[lab.key]:lab.scene.mode==='equipment'&&ids.includes('bracer')?'bracer':ids[0];selections[lab.key]=selected;const r=W.RECIPES[selected];
   return `<div class="lab-recipe-picker"><label for="lab-recipe">選擇配方（${ids.length} 種）</label><select id="lab-recipe">${ids.map(id=>`<option value="${id}" ${id===selected?'selected':''}>${W.RECIPES[id].name}・${W.CRAFT_MONTHS[id]} 月</option>`).join('')}</select><article class="lab-card"><h3>${r.name}</h3><p>${r.material} 1・${W.CRAFT_MONTHS[selected]} 個月</p><p>${tips.labels(W.productionTraits(s,selected))}</p>${button('開始製作',{type:'craft',recipe:selected},lab.scene.mode!=='forge'&&s.materials[r.material]<1)}</article></div>`;
  }
  return `<div class="lab-recipes">${ids.map(id=>{const r=W.RECIPES[id];return `<article class="lab-card"><h3>${r.name}</h3><p>${r.material} 1・${W.CRAFT_MONTHS[id]} 個月</p><p>${tips.labels(W.productionTraits(s,id))}</p>${button('開始製作',{type:'craft',recipe:id},lab.scene.mode!=='forge'&&s.materials[r.material]<1)}</article>`;}).join('')}</div>`;
 }
 function equipment(){const s=lab.state,initial=new Set(lab.scene.initialItemIds),items=W.inventory(s),samples=items.filter(i=>equipmentSamples.has(i.id)),others=items.filter(i=>initial.has(i.id)&&!equipmentSamples.has(i.id)),fresh=items.filter(i=>!initial.has(i.id));
  const card=i=>itemCard(i,`${button('鑑定',{type:'appraise',itemId:i.id},i.appraised||!W.canAppraise(s))}${i.returned?button('修復一次',{type:'repair',itemId:i.id},i.repaired)+button('熔鍊為材料與傳承',{type:'smelt',itemId:i.id}):''}`);
  return `${materials()}<div class="lab-grid">${section('代表舊物與本次新作',`<div class="lab-list lab-samples">${samples.map(card).join('')||'<p>代表樣本已整理，可展開其他庫存繼續。</p>'}${fresh.length?'<h3>此次新作</h3>'+fresh.map(card).join(''):''}</div><details class="lab-other-items"><summary>其他庫存（${others.length} 件）</summary><div class="lab-list">${others.map(card).join('')||'<p>其他舊物已整理。</p>'}</div></details>`)}${section('下一件同材料傳承',`<p>${s.legacies.filter(l=>!l.usedBy).map(l=>escape(l.material)+'：'+tips.labels(l.traits)).join('；')||'沒有待用傳承。'}</p>${recipes(true)}${production(true)}`)}</div>`;
 }
 function production(onlyNew=false){const s=lab.state,ids=new Set(lab.scene.initialItemIds),items=Object.values(s.items).filter(i=>i.status==='crafting'&&(!onlyNew||!ids.has(i.id)));return `<div class="lab-list">${items.map(i=>`<article class="lab-card"><h3>${W.RECIPES[i.recipe].name}</h3><p>第 ${i.dueMonth} 月開店完工・還需 ${Math.max(0,i.dueMonth-s.month)} 月${i.reservedFor?'・預留給 '+W.PEOPLE[s.commissions.find(c=>c.id===i.reservedFor).npc].name:''}</p></article>`).join('')||'<p>尚無在製品。</p>'}</div>`;}
 function commissions(){const s=lab.state;return s.commissions.filter(c=>!['delivered','cancelled'].includes(c.status)).map(c=>`<article class="lab-card"><h3>${W.PEOPLE[c.npc].name}・${W.RECIPES[c.recipe].name}</h3><p>${({accepted:'待開工',crafting:'製作中',ready:'等待本人領貨'})[c.status]}</p>${c.status==='accepted'?button('依委託開工',{type:'craft',commissionId:c.id},!W.canStartCommission(s,c)):''}</article>`).join('')||'<p>沒有待交製作委託。</p>';}
 function counter(financeOnly=false){const s=lab.state,v=W.activeVisit(s);if(!v)return section('櫃臺',`<p>${s.open?'本月接待已完成。':'先開店再接待。'}</p>`);
  const candidate=W.inventory(s).filter(i=>W.suitable(s,i,v)),c=s.commissions.find(c=>c.id===v.commissionId),waiting=s.visits.filter(x=>x.status==='waiting'&&x.id!==v.id).length;
  const available=candidate.map(i=>itemCard(i)).join('');
  const canAccept=v.phase==='request'&&!['intro','delivery'].includes(v.kind)&&!candidate.length&&W.unlocked(s,v.needs[0])&&!W.pendingTasks(s,v.npc).some(t=>t.id!==v.id);
  return section(`${W.PEOPLE[v.npc].name}・等候 ${waiting} 位`,`<div class="lab-list"><p>${escape(W.requestDetail(v))}</p>${!financeOnly&&!v.asked?button('聽需求',{type:'talk'}):''}${available||'<p>目前沒有合適現貨。</p>'}${v.phase==='request'&&c?.status==='crafting'?'<p>本人等成品完成，不可提前交貨。</p>':''}</div><div class="counter-actions">${candidate.map(i=>button((v.kind==='delivery'?'交付本人・':'推薦售出・')+W.RECIPES[i.recipe].name,{type:v.kind==='delivery'?'deliver':'sell',itemId:i.id})).join('')}${!financeOnly&&canAccept?button('接受製作委託',{type:'accept-commission'}):''}${button(v.phase==='service'?'送客，接下一位':'婉拒，接下一位',{type:v.phase==='service'?'leave':'decline'})}</div>`,'lab-counter');
 }
 function ledger(){const s=lab.state;return `<div class="lab-ledger"><span>硬幣 <strong>${s.coins}</strong></span><span>欠款 <strong>${s.debt}</strong></span></div>`;}
 function receipts(){const s=lab.state,r=s.monthReview,e=r.entries[r.cursor],last=r.cursor===r.entries.length-1;return `<section class="lab-section lab-receipt"><h2>第 ${s.month} 月・第 ${r.cursor+1}／${r.entries.length} 筆</h2>${e.kind==='money'?`<h3>生活費 ${e.amount} 枚</h3><p>現金支付 ${e.cashPaid} 枚，新欠款 ${e.debtAdded} 枚。</p>${ledger()}`:itemCard(s.items[e.itemId])}${button(last?'閱完，開始營業':'下一筆',{type:'review-next',month:r.month,cursor:r.cursor})}</section>`;}
 function growth(){const s=lab.state,npc=lab.scene.npc,p=W.characterProgress(s,npc);return `<div class="lab-growth-select">${['growth-cen','growth-he','growth-shu','growth-gap'].map(key=>`<button data-scene="${key}" ${key===lab.key?'disabled':''}>${escape(S[key].title)}</button>`).join('')}</div><div class="lab-grid">${section(`${W.PEOPLE[npc].name}・等級 ${p.level}・${p.abilityName} ${p.ability}`,`<h3>${escape(p.goalTitle)}${p.completed?'・已完成':''}</h3><p>${escape(p.hint)}</p><p>${escape(p.abilityText)}</p><ol class="lab-history">${p.history.map(h=>`<li>第 ${h.month} 月：${escape(h.title)}${h.grows?'（成長經歷）':''}</li>`).join('')}</ol><div class="lab-list">${W.owned(s,npc).map(i=>itemCard(i)).join('')||'<p>沒有持有裝備。</p>'}</div>`)}${counter()}</div><details><summary>補裝與待交貨（依正常排隊，不能跳過本人）</summary>${materials()}<div class="lab-grid">${section('可製作裝備',recipes())}${section('製作委託',commissions()+production())}</div></details>`;}
 function materialScreen(){const s=lab.state,v=W.activeVisit(s),busy=v&&W.pendingTasks(s,v.npc),jobs=[...s.orders,...s.explorations,...s.journey.outings];return `${ledger()}${materials()}<div class="lab-grid">${section('當面交代',v?`<h3>${W.PEOPLE[v.npc].name}</h3><p>${escape(W.requestDetail(v))}</p><p>${busy.length?'已有背景任務：'+busy.map(t=>escape(t.label)).join('、'):'目前可接受一件材料任務。'}</p><div class="lab-form"><label>材料 <select id="lab-material">${W.knownMaterials(s).map(m=>`<option>${m}</option>`).join('')}</select></label><label>數量 <input id="lab-quantity" type="number" min="1" step="1" value="2"></label></div><p>木頭3、鐵6、銅10、銀16、金24枚／個；委託時扣款，不足記欠款。</p>${button('委託採購',{type:'order-form'},!!busy.length)}${button('探索新材料（6枚）',{type:'explore'},!!busy.length||!W.nextUnknown(s))}${W.canScout(s)?button('近程勘路（6枚）',{type:'scout'},!!busy.length||v.npc!=='he'):''}${W.canGather(s,v.npc)?button('驛道採集（6枚）',{type:'gather-form'},!!busy.length):''}${button(v.phase==='service'?'送客':'婉拒，接下一位',{type:v.phase==='service'?'leave':'decline'})}`:'<p>先開店或下月接待，才能當面委託。</p>')}${section('任務與交付',`<div class="lab-list">${jobs.slice().reverse().map(t=>`<article class="lab-card"><h3>${W.PEOPLE[t.npc].name}・${escape(t.material||'近程勘路')}</h3><p>${t.status==='pending'?'第 '+t.due+' 月交付':'已交付：第 '+t.deliveredMonth+' 月'}・${t.quantity} 個・${t.cost} 枚</p></article>`).join('')||'<p>尚無派遣。採購與探索共用每人一件限制。</p>'}</div><p>已辨識：${W.knownMaterials(s).join('、')}</p><details><summary>最近材料鳥信</summary>${s.news.filter(n=>/^(delivery-order-|exploration-|outing-)/.test(n.id)).slice(-6).map(n=>`<p>${escape(n.text)}</p>`).join('')||'<p>交付後由魔法鳥送達。</p>'}</details>`)}</div>`;}
 function render(keepBook=true){if(keepBook&&$('lab-app').innerHTML.includes('id="trial-book-panel"'))bookOpen=$('trial-book-panel').open;tips.hide();tips.resetDescriptions();const s=lab.state,scene=lab.scene;$('lab-app').setAttribute('data-mode',scene?.mode||'');
  if(!s){$('lab-controls').innerHTML='';$('lab-app').innerHTML=`<div class="lab-menu">${modes.map(([key,title,text],i)=>`<button data-scene="${key}"><strong>${i+1} ${title}</strong><span>${text}</span></button>`).join('')}</div>`;return;}
  const review=W.pendingReview(s),t=trial.state;
  $('lab-controls').innerHTML=`<button data-tool="menu">選擇測試</button><button data-tool="reset">重置目前情境</button><strong>${escape(scene.title)}</strong>`+(scene.mode==='forge'?`<span>技能點 <strong>${t.points}</strong></span>${prototypeButton('品質強化 '+t.skills.quality+'/3 ＋','skill',{branch:'quality'},!t.points||t.skills.quality===3)}${prototypeButton('交易強化 '+t.skills.trade+'/3 ＋','skill',{branch:'trade'},!t.points||t.skills.trade===3)}<span>試售收入 <strong>${t.income}</strong></span>`:`<span class="lab-month">第 ${s.month} 月・${s.open?'營業中':'關店中'}</span>${button('開店，前進一月',{type:'open'},s.open||review)}${button('關店',{type:'close'},!s.open||review)}`);
  let html='';
  if(scene.mode==='operations'&&review)html=receipts();
  else if(scene.mode==='forge')html=weaponScreen();
  else if(scene.mode==='equipment')html=equipment();
  else if(scene.mode==='trade')html=`${ledger()}<div class="lab-grid">${counter()}${section('現貨與委託',`<details><summary>全部庫存</summary><div class="lab-list">${W.inventory(s).map(i=>itemCard(i)).join('')||'<p>沒有現貨。</p>'}</div></details>${commissions()}${production()}`)}</div>`;
  else if(scene.mode==='materials')html=materialScreen();
  else if(scene.mode==='growth')html=growth();
  else html=`${ledger()}<div class="lab-grid">${section('工期與收支',`${production()}<details><summary>最近工坊記事</summary>${s.log.slice(-8).map(t=>`<p>${escape(t)}</p>`).join('')}</details><p>關店不結算；下次開店逐筆生活費與完工卡。收入先抵欠款。</p>`)}${counter(true)}</div>`;
  $('lab-app').innerHTML=`<p class="lab-intro"><strong>起始情境：</strong>${escape(scene.mode==='forge'?'接近配方決定基礎參數；星級、特性與技能分開計算。鍛造立即完成，只用測試資料。':scene.intro)}</p>${html}`;
  if(scene.mode==='forge'){$('trial-book-panel').open=bookOpen;for(const [n,m]of W.MATERIALS.entries())$('trial-q-'+n).value=String(draft[m]);}
 }
 document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled){tips.click(event);return;}
  const pointer=event.detail>0||['touch','pen'].includes(event.pointerType),now=performance.now();
  const navigation=!!b.dataset.scene||['menu','reset'].includes(b.dataset.tool);
  if(navigation){pointerGuard=false;pointerUntil=0;}
  if(!navigation&&pointer&&pointerGuard&&(now<pointerUntil||event.detail>1)){pointerUntil=now+600;event.preventDefault();event.stopPropagation();return;}if(pointer&&now>=pointerUntil)pointerGuard=false;
  if(tips.click(event))return;
  try{if(b.dataset.scene){lab.select(b.dataset.scene);notice('測試進度獨立；正式存檔保留。');render();return;}
   if(b.dataset.tool==='menu'){lab.menu();render();notice('選擇另一項；本頁內各情境進度保留。');return;}
   if(b.dataset.tool==='reset'){delete selections[lab.key];if(lab.scene.mode==='forge'){trial.reset();draft=Object.fromEntries(W.MATERIALS.map(m=>[m,0]));bookSelection=null;bookOpen=false;}lab.reset();render(false);notice('目前情境已恢復初始資料，其他情境與正式遊戲保留。');return;}
   if(b.dataset.trial&&lab.scene.mode==='forge'){
    const expected=Number(b.dataset.revision);
    if(b.dataset.trial==='reuse'){draft=trial.reuse(b.dataset.key);render();$('trial-reuse').focus({preventScroll:true});notice('已填入相同配料。');return;}
    if(b.dataset.trial==='forge'){b.disabled=true;const item=trial.forge(readTrial(),expected);render();notice(`鍛造完成：${item.name}，${'★'.repeat(item.stars)}。`);return;}
    if(b.dataset.trial==='skill'){trial.allocate(b.dataset.branch,expected);render();notice('技能已提升；增益與機率已更新。');return;}
    if(b.dataset.trial==='sell'){const sold=trial.sell(b.dataset.item,expected);render();notice(`出售測試完成，收入 ${sold.amount}。`);return;}
   }
   if(!b.dataset.action)return;let action=JSON.parse(b.dataset.action);
   if(action.type==='order-form')action={...action,type:'order',material:$('lab-material').value,quantity:Number($('lab-quantity').value)};
   if(action.type==='gather-form')action={...action,type:'gather-route',material:$('lab-material').value};
   action=lab.action({...action});
   // Preserve DOM revision and counter tokens: re-scoping must never legitimise stale input.
   const original=JSON.parse(b.dataset.action);action.expectedRevision=original.expectedRevision;if(original.visitId){action.visitId=original.visitId;action.counterId=original.counterId;}
   if(pointer&&['open','review-next'].includes(action.type)){pointerGuard=true;pointerUntil=now+600;}
   b.disabled=true;const result=lab.act(action);render();notice(result.message);
  }catch(error){render();notice(error.message,true);}
 });
 document.addEventListener('input',event=>{if(!/^trial-q-[0-4]$/.test(event.target.id)||lab.scene?.mode!=='forge')return;const input=readTrial();try{const total=window.WorkshopTrial.measure(input).total;$('trial-total').textContent=`已投入 ${total}／40；每種最多20。配料接近度影響基礎參數。`;}catch(error){$('trial-total').textContent=error.message;}});
 document.addEventListener('change',event=>{if(event.target.id==='trial-book'&&lab.scene?.mode==='forge'){bookSelection=event.target.value;render();$('trial-book').focus({preventScroll:true});return;}if(event.target.id!=='lab-recipe'||!lab.scene)return;const value=event.target.value;if(!W.visibleRecipes(lab.state).includes(value))return;selections[lab.key]=value;render();$('lab-recipe').focus({preventScroll:true});});
 render();
})();
