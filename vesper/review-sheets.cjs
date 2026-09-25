/* Contact sheets from real fixed-camera renders, without image synthesis. */
const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright')}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'))}
(async()=>{
 const base=path.join(__dirname,'assets/review-v7'),browser=await pw.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1840,height:1230},deviceScaleFactor:1});
  for(const mode of ['color','gray']){
   let cards='';
   for(const [stage,label]of [['before-neutral','修改前 · v6'],['final','修改后 · v7']]){
    for(const [view,title]of [['front','正面 / 正交'],['side','侧面 / 正交'],['back','背面 / 正交'],['quarter','四分之三 / 透视']]){
     const src='data:image/jpeg;base64,'+fs.readFileSync(path.join(base,stage,mode+'-'+view+'.jpg')).toString('base64');
     cards+=`<figure><figcaption><b>${label}</b><span>${title}</span></figcaption><img src="${src}"></figure>`;
    }
   }
   await page.setContent(`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f4f4ef;color:#27342b;font-family:"Microsoft YaHei",sans-serif;padding:30px 34px}header{display:flex;justify-content:space-between;align-items:end;margin:0 0 22px}h1{font-size:26px;margin:0}p{font-size:13px;color:#72786c;margin:8px 0 0}small{font-size:13px;color:#64715d}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px 14px}figure{margin:0;border:1px solid #dfe3d9;border-radius:7px;overflow:hidden}figcaption{font-size:12px;padding:10px 14px;display:flex;justify-content:space-between;background:#fbfcf8}figcaption span{color:#7c8178}img{width:100%;display:block}footer{margin-top:18px;color:#72786c;font-size:12px}</style><header><div><h1>奶龙 · ${mode==='gray'?'灰模轮廓':'材质与形体'}前后对照</h1><p>同一相机、模型尺度与中性白光 · 上排修改前 / 下排修改后</p></div><small>VESPER / 07</small></header><div class="grid">${cards}</div><footer>正、侧、背仅旋转角色；四分之三是固定独立透视机位。灰模统一替换材质。所有图像来自实际 3D 网格。</footer>`);
   await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
   await page.screenshot({path:path.join(base,mode+'-comparison.jpg'),type:'jpeg',quality:95,fullPage:true});
   console.log('Saved '+mode+'-comparison.jpg');
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

