(() => {
  'use strict';
  const W = window.Workshop, KEY = 'birdsong-workshop-save-v1';
  let state = W.initialState(), tab = 'craft', savedRaw = null, saveProblem = '', startNotice = '';
  const pages = { inventory: 1, mail: 1, collection: 1 };
  const recommendations = {};
  let renderedTab = null, resetPanelScroll = false, mailMonth = null;
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
    const data = { ...action, expectedRevision: state.revision };
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
      1: '木頭做木杖，鐵做鐵劍；製作不耗月份。',
      2: state.open ? '聽阿岑的用途，再逐件推薦兩把武器。' : '開店迎接阿岑；未完成的需求會跨月保留。',
      3: '先託阿岑買銅 1 個，下次開店交付。',
      4: state.open ? '關店，再開店收材料與鳥信。' : '按開店收取材料與鳥信。',
      5: '聽用途、做合用商品、推薦，再規劃下批採購。'
    }[t.step];
  }
  function itemLabel(i) { return W.RECIPES[i.recipe].name; }
  function requestText(v) {
    if (v.kind === 'intro' && v.needs.length === 1) return `剛才那件我收好了。現在還需要${W.RECIPES[v.needs[0]].name}，也由我帶著。`;
    if (v.asked) return W.requestDetail(v);
    if (v.kind === 'intro') return '我想買兩把不同武器，都是我自己用。';
    if (v.kind === 'commission') return '想委託一只金鈴，提醒孩子們還書；完成多付 12 枚。';
    return { watering: '菜圃的嫩芽怕缺水，想請你做件澆水的工具。', stool: '整理種子時，想在菜圃坐下歇歇腳。', staff: '這個月要走夜路，想帶一件照路的東西。', sword: '想帶一件防身工具出門。', lamp: '圖書室想晚些關門，想請你做盞燈。' }[v.needs[0]] || '想請你推薦一件合用的物品。';
  }
  function renderVisitor() {
    const v = W.activeVisit(state);
    if (!state.open) return `<section class="visitor"><h3>櫃臺暫休</h3><p class="help">工作臺仍可製作。${state.visits.some(v => v.status === 'waiting') ? '未完成的需求留到下次開店。' : ''}</p></section>`;
    if (!v) return `<section class="visitor"><h3>這一輪來客已處理完</h3><p class="help">${W.openingDone(state) && !state.tutorial.ordered ? '阿岑：「我在門口等你交代採購清單。」' : '準備好下批材料後，關店再開店。'}</p></section>`;
    const person = W.PEOPLE[v.npc], choices = W.inventory(state).filter(i => W.suitable(state, i, v));
    const selected = choices.find(i => i.id === recommendations[v.id]) || choices[0];
    if (selected) recommendations[v.id] = selected.id;
    return `<section class="visitor" aria-label="目前顧客"><div class="visitor-head"><span class="portrait" aria-hidden="true">${person.name.slice(-1)}</span><div><h3>${person.name} <span class="subtle">${person.role}</span></h3><small>信任 ${state.npcs[v.npc].trust}・持有 ${W.owned(state, v.npc).length} 件${v.month < state.month ? '・保留需求' : ''}</small></div></div><blockquote>「${requestText(v)}」</blockquote>${v.asked ? '' : button('多問一句', { type: 'talk', visitId: v.id })}${choices.length ? `<label class="recommend-label">可推薦的作品<select id="recommend-item" data-visit="${escape(v.id)}">${choices.map((i, index) => `<option value="${i.id}" ${i === selected ? 'selected' : ''}>${itemLabel(i)} · ${W.price(i)} 枚${i.returned ? ' · 舊物' : ''}${choices.length > 2 ? `（${index + 1}）` : ''}</option>`).join('')}</select></label><div id="recommend-action" class="actions">${button(`推薦${itemLabel(selected)} · ${W.price(selected) + (v.kind === 'commission' ? 12 : 0)} 枚`, { type: 'sell', itemId: selected.id, visitId: v.id }, { primary: true })}</div>` : v.asked ? '<p class="help">作品架還沒有合用的物品。</p>' : ''}${v.kind !== 'intro' ? `<div class="actions">${button('婉拒本次需求', { type: 'decline', visitId: v.id })}</div>` : ''}</section>`;
  }
  function renderCraft() {
    const current = W.activeVisit(state);
    const shown = W.visibleRecipes(state).sort((a, b) => current?.asked ? Number(current.needs.includes(b)) - Number(current.needs.includes(a)) : 0);
    return `<div class="section-head"><h2>工作臺</h2>${state.tutorial.delivered ? `<span class="subtle">製作經驗 ${state.xp.craft}${W.canAppraise(state) ? ` · 鑑定 ${state.xp.appraisal}` : ''}</span>` : ''}</div><div class="panel-scroll"><div class="recipes">${shown.map(id => {
      const r = W.RECIPES[id], unlocked = W.unlocked(state, id), enough = state.materials[r.material] > 0;
      return `<article class="recipe"><div class="recipe-top"><span class="glyph" aria-hidden="true">${r.symbol}</span><div><h3>${r.name}</h3><small>${r.material} 1 個</small></div>${current?.asked && current.needs.includes(id) ? '<span class="badge">合用</span>' : ''}</div><p>${r.use}。</p>${unlocked ? button(enough ? `製作${r.name}` : `缺${r.material}`, { type: 'craft', recipe: id }, { primary: enough, disabled: !enough }) : ''}</article>`;
    }).join('')}</div></div>`;
  }
  function itemCard(i, collection = false) {
    const r = W.RECIPES[i.recipe], v = W.activeVisit(state);
    const status = { inventory: i.returned ? '贈還舊物' : '工坊庫存', owned: `${W.PEOPLE[i.owner]?.name || ''}持有`, smelted: '已熔鍊／拆解' }[i.status];
    const legacyName = i.legacy && state.items[i.legacy] ? itemLabel(state.items[i.legacy]) : null;
    return `<article class="item"><div class="item-header"><div><h3>${r.name}${i.appraised ? ` <span class="badge">${W.QUALITY[i.quality]}</span>` : ''}</h3><span class="subtle">${status}</span></div><strong>${W.price(i)} 枚</strong></div>${i.appraised ? `<p>${i.material}第 ${r.tier} 階 · ${r.use}。</p>` : ''}${legacyName ? `<p>承接${legacyName}的傳承。</p>` : ''}${!collection ? `<div class="actions">${W.suitable(state, i, v) ? button('推薦給目前顧客', { type: 'sell', itemId: i.id, visitId: v.id }, { primary: true }) : ''}${W.canAppraise(state) ? button(i.appraised ? '已鑑定' : '鑑定物品', { type: 'appraise', itemId: i.id }, { disabled: i.appraised }) : ''}${i.returned ? button('熔鍊／拆解', { type: 'smelt', itemId: i.id }) : ''}</div>` : ''}${collection ? `<details><summary>物品故事（${i.history.length} 筆）</summary><p class="item-id">物品編號 ${i.id}</p><ul class="item-history">${i.history.map(h => `<li>第 ${h.month} 月：${escape(h.text)}</li>`).join('')}</ul></details>` : ''}</article>`;
  }
  function renderInventory() {
    const items = W.inventory(state);
    const page = paginate(items, 'inventory');
    return `<div class="section-head"><h2>作品架</h2><span class="subtle">${items.length} 件可售物品</span></div><div class="list panel-scroll">${items.length ? page.items.map(i => itemCard(i)).join('') : '<p class="empty">作品架還空著。製作完成的物品會放在這裡；售出後由顧客持有。</p>'}</div>${page.pager}`;
  }
  function renderPurchase() {
    return `<div class="section-head"><h2>委託採購</h2><span class="subtle"></span></div><div class="panel-scroll"><div class="purchase"><p>「清單交給我。下趟路過材料鋪，我替你帶回來。」</p><div class="purchase-grid"><label>材料<select id="order-material">${W.MATERIALS.map(m => `<option value="${m}" ${m === '銅' ? 'selected' : ''}>${m} · ${W.COST[m]} 枚／個</option>`).join('')}</select></label><label>數量<input id="order-quantity" type="number" min="1" max="9" step="1" value="1" inputmode="numeric"></label>${button('委託阿岑採購', { type: 'order-form', requestId: `ui-${state.revision}-${state.seq}` }, { primary: true })}</div><p id="order-total" class="subtle">共 10 枚，委託時扣款；不足的部分先記欠款。</p><p class="help">第 ${state.month + 1} 月開店時交貨。</p></div><h3 class="orders-heading">採購紀錄</h3><ul class="order-list">${state.orders.slice().reverse().map(o => `<li>${o.material} ${o.quantity} 個 · ${o.cost} 枚 · ${o.status === 'pending' ? `等第 ${o.due} 月交付` : `第 ${o.deliveredMonth} 月已交付`}</li>`).join('') || '<li>還沒有訂單。先帶回一份銅，迎接菜圃的新需求。</li>'}</ul></div>`;
  }
  function renderMail() {
    const selectedMonth = mailMonth === null ? state.month : mailMonth;
    const months = [...new Set([state.month, ...state.news.map(n => n.month)])].sort((a, b) => b - a);
    const entries = [...state.returns.filter(o => o.status === 'offered').map(o => ({ offer: o })), ...state.news.filter(n => n.month === selectedMonth).slice().reverse().map(n => ({ letter: n }))];
    const page = paginate(entries, 'mail');
    return `<div class="section-head"><h2>窗邊鳥信</h2><label class="mail-month">月份<select id="mail-month">${months.map(m => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>第 ${m} 月</option>`).join('')}</select></label></div><div class="list panel-scroll">${page.items.map(entry => {
      if (entry.offer) { const o = entry.offer; return `<article class="letter new"><h3>${W.PEOPLE[o.npc].name}願意贈還${itemLabel(state.items[o.itemId])}</h3><p>對方已退役這件舊物，以備用品接替。接受贈還才取得實物，可再售或熔鍊，沒有費用。</p><div class="actions">${button('接受贈還舊物', { type: 'reclaim', itemId: o.itemId }, { primary: true })}</div></article>`; }
      const n = entry.letter; return `<article class="letter ${n.month === state.month ? 'new' : ''}"><div class="letter-meta">第 ${n.month} 月${n.itemId ? ` · ${itemLabel(state.items[n.itemId])}` : ''}</div><p>${escape(n.text)}</p></article>`;
    }).join('') || '<p class="empty">魔法鳥還沒送信。下一次開店時會更新情報。</p>'}</div>${page.pager}`;
  }
  function renderPeople() {
    return `<div class="section-head"><h2>溪岸的人們</h2></div><div class="list panel-scroll">${Object.entries(W.PEOPLE).map(([id, p]) => `<article class="person"><h3>${p.name} <span class="subtle">${p.role}</span></h3><p>信任 ${state.npcs[id].trust} · 累計交易 ${state.items ? Object.values(state.items).reduce((n, i) => n + i.history.filter(h => h.text.startsWith(p.name + '買下')).length, 0) : 0} 次</p><p>${state.npcs[id].story ? p.story : '多聽用途、提供合用的物品，彼此會更熟悉。'}</p><p class="subtle">持有：${W.owned(state, id).map(i => `${itemLabel(i)}`).join('、') || '目前沒有工坊物品'}${state.npcs[id].goldDone ? '。金鈴委託已完成。' : ''}</p></article>`).join('')}</div>`;
  }
  function renderCollection() {
    const items = Object.values(state.items);
    const page = paginate(items.slice().reverse(), 'collection', 4);
    return `<div class="section-head"><h2>收藏簿</h2></div><p class="stats">製作 ${items.length} 件 · 配方 ${new Set(items.map(i => i.recipe)).size}／6 種 · 熔鍊 ${state.legacies.length} 件 · 鑑定 ${state.xp.appraisal}</p><div class="list panel-scroll">${page.items.map(i => itemCard(i, true)).join('') || '<p class="empty">製作第一件作品，收藏簿就會開始記錄。</p>'}</div>${page.pager}`;
  }
  function renderSettings() {
    return `<div class="section-head"><h2>保存與備份</h2></div><div class="settings panel-scroll"><p>操作後自動保存在這個瀏覽器。清除瀏覽器資料會移除進度，請定期匯出備份。</p>${saveProblem ? `<p class="save-warning">${escape(saveProblem)}</p>` : ''}<div class="actions"><button data-tool="export" class="primary">匯出 JSON 備份</button><button data-tool="import">匯入備份</button><button data-tool="raw">匯出原始存檔</button><button data-tool="new" class="danger">重新開始</button></div><p class="help">匯入與重新開始會取代目前進度，確認前可取消。</p><details class="rules"><summary>查看工坊規則</summary><h3>時間與款項</h3><p>開店前進一個月，收取交貨與鳥信，支付生活費 8 枚。關店不換月；兩種狀態都能製作。款項不足先記欠款，銷售所得優先還款。</p><h3>製作</h3><p>材料充足就必定成功。木頭、鐵、銅、銀、金依序第 1 至 5 階。物品售價只按品質區分：樸實 14、細緻 20、精良 26 枚。</p><h3>保存</h3><p>固定使用同一網址與瀏覽器。匯入會先驗證備份；壞檔不覆蓋目前進度。</p></details></div>`;
  }
  function currentGuidance() {
    const t = W.tutorialStep(state), v = W.activeVisit(state);
    if (t.step < 5) return { title: t.title, text: compactGoal(t), full: t.text };
    if (v && v.npc === 'he' && !v.asked && !state.visits.some(x => x.npc === 'he' && x.status === 'done')) return { title: '小禾帶來新需求', text: '問清用途，再做一件合用的工具。', full: '先聽小禾的需求。你會從這次對話學到新的配方。' };
    if (W.canAppraise(state) && !state.xp.appraisal && v?.npc === 'he' && W.inventory(state).some(i => W.suitable(state, i, v))) return { title: '小禾想了解品質', text: '到作品架鑑定這件物品，再向她推薦。', full: '鑑定不耗材料或月份。你可以看出物品的品質，每件鑑定一次。' };
    if (state.returns.some(o => o.status === 'offered') && !state.returns.some(o => o.status === 'accepted')) return { title: '鳥信裡有舊物要歸還', text: '讀贈還信，接受後才收到實物。', full: '原持有者願意把已退役的舊物贈還。接受贈還後，物品才回到工坊。' };
    if (!state.legacies.length && W.inventory(state).some(i => i.returned)) return { title: '舊物回到工坊', text: '可再售或熔鍊回收材料，故事留在收藏簿。', full: '再售會轉給新持有者；熔鍊會消耗原物，得到原材料與一次同材質傳承。' };
    return null;
  }
  function render() {
    const inv = W.inventory(state), guidance = currentGuidance();
    const panelScroll = document.querySelector('.panel-scroll')?.scrollTop || 0;
    const counterScroll = document.querySelector('.counter-scroll')?.scrollTop || 0;
    const peopleVisible = state.npcs.he.story || state.npcs.shu.story;
    const collectionVisible = state.returns.some(o => o.status === 'accepted');
    const allowedTabs = ['craft', 'inventory', ...(W.openingDone(state) ? ['purchase'] : []), ...(state.tutorial.delivered ? ['mail'] : []), ...(peopleVisible ? ['people'] : []), ...(collectionVisible ? ['collection'] : []), 'settings'];
    if (!allowedTabs.includes(tab)) tab = 'craft';
    $('ledger').innerHTML = `<span>硬幣 <strong>${state.coins}</strong></span><span>欠款 <strong class="${state.debt ? 'debt' : ''}">${state.debt}</strong></span>${state.tutorial.delivered ? `<span>聲望 <strong>${state.reputation}</strong></span>` : ''}`;
    $('door').innerHTML = `<span class="door-label">${state.month ? `第 ${state.month} 月` : '準備月 0'}<span>${state.open ? '營業中' : '關店中'}</span></span>${button('開店', { type: 'open' }, { primary: true, disabled: state.open })}${button('關店', { type: 'close' }, { disabled: !state.open })}`;
    const panels = { craft: renderCraft, inventory: renderInventory, purchase: renderPurchase, mail: renderMail, people: renderPeople, collection: renderCollection, settings: renderSettings };
    const materials = W.openingDone(state) ? W.MATERIALS : ['木頭', '鐵'];
    $('app').innerHTML = `${guidance ? `<section class="guide" aria-label="目前目標"><h2>${guidance.title}</h2><p>${guidance.text}</p><button data-tool="guide">說明</button></section>` : ''}<div class="layout"><aside class="counter"><div class="counter-heading"><h2>櫃臺</h2><span>${state.open ? `等候 ${state.visits.filter(v => v.status === 'waiting').length} 位` : '暫停接客'}</span></div><div class="counter-scroll">${renderVisitor()}</div><div class="counter-tools"><button data-tool="log">工坊記事</button><button data-tool="about">工坊簡介</button></div></aside><section class="workbench" aria-label="工坊工作區"><nav class="tabs" role="tablist" aria-label="工坊功能">${tabButton('craft', '工作臺')}${tabButton('inventory', '作品架')}${W.openingDone(state) ? tabButton('purchase', '委託採購') : ''}${state.tutorial.delivered ? tabButton('mail', `鳥信${state.returns.some(o => o.status === 'offered') ? '（有舊物）' : ''}`) : ''}${peopleVisible ? tabButton('people', '人物') : ''}${collectionVisible ? tabButton('collection', '收藏簿') : ''}${tabButton('settings', '保存')}</nav><div class="materials-bar" aria-label="材料櫃">${materials.map(m => `<span class="material-chip">${m} <strong>${state.materials[m]}</strong></span>`).join('')}<span class="bench-count">庫存 ${inv.length} 件${state.orders.some(o => o.status === 'pending') ? ` · 待交 ${state.orders.filter(o => o.status === 'pending').length} 筆` : ''}</span></div><section class="panel" id="panel" role="tabpanel">${panels[tab]()}</section></section></div>`;
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
    if (b.dataset.action) { b.disabled = true; await act(JSON.parse(b.dataset.action)); return; }
    if (b.dataset.tab) { tab = b.dataset.tab; resetPanelScroll = true; render(); document.querySelector(`[data-tab="${tab}"]`)?.focus({ preventScroll: true }); return; }
    if (b.dataset.page && Object.hasOwn(pages, b.dataset.page)) { pages[b.dataset.page] = Number(b.dataset.number); resetPanelScroll = true; render(); document.querySelector('.pagination button:not(:disabled)')?.focus({ preventScroll: true }); return; }
    if (b.dataset.tool === 'guide') { const g = currentGuidance(); if (g) showInfo(g.title, `<p>${escape(g.full)}</p>`); }
    if (b.dataset.tool === 'about') showInfo('溪岸的工坊', '<p>你是工坊學徒。熟客會帶著需求上門，也會把物品帶回生活裡使用。魔法鳥替你們傳信。</p>');
    if (b.dataset.tool === 'log') showInfo('工坊記事', `<ol class="log-list">${state.log.slice().reverse().map(t => `<li>${escape(t)}</li>`).join('')}</ol>`);
    if (b.dataset.tool === 'export') { download(W.exportSave(state), `鳥信工坊-第${state.month}月.json`); notify('已匯出備份。請在瀏覽器下載紀錄確認檔案。'); }
    if (b.dataset.tool === 'raw') { try { download(localStorage.getItem(KEY) || W.exportSave(state), '鳥信工坊-原始存檔.json'); } catch (e) { notify('無法讀取原始存檔，請匯出目前進度。', true); } }
    if (b.dataset.tool === 'import') $('import-file').click();
    if (b.dataset.tool === 'new' && await confirm('重新開始這間工坊？', '目前進度會被替換。若想保留，請先取消並匯出 JSON 備份。', '重新開始')) { state = W.initialState(); saveProblem = ''; tab = 'craft'; save(); render(); notify('新的一間工坊準備好了。先做木杖與鐵劍。'); }
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
    $('order-total').textContent = Number.isInteger(quantity) && quantity >= 1 && quantity <= 9 ? `共 ${quantity * W.COST[material]} 枚，委託時扣款；不足的部分先記欠款。` : '數量請填 1 至 9 的整數。';
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
