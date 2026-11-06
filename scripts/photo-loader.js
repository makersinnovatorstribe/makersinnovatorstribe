/* Keep a decoded preview on paper while the selected detail image arrives. */
(() => {
 'use strict';
 const MAX_IMAGES=12, MAX_REQUESTS=3;
 const cache=new Map();
 let running=0;
 const touch=(url,entry)=>{cache.delete(url);cache.set(url,entry)};
 function pump(){
  while(running<MAX_REQUESTS){
   const next=[...cache.values()].filter(entry=>entry.state==='queued').sort((a,b)=>a.priority-b.priority)[0];
   if(!next)break;
   next.state='loading';running++;
   const image=next.image;
   image.decoding='async';image.fetchPriority=next.priority<3?'high':'low';
   image.onload=async()=>{
    try{if(image.decode)await image.decode();if(!image.naturalWidth)throw new Error('Empty photo');finish(next,'ready',image)}
    catch{finish(next,'failed',null)}
   };
   image.onerror=()=>finish(next,'failed',null);
   image.src=next.url;
   if(image.complete&&image.naturalWidth)image.onload();
  }
 }
 function finish(entry,state,value){
  if(entry.state!=='loading')return;
  entry.image.onload=null;entry.image.onerror=null;entry.state=state;running--;
  entry.resolve(value);pump();trim();
 }
 function cancel(entry){
  if(entry.state==='queued'||entry.state==='loading'){
   const active=entry.state==='loading';
   entry.image.onload=null;entry.image.onerror=null;entry.state='cancelled';
   if(active){running--;entry.image.src=''}
   entry.resolve(null);
  }
  cache.delete(entry.url);
 }
 function trim(){
  for(const [url,entry] of cache){
   if(cache.size<=MAX_IMAGES)break;
   if(entry.state!=='loading'&&entry.state!=='queued')cache.delete(url);
  }
 }
 function load(url,priority=3){
  if(!url)return Promise.resolve(null);
  let entry=cache.get(url);
  if(entry&&entry.state!=='failed'&&entry.state!=='cancelled'){
   entry.priority=Math.min(entry.priority,priority);if(entry.state==='loading'&&entry.priority<3)entry.image.fetchPriority='high';touch(url,entry);pump();return entry.promise;
  }
  let resolve;const promise=new Promise(done=>{resolve=done});
  entry={url,priority,promise,resolve,state:'queued',image:new Image()};
  touch(url,entry);pump();trim();return promise;
 }
 function keepOnly(urls){
  for(const entry of cache.values())if(!urls.has(entry.url)&&(entry.state==='queued'||entry.state==='loading'))cancel(entry);
  pump();
 }
 const detailUrl=photo=>{
  const connection=window.navigator?.connection;
  const modest=window.innerWidth<=1000||connection?.saveData||/2g/.test(connection?.effectiveType||'');
  return modest?(photo.detail||photo.file):(photo.file||photo.detail);
 };
 const previewUrl=photo=>photo.thumbnail||photo.detail||photo.file;
 const drivePoster=photo=>photo.kind==='poster'&&/^https:\/\/drive\.google\.com\/(?:file\/d\/|open\?)/i.test(photo.file||'');
 function create(image){
  const stage=document.createElement('div');stage.className='project-photo-stage';
  const preview=document.createElement('img');preview.className='project-image-preview';preview.alt='';preview.setAttribute('aria-hidden','true');preview.decoding='async';
  const status=document.createElement('span');status.className='project-photo-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const retryButton=document.createElement('button');retryButton.className='project-photo-retry';retryButton.type='button';retryButton.textContent='Try again';retryButton.hidden=true;
  const parent=image.parentNode;parent.prepend(stage);stage.append(preview,image,status,retryButton);
  image.classList.add('project-image-detail');image.decoding='async';
  image.loading='eager';image.fetchPriority='high';
  let revision=0, selected='', selectedTitle='', selectedPhoto=null, selectedItems=[], selectedIndex=0;
  function display(decoded){
   // Attach the already decoded element itself: assigning src on a second image
   // can briefly clear that element on slower phones even with a warm cache.
   const previous=image;
   if(previous!==decoded){decoded.id=previous.id;decoded.className='project-image-detail';stage.insertBefore(decoded,status);previous.remove();image=decoded}
   image.alt=selectedTitle;image.width=decoded.naturalWidth;image.height=decoded.naturalHeight;
   stage.classList.add('is-detail-ready');stage.classList.remove('is-photo-loading','is-photo-error');
   stage.setAttribute('aria-busy','false');status.textContent='';retryButton.hidden=true;
  }
  function show(photo,items,index){
   const token=++revision, thumb=previewUrl(photo), detail=detailUrl(photo);
   selectedPhoto=photo;selectedItems=items;selectedIndex=index;
   selected=detail;selectedTitle=photo.title||'';retryButton.hidden=true;
   stage.classList.add('is-photo-loading');stage.classList.remove('is-photo-error');
   stage.setAttribute('aria-busy','true');image.alt=photo.title||'';
   status.textContent='Bringing this moment into focus…';
   if(drivePoster(photo)){
    const live=window.MIT_WORKSHOP_LIVE;
    const unavailable=()=>{if(token!==revision)return;stage.classList.remove('is-photo-loading');stage.classList.add('is-photo-error');stage.setAttribute('aria-busy','false');status.textContent='The poster is taking a little longer. Try again in a moment.';retryButton.hidden=false};
    if(!live?.resolveImage){unavailable();return}
    live.resolveImage(photo,'thumb').then(url=>load(url,1).then(decoded=>{
     if(token!==revision||!decoded||stage.classList.contains('is-detail-ready')&&image.src===selected)return;
     preview.src=url;preview.width=decoded.naturalWidth;preview.height=decoded.naturalHeight;
     stage.classList.add('has-photo-preview');stage.classList.remove('is-detail-ready');
    })).catch(()=>{});
    live.resolveImage(photo,'full').then(url=>{
     if(token!==revision)return null;selected=url;return load(url,2);
    }).then(decoded=>{if(token!==revision)return;if(decoded)display(decoded);else unavailable()}).catch(unavailable);
    return;
   }
   const adjacent=items.length>1?[items[(index-1+items.length)%items.length],items[(index+1)%items.length]]:[];
   const wanted=new Set([thumb,detail,...adjacent.flatMap(item=>[previewUrl(item),detailUrl(item)])]);
   keepOnly(wanted);
   const revealDetail=decoded=>{
    if(token!==revision)return;
    if(!decoded){stage.classList.remove('is-photo-loading');stage.classList.add('is-photo-error');stage.setAttribute('aria-busy','false');status.textContent='This moment is taking a little longer. Keep the preview or try again.';retryButton.hidden=false;return}
    display(decoded);
   };
   load(thumb,1).then(decoded=>{
    if(token!==revision||!decoded||stage.classList.contains('is-detail-ready')&&image.src.endsWith(detail))return;
    preview.src=thumb;preview.width=decoded.naturalWidth;preview.height=decoded.naturalHeight;
    stage.classList.add('has-photo-preview');stage.classList.remove('is-detail-ready');
   });
   load(detail,2).then(revealDetail);
   for(const item of adjacent){load(previewUrl(item),3);load(detailUrl(item),4)}
  }
  retryButton.addEventListener('click',()=>{if(stage.classList.contains('is-photo-error')){
   if(drivePoster(selectedPhoto)){show(selectedPhoto,selectedItems,selectedIndex);return}
   const failed=cache.get(selected);if(failed)cache.delete(selected);
   stage.classList.add('is-photo-loading');stage.classList.remove('is-photo-error');
   retryButton.hidden=true;stage.setAttribute('aria-busy','true');status.textContent='Bringing this moment into focus…';
   const token=revision;load(selected,1).then(decoded=>{if(token!==revision)return;if(decoded)display(decoded);else{stage.classList.remove('is-photo-loading');stage.classList.add('is-photo-error');stage.setAttribute('aria-busy','false');status.textContent='This moment is taking a little longer. Keep the preview or try again.';retryButton.hidden=false}});
  }});
  return Object.freeze({show,close(){revision++;keepOnly(new Set())}});
 }
 window.MIT_PHOTO_LOADER=Object.freeze({create});
})();
