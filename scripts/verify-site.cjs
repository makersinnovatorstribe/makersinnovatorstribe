'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const workspace = path.resolve(__dirname, '../..');
const rootArg = process.argv.indexOf('--root');
const root = rootArg < 0 ? path.join(workspace, 'site') : path.resolve(process.argv[rootArg + 1]);
const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(root), path.basename(root) + '-manifest.json'), 'utf8'));
const paths = new Set(manifest.files.map(file => file.path));
const failures = [];
for (const file of manifest.files) {
  if (!/\.(?:html|css|js|json)$/.test(file.path)) continue;
  const text = fs.readFileSync(path.join(root, file.path), 'utf8');
  for (const match of text.matchAll(/["'`]((?:\.\.\/)?(?:assets|scripts|styles)\/[^"'`\s<>]+\.(?:webp|png|jpe?g|svg|json|js|css|html))(?:[?#][^"'`\s<>]*)?["'`]/g)) {
    const relative = match[1].startsWith('../') ? path.posix.normalize(path.posix.join(path.posix.dirname(file.path), match[1])) : match[1];
    if (!paths.has(relative)) failures.push(file.path + ': ' + relative);
  }
}
if (failures.length) throw new Error('Missing or incorrectly cased publishing paths:\n' + failures.join('\n'));
console.log('Verified literal asset references and exact filename case in ' + paths.size + ' publishing files.');
if (process.argv.includes('--serve')) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:4174');
    const prefix = '/makersinnovatorstribe/';
    if (!url.pathname.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    if (!paths.has(relative)) { console.log('404 ' + relative); res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(relative)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(path.join(root, relative)).pipe(res);
  }).listen(4174, '127.0.0.1', () => console.log('Publishing preview: http://127.0.0.1:4174/makersinnovatorstribe/'));
}
