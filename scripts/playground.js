(() => {
  'use strict';
  const button = document.getElementById('spin-cube');
  const cube = document.getElementById('idea-cube');
  const output = document.getElementById('idea-output');
  if (!button || !cube || !output) return;

  const crafts = (window.MIT_CONTENT?.projects || []).filter(project => project.match && project.label && project.title);
  // Normals match the six CSS face transforms. Read the craft from each physical face.
  const faces = [
    { side: 'front', normal: [0, 0, 1], axis: [0, 1, 0], angle: 0 },
    { side: 'right', normal: [1, 0, 0], axis: [0, 1, 0], angle: -90 },
    { side: 'top', normal: [0, -1, 0], axis: [1, 0, 0], angle: -90 },
    { side: 'back', normal: [0, 0, -1], axis: [0, 1, 0], angle: 180 },
    { side: 'left', normal: [-1, 0, 0], axis: [0, 1, 0], angle: 90 },
    { side: 'bottom', normal: [0, 1, 0], axis: [1, 0, 0], angle: 90 }
  ].map(face => {
    const element = cube.querySelector('.cube-' + face.side);
    return { ...face, element, craftIndex: crafts.findIndex(craft => craft.match === element?.dataset.craft) };
  }).filter(face => face.craftIndex !== -1);
  const exploreButton = document.getElementById('explore-craft');
  const hero = button.closest('.hero');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const instructions = document.createElement('span');
  instructions.id = 'cube-instructions';
  instructions.className = 'cube-instructions';
  instructions.textContent = 'Turn the cube to discover a real MIT craft. Move your mouse over it or drag with your finger. Arrow keys rotate it; hold Shift for a bigger turn. Enter or Space turns to another craft. The See craft button opens photos of the face pointing towards you.';
  button.insertAdjacentElement('afterend', instructions);
  button.setAttribute('aria-label', 'Craft cube. Turn it to discover a craft, or activate to pick another.');
  button.setAttribute('aria-describedby', instructions.id);
  let lastCraft = -1, facingFace = null;
  let drag = null, frame = null, suppressClick = false, hoverPoint = null, turn = null;
  let velocity = [0, 0, 0], motionStarted = 0, frameTime = 0;
  let availableCrafts = null;

  function showCraft(index) {
    if (!crafts[index]) return;
    lastCraft = index;
    const craft = crafts[index];
    output.textContent = craft.label;
    if (exploreButton) {
      // main.js owns the one modal listener and reads this data attribute at click time.
      exploreButton.dataset.project = craft.match;
      exploreButton.textContent = 'See ' + craft.label;
      exploreButton.setAttribute('aria-label', availableCrafts?.size === 0 ? 'Craft photos could not be loaded. Refresh to try again.' : 'See ' + craft.label + ': ' + craft.title);
      exploreButton.disabled = !availableCrafts?.has(craft.match);
    }
    hero?.querySelectorAll('.floating-make').forEach(prop => prop.classList.toggle('is-craft-selected', prop.dataset.project === craft.match));
  }
  window.MIT_CRAFT_READY = Promise.resolve(window.MIT_PAGE_READY).then(() => {
    const cards = document.getElementById('project-grid')?.querySelectorAll('.project-card') || [];
    const contentProjects = window.MIT_CONTENT?.projects || [];
    availableCrafts = new Set([...cards].map(card => contentProjects[Number(card.dataset.makeIndex)]?.match).filter(Boolean));
    if (availableCrafts.size && !availableCrafts.has(crafts[lastCraft]?.match)) {
      const loadedFace = faces.find(face => availableCrafts.has(crafts[face.craftIndex].match));
      if (loadedFace) turnToFace(loadedFace, false);
    } else showCraft(lastCraft);
    if (!availableCrafts.size && exploreButton) {
      exploreButton.disabled = true;
      exploreButton.setAttribute('aria-label', 'Craft photos could not be loaded. Refresh to try again.');
    }
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const length = vector => Math.hypot(...vector);
  const unit = vector => { const size = length(vector); return size ? vector.map(value => value / size) : [0, 0, 0]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normalise = quaternion => { const size = Math.hypot(...quaternion); return size ? quaternion.map(value => value / size) : [0, 0, 0, 1]; };
  function multiply(a, b) {
    return normalise([
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
    ]);
  }
  function axisTurn(axis, radians) {
    const direction = unit(axis), sine = Math.sin(radians / 2);
    return [direction[0] * sine, direction[1] * sine, direction[2] * sine, Math.cos(radians / 2)];
  }
  const presentation = multiply(multiply(axisTurn([1, 0, 0], -22 * Math.PI / 180), axisTurn([0, 1, 0], -31 * Math.PI / 180)), axisTurn([0, 0, 1], 4 * Math.PI / 180));
  let rotation = presentation.slice();
  function render() {
    const [x, y, z, w] = rotation;
    // An orthonormal matrix avoids Euler-axis locking during a free turn.
    const matrix = [
      1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
      2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
      2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
      0, 0, 0, 1
    ];
    cube.style.transform = 'matrix3d(' + matrix.map(value => Number(value.toFixed(7))).join(',') + ')';
    // The transformed normal with the largest positive Z points most towards the viewer.
    // Selection follows the real orientation during a drag, hover, key turn and inertia.
    const towardsViewer = face => matrix[2] * face.normal[0] + matrix[6] * face.normal[1] + matrix[10] * face.normal[2];
    const nextFace = faces.reduce((best, face) => !best || towardsViewer(face) > towardsViewer(best) + .0000001 ? face : best, facingFace);
    if (nextFace && (nextFace !== facingFace || lastCraft !== nextFace.craftIndex)) {
      facingFace = nextFace;
      showCraft(nextFace.craftIndex);
    }
  }
  function stopMotion() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    turn = null;
    velocity = [0, 0, 0];
    button.classList.remove('cube-is-moving');
  }
  function animate(time) {
    frame = null;
    if (drag || reducedMotion.matches || document.hidden) {
      stopMotion();
      return;
    }
    if (turn) {
      const progress = clamp((time - turn.started) / 620, 0, 1);
      rotation = interpolate(turn.from, turn.to, 1 - Math.pow(1 - progress, 3));
      render();
      if (progress === 1) { stopMotion(); return; }
      frame = window.requestAnimationFrame(animate);
      return;
    }
    if (time - motionStarted >= 1500 || length(velocity) < .000045) { stopMotion(); return; }
    const elapsed = clamp(time - frameTime, 0, 32);
    frameTime = time;
    rotation = multiply(axisTurn(velocity, length(velocity) * elapsed), rotation);
    velocity = velocity.map(value => value * Math.exp(-elapsed / 320));
    render();
    frame = window.requestAnimationFrame(animate);
  }
  function coast(nextVelocity) {
    stopMotion();
    if (reducedMotion.matches || document.hidden || length(nextVelocity) < .00012) return;
    const speed = Math.min(length(nextVelocity), .006);
    velocity = unit(nextVelocity).map(value => value * speed);
    motionStarted = frameTime = performance.now();
    button.classList.add('cube-is-moving');
    frame = window.requestAnimationFrame(animate);
  }
  function interpolate(from, target, progress) {
    let to = target, dot = from.reduce((sum, value, index) => sum + value * to[index], 0);
    // q and -q encode the same orientation; take the shorter arc around the cube.
    if (dot < 0) { to = to.map(value => -value); dot = -dot; }
    if (dot > .9995) return normalise(from.map((value, index) => value + (to[index] - value) * progress));
    const angle = Math.acos(clamp(dot, -1, 1)), sine = Math.sin(angle);
    return normalise(from.map((value, index) => (value * Math.sin((1 - progress) * angle) + to[index] * Math.sin(progress * angle)) / sine));
  }
  function turnToFace(face, animateTurn = true) {
    stopMotion();
    const target = multiply(presentation, axisTurn(face.axis, face.angle * Math.PI / 180));
    if (!animateTurn || reducedMotion.matches || document.hidden) {
      rotation = target;
      render();
      // Also refresh availability if the loaded face was already pointing forward.
      showCraft(face.craftIndex);
      return;
    }
    turn = { from: rotation.slice(), to: target, started: performance.now() };
    button.classList.add('cube-is-moving');
    frame = window.requestAnimationFrame(animate);
  }
  function trackball(clientX, clientY, rect) {
    const radius = Math.min(rect.width, rect.height) * .44;
    const x = (clientX - rect.left - rect.width / 2) / radius;
    const y = (clientY - rect.top - rect.height / 2) / radius;
    const distance = x * x + y * y;
    return distance <= 1 ? [x, y, Math.sqrt(1 - distance)] : unit([x, y, 0]);
  }
  function between(a, b) {
    const dot = clamp(a.reduce((sum, value, index) => sum + value * b[index], 0), -1, 1);
    if (dot < -.9999) return axisTurn(cross(a, Math.abs(a[0]) < .8 ? [1, 0, 0] : [0, 1, 0]), Math.PI);
    return normalise([...cross(a, b), 1 + dot]);
  }
  const eventTime = event => Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
  function endDrag(event, cancelled = false) {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    const old = drag;
    drag = null;
    suppressClick = old.moved;
    button.classList.remove('cube-is-dragging');
    button.classList.remove('cube-is-moving');
    try { if (button.hasPointerCapture(old.id)) button.releasePointerCapture(old.id); } catch (_) { /* Capture may already be released. */ }
    if (!cancelled && old.moved && eventTime(event) - old.lastMove < 90) coast(old.velocity);
  }

  button.addEventListener('pointerdown', event => {
    if (drag || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    stopMotion();
    hoverPoint = null;
    suppressClick = false;
    const rect = button.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const time = eventTime(event);
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, rect, vector: trackball(event.clientX, event.clientY, rect), time, lastMove: time, velocity: [0, 0, 0], moved: false };
    try { button.setPointerCapture(event.pointerId); } catch (_) { /* A cancelled pointer has nothing to capture. */ }
  });
  button.addEventListener('pointermove', event => {
    // A desktop pointer can explore the object without pressing a button.
    // Touch retains direct trackball control, leaving the rest of the page scrollable.
    if (!drag && finePointer.matches && event.pointerType === 'mouse' && !reducedMotion.matches) {
      if (hoverPoint) {
        const dx = clamp(event.clientX - hoverPoint.x, -24, 24);
        const dy = clamp(event.clientY - hoverPoint.y, -24, 24);
        stopMotion();
        rotation = multiply(multiply(axisTurn([1, 0, 0], -dy * .004), axisTurn([0, 1, 0], dx * .004)), rotation);
        render();
      }
      hoverPoint = { x: event.clientX, y: event.clientY };
      return;
    }
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
    drag.moved = true;
    button.classList.add('cube-is-dragging');
    button.classList.add('cube-is-moving');
    const vector = trackball(event.clientX, event.clientY, drag.rect);
    const delta = between(drag.vector, vector);
    rotation = multiply(delta, rotation);
    const time = eventTime(event), elapsed = clamp(time - drag.time, 8, 50);
    const sine = Math.hypot(delta[0], delta[1], delta[2]);
    const angle = 2 * Math.atan2(sine, delta[3]);
    const spin = sine > .000001 ? delta.slice(0, 3).map(value => value / sine * angle / elapsed) : [0, 0, 0];
    drag.velocity = drag.velocity.map((value, index) => value * .4 + spin[index] * .6);
    drag.vector = vector;
    drag.time = drag.lastMove = time;
    render();
  });
  button.addEventListener('pointerup', event => endDrag(event));
  button.addEventListener('pointercancel', event => endDrag(event, true));
  button.addEventListener('lostpointercapture', event => endDrag(event, true));
  button.addEventListener('pointerleave', () => {
    hoverPoint = null;
  });

  function mix() {
    endDrag(null, true);
    hoverPoint = null;
    // Walk the physical faces, skipping missing albums. A turn always lands on its craft.
    const current = faces.indexOf(facingFace);
    for (let offset = 1; offset <= faces.length; offset++) {
      const candidate = faces[(current + offset) % faces.length];
      if ((!availableCrafts || !availableCrafts.size || availableCrafts.has(crafts[candidate.craftIndex].match)) && candidate !== facingFace) {
        turnToFace(candidate);
        return;
      }
    }
  }
  button.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    suppressClick = false;
    mix();
  });
  const mixButton = document.getElementById('mix-idea');
  if (mixButton) mixButton.addEventListener('click', mix);
  button.addEventListener('keydown', event => {
    const directions = { ArrowLeft: [0, -1, 0], ArrowRight: [0, 1, 0], ArrowUp: [1, 0, 0], ArrowDown: [-1, 0, 0] };
    const axis = directions[event.key];
    if (!axis) return;
    event.preventDefault();
    endDrag(null, true);
    stopMotion();
    rotation = multiply(axisTurn(axis, (event.shiftKey ? 24 : 10) * Math.PI / 180), rotation);
    render();
  });
  function cancelInteraction() { hoverPoint = null; endDrag(null, true); stopMotion(); }
  // Keep the craft stable from the start of a tap through the existing modal click handler.
  exploreButton?.addEventListener('pointerdown', cancelInteraction, { passive: true });
  exploreButton?.addEventListener('focus', cancelInteraction);
  window.addEventListener('blur', cancelInteraction);
  window.addEventListener('pagehide', cancelInteraction);
  window.addEventListener('resize', cancelInteraction);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelInteraction(); });
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopMotion(); });
  else if (reducedMotion.addListener) reducedMotion.addListener(() => { if (reducedMotion.matches) stopMotion(); });

  // A small, staggered nudge makes the real objects discoverable on touch screens.
  // Animate their artwork only; hit areas and labels remain still.
  if (hero) {
    let visible = false, pointerActive = false, focusWithin = false, windowActive = true;
    const updatePropMotion = () => hero.classList.toggle('hero-motion-on', visible && !document.hidden && !reducedMotion.matches && !pointerActive && !focusWithin && windowActive);
    if ('IntersectionObserver' in window) {
      const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; updatePropMotion(); });
      visibility.observe(hero);
    } else { visible = true; }
    hero.addEventListener('pointerdown', () => { pointerActive = true; updatePropMotion(); }, { passive: true });
    window.addEventListener('pointerup', () => { pointerActive = false; updatePropMotion(); }, { passive: true });
    window.addEventListener('pointercancel', () => { pointerActive = false; updatePropMotion(); }, { passive: true });
    hero.addEventListener('focusin', () => { focusWithin = true; updatePropMotion(); });
    hero.addEventListener('focusout', event => { focusWithin = !!event.relatedTarget && hero.contains(event.relatedTarget); updatePropMotion(); });
    window.addEventListener('blur', () => { windowActive = false; pointerActive = false; updatePropMotion(); });
    window.addEventListener('focus', () => { windowActive = true; updatePropMotion(); });
    window.addEventListener('pagehide', () => { windowActive = false; updatePropMotion(); });
    window.addEventListener('pageshow', () => { windowActive = true; updatePropMotion(); });
    document.addEventListener('visibilitychange', updatePropMotion);
    if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', updatePropMotion);
    else if (reducedMotion.addListener) reducedMotion.addListener(updatePropMotion);
    updatePropMotion();
  }
  render();
})();
