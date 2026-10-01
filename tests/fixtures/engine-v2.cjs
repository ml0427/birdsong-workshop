(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Workshop = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MATERIALS = ['木頭', '鐵', '銅', '銀', '金'];
  const COST = { 木頭: 3, 鐵: 6, 銅: 10, 銀: 16, 金: 24 };
  const TRAITS = {
    light: { name: '輕巧', text: '效能增加 1，便於施法與佩戴。' },
    solid: { name: '堅固', text: '每次使用的耐久磨耗減少 1。' },
    guard: { name: '護身', text: '防護使用的結果加值 2。' }
  };
  const RECIPES = {
    staff: { name: '木杖', material: '木頭', tier: 1, kind: 'staff', use: '引導魔力與照路', symbol: '杖', trait: 'light' },
    sword: { name: '鐵劍', material: '鐵', tier: 2, kind: 'sword', use: '攜帶防身', symbol: '劍', trait: 'solid' },
    shield: { name: '木盾', material: '木頭', tier: 1, kind: 'shield', use: '抵擋飛石與衝擊', symbol: '盾', trait: 'solid' },
    bracer: { name: '銅護腕', material: '銅', tier: 3, kind: 'bracer', use: '保護手臂與穩定魔力', symbol: '腕', trait: 'guard' },
    amulet: { name: '銀護符', material: '銀', tier: 4, kind: 'amulet', use: '佩戴護身與抵禦魔法干擾', symbol: '符', trait: 'guard' },
    bell: { name: '金鈴', material: '金', tier: 5, kind: 'bell', use: '佩戴後感應接近的危險', symbol: '鈴', trait: 'light' }
  };
  const PEOPLE = { cen: { name: '阿岑', role: '熟客' }, he: { name: '小禾', role: '重視個人防護的熟客' }, shu: { name: '望舒', role: '魔法裝備使用者' } };
  const QUALITY = ['樸實', '細緻', '精良'], QUALITY_PRICE = [14, 20, 26];
  const MAX = Number.MAX_SAFE_INTEGER;
  const clone = s => JSON.parse(JSON.stringify(s));
  const fail = message => { throw new Error(message); };
  const integer = (v, min = 0, max = MAX) => Number.isSafeInteger(v) && v >= min && v <= max;
  function add(a, b) { const n = a + b; if (!integer(n)) fail('數值超出安全整數範圍，未執行操作。'); return n; }
  function multiply(a, b) { const n = a * b; if (!integer(n)) fail('總價超出安全整數範圍，未執行採購。'); return n; }
  function initialState() {
    return { schema: 2, revision: 0, month: 0, lastSettled: 0, open: false, coins: 20, debt: 0, seq: 0,
      materials: { 木頭: 1, 鐵: 1, 銅: 0, 銀: 0, 金: 0 }, items: {}, xp: { craft: 0, appraisal: 0 }, reputation: 0,
      npcs: Object.fromEntries(Object.keys(PEOPLE).map(id => [id, { trust: 0, story: false, goldDone: false, storyItem: null }])),
      tutorial: { sold: [], ordered: false, delivered: false }, orders: [], visits: [], news: [], returns: [], legacies: [],
      log: ['師傅留下木頭與鐵各一個。先做木杖和鐵劍，熟客阿岑會來收。'] };
  }
  const inventory = s => Object.values(s.items).filter(i => i.status === 'inventory');
  const owned = (s, npc) => Object.values(s.items).filter(i => i.status === 'owned' && i.owner === npc);
  const activeVisit = s => s.open ? s.visits.find(v => v.status === 'waiting') || null : null;
  const openingDone = s => ['staff', 'sword'].every(k => s.tutorial.sold.includes(k));
  function unlocked(s, id) {
    if (id === 'staff' || id === 'sword') return true;
    if (!s.tutorial.delivered) return false;
    return id === 'shield' || id === 'bracer' && s.xp.craft >= 2 || id === 'amulet' && (s.xp.craft >= 4 || s.reputation >= 3) || id === 'bell' && s.xp.craft >= 6 && s.reputation >= 5;
  }
  const price = i => QUALITY_PRICE[i.quality];
  const canAppraise = s => s.tutorial.delivered && s.visits.some(v => v.npc === 'he' && v.asked);
  function visibleRecipes(s) {
    const learned = new Set(['staff', 'sword', ...Object.values(s.items).map(i => i.recipe)]);
    for (const v of s.visits) if (v.asked) for (const r of v.needs) learned.add(r);
    return Object.keys(RECIPES).filter(id => learned.has(id) && unlocked(s, id));
  }
  const performance = i => RECIPES[i.recipe].tier * 2 + i.quality * 2 + (i.traits.includes('light') ? 1 : 0);
  const traitNames = i => i.traits.map(t => TRAITS[t].name).join('、');
  const episode = i => i.episodes.at(-1) || null;
  function useResult(i) {
    const score = performance(i) + (['sword', 'shield', 'bracer', 'amulet'].includes(i.recipe) && i.traits.includes('guard') ? 2 : 0);
    const strong = score >= RECIPES[i.recipe].tier * 2 + 2;
    const texts = {
      staff: ['照路魔光明亮而穩定', '魔光較淡，仍足以看清腳下'],
      sword: ['防身時格擋穩定，順利離開危險處', '格擋較吃力，謹慎避開危險處'],
      shield: ['飛石被穩穩擋住，沒有受傷', '擋住飛石後手臂發麻，仍平安離開'],
      bracer: ['手臂防護充足，魔力流動穩定', '手臂受到保護，施法時仍需集中注意'],
      amulet: ['魔法干擾被抵擋，安全通過', '干擾減弱，放慢腳步後安全通過'],
      bell: ['提前感應異常，鈴聲讓持有者及時避開', '靠近異常時才響起，持有者停步繞行']
    };
    const extra = score >= RECIPES[i.recipe].tier * 2 + 5;
    return { score, strong, wear: Math.min(i.durability, Math.max(1, (strong ? 2 : 3) - (i.traits.includes('solid') ? 1 : 0))), text: texts[i.recipe][strong ? 0 : 1] + (extra ? '，效能餘裕充足，操作更加從容' : '') };
  }
  function requestDetail(v) {
    if (v.phase === 'service') return v.kind === 'intro' ? '兩件武器都收好了。採購清單交給我，辦完再離開。' : '這次需求已辦妥。我還在櫃臺，可以交代採購或領回我贈還的舊物。';
    if (v.kind === 'intro') return '木杖照路，鐵劍防身。兩件都由我自己使用。';
    const details = { staff: '我要用木杖引導魔力，照亮走路的方向。', sword: '外出時需要鐵劍防身，格擋時握持要穩。', shield: '想用木盾保護自己，擋住飛石與衝擊。', bracer: '想用銅護腕保護手臂，也讓魔力更穩定。請幫我看看接縫與品質。', amulet: '想佩戴銀護符，抵禦路上的魔法干擾。', bell: '想佩戴金鈴，接近危險時能先得到警示。' };
    return `${details[v.needs[0]] || '我帶了退役舊物來贈還。'}${v.reason ? ` ${v.reason}` : ''}${v.traitRequired ? ` 希望有「${TRAITS[v.traitRequired].name}」特性。` : ''}`;
  }
  function suitable(s, i, v = activeVisit(s)) {
    return !!v && v.phase === 'request' && i.status === 'inventory' && v.needs.includes(i.recipe) && i.durability > 3 && i.quality >= v.minQuality && (!v.traitRequired || i.traits.includes(v.traitRequired)) && !s.returns.some(o => o.itemId === i.id && o.npc === v.npc);
  }
  function log(s, message) { s.log.push(`第 ${s.month} 月｜${message}`); s.log = s.log.slice(-180); return message; }
  function news(s, id, text, itemId = null) { if (!s.news.some(n => n.id === id)) s.news.push({ id, month: s.month, text, itemId }); }
  function charge(s, amount) { const paid = Math.min(s.coins, amount); s.coins -= paid; s.debt = add(s.debt, amount - paid); }
  function income(s, amount) { const paid = Math.min(s.debt, amount); s.debt -= paid; s.coins = add(s.coins, amount - paid); }
  function history(s, i, text) { i.history.push({ month: s.month, text }); }
  function scope(s, a) {
    const v = activeVisit(s);
    if (!v || a.visitId !== v.id || a.counterId !== v.counterId) fail('這位顧客目前不在櫃臺，請使用目前畫面的操作。');
    return v;
  }
  function addVisit(s, npc, needs, kind = 'normal', extra = {}, id = `visit-${s.month}-${npc}`) {
    if (s.visits.some(v => v.id === id || v.npc === npc && v.status === 'waiting')) return;
    s.visits.push({ id, month: s.month, npc, needs, kind, asked: false, status: 'waiting', phase: needs.length ? 'request' : 'service', counterId: `${id}@${s.month}`, reason: '', minQuality: 0, traitRequired: null, ...extra });
  }
  function demand(s, npc) {
    const pool = { cen: ['staff', 'sword', 'shield', 'bracer', 'bell', 'amulet'], he: ['bracer', 'shield', 'amulet', 'staff', 'bell'], shu: ['amulet', 'bell', 'staff', 'shield', 'bracer'] }[npc].filter(r => unlocked(s, r));
    const carried = owned(s, npc).filter(i => !s.returns.some(o => o.itemId === i.id && o.status === 'offered'));
    let recipe = pool.find(r => !carried.some(i => i.recipe === r)), reason = '這個用途還沒有合用的裝備。', minQuality = 0;
    if (recipe && owned(s, npc).some(i => i.recipe === recipe)) reason = '原有同類裝備已磨損退役，這次想替換為狀態良好的一件。';
    if (!recipe) {
      recipe = pool[(s.month + Object.keys(PEOPLE).indexOf(npc)) % pool.length];
      const same = carried.filter(i => i.recipe === recipe);
      if (same.some(i => i.durability <= 3)) reason = '現有同類裝備已磨損，這次想換一件狀態良好的。';
      else if (same.every(i => i.quality < 2) && Math.floor(s.xp.craft / 3) > Math.max(...same.map(i => i.quality))) { minQuality = Math.min(2, Math.max(...same.map(i => i.quality)) + 1); reason = `已持有同類裝備，這次想升級到${QUALITY[minQuality]}品質。`; }
      else reason = '已持有同類裝備，這次想另備一件，輪替使用。';
    }
    const inherited = inventory(s).find(i => i.recipe === recipe && i.legacy && i.traits.length === 2 && i.durability > 3);
    const traitRequired = inherited && s.npcs[npc].trust >= 3 ? inherited.traits.find(t => t !== RECIPES[recipe].trait) : null;
    return { needs: [recipe], reason, minQuality, traitRequired: traitRequired || null };
  }
  function settle(s) {
    if (s.lastSettled >= s.month) fail('這個月已結算。');
    charge(s, 8);
    for (const o of s.orders) {
      if (o.status !== 'pending' || o.due > s.month) continue;
      s.materials[o.material] = add(s.materials[o.material], o.quantity); o.status = 'delivered'; o.deliveredMonth = s.month;
      if (o.tutorial) s.tutorial.delivered = true;
      news(s, `delivery-${o.id}`, `${PEOPLE[o.npc].name}帶回 ${o.material} ${o.quantity} 個。採購款已在委託時記帳。`);
    }
    for (const i of Object.values(s.items)) {
      if (i.status !== 'owned') continue;
      const e = episode(i), person = PEOPLE[i.owner], retired = s.returns.some(o => o.itemId === i.id && o.status === 'offered');
      if (!retired && i.durability > 3 && s.month > e.since && e.lastUsedMonth !== s.month) {
        const result = useResult(i), before = i.durability;
        i.durability -= result.wear; e.lastUsedMonth = s.month; if (e.firstUsedMonth === null) e.firstUsedMonth = s.month; e.uses = add(e.uses, 1); i.usedEvent = true;
        const text = `${person.name}使用「${RECIPES[i.recipe].name}」：${result.text}。效能結果 ${result.score}，耐久 ${before}→${i.durability}／${i.maxDurability}；${traitNames(i)}。`;
        history(s, i, text); news(s, `use-${i.id}-${e.id}-${s.month}`, text, i.id);
      }
      if (!i.retirementOffered && i.durability <= 3 && e.uses > 0) {
        i.retirementOffered = true; s.returns.push({ itemId: i.id, npc: i.owner, episodeId: e.id, status: 'offered' });
        news(s, `retire-${i.id}`, `${person.name}來信：「${RECIPES[i.recipe].name}」使用後耐久只剩 ${i.durability}／${i.maxDurability}。我暫停使用，改帶手邊備用品，願意當面贈還工坊；你收下前仍由我保管。`, i.id);
      }
    }
    for (const [npc, relation] of Object.entries(s.npcs)) {
      if (relation.story || relation.trust < 3) continue;
      const source = Object.values(s.items).find(i => i.episodes.some(e => e.npc === npc && e.firstUsedMonth !== null && e.firstUsedMonth < s.month));
      if (!source) continue;
      relation.story = true; relation.storyItem = source.id;
      news(s, `story-v2-${npc}`, `${PEOPLE[npc].name}分享經歷：「之前確實用過你做的${RECIPES[source.recipe].name}。${source.traits.includes('guard') ? '那份護身效果' : source.traits.includes('solid') ? '它經得起磨耗' : '它便於攜帶'}讓我更安心。我願意繼續把裝備交給你照料。」`, source.id);
    }
    if (!openingDone(s) || !s.tutorial.ordered) addVisit(s, 'cen', ['staff', 'sword'].filter(k => !s.tutorial.sold.includes(k)), 'intro', {}, 'intro-cen');
    else if (s.tutorial.delivered) {
      for (const npc of ['he', 'cen', 'shu']) {
        if (npc === 'shu' && !unlocked(s, 'amulet')) continue;
        const commission = npc === 'shu' && s.npcs.shu.trust >= 3 && s.reputation >= 3 && !s.npcs.shu.goldDone && unlocked(s, 'bell');
        const d = commission ? { needs: ['bell'], reason: '想試用佩戴式魔法警示金鈴；這是一筆一次委託，完成另付 12 枚。', minQuality: 0, traitRequired: null } : demand(s, npc);
        addVisit(s, npc, d.needs, commission ? 'commission' : 'normal', d);
      }
      for (const o of s.returns.filter(o => o.status === 'offered')) addVisit(s, o.npc, [], 'return');
    }
    for (const v of s.visits.filter(v => v.status === 'waiting')) v.counterId = `${v.id}@${s.month}`;
    if (s.tutorial.delivered && inventory(s).length === 0 && MATERIALS.every(m => s.materials[m] === 0) && !s.orders.some(o => o.status === 'pending')) {
      s.materials.木頭 = 1; s.materials.鐵 = 1; news(s, `relief-${s.month}`, '阿岑送來木頭與鐵各一個作周轉：「先讓工作臺動起來，欠款可以慢慢還。」');
    }
    if (!s.news.some(n => n.month === s.month)) news(s, `month-${s.month}`, s.month === 1 ? '阿岑託魔法鳥帶來口信：「我來看看你的第一批作品。」' : '本月沒有新消息。');
    s.lastSettled = s.month;
  }
  function tutorialStep(s) {
    if (!openingDone(s)) {
      const made = new Set(Object.values(s.items).map(i => i.recipe));
      if (!made.has('staff') || !made.has('sword')) return { title: '製作木杖與鐵劍', text: '木頭與鐵各一個，分別做成木杖、鐵劍。製作不換月，也不會失敗。', step: 1 };
      return { title: s.open ? '把作品推薦給阿岑' : '開店迎接阿岑', text: s.open ? '兩件都由阿岑自己使用。逐件推薦即可。' : '開店進入下一個月，阿岑會帶著需求來訪。', step: 2 };
    }
    if (!s.tutorial.ordered) return { title: '交代採購清單', text: '阿岑還在櫃臺等清單。先委託銅 1 個，下次開店交付；提早關店也會保留這一步。', step: 3 };
    if (!s.tutorial.delivered) return { title: s.open ? '等下次開店到貨' : '開店收取材料', text: s.open ? '先關店，再開店收取材料與鳥信。關店不推進月份。' : '按開店即可，材料與鳥信會一起送到。', step: 4 };
    return { title: '小禾帶來新需求', text: '先聽用途，再做一件合用的裝備。', step: 5 };
  }
  function orderQuote(s, material, quantity) {
    if (!MATERIALS.includes(material) || !integer(quantity, 1)) fail('採購數量請填正安全整數，材料需在清單內。');
    const cost = multiply(COST[material], quantity); add(s.debt, Math.max(0, cost - s.coins));
    const reserved = s.orders.filter(o => o.status === 'pending' && o.material === material).reduce((n, o) => add(n, o.quantity), s.materials[material]);
    add(reserved, quantity); return cost;
  }
  function dispatch(state, a) {
    if (!a || typeof a.type !== 'string') fail('操作格式不正確。');
    if (a.expectedRevision !== undefined && a.expectedRevision !== state.revision) fail('這個操作已處理，請使用目前畫面的按鈕。');
    const s = clone(state); let message;
    switch (a.type) {
      case 'open':
        if (s.open) fail('工坊已經營業中，沒有再次換月或扣款。');
        s.month = add(s.month, 1); s.open = true; settle(s); message = log(s, '開店。生活費、交貨與鳥信已一起更新。'); break;
      case 'close':
        if (!s.open) fail('工坊已經關店，月份沒有改變。');
        for (const v of s.visits.filter(v => v.status === 'waiting' && v.phase === 'service')) if (v.kind !== 'intro' || s.tutorial.ordered) v.status = 'done';
        for (const v of s.visits.filter(v => v.status === 'waiting')) v.counterId = null;
        s.open = false; message = log(s, '關店。未完成的需求留到下次；可以繼續製作。'); break;
      case 'craft': {
        const r = RECIPES[a.recipe]; if (!r || !unlocked(s, a.recipe)) fail('這份配方尚未學會。');
        if (s.materials[r.material] < 1) fail(`需要 ${r.material} 1 個。可開店委託目前顧客採購。`);
        const legacy = s.legacies.find(l => l.material === r.material && l.usedBy === null), id = `item-${s.seq = add(s.seq, 1)}`;
        const quality = Math.min(2, Math.floor(s.xp.craft / 3) + (legacy ? 1 : 0)), traits = [r.trait];
        if (legacy) { for (const t of legacy.traits) if (!traits.includes(t) && traits.length < 2) traits.push(t); if (traits.length < 2) traits.push(r.trait === 'solid' ? 'guard' : 'solid'); }
        s.materials[r.material]--;
        const i = s.items[id] = { id, recipe: a.recipe, material: r.material, quality, traits, durability: 9, maxDurability: 9, repaired: false, status: 'inventory', owner: null, createdMonth: s.month, soldMonth: null, appraised: false, usedEvent: false, retirementOffered: false, returned: false, legacy: legacy ? legacy.itemId : null, episodes: [], history: [] };
        if (legacy) { legacy.usedBy = id; history(s, s.items[legacy.itemId], `特性傳承進入新作「${r.name}」，特性：${traitNames(i)}。`); }
        history(s, i, `你製作了${QUALITY[quality]}的${r.name}，特性：${traitNames(i)}${legacy ? `；承接${RECIPES[s.items[legacy.itemId].recipe].name}的材料與特性` : ''}。`);
        s.xp.craft = add(s.xp.craft, 1); message = log(s, `${r.name}做好了。`); break;
      }
      case 'talk': {
        const v = scope(s, a); if (v.asked) fail('已經聽過這次需求了。');
        v.asked = true; s.npcs[v.npc].trust = add(s.npcs[v.npc].trust, 1); message = log(s, `${PEOPLE[v.npc].name}：「${requestDetail(v)}」`); break;
      }
      case 'sell': {
        const v = scope(s, a), i = s.items[a.itemId];
        if (!i || i.status !== 'inventory') fail('這件物品已不在工坊庫存。');
        if (!suitable(s, i, v)) fail('這件物品不符合目前需求、耐久或特性，或是這位顧客已退役的同一舊物。');
        const amount = price(i) + (v.kind === 'commission' ? 12 : 0); income(s, amount); i.status = 'owned'; i.owner = v.npc; i.soldMonth = s.month;
        i.episodes.push({ id: i.episodes.length + 1, npc: v.npc, since: s.month, until: null, firstUsedMonth: null, lastUsedMonth: null, uses: 0 });
        history(s, i, `${PEOPLE[v.npc].name}買下並持有，支付 ${amount} 枚。`);
        s.npcs[v.npc].trust = add(s.npcs[v.npc].trust, 1); s.reputation = add(s.reputation, 1);
        if (v.kind === 'intro') { if (!s.tutorial.sold.includes(i.recipe)) s.tutorial.sold.push(i.recipe); v.needs = v.needs.filter(k => k !== i.recipe); } else v.needs = [];
        if (!v.needs.length) v.phase = 'service'; if (v.kind === 'commission') s.npcs[v.npc].goldDone = true;
        message = log(s, `${PEOPLE[v.npc].name}買下${RECIPES[i.recipe].name}，收入 ${amount} 枚。商品已轉入持有紀錄；顧客還在櫃臺。`); break;
      }
      case 'decline': case 'leave': {
        const v = scope(s, a);
        if (v.kind === 'intro' && (!openingDone(s) || !s.tutorial.ordered)) fail('阿岑會等兩件開場作品與第一張採購清單；可先關店準備。');
        if (a.type === 'leave' && v.phase !== 'service') fail('請先處理或婉拒這次需求。');
        v.status = v.phase === 'service' ? 'done' : 'declined'; v.counterId = null; message = log(s, `${PEOPLE[v.npc].name}離開櫃臺。下一位顧客才能進來。`); break;
      }
      case 'order': {
        const v = scope(s, a); if (!openingDone(s)) fail('先把木杖與鐵劍交給阿岑，再託他採購。');
        if (typeof a.requestId !== 'string' || !a.requestId || a.requestId.length > 100) fail('訂單識別碼不正確。');
        if (s.orders.some(o => o.requestId === a.requestId)) fail('這筆採購已委託，不會再扣款。');
        const cost = orderQuote(s, a.material, a.quantity), tutorial = !s.tutorial.ordered; charge(s, cost);
        s.orders.push({ id: `order-${s.seq = add(s.seq, 1)}`, requestId: a.requestId, npc: v.npc, material: a.material, quantity: a.quantity, cost, due: add(s.month, 1), status: 'pending', tutorial, deliveredMonth: null });
        s.tutorial.ordered = true; message = log(s, `委託${PEOPLE[v.npc].name}採購${a.material} ${a.quantity} 個，共 ${cost} 枚；第 ${s.month + 1} 月開店交付。`); break;
      }
      case 'appraise': {
        if (!canAppraise(s)) fail('先聽小禾說明品質需求，再做鑑定。');
        const i = s.items[a.itemId]; if (!i || i.status !== 'inventory') fail('只可鑑定工坊持有的實物。'); if (i.appraised) fail('這件物品已鑑定，不重複增加經驗。');
        i.appraised = true; s.xp.appraisal = add(s.xp.appraisal, 1);
        history(s, i, `鑑定：${i.material}第 ${RECIPES[i.recipe].tier} 階，${QUALITY[i.quality]}；效能 ${performance(i)}，耐久 ${i.durability}／${i.maxDurability}，${traitNames(i)}。`);
        message = log(s, `鑑定完成：${RECIPES[i.recipe].name}，${QUALITY[i.quality]}，效能 ${performance(i)}，耐久 ${i.durability}／${i.maxDurability}。`); break;
      }
      case 'reclaim': {
        const v = scope(s, a), o = s.returns.find(o => o.itemId === a.itemId && o.status === 'offered'), i = s.items[a.itemId];
        if (!o || !i || o.npc !== v.npc || i.status !== 'owned' || i.owner !== o.npc || episode(i).id !== o.episodeId) fail('只能當面領回目前顧客保管、同意贈還的舊物。');
        o.status = 'accepted'; episode(i).until = s.month; i.status = 'inventory'; i.owner = null; i.returned = true;
        history(s, i, `${PEOPLE[o.npc].name}因磨損退役贈還，實物回到工坊。`); message = log(s, `收下${PEOPLE[o.npc].name}贈還的${RECIPES[i.recipe].name}。可修復再售或熔鍊傳承。`); break;
      }
      case 'repair': {
        const i = s.items[a.itemId]; if (!i || i.status !== 'inventory' || !i.returned || i.repaired || i.durability === i.maxDurability) fail('只能修復尚未修復過的贈還舊物。');
        const before = i.durability; i.durability = i.maxDurability; i.repaired = true; history(s, i, `你練習修復接縫，耐久 ${before}→${i.maxDurability}，保留原特性。`);
        message = log(s, `修復${RECIPES[i.recipe].name}，恢復全耐久；每件舊物可免費練習修復一次。`); break;
      }
      case 'smelt': {
        const i = s.items[a.itemId]; if (!s.tutorial.delivered || !i || i.status !== 'inventory' || !i.returned) fail('只可熔鍊已合理領回、仍在庫存的舊物。');
        const reserved = s.orders.filter(o => o.status === 'pending' && o.material === i.material).reduce((n, o) => add(n, o.quantity), s.materials[i.material]); add(reserved, 1);
        i.status = 'smelted'; s.materials[i.material] = add(s.materials[i.material], 1); s.legacies.push({ itemId: i.id, material: i.material, traits: [...i.traits], usedBy: null });
        history(s, i, `熔鍊／拆解為${i.material} 1 個；${traitNames(i)}特性等待下一件同材質作品。`); message = log(s, `回收${i.material} 1 個與${traitNames(i)}特性傳承。`); break;
      }
      default: fail('沒有這個操作。');
    }
    s.revision = add(s.revision, 1); validate(s); return { state: s, message };
  }
  function validate(s) {
    const check = (test, field) => { if (!test) fail(`存檔格式不正確：${field}`); };
    const str = (v, max = 1000) => typeof v === 'string' && v.length <= max;
    const arr = v => Array.isArray(v) && v.length <= 20000;
    const unique = (a, key) => new Set(a.map(x => x[key])).size === a.length;
    const traits = t => arr(t) && t.length >= 1 && t.length <= 2 && new Set(t).size === t.length && t.every(x => Object.hasOwn(TRAITS, x));
    check(s && typeof s === 'object' && !Array.isArray(s) && s.schema === 2, '版本');
    for (const k of ['revision', 'month', 'lastSettled', 'coins', 'debt', 'seq', 'reputation']) check(integer(s[k]), k);
    check(s.lastSettled === s.month && typeof s.open === 'boolean', '月結');
    check(s.materials && MATERIALS.every(m => integer(s.materials[m])), '材料');
    check(s.xp && integer(s.xp.craft) && integer(s.xp.appraisal), '技能');
    check(s.tutorial && arr(s.tutorial.sold) && s.tutorial.sold.length <= 2 && new Set(s.tutorial.sold).size === s.tutorial.sold.length && s.tutorial.sold.every(k => ['staff', 'sword'].includes(k)) && typeof s.tutorial.ordered === 'boolean' && typeof s.tutorial.delivered === 'boolean', '教學');
    check(!s.tutorial.delivered || s.tutorial.ordered, '交貨前置'); check(!s.tutorial.ordered || openingDone(s), '採購前置');
    check(s.items && typeof s.items === 'object' && !Array.isArray(s.items) && Object.keys(s.items).length <= 20000, '物品');
    let highest = 0;
    for (const [id, i] of Object.entries(s.items)) {
      check(/^item-[1-9]\d*$/.test(id) && i && i.id === id, '物品識別'); highest = Math.max(highest, Number(id.split('-')[1]));
      check(Object.hasOwn(RECIPES, i.recipe) && i.material === RECIPES[i.recipe].material && integer(i.quality, 0, 2), '配方');
      check(traits(i.traits) && i.maxDurability === 9 && integer(i.durability, 0, i.maxDurability) && typeof i.repaired === 'boolean', '裝備參數');
      check(['inventory', 'owned', 'smelted'].includes(i.status) && (i.status === 'owned' ? Object.hasOwn(PEOPLE, i.owner) : i.owner === null), '持有者');
      check(integer(i.createdMonth, 0, s.month) && (i.soldMonth === null || integer(i.soldMonth, i.createdMonth, s.month)), '物品月份');
      check(['appraised', 'usedEvent', 'retirementOffered', 'returned'].every(k => typeof i[k] === 'boolean'), '物品事件');
      check(i.legacy === null || str(i.legacy, 50), '傳承');
      check(arr(i.history) && i.history.every(h => h && integer(h.month, 0, s.month) && str(h.text)), '歷史');
      check(arr(i.episodes), '持有期');
      let end = i.createdMonth;
      for (let n = 0; n < i.episodes.length; n++) {
        const e = i.episodes[n];
        check(e && e.id === n + 1 && Object.hasOwn(PEOPLE, e.npc) && integer(e.since, end, s.month) && (e.until === null ? n === i.episodes.length - 1 && i.status === 'owned' : integer(e.until, e.since, s.month)), '持有期範圍');
        check(integer(e.uses) && (e.uses === 0 ? e.firstUsedMonth === null && e.lastUsedMonth === null : integer(e.firstUsedMonth, e.since, e.until === null ? s.month : e.until) && integer(e.lastUsedMonth, e.firstUsedMonth, e.until === null ? s.month : e.until)), '使用紀錄');
        end = e.until === null ? s.month : e.until;
      }
      check(i.status !== 'owned' || episode(i) && episode(i).npc === i.owner && episode(i).until === null && episode(i).since === i.soldMonth, '當前持有期');
    }
    for (const k of ['orders', 'visits', 'news', 'returns', 'legacies', 'log']) check(arr(s[k]), k);
    check(s.log.every(t => str(t)), '記事');
    check(unique(s.orders, 'id') && unique(s.orders, 'requestId'), '訂單重複');
    for (const o of s.orders) {
      check(o && /^order-[1-9]\d*$/.test(o.id) && str(o.requestId, 100) && o.requestId.length > 0 && Object.hasOwn(PEOPLE, o.npc) && MATERIALS.includes(o.material) && integer(o.quantity, 1) && integer(o.cost) && o.cost === COST[o.material] * o.quantity && integer(o.due, 1) && ['pending', 'delivered'].includes(o.status) && typeof o.tutorial === 'boolean', '訂單');
      check(o.status === 'pending' ? o.due > s.month && o.deliveredMonth === null : integer(o.deliveredMonth, o.due, s.month), '交付');
      highest = Math.max(highest, Number(o.id.split('-')[1]));
    }
    for (const m of MATERIALS) { const reserved = s.orders.filter(o => o.status === 'pending' && o.material === m).reduce((sum, o) => sum + o.quantity, s.materials[m]); check(integer(reserved), '材料預留溢位'); }
    check(s.seq >= highest && integer(highest), '序號');
    check(unique(s.visits, 'id') && unique(s.visits.filter(v => v.status === 'waiting'), 'npc'), '來客重複');
    check(s.visits.every(v => v && str(v.id, 100) && Object.hasOwn(PEOPLE, v.npc) && integer(v.month, 1, s.month) && arr(v.needs) && v.needs.every(k => Object.hasOwn(RECIPES, k)) && ['intro', 'normal', 'commission', 'return'].includes(v.kind) && ['waiting', 'done', 'declined'].includes(v.status) && ['request', 'service'].includes(v.phase) && typeof v.asked === 'boolean' && integer(v.minQuality, 0, 2) && str(v.reason) && (v.traitRequired === null || Object.hasOwn(TRAITS, v.traitRequired)) && (v.status !== 'waiting' || (v.phase === 'request' ? v.needs.length > 0 : v.needs.length === 0)) && (v.counterId === null || str(v.counterId, 130)) && (v.status !== 'waiting' || !s.open || v.counterId === `${v.id}@${s.month}`)), '需求');
    check(unique(s.news, 'id') && s.news.every(n => n && str(n.id, 100) && integer(n.month, 1, s.month) && str(n.text) && (n.itemId === null || Object.hasOwn(s.items, n.itemId))), '鳥信');
    check(unique(s.returns, 'itemId') && s.returns.every(o => o && Object.hasOwn(s.items, o.itemId) && Object.hasOwn(PEOPLE, o.npc) && ['offered', 'accepted'].includes(o.status) && integer(o.episodeId, 1) && s.items[o.itemId].episodes.some(e => e.id === o.episodeId && e.npc === o.npc) && (o.status !== 'offered' || s.items[o.itemId].status === 'owned' && s.items[o.itemId].owner === o.npc && episode(s.items[o.itemId]).id === o.episodeId)), '舊物贈還');
    check(unique(s.legacies, 'itemId') && s.legacies.every(l => l && Object.hasOwn(s.items, l.itemId) && s.items[l.itemId].status === 'smelted' && l.material === s.items[l.itemId].material && traits(l.traits) && (l.usedBy === null || Object.hasOwn(s.items, l.usedBy) && s.items[l.usedBy].legacy === l.itemId && s.items[l.usedBy].material === l.material)), '熔鍊傳承');
    check(Object.values(s.items).every(i => i.legacy === null || s.legacies.some(l => l.itemId === i.legacy && l.usedBy === i.id)), '傳承來源');
    check(Object.values(s.items).filter(i => i.status === 'smelted').every(i => s.legacies.some(l => l.itemId === i.id)), '熔鍊紀錄');
    check(s.npcs && Object.keys(PEOPLE).every(id => {
      const p = s.npcs[id];
      return p && integer(p.trust) && typeof p.story === 'boolean' && typeof p.goldDone === 'boolean' && (p.story ? Object.hasOwn(s.items, p.storyItem) && s.items[p.storyItem].episodes.some(e => e.npc === id && e.firstUsedMonth !== null && e.firstUsedMonth < s.month) : p.storyItem === null);
    }), '人物故事證據');
    return true;
  }
  const LEGACY_RECIPES = { staff: {material:'木頭'}, sword:{material:'鐵'}, stool:{material:'木頭'}, watering:{material:'銅'}, lamp:{material:'銀'}, bell:{material:'金'} };
  const legacyInteger = (v, min = 0, max = 1e9) => integer(v, min, max);
  function validateLegacy(s) {
    const check = (test, message) => { if (!test) fail(`存檔格式不正確：${message}`); };
    const strings = (v, max = 1000) => typeof v === 'string' && v.length <= max;
    const array = v => Array.isArray(v) && v.length <= 20000;
    check(s && typeof s === 'object' && !Array.isArray(s) && s.schema === 1, '版本');
    for (const k of ['revision', 'month', 'lastSettled', 'coins', 'debt', 'seq', 'reputation']) check(legacyInteger(s[k]), k);
    check(s.lastSettled === s.month && typeof s.open === 'boolean', '月結');
    check(s.materials && MATERIALS.every(m => legacyInteger(s.materials[m])), '材料');
    check(s.xp && legacyInteger(s.xp.craft) && legacyInteger(s.xp.appraisal), '技能');
    check(s.npcs && Object.keys(PEOPLE).every(id => s.npcs[id] && legacyInteger(s.npcs[id].trust) && typeof s.npcs[id].story === 'boolean' && typeof s.npcs[id].goldDone === 'boolean'), '人物');
    check(s.tutorial && array(s.tutorial.sold) && s.tutorial.sold.length <= 2 && new Set(s.tutorial.sold).size === s.tutorial.sold.length && s.tutorial.sold.every(k => ['staff', 'sword'].includes(k)) && typeof s.tutorial.ordered === 'boolean' && typeof s.tutorial.delivered === 'boolean', '教學');
    check(!s.tutorial.delivered || s.tutorial.ordered, '交付前置');
    check(!s.tutorial.ordered || openingDone(s), '採購前置');
    check(s.items && typeof s.items === 'object' && !Array.isArray(s.items) && Object.keys(s.items).length <= 20000, '物品表');
    let highest = 0;
    for (const [id, i] of Object.entries(s.items)) {
      check(/^item-[1-9]\d*$/.test(id) && i && i.id === id, '物品識別');
      highest = Math.max(highest, Number(id.split('-')[1]));
      check(Object.hasOwn(LEGACY_RECIPES, i.recipe) && i.material === LEGACY_RECIPES[i.recipe].material && legacyInteger(i.quality, 0, 2), '配方／品質');
      check(['inventory', 'owned', 'smelted'].includes(i.status), '持有狀態');
      check(i.status === 'owned' ? Object.hasOwn(PEOPLE, i.owner) : i.owner === null, '持有者');
      check(legacyInteger(i.createdMonth, 0, s.month) && (i.soldMonth === null || legacyInteger(i.soldMonth, i.createdMonth, s.month)), '物品月份');
      check(i.status !== 'owned' || i.soldMonth !== null, '成交月份');
      check(['appraised', 'usedEvent', 'retirementOffered', 'returned'].every(k => typeof i[k] === 'boolean'), '物品事件');
      check(i.legacy === null || strings(i.legacy, 50), '傳承');
      check(array(i.history) && i.history.every(h => h && legacyInteger(h.month, 0, s.month) && strings(h.text)), '物品歷史');
    }
    for (const k of ['orders', 'visits', 'news', 'returns', 'legacies', 'log']) check(array(s[k]), k);
    check(s.log.every(t => strings(t)), '日誌');
    const unique = (list, key) => new Set(list.map(x => x[key])).size === list.length;
    check(unique(s.orders, 'id') && unique(s.orders, 'requestId'), '訂單重複');
    for (const o of s.orders) {
      check(o && /^order-[1-9]\d*$/.test(o.id) && strings(o.requestId, 100) && o.requestId.length > 0 && MATERIALS.includes(o.material) && legacyInteger(o.quantity, 1, 9) && o.cost === COST[o.material] * o.quantity && legacyInteger(o.due, 1) && ['pending', 'delivered'].includes(o.status) && typeof o.tutorial === 'boolean', '訂單');
      check(o.status === 'pending' ? o.due > s.month && o.deliveredMonth === null : legacyInteger(o.deliveredMonth, o.due, s.month), '交付');
      highest = Math.max(highest, Number(o.id.split('-')[1]));
    }
    check(s.seq >= highest, '序號');
    check(unique(s.visits, 'id') && unique(s.visits.filter(v => v.status === 'waiting'), 'npc'), '來客重複');
    check(s.visits.every(v => v && strings(v.id, 100) && Object.hasOwn(PEOPLE, v.npc) && legacyInteger(v.month, 1, s.month) && array(v.needs) && v.needs.every(k => Object.hasOwn(LEGACY_RECIPES, k)) && ['intro', 'normal', 'commission'].includes(v.kind) && ['waiting', 'done', 'declined'].includes(v.status) && typeof v.asked === 'boolean' && (v.status !== 'waiting' || v.needs.length > 0)), '需求');
    check(unique(s.news, 'id') && s.news.every(n => n && strings(n.id, 100) && legacyInteger(n.month, 1, s.month) && strings(n.text) && (n.itemId === null || Object.hasOwn(s.items, n.itemId))), '鳥信');
    check(unique(s.returns, 'itemId') && s.returns.every(o => o && Object.hasOwn(s.items, o.itemId) && Object.hasOwn(PEOPLE, o.npc) && ['offered', 'accepted'].includes(o.status) && (o.status !== 'offered' || s.items[o.itemId].status === 'owned' && s.items[o.itemId].owner === o.npc)), '舊物交還');
    check(unique(s.legacies, 'itemId') && s.legacies.every(l => l && Object.hasOwn(s.items, l.itemId) && s.items[l.itemId].status === 'smelted' && l.material === s.items[l.itemId].material && (l.usedBy === null || Object.hasOwn(s.items, l.usedBy) && s.items[l.usedBy].legacy === l.itemId && s.items[l.usedBy].material === l.material)), '熔鍊傳承');
    check(Object.values(s.items).every(i => i.legacy === null || s.legacies.some(l => l.itemId === i.legacy && l.usedBy === i.id)), '傳承來源');
    check(Object.values(s.items).filter(i => i.status === 'smelted').every(i => s.legacies.some(l => l.itemId === i.id)), '熔鍊紀錄');
    return true;
  }

  function migrate(old) {
    validateLegacy(old);
    const s = clone(old), map = { stool: 'shield', watering: 'bracer', lamp: 'amulet' };
    const mapped = id => map[id] || id;
    const rewrite = text => text.replace(/銅澆水壺/g, '銅護腕').replace(/木凳/g, '木盾').replace(/銀燈/g, '銀護符').replace(/菜圃照料者/g, '重視個人防護的熟客').replace(/圖書室管理者/g, '魔法裝備使用者');
    s.schema = 2;
    for (const [npc, p] of Object.entries(s.npcs)) { p.story = false; p.storyItem = null; }
    for (const i of Object.values(s.items)) {
      i.recipe = mapped(i.recipe); i.traits = [RECIPES[i.recipe].trait];
      if (i.legacy) i.traits.push(i.traits[0] === 'solid' ? 'guard' : 'solid');
      i.maxDurability = 9;
      i.durability = s.returns.some(o => o.itemId === i.id && o.status === 'offered') || i.status !== 'owned' && i.returned ? 3 : 9;
      i.repaired = false; i.episodes = [];
      for (const h of i.history) {
        const npc = Object.keys(PEOPLE).find(id => h.text.startsWith(PEOPLE[id].name));
        if (npc && h.text.includes('買下')) {
          const previous = episode(i); if (previous && previous.until === null) previous.until = h.month;
          i.episodes.push({ id: i.episodes.length + 1, npc, since: h.month, until: null, firstUsedMonth: null, lastUsedMonth: null, uses: 0 });
        } else if (npc && h.text.includes('使用')) {
          const e = episode(i);
          if (e && e.npc === npc) { e.firstUsedMonth ??= h.month; e.lastUsedMonth = h.month; e.uses++; }
          h.text = `${PEOPLE[npc].name}使用「${RECIPES[i.recipe].name}」：已留下使用紀錄，用途為${RECIPES[i.recipe].use}。（舊版紀錄；新耐久自更新起計。）`;
        } else if (npc && h.text.includes('退役贈還')) { const e = episode(i); if (e) e.until = h.month; }
        h.text = rewrite(h.text);
      }
      let e = episode(i);
      if (i.status === 'owned' && (!e || e.npc !== i.owner || e.until !== null)) { if (e && e.until === null) e.until = i.soldMonth; i.episodes.push({ id: i.episodes.length + 1, npc: i.owner, since: i.soldMonth, until: null, firstUsedMonth: null, lastUsedMonth: null, uses: 0 }); }
      else if (i.status !== 'owned' && e && e.until === null) e.until = s.month;
    }
    for (const o of s.orders) o.npc = 'cen';
    for (const o of s.returns) { const i = s.items[o.itemId]; o.episodeId = [...i.episodes].reverse().find(e => e.npc === o.npc)?.id; }
    for (const l of s.legacies) l.traits = [...s.items[l.itemId].traits];
    for (const v of s.visits) {
      v.needs = v.needs.map(mapped); v.phase = v.status === 'waiting' && v.needs.length ? 'request' : 'service';
      v.minQuality = 0; v.traitRequired = null; v.reason = v.kind === 'intro' ? '' : '這次需要一件狀態良好的裝備，可作替換或備用。';
      if (v.phase === 'service') v.needs = [];
      v.counterId = v.status === 'waiting' && s.open ? `${v.id}@${s.month}` : null;
    }
    // v1 prematurely removed the tutorial customer before the first order.
    if (openingDone(s) && !s.tutorial.ordered) {
      const v = s.visits.find(v => v.id === 'intro-cen');
      if (v) { v.status = 'waiting'; v.phase = 'service'; v.needs = []; v.counterId = s.open ? `${v.id}@${s.month}` : null; }
      else if (s.month) addVisit(s, 'cen', [], 'intro', { counterId: s.open ? `intro-cen@${s.month}` : null }, 'intro-cen');
    }
    for (const n of s.news) {
      if (n.id.startsWith('story-')) { n.text = `${n.text.split('講起故事')[0]}關係紀錄：彼此逐漸熟悉。（舊版固定故事未作為使用證據。）`; continue; }
      if (n.id.startsWith('use-') && n.itemId) {
        const i = s.items[n.itemId]; n.text = i.history.find(h => h.month === n.month && h.text.includes('使用「'))?.text || `「${RECIPES[i.recipe].name}」的舊版使用紀錄已保留；用途為${RECIPES[i.recipe].use}。`;
      } else if (n.id.startsWith('retire-') && n.itemId) n.text = `${PEOPLE[s.returns.find(o => o.itemId === n.itemId)?.npc || 'cen'].name}的舊版退役贈還約定仍保留；可在對方到櫃臺時領回「${RECIPES[s.items[n.itemId].recipe].name}」。`;
      else n.text = rewrite(n.text);
    }
    // Legacy dialogue/log purposes are rewritten, while dated transaction amounts stay intact.
    s.log = s.log.map(t => /菜圃|種子|嫩芽|還書|圖書室|澆水|坐下/.test(t) && !/支付|收入|枚；/.test(t) ? rewrite(t.split('：')[0]) + '：舊版用途紀錄已轉為裝備需求；持有與交易進度保留。' : rewrite(t));
    validate(s); return s;
  }
  function exportSave(s) { validate(s); return JSON.stringify({ game: '鳥信工坊', schema: 2, state: s }, null, 2); }
  function importSave(text) {
    if (typeof text !== 'string' || text.length > 8 * 1024 * 1024) fail('備份太大或格式不正確。');
    const d = JSON.parse(text);
    if (!d || d.game !== '鳥信工坊' || ![1, 2].includes(d.schema) || !d.state || d.state.schema !== d.schema) fail('這不是鳥信工坊格式備份。');
    if (d.schema === 1) return migrate(d.state);
    validate(d.state); return clone(d.state);
  }
  return { MATERIALS, COST, RECIPES, TRAITS, PEOPLE, QUALITY, QUALITY_PRICE, initialState, inventory, owned, activeVisit, openingDone, unlocked, visibleRecipes, canAppraise, requestDetail, price, suitable, tutorialStep, performance, traitNames, useResult, orderQuote, dispatch, validate, exportSave, importSave };
});
