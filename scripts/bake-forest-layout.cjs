/* Run only after the author approves a finished draft. Never modifies the
   editor's current record or recovery history. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateLayout } = require('./forest-draft-store.cjs');
const root = path.resolve(__dirname, '..');
const record = JSON.parse(fs.readFileSync(path.join(root, '.editor/woodland-layout.json'), 'utf8'));
const layout = validateLayout(record.layout);
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'forest-asset-library.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'forest-path-options.js'), 'utf8'), context);
const known = new Set(['ground', 'path', 'creek', ...Array.from({ length: 10 }, (_, i) => 'floor-' + i), ...Array.from({ length: 11 }, (_, i) => 'person-' + i)]);
for (let scene = 0; scene < 3; scene++) {
  for (const id of ['grove', 'station', 'edge-tree', 'fern', ...Array.from({ length: scene === 2 ? 2 : 3 }, (_, i) => 'tree-' + i), ...Array.from({ length: 4 }, (_, i) => 'lamp-' + i)]) known.add('s' + scene + '-' + id);
  if (scene < 2) known.add('s' + scene + '-bench');
}
known.add('s1-front-birch');
context.window.MIT_FOREST_ASSET_LIBRARY.forEach(item => known.add(item.id));
for (const copy of layout.duplicates) {
  if (!known.has(copy.source) || known.has(copy.id)) throw new Error('Unresolved copy: ' + copy.id);
  known.add(copy.id);
}
for (const id of Object.keys(layout.assets)) if (!known.has(id)) throw new Error('Unresolved placement: ' + id);
for (const key of ['path', 'creek']) if (!context.window.MIT_FOREST_PATH_OPTIONS.some(option => option.id === layout[key])) throw new Error('Unresolved ' + key);
const output = { designWidth: 390, revision: record.revision, savedAt: record.savedAt, layout };
fs.writeFileSync(path.join(__dirname, 'forest-baked-layout.js'), '/* Approved 390px composition. Source snapshot: .editor/baked-390-layout.json */\nwindow.MIT_FOREST_BAKED = ' + JSON.stringify(output, null, 2) + ';\n');
fs.writeFileSync(path.join(root, '.editor/baked-390-layout.json'), JSON.stringify(record, null, 2) + '\n');
console.log('Baked ' + Object.keys(layout.assets).length + ' adjustments and ' + layout.duplicates.length + ' independent copies at 390px.');
