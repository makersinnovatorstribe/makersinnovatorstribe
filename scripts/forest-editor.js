(() => {
  'use strict';
  const scratch = new URLSearchParams(location.search).get('scratch') === '1';
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const initial = () => ({ version: 1, path: 'none', creek: 'creek-none', background: 'paper-light', assets: {}, duplicates: [] });
  const backgrounds = [
    { id: 'paper-light', label: 'Current pale paper', description: 'Cut-paper flowers and leaves, pale sage ground.', src: 'assets/images/woodland-v10/floor-material-light.webp', tile: true },
    { id: 'paper-fine', label: 'Small paper details', description: 'The smaller-leaf variant, available for you to try.', src: 'assets/images/woodland-v10/floor-material-fine.webp', tile: true },
    { id: 'paper-olive', label: 'Olive paper', description: 'The darker cut-paper floor.', src: 'assets/images/woodland-v10/floor-material.webp', tile: true },
    { id: 'detailed', label: 'Earlier textured ground', description: 'The detailed moss-and-leaves floor from the last version.', src: 'assets/images/woodland-v9/ground-detailed.webp' },
    { id: 'original', label: 'Original woodland floor', description: 'The earlier illustrated ground material.', src: 'assets/images/exco-world/woodland/woodland-floor.webp' },
    { id: 'plain', label: 'Plain sage paper', description: 'A quiet base; keep all trees and plants as separate layers.', color: '#c8cdae' }
  ];
  const scenes = ['Treehouse', 'Craft camp', 'Makers’ lookout'];
  const catalog = window.MIT_FOREST_ASSET_LIBRARY || [];
  let libraryGesture = null;
  let host, items = [], selected = null, layout = initial(), undoStack = [], redoStack = [], preview = false, gesture = null, savingTimer;
  let pathOptions = [], panMode = false, drafts;
  const pixelCache = new WeakMap();
  const maskCache = new Map();
  const lampProperties = { glow: '--lamp-glow', glowSize: '--lamp-glow-size' };

  const status = text => { $('save-status').textContent = text; };
  const serialize = () => JSON.stringify({ ...layout, editedAt: new Date().toISOString() }, null, 2);
  function refreshDraft() {
    $('layout-json').value = serialize();
    $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length;
  }
  function save() {
    layout.editedAt = new Date().toISOString();
    refreshDraft(); drafts.changed(layout);
  }
  async function saveNow() {
    endGesture();
    $('save-layout').disabled = true;
    try { await drafts.save(layout); }
    finally { $('save-layout').disabled = false; }
  }
  function remember(before = clone(layout)) {
    if (JSON.stringify(before) === JSON.stringify(layout)) return;
    undoStack.push(before); if (undoStack.length > 100) undoStack.shift(); redoStack = []; save();
  }
  function change(fn) { const before = clone(layout); fn(); applyAll(); remember(before); }

  function entry(element, id, label, scene, kind) {
    if (items.some(item => item.id === id)) throw new Error('Duplicate editor instance ID: ' + id);
    const style = getComputedStyle(element);
    const image = element.tagName === 'IMG' ? element : element.querySelector('img');
    const item = { element, id, label, scene, kind, image, baseZ: Number(style.zIndex) || (kind === 'person' ? 4 : 0), original: {}, originalLamp: {} };
    for (const name of ['transform', 'transformOrigin', 'zIndex', 'display']) item.original[name] = element.style[name];
    if (kind === 'lamp') for (const name of Object.values(lampProperties)) item.originalLamp[name] = element.style.getPropertyValue(name);
    element.dataset.forestId = id; element.classList.add('forest-edit-target'); items.push(item);
    return item;
  }
  function register() {
    entry(host.querySelector('.exco-terrain'), 'ground', 'Ground material', 'ground', 'ground');
    entry(host.querySelector('.exco-path-plane'), 'path', 'Walking path', 'ground', 'path');
    entry(host.querySelector('.exco-creek-plane'), 'creek', 'Stream crossing', 'ground', 'creek');
    host.querySelectorAll('.exco-ground-detail').forEach((el, i) => entry(el, 'floor-' + i, (el.querySelector('img').src.includes('log') ? 'Fallen log' : 'Moss & flowers') + ' ' + (i + 1), 'ground', 'plant'));
    host.querySelectorAll('.exco-world-stage').forEach((stage, scene) => {
      const label = name => scenes[scene] + ' · ' + name;
      stage.querySelectorAll('.exco-back-grove').forEach(el => entry(el, 's' + scene + (el.classList.contains('exco-front-birch') ? '-front-birch' : '-grove'), label(el.classList.contains('exco-front-birch') ? 'Foreground birch section' : 'Background grove'), String(scene), 'tree'));
      for (const [selector, id, name, kind] of [['.exco-station-art', 'station', ['Treehouse & bear', 'Sewing tent & bear', 'Printer bear & stump'][scene], 'station'], ['.exco-edge-tree', 'edge-tree', 'Edge tree', 'tree'], ['.exco-shared-bench', 'bench', 'Workbench', 'bench'], ['.exco-near-plants', 'fern', 'Large fern', 'plant']]) {
        const el = stage.querySelector(selector); if (el) entry(el, 's' + scene + '-' + id, label(name), String(scene), kind);
      }
      stage.querySelectorAll('.exco-tree').forEach((el, i) => {
        if (scene === 0 && i < 2) el.classList.add('editor-entry-tree');
        const src = el.querySelector('img').src;
        const species = src.includes('birch') ? 'Birch' : src.includes('ash') ? 'Ash' : 'Oak';
        entry(el, 's' + scene + '-tree-' + i, label(species + ' tree ' + (i + 1)), String(scene), 'tree');
      });
      stage.querySelectorAll('.exco-scene-lamp').forEach((el, i) => entry(el, 's' + scene + '-lamp-' + i, label('Lantern ' + (i + 1)), String(scene), 'lamp'));
      stage.querySelectorAll('.exco-person-place').forEach(el => entry(el, 'person-' + el.dataset.person, el.querySelector('.exco-person-name').textContent, String(scene), 'person'));
    });
  }

  function assetState(item) { return { x: 0, y: 0, scale: 1, hidden: false, ...(item.kind === 'lamp' ? { glow: 1, glowSize: 1 } : {}), ...layout.assets[item.id] }; }
  function z(item) { return layout.assets[item.id]?.z ?? item.baseZ; }
  function restoreInline(item, element = item.element) {
    Object.assign(element.style, item.original);
    for (const [name, value] of Object.entries(item.originalLamp)) {
      if (value) element.style.setProperty(name, value);
      else element.style.removeProperty(name);
    }
  }
  function applyAsset(item) {
    restoreInline(item);
    const state = assetState(item), width = host.clientWidth;
    const baseTransform = getComputedStyle(item.element).transform;
    if (state.x || state.y || state.scale !== 1) {
      item.element.style.transformOrigin = '50% 100%';
      item.element.style.transform = `translate(${state.x * width / 100}px, ${state.y * width / 100}px) ${baseTransform === 'none' ? '' : baseTransform} scale(${state.scale})`;
      // A transform groups the previously independent art/name layers. Keep the
      // whole actor at its normal scene depth instead of creating an auto/zero
      // stacking context beneath the woodland's ground details and props.
      if (item.kind === 'person') item.element.style.zIndex = state.z ?? item.baseZ;
    }
    if (state.z !== undefined) item.element.style.zIndex = state.z;
    if (state.hidden) item.element.style.display = 'none';
    if (item.kind === 'lamp') for (const [field, property] of Object.entries(lampProperties)) {
      if (layout.assets[item.id]?.[field] !== undefined) item.element.style.setProperty(property, state[field]);
    }
  }
  function applySource(item, option) {
    if (!option || option.kind === 'none') { item.element.hidden = true; return; }
    item.element.hidden = false;
    item.element.src = option.src; item.element.width = option.width; item.element.height = option.height;
    item.element.style.maskImage = option.includesScenery || option.includesGround ? 'none' : '';
  }
  function syncDuplicates() {
    const wanted = new Set(layout.duplicates.map(duplicate => duplicate.id));
    items.filter(item => item.duplicate && !wanted.has(item.id)).forEach(item => item.element.remove());
    items = items.filter(item => !item.duplicate || wanted.has(item.id));
    for (const duplicate of layout.duplicates) {
      if (items.some(item => item.id === duplicate.id)) continue;
      const source = items.find(item => item.id === duplicate.source);
      const template = catalog.find(item => item.id === duplicate.source);
      if (!source && !template) continue;
      if (source && ['ground', 'path', 'creek', 'person'].includes(source.kind)) continue;
      let element;
      if (template) {
        element = document.createElement('span'); element.className = 'editor-added-asset';
        element.style.width = template.width + '%'; element.style.aspectRatio = template.width + ' / ' + template.height;
        if (template.kind === 'lamp') {
          element.classList.add('exco-scene-lamp');
          for (const name of ['exco-lamp-halo', 'exco-lamp-pool']) { const part = document.createElement('span'); part.className = name; element.append(part); }
        }
        const image = document.createElement('img'); image.src = template.src; image.alt = ''; image.draggable = false;
        if (template.kind === 'lamp') image.className = 'exco-lamp-art';
        element.append(image); host.querySelector('.exco-landscape').append(element);
      } else {
        element = source.element.cloneNode(true); restoreInline(source, element);
        element.removeAttribute('data-forest-id'); source.element.parentNode.append(element);
      }
      const family = template?.id || source.family || source.id;
      const original = items.find(item => item.id === family) || catalog.find(item => item.id === family);
      const number = items.filter(item => item.family === family).length + 1;
      const item = entry(element, duplicate.id, original.label + ' · copy ' + number, source?.scene || 'ground', source?.kind || template.kind || 'plant');
      item.duplicate = true; item.family = family;
    }
  }
  function applyAll() {
    syncDuplicates();
    applySource(items.find(item => item.id === 'path'), pathOptions.find(option => option.id === layout.path));
    applySource(items.find(item => item.id === 'creek'), pathOptions.find(option => option.id === layout.creek));
    const floor = backgrounds.find(option => option.id === layout.background) || backgrounds[0];
    const terrain = items.find(item => item.id === 'ground').element;
    terrain.style.background = floor.color || '';
    terrain.querySelectorAll('img').forEach((image, i) => {
      image.hidden = !floor.src || (!floor.tile && i > 0);
      if (floor.src) image.src = floor.src;
      image.style.height = floor.tile ? 'auto' : '100%';
      image.style.objectFit = floor.tile ? '' : 'fill';
    });
    items.forEach(applyAsset);
    if (selected && !items.includes(selected)) selected = items.find(item => item.id === selected.id) || null;
    renderLayers(); updateSelection(); updateChoices(); window.MIT_FOREST_LABELS?.refresh();
  }

  function validateDraft(value) {
    if (!value || value.version !== 1 || !value.assets || typeof value.assets !== 'object' || Array.isArray(value.assets)) throw new Error('Choose a woodland editor layout JSON file.');
    const draft = initial();
    for (const field of ['path', 'creek']) if (pathOptions.some(option => option.id === value[field] && (option.category === 'creek') === (field === 'creek'))) draft[field] = value[field];
    if (backgrounds.some(option => option.id === value.background)) draft.background = value.background;
    const known = new Set(items.filter(item => !item.duplicate).map(item => item.id));
    const lamps = new Set([...items.filter(item => !item.duplicate && item.kind === 'lamp').map(item => item.id), ...catalog.filter(item => item.kind === 'lamp').map(item => item.id)]);
    const duplicable = new Set([...items.filter(item => !item.duplicate && !['ground', 'path', 'creek', 'person'].includes(item.kind)).map(item => item.id), ...catalog.map(item => item.id)]);
    for (const duplicate of (Array.isArray(value.duplicates) ? value.duplicates.slice(0, 80) : [])) {
      if (!duplicate || typeof duplicate !== 'object' || typeof duplicate.id !== 'string' || !/^copy-[\w-]+$/.test(duplicate.id) || !duplicable.has(duplicate.source) || known.has(duplicate.id)) continue;
      draft.duplicates.push({ id: duplicate.id, source: duplicate.source }); known.add(duplicate.id); duplicable.add(duplicate.id);
      if (lamps.has(duplicate.source)) lamps.add(duplicate.id);
    }
    for (const [id, raw] of Object.entries(value.assets)) {
      if (!known.has(id) || !raw || typeof raw !== 'object') continue;
      const state = {};
      for (const [key, low, high] of [['x', -500, 500], ['y', -1000, 1000], ['scale', .1, 5], ['z', -20, 200]]) {
        if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) state[key] = clamp(raw[key], low, high);
      }
      if (lamps.has(id)) for (const [key, low, high] of [['glow', 0, 2], ['glowSize', .5, 2.5]]) {
        if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) state[key] = clamp(raw[key], low, high);
      }
      if (typeof raw.hidden === 'boolean') state.hidden = raw.hidden;
      draft.assets[id] = state;
    }
    return draft;
  }

  function updateChoices() {
    document.querySelectorAll('[data-option]').forEach(button => {
      const active = layout[button.dataset.field] === button.dataset.option;
      button.classList.toggle('is-selected', active); button.setAttribute('aria-pressed', String(active));
    });
  }
  function optionButton(option, field, parent) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'editor-option';
    button.dataset.option = option.id; button.dataset.field = field;
    if (option.thumbnail || option.src) {
      const image = document.createElement('img'); image.src = option.thumbnail || option.src; image.alt = ''; image.loading = 'lazy'; button.append(image);
    } else { const swatch = document.createElement('span'); swatch.className = 'editor-option-swatch'; swatch.textContent = option.kind === 'none' ? '∅' : ''; swatch.style.background = option.color || '#e9e7e0'; button.append(swatch); }
    const title = document.createElement('strong'); title.textContent = option.label;
    const detail = document.createElement('span'); detail.textContent = option.description;
    button.append(title, detail); button.addEventListener('click', () => { change(() => { layout[field] = option.id; }); }); parent.append(button);
  }
  function renderOptions() {
    const paths = pathOptions.filter(option => option.category !== 'creek');
    paths.filter(option => !option.includesGround && !option.includesScenery).forEach(option => optionButton(option, 'path', $('path-options')));
    const divider = document.createElement('h3'); divider.className = 'editor-options-heading'; divider.textContent = 'Earlier paths inside complete scenes'; $('path-options').append(divider);
    paths.filter(option => option.includesGround || option.includesScenery).forEach(option => optionButton(option, 'path', $('path-options')));
    pathOptions.filter(option => option.category === 'creek').forEach(option => optionButton(option, 'creek', $('creek-options')));
    backgrounds.forEach(option => optionButton(option, 'background', $('background-options')));
  }
  function renderLayers() {
    const list = $('layer-list'), filter = $('layer-filter').value;
    const scroll = list.scrollTop; list.replaceChildren();
    const sorted = [...items].sort((a, b) => z(b) - z(a) || items.indexOf(b) - items.indexOf(a));
    sorted.filter(item => filter === 'all' || item.scene === filter).forEach(item => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'editor-layer-row';
      button.dataset.assetId = item.id; button.classList.toggle('is-selected', selected === item); button.setAttribute('aria-pressed', String(selected === item));
      if (item.image) { const img = document.createElement('img'); img.src = item.image.src; img.alt = ''; img.loading = 'lazy'; button.append(img); }
      const copy = document.createElement('span'); copy.className = 'layer-copy'; const name = document.createElement('strong'); name.textContent = item.label;
      const caption = document.createElement('small'); caption.textContent = (assetState(item).hidden || item.element.hidden ? 'Hidden · ' : '') + (item.scene === 'ground' ? 'Ground & path' : scenes[Number(item.scene)]);
      copy.append(name, caption); const layer = document.createElement('span'); layer.className = 'layer-index'; layer.textContent = String(z(item));
      button.append(copy, layer); button.addEventListener('click', () => select(item)); list.append(button);
    }); list.scrollTop = scroll;
  }
  function updateSelection() {
    $('asset-controls').disabled = !selected;
    $('asset-lamp-controls').hidden = selected?.kind !== 'lamp';
    $('selected-name').textContent = selected ? selected.label : 'Choose something in the scene';
    $('selected-description').textContent = selected ? 'Only this instance changes. Use its Move handle when artwork overlaps.' : 'Or select it from the layer list below.';
    if (selected) {
      const state = assetState(selected);
      const showValue = (id, value) => { if (document.activeElement !== $(id)) $(id).value = value; };
      showValue('asset-size', Math.round(state.scale * 100)); showValue('asset-scale', Math.round(state.scale * 100));
      showValue('asset-x', Number(state.x.toFixed(1))); showValue('asset-y', Number(state.y.toFixed(1))); showValue('asset-layer', z(selected));
      if (selected.kind === 'lamp') for (const [id, field] of [['asset-glow', 'glow'], ['asset-glow-size', 'glowSize']]) {
        const percentage = Math.round(state[field] * 100);
        showValue(id, percentage); $(id + '-value').textContent = percentage + '%';
      }
      $('asset-hide').textContent = state.hidden ? 'Show asset' : 'Hide asset'; $('asset-hide').setAttribute('aria-pressed', String(state.hidden));
      $('asset-duplicate').disabled = ['person', 'ground', 'path', 'creek'].includes(selected.kind);
    }
    updateBox();
  }
  function updateBox() {
    const box = $('selection-box');
    box.hidden = !selected || preview || assetState(selected).hidden || selected.element.hidden;
    if (box.hidden) return;
    const rect = selected.element.getBoundingClientRect();
    if (!rect.width || !rect.height) { box.hidden = true; return; }
    box.style.left = rect.left + window.scrollX + 'px'; box.style.top = rect.top + window.scrollY + 'px';
    box.style.width = rect.width + 'px'; box.style.height = rect.height + 'px';
    $('selection-label').textContent = selected.label;
  }
  function select(item) {
    selected = item; renderLayers(); updateSelection();
    document.querySelectorAll('[data-tab]').forEach(button => {
      const active = button.dataset.tab === 'layers'; button.setAttribute('aria-selected', String(active)); $('tab-' + button.dataset.tab).hidden = !active;
    });
    $('editor-panel').scrollTop = 0;
  }
  function patchInstance(item, values) {
    if (!item) return;
    layout.assets[item.id] = { ...layout.assets[item.id], ...values }; applyAsset(item); updateSelection(); window.MIT_FOREST_LABELS?.refresh();
  }
  const patchSelected = values => patchInstance(selected, values);

  function sampleAlpha(image, u, v) {
    if (!image.complete || !image.naturalWidth) return false;
    try {
      let cached = pixelCache.get(image);
      if (!cached || cached.src !== image.src) {
        const canvas = document.createElement('canvas'); canvas.width = Math.min(600, image.naturalWidth); canvas.height = Math.round(canvas.width * image.naturalHeight / image.naturalWidth);
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        cached = { src: image.src, ctx, width: canvas.width, height: canvas.height }; pixelCache.set(image, cached);
      }
      return cached.ctx.getImageData(clamp(Math.floor(u * cached.width), 0, cached.width - 1), clamp(Math.floor(v * cached.height), 0, cached.height - 1), 1, 1).data[3] > 35;
    } catch { return true; }
  }
  function maskImage(element) {
    const url = /^url\(["']?(.+?)["']?\)$/.exec(getComputedStyle(element).maskImage || '')?.[1];
    if (!url) return null;
    if (!maskCache.has(url)) { const image = new Image(); image.src = url; maskCache.set(url, image); }
    return maskCache.get(url);
  }
  function insidePaint(element, x, y) {
    // CSS clips and masks affect visible ink even though the uncut source image
    // still contains opaque pixels. Never let that invisible part win a pick.
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect();
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (!rect.width || !rect.height) continue;
      if (node !== element && ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX) && (x < rect.left || x > rect.right)) return false;
      if (node !== element && ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY) && (y < rect.top || y > rect.bottom)) return false;
      if ((style.clipPath || '').startsWith('inset(')) {
        const terms = style.clipPath.slice(6, -1).split(/\s+round\s+/)[0].match(/calc\([^)]*\)|[+-]?[\d.]+(?:px|%)/g) || [];
        const edges = [terms[0] || '0px', terms[1] || terms[0] || '0px', terms[2] || terms[0] || '0px', terms[3] || terms[1] || terms[0] || '0px'];
        const length = (term, axis) => {
          const size = axis ? rect.height : rect.width, unscaled = axis ? node.offsetHeight : node.offsetWidth;
          return [...term.matchAll(/([+-]?)\s*([\d.]+)(%|px)/g)].reduce((sum, match) => sum + (match[1] === '-' ? -1 : 1) * Number(match[2]) * (match[3] === '%' ? size / 100 : size / (unscaled || size)), 0);
        };
        if (x < rect.left + length(edges[3], 0) || x > rect.right - length(edges[1], 0) || y < rect.top + length(edges[0], 1) || y > rect.bottom - length(edges[2], 1)) return false;
      }
      const mask = maskImage(node);
      if (mask && !sampleAlpha(mask, (x - rect.left) / rect.width, (y - rect.top) / rect.height)) return false;
    }
    return true;
  }
  // The layer list and Move handle also reach objects behind other artwork.
  function containsInk(item, x, y) {
    if (!insidePaint(item.element, x, y)) return false;
    const image = item.image;
    if (!image || !image.complete || !image.naturalWidth) return true;
    const rect = image.getBoundingClientRect(); let width = rect.width, height = rect.height, left = rect.left, top = rect.top;
    if (getComputedStyle(image).objectFit === 'contain') {
      const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      width = image.naturalWidth * fit; height = image.naturalHeight * fit; left += (rect.width - width) / 2; top += (rect.height - height) / 2;
    }
    if (x < left || x > left + width || y < top || y > top + height) return false;
    const reflected = (getComputedStyle(image).transform || '').startsWith('matrix(-');
    return sampleAlpha(image, reflected ? 1 - (x - left) / width : (x - left) / width, (y - top) / height);
  }
  function pick(event) {
    const candidates = items.filter(item => {
      if (assetState(item).hidden || item.element.hidden || item.kind === 'ground') return false;
      const r = item.element.getBoundingClientRect(); return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    }).sort((a, b) => z(b) - z(a) || items.indexOf(b) - items.indexOf(a));
    return candidates.find(item => containsInk(item, event.clientX, event.clientY));
  }
  function startGesture(event, resize = false, keepSelection = false) {
    if (preview || event.button > 0 || gesture) return;
    if (panMode && !resize && !keepSelection) return;
    if (!resize && !keepSelection) {
      if (event.target.closest('.woodland-lantern-button')) return;
      const item = event.altKey && selected ? selected : pick(event); if (!item) return;
      select(item);
    }
    if (!selected) return;
    event.preventDefault();
    const rect = selected.element.getBoundingClientRect();
    gesture = { before: clone(layout), item: selected, startX: event.clientX, startY: event.clientY, width: host.getBoundingClientRect().width, state: assetState(selected), resize, rect, pointerId: event.pointerId };
    document.body.classList.add('is-dragging');
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
  }
  function moveGesture(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
    if (gesture.resize) {
      const ratio = clamp(1 + (dx + dy) / Math.max(80, gesture.rect.width + gesture.rect.height), .1, 5);
      patchInstance(gesture.item, { scale: clamp(gesture.state.scale * ratio, .1, 5) });
    } else patchInstance(gesture.item, { x: gesture.state.x + dx / gesture.width * 100, y: gesture.state.y + dy / gesture.width * 100 });
  }
  function endGesture(event) {
    if (!gesture || (event?.pointerId !== undefined && event.pointerId !== gesture.pointerId)) return;
    const before = gesture.before; gesture = null; document.body.classList.remove('is-dragging'); remember(before); renderLayers();
  }

  function visibleCanvas() {
    const canvas = document.querySelector('.editor-canvas-scroll').getBoundingClientRect();
    const tools = document.querySelector('.editor-stage-tools').getBoundingClientRect();
    const panel = $('editor-panel').getBoundingClientRect();
    const panelCoversCanvas = window.innerWidth <= 760 && document.body.classList.contains('panel-open');
    return { left: canvas.left, right: canvas.right, top: Math.max(canvas.top, tools.bottom), bottom: Math.min(canvas.bottom, window.innerHeight, panelCoversCanvas ? panel.top : Infinity) };
  }
  function showLibraryCanvas() {
    const plane = host.querySelector('.exco-landscape').getBoundingClientRect(), canvas = visibleCanvas();
    if (plane.top > canvas.bottom - 150) window.scrollBy({ top: plane.top - canvas.top + 20, behavior: 'instant' });
  }
  function addFromLibrary(template, point) {
    if (preview || layout.duplicates.length >= 80) return;
    const plane = host.querySelector('.exco-landscape'), rect = plane.getBoundingClientRect(), width = host.getBoundingClientRect().width;
    if (!point) {
      const canvas = visibleCanvas();
      const top = Math.max(rect.top, canvas.top), bottom = Math.min(rect.bottom, canvas.bottom, window.innerHeight);
      point = { x: rect.left + rect.width / 2, y: top + Math.max(90, bottom - top) * .6 };
    }
    const id = 'copy-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    change(() => {
      layout.duplicates.push({ id, source: template.id });
      layout.assets[id] = { x: clamp((point.x - rect.left) / width * 100 - template.width / 2, -500, 500), y: clamp((point.y - rect.top) / width * 100 - template.height / 2, -1000, 1000), scale: 1, z: template.kind === 'lamp' ? 8 : 6 };
    });
    select(items.find(item => item.id === id));
  }
  function stopLibraryDrag(event, cancel = false) {
    if (!libraryGesture || (event?.pointerId !== undefined && event.pointerId !== libraryGesture.pointerId)) return;
    const drag = libraryGesture; libraryGesture = null;
    drag.ghost.remove(); document.body.classList.remove('is-library-dragging');
    if (cancel || !drag.moved) return;
    const r = host.querySelector('.exco-landscape').getBoundingClientRect(), canvas = visibleCanvas();
    if (event.clientX >= Math.max(r.left, canvas.left) && event.clientX <= Math.min(r.right, canvas.right) && event.clientY >= Math.max(r.top, canvas.top) && event.clientY <= Math.min(r.bottom, canvas.bottom)) {
      addFromLibrary(drag.template, { x: event.clientX, y: event.clientY });
    }
  }
  function renderLibrary() {
    const list = $('asset-library'), filter = $('library-filter').value;
    list.replaceChildren();
    for (const template of catalog.filter(item => filter === 'all' || item.group === filter)) {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'editor-library-card';
      card.dataset.libraryId = template.id; card.setAttribute('aria-label', 'Add ' + template.label);
      const image = document.createElement('img'); image.src = template.src; image.alt = ''; image.draggable = false;
      const label = document.createElement('strong'); label.textContent = template.label;
      const hint = document.createElement('span'); hint.textContent = template.fresh ? 'NEW · drag or tap +' : 'Drag or tap +';
      card.append(image, label, hint);
      card.addEventListener('click', event => {
        if (card.dataset.dragged === 'true') { card.dataset.dragged = 'false'; return; }
        addFromLibrary(template);
      });
      card.addEventListener('pointerdown', event => {
        if (event.button > 0 || preview || libraryGesture) return;
        card.dataset.dragged = 'false';
        const ghost = document.createElement('img'); ghost.src = template.src; ghost.className = 'editor-library-ghost'; ghost.hidden = true;
        document.body.append(ghost); libraryGesture = { template, ghost, card, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        try { card.setPointerCapture(event.pointerId); } catch {}
      });
      list.append(card);
    }
  }
  function bindControls() {
    $('library-filter').addEventListener('change', renderLibrary);
    document.addEventListener('pointermove', event => {
      const drag = libraryGesture; if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7) return;
      drag.moved = true; drag.card.dataset.dragged = 'true'; drag.ghost.hidden = false;
      drag.ghost.style.left = event.clientX + 'px'; drag.ghost.style.top = event.clientY + 'px';
      document.body.classList.add('is-library-dragging'); event.preventDefault();
    }, { passive: false });
    document.addEventListener('pointerup', event => stopLibraryDrag(event));
    document.addEventListener('pointercancel', event => stopLibraryDrag(event, true));
    window.addEventListener('blur', () => stopLibraryDrag(null, true));

    $('layer-filter').addEventListener('change', renderLayers);
    for (const [id, field, factor, low, high] of [['asset-size', 'scale', .01, .1, 5], ['asset-x', 'x', 1, -500, 500], ['asset-y', 'y', 1, -1000, 1000], ['asset-layer', 'z', 1, -20, 200]]) {
      $(id).addEventListener('input', () => {
        if ($(id).value === '') return;
        const value = Number($(id).value) * factor;
        if (selected && Number.isFinite(value)) change(() => patchSelected({ [field]: clamp(value, low, high) }));
      });
      $(id).addEventListener('blur', updateSelection);
    }
    let sliderBefore;
    $('asset-scale').addEventListener('input', () => { sliderBefore ||= clone(layout); patchSelected({ scale: Number($('asset-scale').value) / 100 }); });
    $('asset-scale').addEventListener('change', () => { if (sliderBefore) { remember(sliderBefore); sliderBefore = null; } });
    for (const [id, field, low, high] of [['asset-glow', 'glow', 0, 2], ['asset-glow-size', 'glowSize', .5, 2.5]]) {
      const control = $(id); let edit = null;
      const commit = () => { if (edit) { const before = edit.before; edit = null; remember(before); } };
      control.addEventListener('input', () => {
        if (selected?.kind !== 'lamp' || control.value === '') return;
        const value = Number(control.value) / 100; if (!Number.isFinite(value)) return;
        if (edit && edit.item !== selected) commit();
        edit ||= { item: selected, before: clone(layout) };
        patchInstance(edit.item, { [field]: clamp(value, low, high) });
      });
      control.addEventListener('change', commit);
      control.addEventListener('blur', commit);
    }
    for (const [id, amount] of [['layer-backward', -1], ['layer-forward', 1]]) $(id).addEventListener('click', () => change(() => patchSelected({ z: clamp(z(selected) + amount, -20, 200) })));
    $('layer-front').addEventListener('click', () => change(() => patchSelected({ z: Math.min(200, Math.max(...items.map(z)) + 1) })));
    $('layer-back').addEventListener('click', () => change(() => patchSelected({ z: Math.max(1, Math.min(...items.filter(item => !['ground', 'path', 'creek'].includes(item.kind)).map(z)) - 1) })));
    $('asset-hide').addEventListener('click', () => change(() => patchSelected({ hidden: !assetState(selected).hidden })));
    $('asset-reset').addEventListener('click', () => change(() => { delete layout.assets[selected.id]; }));
    $('asset-find').addEventListener('click', () => selected?.element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }));
    $('asset-duplicate').addEventListener('click', () => {
      if (!selected || layout.duplicates.length >= 80) return;
      const source = selected, id = 'copy-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      const family = source.family || source.id;
      const siblings = items.filter(item => item.id === family || item.family === family);
      const state = assetState(source);
      let offset = 8;
      while (siblings.some(item => Math.abs(assetState(item).x - state.x - offset) < 2 && Math.abs(assetState(item).y - state.y - offset) < 2)) offset += 8;
      change(() => {
        layout.duplicates.push({ id, source: source.id });
        layout.assets[id] = { ...state, x: state.x + offset, y: state.y + offset, z: Math.min(200, Math.max(...siblings.map(z)) + 1) };
      });
      select(items.find(item => item.id === id));
    });
    $('undo').addEventListener('click', () => { if (!undoStack.length) return; redoStack.push(clone(layout)); layout = undoStack.pop(); applyAll(); save(); });
    $('redo').addEventListener('click', () => { if (!redoStack.length) return; undoStack.push(clone(layout)); layout = redoStack.pop(); applyAll(); save(); });
    $('preview-toggle').addEventListener('click', () => {
      preview = !preview; document.body.classList.toggle('is-preview', preview); $('preview-toggle').setAttribute('aria-pressed', String(preview)); $('preview-toggle').textContent = preview ? 'Back to editing' : 'Preview';
      $('editor-help').textContent = preview ? 'Preview mode · try the lantern and profiles.' : 'Select an asset, then drag it. Drag its corner to resize.'; updateBox();
    });
    const sizeCanvas = () => {
      const chosen = $('preview-width').value;
      const width = chosen === 'fit' ? Math.max(240, Math.min(820, document.querySelector('.editor-canvas-scroll')?.clientWidth || window.innerWidth - 24)) : Number(chosen);
      document.documentElement.style.setProperty('--preview-width', width + 'px');
      window.MIT_FOREST_LAYOUT?.resize(host);
      requestAnimationFrame(applyAll);
    };
    $('preview-width').addEventListener('change', sizeCanvas);
    if (window.innerWidth <= 760) { $('preview-width').value = 'fit'; sizeCanvas(); }
    $('pan-toggle').addEventListener('click', () => {
      panMode = !panMode; document.body.classList.toggle('is-pan-mode', panMode); $('pan-toggle').setAttribute('aria-pressed', String(panMode));
      $('editor-help').textContent = panMode ? 'Scroll the scene; tap an asset to select it. Turn Scroll mode off to drag.' : 'Drag an asset to move it; drag its corner to resize.';
    });
    $('toggle-panel').addEventListener('click', () => { const open = document.body.classList.toggle('panel-open'); $('toggle-panel').setAttribute('aria-expanded', String(open)); });
    document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach(tab => { const active = tab === button; tab.setAttribute('aria-selected', String(active)); $('tab-' + tab.dataset.tab).hidden = !active; });
      if (button.dataset.tab === 'library') showLibraryCanvas();
    }));
    $('show-layout').addEventListener('click', () => { $('layout-json').value = serialize(); $('layout-dialog').showModal(); });
    $('close-layout').addEventListener('click', () => $('layout-dialog').close());
    $('copy-layout').addEventListener('click', async () => { try { await navigator.clipboard.writeText(serialize()); $('copy-layout').textContent = 'Copied'; } catch { $('layout-json').select(); $('copy-layout').textContent = 'Select all and copy'; } });
    $('save-layout').addEventListener('click', saveNow);
    $('close-recovery').addEventListener('click', () => $('recovery-dialog').close());
    $('recover-layout').addEventListener('click', async () => {
      const list = $('recovery-list'); list.textContent = 'Loading recovery versions…';
      $('recovery-dialog').showModal();
      try {
        const versions = await drafts.recoveries(); list.replaceChildren();
        if (!versions.length) list.textContent = 'No earlier backups yet. New changes are backed up automatically.';
        for (const version of versions) {
          const button = document.createElement('button'); button.type = 'button';
          button.textContent = version.label + (version.savedAt ? ' · ' + new Date(version.savedAt).toLocaleString() : '');
          button.addEventListener('click', () => {
            change(() => { layout = validateDraft(version.layout); });
            $('recovery-dialog').close();
          });
          list.append(button);
        }
      } catch { list.textContent = 'Recovery could not load. Your current draft is unchanged.'; }
    });
    $('import-layout').addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file) return;
      try { const next = validateDraft(JSON.parse(await file.text())); change(() => { layout = next; }); }
      catch (error) { status(error.message); } event.target.value = '';
    });
    $('restore-start').addEventListener('click', () => { change(() => { layout = initial(); }); status('Reset to starting composition · Undo restores your work'); });
    host.addEventListener('pointerdown', event => startGesture(event));
    host.addEventListener('click', event => { if (!preview && !event.target.closest('.woodland-lantern-button')) { event.stopPropagation(); event.preventDefault(); if (panMode) { const item = pick(event); if (item) select(item); } } }, true);
    $('resize-handle').addEventListener('pointerdown', event => startGesture(event, true));
    $('move-handle').addEventListener('pointerdown', event => startGesture(event, false, true));
    document.addEventListener('pointermove', moveGesture); document.addEventListener('pointerup', endGesture); document.addEventListener('pointercancel', endGesture);
    window.addEventListener('blur', () => endGesture());
    window.addEventListener('scroll', updateBox, { passive: true }); document.addEventListener('scroll', updateBox, true);
    window.addEventListener('resize', () => { clearTimeout(savingTimer); savingTimer = setTimeout(sizeCanvas, 100); });
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveNow(); return; }
      if (event.target.matches('input,textarea,select') || $('layout-dialog').open || $('recovery-dialog').open) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); $(event.shiftKey ? 'redo' : 'undo').click(); return; }
      if (event.key === 'Escape') { selected = null; renderLayers(); updateSelection(); return; }
      if (preview || !selected) return;
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[event.key]) {
        event.preventDefault(); const [x, y] = arrows[event.key], state = assetState(selected), step = (event.shiftKey ? 10 : 1) / host.clientWidth * 100;
        change(() => patchSelected({ x: state.x + x * step, y: state.y + y * step }));
      }
    });
  }
  async function start() {
    await window.MIT_CREW_READY;
    host = $('committee-grid'); if (!host.querySelector('.exco-landscape')) { status('Could not load the woodland. Reload to try again.'); return; }
    pathOptions = window.MIT_FOREST_PATH_OPTIONS || [{ id: 'none', label: 'No path', description: 'Keep the ground clear.', kind: 'none', category: 'path' }, { id: 'creek-none', label: 'No stream', description: 'Remove the crossing.', kind: 'none', category: 'creek' }];
    const freeze = document.createElement('style');
    freeze.textContent = '.forest-editor .exco-landscape,.forest-editor .exco-world-stage{--exco-pointer-x:0px!important;--exco-pointer-y:0px!important;--exco-scroll:0px!important}.forest-editor .exco-ground-material[hidden]{display:none}.forest-editor .exco-person:is(:hover,:focus-visible) .exco-person-art{transform:none}';
    document.head.append(freeze); register();
    drafts = window.MIT_FOREST_DRAFTS.create({ validate: validateDraft, scratch, onStatus: (state, message) => {
      status(message); $('save-status').dataset.state = state;
    } });
    const saved = await drafts.load(); if (saved) layout = validateDraft(saved);
    items.forEach(item => maskImage(item.element));
    renderOptions(); renderLibrary(); bindControls(); applyAll(); refreshDraft();
    if (window.matchMedia('(pointer: coarse)').matches) $('pan-toggle').click();
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'paths') document.querySelector('[data-tab="paths"]').click();
  }
  start().catch(error => { status('Editor could not start: ' + error.message); console.error(error); });
})();
