/* Export existing public content for a single, editable Google Sheets CMS tab. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Papa = require('./vendor/papaparse-5.7.0.min.js');
const cms = require('./sheet-cms.js');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/content.js'), 'utf8'), context);
const content = context.window.MIT_CONTENT;
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'scripts', name + '.json'), 'utf8'));
const rows = [];
const add = (Section, ID, values = {}) => rows.push(Object.fromEntries(cms.HEADERS.map(h => [h, h === 'Section' ? Section : h === 'ID' ? ID : h === 'Status' ? 'auto' : values[h] || ''])));
// Existing deployed assets keep their portable paths. New uploads use public HTTPS URLs.
const image = file => file || '';
const decode = text => text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/<([a-z\d]+)\b[^>]*data-cms="([^"]+)"[^>]*>([^<]*)<\/\1>/gi)) add('page', match[2], { Text: decode(match[3]) });
const imageIds = new Set();
for (const match of html.matchAll(/<img\b[^>]*data-cms-image="([^"]+)"[^>]*>/gi)) {
  if (imageIds.has(match[1])) continue;
  imageIds.add(match[1]); add('page', match[1], { Title: decode(/\balt="([^"]*)"/.exec(match[0])?.[1] || ''), Image_URL: image(/\bsrc="([^"]+)"/.exec(match[0])?.[1]) });
}
for (const p of [...content.projects, ...content.extraProjects]) {
  add('make', p.match, { Title: p.title, Text: p.description, Image_URL: image(p.image) });
  add('field', 'make.' + p.match + '.label', { Text: p.label });
}
const photos = read('photos');
for (const p of photos) {
  add('photo', p.id, { Title: p.title, Text: p.description, Image_URL: image(p.file), Date: p.date || '' });
  add('field', 'photo.' + p.id + '.category', { Text: p.category });
}
for (const [id, title] of [['orientation-community','Find your people.'],['strawberry-session','A little figuring it out.'],['embroidery-session','A lot of making it happen.'],['rug-community','Good people. Very good ideas.']]) add('moment', id, { Title: title });
const times = { 'october-tufting': '12:00-16:00', 'october-sewing': '14:00-16:30', 'upcycling-pouch': '14:00-16:30' };
for (const p of read('posters')) {
  const id = p.id || cms.posterId(p.file);
  add('workshop', id, { Title: p.title, Text: p.archiveSummary || p.description, Image_URL: image(p.file), Link_URL: p.signupUrl, Date: p.date, Time: p.timeRange || times[id] || '' });
  for (const field of ['location', 'spots']) if (p[field]) add('field', 'workshop.' + id + '.' + field, { Text: p[field] });
}
for (const p of read('committee')) {
  const id = cms.slug(p.name);
  add('profile', id, { Title: p.name, Text: p.bio, Image_URL: image(p.image), Link_URL: p.personalLink });
  for (const field of ['role', 'programme', 'year', 'favouriteCraft', 'funFact']) add('field', 'profile.' + id + '.' + field, { Text: p[field] });
  add('pose', id, { Image_URL: image(p.previewImage) });
}
add('setting', 'instagram', { Text: content.instagramHandle, Link_URL: content.instagramUrl });
add('setting', 'committee-term', { Text: content.committeeTerm });
add('setting', 'joining', { Text: content.joinLabel, Link_URL: content.joinUrl });
const output = path.join(root, 'deliverables', 'sheet-cms');
fs.mkdirSync(output, { recursive: true });
const publicTemplates = path.join(root, 'cms', 'templates');
fs.mkdirSync(publicTemplates, { recursive: true });
for (const [name, data] of [['MIT-Website-CMS.csv', rows], ['MIT-Workshops-Only.csv', rows.filter(r => r.Section === 'workshop')], ['three-sample-rows.csv', [rows.find(r => r.ID === 'hero-description'), rows.find(r => r.Section === 'make'), rows.find(r => r.Section === 'workshop')].filter(Boolean)]]) {
  const csv = Papa.unparse(data, { columns: cms.HEADERS, newline: '\r\n', escapeFormulae: true });
  fs.writeFileSync(path.join(output, name), csv + '\r\n');
  if (name === 'MIT-Website-CMS.csv' || name === 'MIT-Workshops-Only.csv') fs.writeFileSync(path.join(publicTemplates, name), csv + '\r\n');
  cms.parse(csv, Papa);
}
console.log('Exported ' + rows.length + ' existing-content rows and ' + read('posters').length + ' workshop sessions; no invented profiles or upcoming events.');
