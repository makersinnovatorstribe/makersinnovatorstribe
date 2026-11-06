(() => {
 'use strict';
 const content=window.MIT_CONTENT, $=id=>document.getElementById(id);
 if(!content||!$('project-grid'))return;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeUrl=s=>{try{if(typeof s!=='string'||!s.trim())return '';const u=new URL(s,document.baseURI);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
 const readJson=async file=>{const r=await fetch(new URL(file,document.baseURI));if(!r.ok)throw new Error('Unable to load '+file);return r.json()};
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const open=(dialog,trigger)=>window.MIT_SHEET?window.MIT_SHEET.open(dialog,{trigger}):(dialog.showModal(),dialog);
 const close=dialog=>window.MIT_SHEET?window.MIT_SHEET.close(dialog):(dialog.close(),Promise.resolve());
 let photos=[],basePhotos=[],activePhotos=[],photoIndex=0,galleryReturn=false,captionFollowsPhoto=false,craft='All',expanded=false;
 const seedProjects=content.projects.slice(),seedExtras=(content.extraProjects||[]).slice(),extraIds=new Set(seedExtras.map(p=>p.match));
 let projects=[...seedProjects,...seedExtras],crafts=[...new Set(projects.map(p=>p.label))];
 const dateText=date=>date?new Intl.DateTimeFormat('en-SG',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Singapore'}).format(new Date(date+'T12:00:00+08:00')):'';
 const matching=p=>p.photoIds?p.photoIds.map(id=>photos.find(x=>x.id===id)).filter(Boolean):photos.filter(x=>x.category.toLowerCase().includes(p.match.toLowerCase()));
 const imageTag=p=>`<img src="${escape(p.thumbnail||p.detail||p.file)}" data-cms-fallback="${escape(p.fallbackFile||'assets/images/MITLogo_Web.webp')}" alt="${escape(p.title)}" width="${p.thumbnailWidth||p.width||640}" height="${p.thumbnailHeight||p.height||480}" loading="lazy" decoding="async">`;
 $('open-gallery').disabled=true;
 const track=$('photo-track');
 const photoLoader=$('project-image')?window.MIT_PHOTO_LOADER?.create($('project-image')):null;
 const slideLoaders=new Map();let slideNodes=[],trackTimer=0,requestedPhoto=null;
 const drivePoster=p=>p.kind==='poster'&&/^https:\/\/drive\.google\.com\/(?:file\/d\/|open\?)/i.test(p.file||'');
 function buildTrack(){if(!track)return;slideLoaders.forEach(l=>l.close());slideLoaders.clear();requestedPhoto=null;track.replaceChildren();slideNodes=[];
  activePhotos.forEach(p=>{const slide=document.createElement('div');slide.className='photo-slide'+(p.kind==='poster'||/posters\//.test(p.file)?' is-poster':'');const img=document.createElement('img');img.alt=p.title;img.width=p.thumbnailWidth||p.width||640;img.height=p.thumbnailHeight||p.height||480;img.loading='lazy';img.decoding='async';slide.append(img);track.append(slide);slideNodes.push(slide)});
  const dots=$('photo-dots');dots.replaceChildren();if(activePhotos.length<=7)activePhotos.forEach((p,index)=>{const b=document.createElement('button');b.type='button';b.className='photo-dot';b.setAttribute('aria-label','Photo '+(index+1)+' of '+activePhotos.length);b.addEventListener('click',()=>{photoIndex=index;showPhoto()});dots.append(b)});
 }
 function loadCurrent(){if(!track)return;let loader=slideLoaders.get(photoIndex);const slide=slideNodes[photoIndex];if(!slide)return;
  if(!loader){const image=slide.querySelector('img');if(!drivePoster(activePhotos[photoIndex]))image.src=activePhotos[photoIndex].thumbnail||activePhotos[photoIndex].detail||activePhotos[photoIndex].file;loader=window.MIT_PHOTO_LOADER?.create(image);if(loader)slideLoaders.set(photoIndex,loader)}
  loader?.show(activePhotos[photoIndex],activePhotos,photoIndex);
  [photoIndex-1,photoIndex+1].forEach(i=>{const img=slideNodes[i]?.querySelector('img');if(img&&!drivePoster(activePhotos[i])){img.loading='eager';if(!img.getAttribute('src'))img.src=activePhotos[i].thumbnail||activePhotos[i].detail||activePhotos[i].file}});
 }
 if(track){const settled=()=>{if(!$('project-dialog').open)return;window.clearTimeout(trackTimer);trackTimer=0;const i=Math.max(0,Math.min(activePhotos.length-1,Math.round(track.scrollLeft/(track.clientWidth||1))));if(requestedPhoto&&i!==requestedPhoto.index&&performance.now()<requestedPhoto.until){trackTimer=window.setTimeout(settled,100);return}requestedPhoto=null;if(i!==photoIndex){photoIndex=i;showPhoto(false)}};
  track.addEventListener('scroll',()=>{window.clearTimeout(trackTimer);trackTimer=window.setTimeout(settled,100)},{passive:true});track.addEventListener('scrollend',settled);['pointerdown','touchstart','wheel'].forEach(type=>track.addEventListener(type,()=>{requestedPhoto=null},{passive:true}));
  window.addEventListener('resize',()=>{if($('project-dialog').open)track.scrollTo({left:photoIndex*track.clientWidth,behavior:'instant'})},{passive:true});
 }
 if(!window.MIT_SHEET)document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
 });
 const menuButton=document.querySelector('.menu-button');
 menuButton.addEventListener('click',()=>{open($('menu-dialog'),menuButton);menuButton.setAttribute('aria-expanded','true')});
 $('menu-dialog').addEventListener('close',()=>menuButton.setAttribute('aria-expanded','false'));
 $('menu-dialog').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>close($('menu-dialog'))));
 function showPhoto(move=true){const p=activePhotos[photoIndex];if(!p)return;
  if(track){loadCurrent();if(move){requestedPhoto={index:photoIndex,until:performance.now()+1500};track.scrollTo({left:photoIndex*track.clientWidth,behavior:reduced()?'instant':'smooth'})};const dots=$('photo-dots');if(activePhotos.length>7)dots.textContent=(photoIndex+1)+' / '+activePhotos.length;else dots.querySelectorAll('.photo-dot').forEach((b,i)=>b.setAttribute('aria-current',String(i===photoIndex)))}
  else if(photoLoader)photoLoader.show(p,activePhotos,photoIndex);else{$('project-image').src=p.file;$('project-image').alt=p.title}
  if(captionFollowsPhoto){$('project-title').textContent=p.title;$('project-category').textContent=p.category;$('project-description').textContent=p.description||''}
  $('project-date').textContent=p.date?dateText(p.date):(p.dateLabel||'');$('project-date').hidden=!$('project-date').textContent;
  $('project-description').hidden=!$('project-description').textContent;
  $('photo-position').textContent=(photoIndex+1)+' / '+activePhotos.length;
  $('previous-photo').disabled=activePhotos.length<2;$('next-photo').disabled=activePhotos.length<2;
 }
 function openDetail(title,category,description,items,index=0,followCaption=false,trigger){if(!items.length)return;
  activePhotos=items;photoIndex=Math.max(0,Math.min(items.length-1,index));captionFollowsPhoto=followCaption;
  $('project-title').textContent=title;$('project-category').textContent=category;$('project-description').textContent=description;
  buildTrack();if(!$('project-dialog').open)open($('project-dialog'),trigger);showPhoto(false);
  if(track)track.scrollTo({left:photoIndex*track.clientWidth,behavior:'instant'});
 }
 window.MIT_PHOTO_DETAIL=Object.freeze({open:({title='',category='',description='',items=[],index=0,followCaption=false,trigger}={})=>openDetail(title,category,description,items,index,followCaption,trigger),photos:()=>photos.slice()});
 $('previous-photo').addEventListener('click',()=>{photoIndex=(photoIndex-1+activePhotos.length)%activePhotos.length;showPhoto()});
 $('next-photo').addEventListener('click',()=>{photoIndex=(photoIndex+1)%activePhotos.length;showPhoto()});
 $('project-dialog').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();$('previous-photo').click()}if(e.key==='ArrowRight'){e.preventDefault();$('next-photo').click()}});
 $('project-dialog').addEventListener('close',()=>{window.clearTimeout(trackTimer);photoLoader?.close();slideLoaders.forEach(l=>l.close());if(galleryReturn){galleryReturn=false;open($('gallery-dialog'),$('open-gallery'))}});
 document.querySelectorAll('[data-project]').forEach(b=>b.addEventListener('click',()=>{const p=content.projects.find(p=>p.match===b.dataset.project);if(p){const items=matching(p),first=items.findIndex(x=>x.file===p.image);openDetail(p.title,p.label,p.description,items,Math.max(0,first),false,b)}}));
 const cutouts={Textile:{file:'strawberry-bag.webp',width:600,height:454,alt:'A strawberry-shaped fabric bag made by the tribe'},Tuft:{file:'mascot-rug.webp',width:600,height:597,alt:'The finished MIT mascot rug'},Laser:{file:'layered-wood.webp',width:600,height:600,alt:'A woodland scene made from layers of laser-cut wood'}};
 function renderProjects(){
  const visible=craft==='All'?(expanded?projects:content.projects):projects.filter(p=>p.label===craft),grid=$('project-grid');grid.replaceChildren();
  visible.forEach((p,index)=>{let items=matching(p),photo=photos.find(x=>x.file===p.image)||items[0];
   if(p.image&&(p.cmsImage||!photo)){photo={id:'make-'+p.match,file:p.image,thumbnail:p.image,fallbackFile:p.fallbackFile,title:p.title,category:p.label,description:p.description,width:640,height:480};items=[photo,...items]}
   if(!photo)return;
   const cutout=!p.cmsImage&&cutouts[p.match],card=document.createElement('button');card.type='button';card.className='make-card card'+(index===0?' make-card--feature':'');card.dataset.craft=p.label;card.dataset.makeIndex=String(projects.indexOf(p));card.setAttribute('aria-label','Explore '+p.title);
   const firstSentence=(p.description||'').match(/[^.!?]+[.!?]?/)?.[0]||'';
   const art=cutout?`<img class="cutout" src="assets/images/cutouts/${cutout.file}" alt="${escape(cutout.alt)}" width="${cutout.width}" height="${cutout.height}" loading="lazy" decoding="async">`:imageTag(photo);
   card.innerHTML=`<span class="make-well${cutout?' is-cutout':''}">${art}</span><span class="make-cap"><span class="tag t-label">${escape(p.label)}</span><span class="t-h4">${escape(p.title)}</span>${index===0&&firstSentence?`<span class="make-description t-small">${escape(firstSentence)}</span>`:''}<span class="make-arrow" aria-hidden="true">↗</span></span>`;
   card.addEventListener('click',()=>openDetail(p.title,p.label,p.description,items,Math.max(0,items.indexOf(photo)),false,card));grid.append(card);
  });
  window.MIT_IMAGES?.scan(grid);
  const more=$('see-more-makes');more.disabled=!(content.extraProjects||[]).length;more.hidden=craft!=='All';more.setAttribute('aria-expanded',String(expanded));more.textContent=expanded?'Show fewer makes −':`See ${(content.extraProjects||[]).length} more makes ＋`;
  if($('make-filters'))$('make-filters').querySelectorAll('.chip').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.craft===craft)));
 }
 function filter(label){craft=crafts.includes(label)?label:'All';expanded=false;if(photos.length){renderProjects();if(!reduced()){$('project-grid').classList.remove('is-filtering');void $('project-grid').offsetWidth;$('project-grid').classList.add('is-filtering')}}}
 window.MIT_MAKES=Object.freeze({filter});
 function renderCrafts(){
  $('make-filters')?.replaceChildren();$('hero-crafts')?.replaceChildren();
  ['All',...crafts].forEach(label=>{if($('make-filters')){const b=document.createElement('button');b.type='button';b.className='chip';b.dataset.craft=label;b.textContent=label;b.setAttribute('aria-pressed',String(label===craft));b.addEventListener('click',()=>filter(label));$('make-filters').append(b)}});
  crafts.forEach((label,index)=>{if(!$('hero-crafts'))return;const a=document.createElement('a');a.className='chip';a.href='#makes';a.dataset.craft=label;a.textContent=label;a.style.setProperty('--chip-index',index);a.addEventListener('click',()=>filter(label));$('hero-crafts').append(a)});
 }
 renderCrafts();
 $('see-more-makes').addEventListener('click',()=>{expanded=!expanded;renderProjects()});
 function renderMoments(){
  const seeds=[['orientation-community','Find your people.'],['strawberry-session','A little figuring it out.'],['embroidery-session','A lot of making it happen.'],['rug-community','Good people. Very good ideas.']].flatMap(([id,caption])=>{const p=photos.find(x=>x.id===id);return p?[{...p,photoTitle:p.title,title:caption,description:'A moment from our workshop album.'}]:[]});
  const moments=window.MIT_CMS?.collection('moment',seeds)||seeds;
  $('moment-grid').replaceChildren();moments.forEach((p,index)=>{const title=p.photoTitle||p.title,b=document.createElement('button');b.type='button';b.className='moment-photo';b.style.setProperty('--paper-angle',['-2deg','1.5deg','-1deg','2deg'][index%4]);b.setAttribute('aria-label','View '+title);b.innerHTML=`<span class="tape" aria-hidden="true"></span>${imageTag({...p,title})}<span>${escape(p.title)}</span>`;b.addEventListener('click',()=>openDetail(title,p.category,p.description||'A moment from our workshop album.',[{...p,title}],0,false,b));$('moment-grid').append(b)});
  $('open-gallery').textContent=`Open the album · ${photos.length} photos ↗`;
 }
 function renderGallery(category='All'){
  const items=category==='All'?photos:photos.filter(p=>p.category===category);$('gallery-grid').replaceChildren();$('gallery-status').textContent=items.length+' '+(items.length===1?'photo':'photos');
  $('gallery-filters').querySelectorAll('.chip').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===category)));
  items.forEach((p,index)=>{const b=document.createElement('button');b.type='button';b.className='gallery-photo';b.setAttribute('aria-label','View '+p.title);b.innerHTML=imageTag(p);
   b.addEventListener('click',()=>{galleryReturn=true;openDetail(p.title,p.category,'From the tribe’s workshop and event album.',items,index,true,b);close($('gallery-dialog'))});$('gallery-grid').append(b)});
 }
 $('open-gallery').addEventListener('click',()=>{renderGallery();open($('gallery-dialog'),$('open-gallery'))});
 function renderLinks(){const instagram=safeUrl(content.instagramUrl),joining=safeUrl(content.joinUrl);
 document.querySelectorAll('[data-instagram]').forEach(a=>{if(instagram)a.href=instagram});
 if($('instagram-handle'))$('instagram-handle').textContent=content.instagramHandle;
 const join=$('join-button');if(join){join.href=joining||instagram;join.target='_blank';join.rel='noopener';join.textContent=joining?(content.joinLabel||'Join MIT')+' ↗':'Message us on Instagram ↗'}
 $('social-links')?.replaceChildren();if(joining&&instagram){const a=document.createElement('a');a.className='btn btn--ghost';a.href=instagram;a.target='_blank';a.rel='noopener';a.textContent='Message us on Instagram ↗';$('social-links').append(a)}}
 renderLinks();
 let copyTimer=0;
 $('copy-handle')?.addEventListener('click',async()=>{const b=$('copy-handle'),handle=$('instagram-handle');try{await navigator.clipboard.writeText(content.instagramHandle);b.textContent='✓';$('copy-status').textContent='Copied';clearTimeout(copyTimer);copyTimer=setTimeout(()=>{b.textContent='⧉';$('copy-status').textContent=''},1600)}catch{const range=document.createRange();range.selectNodeContents(handle);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);$('copy-status').textContent='Select and copy the handle'}});
 function refreshCms(){
  projects=window.MIT_CMS?.collection('make',[...seedProjects,...seedExtras])||[...seedProjects,...seedExtras];
  content.projects=projects.filter(p=>!extraIds.has(p.match));content.extraProjects=projects.filter(p=>extraIds.has(p.match));
  crafts=[...new Set(projects.map(p=>p.label))];if(!crafts.includes(craft))craft='All';
  photos=window.MIT_CMS?.collection('photo',basePhotos)||basePhotos.slice();
  renderCrafts();renderProjects();renderMoments();renderLinks();
  const category=$('gallery-filters').querySelector('[aria-pressed="true"]')?.textContent||'All';
  $('gallery-filters').replaceChildren();['All',...new Set(photos.map(p=>p.category))].forEach(label=>{const b=document.createElement('button');b.type='button';b.className='chip gallery-filter';b.textContent=label;b.setAttribute('aria-pressed',String(label===category));b.addEventListener('click',()=>renderGallery(label));$('gallery-filters').append(b)});
  if($('gallery-dialog').open)renderGallery(category);
  window.MIT_CMS?.applyPage();
 }
 async function init(){try{basePhotos=await readJson('scripts/photos.json');refreshCms();$('open-gallery').disabled=false;window.MIT_CMS?.subscribe(refreshCms)}catch(error){$('project-grid').innerHTML='<p class="loading-message t-small">The photo album could not be loaded. Please refresh to try again.</p>';$('open-gallery').disabled=true;console.error(error)}}
 window.MIT_PAGE_READY=init();
})();
