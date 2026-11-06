/* Bounded woodland delivery. Editor artwork and authored dimensions stay exact. */
(() => {
  'use strict';
  if (document.body?.classList.contains('forest-editor') || document.body?.classList.contains('portrait-editor')) return;
  const variants = new Map(Object.entries(window.MIT_IMAGE_VARIANTS || {}).map(([source, values]) => [new URL(source, document.baseURI).href, values]));
  const records = new WeakMap(), pending = new Set(), queue = [];
  const LIMIT = 3, TIMEOUT = 20000, RETRIES = 2, MARGIN = 600;
  let active = 0;
  const entriesFor = source => variants.get(new URL(source, document.baseURI).href);
  function renderedWidth(image) {
    // sizes=auto is unavailable in some phone browsers. Include the saved
    // canvas transform, instead of decoding a full viewport for every leaf.
    return Math.max(1, Math.ceil(image.getBoundingClientRect().width || image.width || window.innerWidth));
  }
  function enhance(image, source = image.getAttribute('src')) {
    if (!source) return;
    const entries = entriesFor(source);
    if (entries) {
      image.sizes = image.classList.contains('hero-workshop-art') || image.fetchPriority === 'high' ? '(min-width:900px) 520px, 88.8vw' : renderedWidth(image) + 'px';
      image.srcset = entries.map(entry => entry.src + ' ' + entry.width + 'w').join(', ');
    }
    image.decoding = 'async';
  }
  function near(image) {
    const box = image.getBoundingClientRect();
    return image.isConnected && box.width > 0 && box.height > 0 && box.bottom >= -MARGIN && box.top <= window.innerHeight + MARGIN;
  }
  function enqueue(record) {
    if (!record.near || !['waiting', 'retry'].includes(record.state)) return;
    record.state = 'queued'; queue.push(record); pump();
  }
  function pump() {
    while (active < LIMIT && queue.length) {
      const record = queue.shift();
      if (records.get(record.image) !== record || record.state !== 'queued') continue;
      if (!record.near || (nearby && !record.image.isConnected)) { record.state = 'waiting'; continue; }
      start(record);
    }
  }
  function start(record) {
    const image = record.image;
    record.state = 'loading'; image.dataset.sceneState = 'loading'; active++;
    let done = false, decoding = false, timeout;
    const cleanup = () => {
      clearTimeout(timeout);
      image.removeEventListener('load', loaded); image.removeEventListener('error', failed);
      record.cancel = null; active--;
    };
    const finish = success => {
      if (done) return;
      done = true; cleanup();
      if (records.get(image) !== record) { pump(); return; }
      if (success) {
        record.state = 'ready'; image.dataset.sceneState = 'ready';
        nearby?.unobserve(image); pending.delete(record);
      } else {
        // Stop a hung request before giving its queue slot to another layer.
        image.removeAttribute('srcset'); image.removeAttribute('src');
        record.state = 'error'; image.dataset.sceneState = 'error';
        if (record.attempt < RETRIES) {
          record.attempt++; record.state = 'retry';
          record.timer = setTimeout(() => { record.timer = null; enqueue(record); }, record.attempt * 700);
        }
      }
      pump();
    };
    const failed = () => finish(false);
    const loaded = async () => {
      if (done || decoding || !image.complete || !image.naturalWidth) return;
      decoding = true;
      try { if (image.decode) await image.decode(); finish(!!image.naturalWidth); }
      catch { finish(false); }
    };
    record.cancel = () => { if (!done) { done = true; cleanup(); } };
    image.addEventListener('load', loaded); image.addEventListener('error', failed);
    timeout = setTimeout(failed, TIMEOUT);
    // The intersection gate already implements lazy loading. A second native
    // lazy gate can strand transformed layers on mobile, so request now.
    image.loading = 'eager'; image.decoding = 'async';
    if (record.attempt) {
      const entries = entriesFor(record.source), target = renderedWidth(image) * Math.min(window.devicePixelRatio || 1, 3);
      const source = entries?.find(entry => entry.width >= target)?.src || entries?.at(-1)?.src || record.source;
      const retry = new URL(source, document.baseURI);
      retry.searchParams.set('mit-image-retry', String(record.attempt));
      image.removeAttribute('srcset'); image.src = retry.href;
    } else { enhance(image, record.source); image.src = record.source; }
    if (image.complete && image.naturalWidth) void loaded();
  }
  const nearby = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const record = records.get(entry.target);
      if (!record) continue;
      record.near = entry.isIntersecting;
      if (record.near && record.state === 'error') { record.attempt = 0; record.state = 'waiting'; }
      if (!record.timer) enqueue(record);
    }
  }, {rootMargin:MARGIN + 'px'}) : null;
  function set(image, source) {
    if (!source) return;
    const previous = records.get(image);
    if (previous?.source === source) return;
    if (previous) { previous.cancel?.(); clearTimeout(previous.timer); pending.delete(previous); }
    const record = {image, source, state:'waiting', near:!nearby, attempt:0};
    records.set(image, record); pending.add(record);
    image.dataset.sceneSrc = source; image.dataset.sceneState = 'waiting';
    image.removeAttribute('src'); image.removeAttribute('srcset');
    if (nearby) nearby.observe(image); else enqueue(record);
    pump();
  }
  function recover() {
    if (document.hidden || window.navigator?.onLine === false) return;
    for (const record of pending) {
      if (record.state !== 'error' || !near(record.image)) continue;
      record.near = true; record.attempt = 0; record.state = 'waiting'; enqueue(record);
    }
  }
  window.addEventListener('online', recover);
  window.addEventListener('pageshow', recover);
  document.addEventListener('visibilitychange', recover);
  window.MIT_IMAGES = Object.freeze({
    set(image, source) {
      if (image.fetchPriority === 'high') { enhance(image, source); image.src = source; }
      else set(image, source);
    },
    enhance,
    delivery(source) { return entriesFor(source)?.at(-1)?.src || source; },
    scan(host) { host.querySelectorAll('img').forEach(image => {
      // cloneNode copies data attributes, not the observer registration.
      if (image.dataset.sceneSrc) set(image, image.dataset.sceneSrc);
      else enhance(image);
    }); }
  });
  document.querySelectorAll('img').forEach(image => enhance(image));
})();
