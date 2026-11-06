/* Past posters live beside the camera roll; dates never imply public registration. */
(() => {
  'use strict';

  const isCalendarDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  const dayInSingapore = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const value = type => parts.find(part => part.type === type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
  };
  const clockInSingapore = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Singapore', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
    return { date: dayInSingapore(now), time: `${parts.find(part => part.type === 'hour').value}:${parts.find(part => part.type === 'minute').value}` };
  };
  const referenceClock = (reference, time = '') => typeof reference === 'string' ? { date: reference, time }
    : reference instanceof Date ? clockInSingapore(reference) : reference || clockInSingapore();
  const isPast = (poster, clock) => poster.archiveStatus === 'past' || poster.date < clock.date ||
    poster.date === clock.date && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(poster.endTime || '') && !!clock.time && clock.time >= poster.endTime;
  const selectPast = (posters, reference, time) => posters
    .filter(poster => isCalendarDate(poster.date) && isPast(poster, referenceClock(reference, time)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const selectUpcoming = (posters, reference, time) => posters
    .filter(poster => isCalendarDate(poster.date) && !isPast(poster, referenceClock(reference, time)))
    .sort((a, b) => a.date.localeCompare(b.date));
  const matchingPhotos = (poster, photos) => (poster.relatedPhotoIds || [])
    .map(id => photos.find(photo => photo.id === id)).filter(Boolean);

  // Pure date/association functions also keep the archive cutoff testable.
  const archive = Object.freeze({ selectPast, selectUpcoming, matchingPhotos, isCalendarDate, dayInSingapore, clockInSingapore });
  if (typeof module === 'object' && module.exports) module.exports = archive;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.MIT_WORKSHOP_ARCHIVE = archive;

  // Both the logbook and upcoming ticket consume this one request. Publish it
  // before looking for the archive grid, so it also works on a ticket-only page.
  window.MIT_POSTERS_READY = window.MIT_POSTERS_READY || fetch(new URL('scripts/posters.json', document.baseURI))
    .then(response => {
      if (!response.ok) throw new Error('Unable to load workshop memories.');
      return response.json();
    }).then(posters => {
      if (!Array.isArray(posters)) throw new Error('Invalid workshop data.');
      return posters;
    });

  const grid = document.getElementById('workshop-archive');
  if (!grid) return;
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const image = (item, poster = false) => {
    const img = node('img', poster ? 'archive-poster-image' : 'archive-photo-image');
    if (poster && window.MIT_WORKSHOP_LIVE?.bindImage) window.MIT_WORKSHOP_LIVE.bindImage(img, item, 'thumb');
    else img.src = new URL(item.thumbnail || item.file, document.baseURI).href;
    img.alt = poster ? `${item.title} — original workshop poster` : item.title;
    img.width = item.thumbnailWidth || item.width || 480;
    img.height = item.thumbnailHeight || item.height || 640;
    img.loading = 'lazy';
    img.decoding = 'async';
    return img;
  };
  const dateText = date => new Intl.DateTimeFormat('en-SG', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Singapore'
  }).format(new Date(date + 'T12:00:00+08:00'));
  const stampText = date => new Intl.DateTimeFormat('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore'
  }).format(new Date(date + 'T12:00:00+08:00')).toUpperCase();

  function open(poster, related, index = 0) {
    if (!window.MIT_PHOTO_DETAIL) return;
    const item = {
      ...poster, kind: 'poster', category: 'Past workshop · poster archive',
      dateLabel: dateText(poster.date),
      description: poster.archiveSummary || poster.description || ''
    };
    const photos = related.map(photo => ({ ...photo, description: poster.photoLabel || photo.description || '' }));
    window.MIT_PHOTO_DETAIL.open({
      title: poster.title, category: item.category,
      description: item.description,
      items: [item, ...photos], index, followCaption: true
    });
  }

  const cards = new Map();
  function updateImage(img, item) {
    if (window.MIT_WORKSHOP_LIVE?.bindImage) window.MIT_WORKSHOP_LIVE.bindImage(img, item, 'thumb');
    else {
      const src = new URL(item.thumbnail || item.file, document.baseURI).href;
      if (img.src !== src) img.src = src;
    }
    img.alt = `${item.title} — original workshop poster`;
    img.width = item.thumbnailWidth || item.width || 480;
    img.height = item.thumbnailHeight || item.height || 640;
  }
  function render(posters, photos) {
    const past = selectPast(posters);
    const wanted = [];
    past.forEach(poster => {
      const related = matchingPhotos(poster, photos);
      const key = poster.id || poster.file;
      let entry = cards.get(key);
      if (!entry) {
        const card = node('article', 'workshop-memory');
        const posterButton = node('button', 'archive-poster-button');
        posterButton.type = 'button';
        const posterImage = image(poster, true);
        posterButton.append(posterImage, node('span', 'archive-view-poster', 'View poster ↗'));
        const copy = node('div', 'archive-copy');
        const meta = node('div', 'archive-meta');
        const date = node('time', 'archive-date tag tag--stamp');
        const title = node('h4', 'archive-title t-h4');
        const summary = node('p', 'archive-summary t-small');
        meta.append(date);
        copy.append(meta, title, summary);
        card.append(posterButton, copy);
        entry = { card, posterButton, posterImage, copy, date, title, summary, strip: null, photoKey: '' };
        posterButton.addEventListener('click', () => open(entry.poster, entry.related));
        cards.set(key, entry);
      }
      entry.poster = poster;
      entry.related = related;
      entry.posterButton.setAttribute('aria-label', `View archived ${poster.title} poster from ${dateText(poster.date)}`);
      updateImage(entry.posterImage, poster);
      entry.date.dateTime = poster.date;
      entry.date.textContent = stampText(poster.date);
      entry.title.textContent = poster.title;
      entry.summary.textContent = poster.archiveSummary || poster.description || '';
      const photoKey = JSON.stringify(related.slice(0, 2).map(photo => [photo.id, photo.thumbnail || photo.file]));
      if (!related.length && entry.strip) { entry.strip.remove(); entry.strip = null; entry.photoKey = ''; }
      if (related.length) {
        if (!entry.strip) {
          entry.strip = node('button', 'archive-photo-strip');
          entry.strip.type = 'button';
          entry.strip.addEventListener('click', () => open(entry.poster, entry.related, 1));
          entry.copy.append(entry.strip);
        }
        if (photoKey !== entry.photoKey) {
          entry.strip.replaceChildren(...related.slice(0, 2).map(photo => image(photo)));
          entry.photoKey = photoKey;
        }
        entry.strip.setAttribute('aria-label', `View related ${poster.title} making photos`);
        let action = entry.strip.querySelector('.archive-photo-action');
        if (poster.photoLabel) {
          if (!action) { action = node('span', 'archive-photo-action t-label'); entry.strip.append(action); }
          action.textContent = `${poster.photoLabel} ↗`;
        } else action?.remove();
      }
      wanted.push(entry.card);
    });
    for (const [key, entry] of cards) if (!wanted.includes(entry.card)) {
      window.MIT_WORKSHOP_LIVE?.unbindImage?.(entry.posterImage);
      entry.card.remove(); cards.delete(key);
    }
    for (const child of Array.from(grid.children)) if (!wanted.includes(child)) child.remove();
    wanted.forEach((card, index) => {
      if (grid.children[index] === card) return;
      if (grid.insertBefore) grid.insertBefore(card, grid.children[index] || null); else grid.append(card);
    });
    if (!past.length) grid.append(node('p', 'archive-empty', 'Past workshop posters will appear here.'));
  }

  window.MIT_ARCHIVE_READY = Promise.all([window.MIT_POSTERS_READY, window.MIT_PAGE_READY]).then(([posters]) => {
    const live = window.MIT_WORKSHOP_LIVE;
    const refresh = data => render(data, window.MIT_PHOTO_DETAIL?.photos() || []);
    refresh(live ? live.get() : posters);
    live?.subscribe(refresh);
    window.MIT_CMS?.subscribe(() => refresh(live ? live.get() : posters));
  }).catch(error => {
    grid.replaceChildren(node('p', 'archive-empty', 'The poster archive could not be loaded. The photo album is still above.'));
    console.error(error);
  });
})();
