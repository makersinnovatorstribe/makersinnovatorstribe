/* Create the standalone publishing folder without moving the editable project. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const source = path.resolve(__dirname, '..');
const workspace = path.dirname(source);
const outputIndex = process.argv.indexOf('--output');
if (outputIndex !== -1 && !process.argv[outputIndex + 1]) throw new Error('--output needs a folder path.');
const destination = outputIndex === -1 ? path.join(workspace, 'site') : path.resolve(source, process.argv[outputIndex + 1]);
if (!destination.startsWith(workspace + path.sep) || destination === source || source.startsWith(destination + path.sep)) throw new Error('Publishing output must be a separate folder inside the workspace.');
const manifestFile = path.join(path.dirname(destination), path.basename(destination) + '-manifest.json');
const files = new Set(['index.html', 'pages/main.html', 'scripts/committee.json', 'scripts/photos.json', 'scripts/posters.json']);
const html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="((?:scripts|styles)\/[^"?#]+\.(?:js|css))"/g)) files.add(match[1]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Publishing cannot include symlinks: ' + file);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
// Keep web delivery variants, including dynamically selected forest templates.
for (const file of walk(path.join(source, 'assets'))) {
  if (/\.(?:webp|svg)$/i.test(file)) files.add(path.relative(source, file).split(path.sep).join('/'));
}
for (const name of ['hammer', 'fired-up', 'little-maker']) files.add('assets/images/mascots/mit-mascot-' + name + '.png');
// Explicit JSON paths also cover the source-image fields retained in crew data.
for (const file of [...files].filter(file => file.endsWith('.json'))) {
  const text = fs.readFileSync(path.join(source, file), 'utf8');
  for (const match of text.matchAll(/"(assets\/[^"?#]+\.(?:png|jpe?g|webp|svg))"/g)) files.add(match[1]);
}

function outputPath(relative) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => part === '..' || part === '.git')) throw new Error('Unsafe publishing path: ' + relative);
  const result = path.resolve(destination, relative);
  if (!result.startsWith(destination + path.sep)) throw new Error('Path outside site: ' + relative);
  return result;
}
const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
if (fs.existsSync(destination) && !previous) throw new Error('An existing site folder has no build manifest; preserve it before rebuilding.');
const next = new Set([...files, '.nojekyll']);
// Only retire files recorded by this builder, preserving anything added by hand.
for (const file of previous?.files || []) {
  if (!next.has(file.path) && fs.existsSync(outputPath(file.path))) fs.unlinkSync(outputPath(file.path));
}
fs.mkdirSync(destination, { recursive: true });
for (const relative of files) {
  const input = path.join(source, relative);
  if (!fs.existsSync(input) || !fs.statSync(input).isFile()) throw new Error('Missing deployment file: ' + relative);
  const target = outputPath(relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(input, target);
}
fs.writeFileSync(path.join(destination, '.nojekyll'), '');
const entries = [...next].sort().map(relative => {
  const content = fs.readFileSync(outputPath(relative));
  return { path: relative, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex'), gitSha: crypto.createHash('sha1').update('blob ' + content.length + '\0').update(content).digest('hex') };
});
fs.writeFileSync(manifestFile, JSON.stringify({ source, destination, files: entries, bytes: entries.reduce((total, item) => total + item.bytes, 0) }, null, 2) + '\n');
console.log(JSON.stringify({ folder: destination, files: entries.length, megabytes: +(entries.reduce((total, item) => total + item.bytes, 0) / 1048576).toFixed(2) }));
