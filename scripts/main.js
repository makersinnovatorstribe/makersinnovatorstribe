(() => {
 'use strict';
 const content=window.MIT_CONTENT, $=id=>document.getElementById(id);
 if(!content || !$('project-grid')) return;
 let photos=[],activePhotos=[],photoIndex=0,galleryReturn=false,captionFollowsPhoto=false;
 $('open-gallery').disabled=true;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeUrl=s=>{if(typeof s!=='string'||!s.trim())return '';try{const u=new URL(s,document.baseURI);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
 const readJson=async file=>{const response=await fetch(new URL(file,document.baseURI));if(!response.ok)throw new Error('Unable to load '+file);return response.json()};
 const dateText=date=>date?new Intl.DateTimeFormat('en-SG',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Singapore'}).format(new Date(date+'T12:00:00+08:00')):'';
 const matching=p=>p.photoIds?p.photoIds.map(id=>photos.find(photo=>photo.id===id)).filter(Boolean):photos.filter(photo=>photo.category.toLowerCase().includes(p.match.toLowerCase()));
 const imageTag=(p,thumb=true)=>`<img src="${escape(thumb?(p.thumbnail||p.file):p.file)}" alt="${escape(p.title)}" width="${p.width||640}" height="${p.height||480}" loading="lazy">`;
 document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
 });
 const menuButton=document.querySelector('.menu-button');
 menuButton.addEventListener('click',()=>{$('menu-dialog').showModal();menuButton.setAttribute('aria-expanded','true')});
 $('menu-dialog').addEventListener('close',()=>menuButton.setAttribute('aria-expanded','false'));
 $('menu-dialog').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>$('menu-dialog').close()));
 function showPhoto(){
  const photo=activePhotos[photoIndex];if(!photo)return;
  $('project-image').src=photo.file;$('project-image').alt=photo.title;
  if(captionFollowsPhoto){$('project-title').textContent=photo.title;$('project-category').textContent=photo.category}
  $('project-date').textContent=photo.date?dateText(photo.date):(photo.dateLabel||'');
  $('photo-position').textContent=(photoIndex+1)+' / '+activePhotos.length;
  $('previous-photo').disabled=activePhotos.length<2;$('next-photo').disabled=activePhotos.length<2;
 }
 function openDetail(title,category,description,items,index=0,followCaption=false){
  if(!items.length)return;activePhotos=items;photoIndex=index;captionFollowsPhoto=followCaption;
  $('project-title').textContent=title;$('project-category').textContent=category;$('project-description').textContent=description;
  showPhoto();if(!$('project-dialog').open)$('project-dialog').showModal();
 }
 $('previous-photo').addEventListener('click',()=>{photoIndex=(photoIndex-1+activePhotos.length)%activePhotos.length;showPhoto()});
 $('next-photo').addEventListener('click',()=>{photoIndex=(photoIndex+1)%activePhotos.length;showPhoto()});
 $('project-dialog').addEventListener('keydown',event=>{if(event.key==='ArrowLeft')$('previous-photo').click();if(event.key==='ArrowRight')$('next-photo').click()});
 $('project-dialog').addEventListener('close',()=>{if(galleryReturn){galleryReturn=false;$('gallery-dialog').showModal()}});
 document.querySelectorAll('[data-project]').forEach(button=>button.addEventListener('click',()=>{const p=content.projects.find(p=>p.match===button.dataset.project);if(p){const items=matching(p),first=items.findIndex(x=>x.file===p.image);openDetail(p.title,p.label,p.description,items,Math.max(0,first))}}));
 function renderProjectCards(projects,gridId,offset=0){
  $(gridId).replaceChildren();
  projects.forEach((p,index)=>{const items=matching(p),photo=photos.find(x=>x.file===p.image)||items[0];if(!photo)return;
   const card=document.createElement('button');card.className='project-card';card.type='button';card.dataset.makeIndex=String(index+offset);card.setAttribute('aria-label','Explore '+p.title);
   card.style.setProperty('--photo-ratio',String((photo.width||4)/(photo.height||3)));
   card.innerHTML=`<span class="project-photo">${imageTag(photo)}</span><span class="project-caption"><span class="project-tag">${escape(p.label)}</span><span class="project-title">${escape(p.title)}</span><span class="project-arrow" aria-hidden="true">↗</span></span>`;
   card.addEventListener('click',()=>openDetail(p.title,p.label,p.description,items,Math.max(0,items.indexOf(photo))));$(gridId).append(card);
  });
 }
 function renderProjects(){
  renderProjectCards(content.projects,'project-grid');
  const extras=content.extraProjects||[];
  renderProjectCards(extras,'more-project-grid',content.projects.length);
  $('see-more-makes').disabled=!extras.length;
  $('more-makes-count').textContent=extras.length+' more projects to discover';
 }
 $('see-more-makes').addEventListener('click',()=>{
  const expanded=$('more-makes').hidden;
  $('more-makes').hidden=!expanded;
  $('see-more-makes').setAttribute('aria-expanded',String(expanded));
  $('see-more-makes').innerHTML=expanded?'Show fewer makes <span aria-hidden="true">−</span>':'See more makes <span aria-hidden="true">＋</span>';
 });
 function renderMoments(){
  const moments=[{id:'orientation-community',caption:'Find your people.'},{id:'strawberry-session',caption:'A little figuring it out.'},{id:'embroidery-session',caption:'A lot of making it happen.'}];
  moments.forEach(({id,caption})=>{const p=photos.find(photo=>photo.id===id);if(!p)return;const button=document.createElement('button');button.type='button';button.className='moment-photo';button.setAttribute('aria-label','View '+p.title);button.innerHTML=imageTag(p,false)+`<span>${escape(caption)}</span>`;button.addEventListener('click',()=>openDetail(p.title,p.category,'A moment from our workshop album.',[p]));$('moment-grid').append(button)});
  $('album-count').textContent=photos.length+' moments & counting';
 }
 function renderGallery(category='All'){
  const items=category==='All'?photos:photos.filter(p=>p.category===category);
  $('gallery-grid').replaceChildren();$('gallery-status').textContent=items.length+' '+(items.length===1?'photo':'photos');
  document.querySelectorAll('.gallery-filter').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===category)));
  items.forEach((p,index)=>{const button=document.createElement('button');button.className='gallery-photo';button.setAttribute('aria-label','View '+p.title);button.innerHTML=imageTag(p)+`<span>${escape(p.title)}</span>`;
   button.addEventListener('click',()=>{$('gallery-dialog').close();galleryReturn=true;openDetail(p.title,p.category,'From the tribe’s workshop and event album.',items,index,true)});$('gallery-grid').append(button)});
 }
 $('open-gallery').addEventListener('click',()=>{renderGallery();$('gallery-dialog').showModal()});
 const instagram=safeUrl(content.instagramUrl);
 if(instagram){const a=document.createElement('a');a.href=instagram;a.target='_blank';a.rel='noopener noreferrer';a.textContent=content.instagramHandle+' ↗';$('social-links').append(a)}
 if(content.contactEmail){const a=document.createElement('a');a.href='mailto:'+content.contactEmail;a.textContent='Email us ↗';$('social-links').append(a)}
 $('join-button').addEventListener('click',()=>{
  const url=safeUrl(content.joinUrl);
  $('join-details').innerHTML=url?`<p>${escape(content.joinDescription)}</p><a class="button" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(content.joinLabel)} ↗</a>`:`<p>Curious about joining or trying a workshop?<br>Say hello to us on Instagram.</p><a class="button" href="${escape(instagram)}" target="_blank" rel="noopener noreferrer">Message ${escape(content.instagramHandle)} ↗</a><p class="pending-note">Ask the tribe about current workshops and joining details.</p>`;
  $('join-dialog').showModal();
 });
 async function init(){
  try{photos=await readJson('scripts/photos.json');renderProjects();renderMoments();$('open-gallery').disabled=false;
   ['All',...new Set(photos.map(p=>p.category))].forEach(category=>{const b=document.createElement('button');b.className='gallery-filter';b.textContent=category;b.setAttribute('aria-pressed',String(category==='All'));b.addEventListener('click',()=>renderGallery(category));$('gallery-filters').append(b)});
  }catch(error){$('project-grid').innerHTML='<p class="loading-message">The photo album could not be loaded. Please refresh to try again.</p>';$('open-gallery').disabled=true;console.error(error)}
  try{const posters=await readJson('scripts/posters.json');if(posters.length){$('workshops').hidden=false;const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   posters.forEach(p=>{const upcoming=p.date>=today,button=document.createElement('button');button.className='poster-card '+(upcoming?'is-upcoming':'is-past');button.type='button';button.setAttribute('aria-label','View '+p.title+' poster');button.style.setProperty('--poster-ratio',String((p.width||600)/(p.height||800)));button.innerHTML=`<span class="poster-pin" aria-hidden="true"></span><img src="${escape(p.file)}" alt="${escape(p.title)} workshop poster" width="${p.width||600}" height="${p.height||800}" loading="lazy"><span class="poster-status ${upcoming?'upcoming':''}">${upcoming?'Coming up':'From the archive'}</span><h3>${escape(p.title)}</h3><p>${escape(p.dateLabel)}</p><span class="poster-open" aria-hidden="true">Take a look ↗</span>`;button.addEventListener('click',()=>openDetail(p.title,upcoming?'Upcoming workshop':'Past workshop',p.description,[p]));$('poster-grid').append(button)})}}
  catch(error){console.error(error)}
 }
 window.MIT_PAGE_READY=init();
})();
