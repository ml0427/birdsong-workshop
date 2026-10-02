(() => {
  'use strict';
  const W = window.Workshop, KEY = 'birdsong-workshop-save-v1';
  let state = W.initialState(), tab = 'craft', savedRaw = null, saveProblem = '', startNotice = '';
  const pages = { inventory: 1, mail: 1, collection: 1 };
  const recommendations = {};
  let renderedTab = null, resetPanelScroll = false, mailMonth = null;
  let reviewPointerGuard = false, reviewPointerUntil = 0;
  const escape = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  try {
    savedRaw = localStorage.getItem(KEY);
    if (savedRaw) {
      try { state = W.importSave(savedRaw); startNotice = '已讀取本機存檔，繼續上次的工坊。'; }
      catch (error) {
        const backup = localStorage.getItem(KEY + '-previous');
        if (backup) { state = W.importSave(backup); savedRaw = backup; startNotice = '主存檔損壞，已讀取上一筆自動備份。建議匯出備份。'; }
        else { saveProblem = '既有存檔無法讀取；請先匯出原始存檔或匯入備份。'; startNotice = saveProblem; }
      }
    }
  } catch (error) { saveProblem = '此瀏覽器無法使用本機保存。仍可遊玩，離開前請匯出備份。'; startNotice = saveProblem; }
  function notify(text, error = false) { $('notice').textContent = text; $('notice').classList.toggle('error', error); }
  function save() {
    if (saveProblem.includes('既有存檔')) return;
    try {
      const next = W.exportSave(state);
      if (savedRaw) localStorage.setItem(KEY + '-previous', savedRaw);
      localStorage.setItem(KEY, next); savedRaw = next; saveProblem = '';
      $('save-status').textContent = '進度已保存';
    } catch (error) { saveProblem = '本機保存失敗。請立即匯出備份，再繼續遊玩。'; $('save-status').textContent = saveProblem; }
  }
  function button(label, action, opts = {}) {
    const v = W.activeVisit(state);
    const scoped = ['talk', 'sell', 'decline', 'leave', 'reclaim', 'order-form', 'explore', 'accept-commission', 'cancel-commission', 'deliver', 'scout', 'gather-route-form'].includes(action.type);
    const data = { ...(scoped && v ? { visitId: v.id, counterId: v.counterId } : {}), ...action, expectedRevision: state.revision };
    return `<button ${opts.primary ? 'class="primary"' : ''} ${opts.disabled ? 'disabled' : ''} data-action="${escape(JSON.stringify(data))}">${escape(label)}</button>`;
  }
  function tabButton(id, label) { return `<button role="tab" aria-selected="${tab === id}" aria-controls="panel" data-tab="${id}">${label}</button>`; }
  function paginate(items, scope, size = 6) {
    const total = Math.max(1, Math.ceil(items.length / size));
    const page = Math.max(1, Math.min(total, pages[scope] || 1));
    pages[scope] = page;
    const pager = total > 1 ? `<nav class="pagination" aria-label="${scope === 'mail' ? '鳥信' : scope === 'collection' ? '收藏' : '作品'}分頁"><button data-page="${scope}" data-number="${page - 1}" ${page === 1 ? 'disabled' : ''}>上一頁</button><span>第 ${page}／${total} 頁 · 共 ${items.length} 筆</span><button data-page="${scope}" data-number="${page + 1}" ${page === total ? 'disabled' : ''}>下一頁</button></nav>` : '';
    return { items: items.slice((page - 1) * size, page * size), pager };
  }
  function compactGoal(t) {
    return {
      1: '木頭、鐵各 3 個；先開始木杖和鐵劍，下次開店完工。',
      2: Object.values(state.items).some(i => i.status === 'crafting') ? '按開店換月才推進工期；營業中先關店再開店。' : '聽阿岑的用途，再逐件推薦完成的兩把武器。',
      3: '接待新需求、查看人物與鳥信；材料委託可稍後向在場人物補學。',
      4: state.open ? '關店，再開店收材料與鳥信。' : '按開店收取材料與鳥信。',
      5: '聽用途、接委託或開始作品；完工再交易。'
    }[t.step];
  }
  function itemLabel(i) { return W.RECIPES[i.recipe].name; }
  function materialHandoff(v) {
    if (v?.phase !== 'service') return '';
    const jobs = [...state.orders, ...state.explorations, ...state.journey.outings]
      .filter(o => o.npc === v.npc && o.status === 'pending');
    return jobs.length ? `材料委託已交代，第 ${Math.min(...jobs.map(o => o.due))} 月開店回報。` : '';
  }
  function requestText(v) {
    if (materialHandoff(v)) return materialHandoff(v);
    if (v.kind === 'delivery' && v.phase === 'request') return '我來領先前請工坊做的裝備。當面交貨後再付款。';
    if (v.phase === 'service') return W.requestDetail(v);
    if (v.kind === 'intro' && v.needs.length === 1) return `剛才那件我收好了。現在還需要${W.RECIPES[v.needs[0]].name}，也由我帶著。`;
    if (v.asked) return W.requestDetail(v);
    if (v.kind === 'intro') return '我想買兩把不同武器，都是我自己用。';
    return W.requestDetail(v);
  }
  function renderVisitor() {
    const v = W.activeVisit(state);
    if (!v) return `<section class="visitor"><h3>這一輪來客已處理完</h3><p class="help">櫃臺目前沒有人。可繼續製作，關店再開店迎接下月來客。</p></section>`;
    const person = W.PEOPLE[v.npc], choices = W.inventory(state).filter(i => W.suitable(state, i, v));
    const selected = choices.find(i => i.id === recommendations[v.id]) || choices[0];
    if (selected) recommendations[v.id] = selected.id;
    const offers = state.returns.filter(o => o.status === 'offered' && o.npc === v.npc);
    const hint = W.characterProgress(state, v.npc).hint;
    const journeyLine = hint && (v.asked || v.phase === 'service') && !requestText(v).includes(hint) ? `<p class="help">${escape(hint)}</p>` : '';
    return `<section class="visitor" aria-label="目前顧客"><div class="visitor-head"><span class="portrait" aria-hidden="true">${person.name.slice(-1)}</span><div><h3>${person.name} <span class="subtle">${person.role}</span></h3><small>信任 ${state.npcs[v.npc].trust}・持有 ${W.owned(state, v.npc).length} 件${v.month < state.month ? '・保留需求' : ''}</small></div></div><blockquote>「${escape(requestText(v))}」</blockquote>${journeyLine}${v.asked || materialHandoff(v) ? '' : button('多問一句', { type: 'talk', visitId: v.id })}${choices.length ? `<label class="recommend-label">可推薦的裝備<select id="recommend-item" data-visit="${escape(v.id)}">${choices.map((i, index) => `<option value="${i.id}" ${i === selected ? 'selected' : ''}>${itemLabel(i)} · ${W.price(i)} 枚 · ${W.traitNames(i)}${W.canAppraise(state) ? ` · 耐久 ${i.durability}／${i.maxDurability}` : ''}${i.returned ? ' · 修復舊物' : ''}${i.legacy ? ` · 傳承自${itemLabel(state.items[i.legacy])}` : ''}${choices.length > 1 ? ` · 第 ${index + 1} 件` : ''}</option>`).join('')}</select></label><p class="help trait-effects">特性：${W.traitDetails(selected)}。</p><div id="recommend-action" class="actions">${button(` ${v.kind === 'delivery' ? '交付委託' : '推薦'}${itemLabel(selected)} · ${W.price(selected) + (v.kind === 'commission' || state.commissions.find(c => c.id === v.commissionId)?.kind === 'commission' ? 12 : 0)} 枚`, { type: v.kind === 'delivery' ? 'deliver' : 'sell', itemId: selected.id, visitId: v.id }, { primary: true })}</div>` : v.asked && v.phase === 'request' ? '<p class="help">作品架還沒有符合用途、品質與耐久的裝備。</p>' : ''}${v.phase === 'request' && !choices.length && !['intro', 'delivery'].includes(v.kind) ? `<div class="actions">${button('沒現貨，接製作委託', { type: 'accept-commission', requestId: `customer-${state.revision}-${state.seq}` }, { primary: true, disabled: W.pendingTasks(state, v.npc).some(t => t.id !== v.id) })}</div><p class="help">工坊替客人製作，完工保留給本人；回店交貨才付款。</p>` : ''}${state.commissions.filter(c => c.npc === v.npc && c.status === 'accepted').map(c => `<div class="actions">${button('當面取消未開工委託', { type: 'cancel-commission', commissionId: c.id })}</div>`).join('')}${offers.map(o => `<div class="actions">${button(`收下贈還${itemLabel(state.items[o.itemId])}`, { type: 'reclaim', itemId: o.itemId }, { primary: true })}</div>`).join('')}${W.openingDone(state) && !materialHandoff(v) ? `<div class="actions"><button data-tab="purchase">${person.name}的材料委託</button></div>` : ''}${v.phase === 'service' ? `<div class="actions">${button('送客', { type: 'leave' })}</div>` : `<div class="actions">${button('婉拒本次需求並送客', { type: 'decline', visitId: v.id })}</div>`}</section>`;
  }
  function renderCraft() {
    const current = W.activeVisit(state);
    const shown = W.visibleRecipes(state).sort((a, b) => current?.asked ? Number(current.needs.includes(b)) - Number(current.needs.includes(a)) : 0);
    const jobs = Object.values(state.items).filter(i => i.status === 'crafting');
    const accepted = state.commissions.filter(c => c.status === 'accepted');
    return `<div class="section-head"><h2>工作臺</h2>${W.openingDone(state) ? `<span class="subtle">製作經驗 ${state.xp.craft}${W.canAppraise(state) ? ` · 鑑定 ${state.xp.appraisal}` : ''}</span>` : ''}</div><div class="panel-scroll"><div class="recipes">${shown.map(id => {
      const r = W.RECIPES[id], unlocked = W.unlocked(state, id), enough = state.materials[r.material] > 0;
      const legacy = state.legacies.find(l => l.material === r.material && l.usedBy === null);
      return `<article class="recipe"><div class="recipe-top"><span class="glyph" aria-hidden="true">${r.symbol}</span><div><h3>${r.name}</h3><small>${r.material} 1 個 · ${W.CRAFT_MONTHS[id]} 個月</small></div>${current?.asked && current.needs.includes(id) ? '<span class="badge">合用</span>' : ''}</div><p>${r.use}。</p><p class="help trait-effects">特性：${W.traitDetails(W.productionTraits(state, id))}。</p>${legacy ? `<p class="help">下一件自動承接${itemLabel(state.items[legacy.itemId])}的傳承；這次的兩個特性如上，開工才消耗，僅一次。</p>` : ''}${unlocked ? button(enough ? `開始${r.name}` : `缺${r.material}`, { type: 'craft', recipe: id }, { primary: enough, disabled: !enough }) : ''}</article>`;
    }).join('')}</div>${jobs.length || accepted.length ? `<div class="production-list" aria-label="製作進度">${jobs.map(i => `<article class="production"><h3>${itemLabel(i)} · 製作中</h3><p>尚需 ${i.dueMonth - state.month} 個月；第 ${i.dueMonth} 月開店完工${i.reservedFor ? `，保留給${W.PEOPLE[state.commissions.find(c => c.id === i.reservedFor).npc].name}` : '，完成後上架'}。</p></article>`).join('')}${accepted.map(c => `<article class="production"><h3>${W.PEOPLE[c.npc].name}請工坊做${W.RECIPES[c.recipe].name}</h3><p>尚未開工：備好材料、品質與指定特性後開始，需 ${W.CRAFT_MONTHS[c.recipe]} 個月。</p>${button('開始這份客人委託', { type: 'craft', commissionId: c.id }, { primary: true, disabled: !W.canStartCommission(state, c) })}</article>`).join('')}</div>` : ''}</div>`;
  }
  function itemCard(i, collection = false) {
    const r = W.RECIPES[i.recipe], v = W.activeVisit(state);
    const mismatch = !collection && v?.phase === 'request' ? W.recommendationReason(state, i, v) : '';
    const status = { crafting: `製作中 · 尚需 ${i.dueMonth - state.month} 個月`, inventory: i.reservedFor ? `${W.PEOPLE[state.commissions.find(c => c.id === i.reservedFor).npc].name}委託保留` : i.returned ? '贈還舊物' : '工坊庫存', owned: `${W.PEOPLE[i.owner]?.name || ''}持有`, smelted: '已熔鍊／拆解' }[i.status];
    const legacyName = i.legacy && state.items[i.legacy] ? itemLabel(state.items[i.legacy]) : null;
    return `<article class="item"><div class="item-header"><div><h3>${r.name}${i.appraised ? ` <span class="badge">${W.QUALITY[i.quality]}</span>` : ''}</h3><span class="subtle">${status}</span></div><strong>${i.status === 'crafting' ? '未完工' : W.price(i) + ' 枚'}</strong></div>${i.appraised ? `<p>${i.material}第 ${r.tier} 階 · 效能 ${W.performance(i)} · 耐久 ${i.durability}／${i.maxDurability}。</p>` : ''}<p class="trait-effects">特性：${W.traitDetails(i)}${i.status === 'inventory' && i.returned && i.durability <= 3 ? ' · 磨損，修復後才能推薦' : ''}。</p>${i.status === 'smelted' ? '<p>實物已消耗；只有材料與傳承紀錄，不能修復或出售。</p>' : ''}${legacyName ? `<p>承接${legacyName}的傳承。</p>` : ''}${mismatch ? `<p class="help">不合用：${escape(mismatch)}</p>` : ''}${!collection ? `<div class="actions">${W.suitable(state, i, v) ? button(v?.kind === 'delivery' ? '當面交付委託' : '推薦給目前顧客', { type: v.kind === 'delivery' ? 'deliver' : 'sell', itemId: i.id, visitId: v.id }, { primary: true }) : ''}${W.canAppraise(state) ? button(i.appraised ? '已鑑定' : '鑑定物品', { type: 'appraise', itemId: i.id }, { disabled: i.appraised }) : ''}${i.returned && !i.repaired && i.durability < i.maxDurability ? button('練習修復（免費一次）', { type: 'repair', itemId: i.id }) : ''}${i.returned ? button('熔鍊／拆解', { type: 'smelt', itemId: i.id }) : ''}</div>` : ''}${collection ? `<details><summary>物品故事（${i.history.length} 筆）</summary><p class="item-id">物品編號 ${i.id}</p><ul class="item-history">${i.history.map(h => `<li>第 ${h.month} 月：${escape(h.text)}</li>`).join('')}</ul></details>` : ''}</article>`;
  }
  function renderInventory() {
    const items = W.inventory(state);
    const page = paginate(items, 'inventory');
    return `<div class="section-head"><h2>作品架</h2><span class="subtle">${items.filter(i => !i.reservedFor).length} 件可售 · ${items.filter(i => i.reservedFor).length} 件委託保留</span></div><div class="list panel-scroll">${items.length ? page.items.map(i => itemCard(i)).join('') : '<p class="empty">作品架還空著。製作完成的物品會放在這裡；售出後由顧客持有。</p>'}</div>${page.pager}`;
  }
  function renderPurchase() {
    const v = W.activeVisit(state), materials = W.knownMaterials(state), defaultMaterial = materials.includes('銅') ? '銅' : '木頭';
    const handoff = materialHandoff(v);
    const busy = v ? W.pendingTasks(state, v.npc) : [], exploring = state.explorations.some(e => e.status === 'pending');
    const routeControls = v ? `${v.npc === 'he' && W.canScout(state) ? `<div class="actions">${button('近程勘路 · 6 枚', { type: 'scout', requestId: `scout-ui-${state.revision}-${state.seq}` }, { disabled: !!busy.length })}</div><p class="help">下月帶回木頭 1 個，留下實際辨路經歷。</p>` : ''}${W.canGather(state, v.npc) ? `<div class="actions">${button('沿驛道採集所選材料 · 6 枚', { type: 'gather-route-form', requestId: `gather-ui-${state.revision}-${state.seq}` }, { disabled: !!busy.length })}</div><p class="help">沿已恢復通路，下月帶回所選已知材料 3 個。</p>` : ''}` : '';
    return `<div class="section-head"><h2>請在場人物採購／探索</h2></div><div class="panel-scroll">${handoff ? `<p class="help">${handoff}</p>` : v ? `<div class="purchase"><p>${W.PEOPLE[v.npc].name}${busy.length ? `已有 ${busy.length} 件未完成委託：${busy.map(t => t.label).join('、')}。完成後才接下一件。` : '目前可接一件委託；材料派遣、客人請工坊製作共用限制。'}</p><div class="purchase-grid"><label>已辨識材料<select id="order-material">${materials.map(m => `<option value="${m}" ${m === defaultMaterial ? 'selected' : ''}>${m} · ${W.COST[m]} 枚／個</option>`).join('')}</select></label><label>數量<input id="order-quantity" type="number" min="1" step="1" value="1" inputmode="numeric"></label>${button(`請${W.PEOPLE[v.npc].name}採購`, { type: 'order-form', requestId: `ui-${state.revision}-${state.seq}` }, { primary: true, disabled: !!busy.length })}</div><p id="order-total" class="subtle">共 ${W.COST[defaultMaterial]} 枚，委託時扣款；不足先欠。下月開店交付，合法正整數不限數量。</p>${routeControls}${W.nextUnknown(state) ? `<div class="actions">${button('探索未辨識材料 · 6 枚', { type: 'explore', requestId: `explore-ui-${state.revision}-${state.seq}` }, { primary: true, disabled: !!busy.length || exploring })}</div><p class="help">${exploring ? '已有一條線索在探索，等回報後才有下一條。' : `下月帶回新材料 ${W.explorationQuantity(state)} 個；辨識後才可採購與學習相關配方。`}</p>` : '<p class="help">這批材料已辨識，暫時沒有新探索線索。</p>'}</div>` : '<p class="empty">目前櫃臺沒有人；新委託要等本人在場。已接受的委託仍按月處理。</p>'}${W.roadState(state) === 'restored' ? '<p class="help">舊驛道已重通：往後新探索多帶一份材料。</p>' : ''}<h3 class="orders-heading">材料委託紀錄</h3><ul class="order-list">${state.orders.slice().reverse().map(o => `<li>採購 · ${W.PEOPLE[o.npc].name} · ${o.material} ${o.quantity} 個 · ${o.status === 'pending' ? `第 ${o.due} 月交付` : '已交付'}</li>`).join('')}${state.explorations.slice().reverse().map(e => `<li>探索 · ${W.PEOPLE[e.npc].name} · ${e.status === 'pending' ? `未知材料線索，第 ${e.due} 月回報` : `${e.material} ${e.quantity} 個，已辨識`}</li>`).join('')}${state.journey.outings.slice().reverse().map(o => `<li>${o.kind === 'scout' ? '近程勘路' : '驛道採集'} · 小禾 · ${o.material} ${o.quantity} 個 · ${o.status === 'pending' ? `第 ${o.due} 月交付` : '已交付'}</li>`).join('')}${!state.orders.length && !state.explorations.length && !state.journey.outings.length ? '<li>尚無材料委託。</li>' : ''}</ul></div>`;
  }
  function renderMail() {
    const selectedMonth = mailMonth === null ? state.month : mailMonth;
    const months = [...new Set([state.month, ...state.news.map(n => n.month)])].sort((a, b) => b - a);
    const entries = [...state.returns.filter(o => o.status === 'offered').map(o => ({ offer: o })), ...state.news.filter(n => n.month === selectedMonth).slice().reverse().map(n => ({ letter: n }))];
    const page = paginate(entries, 'mail');
    return `<div class="section-head"><h2>窗邊鳥信</h2><label class="mail-month">月份<select id="mail-month">${months.map(m => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>第 ${m} 月</option>`).join('')}</select></label></div><div class="list panel-scroll">${page.items.map(entry => {
      if (entry.offer) { const o = entry.offer; return `<article class="letter new"><h3>${W.PEOPLE[o.npc].name}願意贈還${itemLabel(state.items[o.itemId])}</h3><p>裝備已因磨損暫停使用，以手邊備用品接替。請等對方到櫃臺，當面收下才取得實物；之後可修復再售或熔鍊。</p></article>`; }
      const n = entry.letter; return `<article class="letter ${n.month === state.month ? 'new' : ''}"><div class="letter-meta">第 ${n.month} 月${n.itemId ? ` · ${itemLabel(state.items[n.itemId])}` : ''}</div><p>${escape(n.text)}</p></article>`;
    }).join('') || '<p class="empty">魔法鳥還沒送信。下一次開店時會更新情報。</p>'}</div>${page.pager}`;
  }
  function renderPeople() {
    return `<div class="section-head"><h2>溪岸的人們</h2><span class="subtle">只記錄已相識的人</span></div><div class="list panel-scroll">${W.knownPeople(state).map(id => {
      const p = W.PEOPLE[id], progress = W.characterProgress(state, id), gear = W.owned(state, id);
      return `<article class="person"><h3>${p.name} <span class="subtle">${p.role}</span></h3><p>等級 ${progress.level} · ${progress.abilityName} ${progress.ability}</p><p class="help">${escape(progress.abilityText)}</p><h4>目前目標：${escape(progress.goalTitle)}${progress.completed ? '（已完成）' : ''}</h4><p>${escape(progress.hint)}</p><h4>已完成經歷</h4>${progress.history.length ? `<ul>${progress.history.map(e => `<li>第 ${e.month} 月｜${escape(e.title)}${e.grows ? `（${progress.abilityName}＋1）` : '（紀錄，不重複加能力）'}</li>`).join('')}</ul>` : '<p class="subtle">尚未留下實際行動經歷。</p>'}<p>信任 ${state.npcs[id].trust} · 累計交易 ${Object.values(state.items).reduce((n, i) => n + i.history.filter(h => h.text.startsWith(p.name + '買下')).length, 0)} 次</p>${state.npcs[id].story ? `<p>${escape(state.news.find(n => n.id === `story-v2-${id}`)?.text || '實際使用紀錄保留在收藏簿。')}</p>` : ''}<h4>持有裝備</h4>${gear.length ? `<ul class="trait-effects">${gear.map(i => `<li>${itemLabel(i)}：效能 ${W.performance(i)} · 耐久 ${i.durability}／${i.maxDurability}；${W.traitDetails(i)}。</li>`).join('')}</ul>` : '<p class="subtle">目前沒有工坊物品。</p>'}${state.npcs[id].goldDone ? '<p>金鈴委託已完成。</p>' : ''}</article>`;
    }).join('')}</div>`;
  }
  function renderCollection() {
    const items = Object.values(state.items);
    const page = paginate(items.slice().reverse(), 'collection', 4);
    return `<div class="section-head"><h2>收藏簿</h2></div><p class="stats">製作 ${items.length} 件 · 配方 ${new Set(items.map(i => i.recipe)).size}／6 種 · 熔鍊 ${state.legacies.length} 件 · 鑑定 ${state.xp.appraisal}</p><div class="list panel-scroll">${page.items.map(i => itemCard(i, true)).join('') || '<p class="empty">製作第一件作品，收藏簿就會開始記錄。</p>'}</div>${page.pager}`;
  }
  function renderSettings() {
    return `<div class="section-head"><h2>保存與備份</h2></div><div class="settings panel-scroll"><p>操作後自動保存在這個瀏覽器。清除瀏覽器資料會移除進度，請定期匯出備份。</p>${saveProblem ? `<p class="save-warning">${escape(saveProblem)}</p>` : ''}<div class="actions"><button data-tool="export" class="primary">匯出 JSON 備份</button><button data-tool="import">匯入備份</button><button data-tool="raw">匯出原始存檔</button><button data-tool="new" class="danger">重新開始</button></div><p class="help">匯入與重新開始會取代目前進度，確認前可取消。</p><details class="rules"><summary>查看工坊規則</summary><h3>時間與款項</h3><p>開店前進一個月，收取交貨與鳥信，支付生活費 8 枚。關店不換月；兩種狀態都能製作。採購與贈還只能向當前櫃臺人物辦理；辦完送客才換下一位。款項不足先記欠款，銷售所得優先還款。</p><h3>製作</h3><p>開始製作扣材料，基本作品 1 個月、複雜作品 2 個月；只在開店換月推進，必定完成。沒有工時額度或製作容量限制。${W.knownMaterials(state).join('、')}是目前辨識的材料；新材料經探索逐步發現。物品售價只按品質區分：樸實 14、細緻 20、精良 26 枚。</p><h3>裝備與傳承</h3><p>鑑定後顯示效能與耐久；基本特性不用先鑑定。${W.traitDetails(Object.keys(W.TRAITS).filter(t => W.visibleRecipes(state).some(r => W.RECIPES[r].trait === t) || Object.values(state.items).some(i => i.traits.includes(t))))}。NPC 實際使用才磨耗，磨損後當面贈還；每件可免費練習修復一次，或熔鍊把特性傳給同材質新作，最多兩個。</p><h3>保存</h3><p>固定使用同一網址與瀏覽器。匯入會先驗證備份；壞檔不覆蓋目前進度。</p></details></div>`;
  }
  function currentGuidance() {
    const t = W.tutorialStep(state), v = W.activeVisit(state);
    if (t.step >= 5 && W.knownMaterials(state).length === 2) return { title: '探索新材料線索', text: '向在場人物委託探索，下月辨識後再談新裝備。', full: '未知材料不能先採購或製作；探索與採購、客人製作委託共用每人一件限制。' };
    if (t.step < 5) return { title: t.title, text: compactGoal(t), full: t.text };
    if (v && v.phase === 'request' && v.npc === 'he' && !v.asked && !state.visits.some(x => x.npc === 'he' && x.status === 'done')) return { title: '小禾帶來新需求', text: '問清用途，開始合用作品或接受製作委託；完工再交易。', full: '先聽小禾的需求。你會從這次對話學到新的配方。' };
    if (W.canAppraise(state) && !state.xp.appraisal && v?.npc === 'he' && W.inventory(state).some(i => W.suitable(state, i, v))) return { title: '小禾想了解品質', text: '可先鑑定並保留詳細資料，也能直接推薦或交付合用作品。', full: '鑑定是選用建議，不是交易門檻；不耗材料或月份，每件一次。完工報告不代替鑑定；鑑定讓作品架與收藏顯示品質、效能及當前耐久，並累積鑑定經驗。' };
    if (state.returns.some(o => o.status === 'offered') && !state.returns.some(o => o.status === 'accepted')) return { title: '鳥信裡有舊物要歸還', text: '讀贈還信；等本人到櫃臺時當面領回。', full: '原持有者因磨損退役舊物，願意當面贈還。只有本人在櫃臺時才可收下，物品才回到工坊。' };
    if (!state.legacies.length && W.inventory(state).some(i => i.returned)) return { title: '舊物回到工坊', text: '先修復再售，或熔鍊回收材料與特性。', full: '再售會轉給新持有者；熔鍊會消耗原物，得到原材料與一次同材質傳承。' };
    return null;
  }
  function renderMonthReview() {
    const r = state.monthReview, entry = r.entries[r.cursor], finished = entry.kind === 'finished';
    const group = r.entries.filter(e => e.kind === entry.kind), groupIndex = r.entries.slice(0, r.cursor + 1).filter(e => e.kind === entry.kind).length;
    let detail;
    if (finished) {
      const i = state.items[entry.itemId], recipe = W.RECIPES[i.recipe], owner = i.reservedFor && state.commissions.find(c => c.id === i.reservedFor);
      detail = `<h3>${recipe.name} · ${W.QUALITY[i.quality]}</h3><dl class="review-details"><div><dt>材料／階級</dt><dd>${i.material}／第 ${recipe.tier} 階</dd></div><div><dt>效能</dt><dd>${W.performance(i)}</dd></div><div><dt>耐久</dt><dd>${i.durability}／${i.maxDurability}</dd></div><div><dt>特性</dt><dd>${W.traitDetails(i)}</dd></div><div><dt>預訂</dt><dd>${owner ? `保留給${W.PEOPLE[owner.npc].name}，當面交貨才付款` : '沒有預訂，放上作品架'}</dd></div></dl><p class="help">這是本次完工報告，尚未鑑定。鑑定可永久標示詳細資料並累積經驗。</p>`;
    } else {
      detail = `<h3>生活費 · 支出 ${entry.amount} 枚</h3><p>現金扣除 ${entry.cashPaid} 枚${entry.debtAdded ? `；不足的 ${entry.debtAdded} 枚記為新增欠款` : '，沒有新增欠款'}。</p><p class="help">只列這次換月的實際收支；先前已付的採購／派遣款不再扣，未交貨作品不先收款。</p>`;
    }
    return `<section class="month-review" aria-label="月結逐筆閱覽"><div class="section-head"><h2>第 ${r.month} 月 · ${finished ? '完工報告' : '收支結算'}</h2><span class="subtle">${finished ? '作品' : '收支'} ${groupIndex}／${group.length} · 全部 ${r.cursor + 1}／${r.entries.length}</span></div><article class="review-card">${detail}</article><div class="review-actions">${button(r.cursor + 1 === r.entries.length ? '閱完了，開始接客' : '下一筆', { type: 'review-next', month: r.month, cursor: r.cursor }, { primary: true })}</div><p class="subtle">${saveProblem ? '目前無法保存閱覽進度。' : '進度已隨存檔保留。'}閱完才進入櫃臺，不會再次結算。</p></section>`;
  }
  function render() {
    const inv = W.inventory(state), guidance = currentGuidance();
    const panelScroll = document.querySelector('.panel-scroll')?.scrollTop || 0;
    const counterScroll = document.querySelector('.counter-scroll')?.scrollTop || 0;
    const peopleVisible = W.knownPeople(state).length > 0;
    const collectionVisible = state.returns.some(o => o.status === 'accepted');
    const allowedTabs = ['craft', 'inventory', ...(W.openingDone(state) ? ['purchase'] : []), ...(W.openingDone(state) ? ['mail'] : []), ...(peopleVisible ? ['people'] : []), ...(collectionVisible ? ['collection'] : []), 'settings'];
    if (!allowedTabs.includes(tab)) tab = 'craft';
    $('ledger').innerHTML = `<span>硬幣 <strong>${state.coins}</strong></span><span>欠款 <strong class="${state.debt ? 'debt' : ''}">${state.debt}</strong></span>${W.openingDone(state) ? `<span>聲望 <strong>${state.reputation}</strong></span>` : ''}`;
    if (W.pendingReview(state)) {
      $('app').innerHTML = renderMonthReview();
      $('save-status').textContent = saveProblem || (savedRaw ? '進度已保存' : '操作後自動保存');
      return;
    }
    const doorHtml = `<span class="door-label">${state.month ? `第 ${state.month} 月` : '準備月 0'}<span>${state.open ? '營業中' : '關店中'}</span></span>${button('開店', { type: 'open' }, { primary: true, disabled: state.open })}${button('關店', { type: 'close' }, { disabled: !state.open })}`;
    const panels = { craft: renderCraft, inventory: renderInventory, purchase: renderPurchase, mail: renderMail, people: renderPeople, collection: renderCollection, settings: renderSettings };
    const materials = W.knownMaterials(state);
    $('app').innerHTML = `${guidance ? `<section class="guide" aria-label="目前目標"><h2>${guidance.title}</h2><p>${guidance.text}</p><button data-tool="guide">說明</button></section>` : ''}<div class="layout${state.open ? '' : ' closed'}"><aside class="counter${state.open ? '' : ' door-only'}"><div class="counter-heading"><h2>櫃臺</h2><span>${state.open ? `等候 ${state.visits.filter(v => v.status === 'waiting' && v.id !== W.activeVisit(state)?.id).length} 位` : '人物互動暫休'}</span></div><div id="door" class="door-controls">${doorHtml}</div>${state.open ? `<div class="counter-scroll">${renderVisitor()}</div><div class="counter-tools"><button data-tool="log">工坊記事</button><button data-tool="about">工坊簡介</button></div>` : ''}</aside><section class="workbench" aria-label="工坊工作區"><nav class="tabs" role="tablist" aria-label="工坊功能">${tabButton('craft', '工作臺')}${tabButton('inventory', '作品架')}${W.openingDone(state) ? tabButton('purchase', '委託採購') : ''}${W.openingDone(state) ? tabButton('mail', `鳥信${state.returns.some(o => o.status === 'offered') ? '（有舊物）' : ''}`) : ''}${peopleVisible ? tabButton('people', '人物') : ''}${collectionVisible ? tabButton('collection', '收藏簿') : ''}${tabButton('settings', '保存')}</nav><div class="materials-bar" aria-label="材料櫃">${materials.map(m => `<span class="material-chip">${m} <strong>${state.materials[m]}</strong></span>`).join('')}<span class="bench-count">庫存 ${inv.length} 件${state.orders.some(o => o.status === 'pending') ? ` · 待交 ${state.orders.filter(o => o.status === 'pending').length} 筆` : ''}</span></div><section class="panel" id="panel" role="tabpanel">${panels[tab]()}</section>${!state.open ? '<div class="counter-tools"><button data-tool="log">工坊記事</button><button data-tool="about">工坊簡介</button></div>' : ''}</section></div>`;
    if (renderedTab === tab && !resetPanelScroll) document.querySelector('.panel-scroll')?.scrollTo(0, panelScroll);
    document.querySelector('.counter-scroll')?.scrollTo(0, counterScroll);
    renderedTab = tab; resetPanelScroll = false;
    $('save-status').textContent = saveProblem || (savedRaw ? '進度已保存' : '操作後自動保存');
  }
  function showInfo(title, copy) {
    $('info-title').textContent = title; $('info-copy').innerHTML = copy;
    $('info-dialog').showModal();
  }
  async function confirm(title, copy, label = '確定') {
    $('confirm-title').textContent = title; $('confirm-copy').textContent = copy; $('confirm-yes').textContent = label;
    const dialog = $('confirm-dialog'); dialog.returnValue = ''; dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true }));
  }
  function download(text, name) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function act(action) {
    try {
      try {
        const current = localStorage.getItem(KEY);
        if (!saveProblem && current !== savedRaw && current !== null) {
          state = W.importSave(current); savedRaw = current; render();
          throw new Error('另一個視窗已更新進度。已同步，請重新選擇操作。');
        }
      } catch (error) { if (error.message.includes('另一個視窗')) throw error; }
      if (action.expectedRevision !== undefined && action.expectedRevision !== state.revision) throw new Error('這個操作已處理，請使用目前畫面的按鈕。');
      if (action.type === 'gather-route-form') action = { ...action, type: 'gather-route', material: $('order-material').value };
      if (action.type === 'order-form') {
        action = { ...action, type: 'order', material: $('order-material').value, quantity: Number($('order-quantity').value) };
      }
      if (action.type === 'smelt' && !await confirm('熔鍊／拆解這件舊物？', '原物會變成材料與一份傳承，不能再售。故事仍留在收藏簿。', '熔鍊傳承')) { render(); return; }
      const result = W.dispatch(state, action); state = result.state; save();
      if (action.type === 'sell' && W.openingDone(state) && !state.tutorial.ordered) tab = 'purchase';
      if (action.type === 'open') { mailMonth = null; pages.mail = 1; }
      if (action.type === 'open' && state.returns.some(o => o.status === 'offered')) tab = 'mail';
      render(); notify(result.message);
    } catch (error) { render(); notify(error.message, true); }
  }
  document.addEventListener('click', async event => {
    const b = event.target.closest('button'); if (!b || b.disabled) return;
    const pointerClick = event.detail > 0 || ['touch', 'pen'].includes(event.pointerType);
    if (pointerClick && reviewPointerGuard) {
      // The next click can target a newly rendered button with a fresh revision
      // and even reset detail to 1. Wait for this pointer burst to end as well.
      const now = performance.now();
      if (now < reviewPointerUntil || event.detail > 1) {
        reviewPointerUntil = now + 600;
        event.preventDefault(); event.stopPropagation(); return;
      }
      reviewPointerGuard = false;
    }
    if (b.dataset.action) {
      const action = JSON.parse(b.dataset.action);
      if (['open', 'review-next'].includes(action.type) && pointerClick) { reviewPointerGuard = true; reviewPointerUntil = performance.now() + 600; }
      b.disabled = true; await act(action); return;
    }
    if (b.dataset.tab) { tab = b.dataset.tab; resetPanelScroll = true; render(); document.querySelector(`[data-tab="${tab}"]`)?.focus({ preventScroll: true }); return; }
    if (b.dataset.page && Object.hasOwn(pages, b.dataset.page)) { pages[b.dataset.page] = Number(b.dataset.number); resetPanelScroll = true; render(); document.querySelector('.pagination button:not(:disabled)')?.focus({ preventScroll: true }); return; }
    if (b.dataset.tool === 'guide') { const g = currentGuidance(); if (g) showInfo(g.title, `<p>${escape(g.full)}</p>`); }
    if (b.dataset.tool === 'about') showInfo('溪岸的工坊', '<p>你是工坊學徒。熟客會帶著需求上門，也會把物品帶回生活裡使用。魔法鳥替你們傳信。</p>');
    if (b.dataset.tool === 'log') showInfo('工坊記事', `<ol class="log-list">${state.log.slice().reverse().map(t => `<li>${escape(t)}</li>`).join('')}</ol>`);
    if (b.dataset.tool === 'export') { download(W.exportSave(state), `鳥信工坊-第${state.month}月.json`); notify('已匯出備份。請在瀏覽器下載紀錄確認檔案。'); }
    if (b.dataset.tool === 'raw') { try { download(localStorage.getItem(KEY) || W.exportSave(state), '鳥信工坊-原始存檔.json'); } catch (e) { notify('無法讀取原始存檔，請匯出目前進度。', true); } }
    if (b.dataset.tool === 'import') $('import-file').click();
    if (b.dataset.tool === 'new' && await confirm('重新開始這間工坊？', '目前進度會被替換。若想保留，請先取消並匯出 JSON 備份。', '重新開始')) { state = W.initialState(); saveProblem = ''; tab = 'craft'; save(); render(); notify('新的一間工坊準備好了。先開始木杖與鐵劍，下次開店完工。'); }
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'recommend-item') {
      recommendations[event.target.dataset.visit] = event.target.value;
      render(); document.getElementById('recommend-item')?.focus({ preventScroll: true });
    }
    if (event.target.id === 'mail-month') { mailMonth = Number(event.target.value); pages.mail = 1; resetPanelScroll = true; render(); document.getElementById('mail-month')?.focus({ preventScroll: true }); }
  });
  document.addEventListener('input', event => {
    if (!['order-material', 'order-quantity'].includes(event.target.id)) return;
    const quantity = Number($('order-quantity').value), material = $('order-material').value;
    try { const cost = W.orderQuote(state, material, quantity); $('order-total').textContent = `共 ${cost} 枚，委託時扣款；不足的部分先記欠款。`; }
    catch (error) { $('order-total').textContent = error.message; }
  });
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('備份超過 8 MB，請選擇有效存檔。');
      const imported = W.importSave(await file.text());
      if (!await confirm('匯入這份工坊備份？', `第 ${imported.month} 月，${imported.open ? '營業中' : '關店中'}；${Object.keys(imported.items).length} 件作品。確認後取代目前進度。`, '匯入備份')) return;
      state = imported; saveProblem = ''; tab = 'craft'; save(); render(); notify('備份已匯入，可以接著遊玩。');
    } catch (error) { notify(`匯入失敗，現有進度保留。${error.message}`, true); }
  });
  window.addEventListener('storage', event => {
    if (event.key !== KEY || !event.newValue) return;
    try { state = W.importSave(event.newValue); savedRaw = event.newValue; render(); notify('另一個工坊視窗更新了進度，這裡已同步。'); } catch (e) { notify('另一個視窗的存檔無法讀取，目前進度保留。', true); }
  });
  render(); if (startNotice) notify(startNotice, !!saveProblem);
})();
