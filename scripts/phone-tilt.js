(() => {
  'use strict';

  // One sensor stream shared by the woodland. Readings remain in memory only.
  // Permission-free browsers start automatically; others require a real scene gesture.
  const listeners = new Set();
  const scenes = new Map();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const orientation = window.DeviceOrientationEvent;
  const needsPermission = typeof orientation?.requestPermission === 'function';
  const state = { x: 0, y: 0 };
  let permission = !orientation || window.isSecureContext === false ? 'unavailable' : needsPermission ? 'unknown' : 'granted';
  let listening = false, neutral = null, timer = 0, pageSuspended = false, disposed = false;
  let sensorAvailable = true;
  const notify = () => listeners.forEach(listener => listener());
  const delta = (angle, origin) => ((angle - origin + 540) % 360) - 180;
  const normalize = value => Math.sign(value) * Math.min(1, Math.max(0, Math.abs(value) - 1.5) / 18.5);

  function recenter() {
    neutral = null;
    const changed = state.x !== 0 || state.y !== 0;
    state.x = state.y = 0;
    if (changed) notify();
  }
  function stop() {
    listening = false;
    window.clearTimeout(timer);
    timer = 0;
    window.removeEventListener('deviceorientation', sample);
    recenter();
  }
  function sample(event) {
    if (!listening || disposed || document.hidden || reduced.matches || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    if (!neutral) {
      neutral = { beta: event.beta, gamma: event.gamma };
      window.clearTimeout(timer);
      timer = 0;
    }
    const rotation = ((window.screen?.orientation?.angle ?? window.orientation ?? 0) * Math.PI) / 180;
    const horizontal = delta(event.gamma, neutral.gamma);
    const vertical = delta(event.beta, neutral.beta);
    const x = normalize(horizontal * Math.cos(rotation) + vertical * Math.sin(rotation));
    const y = normalize(vertical * Math.cos(rotation) - horizontal * Math.sin(rotation));
    if (Math.abs(x - state.x) < .002 && Math.abs(y - state.y) < .002) return;
    state.x = x;
    state.y = y;
    notify();
  }
  function start() {
    if (disposed || listening || !sensorAvailable || permission !== 'granted' || reduced.matches || document.hidden || pageSuspended) return;
    recenter();
    listening = true;
    window.addEventListener('deviceorientation', sample, { passive: true });
    timer = window.setTimeout(() => {
      if (!neutral && listening) {
        sensorAvailable = false;
        stop();
      }
    }, 6000);
  }
  async function requestFromScene(event, host) {
    if (disposed || permission !== 'unknown' || reduced.matches || document.hidden || pageSuspended || event.isTrusted !== true) return;
    const control = event.target?.closest?.('.exco-person, .exco-lantern-toggle');
    if (!control || !host.contains(control)) return;
    // Call synchronously inside an existing button's real click activation, as iOS requires.
    // This is a native permission prompt, never a permission bypass or a new tilt control.
    permission = 'pending';
    try {
      const answer = await orientation.requestPermission();
      if (disposed) return;
      permission = answer === 'granted' ? 'granted' : 'denied';
      start();
    } catch {
      if (!disposed) permission = 'denied';
    }
  }
  function armScene(host) {
    if (disposed || !host?.addEventListener || permission === 'unavailable') return () => {};
    if (scenes.has(host)) return scenes.get(host).cleanup;
    const gesture = event => { requestFromScene(event, host); };
    const cleanup = () => {
      if (scenes.get(host)?.cleanup !== cleanup) return;
      host.removeEventListener('click', gesture, true);
      scenes.delete(host);
    };
    scenes.set(host, { cleanup });
    host.addEventListener('click', gesture, { capture: true });
    return cleanup;
  }
  function visibilityChanged() { if (document.hidden) stop(); else start(); }
  function preferenceChanged() { if (reduced.matches) stop(); else start(); }
  function pageHidden() { pageSuspended = true; stop(); }
  function pageShown() { pageSuspended = false; start(); }
  function destroy() {
    if (disposed) return;
    disposed = true;
    stop();
    for (const scene of [...scenes.values()]) scene.cleanup();
    listeners.clear();
    window.removeEventListener('orientationchange', recenter);
    window.screen?.orientation?.removeEventListener('change', recenter);
    window.removeEventListener('pagehide', pageHidden);
    window.removeEventListener('pageshow', pageShown);
    document.removeEventListener('visibilitychange', visibilityChanged);
    if (reduced.removeEventListener) reduced.removeEventListener('change', preferenceChanged);
    else reduced.removeListener?.(preferenceChanged);
  }

  window.addEventListener('orientationchange', recenter, { passive: true });
  window.screen?.orientation?.addEventListener('change', recenter);
  window.addEventListener('pagehide', pageHidden);
  window.addEventListener('pageshow', pageShown);
  document.addEventListener('visibilitychange', visibilityChanged);
  if (reduced.addEventListener) reduced.addEventListener('change', preferenceChanged);
  else reduced.addListener?.(preferenceChanged);
  window.MIT_PHONE_TILT = {
    state,
    armScene,
    destroy,
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
  start();
})();
