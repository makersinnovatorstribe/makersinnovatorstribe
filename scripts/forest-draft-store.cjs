'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_BYTES = 256 * 1024;
const HISTORY_ID = /^\d{8}T\d{9}Z-[a-f0-9]{64}$/;
const SAFE_ID = /^[a-zA-Z0-9][\w-]{0,119}$/;
const REVISION = /^[a-f0-9]{64}$/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

class DraftError extends Error {
  constructor(status, message, details = {}) { super(message); this.status = status; this.details = details; }
}

// The server accepts layout data only; no JSON field ever becomes a file path.
// Keep these numeric limits in step with the editor's import validator.
function validateLayout(value) {
  if (!plain(value) || value.version !== 1 || !plain(value.assets)) throw new DraftError(400, 'Expected a version 1 woodland layout with an assets object.');
  if (!Array.isArray(value.duplicates) || value.duplicates.length > 80) throw new DraftError(400, 'The duplicate list must contain at most 80 entries.');
  const allowed = new Set(['version', 'assets', 'duplicates', 'path', 'creek', 'background', 'editedAt']);
  if (Object.keys(value).some(key => !allowed.has(key))) throw new DraftError(400, 'Unexpected layout field.');
  const result = { version: 1, path: value.path, creek: value.creek, background: value.background, assets: {}, duplicates: [] };
  for (const key of ['path', 'creek', 'background']) if (typeof value[key] !== 'string' || !SAFE_ID.test(value[key])) throw new DraftError(400, 'Invalid ' + key + ' choice.');
  if (Object.keys(value.assets).length > 256) throw new DraftError(400, 'Too many asset adjustments.');
  for (const [id, state] of Object.entries(value.assets)) {
    if (!SAFE_ID.test(id) || ['constructor', 'prototype', '__proto__'].includes(id) || !plain(state)) throw new DraftError(400, 'Invalid asset adjustment.');
    const clean = {};
    const limits = { x: [-500, 500], y: [-1000, 1000], scale: [.1, 5], z: [-20, 200], glow: [0, 2], glowSize: [.5, 2.5] };
    for (const [key, entry] of Object.entries(state)) {
      if (key === 'hidden') { if (typeof entry !== 'boolean') throw new DraftError(400, 'Asset hidden must be true or false.'); clean.hidden = entry; }
      else if (own(limits, key)) {
        const [low, high] = limits[key];
        if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < low || entry > high) throw new DraftError(400, 'Invalid asset ' + key + '.');
        clean[key] = entry;
      } else throw new DraftError(400, 'Unexpected asset field.');
    }
    result.assets[id] = clean;
  }
  const copies = new Set();
  for (const item of value.duplicates) {
    if (!plain(item) || Object.keys(item).some(key => !['source', 'id'].includes(key)) ||
        typeof item.source !== 'string' || !SAFE_ID.test(item.source) ||
        typeof item.id !== 'string' || !/^copy-[\w-]{1,110}$/.test(item.id) || copies.has(item.id) || item.id === item.source) throw new DraftError(400, 'Invalid duplicate asset.');
    copies.add(item.id); result.duplicates.push({ source: item.source, id: item.id });
  }
  if (value.editedAt !== undefined) {
    if (typeof value.editedAt !== 'string' || value.editedAt.length > 40 || !Number.isFinite(Date.parse(value.editedAt))) throw new DraftError(400, 'Invalid edit timestamp.');
    result.editedAt = value.editedAt;
  }
  return result;
}

function validatePayload(value) {
  if (!plain(value) || !own(value, 'layout') || Object.keys(value).some(key => !['layout', 'revision', 'reason'].includes(key))) throw new DraftError(400, 'Expected layout, optional revision and save reason.');
  if (own(value, 'revision') && value.revision !== null && (typeof value.revision !== 'string' || !REVISION.test(value.revision))) throw new DraftError(400, 'Invalid saved revision.');
  if (value.reason !== undefined && !['save', 'autosave'].includes(value.reason)) throw new DraftError(400, 'Invalid save reason.');
  return { layout: validateLayout(value.layout), reason: value.reason || 'save', ...(own(value, 'revision') ? { revision: value.revision } : {}) };
}

function stableJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJSON).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJSON(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
const digest = layout => crypto.createHash('sha256').update(stableJSON(layout)).digest('hex');
const historyId = record => record.savedAt.replace(/[-:.]/g, '') + '-' + record.revision;

async function atomicWrite(file, text) {
  const temporary = file + '.' + process.pid + '-' + crypto.randomBytes(8).toString('hex') + '.tmp';
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close(); handle = null;
    // Node's rename replaces an existing regular file on Windows atomically.
    // Never unlink the current layout first: a failed rename leaves it intact.
    await fs.rename(temporary, file);
    if (await fs.readFile(file, 'utf8') !== text) throw new Error('Saved layout readback did not match.');
  } finally {
    if (handle) await handle.close().catch(() => {});
    await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

function createForestDraftStore({ root }) {
  if (!root) throw new TypeError('A project root is required.');
  const directory = path.join(path.resolve(root), '.editor');
  const historyDirectory = path.join(directory, 'history');
  const currentFile = path.join(directory, 'woodland-layout.json');
  let queue = Promise.resolve();
  const serial = operation => {
    const pending = queue.then(operation);
    queue = pending.catch(() => {});
    return pending;
  };

  async function readRecord(file, missingOkay = false) {
    let raw;
    try { raw = await fs.readFile(file, 'utf8'); }
    catch (error) { if (missingOkay && error.code === 'ENOENT') return null; throw error; }
    if (Buffer.byteLength(raw) > MAX_BYTES * 2) throw new Error('Saved layout exceeds the storage limit.');
    const record = JSON.parse(raw);
    if (!plain(record) || typeof record.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.savedAt) || !Number.isFinite(Date.parse(record.savedAt)) || !REVISION.test(record.revision) || !['save', 'autosave'].includes(record.reason)) throw new Error('Saved layout record is invalid.');
    record.layout = validateLayout(record.layout);
    if (record.revision !== digest(record.layout)) throw new Error('Saved layout checksum does not match.');
    return record;
  }
  async function history() {
    let files;
    try { files = await fs.readdir(historyDirectory); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const entries = [];
    for (const file of files) {
      if (!file.endsWith('.json') || !HISTORY_ID.test(file.slice(0, -5))) continue;
      // A damaged history entry must not make the intact current draft unusable.
      try { const record = await readRecord(path.join(historyDirectory, file)); entries.push({ id: file.slice(0, -5), savedAt: record.savedAt, reason: record.reason }); }
      catch { /* Leave the damaged file untouched for manual recovery. */ }
    }
    return entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.id.localeCompare(a.id));
  }
  async function response(record) {
    return { layout: record?.layout || null, revision: record?.revision || null, savedAt: record?.savedAt || null, history: await history() };
  }
  async function snapshot(record) {
    const file = path.join(historyDirectory, historyId(record) + '.json');
    // Preserve the original bytes/metadata if this revision is already backed up.
    try { const existing = await readRecord(file); if (existing.revision === record.revision) return; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await atomicWrite(file, JSON.stringify(record, null, 2) + '\n');
  }
  return {
    directory,
    read: () => serial(async () => response(await readRecord(currentFile, true))),
    history: id => serial(async () => {
      if (!HISTORY_ID.test(id)) throw new DraftError(400, 'Invalid recovery version.');
      const record = await readRecord(path.join(historyDirectory, id + '.json'), true);
      if (!record) throw new DraftError(404, 'Recovery version not found.');
      return response(record);
    }),
    save: payload => serial(async () => {
      const next = validatePayload(payload);
      if (Buffer.byteLength(JSON.stringify(next)) > MAX_BYTES) throw new DraftError(413, 'Layout must be 256 KB or smaller.');
      const previous = await readRecord(currentFile, true);
      if (own(next, 'revision') && next.revision !== (previous?.revision || null)) throw new DraftError(409, 'A newer layout is already saved. Load or recover it before saving over it.', await response(previous));
      const revision = digest(next.layout);
      if (previous?.revision === revision) return response(previous);
      await fs.mkdir(historyDirectory, { recursive: true });
      if (previous) await snapshot(previous);
      const record = { layout: next.layout, revision, savedAt: new Date().toISOString(), reason: next.reason };
      // Store the new recovery snapshot first; if replacing the current file
      // fails, both the old current draft and the new recovery copy survive.
      await snapshot(record);
      await atomicWrite(currentFile, JSON.stringify(record, null, 2) + '\n');
      return response(await readRecord(currentFile));
    })
  };
}

function sendJSON(res, status, value, extra = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let length = 0, settled = false; const chunks = [];
    const fail = error => { if (!settled) { settled = true; reject(error); } };
    if (Number(req.headers['content-length']) > MAX_BYTES) { req.resume(); fail(new DraftError(413, 'Layout must be 256 KB or smaller.')); return; }
    req.on('data', chunk => {
      if (settled) return;
      length += chunk.length;
      if (length > MAX_BYTES) { chunks.length = 0; fail(new DraftError(413, 'Layout must be 256 KB or smaller.')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); settled = true; resolve(value); }
      catch { fail(new DraftError(400, 'Request body must be valid JSON.')); }
    });
    req.on('aborted', () => fail(new DraftError(400, 'Save request was interrupted.')));
    req.on('error', () => fail(new DraftError(400, 'Save request could not be read.')));
  });
}

function createForestDraftHandler({ root }) {
  const store = createForestDraftStore({ root });
  return async function handle(req, res, pathname) {
    try {
      const host = String(req.headers.host || '').toLowerCase();
      const port = req.socket.localPort;
      const localHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!localHosts.includes(host) || (req.headers.origin && req.headers.origin !== 'http://' + host) || req.headers['sec-fetch-site'] === 'cross-site') throw new DraftError(403, 'Layout saving is available only from this local preview.');
      const isRoot = pathname === '/api/forest-layout';
      const match = pathname.match(/^\/api\/forest-layout\/history\/([^/]+)$/);
      if (!isRoot && !match) throw new DraftError(404, 'Unknown layout endpoint.');
      if (req.method === 'GET') return sendJSON(res, 200, match ? await store.history(match[1]) : await store.read());
      if (req.method !== 'POST' || !isRoot) return sendJSON(res, 405, { error: 'Method not allowed.' }, { Allow: isRoot ? 'GET, POST' : 'GET' });
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new DraftError(415, 'Send the layout as application/json.');
      const saved = await store.save(await readBody(req));
      return sendJSON(res, 200, saved);
    } catch (error) {
      if (res.headersSent || res.destroyed) return;
      if (error instanceof DraftError) sendJSON(res, error.status, { error: error.message, ...error.details });
      else { console.error('Woodland draft storage:', error.message); sendJSON(res, 500, { error: 'The layout could not be read or saved on disk. Your existing files have been kept.' }); }
    }
  };
}

module.exports = { createForestDraftStore, createForestDraftHandler, validateLayout, validatePayload, MAX_BYTES };
