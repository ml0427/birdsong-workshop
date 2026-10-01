'use strict';
const W=require('../engine.js'),{completeDelayedRoute}=require('../tests/audit-helpers.cjs');
const route=completeDelayedRoute(process.argv.includes('--resale')?'repair':'smelt');
console.log(JSON.stringify({source:'全新合成遊戲；所有狀態遞迴凍結、只呼叫公開 dispatch、獨立重播比對通過',actions:route.g.actions,months:route.g.months,events:route.g.state.journey.events,finalRoad:W.roadState(route.g.state)},null,2));
