/* A real upcoming workshop, selected by Singapore calendar day. */
(() => {
  'use strict';

  const calendarNoon = date => new Date(`${date}T12:00:00+08:00`);
  const formatDate = (date, options) => new Intl.DateTimeFormat('en-SG', {
    ...options, timeZone: 'Asia/Singapore'
  }).format(calendarNoon(date));
  const daysUntil = (date, today) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  const countdownText = (date, today) => {
    const days = daysUntil(date, today);
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow';
    if (days < 14) return `in ${days} days`;
    return formatDate(date, { day: 'numeric', month: 'short' });
  };
  // dateLabel is existing approved copy, not a guessed workshop duration.
  const timeLabel = poster => {
    const weekday = formatDate(poster.date, { weekday: 'short' });
    const time = String(poster.dateLabel || '').split('·').slice(1).join('·').trim();
    return time ? `${weekday} · ${time}` : weekday;
  };
  const helpers = Object.freeze({ daysUntil, countdownText, timeLabel });
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const section = document.getElementById('next');
  const host = document.getElementById('next-workshop');
  const archive = window.MIT_WORKSHOP_ARCHIVE;
  if (!section || !host || !archive || !window.MIT_POSTERS_READY) return;

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const safeUrl = value => {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, document.baseURI);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  const links = Array.from(document.querySelectorAll('[data-next-link]'));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let posters = [], selected = null, midnightTimer = 0, stampObserver = null, stamped = false;

  function imageSource(img, poster) {
    const live = window.MIT_WORKSHOP_LIVE;
    if (live?.bindImage) live.bindImage(img, poster, 'thumb');
    else {
      const src = new URL(poster.thumbnail || poster.file, document.baseURI).href;
      if (img.src !== src) img.src = src;
    }
  }
  function releaseImage() { window.MIT_WORKSHOP_LIVE?.unbindImage?.(host.querySelector('.next-poster-thumb')); }

  function hide() {
    section.hidden = true;
    links.forEach(link => { link.hidden = true; });
    releaseImage(); host.replaceChildren();
    selected = null;
    stampObserver?.disconnect();
  }

  function stamp(ticket) {
    stampObserver?.disconnect();
    if (stamped || reduced.matches || !window.IntersectionObserver) return;
    stampObserver = new window.IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      // Only transforms animate; every word is already visible at rest.
      ticket.classList.add('is-stamped');
      stamped = true;
      stampObserver.disconnect();
    }, { threshold: .2 });
    stampObserver.observe(ticket);
  }

  function optionalCopy(parent, className, value) {
    let element = parent.querySelector('.' + className);
    if (!String(value || '').trim()) { element?.remove(); return; }
    if (!element) { element = node('p', className + ' t-small'); parent.append(element); }
    element.textContent = value;
  }

  function update(ticket, poster, today) {
    ticket.querySelector('.next-countdown').textContent = countdownText(poster.date, today);
    const date = ticket.querySelector('.next-date-stamp');
    date.dateTime = poster.date;
    date.setAttribute('aria-label', formatDate(poster.date, { day: 'numeric', month: 'long', year: 'numeric' }));
    date.querySelector('.next-date-day').textContent = poster.date.slice(-2).replace(/^0/, '');
    date.querySelector('.t-label').textContent = formatDate(poster.date, { month: 'short' }).toUpperCase();
    const copy = ticket.querySelector('.next-ticket-copy');
    copy.querySelector('.next-title').textContent = poster.title;
    copy.querySelector('.next-time').textContent = timeLabel(poster);
    optionalCopy(copy, 'next-location', poster.location);
    optionalCopy(copy, 'next-spots', poster.spots);
    const detail = ticket.querySelector('.next-ticket-detail');
    const thumb = detail.querySelector('.next-poster-thumb');
    imageSource(thumb, poster);
    thumb.alt = `${poster.title} workshop poster`;
    thumb.width = poster.thumbnailWidth || poster.width || 226;
    thumb.height = poster.thumbnailHeight || poster.height || 320;
    optionalCopy(detail, 'next-description', poster.description);
    const actions = ticket.querySelector('.next-ticket-actions');
    let primary = actions.querySelector('a');
    const signup = safeUrl(poster.signupUrl);
    const contact = signup || safeUrl(window.MIT_CONTENT?.instagramUrl);
    if (contact) {
      if (!primary) { primary = node('a', 'btn'); actions.prepend(primary); }
      primary.textContent = signup ? 'Sign up ↗' : 'Ask about a spot ↗';
      primary.href = contact;
      primary.target = '_blank';
      primary.rel = 'noopener';
    } else primary?.remove();
  }

  function render(reference = archive.clockInSingapore()) {
    const clock = typeof reference === 'string' ? { date: reference, time: '' } : reference;
    const today = clock.date;
    const poster = archive.selectUpcoming(posters, clock)[0];
    if (!poster) { hide(); return; }
    if (selected === poster) {
      host.querySelector('.next-countdown').textContent = countdownText(poster.date, today);
      return;
    }
    if (selected && (selected.id || selected.file) === (poster.id || poster.file)) {
      selected = poster;
      update(host.querySelector('.next-ticket'), poster, today);
      return;
    }
    selected = poster;
    const ticket = node('article', 'next-ticket card');
    const top = node('div', 'next-ticket-top');
    top.append(node('span', 't-label', 'Next at MIT'), node('span', 'next-countdown t-small', countdownText(poster.date, today)));

    const main = node('div', 'next-ticket-main');
    const date = node('time', 'next-date-stamp');
    date.dateTime = poster.date;
    date.setAttribute('aria-label', formatDate(poster.date, { day: 'numeric', month: 'long', year: 'numeric' }));
    const day = node('span', 'next-date-day', poster.date.slice(-2).replace(/^0/, ''));
    const month = node('span', 't-label', formatDate(poster.date, { month: 'short' }).toUpperCase());
    day.setAttribute('aria-hidden', 'true');
    month.setAttribute('aria-hidden', 'true');
    date.append(day, month);
    const copy = node('div', 'next-ticket-copy');
    const title = node('h2', 'next-title t-h3', poster.title);
    title.id = 'next-workshop-title';
    copy.append(title, node('p', 'next-time t-small', timeLabel(poster)));
    if (String(poster.location || '').trim()) copy.append(node('p', 'next-location t-small', poster.location));
    if (String(poster.spots || '').trim()) copy.append(node('p', 'next-spots t-small', poster.spots));
    main.append(date, copy);

    const perforation = node('div', 'next-perforation');
    perforation.setAttribute('aria-hidden', 'true');
    const detail = node('div', 'next-ticket-detail');
    const thumb = node('img', 'next-poster-thumb');
    imageSource(thumb, poster);
    thumb.alt = `${poster.title} workshop poster`;
    thumb.width = poster.thumbnailWidth || poster.width || 226;
    thumb.height = poster.thumbnailHeight || poster.height || 320;
    thumb.loading = 'lazy';
    thumb.decoding = 'async';
    detail.append(thumb);
    if (poster.description) detail.append(node('p', 'next-description t-small', poster.description));

    const actions = node('div', 'next-ticket-actions');
    const signup = safeUrl(poster.signupUrl);
    const contact = signup || safeUrl(window.MIT_CONTENT?.instagramUrl);
    if (contact) {
      const primary = node('a', 'btn', signup ? 'Sign up ↗' : 'Ask about a spot ↗');
      primary.href = contact;
      primary.target = '_blank';
      primary.rel = 'noopener';
      actions.append(primary);
    }
    const view = node('button', 'next-view-poster btn btn--quiet', 'View poster');
    view.type = 'button';
    view.setAttribute('aria-haspopup', 'dialog');
    view.addEventListener('click', () => {
      if (!selected) return;
      window.MIT_PHOTO_DETAIL?.open({
        title: selected.title, category: 'Next workshop', description: selected.description || '',
        items: [{ ...selected, kind: 'poster', category: 'Next workshop' }], index: 0, followCaption: true
      });
    });
    actions.append(view);
    ticket.append(top, main, perforation, detail, actions);
    releaseImage(); host.replaceChildren(ticket);
    section.setAttribute('aria-labelledby', title.id);
    section.hidden = false;
    links.forEach(link => { link.hidden = false; });
    stamp(ticket);
  }

  function scheduleMidnight() {
    window.clearTimeout(midnightTimer);
    if (document.hidden) return;
    const today = archive.dayInSingapore();
    const now = Date.now();
    let nextBoundary = Date.parse(`${today}T00:00:00+08:00`) + 86400000;
    for (const poster of posters) {
      if (!poster.endTime || poster.archiveStatus === 'past') continue;
      const expiry = Date.parse(`${poster.date}T${poster.endTime}:00+08:00`);
      if (expiry > now && expiry < nextBoundary) nextBoundary = expiry;
    }
    midnightTimer = window.setTimeout(() => { render(); scheduleMidnight(); }, Math.max(50, nextBoundary - now + 50));
  }

  if (!window.MIT_WORKSHOP_LIVE) document.addEventListener('visibilitychange', () => { render(); scheduleMidnight(); });
  window.MIT_NEXT_WORKSHOP_READY = window.MIT_POSTERS_READY.then(data => {
    const live = window.MIT_WORKSHOP_LIVE;
    posters = live ? live.get() : data;
    render();
    section.removeAttribute?.('data-workshop-pending');
    if (live) live.subscribe(data => { posters = data; render(); });
    else scheduleMidnight();
  }).catch(error => { section.removeAttribute?.('data-workshop-pending'); hide(); console.error(error); });
})();
