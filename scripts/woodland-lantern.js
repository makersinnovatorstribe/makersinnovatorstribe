/* Day/evening light travels through the live artwork; no scene snapshots. */
(() => {
  'use strict';

  function create({ button, world, apply, getEvening }) {
    if (!button || !world || typeof apply !== 'function') throw new TypeError('A lantern button, woodland and state callback are required.');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const calmPhone = window.matchMedia('(max-width:767px) and (pointer:coarse)');
    let evening = getEvening ? getEvening() : button.getAttribute('aria-pressed') === 'true';
    let destroyed = false, revealTimer = 0, tipTimer = 0;
    let delays = [];

    function clearTip() {
      window.clearTimeout(tipTimer);
      tipTimer = 0;
      button.classList.remove('is-lantern-tipped');
    }
    function tip() {
      clearTip();
      if (destroyed || reduced.matches || document.hidden) return;
      button.classList.add('is-lantern-tipped');
      tipTimer = window.setTimeout(clearTip, 420);
    }
    function instant(callback) {
      const previous = world.getAttribute('data-lantern-snapshot');
      world.setAttribute('data-lantern-snapshot', 'instant');
      world.getBoundingClientRect();
      try { callback(); world.getBoundingClientRect(); }
      finally {
        if (previous === null) world.removeAttribute('data-lantern-snapshot');
        else world.setAttribute('data-lantern-snapshot', previous);
      }
    }
    function clearReveal() {
      window.clearTimeout(revealTimer);
      revealTimer = 0;
      world.removeAttribute('data-lantern-reveal');
      for (const { element, value, priority } of delays) {
        if (value) element.style.setProperty('--lantern-reveal-delay', value, priority);
        else element.style.removeProperty('--lantern-reveal-delay');
      }
      delays = [];
    }
    function toggle() {
      if (destroyed) return Promise.resolve(evening);
      evening = !(getEvening ? getEvening() : evening);
      clearReveal();
      clearTip();
      if (reduced.matches || document.hidden || button.isConnected === false || world.isConnected === false) {
        instant(() => apply(evening));
        return Promise.resolve(evening);
      }

      // The phone stylesheet fades the light pools without interpolating every
      // tree's colour filter. It needs neither per-layer distances nor delay
      // writes, which otherwise force the entire scene through extra styling.
      if (calmPhone.matches) {
        world.setAttribute('data-lantern-reveal', 'live');
        apply(evening);
        tip();
        revealTimer = window.setTimeout(clearReveal, 820);
        return Promise.resolve(evening);
      }

      const origin = button.getBoundingClientRect();
      const box = world.getBoundingClientRect();
      const scale = box.width / world.offsetWidth || 1;
      const x = origin.left + origin.width / 2, y = origin.top + origin.height / 2;
      // Each layer keeps painting while its color/glow eases into the new state.
      // Nearby artwork responds first; the short delay suggests light spreading
      // from the lantern without replacing the forest with a captured image.
      const measures = [...world.querySelectorAll('[data-forest-id], .exco-fireflies, .exco-lamp-halo, .exco-lamp-pool, .exco-lamp-art')].map(element => {
        const bounds = element.getBoundingClientRect();
        const nearestX = Math.max(bounds.left, Math.min(x, bounds.right));
        const nearestY = Math.max(bounds.top, Math.min(y, bounds.bottom));
        const delay = Math.min(240, Math.hypot(nearestX - x, nearestY - y) / scale / 1.6);
        const value = element.style.getPropertyValue('--lantern-reveal-delay');
        const priority = element.style.getPropertyPriority('--lantern-reveal-delay');
        return { element, value, priority, delay };
      });
      // Finish every geometry read before changing any style. Interleaving
      // these across the saved scene forced one complete style flush per lamp.
      delays = measures;
      for (const {element, delay} of measures) element.style.setProperty('--lantern-reveal-delay', delay.toFixed(0) + 'ms');
      world.setAttribute('data-lantern-reveal', 'live');
      world.getBoundingClientRect();
      apply(evening);
      tip();
      revealTimer = window.setTimeout(clearReveal, 820);
      return Promise.resolve(evening);
    }
    function suspend() { instant(clearReveal); clearTip(); }
    function motionChanged() { if (reduced.matches) suspend(); }
    function visibilityChanged() { if (document.hidden) suspend(); }
    reduced.addEventListener?.('change', motionChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pagehide', suspend);
    return {
      toggle,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        suspend();
        reduced.removeEventListener?.('change', motionChanged);
        document.removeEventListener('visibilitychange', visibilityChanged);
        window.removeEventListener('pagehide', suspend);
      }
    };
  }
  window.MIT_WOODLAND_LANTERN = { create };
})();
