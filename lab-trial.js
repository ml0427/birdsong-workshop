(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.Workshop);if(typeof module==='object'&&module.exports)module.exports=api;else root.WorkshopTrial=api;})(typeof window==='object'?window:globalThis,function(W){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),MAX=Number.MAX_SAFE_INTEGER;
 // Hidden workshop templates. UI never lists them until a mixture is forged.
 const templates=[
  {id:'staff',name:'木杖',input:[3,0,0,0,0],power:12,durability:12,pool:'magic'},
  {id:'sword',name:'鐵劍',input:[1,3,0,0,0],power:16,durability:16,pool:'physical'},
  {id:'spear',name:'長槍',input:[3,2,1,0,0],power:20,durability:18,pool:'physical'},
  {id:'focus',name:'法杖',input:[2,0,0,2,1],power:24,durability:14,pool:'magic'}
 ];
 const fail=text=>{throw Error(text);},integer=n=>Number.isSafeInteger(n)&&n>=0;
 function plus(a,b){const n=a+b;if(!integer(n))fail('測試數值已達安全上限，請重置。');return n;}
 function measure(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!W.MATERIALS.includes(k)))fail('請只投入木頭、鐵、銅、銀、金。');
  const quantities=Object.fromEntries(W.MATERIALS.map(m=>{const n=Object.hasOwn(input,m)?input[m]:0;if(!Number.isSafeInteger(n)||n<0||n>20)fail('每種材料請填0–20的整數。');return [m,n];}));
  const values=W.MATERIALS.map(m=>quantities[m]),total=values.reduce((a,b)=>a+b,0);if(!total)fail('先投入至少1個材料，再鍛造。');if(total>40)fail('單件最多投入40個材料。');
  const ranked=templates.map((t,index)=>({t,index,distance:values.reduce((sum,n,k)=>sum+Math.abs(n-t.input[k]),0)})).sort((a,b)=>a.distance-b.distance||a.index-b.index),{t,distance}=ranked[0];
  return {input:quantities,total,key:values.join(','),weapon:t.id,name:t.name,pool:t.pool,distance,fit:Math.round(100*(1-distance/(total+t.input.reduce((a,b)=>a+b,0)))),basePower:Math.max(1,t.power-4*distance),baseDurability:Math.max(3,t.durability-2*distance)};
 }
 function probabilities(level=0){if(!Number.isInteger(level)||level<0||level>3)fail('技能級數不正確。');return {stars:[70-15*level,25+10*level,5+5*level],counts:[60,40],pools:{magic:{light:70,solid:70},physical:{light:140/3,solid:140/3,guard:140/3}}};}
 function effect(item){const power=item.basePower+(item.stars-1)*2+item.traits.reduce((n,t)=>n+(W.TRAITS[t].powerBonus||0),0),guard=item.pool==='physical'?item.traits.reduce((n,t)=>n+(W.TRAITS[t].useBonus||0),0):0;return {power,score:power+guard,wear:Math.max(1,2-item.traits.reduce((n,t)=>n+(W.TRAITS[t].wearReduction||0),0)),starBonus:(item.stars-1)*2};}
 function initial(){return {revision:0,seq:0,crafted:0,earnedPoints:0,points:0,skills:{quality:0,trade:0},income:0,items:[],book:[{木頭:2},{鐵:2}].map(input=>{const m=measure(input);return {key:m.key,input:m.input,name:null};})};}
 function create(options={}){
  let state=initial();const random=typeof options.random==='function'?options.random:Math.random;
  const draw=()=>{const n=Number(random());return Number.isFinite(n)?Math.max(0,Math.min(0.999999999999,n)):0;};
  function revision(expected){if(expected!==state.revision)fail('這份操作已處理，請使用目前的按鈕。');plus(state.revision,1);}
  function price(item){return effect(item).power*2+item.baseDurability+state.skills.trade*5;}
  return {get state(){return clone(state);},reset(){state=initial();return clone(state);},forge(input,expected){
   revision(expected);const mix=measure(input),seq=plus(state.seq,1),crafted=plus(state.crafted,1),p=probabilities(state.skills.quality).stars,r=draw()*100,stars=r<p[0]?1:r<p[0]+p[1]?2:3;
   const eligible=['light','solid',...(mix.pool==='physical'?['guard']:[])],count=draw()<0.6?1:2,traits=[];for(let n=0;n<count;n++)traits.push(eligible.splice(Math.floor(draw()*eligible.length),1)[0]);
   const item={id:'weapon-'+seq,...mix,stars,traits,qualityLevel:state.skills.quality,status:'inventory',soldFor:null,soldTradeLevel:null};
   const next=clone(state),earnedPoints=Math.min(6,Math.floor(crafted/3));next.seq=seq;next.crafted=crafted;next.points+=earnedPoints-next.earnedPoints;next.earnedPoints=earnedPoints;next.items.push(item);next.revision++;
   const entry=next.book.find(b=>b.key===mix.key);if(entry)entry.name=mix.name;else next.book.push({key:mix.key,input:clone(mix.input),name:mix.name});state=next;return clone(item);
  },allocate(branch,expected){revision(expected);if(!['quality','trade'].includes(branch))fail('請選品質或交易強化。');if(state.skills[branch]>=3)fail('這個技能已達3級。');if(!state.points)fail('尚無技能點；每鍛造3件得1點。');const next=clone(state);next.points--;next.skills[branch]++;next.revision++;state=next;return clone(state);},quote(id){const item=state.items.find(i=>i.id===id);if(!item)fail('沒有這件測試武器。');return item.status==='sold'?item.soldFor:price(item);},sell(id,expected){revision(expected);const item=state.items.find(i=>i.id===id);if(!item||item.status!=='inventory')fail('這件測試武器已出售或不存在。');const amount=price(item),income=plus(state.income,amount),next=clone(state),sold=next.items.find(i=>i.id===id);sold.status='sold';sold.soldFor=amount;sold.soldTradeLevel=state.skills.trade;next.income=income;next.revision++;state=next;return {amount,item:clone(sold)};},reuse(key){const b=state.book.find(b=>b.key===key);if(!b)fail('這份配料尚未記在筆記中。');return clone(b.input);}
  };
 }
 return {create,measure,probabilities,effect};
});
