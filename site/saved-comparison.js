/* Temporary comparison context. My School remains in the original app state. */
'use strict';
(function(){
  const KEY='eqao-temporary-comparison-v1';
  const pane=document.createElement('main');pane.id='saved-comparison-main';pane.hidden=true;document.querySelector('.app-shell').append(pane);
  const palette=['#28679d','#49756b','#a5633d','#79658d','#9b8032'];
  let context=null,request=0,chart=null;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const labels={myschool:'My school',trends:'School trends',schools:'Find schools',boards:'Compare school boards',sources:'Sources',archive:'Historical archive'};
  function save(){try{sessionStorage.setItem(KEY,JSON.stringify(context));}catch{}}
  function writeRoute(push=false){
    if(!context)return;
    const p=new URLSearchParams(location.search);for(const key of ['view','school','grade','year','language'])p.set(key,state[key]);p.set('compare',state.comparisons.join(','));
    p.set('comparison',context.schools.join(','));p.set('comparisonSubject',context.subject);p.set('comparisonGrade',context.grade);p.set('comparisonYear',context.year);
    if(context.reference)p.set('reference',context.reference);else p.delete('reference');
    const snapshot={...(history.state||{}),eqao:clone(state),savedComparison:clone(context)};
    history[push?'pushState':'replaceState'](snapshot,'',`${location.pathname}?${p}`);save();
  }
  const originalRefresh=refreshUrl;
  refreshUrl=function(){originalRefresh();if(context)writeRoute();};
  function captureReturn(){return {state:clone(state),details:[...ui.schoolDetails],url:location.pathname+location.search,scroll:window.scrollY||0};}
  function setVisible(on){$('#main').hidden=on;pane.hidden=!on;document.body.classList.toggle('saved-compare-active',on);}
  async function enter(schools){
    await getSchoolIndex();const ids=[...new Set(schools)].filter(id=>schoolInfo(id)).slice(0,5);if(ids.length<2)return false;
    const previous=context?.returnContext||captureReturn();
    context={schools:ids,subject:0,grade:state.grade,year:state.year<2022?2026:state.year,reference:'',returnContext:previous};
    setVisible(true);writeRoute(true);await draw();pane.scrollIntoView({block:'start'});$('#saved-comparison-title')?.focus({preventScroll:true});return true;
  }
  function back({restore=true}={}){
    if(!context)return;const prior=context.returnContext;context=null;request++;chart=null;setVisible(false);
    try{sessionStorage.removeItem(KEY);}catch{}
    const cleanRoute=new URLSearchParams(location.search);for(const key of ['comparison','comparisonSubject','comparisonGrade','comparisonYear','reference'])cleanRoute.delete(key);history.replaceState({eqao:clone(state)},'',`${location.pathname}?${cleanRoute}`);
    if(restore){Object.assign(state,prior.state);ui.schoolDetails=new Set(prior.details||[]);pushNavigation=false;const restored=new URL(prior.url,location.origin);for(const key of ['comparison','comparisonSubject','comparisonGrade','comparisonYear','reference'])restored.searchParams.delete(key);history.replaceState({eqao:clone(state)},'',restored.pathname+restored.search);updateSchoolPicker();render();setTimeout(()=>{window.scrollTo({top:prior.scroll||0,behavior:'instant'});const target=!$('#choose-school').hidden?$('#choose-school'):$('#views .navitem.active');target?.focus({preventScroll:true});},50);}
  }
  async function draw(){
    if(!context)return;chart=null;const token=++request,c=context;
    pane.innerHTML=`<button class="text-button saved-comparison-back" id="saved-comparison-back">← Back to ${esc(labels[c.returnContext.state.view]||'explorer')}</button><div class="saved-compare-heading"><p class="eyebrow">TEMPORARY COMPARISON</p><h1 id="saved-comparison-title" tabindex="-1">Compare schools</h1><p>${c.schools.length} schools, side by side. My school stays ${schoolInfo(state.school)?`<strong>${esc(schoolInfo(state.school).name)}</strong>`:'unchanged'}.</p></div><div class="toolbar saved-comparison-filters"><div class="filter-field"><span class="field-label">Grade</span><div class="segmented">${[3,6].map(g=>`<button data-temp-grade="${g}" aria-pressed="${c.grade===g}" class="${c.grade===g?'selected':''}">Grade ${g}</button>`).join('')}</div></div><div class="filter-field"><label for="temp-comparison-year">School year</label><select id="temp-comparison-year">${[2026,2025,2024,2023,2022].map(y=>`<option value="${y}" ${c.year===y?'selected':''}>${yearLabel(y)}</option>`).join('')}</select></div><button class="button secondary" id="temp-change-schools">Change schools</button></div><div id="temp-comparison-results" role="status">Loading school results…</div>`;
    $('#saved-comparison-back').onclick=()=>back();
    $('#temp-change-schools').onclick=()=>window.savedSchools.open();
    pane.querySelectorAll('[data-temp-grade]').forEach(button=>button.onclick=()=>{c.grade=+button.dataset.tempGrade;writeRoute();draw();});
    $('#temp-comparison-year').onchange=e=>{c.year=+e.target.value;writeRoute();draw();};
    try{
      for(let attempt=0;!data&&attempt<100;attempt++)await new Promise(resolve=>setTimeout(resolve,50));
      if(!data)throw Error('Snapshot unavailable');
      const years=data.years.filter(y=>y<=c.year),all=await Promise.all(years.map(y=>getSchools(y,c.grade)));
      if(token!==request||c!==context)return;
      const records=c.schools.map(id=>({id,meta:schoolInfo(id),rows:all.map(rows=>rows.find(r=>r.id===id&&r.language===schoolInfo(id).language))}));
      const mixed=new Set(records.map(s=>s.meta.language)).size>1;
      $('#temp-comparison-results').removeAttribute('role');
      $('#temp-comparison-results').innerHTML=`<section class="temp-result-overview"><h2>Current results</h2><p class="small muted">Students meeting or exceeding the provincial standard · Grade ${c.grade} · ${yearLabel(c.year)}</p><div class="table-wrap"><table class="temp-results-table"><thead><tr><th>School</th>${subjects.map(s=>`<th class="numeric">${s}</th>`).join('')}</tr></thead><tbody>${records.map((s,i)=>`<tr><th scope="row"><span class="temp-school-label"><i class="swatch" style="background:${palette[i]}"></i>${esc(s.meta.name)}</span><small>${esc(s.meta.city||'Ontario')} · ${languageLabel(s.meta.language)}</small></th>${subjects.map((subject,j)=>`<td class="numeric">${rawLabel(s.rows.at(-1),j)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section><section class="temp-trends"><h2>How results change</h2><div class="segmented temp-subject-tabs" aria-label="Comparison subject">${subjects.map((s,i)=>`<button data-temp-subject="${i}" class="${c.subject===i?'selected':''}" aria-pressed="${c.subject===i}">${s}</button>`).join('')}</div><div id="temp-school-chart" class="chart"></div><div id="temp-school-readout" class="chart-readout" aria-live="polite">Focus or tap a point for its result and participant count.</div><details class="temp-chart-values"><summary>View chart values</summary><div id="temp-values" class="table-wrap"></div></details><p class="chart-caption">Each school has equal visual weight. All scales are 0–100%. Missing or suppressed results remain gaps. Each year describes a different group of students.${mixed?' English- and French-language schools use different assessments; compare results with care.':''}</p></section><details class="school-disclosure temp-differences" ${c.reference?'open':''}><summary>Compare differences <span>Choose a reference, if useful</span></summary><div class="disclosure-body"><label for="temp-reference">Reference school for differences</label><select id="temp-reference"><option value="">Choose a reference school…</option>${records.map(s=>`<option value="${s.id}" ${c.reference===s.id?'selected':''}>${esc(s.meta.name)}</option>`).join('')}</select><p class="small muted">This choice only changes the differences below. It does not change My school or the trend lines.</p><div id="temp-difference-results"></div></div></details>`;
      const paintChart=()=>{
        if(c!==context)return;
        drawTrend($('#temp-school-chart'),records.map((s,i)=>({name:s.meta.name,color:palette[i],values:s.rows.map(r=>r?.values?.[c.subject]??null),participants:s.rows.map(r=>r?.participants?.[c.subject]??null)})),years,$('#temp-school-readout'),{fixedScale:true,selectedYear:c.year});
        $('#temp-values').innerHTML=`<table><thead><tr><th>School year</th>${records.map(s=>`<th class="numeric">${esc(s.meta.name)}</th>`).join('')}</tr></thead><tbody>${years.map((y,j)=>`<tr><th>${yearLabel(y)}</th>${records.map(s=>`<td class="numeric">${rawLabel(s.rows[j],c.subject)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      };
      const paintDifferences=()=>{
        const ref=records.find(s=>s.id===c.reference);
        $('#temp-difference-results').innerHTML=ref?`<p class="small">Difference from ${esc(ref.meta.name)} · percentage points · ${yearLabel(c.year)}</p><div class="table-wrap"><table><thead><tr><th>School</th>${subjects.map(s=>`<th class="numeric">${s}</th>`).join('')}</tr></thead><tbody>${records.map(s=>`<tr><th>${esc(s.meta.name)}${s.id===ref.id?' <span class="small muted">· Reference</span>':''}</th>${subjects.map((subject,i)=>`<td class="numeric">${delta(difference(s.rows.at(-1)?.values?.[i],ref.rows.at(-1)?.values?.[i]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="small muted">Choose a school to see percentage-point differences. No reference is needed for the charts above.</p>';
      };
      chart=paintChart;paintChart();paintDifferences();
      pane.querySelectorAll('[data-temp-subject]').forEach(button=>button.onclick=()=>{c.subject=+button.dataset.tempSubject;pane.querySelectorAll('[data-temp-subject]').forEach(b=>{const on=+b.dataset.tempSubject===c.subject;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on);});writeRoute();paintChart();});
      $('#temp-reference').onchange=e=>{c.reference=c.schools.includes(e.target.value)?e.target.value:'';writeRoute();paintDifferences();};
    }catch{if(token!==request)return;$('#temp-comparison-results').innerHTML='<p class="error">School results could not be loaded. <button class="button secondary" id="temp-comparison-retry">Try again</button></p>';$('#temp-comparison-retry').onclick=draw;}
  }
  async function restoreFromURL(){
    const p=new URLSearchParams(location.search),raw=p.get('comparison');if(!raw){if(context)back({restore:false});return;}
    await getSchoolIndex();const ids=[...new Set(raw.split(','))].filter(id=>schoolInfo(id)).slice(0,5);if(ids.length<2){back({restore:false});return;}
    let stored;try{stored=JSON.parse(sessionStorage.getItem(KEY));}catch{}
    const prior=stored?.returnContext?.state&&stored.returnContext.state.school===state.school&&stored.returnContext.state.view===state.view?stored.returnContext:captureReturn();
    context={schools:ids,subject:[0,1,2].includes(+p.get('comparisonSubject'))?+p.get('comparisonSubject'):0,grade:[3,6].includes(+p.get('comparisonGrade'))?+p.get('comparisonGrade'):state.grade,year:[2022,2023,2024,2025,2026].includes(+p.get('comparisonYear'))?+p.get('comparisonYear'):2026,reference:ids.includes(p.get('reference'))?p.get('reference'):'',returnContext:prior};
    setVisible(true);writeRoute();await draw();
  }
  window.addEventListener('popstate',restoreFromURL);
  window.addEventListener('resize',()=>{if(context)chart?.();});
  document.addEventListener('click',event=>{if(context&&event.target.closest?.('[data-view], .brand'))back({restore:false});},true);
  window.savedCompareScreen={enter,back,restoreFromURL,get context(){return context}};
  window.savedCompareReady=restoreFromURL();
})();
