/* Revision 7 compatibility and frozen in-game render verification.
 * Run only after the final model study: node vesper/v7-compatibility.cjs after [URL]
 * Does not modify runtime files, exported models or saved game state.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
const stage=process.argv[2]||'after',base=path.join(__dirname,'assets','review-v7');
if(!/^[a-z][a-z0-9-]*$/.test(stage))throw Error('Invalid review stage.');
const baseline=JSON.parse(fs.readFileSync(path.join(base,'before-neutral','manifest.json'),'utf8'));
const final=JSON.parse(fs.readFileSync(path.join(base,stage,'manifest.json'),'utf8'));
const output=path.join(base,stage,process.env.VESPER_QA_OUTPUT||'compatibility');
if(fs.existsSync(path.join(output,'report.json')))throw Error('Verification report already exists. Keep its evidence and use a new final stage.');
const b=baseline.geometry,a=final.geometry,checks=[];
function check(name,fn){try{fn();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,reason:e.message});}}
check('public height unchanged',()=>assert.equal(a.heightInterface,b.heightInterface));
check('public collision radius unchanged',()=>assert.equal(a.radiusInterface,b.radiusInterface));
check('2 m rest total height and root-level soles',()=>{assert.ok(Math.abs(a.bounds.size[1]-2)<.005);assert.ok(Math.abs(a.bounds.min[1])<.003);});
const bones=g=>g.bones.map(x=>({name:x.name,parent:x.parent}));
check('bone names, order and hierarchy unchanged',()=>assert.deepEqual(bones(a),bones(b)));
check('animation names, durations and track bindings unchanged',()=>assert.deepEqual(a.clips,b.clips));
check('public methods and joints unchanged',()=>assert.deepEqual(a.interfaces,b.interfaces));
check('same neutral review cameras and lights',()=>assert.deepEqual(final.settings,baseline.settings));
const jointRestChanges=a.bones.flatMap((x,i)=>JSON.stringify(x.position)!==JSON.stringify(b.bones[i]?.position)?[{name:x.name,before:b.bones[i]?.position,after:x.position}]:[]);
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(process.argv[3]||'http://127.0.0.1:18760/vesper.html?qa=1',{timeout:120000,waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__vesper?.character,{timeout:120000});
  await page.locator('#startButton').click();
  await page.evaluate(()=>{window.requestAnimationFrame=callback=>{window.__v7Frame=callback;return 0;};});
  await page.waitForTimeout(120);
  const previewRoundTrip=await page.evaluate(()=>{
   const v=window.__vesper;
   const snapshot=()=>{
    const lights=[];v.character.root.traverse(o=>{if(o.isLight)lights.push({uuid:o.uuid,name:o.name,type:o.type,visible:o.visible});});
    return {mode:v.mode,fov:v.camera.fov,position:v.player.position.toArray(),rotation:v.player.rotation.toArray(),lights,background:v.scene.background?.getHexString(),hasFog:!!v.scene.fog,exposure:v.renderer.toneMappingExposure};
   };
   const before=snapshot();v.enterModel();const preview=snapshot();v.leaveModel();const returned=snapshot();
   return {before,preview,returned};
  });
  check('real model preview uses neutral background and 30 degree lens',()=>{
   assert.equal(previewRoundTrip.preview.mode,'model');assert.equal(previewRoundTrip.preview.fov,30);
   assert.equal(previewRoundTrip.preview.background,'efefec');assert.equal(previewRoundTrip.preview.hasFog,false);
  });
  check('real model preview disables attached gameplay lights',()=>{
   assert.ok(previewRoundTrip.before.lights.length>0,'Expected the real character fill light');
   assert.deepEqual(previewRoundTrip.preview.lights.map(l=>l.uuid),previewRoundTrip.before.lights.map(l=>l.uuid));
   assert.ok(previewRoundTrip.preview.lights.every(l=>l.visible===false));
  });
  check('return from preview restores FOV and attached light visibility',()=>{
   assert.equal(previewRoundTrip.returned.fov,previewRoundTrip.before.fov);
   assert.deepEqual(previewRoundTrip.returned.lights,previewRoundTrip.before.lights);
  });
  check('return from preview restores player placement and game mode',()=>{
   assert.deepEqual(previewRoundTrip.returned.position,previewRoundTrip.before.position);
   assert.deepEqual(previewRoundTrip.returned.rotation,previewRoundTrip.before.rotation);
   assert.equal(previewRoundTrip.returned.mode,previewRoundTrip.before.mode);
   assert.equal(previewRoundTrip.returned.hasFog,previewRoundTrip.before.hasFog);
  });
  const result=await page.evaluate(async()=>{
   const THREE=await import('./vesper/vendor/three.module.js'),v=window.__vesper,m=v.character;
   m.root.position.set(0,0,0);m.root.rotation.set(0,0,0);m.mixer.stopAllAction();
   const mesh=m.organicMesh,p=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight,ix=mesh.geometry.index;
   const bones=mesh.skeleton.bones,bodyIndices=new Set(bones.flatMap((b,i)=>['OrganicRoot','Spine','Head'].includes(b.name)?[i]:[]));
   const wristIndices=new Set(bones.flatMap((b,i)=>['WristL','WristR'].includes(b.name)?[i]:[]));
   const torsoVertex=new Uint8Array(p.count),handSamples=[];
   for(let i=0;i<p.count;i++){
    let body=0,wrist=0;
    for(let c=0;c<4;c++){const bone=si.array[i*4+c],w=sw.array[i*4+c];if(bodyIndices.has(bone))body+=w;if(wristIndices.has(bone))wrist+=w;}
    torsoVertex[i]=body>.985&&p.getY(i)>.68&&p.getY(i)<1.40&&p.getZ(i)>.18?1:0;
    // Select the inward/back-facing skin of the fully wrist-bound hands.
    if(wrist>.999&&p.getY(i)>.72&&p.getY(i)<1.24&&p.getZ(i)>.44&&Math.abs(p.getX(i))<.40&&normal.getZ(i)<-.28&&i%3===0)handSamples.push(i);
   }
   const bodyTriangles=[];
   for(let j=0;j<ix.count;j+=3){const a=ix.getX(j),b=ix.getX(j+1),c=ix.getX(j+2);if(torsoVertex[a]&&torsoVertex[b]&&torsoVertex[c])bodyTriangles.push([a,b,c]);}
   const meshes=[];m.root.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
   const point=new THREE.Vector3(),posed=new Float32Array(p.count*3),frames=[];
   function matrices(){m.root.updateMatrixWorld(true);m.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});}
   function pose(clipName,fraction){
    m.mixer.stopAllAction();const clip=m.animations.find(c=>c.name===clipName);
    m.mixer.clipAction(clip).reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();m.mixer.setTime(clip.duration*fraction);matrices();
   }
   function contactDiagnostic(){
    const cell=.024,grid=new Map(),key=(x,y)=>x+','+y;
    for(const tri of bodyTriangles){
     let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
     for(const i of tri){xmin=Math.min(xmin,posed[i*3]);xmax=Math.max(xmax,posed[i*3]);ymin=Math.min(ymin,posed[i*3+1]);ymax=Math.max(ymax,posed[i*3+1]);}
     for(let x=Math.floor(xmin/cell);x<=Math.floor(xmax/cell);x++)for(let y=Math.floor(ymin/cell);y<=Math.floor(ymax/cell);y++){const k=key(x,y);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(tri);}
    }
    const gaps=[];
    for(const i of handSamples){
     const x=posed[i*3],y=posed[i*3+1],z=posed[i*3+2],candidates=grid.get(key(Math.floor(x/cell),Math.floor(y/cell)))||[];
     let front=-Infinity;
     for(const [a,b,c] of candidates){
      const ax=posed[a*3],ay=posed[a*3+1],bx=posed[b*3],by=posed[b*3+1],cx=posed[c*3],cy=posed[c*3+1];
      const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-12)continue;
      const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den,w=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den,t=1-u-w;
      if(Math.min(u,w,t)<-1e-5)continue;
      front=Math.max(front,u*posed[a*3+2]+w*posed[b*3+2]+t*posed[c*3+2]);
     }
     if(Number.isFinite(front))gaps.push(z-front);
    }
    gaps.sort((a,b)=>a-b);
    return {samples:handSamples.length,projectedSamples:gaps.length,minZGap:gaps[0]??null,medianZGap:gaps[Math.floor(gaps.length/2)]??null,p95ZGap:gaps[Math.floor(gaps.length*.95)]??null,over15mmInside:gaps.filter(x=>x<-.015).length,over30mmInside:gaps.filter(x=>x<-.030).length};
   }
   let totalVertexChecks=0,nonfinite=0,minimumSole=Infinity,maxBothOffGround=-Infinity;
   const phases={Idle:[0,.125,.25,.50,.75,.99999],Walk:[0,.08,.16,.25,.42,.50,.58,.66,.75,.84,.92,.99999]};
   for(const [clip,values] of Object.entries(phases))for(const phase of values){
    pose(clip,phase);
    for(const object of meshes)for(let i=0;i<object.geometry.attributes.position.count;i++){
     object.getVertexPosition(i,point).applyMatrix4(object.matrixWorld);totalVertexChecks++;
     if(![point.x,point.y,point.z].every(Number.isFinite))nonfinite++;
     if(object===mesh){posed[i*3]=point.x;posed[i*3+1]=point.y;posed[i*3+2]=point.z;}
    }
    const soles={};
    for(const side of ['left','right']){let y=Infinity;for(const i of m.soleSamples[side])y=Math.min(y,posed[i*3+1]);soles[side]=y;}
    minimumSole=Math.min(minimumSole,soles.left,soles.right);maxBothOffGround=Math.max(maxBothOffGround,Math.min(soles.left,soles.right));
    frames.push({clip,phase,soles,handBelly:contactDiagnostic()});
   }
   let loopError=0;
   for(const clip of m.animations)for(const track of clip.tracks){
    const size=track.getValueSize();
    for(const n of track.values)if(!Number.isFinite(n))nonfinite++;
    for(let c=0;c<size;c++)loopError=Math.max(loopError,Math.abs(track.values[c]-track.values[track.values.length-size+c]));
   }
   const materials=[];m.root.traverseVisible(o=>{if(o.isMesh)for(const mat of Array.isArray(o.material)?o.material:[o.material])materials.push({mesh:o.name,material:mat.name||mat.type,transparent:mat.transparent,opacity:mat.opacity,depthWrite:mat.depthWrite,depthTest:mat.depthTest,polygonOffset:mat.polygonOffset,roughness:mat.roughness,emissive:mat.emissive?.getHexString(),emissiveIntensity:mat.emissiveIntensity});});
   // Preserve the original church, light rig and postprocessing. Only freeze time,
   // set the requested character pose/camera immediately before the game RenderPass,
   // and hide the HTML HUD for unobstructed evidence.
   v.world.update=()=>{};
   const render=v.renderer.render.bind(v.renderer);
   const originalExposure=v.renderer.toneMappingExposure;
   const shot={clip:'Idle',phase:0,root:[0,0,-2],yaw:0,camera:[2.8,1.7,2.9],target:[0,1,-2],fov:39};
   v.renderer.render=function(scene,camera){
    if(scene===v.scene){
     pose(shot.clip,shot.phase);m.root.position.fromArray(shot.root);m.root.rotation.set(0,shot.yaw,0);matrices();
     camera.position.fromArray(shot.camera);camera.fov=shot.fov;camera.lookAt(...shot.target);camera.updateProjectionMatrix();
    }
    return render(scene,camera);
   };
   document.querySelectorAll('dialog[open]').forEach(d=>d.close());
   const style=document.createElement('style');style.textContent='body > :not(canvas):not(script):not(style){visibility:hidden!important} #world{visibility:visible!important}';document.head.append(style);
   window.__v7Validation={v,m,shot,pose,matrices,renderTime:performance.now()};
   return {totalVertexChecks,nonfinite,minimumSole,maxBothOffGround,loopError,frames,materials,gameLighting:{exposure:originalExposure,background:v.scene.background?.getHexString(),fog:!!v.scene.fog},handMethod:'Projected +Z gap from inward-facing, fully wrist-bound hand vertices to the animated torso front triangles. Negative means the sampled back surface lies inside the torso. This diagnostic is not a complete solid intersection or visual pass.'};
  });
  check('sampled real animated vertices and tracks finite',()=>assert.equal(result.nonfinite,0));
  check('sampled soles do not penetrate > 12 mm',()=>assert.ok(result.minimumSole>-.012,'minimum '+result.minimumSole));
  check('at least one sampled foot remains planted within 15 mm',()=>assert.ok(result.maxBothOffGround<.015,'unsupported '+result.maxBothOffGround));
  check('Idle and Walk loop track endpoints continuous',()=>assert.ok(result.loopError<1e-5));
  const shots=[
   {name:'church-overview',clip:'Idle',phase:0,root:[0,0,5],yaw:Math.PI,camera:[0,3.1,11.3],target:[0,3.6,-10],fov:57},
   {name:'church-idle-quarter',clip:'Idle',phase:0,root:[0,0,3],yaw:-.80,camera:[0,1.7,8.0],target:[0,1,3],fov:33},
   {name:'church-walk-00',clip:'Walk',phase:0},
   {name:'church-walk-25',clip:'Walk',phase:.25},
   {name:'church-walk-50',clip:'Walk',phase:.50},
   {name:'church-walk-75',clip:'Walk',phase:.75},
   {name:'church-hands-idle',clip:'Idle',phase:0,camera:[0,1.18,5.8],target:[0,1.07,3.2],fov:20},
   {name:'church-hands-walk-08',clip:'Walk',phase:.08},
   {name:'church-hands-walk-58',clip:'Walk',phase:.58}
  ];
  const files=[];
  for(const shot of shots){
   await page.evaluate(shot=>{Object.assign(window.__v7Validation.shot,shot);window.__v7Frame(window.__v7Validation.renderTime);},shot);
   const name=shot.name+'.jpg';await page.screenshot({path:path.join(output,name),type:'jpeg',quality:96});files.push(name);console.log(name);
  }
  const hashes=[];
  for(let repeat=0;repeat<3;repeat++){
   await page.evaluate(()=>window.__v7Frame(window.__v7Validation.renderTime));
   const bytes=await page.screenshot({type:'png'});hashes.push(crypto.createHash('sha256').update(bytes).digest('hex'));
  }
  const repeatRender={hashes,identical:new Set(hashes).size===1,scope:'Three repeats of identical frozen game time, pose and camera. Confirms frame determinism only; moving-camera z fighting still requires review of the saved near views.'};
  check('identical frozen in-game render is stable',()=>assert.ok(repeatRender.identical,'Repeated frame pixels differ'));
  check('browser page errors absent',()=>assert.deepEqual(errors,[]));
  const report={stage,createdAt:new Date().toISOString(),checks,pass:checks.every(x=>x.pass),jointRestChanges,geometry:{before:b.bounds,after:a.bounds},animation:result,previewRoundTrip,repeatRender,files,manualReviewRequired:['Inspect the original-church full and near images for readable dark areas, hand/back-of-palm penetration, and eyelid/pupil/skin boundaries.','Projection hand gaps are a diagnostic; shallow contact can be intentional. Do not report a clean mesh intersection test from this measurement.','Static deterministic renders do not prove every moving camera angle is free of z fighting.']};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({output,pass:report.pass,checks,vertexChecks:result.totalVertexChecks,minSole:result.minimumSole,handGapRange:result.frames.map(f=>({clip:f.clip,phase:f.phase,...f.handBelly}))},null,2));
  if(!report.pass)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

