(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./content.js') : root.WorkshopContent);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Workshop = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CONTENT) {
  'use strict';
  const MATERIALS = ['木頭', '鐵', '銅', '銀', '金'];
  const COST = { 木頭: 3, 鐵: 6, 銅: 10, 銀: 16, 金: 24 };
  const TRAITS = {
    light: { name: '輕巧', powerBonus: 1 },
    solid: { name: '堅固', wearReduction: 1 },
    guard: { name: '護身', useBonus: 2, appliesTo: ['sword', 'shield', 'bracer', 'amulet'] }
  };
  const RECIPES = {
    staff: { name: '木杖', material: '木頭', tier: 1, kind: 'staff', use: '引導魔力與照路', symbol: '杖', trait: 'light' },
    sword: { name: '鐵劍', material: '鐵', tier: 2, kind: 'sword', use: '攜帶防身', symbol: '劍', trait: 'solid' },
    shield: { name: '木盾', material: '木頭', tier: 1, kind: 'shield', use: '抵擋飛石與衝擊', symbol: '盾', trait: 'solid' },
    bracer: { name: '銅護腕', material: '銅', tier: 3, kind: 'bracer', use: '保護手臂與穩定魔力', symbol: '腕', trait: 'guard' },
    amulet: { name: '銀護符', material: '銀', tier: 4, kind: 'amulet', use: '佩戴護身與抵禦魔法干擾', symbol: '符', trait: 'guard' },
    bell: { name: '金鈴', material: '金', tier: 5, kind: 'bell', use: '佩戴後感應接近的危險', symbol: '鈴', trait: 'light' }
  };
  TRAITS.light.text = `效能＋${TRAITS.light.powerBonus}（所有用途）`;
  TRAITS.solid.text = `每次使用磨耗－${TRAITS.solid.wearReduction}，最低1點（不超過剩餘耐久）`;
  TRAITS.guard.text = `限${TRAITS.guard.appliesTo.map(id => RECIPES[id].name.replace(/^(銅|銀)/, '')).join('／')}使用判定＋${TRAITS.guard.useBonus}，面板效能不變`;
  const PEOPLE = { cen: { name: '阿岑', role: '熟客' }, he: { name: '小禾', role: '重視個人防護的熟客' }, shu: { name: '望舒', role: '魔法裝備使用者' } };
  const QUALITY = ['樸實', '細緻', '精良'], QUALITY_PRICE = [14, 20, 26];
  const CRAFT_MONTHS = { staff: 1, sword: 1, shield: 1, bracer: 1, amulet: 2, bell: 2 }, EXPLORATION_COST = 6;
  const MAX = Number.MAX_SAFE_INTEGER;
  const clone = s => JSON.parse(JSON.stringify(s));
  const fail = message => { throw new Error(message); };
  const integer = (v, min = 0, max = MAX) => Number.isSafeInteger(v) && v >= min && v <= max;
  function add(a, b) { const n = a + b; if (!integer(n)) fail('數值超出安全整數範圍，未執行操作。'); return n; }
  function multiply(a, b) { const n = a * b; if (!integer(n)) fail('總價超出安全整數範圍，未執行採購。'); return n; }
  function initialState() {
    return { schema: 5, revision: 0, month: 0, lastSettled: 0, open: false, coins: 20, debt: 0, seq: 0, monthReview: null,
      materials: { 木頭: 3, 鐵: 3, 銅: 0, 銀: 0, 金: 0 }, knownMaterials: ['木頭', '鐵'], explorations: [], commissions: [], legacyTaskIds: [], items: {}, xp: { craft: 0, appraisal: 0 }, reputation: 0,
      npcs: Object.fromEntries(Object.keys(PEOPLE).map(id => [id, { trust: 0, story: false, goldDone: false, storyItem: null }])),
      tutorial: { sold: [], ordered: false, delivered: false }, orders: [], visits: [], news: [], returns: [], legacies: [], content: emptyContent(), journey: emptyJourney(),
      log: ['師傅留下木頭與鐵各 3 個。先開始木杖和鐵劍，下次開店完成，熟客阿岑會來收。'] };
  }
  const inventory = s => Object.values(s.items).filter(i => i.status === 'inventory');
  const owned = (s, npc) => Object.values(s.items).filter(i => i.status === 'owned' && i.owner === npc);
  const activeVisit = s => s.open ? s.visits.find(v => v.status === 'waiting') || null : null;
  const openingDone = s => ['staff', 'sword'].every(k => s.tutorial.sold.includes(k));
  const knownMaterials = s => [...s.knownMaterials];
  const nextUnknown = s => MATERIALS.find(m => !s.knownMaterials.includes(m)) || null;
  function pendingTasks(s, npc) {
    return [...s.orders.filter(o => o.npc === npc && o.status === 'pending').map(o => ({ id: o.id, label: '玩家請對方採購', due: o.due })), ...s.explorations.filter(e => e.npc === npc && e.status === 'pending').map(e => ({ id: e.id, label: '玩家請對方探索', due: e.due })), ...(s.schema >= 5 ? s.journey?.outings || [] : []).filter(o => o.npc === npc && o.status === 'pending').map(o => ({ id: o.id, label: o.kind === 'scout' ? '玩家請對方近程勘路' : '玩家請對方驛道採集', due: o.due })), ...s.commissions.filter(c => c.npc === npc && !['delivered', 'cancelled'].includes(c.status)).map(c => ({ id: c.id, label: '對方請工坊製作', due: c.itemId ? s.items[c.itemId].dueMonth : null })), ...s.visits.filter(v => v.npc === npc && v.kind === 'commission' && v.status === 'waiting' && v.phase === 'request').map(v => ({ id: v.id, label: '對方的金鈴委託', due: null }))];
  }
  function requireFreeTask(s, npc) { if (pendingTasks(s, npc).length) fail(`${PEOPLE[npc].name}已有未完成委託，完成後才能接下一件；材料派遣與客人製作共用這個限制。`); }
  function knowledgeText(s, text) {
    for (const [r, alias] of Object.entries({ bracer: '一種護腕', amulet: '一種護符', bell: '警示飾品' })) if (!s.knownMaterials.includes(RECIPES[r].material)) text = text.replaceAll(RECIPES[r].name, alias);
    return text;
  }
  function unlocked(s, id) {
    if (!RECIPES[id] || !s.knownMaterials.includes(RECIPES[id].material)) return false;
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
  const performance = i => RECIPES[i.recipe].tier * 2 + i.quality * 2 + i.traits.reduce((n, t) => n + (TRAITS[t].powerBonus || 0), 0);
  const traitNames = i => i.traits.map(t => TRAITS[t].name).join('、');
  const traitDetails = value => (Array.isArray(value) ? value : value.traits).map(t => `${TRAITS[t].name}（${TRAITS[t].text}）`).join('；');
  const episode = i => i.episodes.at(-1) || null;
  function useResult(i) {
    const score = performance(i) + i.traits.reduce((n, t) => n + (TRAITS[t].appliesTo?.includes(i.recipe) ? TRAITS[t].useBonus : 0), 0);
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
    return { score, strong, wear: Math.min(i.durability, Math.max(1, (strong ? 2 : 3) - i.traits.reduce((n, t) => n + (TRAITS[t].wearReduction || 0), 0))), text: texts[i.recipe][strong ? 0 : 1] + (extra ? '，效能餘裕充足，操作更加從容' : '') };
  }
  function requestDetail(v) {
    if (v.phase === 'service') return v.kind === 'intro' ? '兩件武器都收好了。需要材料時再交代清單，也可以先離開。' : v.contextText || '這次需求已辦妥。我還在櫃臺，可以交代採購或領回我贈還的舊物。';
    if (v.kind === 'intro') return '木杖照路，鐵劍防身。兩件都由我自己使用。';
    const details = { staff: '我要用木杖引導魔力，照亮走路的方向。', sword: '外出時需要鐵劍防身，格擋時握持要穩。', shield: '想用木盾保護自己，擋住飛石與衝擊。', bracer: '想用銅護腕保護手臂，也讓魔力更穩定。請幫我看看接縫與品質。', amulet: '想佩戴銀護符，抵禦路上的魔法干擾。', bell: '想佩戴金鈴，接近危險時能先得到警示。' };
    return `${details[v.needs[0]] || '我帶了退役舊物來贈還。'}${v.reason ? ` ${v.reason}` : ''}${v.traitRequired ? ` 希望有「${TRAITS[v.traitRequired].name}」特性。` : ''}`;
  }
  function suitable(s, i, v = activeVisit(s)) {
    return recommendationReason(s, i, v) === '';
  }
  function recommendationReason(s, i, v = activeVisit(s)) {
    if (!v) return '目前沒有顧客在櫃臺。';
    if (v.phase !== 'request') return '這次需求已辦妥，顧客暫時不再購物。';
    if (!i || i.status !== 'inventory') return '物品已不在工坊庫存。';
    if (v.kind === 'delivery' && i.reservedFor !== v.commissionId) return '本人來領指定的委託成品，這件不是該份委託。';
    if (i.reservedFor && (v.kind !== 'delivery' || v.commissionId !== i.reservedFor)) return `這件是${PEOPLE[s.commissions.find(c => c.id === i.reservedFor).npc].name}的製作委託成品，交付前不能一般出售。`;
    if (s.returns.some(o => o.itemId === i.id && o.npc === v.npc)) return `${PEOPLE[v.npc].name}已退役並贈還這一件，不再買回同一舊物；可推薦給其他使用者。`;
    if (!v.needs.includes(i.recipe)) return `目前需要${v.needs.map(r => RECIPES[r].name).join('或')}，這件的用途不同。`;
    if (i.durability <= 3) return `耐久只剩 ${i.durability}／${i.maxDurability}，先修復才能推薦。`;
    if (i.quality < v.minQuality) return `顧客要${QUALITY[v.minQuality]}以上品質，這件是${QUALITY[i.quality]}。`;
    if (v.traitRequired && !i.traits.includes(v.traitRequired)) return `這次需要「${TRAITS[v.traitRequired].name}」特性，這件沒有。`;
    return '';
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
    s.visits.push({ id, month: s.month, npc, needs, kind, asked: false, status: 'waiting', phase: needs.length ? 'request' : 'service', counterId: `${id}@${s.month}`, reason: '', minQuality: 0, traitRequired: null, contentKey: null, contextText: '', ...extra });
  }
  function emptyContent() {
    return { events: [], declined: Object.fromEntries(Object.keys(PEOPLE).map(npc => [npc, Object.fromEntries(Object.keys(RECIPES).map(r => [r, 0]))])) };
  }
  const eventDone = (s, key) => s.content.events.find(e => e.key === key) || null;
  const JOURNEY_KEYS = ['he-near', 'he-clue', 'he-survey', 'road-open'];
  function emptyJourney() { return { growth: { he: { level: 1, pathfinding: 0 } }, outings: [], events: [] }; }
  function nearProof(s, month = s.month) {
    return [...s.explorations.filter(e => e.npc === 'he').map(e => ({ ...e, source: 'exploration' })), ...(s.journey?.outings || []).filter(o => o.kind === 'scout').map(o => ({ ...o, source: 'outing' }))]
      .filter(e => e.status === 'delivered' && e.deliveredMonth <= month && s.news.some(n => n.id === `${e.source === 'exploration' ? 'exploration' : 'outing'}-${e.id}` && n.month === e.deliveredMonth && n.text.startsWith('小禾'))).sort((a, b) => a.deliveredMonth - b.deliveredMonth || a.id.localeCompare(b.id))[0] || null;
  }
  function earnedGrowth(s, month = s.month) {
    const count = Number(!!nearProof(s, month)) + ['he-wrist', 'he-shield'].filter(key => eventDone(s, key)?.month <= month).length;
    return { level: 1 + Math.floor(count / 2), pathfinding: count };
  }
  function canScout(s) { return s.tutorial.delivered && !nearProof(s) && !s.journey.outings.some(o => o.kind === 'scout'); }
  function journeyProgress(s) { return { ...s.journey.growth.he, stage: s.journey.events.length }; }
  function roadState(s) { return s.journey.events.some(e => e.key === 'road-open') ? 'restored' : s.journey.events.some(e => e.key === 'he-survey') ? 'marked' : 'unknown'; }
  function explorationQuantity(s) { return roadState(s) === 'restored' ? 3 : 2; }
  function reservedMaterial(s, material) {
    return [...s.orders, ...s.explorations, ...(s.journey?.outings || [])].filter(o => o.status === 'pending' && o.material === material)
      .reduce((n, o) => add(n, o.quantity || 2), s.materials[material]);
  }
  function journeyGear(s, recipe, justUsed = false) {
    return owned(s, 'he').find(i => i.recipe === recipe && performance(i) >= (recipe === 'bracer' ? 8 : 4)
      && i.traits.includes(recipe === 'bracer' ? 'guard' : 'solid') && i.durability >= 4
      && !s.returns.some(o => o.itemId === i.id && o.status === 'offered')
      && (justUsed ? episode(i).since < s.month && episode(i).lastUsedMonth === s.month : i.durability - useResult(i).wear >= 4)) || null;
  }
  function journeyHint(s) {
    const p = journeyProgress(s);
    if (!s.tutorial.delivered) return '';
    if (p.stage === 0 && pendingTasks(s, 'he').some(t => t.label.includes('勘路') || t.label.includes('探索'))) return '近程行動已出發，下月回報；目前先等結果。';
    if (p.stage === 0) return nearProof(s) ? '近程探索的路線我記下了，下次整理給你。' : '我想先熟悉近程路線；可以託我勘路，或探索一條新材料線索。';
    if (p.stage === 1) return eventDone(s, 'he-wrist') ? '溪口的使用經歷已記下，下次整理那條舊路的線索。' : '近程路線已熟悉；還要親自試過手臂防護，才知道溪口能怎麼走。';
    if (p.stage === 2) {
      if (p.pathfinding < 3 || !eventDone(s, 'he-shield')) return '發現舊驛道的路標了；還要親自試過飛石防護，累積辨路經驗再勘查。';
      if (!journeyGear(s, 'bracer')) return '舊驛道路標待勘查；想補一只細緻以上、護身穩定且耐久充足的護腕。';
      return '勘查裝備備好了；下次親自使用後，再回報舊路標。';
    }
    if (p.stage === 3) {
      if (!journeyGear(s, 'bracer')) return '路標已確認；護腕磨損或防護不足，先補好再通行。';
      if (!journeyGear(s, 'shield')) return '路標已確認；還需要細緻以上、堅固且耐久充足的木盾，才能清理碎石通路。';
      return '護腕和木盾已備好；下次親自使用後，試著接通舊驛道。';
    }
    return '舊驛道已重通；新探索多帶一份材料，也能沿驛道採集已知材料。';
  }
  function journeyDemand(s, npc) {
    const p = journeyProgress(s);
    if (npc !== 'he' || p.stage < 2 || p.stage >= 4 || !eventDone(s, 'he-shield')) return null;
    const recipe = !journeyGear(s, 'bracer') ? 'bracer' : p.stage >= 3 && !journeyGear(s, 'shield') ? 'shield' : null;
    return recipe && unlocked(s, recipe) ? { needs: [recipe], reason: journeyHint(s), minQuality: 1, traitRequired: RECIPES[recipe].trait, contentKey: null } : null;
  }
  function refreshJourneyRequest(s) {
    const required = journeyDemand(s, 'he');
    if (!required) return;
    const visit = s.visits.find(v => v.npc === 'he' && v.status === 'waiting' && v.phase === 'request'
      && ['normal', 'return'].includes(v.kind) && v.needs.includes(required.needs[0]));
    if (!visit) return;
    visit.minQuality = Math.max(visit.minQuality, required.minQuality);
    visit.traitRequired ||= required.traitRequired;
    visit.reason = required.reason;
  }
  function journeySnapshot(i) {
    const wear = useResult({ ...i, durability: 9 }).wear;
    return { itemId: i.id, episodeId: episode(i).id, before: i.durability + wear, after: i.durability, score: performance(i) };
  }
  function advanceJourney(s) {
    s.journey.growth.he = earnedGrowth(s);
    const stage = s.journey.events.length, previous = s.journey.events.at(-1);
    if (stage >= 4 || previous?.month === s.month) return;
    let source = null, gear = [], text = '';
    if (stage === 0) {
      const proof = nearProof(s); if (!proof) return;
      source = { type: proof.source, id: proof.id };
      text = '小禾整理實際走過的近程路線，辨路經歷已留下。她想把溪口的裝備使用紀錄一起帶來對照。';
    } else if (stage === 1) {
      const proof = eventDone(s, 'he-wrist'); if (!proof || proof.month >= s.month) return;
      source = { type: 'content', id: proof.key };
      text = '小禾把近程路線與先前「溪口亂流」紀錄對照，發現岔路旁的舊驛道路標。路標後方仍未確認，她先保留這條線索。';
    } else {
      const p = journeyProgress(s), proof = eventDone(s, 'he-shield'), bracer = journeyGear(s, 'bracer', true);
      if (p.level < 2 || p.pathfinding < 3 || !proof || proof.month >= s.month || !bracer) return;
      source = { type: 'content', id: proof.key }; gear.push(journeySnapshot(bracer));
      if (stage === 2) text = '小禾帶著護身護腕，運用溪口與碎石轉角的經驗勘查舊路標。標記位置已確認，驛道還有碎石待清理；這次先平安返回。';
      else {
        const shield = journeyGear(s, 'shield', true); if (!shield || roadState(s) !== 'marked') return;
        gear.push(journeySnapshot(shield));
        text = '小禾循已確認的路標，用護腕穩定魔力、木盾擋開鬆動碎石，接通了舊驛道。往後新探索多帶一份材料，工坊也可委託她沿驛道採集已辨識材料。';
      }
    }
    const key = JOURNEY_KEYS[stage], newsId = `journey-${key}`;
    s.journey.events.push({ key, month: s.month, source, gear, ...earnedGrowth(s), newsId, text });
    news(s, newsId, text, gear[0]?.itemId || null);
  }
  function eventEligible(s, def, i) {
    if (eventDone(s, def.id) || i.recipe !== def.recipe || def.requires && !eventDone(s, def.requires)) return false;
    if (def.trigger === 'cross') return i.owner !== def.npc && s.returns.some(o => o.itemId === i.id && o.npc === def.npc && o.status === 'accepted');
    if (i.owner !== def.npc) return false;
    if (def.trigger === 'replacement') {
      const old = s.items[eventDone(s, def.requires).itemId];
      return old.id !== i.id && (old.durability <= 3 || old.retirementOffered) && old.episodes.some(e => e.npc === def.npc && e.uses > 0);
    }
    return true;
  }
  function contentUse(s, i, result, before, newsId) {
    const narrative = [], e = episode(i);
    for (const def of CONTENT.EVENTS) {
      if (!eventEligible(s, def, i)) continue;
      const branch = def.branches.find(b => (b.strong === undefined || b.strong === result.strong) && (!b.trait || i.traits.includes(b.trait)));
      const text = knowledgeText(s, branch.text.replace(/\{(actor|wear)\}/g, (_, key) => key === 'actor' ? PEOPLE[i.owner].name : String(result.wear)));
      s.content.events.push({ key: def.id, month: s.month, npc: def.npc, actor: i.owner, itemId: i.id, episodeId: e.id, branch: branch.id, before, after: i.durability, score: result.score, wear: result.wear, newsId, text });
      narrative.push(`「${def.title}」${text}`);
    }
    return narrative;
  }
  function demand(s, npc) {
    const special = journeyDemand(s, npc); if (special) return special;
    const healthy = (r, q = 0) => owned(s, npc).some(i => i.recipe === r && i.durability > 3 && i.quality >= q && !s.returns.some(o => o.itemId === i.id && o.status === 'offered'));
    const candidates = [];
    const need = (recipe, reason, key = null, minQuality = 0) => {
      if (unlocked(s, recipe) && !healthy(recipe, minQuality)) candidates.push({ needs: [recipe], reason, minQuality, traitRequired: null, contentKey: key });
    };
    // Real worn gear gives a reason to replace; healthy gear never generates endless spares.
    for (const recipe of Object.keys(RECIPES)) {
      const worn = owned(s, npc).find(i => i.recipe === recipe && i.durability <= 3 && episode(i).uses > 0);
      if (worn) need(recipe, `用過的${RECIPES[recipe].name}耐久只剩 ${worn.durability}／${worn.maxDurability}，這次想替換；不買回已贈還的同一件。`);
      else {
        const returned = s.returns.find(o => o.npc === npc && o.status === 'accepted' && s.items[o.itemId].recipe === recipe);
        if (returned) need(recipe, `以前那件${RECIPES[recipe].name}已磨損並贈還，這次想另作替換，不買回同一舊物。`);
      }
    }
    if (npc === 'he') need('bracer', '想保護手臂穿過溪口亂流；請幫我看看接縫與品質。', 'he-wrist');
    if (npc === 'shu') need('amulet', '想佩戴護符，試著通過魔力交界的干擾。', 'shu-amulet');
    if (npc === 'cen' && eventDone(s, 'cen-path')?.branch === 'dim') need('staff', '上次照路的光較淡，這次先換細緻木杖，不是只因材料階級而升級。', 'cen-path', 1);
    for (const [key, follow] of Object.entries(CONTENT.FOLLOWUPS)) {
      const proof = eventDone(s, key);
      if (proof?.npc === npc) need(follow.recipe, follow.text, key);
    }
    // Prefer new uses, then the least recently supplied use, so replacements stay fair.
    const newUse = d => CONTENT.EVENTS.some(def => def.npc === npc && def.recipe === d.needs[0] && def.requires === d.contentKey && !eventDone(s, def.id));
    const lastSupplied = d => Object.values(s.items).filter(i => i.recipe === d.needs[0]).flatMap(i => i.episodes.filter(e => e.npc === npc).map(e => e.since)).reduce((latest, month) => Math.max(latest, month), 0);
    candidates.sort((a, b) => Number(newUse(b)) - Number(newUse(a)) || lastSupplied(a) - lastSupplied(b));
    let d = candidates.find(d => !s.content.declined[npc][d.needs[0]] || s.month - s.content.declined[npc][d.needs[0]] >= 2);
    if (!d) return null;
    const recipe = d.needs[0];
    const same = owned(s, npc).some(i => i.recipe === recipe);
    if (same && !/替換|升級|磨損/.test(d.reason)) d.reason += ' 原有同類裝備已磨損，這次作替換。';
    const inherited = inventory(s).find(i => i.recipe === recipe && i.legacy && i.traits.length === 2 && i.durability > 3);
    if (inherited && s.npcs[npc].trust >= 3) d.traitRequired = inherited.traits.find(t => t !== RECIPES[recipe].trait) || null;
    return d;
  }
  function socialCopy(s, npc) {
    const offer = s.returns.find(o => o.npc === npc && o.status === 'offered');
    if (offer) return `磨損的${RECIPES[s.items[offer.itemId].recipe].name}我帶來了，可以當面贈還；這次沒有其他購物需求。`;
    const gear = owned(s, npc).find(i => i.durability > 3);
    return gear ? `這次沒有要添購。${RECIPES[gear.recipe].name}耐久還有 ${gear.durability}／${gear.maxDurability}，先繼續用；有採購清單可以交給我。` : '這次只來打個招呼，沒有購物需求；有採購清單可以交給我。';
  }
  function settle(s) {
    if (s.lastSettled >= s.month) fail('這個月已結算。');
    const wallet = { coins: s.coins, debt: s.debt };
    s.monthReview = { month: s.month, cursor: 0, wallet, entries: [] };
    charge(s, 8);
    s.monthReview.entries.push({ kind: 'money', source: 'living', amount: 8,
      cashPaid: wallet.coins - s.coins, debtAdded: s.debt - wallet.debt });
    for (const o of s.orders) {
      if (o.status !== 'pending' || o.due > s.month) continue;
      s.materials[o.material] = add(s.materials[o.material], o.quantity); o.status = 'delivered'; o.deliveredMonth = s.month;
      if (o.tutorial) s.tutorial.delivered = true;
      news(s, `delivery-${o.id}`, `${PEOPLE[o.npc].name}帶回 ${o.material} ${o.quantity} 個。採購款已在委託時記帳。`);
    }
    for (const e of s.explorations) {
      if (e.status !== 'pending' || e.due > s.month) continue;
      if (!s.knownMaterials.includes(e.material)) s.knownMaterials.push(e.material);
      s.materials[e.material] = add(s.materials[e.material], e.quantity); e.status = 'delivered'; e.deliveredMonth = s.month;
      if (e.tutorial) s.tutorial.delivered = true;
      news(s, `exploration-${e.id}`, `${PEOPLE[e.npc].name}探索帶回${e.material} ${e.quantity} 個。你辨識了新材料；可以採購它，相關配方由用途對話學習。`);
    }
    for (const o of s.journey.outings) {
      if (o.status !== 'pending' || o.due > s.month) continue;
      s.materials[o.material] = add(s.materials[o.material], o.quantity); o.status = 'delivered'; o.deliveredMonth = s.month;
      news(s, `outing-${o.id}`, `小禾${o.kind === 'scout' ? '完成近程勘路' : '沿恢復的驛道採集'}，帶回${o.material} ${o.quantity} 個；報酬已在委託時記帳。`);
    }
    for (const i of Object.values(s.items)) {
      if (i.status !== 'crafting' || i.dueMonth > s.month) continue;
      i.status = 'inventory'; i.finishedMonth = s.month; s.xp.craft = add(s.xp.craft, 1);
      s.monthReview.entries.push({ kind: 'finished', itemId: i.id });
      if (i.reservedFor) s.commissions.find(c => c.id === i.reservedFor).status = 'ready';
      history(s, i, `第 ${s.month} 月完工，${QUALITY[i.quality]}的${RECIPES[i.recipe].name}${i.reservedFor ? `保留給${PEOPLE[s.commissions.find(c => c.id === i.reservedFor).npc].name}` : '放上作品架'}。`);
      news(s, `finished-${i.id}`, `${RECIPES[i.recipe].name}完工${i.reservedFor ? '，等待本人到櫃臺交貨，尚未出售' : '，可在作品架推薦'}。`, i.id);
    }
    for (const i of Object.values(s.items)) {
      if (i.status !== 'owned') continue;
      const e = episode(i), person = PEOPLE[i.owner], retired = s.returns.some(o => o.itemId === i.id && o.status === 'offered');
      if (!retired && i.durability > 3 && s.month > e.since && e.lastUsedMonth !== s.month) {
        const result = useResult(i), before = i.durability;
        i.durability -= result.wear; e.lastUsedMonth = s.month; if (e.firstUsedMonth === null) e.firstUsedMonth = s.month; e.uses = add(e.uses, 1); i.usedEvent = true;
        const newsId = `use-${i.id}-${e.id}-${s.month}`, narrative = contentUse(s, i, result, before, newsId);
        const text = `${person.name}使用「${RECIPES[i.recipe].name}」：${result.text}。耐久 ${before}→${i.durability}／${i.maxDurability}；${traitNames(i)}。${narrative.join(' ')}`;
        history(s, i, text);
        if (e.uses === 1 || i.durability <= 3 || narrative.length) news(s, newsId, text, i.id);
      }
      if (!i.retirementOffered && i.durability <= 3 && e.uses > 0) {
        i.retirementOffered = true; s.returns.push({ itemId: i.id, npc: i.owner, episodeId: e.id, status: 'offered' });
        news(s, `retire-${i.id}`, `${person.name}來信：「${RECIPES[i.recipe].name}」使用後耐久只剩 ${i.durability}／${i.maxDurability}。我暫停使用，改帶手邊備用品，願意當面贈還工坊；你收下前仍由我保管。`, i.id);
      }
    }
    advanceJourney(s);
    refreshJourneyRequest(s);
    for (const [npc, relation] of Object.entries(s.npcs)) {
      if (relation.story || relation.trust < 3) continue;
      const source = Object.values(s.items).find(i => i.episodes.some(e => e.npc === npc && e.firstUsedMonth !== null && e.firstUsedMonth < s.month));
      if (!source) continue;
      relation.story = true; relation.storyItem = source.id;
      news(s, `story-v2-${npc}`, `${PEOPLE[npc].name}分享經歷：「之前確實用過你做的${RECIPES[source.recipe].name}。${source.traits.includes('guard') ? '那份護身效果' : source.traits.includes('solid') ? '它經得起磨耗' : '它便於攜帶'}讓我更安心。我願意繼續把裝備交給你照料。」`, source.id);
    }
    if (!openingDone(s) || !s.tutorial.ordered) {
      const needs = ['staff', 'sword'].filter(k => !s.tutorial.sold.includes(k));
      const intro = s.visits.find(v => v.id === 'intro-cen');
      if (intro && intro.status !== 'waiting' && !s.visits.some(v => v.npc === 'cen' && v.status === 'waiting'))
        Object.assign(intro, { month: s.month, status: 'waiting', asked: false, needs, phase: needs.length ? 'request' : 'service' });
      addVisit(s, 'cen', needs, 'intro', {}, 'intro-cen');
    }
    else if (s.tutorial.delivered) {
      for (const npc of ['he', 'cen', 'shu']) {
        const commission = s.commissions.find(c => c.npc === npc && !['delivered', 'cancelled'].includes(c.status));
        if (commission) {
          if (commission.status === 'ready') addVisit(s, npc, [commission.recipe], 'delivery', { commissionId: commission.id, minQuality: commission.minQuality, traitRequired: commission.traitRequired, reason: '我來領先前委託工坊製作的裝備，當面交貨後才付款。' }, `delivery-${commission.id}-${s.month}`);
          else addVisit(s, npc, [], 'normal', { contextText: commission.status === 'accepted' ? '製作委託還沒開始；缺材料時可以先準備，也可以當面取消未開工的委託。' : '裝備還在製作，我這次先看看進度，完工後再來領。' });
          continue;
        }
        if (npc === 'he' && !s.knownMaterials.includes('銅')) { addVisit(s, npc, [], 'normal', { contextText: '我想找保護手臂的裝備。先探索新的材料線索，辨識後再談配方；有清單可以交給我。' }); continue; }
        if (npc === 'shu' && !unlocked(s, 'amulet')) continue;
        const d = demand(s, npc);
        const goldCommission = npc === 'shu' && d?.needs[0] === 'bell' && eventDone(s, 'shu-amulet') && s.npcs.shu.trust >= 3 && s.reputation >= 3 && !s.npcs.shu.goldDone && !pendingTasks(s, npc).length;
        if (goldCommission) d.reason += ' 這筆金鈴信任委託只一次另付 12 枚。';
        if (d) addVisit(s, npc, d.needs, goldCommission ? 'commission' : 'normal', d);
        else if (s.returns.some(o => o.npc === npc && o.status === 'offered') || (s.month + Object.keys(PEOPLE).indexOf(npc)) % 3 === 0) addVisit(s, npc, [], 'normal', { contextText: socialCopy(s, npc) });
      }
      for (const o of s.returns.filter(o => o.status === 'offered')) addVisit(s, o.npc, [], 'return');
    }
    for (const v of s.visits.filter(v => v.status === 'waiting')) v.counterId = `${v.id}@${s.month}`;
    const pendingIds = new Set(Object.keys(PEOPLE).flatMap(npc => pendingTasks(s, npc).map(t => t.id)));
    s.legacyTaskIds = s.legacyTaskIds.filter(id => pendingIds.has(id));
    if (s.tutorial.delivered && inventory(s).length === 0 && !Object.values(s.items).some(i => i.status === 'crafting') && MATERIALS.every(m => s.materials[m] === 0) && !s.orders.some(o => o.status === 'pending') && !s.explorations.some(e => e.status === 'pending') && !s.journey.outings.some(o => o.status === 'pending')) {
      s.materials.木頭 = 1; s.materials.鐵 = 1; news(s, `relief-${s.month}`, '阿岑送來木頭與鐵各一個作周轉：「先讓工作臺動起來，欠款可以慢慢還。」');
    }
    if (!s.news.some(n => n.month === s.month)) news(s, `month-${s.month}`, s.month === 1 ? '阿岑託魔法鳥帶來口信：「我來看看你的第一批作品。」' : '本月沒有新消息。');
    s.lastSettled = s.month;
  }
  function tutorialStep(s) {
    if (!openingDone(s)) {
      const made = new Set(Object.values(s.items).map(i => i.recipe));
      if (!made.has('staff') || !made.has('sword')) return { title: '開始木杖與鐵劍', text: '木頭與鐵各 3 個，先各開始一件。兩件都需 1 個月，材料充足必定成功。', step: 1 };
      const waiting = Object.values(s.items).some(i => ['staff', 'sword'].includes(i.recipe) && i.status === 'crafting');
      return { title: waiting ? '開店推進一月，完成武器' : s.open ? '把作品推薦給阿岑' : '開店迎接阿岑', text: waiting ? '準備月開始的兩件，下次開店就完成。營業中開始則先關店再開店；沒有現實等待。' : '兩件都由阿岑自己使用。逐件推薦即可。', step: 2 };
    }
    if (!s.tutorial.ordered) return { title: '材料委託可以稍後', text: activeVisit(s)?.npc === 'cen' ? '可託阿岑探索或採購，也可以直接送客。材料教學能在之後來訪補學。' : '阿岑下次來訪仍可交代材料委託。現在可繼續製作，或關店後再開店。', step: 3 };
    if (!s.tutorial.delivered) return { title: s.open ? '等下次開店到貨' : '開店收取材料', text: s.open ? '先關店，再開店收取材料與鳥信。關店不推進月份。' : '按開店即可，材料與鳥信會一起送到。', step: 4 };
    return { title: '小禾帶來新需求', text: '先聽用途，開始製作或接客人委託；完工後再推薦或交付。', step: 5 };
  }
  function orderQuote(s, material, quantity) {
    if (!s.knownMaterials.includes(material) || !integer(quantity, 1)) fail('採購數量請填正安全整數，且只能選已辨識材料；新材料先委託探索。');
    const cost = multiply(COST[material], quantity); add(s.debt, Math.max(0, cost - s.coins));
    const reserved = reservedMaterial(s, material);
    add(reserved, quantity); return cost;
  }
  function productionTraits(s, recipe) {
    const r = RECIPES[recipe], legacy = s.legacies.find(l => l.material === r.material && l.usedBy === null);
    const traits = [r.trait];
    if (legacy) { for (const t of legacy.traits) if (!traits.includes(t) && traits.length < 2) traits.push(t); if (traits.length < 2) traits.push(r.trait === 'solid' ? 'guard' : 'solid'); }
    return traits;
  }
  function startProduction(s, recipe, commission = null) {
        const r = RECIPES[recipe]; if (!r || !unlocked(s, recipe)) fail('這份配方尚未學會。');
        if (s.materials[r.material] < 1) fail(`需要 ${r.material} 1 個。可開店委託目前顧客採購。`);
        const legacy = s.legacies.find(l => l.material === r.material && l.usedBy === null), id = `item-${s.seq = add(s.seq, 1)}`;
        const quality = Math.min(2, Math.floor(s.xp.craft / 3) + (legacy ? 1 : 0)), traits = productionTraits(s, recipe);
        if (commission && (quality < commission.minQuality || commission.traitRequired && !traits.includes(commission.traitRequired))) fail('目前製作條件未達客人要求，先練習或取得合適傳承，再開始這件委託。');
        s.materials[r.material]--;
        const i = s.items[id] = { id, recipe: recipe, material: r.material, quality, traits, durability: 9, maxDurability: 9, repaired: false, status: 'crafting', owner: null, createdMonth: s.month, soldMonth: null, appraised: false, usedEvent: false, retirementOffered: false, returned: false, legacy: legacy ? legacy.itemId : null, episodes: [], dueMonth: s.month + CRAFT_MONTHS[recipe], finishedMonth: null, reservedFor: commission ? commission.id : null, history: [] };
        if (legacy) { legacy.usedBy = id; history(s, s.items[legacy.itemId], `特性傳承進入新作「${r.name}」，特性：${traitNames(i)}。`); }
        history(s, i, `你開始製作${QUALITY[quality]}的${r.name}，特性：${traitNames(i)}${legacy ? `；將承接${RECIPES[s.items[legacy.itemId].recipe].name}的材料與特性` : ''}。`);
        if (commission) { commission.itemId = id; commission.status = 'crafting'; }
        return i;
  }
  function canStartCommission(s, c) {
    const r = RECIPES[c.recipe], legacy = s.legacies.find(l => l.material === r.material && l.usedBy === null);
    const traits = productionTraits(s, c.recipe);
    return s.materials[r.material] > 0 && Math.min(2, Math.floor(s.xp.craft / 3) + (legacy ? 1 : 0)) >= c.minQuality && (!c.traitRequired || traits.includes(c.traitRequired));
  }
  function duplicateRequest(s, id) { return [...s.orders, ...s.explorations, ...s.commissions, ...s.journey.outings].some(t => t.requestId === id); }
  function pendingReview(s) { return !!s.monthReview && s.monthReview.cursor < s.monthReview.entries.length; }
  function validateReview(s) {
    const r = s.monthReview;
    // schema 5 files made before v0.11 have no receipt; do not invent past entries.
    if (r === undefined || r === null) return;
    const bad = () => fail('存檔月結記錄不正確。');
    if (!r || typeof r !== 'object' || Array.isArray(r) || r.month !== s.month || r.month !== s.lastSettled
      || !integer(r.month, 1) || !Array.isArray(r.entries) || r.entries.length < 1 || r.entries.length > 20001
      || !integer(r.cursor, 0, r.entries.length) || !r.wallet || !integer(r.wallet.coins) || !integer(r.wallet.debt)) bad();
    const fee = r.entries[0], cash = Math.min(8, r.wallet.coins), debt = 8 - cash;
    if (!fee || fee.kind !== 'money' || fee.source !== 'living' || fee.amount !== 8 || fee.cashPaid !== cash || fee.debtAdded !== debt || !integer(r.wallet.debt + debt)) bad();
    const completed = Object.values(s.items).filter(i => i.finishedMonth === r.month).map(i => i.id);
    if (r.entries.length !== completed.length + 1 || !r.entries.slice(1).every((e, n) => e?.kind === 'finished' && e.itemId === completed[n])) bad();
    if (pendingReview(s) && (!s.open || s.coins !== r.wallet.coins - cash || s.debt !== r.wallet.debt + debt)) bad();
  }
  function checkRequestId(id) { if (typeof id !== 'string' || !id || id.length > 100) fail('委託識別碼不正確。'); }
  function dispatch(state, a) {
    if (!a || typeof a.type !== 'string') fail('操作格式不正確。');
    if (a.expectedRevision !== undefined && a.expectedRevision !== state.revision) fail('這個操作已處理，請使用目前畫面的按鈕。');
    if (pendingReview(state) && a.type !== 'review-next') fail('本月已經營業；先閱完月結，再使用櫃臺與工坊。');
    const s = clone(state); let message;
    switch (a.type) {
      case 'review-next': {
        if (!pendingReview(s) || a.month !== s.monthReview.month || a.cursor !== s.monthReview.cursor) fail('這筆月結已閱過，請使用目前的下一筆。');
        s.monthReview.cursor++;
        message = pendingReview(s) ? '繼續查看下一筆月結。' : '月結閱覽完成，可以開始接客。'; break;
      }
      case 'open':
        if (s.open) fail('工坊已經營業中，沒有再次換月或扣款。');
        s.month = add(s.month, 1); s.open = true; settle(s); message = log(s, '開店。生活費、交貨與鳥信已一起更新。'); break;
      case 'close':
        if (!s.open) fail('工坊已經關店，月份沒有改變。');
        for (const v of s.visits.filter(v => v.status === 'waiting' && v.phase === 'service')) { v.status = 'done'; v.counterId = null; }
        for (const v of s.visits.filter(v => v.status === 'waiting')) v.counterId = null;
        s.open = false; message = log(s, '關店。未完成的需求留到下次；可以繼續製作。'); break;
      case 'craft': {
        const commission = a.commissionId ? s.commissions.find(c => c.id === a.commissionId && c.status === 'accepted') : null;
        if (a.commissionId && !commission) fail('這份客人製作委託已開始或已結束。');
        const i = startProduction(s, commission ? commission.recipe : a.recipe, commission);
        message = log(s, `開始製作${RECIPES[i.recipe].name}，第 ${i.dueMonth} 月開店完工${commission ? `；保留給${PEOPLE[commission.npc].name}` : ''}。`); break;
      }
      case 'talk': {
        const v = scope(s, a); if (v.asked) fail('已經聽過這次需求了。');
        v.asked = true; s.npcs[v.npc].trust = add(s.npcs[v.npc].trust, 1);
        const detail = requestDetail(v), hint = v.npc === 'he' && s.tutorial.delivered ? journeyHint(s) : '';
        message = log(s, `${PEOPLE[v.npc].name}：「${detail}${hint && !detail.includes(hint) ? ' ' + hint : ''}」`); break;
      }
      case 'sell': case 'deliver': {
        const v = scope(s, a), i = s.items[a.itemId];
        const commission = a.type === 'deliver' ? s.commissions.find(c => c.id === v.commissionId && c.status === 'ready') : null;
        if (a.type === 'deliver' && (!commission || v.kind !== 'delivery' || commission.npc !== v.npc || commission.itemId !== a.itemId)) fail('這不是目前本人可領取的製作委託成品。');
        if (a.type === 'sell' && v.kind === 'delivery') fail('這次是交付製作委託，請使用交付按鈕。');
        if (!i || i.status !== 'inventory') fail('這件物品已不在工坊庫存。');
        const reason = recommendationReason(s, i, v); if (reason) fail(`這件物品不符合需求：${reason}`);
        const amount = price(i) + (v.kind === 'commission' || commission?.kind === 'commission' ? 12 : 0); income(s, amount); i.status = 'owned'; i.owner = v.npc; i.soldMonth = s.month; i.reservedFor = null;
        if (commission) { commission.status = 'delivered'; commission.deliveredMonth = s.month; }
        i.episodes.push({ id: i.episodes.length + 1, npc: v.npc, since: s.month, until: null, firstUsedMonth: null, lastUsedMonth: null, uses: 0 });
        history(s, i, `${PEOPLE[v.npc].name}買下並持有，支付 ${amount} 枚。`);
        s.npcs[v.npc].trust = add(s.npcs[v.npc].trust, 1); s.reputation = add(s.reputation, 1);
        if (v.kind === 'intro') { if (!s.tutorial.sold.includes(i.recipe)) s.tutorial.sold.push(i.recipe); v.needs = v.needs.filter(k => k !== i.recipe); } else v.needs = [];
        if (!v.needs.length) { v.phase = 'service'; v.contextText = '裝備收好了，等真正用過再告訴你結果；有採購清單可以交給我。'; }
        if (v.kind === 'commission' || commission?.kind === 'commission') s.npcs[v.npc].goldDone = true;
        message = log(s, `${PEOPLE[v.npc].name}買下${RECIPES[i.recipe].name}，收入 ${amount} 枚。商品已轉入持有紀錄；顧客還在櫃臺。`); break;
      }
      case 'decline': case 'leave': {
        const v = scope(s, a);
        if (a.type === 'leave' && v.phase !== 'service') fail('請先處理或婉拒這次需求。');
        if (v.phase === 'request') for (const r of v.needs) s.content.declined[v.npc][r] = s.month;
        v.status = v.phase === 'service' ? 'done' : 'declined'; v.counterId = null; message = log(s, `${PEOPLE[v.npc].name}離開櫃臺。下一位顧客才能進來。`); break;
      }
      case 'order': {
        const v = scope(s, a); if (!openingDone(s)) fail('先把木杖與鐵劍交給阿岑，再託他採購。');
        checkRequestId(a.requestId); if (duplicateRequest(s, a.requestId)) fail('這筆委託已接受，不會再扣款。');
        requireFreeTask(s, v.npc);
        const cost = orderQuote(s, a.material, a.quantity), tutorial = !s.tutorial.ordered; charge(s, cost);
        s.orders.push({ id: `order-${s.seq = add(s.seq, 1)}`, requestId: a.requestId, npc: v.npc, material: a.material, quantity: a.quantity, cost, due: add(s.month, 1), status: 'pending', tutorial, deliveredMonth: null });
        s.tutorial.ordered = true; message = log(s, `委託${PEOPLE[v.npc].name}採購${a.material} ${a.quantity} 個，共 ${cost} 枚；第 ${s.month + 1} 月開店交付。`); break;
      }
      case 'explore': {
        const v = scope(s, a); if (!openingDone(s)) fail('先把兩件開場作品交給阿岑，再探索。');
        checkRequestId(a.requestId); if (duplicateRequest(s, a.requestId)) fail('這筆委託已接受，不會再扣款。');
        requireFreeTask(s, v.npc); const material = nextUnknown(s);
        if (!material) fail('目前這批材料都已辨識，沒有新的探索線索。');
        if (s.explorations.some(e => e.status === 'pending' && e.material === material)) fail('這條材料線索已有人探索，等交付後再探索下一條。');
        const quantity = explorationQuantity(s); add(reservedMaterial(s, material), quantity); const tutorial = !s.tutorial.ordered; charge(s, EXPLORATION_COST);
        s.explorations.push({ id: `explore-${s.seq = add(s.seq, 1)}`, requestId: a.requestId, npc: v.npc, material, quantity, due: add(s.month, 1), status: 'pending', cost: EXPLORATION_COST, tutorial, deliveredMonth: null });
        s.tutorial.ordered = true; message = log(s, `請${PEOPLE[v.npc].name}探索一條未辨識材料線索，報酬 6 枚；下月開店帶回新材料。`); break;
      }
      case 'scout': case 'gather-route': {
        const v = scope(s, a);
        if (v.npc !== 'he' || !s.tutorial.delivered) fail('先完成第一批材料交付，再當面向小禾交代路線。');
        checkRequestId(a.requestId); if (duplicateRequest(s, a.requestId)) fail('這筆勘路或採集已接受，不會再扣款。');
        requireFreeTask(s, v.npc);
        const scout = a.type === 'scout';
        if (scout && (nearProof(s) || s.journey.outings.some(o => o.kind === 'scout'))) fail('近程路線已有行動紀錄，不重複勘路或增加能力。');
        if (!scout && roadState(s) !== 'restored') fail('先有實際通路恢復的消息，才能沿驛道採集。');
        const material = scout ? '木頭' : a.material;
        if (!s.knownMaterials.includes(material)) fail('驛道採集只能選已辨識材料。');
        const quantity = scout ? 1 : 3; add(reservedMaterial(s, material), quantity); charge(s, EXPLORATION_COST);
        s.journey.outings.push({ id: `outing-${s.seq = add(s.seq, 1)}`, requestId: a.requestId, npc: 'he', kind: scout ? 'scout' : 'gather', material, quantity, cost: EXPLORATION_COST, createdMonth: s.month, due: add(s.month, 1), status: 'pending', deliveredMonth: null });
        message = log(s, `請小禾${scout ? '近程勘路' : `沿驛道採集${material}`}，報酬 6 枚；下月開店帶回${material} ${quantity} 個。`); break;
      }
      case 'accept-commission': {
        const v = scope(s, a);
        if (v.phase !== 'request' || ['intro', 'delivery'].includes(v.kind)) fail('開場先開始兩把作品，或等本人來領已接受的委託；這裡沒有新製作委託。');
        if (inventory(s).some(i => suitable(s, i, v))) fail('已有合適現貨，可直接推薦；這次不需要另接製作委託。');
        if (pendingTasks(s, v.npc).some(t => t.id !== v.id)) fail(`${PEOPLE[v.npc].name}已有未完成委託，完成後才能接受下一件。`);
        checkRequestId(a.requestId); if (duplicateRequest(s, a.requestId)) fail('這份製作委託已接受。');
        const recipe = v.needs[0]; if (!unlocked(s, recipe)) fail('這件裝備的材料或配方尚未辨識，先探索，再接受可做的需求。');
        const c = { id: `commission-${s.seq = add(s.seq, 1)}`, requestId: a.requestId, npc: v.npc, recipe, minQuality: v.minQuality, traitRequired: v.traitRequired, kind: v.kind, status: 'accepted', itemId: null, acceptedMonth: s.month, deliveredMonth: null };
        s.commissions.push(c); v.needs = []; v.phase = 'service'; v.contextText = '製作委託記下了。完工後我會回店領取，交貨才付款。';
        if (canStartCommission(s, c)) startProduction(s, recipe, c);
        message = log(s, `接受${PEOPLE[v.npc].name}的${RECIPES[recipe].name}製作委託${c.status === 'crafting' ? `，已開工，第 ${s.items[c.itemId].dueMonth} 月完工` : '，先備材料或練習到符合品質，再開工'}；尚未出售。`); break;
      }
      case 'cancel-commission': {
        const v = scope(s, a), c = s.commissions.find(c => c.id === a.commissionId && c.npc === v.npc && c.status === 'accepted');
        if (!c) fail('只能當面取消這位客人尚未開工的委託。');
        c.status = 'cancelled'; message = log(s, `當面取消${PEOPLE[v.npc].name}尚未開工的製作委託，沒有扣款或售出物品。`); break;
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
        const reserved = reservedMaterial(s, i.material); add(reserved, 1);
        i.status = 'smelted'; s.materials[i.material] = add(s.materials[i.material], 1); s.legacies.push({ itemId: i.id, material: i.material, traits: [...i.traits], usedBy: null });
        history(s, i, `熔鍊／拆解為${i.material} 1 個；${traitNames(i)}特性等待下一件同材質作品。`); message = log(s, `回收${i.material} 1 個與${traitNames(i)}特性傳承。`); break;
      }
      default: fail('沒有這個操作。');
    }
    const pendingIds = new Set(Object.keys(PEOPLE).flatMap(npc => pendingTasks(s, npc).map(t => t.id)));
    s.legacyTaskIds = s.legacyTaskIds.filter(id => pendingIds.has(id));
    s.revision = add(s.revision, 1); validate(s); return { state: s, message };
  }
  const validate = s => { validateJourneyShape(s); validateCore(s, 5); validateJourney(s); validateReview(s); return true; };
  const validateV4 = s => validateCore(s, 4);
  const validateV2 = s => validateCore(s, 2);
  const validateV3 = s => validateCore(s, 3);
  function validateCore(s, schema) {
    const check = (test, field) => { if (!test) fail(`存檔格式不正確：${field}`); };
    const str = (v, max = 1000) => typeof v === 'string' && v.length <= max;
    const arr = v => Array.isArray(v) && v.length <= 20000;
    const unique = (a, key) => new Set(a.map(x => x[key])).size === a.length;
    const traits = t => arr(t) && t.length >= 1 && t.length <= 2 && new Set(t).size === t.length && t.every(x => Object.hasOwn(TRAITS, x));
    check(s && typeof s === 'object' && !Array.isArray(s) && s.schema === schema, '版本');
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
      check(['inventory', 'owned', 'smelted', ...(schema >= 4 ? ['crafting'] : [])].includes(i.status) && (i.status === 'owned' ? Object.hasOwn(PEOPLE, i.owner) : i.owner === null), '持有者');
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
    check(s.visits.every(v => v && str(v.id, 100) && Object.hasOwn(PEOPLE, v.npc) && integer(v.month, 1, s.month) && arr(v.needs) && v.needs.every(k => Object.hasOwn(RECIPES, k)) && ['intro', 'normal', 'commission', 'return', ...(schema >= 4 ? ['delivery'] : [])].includes(v.kind) && ['waiting', 'done', 'declined'].includes(v.status) && ['request', 'service'].includes(v.phase) && typeof v.asked === 'boolean' && integer(v.minQuality, 0, 2) && str(v.reason) && (v.traitRequired === null || Object.hasOwn(TRAITS, v.traitRequired)) && (v.status !== 'waiting' || (v.phase === 'request' ? v.needs.length > 0 : v.needs.length === 0)) && (v.counterId === null || str(v.counterId, 130)) && (v.status !== 'waiting' || !s.open || v.counterId === `${v.id}@${s.month}`)), '需求');
    check(unique(s.news, 'id') && s.news.every(n => n && str(n.id, 100) && integer(n.month, 1, s.month) && str(n.text) && (n.itemId === null || Object.hasOwn(s.items, n.itemId))), '鳥信');
    check(unique(s.returns, 'itemId') && s.returns.every(o => o && Object.hasOwn(s.items, o.itemId) && Object.hasOwn(PEOPLE, o.npc) && ['offered', 'accepted'].includes(o.status) && integer(o.episodeId, 1) && s.items[o.itemId].episodes.some(e => e.id === o.episodeId && e.npc === o.npc) && (o.status !== 'offered' || s.items[o.itemId].status === 'owned' && s.items[o.itemId].owner === o.npc && episode(s.items[o.itemId]).id === o.episodeId)), '舊物贈還');
    check(unique(s.legacies, 'itemId') && s.legacies.every(l => l && Object.hasOwn(s.items, l.itemId) && s.items[l.itemId].status === 'smelted' && l.material === s.items[l.itemId].material && traits(l.traits) && (l.usedBy === null || Object.hasOwn(s.items, l.usedBy) && s.items[l.usedBy].legacy === l.itemId && s.items[l.usedBy].material === l.material)), '熔鍊傳承');
    check(Object.values(s.items).every(i => i.legacy === null || s.legacies.some(l => l.itemId === i.legacy && l.usedBy === i.id)), '傳承來源');
    check(Object.values(s.items).filter(i => i.status === 'smelted').every(i => s.legacies.some(l => l.itemId === i.id)), '熔鍊紀錄');
    check(s.npcs && Object.keys(PEOPLE).every(id => {
      const p = s.npcs[id];
      return p && integer(p.trust) && typeof p.story === 'boolean' && typeof p.goldDone === 'boolean' && (p.story ? Object.hasOwn(s.items, p.storyItem) && s.items[p.storyItem].episodes.some(e => e.npc === id && e.firstUsedMonth !== null && e.firstUsedMonth < s.month) : p.storyItem === null);
    }), '人物故事證據');
    if (schema >= 3) {
      check(s.content && arr(s.content.events) && unique(s.content.events, 'key'), '內容節點');
      check(s.content.declined && Object.keys(PEOPLE).every(npc => s.content.declined[npc] && Object.keys(RECIPES).every(r => integer(s.content.declined[npc][r], 0, s.month))), '拒單紀錄');
      check(s.visits.every(v => (v.contentKey === null || CONTENT.EVENTS.some(def => def.id === v.contentKey)) && str(v.contextText)), '內容需求');
      for (const record of s.content.events) {
        const def = CONTENT.EVENTS.find(def => def.id === record.key), i = s.items[record.itemId], e = i?.episodes.find(e => e.id === record.episodeId);
        check(def && record.npc === def.npc && i && i.recipe === def.recipe && Object.hasOwn(PEOPLE, record.actor) && integer(record.month, 1, s.month) && e && e.npc === record.actor && e.uses > 0 && e.firstUsedMonth <= record.month && e.lastUsedMonth >= record.month && str(record.text), '內容使用證據');
        check(def.trigger === 'cross' ? record.actor !== def.npc && s.returns.some(o => o.itemId === i.id && o.npc === def.npc && o.status === 'accepted') : record.actor === def.npc, '內容持有者');
        const prior = def.requires && eventDone(s, def.requires);
        check(!def.requires || prior && prior.month <= record.month, '內容前置');
        if (def.trigger === 'replacement') check(prior.itemId !== i.id && s.items[prior.itemId].episodes.some(e => e.npc === def.npc && e.uses > 0), '替換證據');
        check(integer(record.before, 4, 9) && integer(record.after, 0, record.before) && integer(record.wear, 1, 3) && record.before - record.after === record.wear, '內容磨耗');
        const result = useResult({ ...i, durability: record.before });
        const branch = def.branches.find(b => (b.strong === undefined || b.strong === result.strong) && (!b.trait || i.traits.includes(b.trait)));
        check(record.score === result.score && record.wear === result.wear && record.branch === branch.id, '內容分支');
        check(s.news.some(n => n.id === record.newsId && n.month === record.month && n.itemId === record.itemId) && i.history.some(h => h.month === record.month && h.text.includes(record.text)), '內容情報');
      }
    }
    if (schema >= 4) {
      check(arr(s.knownMaterials) && s.knownMaterials.length >= 2 && s.knownMaterials.length <= 5 && s.knownMaterials.every((m, n) => m === MATERIALS[n]), '已辨識材料');
      check(arr(s.explorations) && arr(s.commissions) && arr(s.legacyTaskIds) && new Set(s.legacyTaskIds).size === s.legacyTaskIds.length, '委託表');
      const allJobs = [...s.orders, ...s.explorations, ...s.commissions, ...(schema >= 5 ? s.journey?.outings || [] : [])];
      check(unique(allJobs, 'id') && unique(allJobs, 'requestId'), '跨類委託重複');
      check(unique(s.explorations, 'material'), '重複探索');
      check(s.orders.every(o => s.knownMaterials.includes(o.material)), '採購材料知識');
      for (const e of s.explorations) {
        check(e && /^explore-[1-9]\d*$/.test(e.id) && str(e.requestId, 100) && e.requestId.length > 0 && Object.hasOwn(PEOPLE, e.npc) && MATERIALS.indexOf(e.material) >= 2 && e.cost === EXPLORATION_COST && integer(e.due, 1) && typeof e.tutorial === 'boolean' && ['pending', 'delivered'].includes(e.status), '探索');
        check(e.status === 'pending' ? e.material === nextUnknown(s) && e.due > s.month && e.deliveredMonth === null : s.knownMaterials.includes(e.material) && integer(e.deliveredMonth, e.due, s.month), '探索交付');
        if (schema >= 5) check(e.quantity === (s.journey?.events.some(r => r.key === 'road-open' && r.month < e.due) ? 3 : 2), '探索通路份量');
        highest = Math.max(highest, Number(e.id.split('-')[1]));
      }
      for (const c of s.commissions) {
        check(c && /^commission-[1-9]\d*$/.test(c.id) && str(c.requestId, 100) && c.requestId.length > 0 && Object.hasOwn(PEOPLE, c.npc) && Object.hasOwn(RECIPES, c.recipe) && s.knownMaterials.includes(RECIPES[c.recipe].material) && integer(c.minQuality, 0, 2) && (c.traitRequired === null || Object.hasOwn(TRAITS, c.traitRequired)) && ['normal', 'commission', 'return'].includes(c.kind) && ['accepted', 'crafting', 'ready', 'delivered', 'cancelled'].includes(c.status) && integer(c.acceptedMonth, 1, s.month), '客人製作委託');
        const i = c.itemId && s.items[c.itemId];
        check(['accepted', 'cancelled'].includes(c.status) ? c.itemId === null && c.deliveredMonth === null : i && i.recipe === c.recipe && i.quality >= c.minQuality && (!c.traitRequired || i.traits.includes(c.traitRequired)), '委託成品');
        if (c.status === 'crafting' || c.status === 'ready') check(i.reservedFor === c.id && i.status === (c.status === 'crafting' ? 'crafting' : 'inventory') && c.deliveredMonth === null, '成品保留');
        if (c.status === 'delivered') check(integer(c.deliveredMonth, c.acceptedMonth, s.month) && i.episodes.some(e => e.npc === c.npc && e.since === c.deliveredMonth), '本人交貨');
        highest = Math.max(highest, Number(c.id.split('-')[1]));
      }
      check(s.seq >= highest, '委託序號');
      for (const i of Object.values(s.items)) {
        check(i.status === 'crafting' ? integer(i.dueMonth, s.month + 1) && i.finishedMonth === null && i.episodes.length === 0 : integer(i.finishedMonth, i.createdMonth, s.month) && (i.dueMonth === null || integer(i.dueMonth, i.createdMonth + CRAFT_MONTHS[i.recipe], i.finishedMonth)), '製作工期');
        check(i.soldMonth === null || i.finishedMonth !== null && i.soldMonth >= i.finishedMonth, '未完工不可售出');
        check(i.reservedFor === null || s.commissions.some(c => c.id === i.reservedFor && c.itemId === i.id && ['crafting', 'ready'].includes(c.status)), '專屬成品');
      }
      for (const v of s.visits.filter(v => v.kind === 'delivery')) check(s.commissions.some(c => c.id === v.commissionId && c.npc === v.npc), '交貨來訪');
      const pending = Object.keys(PEOPLE).flatMap(npc => pendingTasks(s, npc));
      check(s.legacyTaskIds.every(id => pending.some(t => t.id === id)), '舊版委託保留');
      for (const npc of Object.keys(PEOPLE)) { const jobs = pendingTasks(s, npc); check(jobs.length <= 1 || jobs.every(t => s.legacyTaskIds.includes(t.id)), '人物單一委託'); }
    }
    return true;
  }
  function validateJourneyShape(s) {
    const j = s?.journey;
    if (!j || !Array.isArray(j.outings) || j.outings.length > 20000 || !Array.isArray(j.events) || j.events.length > 4
      || !j.outings.every(o => o && typeof o === 'object' && !Array.isArray(o)) || !j.events.every(e => e && typeof e === 'object' && !Array.isArray(e))
      || !j.growth?.he || !integer(j.growth.he.level, 1, 2) || !integer(j.growth.he.pathfinding, 0, 3)) fail('存檔格式不正確：人物勘路進度');
  }
  function validateJourney(s) {
    const check = (test, field) => { if (!test) fail(`存檔格式不正確：${field}`); };
    const j = s.journey, growth = earnedGrowth(s), opened = j.events.find(e => e?.key === 'road-open');
    check(j.growth.he.level === growth.level && j.growth.he.pathfinding === growth.pathfinding, '人物成長證據');
    check(j.outings.filter(o => o?.kind === 'scout').length <= 1, '近程勘路重複');
    for (const o of j.outings) {
      check(o && /^outing-[1-9]\d*$/.test(o.id) && typeof o.requestId === 'string' && o.requestId.length > 0 && o.requestId.length <= 100
        && o.npc === 'he' && ['scout', 'gather'].includes(o.kind) && s.knownMaterials.includes(o.material) && o.cost === EXPLORATION_COST
        && integer(o.createdMonth, 1, s.month) && integer(o.due) && o.due === o.createdMonth + 1 && ['pending', 'delivered'].includes(o.status), '勘路採集委託');
      check(o.kind === 'scout' ? o.material === '木頭' && o.quantity === 1 : o.quantity === 3 && opened && opened.month <= o.createdMonth, '採集通路前置');
      check(o.status === 'pending' ? o.due > s.month && o.deliveredMonth === null : integer(o.deliveredMonth, o.due, s.month), '勘路採集交付');
      if (o.status === 'delivered') check(s.news.some(n => n.id === `outing-${o.id}` && n.month === o.deliveredMonth && n.text.startsWith('小禾') && n.text.includes(`${o.material} ${o.quantity} 個`)), '勘路交付鳥信');
      check(Number(o.id.split('-')[1]) <= s.seq, '勘路序號');
    }
    for (const material of MATERIALS) {
      const quantity = [...s.orders, ...s.explorations, ...j.outings].filter(o => o.status === 'pending' && o.material === material).reduce((n, o) => n + o.quantity, s.materials[material]);
      check(integer(quantity), '跨類材料預留');
    }
    check(s.news.filter(n => n.id.startsWith('journey-')).every(n => j.events.some(e => e?.newsId === n.id && e.month === n.month && e.text === n.text)), '孤立勘路鳥信');
    check(s.news.filter(n => n.id.startsWith('outing-')).every(n => j.outings.some(o => n.id === `outing-${o.id}` && o.status === 'delivered' && n.month === o.deliveredMonth)), '孤立採集鳥信');
    let previousMonth = 0;
    for (let n = 0; n < j.events.length; n++) {
      const r = j.events[n], g = earnedGrowth(s, r?.month);
      check(r && r.key === JOURNEY_KEYS[n] && integer(r.month, previousMonth + 1, s.month) && r.source && Array.isArray(r.gear)
        && r.level === g.level && r.pathfinding === g.pathfinding && typeof r.text === 'string' && r.text.length <= 1000, '勘路節點順序');
      previousMonth = r.month;
      if (n === 0) {
        const proof = nearProof(s, r.month); check(proof && r.source.type === proof.source && r.source.id === proof.id && r.gear.length === 0, '近程行動證據');
      } else {
        const proof = eventDone(s, n === 1 ? 'he-wrist' : 'he-shield');
        check(proof && proof.month < r.month && r.source.type === 'content' && r.source.id === proof.key, '勘路使用前置');
        check(n === 1 ? r.gear.length === 0 : r.level >= 2 && r.pathfinding >= 3 && r.gear.length === (n === 2 ? 1 : 2), '勘路能力與裝備');
      }
      for (let k = 0; k < r.gear.length; k++) {
        const gear = r.gear[k], i = s.items[gear?.itemId], e = i?.episodes.find(e => e.id === gear.episodeId), recipe = k === 0 ? 'bracer' : 'shield';
        check(i && i.recipe === recipe && i.traits.includes(k === 0 ? 'guard' : 'solid') && gear.score === performance(i) && gear.score >= (k === 0 ? 8 : 4)
          && integer(gear.before, 4, 9) && integer(gear.after, 4, gear.before), '勘路裝備效能');
        const wear = useResult({ ...i, durability: gear.before }).wear;
        check(gear.before - gear.after === wear && e && e.npc === 'he' && e.since < r.month && (e.until === null || e.until >= r.month)
          && e.uses > 0 && e.firstUsedMonth <= r.month && e.lastUsedMonth >= r.month
          && i.history.some(h => h.month === r.month && h.text.startsWith('小禾使用「') && h.text.includes(`耐久 ${gear.before}→${gear.after}／`)), '勘路實際持有與磨耗');
      }
      check(r.newsId === `journey-${r.key}` && s.news.some(news => news.id === r.newsId && news.month === r.month && news.text === r.text && news.itemId === (r.gear[0]?.itemId || null)), '勘路鳥信證據');
    }
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
    validateV2(s); return migrateV2(s);
  }
  function migrateV2(old) {
    validateV2(old); const s = clone(old); s.schema = 3; s.content = emptyContent();
    for (const v of s.visits) { v.contentKey = null; v.contextText = ''; }
    validateV3(s); return migrateV3(s);
  }
  function migrateV3(old) {
    validateV3(old); const s = clone(old); s.schema = 4; s.knownMaterials = [...MATERIALS]; s.explorations = []; s.commissions = []; s.legacyTaskIds = [];
    for (const i of Object.values(s.items)) { i.dueMonth = null; i.finishedMonth = i.createdMonth; i.reservedFor = null; }
    for (const npc of Object.keys(PEOPLE)) { const tasks = pendingTasks(s, npc); if (tasks.length > 1) s.legacyTaskIds.push(...tasks.map(t => t.id)); }
    validateV4(s); return migrateV4(s);
  }
  function migrateV4(old) {
    validateV4(old); const s = clone(old); s.schema = 5; s.journey = emptyJourney();
    for (const e of s.explorations) e.quantity = 2;
    s.journey.growth.he = earnedGrowth(s); validate(s); return s;
  }
  function exportSave(s) { validate(s); return JSON.stringify({ game: '鳥信工坊', schema: 5, state: s }, null, 2); }
  function importSave(text) {
    if (typeof text !== 'string' || text.length > 8 * 1024 * 1024) fail('備份太大或格式不正確。');
    const d = JSON.parse(text);
    if (!d || d.game !== '鳥信工坊' || ![1, 2, 3, 4, 5].includes(d.schema) || !d.state || d.state.schema !== d.schema) fail('這不是鳥信工坊格式備份。');
    if (d.schema === 1) return migrate(d.state);
    if (d.schema === 2) return migrateV2(d.state);
    if (d.schema === 3) return migrateV3(d.state);
    if (d.schema === 4) return migrateV4(d.state);
    validate(d.state); return clone(d.state);
  }
  return { MATERIALS, COST, CRAFT_MONTHS, EXPLORATION_COST, RECIPES, TRAITS, PEOPLE, CONTENT, QUALITY, QUALITY_PRICE, initialState, canScout, journeyProgress, journeyHint, roadState, explorationQuantity, knownMaterials, nextUnknown, pendingTasks, canStartCommission, inventory, owned, activeVisit, openingDone, unlocked, visibleRecipes, canAppraise, requestDetail, price, suitable, recommendationReason, tutorialStep, performance, traitNames, traitDetails, productionTraits, useResult, orderQuote, dispatch, pendingReview, validate, exportSave, importSave };
});
