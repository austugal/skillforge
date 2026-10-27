'use strict';
const {_electron} = require('playwright');
const os = require('node:os');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const fs = require('node:fs/promises');
(async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(),'skillforge-ui-'));
  const exportDir = path.join(dataDir,'exports'); await fs.mkdir(exportDir);
  const electron = await _electron.launch({args:['--no-sandbox','--ozone-platform=headless','--disable-gpu',path.resolve('test/launch.cjs')],env:{...process.env,SKILLFORGE_TEST_DATA:dataDir}});
  try {
    await electron.evaluate(({dialog}, folder) => {dialog.showOpenDialog = async()=>({canceled:false,filePaths:[folder]});},exportDir);
    const page = await electron.firstWindow(); await page.waitForSelector('#title');
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.locator('#title').fill('Review property revenue');
    await page.locator('#description').fill('Use for the daily revenue review in the approved test tenant.');
    await page.locator('#preconditions').fill('Test property access, source report, read-only review role.');
    await page.locator('#note').fill('Open the daily report for the selected property'); await page.locator('#add-note').click();
    await page.locator('#note').fill('Compare totals with the source ledger'); await page.locator('#add-note').click();
    await page.locator('#derive').click(); await page.waitForSelector('.step'); assert.equal(await page.locator('.step').count(),2);
    await page.getByLabel('Expected result / verification',{exact:true}).nth(0).fill('The report date and property match the request.');
    await page.getByLabel('Recovery if it fails',{exact:true}).nth(0).fill('Stop and verify property/report access.');
    await page.getByLabel('Expected result / verification',{exact:true}).nth(1).fill('Totals reconcile, or the discrepancy is documented.');
    await page.getByLabel('Recovery if it fails',{exact:true}).nth(1).fill('Keep the original report and escalate discrepancies.');
    await page.getByLabel('Approve step 1',{exact:true}).check(); await page.getByLabel('Approve step 2',{exact:true}).check();
    await page.locator('[data-tab="export"]').click(); assert.equal(await page.locator('#export-button').isEnabled(),false);
    await page.locator('#approved').check(); assert.equal(await page.locator('#export-button').isEnabled(),true);
    assert.match(await page.locator('#skill-preview').innerText(),/Review property revenue/);
    const preview=await page.locator('#skill-preview').innerText(); await page.locator('#target').selectOption('codex'); await page.locator('#export-button').click();
    await page.waitForFunction(()=>document.getElementById('export-location').textContent.includes('skillforge-'));
    const location = await page.locator('#export-location').innerText();
    const actual = await fs.readFile(path.join(location,'.agents/skills/review-property-revenue/SKILL.md'),'utf8');
    assert.equal(actual,preview);
    await page.locator('[data-tab="refine"]').click(); await page.getByLabel('Action',{exact:true}).nth(0).fill('Changed action');
    assert.equal(await page.getByLabel('Approve step 1',{exact:true}).isChecked(),false);
    await page.locator('[data-tab="export"]').click(); assert.equal(await page.locator('#export-button').isEnabled(),false);
    await page.locator('[data-tab="capture"]').click(); await page.locator('#note').fill('<img src=x onerror=alert(1)>'); await page.locator('#add-note').click(); assert.equal(await page.locator('.timeline img').count(),0);
    await page.locator('#note').fill('Contact john@example.com password=hello'); await page.locator('#add-note').click(); assert.ok(!(await page.locator('#timeline').innerText()).includes('john@example.com'));
    // Exercise MediaRecorder and real file IPC with a synthetic video source.
    // This does not establish OS screen capture behavior.
    await electron.evaluate(({desktopCapturer, nativeImage}) => {desktopCapturer.getSources = async()=>[{id:'screen:test',name:'Synthetic test source',thumbnail:nativeImage.createEmpty()}];});
    await page.evaluate(() => {
      navigator.mediaDevices.getDisplayMedia = async() => {
        const canvas=document.createElement('canvas'); canvas.width=320; canvas.height=180;
        const ctx=canvas.getContext('2d');
        window.syntheticTimer=setInterval(()=>{ctx.fillStyle='#222';ctx.fillRect(0,0,320,180);ctx.fillStyle='#fff';ctx.fillText(String(Date.now()),20,40);},50);
        return canvas.captureStream(10);
      };
    });
    await page.locator('#refresh').click(); await page.locator('#source').selectOption('screen:test'); await page.locator('#record').click();
    await page.waitForFunction(()=>document.getElementById('record-state').textContent==='RECORDING');
    await page.locator('#pause').click(); await page.waitForFunction(()=>document.getElementById('record-state').textContent==='PAUSED');
    await page.locator('#pause').click(); await page.waitForFunction(()=>document.getElementById('record-state').textContent==='RECORDING');
    await page.waitForFunction(()=>document.getElementById('timer').textContent!=='00:00');
    await page.locator('#stop').click(); await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Recording saved locally'));
    await page.evaluate(()=>clearInterval(window.syntheticTimer));
    const sessionDirs=await fs.readdir(path.join(dataDir,'sessions')); let videos=[];
    for(const dir of sessionDirs) for(const file of await fs.readdir(path.join(dataDir,'sessions',dir))) if(file.endsWith('.webm')) videos.push(path.join(dataDir,'sessions',dir,file));
    assert.equal(videos.length,1); assert.ok((await fs.stat(videos[0])).size>100);
    assert.match(await page.evaluate(async()=>{try{await window.desktop.load('../outside');return 'allowed';}catch(e){return e.message;}}),/Invalid session/);
    await page.setViewportSize({width:1000,height:900}); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),true);
    await page.setViewportSize({width:1460,height:1100});
    await page.locator('#new').click();
    await fs.mkdir('test-results',{recursive:true}); await page.evaluate(()=>window.scrollTo(0,0)); await page.screenshot({path:'test-results/studio.png',fullPage:true});
    assert.deepEqual(errors,[]); console.log('Renderer integration passed: edit → derive → review → export, approval invalidation, text safety, responsive layout, synthetic recording with real disk writes.');
  } finally {await electron.evaluate(({app})=>app.exit()); await fs.rm(dataDir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
})().catch(e=>{console.error(e);process.exitCode=1;});
