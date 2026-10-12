'use strict';
// This controller knows school/UI state, but no renderer-specific types.
let schoolLocationMap=null, schoolMapPreview=null, schoolMapMatches=[], schoolMapQuery='', schoolMapSearchTimer;
let schoolMapBackground=schoolMapProviders.defaultBackground;
const locatedSchool=s=>Number.isFinite(s?.lat)&&Number.isFinite(s?.lon)&&Math.abs(s.lat)<=90&&Math.abs(s.lon)<=180;
$('#school-map-background').innerHTML=schoolMapBackgroundChoices().map(({key,label})=>`<option value="${esc(key)}">${esc(label)}</option>`).join('');
$('#school-map-background').value=schoolMapBackground;
$('#school-map-background').onchange=e=>{schoolMapBackground=e.target.value;schoolLocationMap?.adapter?.setBackground(schoolMapBackground)};
$('#school-map-recenter').onclick=()=>{
  const adapter=schoolLocationMap?.adapter;if(!adapter)return;
  if($('#school-chooser').open){adapter.highlight(null);schoolMapPreview=null;paintSchoolMapPreview();adapter.fit(schoolMapMatches)}
  else adapter.focus(schoolInfo(state.school));
};
function clearSchoolLocation(){
  clearTimeout(schoolMapSearchTimer);
  if(schoolLocationMap){clearTimeout(schoolLocationMap.timeout);schoolLocationMap.abort.abort();schoolLocationMap.adapter?.destroy();schoolLocationMap=null;}
  schoolMapPreview=null;
  $('#school-location').hidden=true;$('#school-map').hidden=true;$('#school-map').replaceChildren();
  $('#school-map-status').textContent='';$('#school-map-preview').textContent='';$('#school-map-recenter').disabled=true;
  $('#school-heading-layout').classList.remove('has-school-map');document.body.classList.remove('school-searching');
  delete $('#school-map').dataset.ready;
  if(typeof updateSchoolKeyboardLayout==='function')updateSchoolKeyboardLayout();
}
function paintSchoolMapPreview(){
  const school=schoolMapPreview||(!$('#school-chooser').open?schoolInfo(state.school):null);
  const label=$('#school-map-preview'),link=$('#school-map-link');
  label.textContent=school?`${school.name} · ${school.city||'Ontario'}${locatedSchool(school)?'':' · Location unavailable'}`:'';
  link.hidden=!school;
  if(school)link.href=`https://www.google.com/maps/search/?api=1&query=${locatedSchool(school)?`${school.lat},${school.lon}`:encodeURIComponent([school.name,school.city,'Ontario'].filter(Boolean).join(' '))}`;
  if(schoolLocationMap?.ready)$('#school-map-status').textContent=schoolLocationMap.message||(school&&!locatedSchool(school)?'School location unavailable.':'');
}
function previewSchoolLocation(school,{move=true}={}){
  if(!school||state.view!=='myschool')return;
  const changed=schoolMapPreview?.id!==school.id;schoolMapPreview=school;
  clearTimeout(schoolMapSearchTimer);
  schoolLocationMap?.adapter?.highlight(locatedSchool(school)?school:null);
  if(move&&changed)schoolLocationMap?.adapter?.focus(school);
  paintSchoolMapPreview();
}
function updateSchoolMapMatches(matches,query){
  const changed=query!==schoolMapQuery;schoolMapMatches=matches;schoolMapQuery=query;
  if(state.view!=='myschool')return;
  syncSchoolDiscovery();
  if(!$('#school-chooser').open)return;
  schoolLocationMap?.adapter?.setSchools(matches);
  if(!changed)return;
  schoolMapPreview=null;schoolLocationMap?.adapter?.highlight(null);paintSchoolMapPreview();
  clearTimeout(schoolMapSearchTimer);
  schoolMapSearchTimer=setTimeout(()=>{
    if(state.view!=='myschool'||!$('#school-chooser').open||schoolMapPreview)return;
    const exact=matches.find(s=>normalizeSchoolSearch(s.name)===normalizeSchoolSearch(query));
    if(query&&(exact||matches.length===1))previewSchoolLocation(exact||matches[0]);
    else if(query.length>=2)schoolLocationMap?.adapter?.fit(matches);
  },250);
}
function renderSchoolLocation(meta){
  if(state.view!=='myschool')return;
  syncSchoolDiscovery();
  if(!$('#school-chooser').open)previewSchoolLocation(meta);
}
function syncSchoolDiscovery(){
  const searching=state.view==='myschool'&&$('#school-chooser').open;
  document.body.classList.toggle('school-searching',searching);
  if(typeof updateSchoolKeyboardLayout==='function')updateSchoolKeyboardLayout();
  if(state.view!=='myschool')return;
  $('#school-location').hidden=false;$('#school-heading-layout').classList.add('has-school-map');
  $('#school-map-recenter').textContent=searching?'Show matches':'Recenter';
  $('#school-location-title').textContent=searching?'Explore schools':'School location';
  if(!schoolLocationMap)startSchoolLocationMap();
  const selected=schoolInfo(state.school);
  if(!searching&&selected&&schoolMapPreview?.id!==selected.id)previewSchoolLocation(selected);
  schoolLocationMap?.adapter?.setSchools(searching?schoolMapMatches:selected?[selected]:[]);
  schoolLocationMap?.adapter?.resize();
  paintSchoolMapPreview();
}
async function startSchoolLocationMap(){
  const container=$('#school-map'),status=$('#school-map-status');
  const instance={adapter:null,ready:false,failed:false,timeout:null,abort:new AbortController()};schoolLocationMap=instance;
  const current=()=>schoolLocationMap===instance&&!instance.failed&&state.view==='myschool';
  const fail=()=>{
    if(!current())return;instance.failed=true;instance.abort.abort();clearTimeout(instance.timeout);instance.adapter?.destroy();instance.adapter=null;
    container.hidden=true;container.replaceChildren();delete container.dataset.ready;
    $('#school-map-recenter').disabled=true;
    status.textContent='The map could not be loaded. You can still search, choose and save schools.';
    const retry=document.createElement('button');retry.type='button';retry.className='text-button';retry.textContent='Try map again';
    retry.onclick=()=>{schoolLocationMap=null;startSchoolLocationMap()};status.append(' ',retry);
  };
  container.hidden=false;status.textContent='Loading map…';instance.timeout=setTimeout(fail,15000);
  try{
    const adapter=await createSchoolMap({container,background:schoolMapBackground,signal:instance.abort.signal,
      onSchoolPreview:previewSchoolLocation,onSchoolChoose:school=>selectMySchool(school.id),
      onStatus:message=>{
        if(!current())return;instance.message=message;
        if(!message){instance.ready=true;clearTimeout(instance.timeout);container.dataset.ready='true';$('#school-map-recenter').disabled=false;paintSchoolMapPreview()}
        else status.textContent=message;
      }});
    if(!current()){adapter.destroy();return}
    instance.adapter=adapter;
    const searching=$('#school-chooser').open,selected=schoolMapPreview||(!searching?schoolInfo(state.school):null);
    adapter.setSchools(searching?schoolMapMatches:selected?[selected]:[]);adapter.highlight(locatedSchool(selected)?selected:null);
    if(selected)adapter.focus(selected,{animate:false});
    else if(schoolMapQuery.length>=2)adapter.fit(schoolMapMatches,{animate:false});
  }catch{fail()}
}
