/* Usage: node 导出预览.cjs <playwright-package-directory> [base-url] */
const fs=require('node:fs');const path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const out=path.resolve(__dirname,'..');const base=process.argv[3]||'http://127.0.0.1:18789/';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+encodeURI('宣传片/资源预览.html'));await page.waitForFunction(()=>window.promoReady);await page.evaluate(()=>document.fonts.ready);
function save(data,file){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(data.split(',')[1],'base64'));}
for(let i=1;i<=10;i++){const id=String(i).padStart(2,'0');const data=await page.evaluate(async id=>window.promoExport.renderShot(id,{textOnly:true}),id);save(data,path.join(out,'素材/文字',`TXT-${id}.png`));}
for(const id of ['05','10']){const data=await page.evaluate(async id=>window.promoExport.renderShot(id,{progress:1,effects:false}),id);save(data,path.join(out,'素材/组件构图',`SHOT-${id}.png`));}
const frames=[];
for(let i=1;i<=10;i++){const id=String(i).padStart(2,'0');const data=await page.evaluate(async id=>window.promoExport.renderShot(id,{progress:.65}),id);save(data,path.join(out,'效果稿/逐镜',`SHOT-${id}.png`));frames.push(data);}
const contact=await page.evaluate(async frames=>{const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=2900;const ctx=canvas.getContext('2d');ctx.fillStyle='#101d2d';ctx.fillRect(0,0,1920,2900);for(let i=0;i<frames.length;i++){const im=new Image();im.src=frames[i];await im.decode();const x=(i%2)*960,y=Math.floor(i/2)*580;ctx.drawImage(im,x+16,y+16,928,522);ctx.font='400 20px SourceHan';ctx.fillStyle='#e9be72';ctx.fillText('镜头 '+String(i+1).padStart(2,'0')+' / '+PROMO_PACK.shots[i].name,x+20,y+565);}return canvas.toDataURL('image/png');},frames);save(contact,path.join(out,'效果稿/分镜静帧总览.png'));
const mogao=await page.evaluate(()=>window.promoExport.renderShot('04',{progress:.65,variant:'mogao'}));save(mogao,path.join(out,'效果稿/逐镜/SHOT-04B.png'));
for(const kind of ['fire','atmosphere','cards','network','stars']){const data=await page.evaluate(async kind=>window.promoExport.renderEffect(kind,.6),kind);save(data,path.join(out,'素材/效果',`FX-${kind}.png`));}
for(const [id,name]of [['04','01-古代创造与奇观'],['06','02-工业工程与现代科学'],['09','03-星辰与桌游']]){const data=await page.evaluate(async id=>window.promoExport.renderShot(id,{progress:.65}),id);save(data,path.join(out,'效果稿',name+'.png'));}
const layers=await page.evaluate(()=>window.promoExport.renderLayers());save(layers,path.join(out,'素材/图层/BG-09/拼合检查.png'));
await page.setViewportSize({width:1440,height:1080});await page.reload();await page.waitForFunction(()=>window.promoReady);await page.screenshot({path:path.join(out,'效果稿/素材预览.png'),fullPage:true});
const sourceFonts=await page.evaluate(()=>document.fonts.check('700 80px SourceHan'));if(!sourceFonts)errors.push('Font loading failed');
console.log(JSON.stringify({text:10,product:2,effects:5,studies:3,shotFrames:10,fontLoaded:sourceFonts,errors}));await browser.close();if(errors.length)process.exitCode=1;})();
