(() => {
  'use strict';
  const W = window.Workshop, KEY = 'birdsong-workshop-save-v1';
  let state = W.initialState(), tab = 'craft', savedRaw = null, saveProblem = '', startNotice = '';
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
  function itemLabel(i) { return W.RECIPES[i.recipe].name; }
  function requestText(v) {
    if (v.kind === 'intro') return v.needs.length === 2 ? '我想買一把照路的木杖，再買一把巡路防身的鐵劍。兩件都由我使用。' : `剛才那件我收好了。現在還需要${W.RECIPES[v.needs[0]].name}，也由我帶著。`;
    if (v.kind === 'commission') return '大家信得過你的手藝。想正式委託一只金鈴，提醒孩子們還書；完成會多付 12 枚。';
    return { watering: '菜圃的嫩芽怕缺水。我需要一件方便澆水的工具。', stool: '整理種子時，我想在菜圃坐下歇歇腳。', staff: '這個月走夜路，需要一把能引導微光的木杖。', sword: '巡路要帶防身工具。請幫我挑一把鐵劍。', lamp: '圖書室想晚些關門，需要一盞明亮的銀燈。' }[v.needs[0]] || '想請你推薦一件合用的物品。';
  }
  function renderVisitor() {
    const v = W.activeVisit(state);
    if (!state.open) return `<section class="visitor"><h3>門牌朝內，工作臺仍亮著</h3><p class="help">${state.tutorial.delivered ? '關店時可以製作、採購與整理舊物。' : W.openingDone(state) ? '關店時可以製作，也可以交代採購清單。' : '先用工作臺做木杖與鐵劍，準備好再開店。'}按開店才換月；${state.visits.some(v => v.status === 'waiting') ? '未完成的顧客需求會保留，下次繼續。' : '準備好再迎接來客。'}</p></section>`;
    if (!v) return `<section class="visitor"><h3>這一輪來客已處理完</h3><p class="help">${W.openingDone(state) && !state.tutorial.ordered ? '阿岑在門口等你交代採購清單。請打開「委託採購」。' : '可以繼續製作、整理鳥信或委託採購。準備好後關店，再開店迎接下個月。'}</p></section>`;
    const person = W.PEOPLE[v.npc], choices = W.inventory(state).filter(i => W.suitable(state, i, v));
    return `<section class="visitor" aria-label="目前顧客"><div class="visitor-head"><span class="portrait" aria-hidden="true">${person.name.slice(-1)}</span><div><h3>${person.name} <span class="subtle">${person.role}</span></h3><small>信任 ${state.npcs[v.npc].trust}・持有 ${W.owned(state, v.npc).length} 件${v.month < state.month ? '・保留的需求' : ''}</small></div></div><p class="subtle">${person.greeting}</p><blockquote>「${requestText(v)}」<span class="need">適合推薦：${v.needs.map(k => W.RECIPES[k].name).join('、')}</span></blockquote>${v.asked ? '<p class="subtle">用途已了解。挑一件合用的，或先回工作臺製作。</p>' : button('詢問用途', { type: 'talk', visitId: v.id })}<div class="actions">${choices.map(i => button(`推薦${itemLabel(i)} · ${W.price(i) + (v.kind === 'commission' ? 12 : 0)} 枚`, { type: 'sell', itemId: i.id, visitId: v.id }, { primary: true })).join('')}${v.kind !== 'intro' ? button('婉拒本次需求', { type: 'decline', visitId: v.id }) : ''}</div>${!choices.length ? `<p class="help">庫存還沒有合用的物品。到工作臺製作${v.needs.map(k => W.RECIPES[k].name).join('或')}，缺材料可先委託採購。</p>` : ''}</section>`;
  }
  function renderCraft() {
    const current = W.activeVisit(state);
    const shown = state.tutorial.delivered ? Object.keys(W.RECIPES) : ['staff', 'sword'];
    const locks = { lamp: '製作經驗 4 或聲望 3', bell: '製作經驗 6 且聲望 5' };
    return `<div class="section-head"><h2>工作臺</h2><span class="subtle">製作必定成功，不換月</span></div><div class="recipes">${shown.map(id => {
      const r = W.RECIPES[id], unlocked = W.unlocked(state, id), enough = state.materials[r.material] > 0;
      return `<article class="recipe ${unlocked ? '' : 'locked'}"><div class="recipe-top"><span class="glyph" aria-hidden="true">${r.symbol}</span><div><h3>${r.name}</h3><small>第 ${r.tier} 階 · ${r.material} 1 個</small></div>${current && current.needs.includes(id) ? '<span class="badge">符合需求</span>' : ''}</div><p>${r.use}。${unlocked ? `現有${r.material} ${state.materials[r.material]} 個。` : `尚未學會：${locks[id] || '完成教學'}。`}</p>${unlocked ? button(enough ? `製作${r.name}` : `缺${r.material}`, { type: 'craft', recipe: id }, { primary: enough, disabled: !enough }) : ''}</article>`;
    }).join('')}</div>${state.tutorial.delivered ? '<p class="help">每完成一件增加製作經驗。每 3 點提升品質，最多精良；同材質的舊物傳承可額外提升品質。</p>' : ''}`;
  }
  function itemCard(i, collection = false) {
    const r = W.RECIPES[i.recipe], v = W.activeVisit(state);
    const status = { inventory: '工坊庫存', owned: `${W.PEOPLE[i.owner]?.name || ''}持有`, smelted: '已熔鍊／拆解' }[i.status];
    return `<article class="item"><div class="item-header"><div><h3>${r.name} <span class="badge">${W.QUALITY[i.quality]}</span>${i.returned ? ' <span class="badge">舊物</span>' : ''}</h3><span class="item-id">${i.id} · ${r.material}第 ${r.tier} 階 · ${status}</span></div><strong>${W.price(i)} 枚</strong></div><p>${r.use}${i.legacy ? `。承接 ${escape(i.legacy)} 的傳承` : ''}。</p>${!collection ? `<div class="actions">${W.suitable(state, i, v) ? button('推薦給目前顧客', { type: 'sell', itemId: i.id, visitId: v.id }, { primary: true }) : ''}${state.tutorial.delivered ? button(i.appraised ? '已鑑定' : '鑑定物品', { type: 'appraise', itemId: i.id }, { disabled: i.appraised }) : ''}${i.returned ? button('熔鍊／拆解傳承', { type: 'smelt', itemId: i.id }) : ''}</div>` : ''}${collection ? `<details><summary>物品故事（${i.history.length} 筆）</summary><ul class="item-history">${i.history.map(h => `<li>第 ${h.month} 月：${escape(h.text)}</li>`).join('')}</ul></details>` : ''}</article>`;
  }
  function renderInventory() {
    const items = W.inventory(state);
    return `<div class="section-head"><h2>作品架</h2><span class="subtle">${items.length} 件可售物品</span></div><div class="list">${items.length ? items.map(i => itemCard(i)).join('') : '<p class="empty">作品架還空著。製作完成的物品會放在這裡；售出後由顧客持有。</p>'}</div>`;
  }
  function renderPurchase() {
    return `<div class="section-head"><h2>委託採購</h2><span class="subtle">阿岑會在下次開店交貨</span></div><div class="purchase"><p>「清單交給我。下趟路過材料鋪，我替你帶回來。」</p><div class="purchase-grid"><label>材料<select id="order-material">${W.MATERIALS.map(m => `<option value="${m}" ${m === '銅' ? 'selected' : ''}>${m} · ${W.COST[m]} 枚／個</option>`).join('')}</select></label><label>數量<input id="order-quantity" type="number" min="1" max="9" step="1" value="1" inputmode="numeric"></label></div><p id="order-total" class="subtle">共 10 枚，委託時扣款；不足的部分先記欠款。</p><div class="actions">${button('委託阿岑採購', { type: 'order-form', requestId: `ui-${state.revision}-${state.seq}` }, { primary: true })}</div><p class="help">下次交付：第 ${state.month + 1} 月。關店後也能訂購；關店本身不交貨。</p></div><h3 style="margin-top:22px">採購紀錄</h3><ul class="order-list">${state.orders.slice().reverse().map(o => `<li>${o.material} ${o.quantity} 個 · ${o.cost} 枚 · ${o.status === 'pending' ? `等第 ${o.due} 月交付` : `第 ${o.deliveredMonth} 月已交付`} <small>${escape(o.id)}</small></li>`).join('') || '<li>還沒有訂單。先帶回一份銅，迎接菜圃的新需求。</li>'}</ul>`;
  }
  function renderMail() {
    return `<div class="section-head"><h2>窗邊鳥信</h2><span class="subtle">開店時更新</span></div><div class="list">${state.returns.filter(o => o.status === 'offered').map(o => `<article class="letter new"><h3>${W.PEOPLE[o.npc].name}願意贈還${itemLabel(state.items[o.itemId])}</h3><p>對方已退役這件舊物，以備用品接替。接受贈還才會取得實物，可再售或熔鍊。沒有費用。</p><div class="actions">${button('接受贈還舊物', { type: 'reclaim', itemId: o.itemId }, { primary: true })}</div></article>`).join('')}${state.news.slice().reverse().map(n => `<article class="letter ${n.month === state.month ? 'new' : ''}"><div class="letter-meta">第 ${n.month} 月${n.itemId ? ` · ${escape(n.itemId)}` : ''}</div><p>${escape(n.text)}</p></article>`).join('') || '<p class="empty">魔法鳥還沒送信。下一次開店時會更新情報。</p>'}</div>`;
  }
  function renderPeople() {
    return `<div class="section-head"><h2>溪岸的人們</h2><span class="subtle">固定角色，持續留下紀錄</span></div><div class="list">${Object.entries(W.PEOPLE).map(([id, p]) => `<article class="person"><h3>${p.name} <span class="subtle">${p.role}</span></h3><p>信任 ${state.npcs[id].trust} · 累計交易 ${state.items ? Object.values(state.items).reduce((n, i) => n + i.history.filter(h => h.text.startsWith(p.name + '買下')).length, 0) : 0} 次</p><p>${state.npcs[id].story ? p.story : '多聽用途、提供合用的物品，彼此會更熟悉。'}</p><p class="subtle">持有：${W.owned(state, id).map(i => `${itemLabel(i)}（${i.id}）`).join('、') || '目前沒有工坊物品'}${state.npcs[id].goldDone ? '。金鈴委託已完成。' : ''}</p></article>`).join('')}</div>`;
  }
  function renderCollection() {
    const items = Object.values(state.items);
    return `<div class="section-head"><h2>收藏簿</h2><span class="subtle">保存故事，也保存離開工坊的物品</span></div><p class="stats">製作 ${items.length} 件 · 配方 ${new Set(items.map(i => i.recipe)).size}／6 種 · 熔鍊 ${state.legacies.length} 件 · 鑑定經驗 ${state.xp.appraisal}</p><div class="list">${items.slice().reverse().map(i => itemCard(i, true)).join('') || '<p class="empty">製作第一件作品，收藏簿就會開始記錄。</p>'}</div>`;
  }
  function renderSettings() {
    return `<div class="settings"><h2>保存與備份</h2><p>每次有效操作都會自動保存於這個瀏覽器。本機存檔不會傳到網路；清除瀏覽器資料會移除進度。</p><p class="subtle">${escape(saveProblem || '自動保存可用。上一次狀態另有一份本機備份。')} 請固定使用同一個網址與瀏覽器。</p><div class="actions"><button data-tool="export" class="primary">匯出 JSON 備份</button><button data-tool="import">匯入備份</button><button data-tool="raw">匯出原始本機存檔</button><button data-tool="new" class="danger">重新開始</button></div><hr><h3>工坊時間</h3><p>初始準備月 0。每按一次開店，前進一個月並支付生活費 8 枚、收取交貨與鳥信。關店只停止營業；製作、採購與鑑定不換月。欠款不會結束遊戲。</p><h3>材料與成長</h3><p>木頭、鐵、銅、銀、金依序第 1 至 5 階。製作經驗解鎖配方與品質，鑑定每件一次增加鑑定經驗。詢問用途與成交增加信任，交易增加聲望。</p><h3>舊物的去向</h3><p>顧客使用後，第三個月可提出退役贈還。接受後才能再售或熔鍊；熔鍊得原材料 1 個，下一件同材質物品承接傳承。原物故事一直留在收藏簿。</p></div>`;
  }
  function render() {
    const t = W.tutorialStep(state), inv = W.inventory(state);
    const allowedTabs = ['craft', 'inventory', ...(W.openingDone(state) ? ['purchase'] : []), ...(state.tutorial.delivered ? ['mail', 'people', 'collection'] : []), 'settings'];
    if (!allowedTabs.includes(tab)) tab = 'craft';
    $('door').innerHTML = `<span class="door-label">${state.month ? `第 ${state.month} 月` : '準備月 0'}<br>${state.open ? '營業中' : '關店中'}</span>${button('開店', { type: 'open' }, { primary: true, disabled: state.open })}${button('關店', { type: 'close' }, { disabled: !state.open })}`;
    const panels = { craft: renderCraft, inventory: renderInventory, purchase: renderPurchase, mail: renderMail, people: renderPeople, collection: renderCollection, settings: renderSettings };
    $('app').innerHTML = `<div class="layout"><div class="workspace"><section class="intro"><div class="intro-copy"><h2>溪岸的工坊，從你開始。</h2><p>一張工作臺，幾位常來的客人。<br>物品走出這扇門，故事會隨鳥信回來。</p></div><div class="window" aria-hidden="true"><svg viewBox="0 0 170 150"><path d="M30 118V50a55 55 0 0 1 110 0v68Z" fill="#9ed5d0"/><path d="M33 97q25-20 53-3t51-11v35H33Z" fill="#689fa9"/><path d="M31 109q26-13 54-5t56-3v19H31Z" fill="#386b82"/><path d="M85 6v111M30 67h110" stroke="#c5a16b" stroke-width="7"/><path d="M20 121h132v9H20Z" fill="#c5a16b"/><circle cx="117" cy="40" r="10" fill="#f3f6f4"/><path d="m70 92 10-11 13 4 8-3-5 10-18 2-8 8Z" fill="#f3f6f4"/><path d="m93 85 5-1-1 4" fill="#c5a16b"/><path d="m80 95-1 12m8-13v13" stroke="#f3f6f4" stroke-width="2"/><path d="M52 131v8m64-8v8" stroke="#c5a16b" stroke-width="4"/></svg></div></section><section class="guide"><small>${t.step < 5 ? `學徒的第一筆生意 · 第 ${t.step}／4 步` : '日常已展開'}</small><h3>${t.title}</h3><p>${t.text}</p></section>${renderVisitor()}<nav class="tabs" role="tablist" aria-label="工坊功能">${tabButton('craft', '工作臺')}${tabButton('inventory', '作品架')}${W.openingDone(state) ? tabButton('purchase', '委託採購') : ''}${state.tutorial.delivered ? tabButton('mail', `鳥信${state.returns.some(o => o.status === 'offered') ? '（有舊物）' : ''}`) + tabButton('people', '人物') + tabButton('collection', '收藏簿') : ''}${tabButton('settings', '保存')}</nav><section class="panel" id="panel" role="tabpanel">${panels[tab]()}</section><details class="log"><summary>工坊記事（最近 ${state.log.length} 筆）</summary><ol>${state.log.slice().reverse().map(text => `<li>${escape(text)}</li>`).join('')}</ol></details></div><aside class="sidebar"><section class="aside-section"><h2>工坊帳本</h2><div class="ledger"><div><small>硬幣</small><strong>${state.coins}</strong></div><div><small>欠款</small><strong class="${state.debt ? 'debt' : ''}">${state.debt}</strong></div></div><p class="subtle">每月生活費 8 枚<br>不足先記帳，收入優先還款。</p></section><section class="aside-section"><h2>材料櫃</h2><ul class="materials">${(W.openingDone(state) ? W.MATERIALS : ['木頭', '鐵']).map(m => `<li><span>${m}</span><strong>${state.materials[m]}</strong></li>`).join('')}</ul><p class="help">作品架：${inv.length} 件${state.orders.some(o => o.status === 'pending') ? `<br>待交付：${state.orders.filter(o => o.status === 'pending').length} 筆訂單` : ''}</p></section><section class="aside-section"><h2>${state.tutorial.delivered ? '學徒手札' : '師傅的叮嚀'}</h2>${state.tutorial.delivered ? `<p class="skill-line">製作經驗 ${state.xp.craft} · 鑑定經驗 ${state.xp.appraisal}<br>聲望 ${state.reputation} · 配方 ${Object.keys(W.RECIPES).filter(k => W.unlocked(state, k)).length}／6</p><p class="help">先聽用途，再推薦。舊物有新去處，人物也會記住你。</p>` : '<p>「做得合用，比做得華麗更要緊。先把這兩份材料，做成會被人帶走的東西。」</p>'}</section></aside></div>`;
    $('save-status').textContent = saveProblem || (savedRaw ? '進度已保存' : '第一筆操作後自動保存');
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
      if (action.type === 'smelt' && !await confirm('熔鍊／拆解這件舊物？', '原物會變成材料與一份傳承，不能再售。故事仍留在收藏簿。', '熔鍊傳承')) return;
      const result = W.dispatch(state, action); state = result.state; save();
      if (action.type === 'sell' && W.openingDone(state) && !state.tutorial.ordered) tab = 'purchase';
      if (action.type === 'open' && state.tutorial.delivered && state.news.some(n => n.month === state.month && n.itemId)) tab = 'mail';
      render(); notify(result.message);
    } catch (error) { render(); notify(error.message, true); }
  }
  document.addEventListener('click', async event => {
    const b = event.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.action) { b.disabled = true; await act(JSON.parse(b.dataset.action)); return; }
    if (b.dataset.tab) { tab = b.dataset.tab; render(); document.querySelector(`[data-tab="${tab}"]`)?.focus(); return; }
    if (b.dataset.tool === 'export') { download(W.exportSave(state), `鳥信工坊-第${state.month}月.json`); notify('已匯出備份。請在瀏覽器下載紀錄確認檔案。'); }
    if (b.dataset.tool === 'raw') { try { download(localStorage.getItem(KEY) || W.exportSave(state), '鳥信工坊-原始存檔.json'); } catch (e) { notify('無法讀取原始存檔，請匯出目前進度。', true); } }
    if (b.dataset.tool === 'import') $('import-file').click();
    if (b.dataset.tool === 'new' && await confirm('重新開始這間工坊？', '目前進度會被替換。若想保留，請先取消並匯出 JSON 備份。', '重新開始')) { state = W.initialState(); saveProblem = ''; tab = 'craft'; save(); render(); notify('新的一間工坊準備好了。先做木杖與鐵劍。'); }
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
