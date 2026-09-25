/* Locked neutral-model review. Usage: node vesper/model-study.cjs before|silhouette|limbs|after [URL]
 * Refuses to overwrite a completed stage. The game is read only; the real character
 * is moved to a separate scene after its animation loop has stopped.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
const stage=process.argv[2]||'after';
if(!/^[a-z][a-z0-9-]*$/.test(stage))throw Error('Stage must be a simple lowercase label.');
const output=path.join(__dirname,'assets','review-v7',stage);
if(fs.existsSync(path.join(output,'manifest.json')))throw Error('Completed review stage already exists; use a new stage label to preserve its evidence: '+stage);
const settings={
 viewport:{width:1600,height:1800},pixelRatio:1,
 background:'#efefec',floor:'#e7e7e3',gray:'#9c9c96',
 toneMapping:'ACESFilmicToneMapping',exposure:1.04,
 lights:{hemisphere:{sky:'#ffffff',ground:'#c5c5c1',intensity:1.9},key:{color:'#ffffff',intensity:2.6,position:[-3.6,5.6,5],shadowMap:2048,normalBias:.008},fill:{color:'#ffffff',intensity:1.35,position:[4,2.8,4]},rim:{color:'#ffffff',intensity:.70,position:[1,4,-4]}},
 orthographic:{left:-1.102222222,right:1.102222222,top:1.24,bottom:-1.24,near:.1,far:60,position:[0,1,8],target:[0,1,0]},
 quarter:{type:'PerspectiveCamera',fov:30,near:.1,far:60,position:[0,1.15,5.02],target:[0,1,.02],yaw:-.90},
 views:[{name:'front',yaw:0},{name:'side',yaw:-Math.PI/2},{name:'back',yaw:Math.PI},{name:'quarter',yaw:-.90}]
};
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:settings.viewport,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const url=process.argv[3]||'http://127.0.0.1:18760/vesper.html?qa=1';
  await page.goto(url,{timeout:120000,waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__vesper?.character,{timeout:120000});
  await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(120);
  const geometry=await page.evaluate(async(settings)=>{
   const THREE=await import('./vesper/vendor/three.module.js');
   const model=window.__vesper.character;
   model.mixer.stopAllAction();model.root.position.set(0,0,0);model.root.rotation.set(0,0,0);
   model.update(0,{time:0,moving:false,speed:0});
   model.root.position.set(0,0,0);model.root.rotation.set(0,0,0);
   model.root.traverse(o=>{if(o.isLight)o.visible=false;}); // Exclude gameplay-local fill lights from the neutral rig.
   const scene=new THREE.Scene();scene.background=new THREE.Color(settings.background);scene.add(model.root);
   const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
   renderer.setSize(settings.viewport.width,settings.viewport.height);renderer.setPixelRatio(settings.pixelRatio);
   renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE[settings.toneMapping];renderer.toneMappingExposure=settings.exposure;
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   renderer.domElement.id='model-study';
   Object.assign(renderer.domElement.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',zIndex:'2147483647'});
   document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.body.append(renderer.domElement);
   const h=settings.lights.hemisphere;scene.add(new THREE.HemisphereLight(h.sky,h.ground,h.intensity));
   for(const name of ['key','fill','rim']){
    const l=settings.lights[name],light=new THREE.DirectionalLight(l.color,l.intensity);
    light.position.fromArray(l.position);light.target.position.set(0,1,0);scene.add(light.target);scene.add(light);
    if(name==='key'){light.castShadow=true;light.shadow.mapSize.set(l.shadowMap,l.shadowMap);Object.assign(light.shadow.camera,{left:-2.4,right:2.4,top:3,bottom:-2,near:.1,far:18});light.shadow.normalBias=l.normalBias;light.shadow.bias=-.00005;}
   }
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:settings.floor,roughness:1}));
   floor.rotation.x=-Math.PI/2;floor.position.y=-.001;floor.receiveShadow=true;scene.add(floor);
   const s=settings.orthographic;
   const camera=new THREE.OrthographicCamera(s.left,s.right,s.top,s.bottom,s.near,s.far);
   camera.position.fromArray(s.position);camera.lookAt(...s.target);
   const q=settings.quarter,quarterCamera=new THREE.PerspectiveCamera(q.fov,settings.viewport.width/settings.viewport.height,q.near,q.far);
   quarterCamera.position.fromArray(q.position);quarterCamera.lookAt(...q.target);
   const grayMaterial=new THREE.MeshStandardMaterial({color:settings.gray,roughness:.83,metalness:0});
   const materials=new Map();model.root.traverse(o=>{if(o.isMesh){materials.set(o,o.material);o.castShadow=true;}});
   model.root.updateMatrixWorld(true);model.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
   const box=new THREE.Box3(),v=new THREE.Vector3(),meshInfo=[],boneInfo=[];
   const seenBones=new Set();
   model.root.traverseVisible(o=>{
    if(o.isMesh){
     const a=o.geometry.attributes.position;let nonfinite=0;
     for(let i=0;i<a.count;i++){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);if(![v.x,v.y,v.z].every(Number.isFinite))nonfinite++;else box.expandByPoint(v);}
     meshInfo.push({name:o.name,vertices:a.count,triangles:o.geometry.index?o.geometry.index.count/3:a.count/3,skinned:!!o.isSkinnedMesh,nonfinite});
     if(o.isSkinnedMesh)for(const b of o.skeleton.bones){if(!seenBones.has(b)){seenBones.add(b);boneInfo.push({name:b.name,parent:b.parent?.name||'',position:b.position.toArray()});}}
    }
   });
   window.__modelStudy={THREE,model,scene,renderer,camera,quarterCamera,materials,grayMaterial};
   return {modelVersion:model.root.userData.modelVersion,heightInterface:model.height,radiusInterface:model.radius,bounds:{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()},meshes:meshInfo,bones:boneInfo,clips:model.animations.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.map(t=>t.name)})),interfaces:{update:typeof model.update,dispose:typeof model.dispose,mixer:!!model.mixer,organicMesh:!!model.organicMesh,soleSamples:!!model.soleSamples,joints:Object.keys(model.joints||{})}};
  },settings);
  for(const mode of ['color','gray']){
   for(const view of settings.views){
    await page.evaluate(({mode,view})=>{
     const r=window.__modelStudy;
     r.model.root.rotation.y=view.yaw;
     for(const [o,material] of r.materials)o.material=mode==='gray'?r.grayMaterial:material;
     r.model.root.updateMatrixWorld(true);r.model.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
     r.renderer.render(r.scene,view.name==='quarter'?r.quarterCamera:r.camera);
    },{mode,view});
    const file=mode+'-'+view.name+'.jpg';
    await page.screenshot({path:path.join(output,file),type:'jpeg',quality:96});
    console.log(stage+' '+file);
   }
  }
  assert.equal(errors.length,0,errors.join('\n'));
  assert.ok(geometry.bones.length>0,'Skinned model required');assert.ok(geometry.meshes.every(m=>m.nonfinite===0),'Non-finite geometry');
  const manifest={stage,createdAt:new Date().toISOString(),source:process.argv[3]||'http://127.0.0.1:18760/vesper.html?qa=1',settings,geometry,files:settings.views.flatMap(v=>['color-'+v.name+'.jpg','gray-'+v.name+'.jpg']),notes:['All front/side/back views use the same orthographic camera, light rig and model root. Only model yaw changes.','Quarter view has an independent locked perspective camera matching the supplied whole-body reference; do not derive orthographic widths from it.','Gray views replace all character materials to evaluate silhouette and surface transitions independently of color.','Floor plane is 1 mm below character root. Scene changes exist in the review page only.','Any lights attached to the character by the game are hidden in this separate review scene; only the locked neutral rig contributes.']};
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({output,bounds:geometry.bounds,bones:geometry.bones.length,meshes:geometry.meshes.length,clips:geometry.clips.map(c=>c.name),errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


