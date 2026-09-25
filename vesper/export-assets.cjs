/* Re-export the authored Three.js geometry and capture the real game view.
   Start the app first; optionally pass its URL as the first argument. */
const fs=require('node:fs'),path=require('node:path');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
(async()=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:960}});
 try {
  const url=process.argv[2]||'http://127.0.0.1:18760/vesper.html?qa=1';
  await page.goto(url);await page.waitForFunction(()=>window.__vesper,{timeout:30000});
  const assets=path.join(__dirname,'assets');fs.mkdirSync(assets,{recursive:true});
  for(const kind of (process.argv.includes('--character-only')?['character']:['character','church'])){
   const encoded=await page.evaluate(kind=>window.__vesper.exportGLB(kind),kind);
   const out=path.join(assets,kind==='character'?'nailong.glb':'church.glb');fs.writeFileSync(out,Buffer.from(encoded,'base64'));
   const data=fs.readFileSync(out),json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
   if(data.toString('utf8',0,4)!=='glTF')throw new Error('Invalid GLB');
   console.log(path.basename(out),data.length+' bytes','nodes '+json.nodes.length,'animations '+(json.animations||[]).map(a=>a.name).join(','));
  }
  await page.waitForTimeout(700);
  await page.screenshot({path:path.join(assets,'game-preview.jpg'),type:'jpeg',quality:92});
  await page.addStyleTag({content:'.topbar,.intro,.intro-footer,.loading{display:none!important}'});
  await page.screenshot({path:path.join(assets,'cover.jpg'),type:'jpeg',quality:90});
  await page.evaluate(()=>window.__vesper.enterModel());await page.locator('#panelClose').click();await page.waitForTimeout(900);
  await page.addStyleTag({content:'.model-bar{display:none!important}'});
  await page.screenshot({path:path.join(assets,'nailong-preview.jpg'),type:'jpeg',quality:92});
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

