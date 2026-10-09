'use strict';

// Published, paired annual percentages only. Every eligible school counts equally.
const trendMeasure=subject=>subject==='all'?'Average across subjects':subjects[Number(subject)];
const trendShare=(n,total)=>total?pct(100*n/total):'—';

function schoolTrendSummary(current,previousRows,{subject='all',minimum=0,consistent=false}={}){
  const oldById=new Map(previousRows.map(r=>[`${r.language}-${r.id}`,r]));
  const indices=subject==='all'?[0,1,2]:[Number(subject)];
  const rows=[],excluded={missing:0,participants:0,direction:0};
  for(const r of current){
    const old=oldById.get(`${r.language}-${r.id}`);
    const changes=subjects.map((_,i)=>Number.isFinite(r.values?.[i])&&Number.isFinite(old?.values?.[i])?r.values[i]-old.values[i]:null);
    if(!indices.every(i=>Number.isFinite(changes[i]))){excluded.missing++;continue}
    if(minimum>0&&!indices.every(i=>Number.isFinite(r.participants?.[i])&&Number.isFinite(old?.participants?.[i])&&r.participants[i]>=minimum&&old.participants[i]>=minimum)){excluded.participants++;continue}
    if(subject==='all'&&consistent&&!changes.every(v=>v>0)&&!changes.every(v=>v<0)){excluded.direction++;continue}
    const mean=record=>indices.reduce((total,i)=>total+record.values[i],0)/indices.length;
    const participants=record=>indices.every(i=>Number.isFinite(record.participants?.[i]))?Math.min(...indices.map(i=>record.participants[i])):null;
    rows.push({r,old,changes,change:indices.reduce((total,i)=>total+changes[i],0)/indices.length,
      before:mean(old),after:mean(r),beforeParticipants:participants(old),afterParticipants:participants(r)});
  }
  const values=rows.map(r=>r.change).sort((a,b)=>a-b),middle=Math.floor(values.length/2);
  const complete=rows.filter(r=>r.changes.every(Number.isFinite));
  return {rows,total:current.length,excluded,median:values.length?(values.length%2?values[middle]:(values[middle-1]+values[middle])/2):null,
    up:values.filter(v=>v>0).length,down:values.filter(v=>v<0).length,flat:values.filter(v=>v===0).length,
    completeAll:complete.length,upAll:complete.filter(r=>r.changes.every(v=>v>0)).length,downAll:complete.filter(r=>r.changes.every(v=>v<0)).length};
}

function rankSchoolTrends(rows,direction){
  const sorted=rows.filter(r=>direction==='up'?r.change>0:r.change<0).sort((a,b)=>(direction==='up'?b.change-a.change:a.change-b.change)||a.r.name.localeCompare(b.r.name)||a.r.id.localeCompare(b.r.id));
  let rank=0;
  return sorted.slice(0,10).map((r,i)=>{if(i===0||r.change!==sorted[i-1].change)rank=i+1;return {...r,rank}});
}

function trendDistribution(rows){
  const bins=[{label:'≤ −10',test:v=>v<=-10},{label:'−10 to −5',test:v=>v>-10&&v<=-5},{label:'−5 to 0',test:v=>v>-5&&v<0},
    {label:'0',test:v=>v===0},{label:'0 to +5',test:v=>v>0&&v<5},{label:'+5 to +10',test:v=>v>=5&&v<10},{label:'≥ +10',test:v=>v>=10}];
  return bins.map(({label,test})=>({label,count:rows.filter(r=>test(r.change)).length}));
}

function trendRankingHTML(rows,direction,scale,subject){
  if(!rows.length)return `<p class="empty">No eligible schools have an annual ${direction==='up'?'increase':'decrease'} for these filters.</p>`;
  const all=subject==='all';
  return `<div class="ranking-scale" aria-hidden="true"><span>0 points</span><span>${direction==='up'?'+':'−'}${scale} points</span></div><ol class="trend-ranking">${rows.slice(0,ui.trendLimit).map(row=>{
    const {r,old,changes}=row;
    return `<li class="ranking-row" data-trend-school="${r.id}" data-change="${row.change}" data-rank="${row.rank}">
      <div class="ranking-head"><span class="ranking-number" aria-label="Rank ${row.rank}">${row.rank}</span><button class="ranking-school" data-trend-open="${r.id}">${esc(r.name)}</button><strong class="${direction==='up'?'positive':'negative'}">${delta(row.change).replace(' pp',' points')}</strong></div>
      <p class="ranking-board">${esc(board(r.board)?.name||r.board)}${r.city?` · ${esc(r.city)}`:''}</p>
      <div class="ranking-bar-track" aria-hidden="true"><div class="ranking-bar ${direction}" style="width:${100*Math.abs(row.change)/scale}%"></div></div>
      <p class="ranking-result">${all?'Subject mean: ':''}${pct(row.before)} → ${pct(row.after)}</p>
      <p class="ranking-participants">${all?'Smallest subject group':'Participants'}: ${number(row.beforeParticipants)} → ${number(row.afterParticipants)}${row.beforeParticipants!==null&&row.afterParticipants!==null&&Math.min(row.beforeParticipants,row.afterParticipants)<30?' · Small group':''}</p>
      <details class="ranking-details"><summary>Results and participant counts</summary><div class="table-wrap"><table><thead><tr><th>Subject</th><th>${yearLabel(state.year-1)}</th><th>${yearLabel(state.year)}</th><th>Change</th></tr></thead><tbody>${subjects.map((s,i)=>`<tr><th scope="row">${s}</th><td>${rawLabel(old,i)}<small>${number(old.participants?.[i])} participants</small></td><td>${rawLabel(r,i)}<small>${number(r.participants?.[i])} participants</small></td><td>${delta(changes[i])}</td></tr>`).join('')}</tbody></table></div></details>
    </li>`;
  }).join('')}</ol>`;
}

async function renderSchoolTrends(token){
  exportRows=[];$('#export').disabled=true;
  $('#content').innerHTML='<div class="panel muted" role="status">Loading paired school results…</div>';
  try{
    const hasPrevious=data.years.includes(state.year-1);
    const [current,old]=await Promise.all([getSchools(state.year,state.grade),hasPrevious?getSchools(state.year-1,state.grade):Promise.resolve([])]);
    if(token!==renderToken)return;
    currentSchools=current.filter(r=>r.language===state.language&&matches(board(r.board)));
    const present=new Set(currentSchools.map(r=>r.board));
    const boards=data.boards.filter(b=>present.has(b.id)).sort((a,b)=>a.name.localeCompare(b.name));
    if(state.trendBoard!=='all'&&!present.has(state.trendBoard))state.trendBoard='all';
    const filtered=currentSchools.filter(r=>state.trendBoard==='all'||r.board===state.trendBoard);
    const summary=schoolTrendSummary(filtered,old,{subject:state.trendSubject,minimum:state.trendMinimum,consistent:state.trendConsistent});
    const {rows,total,excluded}=summary,all=state.trendSubject==='all',n=rows.length;
    const up=rankSchoolTrends(rows,'up'),down=rankSchoolTrends(rows,'down');
    const scale=Math.max(10,Math.ceil(Math.max(0,...up.map(r=>r.change),...down.map(r=>-r.change))/10)*10);
    const provinceChanges=subjects.map((_,i)=>difference(province()?.values[i],province(state.year-1)?.values[i]));
    const provinceChange=all?(provinceChanges.every(Number.isFinite)?provinceChanges.reduce((a,b)=>a+b,0)/3:null):provinceChanges[Number(state.trendSubject)];
    const bins=trendDistribution(rows),maxBin=Math.max(1,...bins.map(b=>b.count));
    $('#trend-board').innerHTML='<option value="all">All matching boards</option>'+boards.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');
    $('#content').innerHTML=`<p class="trend-period" id="trend-period">${yearLabel(state.year-1)} → ${yearLabel(state.year)} · Grade ${state.grade} · ${languageLabel(state.language)} · ${trendMeasure(state.trendSubject)}${all?' (equal-weight mean of subject changes)':''}</p>
      ${hasPrevious?'':`<div class="notice"><strong>Previous-year comparison unavailable.</strong> The current series begins in ${yearLabel(data.years[0])}. No ${yearLabel(state.year-1)} results are included; the historical archive is kept separate.</div>`}
      <section class="trend-summary" aria-label="Change summary"><div class="trend-cards"><span class="stat">${delta(summary.median).replace(' pp',' points')}</span><span> median school change · ${number(n)} schools with comparable results</span></div><div class="trend-direction" id="trend-direction">${[['up','Increasing',summary.up],['flat','Unchanged',summary.flat],['down','Decreasing',summary.down]].map(([key,label,count])=>`<span class="direction-${key}">${label} <strong>${trendShare(count,n)}</strong></span>`).join('')}</div><p class="small muted">Ontario change: <strong>${delta(provinceChange).replace(' pp',' percentage points')}</strong>${all?' · average of its three published subject changes':''}. Each eligible school counts equally in the median.</p></section>
      <details class="trend-coverage-details"><summary>Coverage and exclusions · ${number(n)} of ${number(total)} schools</summary><p class="small muted" id="trend-coverage" role="status">${number(n)} of ${number(total)} schools eligible. Excluded: ${number(excluded.missing)} without exact paired results${all?' in all three subjects':''}; ${number(excluded.participants)} below the participant minimum or with unavailable counts; ${number(excluded.direction)} with mixed or unchanged subject directions.</p><p class="small muted">${number(summary.upAll)} of ${number(summary.completeAll)} eligible schools with all three paired subjects increased in every subject (${trendShare(summary.upAll,summary.completeAll)}).</p></details>
      ${all?'<p class="chart-caption">Average across subjects uses equal weights for reading, writing and mathematics. It is not an official combined EQAO score.</p>':''}
      <div class="trend-rankings"><section class="panel" id="trending-up"><div class="panel-head"><div><p class="eyebrow">01 / ANNUAL INCREASES</p><h2>Largest increases</h2><p>${number(summary.up)} eligible schools increased · ${trendMeasure(state.trendSubject)}</p></div></div>${trendRankingHTML(up,'up',scale,state.trendSubject)}</section>
      <section class="panel" id="trending-down"><div class="panel-head"><div><p class="eyebrow">02 / ANNUAL DECREASES</p><h2>Largest decreases</h2><p>${number(summary.down)} eligible schools decreased · ${trendMeasure(state.trendSubject)}</p></div></div>${trendRankingHTML(down,'down',scale,state.trendSubject)}</section></div>
      ${up.length>5||down.length>5?`<div class="ranking-more"><span class="small muted">Showing up to ${ui.trendLimit} schools in each direction.</span><button class="button secondary" id="trend-show-more" aria-expanded="${ui.trendLimit===10}">${ui.trendLimit===5?'Show ten in each direction':'Show fewer'}</button></div>`:''}
      <p class="chart-caption">Bar lengths show the size of the change on the same 0–${scale} percentage-point scale; signed labels show direction. Equal changes share a rank. Ties at the tenth row are ordered by school name, then identifier; each list shows at most ten schools. Zero changes enter neither list. School names open the school dashboard.</p>
      <section class="panel trend-distribution"><div class="panel-head"><div><p class="eyebrow">03 / THE FULL PICTURE</p><h2>How widespread is the change?</h2><p>All ${number(n)} eligible schools · annual change in percentage points</p></div></div><div class="distribution-bars" role="img" aria-label="${esc(bins.map(b=>`${b.label} pp: ${b.count} schools`).join('; '))}">${bins.map((b,i)=>`<div class="distribution-bin"><strong>${number(b.count)}</strong><div class="distribution-track"><span style="height:${100*b.count/maxBin}%;background:${i<3?'var(--orange)':i>3?'var(--teal)':'#999f94'}"></span></div><span>${b.label}</span></div>`).join('')}</div><p class="chart-caption">Intervals: ≤ −10; (−10, −5]; (−5, 0); exactly 0; (0, +5); [+5, +10); ≥ +10 pp. Unrounded changes determine the bins.</p></section>
      <section class="panel prose trend-method"><details><summary>How these comparisons are calculated</summary><p>Annual change = the published percentage meeting the provincial standard in ${yearLabel(state.year)} minus the corresponding percentage in ${yearLabel(state.year-1)}. ${all?'Average across subjects is the equal-weight arithmetic mean of reading, writing and mathematics changes. It requires numeric results in all six subject/year cells. Subject means describe percentages across subjects, not the percentage of students meeting all three standards.':'Only the selected subject determines eligibility and rank.'}</p><p>The minimum participant filter applies to each selected subject in both years. The all-three direction filter requires every subject to increase or every subject to decrease. Summary statistics and exports follow the same filters. The all-three-improving share uses eligible schools with exact paired results in all three subjects as its denominator.</p><p>These are annual results for different student groups, not tracked individual progress or a measure of school quality. Small groups can show large movements; participant counts are shown for both years. “Small group” marks fewer than 30 participants in either year (the smallest selected subject group for an average); this is a display cue, not a statistical significance threshold. Differences use published rounded percentages; display rounding does not determine ranks. Suppressed, bounded and missing values are never converted to zero or reconstructed. ${state.year===2023?'EQAO notes that 2021–22 CSV results may differ from its interactive dashboard. ':''}Ontario comes from its published records and does not change with board filters.</p><p>${hasPrevious?`<a href="downloads/${encodeURIComponent(`Grade-${state.grade}-${state.year-2}-${state.year-1}-Achievement-Results.zip`)}" download>Previous-year source</a> · `:''}<a href="downloads/${encodeURIComponent(`Grade-${state.grade}-${state.year-1}-${state.year}-Achievement-Results.zip`)}" download>Selected-year source</a> · snapshot retrieved 6 October 2026.</p></details></section>`;
    $('#trend-show-more')?.addEventListener('click',()=>{ui.trendLimit=ui.trendLimit===5?10:5;ui.trendFocus=true;render()});
    $('#trend-subject').value=state.trendSubject;$('#trend-board').value=state.trendBoard;$('#trend-minimum').value=String(state.trendMinimum);
    for(const el of $$('[data-trend-open]'))el.onclick=()=>selectMySchool(el.dataset.trendOpen);
    exportRows=rows.map(row=>({school_year:yearLabel(state.year),previous_school_year:yearLabel(state.year-1),grade:state.grade,language:state.language,school_id:row.r.id,school_name:row.r.name,board_name:board(row.r.board)?.name,measure:trendMeasure(state.trendSubject),previous_percent:row.before,current_percent:row.after,annual_change_pp:row.change,ontario_change_pp:provinceChange,relative_to_ontario_change_pp:difference(row.change,provinceChange),
      ...Object.fromEntries(subjects.flatMap((s,i)=>{const key=s.toLowerCase();return [[`${key}_previous_percent`,row.old.values?.[i]],[`${key}_current_percent`,row.r.values?.[i]],[`${key}_change_pp`,row.changes[i]],[`${key}_previous_participants`,row.old.participants?.[i]],[`${key}_current_participants`,row.r.participants?.[i]]]})),previous_source:row.old.source,current_source:row.r.source}));
    $('#export').disabled=!rows.length;refreshUrl();
    if(ui.trendFocus){$('#trend-show-more')?.focus({preventScroll:true});ui.trendFocus=false}
  }catch(error){
    if(token!==renderToken)return;
    $('#content').innerHTML='<div class="error">The annual school comparisons could not be loaded. <button id="retry-trends" class="button secondary">Try again</button></div>';
    $('#retry-trends').onclick=()=>render();
  }
}

// These controls live in the shared filter row, so changing results preserves focus.
for(const [id,key] of [['trend-subject','trendSubject'],['trend-board','trendBoard'],['trend-minimum','trendMinimum']])$('#'+id).onchange=e=>{state[key]=key==='trendMinimum'?Number(e.target.value):e.target.value;ui.trendLimit=5;render()};
$('#trend-consistent').onchange=e=>{state.trendConsistent=e.target.checked;ui.trendLimit=5;render()};
