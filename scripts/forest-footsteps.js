/* Scroll lays alternating impressions along the actual saved paper trail. */
(() => {
  'use strict';
  const requestFrame = window.MIT_MOTION?.request || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
  const cancelFrame = window.MIT_MOTION?.cancel || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);
  if (!document.querySelector('main')) return;
  Promise.resolve(window.MIT_CREW_READY).then(() => {
    const forest = document.querySelector('.exco-landscape');
    const path = forest?.querySelector('.exco-path-plane');
    const config = window.MIT_FOREST_FOOTSTEP_ROUTE;
    if (!path || !config || path.hidden || forest.querySelector('.forest-footsteps')) return;
    if (getComputedStyle(path).display === 'none') return;
    if (new URL(path.dataset.sceneSrc || path.src, document.baseURI).pathname !== new URL(config.source, document.baseURI).pathname) return;
    const layer = document.createElement('div');
    layer.className = 'forest-footsteps'; layer.setAttribute('aria-hidden', 'true');
    path.insertAdjacentElement('afterend', layer);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const LIFE = 3200, LIMIT = 10, SPAN = 210, FADE = 240;
    layer.style.setProperty('--footprint-life', LIFE + 'ms');
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const variation = seed => { const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return value - Math.floor(value); };
    const sole = 'M4.5 1.2C2.1 1.2 1 3.3 1.3 6.4L2.2 10.7C2.7 12.1 2.4 13.4 3.1 14.5C4.2 15.4 8.8 15.5 10 14.2C10.6 12.8 9.9 11.5 10.3 9.8C11.2 6.7 10.5 3.5 8.8 2.1C7.7 1.2 6.2 1 4.5 1.2ZM3.5 17.2L8.5 17.2C9.6 17.4 10 19 9.5 21.4C9 23.3 3.3 23.5 2.7 21.3C2.2 19.2 2.5 17.6 3.5 17.2Z';
    // The same sole leaves three impressions with different worn tread gaps.
    const tread = [
      'M3 6.8L8.6 6.4L8.7 7.4L3.2 7.8ZM4 19L8.1 18.8L8 19.7L4 19.8Z',
      'M2.8 4.4L5 4.2L5 5.2L3 5.4ZM6.7 8.9L9 8.5L8.8 9.7L6.8 10ZM3.8 20.4L6 20.3L6 21.4L4 21.3Z',
      'M4.2 3.1L7.3 3L7.4 3.8L4.1 4ZM3.2 10.8L7 10.3L7.1 11.3L3.4 11.8ZM7.1 18.5L8.3 18.4L8.4 21L7.3 21.2Z'
    ];
    let route = [], total = 0, prints = [], scrollFrame = 0, expiryTimer = 0, expiryAt = 0;
    let pathTop = 0, pathHeight = 1, pathLogicalHeight = 2185;
    let cursor = null, previousScroll = window.scrollY, direction = 0, side = -1, step = 0, stride = 27;
    function clear() {
      prints.forEach(print => print.element.remove()); prints = [];
      if (scrollFrame) cancelFrame(scrollFrame); scrollFrame = 0;
      if (expiryTimer) window.clearTimeout(expiryTimer); expiryTimer = expiryAt = 0;
      cursor = null; direction = 0; previousScroll = window.scrollY;
    }
    function resize() {
      clear();
      const css = getComputedStyle(path);
      for (const key of ['left', 'top', 'width', 'height', 'transform', 'transformOrigin', 'maskImage', 'maskSize', 'maskRepeat']) {
        if (css[key]) layer.style[key] = css[key];
      }
      const width = path.offsetWidth || path.clientWidth || 490;
      const height = path.offsetHeight || 2185;
      // This path is deliberately fixed. Cache its document-space geometry on
      // resize; scrolling then performs arithmetic, not forced layout reads.
      const bounds = path.getBoundingClientRect();
      pathTop = bounds.top + window.scrollY;
      pathHeight = bounds.height || height;
      pathLogicalHeight = height;
      total = 0;
      route = config.points.map(([x, y], index) => {
        const point = { x: x * width / config.width, y: y * height / config.height, distance: 0 };
        if (index) {
          const [px, py] = config.points[index - 1];
          total += Math.hypot(point.x - px * width / config.width, point.y - py * height / config.height);
        }
        point.distance = total; return point;
      });
      cursor = focusDistance();
    }
    function focusDistance(allowOutside = false) {
      const fraction = (window.innerHeight * .62 - pathTop + window.scrollY) / pathHeight;
      if (fraction < 0 || fraction > 1) {
        if (!allowOutside) return null;
        return fraction < 0 ? fraction * pathLogicalHeight : total + (fraction - 1) * pathLogicalHeight;
      }
      const index = clamp(fraction * (route.length - 1), 0, route.length - 1);
      const low = Math.floor(index), high = Math.min(low + 1, route.length - 1);
      return route[low].distance + (route[high].distance - route[low].distance) * (index - low);
    }
    function pointAt(distance) {
      let low = 0, high = route.length - 1;
      while (high - low > 1) {
        const middle = (low + high) >> 1;
        if (route[middle].distance < distance) low = middle; else high = middle;
      }
      const a = route[low], b = route[high], fraction = (distance - a.distance) / (b.distance - a.distance || 1);
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
      return { x: a.x + dx * fraction, y: a.y + dy * fraction, dx: dx / length, dy: dy / length };
    }
    function distanceFade(distance, target) {
      const progress = clamp((Math.abs(distance - target) - 35) / (SPAN - 35), 0, 1);
      return 1 - progress * progress * (3 - 2 * progress);
    }
    function dim(print, fade) {
      // Old impressions only get lighter; reversing never makes them flash back.
      if (fade > print.fade) return;
      if (fade < print.fade) {
        print.fade = fade;
        print.element.style.setProperty('--footprint-distance', fade.toFixed(4));
      }
      if (fade === 0 && print.retireAt === null) {
        print.retireAt = performance.now() + FADE;
        print.element.dataset.retiring = 'true';
        scheduleExpiry();
      }
    }
    function stamp(distance, facing, target) {
      const point = pointAt(distance), dx = point.dx * facing, dy = point.dy * facing;
      side *= -1;
      const index = step++, impression = index % tread.length;
      // Lanes use the unflipped path normal. Facing only turns the shoes, so
      // reversing cannot cancel the separation between the two walking routes.
      const lane = facing === 1 ? 9 + Math.sin(distance / 145 + .7) * 1.4 : -9 + Math.sin(distance / 185 + 2.3) * 1.4;
      const stance = 3.1 + variation(index + 3) * 1.1;
      const offset = lane + side * stance * facing + (variation(index + 7) - .5) * 1.2;
      const x = point.x - point.dy * offset, y = point.y + point.dx * offset;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90 + side * 2 + (variation(index + 11) - .5) * 8;
      const print = document.createElement('span'); print.className = 'forest-footprint';
      print.dataset.side = side === 1 ? 'left' : 'right'; print.dataset.direction = facing === 1 ? 'down' : 'up';
      print.style.width = (10.9 + variation(index + 13) * 1.5).toFixed(2) + 'px';
      print.style.height = (21.7 + variation(index + 17) * 2.7).toFixed(2) + 'px';
      print.style.setProperty('--footprint-strength', (.35 + variation(index + 19) * .13).toFixed(3));
      const fade = distanceFade(distance, target);
      print.style.setProperty('--footprint-distance', fade.toFixed(4));
      print.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) translate(-50%,-50%) rotate(${angle.toFixed(2)}deg)`;
      print.innerHTML = '<svg viewBox="0 0 12 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="' + sole + tread[impression] + '"/></svg>';
      const mark = { element: print, born: performance.now(), distance, fade, retireAt: null };
      layer.append(print); prints.push(mark); dim(mark, fade);
      // Keep the short active cluster, allowing retired marks to finish fading.
      const active = prints.filter(mark => mark.retireAt === null);
      while (active.length > LIMIT) dim(active.shift(), 0);
      stride = 24 + variation(index + 23) * 7;
      scheduleExpiry();
    }
    function scheduleExpiry() {
      if (!prints.length) return;
      const next = Math.min(...prints.map(print => Math.min(print.born + LIFE, print.retireAt ?? Infinity)));
      if (expiryTimer && expiryAt <= next) return;
      if (expiryTimer) window.clearTimeout(expiryTimer);
      expiryAt = next;
      expiryTimer = window.setTimeout(expire, Math.max(1, next - performance.now()));
    }
    function expire() {
      expiryTimer = expiryAt = 0;
      const time = performance.now();
      prints = prints.filter(print => {
        if (time - print.born >= LIFE || (print.retireAt !== null && time >= print.retireAt)) { print.element.remove(); return false; }
        return true;
      });
      scheduleExpiry();
    }
    function scroll() {
      scrollFrame = 0;
      const delta = window.scrollY - previousScroll; previousScroll = window.scrollY;
      const target = focusDistance();
      const fadeTarget = focusDistance(true);
      prints.forEach(print => dim(print, distanceFade(print.distance, fadeTarget)));
      if (reduced.matches || document.hidden || document.querySelector('dialog[open]') || target === null) {
        cursor = target; direction = 0; return;
      }
      if (Math.abs(delta) < .5) return;
      const nextDirection = delta > 0 ? 1 : -1;
      if (cursor === null) cursor = target;
      // Fast scrolling still leaves only a short local cluster behind the walker.
      if (Math.abs(target - cursor) > SPAN) cursor = target - nextDirection * SPAN;
      if (direction !== nextDirection) { direction = nextDirection; stamp(cursor, direction, target); }
      while ((target - cursor) * direction >= stride) {
        cursor += stride * direction;
        stamp(clamp(cursor, 0, total), direction, target);
      }
    }
    window.addEventListener('scroll', () => {
      if (!prints.length && focusDistance() === null) {
        cursor = null; direction = 0; previousScroll = window.scrollY; return;
      }
      if (!scrollFrame) scrollFrame = requestFrame(scroll);
    }, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pagehide', clear);
    window.addEventListener('pageshow', resize);
    document.addEventListener('visibilitychange', clear);
    reduced.addEventListener('change', () => { clear(); layer.hidden = reduced.matches; });
    if ('ResizeObserver' in window) new window.ResizeObserver(resize).observe(path);
    document.fonts?.ready.then(resize);
    resize(); layer.hidden = reduced.matches;
  });
})();
