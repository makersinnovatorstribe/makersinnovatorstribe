/* Shared by the manual editor, disk validator and eventual baked website. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MIT_PORTRAITS = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const people = ['natalie', 'kar-way', 'elayna', 'yu-jing', 'alfred', 'wei-shen', 'puteri', 'yamone', 'luther', 'jun-leong', 'pei-ni'];
  const assets = [
    {"id":"bluebells","label":"Bluebells","group":"Flowers","src":"assets/images/portrait-decorations/bluebells-v1.webp","ratio":0.812819,"fresh":true},
    {"id":"buttercups","label":"Golden buttercups","group":"Flowers","src":"assets/images/portrait-decorations/buttercups-v1.webp","ratio":0.95735,"fresh":true},
    {"id":"strawberry-sprig","label":"Wild strawberries","group":"Flowers","src":"assets/images/portrait-decorations/strawberry-sprig-v1.webp","ratio":1.071661,"fresh":true},
    {"id":"clover-blossoms","label":"Clover blossoms","group":"Flowers","src":"assets/images/portrait-decorations/clover-blossoms-v1.webp","ratio":1.160653,"fresh":true},
    {"id":"amber-mushrooms","label":"Amber mushrooms","group":"Ground","src":"assets/images/portrait-decorations/amber-mushrooms-v1.webp","ratio":0.989764,"fresh":true},
    {"id":"oak-acorns","label":"Oak and acorns","group":"Plants","src":"assets/images/portrait-decorations/oak-acorns-v1.webp","ratio":1.149573,"fresh":true},
    {"id":"ivy-corner","label":"Ivy corner","group":"Plants","src":"assets/images/portrait-decorations/ivy-corner-v1.webp","ratio":0.949733,"fresh":true},
    {"id":"woodland-violets","label":"Woodland violets","group":"Flowers","src":"assets/images/portrait-decorations/woodland-violets-v1.webp","ratio":1.060132,"fresh":true},
    {"id":"willow-sprig","label":"Willow sprig","group":"Plants","src":"assets/images/portrait-decorations/willow-sprig-v1.webp","ratio":0.659689,"fresh":true},
    {"id":"seedling-log","label":"Seedling log","group":"Ground","src":"assets/images/portrait-decorations/seedling-log-v1.webp","ratio":1.622917,"fresh":true},
    { id: 'forest-fern', label: 'Forest fern', group: 'Plants', src: 'assets/images/atelier-v6/foreground-fern.webp', ratio: .8 },
    { id: 'flowers', label: 'Forest flowers', group: 'Flowers', src: 'assets/images/exco-world/props/fern-patch.webp', ratio: 2.5 },
    { id: 'daisies', label: 'Wild daisies', group: 'Flowers', src: 'assets/images/woodland-editor/daisies-paper.webp', ratio: 1.5 },
    { id: 'paper-fern', label: 'Paper fern', group: 'Plants', src: 'assets/images/woodland-editor/fern-paper.webp', ratio: 1225 / 1284 },
    { id: 'grass', label: 'Meadow grass', group: 'Plants', src: 'assets/images/woodland-editor/grass-meadow.webp', ratio: 2 },
    { id: 'log', label: 'Log and ferns', group: 'Ground', src: 'assets/images/exco-world/props/log-ferns.webp', ratio: 700 / 233 },
    { id: 'stones', label: 'Mossy stones', group: 'Ground', src: 'assets/images/woodland-editor/moss-stones.webp', ratio: 20 / 14 },
    { id: 'lantern', label: 'Paper lantern', group: 'Lights', src: 'assets/images/woodland-editor/lantern-paper.webp', ratio: 1 },
    { id: 'ash', label: 'Tall ash', group: 'Trees', src: 'assets/images/woodland-v8/ash-tree.webp', ratio: 48 / 75 },
    { id: 'oak', label: 'Oak tree', group: 'Trees', src: 'assets/images/exco-world/woodland/woodland-oak.webp', ratio: 55 / 75 },
    { id: 'birch', label: 'Birch tree', group: 'Trees', src: 'assets/images/exco-world/woodland/woodland-birch.webp', ratio: 38 / 75 }
  ];
  const byId = Object.fromEntries(assets.map(asset => [asset.id, asset]));
  const publicSources = {
    'forest-fern': 'assets/images/portrait-decorations/delivery-v2/forest-fern-320.webp',
    'paper-fern': 'assets/images/portrait-decorations/delivery-v2/paper-fern-320.webp',
    grass: 'assets/images/portrait-decorations/delivery-v2/grass-320.webp',
    flowers: 'assets/images/portrait-decorations/delivery-v2/flowers-320.webp',
    daisies: 'assets/images/portrait-decorations/delivery-v2/daisies-320.webp',
    log: 'assets/images/portrait-decorations/delivery-v2/log-320.webp',
    stones: 'assets/images/portrait-decorations/delivery-v2/stones-320.webp'
  };
  const deliverySource = definition => publicSources[definition.id] || (definition.fresh ? definition.src.replace(/([^/]+)-v1\.webp$/, 'delivery-v1/$1-320.webp') : definition.src);
  const plain = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  const reject = message => { throw new TypeError(message); };
  const only = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
  function placement(value) {
    if (!only(value, ['x', 'y', 'width', 'rotation', 'z', 'flipX', 'hidden'])) reject('Invalid placement fields.');
    const result = {};
    for (const [key, low, high] of [['x', -50, 150], ['y', -50, 150], ['width', 2, 200], ['rotation', -180, 180], ['z', -1000, 1000]]) {
      const number = value[key];
      if (typeof number !== 'number' || !Number.isFinite(number) || number < low || number > high || (key === 'z' && !Number.isInteger(number))) reject('Invalid ' + key + '.');
      result[key] = number;
    }
    for (const key of ['flipX', 'hidden']) { if (typeof value[key] !== 'boolean') reject('Invalid ' + key + '.'); result[key] = value[key]; }
    return result;
  }
  function validate(value) {
    if (!only(value, ['version', 'profiles']) || value.version !== 1 || !plain(value.profiles) || Object.keys(value.profiles).length !== people.length) reject('Expected eleven portrait designs.');
    const profiles = {};
    for (const person of people) {
      const profile = value.profiles[person];
      if (!only(profile, ['portrait', 'assets']) || !Array.isArray(profile.assets) || profile.assets.length > 80) reject('Invalid profile design.');
      const ids = new Set();
      profiles[person] = { portrait: placement(profile.portrait), assets: profile.assets.map(asset => {
        if (!only(asset, ['id', 'source', 'x', 'y', 'width', 'rotation', 'z', 'flipX', 'hidden']) || !/^p-[a-z0-9-]{1,90}$/.test(asset.id) || ids.has(asset.id) || !Object.prototype.hasOwnProperty.call(byId, asset.source)) reject('Invalid or repeated decoration instance.');
        ids.add(asset.id);
        const { id, source, ...state } = asset;
        return { id, source, ...placement(state) };
      }) };
    }
    return { version: 1, profiles };
  }
  function blank() {
    return { version: 1, profiles: Object.fromEntries(people.map(id => [id, { portrait: { x: 50, y: 49, width: 70, rotation: -3, z: 10, flipX: false, hidden: false }, assets: [] }])) };
  }
  function position(element, state) {
    Object.assign(element.style, { left: state.x + '%', top: state.y + '%', width: state.width + '%', zIndex: state.z, transform: 'translate(-50%, -50%) rotate(' + state.rotation + 'deg) scaleX(' + (state.flipX ? -1 : 1) + ')', display: state.hidden ? 'none' : '' });
  }
  const safeImage = value => {
    if (typeof value !== 'string' || !value.trim()) return '';
    try { const url = new URL(value, document.baseURI); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  };
  // Public flowers grow from the paper's edges. Keep plant sizes intact when a
  // landscape photo shortens the frame; scaling every y coordinate used to
  // leave disconnected sprigs above the picture and crowded plants below it.
  function publicArrangement(profile, ratio) {
    ratio = Number.isFinite(ratio) && ratio > 0 ? ratio : .75;
    const original = profile.portrait;
    const paperWidth = Math.min(76, original.width + 4);
    const scale = paperWidth / original.width;
    const paperHeight = paperWidth / ratio;
    const paperTop = 14, paperBottom = paperTop + paperHeight;
    const originalHeight = original.width / .75;
    const originalTop = original.y * 1.2 - originalHeight / 2;
    const originalBottom = original.y * 1.2 + originalHeight / 2;
    const projected = profile.assets.map(asset => {
      const width = asset.width * (ratio > 1.15 ? .9 : 1);
      const angle = asset.rotation * Math.PI / 180;
      const assetRatio = byId[asset.source].ratio;
      const halfX = (width * Math.abs(Math.cos(angle)) + width / assetRatio * Math.abs(Math.sin(angle))) / 2;
      const halfY = (width * Math.abs(Math.sin(angle)) + width / assetRatio * Math.abs(Math.cos(angle))) / 2;
      const x = Math.min(98 - halfX, Math.max(2 + halfX, 50 + (asset.x - original.x) * scale));
      const topAnchor = asset.y < 35;
      let y = topAnchor
        ? paperTop + (asset.y * 1.2 - originalTop) * scale
        : paperBottom + (asset.y * 1.2 - originalBottom) * scale;
      const crossesPhotoCentre = x + halfX > 50 - paperWidth * .26 && x - halfX < 50 + paperWidth * .26;
      if (!topAnchor && asset.z >= original.z && crossesPhotoCentre) y = Math.max(y, paperBottom - Math.min(10, paperHeight * .16) + halfY);
      return { ...asset, width, x, y, halfY };
    });
    const top = Math.min(0, ...projected.map(asset => asset.y - asset.halfY - 3));
    const height = Math.max(paperBottom + 27, ...projected.map(asset => asset.y + asset.halfY + 4)) - top;
    return {
      aspectRatio: 100 / height,
      portrait: { ...original, x: 50, y: (paperTop + paperHeight / 2 - top) / height * 100, width: paperWidth },
      assets: projected.map(({ halfY, ...asset }) => ({ ...asset, y: (asset.y - top) / height * 100 }))
    };
  }
  function render(stage, person, index, profile, options = {}) {
    stage.replaceChildren();
    stage.classList.add('portrait-canvas');
    stage.classList.toggle('portrait-public', options.public === true);
    stage.setAttribute('aria-label', person.name + "'s portrait decoration canvas");
    const photo = document.createElement('div');
    photo.className = 'portrait-element portrait-paper'; photo.dataset.instance = 'portrait';
    const image = document.createElement('img'); image.draggable = false;
    let publicPhotoRatio = 0;
    const decorationElements = [];
    function arrange(ratio) {
      if (options.public !== true) return;
      publicPhotoRatio = ratio;
      const arrangement = publicArrangement(profile, ratio);
      stage.style.aspectRatio = String(arrangement.aspectRatio);
      photo.style.aspectRatio = String(ratio);
      position(photo, arrangement.portrait);
      decorationElements.forEach((element, index) => position(element, arrangement.assets[index]));
    }
    if (options.public === true) {
      const portrait = safeImage(person.image), preview = safeImage(person.previewImage), source = portrait || preview;
      if (source) {
        image.alt = person.name;
        image.width = portrait ? person.imageWidth || 360 : person.previewWidth || 360;
        image.height = portrait ? person.imageHeight || 480 : person.previewHeight || 480;
        const ratio = image.width / image.height;
        if (portrait && Number.isFinite(ratio) && ratio > 0) publicPhotoRatio = ratio;
        image.addEventListener('load', () => {
          const actual = image.naturalWidth / image.naturalHeight;
          if (portrait && Number.isFinite(actual) && actual > 0 && Math.abs(actual - publicPhotoRatio) > .01) arrange(actual);
        });
        image.decoding = 'async'; image.loading = 'eager';
        photo.append(image);
        if (!portrait) photo.classList.add('portrait-cutout');
        if (window.MIT_PHOTO_LOADER) {
          const loader = window.MIT_PHOTO_LOADER.create(image);
          const item = { title: person.name, file: source, thumbnail: safeImage(person.imageThumbnail) || source };
          loader.show(item, [item], 0);
        } else image.src = source;
      } else {
        photo.classList.add('portrait-monogram');
        const initial = document.createElement('span'); initial.className = 'portrait-initial';
        initial.textContent = String(person.name || '').split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('');
        initial.setAttribute('aria-hidden', 'true'); photo.append(initial);
        photo.setAttribute('aria-label', person.name);
      }
    } else {
      if (person.image) { image.src = person.image; image.alt = person.name; }
      else { image.src = person.previewImage || 'assets/images/exco-world/characters/pose-' + String(index + 1).padStart(2, '0') + '.webp'; image.alt = ''; photo.classList.add('portrait-pending'); }
      photo.append(image);
      if (!person.image) { const note = document.createElement('span'); note.textContent = 'portrait coming soon'; photo.append(note); }
    }
    position(photo, profile.portrait); stage.append(photo);
    for (const asset of profile.assets) {
      const image = document.createElement('img');
      image.className = 'portrait-element portrait-decoration'; image.dataset.instance = asset.id;
      const definition = byId[asset.source];
      const source = options.public === true ? deliverySource(definition) : definition.src;
      // Dialogs are created only when opened. Their tiny decorations can load
      // immediately instead of waiting behind the forest's scenery queue.
      image.width = 320; image.height = Math.round(320 / definition.ratio);
      image.loading = 'eager'; image.src = source;
      image.alt = ''; image.draggable = false; image.decoding = 'async';
      image.setAttribute('aria-hidden', 'true');
      position(image, asset); decorationElements.push(image); stage.append(image);
    }
    if (options.public === true) arrange(publicPhotoRatio || .75);
    return stage;
  }
  return { people, assets, byId, blank, validate, position, render, publicArrangement, deliverySource };
});
