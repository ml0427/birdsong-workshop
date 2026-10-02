(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.Workshop);if(typeof module==='object'&&module.exports)module.exports=api;else root.WorkshopTrial=api;})(typeof window==='object'?window:globalThis,function(W){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),MAX=Number.MAX_SAFE_INTEGER;
 const kinds=['staff','sword','bracer','amulet','bell'];
 const error=text=>{throw Error(text);};
 function measure(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!W.MATERIALS.includes(k)))error('請只投入木頭、鐵、銅、銀、金。');
  const quantities=Object.fromEntries(W.MATERIALS.map(m=>{const n=Object.hasOwn(input,m)?input[m]:0;if(!Number.isSafeInteger(n)||n<0||n>20)error('每種材料請填0–20的整數。');return [m,n];}));
  const total=Object.values(quantities).reduce((a,b)=>a+b,0);
  if(!total)error('先投入至少1個材料，再開始試作。');if(total>40)error('單件試作最多投入40個材料。');
  const values=W.MATERIALS.map(m=>quantities[m]),top=Math.max(...values);
  const index=values.findLastIndex(n=>n===top),recipe=values[0]===top&&values[1]===top?'shield':kinds[index];
  return {input:quantities,total,key:values.join(','),recipe};
 }
 function initial(){return {revision:0,seq:0,items:[],book:[{木頭:1},{木頭:1,鐵:1},{銀:1}].map(input=>{const m=measure(input);return {key:m.key,input:m.input,name:null};})};}
 function create(options={}){
  let state=initial();const random=options.random||Math.random;
  const draw=()=>{const n=Number(random());return Number.isFinite(n)?Math.max(0,Math.min(0.999999999999,n)):0;};
  function revision(expected){if(expected!==state.revision)error('這份試作操作已處理，請使用目前的按鈕。');if(state.revision>=MAX)error('測試記錄已達安全上限，請重置情境。');}
  return {get state(){return clone(state);},reset(){state=initial();return clone(state);},start(input,month,expected){
   revision(expected);const mix=measure(input);
   if(!Number.isSafeInteger(month)||month<0||month>MAX-2||state.seq>=MAX)error('月份或試作記錄超出安全範圍。');
   const eligible=Object.entries(W.TRAITS).filter(([,t])=>!t.appliesTo||t.appliesTo.includes(mix.recipe)).map(([id])=>id),count=1+Math.floor(draw()*2),traits=[];
   for(let n=0;n<count;n++)traits.push(eligible.splice(Math.floor(draw()*eligible.length),1)[0]);
   const item={id:'trial-'+(state.seq+1),key:mix.key,input:mix.input,recipe:mix.recipe,quality:Math.min(2,Math.floor((mix.total-1)/10)),traits,maxDurability:8+mix.total,durability:8+mix.total,status:'crafting',createdMonth:month,dueMonth:month+W.CRAFT_MONTHS[mix.recipe],finishedMonth:null};
   state={...state,seq:state.seq+1,revision:state.revision+1,items:[...state.items,item]};return clone(item);
  },advance(month){
   if(!Number.isSafeInteger(month)||month<0)error('月份不正確。');
   const due=state.items.filter(i=>i.status==='crafting'&&i.dueMonth<=month);if(!due.length)return [];
   if(state.revision>=MAX)error('測試記錄已達安全上限，請重置情境。');
   const next=clone(state);
   for(const item of next.items.filter(i=>i.status==='crafting'&&i.dueMonth<=month)){
    item.status='inventory';item.finishedMonth=month;
    const entry=next.book.find(b=>b.key===item.key);if(entry)entry.name=W.RECIPES[item.recipe].name;else next.book.push({key:item.key,input:clone(item.input),name:W.RECIPES[item.recipe].name});
   }
   next.revision++;state=next;return clone(due.map(i=>state.items.find(j=>j.id===i.id)));
  },reuse(key){const b=state.book.find(b=>b.key===key);if(!b)error('這份配料尚未記在筆記中。');return clone(b.input);}
  };
 }
 return {create,measure};
});
