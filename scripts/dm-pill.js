(() => {
 'use strict';
 const pill=document.querySelector('.dm-pill'),hero=document.getElementById('top'),join=document.getElementById('join');
 if(!pill||!hero||!join)return;
 const desktop=window.matchMedia('(min-width: 900px)'),reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let heroOut=false,joinVisible=false,timer=0;
 const allowed=()=>heroOut&&!joinVisible&&!desktop.matches&&!document.querySelector('dialog[open]');
 function update(){window.clearTimeout(timer);if(allowed()){pill.hidden=false;if(reduced.matches)pill.classList.add('is-visible');else{void pill.offsetWidth;pill.classList.add('is-visible')}}else{pill.classList.remove('is-visible');if(reduced.matches||desktop.matches)pill.hidden=true;else timer=window.setTimeout(()=>{if(!allowed())pill.hidden=true},160)}}
 if('IntersectionObserver' in window){
  new IntersectionObserver(entries=>{const e=entries[0];heroOut=!e.isIntersecting&&e.boundingClientRect.bottom<=0;update()},{threshold:0}).observe(hero);
  new IntersectionObserver(entries=>{joinVisible=entries[0].isIntersecting;update()},{threshold:0}).observe(join);
 }else{
  const inspect=()=>{heroOut=hero.getBoundingClientRect().bottom<=0;const r=join.getBoundingClientRect();joinVisible=r.top<innerHeight&&r.bottom>0;update()};window.addEventListener('scroll',inspect,{passive:true});inspect();
 }
 new MutationObserver(update).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 document.addEventListener('sheet:open',update);document.addEventListener('sheet:close',update);desktop.addEventListener('change',update);reduced.addEventListener('change',update);
})();
