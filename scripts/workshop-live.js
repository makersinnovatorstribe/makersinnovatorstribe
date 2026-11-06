/* A small, optional live feed; bundled workshops remain the offline fallback. */
(() => {
  'use strict';

  const textFields = ['title', 'dateLabel', 'location', 'signupUrl', 'spots', 'description', 'label',
    'archiveSummary', 'photoLabel', 'relatedPhotosNote', 'sourceUrl'];
  const dimensions = ['width', 'height', 'thumbnailWidth', 'thumbnailHeight'];
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const validDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  const posterId = value => typeof value === 'string'
    ? value.split(/[?#]/)[0].split('/').filter(Boolean).pop()?.replace(/\.[a-z\d]+$/i, '') || '' : '';
  const imageUrl = value => {
    if (typeof value !== 'string' || !value.trim()) return '';
    const input = value.trim();
    if (/^assets\/images\//.test(input) && !/[\\\s]/.test(input) && !input.split(/[/?#]/).includes('..')) {
      const resolved = new URL(input, 'https://mit-content.invalid/');
      if (resolved.pathname.startsWith('/assets/images/')) return input;
    }
    try {
      const url = new URL(input);
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch { /* An invalid row is rejected by the caller. */ }
    return '';
  };
  const externalUrl = value => {
    if (value === '') return '';
    if (typeof value !== 'string') throw new Error('Workshop links must be text.');
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Workshop links must use HTTPS.');
    return url.href;
  };
  function normalize(rows, defaults = []) {
    if (!Array.isArray(rows) || rows.length > 200) throw new Error('Invalid workshop list.');
    const byId = new Map(defaults.map(poster => [poster.id || posterId(poster.file), poster]));
    const byFile = new Map(defaults.map(poster => [poster.file, poster]));
    const byWorkshop = new Map();
    for (const poster of defaults) {
      const key = `${poster.title}\n${poster.date}`;
      byWorkshop.set(key, byWorkshop.has(key) ? null : poster);
    }
    const ids = new Set();
    return rows.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid workshop row.');
      const id = own(row, 'id') ? row.id : posterId(row.file);
      if (typeof id !== 'string' || !/^[a-z\d][a-z\d_-]{0,119}$/i.test(id) || ids.has(id)) throw new Error('Workshop IDs must be unique stable slugs.');
      ids.add(id);
      if (!validDate(row.date)) throw new Error('Workshop date must be a real YYYY-MM-DD date.');
      const fallback = byId.get(id) || byFile.get(row.file) || byWorkshop.get(`${row.title}\n${row.date}`) || {};
      const poster = { id, kind: 'poster', date: row.date };
      if (own(row, 'archiveStatus')) {
        if (!['auto', 'past'].includes(row.archiveStatus)) throw new Error('Invalid workshop status.');
        poster.archiveStatus = row.archiveStatus;
      }
      if (own(row, 'endTime') && row.endTime !== '') {
        if (typeof row.endTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.endTime)) throw new Error('Invalid workshop end time.');
        poster.endTime = row.endTime;
      }
      const time = value => String(value || '').split('·').slice(1).join('·').trim();
      const scheduleChanged = row.date !== fallback.date || own(row, 'dateLabel') && time(row.dateLabel) !== time(fallback.dateLabel);
      for (const field of textFields) {
        // The small public sheet only supplies scheduling fields. Retain the
        // approved seed's craft copy and photo associations when omitted.
        // Explicit blanks clear fields; changed dates/times omit dated copy.
        const inherited = field === 'description' && scheduleChanged ? '' : fallback[field];
        const value = own(row, field) ? row[field] : inherited || '';
        if (typeof value !== 'string' || value.length > 5000) throw new Error('Workshop copy must be plain text.');
        poster[field] = value.trim();
      }
      if (!poster.title || poster.title.length > 200) throw new Error('A workshop title is required.');
      poster.file = imageUrl(row.file);
      if (!poster.file) throw new Error('A valid workshop poster image is required.');
      poster.thumbnail = own(row, 'thumbnail') && row.thumbnail !== '' ? imageUrl(row.thumbnail) : poster.file;
      if (!poster.thumbnail) throw new Error('Invalid poster thumbnail.');
      if (poster.file === fallback.file && poster.thumbnail === poster.file && fallback.thumbnail) poster.thumbnail = fallback.thumbnail;
      poster.signupUrl = externalUrl(poster.signupUrl);
      poster.sourceUrl = externalUrl(poster.sourceUrl);
      for (const field of dimensions) {
        const sameImage = field.startsWith('thumbnail')
          ? poster.thumbnail === (fallback.thumbnail || fallback.file)
          : poster.file === fallback.file;
        const value = own(row, field) ? row[field] : sameImage ? fallback[field] : undefined;
        if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 20000)) throw new Error('Invalid poster dimensions.');
        if (value !== undefined) poster[field] = value;
      }
      const related = own(row, 'relatedPhotoIds') ? row.relatedPhotoIds : fallback.relatedPhotoIds || [];
      if (!Array.isArray(related) || related.length > 100 || related.some(id => typeof id !== 'string' || !/^[a-z\d][a-z\d_-]{0,119}$/i.test(id))) throw new Error('Invalid related photograph IDs.');
      poster.relatedPhotoIds = [...new Set(related)];
      return Object.freeze(poster);
    });
  }
  const trustedEndpoint = value => typeof value === 'string' && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z\d_-]+\/exec$/.test(value);
  const dayInSingapore = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const value = type => parts.find(part => part.type === type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
  };
  const clockInSingapore = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Singapore', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
    return { date: dayInSingapore(now), time: `${parts.find(part => part.type === 'hour').value}:${parts.find(part => part.type === 'minute').value}` };
  };
  const isDriveImage = value => { try { return new URL(value).hostname === 'drive.google.com'; } catch { return false; } };
  const helpers = Object.freeze({ normalize, posterId, trustedEndpoint, dayInSingapore, clockInSingapore, isDriveImage });
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const config = window.MIT_WORKSHOP_LIVE_CONFIG || {};
  const endpoint = trustedEndpoint(config.endpoint) ? config.endpoint : '';
  const refreshMs = Math.max(5000, Math.min(300000, Number(config.refreshMs) || 15000));
  const subscribers = new Set();
  let bundled = [], current = [], signature = '', pollTimer = 0, midnightTimer = 0;
  let inFlight = null, callbackCounter = 0, lastError = '', lastDay = dayInSingapore(), lastMinute = clockInSingapore().time;
  const notify = reason => subscribers.forEach(listener => {
    try { listener(current, { reason, today: lastDay }); } catch (error) { console.error(error); }
  });
  function publish(data, reason) {
    const next = JSON.stringify(data);
    if (next === signature) return false;
    const retained = new Map(current.map(poster => [poster.id, poster]));
    current = Object.freeze(data.map(poster => {
      const previous = retained.get(poster.id);
      return previous && JSON.stringify(previous) === JSON.stringify(poster) ? previous : poster;
    }));
    signature = next;
    notify(reason);
    scheduleBoundary();
    return true;
  }
  function schedulePoll() {
    window.clearTimeout(pollTimer);
    if (endpoint && !document.hidden) pollTimer = window.setTimeout(() => { refresh(); }, refreshMs);
  }
  function checkClock() {
    const clock = clockInSingapore();
    const changedDay = clock.date !== lastDay, changedMinute = clock.time !== lastMinute;
    lastDay = clock.date; lastMinute = clock.time;
    if (changedDay || changedMinute) notify(changedDay ? 'day' : 'time');
  }
  function scheduleBoundary() {
    window.clearTimeout(midnightTimer);
    if (document.hidden) return;
    const now = Date.now();
    let next = Date.parse(`${dayInSingapore()}T00:00:00+08:00`) + 86400000;
    for (const poster of current) {
      if (!poster.endTime || poster.archiveStatus === 'past') continue;
      const expiry = Date.parse(`${poster.date}T${poster.endTime}:00+08:00`);
      if (expiry > now && expiry < next) next = expiry;
    }
    midnightTimer = window.setTimeout(() => { checkClock(); scheduleBoundary(); }, Math.max(50, next - now + 50));
  }
  function jsonp(parameters = {}, deadline = 8000) {
    return new Promise((resolve, reject) => {
      const name = `MIT_WORKSHOPS_${++callbackCounter}_${Date.now()}`;
      const script = document.createElement('script');
      let finished = false, timeout = 0;
      const finish = (error, payload) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        script.onerror = null;
        script.remove();
        if (error) {
          // Removing a timed-out script usually stops it, but an already
          // queued response can still execute. Keep a short-lived no-op so it
          // neither updates the store nor raises a callback ReferenceError.
          window[name] = () => {};
          window.setTimeout(() => { delete window[name]; }, 8000);
        } else delete window[name];
        if (error) reject(error); else resolve(payload);
      };
      window[name] = payload => finish(null, payload);
      script.onerror = () => finish(new Error('The live workshop feed could not be loaded.'));
      const url = new URL(endpoint);
      url.searchParams.set('callback', name); url.searchParams.set('_', Date.now());
      for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
      script.src = url.href;
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      timeout = window.setTimeout(() => finish(new Error('The live workshop feed timed out.')), deadline);
      (document.head || document.body).append(script);
    });
  }
  // Drive viewer pages are HTML, not images. The read-only web app returns
  // only posters currently published in the sheet, then this tab caches the
  // resulting raster locally. Two transfers at a time keep phones responsive.
  const imageCache = new Map(), imageQueue = [], imageBindings = new WeakMap();
  let imageRequests = 0, imageObserver = null;
  const imageKey = (poster, variant) => `${poster.id || posterId(poster.file)}\n${poster.file}\n${variant}\n${variant === 'thumb' ? poster.thumbnail || poster.file : poster.file}`;
  function pruneImages(protectedKey) {
    const ready = [...imageCache].filter(([, entry]) => entry.url).sort((a, b) => a[1].used - b[1].used);
    let bytes = ready.reduce((sum, [, entry]) => sum + entry.bytes, 0);
    const groups = () => new Set([...imageCache.values()].map(entry => entry.group)).size;
    for (const [key, entry] of ready) {
      if (imageCache.size <= 40 && groups() <= 20 && bytes <= 24 * 1024 * 1024) break;
      if (key === protectedKey) continue;
      imageCache.delete(key); bytes -= entry.bytes;
      URL.revokeObjectURL(entry.url);
    }
  }
  function rasterBlob(payload, poster, variant) {
    if (!payload || payload.schemaVersion !== 1 || payload.id !== poster.id || payload.variant !== variant ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(payload.mimeType) || typeof payload.base64 !== 'string' ||
        !payload.base64.length || payload.base64.length > 8388608 || payload.base64.length % 4 ||
        !/^[A-Za-z\d+/]*={0,2}$/.test(payload.base64)) throw new Error('Poster unavailable.');
    const binary = atob(payload.base64);
    if (!binary.length || binary.length > 6 * 1024 * 1024) throw new Error('Poster unavailable.');
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const starts = values => values.every((value, index) => bytes[index] === value);
    const valid = payload.mimeType === 'image/png' ? starts([137, 80, 78, 71, 13, 10, 26, 10])
      : payload.mimeType === 'image/jpeg' ? starts([255, 216, 255])
      : starts([82, 73, 70, 70]) && [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value);
    if (!valid) throw new Error('Poster unavailable.');
    return new Blob([bytes], { type: payload.mimeType });
  }
  function pumpImages() {
    if (document.hidden) return;
    while (imageRequests < 2 && imageQueue.length) {
      const job = imageQueue.shift(); imageRequests++;
      jsonp({ action: 'poster', key: job.poster.id, variant: job.variant }, 15000)
        .then(payload => {
          const blob = rasterBlob(payload, job.poster, job.variant);
          job.entry.url = URL.createObjectURL(blob);
          job.entry.bytes = blob.size; job.entry.used = Date.now();
          pruneImages(job.key);
          job.resolve(job.entry.url);
        }).catch(error => { imageCache.delete(job.key); job.reject(error); })
        .finally(() => { imageRequests--; pumpImages(); });
    }
  }
  function resolveImage(poster, variant = 'thumb') {
    if (!poster || !['thumb', 'full'].includes(variant)) return Promise.reject(new Error('Poster unavailable.'));
    const value = variant === 'thumb' ? poster.thumbnail || poster.file : poster.file;
    if (!isDriveImage(poster.file) && !isDriveImage(value)) {
      const safe = imageUrl(value);
      return safe ? Promise.resolve(new URL(safe, document.baseURI).href) : Promise.reject(new Error('Poster unavailable.'));
    }
    if (!endpoint || typeof poster.id !== 'string' || !/^[a-z\d][a-z\d_-]{0,119}$/i.test(poster.id)) return Promise.reject(new Error('Poster unavailable.'));
    const key = imageKey(poster, variant), cached = imageCache.get(key);
    if (cached) { cached.used = Date.now(); return cached.promise; }
    const entry = { group: `${poster.id}\n${poster.file}`, used: Date.now(), bytes: 0, url: '', promise: null };
    entry.promise = new Promise((resolve, reject) => imageQueue.push({ key, poster, variant, entry, resolve, reject }));
    imageCache.set(key, entry); pumpImages();
    return entry.promise;
  }
  function decodedImage(url) {
    const image = new Image(); image.decoding = 'async';
    if (typeof image.decode === 'function') { image.src = url; return image.decode(); }
    return new Promise((resolve, reject) => {
      image.onload = resolve; image.onerror = () => reject(new Error('Poster unavailable.')); image.src = url;
    });
  }
  function loadBinding(img, binding) {
    if (binding.started || imageBindings.get(img) !== binding) return;
    binding.started = true;
    img.setAttribute('data-poster-state', 'loading');
    resolveImage(binding.poster, binding.variant).then(url => decodedImage(url).then(() => url)).then(url => {
      if (imageBindings.get(img) !== binding) return;
      if (img.src !== url) img.src = url;
      img.hidden = false; img.setAttribute('data-poster-state', 'ready');
      binding.placeholder?.remove(); binding.placeholder = null;
    }).catch(() => {
      if (imageBindings.get(img) !== binding) return;
      img.setAttribute('data-poster-state', 'error');
      if (img.getAttribute('src') || img.src) return; // Keep the last working image.
      img.hidden = true;
      const placeholder = document.createElement('span');
      placeholder.className = 't-small'; placeholder.textContent = 'Poster preview unavailable. View poster to retry.';
      binding.placeholder = placeholder; img.parentNode?.append(placeholder);
    });
  }
  function unbindImage(img) {
    if (!img) return;
    imageObserver?.unobserve(img);
    imageBindings.get(img)?.placeholder?.remove(); imageBindings.delete(img);
  }
  function bindImage(img, poster, variant = 'thumb') {
    const key = imageKey(poster, variant), previous = imageBindings.get(img);
    if (previous?.key === key) return;
    unbindImage(img);
    const binding = { key, poster, variant, started: false, placeholder: null };
    imageBindings.set(img, binding);
    const value = variant === 'thumb' ? poster.thumbnail || poster.file : poster.file;
    // Initial bundled/direct thumbnails retain the browser's native lazy load.
    if (!isDriveImage(poster.file) && !isDriveImage(value) && !(img.getAttribute('src') || img.src)) {
      const safe = imageUrl(value);
      if (safe) { img.src = new URL(safe, document.baseURI).href; img.hidden = false; binding.started = true; return; }
    }
    if (window.IntersectionObserver && variant === 'thumb') {
      if (!imageObserver) imageObserver = new window.IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
          imageObserver.unobserve(entry.target);
          const currentBinding = imageBindings.get(entry.target);
          if (currentBinding) loadBinding(entry.target, currentBinding);
        }
      }, { rootMargin: '220px' });
      imageObserver.observe(img);
    } else loadBinding(img, binding);
  }
  function refresh() {
    if (!endpoint || document.hidden) return Promise.resolve(false);
    if (inFlight) return inFlight;
    window.clearTimeout(pollTimer);
    inFlight = jsonp().then(payload => {
      if (!payload || payload.schemaVersion !== 1) throw new Error('Unsupported workshop feed.');
      const data = normalize(payload.workshops, bundled);
      lastError = '';
      return publish(data, 'remote');
    }).catch(error => { lastError = error.message; return false; }).finally(() => {
      inFlight = null;
      schedulePoll();
    });
    return inFlight;
  }
  window.MIT_WORKSHOP_LIVE = Object.freeze({
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    get: () => current,
    refresh,
    resolveImage, bindImage, unbindImage,
    status: () => ({ enabled: !!endpoint, refreshing: !!inFlight, error: lastError })
  });
  const local = window.MIT_POSTERS_READY || fetch(new URL('scripts/posters.json', document.baseURI)).then(response => {
    if (!response.ok) throw new Error('Unable to load workshop memories.');
    return response.json();
  });
  let usedRemoteFallback = false;
  window.MIT_POSTERS_READY = local.then(rows => {
    bundled = normalize(rows);
    publish(normalize(window.MIT_CMS?.collection('workshop', bundled) || bundled, bundled), 'local');
    return current;
  }).catch(error => {
    if (!endpoint) throw error;
    usedRemoteFallback = true;
    return refresh().then(() => {
      if (!signature) throw error;
      return current;
    });
  }).then(data => {
    scheduleBoundary();
    // Consumers receive the bundled snapshot first; the enhancement never
    // holds a ticket or scrapbook hostage to an external network request.
    if (endpoint && !usedRemoteFallback) window.setTimeout(() => { refresh(); }, 0);
    return data;
  });
  document.addEventListener('visibilitychange', () => {
    window.clearTimeout(pollTimer);
    window.clearTimeout(midnightTimer);
    if (document.hidden) return;
    pumpImages();
    checkClock();
    scheduleBoundary();
    window.MIT_POSTERS_READY.then(() => refresh()).catch(() => {});
  });
  window.MIT_POSTERS_READY.then(() => window.MIT_CMS?.subscribe(() => {
    try { publish(normalize(window.MIT_CMS.collection('workshop', bundled), bundled), 'sheet'); }
    catch (error) { lastError = error.message; }
  })).catch(() => {});
})();
