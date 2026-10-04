/* Scoped day/evening reveal. Exco owns the state, copy and click listener. */
(() => {
  'use strict';
  let sequence = 0;
  let activeRun = null;

  function create({ button, world, apply }) {
    if (!button || !world || typeof apply !== 'function') throw new TypeError('A lantern button, woodland and state callback are required.');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let evening = button.getAttribute('aria-pressed') === 'true';
    let current = null;
    let destroyed = false;
    let tipTimer = 0;

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
    function applyImmediately(value) {
      const previous = world.getAttribute('data-lantern-snapshot');
      world.setAttribute('data-lantern-snapshot', 'instant');
      // Flush the suppression before and after the state change, so existing
      // filter transitions cannot leave the fallback midway between seasons.
      world.getBoundingClientRect();
      try { apply(value); world.getBoundingClientRect(); }
      finally {
        if (previous === null) world.removeAttribute('data-lantern-snapshot');
        else world.setAttribute('data-lantern-snapshot', previous);
      }
    }
    function canReveal() {
      return !reduced.matches && !document.hidden && button.isConnected !== false && world.isConnected !== false &&
        typeof document.startViewTransition === 'function' && typeof document.documentElement.animate === 'function';
    }

    function toggle() {
      if (destroyed) return Promise.resolve(evening);
      evening = !evening;
      // A queued snapshot callback must never overwrite a newer tap's intent.
      if (activeRun) activeRun.stop(false);
      clearTip();
      if (!canReveal()) {
        applyImmediately(evening);
        tip();
        return Promise.resolve(evening);
      }

      const root = document.documentElement;
      const box = world.getBoundingClientRect();
      const origin = button.getBoundingClientRect();
      // Snapshot clipping uses the unscaled element box. The 390px composition
      // can be uniformly enlarged or reduced by its parent on another screen.
      const scale = box.width / world.offsetWidth || 1;
      const x = (origin.left + origin.width / 2 - box.left) / scale;
      const y = (origin.top + origin.height / 2 - box.top) / scale;
      const right = (Math.min(box.right, window.innerWidth) - box.left) / scale;
      const bottom = (Math.min(box.bottom, window.innerHeight) - box.top) / scale;
      const left = (Math.max(box.left, 0) - box.left) / scale;
      const top = (Math.max(box.top, 0) - box.top) / scale;
      if (!box.width || !box.height || right <= left || bottom <= top) {
        applyImmediately(evening);
        tip();
        return Promise.resolve(evening);
      }
      // Cover the visible clearing, not thousands of offscreen pixels. Scrolling
      // during the reveal ends the snapshot and exposes the complete live scene.
      const radius = Math.ceil(Math.max(
        Math.hypot(x - left, y - top), Math.hypot(x - right, y - top),
        Math.hypot(x - left, y - bottom), Math.hypot(x - right, y - bottom)
      )) + 2;
      const name = 'mit-woodland-' + (++sequence);
      const saved = [root, world].map(element => ({ element, value: element.style.getPropertyValue('view-transition-name'), priority: element.style.getPropertyPriority('view-transition-name') }));
      const previousSnapshot = world.getAttribute('data-lantern-snapshot');
      const sheet = document.createElement('style');
      sheet.textContent = `
        ::view-transition { pointer-events: none; }
        ::view-transition-group(${name}), ::view-transition-image-pair(${name}),
        ::view-transition-old(${name}), ::view-transition-new(${name}) {
          animation: none !important; pointer-events: none; mix-blend-mode: normal;
        }
        ::view-transition-image-pair(${name}) { isolation: isolate; }
        ::view-transition-old(${name}) { z-index: 1; }
        ::view-transition-new(${name}) { z-index: 2; }
      `;
      document.head.append(sheet);
      root.style.setProperty('view-transition-name', 'none', 'important');
      world.style.setProperty('view-transition-name', name, 'important');
      world.setAttribute('data-lantern-snapshot', name);

      let resolve;
      const done = new Promise(yes => { resolve = yes; });
      const run = { value: evening, applied: false, ended: false, cancelled: false, animationDone: false, transition: null, animation: null, timer: 0, stop };
      current = activeRun = run;
      function commit() {
        if (run.ended || run.cancelled || run.applied || destroyed) return;
        run.applied = true;
        apply(run.value);
      }
      function finish(withTip) {
        if (run.ended) return;
        run.ended = true;
        window.clearTimeout(run.timer);
        window.removeEventListener('scroll', interrupt);
        window.removeEventListener('resize', interrupt);
        window.removeEventListener('pagehide', interrupt);
        document.removeEventListener('visibilitychange', interrupt);
        saved.forEach(({ element, value, priority }) => {
          if (value) element.style.setProperty('view-transition-name', value, priority);
          else element.style.removeProperty('view-transition-name');
        });
        if (previousSnapshot === null) world.removeAttribute('data-lantern-snapshot');
        else world.setAttribute('data-lantern-snapshot', previousSnapshot);
        sheet.remove();
        if (current === run) current = null;
        if (activeRun === run) activeRun = null;
        if (withTip) tip();
        resolve(run.value);
      }
      function stop(commitLatest = true) {
        if (run.ended) return;
        if (commitLatest) commit();
        run.cancelled = true;
        try { run.transition?.skipTransition(); } catch (_) { /* Already skipped. */ }
        try { run.animation?.cancel(); } catch (_) { /* Already finished. */ }
        finish(false);
      }
      function interrupt() { stop(true); }
      window.addEventListener('scroll', interrupt, { passive: true });
      window.addEventListener('resize', interrupt, { passive: true });
      window.addEventListener('pagehide', interrupt);
      document.addEventListener('visibilitychange', interrupt);
      run.timer = window.setTimeout(interrupt, 1800);
      try {
        run.transition = document.startViewTransition(commit);
        // Attach handlers to every lifecycle promise: skipped transitions reject
        // ready even when their DOM update itself succeeds.
        Promise.resolve(run.transition.updateCallbackDone).catch(() => stop(true));
        Promise.resolve(run.transition.ready).then(() => {
          if (run.ended || destroyed) return;
          if (!canReveal()) { stop(true); return; }
          try {
            run.animation = root.animate(
              { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
              { duration: 620, easing: 'cubic-bezier(.22,.68,.24,1)', fill: 'both', pseudoElement: `::view-transition-new(${name})` }
            );
            Promise.resolve(run.animation.finished).then(() => { run.animationDone = true; }, () => stop(true));
            // Some older engines ignore an unknown pseudoElement option. Never
            // leave an accidental clip-path animation on the actual page root.
            if (run.animation.effect?.pseudoElement !== `::view-transition-new(${name})`) {
              stop(true);
              return;
            }
          } catch (_) { stop(true); }
        }, () => stop(true));
        Promise.resolve(run.transition.finished).then(() => {
          if (!run.ended) { commit(); finish(run.animationDone); }
        }, () => stop(true));
      } catch (_) { stop(true); }
      return done;
    }

    function motionChanged() {
      if (!reduced.matches) return;
      clearTip();
      current?.stop(true);
    }
    reduced.addEventListener?.('change', motionChanged);
    return {
      toggle,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        current?.stop(false);
        clearTip();
        reduced.removeEventListener?.('change', motionChanged);
      }
    };
  }
  window.MIT_WOODLAND_LANTERN = { create };
})();
