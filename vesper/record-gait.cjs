/* Render actual Three.js animation, two angles, without external media. */
const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
(async()=>{
 const browser=await pw.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.argv[2]||'http://127.0.0.1:18760/vesper.html?qa=1');
  await page.waitForFunction(()=>window.__vesper);
  const video=await page.evaluate(async()=>{
   const THREE=await import('./vesper/vendor/three.module.js'),{createNailong}=await import('./vesper/character.js');
   // Stop the church renderer while recording a separate model study.
   window.requestAnimationFrame=()=>0;
   const scene=new THREE.Scene();scene.background=new THREE.Color('#e8e4dc');
   const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,800);renderer.setPixelRatio(1);
   renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
   const camera=new THREE.OrthographicCamera(-2.2,2.2,1.375,-1.375,.1,50);camera.position.set(0,1.95,10);camera.lookAt(0,1.01,0);
   scene.add(new THREE.HemisphereLight('#fff3db','#b0a797',1.4));
   const light=new THREE.DirectionalLight('#fff6e6',3);light.position.set(-3,6,5);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-5;light.shadow.camera.right=5;light.shadow.camera.top=4;light.shadow.camera.bottom=-4;light.shadow.normalBias=.012;scene.add(light);
   const fill=new THREE.DirectionalLight('#b7c9e7',.75);fill.position.set(4,3,-2);scene.add(fill);
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:'#e8e4dc',roughness:.92}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;floor.receiveShadow=true;scene.add(floor);
   const models=[createNailong(),createNailong()];
   models.forEach((m,i)=>{m.root.position.x=i?1.02:-1.03;m.root.rotation.y=i?Math.PI/2:.40;scene.add(m.root);});
   const canvas=renderer.domElement;canvas.style='position:fixed;inset:0;z-index:100000';document.body.append(canvas);document.querySelectorAll('dialog[open]').forEach(d=>d.close());
   const stream=canvas.captureStream(30),chunks=[],mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
   const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
   rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   const result=new Promise(resolve=>{rec.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks,{type:mime}).arrayBuffer());let encoded='';for(let i=0;i<bytes.length;i+=0x8000)encoded+=String.fromCharCode(...bytes.subarray(i,i+0x8000));resolve(btoa(encoded));};});
   // Run at a fixed cadence for a reproducible view of idle -> walk -> idle.
   const start=performance.now();let last=start;
   const timer=setInterval(()=>{
    const now=performance.now(),t=(now-start)/1000,dt=Math.min((now-last)/1000,.05);last=now;
    for(const m of models)m.update(dt,{moving:t>.65&&t<7.25,speed:m.gait.referenceSpeed,time:t});
    renderer.render(scene,camera);
    if(t>8){clearInterval(timer);rec.stop();stream.getTracks().forEach(t=>t.stop());}
   },1000/30);
   renderer.render(scene,camera);rec.start(100);return result;
  });
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(__dirname,'assets/nailong-walk.webm'),Buffer.from(video,'base64'));
  console.log('PASS actual model animation recorded: assets/nailong-walk.webm');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
