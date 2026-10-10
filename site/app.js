'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const subjects=['Reading','Writing','Mathematics'];
const subjectColors=['#28679d','#a5633d','#79658d'];
const defaultState=()=>({view:'trends',grade:3,language:'en',type:'all',year:2026,subject:0,pins:['66052','66095'],focus:'66052',search:'',sort:'name',direction:1,page:0,schoolBoard:'all',school:'',comparisons:[],radius:5,nearType:'all',expanded:null,showOntario:true,showBoard:false,trendSubject:'all',trendBoard:'all',trendMinimum:0,trendConsistent:false});
const state=defaultState();
const ui={moreFilters:false,trendLimit:5,schoolDetails:new Set()};
let pushNavigation=false;
let data;
const yearLabel=y=>`${y-1}–${String(y).slice(2)}`;
const pct=v=>v===null||v===undefined?'—':`${Number(v.toFixed(1))}%`;
const number=v=>v===null||v===undefined?'—':v.toLocaleString('en-CA');
const delta=v=>v===null||v===undefined?'—':`${v>0?'+':''}${Number(v.toFixed(1))} pp`;
const board=id=>data?.boards.find(b=>b.id===id);
function matches(b){return b&&b.language===state.language&&(state.type==='everything'||state.type==='all'&&['Public','Catholic'].includes(b.type)||b.type===state.type)}
function results(){return data.results.filter(r=>r.year===state.year&&r.grade===state.grade&&matches(board(r.id)))}
function province(year=state.year,grade=state.grade){return data.province.find(r=>r.year===year&&r.grade===grade&&r.language===state.language)}
function setGrade(g){state.grade=g;render()}
function setView(v){pushNavigation=state.view!==v;state.view=v;state.search='';state.page=0;if(v==='archive')state.year=2019;else if(state.year<2022)state.year=2026;render()}
function syncFilters(displayView){
  const school=displayView==='myschool',trends=displayView==='trends',sources=displayView==='sources';
  $('#filter-bar').hidden=sources||(school&&!state.school);
  $('#subject-field').hidden=school||trends;$('#subjects').hidden=school||trends;
  $('#language-field').hidden=school;$('#more-filters').hidden=school;
  $('#trend-subject-field').hidden=!trends;$('#trend-board-field').hidden=!trends;
  $('#trend-minimum-field').hidden=!trends;$('#trend-consistent-field').hidden=!trends;
  $('#trend-subject').value=state.trendSubject;$('#trend-minimum').value=state.trendMinimum;
  $('#trend-consistent').checked=state.trendConsistent;$('#trend-consistent').disabled=state.trendSubject!=='all';
  const languageParent=trends?$('#advanced-filters'):$('#filter-bar');
  if($('#language-field').parentElement!==languageParent){
    if(trends)languageParent.prepend($('#language-field'));
    else languageParent.insertBefore($('#language-field'),$('#more-filters'));
  }
  $('#language').value=state.language;$('#boardType').value=state.type;
  const active=Number(state.type!=='all')+(trends?Number(state.language!=='en')+Number(state.trendBoard!=='all')+Number(state.trendMinimum>0)+Number(state.trendConsistent&&state.trendSubject==='all'):0);
  $('#more-filters').textContent=`${trends?'Filters':'More filters'}${active?` · ${active}`:''} ${ui.moreFilters?'−':'+'}`;
  $('#more-filters').setAttribute('aria-expanded',String(ui.moreFilters));
  $('#advanced-filters').hidden=school||sources||!ui.moreFilters;
  const filters=[];
  if(trends){
    if(state.language!=='en')filters.push(['language',languageLabel(state.language)]);
    if(state.trendBoard!=='all')filters.push(['trendBoard',board(state.trendBoard)?.name||state.trendBoard]);
    if(state.type!=='all')filters.push(['type',$('#boardType').selectedOptions[0].textContent]);
    if(state.trendMinimum>0)filters.push(['trendMinimum',`At least ${state.trendMinimum} participants per subject`]);
    if(state.trendConsistent&&state.trendSubject==='all')filters.push(['trendConsistent','All subjects moving together']);
  }
  $('#active-filters').hidden=!filters.length;
  $('#active-filters').innerHTML=filters.map(([key,label])=>`<span class="chip"><span>${esc(label)}</span><button type="button" data-remove-filter="${key}" aria-label="Remove ${esc(label)} filter">×</button></span>`).join('');
}
$('#more-filters').onclick=()=>{ui.moreFilters=!ui.moreFilters;syncFilters(state.view)};
$('#reset-filters').onclick=()=>{state.type='all';state.trendMinimum=0;state.trendConsistent=false;if(state.view==='trends'){state.language='en';state.trendBoard='all'}ui.trendLimit=5;render()};
$('#active-filters').onclick=e=>{
  const button=e.target.closest('[data-remove-filter]');if(!button)return;
  const key=button.dataset.removeFilter;
  state[key]=defaultState()[key];ui.trendLimit=5;render();$('#more-filters').focus();
};
$('#advanced-filters').onkeydown=e=>{if(e.key==='Escape'){ui.moreFilters=false;syncFilters(state.view);$('#more-filters').focus()}};
$('#grades').onclick=e=>{const b=e.target.closest('[data-grade]');if(b)setGrade(+b.dataset.grade)};
$('#subjects').onclick=e=>{const b=e.target.closest('[data-subject]');if(b){state.subject=+b.dataset.subject;render()}};
$('#year').onchange=e=>{state.year=+e.target.value;render()};
$('#language').onchange=e=>{state.language=e.target.value;render()};
$('#boardType').onchange=e=>{state.type=e.target.value;render()};
fetch('data/core.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{data=d;$('#loading').hidden=true;$('#dashboard').hidden=false;render()}).catch(()=>{$('#loading').innerHTML='<div class="error">The data could not be loaded. Check your connection and reload this page.</div>'});

const colors=['#28679d','#a5633d','#49756b','#79658d'];
const cache=new Map();
let renderToken=0, currentSchools=[], exportRows=[], chartRedraw=null, schoolChartRedraw=null;
const numeric=s=>/^\d+(\.\d+)?%?$/.test(String(s).trim())?Number(String(s).replace('%','')):null;
const rawLabel=(r,i)=>r?.values?.[i]!==null&&r?.values?.[i]!==undefined?pct(r.values[i]):esc(r?.raw?.[i]||'—');
const previous=r=>data.results.find(a=>a.year===r.year-1&&a.grade===r.grade&&a.id===r.id&&a.language===r.language);
const difference=(a,b)=>a===null||a===undefined||b===null||b===undefined?null:a-b;
const changeHTML=v=>`<span class="${v===null?'':v>=0?'positive':'negative'}">${delta(v)}</span>`;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,3500)}
function refreshUrl(){
  const p=new URLSearchParams();for(const k of ['view','grade','language','type','year','subject','focus'])p.set(k,state[k]);p.set('pins',state.pins.join(','));
  p.set('school',state.school);p.set('compare',state.comparisons.join(','));p.set('radius',state.radius);p.set('nearType',state.nearType);
  p.set('trendSubject',state.trendSubject);p.set('trendBoard',state.trendBoard);p.set('trendMinimum',state.trendMinimum);p.set('trendConsistent',state.trendConsistent?'1':'0');
  try{localStorage.setItem('eqao-my-school-v1',JSON.stringify({school:state.school,comparisons:state.comparisons,radius:state.radius,nearType:state.nearType,grade:state.grade,year:state.view==='archive'?2026:state.year}))}catch{}
  const url=`${location.pathname}?${p}`,snapshot={eqao:{...state}};
  if(pushNavigation&&url!==`${location.pathname}${location.search}`)history.pushState(snapshot,'',url);
  else history.replaceState(snapshot,'',url);
  pushNavigation=false;
}
function restoreUrl(useSaved=true){
  Object.assign(state,defaultState());
  try{
    const saved=useSaved?JSON.parse(localStorage.getItem('eqao-my-school-v1')):null;
    if(saved){if(/^\d{6}$/.test(saved.school))state.school=saved.school;if(Array.isArray(saved.comparisons))state.comparisons=saved.comparisons.filter(x=>/^\d{6}$/.test(x)).slice(0,4);if([1,3,5,10,25,50].includes(saved.radius))state.radius=saved.radius;if(['all','Public','Catholic','Other authority'].includes(saved.nearType))state.nearType=saved.nearType;if([3,6].includes(saved.grade))state.grade=saved.grade;if([2022,2023,2024,2025,2026].includes(saved.year))state.year=saved.year;}
  }catch{}
  const p=new URLSearchParams(location.search);
  for(const [k,allowed] of Object.entries({view:['myschool','boards','schools','trends','archive','sources'],language:['en','fr'],type:['all','Public','Catholic','Other authority','everything'],nearType:['all','Public','Catholic','Other authority'],trendSubject:['all','0','1','2']}))if(allowed.includes(p.get(k)))state[k]=p.get(k);
  if(/^\d{5}$/.test(p.get('trendBoard')||''))state.trendBoard=p.get('trendBoard');
  if(p.has('trendMinimum')&&[0,20,30,50,100].includes(+p.get('trendMinimum')))state.trendMinimum=+p.get('trendMinimum');
  state.trendConsistent=p.get('trendConsistent')==='1';
  for(const [k,allowed] of Object.entries({grade:[3,6],year:[2018,2019,2022,2023,2024,2025,2026],subject:[0,1,2]}))if(p.has(k)&&allowed.includes(+p.get(k)))state[k]=+p.get(k);
  if(p.has('pins'))state.pins=p.get('pins').split(',').filter(x=>/^\d{5}$/.test(x)).slice(0,4);
  if(/^\d{5}$/.test(p.get('focus')||''))state.focus=p.get('focus');
  if(p.has('school'))state.school=/^\d{6}$/.test(p.get('school'))?p.get('school'):'';
  if(!p.has('view'))state.view=state.school?'myschool':'trends';
  if(p.has('compare'))state.comparisons=p.get('compare').split(',').filter(x=>/^\d{6}$/.test(x)).slice(0,4);
  if(p.has('radius')&&[1,3,5,10,25,50].includes(+p.get('radius')))state.radius=+p.get('radius');
  if(state.view==='archive'&&state.year>2019)state.year=2019;
  if(state.view!=='archive'&&state.year<2022)state.year=2026;
  $('#language').value=state.language;$('#boardType').value=state.type;
}
restoreUrl();
window.addEventListener('popstate',event=>{
  pushNavigation=false;
  if(event.state?.eqao)Object.assign(state,defaultState(),event.state.eqao);
  else restoreUrl(false);
  $('#language').value=state.language;$('#boardType').value=state.type;
  $('#school-chooser').open=false;$('#school-picker-search').value='';
  updateSchoolPicker();render();
});
for(const link of $$('.brand'))link.onclick=event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();setView(state.school?'myschool':'trends');$('#main').scrollIntoView({block:'start'});
};
function render(){
  if(!data)return;
  const token=++renderToken;chartRedraw=null;schoolChartRedraw=null;
  const displayView=state.view;
  if(displayView==='myschool'&&schoolInfo(state.school)){state.language=schoolInfo(state.school).language;$('#language').value=state.language}
  const rs=results().sort((a,b)=>a.name.localeCompare(b.name));
  if(state.view!=='archive'){
    const available=new Set(rs.map(r=>r.id));
    state.pins=state.pins.filter(id=>available.has(id));
    if(!available.has(state.focus))state.focus=state.pins[0]||rs[0]?.id||'';
    if(!state.pins.length&&state.focus)state.pins=[state.focus];
  }
  $$('#grades button').forEach(b=>{const on=+b.dataset.grade===state.grade;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',on)});
  $$('#subjects button').forEach(b=>{const on=+b.dataset.subject===state.subject;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
  $$('[data-view]').forEach(b=>{const on=b.dataset.view===state.view||(b.closest('#views')&&b.dataset.view==='trends'&&state.view==='schools');b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  $('#explore-views').hidden=!['trends','schools'].includes(displayView);
  const titles={myschool:['SELECTED SCHOOL','Start with your school.','See how it’s doing, follow the changes, and find useful questions to ask.'],boards:['BOARD COMPARISON','A clearer view of achievement.','Compare Ontario’s school boards and follow results over time.'],schools:['SCHOOL EXPLORER','Look closer, school by school.','Find a school, compare its results, and explore its recent history.'],archive:['HISTORICAL ARCHIVE','Before the digital assessments.','Explore the oldest province-wide raw school results located in the current public catalogues.'],sources:['SOURCES & COVERAGE','Know what is behind the numbers.','Original files, definitions, data coverage, and reproducible downloads.']};
  titles.trends=['SCHOOL TRENDS','School result trends',''];
  const title=titles[displayView];$('#section-label').textContent=title[0];$('#page-title').textContent=title[1];$('#page-description').textContent=title[2];
  $('#section-label').hidden=displayView==='trends';$('#page-description').hidden=displayView==='trends';
  syncFilters(displayView);$('#export').hidden=state.view==='sources';$('#export').disabled=false;
  $('#choose-school').hidden=['sources','archive'].includes(displayView);
  document.body.classList.toggle('school-home',displayView==='myschool');
  const years=state.view==='archive'?data.archiveYears:data.years;
  $('#year').innerHTML=[...years].reverse().map(y=>`<option value="${y}" ${y===state.year?'selected':''}>${yearLabel(y)}</option>`).join('');
  const notice=$('#notice');notice.hidden=true;
  if(state.view==='archive'){notice.hidden=false;notice.innerHTML='<strong>Different measurement basis.</strong> These Ministry workbooks contain school-level results. Any board summary below is an unweighted mean of reported school percentages, not an official board result. Assessment format and reporting changed after 2018–19; these results are kept separate from the current series.'}
  else if(state.year===2022&&state.view!=='sources'){notice.hidden=false;notice.innerHTML='<strong>2021–22 calculation note.</strong> EQAO says these CSV values may differ from its interactive dashboards because of calculation methods. This app uses the published CSV values consistently.'}
  refreshUrl();
  if(displayView==='myschool'&&!state.school){
    $('#export').hidden=true;exportRows=[];
    $('#content').innerHTML='<section class="welcome-panel"><p>Choose a school to see reading, writing and mathematics together, with Ontario benchmarks and changes over time.</p><button id="welcome-choose" class="button">Find your school</button></section>';
    $('#welcome-choose').onclick=()=>{$('#school-chooser').open=true;$('#school-picker-search').focus()};
  }
  else if(displayView==='myschool')renderMySchool(token);
  else if(displayView==='trends')renderSchoolTrends(token);
  else if(state.view==='boards')renderBoards(rs);
  else if(state.view==='sources')renderSources();
  else renderSchools(token);
}
function card(label,value,note,primary=false){return `<div class="card ${primary?'primary':''}"><div class="label">${label}</div><div class="stat">${value}</div><div class="sub">${note}</div></div>`}
function trendFinding(values,years,selectedIndex,subject){
  const end=values[selectedIndex],start=values[0],change=difference(end,start);
  if(change===null)return `${subject} over time`;
  if(selectedIndex===0)return `${pct(end)} met the ${subject.toLowerCase()} standard in ${yearLabel(years[0])}`;
  if(change===0)return `${subject} is at its ${yearLabel(years[0])} level`;
  return `${subject} is ${change>0?'up':'down'} ${Number(Math.abs(change).toFixed(1))} ${Math.abs(change)===1?'point':'points'} since ${yearLabel(years[0])}`;
}
function renderBoards(rs){
  const p=province(),i=state.subject,vals=rs.map(r=>r.values[i]).filter(v=>v!==null).sort((a,b)=>a-b),mid=Math.floor(vals.length/2),med=vals.length?(vals.length%2?vals[mid]:(vals[mid-1]+vals[mid])/2):null;
  const pd=difference(p?.values[i],province(state.year-1)?.values[i]);
  $('#content').innerHTML=`<div class="cards">${card(`Ontario · ${state.language==='en'?'English':'French'}`,pct(p?.values[i]),`${changeHTML(pd)} vs previous year`,true)}${card('Median board',pct(med),'Each selected board counts equally')}${card('Boards reporting',`${vals.length} <small>/ ${rs.length}</small>`,'Published numeric results')}${card('Fully participating',number(p?.participants[i]),'Students across this language system')}</div>
  <div class="panels"><section class="panel trend-panel"><div class="panel-head"><div><p class="eyebrow">01 / THE LONGER VIEW</p><h2>${trendFinding(data.years.map(y=>province(y)?.values[i]??null),data.years,data.years.indexOf(state.year),subjects[i])}</h2><p>Ontario’s ${state.language==='en'?'English':'French'}-language system · Grade ${state.grade} ${subjects[i].toLowerCase()} · ${yearLabel(state.year)}</p></div></div><div id="trend" class="chart"></div><div class="chart-readout" id="trend-readout" aria-live="polite">Hover, tap or focus a point to explore a year.</div><p class="chart-caption">Source: <a href="downloads/${encodeURIComponent(p?.source||'')}" download>EQAO achievement data</a> · Fully participating students at Levels 3 and 4. The vertical shading marks the selected school year. Annual results describe different groups of students. The 2021–22 CSV uses a different calculation method from EQAO’s interactive dashboard.</p><div class="pin-controls"><label for="add-board">Compare up to four boards with Ontario</label><select id="add-board"><option value="">Add a school board…</option>${rs.filter(r=>!state.pins.includes(r.id)).map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select><div id="pins" class="chips">${state.pins.map((id,j)=>`<span class="chip"><span class="swatch" style="background:${colors[j]}"></span>${esc(board(id)?.name)}<button data-unpin="${id}" aria-label="Remove ${esc(board(id)?.name)} from comparison">×</button></span>`).join('')}</div></div></section>
  <section class="panel focus-panel" id="focus-panel"></section></div>
  <section class="panel detail-panel"><div class="panel-head"><div><p class="eyebrow">02 / COMPARE THE DETAILS</p><h2>Across Ontario’s boards</h2><p>Students at the provincial standard (%) · select a board for its profile, or + to compare its trend.</p></div><span class="badge">${yearLabel(state.year)}</span></div><div class="table-toolbar"><span class="small muted" id="board-count"></span><input class="search" id="board-search" type="search" placeholder="Search school boards…" aria-label="Search school boards" value="${esc(state.search)}"></div><div class="table-wrap" id="board-table"></div><div class="table-bottom"><span id="board-page-label"></span><div class="pagination"><button id="board-prev" aria-label="Previous boards">‹</button><button id="board-next" aria-label="Next boards">›</button></div></div><p class="chart-caption" style="margin:18px 0 0">pp = percentage points. Both difference columns refer to ${subjects[i].toLowerCase()}. The Ontario benchmark includes public and provincial schools in the selected language system; it does not change with the board-type filter.</p></section>`;
  const analysis=document.createElement('details');analysis.id='board-analysis';analysis.className='school-disclosure';analysis.open=Boolean(ui.boardDetails);
  analysis.innerHTML='<summary>Explore board trends and student groups <span>Historical comparisons and board profiles</span></summary>';
  analysis.append($('.cards'),$('.panels'));$('#content').append(analysis);
  $('#content').insertAdjacentHTML('afterbegin',`<section class="board-overview" aria-label="Ontario benchmarks"><p class="small muted">Ontario · ${state.language==='en'?'English':'French'}-language · students meeting or exceeding the provincial standard</p><div>${subjects.map((s,j)=>`<p><span>${s}</span><strong>${rawLabel(p,j)}</strong></p>`).join('')}</div></section>`);
  analysis.addEventListener('toggle',()=>{ui.boardDetails=analysis.open;if(analysis.open)chartRedraw?.()});
  const chartSeries=[{name:'Ontario',color:'#626b60',dashed:true,values:data.years.map(y=>province(y)?.values[i]??null)},...state.pins.map((id,j)=>({name:board(id)?.name||id,color:colors[j],values:data.years.map(y=>data.results.find(r=>r.id===id&&r.year===y&&r.grade===state.grade&&r.language===state.language)?.values[i]??null)}))];
  chartRedraw=()=>drawTrend($('#trend'),chartSeries,data.years,$('#trend-readout'),{selectedYear:state.year,annotate:true});
  chartRedraw();
  $('#add-board').onchange=e=>{if(!e.target.value)return;if(state.pins.length>=4){toast('Remove a board before adding another.');e.target.value='';return}state.pins.push(e.target.value);state.focus=e.target.value;render()};
  $('#pins').onclick=e=>{const b=e.target.closest('[data-unpin]');if(b){state.pins=state.pins.filter(id=>id!==b.dataset.unpin);render()}};
  $('#board-search').oninput=e=>{state.search=e.target.value;state.page=0;renderBoardTable(rs)};
  $('#board-prev').onclick=()=>{state.page--;renderBoardTable(rs)};$('#board-next').onclick=()=>{state.page++;renderBoardTable(rs)};
  renderFocus(rs);renderBoardTable(rs);
}
function drawTrend(el,series,years,readout,options={}){
  if(!el)return;
  const w=Math.max(240,el.clientWidth),compact=Boolean(options.compact),direct=!compact&&w>=580,h=compact?180:direct?350:310;
  const m={l:38,r:direct?158:12,t:compact?15:options.annotate?82:42,b:compact?32:38},iw=w-m.l-m.r,ih=h-m.t-m.b;
  const numericValues=series.flatMap(s=>s.values).filter(v=>Number.isFinite(v));
  let lower=options.fixedScale?0:numericValues.length?Math.max(0,Math.floor((Math.min(...numericValues)-8)/10)*10):0;
  let upper=options.fixedScale?100:numericValues.length?Math.min(100,Math.ceil((Math.max(...numericValues)+8)/10)*10):100;
  if(upper-lower<30){lower=Math.max(0,upper-30);upper=Math.min(100,lower+30)}
  const x=j=>m.l+j*iw/Math.max(1,years.length-1),y=v=>m.t+ih*(1-(v-lower)/(upper-lower));
  const title='Students at the provincial standard (%)';
  let html=`<svg viewBox="0 0 ${w} ${h}" role="group" aria-label="${title}. The vertical scale runs from ${lower}% to ${upper}%. Focus or tap a point for details."><title>${title}</title><desc>Lines show annual school-year results. Gaps indicate missing or suppressed results. Line charts use a labelled scale; subject-profile bars use the full 0 to 100% scale.</desc>`;
  const selected=years.indexOf(options.selectedYear);
  if(selected>=0)html+=`<rect class="selected-year-band" x="${Math.max(m.l,x(selected)-15)}" y="${m.t-9}" width="${Math.min(w-m.r,x(selected)+15)-Math.max(m.l,x(selected)-15)}" height="${ih+9}" fill="#efeee7"/>`;
  if(!compact)html+=`<text class="axis-label" x="${m.l}" y="18">${title}</text>`;
  const tickStep=compact?50:upper-lower>60?20:10;
  const ticks=[];for(let v=lower;v<=upper;v+=tickStep)ticks.push(v);if(ticks.at(-1)!==upper)ticks.push(upper);
  ticks.forEach(v=>{html+=`<line x1="${m.l}" x2="${w-m.r}" y1="${y(v)}" y2="${y(v)}" stroke="#dedfd8" stroke-width=".7"/><text x="${m.l-10}" y="${y(v)+4}" text-anchor="end">${v}%</text>`});
  years.forEach((yr,j)=>{html+=`<text x="${x(j)}" y="${h-15}" text-anchor="${j===0?'start':j===years.length-1?'end':'middle'}" style="${yr===options.selectedYear?'fill:#252824;font-weight:600':''}"><title>${yearLabel(yr)}</title>${w<460?`${String(yr-1).slice(2)}–${String(yr).slice(2)}`:yearLabel(yr)}</text>`});
  series.forEach((s,si)=>{
    let path='',prev=null;
    s.values.forEach((v,j)=>{if(!Number.isFinite(v)){prev=null;return}path+=`${prev===null?'M':'L'}${x(j)},${y(v)} `;prev=j});
    html+=`<path class="trend-line" data-series="${esc(s.name)}" d="${path}" fill="none" stroke="${s.color}" stroke-width="${s.dashed?1.8:2.3}" stroke-linejoin="round" stroke-linecap="round" ${s.dashed?'stroke-dasharray="4 4"':''}/>`;
    s.values.forEach((v,j)=>{if(Number.isFinite(v)){const label=`${s.name} · ${yearLabel(years[j])} · ${pct(v)}`;html+=`<circle tabindex="0" role="button" aria-label="${esc(label)}" data-label="${esc(label)}" cx="${x(j)}" cy="${y(v)}" r="${j===selected?4.5:3.5}" fill="${s.color}"><title>${esc(label)}</title></circle>`}});
  });
  if(options.annotate&&series[0]){
    const vs=series[0].values,valid=vs.map((v,j)=>({v,j})).filter(a=>Number.isFinite(a.v));
    if(valid.length>1){
      const low=valid.reduce((a,b)=>b.v<a.v?b:a),noteX=Math.max(m.l+8,Math.min(x(low.j)-55,w-m.r-135));
      html+=`<g class="chart-annotation"><path d="M${noteX+60},64 L${x(low.j)},${y(low.v)-8}" fill="none" stroke="#a7ad9e" stroke-width="1"/><text class="annotation-text" x="${noteX}" y="43">${yearLabel(years[low.j])} · ${pct(low.v)}</text><text class="annotation-text" x="${noteX}" y="59" style="fill:#686c66">${valid.every(a=>a.v===low.v)?'Ontario stayed at this level':'Ontario’s series low'}</text></g>`;
    }
  }
  const endpoints=series.map(s=>{const j=s.values.findLastIndex(v=>Number.isFinite(v));return j<0?null:{...s,j,value:s.values[j],target:y(s.values[j])}}).filter(Boolean);
  if(direct){
    const ordered=[...endpoints].sort((a,b)=>a.target-b.target),gap=34;
    ordered.forEach((s,j)=>{s.labelY=Math.max(m.t+10,s.target,j?ordered[j-1].labelY+gap:0)});
    if(ordered.length&&ordered.at(-1).labelY>h-m.b-8){
      ordered.at(-1).labelY=h-m.b-8;
      for(let j=ordered.length-2;j>=0;j--)ordered[j].labelY=Math.min(ordered[j].labelY,ordered[j+1].labelY-gap);
    }
    ordered.forEach(s=>{
      const label=s.name.length>23?s.name.slice(0,22)+'…':s.name;
      html+=`<path d="M${x(s.j)+5},${s.target} L${w-m.r+9},${s.labelY} L${w-m.r+15},${s.labelY}" fill="none" stroke="${s.color}" stroke-width=".9"/><text class="end-label" x="${w-m.r+21}" y="${s.labelY-3}" style="fill:${s.color}"><title>${esc(s.name)}</title>${esc(label)}<tspan x="${w-m.r+21}" dy="15" font-weight="400">${pct(s.value)}${s.j<years.length-1?` · ${yearLabel(years[s.j])}`:''}</tspan></text>`;
    });
  }
  html+='</svg>';
  if(!direct)html+=`<div class="chart-key">${series.map(s=>{const endpoint=endpoints.find(e=>e.name===s.name);return `<div class="chart-key-item"><i class="swatch" style="background:${s.color};${s.dashed?'background:repeating-linear-gradient(to right,'+s.color+' 0 4px,transparent 4px 7px)':''}"></i><span>${esc(s.name)}${endpoint&&endpoint.j<years.length-1?` <small>(${yearLabel(years[endpoint.j])})</small>`:''}</span><strong style="color:${s.color}">${endpoint?pct(endpoint.value):'—'}</strong></div>`}).join('')}</div>`;
  el.innerHTML=html;
  const show=e=>{const p=e.target.closest('[data-label]');if(p&&readout)readout.textContent=p.dataset.label};
  el.onpointerover=show;el.onclick=show;el.onfocusin=show;
  el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){const p=e.target.closest('[data-label]');if(p){e.preventDefault();show(e)}}};
}
function renderFocus(rs){
  const r=rs.find(r=>r.id===state.focus),p=province();
  const gap=difference(r?.values[state.subject],p?.values[state.subject]);
  const insight=gap===null?'No numeric comparison is available for this subject.':gap===0?`${esc(r.name)} matches Ontario in ${subjects[state.subject].toLowerCase()}.`:`${esc(r.name)} is ${Number(Math.abs(gap).toFixed(1))} percentage ${Math.abs(gap)===1?'point':'points'} ${gap>0?'above':'below'} Ontario in ${subjects[state.subject].toLowerCase()}.`;
  $('#focus-panel').innerHTML=`<div class="panel-head"><div><p class="eyebrow">SELECTED BOARD</p><h2>A board in focus</h2><p>All three subjects · Grade ${state.grade} · ${yearLabel(state.year)}</p></div></div><label class="skip-label" for="focus-board" style="display:none">Board profile selection</label><select id="focus-board" aria-label="Board profile selection" class="focus-select">${rs.map(a=>`<option value="${a.id}" ${a.id===state.focus?'selected':''}>${esc(a.name)}</option>`).join('')}</select><p class="profile-insight">${insight}</p><div class="profile-scale"><span>0%</span><span>Students at standard</span><span>100%</span></div>${r?subjects.map((s,i)=>`<div class="metric-row"><div class="metric-top"><span>${s}</span><strong>${rawLabel(r,i)}</strong></div><div class="track"><div class="fill" style="width:${r.values[i]??0}%;background:${i===state.subject?'var(--blue)':'#a9afa3'}"></div>${p?.values[i]!=null?`<i class="benchmark" style="left:${p.values[i]}%" title="Ontario: ${pct(p.values[i])}"></i>`:''}</div><div class="metric-foot">${changeHTML(difference(r.values[i],p?.values[i]))} vs Ontario · ${number(r.participants[i])} students</div></div>`).join(''):'<div class="empty">No board results in this selection.</div>'}<div class="focus-foot">Thin markers show Ontario. All bars share a 0–100% scale.${r?`<br>${esc(board(r.id)?.type)} · Board ${r.id}<details><summary>Student groups · ${subjects[state.subject]}</summary><table><tbody>${Object.entries({G1:'Male',G2:'Female',E1:'Language learners',S1:'Special education needs (excluding gifted)'}).map(([g,label])=>`<tr><td>${label}</td><td class="numeric">${esc(r.groups[g][state.subject])}</td></tr>`).join('')}</tbody></table><p>Groups can overlap and do not add up to a total. Missing or suppressed results are preserved.</p></details>`:''}</div>`;
  $('#focus-board').onchange=e=>{state.focus=e.target.value;renderFocus(rs);renderBoardTable(rs);refreshUrl()};
}
function sortedRows(rows){
  const list=[...rows];list.sort((a,b)=>{if(state.sort==='name')return state.direction*a.name.localeCompare(b.name);const i=Number(state.sort);const av=a.values[i],bv=b.values[i];if(av==null)return bv==null?a.name.localeCompare(b.name):1;if(bv==null)return -1;return state.direction*(av-bv)||a.name.localeCompare(b.name)});return list;
}
function sortableHeader(label,key){return `<button data-sort="${key}">${label}${state.sort===key?(state.direction===1?' ↑':' ↓'):''}</button>`}
function metricCell(r,i){return `<td class="numeric ${i===state.subject?'subject-col':''}"><span class="table-bar">${r.values[i]!==null?`<span class="mini-track"><i style="width:${r.values[i]}%"></i></span>`:''}<span>${rawLabel(r,i)}</span></span></td>`}
function renderBoardTable(rs){
  const q=state.search.trim().toLocaleLowerCase(),rows=sortedRows(rs.filter(r=>r.name.toLocaleLowerCase().includes(q)||r.id.includes(q))),size=15,pages=Math.max(1,Math.ceil(rows.length/size));state.page=Math.min(Math.max(0,state.page),pages-1);
  $('#board-count').textContent=`${rows.length} boards · ${state.language==='en'?'English':'French'}-language`;
  $('#board-table').innerHTML=`<table><thead><tr><th>${sortableHeader('School board','name')}</th>${subjects.map((s,i)=>`<th class="numeric ${i===state.subject?'subject-col':''}" aria-sort="${state.sort===String(i)?state.direction===1?'ascending':'descending':'none'}">${sortableHeader(s,String(i))}</th>`).join('')}<th class="numeric">vs Ontario</th><th class="numeric">Year change</th><th>Compare</th></tr></thead><tbody>${rows.slice(state.page*size,(state.page+1)*size).map(r=>`<tr class="${r.id===state.focus?'selected-row':''}"><td class="name-cell"><button data-focus="${r.id}">${esc(r.name)}</button><small>${esc(board(r.id)?.type)} · ${r.id}</small></td>${subjects.map((s,i)=>metricCell(r,i)).join('')}<td class="numeric">${changeHTML(difference(r.values[state.subject],province()?.values[state.subject]))}</td><td class="numeric">${changeHTML(difference(r.values[state.subject],previous(r)?.values[state.subject]))}</td><td><button class="pin-button ${state.pins.includes(r.id)?'on':''}" data-pin="${r.id}" aria-label="${state.pins.includes(r.id)?'Remove':'Compare'} ${esc(r.name)}" aria-pressed="${state.pins.includes(r.id)}">${state.pins.includes(r.id)?'−':'+'}</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">No boards match this search. Try a shorter name or change the filters.</td></tr>'}</tbody></table>`;
  $('#board-page-label').textContent=rows.length?`${state.page*size+1}–${Math.min((state.page+1)*size,rows.length)} of ${rows.length}`:'No matching boards';$('#board-prev').disabled=state.page===0;$('#board-next').disabled=state.page===pages-1;
  $('#board-table').onclick=e=>{const s=e.target.closest('[data-sort]'),f=e.target.closest('[data-focus]'),p=e.target.closest('[data-pin]');if(s){state.direction=state.sort===s.dataset.sort?-state.direction:s.dataset.sort==='name'?1:-1;state.sort=s.dataset.sort;state.page=0;renderBoardTable(rs)}if(f){$('#board-analysis').open=true;state.focus=f.dataset.focus;renderFocus(rs);renderBoardTable(rs);refreshUrl();if(innerWidth<760)$('#focus-panel').scrollIntoView({behavior:'smooth',block:'start'})}if(p){ui.boardDetails=true;if(state.pins.includes(p.dataset.pin))state.pins=state.pins.filter(id=>id!==p.dataset.pin);else if(state.pins.length<4)state.pins.push(p.dataset.pin);else{toast('You can compare up to four boards. Remove one first.');return}render()}};
  exportRows=rows.map(r=>({school_year:yearLabel(r.year),grade:r.grade,board_id:r.id,board_name:r.name,language:r.language,reading:r.raw[0],writing:r.raw[1],mathematics:r.raw[2],reading_participants:r.participants[0],writing_participants:r.participants[1],math_participants:r.participants[2],source:r.source,metric:'Percent of fully participating students at Levels 3 and 4'}));
}
async function getSchools(year,grade){
  const key=`${year}-${grade}`;if(!cache.has(key))cache.set(key,fetch(`data/schools-${key}.json`).then(r=>{if(!r.ok)throw Error('School file unavailable');return r.json()}).catch(e=>{cache.delete(key);throw e}));return cache.get(key);
}
async function renderSchools(token){
  $('#content').innerHTML='<div class="panel muted" role="status">Loading school results…</div>';
  try{
    const rows=await getSchools(state.year,state.grade);if(token!==renderToken)return;currentSchools=rows.filter(r=>matches(board(r.board))&&r.language===state.language);
    const present=new Set(currentSchools.map(r=>r.board)),bs=data.boards.filter(b=>present.has(b.id)).sort((a,b)=>a.name.localeCompare(b.name));
    if(state.schoolBoard!=='all'&&!present.has(state.schoolBoard))state.schoolBoard='all';
    $('#content').innerHTML=`${state.view==='archive'?`<section class="panel" style="margin-bottom:20px"><div class="panel-head"><div><h2>School averages by board</h2><p>Unweighted mean of reported school ${subjects[state.subject].toLowerCase()} percentages. Each school counts equally.</p></div><span class="badge">Not an official board score</span></div><div class="table-wrap" id="archive-summary"></div><details><summary>Why this is a separate series</summary><p class="prose">The historical files do not provide grade-specific student counts, so a student-weighted board result cannot be reconstructed. Suppressed, withheld, unavailable and bounded values are excluded from means. The number of schools used is shown for every board. No values have been inferred from three-year change columns.</p></details></section>`:''}<section class="panel"><div class="panel-head"><div><h2>${state.view==='archive'?'Historical school results':'School results'}</h2><p>Grade ${state.grade} · ${yearLabel(state.year)} · click a school for its history</p></div></div><div class="school-filters"><div><label for="school-board">School board</label><select id="school-board"><option value="all">All matching boards</option>${bs.map(b=>`<option value="${b.id}" ${state.schoolBoard===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></div><div><label for="school-search">Find a school</label><input id="school-search" type="search" value="${esc(state.search)}" placeholder="School name, city or number…"></div></div><div class="table-wrap" id="school-table"></div><div class="table-bottom"><span id="school-count"></span><div class="pagination"><button id="school-prev" aria-label="Previous schools">‹</button><button id="school-next" aria-label="Next schools">›</button></div></div><p class="small muted" style="margin:20px 0 0">N/R or S. R. = suppressed · N/D or A/D = no data · W = withheld · NA = not applicable. A missing result is never treated as zero.</p></section>`;
    $('#school-search').oninput=e=>{state.search=e.target.value;state.page=0;renderSchoolTable()};$('#school-board').onchange=e=>{state.schoolBoard=e.target.value;state.page=0;renderSchoolTable();if(state.view==='archive')renderArchiveSummary()};
    $('#school-prev').onclick=()=>{state.page--;renderSchoolTable()};$('#school-next').onclick=()=>{state.page++;renderSchoolTable()};
    renderSchoolTable();if(state.view==='archive')renderArchiveSummary();
  }catch(e){if(token===renderToken)$('#content').innerHTML='<div class="error">School results could not be loaded. <button id="retry-schools" class="button secondary">Try again</button></div>';$('#retry-schools')?.addEventListener('click',render)}
}
function renderSchoolTable(){
  const q=state.search.trim().toLocaleLowerCase(),rows=sortedRows(currentSchools.filter(r=>(state.schoolBoard==='all'||r.board===state.schoolBoard)&&(!q||`${r.name} ${r.city} ${r.id}`.toLocaleLowerCase().includes(q)))),size=20,pages=Math.max(1,Math.ceil(rows.length/size));state.page=Math.min(Math.max(state.page,0),pages-1);
  $('#school-table').innerHTML=`<table><thead><tr><th>${sortableHeader('School','name')}</th>${subjects.map((s,i)=>`<th class="numeric ${i===state.subject?'subject-col':''}">${sortableHeader(s,String(i))}</th>`).join('')}<th class="numeric">${state.view==='archive'?'School ID':'Participating*'}</th></tr></thead><tbody>${rows.slice(state.page*size,(state.page+1)*size).map(r=>`<tr><td class="name-cell"><button data-school="${r.id}">${esc(r.name)}</button><small>${esc(board(r.board)?.name||r.board)}${r.city?` · ${esc(r.city)}`:''}</small></td>${subjects.map((s,i)=>metricCell(r,i)).join('')}<td class="numeric">${state.view==='archive'?r.id:number(r.participants[state.subject])}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No schools match these filters.</td></tr>'}</tbody></table>`;
  $('#school-count').textContent=rows.length?`${state.page*size+1}–${Math.min((state.page+1)*size,rows.length)} of ${rows.length} schools${state.view==='archive'?'':` · *${subjects[state.subject]}`}`:'No matching schools';$('#school-prev').disabled=state.page===0;$('#school-next').disabled=state.page===pages-1;
  $('#school-table').onclick=e=>{const s=e.target.closest('[data-sort]'),b=e.target.closest('[data-school]');if(s){state.direction=state.sort===s.dataset.sort?-state.direction:s.dataset.sort==='name'?1:-1;state.sort=s.dataset.sort;state.page=0;renderSchoolTable()}if(b)showSchool(b.dataset.school)};
  exportRows=rows.map(r=>({school_year:yearLabel(state.year),grade:state.grade,school_id:r.id,school_name:r.name,board_id:r.board,board_name:board(r.board)?.name,language:r.language,reading:r.raw[0],writing:r.raw[1],mathematics:r.raw[2],source:r.source,metric:state.view==='archive'?'Historical school percentage as published in Ministry workbook':'Percent of fully participating students at Levels 3 and 4'}));
}
function renderArchiveSummary(){
  const i=state.subject,groups=new Map();for(const r of currentSchools){if(state.schoolBoard!=='all'&&r.board!==state.schoolBoard)continue;if(!groups.has(r.board))groups.set(r.board,[]);groups.get(r.board).push(r)}
  const rows=[...groups].map(([id,rs])=>{const vals=rs.map(r=>r.values[i]).filter(v=>v!==null);return {id,name:board(id)?.name||id,n:vals.length,total:rs.length,value:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null}}).sort((a,b)=>a.name.localeCompare(b.name));
  $('#archive-summary').innerHTML=`<div style="max-height:310px;overflow:auto"><table><thead><tr><th>School board</th><th class="numeric">School mean</th><th class="numeric">Schools used / listed</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="name-cell"><button data-archive-board="${r.id}">${esc(r.name)}</button></td><td class="numeric">${pct(r.value)}</td><td class="numeric">${r.n} / ${r.total}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">No historical results for these filters.</td></tr>'}</tbody></table></div>`;
  $('#archive-summary').onclick=e=>{const b=e.target.closest('[data-archive-board]');if(b){state.schoolBoard=b.dataset.archiveBoard;$('#school-board').value=state.schoolBoard;state.page=0;renderSchoolTable();renderArchiveSummary()}};
}
async function showSchool(id){
  const dialog=$('#school-dialog'),el=$('#school-detail'),grade=state.grade,lang=state.language,archive=state.view==='archive',years=archive?data.archiveYears:data.years,selectedYear=state.year;
  const school=currentSchools.find(r=>r.id===id);if(!school)return;
  dialog.showModal();el.innerHTML=`<p class="eyebrow">SCHOOL ${id} · GRADE ${grade}</p><h2>${esc(school.name)}</h2><p class="muted small">${esc(board(school.board)?.name)} · ${esc(school.city||'Ontario')}</p><div class="muted" role="status">Loading history…</div>`;
  try{
    const all=await Promise.all(years.map(y=>getSchools(y,grade)));if(!dialog.open)return;
    const historyRows=all.map(rs=>rs.find(r=>r.id===id&&r.language===lang));
    el.innerHTML=`<p class="eyebrow">SCHOOL ${id} · GRADE ${grade}</p><h2>${esc(school.name)}</h2><p class="muted small">${esc(board(school.board)?.name)} · ${esc(school.city||'Ontario')}</p>${archive?'<div class="notice">Historical Ministry school percentages. Kept separate from current digital assessments.</div>':`<button class="button" data-use-school="${id}">Make this my school</button>`}<div id="school-trend" class="chart"></div><div class="chart-readout" id="school-readout" aria-live="polite">Tap a point to see the result.</div><div class="table-wrap"><table><thead><tr><th>School year</th>${subjects.map(s=>`<th class="numeric">${s}</th>`).join('')}</tr></thead><tbody>${historyRows.map((r,j)=>`<tr><td>${yearLabel(years[j])}</td>${subjects.map((s,i)=>`<td class="numeric">${rawLabel(r,i)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="small muted" style="margin-top:18px">Missing and suppressed results remain gaps. These are different groups of students each year, not a tracked student cohort. School names and board membership can change.</p><a class="small" href="downloads/${encodeURIComponent(school.source)}" download>Download the original ${yearLabel(selectedYear)} source</a>`;
    schoolChartRedraw=()=>drawTrend($('#school-trend'),subjects.map((s,i)=>({name:s,color:subjectColors[i],values:historyRows.map(r=>r?.values[i]??null)})),years,$('#school-readout'),{selectedYear});
    schoolChartRedraw();
  }catch(e){el.insertAdjacentHTML('beforeend','<p class="error">The school history could not be loaded. Close this panel and try again.</p>')}
}
function renderSources(){
  const sourceUrl='https://www.eqao.com/about-eqao/open-data/';
  const sourceCount=category=>data.sources.filter(s=>s.category===category).length;
  const sourceBytes=data.sources.reduce((total,s)=>total+s.bytes,0);
  $('#content').innerHTML=`<div class="cards">${card('Original source files',number(data.sources.length),`${sourceCount('achievement')} result archives · ${sourceCount('definitions')} dictionaries · ${sourceCount('school-information')} workbooks`,true)}${card('Raw source size',`${(sourceBytes/1e6).toFixed(1)} <small>MB</small>`,'Publisher originals, preserved verbatim')}${card('Earliest located','2017–18','School results in Ontario’s current catalogue')}${card('Latest available','2025–26','Grade 3 and Grade 6 EQAO results')}</div><div class="coverage-grid"><section class="panel"><h2>What is available</h2><div class="timeline-row"><strong>2017–19</strong><div class="coverage-stripe legacy">Two historical school years. Grade 3 and Grade 6 reading, writing and mathematics. English and French schools.</div></div><div class="timeline-row"><strong>2019–21</strong><div class="coverage-stripe gap">No new Grade 3/6 results included. Ontario’s 2019–20 and 2020–21 files repeat the 2018–19 assessment results; archived but not counted again.</div></div><div class="timeline-row"><strong>2021–26</strong><div class="coverage-stripe">Five school years of official EQAO board, school and language-system provincial results. Achievement levels, participation and board student groups.</div></div><div class="timeline-row"><strong>Earlier</strong><div class="coverage-stripe gap">No earlier complete province-wide raw download was located in the current public catalogues. Older reports exist. Additional historical data requires a separate search or an <a href="${sourceUrl}" target="_blank" rel="noopener">EQAO data request</a>.</div></div></section><section class="panel prose"><h2>How to read the results</h2><p><strong>Provincial standard:</strong> Level 3 or 4. This is the percentage of students meeting the standard, not an average test mark.</p><p><strong>Current series:</strong> values come directly from EQAO’s published <code>pctOverallR/W/M_L34</code> fields for fully participating students. No school averaging is used for official board or Ontario results.</p><p><strong>Compare like with like:</strong> English- and French-language systems have separate benchmarks. The board-type filter changes the board list, not the provincial benchmark. “All district boards” excludes other authorities and provincial schools from the list.</p><p><strong>Changes:</strong> year changes use percentage points between published rounded percentages. Small differences may reflect rounding. These are repeated annual cohorts, not individual student progress or a measure of a board’s causal effect.</p></section></div><section class="panel prose" style="margin-bottom:20px"><h2>Method and limitations</h2><details open><summary>Gaps, suppressed values and comparability</summary><p>N/R and S. R. identify suppressed small groups. N/D and A/D identify no data. W means withheld. NA means not applicable. Bounded values such as &lt;1% remain text and are not plotted as exact values. None are replaced with zero or reconstructed from counts.</p><p>EQAO warns that 2021–22 CSV results may differ from its interactive dashboards. The historical school workbooks use their own published basis and lack grade-specific denominators. The historical board summaries are explicitly unweighted school means and cannot substitute for official board results. Older and current assessment series are not joined by a trend line.</p></details><details><summary>Processing and provenance</summary><p>Original ZIP and XLSX files are preserved with source URLs, byte sizes and SHA-256 hashes. All CSV parts are extracted locally. Charts use the first achievement CSV; published student-group percentages are joined from the second CSV by organisation type, ID and language. Only suppression-applied public records are used.</p><p>English and French Ontario workbook editions are language translations, each containing both school systems. Only the English edition is parsed to avoid duplication. The 2024–25 workbook supplies board type and school city labels. Current EQAO names and identifiers take precedence. A missing board classification is labelled “Other authority.”</p><p>Each numeric current-series achievement percentage was checked against its source numerator and fully participating denominator within half a percentage point. Source keys were checked for duplicates. <a href="data/sources.json" download>Download the source manifest</a> · <a href="data/audit.json" download>All-school source audit</a> · <a href="data/calculation-audit.json" download>Calculation audit</a> · <a href="data/publisher-audit.json" download>Publisher-file verification</a>.</p></details><details><summary>What the source archive contains</summary><p>All ten Grade 3/6 achievement ZIPs from 2021–22 through 2025–26, five annual aggregate field-definition workbooks, and all sixteen English/French school-information workbooks currently listed by Ontario (2017–18 through 2024–25). Questionnaire datasets are not included: this application focuses on achievement results.</p><p>School locations are contextual metadata, not geographic attendance boundaries. School composition, participation, curriculum and assessment changes can affect comparisons. School trends ranks descriptive annual changes, with an optional equal-weight mean across subjects; it is not a school-quality ranking.</p></details></section><section class="panel"><div class="panel-head"><div><h2>Download and inspect the data</h2><p>Original files are available here as well as on the publishers’ websites.</p></div><a class="button secondary" href="data/board-results.csv" download>All board results · CSV</a></div><p class="small"><a href="${sourceUrl}" target="_blank" rel="noopener">EQAO Open Data</a> · <a href="https://data.ontario.ca/dataset/school-information-and-student-demographics" target="_blank" rel="noopener">Ontario Data Catalogue</a> · <a href="https://www.ontario.ca/page/open-government-licence-ontario" target="_blank" rel="noopener">Open Government Licence – Ontario</a></p><ul class="source-list">${data.sources.map(s=>`<li><a href="downloads/${encodeURIComponent(s.path.split('/').pop())}" download>${esc(s.path.split('/').pop())}</a><small>${esc(s.publisher)} · ${(s.bytes/1e6).toFixed(2)} MB · <a href="${esc(s.url)}" target="_blank" rel="noopener">Publisher’s original</a></small></li>`).join('')}</ul></section>`;
}
function csvCell(v){
  let s=String(v??'');
  // Escape formula-like text while preserving signed numeric calculations.
  if(typeof v==='string'&&/^[=+@\-]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
function exportCSV(){
  if(!exportRows.length){toast('There are no matching rows to export.');return}
  const fields=Object.keys(exportRows[0]);
  const text='\ufeff'+[fields.map(csvCell).join(','),...exportRows.map(r=>fields.map(k=>csvCell(r[k])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`eqao-${state.view}-grade${state.grade}-${state.year}-${state.language}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`Exported ${exportRows.length} matching rows.`);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){setView(b.dataset.view);$('#main').scrollIntoView({block:'start'})}});
$('#export').onclick=exportCSV;
$('#school-dialog').addEventListener('close',()=>{schoolChartRedraw=null});
$('#footer-about').onclick=()=>$('#about-dialog').showModal();
for(const id of ['school-dialog','about-dialog']){
  const dialog=$(`#${id}`);
  $(`#${id} .dialog-close`).onclick=()=>dialog.close();
  dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}};
}
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{chartRedraw?.();schoolChartRedraw?.()},150)});
// An optional browser agent surface uses the same filters and export rows as the UI.
if(document.modelContext?.registerTool){
  try{Promise.resolve(document.modelContext.registerTool({name:'read_eqao_view',description:'Read the current EQAO dashboard filters and matching table records.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(input&&Object.keys(input).length)throw Error('No arguments expected');if(!data)throw Error('Data is still loading');return {filters:{...state},rows:exportRows}}})).catch(()=>{});}catch{}
}
