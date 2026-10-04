(() => {
  'use strict';
  const scriptSource = document.currentScript && document.currentScript.src;

  function mountDrawings() {
    if (document.getElementById('maker-buddy')) return;
    const storageKey = 'mit-maker-drawings-v2';
    // Exact club drawings exported from the supplied Drive Illustrator files:
    // noticeboard: 1RUrU7uTO1O3HkJjMoTFiizhZBcIaxcHu; 3D workshop: 1BPpyQlkwMOFaWms0_S9foU2x8nSVJQmK.
    const drawings = [
      { id: 'hammer', name: 'Hammer bear', file: 'mit-mascot-hammer.png', width: 390, height: 372, alt: 'MIT bear in a yellow apron waving a navy hammer' },
      { id: 'fire', name: 'Fired-up bear', file: 'mit-mascot-fired-up.png', width: 474, height: 456, alt: 'MIT bear with flame eyes and a navy neckerchief' },
      { id: 'little', name: 'Little maker', file: 'mit-mascot-little-maker.png', width: 348, height: 342, alt: 'A small brown MIT bear in a yellow apron' }
    ];
    const assetUrl = file => scriptSource
      ? new URL('../assets/images/mascots/' + file, scriptSource).href
      : new URL('assets/images/mascots/' + file, document.baseURI).href;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) { /* Browser storage is optional. */ }
    const savedToys = saved && saved.version === 2 && Array.isArray(saved.toys) ? saved.toys : null;
    const records = new Map();
    let drag = null, speechTimer = null, scrollFrame = null, speechRecord = null;

    const layer = document.createElement('div');
    layer.id = 'maker-buddy';
    layer.className = 'buddy-layer';
    const instructions = document.createElement('span');
    instructions.id = 'buddy-instructions';
    instructions.className = 'buddy-sr';
    instructions.textContent = 'Move this drawing with your finger or mouse. It stays on the page where you leave it. Arrow keys move it; hold Shift for bigger steps. Enter or Space gets a friendly message. The Toy box adds more drawings, brings them here, or puts them all away.';
    const announcement = document.createElement('span');
    announcement.className = 'buddy-sr';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    const speech = document.createElement('div');
    speech.className = 'buddy-speech';
    speech.setAttribute('aria-hidden', 'true');
    speech.hidden = true;
    layer.append(speech);
    document.body.append(layer, instructions, announcement);

    const box = document.createElement('div');
    box.className = 'buddy-box';
    box.innerHTML = '<button type="button" class="buddy-box-toggle" aria-expanded="true" aria-controls="buddy-box-drawings">Toy box <span class="buddy-box-count"></span><span aria-hidden="true">＋</span></button><div class="buddy-box-panel" id="buddy-box-drawings"><p>Add a drawing. Leave it anywhere.</p><div class="buddy-box-options" role="group" aria-label="Choose a club drawing"></div><button type="button" class="buddy-put-all">Put them all back</button></div>';
    const game = document.getElementById('maker-game');
    if (game) game.insertAdjacentElement('afterend', box);
    else (document.querySelector('main') || document.body).append(box);
    const toggle = box.querySelector('.buddy-box-toggle');
    const panel = box.querySelector('.buddy-box-panel');
    const choices = box.querySelector('.buddy-box-options');
    const putAll = box.querySelector('.buddy-put-all');
    const count = box.querySelector('.buddy-box-count');

    function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function bounds() {
      const scrollY = window.scrollY || 0;
      const main = document.querySelector('main'), footer = document.querySelector('footer');
      const contentBottom = Math.max(
        main ? main.getBoundingClientRect().bottom + scrollY : 0,
        footer ? footer.getBoundingClientRect().bottom + scrollY : 0,
        box.getBoundingClientRect().bottom + scrollY
      );
      return {
        width: document.documentElement.clientWidth || window.innerWidth,
        height: Math.max(window.innerHeight, contentBottom || document.documentElement.scrollHeight)
      };
    }
    function remember() {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          version: 2,
          toys: [...records.values()].map(record => ({ id: record.drawing.id, x: record.x, y: record.y, active: record.active }))
        }));
      } catch (_) { /* Drawings remain movable when storage is unavailable. */ }
    }
    function positionSpeech() {
      if (speech.hidden || !speechRecord) return;
      const page = bounds(), size = speech.getBoundingClientRect();
      const x = speechRecord.layoutX + 41 - size.width / 2;
      const above = speechRecord.layoutY - size.height - 12;
      const y = above >= 12 ? above : speechRecord.layoutY + 86 + 12;
      speech.style.left = clamp(x, 12, Math.max(12, page.width - size.width - 12)) + 'px';
      speech.style.top = clamp(y, 12, Math.max(12, page.height - size.height - 12)) + 'px';
    }
    function place(record) {
      const page = bounds();
      record.layoutX = clamp(record.x, 12, Math.max(12, page.width - 82 - 12));
      record.layoutY = clamp(record.y, 12, Math.max(12, page.height - 86 - 12));
      record.button.style.left = record.layoutX + 'px';
      record.button.style.top = record.layoutY + 'px';
      if (speechRecord === record) positionSpeech();
    }
    function move(record, x, y) {
      const page = bounds();
      record.x = clamp(x, 12, Math.max(12, page.width - 82 - 12));
      record.y = clamp(y, 12, Math.max(12, page.height - 86 - 12));
      place(record);
    }
    function refreshPositions() { records.forEach(record => { if (record.active) place(record); }); }
    function hideSpeech() {
      if (speechTimer !== null) window.clearTimeout(speechTimer);
      speechTimer = null;
      speech.hidden = true;
      speech.textContent = '';
      announcement.textContent = '';
      speechRecord = null;
    }
    function say(record, text) {
      hideSpeech();
      speechRecord = record;
      speech.textContent = text;
      speech.hidden = false;
      positionSpeech();
      announcement.textContent = text;
      speechTimer = window.setTimeout(hideSpeech, 2600);
    }
    function refreshBox() {
      let active = 0;
      records.forEach(record => {
        if (record.active) active++;
        record.choice.setAttribute('aria-label', (record.active ? 'Bring ' : 'Add ') + record.drawing.name + (record.active ? ' here' : ' to the page'));
        record.choice.querySelector('.buddy-choice-action').textContent = record.active ? 'Bring here' : 'Add';
      });
      count.textContent = active ? active + ' out' : '';
      putAll.disabled = active === 0;
    }
    function endDrag(event, cancelled = false) {
      if (!drag || (event && event.pointerId !== drag.id)) return;
      const old = drag;
      old.record.suppressClick = !cancelled && old.moved;
      drag = null;
      if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
      scrollFrame = null;
      document.body.classList.remove('buddy-dragging');
      try { if (old.record.button.hasPointerCapture(old.id)) old.record.button.releasePointerCapture(old.id); } catch (_) { /* Pointer already released. */ }
      remember();
    }
    function dragScroll() {
      scrollFrame = null;
      if (!drag || !drag.moved) return;
      const edge = 48, y = drag.clientY;
      const speed = y < edge ? -Math.ceil((edge - y) / 4) : y > window.innerHeight - edge ? Math.ceil((y - (window.innerHeight - edge)) / 4) : 0;
      if (!speed) return;
      const scroller = document.scrollingElement || document.documentElement;
      const before = scroller.scrollTop;
      window.scrollBy({ left: 0, top: clamp(speed, -12, 12), behavior: 'instant' });
      if (scroller.scrollTop === before) return;
      move(drag.record, drag.clientX + (window.scrollX || 0) - drag.grabX, drag.clientY + (window.scrollY || 0) - drag.grabY);
      scrollFrame = window.requestAnimationFrame(dragScroll);
    }
    function addHere(record, index) {
      endDrag(null, true);
      hideSpeech();
      record.active = true;
      record.button.hidden = false;
      const rect = box.getBoundingClientRect();
      const pageX = rect.left + (window.scrollX || 0);
      const pageY = rect.top + (window.scrollY || 0);
      move(record, pageX + 8 + index * 92, Math.max((window.scrollY || 0) + 16, pageY - 110));
      remember();
      refreshBox();
      record.button.focus({ preventScroll: true });
      say(record, record.drawing.name + ' is here.');
    }

    drawings.forEach((drawing, index) => {
      const stored = savedToys && savedToys.find(item => item && item.id === drawing.id);
      const hasPosition = stored && Number.isFinite(stored.x) && Number.isFinite(stored.y);
      const boxRect = box.getBoundingClientRect();
      const boxPageRight = boxRect.right + (window.scrollX || 0);
      const boxPageBottom = boxRect.bottom + (window.scrollY || 0);
      const record = {
        drawing, x: hasPosition ? stored.x : boxPageRight - 82 - 8,
        y: hasPosition ? stored.y : boxPageBottom + 12,
        active: stored ? stored.active === true : !savedToys && index === 0,
        greeting: 0, suppressClick: false, layoutX: 0, layoutY: 0
      };
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'buddy-toy';
      button.dataset.drawing = drawing.id;
      button.dataset.pose = 'wave';
      button.setAttribute('aria-label', drawing.name + ', a draggable MIT drawing. Use arrow keys to move.');
      button.setAttribute('aria-describedby', 'buddy-instructions');
      button.innerHTML = '<img class="buddy-art" src="' + assetUrl(drawing.file) + '" alt="' + drawing.alt + '" width="' + drawing.width + '" height="' + drawing.height + '" draggable="false">';
      button.hidden = !record.active;
      record.button = button;
      layer.append(button);

      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'buddy-drawing-choice';
      choice.innerHTML = '<img src="' + assetUrl(drawing.file) + '" alt="" width="' + drawing.width + '" height="' + drawing.height + '"><span>' + drawing.name + '</span><span class="buddy-choice-action"></span>';
      choice.addEventListener('click', () => addHere(record, index));
      choices.append(choice);
      record.choice = choice;
      records.set(drawing.id, record);
      place(record);

      button.addEventListener('pointerdown', event => {
        if (drag || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
        hideSpeech();
        record.suppressClick = false;
        const pageX = event.clientX + (window.scrollX || 0), pageY = event.clientY + (window.scrollY || 0);
        drag = { id: event.pointerId, record, startX: pageX, startY: pageY, grabX: pageX - record.layoutX, grabY: pageY - record.layoutY, clientX: event.clientX, clientY: event.clientY, moved: false };
        try { button.setPointerCapture(event.pointerId); } catch (_) { /* Cancelled pointers have nothing to capture. */ }
      });
      button.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        const pageX = event.clientX + (window.scrollX || 0), pageY = event.clientY + (window.scrollY || 0);
        if (!drag.moved && Math.hypot(pageX - drag.startX, pageY - drag.startY) < 5) return;
        drag.moved = true;
        drag.clientX = event.clientX;
        drag.clientY = event.clientY;
        document.body.classList.add('buddy-dragging');
        move(record, pageX - drag.grabX, pageY - drag.grabY);
        if (scrollFrame === null) scrollFrame = window.requestAnimationFrame(dragScroll);
      });
      button.addEventListener('pointerup', event => endDrag(event));
      button.addEventListener('pointercancel', event => endDrag(event, true));
      button.addEventListener('lostpointercapture', event => endDrag(event, true));
      button.addEventListener('click', event => {
        if (record.suppressClick && event.detail !== 0) { record.suppressClick = false; return; }
        record.suppressClick = false;
        record.greeting = (record.greeting + 1) % 3;
        button.dataset.pose = record.greeting % 2 ? 'cheer' : 'wave';
        say(record, ['Made with curiosity.', 'Good spot. I’m staying here.', 'Little makers. Big ideas.'][record.greeting]);
      });
      button.addEventListener('keydown', event => {
        const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (!direction) return;
        event.preventDefault();
        hideSpeech();
        const step = event.shiftKey ? 32 : 8;
        move(record, record.layoutX + direction[0] * step, record.layoutY + direction[1] * step);
        remember();
        button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      });
    });

    toggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      toggle.setAttribute('aria-expanded', String(!panel.hidden));
    });
    putAll.addEventListener('click', () => {
      endDrag(null, true);
      hideSpeech();
      records.forEach(record => { record.active = false; record.button.hidden = true; });
      remember();
      refreshBox();
      announcement.textContent = 'All drawings are back in the toy box.';
      toggle.focus({ preventScroll: true });
    });
    window.addEventListener('resize', refreshPositions);
    window.addEventListener('load', refreshPositions);
    window.addEventListener('blur', () => endDrag(null, true));
    window.addEventListener('pagehide', () => { endDrag(null, true); hideSpeech(); });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(refreshPositions);
      const main = document.querySelector('main'), footer = document.querySelector('footer');
      if (main) observer.observe(main);
      if (footer) observer.observe(footer);
    }
    refreshBox();
  }

  // Resolve the album layout before choosing a fresh drawing's Toy box position.
  const mountWhenReady = () => Promise.all([window.MIT_PAGE_READY, window.MIT_CREW_READY, window.MIT_EXPERIENCE_READY]).then(mountDrawings, mountDrawings);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountWhenReady, { once: true });
  else mountWhenReady();
})();

