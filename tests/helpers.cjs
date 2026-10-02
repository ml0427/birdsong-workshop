'use strict';
const assert = require('node:assert/strict');
const W = require('../engine.js');
// Existing feature campaigns explicitly read every receipt as setup before continuing.
// Dedicated monthly tests use raw dispatch and verify each intermediate card.
function game() { return { s: W.initialState(), do(a) { const r = W.dispatch(this.s, a); this.s = r.state; if(a.type==='open')while(W.pendingReview(this.s))this.do({type:'review-next',month:this.s.monthReview.month,cursor:this.s.monthReview.cursor});return {...r,state:this.s}; }, npc(a) { const v = W.activeVisit(this.s); return this.do({ visitId: v?.id, counterId: v?.counterId, ...a }); } }; }
function craft(g, recipe) { g.do({ type: 'craft', recipe }); return Object.values(g.s.items).at(-1); }
function intro(g) {
  const staff = craft(g, 'staff'), sword = craft(g, 'sword'); g.do({ type: 'open' });
  g.npc({ type: 'talk' }); g.npc({ type: 'sell', itemId: staff.id }); g.npc({ type: 'sell', itemId: sword.id }); return { staff, sword };
}
function order(g, material, quantity = 1, requestId = `test-${g.s.seq}`) { return g.npc({ type: 'order', material, quantity, requestId }); }
function next(g) { if (g.s.open) g.do({ type: 'close' }); g.do({ type: 'open' }); }
function depart(g) { const v = W.activeVisit(g.s); if (v) g.npc({ type: v.phase === 'service' ? 'leave' : 'decline' }); }
function at(g, npc) { while (W.activeVisit(g.s) && W.activeVisit(g.s).npc !== npc) depart(g); assert.equal(W.activeVisit(g.s)?.npc, npc); }
function rejection(g, a, regex) { const before = W.exportSave(g.s); assert.throws(() => g.do(a), regex); assert.equal(W.exportSave(g.s), before); }
function scoped(g, a) { const v = W.activeVisit(g.s); return { visitId: v?.id, counterId: v?.counterId, ...a }; }
function explore(g, requestId = `explore-${g.s.seq}`) { return g.npc({ type: 'explore', requestId }); }
function ready() { const g = game(); intro(g); explore(g); next(g); return g; }
function returnedStaff() { const g = ready(); next(g); at(g, 'cen'); g.npc({ type: 'reclaim', itemId: 'item-1' }); return { g, item: g.s.items['item-1'] }; }

module.exports = { game, craft, intro, order, explore, ready, next, depart, at, returnedStaff };
