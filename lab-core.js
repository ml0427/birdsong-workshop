(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.Workshop);if(typeof module==='object'&&module.exports)module.exports=api;else root.WorkshopLab=api;})(typeof window==='object'?window:globalThis,function(W){
 'use strict';
 const scoped=new Set(['talk','sell','deliver','leave','decline','order','explore','reclaim','accept-commission','cancel-commission','scout','gather-route']);
 const allowed={forge:['craft','open','close'],equipment:['craft','open','close','repair','smelt','appraise'],trade:['open','close','talk','sell','deliver','leave','decline','accept-commission','cancel-commission','craft'],materials:['open','close','order','explore','scout','gather-route','leave','decline'],growth:['open','close','talk','sell','deliver','leave','decline','accept-commission','cancel-commission','craft','reclaim','repair','smelt'],operations:['open','close','review-next','talk','sell','deliver','leave','decline']};
 const clone=s=>JSON.parse(JSON.stringify(s));
 function create(scenes){
  let key=null;const sessions=new Map();
  const api={get key(){return key;},get scene(){return key?scenes[key]:null;},get state(){return key?clone(sessions.get(key)):null;},select(next){if(!Object.hasOwn(scenes,next))throw Error('不存在的測試情境。');if(!sessions.has(next)){W.validate(scenes[next].state);sessions.set(next,clone(scenes[next].state));}key=next;return api.state;},menu(){key=null;},reset(){if(key)sessions.set(key,clone(scenes[key].state));return api.state;},action(fields){const s=api.state;if(!s)throw Error('先選擇測試。');const v=W.activeVisit(s);return {...(scoped.has(fields.type)&&v?{visitId:v.id,counterId:v.counterId}:{}),...fields,expectedRevision:s.revision,...(['order','explore','scout','gather-route','accept-commission'].includes(fields.type)&&!fields.requestId?{requestId:'lab-'+key+'-'+s.revision}:{} )};},act(action){
   const scene=api.scene;if(!scene)throw Error('先選擇測試。');
   if(!allowed[scene.mode].includes(action.type))throw Error('這項操作不在目前測試範圍。');
   let input=api.state;
   if(scene.mode==='forge'&&action.type==='craft')for(const m of input.knownMaterials)input.materials[m]=1000;
   const result=W.dispatch(input,action);let next=result.state;
   if(scene.mode!=='operations')while(W.pendingReview(next))next=W.dispatch(next,{type:'review-next',month:next.monthReview.month,cursor:next.monthReview.cursor}).state;
   W.validate(next);sessions.set(key,next);return {state:api.state,message:result.message};
  }};return api;
 }
 return {create};
});
