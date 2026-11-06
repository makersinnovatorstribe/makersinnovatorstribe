/* One demand-driven frame queue. An empty/hidden page owns no animation loop. */
(() => {
  'use strict';
  let next = 0, frame = 0, timer = 0;
  const queue = new Map();
  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    if (timer) clearTimeout(timer);
    frame = timer = 0;
  };
  function schedule() {
    if (document.hidden || !queue.size || frame || timer) return;
    const delay = Math.min(...[...queue.values()].map(task => task.at)) - performance.now();
    if (delay > 20) timer = setTimeout(() => { timer = 0; schedule(); }, delay - 10);
    else frame = requestAnimationFrame(flush);
  }
  function flush(time) {
    frame = 0;
    if (document.hidden) return;
    const ready = [...queue].filter(([, task]) => task.at <= time + 1);
    // Snapshot first: work scheduled by a callback belongs to the next frame.
    for (const [id, task] of ready) {
      if (!queue.has(id)) continue;
      queue.delete(id);
      try { task.callback(time); }
      catch (error) { setTimeout(() => { throw error; }, 0); }
    }
    schedule();
  }
  window.MIT_MOTION = Object.freeze({
    request(callback, delay = 0) {
      const id = ++next;
      queue.set(id, { callback, at: performance.now() + Math.max(0, delay) });
      // A new immediate input must not wait behind a slow decorative tick.
      if (timer && delay === 0) { clearTimeout(timer); timer = 0; }
      schedule();
      return id;
    },
    cancel(id) { queue.delete(id); if (!queue.size) stop(); },
    pending: () => queue.size
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else schedule(); });
  window.addEventListener('pagehide', stop);
})();
