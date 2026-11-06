/* A forest resident: flight uses the saved forest's coordinates, not the screen. */
(() => {
  'use strict';
  const requestFrame = window.MIT_MOTION?.request || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
  const cancelFrame = window.MIT_MOTION?.cancel || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);
  if (!document.querySelector('main')) return;
  Promise.resolve(window.MIT_CREW_READY).then(() => {
    const forest = document.querySelector('.exco-landscape');
    if (!forest || forest.querySelector('.butterfly-layer') || !window.MIT_BUTTERFLY_ART) return;
    const layer = document.createElement('div');
    layer.className = 'butterfly-layer';
    layer.setAttribute('aria-hidden', 'true'); layer.hidden = true;
    const butterfly = document.createElement('span');
    butterfly.className = 'site-butterfly';
    const blue = document.createElement('span');
    blue.className = 'site-butterfly site-butterfly-blue'; blue.hidden = true;
    layer.append(butterfly, blue); forest.append(layer);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const compact = window.innerWidth <= 640 || window.navigator?.connection?.saveData;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    let frame = 0, last = null, phase = 0, ready = false, failed = false;
    let windowActive = true, suspended = false, inView = false;
    let width = 390, height = 2250, heading = 65, blueHeading = 145;
    const sequence = [0, 1, 2, 3, 2, 4, 5, 0];
    function point(kind = 'gold') {
      // Gold sweeps in broad vertical arcs; blue traces smaller crossing loops.
      // Each has its own curve, rather than following a delayed copy of a route.
      const flight = phase * (kind === 'blue' ? .36 : .45);
      const pad = Math.min(36, width / 4, height / 4);
      const top = Math.min(100, height / 4);
      const bottom = Math.max(top, height - Math.min(120, height / 4));
      let x, y, dx, dy;
      if (kind === 'blue') {
        x = width * (.47 + .22 * Math.cos(flight * .34 + 1.1) + .09 * Math.sin(flight * .19 - .6));
        y = height * (.47 + .27 * Math.sin(flight * .095 - .45) + .045 * Math.sin(flight * .32 + 1.4));
        dx = width * (-.0748 * Math.sin(flight * .34 + 1.1) + .0171 * Math.cos(flight * .19 - .6));
        dy = height * (.02565 * Math.cos(flight * .095 - .45) + .0144 * Math.cos(flight * .32 + 1.4));
      } else {
        x = width * (.52 + .25 * Math.sin(flight * .28 + .45) + .06 * Math.sin(flight * .61 + 1.6));
        y = height * (.45 + .29 * Math.sin(flight * .12 - 1.2)) + 24 * Math.sin(flight * .55);
        dx = width * (.07 * Math.cos(flight * .28 + .45) + .0366 * Math.cos(flight * .61 + 1.6));
        dy = height * .0348 * Math.cos(flight * .12 - 1.2) + 13.2 * Math.cos(flight * .55);
      }
      // Turn along the broad flight arc, not the fast wingbeat or body bob.
      const bob = kind === 'blue' ? Math.sin(phase * 4.3 + 1.7) * 1.1 : Math.sin(phase * 5) * 1.3;
      return { x: clamp(x, pad, width - pad), y: clamp(y, top, bottom) + bob, angle: Math.atan2(dy, dx) * 180 / Math.PI + 90 };
    }
    function paint(dt = 0) {
      const next = point();
      if (dt > 0) {
        const difference = ((next.angle - heading + 540) % 360) - 180;
        heading += difference * (1 - Math.exp(-dt * 2.1));
      }
      butterfly.style.transform = `translate3d(${next.x.toFixed(2)}px,${next.y.toFixed(2)}px,0) translate(-50%,-50%) rotate(${heading.toFixed(2)}deg)`;
      art.setPose(reduced.matches ? 0 : sequence[Math.floor(phase / .075) % sequence.length]);
      const second = point('blue');
      if (dt > 0) {
        const difference = ((second.angle - blueHeading + 540) % 360) - 180;
        blueHeading += difference * (1 - Math.exp(-dt * 2.1));
      }
      blue.style.transform = `translate3d(${second.x.toFixed(2)}px,${second.y.toFixed(2)}px,0) translate(-50%,-50%) rotate(${blueHeading.toFixed(2)}deg)`;
      blueArt.setPose(reduced.matches ? 0 : sequence[Math.floor((phase + .19) / .075) % sequence.length]);
    }
    function tick(time) {
      frame = 0;
      // Small paper wings need 30 paint updates per second on a phone, rather
      // than 60â€“120 SVG mutations. Elapsed time keeps their flight speed intact.
      if (compact && last !== null && time - last < 32) { frame = requestFrame(tick, compact ? 32 : 0); return; }
      const dt = last === null ? 0 : clamp((time - last) / 1000, 0, .05);
      last = time; phase += dt;
      paint(dt); frame = requestFrame(tick, compact ? 32 : 0);
    }
    function sync() {
      const dialogOpen = !!document.querySelector('dialog[open]');
      layer.hidden = !ready || failed || document.hidden || suspended || dialogOpen;
      const active = !layer.hidden && inView && windowActive && !reduced.matches;
      layer.dataset.motion = active ? 'running' : 'paused';
      if (!active) {
        if (frame) { cancelFrame(frame); frame = 0; }
        last = null;
      } else if (!frame) { last = null; frame = requestFrame(tick); }
      paint();
    }
    function resize() {
      // clientWidth/offsetHeight ignore the composition's responsive scale.
      // The visitor scales with the authored forest, preserving its location.
      width = forest.clientWidth || 390;
      height = forest.offsetHeight || 2250;
      paint();
    }
    const art = window.MIT_BUTTERFLY_ART.create({
      defer: true,
      onReady: () => { ready = true; sync(); },
      onError: () => { failed = true; sync(); }
    });
    butterfly.append(art.element);
    // Reuse the decoded illustrated poses, retaining their clean alpha edges.
    // A presentation tint supplies the second palette without changing frames.
    const blueArt = window.MIT_BUTTERFLY_ART.create({
      defer: true,
      onReady: () => { blue.hidden = false; },
      onError: () => { blue.hidden = true; }
    });
    blue.append(blueArt.element);
    if ('IntersectionObserver' in window) {
      const visibility = new IntersectionObserver(entries => {
        inView = entries.some(entry => entry.isIntersecting);
        if (inView) { art.load(); blueArt.load(); }
        sync();
      }, { rootMargin: '100px' });
      visibility.observe(forest);
    } else { inView = true; art.load(); blueArt.load(); }
    if ('ResizeObserver' in window) new window.ResizeObserver(resize).observe(forest);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('blur', () => { windowActive = false; sync(); });
    window.addEventListener('focus', () => { windowActive = true; sync(); });
    window.addEventListener('pagehide', () => { suspended = true; sync(); });
    window.addEventListener('pageshow', () => { suspended = false; sync(); });
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    const dialogs = new MutationObserver(sync);
    // Footprints and gallery thumbnails are inserted during scrolling. Their
    // child mutations must not query/paint both butterflies a second time.
    dialogs.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
    resize(); sync();
  });
})();
