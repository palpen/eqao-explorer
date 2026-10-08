'use strict';

// School selections persist locally. Publisher percentages always remain the benchmarks.
let schoolIndex=[], schoolIndexRequest, homeContext;
let pickerMatches=[], pickerActive=-1, pickerDismissed=false, pickerLoading=true, pickerLoadError=false;
const peerColors=['#4e8c93','#b18c38','#a75b7b','#617eb6'];
const languageLabel=l=>l==='fr'?'French-language':'English-language';
const schoolInfo=id=>schoolIndex.find(s=>s.id===id);
const provincial=(language,year,grade)=>data.province.find(r=>r.language===language&&r.year===year&&r.grade===grade);
const schoolBoardResult=(r,year,grade)=>r?data.results.find(b=>b.id===r.board&&b.language===r.language&&b.year===year&&b.grade===grade):undefined;
const schoolValue=(r,i)=>r?.values?.[i]??null;
const schoolStatus=(r,i)=>r?rawLabel(r,i):'No result';

async function getSchoolIndex(){
  if(!schoolIndexRequest){
    pickerLoading=true;pickerLoadError=false;
    schoolIndexRequest=fetch('data/schools-index.json').then(r=>{if(!r.ok)throw Error('School list unavailable');return r.json()}).then(rows=>{schoolIndex=rows;pickerLoading=false;return rows}).catch(e=>{schoolIndexRequest=null;pickerLoading=false;pickerLoadError=true;throw e});
  }
  return schoolIndexRequest;
}
function updateSchoolPicker(){
  const q=$('#school-picker-search').value.trim().toLocaleLowerCase();
  const matches=q?schoolIndex.filter(s=>`${s.name} ${s.city} ${s.id} ${board(s.board)?.name||''}`.toLocaleLowerCase().includes(q)):[];
  pickerMatches=matches.slice(0,8);pickerActive=-1;pickerDismissed=false;
  $('#school-picker-results').innerHTML=pickerMatches.map(s=>`<button type="button" class="school-option" id="school-option-${s.id}" role="option" aria-selected="false" tabindex="-1" data-pick-school="${s.id}"><strong>${esc(s.name)}</strong><small>${esc([s.city,board(s.board)?.name,languageLabel(s.language)].filter(Boolean).join(' · '))}${s.latestYear<2026?` · last reported ${yearLabel(s.latestYear)}`:''}</small></button>`).join('');
  if(pickerLoading)$('#picker-count').textContent='Loading schools…';
  else if(pickerLoadError)$('#picker-count').innerHTML='Schools could not be loaded. <button class="text-button" id="retry-school-picker">Try again</button>';
  else $('#picker-count').textContent=q?matches.length?`${matches.length>8?`Showing 8 of ${number(matches.length)} matches. Keep typing to narrow the list.`:`${matches.length} matching ${matches.length===1?'school':'schools'}.`} Select a school to open its dashboard.`:'No schools found. Try another name, city, board or school number.':`Search ${number(schoolIndex.length)} schools. Your choice is saved in this browser.`;
  updatePickerActive();
  const s=schoolInfo(state.school);
  $('#selected-school-name').textContent=s?s.name:'Explore Ontario schools';
  $('#clear-school').hidden=!s;
  updateSchoolChooserLabel();
}
function updateSchoolChooserLabel(){
  $('#school-change-label').textContent=$('#school-chooser').open?'Close search':schoolInfo(state.school)?'Change school':'Choose school';
}
function updatePickerActive(){
  const input=$('#school-picker-search'),shown=pickerMatches.length>0&&!pickerDismissed;
  $('#school-picker-results').hidden=!shown;input.setAttribute('aria-expanded',String(shown));
  if(shown&&pickerActive>=0)input.setAttribute('aria-activedescendant',`school-option-${pickerMatches[pickerActive].id}`);
  else input.removeAttribute('aria-activedescendant');
  $$('#school-picker-results [role="option"]').forEach((el,i)=>{const active=i===pickerActive;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active))});
  if(shown&&pickerActive>=0)$(`#school-option-${pickerMatches[pickerActive].id}`).scrollIntoView({block:'nearest'});
}
async function selectMySchool(id){
  await getSchoolIndex();const s=schoolInfo(id);if(!s)return;
  pushNavigation=state.school!==id||state.view!=='myschool';
  if(state.school!==id){state.comparisons=[];state.expanded=null;}
  state.school=id;state.language=s.language;state.view='myschool';
  if(state.year<2022)state.year=2026;
  $('#language').value=s.language;$('#school-chooser').open=false;
  $('#school-picker-search').value='';updateSchoolPicker();render();$('#chosen-school-label').focus();
}
$('#clear-school').onclick=()=>{
  pushNavigation=true;
  state.school='';state.comparisons=[];state.expanded=null;state.view='myschool';
  if(state.year<2022)state.year=2026;
  $('#school-chooser').open=false;$('#school-picker-search').value='';
  updateSchoolPicker();render();$('#chosen-school-label').focus();
  toast('School selection cleared.');
};
$('#school-picker-search').oninput=updateSchoolPicker;
$('#school-picker-search').onkeydown=e=>{
  if(e.isComposing)return;
  if((e.key==='ArrowDown'||e.key==='ArrowUp')&&pickerMatches.length){
    e.preventDefault();pickerDismissed=false;
    pickerActive=e.key==='ArrowDown'?(pickerActive+1)%pickerMatches.length:(pickerActive<=0?pickerMatches.length:pickerActive)-1;
    updatePickerActive();
  }else if(e.key==='Enter'&&pickerMatches.length&&!pickerDismissed){e.preventDefault();selectMySchool(pickerMatches[Math.max(0,pickerActive)].id)}
  else if(e.key==='Escape'&&!pickerDismissed){e.preventDefault();pickerDismissed=true;pickerActive=-1;updatePickerActive()}
};
$('#school-picker-results').onclick=e=>{const b=e.target.closest('[data-pick-school]');if(b)selectMySchool(b.dataset.pickSchool)};
$('#picker-count').onclick=e=>{if(e.target.closest('#retry-school-picker')){const request=getSchoolIndex();updateSchoolPicker();request.then(updateSchoolPicker).catch(updateSchoolPicker)}};
$('#school-chooser').addEventListener('toggle',()=>{
  updateSchoolChooserLabel();
  if(!$('#school-chooser').open){pickerDismissed=true;pickerActive=-1;updatePickerActive()}
  else{pickerDismissed=false;updatePickerActive();if(document.activeElement===$('#chosen-school-label'))$('#school-picker-search').focus()}
});
$('#home-grades').onclick=e=>{const b=e.target.closest('[data-home-grade]');if(b)setGrade(+b.dataset.homeGrade)};
$('#home-year').onchange=e=>{state.year=+e.target.value;render()};
getSchoolIndex().then(updateSchoolPicker).catch(updateSchoolPicker);

function distanceKm(a,b){
  if(![a?.lat,a?.lon,b?.lat,b?.lon].every(Number.isFinite))return null;
  const rad=Math.PI/180,dp=(b.lat-a.lat)*rad,dl=(b.lon-a.lon)*rad;
  const h=Math.sin(dp/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dl/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function schoolSummary(rows,years,i){
  const values=rows.map(r=>schoolValue(r,i)),last=values.length-1;
  const start=values.findIndex((v,j)=>j<last&&Number.isFinite(v));
  const recent=values.slice(-3);
  return {values,current:values[last]??null,annual:difference(values[last],values[last-1]),
    total:start<0?null:difference(values[last],values[start]),startYear:start<0?null:years[start],
    direction:recent.length===3&&recent.every(Number.isFinite)?recent[0]>recent[1]&&recent[1]>recent[2]?'declining':recent[0]<recent[1]&&recent[1]<recent[2]?'improving':recent.every(v=>v===recent[0])?'unchanged':'mixed':'unknown'};
}
function relativeSummary(rows,benchmark,years,i){
  const gaps=rows.map((r,j)=>difference(schoolValue(r,i),schoolValue(benchmark[j],i)));
  const last=gaps.length-1,start=gaps.findIndex((v,j)=>j<last&&Number.isFinite(v));
  return {gap:gaps[last]??null,annual:difference(gaps[last],gaps[last-1]),
    total:start<0?null:difference(gaps[last],gaps[start]),startYear:start<0?null:years[start],gaps};
}
function relativeWords(v){return v===null?'Comparison unavailable':v===0?'Kept pace':v>0?'Gained ground':'Lost ground'}
function progressNote(summary,subject){
  if(summary.current===null)return 'No numeric result for this school year.';
  if(summary.total===null)return 'More reported years are needed to show a pattern.';
  const total=summary.total;
  return `${total===0?'At the same level':`${total>0?'Up':'Down'} ${Number(Math.abs(total).toFixed(1))} pp`} since ${yearLabel(summary.startYear)}${summary.direction==='declining'?' · down in both of the last two annual changes':summary.direction==='improving'?' · up in both of the last two annual changes':''}.`;
}

async function renderMySchool(token){
  exportRows=[];homeContext=null;$('#export').hidden=true;
  $('#content').innerHTML='<div class="panel muted" role="status">Loading your school…</div>';
  try{
    await getSchoolIndex();if(token!==renderToken)return;
    const meta=schoolInfo(state.school);
    if(!meta){
      state.school='';state.comparisons=[];updateSchoolPicker();render();
      return;
    }
    state.language=meta.language;$('#language').value=meta.language;
    state.comparisons=[...new Set(state.comparisons)].filter(id=>id!==meta.id&&schoolInfo(id)?.language===meta.language).slice(0,4);
    refreshUrl();updateSchoolPicker();
    const years=data.years.filter(y=>y<=state.year),grades=[3,6];
    const files=await Promise.all(grades.flatMap(g=>years.map(y=>getSchools(y,g))));
    if(token!==renderToken)return;
    const maps=new Map();grades.forEach((g,gi)=>years.forEach((y,yi)=>maps.set(`${y}-${g}`,new Map(files[gi*years.length+yi].map(r=>[`${r.language}-${r.id}`,r])))));
    const record=(id,y,g)=>maps.get(`${y}-${g}`)?.get(`${meta.language}-${id}`);
    const history=(id,g=state.grade)=>years.map(y=>record(id,y,g));
    const rows=history(meta.id),r=rows.at(-1),p=provincial(meta.language,state.year,state.grade),b=schoolBoardResult(r,state.year,state.grade);
    const current=files[grades.indexOf(state.grade)*years.length+years.length-1].filter(s=>s.language===meta.language);
    homeContext={meta,years,rows,r,p,b,current,history,record};
    $('#page-title').textContent=r?.name||meta.name;
    $('#page-description').textContent=`${board(r?.board||meta.board)?.name||'Board unavailable'} · ${meta.city||'Ontario'} · ${languageLabel(meta.language)} · ${board(r?.board||meta.board)?.type||'Other authority'}`;
    $('#section-label').textContent=`SELECTED SCHOOL / ${meta.id}`;
    $('#export').hidden=false;
    $('#content').innerHTML=`
      <div class="school-overview-caption"><span>Grade ${state.grade} · ${yearLabel(state.year)}</span><span>Students meeting the provincial standard · Levels 3 & 4</span></div>
      <div class="cards school-cards">${subjects.map((s,i)=>{
        const sum=schoolSummary(rows,years,i),gap=difference(schoolValue(r,i),schoolValue(p,i));
        return `<article class="card primary subject-card" data-overview-subject="${i}"><div class="label">${s}</div><div class="stat">${schoolStatus(r,i)}</div><div class="sub">${sum.annual===null?'Previous-year comparison unavailable':`${changeHTML(sum.annual)} vs ${yearLabel(state.year-1)}`}</div><div class="card-benchmarks"><span>Ontario <strong>${schoolStatus(p,i)}</strong></span><span>Board <strong>${schoolStatus(b,i)}</strong></span></div><p class="card-gap">${delta(gap)} vs Ontario</p></article>`;
      }).join('')}</div>
      <details class="grade-overview"><summary>Grade 3 & Grade 6, side by side</summary><div class="table-wrap"><table id="grade-overview"><thead><tr><th>School / grade</th>${subjects.map(s=>`<th class="numeric">${s}</th>`).join('')}</tr></thead><tbody>${grades.map(g=>{
        const gr=record(meta.id,state.year,g),gp=provincial(meta.language,state.year,g);
        return `<tr><th scope="row">Grade ${g} · school</th>${subjects.map((s,i)=>`<td class="numeric">${schoolStatus(gr,i)}<small class="cell-note">${delta(difference(schoolValue(gr,i),schoolValue(gp,i)))} vs Ontario</small></td>`).join('')}</tr><tr class="benchmark-row"><td>Grade ${g} · Ontario</td>${subjects.map((s,i)=>`<td class="numeric">${schoolStatus(gp,i)}</td>`).join('')}</tr>`;
      }).join('')}</tbody></table></div><p class="small muted">Each grade uses its own published Ontario benchmark. Grades are different student groups.</p></details>
      <section class="school-section" id="school-trends"><div class="panel-head"><div><p class="eyebrow">01 / THE LONGER VIEW</p><h2>How are results changing?</h2><p>Grade ${state.grade} · ${yearLabel(years[0])} to ${yearLabel(state.year)} · all charts share a 0–100% scale.</p></div></div><div class="trend-small-multiples">${subjects.map((s,i)=>`<article class="subject-trend"><div class="subject-trend-head"><h3>${s}</h3><button class="text-button" data-expand-subject="${i}" aria-expanded="${state.expanded===i}" aria-controls="expanded-subject">${state.expanded===i?'Close':'Compare'} <span aria-hidden="true">↗</span></button></div><p class="trend-finding">${progressNote(schoolSummary(rows,years,i),s)}</p><div id="school-chart-${i}" class="chart"></div><div id="school-readout-${i}" class="chart-readout" aria-live="polite">Focus or tap a point for the year and result.</div></article>`).join('')}</div><p class="chart-caption">Missing or suppressed results remain gaps. Each year describes a different group of students. ${years.includes(2022)?'EQAO notes a calculation difference between the 2021–22 CSV and its interactive reports. ':''}<a href="downloads/${encodeURIComponent(r?.source||`Grade-${state.grade}-${state.year-1}-${state.year}-Achievement-Results.zip`)}" download>Original EQAO results · ${yearLabel(state.year)}</a></p><div id="expanded-subject" ${state.expanded===null?'hidden':''}></div></section>
      <div class="school-insights"><section class="panel" id="relative-progress"></section><section class="panel conversation-panel" id="school-conversations"></section></div>
      <section class="school-section"><div class="panel-head"><div><p class="eyebrow">02 / SCHOOLS AROUND YOU</p><h2>Choose your comparison schools</h2><p>Pick up to four schools to add to an expanded subject chart.</p></div></div><div id="comparison-chips" class="chips"></div><div class="nearby-controls"><div><label for="near-radius">Distance from your school</label><select id="near-radius">${[1,3,5,10,25,50].map(k=>`<option value="${k}" ${state.radius===k?'selected':''}>Within ${k} km</option>`).join('')}</select></div><div><label for="near-type">Board type</label><select id="near-type">${Object.entries({all:'All boards & authorities',Public:'Public',Catholic:'Catholic','Other authority':'Other authorities'}).map(([v,l])=>`<option value="${v}" ${state.nearType===v?'selected':''}>${l}</option>`).join('')}</select></div><div><label for="near-subject">Change & participation for</label><select id="near-subject">${subjects.map((s,i)=>`<option value="${i}" ${state.subject===i?'selected':''}>${s}</option>`).join('')}</select></div><div><label for="near-search">Search nearby schools</label><input id="near-search" type="search" placeholder="School name or city…"></div></div><p id="nearby-description" class="small muted"></p><div class="table-wrap" id="nearby-table"></div><div class="table-bottom"><span id="nearby-count"></span><div class="pagination"><button id="nearby-prev" aria-label="Previous nearby schools">‹</button><button id="nearby-next" aria-label="Next nearby schools">›</button></div></div><details class="outside-comparison"><summary>Add a school beyond this distance</summary><label for="peer-search">Find a comparison school</label><input id="peer-search" type="search" placeholder="Search name, city or school number…"><label for="peer-select">School in the ${languageLabel(meta.language).toLowerCase()} system</label><select id="peer-select"><option value="">Search above to choose a school…</option></select><p class="small muted">Uses the same language system as your school. Saved comparisons remain selected when the distance or board-type filter changes.</p></details><p class="chart-caption">Distances are straight-line distances between published school coordinates, not attendance boundaries or travel distances. ${meta.locationSource?`Location metadata for your school comes from Ontario’s ${yearLabel(meta.locationYear)} school-information workbook.`:"Ontario location metadata is unavailable for your school."} School results and participant counts refer to ${yearLabel(state.year)}.</p></section>
      <section class="school-section" id="achievement-context"></section>
      <section class="school-section school-life"><p class="eyebrow">04 / SCHOOL LIFE & SUPPORT</p><h2>The rest of the school experience</h2><p>Belonging, safety, attendance, special education support and extracurricular opportunities matter, too. School-specific evidence for these topics is not included in this collection yet.</p><div class="support-items"><div><h3>Interest & confidence</h3><p>EQAO student questionnaire results are the next data addition. They are not available in this dashboard yet.</p></div><div><h3>Programs & practical support</h3><p>Ask the school what is offered, who is eligible, and how families can access it. Achievement percentages cannot describe the support available.</p></div></div><p class="small muted">Future items will identify their source, date, and whether they describe this school or the whole board.</p></section>`;
    let nearPage=0;
    const redraw=()=>{
      subjects.forEach((s,i)=>drawTrend($(`#school-chart-${i}`),[{name:'Selected school',color:subjectColors[i],values:rows.map(r=>schoolValue(r,i))},{name:'Ontario',color:'#777b72',dashed:true,values:years.map(y=>schoolValue(provincial(meta.language,y,state.grade),i))}],years,$(`#school-readout-${i}`),{fixedScale:true,selectedYear:state.year}));
      drawExpandedSchool();
    };
    chartRedraw=redraw;redraw();renderRelativeProgress();renderSchoolConversations();renderAchievementContext();renderComparisonChips();
    function nearby(){renderNearbySchools($('#near-search').value,nearPage)}
    $('#near-radius').onchange=e=>{state.radius=+e.target.value;nearPage=0;refreshUrl();nearby()};
    $('#near-type').onchange=e=>{state.nearType=e.target.value;nearPage=0;refreshUrl();nearby()};
    $('#near-search').oninput=()=>{nearPage=0;nearby()};
    $('#near-subject').onchange=e=>{state.subject=+e.target.value;refreshUrl();nearby()};
    $('#nearby-prev').onclick=()=>{nearPage=Math.max(0,nearPage-1);nearby()};$('#nearby-next').onclick=()=>{nearPage++;nearby()};
    $('#nearby-table').onclick=e=>{const b=e.target.closest('[data-compare-school]');if(b)toggleComparison(b.dataset.compareSchool)};
    $('#comparison-chips').onclick=e=>{const b=e.target.closest('[data-remove-peer]');if(b)toggleComparison(b.dataset.removePeer)};
    $('#peer-search').oninput=e=>{
      const q=e.target.value.trim().toLocaleLowerCase();
      const candidates=current.filter(s=>s.id!==meta.id&&!state.comparisons.includes(s.id)&&q&&`${s.name} ${s.city} ${s.id}`.toLocaleLowerCase().includes(q));
      $('#peer-select').innerHTML=`<option value="">${q?candidates.length?'Choose a school…':'No schools match':'Search above to choose a school…'}</option>`+candidates.map(s=>`<option value="${s.id}">${esc(s.name)} · ${esc(s.city)} · ${esc(board(s.board)?.type)}</option>`).join('');
    };
    $('#peer-select').onchange=e=>{if(e.target.value)toggleComparison(e.target.value)};
    $('#school-trends').onclick=e=>{const b=e.target.closest('[data-expand-subject]');if(b){state.expanded=state.expanded===+b.dataset.expandSubject?null:+b.dataset.expandSubject;render()}};
    nearby();
  }catch(e){
    if(token!==renderToken)return;
    $('#content').innerHTML='<div class="error">School results could not be loaded. <button id="retry-my-school" class="button secondary">Try again</button></div>';
    $('#retry-my-school').onclick=render;
  }
}

function expandedSeries(i){
  const {meta,years,rows,history}=homeContext;
  return [{name:'Selected school',color:subjectColors[i],values:rows.map(r=>schoolValue(r,i))},
    ...(state.showOntario?[{name:'Ontario',color:'#777b72',dashed:true,values:years.map(y=>schoolValue(provincial(meta.language,y,state.grade),i))}]:[]),
    ...(state.showBoard?[{name:'School board',color:'#49756b',dashed:true,values:rows.map((r,j)=>schoolValue(schoolBoardResult(r,years[j],state.grade),i))}]:[]),
    ...state.comparisons.map((id,j)=>({name:schoolInfo(id).name,color:peerColors[j],values:history(id).map(r=>schoolValue(r,i))}))];
}
function drawExpandedSchool(){
  if(state.expanded===null||!homeContext)return;
  const el=$('#expanded-subject');if(!el)return;
  el.hidden=false;const i=state.expanded;
  el.innerHTML=`<div class="panel-head"><div><h3>${subjects[i]} · the full comparison</h3><p>Grade ${state.grade} · your saved schools and published benchmarks</p></div></div><div class="line-switches"><label><input type="checkbox" id="line-ontario" ${state.showOntario?'checked':''}> Ontario</label><label><input type="checkbox" id="line-board" ${state.showBoard?'checked':''}> School board</label><span class="small muted">Comparison schools can be removed below.</span></div><div id="expanded-school-chart" class="chart"></div><div id="expanded-school-readout" class="chart-readout" aria-live="polite">Focus or tap a point for details.</div><details><summary>View the chart’s values</summary><div class="table-wrap"><table><thead><tr><th>School year</th>${expandedSeries(i).map(s=>`<th class="numeric">${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${homeContext.years.map((y,j)=>`<tr><th scope="row">${yearLabel(y)}</th>${expandedSeries(i).map(s=>`<td class="numeric">${pct(s.values[j])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details><p class="chart-caption">Board values follow the school’s reported board membership in each year. Comparison lines describe different annual student groups. All scales are 0–100%.</p>`;
  drawTrend($('#expanded-school-chart'),expandedSeries(i),homeContext.years,$('#expanded-school-readout'),{fixedScale:true,selectedYear:state.year});
  $('#line-ontario').onchange=e=>{state.showOntario=e.target.checked;drawExpandedSchool()};$('#line-board').onchange=e=>{state.showBoard=e.target.checked;drawExpandedSchool()};
}

function renderRelativeProgress(){
  const {meta,years,rows}=homeContext;
  const benchmarks=[{label:'Ontario',rows:years.map(y=>provincial(meta.language,y,state.grade))},{label:'School board',rows:rows.map((r,j)=>schoolBoardResult(r,years[j],state.grade))},...state.comparisons.map(id=>({label:schoolInfo(id).name,rows:homeContext.history(id)}))];
  $('#relative-progress').innerHTML=`<p class="eyebrow">RELATIVE PROGRESS</p><h2>Is your school gaining ground?</h2><p class="small muted">The school’s change minus each benchmark’s change, from ${yearLabel(state.year-1)} to ${yearLabel(state.year)}.</p><div class="table-wrap"><table><thead><tr><th>Compared with</th>${subjects.map(s=>`<th class="numeric">${s}</th>`).join('')}</tr></thead><tbody>${benchmarks.map(b=>`<tr><th scope="row">${esc(b.label)}</th>${subjects.map((s,i)=>{const sum=relativeSummary(rows,b.rows,years,i);return `<td class="numeric">${changeHTML(sum.annual)}<small class="cell-note">${relativeWords(sum.annual)}</small></td>`}).join('')}</tr>`).join('')}</tbody></table></div><p class="small muted progress-explainer">A school gaining 2 points while Ontario gains 8 loses 6 points of ground.</p><details><summary>How the gap changed over the longer period</summary>${benchmarks.map(b=>`<h3 class="small">${esc(b.label)}</h3>${subjects.map((s,i)=>{const sum=relativeSummary(rows,b.rows,years,i);return `<p class="small"><strong>${s}:</strong> ${sum.total===null?'Not enough paired results.':`${relativeWords(sum.total)} by ${Math.abs(sum.total)} pp, ${yearLabel(sum.startYear)} to ${yearLabel(state.year)}. Current gap: ${delta(sum.gap)}.`}</p>`}).join('')}`).join('')}</details>`;
}

function conversationFindings(rows,provinceRows,years,grade){
  const lastYears=years.slice(-3),lastRows=rows.slice(-3),lastProvince=provinceRows.slice(-3),findings=[];
  subjects.forEach((subject,i)=>{
    const sum=schoolSummary(rows,years,i),rel=relativeSummary(rows,provinceRows,years,i);
    const paired=lastYears.length===3&&lastRows.every((r,j)=>schoolValue(r,i)!==null&&schoolValue(lastProvince[j],i)!==null);
    const gaps=paired?lastRows.map((r,j)=>schoolValue(r,i)-schoolValue(lastProvince[j],i)):[];
    if(sum.direction==='declining')findings.push({priority:0,subject:i,title:`Grade ${grade} ${subject.toLowerCase()} declined in two consecutive annual changes`,evidence:`${lastYears.map((y,j)=>`${yearLabel(y)}: ${pct(schoolValue(lastRows[j],i))}`).join(' → ')}.${rel.total!==null?` ${relativeWords(rel.total)} by ${Math.abs(rel.total)} pp vs Ontario since ${yearLabel(rel.startYear)}.`:''}`,question:`What has changed in ${subject.toLowerCase()} learning and support, and how will the school assess whether its response is helping?`});
    else if(paired&&gaps.every(g=>g<0))findings.push({priority:1,subject:i,title:`Grade ${grade} ${subject.toLowerCase()} was below Ontario in all three recent years`,evidence:`${lastYears.map((y,j)=>`${yearLabel(y)}: ${delta(gaps[j])}`).join(' · ')} vs the corresponding Ontario result.`,question:`What does the school see behind this persistent ${subject.toLowerCase()} gap, and what support and follow-up can families expect?`});
    else if(paired&&gaps.every(g=>g>0))findings.push({priority:2,subject:i,title:`A sustained strength in Grade ${grade} ${subject.toLowerCase()}`,evidence:`Above Ontario in ${lastYears.map(yearLabel).join(', ')} (${gaps.map(delta).join(', ')}).`,question:`Which ${subject.toLowerCase()} practices are helping students, and how is the school sustaining them or applying them to other subjects?`});
    else if(rel.annual!==null&&Math.abs(rel.annual)>=5)findings.push({priority:3,subject:i,title:`Grade ${grade} ${subject.toLowerCase()} ${rel.annual>0?'gained':'lost'} ground this year`,evidence:`School change: ${delta(sum.annual)}. Ontario change: ${delta(difference(schoolValue(provinceRows.at(-1),i),schoolValue(provinceRows.at(-2),i)))}. Relative change: ${delta(rel.annual)}.`,question:`How does the school interpret this year’s ${subject.toLowerCase()} change, including participation and the needs of this student group?`});
  });
  return findings.sort((a,b)=>a.priority-b.priority);
}
function renderSchoolConversations(){
  const {meta,years,rows}=homeContext;
  const findings=conversationFindings(rows,years.map(y=>provincial(meta.language,y,state.grade)),years,state.grade);
  findings.filter(f=>f.priority===0).forEach(f=>{
    const peers=state.comparisons.map(id=>({name:schoolInfo(id).name,summary:schoolSummary(homeContext.history(id),years,f.subject)})).filter(p=>p.summary.direction==='unchanged'||p.summary.direction==='improving');
    if(peers.length){f.evidence+=` Selected comparison schools ${peers.map(p=>`${p.name} (${p.summary.direction})`).join(', ')} did not share the decline in those three years.`;f.question=`${subjects[f.subject]} declined while these selected comparison schools held steady or improved. What has changed, and how is the school responding?`;}
  });
  $('#school-conversations').innerHTML=`<p class="eyebrow">STRENGTHS, ATTENTION & NEXT QUESTIONS</p><h2>A useful conversation starts here.</h2>${findings.length?findings.slice(0,3).map(f=>`<article class="conversation"><h3>${f.title}</h3><p class="finding-evidence">${f.evidence}</p><p class="school-question">“${f.question}”</p></article>`).join(''):`<p class="small muted">${rows.some(r=>r?.values.some(Number.isFinite))?'No repeated three-year strength or gap stands out under these checks.':'Numeric results are unavailable for the selected period.'}</p><p class="school-question">“What are the school’s current learning priorities, and how will families know whether the support is helping?”</p>`}<p class="chart-caption">Patterns help frame questions. Results alone cannot explain their cause; the school can add context about students and support.</p>`;
  $('#school-conversations').insertAdjacentHTML('beforeend',`<details class="question-method"><summary>How these questions are chosen</summary><p>Each subject is checked in this order, using the selected grade and results through the selected school year:</p><ol><li>A decline in both of the last two annual changes.</li><li>Below the corresponding Ontario result in all three recent years.</li><li>Above Ontario in all three recent years.</li><li>A gain or loss of at least 5 percentage points of ground against Ontario in the latest year.</li></ol><p>The first matching pattern selects a fixed question template. Its subject, grade, figures and years come from the school’s results. Three-year patterns require numeric results in all three years; missing or suppressed results are never filled in.</p><p>If your school declines while selected comparison schools remain unchanged or improve across those same three years, the question also mentions that comparison. The same rules and templates are used for every school. When no pattern qualifies, a general question about learning priorities is shown.</p><p>The five-point cutoff is a display rule, not a statistical significance test. These questions suggest conversations; they do not explain the cause of a result.</p></details>`);
}

function renderComparisonChips(){
  $('#comparison-chips').innerHTML=state.comparisons.length?state.comparisons.map((id,j)=>`<span class="chip"><i class="swatch" style="background:${peerColors[j]}"></i>${esc(schoolInfo(id)?.name)}<button data-remove-peer="${id}" aria-label="Remove ${esc(schoolInfo(id)?.name)}">×</button></span>`).join(''):'<p class="small muted">No comparison schools selected yet.</p>';
}
function toggleComparison(id){
  if(state.comparisons.includes(id))state.comparisons=state.comparisons.filter(s=>s!==id);
  else if(state.comparisons.length<4&&schoolInfo(id)?.language===homeContext.meta.language)state.comparisons.push(id);
  else{toast('You can compare up to four schools. Remove one to add another.');return}
  if(state.expanded===null)state.expanded=state.subject;
  refreshUrl();renderComparisonChips();drawExpandedSchool();renderRelativeProgress();renderSchoolConversations();renderNearbySchools($('#near-search').value,homeContext.nearPage||0);
  // Update expansion controls without rebuilding the page or losing table focus.
  $$('[data-expand-subject]').forEach(b=>{const on=+b.dataset.expandSubject===state.expanded;b.textContent=on?'Close ↗':'Compare ↗';b.setAttribute('aria-expanded',on)});
}
function renderNearbySchools(query='',page=0){
  const {meta,current,record}=homeContext,q=query.trim().toLocaleLowerCase();
  const hasLocation=distanceKm(meta,meta)!==null;
  const matching=current.filter(s=>s.id!==meta.id&&(state.nearType==='all'||board(s.board)?.type===state.nearType));
  const noLocation=matching.filter(s=>distanceKm(meta,schoolInfo(s.id))===null).length;
  const nearby=matching.map(r=>({r,distance:distanceKm(meta,schoolInfo(r.id))})).filter(({r,distance})=>hasLocation?distance!==null&&distance<=state.radius:meta.city&&r.city===meta.city);
  const rows=nearby.filter(({r})=>!q||`${r.name} ${r.city} ${r.id}`.toLocaleLowerCase().includes(q)).sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity)||a.r.name.localeCompare(b.r.name));
  const pages=Math.max(1,Math.ceil(rows.length/10));page=Math.min(page,pages-1);
  homeContext.nearPage=page;
  $('#near-radius').disabled=!hasLocation;
  $('#nearby-description').textContent=`${languageLabel(meta.language)} schools · ${state.nearType==='all'?'all board types':state.nearType} · ${hasLocation?`within ${state.radius} km. ${noLocation} schools without usable coordinates are excluded from distance results.`:meta.city?`Coordinates are unavailable for your school; showing the same city (${meta.city}) instead.`:'Coordinates and city are unavailable; use “Add a school beyond this distance” to choose comparisons.'} Changes, gaps and participation below refer to ${subjects[state.subject].toLowerCase()}, Grade ${state.grade}.`;
  const renderRow=(r,distance,own=false)=>{
    const old=record(r.id,state.year-1,state.grade),p=provincial(r.language,state.year,state.grade);
    const location=schoolInfo(r.id),locationNote=location?.locationYear&&location.locationYear<2025?` · coordinates from ${yearLabel(location.locationYear)}`:'';
    return `<tr class="${own?'selected-row':''}"><td class="name-cell"><strong>${esc(r.name)}</strong>${own?'<span class="my-school-tag">Selected school</span>':''}<small>${esc(board(r.board)?.name||r.board)} · ${languageLabel(r.language)} · ${esc(board(r.board)?.type||'Other authority')}${!own?` · ${distance===null?'distance unavailable':distance.toFixed(1)+' km'}`:''}${locationNote}</small></td>${subjects.map((s,i)=>metricCell(r,i)).join('')}<td class="numeric">${changeHTML(difference(schoolValue(r,state.subject),schoolValue(old,state.subject)))}</td><td class="numeric">${delta(difference(schoolValue(r,state.subject),schoolValue(p,state.subject)))}</td><td class="numeric">${number(r.participants?.[state.subject])}</td><td>${own?'':`<button class="pin-button ${state.comparisons.includes(r.id)?'on':''}" data-compare-school="${r.id}" aria-label="${state.comparisons.includes(r.id)?'Remove':'Compare'} ${esc(r.name)}" aria-pressed="${state.comparisons.includes(r.id)}">${state.comparisons.includes(r.id)?'−':'+'}</button>`}</td></tr>`;
  };
  $('#nearby-table').innerHTML=`<table><thead><tr><th>School / comparison group</th>${subjects.map(s=>`<th class="numeric">${s}</th>`).join('')}<th class="numeric">Year change*</th><th class="numeric">vs Ontario*</th><th class="numeric">Participating*</th><th>Compare</th></tr></thead><tbody>${homeContext.r?renderRow(homeContext.r,0,true):''}${rows.slice(page*10,(page+1)*10).map(({r,distance})=>renderRow(r,distance)).join('')||'<tr><td colspan="8" class="empty">No nearby schools match. Try a wider distance or add a school by name.</td></tr>'}</tbody></table>`;
  $('#nearby-count').textContent=rows.length?`${page*10+1}–${Math.min((page+1)*10,rows.length)} of ${rows.length} nearby schools · *${subjects[state.subject]}`:'No matching nearby schools';
  $('#nearby-prev').disabled=page===0;$('#nearby-next').disabled=page===pages-1;
  const selected=state.comparisons.map(id=>current.find(r=>r.id===id)).filter(Boolean);
  const included=[...new Map([...(homeContext.r?[homeContext.r]:[]),...selected,...rows.map(x=>x.r)].map(r=>[r.id,r])).values()];
  exportRows=included.map(r=>({school_year:yearLabel(state.year),grade:state.grade,school_id:r.id,school_name:r.name,board_name:board(r.board)?.name,language:r.language,board_type:board(r.board)?.type,comparison_role:r.id===meta.id?'Selected school':state.comparisons.includes(r.id)?'Selected comparison':'Nearby school',distance_km:distanceKm(meta,schoolInfo(r.id)),reading:r.raw[0],writing:r.raw[1],mathematics:r.raw[2],change_subject:subjects[state.subject],year_change_pp:difference(schoolValue(r,state.subject),schoolValue(record(r.id,state.year-1,state.grade),state.subject)),ontario_gap_pp:difference(schoolValue(r,state.subject),schoolValue(provincial(r.language,state.year,state.grade),state.subject)),fully_participating_students:r.participants?.[state.subject],source:r.source}));
}

function renderAchievementContext(){
  const {r,meta,years,history}=homeContext,labels=['Below Level 1','Level 1','Level 2','Level 3','Level 4'];
  const otherGrade=state.grade===3?6:3,other=conversationFindings(history(meta.id,otherGrade),years.map(y=>provincial(meta.language,y,otherGrade)),years,otherGrade);
  $('#achievement-context').innerHTML=`<p class="eyebrow">03 / BEHIND THE PERCENTAGE</p><h2>Who participated, and where did students land?</h2><p class="small muted">Grade ${state.grade} · ${yearLabel(state.year)} · achievement levels among fully participating students.</p><div class="achievement-grid">${subjects.map((s,i)=>{
    const levels=r?.levels?.[i]||labels.map(()=>'No result'),values=levels.map(numeric),complete=r?.suppressed==='0'&&values.every(Number.isFinite);
    return `<article class="achievement-card"><h3>${s}</h3><p><strong>${number(r?.participants?.[i])}</strong> fully participating <span class="muted">/ ${number(r?.registered?.[i])} registered</span></p><p class="small muted">Participation: ${r?.participation?.[i]==null?'unavailable':pct(r.participation[i])}</p>${complete?`<div class="level-stack" aria-label="${esc(s)} achievement distribution">${values.map((v,j)=>`<span class="level-${j}" style="flex:${v}" title="${labels[j]}: ${esc(levels[j])}"></span>`).join('')}</div>`:'<p class="level-unavailable small muted">A complete numeric distribution is unavailable.</p>'}<dl class="level-values">${labels.map((l,j)=>`<div><dt><i class="level-${j}"></i>${l}</dt><dd>${esc(levels[j])}</dd></div>`).join('')}</dl></article>`;
  }).join('')}</div><p class="chart-caption">Levels 3 and 4 meet the provincial standard. Published rounded level percentages can total slightly above or below 100%; bar segment widths are normalized for display. Bounded values such as &lt;1% and suppressed values remain text and are never converted into exact percentages. A missing result is never treated as zero.</p><details><summary>Patterns in Grade ${otherGrade}</summary>${other.length?other.map(f=>`<p class="small"><strong>${f.title}.</strong> ${f.evidence}</p>`).join(''):'<p class="small muted">No repeated pattern stands out under the same checks, or not enough reported results are available.</p>'}</details><details><summary>Available student context and source</summary><p class="small muted">These downloads provide school-level achievement and participation. The existing subgroup display belongs to the board explorer; it does not describe this school’s students. No school-level demographic explanation is inferred here.</p><p class="small"><a href="downloads/${encodeURIComponent(r?.source||`Grade-${state.grade}-${state.year-1}-${state.year}-Achievement-Results.zip`)}" download>Download the original EQAO result file</a> · ${meta.locationSource?`<a href="downloads/${encodeURIComponent(meta.locationSource)}" download>Ontario school-location source · ${yearLabel(meta.locationYear)}</a>`:"Ontario school-location source unavailable"} · snapshot retrieved 6 October 2026.</p></details>`;
}

$('#school-detail').addEventListener('click',e=>{const b=e.target.closest('[data-use-school]');if(b){$('#school-dialog').close();selectMySchool(b.dataset.useSchool)}});
