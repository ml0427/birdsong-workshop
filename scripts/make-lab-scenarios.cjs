'use strict';
// Synthetic campaigns, never player saves. History and ownership are earned by dispatch.
const fs=require('node:fs'),path=require('node:path'),W=require('../engine.js');
const {personalRoute}=require('../tests/personal-helpers.cjs');
const {completeDelayedRoute,delayedRoute}=require('../tests/audit-helpers.cjs');
const {game,intro}=require('../tests/helpers.cjs');
const clone=s=>JSON.parse(JSON.stringify(s));
const route=personalRoute(),full=completeDelayedRoute();
let he=W.initialState();
const lastClose=full.g.actions.findLastIndex(row=>row.action.type==='close');
for(const row of full.g.actions.slice(0,lastClose))he=W.dispatch(he,row.action).state;
const trade=route.frames.find(s=>s.knownMaterials.length===5&&W.activeVisit(s)?.kind==='delivery'&&W.inventory(s).some(i=>W.suitable(s,i))&&s.visits.filter(v=>v.status==='waiting').length>=2);
if(!trade)throw Error('Missing earned trade scenario');
const g=game();intro(g);
function prepare(raw,closed=true,cash=200){
 let s=clone(raw);
 while(W.pendingReview(s))s=W.dispatch(s,{type:'review-next',month:s.monthReview.month,cursor:s.monthReview.cursor}).state;
 if(closed&&s.open)s=W.dispatch(s,{type:'close'}).state;
 // Explicit setup allowance: funds and known material quantities only.
 s.coins=cash;s.debt=0;for(const m of s.knownMaterials)s.materials[m]=20;
 W.validate(s);return s;
}
const equipment=prepare(route.seed);
const legacyItem=W.inventory(equipment).find(i=>i.returned&&!i.repaired&&i.recipe==='bracer');
const tradeStock=prepare(trade,false);
const stockedTrade=W.dispatch(tradeStock,{type:'craft',recipe:'sword'}).state;
const equipped=W.dispatch(equipment,{type:'smelt',itemId:legacyItem.id}).state;
let operations=prepare(trade,true,4);
operations=W.dispatch(operations,{type:'craft',recipe:'staff'}).state;
operations=W.dispatch(operations,{type:'craft',recipe:'amulet'}).state;
const scenes={
 forge:{mode:'forge',title:'鍛造',intro:'材料無限供應。開始製作後，按開店前進一月；護符與金鈴需要兩月。',state:prepare(route.seed)},
 equipment:{mode:'equipment',title:'裝備整理',intro:'這些舊物已由本人退役贈還。修復、鑑定或熔鍊；銅已有一份由舊護腕實際熔鍊取得的傳承。',state:equipped},
 trade:{mode:'trade',title:'櫃臺交易',intro:'小禾正等領取木盾；新鐵劍下月完工，可供推薦。先處理目前顧客，再接下一位。',state:stockedTrade},
 materials:{mode:'materials',title:'材料取得',intro:'開場兩件已售出，尚未派遣。當面委託採購或探索，下次開店才交付；每人只能一件背景任務。',state:prepare(g.s,false)},
 'growth-cen':{mode:'growth',npc:'cen',title:'阿岑・目標前一月',intro:'裝備和能力是正常交易與使用取得。下次開店，由本人真正使用才判定目標。',state:prepare(route.frames.findLast(s=>s.month===12&&s.items['item-34']?.owner==='cen'))},
 'growth-he':{mode:'growth',npc:'he',title:'小禾・目標前一月',intro:'路標已勘查，剛交付新護腕。下次開店後檢查真正的裝備使用與通路。',state:prepare(he)},
 'growth-shu':{mode:'growth',npc:'shu',title:'望舒・目標前一月',intro:'已交付護符與金鈴。當月領貨不觸發，下月本人使用才判定。',state:prepare(route.before)},
 'growth-gap':{mode:'growth',npc:'he',title:'小禾・缺裝備',intro:'目前木盾剩耐久不足。依正常來訪需求接委託或補裝，不會按一下直接完成路線。',state:prepare(delayedRoute().g.state)},
 operations:{mode:'operations',title:'店舖營運',intro:'現金4枚、欠款0。木杖一月，銀護符兩月；逐卡讀月結，真正交貨收入先清欠款。',state:operations}
};
for(const scene of Object.values(scenes)){W.validate(scene.state);scene.initialItemIds=Object.keys(scene.state.items);}
const source='// Generated synthetic scenarios by scripts/make-lab-scenarios.cjs; no player data.\n(function(root,factory){if(typeof module===\'object\'&&module.exports)module.exports=factory();else root.WorkshopLabScenarios=factory();})(typeof window===\'object\'?window:globalThis,function(){return '+JSON.stringify(scenes)+';});\n';
fs.writeFileSync(path.resolve(__dirname,'../lab-scenarios.js'),source);
console.log('Generated '+Object.keys(scenes).length+' validated independent scenes from public engine campaigns.');
