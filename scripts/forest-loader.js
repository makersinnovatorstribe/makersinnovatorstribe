/* Keep the editable controllers separate, fetching them together near the woods. */
(() => {
  'use strict';
  const section = document.getElementById('people');
  const sources = [...document.querySelectorAll('script[data-forest-src]')];
  if (!section || !sources.length) return;
  let loading = null, observer;
  let resolveCrew, rejectCrew;
  const gate = new Promise((resolve, reject) => { resolveCrew = resolve; rejectCrew = reject; });
  gate.catch(() => {});
  window.MIT_CREW_READY = gate;
  async function heroPaint() {
    // If the woods are already near the first screen, their construction must
    // still yield to the high-priority hero. Direct links/scrolling skip this.
    if (location.hash || window.scrollY > window.innerHeight * .35) return;
    const image = document.querySelector('.hero-workshop-scene img.exco-hammer-fallback, .hero-workshop-scene img.hero-workshop-art');
    if (!image?.decode) return;
    let timer;
    try { await Promise.race([image.decode().catch(() => {}), new Promise(resolve => { timer = setTimeout(resolve, 900); })]); }
    finally { clearTimeout(timer); }
    await new Promise(resolve => window.MIT_MOTION.request(() => window.MIT_MOTION.request(resolve)));
  }
  function load() {
    if (loading) return loading;
    observer?.disconnect();
    // async=false preserves the documented execution order while downloads
    // overlap. Existing crew/page readiness promises still own final geometry.
    loading = heroPaint().then(() => Promise.all(sources.map(source => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = false;
      script.src = source.dataset.forestSrc;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Unable to load a woodland controller.'));
      document.head.append(script);
    })))).then(() => {
      const crew = window.MIT_CREW_READY;
      if (crew === gate) throw new Error('The woodland controller did not initialize.');
      return crew;
    }).then(value => { section.removeAttribute('data-forest-pending'); resolveCrew(value); return value; }).catch(error => { rejectCrew(error); throw error; });
    loading.catch(() => {});
    return loading;
  }
  window.MIT_LOAD_FOREST = load;
  window.MIT_FOREST_READY = gate;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void load(); }, {rootMargin:Math.round(window.innerHeight * .9) + 'px 0px'});
    observer.observe(section);
  } else void load();
  if (location.hash === '#people' || document.documentElement.scrollHeight <= innerHeight) void load();
})();
