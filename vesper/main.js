import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createNailong } from './character.js';
import { buildChurch } from './church.js';
import { createState, restoreState, interact, playNotes, alignMirror, getObjective, getHint, getInventory, getJournal } from './puzzle.mjs';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SAVE = 'vesper-save-v1';
const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key,value) => { try { localStorage.setItem(key,value); } catch {} };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = restoreState(read(SAVE)), mode='intro', previousMode='intro', lastTime=0, elapsed=0, nearest=null, toastTimer;
let panelToken=0;
let yaw=0, pitch=.05, distance=5.5, dragging=null, walkSpeed=0, notes=[], quality=read('vesper-quality') || (innerWidth<700?'balanced':'high');
let renderer, scene, camera, world, character, composer, bloom;
const keys = new Set(), touch = new THREE.Vector2(), cameraTarget = new THREE.Vector3(), lookTarget = new THREE.Vector3();
const points = [
 {id:'journal',name:'翻阅遗落的手记',x:-7,z:10},
 {id:'organ',name:'弹奏旧风琴',x:-6,z:-11},
 {id:'mirror',name:'调整黄铜反光镜',x:7,z:-6},
 {id:'altar',name:'查看十字架下的石台',x:0,z:-13},
 {id:'exit',name:'查看教堂正门',x:0,z:15}
];
const audio = window.BoardGameAudio.create({storagePrefix:'vesper'});
if(read('vesper-muted')===null) audio.setMuted(true);
let audioContext, ambientGain;
function unlockAudio() {
 audio.unlock();
 if(!audioContext) {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if(!Audio) return;
  audioContext=new Audio(); ambientGain=audioContext.createGain(); ambientGain.gain.value=0; ambientGain.connect(audioContext.destination);
  [55,82.41,110.15].forEach((f,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=f;g.gain.value=i===0?.08:.022;o.connect(g).connect(ambientGain);o.start();});
 }
 if(audioContext.state==='suspended') audioContext.resume().catch(()=>{});
 updateSound();
}
function updateSound() {
 $('soundButton').classList.toggle('muted',audio.muted);
 $('soundButton').ariaLabel=audio.muted?'打开声音':'关闭声音';
 if(ambientGain) ambientGain.gain.setTargetAtTime(audio.muted||document.hidden?0:audio.volume*.15,audioContext.currentTime,.3);
}
function tone(note, length=.8) {
 if(audio.muted||document.hidden) return;
 unlockAudio(); if(!audioContext) return;
 const f=({C:261.63,D:293.66,E:329.63,F:349.23,G:392,A:440,B:493.88,step:80})[note] || 440;
 const g=audioContext.createGain(),o=audioContext.createOscillator(),h=audioContext.createOscillator();
 o.frequency.value=f; h.frequency.value=f*2; o.type='sine';h.type='sine';
 const hg=audioContext.createGain();hg.gain.value=.13;h.connect(hg).connect(g);o.connect(g);g.connect(audioContext.destination);
 const now=audioContext.currentTime;
 g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime((note==='step'?.025:.12)*audio.volume,now+.03);g.gain.exponentialRampToValueAtTime(.0001,now+length);
 o.start();h.start();o.stop(now+length);h.stop(now+length);
 o.onended=()=>{o.disconnect();h.disconnect();hg.disconnect();g.disconnect();};
}
$('soundButton').onclick=()=>{audio.setMuted(!audio.muted);unlockAudio();updateSound();};
updateSound();
const profile={name:read('boardclub-name')||'旅人',socialId:'vesper-local-traveller',avatar:window.BoardGameUI.getAvatar(),connected:true};
$('playerName').value=profile.name;
window.BoardGameUI.mountAvatarPicker($('avatarPicker'),$('playerName'));
const social=window.BoardGameUI.mountInteractions(()=>({code:'vesper-solo',players:[profile],you:profile.socialId,connected:true}),()=>{}, {audio,onSoundChange:updateSound});
function updateAvatar() {$('playerAvatar').innerHTML=window.BoardGameUI.avatar(profile,true,'vesper-avatar',true);social.sync();}
window.addEventListener('board-avatar-change',({detail})=>{profile.avatar=window.AvatarData.normalize(detail.avatar);updateAvatar();});
updateAvatar();

function toast(text) {clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function save() {write(SAVE,JSON.stringify(state));updateHUD();}
function updateHUD() {
 $('objectiveText').textContent=getObjective(state);
 $('progressDots').innerHTML=[state.journalRead,state.organSolved,state.beamAligned,state.keyTaken,state.escaped].map(done=>'<i class="'+(done?'done':'')+'"></i>').join('');
 const icons={journal:'▤',lens:'◉',key:'⚿'};
 $('inventory').innerHTML=getInventory(state).map(item=>'<button title="'+esc(item.name)+'" aria-label="'+esc(item.name)+'" data-item="'+item.id+'">'+icons[item.id]+'</button>').join('');
 $('inventory').querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const item=getInventory(state).find(i=>i.id===b.dataset.item);openPanel(item.name,'<p>'+esc(item.description)+'</p>');});
 if(world) {if(world.key)world.key.visible=state.beamAligned&&!state.keyTaken;world.setMirror?.(state.mirrorAngle||30);world.setEscaped?.(state.escaped);world.setBeamAligned?.(state.beamAligned);}
 if($('startButton')) $('startLabel').textContent=state.journalRead&&!state.escaped?'继续探索':'走进教堂';
}
function openPanel(title,html,eyebrow='VESPER · EXPLORATION') {
 panelToken++;keys.clear();dragging=null;touch.set(0,0);$('joystickKnob').style.transform='';
 $('panelTitle').textContent=title;$('panelBody').innerHTML=html;$('panelEyebrow').textContent=eyebrow;
 if(!$('panel').open) $('panel').showModal();
}
function closePanel() {panelToken++;$('panel').close();keys.clear();if(mode==='playing')$('world').focus({preventScroll:true});}
$('panelClose').onclick=closePanel;
$('panel').addEventListener('cancel',()=>{panelToken++;keys.clear();});
$('panel').addEventListener('click',e=>{if(e.target===$('panel')){const r=$('panel').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();}});
function showJournal() {
 const entries=getJournal(state);
 openPanel('探索手记', '<p>光会记得离开的路。旅途中找到的线索都会留在这里。</p>'+entries.map(e=>'<hr><h3>'+esc(e.title)+'</h3><p>'+esc(e.text)+'</p>').join('')+'<div class="actions"><button class="action" id="hintButton">给我一点提示</button></div>','FIELD NOTES · '+String(entries.length).padStart(2,'0'));
 $('hintButton').onclick=()=>{toast(getHint(state));};
}
$('journalButton').onclick=showJournal;
function settings() {
 openPanel('片刻停留','<p>W / A / S / D 或方向键行走，Shift 快走。<br>按住鼠标拖动环顾，滚轮拉近或拉远。<br>走近物件按 E 互动；J 查看手记；Esc 暂停。<br>手机：左侧摇杆行走，拖动右侧画面环顾。</p><hr><label class="settings-row">画面质量<select id="qualitySelect"><option value="high">精致</option><option value="balanced">流畅</option><option value="low">低功耗</option></select></label><label class="settings-row">音效音量 <span id="volumeText">'+Math.round(audio.volume*100)+'%</span></label><input id="volumeControl" type="range" min="0" max="100" value="'+Math.round(audio.volume*100)+'" aria-label="音效音量"><div class="actions"><button class="action" id="resumeButton">返回探索</button><button class="action quiet" id="resetButton">重新开始</button><button class="action quiet" id="inspectModel">查看奶龙</button></div>','PAUSE · TAKE A BREATH');
 $('qualitySelect').value=quality;$('qualitySelect').onchange=e=>{quality=e.target.value;write('vesper-quality',quality);resize();};
 $('volumeControl').oninput=e=>{audio.setVolume(Number(e.target.value)/100);$('volumeText').textContent=e.target.value+'%';updateSound();};
 $('resumeButton').onclick=closePanel;$('inspectModel').onclick=()=>{closePanel();enterModel();};
 $('resetButton').onclick=()=>{openPanel('重新开始旅程','<p>这会清除本次探索的手记、物品与谜题进度。</p><div class="actions"><button id="confirmReset" class="action">清除进度并开始</button><button id="cancelReset" class="action quiet">保留进度</button></div>');$('cancelReset').onclick=settings;$('confirmReset').onclick=()=>{state=createState();save();closePanel();start();};};
}
$('settingsButton').onclick=settings;
function applyResult(result) {
 state=result.state;save();
 if(result.changed) tone('G',.45);
 if(result.kind==='win') {
  closePanel();mode='won';$('interactButton').hidden=true;
  openPanel('微光之后，是归途。','<p>'+esc(result.text)+'</p><h3>奶龙胜利 / Nailong wins</h3><p>乐音唤醒了旧风琴。侧窗的光穿过尘埃，照亮了离开的路。<br>你带走的，只有这段安静的回声。</p><div class="actions"><button id="roamButton" class="action">留在教堂看看</button><button id="againButton" class="action quiet">再一次旅程</button></div>','CHAPTER COMPLETE · VESPER');
  $('roamButton').onclick=()=>{closePanel();mode='playing';};$('againButton').onclick=()=>{state=createState();save();closePanel();start();};return;
 }
 let html='<p>'+esc(result.text)+'</p>';
 if(result.kind==='organ') {
  notes=[];html+='<p id="playedNotes" class="played-notes">· · ·</p><div class="piano">'+result.choices.map(c=>'<button data-note="'+c.value+'" aria-label="'+esc(c.label)+'">'+esc(c.label)+'</button>').join('')+'</div><div class="actions"><button class="action quiet" id="clearNotes">重新弹奏</button><button class="action quiet" id="clueButton">查看手记</button></div>';
 } else if(result.kind==='mirror') {
  html+='<div class="actions">'+result.choices.map(c=>'<button class="action" data-angle="'+c.value+'">'+esc(c.label)+'</button>').join('')+'</div>';
 } else html+='<div class="actions"><button class="action" id="continueButton">收起 · 继续探索</button></div>';
 openPanel(result.title,html,result.kind==='organ'?'THE ORGAN · THREE NOTES':result.kind==='mirror'?'THE LIGHT · A FORGOTTEN PATH':'FOUND IN THE SANCTUARY');
 $('continueButton')?.addEventListener('click',closePanel);
 $('panelBody').querySelectorAll('[data-note]').forEach(b=>b.onclick=()=>{
  if(notes.length>=3)return;notes.push(b.dataset.note);tone(b.dataset.note);$('playedNotes').textContent=notes.join('  ·  ');
  if(notes.length===3){const chosen=[...notes], token=panelToken;setTimeout(()=>{if(token===panelToken&&$('panel').open&&$('playedNotes'))applyResult(playNotes(state,chosen));},350);}
 });
 $('clearNotes')?.addEventListener('click',()=>{panelToken++;notes=[];$('playedNotes').textContent='· · ·';});
 $('clueButton')?.addEventListener('click',showJournal);
 $('panelBody').querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>applyResult(alignMirror(state,Number(b.dataset.angle))));
}
function interactWith(id) {
 if(mode!=='playing'||$('panel').open)return false;
 const point=points.find(p=>p.id===id);
 if(!point||Math.hypot(point.x-character.root.position.x,point.z-character.root.position.z)>2.3)return false;
 applyResult(interact(state,id));return true;
}
function doInteract(){if(nearest)interactWith(nearest.id);else toast('靠近手记、风琴或反光镜，寻找更多线索。');}
$('interactButton').onclick=doInteract;$('touchInteract').onclick=doInteract;

function start() {
 renderer.toneMappingExposure=1.15;bloom.enabled=quality==='high';mode='playing';document.body.classList.remove('model-mode');
 $('intro').hidden=true;$('introFooter').hidden=true;$('hud').hidden=false;
 character.root.position.set(0,0,10);character.root.rotation.y=Math.PI;character.root.scale.setScalar(1);
 yaw=0;pitch=.05;distance=5.7;keys.clear();scene.fog=churchFog;worldGroupVisible(true);
 camera.position.set(0,2.85,15.2);lookTarget.copy(character.root.position).add(new THREE.Vector3(0,2.0,0));
 unlockAudio();closePanel();save();toast('教堂静得只剩脚步声。入口左侧，似乎遗落了一本手记。');
}
let churchFog=null, modelLight, modelFloor;
function worldGroupVisible(visible) {for(const child of scene.children){if(child!==character.root&&child!==modelLight&&child!==modelFloor)child.visible=visible;}modelLight.visible=!visible;modelFloor.visible=!visible;}
function enterModel() {
 if(mode==='model')return;
 modelWalking=false;$('modelWalk').textContent='播放行走';
 modelReturnState={position:character.root.position.clone(),rotation:character.root.rotation.clone(),yaw,pitch,distance};
 previousMode=mode;mode='model';renderer.toneMappingExposure=.93;bloom.enabled=false;document.body.classList.add('model-mode');closePanel();scene.fog=null;worldGroupVisible(false);scene.background=new THREE.Color('#efede6');
 character.root.position.set(0,0,0);character.root.rotation.y=0;distance=3.0;yaw=.95;pitch=.025;
 openPanel('认识奶龙','<p>一个安静、略带忧伤的小小旅人。<br>饱满的肚子、轻扶腹部的双手与安静的目光，带呼吸、眨眼和缓缓行走的动作。</p><div class="actions"><button class="action" id="walkPreview">播放走路动作</button><button class="action quiet" id="modelReturn">返回教堂</button></div><p style="font-size:11px">关闭此卡片后，拖动旋转视角；滚轮缩放。按 Esc 返回教堂。</p>','CHARACTER STUDY · NAILONG');
 $('walkPreview').onclick=()=>{modelWalking=!modelWalking;$('walkPreview').textContent=modelWalking?'暂停走路动作':'播放走路动作';$('modelWalk').textContent=modelWalking?'暂停行走':'播放行走';if($('walkPreview'))$('walkPreview').textContent=modelWalking?'暂停走路动作':'播放走路动作';};
 $('modelReturn').onclick=leaveModel;
}
let modelWalking=false, modelReturnState=null;
function leaveModel() {closePanel();renderer.toneMappingExposure=1.15;bloom.enabled=quality==='high';document.body.classList.remove('model-mode');scene.background=new THREE.Color('#17141d');scene.fog=churchFog;worldGroupVisible(true);mode=previousMode;if(modelReturnState){character.root.position.copy(modelReturnState.position);character.root.rotation.copy(modelReturnState.rotation);yaw=modelReturnState.yaw;pitch=modelReturnState.pitch;distance=modelReturnState.distance;}$('intro').hidden=mode!=='intro';$('introFooter').hidden=mode!=='intro';$('hud').hidden=mode==='intro';updateHUD();}

$('modelButton').onclick=enterModel;$('modelBack').onclick=leaveModel;$('modelWalk').onclick=()=>{modelWalking=!modelWalking;$('modelWalk').textContent=modelWalking?'暂停行走':'播放行走';};
function resize() {
 if(!renderer)return;renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?1.6:quality==='balanced'?1.1:.8));renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);bloom.enabled=quality==='high'&&mode!=='model';renderer.shadowMap.enabled=quality!=='low';
}
function blocked(x,z) {
 const r=.36;if(x < -8.15||x>8.15||z < -14.65||z>15.25)return true;
 return world.colliders.some(c=>x>c.minX-r&&x<c.maxX+r&&z>c.minZ-r&&z<c.maxZ+r);
}
function move(dx,dz) {
 const p=character.root.position, steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
 for(let i=0;i<steps;i++){if(!blocked(p.x+dx/steps,p.z))p.x+=dx/steps;if(!blocked(p.x,p.z+dz/steps))p.z+=dz/steps;}
}
window.addEventListener('keydown',e=>{
 if(e.target.matches('input,select,textarea'))return;
 if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(mode==='model'){e.preventDefault();leaveModel();}else if(!$('panel').open&&mode!=='intro')settings();return;}
 if($('panel').open||document.querySelector('#avatarDialog[open]'))return;
 if(e.code==='KeyE'&&!e.repeat)doInteract();
 if(e.code==='KeyJ'&&!e.repeat)showJournal();
 keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();touch.set(0,0);dragging=null;});
document.addEventListener('visibilitychange',()=>{keys.clear();touch.set(0,0);updateSound();if(document.hidden){audio.stop();audioContext?.suspend();}else if(!audio.muted)audioContext?.resume().catch(()=>{});});
$('world').addEventListener('pointerdown',e=>{if(!['playing','model'].includes(mode))return;dragging={id:e.pointerId,x:e.clientX,y:e.clientY};$('world').setPointerCapture(e.pointerId);});
$('world').addEventListener('pointermove',e=>{if(!dragging||dragging.id!==e.pointerId)return;yaw-=(e.clientX-dragging.x)*.006;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-dragging.y)*.004,-.08,.86);dragging.x=e.clientX;dragging.y=e.clientY;});
const stopDrag=()=>{dragging=null;};$('world').addEventListener('pointerup',stopDrag);$('world').addEventListener('pointercancel',stopDrag);
$('world').addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.005,mode==='model'?2.6:2.8,mode==='model'?7:8);},{passive:false});
let joystickId=null;
$('joystick').onpointerdown=e=>{joystickId=e.pointerId;$('joystick').setPointerCapture(e.pointerId);updateStick(e);};
function updateStick(e){if(e.pointerId!==joystickId)return;const r=$('joystick').getBoundingClientRect();touch.set((e.clientX-r.left-r.width/2)/34,(e.clientY-r.top-r.height/2)/34);if(touch.length()>1)touch.normalize();$('joystickKnob').style.transform='translate('+touch.x*28+'px,'+touch.y*28+'px)';}
$('joystick').onpointermove=updateStick;
const stopStick=()=>{joystickId=null;touch.set(0,0);$('joystickKnob').style.transform='';};$('joystick').onpointerup=stopStick;$('joystick').onpointercancel=stopStick;
function frame(now) {
 requestAnimationFrame(frame);
 const dt=Math.min((now-lastTime)/1000||.016,.045);lastTime=now;if(document.hidden)return;elapsed+=dt;
 const active=mode==='playing'&&!$('panel').open&&!document.querySelector('#avatarDialog[open]');
 let moving=false;
 if(active){
  let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch.x;
  let z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+touch.y;
  const len=Math.hypot(x,z);if(len>.1){x/=Math.max(1,len);z/=Math.max(1,len);const dx=x*Math.cos(yaw)+z*Math.sin(yaw),dz=-x*Math.sin(yaw)+z*Math.cos(yaw);const speed=character.gait.referenceSpeed*(keys.has('ShiftLeft')||keys.has('ShiftRight')?1.8:1);
   const before=character.root.position.clone();move(dx*speed*dt,dz*speed*dt);moving=before.distanceToSquared(character.root.position)>.000001;walkSpeed=before.distanceTo(character.root.position)/Math.max(dt,.0001);
   const target=Math.atan2(dx,dz);character.root.rotation.y+=Math.atan2(Math.sin(target-character.root.rotation.y),Math.cos(target-character.root.rotation.y))*Math.min(1,dt*12);
  }
 }
 character.update(dt,{moving:mode==='model'?modelWalking:moving,speed:mode==='model'?character.gait.referenceSpeed:walkSpeed,time:elapsed});
 if(mode==='playing'&&moving)for(const foot of character.gait.stepEvents)tone('step',.095);
 world.update(dt,reduced?0:elapsed);
 if(mode==='intro'){
  camera.position.set(.4+(reduced?0:Math.sin(elapsed*.035)*.18),2.9,14.7);
  camera.lookAt(0,5.25,-12);
 }else{
  cameraTarget.copy(character.root.position).add(new THREE.Vector3(0,mode==='model'?1.0:2.0,0));
  const offset=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance+(mode==='model'?.12:.6),Math.cos(yaw)*Math.cos(pitch)*distance);
  const desired=cameraTarget.clone().add(offset);
  if(mode!=='model'){desired.x=THREE.MathUtils.clamp(desired.x,-8.4,8.4);desired.z=THREE.MathUtils.clamp(desired.z,-15,15.6);desired.y=THREE.MathUtils.clamp(desired.y,1.7,4.8);}
  camera.position.lerp(desired,1-Math.exp(-dt*8));lookTarget.lerp(cameraTarget,1-Math.exp(-dt*10));camera.lookAt(lookTarget);
 }
 if(mode==='playing'){
  nearest=points.map(p=>({...p,d:Math.hypot(character.root.position.x-p.x,character.root.position.z-p.z)})).sort((a,b)=>a.d-b.d)[0];if(nearest.d>2.3)nearest=null;
  $('interactButton').hidden=!nearest||$('panel').open;if(nearest)$('interactLabel').textContent=nearest.name;
  $('compassNeedle').style.transform='rotate('+(-yaw)+'rad)';
 }
 composer.render();
}
async function boot(){
 try{
  renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();scene.background=new THREE.Color('#17121e');camera=new THREE.PerspectiveCamera(57,innerWidth/innerHeight,.1,90);
  world=buildChurch(scene);churchFog=scene.fog;
  character=createNailong();scene.add(character.root);character.root.position.set(1.35,0,6.8);character.root.rotation.y=-.35;
  const charFill=new THREE.PointLight('#ffe3a0',1.4,5,1.7);charFill.position.set(0,2.6,1.5);character.root.add(charFill);
  modelLight=new THREE.Group();modelLight.add(new THREE.HemisphereLight('#fff3da','#b2a594',1.55));const key=new THREE.DirectionalLight('#fff6e6',3);key.position.set(-3,6,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.normalBias=.012;modelLight.add(key);const rim=new THREE.DirectionalLight('#c4d4e7',.7);rim.position.set(-3,3,-3);modelLight.add(rim);scene.add(modelLight);modelLight.visible=false;
  modelFloor=new THREE.Mesh(new THREE.CylinderGeometry(1.75,1.85,.13,80),new THREE.MeshStandardMaterial({color:'#dfd9cc',roughness:.85}));modelFloor.position.y=-.065;modelFloor.receiveShadow=true;scene.add(modelFloor);modelFloor.visible=false;
  const renderTarget=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});composer=new EffectComposer(renderer,renderTarget);composer.addPass(new RenderPass(scene,camera));bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.25,.65,.95);composer.addPass(bloom);composer.addPass(new OutputPass());resize();
  window.addEventListener('resize',resize);$('startButton').disabled=false;$('loading').hidden=true;updateHUD();$('startButton').onclick=start;
  $('world').addEventListener('webglcontextlost',e=>{e.preventDefault();$('fatal').hidden=false;$('fatalText').textContent='图形连接中断，请重新加载。也可以在设置中选择流畅画质。';});
  if(new URLSearchParams(location.search).has('qa')){
   window.__vesper={get state(){return state;},get mode(){return mode;},player:character.root,character,world,scene,renderer,camera,interact:interactWith,blocked,enterModel,leaveModel,async exportGLB(kind='character'){
    const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
    const exporter=new GLTFExporter();let target,animations=[];
    if(kind==='character'){const fresh=createNailong();target=fresh.root;animations=fresh.animations;}
    else {
     target=new THREE.Scene();target.name='Vesper Sanctuary';
     const architecture=world.world.clone(true);
     const instances=[],unsupported=[];
     architecture.traverse(o=>{if(o.isInstancedMesh)instances.push(o);else if(o.isPoints||o.material?.isShaderMaterial)unsupported.push(o);});
     for(const o of unsupported)o.removeFromParent();
     for(const batch of instances){const parent=batch.parent,matrix=new THREE.Matrix4();for(let i=0;i<batch.count;i++){batch.getMatrixAt(i,matrix);const mesh=new THREE.Mesh(batch.geometry,batch.material);mesh.name='Architectural detail '+i;mesh.applyMatrix4(matrix);parent.add(mesh);}batch.removeFromParent();}
     target.add(architecture);
     for(const child of scene.children){if(child.isLight&&!child.isHemisphereLight){const light=child.clone();if(child.target)light.lookAt(child.target.position);target.add(light);}}
    }
    const buffer=await exporter.parseAsync(target,{binary:true,animations,onlyVisible:true});
    let bin='';for(const b of new Uint8Array(buffer))bin+=String.fromCharCode(b);return btoa(bin);
   }};
  }
  requestAnimationFrame(frame);const query=new URLSearchParams(location.search);if(query.has('model')){enterModel();if(query.has('inspect'))closePanel();if(query.has('walk')){modelWalking=true;$('modelWalk').textContent='暂停行走';}}
 }catch(error){console.error(error);$('loading').hidden=true;$('fatal').hidden=false;$('fatalText').textContent='需要支持 WebGL 2 的浏览器。请启用浏览器硬件加速后重试。'+error.message;}
}
boot();


