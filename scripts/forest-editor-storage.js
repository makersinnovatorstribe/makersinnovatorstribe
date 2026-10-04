/* Browser backup + revision-checked local project saves. No remote publishing. */
(() => {
  'use strict';
  const KEY = 'mit-woodland-layout-draft-v1';
  const HISTORY_KEY = KEY + '-history';
  const META_KEY = KEY + '-meta';
  const API = '/api/forest-layout';
  const OFFLINE = 'Missing save connection—your browser draft is still available';
  const CONFLICT = 'Newer saved version found. Click Save to keep this draft, or use Recovery.';
  const copy = value => JSON.parse(JSON.stringify(value));

  function create({ validate, onStatus = () => {}, scratch = false }) {
    if (typeof validate !== 'function') throw new TypeError('A layout validator is required.');
    let latest = null, revision = null, dirty = false, paused = false, destroyed = false;
    let generation = 0, timer = 0, inFlight = null, loading = null, loaded = false, manualQueued = false;
    let editedAt = null, serverHistory = [], conflictRecord = null, backupSequence = 0;
    const notify = (state, message) => { if (!destroyed) onStatus(state, message); };
    const normalized = value => copy(validate(copy(value)));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const read = key => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : null; } catch { return null; } };
    const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
    const valid = value => { try { return value ? normalized(value) : null; } catch { return null; } };
    const stopTimer = () => { window.clearTimeout(timer); timer = 0; };
    const meta = pending => ({ pending, editedAt, revision });

    function backup(layout, savedAt, label = 'Browser backup') {
      const safe = valid(layout);
      if (!safe || scratch) return;
      const previous = read(HISTORY_KEY);
      const history = Array.isArray(previous) ? previous : [];
      if (history.length && same(valid(history[0]?.layout), safe)) return;
      history.unshift({ id: 'browser-' + Date.now().toString(36) + '-' + (++backupSequence), label, savedAt: savedAt || new Date().toISOString(), layout: safe });
      write(HISTORY_KEY, history.slice(0, 50));
    }
    function storeBrowser() {
      const previous = read(KEY), previousMeta = read(META_KEY);
      if (previous && !same(valid(previous), latest)) backup(previous, previousMeta?.editedAt || previous.editedAt);
      const stored = write(KEY, latest);
      const tracked = write(META_KEY, meta(true));
      return stored && tracked;
    }
    function schedule() {
      stopTimer();
      if (!dirty || paused || destroyed || scratch || !loaded) return;
      timer = window.setTimeout(() => { timer = 0; void flush(false); }, 600);
    }
    function stage(layout, force = false) {
      const next = normalized(layout);
      if (!force && latest && same(next, latest)) return false;
      latest = next; generation++; dirty = true; editedAt = new Date().toISOString();
      const backedUp = storeBrowser();
      notify(paused ? 'conflict' : 'dirty', paused ? CONFLICT : backedUp ? 'Changes backed up in this browser · saving to project…' : 'Changes pending project save · browser backup unavailable');
      return true;
    }
    async function response(url, options) {
      const result = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
      let value;
      try { value = await result.json(); } catch { throw new Error('Save response was not valid JSON.'); }
      if (!result.ok) { const error = new Error(value?.error || 'Save connection failed.'); error.status = result.status; error.record = value; throw error; }
      return value;
    }
    function record(value) {
      if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, 'layout')) throw new Error('Invalid project save response.');
      const layout = value.layout === null ? null : normalized(value.layout);
      if (layout && (typeof value.revision !== 'string' || !value.revision)) throw new Error('Missing project revision.');
      return { layout, revision: value.revision || null, savedAt: typeof value.savedAt === 'string' ? value.savedAt : null, history: Array.isArray(value.history) ? value.history.slice(0, 50) : [] };
    }
    function retainConflict(value) {
      try {
        conflictRecord = record(value); revision = conflictRecord.revision; serverHistory = conflictRecord.history;
        if (conflictRecord.layout) backup(conflictRecord.layout, conflictRecord.savedAt, 'Newer project version');
      } catch { conflictRecord = null; }
      write(META_KEY, meta(true));
    }

    async function flush(manual, keepalive = false) {
      if (destroyed || scratch || !latest) return false;
      stopTimer();
      if (manual) { paused = false; manualQueued = true; }
      if (inFlight) return inFlight;
      if (paused || !dirty) return !dirty;
      const work = async () => {
        while (dirty && !paused && !destroyed) {
          const snapshot = copy(latest), version = generation;
          const reason = manualQueued ? 'save' : 'autosave'; manualQueued = false;
          // The conflict response is retained before an explicit overwrite. The
          // server also snapshots every replaced revision before its atomic write.
          if (conflictRecord?.layout) backup(conflictRecord.layout, conflictRecord.savedAt, 'Newer project version');
          notify('saving', 'Saving to the project file…');
          try {
            const saved = record(await response(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: snapshot, revision, reason }), ...(keepalive ? { keepalive: true } : {}) }));
            if (!saved.layout || !same(saved.layout, snapshot)) throw new Error('Project save readback did not match.');
            revision = saved.revision; serverHistory = saved.history; conflictRecord = null;
            if (version === generation) {
              dirty = false; write(META_KEY, meta(false));
              notify('saved', 'Saved to the project file');
            } else {
              write(META_KEY, meta(true));
              notify('dirty', 'Newer changes are queued for saving…');
            }
          } catch (error) {
            dirty = true;
            if (error.status === 409) {
              paused = true; manualQueued = false; retainConflict(error.record); notify('conflict', CONFLICT);
            } else notify('error', OFFLINE);
            break;
          }
        }
        return !dirty;
      };
      inFlight = work().finally(() => { inFlight = null; });
      return inFlight;
    }

    function load() {
      if (scratch) { notify('scratch', 'Scratch preview · your saved draft is untouched'); return Promise.resolve(null); }
      if (loading) return loading;
      loading = (async () => {
        notify('loading', 'Opening the saved project layout…');
        const browserRaw = read(KEY), browser = valid(browserRaw), browserMeta = read(META_KEY);
        try {
          const saved = record(await response(API));
          revision = saved.revision; serverHistory = saved.history; loaded = true;
          // Editing during a slow load must not be overwritten by its response.
          if (dirty && latest) { schedule(); return copy(latest); }
          const browserTime = Date.parse(browserMeta?.editedAt || browserRaw?.editedAt || '') || 0;
          const projectTime = Date.parse(saved.savedAt || '') || 0;
          const pendingNewer = browser && browserMeta?.pending === true && browserTime > projectTime;
          if (browser && (!saved.layout || pendingNewer)) {
            if (saved.layout && !same(browser, saved.layout)) backup(saved.layout, saved.savedAt, 'Project version before browser recovery');
            latest = browser; dirty = true; generation++; editedAt = browserMeta?.editedAt || browserRaw?.editedAt || new Date().toISOString();
            write(META_KEY, meta(true));
            notify('dirty', saved.layout ? 'Recovered newer browser edits · saving to project…' : 'Recovered browser draft · saving to project…');
            schedule(); return copy(latest);
          }
          if (saved.layout) {
            if (browser && !same(browser, saved.layout)) backup(browser, browserMeta?.editedAt || browserRaw?.editedAt, 'Earlier browser draft');
            latest = saved.layout; editedAt = saved.savedAt; dirty = false;
            // Mirror an acknowledged real project version for offline reopening;
            // this never writes a default layout or creates a new project save.
            write(KEY, latest); write(META_KEY, meta(false));
            notify('saved', 'Project draft loaded'); return copy(latest);
          }
          notify('dirty', 'No saved layout yet · your first edit or Save will create one'); return null;
        } catch {
          loaded = true;
          if (!latest && browser) { latest = browser; dirty = true; generation++; editedAt = browserMeta?.editedAt || browserRaw?.editedAt || new Date().toISOString(); revision = browserMeta?.revision || null; }
          notify('error', OFFLINE); return latest ? copy(latest) : null;
        }
      })();
      return loading;
    }
    function changed(layout) {
      if (destroyed) return false;
      if (scratch) { notify('scratch', 'Scratch preview · your saved draft is untouched'); return true; }
      try { if (stage(layout)) schedule(); return true; }
      catch { notify('error', 'This layout could not be validated. Your previous draft is preserved.'); return false; }
    }
    async function save(layout) {
      if (destroyed || scratch) { if (scratch) notify('scratch', 'Scratch preview · your saved draft is untouched'); return false; }
      try { stage(layout, !dirty); }
      catch { notify('error', 'This layout could not be validated. Your previous draft is preserved.'); return false; }
      // A manual save also works after a failed initial GET, with its last known
      // revision; the server rejects any unsafe overwrite with a409 response.
      loaded = true;
      return flush(true);
    }
    async function recoveries() {
      if (scratch || destroyed) return [];
      const results = [];
      const add = (id, label, savedAt, value) => { const layout = valid(value); if (layout) results.push({ id, label, savedAt: savedAt || '', layout }); };
      const browser = read(KEY), browserMeta = read(META_KEY);
      if (browser) add('browser-current', 'Latest browser backup', browserMeta?.editedAt || browser.editedAt, browser);
      const history = read(HISTORY_KEY);
      if (Array.isArray(history)) history.slice(0, 50).forEach(item => { if (item && typeof item.id === 'string') add(item.id, item.label || 'Browser backup', item.savedAt, item.layout); });
      let versions = serverHistory;
      try { versions = record(await response(API)).history; } catch { /* Browser backups remain usable offline. */ }
      const server = await Promise.all(versions.filter(item => item && typeof item.id === 'string').slice(0, 50).map(async item => {
        try { return { id: item.id, saved: record(await response(API + '/history/' + encodeURIComponent(item.id))) }; } catch { return null; }
      }));
      server.forEach(item => { if (item) add('project-' + item.id, 'Project ' + (versions.find(v => v.id === item.id)?.reason === 'autosave' ? 'autosave' : 'saved version'), item.saved.savedAt, item.saved.layout); });
      const seen = new Set();
      return results.filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; }).sort((a, b) => (Date.parse(b.savedAt) || 0) - (Date.parse(a.savedAt) || 0));
    }
    function beforeUnload(event) {
      if (!dirty || scratch) return;
      event.preventDefault(); event.returnValue = '';
    }
    function pageHide() {
      if (!dirty || paused || inFlight || scratch || destroyed) return;
      void flush(false, true);
    }
    if (!scratch) { window.addEventListener('beforeunload', beforeUnload); window.addEventListener('pagehide', pageHide); }
    return { load, changed, save, recoveries, destroy() { destroyed = true; stopTimer(); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('pagehide', pageHide); } };
  }
  window.MIT_FOREST_DRAFTS = { create };
})();
