/* Local integration checks for the actual preview and source files. */
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const root=path.resolve(__dirname,'../..'),out=path.join(root,'宣传片');
const base=process.argv[3]||'http://127.0.0.1:18789/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+encodeURI('宣传片/资源预览.html'));await page.waitForFunction(()=>window.promoReady);
 const pack=await page.evaluate(()=>PROMO_PACK);
 const missing=[];
 for(const a of pack.assets){const r=await page.request.head(base+encodeURI(a.path));if(!r.ok())missing.push({id:a.id,status:r.status()});}
 const fixed=await page.evaluate(async()=>{
  const results=[];for(const kind of ['fire','atmosphere','cards','network','stars']){
   const a=await promoExport.renderEffect(kind,.42),b=await promoExport.renderEffect(kind,.42),c=await promoExport.renderEffect(kind,.76);
   results.push({kind,repeatable:a===b,changesWithProgress:a!==c});
  }return results;
 });
 await page.locator('[data-tab=effects]').click();
 for(const kind of ['fire','atmosphere','cards','network','stars']){await page.locator(`[data-fx=${kind}]`).click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
 await page.locator('[data-tab=assets]').click();
 const counts={};for(const kind of ['scene','original','cutout','text','effect','layer']){await page.locator('#assetKind').selectOption(kind);counts[kind]=await page.locator('#assetTiles figure').count();}
 await page.locator('[data-tab=layers]').click();const layerToggles=await page.locator('#layerControls input').count();
 if(layerToggles){await page.locator('#layerControls input').last().uncheck();await page.locator('#layerControls input').last().check();}
 await page.locator('[data-tab=audio]').click();const audioCount=await page.locator('audio').count();
 const audioDecoded=await page.evaluate(async()=>{const a=document.querySelector('audio');if(!a)return false;const c=new AudioContext();const data=await fetch(a.src).then(r=>r.arrayBuffer());const b=await c.decodeAudioData(data);await c.close();return b.duration>0;});
 await page.goto(base+encodeURI('宣传片/资源预览.html?shot=10'));await page.waitForFunction(()=>window.promoReady);
 const lastShot=await page.locator('[data-shot="10"]').getAttribute('class');
 await page.goto(base+encodeURI('宣传片/预览.html'));await page.waitForFunction(()=>window.promoReady);
 const legacyRedirect=page.url().includes(encodeURI('资源预览.html'));
 const fonts=await page.evaluate(()=>document.fonts.check('700 80px SourceHan')&&document.fonts.check('400 40px SourceHan'));
 const result={fontLoaded:fonts,assetCount:pack.assets.length,missing,counts,effects:fixed,layerToggles,audioCount,audioDecoded,lastShotSelected:lastShot?.includes('active'),legacyRedirect,errors};
 const passed=fonts&&!missing.length&&fixed.every(x=>x.repeatable&&x.changesWithProgress)&&counts.scene===9&&counts.original===20&&counts.cutout===13&&counts.text===10&&counts.effect===5&&counts.layer===3&&layerToggles===3&&audioCount===10&&audioDecoded&&result.lastShotSelected&&legacyRedirect&&!errors.length;
 result.passed=passed;fs.writeFileSync(path.join(out,'记录/浏览器检查.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 await browser.close();if(!passed)process.exitCode=1;
})();
