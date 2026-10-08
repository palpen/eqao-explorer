// Exercise the application's actual functions, with independent expectations.
// No copied calculation implementation is used as the function under test.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const read=async name=>JSON.parse(await fs.readFile(`${root}/site/data/${name}`,'utf8'));
const core=await read('core.json'),index=await read('schools-index.json');
const datasets=new Map(),maps=new Map();
for(const year of [...core.years,...core.archiveYears])for(const grade of [3,6]){
  const rows=await read(`schools-${year}-${grade}.json`);
  datasets.set(`${year}-${grade}`,rows);
  maps.set(`${year}-${grade}`,new Map(rows.map(r=>[`${r.language}-${r.id}`,r])));
}
const elements=new Map();
function element(selector){
  if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',value:'',clientWidth:1000,hidden:false,
    addEventListener(){},setAttribute(){},removeAttribute(){},classList:{toggle(){}},
    insertAdjacentHTML(position,html){this.innerHTML+=html;}});
  return elements.get(selector);
}
const context=vm.createContext({document:{querySelector:element,querySelectorAll:()=>[],body:element('body')},
  window:{addEventListener(){}},fetch:()=>new Promise(()=>{}),URLSearchParams,
  location:{search:'',pathname:'/'},localStorage:{getItem:()=>null,setItem(){}},history:{replaceState(){}},
  setTimeout:()=>0,clearTimeout(){},innerWidth:1440,console});
const sourceFiles=['site/app.js','site/school.js','site/trends.js'];
const testedSources=await Promise.all(sourceFiles.map(async path=>({path,text:await fs.readFile(`${root}/${path}`,'utf8')})));
for(const file of testedSources)vm.runInContext(file.text,context,{filename:file.path});
context.inputCore=core;context.inputIndex=index;
vm.runInContext('data=inputCore;schoolIndex=inputIndex;',context);
const api=vm.runInContext('({state,difference,numeric,pct,delta,rawLabel,csvCell,schoolSummary,relativeSummary,conversationFindings,distanceKm,schoolBoardResult,provincial,drawTrend,renderBoards,renderArchiveSummary,renderSources,renderNearbySchools,renderAchievementContext,sortedRows,schoolTrendSummary,rankSchoolTrends,trendDistribution})',context);
const counts={schoolSubjectPeriods:0,relativeComparisons:0,findings:0,chartSeries:0,boardSelections:0,archiveSelections:0,nearbyExports:0,distancePairs:0};
const value=(r,i)=>r?.values[i]??null;
const subtract=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?a-b:null;
const format=v=>v===null?'—':`${Number(v.toFixed(1))}%`;
const plain=v=>JSON.parse(JSON.stringify(v));
const benchmark=(language,year,grade)=>core.province.find(r=>r.language===language&&r.year===year&&r.grade===grade);
const boardRows=new Map(core.results.map(r=>[`${r.year}-${r.grade}-${r.language}-${r.id}`,r]));
const boardFor=(r,year,grade)=>r?boardRows.get(`${year}-${grade}-${r.language}-${r.board}`):undefined;
const record=(id,language,year,grade)=>maps.get(`${year}-${grade}`)?.get(`${language}-${id}`);

// Missing, suppressed and bounded percentages must never become numbers.
for(const marker of ['',' ','N/R','S. R.','N/D','A/D','W','NA','<1%','>99%','NaN','Infinity',null,undefined])assert.equal(api.numeric(marker),null,`numeric ${marker}`);
for(const v of [0,1,50,99,100])assert.equal(api.numeric(`${v}%`),v);
for(const absent of [null,undefined]){
  assert.equal(api.difference(absent,50),null);assert.equal(api.difference(50,absent),null);
}
for(const v of [-100,-13,-1,0,1,13,100,1.25])assert.equal(api.csvCell(v),`"${v}"`);
assert.equal(api.csvCell(null),'""');assert.equal(api.csvCell('=SUM(A1:A2)'),`"'=SUM(A1:A2)"`);
assert.equal(api.csvCell('a,"b"'),'"a,""b"""');

function assertChart(rows,years,i){
  const chart=element('test-chart');
  api.drawTrend(chart,[{name:'Test',color:'#123456',values:rows.map(r=>value(r,i))}],years,element('readout'),{fixedScale:true,selectedYear:years.at(-1)});
  assert.match(chart.innerHTML,/0% to 100%/);
  const circles=[...chart.innerHTML.matchAll(/<circle[^>]+aria-label="([^"]+)"[^>]+cx="([^"]+)" cy="([^"]+)"/g)];
  const expected=rows.map((r,j)=>({v:value(r,i),j})).filter(x=>Number.isFinite(x.v));
  assert.equal(circles.length,expected.length);
  // At width 1000 the actual chart dimensions are 350 high, top 42,
  // bottom 38. Check every plotted percentage against its y coordinate.
  circles.forEach((c,j)=>{
    assert.ok(c[1].endsWith(format(expected[j].v)));
    assert.ok(Math.abs(Number(c[3])-(312-2.7*expected[j].v))<1e-9);
  });
  const segments=[...chart.innerHTML.matchAll(/class="trend-line"[^>]+d="([^"]*)"/g)][0][1];
  const starts=expected.filter(({j})=>j===0||!Number.isFinite(value(rows[j-1],i))).length;
  assert.equal((segments.match(/M/g)||[]).length,starts,'missing data must break chart lines');
  counts.chartSeries++;
}

for(const school of index)for(const grade of [3,6])for(const endYear of core.years){
  const years=core.years.filter(y=>y<=endYear),rows=years.map(y=>record(school.id,school.language,y,grade));
  const province=years.map(y=>benchmark(school.language,y,grade));
  const boards=rows.map((r,j)=>boardFor(r,years[j],grade));
  // A real peer exercises the same comparison helper used for any chosen ID.
  const peers=datasets.get(`${endYear}-${grade}`).filter(r=>r.language===school.language);
  const peer=peers[(Number(school.id)+grade)%peers.length];
  const peerRows=years.map(y=>record(peer.id,school.language,y,grade));
  for(let i=0;i<3;i++){
    const values=rows.map(r=>value(r,i)),end=values.at(-1),before=values.at(-2);
    const first=values.slice(0,-1).findIndex(Number.isFinite);
    const last3=values.slice(-3);
    let direction='unknown';
    if(last3.length===3&&last3.every(Number.isFinite)){
      const changes=[last3[1]-last3[0],last3[2]-last3[1]];
      direction=changes.every(v=>v<0)?'declining':changes.every(v=>v>0)?'improving':changes.every(v=>v===0)?'unchanged':'mixed';
    }
    assert.deepEqual(plain(api.schoolSummary(rows,years,i)),{values,current:end,annual:subtract(end,before),total:first<0?null:subtract(end,values[first]),startYear:first<0?null:years[first],direction},`${school.id} ${grade} ${endYear} subject ${i}`);
    for(const comparison of [province,boards,peerRows]){
      const gaps=values.map((v,j)=>subtract(v,value(comparison[j],i))),start=gaps.slice(0,-1).findIndex(Number.isFinite);
      assert.deepEqual(plain(api.relativeSummary(rows,comparison,years,i)),{gap:gaps.at(-1),annual:subtract(gaps.at(-1),gaps.at(-2)),total:start<0?null:subtract(gaps.at(-1),gaps[start]),startYear:start<0?null:years[start],gaps});
      const relative=api.relativeSummary(rows,comparison,years,i).annual;
      const schoolChange=subtract(end,before),benchmarkChange=subtract(value(comparison.at(-1),i),value(comparison.at(-2),i));
      assert.equal(relative,subtract(schoolChange,benchmarkChange));
      counts.relativeComparisons++;
    }
    for(let j=0;j<years.length;j++){
      assert.equal(api.schoolBoardResult(rows[j],years[j],grade),boards[j]);
      assert.equal(api.provincial(school.language,years[j],grade),province[j]);
    }
    assertChart(rows,years,i);counts.schoolSubjectPeriods++;
  }
  const expectedPatterns=[];
  for(let i=0;i<3;i++){
    const recent=rows.slice(-3).map(r=>value(r,i)),prov=province.slice(-3).map(r=>value(r,i));
    const complete=recent.length===3&&recent.every(Number.isFinite);
    const paired=complete&&prov.every(Number.isFinite),gaps=recent.map((v,j)=>subtract(v,prov[j]));
    const latestChange=subtract(subtract(value(rows.at(-1),i),value(rows.at(-2),i)),subtract(value(province.at(-1),i),value(province.at(-2),i)));
    if(complete&&recent[1]<recent[0]&&recent[2]<recent[1])expectedPatterns.push({subject:i,priority:0});
    else if(paired&&gaps.every(g=>g<0))expectedPatterns.push({subject:i,priority:1});
    else if(paired&&gaps.every(g=>g>0))expectedPatterns.push({subject:i,priority:2});
    else if(latestChange!==null&&Math.abs(latestChange)>=5)expectedPatterns.push({subject:i,priority:3});
  }
  expectedPatterns.sort((a,b)=>a.priority-b.priority);
  const findings=plain(api.conversationFindings(rows,province,years,grade));
  assert.deepEqual(findings.map(({subject,priority})=>({subject,priority})),expectedPatterns,`${school.id} findings ${grade} ${endYear}`);
  for(const finding of findings){
    const i=finding.subject;
    assert.ok(finding.title.includes(`Grade ${grade}`));
    if(finding.priority===0){
      for(const r of rows.slice(-3))assert.ok(finding.evidence.includes(format(value(r,i))));
      const relative=api.relativeSummary(rows,province,years,i);
      if(relative.total!==null)assert.ok(finding.evidence.includes(`${Math.abs(relative.total)} pp`));
    }else if(finding.priority===1||finding.priority===2){
      const gaps=rows.slice(-3).map((r,j)=>subtract(value(r,i),value(province.slice(-3)[j],i)));
      for(const gap of gaps)assert.ok(finding.evidence.includes(api.delta(gap)));
    }else if(finding.priority===3){
      const annual=subtract(value(rows.at(-1),i),value(rows.at(-2),i));
      const provinceChange=subtract(value(province.at(-1),i),value(province.at(-2),i));
      assert.ok(finding.evidence.includes(`School change: ${api.delta(annual)}.`));
      assert.ok(finding.evidence.includes(`Ontario change: ${api.delta(provinceChange)}.`));
      assert.ok(finding.evidence.includes(`Relative change: ${api.delta(subtract(annual,provinceChange))}.`));
    }
    assert.doesNotMatch(finding.evidence,new RegExp(core.years.filter(y=>y>endYear).map(y=>`${y-1}–${String(y).slice(2)}`).join('|')||'NEVER_MATCH'));
    counts.findings++;
  }
}
// Sorting must preserve all source rows and keep unavailable results at the end.
for(const rows of datasets.values())for(let subject=0;subject<3;subject++)for(const direction of [-1,1]){
  Object.assign(api.state,{sort:String(subject),direction});
  const sorted=api.sortedRows(rows);
  assert.equal(sorted.length,rows.length);
  assert.deepEqual(new Set(sorted),new Set(rows));
  let previous=null,missing=false;
  for(const row of sorted){
    const v=row.values[subject];
    if(v===null){missing=true;continue}
    assert.equal(missing,false);
    if(previous!==null)assert.ok(direction*(v-previous)>=0);
    previous=v;
  }
}
console.log('PASS: every school/grade/year/subject summary, benchmark gap, finding and plotted value');

const classifications=new Map(core.boards.map(b=>[b.id,b]));
const allowed=(r,language,type)=>r.language===language&&(type==='everything'||type==='all'&&['Public','Catholic'].includes(classifications.get(r.board??r.id)?.type)||classifications.get(r.board??r.id)?.type===type);
for(const language of ['en','fr'])for(const grade of [3,6])for(const year of core.years)for(const type of ['all','Public','Catholic','Other authority','everything'])for(let subject=0;subject<3;subject++){
  Object.assign(api.state,{language,grade,year,type,subject,pins:[],focus:'',search:'',page:0});
  const rows=core.results.filter(r=>r.year===year&&r.grade===grade&&allowed(r,language,type));
  api.renderBoards(rows);
  const stats=[...element('#content').innerHTML.matchAll(/class="stat">(.*?)<\/div>/g)].map(m=>m[1]);
  const values=rows.map(r=>r.values[subject]).filter(Number.isFinite).sort((a,b)=>a-b);
  const mid=Math.floor(values.length/2),median=values.length?(values.length%2?values[mid]:(values[mid-1]+values[mid])/2):null;
  assert.equal(stats[0],format(benchmark(language,year,grade)?.values[subject]??null));
  assert.equal(stats[1],format(median));
  assert.equal(stats[2],`${values.length} <small>/ ${rows.length}</small>`);
  counts.boardSelections++;
}
console.log('PASS: board medians and historical means across all filters');
for(const language of ['en','fr'])for(const grade of [3,6])for(const year of core.archiveYears)for(const type of ['all','Public','Catholic','Other authority','everything'])for(let subject=0;subject<3;subject++){
  Object.assign(api.state,{language,grade,year,type,subject,schoolBoard:'all'});
  const rows=datasets.get(`${year}-${grade}`).filter(r=>allowed(r,language,type));
  context.inputRows=rows;vm.runInContext('currentSchools=inputRows;',context);api.renderArchiveSummary();
  const groups=new Map();for(const row of rows){if(!groups.has(row.board))groups.set(row.board,[]);groups.get(row.board).push(row)}
  for(const [id,records] of groups){
    const values=records.map(r=>r.values[subject]).filter(Number.isFinite);
    const mean=values.length?values.reduce((sum,v)=>sum+v,0)/values.length:null;
    const row=element('#archive-summary').innerHTML.match(new RegExp(`data-archive-board="${id}"[\\s\\S]*?<td class="numeric">([^<]*)</td><td class="numeric">([^<]*)</td>`));
    assert.ok(row);assert.equal(row[1],format(mean));assert.equal(row[2],`${values.length} / ${records.length}`);
  }
  counts.archiveSelections++;
}

// Test all candidate location pairs once: filters and years reuse these same
// coordinates. An independent unit-vector central angle checks the haversine.
const vector=s=>{
  const lat=s.lat*Math.PI/180,lon=s.lon*Math.PI/180;
  return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];
};
const located=index.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon)).map(s=>({s,v:vector(s)}));
for(let i=0;i<located.length;i++)for(let j=i;j<located.length;j++){
  const a=located[i],b=located[j];if(a.s.language!==b.s.language)continue;
  const cross=[a.v[1]*b.v[2]-a.v[2]*b.v[1],a.v[2]*b.v[0]-a.v[0]*b.v[2],a.v[0]*b.v[1]-a.v[1]*b.v[0]];
  const dot=a.v.reduce((sum,v,k)=>sum+v*b.v[k],0);
  const expected=6371*Math.atan2(Math.hypot(...cross),dot);
  assert.ok(Math.abs(api.distanceKm(a.s,b.s)-expected)<1e-7,`${a.s.id} ${b.s.id} distance`);
  counts.distancePairs++;
}
assert.equal(api.distanceKm({lat:null,lon:0},{lat:0,lon:0}),null);
console.log('PASS: every same-language coordinate pair');

// Numerical export expressions are covered exhaustively by the summaries
// above. Exercise the full renderer for a distributed selection plus every
// school without location provenance, rather than repeatedly rendering millions
// of identical table cells. Browser suites separately verify real CSV downloads.
const exportCases=index.filter((school,i)=>i%100===0||!school.locationSource);
for(const school of exportCases){
  const year=2026,grade=school.grades[0],years=core.years;
  Object.assign(api.state,{year,grade,subject:0,radius:5,nearType:'all',comparisons:[]});
  const rows=years.map(y=>record(school.id,school.language,y,grade));
  context.inputHome={meta:school,years,rows,r:rows.at(-1),current:datasets.get(`${year}-${grade}`).filter(r=>r.language===school.language),record:(id,y,g)=>record(id,school.language,y,g),history:(id,g=grade)=>years.map(y=>record(id,school.language,y,g))};
  vm.runInContext('homeContext=inputHome;',context);api.renderNearbySchools();
  const exported=vm.runInContext('exportRows',context);
  for(const line of exported){
    const raw=record(line.school_id,school.language,year,grade),old=record(line.school_id,school.language,year-1,grade),prov=benchmark(school.language,year,grade);
    assert.equal(line.reading,raw.raw[0]);assert.equal(line.writing,raw.raw[1]);assert.equal(line.mathematics,raw.raw[2]);
    assert.equal(line.year_change_pp,subtract(value(raw,0),value(old,0)));
    assert.equal(line.ontario_gap_pp,subtract(value(raw,0),value(prov,0)));
    assert.equal(line.fully_participating_students,raw.participants[0]);assert.equal(line.source,raw.source);
    if(line.school_id!==school.id&&Number.isFinite(school.lat)&&Number.isFinite(school.lon))assert.ok(line.distance_km<=5);
    assert.equal(api.csvCell(line.year_change_pp),line.year_change_pp===null?'""':`"${line.year_change_pp}"`);
    counts.nearbyExports++;
  }
  api.renderAchievementContext();
  const html=element('#achievement-context').innerHTML;
  if(!school.locationSource)assert.doesNotMatch(html,/download>Ontario school-location source/);
}
api.renderSources();
assert.ok(element('#content').innerHTML.includes(`class="stat">${core.sources.length}</div>`));
assert.ok(element('#content').innerHTML.includes(`${(core.sources.reduce((sum,s)=>sum+s.bytes,0)/1e6).toFixed(1)} <small>MB</small>`));
// Independently reconstruct every trend selection and verify eligibility, ranks,
// exclusions, median and distribution against paired publisher records.
counts.trendSelections=0;counts.trendSchoolPairs=0;
for(const year of core.years)for(const grade of [3,6])for(const language of ['en','fr'])for(const type of ['all','Public','Catholic','Other authority','everything'])for(const subject of ['all','0','1','2'])for(const minimum of [0,20,30,50,100])for(const consistent of [false,true]){
  const current=datasets.get(`${year}-${grade}`).filter(r=>allowed(r,language,type));
  const previous=datasets.get(`${year-1}-${grade}`)||[];
  const indices=subject==='all'?[0,1,2]:[Number(subject)],eligible=[];
  const excluded={missing:0,participants:0,direction:0};
  for(const r of current){
    const old=record(r.id,language,year-1,grade);
    if(!indices.every(i=>Number.isFinite(value(r,i))&&Number.isFinite(value(old,i)))){excluded.missing++;continue}
    if(minimum&&!indices.every(i=>Number.isFinite(r.participants[i])&&Number.isFinite(old.participants[i])&&Math.min(r.participants[i],old.participants[i])>=minimum)){excluded.participants++;continue}
    const changes=[0,1,2].map(i=>subtract(value(r,i),value(old,i)));
    if(subject==='all'&&consistent&&!(changes.every(v=>v>0)||changes.every(v=>v<0))){excluded.direction++;continue}
    const change=indices.map(i=>changes[i]).reduce((a,b)=>a+b,0)/indices.length;
    eligible.push({id:r.id,name:r.name,change,changes});
  }
  const summary=plain(api.schoolTrendSummary(current,previous,{subject,minimum,consistent}));
  assert.deepEqual(summary.rows.map(r=>({id:r.r.id,name:r.r.name,change:r.change,changes:r.changes})),eligible);
  assert.deepEqual(summary.excluded,excluded);
  assert.equal(summary.total,eligible.length+Object.values(excluded).reduce((a,b)=>a+b,0));
  const ordered=eligible.map(r=>r.change).sort((a,b)=>a-b),mid=Math.floor(ordered.length/2);
  assert.equal(summary.median,ordered.length?(ordered.length%2?ordered[mid]:(ordered[mid-1]+ordered[mid])/2):null);
  assert.equal(summary.up,eligible.filter(r=>r.change>0).length);
  assert.equal(summary.down,eligible.filter(r=>r.change<0).length);
  assert.equal(summary.flat,eligible.filter(r=>r.change===0).length);
  assert.equal(summary.completeAll,eligible.filter(r=>r.changes.every(Number.isFinite)).length);
  assert.equal(summary.upAll,eligible.filter(r=>r.changes.every(v=>Number.isFinite(v)&&v>0)).length);
  assert.equal(summary.downAll,eligible.filter(r=>r.changes.every(v=>Number.isFinite(v)&&v<0)).length);
  for(const direction of ['up','down']){
    const sorted=eligible.filter(r=>direction==='up'?r.change>0:r.change<0).sort((a,b)=>(direction==='up'?b.change-a.change:a.change-b.change)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
    const ranked=plain(api.rankSchoolTrends(summary.rows,direction));
    assert.deepEqual(ranked.map(r=>r.r.id),sorted.slice(0,10).map(r=>r.id));
    for(const r of ranked)assert.equal(r.rank,sorted.findIndex(s=>s.change===r.change)+1);
  }
  const histogram=plain(api.trendDistribution(summary.rows));
  const expected=[ordered.filter(v=>v<=-10),ordered.filter(v=>v>-10&&v<=-5),ordered.filter(v=>v>-5&&v<0),ordered.filter(v=>v===0),ordered.filter(v=>v>0&&v<5),ordered.filter(v=>v>=5&&v<10),ordered.filter(v=>v>=10)];
  assert.deepEqual(histogram.map(b=>b.count),expected.map(b=>b.length));
  counts.trendSelections++;counts.trendSchoolPairs+=eligible.length;
}
// Adversarial cases cover a suppressed middle subject, zero, changing group
// sizes, unavailable counts, a missing prior year, and rounded display ties.
const fixture=(id,values,participants=[30,30,30],language='en')=>({id,name:id,values,participants,language});
const oldFixtures=[fixture('a',[50,50,50]),fixture('b',[50,50,50]),fixture('c',[50,50,50]),fixture('d',[50,50,50]),fixture('e',[50,50,50],[19,30,30]),fixture('f',[50,50,50])];
const currentFixtures=[fixture('a',[58,54,47]),fixture('b',[50,50,50]),fixture('c',[51,null,52]),fixture('d',[55,56,57]),fixture('e',[60,60,60]),fixture('f',[60,60,60],[null,30,30]),fixture('g',[90,90,90])];
assert.deepEqual(plain(api.schoolTrendSummary(currentFixtures,oldFixtures)).rows.map(r=>[r.r.id,r.change]),[['a',3],['b',0],['d',6],['e',10],['f',10]]);
assert.deepEqual(plain(api.schoolTrendSummary(currentFixtures,oldFixtures,{minimum:20})).excluded,{missing:2,participants:2,direction:0});
assert.deepEqual(plain(api.schoolTrendSummary(currentFixtures,oldFixtures,{consistent:true})).rows.map(r=>r.r.id),['d','e','f']);
assert.equal(api.schoolTrendSummary([fixture('a',[60,60,60])],[fixture('a',[50,50,50],[30,30,30],'fr')]).rows.length,0);
console.log('PASS: paired school trend eligibility, exclusions, tied ranks, medians and distributions across every year/grade/language/type/subject/minimum/direction selection');
const report={passed:true,snapshot:core.updated,counts,
  code:testedSources.map(({path,text})=>({path,sha256:createHash('sha256').update(text).digest('hex')})),
  checks:['Actual application functions tested for every current school, both grades, all five selected years and all subjects','Annual and longer-term differences; Ontario, board and peer relative changes','Generated finding eligibility, evidence and exclusion of future years','Every plotted school percentage and missing-data line break','Every board filter/subject median and provincial headline','Historical means and reporting/listed denominators for every board filter','All same-language school coordinate pairs independently checked','Nearby export rendering, signed CSV values and source','Every missing-location-source case and dynamic source totals','School trend eligibility, exclusions, tied ranks, medians, direction shares and distribution for every year/grade/language/type/subject/minimum/direction selection'],
  limitations:['Pure calculations exhaustively exercised; browser layout/interactions checked by separate browser suites.','Peer histories use one deterministic real peer per school/grade/selected year; arbitrary pairs use that same verified arithmetic.','Full nearby export rendering uses a distributed selection of schools plus all missing location sources; its numerical helpers are exhaustively checked above.','Earth radius 6371 km is an approximation, not a publisher-provided distance.']};
for(const path of ['data/processed/calculation-audit.json','site/data/calculation-audit.json'])await fs.writeFile(`${root}/${path}`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,counts},null,2));
