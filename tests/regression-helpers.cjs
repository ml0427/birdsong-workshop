'use strict';
const assert=require('node:assert/strict'),W=require('../engine.js');
const {ready,craft,explore,next,depart,at}=require('./helpers.cjs');
function request(g,npc,recipe,extra={}){while(W.activeVisit(g.s))depart(g);const id=`focused-${g.s.visits.length}`;g.s.visits.push({id,month:g.s.month,npc,needs:[recipe],kind:'normal',asked:true,status:'waiting',phase:'request',counterId:`${id}@${g.s.month}`,reason:'明確用途測試需求',minQuality:0,traitRequired:null,contentKey:null,contextText:'',...extra});W.validate(g.s);}
function twoMonthCustomer(){const g=ready();g.npc({type:'talk'});craft(g,'staff');const bracer=craft(g,'bracer');explore(g);next(g);at(g,'he');g.npc({type:'sell',itemId:bracer.id});at(g,'shu');g.npc({type:'talk'});g.npc({type:'accept-commission',requestId:'two-month-customer'});assert.equal(g.s.commissions.at(-1).recipe,'amulet');return g;}
module.exports={request,twoMonthCustomer};
