/* Public, read-only spreadsheet content. The approved local site is always the fallback. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MIT_CMS = api.start(root);
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const HEADERS = ['Section', 'ID', 'Title', 'Text', 'Image_URL', 'Link_URL', 'Date', 'Time', 'Status'];
  const SECTIONS = new Set(['page', 'make', 'photo', 'moment', 'workshop', 'profile', 'pose', 'field', 'setting']);
  const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const posterId = file => String(file || '').split(/[?#]/)[0].split('/').pop().replace(/\.[a-z0-9]+$/i, '');
  const safeUrl = (value, local = false) => {
    if (!value || typeof value !== 'string') return '';
    const input = value.trim();
    if (local && /^assets\/images\/[a-z0-9_./-]+$/i.test(input) && !input.split('/').includes('..')) return input;
    try { const u = new URL(input); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; }
    catch { return ''; }
  };
  const csvUrl = value => {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && u.hostname === 'docs.google.com' && !u.username && !u.password &&
        /^\/spreadsheets\/d\/(?:e\/)?[a-z0-9_-]+\/pub$/.test(u.pathname.toLowerCase()) && u.searchParams.get('output') === 'csv' ? u.href : '';
    } catch { return ''; }
  };
  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const timeRange = text => {
    if (!text) return null;
    const match = /^([0-2]\d:[0-5]\d)\s*[-–]\s*([0-2]\d:[0-5]\d)$/.exec(text);
    return match && +match[1].slice(0, 2) < 24 && +match[2].slice(0, 2) < 24 && match[1] < match[2] ? { start: match[1], end: match[2] } : null;
  };
  function parse(text, Papa) {
    if (typeof text !== 'string' || text.length > 1048576 || /^\s*</.test(text)) throw new Error('The link did not return a CSV spreadsheet.');
    const result = Papa.parse(text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim(), dynamicTyping: false });
    if (result.errors.length || result.meta.renamedHeaders && Object.keys(result.meta.renamedHeaders).length ||
        !['Section', 'ID'].every(h => result.meta.fields?.includes(h))) throw new Error('Check the CSV headers and quoted cells.');
    if (result.data.length > 1000) throw new Error('The content sheet is limited to 1,000 rows.');
    const rows = [], warnings = [], used = new Set();
    result.data.forEach((source, index) => {
      const row = Object.fromEntries(HEADERS.map(h => [h, String(source[h] || '').trim()]));
      row.Section = row.Section.toLowerCase(); row.Status = row.Status.toLowerCase() || 'auto';
      if (!SECTIONS.has(row.Section) || !/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(row.ID) || row.ID.split('.').some(x => ['__proto__', 'constructor', 'prototype'].includes(x))) { warnings.push('Row ' + (index + 2) + ': unknown Section or ID.'); return; }
      const key = row.Section + ':' + row.ID;
      if (used.has(key)) throw new Error('Duplicate Section/ID: ' + key);
      used.add(key);
      if (Object.values(row).some(value => value.length > 5000)) throw new Error('A content cell is too long.');
      if (['old', 'archived'].includes(row.Status)) row.Status = 'past';
      if (['published', 'live'].includes(row.Status)) row.Status = 'auto';
      if (row.Status === 'draft') row.Status = 'hidden';
      if (!['auto', 'past', 'hidden'].includes(row.Status)) { warnings.push('Row ' + (index + 2) + ': use auto, past or hidden.'); return; }
      for (const field of ['Image_URL', 'Link_URL']) if (row[field]) {
        const url = safeUrl(row[field], field === 'Image_URL');
        // A Drive viewer link is a page, not a publicly served image file.
        if (!url || field === 'Image_URL' && /^https:\/\/(?:drive|docs)\.google\.com\//.test(url)) {
          warnings.push('Row ' + (index + 2) + ': ' + field + ' needs a public HTTPS ' + (field === 'Image_URL' ? 'image URL.' : 'link.'));
          row[field] = '';
        } else row[field] = url;
      }
      if (row.Section === 'workshop' && row.Status !== 'hidden') {
        if (row.Date && !validDate(row.Date)) { warnings.push('Row ' + (index + 2) + ': Date must be YYYY-MM-DD.'); return; }
        if (row.Time && !timeRange(row.Time)) { warnings.push('Row ' + (index + 2) + ': Time must be HH:mm-HH:mm.'); return; }
      }
      rows.push(Object.freeze(row));
    });
    if (result.data.length && !rows.length) throw new Error('No valid content rows were found.');
    return { rows, warnings };
  }
  const idFor = (section, item) => section === 'make' ? item.match : section === 'profile' ? item._cmsId || slug(item.name) : item.id || posterId(item.file);
  function merge(section, seeds, rows) {
    const records = new Map(rows.filter(r => r.Section === section).map(r => [r.ID, r]));
    const fields = new Map(rows.filter(r => r.Section === 'field' && r.Status !== 'hidden').map(r => [r.ID, r.Text]));
    const poses = new Map(rows.filter(r => r.Section === 'pose' && r.Status !== 'hidden').map(r => [r.ID, r]));
    const mergeOne = (base, row, id) => {
      const item = { ...base };
      if (section === 'profile') item._cmsId = id;
      if (row?.Title) item[section === 'profile' ? 'name' : 'title'] = row.Title;
      if (row?.Text) item[section === 'profile' ? 'bio' : 'description'] = row.Text;
      if (row?.Image_URL) {
        const image = section === 'make' ? 'image' : section === 'profile' ? 'image' : 'file';
        if (item[image] !== row.Image_URL) {
          item.fallbackFile = item[image] || '';
          item[image] = row.Image_URL;
          if (section === 'profile') item.imageThumbnail = base.imageThumbnail || base.image || row.Image_URL;
          else item.thumbnail = row.Image_URL;
          if (section === 'make') item.cmsImage = true;
        }
      }
      if (row?.Link_URL) item[section === 'profile' ? 'personalLink' : 'signupUrl'] = row.Link_URL;
      if (section === 'profile') {
        if (row?.Status === 'hidden') item.cmsHidden = true;
        if (poses.get(id)?.Image_URL) item.previewImage = poses.get(id).Image_URL;
        const term = rows.find(r => r.Section === 'setting' && r.ID === 'committee-term' && r.Status !== 'hidden')?.Text;
        if (term) item.term = term;
      }
      if (section === 'workshop') {
        item.id = id; item.kind = 'poster';
        if (row?.Date) { if (row.Date !== base.date) item.dateLabel = ''; item.date = row.Date; }
        const range = timeRange(row?.Time);
        if (range) { item.endTime = range.end; item.dateLabel = 'Workshop · ' + range.start + '–' + range.end; }
        if (row?.Text) item.archiveSummary = row.Text;
        if (row) item.archiveStatus = row.Status === 'past' ? 'past' : 'auto';
      }
      if (section === 'photo' && row?.Date && validDate(row.Date)) item.date = row.Date;
      const allowed = { profile: ['bio', 'role', 'programme', 'year', 'favouriteCraft', 'funFact', 'term'], make: ['label'], photo: ['category'], workshop: ['location', 'spots'] }[section] || [];
      for (const field of allowed) if (fields.has(`${section}.${id}.${field}`)) item[field] = fields.get(`${section}.${id}.${field}`);
      return item;
    };
    const output = seeds.flatMap(base => {
      const id = idFor(section, base), row = records.get(id); records.delete(id);
      return row?.Status === 'hidden' && section !== 'profile' ? [] : [mergeOne(base, row, id)];
    });
    if (section !== 'profile') for (const [id, row] of records) {
      if (row.Status === 'hidden' || !row.Title || !row.Image_URL || section === 'workshop' && !row.Date) continue;
      output.push(mergeOne(section === 'make' ? { match: id, label: 'Making', photoIds: [] } : { id, category: 'Workshop', width: 640, height: 480 }, row, id));
    }
    return output;
  }
  function start(win) {
    const doc = win.document, config = win.MIT_SHEET_CMS_CONFIG || {}, url = csvUrl(config.url), listeners = new Set();
    const refreshMs = Math.max(30000, Math.min(300000, Number(config.refreshMs) || 60000));
    const key = 'mit-public-sheet-cms-v1:' + url;
    const baseContent = JSON.parse(JSON.stringify(win.MIT_CONTENT || {}));
    const images = new WeakMap(), texts = new WeakMap(), links = new WeakMap();
    let rows = [], signature = '', timer = 0, inFlight = null, error = '', warnings = [], source = 'bundled';
    function setting(id) { return rows.find(r => r.Section === 'setting' && r.ID === id && r.Status !== 'hidden'); }
    function settings() {
      const instagram = setting('instagram');
      if (win.MIT_CONTENT) {
        win.MIT_CONTENT.instagramUrl = instagram?.Link_URL || baseContent.instagramUrl;
        win.MIT_CONTENT.instagramHandle = instagram?.Text || baseContent.instagramHandle;
        win.MIT_CONTENT.committeeTerm = setting('committee-term')?.Text || baseContent.committeeTerm;
        const join = setting('joining');
        win.MIT_CONTENT.joinUrl = join?.Link_URL || baseContent.joinUrl;
        win.MIT_CONTENT.joinLabel = join?.Text || baseContent.joinLabel;
      }
    }
    function image(el, value) {
      const current = el.dataset.sceneSrc || el.getAttribute('src');
      if (new URL(current || '', doc.baseURI).href === new URL(value, doc.baseURI).href) return;
      if (!images.has(el)) images.set(el, { original: current });
      el.removeAttribute('data-cms-image-failed'); el.classList.remove('cms-image-fallback');
      el.dataset.cmsFallback = images.get(el).original || 'assets/images/MITLogo_Web.webp';
      el.removeAttribute('srcset'); el.removeAttribute('sizes');
      if (el.closest?.('#people') && win.MIT_IMAGES) win.MIT_IMAGES.set(el, value);
      else { win.MIT_IMAGES?.enhance?.(el, value); el.src = value; }
    }
    function applyPage() {
      const pages = new Map(rows.filter(r => r.Section === 'page').map(r => [r.ID, r]));
      doc.querySelectorAll('[data-cms]').forEach(el => {
        if (!texts.has(el)) texts.set(el, { text: el.textContent, hidden: el.hidden });
        const row = pages.get(el.dataset.cms), base = texts.get(el);
        el.textContent = row?.Text || base.text;
        el.hidden = row ? row.Status === 'hidden' : base.hidden;
      });
      doc.querySelectorAll('[data-cms-image]').forEach(el => {
        if (!images.has(el)) images.set(el, { original: el.dataset.sceneSrc || el.getAttribute('src'), alt: el.alt });
        const row = pages.get(el.dataset.cmsImage), value = row?.Image_URL || images.get(el).original;
        if (value) image(el, value);
        el.alt = row?.Title || images.get(el).alt || '';
      });
      doc.querySelectorAll('[data-cms-link]').forEach(el => { if (!links.has(el)) links.set(el, el.getAttribute('href')); const row = pages.get(el.dataset.cmsLink); el.href = row?.Link_URL || links.get(el); });
      doc.querySelectorAll('[data-project]').forEach(el => {
        el.hidden = rows.some(row => row.Section === 'make' && row.ID === el.dataset.project && row.Status === 'hidden');
      });
      if (win.MIT_CONTENT) {
        doc.querySelectorAll('[data-instagram]').forEach(el => { el.href = win.MIT_CONTENT.instagramUrl; });
        doc.querySelectorAll('.term-badge').forEach(el => { el.textContent = win.MIT_CONTENT.committeeTerm; });
        const handle = doc.getElementById('instagram-handle'); if (handle) handle.textContent = win.MIT_CONTENT.instagramHandle;
      }
      const title = doc.getElementById('hero-title');
      if (title?.hasAttribute('aria-label')) title.setAttribute('aria-label', [...title.querySelectorAll('[data-cms]')].map(el => el.textContent).join(' ') + '.');
      const hero = doc.querySelector('[data-hero-workshop]'), customHero = pages.get('hero-art')?.Image_URL;
      hero?.classList.toggle('cms-custom-hero', !!customHero && !/\/assets\/images\/atelier-v6\/workshop(?:\.perf-\d+)?\.webp$/.test(new URL(customHero, doc.baseURI).pathname));
    }
    function publish(next, nextSource) {
      const sig = JSON.stringify(next); source = nextSource;
      if (sig === signature) return false;
      rows = next; signature = sig; settings(); applyPage();
      for (const listener of listeners) { try { listener(); } catch (e) { win.console.error('A content section could not refresh.', e); } }
      return true;
    }
    function schedule() { win.clearTimeout(timer); if (url && !doc.hidden) timer = win.setTimeout(refresh, refreshMs); }
    async function refresh() {
      if (!url || doc.hidden) return false;
      if (inFlight) return inFlight;
      win.clearTimeout(timer);
      const controller = new win.AbortController(), deadline = win.setTimeout(() => controller.abort(), 10000);
      inFlight = (async () => {
        try {
          const request = new URL(url); request.searchParams.set('_', String(Date.now()));
          const response = await win.fetch(request.href, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
          if (!response.ok) throw new Error('Google Sheet is temporarily unavailable.');
          const text = await response.text(), parsed = parse(text, win.Papa);
          warnings = parsed.warnings; error = '';
          const changed = publish(parsed.rows, 'sheet');
          try { win.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), text })); } catch { /* Storage is optional. */ }
          return changed;
        } catch (e) { error = e.name === 'AbortError' ? 'The sheet timed out; keeping the saved site content.' : e.message; return false; }
        finally { win.clearTimeout(deadline); inFlight = null; schedule(); }
      })();
      return inFlight;
    }
    const api = Object.freeze({
      enabled: !!url, refresh, applyPage, headers: HEADERS,
      subscribe(listener) { listeners.add(listener); if (signature) listener(); return () => listeners.delete(listener); },
      collection: (section, seeds) => merge(section, seeds, rows),
      row: (section, id) => rows.find(r => r.Section === section && r.ID === id),
      status: () => ({ enabled: !!url, source, refreshing: !!inFlight, error, warnings: warnings.slice(), rows: rows.length })
    });
    doc.addEventListener('error', event => {
      const el = event.target; if (el?.tagName !== 'IMG' || !el.dataset.cmsFallback || el.dataset.cmsImageFailed) return;
      el.dataset.cmsImageFailed = 'true';
      let fallback = safeUrl(el.dataset.cmsFallback, true) || 'assets/images/MITLogo_Web.webp';
      if (new URL(fallback, doc.baseURI).href === new URL(el.getAttribute('src') || '', doc.baseURI).href) fallback = 'assets/images/MITLogo_Web.webp';
      image(el, fallback); el.classList.add('cms-image-fallback'); el.removeAttribute('data-cms-fallback');
    }, true);
    if (url) {
      try { const cached = JSON.parse(win.localStorage.getItem(key)); if (cached && Date.now() - cached.savedAt < 86400000) { const parsed = parse(cached.text, win.Papa); publish(parsed.rows, 'cache'); warnings = parsed.warnings; } } catch { /* The bundled site is already complete. */ }
      doc.addEventListener('visibilitychange', () => { win.clearTimeout(timer); if (!doc.hidden) refresh(); });
      win.addEventListener('online', refresh);
      // Do not put an external request on the critical content or forest path.
      win.setTimeout(refresh, 0);
    }
    return api;
  }
  return Object.freeze({ HEADERS, slug, posterId, safeUrl, csvUrl, validDate, timeRange, parse, merge, start });
});
