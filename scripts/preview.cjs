'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createForestDraftHandler } = require('./forest-draft-store.cjs');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function createPreviewServer({ root = path.resolve(__dirname, '..') } = {}) {
  root = path.resolve(root);
  const draft = createForestDraftHandler({ root });
  return http.createServer((req, res) => {
    let url;
    try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); if (url.includes('\0')) throw new Error('Invalid URL'); }
    catch { res.writeHead(400); return res.end('Invalid URL'); }
    if (url === '/api/forest-layout' || url.startsWith('/api/forest-layout/')) { void draft(req, res, url); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end('Method not allowed'); }
    const file = path.resolve(root, '.' + (url === '/' ? '/index.html' : url));
    if (!file.startsWith(root + path.sep) || path.relative(root, file).toLowerCase().split(path.sep).includes('.editor')) { res.writeHead(403); return res.end('Forbidden'); }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Length': stat.size });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    });
  });
}

if (require.main === module) createPreviewServer().listen(4173, '127.0.0.1', () => console.log('MIT preview: http://127.0.0.1:4173'));
module.exports = { createPreviewServer };
