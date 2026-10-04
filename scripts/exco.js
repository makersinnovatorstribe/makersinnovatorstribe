(() => {
  'use strict';

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
      image.src = imageUrl;
      image.alt = person.name;
      image.width = 360;
      image.height = 480;
      image.loading = 'lazy';
      slot.append(image);
    } else {
      slot.classList.add('exco-photo-pending');
      slot.setAttribute('aria-label', 'Portrait coming soon');
      const icon = node('span', 'exco-camera');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 11 12-1 5-6 19 1 4 6 14 2-2 29-53-2 1-29Z"/><circle cx="32" cy="26" r="11"/><path d="m48 18 5 1M12 33l3 1"/></svg>';
      if (large) {
        const standIn = node('img', 'exco-profile-doodle');
        standIn.src = 'assets/images/exco-world/characters/pose-' + String(index + 1).padStart(2, '0') + '.webp';
        standIn.alt = '';
        standIn.width = 180;
        standIn.height = 240;
        slot.append(standIn, node('span', 'exco-photo-note', 'portrait coming soon'));
      } else slot.append(icon);
    }
    return slot;
  }

  function detail(label, value, wide = false) {
    const item = node('div', 'exco-detail' + (wide ? ' exco-detail-wide' : ''));
    item.append(node('dt', 'exco-detail-label', label));
    item.append(node('dd', value ? 'exco-detail-value' : 'exco-detail-value exco-pending', value || 'To be added'));
    return item;
  }

  function createDialog(person, index, trigger) {
    const dialog = node('dialog', 'exco-dialog');
    dialog.id = 'exco-profile-' + (index + 1);
    const headingId = dialog.id + '-name';
    const roleId = dialog.id + '-role';
    dialog.setAttribute('aria-labelledby', headingId);
    dialog.setAttribute('aria-describedby', roleId);

    const bar = node('div', 'exco-window-bar');
    bar.append(node('span', 'exco-window-title', 'A LITTLE MORE ABOUT ME'));
    const close = button('exco-close', '×', 'Close ' + person.name + "'s profile");
    close.autofocus = true;
    close.addEventListener('click', () => dialog.close());
    bar.append(close);

    const body = node('div', 'exco-profile-body');
    const photoColumn = node('div', 'exco-profile-photo');
    photoColumn.append(photoSlot(person, true, index));
    const copy = node('div', 'exco-profile-copy');
    copy.append(node('span', 'exco-term', 'AY ' + term));
    const heading = node('h2', 'exco-profile-name', person.name);
    heading.id = headingId;
    const role = node('p', 'exco-profile-role', person.role);
    role.id = roleId;
    copy.append(heading, role);
    copy.append(node('p', person.bio ? 'exco-bio' : 'exco-bio exco-pending', person.bio || 'My story is on the way.'));
    const details = node('dl', 'exco-details');
    details.append(detail('Programme', person.programme), detail('Year', person.year));
    details.append(detail('Favourite craft', person.favouriteCraft), detail('Fun fact', person.funFact, true));
    copy.append(details);
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
      document.body.style.overflow = savedOverflow;
      trigger.focus({ preventScroll: true });
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    document.body.append(dialog);
    dialogs.push(dialog);
    return () => {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
    };
  }



  function scenery(file, className, width, height) {
    const image = node('img', 'exco-scenery ' + className);
    image.src = 'assets/images/exco-world/immersive/' + file + '.webp';
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
    for (let index = 0; index < points.length; index++) {
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
    art.src = 'assets/images/woodland-editor/lantern-paper.webp';
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
    let measure = true;
    let targetScroll = 0;
    let currentScroll = 0;
    let currentX = 0;
    let currentY = 0;
    let previousFrame = 0;
    let painted = false;

    function reset() {
      currentScroll = currentX = currentY = 0;
      previousFrame = 0;
      painted = false;
      for (const key of ['--exco-pointer-x', '--exco-pointer-y', '--exco-scroll']) world.style.setProperty(key, '0px');
      world.style.setProperty('--exco-tilt-x', '0deg');
      world.style.setProperty('--exco-tilt-y', '0deg');
    }
    function draw(timestamp) {
      pending = 0;
      if (!visible || reduced.matches || document.hidden) return;
      if (measure) {
        const bounds = world.getBoundingClientRect();
        const height = window.innerHeight;
        const progress = Math.max(-1, Math.min(1, (height / 2 - (bounds.top + bounds.height / 2)) / ((bounds.height + height) / 2)));
        targetScroll = progress * 96;
        measure = false;
      }
      // Scroll is the primary depth input on phones. Frame-rate independent easing
      // smooths touch momentum without intercepting touch events or scroll position.
      const elapsed = previousFrame ? Math.min(48, timestamp - previousFrame) : 16;
      previousFrame = timestamp;
      const ease = 1 - Math.exp(-elapsed / 95);
      if (!painted) { currentScroll = targetScroll; painted = true; }
      currentScroll += (targetScroll - currentScroll) * ease;
      const desiredX = pointerX * 14 + (phoneTilt?.state.x || 0) * 38;
      const desiredY = pointerY * 9 + (phoneTilt?.state.y || 0) * 24;
      currentX += (desiredX - currentX) * ease;
      currentY += (desiredY - currentY) * ease;
      const moving = Math.abs(targetScroll - currentScroll) > .08 || Math.abs(desiredX - currentX) > .03 || Math.abs(desiredY - currentY) > .03;
      if (!moving) { currentScroll = targetScroll; currentX = desiredX; currentY = desiredY; }
      world.style.setProperty('--exco-scroll', currentScroll.toFixed(2) + 'px');
      world.style.setProperty('--exco-pointer-x', currentX.toFixed(2) + 'px');
      world.style.setProperty('--exco-pointer-y', currentY.toFixed(2) + 'px');
      world.style.setProperty('--exco-tilt-x', (-currentY / 9 * 2).toFixed(2) + 'deg');
      world.style.setProperty('--exco-tilt-y', (currentX / 14 * 3).toFixed(2) + 'deg');
      if (moving) pending = requestAnimationFrame(draw);
    }
    function schedule() {
      if (!pending && visible && !reduced.matches && !document.hidden) pending = requestAnimationFrame(draw);
    }
    function scrollChanged() { measure = true; schedule(); }
    function visibilityChanged() {
      world.classList.toggle('is-motion-paused', document.hidden || reduced.matches);
      if (document.hidden) { if (pending) cancelAnimationFrame(pending); pending = 0; previousFrame = 0; }
      else scrollChanged();
    }
    function point(event) {
      if (!finePointer.matches || event.pointerType === 'touch') return;
      const bounds = world.getBoundingClientRect();
      pointerX = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      pointerY = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      schedule();
    }
    function leave() { pointerX = 0; pointerY = 0; schedule(); }
    function preferenceChanged() {
      world.classList.toggle('is-motion-paused', document.hidden || reduced.matches);
      if (pending) cancelAnimationFrame(pending);
      pending = 0;
      reset();
      scrollChanged();
    }
    world.classList.toggle('is-motion-paused', document.hidden || reduced.matches);
    let observer;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        world.classList.toggle('is-in-view', visible);
        if (visible) scrollChanged();
        else if (pending) { cancelAnimationFrame(pending); pending = 0; }
      }, { rootMargin: '120px' });
      observer.observe(world);
    } else { visible = true; world.classList.add('is-in-view'); schedule(); }

    const stopTilt = phoneTilt?.subscribe(schedule);
    window.addEventListener('scroll', scrollChanged, { passive: true });
    window.addEventListener('resize', scrollChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    world.addEventListener('pointermove', point, { passive: true });
    world.addEventListener('pointerleave', leave);
    reduced.addEventListener('change', preferenceChanged);
    return () => {
      observer?.disconnect();
      stopTilt?.();
      if (pending) cancelAnimationFrame(pending);
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
    item.style.setProperty('--actor-sway-duration', (5.8 + index % 4 * .65) + 's');
    item.style.setProperty('--actor-sway-delay', (-index * .83) + 's');
    item.style.setProperty('--exco-person-x', place.x + '%');
    item.style.setProperty('--exco-person-y', place.y + '%');
    item.style.setProperty('--exco-person-mobile-x', place.mx + '%');
    item.style.setProperty('--exco-person-mobile-y', place.my);
    const personButton = button('exco-person', '', 'Get to know ' + person.name + ', ' + person.role);
    personButton.setAttribute('aria-haspopup', 'dialog');
    personButton.setAttribute('aria-controls', 'exco-profile-' + (index + 1));

    const label = node('span', 'exco-person-label');
    label.append(node('span', 'exco-person-name', person.name), node('span', 'exco-person-role', person.role));
    const art = node('span', 'exco-person-art');
    const shadow = node('span', 'exco-person-ground');
    shadow.setAttribute('aria-hidden', 'true');
    const image = node('img', 'exco-person-pose');
    image.src = 'assets/images/exco-world/characters/pose-' + String(index + 1).padStart(2, '0') + '.webp';
    image.alt = '';
    image.width = [285, 155, 264, 247, 186, 233, 212, 242, 316, 248, 309][index];
    image.height = 380;
    image.loading = 'lazy';
    image.setAttribute('aria-hidden', 'true');
    art.append(image);
    const feet = node('span', 'exco-person-feet');
    feet.setAttribute('aria-hidden', 'true');
    const leaves = node('img', 'exco-foot-leaves');
    const hasLog = [7, 8].includes(index);
    leaves.src = 'assets/images/exco-world/props/' + (hasLog ? 'log-ferns.webp' : 'fern-patch.webp');
    leaves.alt = ''; leaves.width = 700; leaves.height = hasLog ? 233 : 280; leaves.loading = 'lazy';
    feet.append(leaves);
    personButton.append(label, shadow, art, feet);
    personButton.addEventListener('click', createDialog(person, index, personButton));
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
    const lantern = button('exco-lantern-toggle woodland-lantern-button', '', 'Light the woodland lanterns');
    lantern.setAttribute('aria-pressed', 'false');
    lantern.setAttribute('title', 'Light the woodland lanterns');
    const lanternIcon = node('span', 'woodland-lantern-icon');
    lanternIcon.setAttribute('aria-hidden', 'true');
    const lanternArt = node('img', 'woodland-lantern-art');
    lanternArt.src = 'assets/images/woodland-editor/lantern-paper.webp';
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
      lantern.setAttribute('aria-pressed', String(evening));
      lantern.setAttribute('aria-label', evening ? 'Bring daylight back to the woodland' : 'Light the woodland lanterns');
      lantern.setAttribute('title', evening ? 'Bring daylight back to the woodland' : 'Light the woodland lanterns');
    };
    // Reveal only the scenery. The lantern/cue stay live, so a click never
    // freezes their swing in a snapshot or jumps back to a new animation phase.
    const lanternReveal = window.MIT_WOODLAND_LANTERN?.create({ button: lantern, world: landscape, apply: applyEvening });
    lantern.addEventListener('click', () => lanternReveal ? lanternReveal.toggle() : applyEvening(!host.classList.contains('is-evening')));
    lanternDock.append(lanternHint, lanternArrow, lantern);
    host.append(lanternDock);
    // Natural-aspect paper tiles preserve the fine material at every width.
    // Alternate vertical reflection registers each adjoining edge exactly.
    const terrain = node('div', 'exco-terrain');
    terrain.setAttribute('aria-hidden', 'true');
    for (let tile = 0; tile < 4; tile++) {
      const ground = node('img', 'exco-ground-material');
      ground.src = 'assets/images/woodland-v10/floor-material-light.webp';
      ground.alt = ''; ground.width = 1086; ground.height = 1448; ground.loading = 'lazy';
      terrain.append(ground);
    }
    const path = node('img', 'exco-path-plane');
    path.src = 'assets/images/woodland-v10/path-paper.svg';
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
      art.src = kind === 'log' ? 'assets/images/exco-world/props/log-ferns.webp' : 'assets/images/woodland-v8/floor-island.webp';
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
        creek.src = 'assets/images/woodland-v10/creek-paper.svg';
        creek.alt = ''; creek.width = 1200; creek.height = 320; creek.loading = 'lazy'; creek.hidden = true;
        creek.setAttribute('aria-hidden', 'true');
        world.append(creek);
      }
      const depth = node('div', 'exco-world-depth');
      depth.setAttribute('aria-hidden', 'true');
      const grove = node('img', 'exco-back-grove');
      grove.src = 'assets/images/exco-world/props/woodland-grove-complete.webp';
      grove.alt = ''; grove.width = 1200; grove.height = 600; grove.loading = 'lazy';
      if (sceneIndex === 1) {
        // The same birch crosses the preceding workbench. Its bark belongs in
        // front, while the registered full canopy stays behind the crew/tools.
        const frontBirch = node('img', 'exco-back-grove exco-front-birch');
        frontBirch.src = grove.src;
        frontBirch.alt = ''; frontBirch.width = 1200; frontBirch.height = 600; frontBirch.loading = 'lazy';
        depth.append(frontBirch);
      }
      const station = node('img', 'exco-station-art');
      station.src = 'assets/images/exco-world/stations/station-' + String(sceneIndex + 1).padStart(2, '0') + '.webp';
      station.alt = ''; station.width = 600; station.height = 600; station.loading = 'lazy';
      depth.append(grove, station);
      const edgeTree = node('img', 'exco-edge-tree');
      edgeTree.src = 'assets/images/exco-world/woodland/' + (sceneIndex === 1 ? 'woodland-birch' : 'woodland-oak') + '.webp';
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
        art.src = kind === 'ash' ? 'assets/images/woodland-v8/ash-tree.webp' : 'assets/images/exco-world/woodland/woodland-' + kind + '.webp';
        art.alt = ''; art.width = kind === 'ash' ? 640 : 600; art.height = kind === 'ash' ? 1280 : 900; art.loading = 'lazy';
        tree.append(art); forest.append(tree);
      });
      depth.append(forest);
      const foreground = node('div', 'exco-foreground');
      foreground.setAttribute('aria-hidden', 'true');
      if (sceneIndex < 2) {
        const bench = node('img', 'exco-shared-bench');
        bench.src = 'assets/images/exco-world/props/workbench.webp';
        bench.alt = ''; bench.width = 700; bench.height = 350; bench.loading = 'lazy';
        foreground.append(bench);
      }
      const nearPlants = node('img', 'exco-near-plants');
      nearPlants.src = 'assets/images/atelier-v6/foreground-fern.webp';
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
    window.MIT_FOREST_LAYOUT?.mount(host);
    motionStops.push(configureMotion(landscape));
    const disarmTilt = phoneTilt?.armScene?.(host);
    if (disarmTilt) motionStops.push(disarmTilt);
    cleanupMotion = () => { motionStops.forEach(stop => stop()); lanternReveal?.destroy(); };
  }

  async function loadCrew() {
    try {
      const response = await fetch(new URL('scripts/committee.json', document.baseURI));
      if (!response.ok) throw new Error('Crew profiles could not be loaded.');
      const people = await response.json();
      if (!Array.isArray(people) || !people.length || people.some(person => typeof person.name !== 'string' || typeof person.role !== 'string')) throw new Error('Crew profiles are unavailable.');
      render(people);
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
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'instant', block: 'start' }));
  });
})();
