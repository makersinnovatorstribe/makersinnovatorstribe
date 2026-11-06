/* The roster is public navigation around the unchanged authored woodland. */
(() => {
  'use strict';
  const requestFrame = window.MIT_MOTION?.request || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
  const cancelFrame = window.MIT_MOTION?.cancel || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);
  const section = document.getElementById('people');
  const host = document.getElementById('committee-grid');
  if (!section || !host || document.body.classList.contains('forest-editor')) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let people = [];
  let pendingPerson = null, selected = null, frame = 0, timer = 0, generation = 0, spotlightScroll = 0;

  function clear() {
    generation++;
    if (frame) cancelFrame(frame);
    if (timer) window.clearTimeout(timer);
    frame = timer = 0; pendingPerson = null;
    host.classList.remove('is-spotlit');
    selected?.control.classList.remove('is-spotlit');
    selected = null;
    section.querySelectorAll('.roster-chip').forEach(chip => chip.setAttribute('aria-pressed', 'false'));
    window.MIT_FOREST_LABELS?.refresh();
  }

  function spotlight(person) {
    pendingPerson = null;
    if (!host.isConnected || document.hidden || document.querySelector('dialog[open]')) return;
    // Read the rendered character and canvas together, before writing styles.
    // Their common scale converts viewport pixels to the saved canvas space.
    const origin = host.getBoundingClientRect();
    const character = person.place.querySelector('.exco-person-character') || person.place;
    let bounds = character.getBoundingClientRect();
    if (!bounds.width || !bounds.height) bounds = person.place.getBoundingClientRect();
    const sx = origin.width / (host.offsetWidth || origin.width) || 1;
    const sy = origin.height / (host.offsetHeight || origin.height) || 1;
    host.style.setProperty('--spot-x', ((bounds.left + bounds.width / 2 - origin.left) / sx).toFixed(2) + 'px');
    host.style.setProperty('--spot-y', ((bounds.top + bounds.height / 2 - origin.top) / sy).toFixed(2) + 'px');
    selected = person; spotlightScroll = window.scrollY;
    host.classList.add('is-spotlit'); person.control.classList.add('is-spotlit');
    section.querySelectorAll('.roster-chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.person === String(person.index))));
    person.control.focus({ preventScroll: true });
    window.MIT_FOREST_LABELS?.refresh();
    timer = window.setTimeout(clear, 2400);
  }

  function focus(index) {
    if (!Number.isInteger(index) || index < 0 || index >= people.length) return false;
    const place = host.querySelector('.exco-person-place[data-person="' + index + '"]');
    const control = place?.querySelector('.exco-person');
    if (!place || !control || place.hidden || place.style.display === 'none') return false;
    clear();
    const person = { index, place, control };
    place.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'center' });
    if (reduced.matches) { spotlight(person); return true; }
    pendingPerson = person;
    const request = generation, started = performance.now();
    let previousY = window.scrollY, still = 0;
    function settled(now) {
      frame = 0;
      if (request !== generation || document.hidden || document.querySelector('dialog[open]')) { pendingPerson = null; return; }
      const y = window.scrollY; still = Math.abs(y - previousY) < .5 ? still + 1 : 0; previousY = y;
      if ((now - started > 180 && still >= 5) || now - started > 2400) spotlight(person);
      else frame = requestFrame(settled);
    }
    frame = requestFrame(settled);
    return true;
  }
  window.MIT_CREW_ROSTER = Object.freeze({ focus, clear });
  window.addEventListener('scroll', () => { if (selected && Math.abs(window.scrollY - spotlightScroll) > 80) clear(); }, { passive: true });
  document.addEventListener('pointerdown', event => {
    const person = selected || pendingPerson;
    if (!person) return;
    const label = host.querySelector('.forest-label-item[data-label-source="label-' + person.index + '"]');
    if (!person.place.contains(event.target) && !label?.contains(event.target)) clear();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  document.addEventListener('sheet:open', clear);
  window.addEventListener('resize', clear, { passive: true });
  reduced.addEventListener?.('change', () => { if (reduced.matches && pendingPerson) focus(pendingPerson.index); });

  Promise.resolve(window.MIT_CREW_READY).then(() => {
    people = window.MIT_CREW?.people || [];
    if (!people.length || !host.isConnected) return;
    let roster = section.querySelector('.crew-roster');
    if (!roster) { roster = document.createElement('nav'); roster.className = 'crew-roster'; section.append(roster); }
    roster.setAttribute('aria-label', 'Find an EXCO');
    const list = document.createElement('ul');
    list.className = 'chip-row';
    people.forEach((person, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.className = 'roster-chip'; button.type = 'button';
      button.dataset.person = String(index);
      button.hidden = !!person.cmsHidden;
      button.setAttribute('aria-controls', 'committee-grid');
      button.setAttribute('aria-pressed', 'false');
      const name = document.createElement('span'); name.className = 'roster-chip-name'; name.textContent = person.name;
      const role = document.createElement('span'); role.className = 'roster-chip-role t-label'; role.textContent = person.role;
      button.append(name, role); button.addEventListener('click', () => window.MIT_CREW.focus(index));
      item.append(button); list.append(item);
    });
    roster.replaceChildren(list);

    // The renderer locks the approved scene and originally includes its
    // heading. Put navigation before that canvas without moving its contents.
    const frame = host.closest('.forest-canvas-frame');
    const composition = host.closest('.forest-composition');
    const topline = composition?.querySelector('.section-topline');
    const heading = composition?.querySelector('.section-heading');
    const dock = host.querySelector('.woodland-lantern-dock');
    if (frame && frame.parentNode === section) {
      let intro = section.querySelector('.people-intro');
      if (!intro) { intro = document.createElement('div'); intro.className = 'people-intro'; }
      section.insertBefore(intro, frame);
      intro.append(...[topline, heading, roster, dock].filter(Boolean));
      if (dock) window.MIT_LANTERN_FRAMES?.refresh();
    }
    window.MIT_FOREST_LABELS?.refresh();
  });
})();
