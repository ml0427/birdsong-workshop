(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Workshop = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MATERIALS = ['木頭', '鐵', '銅', '銀', '金'];
  const COST = { 木頭: 3, 鐵: 6, 銅: 10, 銀: 16, 金: 24 };
  const RECIPES = {
    staff: { name: '木杖', material: '木頭', tier: 1, kind: 'staff', price: 14, use: '行路與引導微光', symbol: '杖' },
    sword: { name: '鐵劍', material: '鐵', tier: 2, kind: 'sword', price: 24, use: '巡路防身', symbol: '劍' },
    stool: { name: '木凳', material: '木頭', tier: 1, kind: 'stool', price: 16, use: '菜圃歇腳', symbol: '凳' },
    watering: { name: '銅澆水壺', material: '銅', tier: 3, kind: 'watering', price: 36, use: '照料菜圃', symbol: '壺' },
    lamp: { name: '銀燈', material: '銀', tier: 4, kind: 'lamp', price: 56, use: '照亮圖書室', symbol: '燈' },
    bell: { name: '金鈴', material: '金', tier: 5, kind: 'bell', price: 80, use: '提醒借書人', symbol: '鈴' }
  };
  const PEOPLE = {
    cen: { name: '阿岑', role: '巡路人', greeting: '我認得師傅留下的招牌。今天，換你坐在工作臺前了。', story: '巡路時，我總記得替沿途的人留一盞光。你做的東西，讓這件事容易多了。' },
    he: { name: '小禾', role: '菜圃照料者', greeting: '我想讓菜圃更好照顧。能替我挑一件實用的嗎？', story: '收成好的時候，我把多的菜分給鄰居。工坊的壺也幫上忙了。' },
    shu: { name: '望舒', role: '圖書室管理者', greeting: '晚間有人來借書。我需要一件能讓圖書室好用些的物品。', story: '以前夜裡只剩我守著書。現在燈亮了，來讀書的人也多了。' }
  };
  const QUALITY = ['樸實', '細緻', '精良'];
  const clone = s => JSON.parse(JSON.stringify(s));
  const fail = message => { throw new Error(message); };
  const integer = (v, min = 0, max = 1e9) => Number.isSafeInteger(v) && v >= min && v <= max;
  function initialState() {
    return {
      schema: 1, revision: 0, month: 0, lastSettled: 0, open: false, coins: 20, debt: 0,
      seq: 0, materials: { 木頭: 1, 鐵: 1, 銅: 0, 銀: 0, 金: 0 }, items: {},
      xp: { craft: 0, appraisal: 0 }, reputation: 0,
      npcs: Object.fromEntries(Object.keys(PEOPLE).map(id => [id, { trust: 0, story: false, goldDone: false }])),
      tutorial: { sold: [], ordered: false, delivered: false }, orders: [], visits: [],
      news: [], returns: [], legacies: [], log: ['師傅留下木頭與鐵各一份。先做木杖和鐵劍，熟客阿岑會來收。']
    };
  }
  const inventory = s => Object.values(s.items).filter(i => i.status === 'inventory');
  const owned = (s, npc) => Object.values(s.items).filter(i => i.status === 'owned' && i.owner === npc);
  const activeVisit = s => s.open ? s.visits.find(v => v.status === 'waiting') || null : null;
  const openingDone = s => ['staff', 'sword'].every(k => s.tutorial.sold.includes(k));
  function unlocked(s, id) {
    if (id === 'staff' || id === 'sword') return true;
    if (!s.tutorial.delivered) return false;
    if (id === 'stool') return true;
    if (id === 'watering') return s.xp.craft >= 2;
    if (id === 'lamp') return s.xp.craft >= 4 || s.reputation >= 3;
    if (id === 'bell') return s.xp.craft >= 6 && s.reputation >= 5;
    return false;
  }
  function price(item) { return RECIPES[item.recipe].price + item.quality * 6; }
  function suitable(s, item, visit = activeVisit(s)) {
    return !!visit && item.status === 'inventory' && visit.needs.includes(RECIPES[item.recipe].kind);
  }
  function log(s, message) { s.log.push(`第 ${s.month} 月｜${message}`); s.log = s.log.slice(-180); return message; }
  function news(s, id, text, itemId = null) {
    if (s.news.some(n => n.id === id)) return;
    s.news.push({ id, month: s.month, text, itemId });
  }
  function charge(s, amount) { const paid = Math.min(s.coins, amount); s.coins -= paid; s.debt += amount - paid; }
  function income(s, amount) { const paid = Math.min(s.debt, amount); s.debt -= paid; s.coins += amount - paid; }
  function history(s, item, text) { item.history.push({ month: s.month, text }); }
  function addVisit(s, npc, needs, kind = 'normal', id = `visit-${s.month}-${npc}`) {
    if (s.visits.some(v => v.id === id || (v.npc === npc && v.status === 'waiting'))) return;
    s.visits.push({ id, month: s.month, npc, needs, kind, asked: false, status: 'waiting' });
  }
  function settle(s) {
    if (s.lastSettled >= s.month) fail('這個月已結算。');
    charge(s, 8);
    for (const order of s.orders) {
      if (order.status !== 'pending' || order.due > s.month) continue;
      s.materials[order.material] += order.quantity;
      order.status = 'delivered'; order.deliveredMonth = s.month;
      if (order.tutorial) s.tutorial.delivered = true;
      news(s, `delivery-${order.id}`, `阿岑交來 ${order.material} ${order.quantity} 個。採購款已在委託時記帳。`);
    }
    for (const item of Object.values(s.items)) {
      if (item.status !== 'owned') continue;
      const person = PEOPLE[item.owner];
      if (!item.usedEvent && s.month > item.soldMonth) {
        item.usedEvent = true;
        const results = {
          staff: '沿溪巡路時，木杖的微光指引了一位迷路的旅人。',
          sword: '巡路時用鐵劍擋開了闖進道路的魔物，平安回來。',
          stool: '在菜圃歇腳整理種子，忙碌的一天舒緩不少。',
          watering: '用銅澆水壺照料菜圃，第一排嫩芽已經長出來了。',
          lamp: '銀燈照亮了圖書室，晚間也有人安心讀書。',
          bell: '金鈴提醒大家歸還書本，借書的孩子記住了那段鈴聲。'
        };
        const text = `${person.name}使用「${RECIPES[item.recipe].name}」：${results[item.recipe]}`;
        history(s, item, text); news(s, `use-${item.id}`, text, item.id);
      }
      if (!item.retirementOffered && s.month >= item.soldMonth + 3) {
        item.retirementOffered = true;
        s.returns.push({ itemId: item.id, npc: item.owner, status: 'offered' });
        news(s, `retire-${item.id}`, `${person.name}來信：「${RECIPES[item.recipe].name}」已完成這段工作。我換用了手邊的備用品，願把舊物贈回工坊，讓它再派上用場。你接受後，我才送交。`, item.id);
      }
    }
    news(s, `month-${s.month}`, s.month === 1 ? '魔法鳥停在窗沿：溪岸工坊重新亮起燈了。今天先等阿岑上門。' : `魔法鳥送來第 ${s.month} 月的消息：溪岸的人們仍在過日子，舊物也繼續留下故事。`);
    if (!openingDone(s)) addVisit(s, 'cen', ['staff', 'sword'].filter(k => !s.tutorial.sold.includes(k)), 'intro', 'intro-cen');
    else if (s.tutorial.delivered) {
      // Persistent waiting requests take precedence; no duplicate person in the queue.
      const firstHeVisit = !s.visits.some(v => v.npc === 'he');
      addVisit(s, 'he', [firstHeVisit || s.month % 2 === 0 ? 'watering' : 'stool']);
      addVisit(s, 'cen', [s.month % 2 === 0 ? 'staff' : 'sword']);
      if (unlocked(s, 'lamp')) {
        const commission = s.npcs.shu.trust >= 3 && s.reputation >= 3 && !s.npcs.shu.goldDone && unlocked(s, 'bell');
        addVisit(s, 'shu', [commission ? 'bell' : 'lamp'], commission ? 'commission' : 'normal');
      }
    }
    if (s.tutorial.delivered && inventory(s).length === 0 && MATERIALS.every(m => s.materials[m] === 0) && !s.orders.some(o => o.status === 'pending')) {
      s.materials.木頭++; s.materials.鐵++;
      news(s, `relief-${s.month}`, '阿岑捎來木頭與鐵各一個作周轉：「先讓工作臺動起來，欠款可以慢慢還。」');
    }
    s.lastSettled = s.month;
  }
  function tutorialStep(s) {
    if (!openingDone(s)) {
      const made = new Set(Object.values(s.items).map(i => i.recipe));
      if (!made.has('staff') || !made.has('sword')) return { title: '先做兩件，讓工坊亮起來', text: '師傅只留了木頭與鐵各一個。用工作臺做一把木杖、一把鐵劍；製作不會換月。', step: 1 };
      return { title: '把兩件作品推薦給阿岑', text: s.open ? '阿岑自己會用這兩件物品。他先說用途，你再逐件推薦；同一人可以持有多件。' : '按「開店」進入下一個月。阿岑會帶著需求來訪，請逐件推薦木杖與鐵劍。', step: 2 };
    }
    if (!s.tutorial.ordered) return { title: '託阿岑帶回下一批材料', text: '現在可以委託採購了。先訂銅 1 個做澆水壺，也可多訂木頭或鐵；交付在下一次開店。', step: 3 };
    if (!s.tutorial.delivered) return { title: '關店，再開店迎接下個月', text: '製作不會推進交貨。關店只停止接客，再按開店才換月；魔法鳥會同時送來人物近況。', step: 4 };
    return { title: '你的工坊，開始留下故事', text: '讀一封鳥信，聽新顧客的需求，再製作適合的物品。採購、鑑定、收藏與舊物傳承都已開放。', step: 5 };
  }
  function dispatch(state, action) {
    if (!action || typeof action.type !== 'string') fail('操作格式不正確。');
    if (action.expectedRevision !== undefined && action.expectedRevision !== state.revision) fail('這個操作已處理，請使用目前畫面的按鈕。');
    const s = clone(state);
    let message;
    switch (action.type) {
      case 'open':
        if (s.open) fail('工坊已經營業中，沒有再換月或扣款。');
        s.month++; s.open = true; settle(s);
        message = log(s, '開店。生活費、交貨與鳥信已一起更新。'); break;
      case 'close':
        if (!s.open) fail('工坊已經關店，月份沒有改變。');
        s.open = false;
        message = log(s, '關店。未完成的需求仍會等你；可以繼續製作。'); break;
      case 'craft': {
        const r = RECIPES[action.recipe];
        if (!r || !unlocked(s, action.recipe)) fail('這份配方尚未學會。');
        if (s.materials[r.material] < 1) fail(`需要 ${r.material} 1 個。可委託阿岑採購，下次開店交付。`);
        const legacy = s.legacies.find(l => l.material === r.material && l.usedBy === null);
        const id = `item-${++s.seq}`;
        const quality = Math.min(2, Math.floor(s.xp.craft / 3) + (legacy ? 1 : 0));
        s.materials[r.material]--;
        s.items[id] = { id, recipe: action.recipe, material: r.material, quality, status: 'inventory', owner: null, createdMonth: s.month, soldMonth: null, appraised: false, usedEvent: false, retirementOffered: false, returned: false, legacy: legacy ? legacy.itemId : null, history: [] };
        if (legacy) { legacy.usedBy = id; history(s, s.items[legacy.itemId], `熔鍊傳承進入新作 ${id}「${r.name}」。`); }
        history(s, s.items[id], `你製作了${QUALITY[quality]}的${r.name}${legacy ? `，承接 ${legacy.itemId} 的材料記憶` : ''}。`);
        s.xp.craft++; message = log(s, `${r.name}製作成功，品質「${QUALITY[quality]}」。`); break;
      }
      case 'talk': {
        const visit = activeVisit(s);
        if (!visit || visit.id !== action.visitId) fail('這位顧客目前沒有在櫃臺。');
        if (visit.asked) fail('已經聽過這次需求了。');
        visit.asked = true; s.npcs[visit.npc].trust++;
        message = log(s, `${PEOPLE[visit.npc].name}：「${visit.kind === 'intro' ? '木杖用來照亮路，鐵劍是巡路時防身。我會一起帶著。' : `我想要${visit.needs.map(k => RECIPES[k].use).join('、')}，合用比華麗更重要。`}」信任增加。`); break;
      }
      case 'sell': {
        const visit = activeVisit(s), item = s.items[action.itemId];
        if (!visit || visit.id !== action.visitId) fail('需求已處理，不能重複交易。');
        if (!item || item.status !== 'inventory') fail('這件物品已不在工坊庫存。');
        if (!suitable(s, item, visit)) fail('這件物品不符合需求。先聽用途，或製作標示適合的配方。');
        const amount = price(item) + (visit.kind === 'commission' ? 12 : 0);
        income(s, amount); item.status = 'owned'; item.owner = visit.npc; item.soldMonth = s.month;
        history(s, item, `${PEOPLE[visit.npc].name}買下並持有，成交 ${amount} 枚。`);
        s.npcs[visit.npc].trust++; s.reputation++;
        if (visit.kind === 'intro') {
          if (!s.tutorial.sold.includes(item.recipe)) s.tutorial.sold.push(item.recipe);
          visit.needs = visit.needs.filter(k => k !== item.recipe);
          if (visit.needs.length === 0) visit.status = 'done';
        } else { visit.status = 'done'; }
        if (visit.kind === 'commission') s.npcs[visit.npc].goldDone = true;
        if (s.npcs[visit.npc].trust >= 3 && !s.npcs[visit.npc].story) {
          s.npcs[visit.npc].story = true; news(s, `story-${visit.npc}`, `${PEOPLE[visit.npc].name}說起往事：「${PEOPLE[visit.npc].story}」`, item.id);
        }
        message = log(s, `${PEOPLE[visit.npc].name}買下${RECIPES[item.recipe].name}，收入 ${amount} 枚${s.debt ? '（已先償還部分欠款）' : ''}。物品已轉入對方持有。`); break;
      }
      case 'decline': {
        const visit = activeVisit(s);
        if (!visit || visit.id !== action.visitId) fail('這個需求已處理。');
        if (visit.kind === 'intro') fail('阿岑會等兩件開場作品，可以先關店製作。');
        visit.status = 'declined'; message = log(s, `${PEOPLE[visit.npc].name}：「沒關係，下次再來。」本次需求已婉拒。`); break;
      }
      case 'order': {
        if (!openingDone(s)) fail('先把木杖與鐵劍賣給阿岑，再託他採購。');
        if (!MATERIALS.includes(action.material) || !integer(action.quantity, 1, 9)) fail('採購數量請填 1 至 9 的整數，材料需在清單內。');
        if (typeof action.requestId !== 'string' || action.requestId.length > 100 || !action.requestId) fail('訂單識別碼不正確。');
        if (s.orders.some(o => o.requestId === action.requestId)) fail('這筆採購已委託，不會再扣款。');
        const cost = COST[action.material] * action.quantity;
        const tutorial = !s.tutorial.ordered;
        charge(s, cost);
        s.orders.push({ id: `order-${++s.seq}`, requestId: action.requestId, material: action.material, quantity: action.quantity, cost, due: s.month + 1, status: 'pending', tutorial, deliveredMonth: null });
        s.tutorial.ordered = true;
        message = log(s, `委託阿岑採購${action.material} ${action.quantity} 個，共 ${cost} 枚；第 ${s.month + 1} 月開店交付。`); break;
      }
      case 'appraise': {
        if (!s.tutorial.delivered) fail('先完成第一次採購交付，再學鑑定。');
        const item = s.items[action.itemId];
        if (!item || item.status !== 'inventory') fail('只可鑑定工坊持有的實物。');
        if (item.appraised) fail('這件物品已鑑定，不重複增加經驗。');
        item.appraised = true; s.xp.appraisal++;
        history(s, item, `你鑑定了物品：${item.material}，第 ${RECIPES[item.recipe].tier} 階，${QUALITY[item.quality]}品質。`);
        message = log(s, `鑑定完成：${RECIPES[item.recipe].name}品質為「${QUALITY[item.quality]}」，適合${RECIPES[item.recipe].use}。`); break;
      }
      case 'reclaim': {
        const offer = s.returns.find(o => o.itemId === action.itemId && o.status === 'offered');
        const item = s.items[action.itemId];
        if (!offer || !item || item.status !== 'owned' || item.owner !== offer.npc) fail('這件舊物已領回，或仍未獲持有者同意。');
        offer.status = 'accepted'; item.status = 'inventory'; item.owner = null; item.returned = true;
        history(s, item, `${PEOPLE[offer.npc].name}退役贈還，交回工坊。`);
        message = log(s, `收到${PEOPLE[offer.npc].name}贈還的${RECIPES[item.recipe].name}。可再售或熔鍊傳承。`); break;
      }
      case 'smelt': {
        const item = s.items[action.itemId];
        if (!s.tutorial.delivered || !item || item.status !== 'inventory' || !item.returned) fail('只可熔鍊已合理領回、仍在庫存的舊物。');
        item.status = 'smelted'; item.owner = null; s.materials[item.material]++;
        s.legacies.push({ itemId: item.id, material: item.material, usedBy: null });
        history(s, item, `熔鍊／拆解為${item.material} 1 個；傳承等待下一件同材質作品。`);
        message = log(s, `回收${item.material} 1 個。下一件同材質作品會承接${RECIPES[item.recipe].name}的傳承。`); break;
      }
      default: fail('沒有這個操作。');
    }
    s.revision++;
    validate(s);
    return { state: s, message };
  }
  function validate(s) {
    const check = (test, message) => { if (!test) fail(`存檔格式不正確：${message}`); };
    const strings = (v, max = 1000) => typeof v === 'string' && v.length <= max;
    const array = v => Array.isArray(v) && v.length <= 20000;
    check(s && typeof s === 'object' && !Array.isArray(s) && s.schema === 1, '版本');
    for (const k of ['revision', 'month', 'lastSettled', 'coins', 'debt', 'seq', 'reputation']) check(integer(s[k]), k);
    check(s.lastSettled === s.month && typeof s.open === 'boolean', '月結');
    check(s.materials && MATERIALS.every(m => integer(s.materials[m])), '材料');
    check(s.xp && integer(s.xp.craft) && integer(s.xp.appraisal), '技能');
    check(s.npcs && Object.keys(PEOPLE).every(id => s.npcs[id] && integer(s.npcs[id].trust) && typeof s.npcs[id].story === 'boolean' && typeof s.npcs[id].goldDone === 'boolean'), '人物');
    check(s.tutorial && array(s.tutorial.sold) && s.tutorial.sold.length <= 2 && new Set(s.tutorial.sold).size === s.tutorial.sold.length && s.tutorial.sold.every(k => ['staff', 'sword'].includes(k)) && typeof s.tutorial.ordered === 'boolean' && typeof s.tutorial.delivered === 'boolean', '教學');
    check(!s.tutorial.delivered || s.tutorial.ordered, '交付前置');
    check(!s.tutorial.ordered || openingDone(s), '採購前置');
    check(s.items && typeof s.items === 'object' && !Array.isArray(s.items) && Object.keys(s.items).length <= 20000, '物品表');
    let highest = 0;
    for (const [id, i] of Object.entries(s.items)) {
      check(/^item-[1-9]\d*$/.test(id) && i && i.id === id, '物品識別');
      highest = Math.max(highest, Number(id.split('-')[1]));
      check(Object.hasOwn(RECIPES, i.recipe) && i.material === RECIPES[i.recipe].material && integer(i.quality, 0, 2), '配方／品質');
      check(['inventory', 'owned', 'smelted'].includes(i.status), '持有狀態');
      check(i.status === 'owned' ? Object.hasOwn(PEOPLE, i.owner) : i.owner === null, '持有者');
      check(integer(i.createdMonth, 0, s.month) && (i.soldMonth === null || integer(i.soldMonth, i.createdMonth, s.month)), '物品月份');
      check(i.status !== 'owned' || i.soldMonth !== null, '成交月份');
      check(['appraised', 'usedEvent', 'retirementOffered', 'returned'].every(k => typeof i[k] === 'boolean'), '物品事件');
      check(i.legacy === null || strings(i.legacy, 50), '傳承');
      check(array(i.history) && i.history.every(h => h && integer(h.month, 0, s.month) && strings(h.text)), '物品歷史');
    }
    for (const k of ['orders', 'visits', 'news', 'returns', 'legacies', 'log']) check(array(s[k]), k);
    check(s.log.every(t => strings(t)), '日誌');
    const unique = (list, key) => new Set(list.map(x => x[key])).size === list.length;
    check(unique(s.orders, 'id') && unique(s.orders, 'requestId'), '訂單重複');
    for (const o of s.orders) {
      check(o && /^order-[1-9]\d*$/.test(o.id) && strings(o.requestId, 100) && o.requestId.length > 0 && MATERIALS.includes(o.material) && integer(o.quantity, 1, 9) && o.cost === COST[o.material] * o.quantity && integer(o.due, 1) && ['pending', 'delivered'].includes(o.status) && typeof o.tutorial === 'boolean', '訂單');
      check(o.status === 'pending' ? o.due > s.month && o.deliveredMonth === null : integer(o.deliveredMonth, o.due, s.month), '交付');
      highest = Math.max(highest, Number(o.id.split('-')[1]));
    }
    check(s.seq >= highest, '序號');
    check(unique(s.visits, 'id') && unique(s.visits.filter(v => v.status === 'waiting'), 'npc'), '來客重複');
    check(s.visits.every(v => v && strings(v.id, 100) && Object.hasOwn(PEOPLE, v.npc) && integer(v.month, 1, s.month) && array(v.needs) && v.needs.every(k => Object.hasOwn(RECIPES, k)) && ['intro', 'normal', 'commission'].includes(v.kind) && ['waiting', 'done', 'declined'].includes(v.status) && typeof v.asked === 'boolean' && (v.status !== 'waiting' || v.needs.length > 0)), '需求');
    check(unique(s.news, 'id') && s.news.every(n => n && strings(n.id, 100) && integer(n.month, 1, s.month) && strings(n.text) && (n.itemId === null || Object.hasOwn(s.items, n.itemId))), '鳥信');
    check(unique(s.returns, 'itemId') && s.returns.every(o => o && Object.hasOwn(s.items, o.itemId) && Object.hasOwn(PEOPLE, o.npc) && ['offered', 'accepted'].includes(o.status) && (o.status !== 'offered' || s.items[o.itemId].status === 'owned' && s.items[o.itemId].owner === o.npc)), '舊物交還');
    check(unique(s.legacies, 'itemId') && s.legacies.every(l => l && Object.hasOwn(s.items, l.itemId) && s.items[l.itemId].status === 'smelted' && l.material === s.items[l.itemId].material && (l.usedBy === null || Object.hasOwn(s.items, l.usedBy) && s.items[l.usedBy].legacy === l.itemId && s.items[l.usedBy].material === l.material)), '熔鍊傳承');
    check(Object.values(s.items).every(i => i.legacy === null || s.legacies.some(l => l.itemId === i.legacy && l.usedBy === i.id)), '傳承來源');
    check(Object.values(s.items).filter(i => i.status === 'smelted').every(i => s.legacies.some(l => l.itemId === i.id)), '熔鍊紀錄');
    return true;
  }
  function exportSave(s) { validate(s); return JSON.stringify({ game: '鳥信工坊', schema: 1, state: s }, null, 2); }
  function importSave(text) {
    if (typeof text !== 'string' || text.length > 8 * 1024 * 1024) fail('備份太大或格式不正確。');
    const data = JSON.parse(text);
    if (!data || data.game !== '鳥信工坊' || data.schema !== 1) fail('這不是鳥信工坊 v1 格式備份。');
    validate(data.state); return clone(data.state);
  }
  return { MATERIALS, COST, RECIPES, PEOPLE, QUALITY, initialState, inventory, owned, activeVisit, openingDone, unlocked, price, suitable, tutorialStep, dispatch, validate, exportSave, importSave };
});
