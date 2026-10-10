import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const base=process.argv[2]||process.env.EQAO_TEST_URL||'http://127.0.0.1:8766/';
const core=JSON.parse(await fs.readFile(root+'/site/data/core.json','utf8'));
const latest=JSON.parse(await fs.readFile(root+'/site/data/schools-2026-3.json','utf8'));
const older=JSON.parse(await fs.readFile(root+'/site/data/schools-2025-3.json','utf8'));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1060}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const pct=v=>`${v}%`,pp=v=>`${v>0?'+':''}${v} pp`;
const annual=v=>v===0?'Unchanged since last year':`${v>0?'Up':'Down'} ${Math.abs(v)} percentage points since last year`;
const gap=v=>v===0?'Same as Ontario':`${Math.abs(v)} points ${v>0?'above':'below'} Ontario`;
const waitSchool=()=>page.locator('#school-chart-0 svg').waitFor();
async function choose(id){
  await page.locator('#choose-school').click();await page.locator('#school-picker-search').fill(id);
  await page.locator(`[data-pick-school="${id}"]`).click();await waitSchool();
  await page.waitForFunction(id=>document.querySelector('#section-label').textContent.includes(id),id);
}
await page.goto(base);await page.locator('#trend-period').waitFor();
assert.match(await page.locator('#page-title').textContent(),/School result trends/);
assert.equal(await page.locator('#school-picker-search').isVisible(),false,'School search starts collapsed');
assert.equal(await page.locator('#school-change-label').textContent(),'Choose school');
await page.locator('#choose-school').click();
assert.equal(await page.locator('.school-picker-fields select').count(),0,'School selection uses one search field');
const picker=page.locator('#school-picker-search');
assert.equal(await picker.getAttribute('aria-expanded'),'false');
await picker.fill('Toronto');
assert.equal(await page.locator('#school-picker-results [role="option"]').count(),8);
assert.match(await page.locator('#picker-count').textContent(),/Showing 8 of/);
await page.locator('.school-selector').screenshot({path:root+'/tests/school-search-desktop.png'});
await picker.press('ArrowDown');const firstOption=await picker.getAttribute('aria-activedescendant');
assert.ok(firstOption);await picker.press('ArrowDown');assert.notEqual(await picker.getAttribute('aria-activedescendant'),firstOption);
await picker.press('ArrowUp');assert.equal(await picker.getAttribute('aria-activedescendant'),firstOption);
await picker.press('Escape');assert.equal(await picker.getAttribute('aria-expanded'),'false');
await picker.press('ArrowDown');assert.equal(await picker.getAttribute('aria-expanded'),'true');
await picker.fill('No such Ontario school at all');assert.match(await page.locator('#picker-count').textContent(),/No schools found/);
await picker.press('Enter');assert.match(await page.locator('#page-title').textContent(),/School result trends/);
await picker.fill('');assert.equal(await page.locator('#school-picker-results').isVisible(),false);
await page.locator('#school-picker-search').fill('123838');await page.keyboard.press('Enter');await waitSchool();
const school=latest.find(s=>s.id==='123838'),old=older.find(s=>s.id===school.id),province=core.province.find(r=>r.year===2026&&r.grade===3&&r.language==='en');
assert.equal(await page.locator('#page-title').textContent(),school.name);
assert.equal(await page.locator('#school-picker-search').isVisible(),false,'School selection hides the search');
assert.equal(await page.locator('#selected-school-name').textContent(),school.name);
assert.equal(await page.locator('#school-change-label').textContent(),'Change school');
assert.equal(await page.locator('#views button').count(),3,'Three primary destinations');
await page.locator('#choose-school').click();assert.equal(await picker.isVisible(),true);
await page.locator('#choose-school').click();assert.equal(await picker.isVisible(),false);
await page.evaluate(()=>scrollTo(0,0));
const schoolStrokes=await Promise.all([0,1,2].map(i=>page.locator(`#school-chart-${i} .trend-line[data-series="Selected school"]`).getAttribute('stroke')));
assert.equal(new Set(schoolStrokes).size,3,'Each subject has its own time-series colour');
for(let i=0;i<3;i++){
  const card=page.locator(`[data-overview-subject="${i}"]`);
  assert.equal(await card.locator('.stat').textContent(),pct(school.values[i]));
  assert.equal(await card.locator('.sub').textContent(),annual(school.values[i]-old.values[i]));
  assert.equal(await card.locator('.card-gap').textContent(),gap(school.values[i]-province.values[i]));
  assert.match(await page.locator(`#school-chart-${i} svg`).getAttribute('aria-label'),/0% to 100%/);
  const point=page.locator(`#school-chart-${i} circle`).filter({has:page.locator('title',{hasText:`Selected school · 2025–26`})});
  assert.ok(Math.abs(Number(await point.getAttribute('cy'))-(15+133*(1-school.values[i]/100)))<1e-8,'Compact plot position matches the published percentage');
}
assert.equal(await page.locator('.achievement-card').count(),3);
assert.match(await page.locator('.achievement-card').first().textContent(),/22 fully participating.*28 registered/s);
assert.deepEqual(await page.locator('.achievement-card').first().locator('dd').allTextContents(),school.levels[0]);
assert.match(await page.locator('#school-conversations').textContent(),/What has changed|persistent|practices|interpret|current learning/);
const firstSchoolQuestions=await page.locator('.conversation h3').allTextContents();
assert.equal(await page.locator('#school-questions').getAttribute('open'),null);
await page.locator('#school-questions > summary').click();
await page.locator('.question-method summary').click();assert.match(await page.locator('.question-method').textContent(),/fixed question template/);
await page.locator('.question-method summary').click();
await page.locator('#school-achievement > summary').click();
await page.locator('.grade-overview summary').click();assert.equal(await page.locator('#grade-overview tbody tr').count(),4);
await page.locator('#school-comparisons > summary').click();
await page.locator('#near-subject').selectOption('2');assert.match(await page.locator('#nearby-description').textContent(),/mathematics/);
assert.ok((await page.locator('#nearby-table tbody tr').first().textContent()).includes(pp(school.values[2]-old.values[2])));
await page.locator('#near-subject').selectOption('0');
await page.screenshot({path:root+'/tests/my-school-desktop.png',fullPage:true});
// Chosen peers affect charts and relative comparisons without averaging them into Ontario.
const initialOntario=await page.locator('[data-overview-subject="0"] .card-benchmarks').textContent();
const peerId=await page.locator('[data-compare-school]').first().getAttribute('data-compare-school');
await page.locator(`[data-compare-school="${peerId}"]`).click();
assert.equal(await page.locator('#comparison-chips [data-remove-peer]').count(),1);
assert.equal(await page.locator('#line-board').isChecked(),false,'Board is optional initially');
await page.locator('#line-board').check();
assert.equal(await page.locator('#expanded-school-chart .trend-line').count(),4);
assert.equal(await page.locator('#expanded-school-chart .trend-line[data-series="Selected school"]').getAttribute('stroke'),schoolStrokes[0]);
assert.equal(await page.locator('[data-overview-subject="0"] .card-benchmarks').textContent(),initialOntario);
assert.equal(await page.locator('#relative-progress tbody tr').count(),3);
// Switch subjects inside the comparison, preserving peers and the open values table.
await page.locator('#expanded-subject details summary').click();
const comparisonHistory=await Promise.all(core.years.map(async year=>({year,rows:JSON.parse(await fs.readFile(`${root}/site/data/schools-${year}-3.json`,'utf8'))})));
for(const subject of [2,1,0]){
  const button=page.locator(`[data-comparison-subject="${subject}"]`);
  await button.focus();await page.keyboard.press('Enter');
  assert.equal(await button.getAttribute('aria-pressed'),'true');
  assert.equal(await button.evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.locator(`[data-expand-subject="${subject}"]`).getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#expanded-subject details').evaluate(el=>el.open),true);
  assert.equal(await page.locator(`#comparison-chips [data-remove-peer="${peerId}"]`).count(),1);
  assert.equal(await page.locator('#line-ontario').isChecked(),true);
  assert.equal(await page.locator('#line-board').isChecked(),true);
  for(const {year,rows} of comparisonHistory){
    const own=rows.find(r=>r.id===school.id&&r.language===school.language);
    const peer=rows.find(r=>r.id===peerId&&r.language===school.language);
    const expected=[own,core.province.find(r=>r.year===year&&r.grade===3&&r.language===school.language),core.results.find(r=>r.id===own?.board&&r.year===year&&r.grade===3&&r.language===school.language),peer].map(r=>r?.values[subject]??null);
    const row=page.locator('#expanded-subject tbody tr').nth(core.years.indexOf(year));
    assert.deepEqual(await row.locator('td').allTextContents(),expected.map(v=>v===null?'—':pct(v)));
    const names=['Selected school','Ontario','School board',latest.find(r=>r.id===peerId).name];
    for(let j=0;j<names.length;j++)if(Number.isFinite(expected[j]))assert.equal(await page.locator('#expanded-school-chart').getByRole('button',{name:`${names[j]} · ${year-1}–${String(year).slice(-2)} · ${pct(expected[j])}`,exact:true}).count(),1);
  }
}
await page.locator('#line-board').uncheck();assert.equal(await page.locator('#expanded-school-chart .trend-line').count(),3);
await page.locator('#line-ontario').uncheck();assert.equal(await page.locator('#expanded-school-chart .trend-line').count(),2);
await page.locator('[data-comparison-subject="2"]').click();
assert.equal(await page.locator('#line-board').isChecked(),false);
assert.equal(await page.locator('#line-ontario').isChecked(),false);
assert.equal(await page.locator('#expanded-school-chart .trend-line').count(),2);
await page.locator('[data-comparison-subject="0"]').click();
await page.locator('#line-ontario').check();await page.locator('#line-board').check();
// Full comparison counts keep every line and direct label readable.
for(let n=0;n<3;n++)await page.locator('[data-compare-school][aria-pressed="false"]').first().click();
assert.equal(await page.locator('#expanded-school-chart .trend-line').count(),7);
const bounds=await page.locator('#expanded-school-chart .end-label').evaluateAll(labels=>labels.map(l=>{const r=l.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}).sort((a,b)=>a.top-b.top));
for(let n=1;n<bounds.length;n++)assert.ok(bounds[n].top>=bounds[n-1].bottom,'Seven direct chart labels do not overlap');
while(await page.locator('#comparison-chips [data-remove-peer]').count()>1)await page.locator('#comparison-chips [data-remove-peer]').last().click();
await page.locator('#near-radius').selectOption('1');assert.equal(await page.locator('#comparison-chips [data-remove-peer]').count(),1);
assert.match(await page.locator('#nearby-description').textContent(),/within 1 km/);
await page.locator('#near-type').selectOption('Catholic');assert.match(await page.locator('#nearby-description').textContent(),/Catholic/);
await page.locator('#near-search').fill('No such school at all');assert.match(await page.locator('#nearby-table').textContent(),/No nearby schools match/);await page.locator('#near-search').fill('');
// Export includes saved peers even if they are outside the displayed comparison radius/type.
const downloadWait=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadWait;await download.saveAs(root+'/tests/school-export.csv');
const csv=await fs.readFile(root+'/tests/school-export.csv','utf8');assert.match(csv,/Selected comparison/);assert.ok(csv.includes(peerId));assert.match(csv,/fully_participating_students/);
assert.doesNotMatch(csv,/"'-\d/, 'Negative numeric changes remain numeric in exported CSV');
await page.goto(base);await waitSchool();assert.equal(await page.locator('#page-title').textContent(),school.name);
assert.equal(await page.locator('#school-picker-search').isVisible(),false,'Reloaded saved school keeps search hidden');
assert.equal(await page.locator('#comparison-chips [data-remove-peer]').count(),1);assert.equal(await page.locator('#near-radius').inputValue(),'1');
// Older selections must never include future results in findings or charts.
await page.locator('#year').selectOption('2024');await waitSchool();assert.equal(await page.locator('#school-chart-0 circle').count(),6);
assert.doesNotMatch(await page.locator('#school-conversations').textContent(),/2024–25|2025–26/);
await page.locator('#year').selectOption('2026');await waitSchool();
await page.locator('[data-grade="6"]').click();await waitSchool();
const g6=JSON.parse(await fs.readFile(root+'/site/data/schools-2026-6.json','utf8')).find(r=>r.id===school.id);
assert.equal(await page.locator('[data-overview-subject="2"] .stat').textContent(),pct(g6.values[2]));
await page.locator('[data-grade="3"]').click();await waitSchool();
await page.locator('[data-expand-subject="1"]').click();await page.locator('#expanded-school-chart svg').waitFor();
assert.equal(await page.locator('#expanded-school-chart .trend-line[data-series="Selected school"]').getAttribute('stroke'),schoolStrokes[1]);
await page.locator('#expanded-school-chart circle').first().focus();await page.keyboard.press('Enter');assert.match(await page.locator('#expanded-school-readout').textContent(),/Selected school.*2021–22/);
for(const width of [1024,390,320]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(200);
  await page.locator('[data-comparison-subject="2"]').click();
  assert.equal(await page.locator('[data-comparison-subject="2"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-comparison-subject="1"]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`School dashboard fits ${width}px`);
  const cardTops=await page.locator('.subject-card').evaluateAll(cards=>cards.map(c=>c.getBoundingClientRect().top));
  assert.ok(width>760?cardTops.every(top=>Math.abs(top-cardTops[0])<1):cardTops.every((top,i)=>i===0||top>cardTops[i-1]),'Subject panels align on desktop and stack on phones');
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:root+`/tests/my-school-${width}.png`,fullPage:true});
  assert.equal(await page.locator('#school-picker-search').isVisible(),false);
}
await page.setViewportSize({width:1440,height:1060});
// Suppression, bounded levels, no grade record and missing coordinates remain explicit.
await choose('105694');assert.deepEqual(await page.locator('.subject-card .stat').allTextContents(),['N/R','N/R','N/R']);assert.equal(await page.locator('.level-stack').count(),0);
assert.match(await page.locator('#achievement-context').textContent(),/unavailable/);
const bounded=latest.find(r=>r.suppressed==='0'&&r.levels.some(ls=>ls.some(l=>l.startsWith('<'))));
if(bounded){await choose(bounded.id);const subject=bounded.levels.findIndex(ls=>ls.some(l=>l.startsWith('<')));assert.equal(await page.locator('.achievement-card').nth(subject).locator('.level-stack').count(),0);assert.match(await page.locator('.achievement-card').nth(subject).textContent(),/<1%/);}
await choose('331635');
const malvernQuestions=await page.locator('.conversation h3').allTextContents();
assert.equal(malvernQuestions.length,2);assert.match(malvernQuestions[0],/reading declined/);assert.match(malvernQuestions[1],/writing gained ground/);
assert.notDeepEqual(malvernQuestions,firstSchoolQuestions,'Question patterns vary with school results');
assert.match(await page.locator('#school-conversations').textContent(),/77%.*61%.*56%/s);
assert.match(await page.locator('#school-conversations').textContent(),/Relative change: \+9 pp/);
await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:root+'/tests/malvern-school-header.png'});
await page.locator('#school-trends').screenshot({path:root+'/tests/subject-colours.png'});
await choose('649653');assert.deepEqual(await page.locator('.subject-card .stat').allTextContents(),['No result','No result','No result']);assert.equal(await page.locator('#near-radius').isDisabled(),true);assert.match(await page.locator('#nearby-description').textContent(),/Coordinates and city are unavailable/);
assert.match(await page.locator('#achievement-context').textContent(),/Ontario school-location source unavailable/);
assert.equal(await page.locator('#achievement-context a').filter({hasText:'Ontario school-location source'}).count(),0,'No invented location-source link');
await choose('023549');assert.match(await page.locator('#page-description').textContent(),/French-language/);
const french=latest.find(s=>s.id==='023549'),fp=core.province.find(r=>r.year===2026&&r.grade===3&&r.language==='fr');
assert.equal(await page.locator('[data-overview-subject="0"] .card-gap').textContent(),gap(french.values[0]-fp.values[0]));assert.match(await page.locator('#nearby-description').textContent(),/French-language/);
await page.goto(new URL('?view=myschool&school=123838&year=2022&grade=6&radius=5&compare=',base).href);await waitSchool();
assert.equal(await page.locator('#page-title').textContent(),school.name);assert.equal(await page.locator('#year').inputValue(),'2022');
assert.equal(await page.locator('[data-grade="6"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#comparison-chips [data-remove-peer]').count(),0);
// Cases distinguish absolute from relative progress and preserve gaps.
const interpretations=await page.evaluate(()=>{
  const row=v=>({values:[v,v,v]});
  return {slow:relativeSummary([row(60),row(62)],[row(60),row(68)],[2025,2026],0),fast:relativeSummary([row(60),row(68)],[row(60),row(62)],[2025,2026],0),gap:schoolSummary([row(70),undefined,row(60)],[2024,2025,2026],0),incomplete:conversationFindings([row(70),undefined,row(60)],[row(80),row(80),row(80)],[2024,2025,2026],3),declining:conversationFindings([row(70),row(65),row(60)],[row(60),row(60),row(60)],[2024,2025,2026],3),oneYear:conversationFindings([row(60)],[row(70)],[2026],3),distance:distanceKm({lat:0,lon:0},{lat:0,lon:1})};
});
assert.equal(interpretations.slow.annual,-6);assert.equal(interpretations.fast.annual,6);assert.equal(interpretations.gap.annual,null);assert.equal(interpretations.gap.direction,'unknown');assert.equal(interpretations.incomplete.length,0);assert.equal(interpretations.oneYear.length,0);assert.match(interpretations.declining[0].title,/two consecutive annual changes/);assert.ok(Math.abs(interpretations.distance-111.195)<.01);
// Failed downloads expose retry.
const mobilePicker=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await mobilePicker.goto(base);await mobilePicker.locator('#trend-period').waitFor();
assert.equal(await mobilePicker.locator('#school-picker-search').isVisible(),false);
await mobilePicker.locator('#choose-school').click();
await mobilePicker.locator('#school-picker-search').fill('Woodbridge');
assert.equal(await mobilePicker.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Search results fit mobile');
await mobilePicker.screenshot({path:root+'/tests/school-search-mobile.png'});
const mobileId=await mobilePicker.locator('[data-pick-school]').first().getAttribute('data-pick-school');
await mobilePicker.locator('[data-pick-school]').first().tap();await mobilePicker.locator('#school-chart-0 svg').waitFor();
assert.ok((await mobilePicker.locator('#section-label').textContent()).includes(mobileId));await mobilePicker.close();
const failurePage=await browser.newPage();await failurePage.route('**/schools-2024-3.json',r=>r.abort());await failurePage.goto(new URL('?view=myschool&school=123838&year=2026&grade=3',base).href);
await failurePage.locator('#retry-my-school').waitFor();await failurePage.unroute('**/schools-2024-3.json');await failurePage.locator('#retry-my-school').click();await failurePage.locator('#school-chart-0 svg').waitFor();await failurePage.close();
assert.deepEqual(errors,[]);
const report={passed:true,url:base,checks:['search hidden by default and after selection/reload','three primary destinations and details collapsed initially','single school search with matching results underneath','keyboard arrows, Enter, Escape, empty query and no matches','mobile search result selection by touch','distinct subject colours consistent in expanded charts','source-backed values, changes, gaps, levels and participant counts','grade overview','consistent chart scales and keyboard values','relative progress distinguishes slower and faster gains','missing years do not imply sustained patterns','real school data produces different question patterns','Malvern reading decline and writing relative gain match source results','question rules are explained in the panel','peer chart lines and relative progress','distance and board-type comparison group','save/restore school, peers and controls','selected peers included in export beyond filters','older-year findings exclude future data','suppression and bounded percentages retained','missing grade and coordinates explicit','French provincial benchmark','desktop/tablet/390px/320px layouts','request failure retry','no uncaught errors']};
await fs.writeFile(root+'/tests/school-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
