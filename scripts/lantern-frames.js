/* Progressive sprite enhancement. The original image stays in the DOM and
   retains its dimensions/source pixels for the woodland editor's alpha picker.
   CSS handles frame timing; JS only tracks assets and lifecycle visibility. */
(() => {
  'use strict';
  const script = document.currentScript;
  const source = new URL('../assets/images/woodland-editor/lantern-animation/lantern-frames.webp', script?.src || new URL('scripts/lantern-frames.js', document.baseURI));
  const selector = '.exco-scene-lamp, .woodland-lantern-icon';
  const records = new Map();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let ready = false, destroyed = false, suspended = false, ratio = .5, mutation, intersection;

  function update(record) {
    const active = ready && record.visible && !document.hidden && !suspended && !reduced.matches && record.element.isConnected;
    record.element.classList.toggle('lantern-frames-running', active);
    record.element.classList.toggle('lantern-frames-still', reduced.matches);
  }
  function updateAll() { records.forEach(update); }
  function prepare(element) {
    if (records.has(element) || !element.isConnected) return;
    const image = element.querySelector('img.exco-lamp-art, img.woodland-lantern-art');
    if (!image) return;
    // A clone can arrive with the former instance's sprite child and classes.
    // Reuse exactly one child and give it fresh observation/state ownership.
    const existing = [...element.querySelectorAll('.lantern-frame-visual')];
    const visual = existing.shift() || document.createElement('span');
    existing.forEach(extra => extra.remove());
    visual.className = 'lantern-frame-visual';
    visual.setAttribute('aria-hidden', 'true');
    visual.style.backgroundImage = `url("${source.href}")`;
    visual.style.setProperty('--lantern-frame-ratio', String(ratio));
    if (visual.parentNode !== element) element.append(visual);
    const record = { element, image, visual, visible: !intersection };
    records.set(element, record);
    element.classList.toggle('has-lantern-frames', ready);
    update(record);
    intersection?.observe(element);
  }
  function forget(element) {
    const record = records.get(element);
    if (!record) return;
    intersection?.unobserve(element);
    element.classList.remove('has-lantern-frames', 'lantern-frames-running', 'lantern-frames-still');
    record.visual.remove();
    records.delete(element);
  }
  function scan() {
    if (destroyed) return;
    for (const [element] of records) if (!element.isConnected) forget(element);
    document.querySelectorAll(selector).forEach(prepare);
  }
  function visibilityChanged() { updateAll(); }
  function leavePage() { suspended = true; updateAll(); }
  function returnPage() { suspended = false; scan(); updateAll(); }
  function start() {
    if (destroyed) return;
    if ('IntersectionObserver' in window) intersection = new IntersectionObserver(entries => {
      entries.forEach(entry => { const record = records.get(entry.target); if (record) { record.visible = entry.isIntersecting; update(record); } });
    }, { rootMargin: '50px' });
    mutation = new MutationObserver(scan);
    mutation.observe(document.body, { childList: true, subtree: true });
    scan();
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pagehide', leavePage);
    window.addEventListener('pageshow', returnPage);
    reduced.addEventListener?.('change', updateAll);

    const sheet = new Image();
    sheet.decoding = 'async';
    let finished = false;
    const loaded = async () => {
      if (finished || destroyed) return;
      finished = true;
      try {
        if (typeof sheet.decode === 'function') await sheet.decode();
        // Generated sheets may have half-pixel cell boundaries (1774×887).
        // Percentage backgrounds preserve their exact 4×2 subdivision.
        if (destroyed || !sheet.naturalWidth || !sheet.naturalHeight) return;
        ratio = (sheet.naturalWidth / 4) / (sheet.naturalHeight / 2);
        ready = true;
        records.forEach(record => {
          record.visual.style.setProperty('--lantern-frame-ratio', String(ratio));
          record.element.classList.add('has-lantern-frames');
          update(record);
        });
      } catch { /* A failed decode keeps the original paper drawing visible. */ }
    };
    sheet.onload = loaded;
    sheet.onerror = () => { finished = true; };
    sheet.src = source.href;
    if (sheet.complete && sheet.naturalWidth) void loaded();
  }
  window.MIT_LANTERN_FRAMES = {
    refresh: scan,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      mutation?.disconnect();
      intersection?.disconnect();
      document.removeEventListener('DOMContentLoaded', start);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('pagehide', leavePage);
      window.removeEventListener('pageshow', returnPage);
      reduced.removeEventListener?.('change', updateAll);
      for (const [element] of records) forget(element);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
