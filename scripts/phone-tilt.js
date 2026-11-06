(() => {
  'use strict';

  // One passive stream for the whole site, independent of EXCO interactions.
  const listeners = new Set();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const orientation = window.DeviceOrientationEvent;
  const needsPermission = typeof orientation?.requestPermission === 'function';
  const state = { x: 0, y: 0 };
  let permission = !orientation || window.isSecureContext === false ? 'unavailable' : needsPermission ? 'unknown' : 'granted';
  let listening = false, neutral = null, pageSuspended = false, disposed = false;
  let probed = false, gesturePending = false, requestId = 0;
  const notify = () => listeners.forEach(listener => listener());
  const delta = (angle, origin) => ((angle - origin + 540) % 360) - 180;
  const normalize = value => Math.sign(value) * Math.min(1, Math.max(0, Math.abs(value) - 1.5) / 18.5);
  const quiet = () => disposed || reduced.matches || document.hidden || pageSuspended;
  const gestures = ['touchend', 'pointerup', 'click', 'keydown'];
  function removeGestures() { gestures.forEach(name => document.removeEventListener(name, requestFromGesture, true)); }

  function recenter() {
    neutral = null;
    const changed = state.x !== 0 || state.y !== 0;
    state.x = state.y = 0;
    if (changed) notify();
  }
  function stop() {
    listening = false;
    window.removeEventListener('deviceorientation', sample);
    recenter();
  }
  function finishPermission(answer) {
    permission = answer;
    removeGestures();
    if (answer === 'denied') stop();
    else start();
  }
  function sample(event) {
    if (!listening || quiet() || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    // WebKit can deliver readings for an already-authorized origin before its
    // permission promise settles. A real reading is sufficient to start motion.
    if (permission === 'unknown') finishPermission('granted');
    if (!neutral) neutral = { beta: event.beta, gamma: event.gamma };
    const rotation = ((window.screen?.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180;
    const horizontal = delta(event.gamma, neutral.gamma);
    const vertical = delta(event.beta, neutral.beta);
    // A phone held around 60° has little comfortable forward/back travel.
    // Calibrate at the actual grip, then compensate the screen's vertical axis
    // (about 2× at 60°). Cap the gain near upright; travel is bounded downstream.
    const heldPitch = neutral.beta * Math.cos(rotation) - neutral.gamma * Math.sin(rotation);
    const pitchGain = Math.min(2.5, 1 / Math.max(.4, Math.abs(Math.cos(heldPitch * Math.PI / 180))));
    const x = normalize(horizontal * Math.cos(rotation) + vertical * Math.sin(rotation));
    const y = normalize((vertical * Math.cos(rotation) - horizontal * Math.sin(rotation)) * pitchGain);
    if (Math.abs(x - state.x) < .002 && Math.abs(y - state.y) < .002) return;
    state.x = x;
    state.y = y;
    notify();
  }
  function start() {
    if (quiet() || listening || permission === 'denied' || permission === 'unavailable') return;
    recenter();
    listening = true;
    window.addEventListener('deviceorientation', sample, { passive: true });
    // Do not time out: some phones begin providing readings after page load.
    // An idle passive listener consumes no animation frames.
  }
  async function requestPermission(interactive) {
    if (quiet() || permission !== 'unknown' || (interactive && gesturePending)) return;
    if (interactive) gesturePending = true;
    const id = ++requestId;
    try {
      // Called synchronously during a real click when prompting is necessary.
      const answer = await orientation.requestPermission();
      if (disposed || id !== requestId || permission !== 'unknown') return;
      finishPermission(answer === 'granted' ? 'granted' : 'denied');
    } catch (error) {
      if (disposed || id !== requestId || permission !== 'unknown') return;
      // A passive probe cannot show a first-use prompt. Leave it available for
      // the next ordinary page tap, rather than treating this as user denial.
      if (error?.name !== 'NotAllowedError') finishPermission('denied');
    } finally {
      if (interactive) gesturePending = false;
    }
  }
  function requestFromGesture(event) {
    if (event.isTrusted !== true) return;
    if (event.type === 'keydown' && (event.key === 'Escape' || event.metaKey || event.ctrlKey || event.altKey)) return;
    // Touch release can carry activation without producing a click, including
    // the first hero interaction. Rejected swipe activation leaves the next tap
    // eligible; none of these passive listeners intercept normal scrolling.
    if (window.navigator?.userActivation?.isActive === false) return;
    requestPermission(true);
  }
  function resume() {
    start();
    // Cached browser decisions resolve without a gesture; first-use permission
    // rejects without a prompt and is requested on the first real page click.
    if (!quiet() && permission === 'unknown' && !probed) {
      probed = true;
      requestPermission(false);
    }
  }
  function visibilityChanged() { if (document.hidden) stop(); else resume(); }
  function preferenceChanged() { if (reduced.matches) stop(); else resume(); }
  function pageHidden() { pageSuspended = true; stop(); }
  function pageShown() { pageSuspended = false; resume(); }
  function destroy() {
    if (disposed) return;
    disposed = true;
    stop();
    listeners.clear();
    removeGestures();
    window.removeEventListener('orientationchange', recenter);
    window.screen?.orientation?.removeEventListener('change', recenter);
    window.removeEventListener('pagehide', pageHidden);
    window.removeEventListener('pageshow', pageShown);
    document.removeEventListener('visibilitychange', visibilityChanged);
    if (reduced.removeEventListener) reduced.removeEventListener('change', preferenceChanged);
    else reduced.removeListener?.(preferenceChanged);
  }

  if (needsPermission && permission === 'unknown') gestures.forEach(name => document.addEventListener(name, requestFromGesture, { capture: true, passive: true }));
  window.addEventListener('orientationchange', recenter, { passive: true });
  window.screen?.orientation?.addEventListener('change', recenter);
  window.addEventListener('pagehide', pageHidden);
  window.addEventListener('pageshow', pageShown);
  document.addEventListener('visibilitychange', visibilityChanged);
  if (reduced.addEventListener) reduced.addEventListener('change', preferenceChanged);
  else reduced.addListener?.(preferenceChanged);
  window.MIT_PHONE_TILT = {
    state,
    destroy,
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
  resume();
})();
