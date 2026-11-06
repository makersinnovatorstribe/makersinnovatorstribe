/* Drawn wing poses share one decoded sheet and one steady body anchor. */
(() => {
  'use strict';
  const sheet = 'assets/images/woodland-butterfly/flutter-sheet-delivery-v3.webp';
  const registration = [[-15.63, -17], [.1, -16.5], [3.41, -23.5], [-16.13, 29], [0, 31.5], [4.08, 17]];
  let sheetGate;
  function decodedSheet() {
    if (sheetGate) return sheetGate;
    sheetGate = new Promise((resolve, reject) => {
      const source = document.createElement('img');
      source.decoding = 'async'; source.fetchPriority = 'low';
      source.addEventListener('load', async () => {
        try {
          if (!source.naturalWidth) throw new Error('Empty butterfly texture');
          if (typeof source.decode === 'function') await source.decode();
          resolve();
        } catch (error) { reject(error); }
      }, { once: true });
      source.addEventListener('error', reject, { once: true });
      source.src = sheet;
    });
    return sheetGate;
  }
  function create({ onReady = () => {}, onError = () => {}, defer = false } = {}) {
    const art = document.createElement('span');
    art.className = 'butterfly-art';
    art.setAttribute('aria-hidden', 'true');
    // The first open wing extends a few pixels over the nominal grid line.
    // Select at the transparent gap instead, keeping its full tip and excluding
    // that tip from the next pose. Registration then fits every pose in 512px.
    art.innerHTML = '<svg viewBox="0 0 512 512" aria-hidden="true" focusable="false"><g class="butterfly-pose-anchor"><svg class="butterfly-pose-cell" overflow="hidden"><image class="butterfly-pose-sheet" width="1536" height="1024"/></svg></g></svg>';
    const anchor = art.querySelector('.butterfly-pose-anchor');
    const cell = art.querySelector('.butterfly-pose-cell');
    const image = art.querySelector('.butterfly-pose-sheet');
    let pose = -1, started = false;
    function setPose(index) {
      index = Math.max(0, Math.min(5, Math.floor(index)));
      if (index === pose) return;
      pose = index;
      const start = index === 1 ? 24 : 0;
      const width = index === 0 ? 536 : 512 - start;
      anchor.setAttribute('transform', 'translate(' + registration[index].join(' ') + ')');
      cell.setAttribute('x', start); cell.setAttribute('y', 0);
      cell.setAttribute('width', width); cell.setAttribute('height', 512);
      cell.setAttribute('viewBox', start + ' 0 ' + width + ' 512');
      image.setAttribute('x', -512 * (index % 3));
      image.setAttribute('y', -512 * Math.floor(index / 3));
      art.dataset.pose = String(index);
    }
    function load() {
      if (started) return;
      started = true;
      // Both residents share one compact, decoded texture. No SVG frame can
      // briefly appear before its bytes have been decoded into pixels.
      decodedSheet().then(() => {
        image.setAttribute('href', sheet);
        art.classList.add('is-ready'); onReady();
      }, onError);
    }
    setPose(0);
    if (!defer) load();
    return { element: art, setPose, load };
  }
  window.MIT_BUTTERFLY_ART = { create };
})();
