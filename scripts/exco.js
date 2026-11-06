(() => {
  'use strict';
  const setImage = (image, source) => window.MIT_IMAGES ? window.MIT_IMAGES.set(image, source) : (image.src = source);
  const requestFrame = window.MIT_MOTION?.request || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
  const cancelFrame = window.MIT_MOTION?.cancel || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);

  // Retire the old site-wide night preference. The woodland starts in daylight
  // on every visit; editor drafts and other storage records are independent.
  try { window.localStorage.removeItem('mit-site-theme-v1'); } catch { /* Private browsing still starts in daylight. */ }
  const host = document.getElementById('committee-grid');
  if (!host) return;
  const term = window.MIT_CONTENT?.committeeTerm || '2026–27';
  let dialogs = [];
  let cleanupMotion = () => {};
  const phoneTilt = window.MIT_PHONE_TILT;

  // Each anchor is a foot position within a clearing, not a card-grid cell.
  const places = [
    { x: 76, y: 64, mx: 76, my: '64%' },
    { x: 26, y: 99, mx: 26, my: '99%' },
    { x: 76, y: 35, mx: 76, my: '35%' },
    { x: 25, y: 45, mx: 25, my: '45%' },
    { x: 73, y: 99, mx: 73, my: '99%' },
    { x: 26, y: 62, mx: 26, my: '62%' },
    { x: 76, y: 69, mx: 76, my: '69%' },
    { x: 27, y: 96, mx: 27, my: '96%' },
    { x: 75, y: 99, mx: 75, my: '99%' },
    { x: 25, y: 87, mx: 25, my: '87%' },
    { x: 75, y: 94, mx: 75, my: '94%' }
  ];

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const button = (className, text, label) => {
    const element = node('button', className, text);
    element.type = 'button';
    if (label) element.setAttribute('aria-label', label);
    return element;
  };
  const safeLink = value => {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, document.baseURI);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };

  function photoSlot(person, large = false, index = 0) {
    const slot = node('span', 'exco-photo-slot' + (large ? ' exco-photo-slot-large' : ''));
    const imageUrl = safeLink(person.image);
    if (imageUrl) {
      const image = node('img', 'exco-portrait-image');
      setImage(image, imageUrl);
      image.alt = person.name;
      image.width = person.imageWidth || 360;
      image.height = person.imageHeight || 480;
      image.loading = large ? 'eager' : 'lazy';
      image.decoding = 'async';
      slot.append(image);
    } else {
      slot.classList.add('exco-photo-pending');
      slot.setAttribute('aria-label', 'Portrait coming soon');
      const icon = node('span', 'exco-camera');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 11 12-1 5-6 19 1 4 6 14 2-2 29-53-2 1-29Z"/><circle cx="32" cy="26" r="11"/><path d="m48 18 5 1M12 33l3 1"/></svg>';
      if (large) {
        const standIn = node('img', 'exco-profile-doodle');
        setImage(standIn, safeLink(person.previewImage) || 'assets/images/exco-world/characters/pose-' + String(index + 1).padStart(2, '0') + '.webp');
        standIn.alt = '';
        standIn.width = 180;
        standIn.height = 240;
        slot.append(standIn, node('span', 'exco-photo-note', 'portrait coming soon'));
      } else slot.append(icon);
    }
    return slot;
  }

  function detail(label, value, wide = false) {
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
    const item = node('div', 'exco-detail' + (wide ? ' exco-detail-wide' : ''));
    item.append(node('dt', 'exco-detail-label', label));
    item.append(node('dd', 'exco-detail-value', value));
    return item;
  }

  function portraitGarden(person, index) {
    const custom = window.MIT_PORTRAIT_BAKED?.profiles?.[window.MIT_PORTRAITS?.people[index]];
    if (custom && window.MIT_PORTRAITS) return window.MIT_PORTRAITS.render(node('div'), person, index, custom, { public: true });
    const garden = node('div', 'exco-portrait-garden');
    const gardens = [
      ['natalie', 'fern', 'fern', 'flowers'],
      ['kar-way', 'grass', 'fern', 'log'],
      ['elayna', 'fern', 'fern', 'daisies'],
      ['yu-jing', 'fern', 'grass', 'flowers'],
      ['alfred', 'paper-fern', 'flowers', 'log'],
      ['wei-shen', 'grass', 'paper-fern', 'flowers'],
      ['puteri', 'fern', 'flowers', 'grass'],
      ['yamone', 'flowers', 'fern', 'daisies'],
      ['luther', 'paper-fern', 'fern', 'log'],
      ['jun-leong', 'fern', 'grass', 'log'],
      ['pei-ni', 'flowers', 'paper-fern', 'daisies']
    ];
    const plants = {
      fern: ['atelier-v6/foreground-fern.webp', 640, 800],
      flowers: ['exco-world/props/fern-patch.webp', 700, 280],
      log: ['exco-world/props/log-ferns.webp', 700, 233],
      grass: ['woodland-editor/grass-meadow.webp', 1774, 887],
      'paper-fern': ['woodland-editor/fern-paper.webp', 1225, 1284],
      daisies: ['woodland-editor/daisies-paper.webp', 1536, 1024]
    };
    const [id, left, right, front] = gardens[index];
    garden.dataset.garden = id;
    // Keep foliage outside the photo's clipping frame. Back leaves sit under
    // the paper; the little flower patch overlaps only its bottom edge.
    const decoration = (file, className, width, height) => {
      const image = node('img', 'exco-portrait-botanical ' + className);
      setImage(image, 'assets/images/' + file);
      image.alt = '';
      image.width = width;
      image.height = height;
      image.loading = 'lazy';
      image.setAttribute('aria-hidden', 'true');
      return image;
    };
    garden.append(
      decoration(plants[left][0], 'exco-portrait-leaves', plants[left][1], plants[left][2]),
      decoration(plants[right][0], 'exco-portrait-sprigs', plants[right][1], plants[right][2]),
      photoSlot(person, true, index),
      decoration(plants[front][0], 'exco-portrait-flowers', plants[front][1], plants[front][2])
    );
    return garden;
  }


  function createDialog(person, index, trigger) {
    const dialog = node('dialog', 'exco-dialog');
    dialog.id = 'exco-profile-' + (index + 1);
    const headingId = dialog.id + '-name';
    const roleId = dialog.id + '-role';
    dialog.setAttribute('aria-labelledby', headingId);
    dialog.setAttribute('aria-describedby', roleId);

    const bar = node('div', 'sheet-handle sheet-grip-wrap');
    const grip = node('span', 'sheet-grip');
    grip.setAttribute('aria-hidden', 'true');
    bar.append(grip);
    const close = button('exco-close icon-btn', '×', 'Close ' + person.name + "'s profile");
    close.setAttribute('data-close', '');
    close.autofocus = true;
    close.addEventListener('click', () => { if (!window.MIT_SHEET) dialog.close(); });
    bar.append(close);

    const body = node('div', 'exco-profile-body');
    const photoColumn = node('div', 'exco-profile-photo');
    photoColumn.append(portraitGarden(person, index));
    const copy = node('div', 'exco-profile-copy');
    copy.append(node('span', 'exco-term tag tag--stamp', 'AY ' + (person.term || window.MIT_CONTENT?.committeeTerm || term)));
    const heading = node('h2', 'exco-profile-name', person.name);
    heading.id = headingId;
    const role = node('p', 'exco-profile-role', person.role);
    role.id = roleId;
    copy.append(heading, role);
    if (typeof person.bio === 'string' && person.bio.trim()) copy.append(node('p', 'exco-bio', person.bio));
    const details = node('dl', 'exco-details');
    const fields = [detail('Programme', person.programme, !person.year), detail('Year', person.year), detail('Favourite craft', person.favouriteCraft, true), detail('Fun fact', person.funFact, true)].filter(Boolean);
    if (fields.length) { details.append(...fields); copy.append(details); }
    const personalLink = safeLink(person.personalLink);
    if (personalLink) {
      const link = node('a', 'exco-personal-link', 'Say hello ↗');
      link.href = personalLink;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', 'Visit ' + person.name + "'s personal link");
      copy.append(link);
    }
    body.append(photoColumn, copy);
    dialog.append(bar, body);

    let savedOverflow = '';
    dialog.addEventListener('close', () => {
      if (!window.MIT_SHEET) {
        document.body.style.overflow = savedOverflow;
        trigger.focus({ preventScroll: true });
      }
    });
    dialog.addEventListener('click', event => {
      if (window.MIT_SHEET) return;
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    document.body.append(dialog);
    dialogs.push(dialog);
    return () => {
      if (window.MIT_SHEET) { window.MIT_SHEET.open(dialog, { trigger }); return; }
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
    };
  }



  function scenery(file, className, width, height) {
    const image = node('img', 'exco-scenery ' + className);
    setImage(image, 'assets/images/exco-world/immersive/' + file + '.webp');
    image.alt = '';
    image.width = width;
    image.height = height;
    image.loading = 'lazy';
    image.setAttribute('aria-hidden', 'true');
    return image;
  }

  function fireflies(sceneIndex) {
    const swarm = node('span', 'exco-fireflies');
    swarm.setAttribute('aria-hidden', 'true');
    const points = [[12, 18], [87, 31], [48, 46], [15, 68], [91, 85], [51, 91], [35, 55], [66, 12], [7, 40], [80, 62], [39, 78], [60, 34], [26, 26], [70, 82], [95, 49], [22, 8], [54, 21], [82, 9], [5, 57], [30, 72], [61, 59], [92, 72], [18, 88], [44, 12], [74, 42], [9, 30], [36, 38], [57, 80], [84, 95], [71, 68]];
    const count = window.navigator?.hardwareConcurrency <= 4 ? 0 : window.innerWidth < 768 ? 12 : points.length;
    for (let index = 0; index < count; index++) {
      const light = node('i');
      const point = points[(index + sceneIndex * 4) % points.length];
      light.style.setProperty('--fly-x', point[0] + '%');
      light.style.setProperty('--fly-y', point[1] + '%');
      light.style.setProperty('--fly-delay', (-index * 1.7 - sceneIndex * 2.3) + 's');
      light.style.setProperty('--fly-drift', (11 + (index * 3 + sceneIndex) % 9) + 's');
      light.style.setProperty('--fly-pulse', (6 + (index * 2 + sceneIndex) % 7) + 's');
      light.style.setProperty('--fly-size', (1.8 + index % 4 * .45) + 'px');
      light.style.setProperty('--fly-dx', ((index % 2 ? -1 : 1) * (7 + index % 5 * 3)) + 'px');
      light.style.setProperty('--fly-dy', (-9 - index % 6 * 3) + 'px');
      swarm.append(light);
    }
    return swarm;
  }

  function sceneLamp(sceneIndex, index) {
    // Separate hanging fixtures: their light, cord and paper artwork move as
    // one editable object. Existing trees, people and saved anchors stay put.
    const positions = [
      [[15, 24, 8.8, 62], [91, 36, 8, 76], [91, 70, 7.8, 72], [8, 83, 8.3, 64]],
      [[12, 12, 8.2, 52], [91, 27, 8.8, 76], [92, 57, 7.8, 70], [10, 82, 8, 62]],
      [[87, 17, 8.6, 64], [8, 38, 8, 56], [9, 66, 7.8, 76], [91, 82, 8.5, 62]]
    ];
    const [x, y, size, cord] = positions[sceneIndex][index];
    const lamp = node('span', 'exco-scene-lamp');
    lamp.dataset.lamp = String(index);
    lamp.setAttribute('aria-hidden', 'true');
    lamp.style.cssText = '--lamp-x:' + x + '%;--lamp-y:' + y + '%;--lamp-size:' + size + 'cqw;--lamp-cord:' + cord + 'px;--lamp-delay:' + (-index * 1.8 - sceneIndex) + 's';
    const halo = node('span', 'exco-lamp-halo');
    const pool = node('span', 'exco-lamp-pool');
    const art = node('img', 'exco-lamp-art');
    setImage(art, 'assets/images/woodland-editor/lantern-paper.webp');
    art.alt = ''; art.width = 1254; art.height = 1254; art.loading = 'lazy';
    lamp.append(halo, pool, art);
    return lamp;
  }

  function configureMotion(world) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let visible = false;
    let pointerX = 0;
    let pointerY = 0;
    let pending = 0;
    let targetScroll = 0;
    let scrollImpulse = 0;
    let lastScrollY = window.scrollY;
    let lastScrollAt = 0;
    let currentScroll = 0;
    let currentX = 0;
    let currentY = 0;
    let previousFrame = 0;
    let pointerBounds = null;
    const cachePointerBounds = rect => {
      const box = rect || world.getBoundingClientRect();
      pointerBounds = { left: box.left + (window.scrollX || 0), top: box.top + window.scrollY, width: box.width || 1, height: box.height || 1 };
    };
    let dialogOpen = !!document.querySelector('dialog[open]');
    const blocked = () => reduced.matches || document.hidden || dialogOpen;
    // Keep the initial input gain, then ease into a short travel envelope.
    // This limits displacement without making small tilts feel sluggish.
    const limitTravel = (value, limit) => limit * Math.tanh(value / limit);
    const paintProperty = (key, value) => {
      if (world.style.getPropertyValue(key) !== value) world.style.setProperty(key, value);
    };

    function reset() {
      currentScroll = currentX = currentY = scrollImpulse = 0;
      lastScrollY = window.scrollY;
      lastScrollAt = 0;
      previousFrame = 0;
      for (const key of ['--exco-pointer-x', '--exco-pointer-y', '--exco-scroll']) paintProperty(key, '0px');
      paintProperty('--exco-tilt-x', '0deg');
      paintProperty('--exco-tilt-y', '0deg');
      paintProperty('--exco-scroll-sway', '0deg');
      window.MIT_FOREST_LAYOUT?.syncLights?.(world);
    }
    function draw(timestamp) {
      pending = 0;
      if (!visible || blocked()) return;
      // Scroll is the primary depth input on phones. Frame-rate independent easing
      // smooths touch momentum without intercepting touch events or scroll position.
      const elapsed = previousFrame ? timestamp - previousFrame : 16;
      previousFrame = timestamp;
      // Scroll speed creates a temporary breeze, with no position-based offset.
      // Negative asset depth weights push opposite to the signed scroll delta.
      targetScroll = scrollImpulse * Math.exp(-Math.max(0, timestamp - lastScrollAt) / 230);
      if (Math.abs(targetScroll) < .04) targetScroll = scrollImpulse = 0;
      const ease = 1 - Math.exp(-elapsed / 95);
      currentScroll += (targetScroll - currentScroll) * (1 - Math.exp(-elapsed / 70));
      const desiredX = limitTravel(pointerX * 14 + (phoneTilt?.state.x || 0) * 70, 18);
      const desiredY = limitTravel(pointerY * 9 + (phoneTilt?.state.y || 0) * 48, 14);
      currentX += (desiredX - currentX) * ease;
      currentY += (desiredY - currentY) * ease;
      const moving = Math.abs(scrollImpulse) > .04 || Math.abs(targetScroll - currentScroll) > .08 || Math.abs(desiredX - currentX) > .03 || Math.abs(desiredY - currentY) > .03;
      if (!moving) { currentScroll = targetScroll; currentX = desiredX; currentY = desiredY; }
      paintProperty('--exco-scroll', currentScroll.toFixed(2) + 'px');
      paintProperty('--exco-pointer-x', currentX.toFixed(2) + 'px');
      paintProperty('--exco-pointer-y', currentY.toFixed(2) + 'px');
      paintProperty('--exco-tilt-x', (-currentY / 9 * 2).toFixed(2) + 'deg');
      paintProperty('--exco-tilt-y', (currentX / 14 * 3).toFixed(2) + 'deg');
      // Humans rock side to side only while the scroll breeze is active.
      // Their independent idle bounce and label anchors are unaffected by tilt.
      const sway = Math.sin(timestamp / 170) * Math.min(2.8, Math.abs(currentScroll) * .13);
      paintProperty('--exco-scroll-sway', sway.toFixed(3) + 'deg');
      window.MIT_FOREST_LAYOUT?.syncLights?.(world);
      if (moving) pending = requestFrame(draw);
      else previousFrame = 0;
    }
    function schedule() {
      if (!pending && visible && !blocked()) pending = requestFrame(draw);
    }
    function scrollChanged() {
      const delta = window.scrollY - lastScrollY;lastScrollY = window.scrollY;
      if (visible && !blocked() && delta) {
        const now = performance.now(), since = now - lastScrollAt;
        const interval = lastScrollAt && since < 120 ? Math.max(8, since) : 16;
        lastScrollAt = now;
        // Pixels per millisecond, so the same distance produces more wind when
        // scrolled quickly. A long idle gap starts a fresh sample, not a jump.
        scrollImpulse = limitTravel(delta / interval * 22, 32);
      }
      schedule();
    }
    function visibilityChanged() {
      world.classList.toggle('is-motion-paused', blocked());
      window.MIT_FOREST_LAYOUT?.syncLights?.(world);
      if (document.hidden) { if (pending) cancelFrame(pending); pending = 0; reset(); }
      else scrollChanged();
    }
    function point(event) {
      if (dialogOpen || !finePointer.matches || event.pointerType === 'touch') return;
      if (!pointerBounds) cachePointerBounds();
      pointerX = Math.max(-1, Math.min(1, (event.clientX + (window.scrollX || 0) - pointerBounds.left) / pointerBounds.width * 2 - 1));
      pointerY = Math.max(-1, Math.min(1, (event.clientY + window.scrollY - pointerBounds.top) / pointerBounds.height * 2 - 1));
      schedule();
    }
    function leave() { pointerX = 0; pointerY = 0; schedule(); }
    function preferenceChanged() {
      world.classList.toggle('is-motion-paused', blocked());
      window.MIT_FOREST_LAYOUT?.syncLights?.(world);
      if (pending) cancelFrame(pending);
      pending = 0;
      reset();
      scrollChanged();
    }
    function dialogChanged() {
      const next = !!document.querySelector('dialog[open]');
      if (next === dialogOpen) return;
      dialogOpen = next;
      world.classList.toggle('is-motion-paused', blocked());
      window.MIT_FOREST_LAYOUT?.syncLights?.(world);
      if (pending) cancelFrame(pending);
      pending = 0;
      // Freeze the exact placement while a profile is read. Discard wind from
      // before the dialog and smoothly settle/resume from this position later.
      previousFrame = lastScrollAt = scrollImpulse = targetScroll = 0;
      lastScrollY = window.scrollY;
      if (!dialogOpen) schedule();
    }
    const dialogs = new MutationObserver(dialogChanged);
    dialogs.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
    world.classList.toggle('is-motion-paused', blocked());
    let observer;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (entries[0].boundingClientRect) cachePointerBounds(entries[0].boundingClientRect);
        world.classList.toggle('is-in-view', visible);
        if (visible) scrollChanged();
        else { if (pending) cancelFrame(pending); pending = 0; reset(); }
      }, { rootMargin: '120px' });
      observer.observe(world);
    } else { visible = true; world.classList.add('is-in-view'); schedule(); }

    const stopTilt = phoneTilt?.subscribe(schedule);
    const boundsObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => cachePointerBounds()) : null;
    boundsObserver?.observe(world);
    window.addEventListener('scroll', scrollChanged, { passive: true });
    window.addEventListener('resize', scrollChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    world.addEventListener('pointermove', point, { passive: true });
    world.addEventListener('pointerleave', leave);
    reduced.addEventListener('change', preferenceChanged);
    return () => {
      observer?.disconnect();
      boundsObserver?.disconnect();
      dialogs.disconnect();
      stopTilt?.();
      if (pending) cancelFrame(pending);
      window.removeEventListener('scroll', scrollChanged);
      window.removeEventListener('resize', scrollChanged);
      document.removeEventListener('visibilitychange', visibilityChanged);
      world.removeEventListener('pointermove', point);
      world.removeEventListener('pointerleave', leave);
      reduced.removeEventListener('change', preferenceChanged);
    };
  }


  function makePerson(person, index) {
    const place = places[index];
    const item = node('li', 'exco-person-place');
    item.dataset.person = String(index);
    item.style.setProperty('--actor-bounce-duration', (4.4 + index % 4 * .45) + 's');
    item.style.setProperty('--actor-bounce-delay', (-index * .83) + 's');
    item.style.setProperty('--actor-bounce-height', (2.6 + index % 4 * .45) + 'px');
    item.style.setProperty('--actor-scroll-rock', (index % 2 ? -1 : 1) * (.85 + index % 4 * .1));
    item.style.setProperty('--exco-person-x', place.x + '%');
    item.style.setProperty('--exco-person-y', place.y + '%');
    item.style.setProperty('--exco-person-mobile-x', place.mx + '%');
    item.style.setProperty('--exco-person-mobile-y', place.my);
    const personButton = button('exco-person', '', 'Get to know ' + person.name + ', ' + person.role);
    personButton.setAttribute('aria-haspopup', 'dialog');
    personButton.setAttribute('aria-controls', 'exco-profile-' + (index + 1));

    const label = node('span', 'exco-person-label');
    label.dataset.labelId = 'label-' + index;
    label.append(node('span', 'exco-person-name', person.name), node('span', 'exco-person-role', person.role));
    const art = node('span', 'exco-person-art');
    const shadow = node('span', 'exco-person-ground');
    shadow.setAttribute('aria-hidden', 'true');
    const image = node('img', 'exco-person-pose');
    const preview = safeLink(person.previewImage);
    setImage(image, preview || 'assets/images/exco-world/characters/pose-' + String(index + 1).padStart(2, '0') + '.webp');
    image.alt = '';
    // Labels follow the head area of the same pose, including raised arms and
    // wide craft tables whose full image box is not the person's silhouette.
    image.setAttribute('data-label-head-x', String(person.previewHead?.x ?? .5));
    image.setAttribute('data-label-head-y', String(person.previewHead?.y ?? .17));
    image.width = [285, 155, 264, 247, 186, 233, 212, 242, 316, 248, 309][index];
    image.height = 380;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.setAttribute('aria-hidden', 'true');
    if (preview) {
      item.classList.add('has-person-cutout');
      const figure = node('span', 'exco-cutout-figure');
      figure.style.setProperty('--cutout-ratio', (person.previewWidth || 1) / (person.previewHeight || 1));
      figure.style.setProperty('--cutout-scale', Math.max(.5, Math.min(3, Number(person.previewScale) || 1)));
      figure.style.setProperty('--cutout-offset-x', (Number(person.previewOffsetX) || 0) + 'px');
      figure.style.setProperty('--cutout-offset-y', (Number(person.previewOffsetY) || 0) + 'px');
      image.width = person.previewWidth || 480;
      image.height = person.previewHeight || 640;
      figure.append(image);
      // The saved character transform is independent of the old button box.
      // Follow the visible cutout, with its transparent margins excluded, so
      // one person's empty rectangle cannot intercept a neighbouring person.
      const hit = node('span', 'exco-pose-hit');
      hit.setAttribute('aria-hidden', 'true');
      const hitArea = Object.entries(window.MIT_POSE_HIT_AREAS || {})
        .find(([source]) => safeLink(source) === preview)?.[1];
      if (hitArea) hit.style.setProperty('clip-path', hitArea);
      figure.append(hit);
      if (person.name === 'Alfred') {
        // His supplied photo ends at the waist. Keep that honest crop nestled
        // in foliage, and move the whole figure clear of Elayna's raised arm.
        item.classList.add('has-book-garden');
        const foliage = node('img', 'exco-book-garden');
        setImage(foliage, 'assets/images/exco-world/props/fern-patch.webp');
        foliage.alt = ''; foliage.width = 700; foliage.height = 280;
        foliage.loading = 'lazy'; foliage.decoding = 'async';
        foliage.setAttribute('aria-hidden', 'true');
        figure.append(foliage);
      }
      if (person.name === 'Luther') {
        item.classList.add('has-table-garden');
        for (const [file, className, width, height] of [
          ['committee/previews/luther-table-supplies-v1.webp','exco-table-supplies',640,427],
          ['woodland-editor/grass-meadow.webp','exco-table-grass',1774,887],
          ['exco-world/props/fern-patch.webp','exco-table-flowers',700,280]
        ]) {
          const decoration = node('img',className);
          setImage(decoration, 'assets/images/' + file);
          decoration.alt = ''; decoration.width = width; decoration.height = height;
          decoration.loading = 'lazy'; decoration.decoding = 'async';
          decoration.setAttribute('aria-hidden','true');
          figure.append(decoration);
        }
      }
      art.append(figure);
    } else art.append(image);
    const feet = node('span', 'exco-person-feet');
    feet.setAttribute('aria-hidden', 'true');
    const leaves = node('img', 'exco-foot-leaves');
    const hasLog = [7, 8].includes(index);
    setImage(leaves, 'assets/images/exco-world/props/' + (hasLog ? 'log-ferns.webp' : 'fern-patch.webp'));
    leaves.alt = ''; leaves.width = 700; leaves.height = hasLog ? 233 : 280; leaves.loading = 'lazy';
    feet.append(leaves);
    // Editing the artwork must not resize or move the profile's name label.
    // The original person-place stays as the saved scene anchor.
    const character = node('span', 'exco-person-character');
    character.append(shadow, art, feet);
    personButton.append(label, character);
    // Build only the profile that is opened, keeping eleven portrait gardens
    // out of the initial render and avoiding eager modal image work on phones.
    let openProfile, profileSignature = '';
    personButton.addEventListener('click', () => {
      const nextSignature = JSON.stringify(person);
      if (!openProfile || nextSignature !== profileSignature) {
        const oldDialog = document.getElementById('exco-profile-' + (index + 1));
        if (oldDialog && !oldDialog.open) { oldDialog.remove(); dialogs = dialogs.filter(dialog => dialog !== oldDialog); }
        openProfile = createDialog(person, index, personButton); profileSignature = nextSignature;
      }
      openProfile();
    });
    item.append(personButton);
    return item;
  }

  function render(people) {
    cleanupMotion();
    dialogs.forEach(dialog => dialog.remove());
    dialogs = [];
    host.replaceChildren();
    host.hidden = false;
    host.classList.remove('committee-grid', 'exco-grid', 'exco-story', 'exco-grove');
    host.classList.add('exco-world');

    const scenes = [
      { label: 'The treehouse', note: 'Every idea starts somewhere.', members: [0, 1, 4] },
      { label: 'The craft camp', note: 'A little making magic.', members: [2, 5, 6, 7, 8] },
      { label: 'The makers’ lookout', note: 'Then we share it with the world.', members: [3, 9, 10] }
    ];
    const lanternDock = node('div', 'woodland-lantern-dock');
    const lantern = button('exco-lantern-toggle woodland-lantern-button', '', 'Turn off the lantern and switch to evening');
    lantern.setAttribute('aria-pressed', 'true');
    lantern.setAttribute('title', 'Turn off the lantern and switch to evening');
    const lanternIcon = node('span', 'woodland-lantern-icon');
    lanternIcon.setAttribute('aria-hidden', 'true');
    const lanternArt = node('img', 'woodland-lantern-art');
    setImage(lanternArt, 'assets/images/woodland-editor/lantern-paper.webp');
    lanternArt.alt = ''; lanternArt.width = 1254; lanternArt.height = 1254;
    lanternIcon.append(lanternArt);
    lantern.append(lanternIcon);
    const lanternHint = node('span', 'woodland-lantern-hint', 'Click me');
    lanternHint.setAttribute('aria-hidden', 'true');
    const lanternArrow = node('span', 'woodland-lantern-arrow');
    lanternArrow.setAttribute('aria-hidden', 'true');
    lanternArrow.innerHTML = '<svg viewBox="0 0 68 42" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6C16 32 43 37 62 18M49 18l13 0-3 13"/></svg>';
    const landscape = node('div', 'exco-landscape');
    const applyEvening = evening => {
      host.classList.toggle('is-evening', evening);
      host.closest('#people')?.classList.toggle('is-evening', evening);
      lantern.setAttribute('aria-pressed', String(!evening));
      const label = evening ? 'Turn on the lantern and switch to daylight' : 'Turn off the lantern and switch to evening';
      lantern.setAttribute('aria-label', label);
      lantern.setAttribute('title', label);
    };
    applyEvening(false);
    // Animate the live scenery, retaining the forest and lantern on every frame.
    const lanternReveal = window.MIT_WOODLAND_LANTERN?.create({ button: lantern, world: landscape, apply: applyEvening, getEvening: () => host.classList.contains('is-evening') });
    lantern.addEventListener('click', () => lanternReveal ? lanternReveal.toggle() : applyEvening(!host.classList.contains('is-evening')));
    lanternDock.append(lanternHint, lanternArrow, lantern);
    host.append(lanternDock);
    // Natural-aspect paper tiles preserve the fine material at every width.
    // Alternate vertical reflection registers each adjoining edge exactly.
    const terrain = node('div', 'exco-terrain');
    terrain.setAttribute('aria-hidden', 'true');
    for (let tile = 0; tile < 4; tile++) {
      const ground = node('img', 'exco-ground-material');
      setImage(ground, 'assets/images/woodland-v10/floor-material-light.webp');
      ground.alt = ''; ground.width = 1086; ground.height = 1448; ground.loading = 'lazy';
      terrain.append(ground);
    }
    const path = node('img', 'exco-path-plane');
    setImage(path, 'assets/images/woodland-v10/path-paper.svg');
    path.alt = ''; path.width = 820; path.height = 2400; path.hidden = true;
    path.loading = 'lazy'; path.setAttribute('aria-hidden', 'true');
    const understory = node('div', 'exco-understory');
    understory.setAttribute('aria-hidden', 'true');
    const groundDetails = [
      ['island', 8, 11, 27, 1], ['island', 91, 23, 28, -1],
      ['log', 8, 31, 35, 1], ['island', 93, 36.5, 26, 1],
      ['island', -2, 47, 25, -1], ['log', 108, 56, 31, -1],
      ['island', 5, 72, 25, 1], ['island', 91, 83, 30, -1],
      ['log', 8, 96, 34, 1], ['island', 91, 94, 29, 1]
    ];
    groundDetails.forEach(([kind, x, y, size, facing]) => {
      const detail = node('span', 'exco-ground-detail');
      detail.style.cssText = '--detail-x:' + x + '%;--detail-y:' + y + '%;--detail-size:' + size + 'cqw;--detail-facing:' + facing;
      const art = node('img');
      setImage(art, kind === 'log' ? 'assets/images/exco-world/props/log-ferns.webp' : 'assets/images/woodland-v8/floor-island.webp');
      art.alt = ''; art.width = kind === 'log' ? 700 : 768; art.height = kind === 'log' ? 233 : 512; art.loading = 'lazy';
      detail.append(art); understory.append(detail);
    });
    landscape.append(terrain, path, understory);
    const motionStops = [];
    scenes.forEach((scene, sceneIndex) => {
      const world = node('div', 'exco-world-stage');
      world.dataset.scene = String(sceneIndex);
      world.setAttribute('role', 'group');
      world.setAttribute('aria-label', scene.label + ': the EXCO crew');
      if (sceneIndex === 2) {
        const creek = node('img', 'exco-creek-plane');
        setImage(creek, 'assets/images/woodland-v10/creek-paper.svg');
        creek.alt = ''; creek.width = 1200; creek.height = 320; creek.loading = 'lazy'; creek.hidden = true;
        creek.setAttribute('aria-hidden', 'true');
        world.append(creek);
      }
      const depth = node('div', 'exco-world-depth');
      depth.setAttribute('aria-hidden', 'true');
      const grove = node('img', 'exco-back-grove');
      setImage(grove, 'assets/images/exco-world/props/woodland-grove-complete.webp');
      grove.alt = ''; grove.width = 1200; grove.height = 600; grove.loading = 'lazy';
      if (sceneIndex === 1) {
        // The same birch crosses the preceding workbench. Its bark belongs in
        // front, while the registered full canopy stays behind the crew/tools.
        const frontBirch = node('img', 'exco-back-grove exco-front-birch');
        setImage(frontBirch, 'assets/images/exco-world/props/woodland-grove-complete.webp');
        frontBirch.alt = ''; frontBirch.width = 1200; frontBirch.height = 600; frontBirch.loading = 'lazy';
        depth.append(frontBirch);
      }
      const station = window.MIT_HAMMER_BEAR ? window.MIT_HAMMER_BEAR.create(sceneIndex) : node('img', 'exco-station-art');
      if (station.tagName === 'IMG') {
        setImage(station, 'assets/images/exco-world/stations/station-' + String(sceneIndex + 1).padStart(2, '0') + '.webp');
        station.alt = ''; station.width = 600; station.height = 600; station.loading = 'lazy';
      }
      depth.append(grove, station);
      const edgeTree = node('img', 'exco-edge-tree');
      setImage(edgeTree, 'assets/images/exco-world/woodland/' + (sceneIndex === 1 ? 'woodland-birch' : 'woodland-oak') + '.webp');
      edgeTree.alt = ''; edgeTree.width = 600; edgeTree.height = 900; edgeTree.loading = 'lazy';
      depth.append(edgeTree);
      const forest = node('div', 'exco-forest');
      forest.setAttribute('aria-hidden', 'true');
      const trees = [
        [['ash', 9, 42, 87, 'far'], ['birch', 29, 43, 70, 'far'], ['oak', -14, 88, 82, 'middle']],
        [['ash', 7, 29, 85, 'far'], ['oak', 112, 61, 88, 'middle'], ['birch', -7, 105, 82, 'middle']],
        [['ash', -5, 49, 89, 'far'], ['oak', 107, 94, 86, 'middle']]
      ][sceneIndex];
      trees.forEach(([kind, x, y, height, plane]) => {
        const tree = node('span', 'exco-tree exco-tree-' + plane);
        tree.style.cssText = '--tree-x:' + x + '%;--tree-y:' + y + '%;--tree-height:' + height + 'cqw';
        const art = node('img');
        setImage(art, kind === 'ash' ? 'assets/images/woodland-v8/ash-tree.webp' : 'assets/images/exco-world/woodland/woodland-' + kind + '.webp');
        art.alt = ''; art.width = kind === 'ash' ? 640 : 600; art.height = kind === 'ash' ? 1280 : 900; art.loading = 'lazy';
        tree.append(art); forest.append(tree);
      });
      depth.append(forest);
      const foreground = node('div', 'exco-foreground');
      foreground.setAttribute('aria-hidden', 'true');
      if (sceneIndex < 2) {
        const bench = node('img', 'exco-shared-bench');
        setImage(bench, 'assets/images/exco-world/props/workbench.webp');
        bench.alt = ''; bench.width = 700; bench.height = 350; bench.loading = 'lazy';
        foreground.append(bench);
      }
      const nearPlants = node('img', 'exco-near-plants');
      setImage(nearPlants, 'assets/images/atelier-v6/foreground-fern.webp');
      nearPlants.alt = ''; nearPlants.width = 640; nearPlants.height = 800; nearPlants.loading = 'lazy';
      foreground.append(nearPlants);
      const crew = node('ul', 'exco-world-crew');
      crew.setAttribute('role', 'list');
      crew.setAttribute('aria-label', scene.label + ' EXCO members');
      scene.members.forEach(index => { if (people[index]) crew.append(makePerson(people[index], index)); });
      world.append(depth, crew, foreground);
      for (let lampIndex = 0; lampIndex < 4; lampIndex++) world.append(sceneLamp(sceneIndex, lampIndex));
      world.append(fireflies(sceneIndex));
      landscape.append(world);
      motionStops.push(configureMotion(world));
    });
    host.append(landscape);
    const stopLayoutMotion = window.MIT_FOREST_LAYOUT?.mount(host);
    if (typeof stopLayoutMotion === 'function') motionStops.push(stopLayoutMotion);
    // New photographic poses can cross scenery that used to sit above a
    // narrow stand-in. Preserve the saved composition, lifting only a pose
    // with an explicit foreground minimum; later higher saved layers win.
    if (!document.body.classList.contains('forest-editor')) host.querySelectorAll('.exco-person-place').forEach(place => {
      const layer = people[Number(place.dataset.person)]?.previewLayer;
      if (Number.isFinite(layer)) place.style.zIndex = Math.max(layer, Number(getComputedStyle(place).zIndex) || 0);
    });
    // Saved people can sit outside their original clearing. Their own artwork
    // bounds, rather than the entire clearing, determine idle playback.
    if ('IntersectionObserver' in window && !document.body.classList.contains('forest-editor')) {
      const actors = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.target) entry.target.classList.toggle(entry.target.tagName === 'I' ? 'firefly-in-view' : 'actor-in-view', entry.isIntersecting);
      }), {rootMargin:'8px'});
      host.querySelectorAll('.exco-person-art,.exco-fireflies i').forEach(art => actors.observe(art));
      motionStops.push(() => actors.disconnect());
      host.classList.add('actor-visibility-ready', 'firefly-visibility-ready');
    }
    motionStops.push(configureMotion(landscape));
    window.MIT_IMAGES?.scan(host);
    cleanupMotion = () => { motionStops.forEach(stop => stop()); lanternReveal?.destroy(); };
  }

  async function loadCrew() {
    try {
      const response = await fetch(new URL('scripts/committee.json', document.baseURI));
      if (!response.ok) throw new Error('Crew profiles could not be loaded.');
      const people = await response.json();
      if (!Array.isArray(people) || !people.length || people.some(person => typeof person.name !== 'string' || typeof person.role !== 'string')) throw new Error('Crew profiles are unavailable.');
      const sourcePeople = people.map(person => ({ ...person }));
      if (window.MIT_CMS && !document.body.classList.contains('forest-editor')) {
        const initial = window.MIT_CMS.collection('profile', sourcePeople);
        people.forEach((person, index) => Object.assign(person, initial[index]));
      }
      render(people);
      window.MIT_CREW = Object.freeze({ people: Object.freeze(people.slice()), focus: index => window.MIT_CREW_ROSTER?.focus(index) });
      if (!document.body.classList.contains('forest-editor')) window.MIT_CMS?.subscribe(() => {
        const updated = window.MIT_CMS.collection('profile', sourcePeople);
        people.forEach((person, index) => {
          const previousPreview = person.previewImage;
          for (const key of Object.keys(person)) if (!(key in updated[index])) delete person[key];
          Object.assign(person, updated[index]);
          const place = host.querySelector('.exco-person-place[data-person="' + index + '"]');
          if (!place) return;
          place.hidden = !!person.cmsHidden;
          place.querySelector('.exco-person-name').textContent = person.name;
          place.querySelector('.exco-person-role').textContent = person.role;
          place.querySelector('.exco-person').setAttribute('aria-label', 'Get to know ' + person.name + ', ' + person.role);
          if (person.previewImage && previousPreview !== person.previewImage) {
            const image = place.querySelector('.exco-person-pose');
            if (!image.closest('.exco-cutout-figure')) {
              const figure = node('span', 'exco-cutout-figure');
              figure.style.setProperty('--cutout-ratio', (person.previewWidth || 480) / (person.previewHeight || 640));
              figure.style.setProperty('--cutout-scale', person.previewScale || 1);
              image.width = person.previewWidth || 480; image.height = person.previewHeight || 640;
              image.parentNode.insertBefore(figure, image); figure.append(image); place.classList.add('has-person-cutout');
            }
            setImage(image, safeLink(person.previewImage));
          } else if (!person.previewImage && previousPreview) {
            const image = place.querySelector('.exco-person-pose'), figure = image.closest('.exco-cutout-figure');
            if (figure) figure.replaceWith(image);
            place.classList.remove('has-person-cutout'); image.width = [285,155,264,247,186,233,212,242,316,248,309][index]; image.height = 380;
            setImage(image, 'assets/images/exco-world/characters/pose-' + String(index + 1).padStart(2, '0') + '.webp');
          }
          const chip = host.closest('#people')?.querySelector('.roster-chip[data-person="' + index + '"]');
          if (chip) { chip.hidden = !!person.cmsHidden; chip.querySelector('.roster-chip-name').textContent = person.name; chip.querySelector('.roster-chip-role').textContent = person.role; }
        });
        window.MIT_CMS.applyPage(); window.MIT_FOREST_LABELS?.refresh();
      });
      window.MIT_CMS?.applyPage();
    } catch (error) {
      host.hidden = false;
      host.classList.add('exco-world');
      const notice = node('div', 'exco-load-notice');
      notice.setAttribute('role', 'status');
      notice.append(node('p', '', 'The crew is on the way.'));
      const retry = button('exco-retry', 'Try again');
      retry.addEventListener('click', () => { retry.disabled = true; loadCrew(); });
      notice.append(retry);
      host.replaceChildren(notice);
      console.error(error);
    }
  }
  const initialHash = location.hash;
  window.MIT_CREW_READY = loadCrew();
  Promise.all([window.MIT_PAGE_READY, window.MIT_EXPERIENCE_READY, window.MIT_CREW_READY]).then(() => {
    // Preserve direct section links after all asynchronous content has its final height.
    if (!initialHash || location.hash !== initialHash) return;
    const target = document.getElementById(initialHash.slice(1));
    if (target) requestFrame(() => target.scrollIntoView({ behavior: 'instant', block: 'start' }));
  });
})();
