/* The finished woodland is authored at 390px. Resize the complete canvas,
   never its individual anchors, breakpoints or paper layers. */
(() => {
  'use strict';
  const setImage = (image, source) => window.MIT_IMAGES ? window.MIT_IMAGES.set(image, source) : (image.src = source);
  const WIDTH = 390;
  const lightStages = new WeakMap();
  const lightValues = new WeakMap();
  const motionProperties = ['--exco-pointer-x', '--exco-pointer-y', '--exco-scroll'];
  function syncLights(world) {
    const lightStage = lightStages.get(world);
    if (!lightStage) return;
    const previous = lightValues.get(lightStage) || {};
    for (const key of motionProperties) {
      const value = world.style.getPropertyValue(key) || '0px';
      if (previous[key] !== value) { lightStage.style.setProperty(key, value); previous[key] = value; }
    }
    const paused = world.classList.contains('is-motion-paused');
    if (previous.paused !== paused) { lightStage.classList.toggle('is-motion-paused', paused); previous.paused = paused; }
    lightValues.set(lightStage, previous);
  }
  function containLights(host, lamps) {
    const landscape = host.querySelector('.exco-landscape');
    const boundary = document.createElement('div');
    boundary.className = 'forest-light-boundary';
    boundary.setAttribute('aria-hidden', 'true');
    const terrain = host.querySelector('.exco-terrain');
    if (terrain.style.transform) boundary.style.transform = terrain.style.transform;
    const landscapeBounds = landscape.getBoundingClientRect();
    const scale = landscapeBounds.width / Number.parseFloat(getComputedStyle(landscape).width);
    const groups = new Map(), copies = new Map();
    for (const source of lamps) {
      const world = source.closest('.exco-world-stage') || landscape;
      if (!groups.has(world)) {
        const group = document.createElement('div');
        group.className = 'forest-light-stage';
        const bounds = world.getBoundingClientRect(), css = getComputedStyle(world);
        group.style.cssText = `left:50px;top:${world === landscape ? 0 : (bounds.top - landscapeBounds.top) / scale}px;width:${css.width};height:${css.height}`;
        groups.set(world, group); lightStages.set(world, group); boundary.append(group);
        syncLights(world);
      }
      // Only project illumination into the ground mask. The original art,
      // unique instance ID, saved placement and sprite animation stay intact.
      const light = document.createElement('span'), css = getComputedStyle(source);
      light.className = 'forest-light-fixture forest-depth forest-ambient';
      light.dataset.lightSource = source.dataset.forestId;
      light.setAttribute('style', source.getAttribute('style') || '');
      Object.assign(light.style, { position: 'absolute', left: css.left, top: css.top, width: css.width, height: css.height, display: css.display, zIndex: '0' });
      for (const part of source.querySelectorAll('.exco-lamp-halo,.exco-lamp-pool')) light.append(part.cloneNode(true));
      groups.get(world).append(light); copies.set(source, light);
      source.classList.add('forest-light-source');
    }
    landscape.append(boundary);
    return { copies, destroy() {
      groups.forEach((group, world) => lightStages.delete(world));
      copies.forEach((light, source) => source.classList.remove('forest-light-source'));
      boundary.remove();
    } };
  }
  // Stable instance seeds give duplicates their own rhythm. A masked birch and
  // its canopy are one physical tree, so that pair deliberately shares a seed.
  function motionSeed(id) {
    let value = 5381;
    for (const letter of id.replace('front-birch', 'grove')) value = ((value * 33) ^ letter.charCodeAt(0)) >>> 0;
    // Mix adjacent IDs too: tree-0 and tree-1 must not share almost one phase.
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
  }
  const backgrounds = {
    'paper-light': { src: 'assets/images/woodland-v10/floor-material-light.webp', tile: true },
    'paper-fine': { src: 'assets/images/woodland-v10/floor-material-fine.webp', tile: true },
    'paper-olive': { src: 'assets/images/woodland-v10/floor-material.webp', tile: true },
    detailed: { src: 'assets/images/woodland-v9/ground-detailed.webp' },
    original: { src: 'assets/images/exco-world/woodland/woodland-floor.webp' },
    plain: { color: '#c8cdae' }
  };

  function lock(host) {
    if (host.parentElement?.classList.contains('forest-composition')) return;
    const frame = document.createElement('div');
    frame.className = 'forest-canvas-frame';
    const composition = document.createElement('div');
    composition.className = 'forest-composition';
    const section = host.closest('#people');
    const topline = section.querySelector('.section-topline');
    const heading = section.querySelector('.section-heading');
    section.insertBefore(frame, topline);
    composition.append(topline, heading, host);
    frame.append(composition);
    host.classList.add('forest-canvas-locked');
    host.dataset.designWidth = String(WIDTH);
    const resize = () => {
      const scale = frame.clientWidth / WIDTH;
      const transform = `scale(${scale})`, height = composition.offsetHeight * scale + 'px';
      const changed = composition.style.transform !== transform || frame.style.height !== height;
      if (composition.style.transform !== transform) composition.style.transform = transform;
      if (frame.style.height !== height) frame.style.height = height;
      if (changed) window.MIT_FOREST_LABELS?.refresh();
    };
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      if (!window.MIT_MOTION) return resize();
      if (!resizeFrame) resizeFrame = window.MIT_MOTION.request(() => { resizeFrame = 0; resize(); });
    });
    observer.observe(frame); observer.observe(composition);
    resize();
  }

  function apply(host, layout) {
    const items = new Map();
    const register = (el, id, kind) => {
      if (!el || items.has(id)) throw new Error('Unresolved woodland asset: ' + id);
      el.dataset.forestId = id;
      items.set(id, { el, kind, original: el.getAttribute('style') });
    };
    register(host.querySelector('.exco-terrain'), 'ground', 'ground');
    register(host.querySelector('.exco-path-plane'), 'path', 'path');
    register(host.querySelector('.exco-creek-plane'), 'creek', 'creek');
    host.querySelectorAll('.exco-ground-detail').forEach((el, i) => register(el, 'floor-' + i, 'plant'));
    host.querySelectorAll('.exco-world-stage').forEach((stage, scene) => {
      const prefix = 's' + scene + '-';
      stage.querySelectorAll('.exco-back-grove').forEach(el => register(el, prefix + (el.classList.contains('exco-front-birch') ? 'front-birch' : 'grove'), 'tree'));
      for (const [selector, id, kind] of [['.exco-station-art', 'station', 'station'], ['.exco-edge-tree', 'edge-tree', 'tree'], ['.exco-shared-bench', 'bench', 'bench'], ['.exco-near-plants', 'fern', 'plant']]) {
        const el = stage.querySelector(selector); if (el) register(el, prefix + id, kind);
      }
      stage.querySelectorAll('.exco-tree').forEach((el, i) => register(el, prefix + 'tree-' + i, 'tree'));
      stage.querySelectorAll('.exco-scene-lamp').forEach((el, i) => register(el, prefix + 'lamp-' + i, 'lamp'));
      stage.querySelectorAll('.exco-person-place').forEach(el => {
        // Legacy combined placement remains an anchor, so saved compositions
        // keep their exact geometry. New adjustments target its two children.
        register(el, 'person-' + el.dataset.person, 'person');
        register(el.querySelector('.exco-person-character'), 'character-' + el.dataset.person, 'character');
        register(el.querySelector('.exco-person-label'), 'label-' + el.dataset.person, 'label');
      });
    });
    for (const duplicate of layout.duplicates) {
      const source = items.get(duplicate.source);
      const template = (window.MIT_FOREST_ASSET_LIBRARY || []).find(item => item.id === duplicate.source);
      if ((!source && !template) || items.has(duplicate.id)) throw new Error('Unresolved woodland copy: ' + duplicate.id);
      let element;
      if (template) {
        element = document.createElement('span'); element.className = 'editor-added-asset';
        element.style.width = template.width + '%'; element.style.aspectRatio = template.width + ' / ' + template.height;
        if (template.kind === 'lamp') {
          element.classList.add('exco-scene-lamp');
          for (const name of ['exco-lamp-halo', 'exco-lamp-pool']) {
            const part = document.createElement('span'); part.className = name; element.append(part);
          }
        }
        const image = document.createElement('img'); setImage(image, template.src); image.alt = ''; image.draggable = false; image.loading = 'lazy';
        if (template.kind === 'lamp') image.className = 'exco-lamp-art';
        element.append(image); host.querySelector('.exco-landscape').append(element);
      } else {
        element = source.el.cloneNode(true);
        if (source.original === null) element.removeAttribute('style');
        else element.setAttribute('style', source.original);
        source.el.parentNode.append(element);
      }
      register(element, duplicate.id, source?.kind || template.kind || (template.group === 'Trees' ? 'tree' : 'plant'));
    }
    const setSource = (id, choice) => {
      const option = (window.MIT_FOREST_PATH_OPTIONS || []).find(item => item.id === choice);
      const element = items.get(id).el;
      element.hidden = !option || option.kind === 'none';
      if (element.hidden) return;
      setImage(element, option.src); element.width = option.width; element.height = option.height;
      element.style.maskImage = option.includesScenery || option.includesGround ? 'none' : '';
    };
    setSource('path', layout.path); setSource('creek', layout.creek);
    const floor = backgrounds[layout.background];
    if (!floor) throw new Error('Unresolved woodland ground: ' + layout.background);
    const terrain = items.get('ground').el;
    terrain.style.background = floor.color || '';
    terrain.querySelectorAll('img').forEach((image, i) => {
      image.hidden = !floor.src || (!floor.tile && i > 0);
      if (floor.src) setImage(image, floor.src);
      image.style.height = floor.tile ? 'auto' : '100%';
      image.style.objectFit = floor.tile ? '' : 'fill';
    });
    for (const [id, state] of Object.entries(layout.assets)) {
      const item = items.get(id);
      if (!item) throw new Error('Unresolved woodland placement: ' + id);
      const { el, kind } = item;
      const base = getComputedStyle(el).transform;
      if (state.x || state.y || (state.scale !== undefined && state.scale !== 1)) {
        el.style.transformOrigin = '50% 100%';
        el.style.transform = `translate(${(state.x || 0) * WIDTH / 100}px, ${(state.y || 0) * WIDTH / 100}px) ${base === 'none' ? '' : base} scale(${state.scale ?? 1})`;
        if (kind === 'person' || kind === 'character') el.style.zIndex = state.z ?? 4;
      }
      if (state.z !== undefined) el.style.zIndex = state.z;
      if (state.hidden) el.style.display = 'none';
      if (kind === 'lamp') {
        if (state.glow !== undefined) el.style.setProperty('--lamp-glow', state.glow);
        if (state.glowSize !== undefined) el.style.setProperty('--lamp-glow-size', state.glowSize);
      }
    }
    // Preserve the authored placement in transform. Independent translation
    // supplies depth to every scenery instance, including unmodified copies.
    // The authored floor, trail, people and label anchors remain grounded.
    const animated = [];
    for (const [id, { el, kind }] of items) {
      if (!['tree', 'plant', 'lamp', 'station', 'bench'].includes(kind)) continue;
      const layer = Number.parseInt(getComputedStyle(el).zIndex, 10) || 0;
      const seed = motionSeed(id), fraction = (seed % 997) / 997;
      const variation = .88 + (seed % 23) / 100;
      const plane = Math.max(0, Math.min(1, (layer + 2) / 14));
      let depth, idleX, idleY, duration;
      if (el.classList.contains('exco-back-grove')) {
        // The masked birch trunk and its canopy belong to one physical tree.
        depth = [-.32 * variation, -.22 * variation, -.08 * variation];
        idleX = .45 + fraction * .65; idleY = .2; duration = 9 + fraction * 3;
      } else if (kind === 'plant') {
        depth = [-(.16 + plane * .46) * variation, -(.10 + plane * .32) * variation, -(.045 + plane * .10) * variation];
        idleX = .7 + fraction * .65; idleY = .35 + fraction * .45; duration = 5.6 + fraction * 2.8;
      } else if (kind === 'station') {
        // These paper scenes contain the workshop bears. Their quiet bob keeps
        // the bear artwork alive without swinging the treehouse or workbench.
        depth = [-.11 * variation, -.065 * variation, -.04 * variation];
        idleX = 0; idleY = 1.3 + fraction * .7; duration = 4.4 + fraction * 1.5;
      } else if (kind === 'bench') {
        depth = [-.07 * variation, -.04 * variation, -.025 * variation];
        idleX = .15; idleY = .2; duration = 8 + fraction * 3;
      } else if (kind === 'lamp') {
        depth = [-(.15 + plane * .24) * variation, -(.10 + plane * .15) * variation, -(.04 + plane * .06) * variation];
        idleX = .25 + fraction * .35; idleY = .25 + fraction * .3; duration = 4 + fraction * 2;
      } else {
        depth = [-(.20 + plane * .38) * variation, -(.12 + plane * .22) * variation, -(.05 + plane * .08) * variation];
        idleX = .45 + fraction * .75; idleY = .2 + fraction * .25; duration = 8 + fraction * 4;
      }
      if (!el.style.transform) el.style.transform = getComputedStyle(el).transform;
      el.style.setProperty('--forest-depth-x', depth[0]);
      el.style.setProperty('--forest-depth-y', depth[1]);
      // More scroll response in every depth plane, within the same 8px guard.
      el.style.setProperty('--forest-depth-scroll', depth[2] * 1.7);
      el.style.setProperty('--forest-idle-x', (idleX * .55).toFixed(2) + 'px');
      el.style.setProperty('--forest-idle-y', (idleY * .55).toFixed(2) + 'px');
      el.style.setProperty('--forest-idle-duration', duration.toFixed(2) + 's');
      el.style.setProperty('--forest-idle-delay', (-fraction * duration).toFixed(2) + 's');
      el.classList.add('forest-depth', 'forest-ambient');
      // Rotate leafy artwork about its roots, independently of the placement
      // and bounded depth translation. Logs, stones and trees stay rigid.
      const art = el.tagName === 'IMG' ? el : el.querySelector('img');
      if (kind === 'plant' && art && /(?:foreground-fern|fern-paper|grass-meadow|fern-patch)\.webp/.test(art.dataset.sceneSrc || art.src)) {
        el.classList.add('forest-leaf-breeze');
        el.style.setProperty('--leaf-breeze-angle', (.28 + fraction * .4).toFixed(2) + 'deg');
        el.style.setProperty('--leaf-breeze-duration', (9 + fraction * 5).toFixed(2) + 's');
        el.style.setProperty('--leaf-breeze-delay', (-fraction * 11).toFixed(2) + 's');
      }
      if (kind === 'station') el.classList.add('forest-bear-bob');
      animated.push(el);
    }
    host.dataset.layoutRevision = window.MIT_FOREST_BAKED.revision;
    host.classList.add('forest-layout-baked');
    // Preserve the original attached lighting everywhere else. Only this saved
    // bottom fixture's enlarged glow spilled beyond the forest's curved edge.
    const lighting = containLights(host, [...items].filter(([id, item]) => item.kind === 'lamp' && id === 'copy-mutvj71a-qs70').map(([, item]) => item.el));
    const running = (el, active) => {
      el.classList.toggle('forest-ambient-running', active);
      lighting.copies.get(el)?.classList.toggle('forest-ambient-running', active);
    };
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => running(entry.target, entry.isIntersecting)), { rootMargin: '60px' });
      animated.forEach(el => observer.observe(el));
      return () => { observer.disconnect(); lighting.destroy(); };
    }
    animated.forEach(el => running(el, true));
    return () => lighting.destroy();
  }

  window.MIT_FOREST_LAYOUT = {
    designWidth: WIDTH,
    syncLights,
    resize(host) {
      const composition = host.parentElement;
      const frame = composition?.parentElement;
      if (!frame?.classList.contains('forest-canvas-frame')) return;
      const scale = frame.clientWidth / WIDTH;
      composition.style.transform = `scale(${scale})`;
      frame.style.height = composition.offsetHeight * scale + 'px';
    },
    mount(host) {
      lock(host);
      if (!document.body.classList.contains('forest-editor') && window.MIT_FOREST_BAKED) return apply(host, window.MIT_FOREST_BAKED.layout);
    }
  };
})();
