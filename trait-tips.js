(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorkshopTraitTips = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const overlap = (a,b) => a.x < b.right && a.x+a.width > b.left && a.y < b.bottom && a.y+a.height > b.top;
  function place(anchor, size, viewport, obstacle = null) {
    const gap = 8, left = (viewport.left || 0)+gap, top = (viewport.top || 0)+gap;
    const right = (viewport.left || 0)+viewport.width-gap, bottom = (viewport.top || 0)+viewport.height-gap;
    if (right <= left || bottom <= top) return null;
    const width = Math.min(size.width, right-left), height = Math.min(size.height, bottom-top);
    const blocked = obstacle && obstacle.right > obstacle.left && obstacle.bottom > obstacle.top ? obstacle : null;
    const candidates = [{x:anchor.left,y:anchor.top-height-gap}, {x:anchor.right+gap,y:anchor.top}, {x:anchor.left-width-gap,y:anchor.top}, {x:anchor.left,y:anchor.bottom+gap}];
    for (const c of candidates) {
      const result = {x:clamp(c.x,left,right-width),y:clamp(c.y,top,bottom-height),width,height};
      if (!blocked || !overlap(result,blocked)) return result;
    }
    // The footer divides the viewport into safe rectangles. Fit in the closest
    // usable one instead of covering the persistent trading/leave controls.
    const areas = [{left,top,right,bottom:Math.min(bottom,blocked.top-gap)}, {left:Math.max(left,blocked.right+gap),top,right,bottom}, {left,top,right:Math.min(right,blocked.left-gap),bottom}, {left,top:Math.max(top,blocked.bottom+gap),right,bottom}]
      .filter(a=>a.right-a.left>=32 && a.bottom-a.top>=32);
    const cx=(anchor.left+anchor.right)/2,cy=(anchor.top+anchor.bottom)/2;
    areas.sort((a,b)=>Math.hypot(cx-clamp(cx,a.left,a.right),cy-clamp(cy,a.top,a.bottom))-Math.hypot(cx-clamp(cx,b.left,b.right),cy-clamp(cy,b.top,b.bottom)) || (b.right-b.left)*(b.bottom-b.top)-(a.right-a.left)*(a.bottom-a.top));
    const a=areas[0]; if(!a)return null;
    const w=Math.min(width,a.right-a.left),h=Math.min(height,a.bottom-a.top);
    return {x:clamp(anchor.left,a.left,a.right-w),y:clamp(anchor.top-h-gap,a.top,a.bottom-h),width:w,height:h};
  }
  function create(document, window, traits) {
    const tip=document.getElementById('trait-tooltip'), descriptions=document.getElementById('trait-descriptions');
    let active=null;
    tip.hidden=true;
    descriptions.innerHTML=Object.entries(traits).map(([key,t])=>`<span id="trait-help-${escape(key)}">${escape(t.text)}</span>`).join('');
    function labels(value) {
      return (Array.isArray(value)?value:value.traits).map(key=>`<button type="button" class="trait-name" data-trait="${escape(key)}" aria-describedby="trait-help-${escape(key)}" aria-controls="trait-tooltip" aria-expanded="false">${escape(traits[key].name)}</button>`).join('<span aria-hidden="true">、</span>');
    }
    const target=e=>{const b=e.target?.closest?.('[data-trait]');return b && Object.hasOwn(traits,b.dataset?.trait)?b:null;};
    const inTip=node=>!!node && (node===tip || tip.contains(node));
    function hide() { if(active)active.trigger.setAttribute('aria-expanded','false');active=null;tip.hidden=true; }
    function show(b,mode) {
      if(active?.trigger!==b){hide();active={trigger:b,pinned:false,hovered:false,focused:false};}
      if(mode==='hover')active.hovered=true;if(mode==='focus')active.focused=true;if(mode==='pin')active.pinned=true;
      tip.textContent=`${traits[b.dataset.trait].name}：${traits[b.dataset.trait].text}`;
      const v=window.visualViewport,viewport={left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||window.innerWidth,height:v?.height||window.innerHeight};
      tip.style.maxWidth=Math.min(320,Math.max(1,viewport.width-16))+'px';tip.style.maxHeight=Math.max(1,viewport.height-16)+'px';
      tip.hidden=false;tip.style.visibility='hidden';
      const rect=tip.getBoundingClientRect(),footer=document.querySelector('.counter-actions')?.getBoundingClientRect();
      const position=place(b.getBoundingClientRect(),rect,viewport,footer);
      if(!position){hide();return;}
      tip.style.maxWidth=position.width+'px';tip.style.maxHeight=position.height+'px';tip.style.left=position.x+'px';tip.style.top=position.y+'px';tip.style.visibility='visible';
      b.setAttribute('aria-expanded','true');
    }
    function toggle(b) { if(active?.trigger===b && active.pinned)hide();else show(b,'pin'); }
    function click(e) {
      const b=target(e);if(b){toggle(b);return true;}if(!inTip(e.target))hide();return false;
    }
    document.addEventListener('pointerover',e=>{const b=target(e);if(b)show(b,'hover');else if(inTip(e.target)&&active)active.hovered=true;});
    document.addEventListener('pointerout',e=>{if(!active)return;const b=target(e);if(b!==active.trigger&&!inTip(e.target))return;if(e.relatedTarget===active.trigger||inTip(e.relatedTarget))return;active.hovered=false;if(!active.pinned&&!active.focused)hide();});
    document.addEventListener('focusin',e=>{const b=target(e);if(b)show(b,'focus');});
    document.addEventListener('focusout',e=>{if(active?.trigger!==target(e))return;active.focused=false;if(!active.pinned&&!active.hovered)hide();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){hide();e.preventDefault();return;}const b=target(e);if(e.key==='Enter'&&b){e.preventDefault();if(!e.repeat)toggle(b);}});
    document.addEventListener('scroll',e=>{if(!inTip(e.target))hide();},true);
    document.addEventListener('toggle',hide,true);
    window.addEventListener('resize',hide);window.addEventListener('blur',hide);
    window.visualViewport?.addEventListener('resize',hide);window.visualViewport?.addEventListener('scroll',hide);
    return {labels,click,hide};
  }
  return {create,place};
});
