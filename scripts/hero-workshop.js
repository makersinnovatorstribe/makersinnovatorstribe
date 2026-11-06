(() => {
  'use strict';
  const hero = document.querySelector('[data-hero-workshop]');
  const scene = hero?.querySelector('.hero-workshop-scene');
  if (!hero || !scene) return;

  const originalBear = scene.querySelector('.hero-workshop-art');
  let ready=false;
  function reveal(){if(ready)return;ready=true;scene.classList.add('is-ready');hero.querySelector('.craft-strip')?.classList.add('is-arriving');window.clearTimeout(safety)}
  const safety=window.setTimeout(reveal,1200);
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)reveal();
  else if(originalBear?.decode)originalBear.decode().then(reveal,()=>{});
  else if(originalBear?.complete&&originalBear.naturalWidth)reveal();
  else originalBear?.addEventListener('load',reveal,{once:true});
  if (originalBear?.tagName === 'IMG' && window.MIT_HAMMER_BEAR) {
    const bear = window.MIT_HAMMER_BEAR.createHero(originalBear);
    // Reuse the preloaded, decoded image as the fallback so the bench does
    // not wait for a second image element after the hanging pieces reveal.
    originalBear.className='exco-hammer-fallback';
    scene.append(bear);
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let pointerDown = false;
  let focusWithin = hero.contains(document.activeElement);
  let windowActive = true;

  function updateMotion() {
    const dialogOpen = !!document.querySelector('dialog[open]');
    const active = visible && windowActive && !document.hidden && !reducedMotion.matches && !pointerDown && !focusWithin && !dialogOpen;
    hero.classList.toggle('hero-workshop-active', active);
  }

  if ('IntersectionObserver' in window) {
    const visibility = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      updateMotion();
    }, { threshold: .05 });
    visibility.observe(scene);
  } else {
    visible = true;
  }

  hero.addEventListener('pointerdown', () => { pointerDown = true; updateMotion(); }, { passive: true });
  function releasePointer() { pointerDown = false; updateMotion(); }
  window.addEventListener('pointerup', releasePointer, { passive: true });
  window.addEventListener('pointercancel', releasePointer, { passive: true });
  hero.addEventListener('focusin', () => { focusWithin = true; updateMotion(); });
  hero.addEventListener('focusout', event => {
    focusWithin = !!event.relatedTarget && hero.contains(event.relatedTarget);
    updateMotion();
  });
  window.addEventListener('blur', () => { windowActive = false; pointerDown = false; updateMotion(); });
  window.addEventListener('focus', () => { windowActive = true; updateMotion(); });
  document.addEventListener('visibilitychange', updateMotion);
  reducedMotion.addEventListener('change', updateMotion);

  // Native project/profile dialogs may open outside the hero. Pause the hanging
  // pieces while any dialog is open, including dialogs created after this script.
  const dialogs = new MutationObserver(updateMotion);
  dialogs.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
  updateMotion();
})();
