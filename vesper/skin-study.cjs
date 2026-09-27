
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
let pw;try{pw=require('playwright')}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'))}
const stage=process.argv[2]||'after',root=path.join(__dirname,'assets/skin-study'),out=path.join(root,stage);
if(fs.existsSync(path.join(out,'manifest.json')))throw Error('Use a new stage to keep previous material evidence.');
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await pw.chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const page=await browser.newPage({viewport:{width:1400,height:1100},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:18760/vesper.html?qa=1');await page.waitForFunction(()=>window.__vesper?.character,{timeout:120000});
await page.locator('#startButton').click();
await page.evaluate(()=>{window.requestAnimationFrame=cb=>{window.__skinFrame=cb;return 0}});await page.waitForTimeout(100);
const info=await page.evaluate(async()=>{
const v=window.__vesper,m=v.character,T=await import('./vesper/vendor/three.module.js');m.mixer.stopAllAction();m.mixer.clipAction(m.animations[0]).reset().play();m.mixer.setTime(0);v.world.update=()=>{};
const pose=()=>{m.mixer.setTime(0);m.root.position.set(0,0,3);m.root.rotation.set(0,-.80,0);m.root.updateMatrixWorld(true);m.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update()})};
const shot={camera:[0,1.7,8],target:[0,1,3],fov:33},render=v.renderer.render.bind(v.renderer);
v.renderer.render=(scene,camera)=>{if(scene===v.scene){pose();camera.position.fromArray(shot.camera);camera.lookAt(...shot.target);camera.fov=shot.fov;camera.updateProjectionMatrix()}return render(scene,camera)};
const style=document.createElement('style');style.textContent='body > :not(canvas):not(script):not(style){display:none!important} #world{display:block!important;visibility:visible!important}';document.head.append(style);
window.__skin={v,m,T,shot,time:performance.now(),pose};
return {materials:[m.organicMesh.material].map(a=>({name:a.name,roughness:a.roughness,ior:a.ior,specularIntensity:a.specularIntensity,clearcoat:a.clearcoat,clearcoatRoughness:a.clearcoatRoughness,emissive:a.emissive.getHexString(),transmission:a.transmission})),lights:m.root.children.filter(o=>o.isLight).map(o=>({color:o.color.getHexString(),intensity:o.intensity})),bones:m.organicMesh.skeleton.bones.map(b=>b.name),clips:m.animations.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length}))};
});
await page.evaluate(()=>window.__skinFrame(window.__skin.time));await page.screenshot({path:path.join(out,'church-quarter.jpg'),type:'jpeg',quality:95});
await page.evaluate(()=>{Object.assign(window.__skin.shot,{camera:[0,1.45,6.4],target:[0,1.3,3],fov:27});window.__skinFrame(window.__skin.time)});await page.screenshot({path:path.join(out,'church-skin.jpg'),type:'jpeg',quality:95});
await page.evaluate(()=>{
const {T,m}=window.__skin;m.root.position.set(0,0,0);m.root.rotation.set(0,-.90,0);m.root.traverse(o=>{if(o.isLight)o.visible=false;if(o.isMesh)for(const a of Array.isArray(o.material)?o.material:[o.material]){if(a.envMap){a.envMap=null;a.needsUpdate=true;}}});
const scene=new T.Scene();scene.background=new T.Color('#efefec');scene.add(m.root);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,1100);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
scene.add(new T.HemisphereLight('#ffffff','#c5c5c1',1.9));
for(const [p,intensity,shadow]of [[[-3.6,5.6,5],2.6,true],[[4,2.8,4],1.35,false],[[1,4,-4],.7,false]]){const l=new T.DirectionalLight('#ffffff',intensity);l.position.fromArray(p);l.target.position.set(0,1,0);l.castShadow=shadow;if(shadow){l.shadow.mapSize.set(2048,2048);Object.assign(l.shadow.camera,{left:-3,right:3,top:3,bottom:-3});l.shadow.normalBias=.008}scene.add(l,l.target)}
const floor=new T.Mesh(new T.PlaneGeometry(50,50),new T.MeshStandardMaterial({color:'#e7e7e3',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.001;floor.receiveShadow=true;scene.add(floor);
const camera=new T.PerspectiveCamera(30,1400/1100,.1,50);camera.position.set(0,1.15,4.6);camera.lookAt(0,1,0);
Object.assign(renderer.domElement.style,{position:'fixed',inset:0,zIndex:99999,visibility:'visible'});document.body.append(renderer.domElement);renderer.render(scene,camera);window.__skin.studio={scene,renderer,camera};
});
await page.screenshot({path:path.join(out,'neutral-quarter.jpg'),type:'jpeg',quality:95});
await page.evaluate(()=>{const {scene,renderer,camera}=window.__skin.studio;camera.position.set(0,1.7,2.7);camera.lookAt(0,1.5,.10);renderer.render(scene,camera)});
await page.screenshot({path:path.join(out,'neutral-skin.jpg'),type:'jpeg',quality:95});
if(errors.length)throw Error(errors.join('\n'));
const sources=['character.js','main.js','church.js'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex')}));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({stage,createdAt:new Date().toISOString(),...info,sources,errors},null,2));
console.log(JSON.stringify({stage,out,...info,errors}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});

