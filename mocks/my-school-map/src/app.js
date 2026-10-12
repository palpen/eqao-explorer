'use strict';
(() => {
  const root=document.getElementById('school-map-preview'),byId=id=>document.getElementById(id);
  const schools=JSON.parse(byId('school-data').textContent),schoolById=new Map(schools.map(s=>[s.id,s]));
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const hasLocation=s=>Number.isFinite(s?.lat)&&Number.isFinite(s?.lon);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bookmark='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3.5h10v13l-5-3-5 3z"/></svg>';
  const searchable=new Map(schools.map(s=>[s.id,normalize([s.name,s.city,s.boardName,s.id].join(' '))]));
  const featured=['Malvern Jr PS','A A Wright PS','Adelaide Hoodless PS'].map(name=>schools.find(s=>s.name===name)).filter(Boolean);
  for(const city of ['Ottawa','London','Thunder Bay','Sudbury','Windsor','Kingston','Mississauga','Toronto']){
    const school=schools.find(s=>s.city===city&&hasLocation(s)&&!featured.includes(s));if(school)featured.push(school);
  }
  let matches=schools,visible=featured,limit=12,active=-1,preview=null,chosen=null,grade=3,view='myschool',adapter=null,background=schoolMapProviders.defaultBackground;
  let inputTimer,hoverTimer,mapTimer,statusTimer,initializing=false,generation=0,lastRemoval=null,keyboardPreview=false;
  const saved=previewSavedSchools;saved.load();
  byId('background').innerHTML=schoolMapBackgroundChoices().map(choice=>`<option value="${escape(choice.key)}">${escape(choice.label)}</option>`).join('');byId('background').value=background;
  function findMatches(query) {
    const q=normalize(query),tokens=q.split(' ').filter(Boolean);if(!q)return schools;
    const isCity=schools.some(s=>normalize(s.city)===q);
    const score=s=>{const n=normalize(s.name);return n===q?0:isCity&&normalize(s.city)===q?1:n.startsWith(q)?2:n.includes(q)?3:4;};
    return schools.filter(s=>tokens.every(token=>searchable.get(s.id).includes(token))).sort((a,b)=>score(a)-score(b)||a.name.localeCompare(b.name)||(a.city||'').localeCompare(b.city||''));
  }
  function schoolRow(s,{savedList=false}={}) {
    const isSaved=saved.has(s.id),nameId=`${savedList?'saved-result':'result'}-${s.id}`,label=savedList?'Remove':isSaved?'Saved':'Save';
    return `<div class="school-option${preview?.id===s.id?' is-preview':''}${chosen?.id===s.id?' is-chosen':''}" role="row" aria-selected="${preview?.id===s.id}" data-school-id="${s.id}"><div role="gridcell" id="${nameId}" class="school-name-cell"><button type="button" class="school-choice" data-choose-school="${s.id}" aria-label="Choose ${escape(s.name)} in ${escape(s.city||'Ontario')}"><strong>${escape(s.name)}</strong><small>${escape(s.city||'Ontario')} · ${s.language==='fr'?'French':'English'}</small><small>${escape(s.boardName)}${!hasLocation(s)?' · <span class="location-missing">Location unavailable</span>':''}${s.latestYear<2026?` · Last reported ${s.latestYear-1}–${String(s.latestYear).slice(-2)}`:''}</small></button></div><div role="gridcell"><button type="button" class="school-save${isSaved?' is-saved':''}" data-save-school="${s.id}" data-saved-list="${savedList}" aria-pressed="${isSaved}" aria-label="${isSaved?'Remove':'Save'} ${escape(s.name)}${isSaved?' from':' to'} saved schools">${bookmark}<span>${label}</span></button></div></div>`;
  }
  function renderList() {
    const query=byId('search').value.trim();visible=query?matches.slice(0,limit):featured;
    byId('school-results').innerHTML=visible.map(s=>schoolRow(s)).join('');byId('empty-results').hidden=matches.length>0;byId('school-results').hidden=matches.length===0;
    byId('show-more').hidden=!query||visible.length>=matches.length;byId('show-more').textContent=`Show ${Math.min(12,matches.length-visible.length)} more schools`;
    byId('search').setAttribute('aria-expanded',String(visible.length>0));
    byId('match-count').textContent=query?`${matches.length.toLocaleString()} matching ${matches.length===1?'school':'schools'}${matches.length>visible.length?` · Showing ${visible.length}`:''}`:`${schools.length.toLocaleString()} schools across Ontario`;syncHighlight();
  }
  function syncHighlight() {
    root.querySelectorAll('[data-school-id]').forEach(el=>{const selected=el.dataset.schoolId===preview?.id;el.classList.toggle('is-preview',selected);el.classList.toggle('is-chosen',el.dataset.schoolId===chosen?.id);el.setAttribute('aria-selected',String(selected));});
    const cell=preview&&byId(`result-${preview.id}`);if(cell)byId('search').setAttribute('aria-activedescendant',cell.id);else byId('search').removeAttribute('aria-activedescendant');
    root.dataset.previewId=preview?.id||'';root.dataset.selectedId=chosen?.id||'';
  }
  function renderPreview() {
    byId('map-detail').hidden=!preview;if(!preview)return;
    byId('map-school-name').textContent=preview.name;byId('map-school-meta').textContent=[preview.city,preview.language==='fr'?'French-language':'English-language'].filter(Boolean).join(' · ');byId('map-school-location').hidden=hasLocation(preview);
    const selected=chosen?.id===preview.id;byId('map-detail-context').textContent=selected?'My school':'School preview';byId('choose-school').textContent=selected?'My school ✓':'Make this my school';byId('choose-school').disabled=selected;
  }
  function showPreview(school,{move=true}={}) {
    if(!school)return;clearTimeout(hoverTimer);preview=school;active=visible.findIndex(s=>s.id===school.id);syncHighlight();renderPreview();adapter?.highlight(school);if(move)adapter?.focus(school);
  }
  function renderResults() {
    byId('school-summary').hidden=!chosen||view!=='myschool';if(!chosen)return;
    byId('summary-name').textContent=chosen.name;byId('summary-meta').textContent=[chosen.city,chosen.boardName,chosen.language==='fr'?'French-language':'English-language'].filter(Boolean).join(' · ');
    const result=chosen.results[String(grade)];
    byId('results').innerHTML=['Reading','Writing','Mathematics'].map((name,i)=>`<div class="result"><h3>${name}</h3><div class="value">${escape(result?.raw?.[i]??'—')}</div><p>${result?Number.isFinite(result.participants?.[i])?`${result.participants[i].toLocaleString()} participants`:'Participant count unavailable':'No published result for this grade and year'}</p></div>`).join('');
    root.querySelectorAll('[data-grade]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.grade)===grade)));
  }
  function showView(next) {
    view=next;root.dataset.view=view;byId('page-title').textContent=view==='saved'?'Saved schools':'My school';byId('saved-school-panel').hidden=view!=='saved';root.querySelector('.search-map').hidden=view!=='myschool';
    for(const [id,name] of [['my-school-nav','myschool'],['saved-school-nav','saved']]){byId(id).classList.toggle('active',view===name);if(view===name)byId(id).setAttribute('aria-current','page');else byId(id).removeAttribute('aria-current');}
    renderResults();updateViewport();if(view==='myschool')requestAnimationFrame(()=>adapter?.resize());
  }
  function chooseSchool(school) {
    if(!school)return;clearTimeout(inputTimer);clearTimeout(hoverTimer);
    if(view==='saved'){byId('search').value=school.name;refreshSearch();clearTimeout(inputTimer);showView('myschool');}
    chosen=school;if(!school.results[String(grade)]&&school.results[grade===3?'6':'3'])grade=grade===3?6:3;showPreview(school);renderResults();
  }
  function refreshSearch() {
    clearTimeout(inputTimer);clearTimeout(hoverTimer);limit=12;active=-1;matches=findMatches(byId('search').value);preview=null;
    renderList();byId('school-results').scrollTop=0;renderPreview();adapter?.highlight(null);adapter?.setSchools(matches);
    const n=matches.filter(hasLocation).length;byId('map-caption').textContent=`${n.toLocaleString()} ${byId('search').value.trim()?'matching':'Ontario'} ${n===1?'school':'schools'} on the map`;byId('show-ontario').textContent=byId('search').value.trim()?'Show matches':'Show Ontario';
    inputTimer=setTimeout(()=>{if(matches.length===1)showPreview(matches[0]);else if(normalize(byId('search').value).length>=2||!byId('search').value.trim())adapter?.fit(matches);},250);
  }
  function renderSavedList() {
    const rows=saved.list().map(id=>schoolById.get(id)).filter(Boolean);byId('saved-count').textContent=String(rows.length);root.dataset.savedCount=String(rows.length);
    byId('saved-school-results').innerHTML=rows.map(s=>schoolRow(s,{savedList:true})).join('');byId('saved-empty').hidden=rows.length>0;byId('saved-school-results').hidden=rows.length===0;
    byId('saved-list-note').textContent=rows.length?`${rows.length} saved ${rows.length===1?'school':'schools'} · Saved in this browser`:'Saved in this browser';
    root.querySelectorAll('#school-results [data-save-school]').forEach(button=>{const s=schoolById.get(button.dataset.saveSchool),isSaved=saved.has(s.id);button.classList.toggle('is-saved',isSaved);button.setAttribute('aria-pressed',String(isSaved));button.setAttribute('aria-label',`${isSaved?'Remove':'Save'} ${s.name}${isSaved?' from':' to'} saved schools`);button.querySelector('span').textContent=isSaved?'Saved':'Save';});syncHighlight();
  }
  function announce(message,{undo=false}={}) {
    clearTimeout(statusTimer);byId('save-status').hidden=false;byId('save-status').querySelector('span').textContent=message;byId('undo-remove').hidden=!undo;statusTimer=setTimeout(()=>{byId('save-status').hidden=true;},undo?7000:2500);
  }
  function toggleSaved(id) {
    const school=schoolById.get(id);if(!school)return;
    if(saved.has(id)){lastRemoval={id,index:saved.remove(id)};renderSavedList();announce(`Removed ${school.name}.`,{undo:true});}
    else {const result=saved.add(id);if(result==='full'){announce('Your list has 100 schools. Remove one before adding another.');return;}lastRemoval=null;renderSavedList();announce(saved.storageAvailable()?`Saved ${school.name}.`:'Saved for this visit. Browser storage is unavailable.');}
  }
  function rowClick(event) {
    const saveButton=event.target.closest('[data-save-school]');if(saveButton){clearTimeout(hoverTimer);toggleSaved(saveButton.dataset.saveSchool);return;}
    const choice=event.target.closest('[data-choose-school]');if(choice)chooseSchool(schoolById.get(choice.dataset.chooseSchool));
  }
  for(const id of ['school-results','saved-school-results']){
    byId(id).addEventListener('click',rowClick);
    // Keep the input and native keyboard active when saving while typing.
    byId(id).addEventListener('pointerdown',event=>{if(event.target.closest('[data-save-school]')&&document.activeElement===byId('search'))event.preventDefault();});
  }
  byId('undo-remove').addEventListener('click',()=>{if(!lastRemoval)return;const item=lastRemoval;lastRemoval=null;saved.add(item.id,item.index);renderSavedList();announce(`Restored ${schoolById.get(item.id).name}.`);});
  window.addEventListener('storage',event=>{if(event.key===saved.key){saved.load();renderSavedList();}});
  const showMapStatus=message=>{byId('map-error').hidden=!message;byId('map-error').querySelector('span').textContent=message;};
  async function initializeMap() {
    if(initializing)return;initializing=true;const token=++generation;showMapStatus('');mapTimer=setTimeout(()=>showMapStatus('The map is taking longer to load. School search is available.'),15000);
    try {
      const next=await createSchoolMap({container:byId('map-view'),background,onSchoolPreview:showPreview,onSchoolChoose:chooseSchool,onStatus:message=>{if(token!==generation)return;if(!message)clearTimeout(mapTimer);showMapStatus(message);}});
      if(token!==generation){next.destroy();return;}adapter=next;adapter.setSchools(matches);adapter.highlight(preview);if(preview&&hasLocation(preview))adapter.focus(preview,{animate:false});else adapter.fit(matches,{animate:false});
    }catch{clearTimeout(mapTimer);showMapStatus('The street map could not load. You can still search and select your school.');byId('map-view').querySelector('.map-loading')?.remove();}
    finally{initializing=false;}
  }
  byId('search').addEventListener('input',refreshSearch);
  byId('search').addEventListener('keydown',event=>{
    if(event.isComposing)return;
    if(['ArrowDown','ArrowUp'].includes(event.key)&&visible.length){event.preventDefault();clearTimeout(inputTimer);active=event.key==='ArrowDown'?(active+1)%visible.length:(active<=0?visible.length:active)-1;showPreview(visible[active]);const list=byId('school-results'),row=byId(`result-${preview.id}`).closest('[role="row"]'),listBox=list.getBoundingClientRect(),rowBox=row.getBoundingClientRect();if(rowBox.top<listBox.top)list.scrollTop-=listBox.top-rowBox.top;else if(rowBox.bottom>listBox.bottom)list.scrollTop+=rowBox.bottom-listBox.bottom;}
    else if(event.key==='Enter'&&visible.length){event.preventDefault();chooseSchool(active>=0?visible[active]:visible[0]);}
    else if(event.key==='Escape'){event.preventDefault();clearTimeout(hoverTimer);clearTimeout(inputTimer);preview=null;active=-1;syncHighlight();renderPreview();adapter?.highlight(null);}
  });
  byId('school-results').addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const choice=event.target.closest('[data-choose-school]');if(!choice||choice.contains(event.relatedTarget))return;clearTimeout(hoverTimer);clearTimeout(inputTimer);hoverTimer=setTimeout(()=>showPreview(schoolById.get(choice.dataset.chooseSchool)),120);});
  byId('school-results').addEventListener('pointerleave',()=>clearTimeout(hoverTimer));
  root.querySelectorAll('[data-query]').forEach(button=>button.addEventListener('click',()=>{byId('search').value=button.dataset.query;refreshSearch();byId('search').focus();}));
  byId('choose-school').addEventListener('click',()=>{if(preview)chooseSchool(preview);});byId('show-more').addEventListener('click',()=>{limit+=12;renderList();});byId('show-ontario').addEventListener('click',()=>{clearTimeout(inputTimer);adapter?.fit(matches);});
  byId('background').addEventListener('change',event=>{background=event.target.value;adapter?.setBackground(background);});
  byId('retry-map').addEventListener('click',()=>{if(initializing)return;adapter?.destroy();adapter=null;byId('map-view').replaceChildren();initializeMap();});
  root.querySelectorAll('[data-grade]').forEach(button=>button.addEventListener('click',()=>{grade=Number(button.dataset.grade);renderResults();}));
  byId('my-school-nav').addEventListener('click',()=>showView('myschool'));byId('saved-school-nav').addEventListener('click',()=>showView('saved'));byId('saved-find-school').addEventListener('click',()=>{showView('myschool');byId('search').focus();});
  // Adapt to the native visual viewport; the phone preview exercises the same
  // compact layout by reducing its iframe height and sending keyboard state.
  let viewportBaseline=window.innerHeight;
  function updateViewport() {
    const viewport=window.visualViewport,height=viewport?.height||window.innerHeight,focused=document.activeElement===byId('search');
    if(!focused&&!keyboardPreview)viewportBaseline=Math.max(viewportBaseline,window.innerHeight);
    const open=window.matchMedia('(max-width:720px)').matches&&view==='myschool'&&(keyboardPreview||focused&&Math.max(viewportBaseline,window.innerHeight)-height>120);
    document.body.classList.toggle('keyboard-open',open);document.body.classList.toggle('short-keyboard',open&&height<300);root.style.setProperty('--visible-height',`${height}px`);root.style.setProperty('--visible-top',`${viewport?.offsetTop||0}px`);document.body.style.setProperty('--visible-top',`${viewport?.offsetTop||0}px`);root.dataset.keyboardOpen=String(open);requestAnimationFrame(()=>adapter?.resize());
  }
  function finishSearch() {keyboardPreview=false;byId('search').blur();updateViewport();if(window.parent!==window)window.parent.postMessage({type:'school-mock-keyboard-close'},location.origin);}
  byId('finish-search').addEventListener('click',finishSearch);byId('search').addEventListener('focus',updateViewport);byId('search').addEventListener('blur',()=>requestAnimationFrame(updateViewport));
  window.addEventListener('resize',updateViewport);window.visualViewport?.addEventListener('resize',updateViewport);window.visualViewport?.addEventListener('scroll',updateViewport);
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.parent||window.parent===window)return;
    if(event.data?.type==='school-mock-keyboard'){keyboardPreview=Boolean(event.data.open);if(keyboardPreview){showView('myschool');byId('search').focus({preventScroll:true});}updateViewport();}
    else if(event.data?.type==='school-mock-key'){const key=event.data.key;if(key==='Done'){finishSearch();return;}if(key==='Backspace')byId('search').value=byId('search').value.slice(0,-1);else if(typeof key==='string'&&/^[a-z ]$/.test(key))byId('search').value+=key;else return;refreshSearch();byId('search').focus({preventScroll:true});}
  });
  root.inspect=()=>({query:byId('search').value,matches:matches.length,previewId:preview?.id,selectedId:chosen?.id,savedIds:saved.list(),view,background,camera:adapter?.camera()});
  refreshSearch();renderSavedList();showView('myschool');initializeMap();
})();
