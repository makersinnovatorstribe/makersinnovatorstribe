(() => {
  'use strict';
  const requestFrame = window.MIT_MOTION?.request || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
  const cancelFrame = window.MIT_MOTION?.cancel || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);

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
    if (element.style.getPropertyValue(property) === value) return false;
    element.style.setProperty(property, value);
    return true;
  };
  const mirrorType = source => {
    const style = getComputedStyle(source);
    return typeProperties.map(property => [property, style.getPropertyValue(property)]);
  };
  const isOurs = node => Boolean(overlay && (node === overlay || overlay.contains(node)));

  // Measure the visible contain area, not the empty space inside a portrait's
  // actor box. Authored dimensions work before the deferred image has decoded.
  function imageBounds(image) {
    if (!image) return null;
    const box = image.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const width = image.naturalWidth || Number(image.getAttribute('width')) || image.width;
    const height = image.naturalHeight || Number(image.getAttribute('height')) || image.height;
    const style = getComputedStyle(image);
    if (!width || !height || style.getPropertyValue('object-fit') !== 'contain') return box;
    const scale = Math.min(box.width / width, box.height / height);
    const drawnWidth = width * scale, drawnHeight = height * scale;
    const position = (style.getPropertyValue('object-position') || '50% 50%').trim().split(/\s+/);
    const fraction = (value, vertical) => {
      if (value === 'center') return .5;
      if (value === (vertical ? 'top' : 'left')) return 0;
      if (value === (vertical ? 'bottom' : 'right')) return 1;
      return /%$/.test(value) ? Math.max(0, Math.min(1, parseFloat(value) / 100)) : .5;
    };
    return { left: box.left + (box.width - drawnWidth) * fraction(position[0], false),
      top: box.top + (box.height - drawnHeight) * fraction(position[1] || '50%', true),
      width: drawnWidth, height: drawnHeight };
  }
  const overlap = (a, b, padding = 0) => Math.max(0, Math.min(a.x + a.width, b.x + b.width + padding) - Math.max(a.x, b.x - padding)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height + padding) - Math.max(a.y, b.y - padding));
  const headFraction = (image, axis, fallback) => {
    const value = image.getAttribute('data-label-head-' + axis);
    return value !== null && Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;
  };
  // Content that is easy to miss when considering just the face: Puteri's
  // phone/arms and Yamone's embroidery. Fractions follow the contained photo,
  // so these exclusions track responsive sizing and character transforms.
  const contentGuards = {
    Puteri: [[.12, .02, .3, .43], [.38, .10, .4, .23], [.22, .22, .67, .73]],
    Yamone: [[.2, .28, .65, .42]],
    Luther: [[.12, .25, .46, .45]],
    Elayna: [[0, 0, 1, .48]]
  };
  function placePublic(measures, sceneWidth, sceneHeight, scaleX, scaleY) {
    const edge = 12 / scaleX, gap = 6 / scaleY;
    const clampX = (x, width) => width <= sceneWidth - edge * 2 ? Math.max(edge, Math.min(x, sceneWidth - width - edge)) : (sceneWidth - width) / 2;
    const visible = measures.filter(measure => !measure.hidden);
    const actors = visible.filter(measure => measure.actor);
    const assigned = [];
    // Source-only labels retain their legacy anchors, including old fixtures.
    for (const measure of visible) {
      measure.drawnWidth = measure.width * measure.sx;
      measure.drawnHeight = measure.height * measure.sy;
      measure.guards = measure.actor ? (contentGuards[measure.record.sourceName.textContent.trim()] || []).map(([x, y, width, height]) => ({
        x: measure.actor.x + measure.actor.width * x, y: measure.actor.y + measure.actor.height * y,
        width: measure.actor.width * width, height: measure.actor.height * height
      })) : [];
      if (!measure.actor) {
        measure.x = clampX(measure.x, measure.drawnWidth);
        assigned.push({ x: measure.x, y: measure.y, width: measure.drawnWidth, height: measure.drawnHeight });
      }
    }
    // The order changes packing priority only. Each record always keeps the
    // image and click target found inside its own original profile button.
    actors.sort((a, b) => a.head.y - b.head.y || a.head.x - b.head.x);
    for (const measure of actors) {
      const owner = measure.actor, head = measure.head, width = measure.drawnWidth, height = measure.drawnHeight;
      const name = measure.record.sourceName.textContent.trim();
      const preferredX = head.x - width / 2;
      const above = head.y - head.radius - height - gap - (name === 'Puteri' ? 14 / scaleY : 0);
      // Keep the entire caption above the hairline. The previous torso
      // fallback covered faces, hands and craft props in the crowded camp.
      // Search the nearby clear space instead of drawing across the person.
      const shift = Math.min(72 / scaleX, width * .7);
      const candidates = [];
      for (const rise of [0, 18 / scaleY, 36 / scaleY, 54 / scaleY, 72 / scaleY, 90 / scaleY, 108 / scaleY]) {
        for (const dx of [0, -shift / 2, shift / 2, -shift, shift]) {
          candidates.push([preferredX + dx, above - rise, rise * .3 + Math.abs(dx) * .25]);
        }
      }
      const belowArms = name === 'Elayna';
      if (belowArms) candidates.unshift([preferredX, owner.y + owner.height + gap, -100]);
      let best = null;
      for (const [x, y, preference] of candidates) {
        // Never push a name down into its owner's face or a lower person.
        const maxY = belowArms ? sceneHeight - height : Math.max(0, Math.min(sceneHeight, owner.y + owner.height) - height);
        const candidate = { x: clampX(x, width), y: Math.max(0, Math.min(y, maxY)), width, height };
        const cx = candidate.x + width / 2, cy = candidate.y + height / 2;
        const ownDistance = Math.hypot(cx - head.x, cy - head.y);
        const reach = Math.max(width, height, head.radius + gap + height / 2 + 120 / scaleY);
        const atFeet = belowArms && y >= owner.y + owner.height;
        if (!atFeet && ownDistance > reach) continue;
        if (!atFeet && actors.some(other => other !== measure && Math.hypot(cx - other.head.x, cy - other.head.y) + gap < ownDistance)) continue;
        let score = preference + ownDistance * .2;
        const ownFace = { x: head.x - head.radius, y: head.y - head.radius, width: head.radius * 2, height: head.radius * 2 };
        score += overlap(candidate, ownFace, gap) * 10000;
        for (const actor of actors) for (const guard of actor.guards) score += overlap(candidate, guard, gap) * 20000;
        for (const other of actors) {
          if (other === measure) continue;
          const face = { x: other.head.x - other.head.radius, y: other.head.y - other.head.radius, width: other.head.radius * 2, height: other.head.radius * 2 };
          score += overlap(candidate, face, gap) * 20000;
          score += overlap(candidate, other.actor) * .3;
          // A label belongs near its owner's HEAD, regardless of empty space
          // inside another person's full-body rectangular image element.
          const otherDistance = Math.hypot(cx - other.head.x, cy - other.head.y);
          score += Math.max(0, ownDistance - otherDistance) * 2000;
        }
        for (const label of assigned) {
          const area = overlap(candidate, label, gap);
          if (area) score += 100000000 + area * 100000;
        }
        if (!best || score < best.score) best = { ...candidate, score };
      }
      // Extreme edge/oversized labels may have no centered candidate within
      // reach. Keep the closest above-head anchor instead of a remote gap.
      best ||= { x: clampX(preferredX, width), y: Math.max(0, above), width, height };
      measure.x = best.x; measure.y = best.y; assigned.push(best);
    }
  }

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
      Object.assign(record, { sourceName, sourceRole, button, image: button.querySelector('.exco-person-pose'), character: button.querySelector('.exco-person-character') });
      const sourceId = source.getAttribute('data-forest-id') || source.getAttribute('data-label-id');
      if (sourceId && record.item.getAttribute('data-label-source') !== sourceId) record.item.setAttribute('data-label-source', sourceId);
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
    records.forEach(record => {
      resize?.observe(record.source);
      if (record.image) resize?.observe(record.image);
      if (record.character) resize?.observe(record.character);
      const figure = record.image?.closest('.exco-cutout-figure');
      if (figure) resize?.observe(figure);
    });
  }

  function draw() {
    frame = 0;
    if (destroyed || document.hidden) return;
    if (reconcileNeeded) reconcile();
    if (!overlay || !records.size) return;

    const origin = host.getBoundingClientRect();
    const hostScaleX = origin.width / (host.offsetWidth || origin.width) || 1;
    const hostScaleY = origin.height / (host.offsetHeight || origin.height) || 1;
    const editing = document.body.classList.contains('forest-editor');
    const needsType = stylesNeeded;
    stylesNeeded = false;
    // Read all actor geometry before writing any mirror styles.
    const measures = [...records.values()].map(record => {
      const width = record.source.offsetWidth;
      const height = record.source.offsetHeight;
      const rect = record.source.getBoundingClientRect();
      const actor = !editing ? imageBounds(record.image) : null;
      const actorRect = actor ? { x: (actor.left - origin.left) / hostScaleX - host.clientLeft,
        y: (actor.top - origin.top) / hostScaleY - host.clientTop,
        width: actor.width / hostScaleX, height: actor.height / hostScaleY } : null;
      return {
        record, width, height,
        actor: actorRect,
        head: actorRect ? { x: actorRect.x + actorRect.width * headFraction(record.image, 'x', .5),
          y: actorRect.y + actorRect.height * headFraction(record.image, 'y', .17),
          radius: Math.min(actorRect.width * .28, actorRect.height * .115) } : null,
        hidden: !width || !height || !rect.width || !rect.height,
        x: (rect.left - origin.left) / hostScaleX - host.clientLeft,
        y: (rect.top - origin.top) / hostScaleY - host.clientTop,
        sx: width ? rect.width / width / hostScaleX : 1,
        sy: height ? rect.height / height / hostScaleY : 1,
        // Children are measured before writes. When compensated typography
        // changes, one follow-up frame reads its resulting line breaks.
        mirrorWidth: Math.max(record.name.offsetWidth, record.role.offsetWidth),
        mirrorHeight: Math.max(record.name.offsetTop + record.name.offsetHeight, record.role.offsetTop + record.role.offsetHeight),
        nameType: needsType ? mirrorType(record.sourceName) : null,
        roleType: needsType ? mirrorType(record.sourceRole) : null,
        focused: document.activeElement === record.button,
        spotlit: record.button.classList.contains('is-spotlit')
      };
    });
    let changedPublicType = false;
    for (const measure of measures) {
      const { record, hidden } = measure;
      if (record.item.hidden !== hidden) record.item.hidden = hidden;
      if (measure.nameType) record.nameType = measure.nameType;
      if (measure.roleType) record.roleType = measure.roleType;
      if (!editing) changedPublicType = putStyle(record.item, '--public-label-scale', Math.max(.001, Math.min(measure.sx * hostScaleX, measure.sy * hostScaleY)).toFixed(5)) || changedPublicType;
      [[record.name, record.nameType, '--t-forest-min-name'], [record.role, record.roleType, '--t-label']].forEach(([element, properties, token]) => {
        if (!properties) return;
        const font = parseFloat(properties.find(([property]) => property === 'font-size')?.[1]);
        const line = parseFloat(properties.find(([property]) => property === 'line-height')?.[1]);
        properties.forEach(([property, original]) => {
          let value = original;
          if (!editing && property === 'font-size' && /px$/.test(original)) value = `max(${original},calc(var(${token}) / var(--public-label-scale)))`;
          if (!editing && property === 'max-width' && token === '--t-label') value = 'calc(160px / var(--public-label-scale))';
          if (!editing && (property === 'white-space' || property === 'text-wrap') && token === '--t-label') {
            const longRole = record.sourceRole.textContent.length > 17;
            value = longRole ? property === 'text-wrap' ? 'balance' : 'normal' : 'nowrap';
          }
          if (!editing && property === 'line-height' && /px$/.test(original)) {
            const ratio = font > 0 && line > 0 ? line / font : token === '--t-label' ? 1.25 : 1;
            value = `max(${original},calc(var(${token}) * ${ratio.toFixed(5)} / var(--public-label-scale)))`;
          }
          const changed = putStyle(element, property, value);
          if (!editing && changed && (property === 'font-size' || property === 'line-height')) changedPublicType = true;
        });
      });
      const roleWidthChanged = putStyle(record.role, 'width', editing ? 'fit-content' : 'max-content');
      if (!editing && roleWidthChanged) changedPublicType = true;
      record.item.classList.toggle('is-focused', measure.focused);
      record.item.classList.toggle('is-spotlit', measure.spotlit);
      if (hidden) continue;
      if (!editing) {
        if (Number.isFinite(measure.mirrorWidth) && measure.mirrorWidth > 0) measure.width = measure.mirrorWidth;
        if (Number.isFinite(measure.mirrorHeight) && measure.mirrorHeight > 0) measure.height = measure.mirrorHeight;
      }
    }
    if (!editing) placePublic(measures, origin.width / hostScaleX, origin.height / hostScaleY, hostScaleX, hostScaleY);
    for (const measure of measures) {
      const { record } = measure;
      if (measure.hidden) continue;
      const widthChanged = putStyle(record.item, 'width', measure.width + 'px');
      const heightChanged = putStyle(record.item, 'height', measure.height + 'px');
      if (!editing && (widthChanged || heightChanged)) changedPublicType = true;
      putStyle(record.item, 'transform', `translate3d(${measure.x.toFixed(3)}px,${measure.y.toFixed(3)}px,0) scale(${measure.sx.toFixed(5)},${measure.sy.toFixed(5)})`);
    }
    if (changedPublicType) refresh();
  }

  function refresh(rebuild = false, type = false) {
    reconcileNeeded ||= rebuild;
    stylesNeeded ||= type;
    if (!destroyed && !frame && !document.hidden) frame = requestFrame(draw);
  }

  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => refresh(false, true)) : null;
  const mutation = new MutationObserver(changes => {
    let update = false;
    let rebuild = false;
    let type = false;
    for (const change of changes) {
      if (isOurs(change.target)) continue;
      // Motion variables never move a label's authored anchor. Ignore that
      // input stream; resize, saved transforms, type and focus still refresh.
      if (change.type === 'attributes' && typeof change.oldValue === 'string') {
        if (change.attributeName === 'style' && change.target.matches('.exco-landscape,.exco-world-stage')) {
          const structural = value => value.replace(/--exco-(?:pointer-[xy]|scroll(?:-sway)?|tilt-[xy])\s*:[^;]+;?/g, '').replace(/\s+/g, '');
          if (structural(change.oldValue) === structural(change.target.getAttribute('style') || '')) continue;
        }
        if (change.attributeName === 'class' && change.target.matches('.exco-landscape,.exco-world-stage')) {
          const structural = value => value.split(/\s+/).filter(name => !['is-in-view', 'is-motion-paused'].includes(name)).sort().join(' ');
          if (structural(change.oldValue) === structural(change.target.className)) continue;
        }
      }
      if (change.type === 'childList') {
        const changed = [...change.addedNodes, ...change.removedNodes];
        if (changed.length && changed.every(isOurs)) continue;
        // Footsteps, sprite cells and decorative plants do not change a name.
        // Only reconcile when labels or their actual actor containers change.
        const selector = '.exco-person-place,.exco-person-label,.exco-person-character,.exco-cutout-figure,.exco-person-pose';
        if (change.target.closest?.('.exco-person-label') || changed.some(node => node.matches?.(selector) || node.querySelector?.(selector))) update = rebuild = type = true;
      } else if (change.type === 'characterData') {
        if (change.target.parentElement?.closest('.exco-person-label')) update = rebuild = type = true;
      } else if (change.target === host || change.target.matches('.exco-person-place,.exco-person,.exco-person-label,.exco-person-name,.exco-person-role,.exco-person-character,.exco-cutout-figure,.exco-person-pose,.exco-landscape,.exco-world-stage')) {
        update = true;
        type ||= change.attributeName === 'class' || change.target === host || change.target.matches('.exco-person-name,.exco-person-role');
      }
    }
    if (update) refresh(rebuild, type);
  });
  mutation.observe(host, { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true, attributeFilter: ['style', 'class', 'hidden', 'src', 'width', 'height', 'data-label-head-x', 'data-label-head-y'] });

  const onResize = () => refresh(false, true);
  const onFocus = () => refresh();
  const onImageLoad = event => { if (event.target.matches?.('.exco-person-pose')) refresh(); };
  const onVisibility = () => {
    if (document.hidden && frame) { cancelFrame(frame); frame = 0; }
    else if (!document.hidden) refresh(false, true);
  };
  window.addEventListener('resize', onResize, { passive: true });
  host.addEventListener('focusin', onFocus);
  host.addEventListener('focusout', onFocus);
  host.addEventListener('load', onImageLoad, true);
  document.addEventListener('visibilitychange', onVisibility);
  document.fonts?.addEventListener('loadingdone', onResize);
  document.fonts?.ready?.then(onResize);

  window.MIT_FOREST_LABELS = {
    refresh: () => refresh(false, true),
    destroy() {
      destroyed = true;
      if (frame) cancelFrame(frame);
      mutation.disconnect();
      resize?.disconnect();
      window.removeEventListener('resize', onResize);
      host.removeEventListener('focusin', onFocus);
      host.removeEventListener('focusout', onFocus);
      host.removeEventListener('load', onImageLoad, true);
      document.removeEventListener('visibilitychange', onVisibility);
      document.fonts?.removeEventListener('loadingdone', onResize);
      overlay?.remove();
      host.classList.remove('forest-labels-ready');
      records.clear();
    }
  };
  Promise.resolve(window.MIT_CREW_READY).then(() => refresh(true, true));
})();
