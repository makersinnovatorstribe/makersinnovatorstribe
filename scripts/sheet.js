(() => {
 'use strict';
 const states=new WeakMap(),opened=new Set(),motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 let bodyOverflow='';
 function notify(type,dialog){document.dispatchEvent(new CustomEvent('sheet:'+type,{detail:{dialog}}))}
 function lock(dialog){if(!opened.size)bodyOverflow=document.body.style.overflow;opened.add(dialog);document.body.style.overflow='hidden'}
 function release(dialog){opened.delete(dialog);if(!opened.size)document.body.style.overflow=bodyOverflow}
 function duration(){return motion.matches?0:260}
 function register(dialog){
  if(states.has(dialog))return states.get(dialog);
  const state={trigger:null,timer:0,resolve:null,drag:null};states.set(dialog,state);dialog.classList.add('sheet');
  let header=dialog.querySelector('.sheet-handle')||dialog.querySelector('.dialog-top');
  if(!header){header=document.createElement('div');dialog.prepend(header)}
  header.classList.add('sheet-handle','sheet-grip-wrap');
  let grip=header.querySelector('.sheet-grip');if(!grip){grip=document.createElement('span');grip.className='sheet-grip';grip.setAttribute('aria-hidden','true');header.prepend(grip)}grip.classList.add('sheet-grab-handle');
  dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>close(dialog)));
  dialog.addEventListener('cancel',e=>{e.preventDefault();close(dialog)});
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close(dialog)});
  dialog.addEventListener('close',()=>{
   window.clearTimeout(state.timer);state.timer=0;dialog.classList.remove('is-closing','is-entering','is-dragging');dialog.style.removeProperty('--sheet-drag');release(dialog);notify('close',dialog);
   const resolve=state.resolve;state.resolve=null;state.closing=null;
   if(!opened.size&&state.trigger?.isConnected)state.trigger.focus({preventScroll:true});resolve?.();
  });
  dialog.addEventListener('pointerdown',e=>{
   if(e.button!==0||e.target.closest('button,a,input,select,textarea'))return;
   const r=dialog.getBoundingClientRect();if(!e.target.closest('.sheet-handle')&&e.clientY-r.top>56)return;
   state.drag={id:e.pointerId,start:e.clientY,last:e.clientY,time:performance.now(),speed:0,distance:0};
   dialog.setPointerCapture(e.pointerId);dialog.classList.remove('is-entering');dialog.classList.add('is-dragging');
  });
  dialog.addEventListener('pointermove',e=>{const d=state.drag;if(!d||e.pointerId!==d.id)return;const now=performance.now();d.speed=(e.clientY-d.last)/Math.max(1,now-d.time);d.last=e.clientY;d.time=now;d.distance=e.clientY-d.start;dialog.style.setProperty('--sheet-drag',(d.distance<0?d.distance*.2:d.distance)+'px');if(e.cancelable)e.preventDefault()});
  function end(e){const d=state.drag;if(!d||e.pointerId!==d.id)return;state.drag=null;if(dialog.hasPointerCapture(e.pointerId))dialog.releasePointerCapture(e.pointerId);dialog.classList.remove('is-dragging');
   if(e.type!=='pointercancel'&&(d.distance>120||(d.distance>0&&performance.now()-d.time<100&&d.speed>.6)))close(dialog);else dialog.style.setProperty('--sheet-drag','0px');
  }
  dialog.addEventListener('pointerup',end);dialog.addEventListener('pointercancel',end);
  return state;
 }
 function open(dialog,{trigger=document.activeElement}={}){
  if(!dialog)return;const state=register(dialog);
  if(state.closing){window.clearTimeout(state.timer);state.resolve?.();state.resolve=null;state.closing=null}
  state.trigger=trigger;dialog.classList.remove('is-closing');dialog.style.removeProperty('--sheet-drag');
  if(!dialog.open){lock(dialog);try{dialog.showModal()}catch(error){release(dialog);throw error}if(!motion.matches)dialog.classList.add('is-entering');notify('open',dialog)}
  return dialog;
 }
 function close(dialog){
  if(!dialog?.open)return Promise.resolve();const state=register(dialog);if(state.closing)return state.closing;
  state.closing=new Promise(resolve=>state.resolve=resolve);const promise=state.closing;
  dialog.classList.remove('is-entering','is-dragging');dialog.classList.add('is-closing');
  if(!duration())dialog.close();else state.timer=window.setTimeout(()=>dialog.close(),duration());return promise;
 }
 motion.addEventListener('change',()=>{if(motion.matches)opened.forEach(dialog=>{const state=states.get(dialog);dialog.classList.remove('is-entering');if(state?.closing){window.clearTimeout(state.timer);dialog.close()}})});
 document.querySelectorAll('dialog').forEach(register);
 window.MIT_SHEET=Object.freeze({open,close});
})();
