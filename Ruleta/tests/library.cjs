const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(),'ruleta-library-'));
const url = require('node:url').pathToFileURL(path.resolve(__dirname,'../index.html')).href;
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome'});
 const context=await browser.newContext({hasTouch:true,viewport:{width:1366,height:740}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.evaluate(()=>RULETA_LIBRARY.themes.length),30);
 await page.locator('#libraryButton').tap();assert.equal(await page.locator('.theme-card').count(),30);
 await page.locator('#themeSearch').fill('mimica');assert((await page.locator('.theme-card').count())>=1);
 await page.locator('#themeSearch').fill('zzzxxyy');assert.equal(await page.locator('#themeDetail').isVisible(),false);
 await page.locator('#themeSearch').fill('');await page.locator('#themeLevel').selectOption('eso');
 assert((await page.locator('.theme-card').count())<30);
 await page.locator('#themeLevel').selectOption('');await page.locator('[data-theme="dues-veritats"]').tap();
 await page.locator('#themeAmount').selectOption('all');await page.locator('#loadThemeButton').tap();
 assert.equal(await page.locator('#entryCount').textContent(),'20');assert.equal(await page.locator('#wheelTitle').textContent(),'Dues veritats i una mentida');assert(await page.locator('#activityHelp').isVisible());
 await page.locator('#undoButton').tap();assert.equal(await page.locator('#entryCount').textContent(),'8');assert.equal(await page.locator('#activityHelp').isVisible(),false);
 await page.locator('#entriesInput').fill('Anna\nBiel\nAnna\nClàudia');await page.locator('#noRepeatToggle').check();
 assert.equal(await page.locator('.roster-pending li').count(),4);
 const winners=[];
 for(let i=0;i<3;i++){
  const previous=await page.locator('.roster-pending li').allTextContents();await page.locator('#spinButton').tap();await page.waitForSelector('#winnerDialog[open]');
  const name=await page.locator('#winnerName').textContent();assert(previous.includes(name));assert(!winners.includes(name));winners.push(name);
  await page.locator('#closeWinner').tap();const active=await page.locator('.roster-pending li').allTextContents();const retired=await page.locator('.roster-retired li').allTextContents();assert(!active.includes(name));assert(retired.includes(name));
  assert.equal(await page.locator('.roster-pending').evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('.roster-retired'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
  if(i===0){await page.reload();assert.deepEqual(await page.locator('.roster-pending li').allTextContents(),active);assert.deepEqual(await page.locator('.roster-retired li').allTextContents(),retired);}
 }
 assert.equal(await page.locator('#spinButton').isDisabled(),true);assert.equal(await page.locator('.roster-retired li').count(),4);
 await page.locator('#restoreButton').tap();assert.equal(await page.locator('.roster-pending li').count(),4);assert.equal(await page.locator('.roster-retired li').count(),0);
 await page.locator('#spinButton').tap();await page.waitForSelector('#winnerDialog[open]');await page.locator('#closeWinner').tap();const before=await page.locator('.roster-pending li').allTextContents();const retiredBefore=await page.locator('.roster-retired li').allTextContents();
 await page.locator('#libraryButton').tap();await page.locator('[data-theme="dibuix-impossible"]').tap();await page.locator('#themeAmount').selectOption('6');await page.locator('#themeMode').selectOption('append');await page.locator('#loadThemeButton').tap();
 assert.equal(await page.locator('.roster-pending li').count(),before.length+6);assert.deepEqual(await page.locator('.roster-retired li').allTextContents(),retiredBefore);
 await page.locator('#undoButton').tap();assert.deepEqual(await page.locator('.roster-pending li').allTextContents(),before);
 await page.locator('#libraryButton').tap();await page.locator('#themeMode').selectOption('replace');await page.locator('#loadThemeButton').tap();assert.equal(await page.locator('.roster-pending li').count(),6);assert.equal(await page.locator('.roster-retired li').count(),0);
 await page.locator('#libraryButton').tap();const downloadPromise=page.waitForEvent('download');await page.locator('#downloadThemeButton').tap();const download=await downloadPromise;await download.saveAs(path.join(output,'theme.json'));const theme=JSON.parse(fs.readFileSync(path.join(output,'theme.json'),'utf8'));assert.equal(theme.entries.length,20);assert(theme.activity.instructions);
 await page.locator('#closeLibrary').tap();await page.locator('#fileInput').setInputFiles(path.join(output,'theme.json'));await page.waitForFunction(()=>document.querySelector('#entryCount').textContent==='20');assert(await page.locator('#activityHelp').isVisible());
 await page.locator('#editListButton').tap();await page.locator('#entriesInput').fill('Nova A\nNova B');await page.locator('#editListButton').tap();assert.deepEqual(await page.locator('.roster-pending li').allTextContents(),['Nova A','Nova B']);assert.equal(await page.locator('#activityHelp').isVisible(),false);
 for(const [w,h] of [[1366,740],[1080,1240],[390,844],[320,568]]){
  await page.setViewportSize({width:w,height:h});await page.locator('#libraryButton').tap();await page.locator('#themeSearch').fill('dues veritats');await page.locator('[data-theme="dues-veritats"]').tap();
  const dimensions=await page.locator('#libraryDialog').evaluate(d=>({overflow:d.scrollWidth>d.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(dimensions.overflow,false);assert.equal(dimensions.pageOverflow,false);
  await page.screenshot({path:path.join(output,`library-${w}.png`)});await page.locator('#closeLibrary').tap();
 }
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS library, JSON import/export, search, stages, random sample, append/undo, retired-at-end, duplicates, exhaustion/reload, touch and responsive layouts.');console.log(output);
})().catch(e=>{console.error(e);process.exit(1)});
