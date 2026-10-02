'use strict';
const assert=require('node:assert/strict'),W=require('../engine.js');
function assertTraits(v,value,fragment=v.html()){
 const keys=Array.isArray(value)?value:value.traits,raw=v.raw();
 for(const key of keys){assert(fragment.includes(`data-trait="${key}"`));assert(!fragment.includes(W.TRAITS[key].text));const b=v.trait(key);v.emit('focusin',b);assert.equal(v.element('trait-tooltip').hidden,false);assert.equal(v.element('trait-tooltip').textContent,`${W.TRAITS[key].name}：${W.TRAITS[key].text}`);assert(v.element('trait-descriptions').innerHTML.includes(`id="trait-help-${key}"`));assert.equal(b.attributes['aria-expanded'],'true');v.emit('keydown',b,{key:'Escape'});assert.equal(v.element('trait-tooltip').hidden,true);}
 assert.equal(v.raw(),raw);
}
module.exports={assertTraits};
