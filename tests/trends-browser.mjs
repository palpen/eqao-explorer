import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const base=process.argv[2]||process.env.EQAO_TEST_URL||'http://127.0.0.1:8766/';
const core=JSON.parse(await fs.readFile(root+'/site/data/core.json','utf8'));
const boardById=new Map(core.boards.map(b=>[b.id,b]));
const datasets=new Map();
for(const y of core.years)for(const g of [3,6])datasets.set(`${y}-${g}`,JSON.parse(await fs.readFile(`${root}/site/data/schools-${y}-${g}.json`,'utf8')));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:1060}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{document.modelContext={registerTool(t){window.eqaoTool=t}}});
const initial=new URL('?view=trends&year=2026&grade=3&language=en&type=all',base).href;

function expected({year=2026,grade=3,language='en',type='all',subject='all',minimum=0,consistent=false,board='all'}={}){
  const previous=new Map((datasets.get(`${year-1}-${grade}`)||[]).filter(r=>r.language===language).map(r=>[r.id,r]));
  const scope=datasets.get(`${year}-${grade}`).filter(r=>r.language===language&&(board==='all'||r.board===board)&&(type==='everything'||type==='all'&&['Public','Catholic'].includes(boardById.get(r.board)?.type)||boardById.get(r.board)?.type===type));
  const selected=subject==='all'?[0,1,2]:[Number(subject)];
  const rows=scope.flatMap(r=>{
    const old=previous.get(r.id);
    if(!old||!selected.every(i=>Number.isFinite(r.values[i])&&Number.isFinite(old.values[i])))return [];
    if(minimum&&!selected.every(i=>Number.isFinite(r.participants[i])&&Number.isFinite(old.participants[i])&&r.participants[i]>=minimum&&old.participants[i]>=minimum))return [];
    const changes=[0,1,2].map(i=>Number.isFinite(r.values[i])&&Number.isFinite(old.values[i])?r.values[i]-old.values[i]:null);
    if(subject==='all'&&consistent&&!changes.every(v=>v>0)&&!changes.every(v=>v<0))return [];
    return [{id:r.id,name:r.name,change:selected.reduce((sum,i)=>sum+changes[i],0)/selected.length,changes}];
  });
  const ranked=direction=>rows.filter(r=>direction==='up'?r.change>0:r.change<0).sort((a,b)=>(direction==='up'?b.change-a.change:a.change-b.change)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  return {rows,total:scope.length,ranked};
}

async function check(options={}){
  await page.locator('#trend-period').waitFor();
  const exp=expected(options),actual=await page.evaluate(()=>window.eqaoTool.execute({}).rows);
  assert.deepEqual(actual.map(r=>({id:r.school_id,change:r.annual_change_pp})),exp.rows.map(r=>({id:r.id,change:r.change})));
  for(const direction of ['up','down']){
    const sorted=exp.ranked(direction);
    const displayed=await page.locator(`#trending-${direction} .ranking-row`).evaluateAll(els=>els.map(el=>({id:el.dataset.trendSchool,change:Number(el.dataset.change),rank:Number(el.dataset.rank),width:parseFloat(el.querySelector('.ranking-bar').style.width)})));
    assert.deepEqual(displayed.map(({id,change,rank})=>({id,change,rank})),sorted.slice(0,options.limit||5).map(r=>({id:r.id,change:r.change,rank:sorted.findIndex(s=>s.change===r.change)+1})));
    const extrema=[...exp.ranked('up').slice(0,10),...exp.ranked('down').slice(0,10)].map(r=>Math.abs(r.change));
    const scale=Math.max(10,Math.ceil(Math.max(0,...extrema)/10)*10);
    // CSS percentage serialization rounds to six significant digits.
    for(const row of displayed)assert.ok(Math.abs(row.width-100*Math.abs(row.change)/scale)<1e-4,`Bar width for ${row.id}`);
  }
  assert.match(await page.locator('#trend-coverage').textContent(),new RegExp(`^${exp.rows.length.toLocaleString('en-CA')} of ${exp.total.toLocaleString('en-CA')} schools eligible`));
  const values=exp.rows.map(r=>r.change).sort((a,b)=>a-b),m=Math.floor(values.length/2);
  const median=values.length?(values.length%2?values[m]:(values[m-1]+values[m])/2):null;
  assert.equal(await page.locator('.trend-cards .stat').first().textContent(),median===null?'—':`${median>0?'+':''}${Number(median.toFixed(1))} points`);
  const barCount=await page.locator('.distribution-bin strong').allTextContents();
  assert.equal(barCount.reduce((sum,v)=>sum+Number(v.replaceAll(',','')),0),exp.rows.length);
  return exp;
}

try{
  await page.goto(initial);await check();
  assert.equal(await page.locator('#subjects').isVisible(),false);
  assert.equal(await page.locator('#views [data-view="trends"]').getAttribute('aria-current'),'page');
  await page.screenshot({path:root+'/tests/trends-desktop.png',fullPage:true});
  await page.locator('#trend-show-more').click();await check({limit:10});
  await page.locator('#trend-show-more').click();await check();
  await page.locator('.ranking-details summary').first().click();
  assert.equal(await page.locator('.ranking-details').first().locator('tbody tr').count(),3);
  await page.locator('.ranking-details summary').first().click();
  for(const subject of ['0','1','2','all']){await page.locator('#trend-subject').selectOption(subject);await check({subject})}
  await page.locator('#more-filters').click();
  await page.locator('#trend-minimum').selectOption('30');await check({minimum:30});
  await page.locator('#trend-consistent').check();await check({minimum:30,consistent:true});
  await page.reload();await check({minimum:30,consistent:true});
  await page.locator('#more-filters').click();
  assert.equal(await page.locator('#trend-consistent').isChecked(),true);
  assert.equal(await page.locator('#trend-minimum').inputValue(),'30');
  await page.locator('#trend-subject').selectOption('0');await check({subject:'0',minimum:30,consistent:true});
  assert.equal(await page.locator('#trend-consistent').isDisabled(),true);
  await page.locator('#trend-subject').selectOption('all');await page.locator('#trend-consistent').uncheck();
  await page.locator('#trend-board').selectOption('66052');
  const selected=await check({minimum:30,board:'66052'});
  const downloadWait=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadWait;
  const csv=await fs.readFile(await download.path(),'utf8');
  assert.match(csv,/annual_change_pp/);assert.match(csv,/relative_to_ontario_change_pp/);
  assert.equal(csv.trim().split('\r\n').length,selected.rows.length+1);
  const schoolId=await page.locator('[data-trend-open]').first().getAttribute('data-trend-open');
  await page.locator('[data-trend-open]').first().focus();await page.keyboard.press('Enter');
  await page.locator('#school-trends').waitFor();assert.equal(new URL(page.url()).searchParams.get('school'),schoolId);
  await page.locator('#views [data-view="trends"]').click();await check({minimum:30,board:'66052'});
  await page.locator('#trend-board').selectOption('all');await page.locator('#trend-minimum').selectOption('0');
  await page.locator('[data-grade="6"]').click();await check({grade:6});
  await page.locator('#language').selectOption('fr');await check({grade:6,language:'fr'});
  await page.locator('#boardType').selectOption('Catholic');await check({grade:6,language:'fr',type:'Catholic'});
  await page.locator('#year').selectOption('2025');await check({year:2025,grade:6,language:'fr',type:'Catholic'});
  await page.locator('#year').selectOption('2022');await check({year:2022,grade:6,language:'fr',type:'Catholic'});
  assert.equal(await page.locator('#export').isDisabled(),true);
  assert.match(await page.locator('#content').textContent(),/Previous-year comparison unavailable/);
  for(const type of ['Other authority','everything']){await page.locator('#boardType').selectOption(type);await check({year:2022,grade:6,language:'fr',type})}
  await page.goto(initial);await check();
  for(const width of [1024,390,320]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px overflow`);
    await page.locator('.ranking-details summary').first().click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px expanded detail overflow`);
    await page.locator('.ranking-details summary').first().click();
    if(width===390)await page.screenshot({path:root+'/tests/trends-mobile.png',fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1060});
  await page.locator('#more-filters').click();
  await page.locator('#trend-minimum').selectOption('100');await check({minimum:100});
  await page.locator('#trend-board').selectOption('66133');await check({minimum:100,board:'66133'});
  await page.locator('#trend-minimum').selectOption('0');await check({board:'66133'});
  await page.locator('.trend-method summary').click();
  for(const url of await page.locator('.trend-method a[download]').evaluateAll(as=>as.map(a=>a.href)))assert.equal((await page.request.head(url)).status(),200,url);
  const retryPage=await browser.newPage();retryPage.on('pageerror',e=>errors.push(e.message));
  const route='**/data/schools-2025-3.json';await retryPage.route(route,r=>r.abort());
  await retryPage.goto(initial);await retryPage.locator('#retry-trends').waitFor();
  assert.equal(await retryPage.locator('#export').isDisabled(),true);
  await retryPage.unroute(route);await retryPage.locator('#retry-trends').click();await retryPage.locator('#trend-period').waitFor();
  await retryPage.close();assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,url:base,checks:['Source-backed ranks and shared bar scale','Combined and all subject measures','Paired participant minimum and same-direction filter','Board, board type, language, grade and selected-year filters','Filter URL restoration','Median, coverage and distribution counts','All filtered rows in CSV with signed relative changes','Keyboard school navigation','Missing previous year and empty comparison','Data-load failure and retry without stale export','Original source links','Desktop/mobile at 1024, 390 and 320px including expanded details','No uncaught browser errors']},null,2));
}finally{await browser.close()}
