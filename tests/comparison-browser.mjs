import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.argv[2]||process.env.EQAO_TEST_URL||'http://127.0.0.1:8766/';
const index=JSON.parse(await fs.readFile('site/data/schools-index.json','utf8'));
const current=JSON.parse(await fs.readFile('site/data/schools-2026-3.json','utf8'));
const home=index.find(s=>s.id==='157635');
// Independent central-angle calculation checks both the order and displayed distance.
function distance(s){
  if(![s.lat,s.lon,home.lat,home.lon].every(Number.isFinite))return null;
  const rad=Math.PI/180,a=home.lat*rad,b=s.lat*rad;
  return 6371*Math.acos(Math.min(1,Math.max(-1,Math.sin(a)*Math.sin(b)+Math.cos(a)*Math.cos(b)*Math.cos((s.lon-home.lon)*rad))));
}
const expected=index.filter(s=>s.id!==home.id).map(s=>({s,d:distance(s)})).sort((a,b)=>{
  if(a.d===null&&b.d!==null)return 1;if(b.d===null&&a.d!==null)return -1;
  return (a.d??0)-(b.d??0)||a.s.name.localeCompare(b.s.name);
});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('?view=myschool&school=157635&grade=3&year=2026&compare=&radius=1&nearType=Public',base).href);
  await page.locator('#school-chart-0 svg').waitFor();
  // Historical points expose the subject-specific count for their own year.
  const history=await Promise.all([2022,2023,2024,2025,2026].map(async year=>({year,row:JSON.parse(await fs.readFile(`site/data/schools-${year}-3.json`,'utf8')).find(r=>r.id===home.id)})));
  for(const subject of [0,1,2]){
    const footer=page.locator(`[data-overview-subject="${subject}"] .subject-actions span`);
    const latestCount=history.at(-1).row.participants[subject];
    assert.equal(await footer.textContent(),`2025–26 · ${latestCount} fully participating students`);
    for(const {year,row} of history){
      const label=`Selected school · ${year-1}–${String(year).slice(-2)} · ${row.values[subject]}% · ${row.participants[subject]} fully participating students`;
      const point=page.locator(`#school-chart-${subject}`).getByRole('button',{name:label,exact:true});
      await point.click();
      assert.equal(await page.locator(`#school-readout-${subject}`).textContent(),label);
      await point.focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator(`#school-readout-${subject}`).textContent(),label);
      assert.equal(await footer.textContent(),`2025–26 · ${latestCount} fully participating students`);
    }
    const province=page.locator(`#school-chart-${subject} circle`).filter({has:page.locator('title',{hasText:'Ontario · 2021–22'})});
    await province.click();
    assert.match(await page.locator(`#school-readout-${subject}`).textContent(),/^Ontario · 2021–22 · .* fully participating students$/);
  }
  await page.locator('#school-comparisons > summary').click();
  assert.equal(new URL(page.url()).searchParams.has('radius'),false);
  assert.equal(new URL(page.url()).searchParams.has('nearType'),false);
  assert.equal(await page.locator('#school-comparisons select').count(),0);
  assert.deepEqual(await page.locator('#comparison-table [data-compare-school]').evaluateAll(bs=>bs.map(b=>b.dataset.compareSchool)),expected.slice(0,10).map(x=>x.s.id));
  for(const {s,d} of expected.slice(0,10))assert.ok((await page.locator(`[data-comparison-row="${s.id}"] .comparison-distance`).textContent()).includes(d.toFixed(1)));
  await page.locator('#comparison-next').click();
  assert.deepEqual(await page.locator('#comparison-table [data-compare-school]').evaluateAll(bs=>bs.map(b=>b.dataset.compareSchool)),expected.slice(10,20).map(x=>x.s.id));
  await page.locator('[data-distance-sort]').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#comparison-table th[aria-sort]').getAttribute('aria-sort'),'descending');
  assert.equal(await page.locator('[data-distance-sort]').evaluate(b=>b===document.activeElement),true);
  const descending=expected.filter(x=>x.d!==null).sort((a,b)=>b.d-a.d||a.s.name.localeCompare(b.s.name));
  assert.deepEqual(await page.locator('#comparison-table [data-compare-school]').evaluateAll(bs=>bs.map(b=>b.dataset.compareSchool)),descending.slice(0,10).map(x=>x.s.id));
  await page.locator('[data-distance-sort]').click();
  for(const id of ['780880','158020','019735','216780']){
    await page.locator('#comparison-search').fill(id);
    await page.locator(`[data-compare-school="${id}"]`).click();
  }
  assert.equal(await page.locator('#comparison-chips [data-remove-peer]').count(),4);
  await page.locator('#comparison-search').fill('056367');
  assert.ok(await page.locator('[data-compare-school="056367"]').isDisabled());
  await page.locator('[data-comparison-subject="2"]').click();
  await page.locator('#expanded-subject details summary').click();
  const lastRow=page.locator('#expanded-subject tbody tr').last();
  const french=current.find(s=>s.id==='019735');
  assert.equal(await lastRow.locator('td').nth(4).textContent(),`${french.values[2]}%`);
  assert.match(await page.locator('#expanded-subject .chart-caption').textContent(),/different assessments/);
  const downloadWait=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadWait;
  assert.equal(download.suggestedFilename(),'eqao-myschool-grade3-2026-ontario.csv');
  const exported=await fs.readFile(await download.path(),'utf8');
  assert.match(exported,/Selected comparison/);assert.ok(exported.includes('019735'));
  assert.doesNotMatch(exported,/change_subject|year_change_pp|fully_participating_students/);
  await page.locator('#close-comparison').click();assert.match(await page.locator('.comparison-empty').textContent(),/Choose a subject/);
  await page.locator('[data-comparison-subject="2"]').click();

  // Searching for a far-away school does not discard the saved comparison group.
  const ottawa=index.find(s=>s.city==='Ottawa'&&distance(s)>300&&current.some(r=>r.id===s.id));
  await page.locator('[data-remove-peer="216780"]').click();
  await page.locator('#comparison-search').fill(ottawa.id);
  await page.locator(`[data-compare-school="${ottawa.id}"]`).click();
  const chosen=await page.evaluate(()=>JSON.parse(localStorage.getItem('eqao-my-school-v1')).comparisons);
  await page.locator('[data-distance-sort]').click();
  await page.reload();await page.locator('#school-chart-0 svg').waitFor();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('eqao-my-school-v1')).comparisons),chosen);
  assert.equal(new URL(page.url()).searchParams.get('distanceSort'),'desc');
  await page.locator('#school-comparisons > summary').click();
  assert.equal(await page.locator('#comparison-table th[aria-sort]').getAttribute('aria-sort'),'descending');
  // Missing coordinates stay last in either direction, but can still be selected.
  const missing=index.find(s=>s.id!==home.id&&(!Number.isFinite(s.lat)||!Number.isFinite(s.lon)));
  await page.locator('[data-remove-peer="158020"]').click();
  await page.locator('#comparison-search').fill(missing.id);
  assert.match(await page.locator(`[data-comparison-row="${missing.id}"] .comparison-distance`).textContent(),/Unavailable/);
  await page.locator(`[data-compare-school="${missing.id}"]`).click();
  assert.ok(await page.locator(`[data-remove-peer="${missing.id}"]`).count());
  await page.locator('#comparison-search').fill('');
  await page.evaluate(()=>renderComparisonSchools('',99999));
  const lastIds=await page.locator('#comparison-table [data-compare-school]').evaluateAll(bs=>bs.map(b=>b.dataset.compareSchool));
  assert.ok(lastIds.every(id=>distance(index.find(s=>s.id===id))===null));
  await page.locator('[data-distance-sort]').click();
  await page.evaluate(()=>renderComparisonSchools('',99999));
  assert.ok((await page.locator('#comparison-table [data-compare-school]').evaluateAll(bs=>bs.map(b=>b.dataset.compareSchool))).every(id=>distance(index.find(s=>s.id===id))===null));
  await page.locator('#comparison-search').fill('780880');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const selector of ['[data-distance-sort]','[data-compare-school="780880"]']){
      const bounds=await page.locator(selector).boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width,`${selector} fits ${width}px`);
    }
    if(width===390)await page.locator('[data-distance-sort]').click();
    else{await page.locator('[data-distance-sort]').focus();await page.keyboard.press('Enter');}
    await page.locator('[data-comparison-subject="1"]').click();
    await page.locator('[data-compare-school="780880"]').click();
    assert.equal(await page.locator('[data-remove-peer="780880"]').count(),width===390?0:1);
  }
  const touchPage=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  await touchPage.goto(new URL('?view=myschool&school=157635&grade=3&year=2026',base).href);
  await touchPage.locator('#school-chart-0 svg').waitFor();
  for(const [year,count] of [[2023,19],[2025,25],[2026,22]]){
    await touchPage.locator('#school-chart-0 circle').filter({has:touchPage.locator('title',{hasText:`Selected school · ${year-1}–${String(year).slice(-2)}`})}).tap();
    assert.match(await touchPage.locator('#school-readout-0').textContent(),new RegExp(` · ${count} fully participating students$`));
  }
  assert.ok(await touchPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await touchPage.screenshot({path:'tests/participation-mobile.png',fullPage:true});
  await touchPage.close();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('eqao-my-school-v1')));
  assert.equal(Object.hasOwn(saved,'radius'),false);assert.equal(Object.hasOwn(saved,'nearType'),false);
  assert.deepEqual(errors,[]);
  console.log('Comparison picker passed: Ontario-wide data, independent distance order, pagination, keyboard sorting, cross-language histories, four-school limit, far-away peers, reload, missing coordinates, mobile controls, legacy links.');
}finally{await browser.close()}
