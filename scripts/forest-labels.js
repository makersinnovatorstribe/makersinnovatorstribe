(() => {
  'use strict';

  const host = document.getElementById('committee-grid');
  if (!host) return;

  // Original label spans remain with the profile controls. Their mirrors sit
  // outside the landscape so moving an actor behind a tree cannot hide its name.
  const typeProperties = [
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'letter-spacing', 'white-space', 'text-wrap', 'max-width', 'margin-top',
    'color', 'text-shadow', 'paint-order',
    '-webkit-text-stroke-width', '-webkit-text-stroke-color'
  ];
  let overlay = null;
  let records = new Map();
  let frame = 0;
  let reconcileNeeded = true;
  let stylesNeeded = true;
  let destroyed = false;

  const putStyle = (element, property, value) => {
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value);
  };
  const mirrorType = source => {
    const style = getComputedStyle(source);
    return typeProperties.map(property => [property, style.getPropertyValue(property)]);
  };
  const isOurs = node => Boolean(overlay && (node === overlay || overlay.contains(node)));

  function reconcile() {
    reconcileNeeded = false;
    const sources = [...host.querySelectorAll('.exco-person-place .exco-person-label')];
    if (!sources.length) {
      records.forEach(record => record.item.remove());
      records.clear();
      return;
    }
    if (!overlay || !host.contains(overlay)) {
      overlay = document.createElement('div');
      overlay.className = 'forest-label-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      host.append(overlay);
    }
    const next = new Map();
    for (const source of sources) {
      const button = source.closest('.exco-person');
      const sourceName = source.querySelector('.exco-person-name');
      const sourceRole = source.querySelector('.exco-person-role');
      if (!button || !sourceName || !sourceRole) continue;
      let record = records.get(source);
      if (!record) {
        const item = document.createElement('span');
        item.className = 'forest-label-item';
        const name = document.createElement('span');
        name.className = 'forest-label-name';
        const role = document.createElement('span');
        role.className = 'forest-label-role';
        item.append(name, role);
        record = { source, button, item, name, role };
        item.addEventListener('click', () => {
          if (document.body.classList.contains('forest-editor') && !document.body.classList.contains('is-preview')) return;
          if (!item.hidden && host.contains(record.button)) record.button.click();
        });
      }
      Object.assign(record, { sourceName, sourceRole, button });
      if (record.name.textContent !== sourceName.textContent) record.name.textContent = sourceName.textContent;
      if (record.role.textContent !== sourceRole.textContent) record.role.textContent = sourceRole.textContent;
      if (record.item.parentNode !== overlay) overlay.append(record.item);
      next.set(source, record);
    }
    records.forEach((record, source) => { if (!next.has(source)) record.item.remove(); });
    records = next;
    if (!host.classList.contains('forest-labels-ready')) host.classList.add('forest-labels-ready');
    stylesNeeded = true;
    resize?.disconnect();
    resize?.observe(host);
    host.querySelectorAll('.exco-world-stage').forEach(stage => resize?.observe(stage));
    records.forEach(record => resize?.observe(record.source));
  }

  function draw() {
    frame = 0;
    if (destroyed || document.hidden) return;
    if (reconcileNeeded) reconcile();
    if (!overlay || !records.size) return;

    const origin = host.getBoundingClientRect();
    const hostScaleX = origin.width / (host.offsetWidth || origin.width) || 1;
    const hostScaleY = origin.height / (host.offsetHeight || origin.height) || 1;
    const needsType = stylesNeeded;
    stylesNeeded = false;
    // Read all actor geometry before writing any mirror styles.
    const measures = [...records.values()].map(record => {
      const width = record.source.offsetWidth;
      const height = record.source.offsetHeight;
      const rect = record.source.getBoundingClientRect();
      return {
        record, width, height,
        hidden: !width || !height || !rect.width || !rect.height,
        x: (rect.left - origin.left) / hostScaleX - host.clientLeft,
        y: (rect.top - origin.top) / hostScaleY - host.clientTop,
        sx: width ? rect.width / width / hostScaleX : 1,
        sy: height ? rect.height / height / hostScaleY : 1,
        nameType: needsType ? mirrorType(record.sourceName) : null,
        roleType: needsType ? mirrorType(record.sourceRole) : null,
        focused: document.activeElement === record.button
      };
    });
    for (const measure of measures) {
      const { record, hidden } = measure;
      if (record.item.hidden !== hidden) record.item.hidden = hidden;
      if (measure.nameType) measure.nameType.forEach(([property, value]) => putStyle(record.name, property, value));
      if (measure.roleType) measure.roleType.forEach(([property, value]) => putStyle(record.role, property, value));
      record.item.classList.toggle('is-focused', measure.focused);
      if (hidden) continue;
      putStyle(record.item, 'width', measure.width + 'px');
      putStyle(record.item, 'height', measure.height + 'px');
      putStyle(record.item, 'transform', `translate3d(${measure.x.toFixed(3)}px,${measure.y.toFixed(3)}px,0) scale(${measure.sx.toFixed(5)},${measure.sy.toFixed(5)})`);
    }
  }

  function refresh(rebuild = false, type = false) {
    reconcileNeeded ||= rebuild;
    stylesNeeded ||= type;
    if (!destroyed && !frame && !document.hidden) frame = requestAnimationFrame(draw);
  }

  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => refresh(false, true)) : null;
  const mutation = new MutationObserver(changes => {
    let update = false;
    let rebuild = false;
    let type = false;
    for (const change of changes) {
      if (isOurs(change.target)) continue;
      if (change.type === 'childList') {
        const changed = [...change.addedNodes, ...change.removedNodes];
        if (changed.length && changed.every(isOurs)) continue;
        update = rebuild = type = true;
      } else if (change.type === 'characterData') {
        if (change.target.parentElement?.closest('.exco-person-label')) update = rebuild = type = true;
      } else if (change.target === host || change.target.matches('.exco-person-place,.exco-person,.exco-person-label,.exco-person-name,.exco-person-role,.exco-landscape,.exco-world-stage')) {
        update = true;
        type ||= change.attributeName === 'class' || change.target === host || change.target.matches('.exco-person-name,.exco-person-role');
      }
    }
    if (update) refresh(rebuild, type);
  });
  mutation.observe(host, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });

  const onResize = () => refresh(false, true);
  const onFocus = () => refresh();
  const onVisibility = () => {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    else if (!document.hidden) refresh(false, true);
  };
  window.addEventListener('resize', onResize, { passive: true });
  host.addEventListener('focusin', onFocus);
  host.addEventListener('focusout', onFocus);
  document.addEventListener('visibilitychange', onVisibility);
  document.fonts?.addEventListener('loadingdone', onResize);
  document.fonts?.ready?.then(onResize);

  window.MIT_FOREST_LABELS = {
    refresh: () => refresh(false, true),
    destroy() {
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      mutation.disconnect();
      resize?.disconnect();
      window.removeEventListener('resize', onResize);
      host.removeEventListener('focusin', onFocus);
      host.removeEventListener('focusout', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      document.fonts?.removeEventListener('loadingdone', onResize);
      overlay?.remove();
      host.classList.remove('forest-labels-ready');
      records.clear();
    }
  };
  Promise.resolve(window.MIT_CREW_READY).then(() => refresh(true, true));
})();
