/* Saved Schools: browser-local shortlist with a temporary comparison screen. */
'use strict';
(async function(){
  const KEY='eqao-saved-schools-v1';
  const icon='<svg class="bookmark-icon" viewBox="0 0 20 24" aria-hidden="true"><path d="M4 3h12v18l-6-4-6 4z"/></svg>';
  const trash='<svg viewBox="0 0 20 24" aria-hidden="true"><path d="M3 6h14M7 6V3h6v3M5 6l1 15h8l1-15M8 10v7m4-7v7"/></svg>';
  let model,undoItem,toastTimer,storageOkay=true,launchFocus;
  const dialog=document.createElement('dialog');dialog.id='saved-dialog';dialog.setAttribute('aria-labelledby','saved-title');
  dialog.innerHTML=`<div class="saved-layout"><header class="saved-head"><p class="eyebrow">YOUR SHORTLIST</p><div class="saved-title-line"><h2 id="saved-title">Saved schools</h2><button class="saved-close" aria-label="Close saved schools" autofocus>×</button></div><p class="saved-meta">Keep schools handy. Choose up to five to compare.</p></header><div class="saved-tools"><div class="saved-search"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="m12 12 5 5"/></svg><input type="search" id="saved-search" aria-label="Search saved schools" placeholder="Search saved schools…"></div><div class="saved-tools-line"><span id="saved-total"></span><button id="saved-clear-selection">Clear selection</button></div></div><div class="saved-body" id="saved-body"></div><footer class="saved-footer"><p class="saved-feedback" id="saved-feedback" role="status"></p><div class="saved-selection-line"><strong id="saved-selection-count" aria-live="polite"></strong><span>Choose 2–5 schools</span></div><button class="button" id="saved-compare">Compare selected <span aria-hidden="true">→</span></button><p class="saved-helper" id="saved-help">Saved schools stay in this browser on this device. They don’t sync across devices. No account needed.</p></footer></div>`;
  document.body.append(dialog);
  const announcement=document.createElement('div');announcement.className='saved-toast';announcement.hidden=true;announcement.setAttribute('role','status');document.body.append(announcement);
  const launch=document.createElement('button');launch.className='button secondary saved-launch';launch.id='saved-launch';launch.setAttribute('aria-haspopup','dialog');launch.setAttribute('aria-controls','saved-dialog');document.querySelector('.topbar').append(launch);
  const title=document.querySelector('#page-title');const titleWrap=document.createElement('div');titleWrap.className='title-with-bookmark';title.before(titleWrap);titleWrap.append(title);
  const headingBookmark=document.createElement('button');headingBookmark.id='heading-bookmark';headingBookmark.className='bookmark-control';headingBookmark.innerHTML=icon;titleWrap.append(headingBookmark);
  launch.disabled=true;launch.innerHTML=`${icon} Saved`;
  try{await getSchoolIndex();}catch{launch.disabled=false;launch.onclick=()=>toast('School list unavailable. Reload to try again.');return;}
  let saved;try{saved=JSON.parse(localStorage.getItem(KEY));}catch{storageOkay=false;}
  model=new SavedSchools(Array.isArray(saved?.ids)?saved.ids.filter(id=>schoolInfo(id)):[],Array.isArray(saved?.selected)?saved.selected:[]);launch.disabled=false;
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(model.snapshot()));}catch{storageOkay=false;}paint();}
  function notify(message,undo=false){(dialog.open?dialog:document.body).append(announcement);clearTimeout(toastTimer);announcement.innerHTML=`<span>${esc(message)}</span>${undo?'<button id="saved-undo">Undo</button>':''}`;announcement.hidden=false;toastTimer=setTimeout(()=>{announcement.hidden=true},6000);}
  function bookmarkHTML(id){const s=schoolInfo(id);if(!s)return '';const on=model.ids.includes(id);return `<button class="bookmark-control" data-bookmark="${esc(id)}" aria-pressed="${on}" aria-label="${on?'Unsave':'Save'} ${esc(s?.name||'school')}">${icon}</button>`;}
  function decorate(){
    headingBookmark.hidden=state.view!=='myschool'||!schoolInfo(state.school);
    if(!headingBookmark.hidden){const on=model.ids.includes(state.school);headingBookmark.dataset.bookmark=state.school;headingBookmark.setAttribute('aria-pressed',on);headingBookmark.setAttribute('aria-label',`${on?'Unsave':'Save'} ${schoolInfo(state.school).name}`);}
    document.querySelectorAll('[data-comparison-row]').forEach(row=>{const strong=row.querySelector('.name-cell > strong');if(!strong)return;const wrap=document.createElement('div');wrap.className='name-with-bookmark';strong.before(wrap);wrap.append(strong);wrap.insertAdjacentHTML('beforeend',bookmarkHTML(row.dataset.comparisonRow));});
    document.querySelectorAll('.name-cell > [data-school]').forEach(name=>{const wrap=document.createElement('div');wrap.className='name-with-bookmark';name.before(wrap);wrap.append(name);name.style.flex='1';wrap.insertAdjacentHTML('beforeend',bookmarkHTML(name.dataset.school));});
    document.querySelectorAll('.ranking-head').forEach(row=>{const name=row.querySelector('[data-trend-open]');if(name&&!row.querySelector('[data-bookmark]')){const wrap=document.createElement('div');wrap.className='name-with-bookmark';name.before(wrap);wrap.append(name);name.style.flex='1';wrap.insertAdjacentHTML('beforeend',bookmarkHTML(name.dataset.trendOpen));}});
    document.querySelectorAll('[data-bookmark]').forEach(b=>{const on=model.ids.includes(b.dataset.bookmark);b.setAttribute('aria-pressed',on);b.setAttribute('aria-label',`${on?'Unsave':'Save'} ${schoolInfo(b.dataset.bookmark)?.name||'school'}`);});
  }
  function paint(){
    launch.innerHTML=`${icon} Saved <span aria-label="${model.ids.length} saved schools">${model.ids.length}</span>`;
    document.querySelector('#saved-help').textContent=storageOkay?'Saved schools stay in this browser on this device. They don’t sync across devices. No account needed.':'Browser storage is unavailable. Saved schools will stay for this visit only. No account needed.';
    const query=document.querySelector('#saved-search').value.trim().toLowerCase(),matches=model.ids.filter(id=>{const s=schoolInfo(id);return `${s.name} ${s.city} ${board(s.board)?.name||''}`.toLowerCase().includes(query)});
    document.querySelector('.saved-tools').hidden=model.ids.length===0;
    document.querySelector('#saved-total').textContent=query?`${matches.length} of ${model.ids.length} saved schools`:`${model.ids.length} saved ${model.ids.length===1?'school':'schools'}`;
    document.querySelector('#saved-clear-selection').hidden=!model.selected.length;
    document.querySelector('#saved-selection-count').textContent=`${model.selected.length} of 5 selected`;
    const compare=document.querySelector('#saved-compare');compare.disabled=model.selected.length<2;
    compare.innerHTML=`Compare selected${model.selected.length?` (${model.selected.length})`:''} <span aria-hidden="true">→</span>`;
    const body=document.querySelector('#saved-body'),scroll=body.scrollTop,focused=document.activeElement?.dataset.savedSelect||document.activeElement?.dataset.savedRemove;
    body.innerHTML=model.ids.length===0?`<div class="saved-empty"><span class="bookmark-control">${icon}</span><h3>A place for your shortlist.</h3><p>Tap the bookmark beside a school’s name to save it here. Come back whenever you want to compare.</p><button class="button secondary" id="saved-find">Find schools</button></div>`:matches.length?`<ul class="saved-list">${matches.map(id=>{const s=schoolInfo(id),checked=model.selected.includes(id);return `<li class="saved-row ${checked?'checked':''}"><label class="saved-row-label"><input type="checkbox" data-saved-select="${id}" ${checked?'checked':''} aria-label="Select ${esc(s.name)} for comparison"><span><strong>${esc(s.name)}</strong><small>${esc(s.city||'Ontario')} · ${esc(board(s.board)?.type||'School')} · ${languageLabel(s.language)}</small></span></label><button class="saved-remove" data-saved-remove="${id}" aria-label="Remove ${esc(s.name)} from saved schools" title="Remove from saved schools">${trash}</button></li>`}).join('')}</ul>`:`<p class="saved-no-matches">No saved schools match “${esc(query)}”. Try another name or city.</p>`;
    body.scrollTop=scroll;
    if(focused&&dialog.open)body.querySelector(`[data-saved-select="${focused}"]`)?.focus({preventScroll:true});
    decorate();
  }
  function open(){launchFocus=document.activeElement;document.querySelector('#saved-feedback').textContent='';document.querySelector('#saved-search').value='';paint();if(!dialog.open)dialog.showModal();if(!announcement.hidden)dialog.append(announcement);launch.setAttribute('aria-expanded','true');}
  function close(){dialog.close();}
  launch.onclick=open;
  dialog.querySelector('.saved-close').onclick=close;
  dialog.addEventListener('close',()=>{document.body.append(announcement);launch.setAttribute('aria-expanded','false');if(launchFocus?.isConnected)launchFocus.focus({preventScroll:true});else launch.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  dialog.addEventListener('change',e=>{const id=e.target.dataset.savedSelect;if(!id)return;const result=model.toggle(id);document.querySelector('#saved-feedback').textContent=result==='limit'?'You can compare up to five schools. Deselect one to choose another.':'';persist();});
  dialog.addEventListener('click',e=>{const remove=e.target.closest('[data-saved-remove]');if(remove){const id=remove.dataset.savedRemove;undoItem=model.remove(id);document.querySelector('#saved-feedback').textContent='';persist();notify(`${schoolInfo(id).name} removed.`,true);(model.ids.length?document.querySelector('#saved-search'):document.querySelector('#saved-find')).focus({preventScroll:true});}if(e.target.closest('#saved-find')){close();setView('schools');$('#search')?.focus();}});
  announcement.onclick=e=>{if(e.target.closest('#saved-undo')&&undoItem){if(model.undo(undoItem)){persist();notify(`${schoolInfo(undoItem.id).name} restored.`)}else notify('Your saved list is full. Remove a school before restoring.');undoItem=null;}};
  document.querySelector('#saved-search').oninput=paint;
  document.querySelector('#saved-clear-selection').onclick=()=>{model.selected=[];document.querySelector('#saved-feedback').textContent='';persist();};
  document.addEventListener('click',e=>{const b=e.target.closest('[data-bookmark]');if(!b)return;e.preventDefault();e.stopPropagation();const id=b.dataset.bookmark;if(model.ids.includes(id)){undoItem=model.remove(id);persist();notify(`${schoolInfo(id).name} removed.`,true);}else{const result=model.save(id);persist();notify(result==='full'?'You have 100 saved schools. Remove one to save another.':`${schoolInfo(id).name} saved.`)}},true);
  document.querySelector('#saved-compare').onclick=async()=>{const group=model.compare();if(!group)return;close();await window.savedCompareScreen.enter(group.schools);};
  const observer=new MutationObserver(()=>decorate());observer.observe(document.querySelector('#content'),{childList:true,subtree:true});observer.observe(title,{childList:true});
  window.addEventListener('storage',e=>{if(e.key!==KEY)return;try{const next=JSON.parse(e.newValue)||{ids:[],selected:[]};model=new SavedSchools(next.ids.filter(id=>schoolInfo(id)),next.selected);paint();}catch{}});
  persist();
  window.savedSchools={get model(){return model},open,close};
})();
