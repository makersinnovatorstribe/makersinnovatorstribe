/* The finished woodland is authored at 390px. Resize the complete canvas,
   never its individual anchors, breakpoints or paper layers. */
(() => {
  'use strict';
  const WIDTH = 390;
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
      composition.style.transform = `scale(${scale})`;
      frame.style.height = composition.offsetHeight * scale + 'px';
      window.MIT_FOREST_LABELS?.refresh();
    };
    const observer = new ResizeObserver(resize);
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
      stage.querySelectorAll('.exco-person-place').forEach(el => register(el, 'person-' + el.dataset.person, 'person'));
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
        const image = document.createElement('img'); image.src = template.src; image.alt = ''; image.draggable = false; image.loading = 'lazy';
        if (template.kind === 'lamp') image.className = 'exco-lamp-art';
        element.append(image); host.querySelector('.exco-landscape').append(element);
      } else {
        element = source.el.cloneNode(true);
        if (source.original === null) element.removeAttribute('style');
        else element.setAttribute('style', source.original);
        source.el.parentNode.append(element);
      }
      register(element, duplicate.id, source?.kind || template.kind || 'plant');
    }
    const setSource = (id, choice) => {
      const option = (window.MIT_FOREST_PATH_OPTIONS || []).find(item => item.id === choice);
      const element = items.get(id).el;
      element.hidden = !option || option.kind === 'none';
      if (element.hidden) return;
      element.src = option.src; element.width = option.width; element.height = option.height;
      element.style.maskImage = option.includesScenery || option.includesGround ? 'none' : '';
    };
    setSource('path', layout.path); setSource('creek', layout.creek);
    const floor = backgrounds[layout.background];
    if (!floor) throw new Error('Unresolved woodland ground: ' + layout.background);
    const terrain = items.get('ground').el;
    terrain.style.background = floor.color || '';
    terrain.querySelectorAll('img').forEach((image, i) => {
      image.hidden = !floor.src || (!floor.tile && i > 0);
      if (floor.src) image.src = floor.src;
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
        if (kind === 'person') el.style.zIndex = state.z ?? 4;
        // The saved transform anchors the object. A separate, small depth
        // translation keeps mouse/phone parallax live without changing it.
        if (!['person', 'ground', 'path', 'bench', 'station'].includes(kind)) el.classList.add('forest-positioned');
      }
      if (state.z !== undefined) el.style.zIndex = state.z;
      if (state.hidden) el.style.display = 'none';
      if (kind === 'lamp') {
        if (state.glow !== undefined) el.style.setProperty('--lamp-glow', state.glow);
        if (state.glowSize !== undefined) el.style.setProperty('--lamp-glow-size', state.glowSize);
      }
    }
    host.dataset.layoutRevision = window.MIT_FOREST_BAKED.revision;
    host.classList.add('forest-layout-baked');
  }

  window.MIT_FOREST_LAYOUT = {
    designWidth: WIDTH,
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
      if (!document.body.classList.contains('forest-editor') && window.MIT_FOREST_BAKED) apply(host, window.MIT_FOREST_BAKED.layout);
    }
  };
})();
