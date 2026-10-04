(() => {
  'use strict';

  // These are the club's drawings exported from the supplied Drive sources.
  const assets = 'assets/images/';
  const decorativeImage = (path, className) => {
    const image = document.createElement('img');
    image.src = new URL(assets + path, document.baseURI).href;
    image.alt = '';
    image.className = className;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.draggable = false;
    image.setAttribute('aria-hidden', 'true');
    return image;
  };

  const collage = document.querySelector('.tribe-collage');
  if (collage && !collage.querySelector('.experience-about-bear')) {
    collage.append(decorativeImage('mascots/mit-mascot-hammer.png', 'experience-about-bear'));
    const note = document.createElement('span');
    note.className = 'experience-about-note';
    note.textContent = 'Made of good company.';
    note.setAttribute('aria-hidden', 'true');
    collage.append(note);
  }

  const join = document.querySelector('#join');
  if (join && !join.querySelector('.experience-join-scene')) {
    const scene = document.createElement('div');
    scene.className = 'experience-join-scene';
    scene.setAttribute('aria-hidden', 'true');
    const ground = document.createElement('span');
    ground.className = 'experience-join-ground';
    const table = document.createElement('span');
    table.className = 'experience-join-table';
    table.append(document.createElement('i'), document.createElement('b'));
    scene.append(
      ground,
      decorativeImage('mascots/mit-mascot-hammer.png', 'experience-join-bear bear-one'),
      decorativeImage('mascots/mit-mascot-little-maker.png', 'experience-join-bear bear-two'),
      decorativeImage('mascots/mit-mascot-fired-up.png', 'experience-join-bear bear-three'),
      table,
      decorativeImage('exco-world/woodland/woodland-floor.webp', 'experience-join-floor')
    );
    join.prepend(scene);
  }

  // Three actual objects give the workbench its own silhouette. The original
  // buttons and their full photograph stories remain in place underneath.
  function layOutTheMakes() {
    const cutouts = {
      Textile: { file: 'strawberry-bag.webp', width: 600, height: 454, alt: 'A strawberry-shaped fabric bag made by the tribe' },
      Tuft: { file: 'mascot-rug.webp', width: 600, height: 597, alt: 'The finished MIT mascot rug' },
      Laser: { file: 'layered-wood.webp', width: 600, height: 600, alt: 'A woodland scene made from layers of laser-cut wood' }
    };
    const grid = document.getElementById('project-grid');
    if (!grid) return;
    grid.querySelectorAll('.project-card').forEach(card => {
      const project = window.MIT_CONTENT?.projects?.[Number(card.dataset.makeIndex)];
      const cutout = project && cutouts[project.match];
      const image = card.querySelector('.project-photo img');
      if (!cutout || !image) return;
      card.classList.add('is-artifact');
      card.dataset.artifact = project.match.toLowerCase();
      image.src = new URL(assets + 'cutouts/' + cutout.file, document.baseURI).href;
      image.alt = cutout.alt;
      image.width = cutout.width;
      image.height = cutout.height;
      image.draggable = false;
      card.style.setProperty('--photo-ratio', String(cutout.width / cutout.height));
    });
  }

  // Fine pointers can nudge a paper print. Touch keeps its normal scroll behavior.
  // No content is hidden while loading, and reduced-motion users get a still page.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const selector = '.makes .project-card, .moments .moment-photo';
  let current = null;
  let frame = 0;
  let pointer = null;
  const reset = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    if (current) {
      current.style.removeProperty('--tilt-x');
      current.style.removeProperty('--tilt-y');
    }
    current = null;
  };
  document.addEventListener('pointermove', event => {
    if (reduced.matches || !fine.matches || event.pointerType === 'touch') return;
    const card = event.target.closest(selector);
    if (!card) { reset(); return; }
    if (current !== card) { reset(); current = card; }
    pointer = { x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!current || !pointer) return;
      const rect = current.getBoundingClientRect();
      const x = Math.max(-.5, Math.min(.5, (pointer.x - rect.left) / rect.width - .5));
      const y = Math.max(-.5, Math.min(.5, (pointer.y - rect.top) / rect.height - .5));
      current.style.setProperty('--tilt-x', `${(-y * 4).toFixed(2)}deg`);
      current.style.setProperty('--tilt-y', `${(x * 4).toFixed(2)}deg`);
    });
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) reset();
  }, { passive: true });
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  reduced.addEventListener('change', reset);
  fine.addEventListener('change', reset);
  // Reserve the loose-object geometry before section links or fresh toys choose
  // their positions. The cutouts and the original photos both have explicit sizes.
  window.MIT_EXPERIENCE_READY = Promise.resolve(window.MIT_PAGE_READY).then(layOutTheMakes, layOutTheMakes);
})();
