/* Small, predecoded forest details. CSS owns playback; no new frame loop. */
(() => {
  'use strict';
  if (document.body.classList.contains('forest-editor')) return;
  Promise.resolve(window.MIT_CREW_READY).then(() => {
    const host = document.getElementById('committee-grid');
    const forest = host?.querySelector('.exco-landscape');
    if (!forest || forest.querySelector('.forest-leaf-region')) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const states = new Map();
    let activeWindow = true, suspended = false;
    const make = (name, tag = 'span') => { const el = document.createElement(tag); el.className = name; return el; };
    const treehouse = forest.querySelector('[data-bear="hammer"]');
    const bird = make('forest-bird-anchor');
    bird.setAttribute('aria-hidden','true'); bird.hidden = true;
    const route = make('forest-bird-route'), sprite = make('forest-bird-sprite');
    route.append(sprite); bird.append(route);
    if (treehouse) treehouse.append(bird);
    const groups = [...forest.querySelectorAll('.exco-world-stage')].map((stage,index) => {
      const region = make('forest-leaf-region','div'); region.setAttribute('aria-hidden','true'); region.hidden = true;
      for (let i=0;i<2;i++) {
        const leaf = make('forest-falling-leaf'), art = make('forest-leaf-art'); leaf.append(art);
        const duration = 32 + index * 3 + i * 7;
        leaf.style.setProperty('--fall-left',(i ? 72-index*6 : 18+index*9)+'%');
        leaf.style.setProperty('--fall-size',(12+index+i*2)+'px');
        leaf.style.setProperty('--fall-drift',(i ? -39-index*7 : 35+index*9)+'px');
        leaf.style.setProperty('--fall-duration',duration+'s');
        leaf.style.setProperty('--fall-delay',(-4-index*3-i*19)+'s');
        region.append(leaf);
      }
      stage.append(region); states.set(region,{ready:false,visible:false}); return {stage,region};
    });
    states.set(bird,{ready:false,visible:false});
    function sync() {
      const blocked = document.hidden || suspended || !activeWindow || !!document.querySelector('dialog[open]');
      host.classList.toggle('forest-life-paused',blocked || reduced.matches);
      states.forEach((state,element) => {
        const isLeaf = element !== bird;
        element.hidden = !state.ready || (isLeaf && reduced.matches);
        element.classList.toggle('is-life-running',state.ready && state.visible && !blocked && !reduced.matches);
      });
    }
    function load(source,ready) {
      const image = make(source.includes('bird') ? 'forest-bird-source' : 'forest-leaf-source','img');
      image.alt=''; image.decoding='async'; image.fetchPriority='low';
      let done=false;
      image.addEventListener('load',async () => {
        if (done || !image.naturalWidth) return; done=true;
        try { if (typeof image.decode === 'function') await image.decode(); ready(); sync(); } catch { /* Keep missing artwork hidden. */ }
      });
      forest.append(image); image.src=source;
    }
    let birdStarted=false,leafStarted=false;
    function begin(element) {
      if (element===bird && treehouse && !birdStarted) {
        birdStarted=true;
        const url='assets/images/forest-life/songbird-poses-v1.webp';
        load(url,() => { sprite.style.backgroundImage='url("'+url+'")';states.get(bird).ready=true; });
      } else if (element!==bird && !leafStarted && !reduced.matches) {
        leafStarted=true;
        const url='assets/images/forest-life/oak-leaf-v1.webp';
        load(url,() => groups.forEach(({region}) => {
          region.querySelectorAll('.forest-leaf-art').forEach(art => { art.style.backgroundImage='url("'+url+'")'; });
          states.get(region).ready=true;
        }));
      }
    }
    // Observe the visible anchors, since undecoded artwork starts hidden.
    const targets = new Map(groups.map(({stage,region}) => [stage,region]));
    if (treehouse) targets.set(treehouse,bird);
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      entries.forEach(entry => { const element=targets.get(entry.target), state=states.get(element); if (state) { state.visible=entry.isIntersecting; if (entry.isIntersecting) begin(element); } }); sync();
    },{rootMargin:'30px'}) : null;
    const resize = () => groups.forEach(({stage,region}) => region.style.setProperty('--fall-distance',Math.max(180,(stage.offsetHeight || 700)*.72).toFixed(2)+'px'));
    for (const [target,element] of targets) {
      if (observer) observer.observe(target);
      else { states.get(element).visible=true; begin(element); }
    }
    window.addEventListener('resize',resize,{passive:true});
    window.addEventListener('blur',() => { activeWindow=false;sync(); });
    window.addEventListener('focus',() => { activeWindow=true;sync(); });
    window.addEventListener('pagehide',() => { suspended=true;sync(); });
    window.addEventListener('pageshow',() => { suspended=false;sync(); });
    document.addEventListener('visibilitychange',sync);
    reduced.addEventListener('change',() => { if (!reduced.matches) states.forEach((state,element) => { if (state.visible) begin(element); }); sync(); });
    // Decorative trail insertions must never wake playback or cause DOM reads.
    const dialogs=new MutationObserver(sync);
    dialogs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
    resize();sync();
  });
})();
