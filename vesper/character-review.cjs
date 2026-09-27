/* Actual geometry review: 3-view render, face close-up, six walking poses,
 * finite meshes/loop tracks and animated sole clearance.
 * Start server first: node vesper/character-review.cjs [base URL]
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
(async()=>{
 const browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:1050},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const output=path.join(__dirname,'assets');fs.mkdirSync(output,{recursive:true});
 try {
  await page.goto(process.argv[2]||'http://127.0.0.1:18760/vesper.html?qa=1');
  await page.waitForFunction(()=>window.__vesper);
  const result=await page.evaluate(async()=>{
   const THREE=await import('./vesper/vendor/three.module.js');
   const {createNailong}=await import('./vesper/character.js');
   window.requestAnimationFrame=()=>0;
   const scene=new THREE.Scene();scene.background=new THREE.Color('#eeeae3');
   const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1.5);renderer.setSize(1600,1050);
   renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   renderer.domElement.id='character-review';Object.assign(renderer.domElement.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'100000'});
   document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.body.append(renderer.domElement);
   scene.add(new THREE.HemisphereLight('#fff5da','#c0b6a3',1.6));
   const key=new THREE.DirectionalLight('#fff6dd',3);key.position.set(-3,6,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.018;scene.add(key);
   const fill=new THREE.DirectionalLight('#c8d7f2',.8);fill.position.set(4,3,-3);scene.add(fill);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:'#eeeae3',roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
   const camera=new THREE.OrthographicCamera(-2.48,2.48,1.6275,-1.6275,.1,60);camera.position.set(0,2.3,12);camera.lookAt(0,1.02,0);
   const models=[createNailong(),createNailong(),createNailong()];
   models.forEach((m,i)=>{m.root.position.x=(i-1)*1.67;m.root.rotation.y=[Math.PI/2,0,Math.PI][i];scene.add(m.root);m.update(0,{time:0});});
   renderer.render(scene,camera);
   const data={meshCount:0,vertices:0,clips:models[0].animations.map(a=>({name:a.name,duration:a.duration,tracks:a.tracks.length})),minSole:Infinity,maxSole:-Infinity};
   const qa=createNailong();qa.root.updateMatrixWorld(true);
   qa.root.traverseVisible(o=>{if(o.isMesh){data.meshCount++;const positions=o.geometry.attributes.position;data.vertices+=positions.count;for(const n of positions.array)if(!Number.isFinite(n))throw Error('Non-finite geometry');}});
   const vertex=new THREE.Vector3();
   const soles=[];
   if(qa.organicMesh&&qa.soleSamples){
    for(let o=qa.organicMesh;o;o=o.parent)if(!o.visible)throw Error('Organic sole mesh must be visible');
    for(const side of ['left','right']){
     const indices=Array.from(qa.soleSamples[side]||[]);
     if(!indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=qa.organicMesh.geometry.attributes.position.count))throw Error('Invalid organic sole sample '+side);
     soles.push({mesh:qa.organicMesh,indices});
    }
    data.soleSource='visible unified skin';
   }else{
    qa.root.traverseVisible(o=>{if(o.isMesh&&/foot|feet|toe/i.test(o.name))soles.push({mesh:o,indices:null});});
    data.soleSource='visible separate feet';
   }
   if(!soles.length)throw Error('No visible feet available for floor clearance test');
   data.soleSampleVertices=soles.reduce((count,source)=>count+(source.indices?source.indices.length:source.mesh.geometry.attributes.position.count),0);
   for(let i=0;i<120;i++){
    qa.update(1/60,{moving:true,speed:qa.gait.referenceSpeed,time:i/60});qa.root.updateMatrixWorld(true);qa.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
    if(i%3!==0)continue;
    for(const {mesh:foot,indices} of soles){
     let minimum=Infinity;const count=indices?indices.length:foot.geometry.attributes.position.count;
     for(let j=0;j<count;j++){
      foot.getVertexPosition(indices?indices[j]:j,vertex).applyMatrix4(foot.matrixWorld);if(!Number.isFinite(vertex.y))throw Error('Non-finite gait');
      minimum=Math.min(minimum,vertex.y);
     }
     data.minSole=Math.min(data.minSole,minimum);data.maxSole=Math.max(data.maxSole,minimum);
    }
   }
   window.__review={THREE,renderer,scene,camera,models,createNailong};return data;
  });
  assert.ok(result.clips.some(c=>c.name==='Idle')&&result.clips.some(c=>c.name==='Walk'),'both portable clips required');
  assert.ok(result.minSole>-.025,'walk feet penetrate floor: '+result.minSole);
  await page.screenshot({path:path.join(output,'nailong-three-view.jpg'),type:'jpeg',quality:95});
  await page.evaluate(()=>{
   const {renderer,scene,camera,models}=window.__review;models[0].root.visible=models[2].root.visible=false;
   camera.left=-.44;camera.right=.44;camera.top=.289;camera.bottom=-.289;camera.position.set(.11,1.85,5);camera.lookAt(0,1.80,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
  });
  await page.screenshot({path:path.join(output,'nailong-expression.jpg'),type:'jpeg',quality:95});
  await page.evaluate(()=>{
   const {renderer,scene,camera,models}=window.__review;
   models[1].root.rotation.y=-.95;
   camera.left=-.86;camera.right=.86;camera.top=.564;camera.bottom=-.564;
   camera.position.set(0,1.60,5);camera.lookAt(0,1.52,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
  });
  await page.screenshot({path:path.join(output,'nailong-face-profile.jpg'),type:'jpeg',quality:95});
  await page.evaluate(()=>{
   const {renderer,scene,camera,models}=window.__review;
   camera.left=-1.72;camera.right=1.72;camera.top=1.12875;camera.bottom=-1.12875;
   camera.position.set(0,1.28,5);camera.lookAt(0,1.00,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
  });
  await page.screenshot({path:path.join(output,'nailong-sculpt.jpg'),type:'jpeg',quality:95});
  await page.evaluate(()=>{
   const {renderer,scene,camera,models,createNailong}=window.__review;models.forEach(m=>scene.remove(m.root));
   for(let i=0;i<6;i++){const m=createNailong();m.root.position.set((i-2.5)*1.35,0,0);m.root.rotation.y=.5;m.mixer.stopAllAction();const clip=m.animations.find(a=>a.name==='Walk');m.mixer.clipAction(clip).reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();m.mixer.setTime(clip.duration*i/6);scene.add(m.root);}
   camera.left=-4.35;camera.right=4.35;camera.top=2.855;camera.bottom=-2.855;camera.position.set(0,2.1,12);camera.lookAt(0,1,0);camera.updateProjectionMatrix();renderer.render(scene,camera);
  });
  await page.screenshot({path:path.join(output,'nailong-walk-poses.jpg'),type:'jpeg',quality:95});
  assert.deepEqual(errors,[]);console.log(JSON.stringify(result));console.log('PASS geometry, animations, sole clearance and three-view render');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

