import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.argv[2]||process.env.EQAO_TEST_URL||'http://127.0.0.1:8766/';
const schools=JSON.parse(await fs.readFile(new URL('../site/data/schools-index.json',import.meta.url),'utf8'));
const school=schools.find(s=>s.id==='002151');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1060}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url=id=>new URL(`?view=myschool&school=${id}`,base).href;
 const ready=()=>page.locator('#school-map[data-ready="true"]').waitFor({timeout:30000});
 const headingBox=()=>page.locator('.has-school-map .page-heading').boundingBox();
 await page.goto(base);await page.locator('#trend-period').waitFor();
 assert.equal(await page.locator('#school-location').isVisible(),false);
 assert.equal(await page.locator('script[src*="leaflet@1.9.4"]').count(),0,'Map libraries load only for a selected school');
 await page.goto(url(school.id));await ready();await page.locator('#school-chart-0 svg').waitFor();
 const heading=await headingBox(),mapBox=await page.locator('#school-location').boundingBox();
 assert.ok(mapBox.x>heading.x+heading.width,'Map sits beside the school heading on desktop');
 assert.equal(await page.locator('#school-map-link').getAttribute('href'),`https://www.google.com/maps/search/?api=1&query=${school.lat},${school.lon}`);
 assert.equal(await page.locator('#school-map').getAttribute('aria-label'),'Interactive school location map');
 assert.equal(await page.locator('#school-location').textContent().then(t=>t.includes('Coordinates:')),false,'Removed coordinate caption stays absent');
 await page.locator('.leaflet-marker-icon').click();assert.match(await page.locator('.leaflet-popup-content').textContent(),new RegExp(school.name));
 await page.locator('#school-map-recenter').click();
 await page.screenshot({path:'tests/school-map-desktop.png'});
 for(const width of [1024,850,390,320]){
  await page.setViewportSize({width,height:1060});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Map fits ${width}px`);
  if(width<=850){const h=await headingBox(),m=await page.locator('#school-location').boundingBox();assert.ok(m.y>=h.y+h.height,'Map stacks below the heading on smaller screens')}
 }
 await page.screenshot({path:'tests/school-map-mobile.png'});
 await page.locator('#grades [data-grade="6"]').click();await ready();
 assert.equal(await page.locator('.leaflet-container').count(),1,'Grade changes replace the map cleanly');
 await page.locator('#views [data-view="trends"]').click();await page.locator('#trend-period').waitFor();
 assert.equal(await page.locator('#school-location').isVisible(),false);assert.equal(await page.locator('#school-map > *').count(),0,'Leaving the school removes map controls and imagery');
 const missing=schools.find(s=>!Number.isFinite(s.lat)||!Number.isFinite(s.lon));
 await page.goto(url(missing.id));await page.locator('#school-chart-0 svg').waitFor();
 assert.equal(await page.locator('#school-map-status').textContent(),'School location unavailable.');
 assert.equal(await page.locator('#school-map').isVisible(),false);
 const blocked=await browser.newPage();await blocked.route('https://cdn.jsdelivr.net/**',route=>route.abort());
 await blocked.goto(url(school.id));await blocked.locator('#school-chart-0 svg').waitFor();
 await blocked.getByText('The map could not be loaded. Open in Google Maps to view this school.').waitFor();
 assert.equal(await blocked.locator('#school-map').isVisible(),false,'Library failures preserve school results and the external link');
 await blocked.close();assert.deepEqual(errors,[]);
 console.log('School map passed: live basemap, desktop placement, responsive stacking, marker, navigation, grade changes, missing coordinates, and blocked-map fallback.');
}finally{await browser.close()}
