/* One predecoded sprite surface per bear; complete poses never fade to empty. */
(() => {
  'use strict';
  const requestFrame = window.MIT_MOTION?.request || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
  const cancelFrame = window.MIT_MOTION?.cancel || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);
  const node = (tag, className) => { const el = document.createElement(tag); el.className = className; return el; };
  const folder = 'assets/images/bear-animation/';
  const waiting = new Set();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Fetch enhancement artwork near its edited position, rather than downloading
  // every offscreen bear's background and sheet during the hero's first paint.
  const nearby = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const load = loaders.get(entry.target);
      if (load && !reduced.matches) { nearby.unobserve(entry.target); waiting.delete(entry.target); void load(); }
    }
  }, { rootMargin: '300px' }) : null;
  const loaders = new WeakMap();
  reduced.addEventListener('change', () => {
    if (!reduced.matches) waiting.forEach(station => { if (nearby) nearby.observe(station); else void loaders.get(station)?.(); });
  });
  const definitions = [
    { kind: 'hammer', original: 'assets/images/exco-world/stations/station-01.webp', width: 600, height: 600,
      background: 'assets/images/exco-world/stations/hammer-animation/background-v3.webp', sheet: 'assets/images/exco-world/stations/hammer-animation/complete-poses-v3.webp',
      cell: 627, placement: [13, 264, .505], registration: [[0, 0], [11.5, -8], [0, 23], [8.5, 22]], duration: 2.6, phase: 0 },
    { kind: 'sewing', original: 'assets/images/exco-world/stations/station-02.webp', width: 600, height: 600,
      background: folder + 'sewing/background-v1.webp', sheet: folder + 'sewing/poses-v1.webp',
      cell: 627, placement: [88, 211.1, .49], registration: [[0, 0], [76.35, 0], [-22.67, 38], [82.62, 36]], duration: 4.8, phase: -1.1 },
    { kind: 'printer', original: 'assets/images/exco-world/stations/station-03.webp', width: 600, height: 600,
      background: folder + 'printer/background-v1.webp', sheet: folder + 'printer/poses-v1.webp',
      cell: 627, placement: [51, 154.8, .59], registration: [[0, 0], [57.27, -1], [-3.35, 32], [37.77, 31]], duration: 5.3, phase: -2.5 },
    { kind: 'hero', original: 'assets/images/atelier-v6/workshop.webp', width: 1374, height: 1145,
      background: folder + 'hero/background-v1.webp', sheet: folder + 'hero/poses-v1.webp', foreground: true,
      cell: 627, placement: [350, 150, 1.1], registration: [[0, 0], [30.89, 0], [5.71, 15], [24.59, 15]], duration: 5.8, phase: -.8 }
  ];
  function create(scene = 0, fallbackImage = null) {
    const originalConfig = definitions[scene];
    if (!originalConfig) throw new RangeError('Unknown bear scene');
    // Keep the 627px logical cells and all authored registration. Smaller phone
    // textures use the same 2×2 grid, so no canvas placement changes on load.
    const compact = window.innerWidth <= 640 || window.navigator?.connection?.saveData;
    const config = { ...originalConfig };
    if (config.kind === 'hammer' && compact) {
      config.background = config.background.replace('background-v3', 'background-mobile-v4');
      config.sheet = config.sheet.replace('complete-poses-v3', 'complete-poses-mobile-v4');
    } else if (config.kind !== 'hammer') {
      if (compact) config.background = config.background.replace('background-v1', 'background-mobile-v2');
      config.sheet = config.sheet.replace('poses-v1', compact ? 'poses-mobile-v2' : 'poses-delivery-v2');
    }
    const hero = config.kind === 'hero';
    if (window.MIT_IMAGES) {
      config.background = window.MIT_IMAGES.delivery(config.background);
      config.sheet = window.MIT_IMAGES.delivery(config.sheet);
    }
    const station = node('span', hero ? 'hero-workshop-art hero-bear-station' : 'exco-station-art exco-hammer-station');
    station.dataset.bear = config.kind;
    station.style.setProperty('--hammer-duration', config.duration + 's');
    station.style.setProperty('--bear-phase', config.phase + 's');
    if (hero) {
      station.setAttribute('role', 'img');
      station.setAttribute('aria-label', 'The MIT bear waves from its birdhouse workbench.');
    } else station.setAttribute('aria-hidden', 'true');
    const fallback = fallbackImage || node('img', 'exco-hammer-fallback');
    fallback.className = 'exco-hammer-fallback';
    fallback.alt = ''; fallback.width = config.width; fallback.height = config.height;
    fallback.decoding = 'async';
    if (hero) fallback.fetchPriority = 'high';
    else fallback.loading = 'lazy';
    if (!fallbackImage) {
      if (window.MIT_IMAGES) window.MIT_IMAGES.set(fallback, config.original);
      else fallback.src = config.original;
    }
    const player = node('span', 'exco-hammer-player');
    // A single background moves between cells of the SAME decoded sheet.
    // Position and registration change in one CSS keyframe. No four opacity
    // tracks, additive blend buffers, image replacement or transparent handoff.
    const { background, sheet, cell, registration } = config;
    const [left, top, scale] = config.placement;
    const sprite = node('span', 'exco-hammer-frame exco-hammer-sprite');
    Object.assign(sprite.style, {
      left: left / config.width * 100 + '%', top: top / config.height * 100 + '%',
      width: cell * scale / config.width * 100 + '%', height: cell * scale / config.height * 100 + '%'
    });
    registration.forEach(([x, y], index) => {
      sprite.style.setProperty('--pose-' + index + '-x', x / cell * 100 + '%');
      sprite.style.setProperty('--pose-' + index + '-y', y / cell * 100 + '%');
    });
    const sources = [background, sheet].map(src => {
      const image = node('img', 'exco-hammer-source');
      image.alt = ''; image.width = cell * 2; image.height = cell * 2;
      image.decoding = 'async'; image.fetchPriority = 'low';
      image.dataset.src = src;
      return image;
    });
    sources[0].classList.add('bear-fixed-scenery');
    if (config.foreground) player.append(sprite, sources[0]);
    else player.append(sources[0], sprite);
    station.append(fallback, player, sources[1]);
    let started = false;
    function load() {
      if (started) return;
      started = true;
      let decoded = 0, failed = false;
      sources.forEach(image => {
        let done = false;
        const ready = async () => {
          if (done || failed || !image.naturalWidth) return;
          done = true;
          try {
            if (typeof image.decode === 'function') await image.decode();
            if (failed) return;
            decoded++;
            if (decoded === sources.length) {
              sprite.style.backgroundImage = 'url("' + sheet + '")';
              requestFrame(() => { if (!failed && station.isConnected) station.classList.add('is-hammer-ready'); });
            }
          } catch { failed = true; }
        };
        image.addEventListener('load', ready);
        image.addEventListener('error', () => { failed = true; });
        image.src = image.dataset.src;
        if (image.complete && image.naturalWidth) void ready();
      });
    }
    loaders.set(station, load); waiting.add(station);
    if (nearby) nearby.observe(station);
    else if (!reduced.matches) { waiting.delete(station); void load(); }
    return station;
  }

  window.MIT_HAMMER_BEAR = { create, createHero: image => create(3, image) };
})();
