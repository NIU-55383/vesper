const fs=require('fs'),path=require('path');
let pw;try{pw=require('playwright')}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'))}
const stage=process.argv[2]||'first',out=path.join(__dirname,'assets/eye-integration',stage);
if(fs.existsSync(path.join(out,'manifest.json')))throw Error('Use a new stage to preserve previous review.');
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await pw.chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.argv.includes('--before'))await page.route('**/vesper/character.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'assets/eye-integration/before/character.js.txt'),'utf8')}));
 await page.goto('http://127.0.0.1:18760/vesper.html?qa=1');await page.waitForFunction(()=>window.__vesper,null,{timeout:120000});
 const info=await page.evaluate(async()=>{
  window.requestAnimationFrame=()=>0;
  const T=await import('./vesper/vendor/three.module.js'),{createNailong}=await import('./vesper/character.js'),m=createNailong();
  const scene=new T.Scene();scene.background=new T.Color('#eeeeeb');scene.add(m.root);
  scene.add(new T.HemisphereLight('#ffffff','#aaaab1',1.65));
  for(const [position,power] of [[[-3,4,4],2.6],[[4,1.8,3],.8],[[0,4,-3],.5]]){const l=new T.DirectionalLight('#ffffff',power);l.position.fromArray(position);scene.add(l)}
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;renderer.outputColorSpace=T.SRGBColorSpace;
  const camera=new T.OrthographicCamera(-.42,.42,.315,-.315,.01,10);camera.position.set(0,1.8,3);camera.lookAt(0,1.79,0);
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.body.replaceChildren(renderer.domElement);Object.assign(renderer.domElement.style,{position:'fixed',inset:0,width:'100%',height:'100%',zIndex:999999});
  m.update(0,{time:0});const materials=[],meshes=[];m.root.traverse(o=>{if(o.isMesh){meshes.push({name:o.name,vertices:o.geometry.attributes.position.count});materials.push(o.material.name)}});
  window.__eyeStudy={T,m,scene,renderer,camera};return {metadata:m.root.userData,meshes,materials,bones:m.organicMesh.skeleton.bones.length,clips:m.animations.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length}))};
 });
 for(const [name,angle,t] of [['front',0,0],['quarter',.60,0],['side',Math.PI/2,0],['closed',0,5.72],['reopened',0,6.05]]){
  await page.evaluate(({angle,t})=>{const {m,scene,renderer,camera}=window.__eyeStudy;m.root.rotation.y=angle;m.update(0,{time:t});m.root.updateMatrixWorld(true);m.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update()});renderer.render(scene,camera)},{angle,t});
  await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:95});
 }
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({...info,errors},null,2));console.log(JSON.stringify({out,...info,errors}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});