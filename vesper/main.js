import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createNailong } from './character.js';
import { buildChurch } from './church.js';
import { createOpening } from './opening.js';
import { createChapterAudio } from './chapter-audio.js';
import { createState, restoreState, act, tickOrgan, tickTape, getTapeTimecode, ARCHIVE_DIALS, PERFORMANCE_DATE, getObjective, getHint, getInventory, getJournal } from './puzzle.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=key=>{try{return localStorage.getItem(key);}catch{return null;}},write=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
const SAVE='vesper-save-v2',POSITION='vesper-position-v2',reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let readyForInput=false;
let state=restoreState(read(SAVE)),mode='intro',previousMode='intro',zone='nave',lastTime=0,elapsed=0,nearest=null,toastTimer,panelKind='',panelToken=0;
let yaw=0,pitch=.05,distance=5.5,dragging=null,walkSpeed=0,quality=read('vesper-quality')||(innerWidth<700?'balanced':'high');
let renderer,scene,camera,world,character,composer,bloom,opening,charFill,churchFog,modelLight,modelFloor;
let introScene,introCharacter,introCamera,introTarget,blendPass,worldPass,introBlend=0,resuming=false;
const introLook=new THREE.Vector3(),introBones=[];
let arrival=0,arrivalCamera=new THREE.Vector3(),arrivalLook=new THREE.Vector3(),modelWalking=false,modelReturnState=null,transitioning=false,focusPaused=false;
let sprint=false,sprintKey=null,lastForward={code:null,time:-1000},touchRun=false,joystickId=null,stalled=0,hintStage='',hintLevel=0,lastAutosave=0,doorClosing=0;
const keys=new Set(),touch=new THREE.Vector2(),cameraTarget=new THREE.Vector3(),lookTarget=new THREE.Vector3();
const audio=window.BoardGameAudio.create({storagePrefix:'vesper'});
const chapterAudio=createChapterAudio(audio);
if(read('vesper-muted')===null)audio.setMuted(false);
function playChapterSound(id,options){if(state.organSilenceRemaining>0)return false;return chapterAudio.play(id,options);}
function unlockAudio(){if(!document.hidden)focusPaused=false;audio.unlock();chapterAudio.unlock();updateSound();}
function updateSound(){$('soundButton').classList.toggle('muted',audio.muted);$('soundButton').ariaLabel=audio.muted?'打开声音':'关闭声音';chapterAudio.sync({hidden:document.hidden,paused:focusPaused||panelKind==='settings'||mode==='model'});}
$('soundButton').onclick=()=>{audio.setMuted(!audio.muted);unlockAudio();};updateSound();
const profile={name:read('boardclub-name')||'旅人',socialId:'vesper-local-traveller',avatar:window.BoardGameUI.getAvatar(),connected:true};
$('playerName').value=profile.name;window.BoardGameUI.mountAvatarPicker($('avatarPicker'),$('playerName'));
const social=window.BoardGameUI.mountInteractions(()=>({code:'vesper-solo',players:[profile],you:profile.socialId,connected:true}),()=>{},{audio,onSoundChange:updateSound});
function updateAvatar(){$('playerAvatar').innerHTML=window.BoardGameUI.avatar(profile,true,'vesper-avatar',true);social.sync();}
window.addEventListener('board-avatar-change',({detail})=>{profile.avatar=window.AvatarData.normalize(detail.avatar);updateAvatar();});updateAvatar();
function toast(text){if(!text)return;clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function save(){write(SAVE,JSON.stringify(state));if(character&&mode==='playing')write(POSITION,JSON.stringify({zone,position:character.root.position.toArray(),yaw}));}
function updateHUD(){
 $('objectiveText').textContent=getObjective(state);
 const icons={programme:'▤',b17Ticket:'17',b18Ticket:'18',tape:'▣',brassKey:'⚿'};
 $('inventory').innerHTML=getInventory(state).map(item=>'<button title="'+esc(item.name)+'" aria-label="'+esc(item.name)+'" data-item="'+item.id+'">'+icons[item.id]+'</button>').join('');
 $('inventory').querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{const item=getInventory(state).find(i=>i.id===b.dataset.item);if(['programme','b17Ticket','b18Ticket'].includes(item.id))dispatch(item.id);else openPanel(item.name,'<p>'+esc(item.description)+'</p>','object');});
 world?.applyChapter(state);$('startLabel').textContent=read('vesper-started-v2')==='1'?'继续':'醒来';
}
function clearControls(){keys.clear();touch.set(0,0);dragging=null;sprint=false;sprintKey=null;touchRun=false;lastForward={code:null,time:-1000};joystickId=null;$('joystickKnob').style.transform='';$('touchRun').classList.remove('active');}
function stopPanelActivity(){if(panelKind==='organ'&&state.organPlaying){state=act(state,'organStop').state;}if(panelKind==='archive'&&state.archiveInserted)state=act(state,'ticketEject').state;}
function openPanel(title,html,kind='object'){
 if(panelKind!==kind)stopPanelActivity();panelToken++;clearControls();panelKind=kind;
 $('panelTitle').textContent=title;$('panelBody').innerHTML=html;$('panelEyebrow').textContent=kind==='settings'?'VESPER · PAUSE':'I. THE SILENT SANCTUARY';
 if(!$('panel').open)$('panel').showModal();updateSound();
}
function closePanel(){stopPanelActivity();panelToken++;panelKind='';$('panel').close();clearControls();save();updateHUD();updateSound();if(mode==='playing')$('world').focus({preventScroll:true});}
$('panelClose').onclick=closePanel;$('panel').addEventListener('cancel',e=>{e.preventDefault();closePanel();});
$('panel').addEventListener('click',e=>{if(e.target===$('panel')){const r=$('panel').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();}});
function showJournal(){const entries=getJournal(state);openPanel('随手记下',entries.length?entries.map(e=>'<h3>'+esc(e.title)+'</h3><p>'+esc(e.text)+'</p><hr>').join(''):'<p>纸上还没有字。</p>','journal');}
$('journalButton').onclick=showJournal;
function settings(){
 openPanel('片刻停留','<p>WASD / 方向键行走。双击 W 或 ↑ 并按住快走，松开即止。<br>拖动环顾，滚轮调节远近。E 互动，J 手记。<br>手机：摇杆行走，按住「快走」加速。</p><label class="settings-row">画面质量<select id="qualitySelect"><option value="high">精致</option><option value="balanced">流畅</option><option value="low">低功耗</option></select></label><label class="settings-row">音量 <span id="volumeText">'+Math.round(audio.volume*100)+'%</span></label><input id="volumeControl" type="range" min="0" max="100" value="'+Math.round(audio.volume*100)+'" aria-label="音效音量"><div class="actions"><button class="action" id="resumeButton">继续</button><button class="action quiet" id="inspectModel">角色预览</button><button class="action quiet" id="resetButton">重新开始</button></div>','settings');
 $('qualitySelect').value=quality;$('qualitySelect').onchange=e=>{quality=e.target.value;write('vesper-quality',quality);resize();};
 $('volumeControl').oninput=e=>{audio.setVolume(Number(e.target.value)/100);$('volumeText').textContent=e.target.value+'%';updateSound();};
 $('resumeButton').onclick=closePanel;$('inspectModel').onclick=()=>{closePanel();enterModel();};
 $('resetButton').onclick=()=>{openPanel('重新开始','<p>这会清除第一章的探索进度。</p><div class="actions"><button class="action" id="confirmReset">重新开始</button><button class="action quiet" id="cancelReset">保留进度</button></div>','settings');$('cancelReset').onclick=settings;$('confirmReset').onclick=reset;};
}
$('settingsButton').onclick=settings;
const button=(id,label,disabled=false)=>'<button class="action" id="'+id+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
function bind(id,fn){$(id)?.addEventListener('click',fn);}
function programmeHTML(reveal=state.patternRevealed){return '<div class="paper"><h3>PROGRAMME</h3><p class="programme-composer">LUDOVICO EINAUDI</p><p>[Track]<br>[Track]<br>Experience<br>[Track]<br>[Track]</p><p class="programme-date">'+esc(PERFORMANCE_DATE)+'</p><div class="trace '+(reveal?'':'dim')+'">'+['○','△','','◇'].map((x,i)=>'<span aria-label="第'+(i+1)+'格'+(!x?'空白':'')+'">'+(reveal?x:'·')+'</span>').join('')+'</div></div>';}
function renderResult(r){
 if(r.kind==='end'){finishChapter();return;}
 if(r.kind==='notice'&&!r.text){if($('panel').open)closePanel();return;}
 if(r.kind==='curtain'){
  const stage=state.curtainOpened?'secured':state.curtainRaised?'raised':state.curtainReleased?'released':'latched';
  openPanel('垂下的绳索','<div class="curtain-diagram '+stage+'"><i class="cord"></i><i class="cord long"></i></div><p>'+esc(r.text)+'</p><div class="actions">'+button('releaseCord','拉短绳',state.curtainReleased)+button('pullCord','拉长绳',state.curtainOpened)+(state.curtainRaised?button('secureCord','将绳环套在挂钩上',state.curtainOpened):'')+'</div>','curtain');
  bind('releaseCord',()=>dispatch('curtainRelease'));bind('pullCord',()=>dispatch('curtainPull'));bind('secureCord',()=>dispatch('curtainSecure'));return;
 }
 if(['programme','pattern'].includes(r.kind)){openPanel(r.kind==='pattern'?'玻璃下的纸':'节目单',programmeHTML()+'<p>'+esc(r.text)+'</p>','programme');return;}
 if(['ticket','ticketBack'].includes(r.kind)){
  const is17=r.ticket==='B17'||r.title==='B17',back=r.kind==='ticketBack';
  const printed=back?(r.printedDate||'— · — · —'):(is17?'B17':'B18');
  openPanel(is17?'B17':'B18','<div class="ticket '+(is17?'worn':'')+'"><span>'+esc(printed)+'</span><span class="holes">'+(!back&&(is17||state.b18Altered)?'◦ ◦ ◦':'')+'</span></div><p>'+esc(r.text)+'</p>'+(!is17?'<div class="actions">'+button('flipTicket',back?'翻回正面':'翻到背面')+'</div>':''),'ticket');
  bind('flipTicket',()=>dispatch(back?'b18Ticket':'flipB18'));return;
 }
 if(r.kind==='organ'){
  openPanel('四个位置','<div id="beats" class="beats">'+[1,2,3,4].map(n=>'<div class="beat" data-beat="'+(n-1)+'">'+n+'</div>').join('')+'</div><p class="beat-status" id="beatStatus">72 BPM</p><div class="symbol-keys">'+['○','△','◇'].map((s,i)=>'<button data-symbol="'+s+'" aria-label="弹奏'+s+'">'+s+'</button>').join('')+'</div><div class="actions">'+button('startOrgan',state.organPlaying?'重新开始':'开始')+button('stopOrgan','停下')+'</div>','organ');
  $('panelBody').querySelectorAll('[data-symbol]').forEach(b=>b.onclick=()=>dispatch('organInput',{symbol:b.dataset.symbol},false));bind('startOrgan',()=>dispatch('organStart',{},false));bind('stopOrgan',()=>dispatch('organStop',{},false));updateLivePanels();return;
 }
 if(r.kind==='archive'||r.kind==='drawer'){
  const projection=state.archiveLampOn&&(state.archiveInserted==='B17'||(state.archiveInserted==='B18'&&state.b18Altered));
  openPanel('票据机','<p class="machine-label">SEAT RECORD / OPTICAL REGISTER</p><div class="projection '+(state.archiveLampOn?'lit':'')+'">'+(projection?'○ × ↓':'')+'</div><p>'+esc(state.archiveInserted||'—')+'</p><div class="dials">'+state.archiveDials.map((v,i)=>'<button data-dial="'+i+'" aria-label="第'+(i+1)+'个转盘，当前'+ARCHIVE_DIALS[i][v]+'">'+ARCHIVE_DIALS[i][v]+'</button>').join('')+'</div><div class="actions">'+button('lampButton',state.archiveLampOn?'关灯':'开灯')+(state.b17TicketCollected?button('insert17','放入 B17'):button('collect17','拿起 B17'))+(state.b18TicketCollected?button('insert18','放入 B18'):button('collect18','拿起 B18'))+button('ejectTicket','退出票据',!state.archiveInserted)+button('punchButton','PUNCH',state.archiveInserted!=='B18'||state.b18Altered)+button('checkArchive','拉开抽屉',state.archiveDrawerSolved)+'</div>'+(state.archiveDrawerSolved?'<hr><p>19:31<br>一把很窄的黄铜钥匙。</p><div class="actions">'+button('ledgerButton','翻阅维护表')+'</div>':''),'archive');
  for(const [id,action,payload]of [['lampButton','archiveLamp'],['insert17','ticketInsert',{ticket:'B17'}],['insert18','ticketInsert',{ticket:'B18'}],['ejectTicket','ticketEject'],['punchButton','punchB18'],['checkArchive','archiveCheck'],['ledgerButton','seatLedger']])bind(id,()=>dispatch(action,payload));
  for(const [id,a]of [['collect17','b17Ticket'],['collect18','b18Ticket']])bind(id,()=>{dispatch(a,{},false);renderResult({kind:'archive'});});
  $('panelBody').querySelectorAll('[data-dial]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.dial);dispatch('archiveTurn',{index:i,value:(state.archiveDials[i]+1)%3});});return;
 }
 if(r.kind==='ledger'){openPanel('SEATING / STORAGE RECORD','<table class="ledger"><tbody>'+Array.from({length:30},(_,i)=>'<tr><td>B'+String(i+1).padStart(2,'0')+'</td><td>'+({2:'MOVED',8:'STORAGE',20:'REPLACED'}[i]||'')+'</td></tr>').join('')+'</tbody></table>','ledger');return;}
 if(r.kind==='tape'){
  openPanel('19:31','<div class="cassette" id="cassette"><div class="reels"><i class="reel"></i><i class="reel"></i></div><div class="timecode" id="timecode">'+getTapeTimecode(state)+'</div></div>'+(state.tapeInserted?'':'<div class="actions">'+button('insertTape','放入磁带')+'</div>')+'<div class="tape-transport">'+button('playTape','PLAY',!state.tapeInserted)+button('stopTape','STOP',!state.tapeInserted)+button('rewindTape','REWIND',!state.tapeInserted)+button('ejectTape','EJECT',!state.tapeInserted)+'</div><p id="tapeHint">'+(state.tapeEarlyStops>=3&&!state.tapeCompleted?'卷盘还没停。':'')+'</p>','tape');
  for(const [id,a]of [['insertTape','tapeInsert'],['playTape','tapePlay'],['stopTape','tapeStop'],['rewindTape','tapeRewind'],['ejectTape','tapeEject']])bind(id,()=>dispatch(a));updateLivePanels();return;
 }
 openPanel(r.title||'观察','<p>'+esc(r.text)+'</p>'+(r.marking?'<p class="machine-label">'+esc(r.marking)+'</p>':''),'object');
}
function updateLivePanels(){
 if(panelKind==='organ'){
  $('beats')?.querySelectorAll('.beat').forEach((b,i)=>{b.classList.toggle('current',state.organPlaying&&state.organBeat===i);b.classList.toggle('filled',!!state.organInputs[i]);b.dataset.symbol=state.organInputs[i]||'';b.classList.toggle('hint',i===2&&state.organFailures>=2);});
  if($('beatStatus'))$('beatStatus').textContent=state.organSolved?'':state.organPlaying?(state.organBeat<0?'·':'72 BPM · '+(state.organBeat+1)):'72 BPM';
 }
 if(panelKind==='tape'){$('timecode').textContent=getTapeTimecode(state);$('cassette').classList.toggle('playing',state.tapePlaying&&!focusPaused&&!document.hidden);}
}
function effects(list){
 const sounds={curtainRelease:'latch',curtainRaise:'curtain',curtainOpen:'curtain',paper:'paper',organFail:'organFail',sideRoomUnlock:'latch',b18Cloth:'cloth',ticketInsert:'paper',archiveLamp:'latch',archiveTurn:'latch',punch:'latch',archiveClick:'latch',archiveSolved:'latch',upperDoorUnlock:'latch',tapeInsert:'tapeStart',tapePlay:'tapeStart',tapeStop:'tapeStop',tapeRewind:'tapeStart',tapeEject:'tapeStop',room:'paper',cloth:'cloth',cup:'cup',breath:'breath',silence:'pianoLast',terminalChime:'terminalChime',realityChair:'realityChair',tapeComplete:'tapeStop',exitUnlock:'latch',floorStoneKnock:'stone',exitRattle:'door',exitOpen:'door'};
 for(const e of list||[]){
  if(sounds[e.type])playChapterSound(sounds[e.type],{volume:e.distant?.18:1});
  if(e.type==='organSolved')chapterAudio.stopAll();
  if(e.type==='exitOpen')exitGlance=2;
  if(e.type==='organNote')playChapterSound('organ'+e.symbol);
  if(e.type==='colourLeak')world.flashColor(e.where==='window'?'window':'slit');
  if(e.type==='exitRattle')world.setDoorAttempt();
  if(e.type==='curtainOpen'||e.type==='sideRoomUnlock'){if($('panel').open)closePanel();}
  if(e.type==='corridorEnter')doorClosing=3.8;
  if(e.type==='chapterEnd')finishChapter();
 }
}
function applyResult(result,show=false){state=result.state;if(result.changed){save();updateHUD();stalled=0;}effects(result.effects);if(show)renderResult(result);return result;}
function dispatch(id,payload={},show=true){unlockAudio();const r=applyResult(act(state,id,payload),false);if(show)renderResult(r);return r;}
function pointEnabled(p){if(p.id==='stone')return state.tapeCompleted;if(p.id==='seatLedger')return state.archiveDrawerSolved;return true;}
function interactWith(id){
 if(mode!=='playing'||$('panel').open||transitioning)return false;
 const point=world.points.find(p=>p.id===id&&p.zone===zone);if(!point||point.zone!==zone||!pointEnabled(point)||Math.hypot(point.x-character.root.position.x,point.z-character.root.position.z)>(point.radius||2))return false;
 if(['lowerDoor','downstairs','lowerEntry'].includes(id)){transitionZone('nave',world.transitions.lowerEntry);return true;}
 const r=dispatch(id,{},false);
 if(id==='upperDoor'&&state.upperDoorUnlocked){transitionZone('upper',world.transitions.upperEntry);return true;}
 renderResult(r);return true;
}
function doInteract(){if(nearest)interactWith(nearest.id);}
$('interactButton').onclick=doInteract;$('touchInteract').onclick=doInteract;
async function transitionZone(next,position){if(transitioning)return;transitioning=true;clearControls();$('sceneFade').classList.add('cover');await new Promise(r=>setTimeout(r,650));zone=next;character.root.position.set(position.x,position.y,position.z);yaw=next==='upper'?Math.PI/2:0;distance=next==='upper'?3.8:5.7;lookTarget.copy(character.root.position).add(new THREE.Vector3(0,1.4,0));camera.position.copy(lookTarget).add(new THREE.Vector3(0,1,4));save();$('sceneFade').classList.remove('cover');await new Promise(r=>setTimeout(r,650));transitioning=false;}
function finishChapter(){if(mode==='won')return;closePanel();mode='won';clearControls();chapterAudio.stopAll();$('sceneFade').classList.add('cover');setTimeout(()=>{$('chapterEnd').hidden=false;$('hud').hidden=true;},800);save();}
$('returnSanctuary').onclick=()=>{state={...state,escaped:false,chapterComplete:false,corridorEntered:false,exitOpened:false};mode='playing';zone='nave';character.root.position.set(0,0,13.8);yaw=Math.PI;doorClosing=0;world.setExitOpen(false);$('chapterEnd').hidden=true;$('sceneFade').classList.remove('cover');$('hud').hidden=false;save();updateHUD();};
function reset(){if(mode==='model')leaveModel();closePanel();state=createState();write('vesper-started-v2','0');write(POSITION,'');zone='nave';doorClosing=0;arrival=0;introBlend=0;resuming=false;character.root.position.set(world.spawn.standing.x,0,world.spawn.standing.z);character.root.rotation.set(0,Math.PI,0);character.root.scale.setScalar(1);save();mode='intro';document.body.classList.add('opening-mode');document.body.classList.remove('model-mode');$('chapterEnd').hidden=true;$('sceneFade').classList.remove('cover');$('intro').hidden=false;$('introFooter').hidden=false;$('hud').hidden=true;opening.group.visible=true;world.setIntroFade(1);updateHUD();}
function start(){
 if(!readyForInput||mode!=='intro')return;closePanel();unlockAudio();arrivalCues=0;resuming=false;
 $('intro').hidden=true;$('introFooter').hidden=true;document.body.classList.remove('opening-mode');
 if(read('vesper-started-v2')==='1'){
  mode='playing';zone='nave';character.root.position.set(world.spawn.standing.x,0,world.spawn.standing.z);character.root.rotation.set(0,Math.PI,0);character.root.scale.setScalar(1);
  try{const p=JSON.parse(read(POSITION));if(p&&world.zones[p.zone]&&Array.isArray(p.position)&&p.position.length===3&&p.position.every(Number.isFinite)){zone=p.zone;character.root.position.fromArray(p.position);if(blocked(character.root.position.x,character.root.position.z)){zone='nave';character.root.position.set(world.spawn.standing.x,0,world.spawn.standing.z);}yaw=Number.isFinite(p.yaw)?p.yaw:0;}}catch{}
  if(state.chapterComplete){state={...state,escaped:false,chapterComplete:false,corridorEntered:false,exitOpened:false};zone='nave';character.root.position.set(0,0,13.8);}
  world.setIntroFade(1);charFill.intensity=.6;scene.background.set('#17141d');scene.fog=churchFog;distance=zone==='upper'?3.8:5.7;lookTarget.copy(character.root.position).add(new THREE.Vector3(0,1.5,0));camera.position.copy(lookTarget).add(new THREE.Vector3(Math.sin(yaw)*3,1.7,Math.cos(yaw)*3));const bounds=boundsOf(zone),floor=world.zones[zone].floorY||0;camera.position.x=THREE.MathUtils.clamp(camera.position.x,bounds.minX+.2,bounds.maxX-.2);camera.position.z=THREE.MathUtils.clamp(camera.position.z,bounds.minZ+.2,bounds.maxZ-.2);camera.position.y=THREE.MathUtils.clamp(camera.position.y,floor+1.65,floor+4.8);camera.lookAt(lookTarget);mode='arrival';resuming=true;arrival=0;clearControls();updateHUD();return;
 }
 mode='arrival';arrival=0;arrivalCamera.copy(introCamera.position);arrivalLook.copy(introLook);zone='nave';const o=world.spawn.standing;character.root.position.set(o.x,0,o.z);character.root.rotation.set(0,Math.PI,0);character.root.scale.setScalar(1);lookTarget.set(o.x,1.5,o.z);camera.position.set(o.x,3.8,o.z+3);camera.lookAt(lookTarget);clearControls();
}function worldGroupVisible(visible){for(const child of scene.children){if(child!==character.root&&child!==modelLight&&child!==modelFloor&&child!==opening.group)child.visible=visible;}modelLight.visible=!visible;modelFloor.visible=!visible;opening.group.visible=visible&&mode==='intro';}
function enterModel(){
 if(!readyForInput||mode==='model'||mode==='arrival')return;closePanel();modelWalking=false;$('modelWalk').textContent='播放行走';
 modelReturnState={position:character.root.position.clone(),rotation:character.root.rotation.clone(),yaw,pitch,distance,fov:camera.fov,lights:[],surfaces:[]};
 character.root.traverse(o=>{if(o.isLight){modelReturnState.lights.push([o,o.visible]);o.visible=false;}});
 const seen=new Set();character.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.envMap&&!seen.has(m)){seen.add(m);modelReturnState.surfaces.push([m,m.envMap,m.envMapIntensity]);m.envMap=null;m.needsUpdate=true;}});
 previousMode=mode;mode='model';renderer.toneMappingExposure=1.04;bloom.enabled=false;document.body.classList.remove('opening-mode');document.body.classList.add('model-mode');scene.fog=null;worldGroupVisible(false);scene.background=new THREE.Color('#efefec');
 character.root.position.set(0,0,0);character.root.rotation.set(0,0,0);character.root.scale.setScalar(1);distance=5.02;yaw=.90;pitch=.006;camera.fov=30;camera.updateProjectionMatrix();
 openPanel('奶龙','<p>拖动旋转视角，滚轮缩放。</p><div class="actions">'+button('walkPreview','播放走路动作')+button('modelReturn','返回教堂')+'</div>','model');
 bind('walkPreview',()=>{modelWalking=!modelWalking;$('walkPreview').textContent=modelWalking?'暂停走路动作':'播放走路动作';$('modelWalk').textContent=modelWalking?'暂停行走':'播放行走';});bind('modelReturn',leaveModel);updateSound();
}
function leaveModel(){
 closePanel();renderer.toneMappingExposure=1.15;bloom.enabled=quality==='high';document.body.classList.remove('model-mode');scene.background=new THREE.Color('#17141d');scene.fog=churchFog;mode=previousMode;worldGroupVisible(true);
 if(modelReturnState){camera.fov=modelReturnState.fov;camera.updateProjectionMatrix();for(const [light,v]of modelReturnState.lights)light.visible=v;for(const [m,map,intensity]of modelReturnState.surfaces){m.envMap=map;m.envMapIntensity=intensity;m.needsUpdate=true;}character.root.position.copy(modelReturnState.position);character.root.rotation.copy(modelReturnState.rotation);yaw=modelReturnState.yaw;pitch=modelReturnState.pitch;distance=modelReturnState.distance;}
 document.body.classList.toggle('opening-mode',mode==='intro');$('intro').hidden=mode!=='intro';$('introFooter').hidden=mode!=='intro';$('hud').hidden=mode!=='playing';updateHUD();updateSound();
}
$('modelButton').onclick=enterModel;$('modelBack').onclick=leaveModel;$('modelWalk').onclick=()=>{modelWalking=!modelWalking;$('modelWalk').textContent=modelWalking?'暂停行走':'播放行走';};
function resize(){if(!renderer)return;renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?1.6:quality==='balanced'?1.1:.8));renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);if(introTarget){introTarget.setSize(Math.round(innerWidth*renderer.getPixelRatio()),Math.round(innerHeight*renderer.getPixelRatio()));introCamera.aspect=camera.aspect;introCamera.updateProjectionMatrix();}bloom.enabled=quality==='high'&&mode!=='model';renderer.shadowMap.enabled=quality!=='low';}
function boundsOf(z){return world.zones?.[z]?.bounds||{minX:-8.15,maxX:8.15,minZ:-14.65,maxZ:15.25};}
function blocked(x,z){const target=world.getZoneAt?.(x,z,zone)||zone,b=boundsOf(target),r=.32;if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)return true;return (world.zones?.[target]?.colliders||world.colliders).some(c=>x>c.minX-r&&x<c.maxX+r&&z>c.minZ-r&&z<c.maxZ+r);}
function move(dx,dz){const p=character.root.position,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.13));for(let i=0;i<steps;i++){if(!blocked(p.x+dx/steps,p.z))p.x+=dx/steps;if(!blocked(p.x,p.z+dz/steps))p.z+=dz/steps;zone=world.getZoneAt?.(p.x,p.z,zone)||zone;}p.y=world.zones?.[zone]?.floorY||0;}
const movementCodes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
window.addEventListener('keydown',e=>{
 if(!readyForInput)return;
 if(e.target.matches('input,select,textarea'))return;
 if(movementCodes.includes(e.code))e.preventDefault();
 if(e.code==='Escape'){if(mode==='model'){e.preventDefault();leaveModel();}else if(!$('panel').open&&mode!=='arrival')settings();return;}
 if($('panel').open||document.querySelector('#avatarDialog[open]'))return;
 if(mode==='intro'&&movementCodes.includes(e.code)){start();return;}
 if(mode!=='playing'&&mode!=='model')return;
 if(e.code==='KeyE'&&!e.repeat)doInteract();if(e.code==='KeyJ'&&!e.repeat)showJournal();
 if(['KeyW','ArrowUp'].includes(e.code)&&!e.repeat){const now=performance.now();if(lastForward.code===e.code&&now-lastForward.time<=280){sprint=true;sprintKey=e.code;}lastForward={code:e.code,time:now};}
 keys.add(e.code);
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code===sprintKey){sprint=false;sprintKey=null;}});
window.addEventListener('blur',()=>{clearControls();focusPaused=true;updateSound();});window.addEventListener('focus',()=>{focusPaused=false;updateSound();});
document.addEventListener('visibilitychange',()=>{clearControls();updateSound();if(document.hidden)audio.stop();});
$('world').addEventListener('pointerdown',e=>{if(!['playing','model'].includes(mode))return;unlockAudio();dragging={id:e.pointerId,x:e.clientX,y:e.clientY};$('world').setPointerCapture(e.pointerId);});
$('world').addEventListener('pointermove',e=>{if(!dragging||dragging.id!==e.pointerId)return;yaw-=(e.clientX-dragging.x)*.006;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-dragging.y)*.004,-.12,.86);dragging.x=e.clientX;dragging.y=e.clientY;});
for(const event of ['pointerup','pointercancel'])$('world').addEventListener(event,()=>{dragging=null;});
$('world').addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.005,mode==='model'?2.6:2.5,mode==='model'?7:8);},{passive:false});
$('joystick').onpointerdown=e=>{if(mode==='intro'){start();return;}joystickId=e.pointerId;$('joystick').setPointerCapture(e.pointerId);updateStick(e);};
function updateStick(e){if(e.pointerId!==joystickId)return;const r=$('joystick').getBoundingClientRect();touch.set((e.clientX-r.left-r.width/2)/34,(e.clientY-r.top-r.height/2)/34);if(touch.length()>1)touch.normalize();$('joystickKnob').style.transform='translate('+touch.x*28+'px,'+touch.y*28+'px)';}
$('joystick').onpointermove=updateStick;for(const event of ['pointerup','pointercancel'])$('joystick').addEventListener(event,()=>{joystickId=null;touch.set(0,0);$('joystickKnob').style.transform='';});
$('touchRun').onpointerdown=e=>{touchRun=true;$('touchRun').classList.add('active');$('touchRun').setPointerCapture(e.pointerId);};for(const e of ['pointerup','pointercancel'])$('touchRun').addEventListener(e,()=>{touchRun=false;$('touchRun').classList.remove('active');});
function updateHint(dt){
 const stage=!state.curtainOpened?'curtain':!state.programmeCollected?'programme':!state.patternRevealed?'window':!state.organSolved?'organ':!state.archiveDrawerSolved?'archive':!state.upperDoorUnlocked?'upperDoor':!state.tapeCompleted?'tapePlayer':'exit';
 if(stage!==hintStage){hintStage=stage;stalled=0;hintLevel=0;}stalled+=dt;
 if(stalled>60&&hintLevel<1){hintLevel=1;hintBeacon.position.set(0,-30,0);const p=world.points.find(p=>p.id===stage);if(p){hintBeacon.position.set(p.x,(p.y||0)+.8,p.z);hintBeacon.userData.until=elapsed+3;}}
 if(stalled>120&&hintLevel<2){hintLevel=2;toast(getHint(state));}
}
let hintBeacon;let arrivalCues=0,exitGlance=0;
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min((now-lastTime)/1000||.016,.08);lastTime=now;if(document.hidden||focusPaused)return;elapsed+=dt;
 const paused=panelKind==='settings'||mode==='model'||transitioning;
 if(mode==='playing'&&!paused){
  if((state.organPlaying&&panelKind==='organ')||state.organSilenceRemaining>0){const r=tickOrgan(state,dt);state=r.state;if(r.effects.length){effects(r.effects);save();updateHUD();}}
  if(state.tapePlaying){const r=tickTape(state,dt);state=r.state;if(r.effects.length){effects(r.effects);save();updateHUD();}}
  chapterAudio.tickTape(state.tapePosition,state.tapePlaying);updateLivePanels();updateHint(dt);
 }
 let moving=false;const active=mode==='playing'&&!$('panel').open&&!transitioning&&exitGlance<=0&&!document.querySelector('#avatarDialog[open]');
 if(active){
  let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touch.x;
  let z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+touch.y;const len=Math.hypot(x,z);
  if(len>.1){x/=Math.max(1,len);z/=Math.max(1,len);const dx=x*Math.cos(yaw)+z*Math.sin(yaw),dz=-x*Math.sin(yaw)+z*Math.cos(yaw),speed=character.gait.referenceSpeed*((sprint||touchRun||keys.has('ShiftLeft')||keys.has('ShiftRight'))?1.7:1);
   const before=character.root.position.clone();move(dx*speed*dt,dz*speed*dt);moving=before.distanceToSquared(character.root.position)>.000001;walkSpeed=before.distanceTo(character.root.position)/Math.max(dt,.0001);const target=Math.atan2(dx,dz);character.root.rotation.y+=Math.atan2(Math.sin(target-character.root.rotation.y),Math.cos(target-character.root.rotation.y))*Math.min(1,dt*12);
  }
 }
 character.update(dt,{moving:mode==='model'?modelWalking:moving,speed:mode==='model'?character.gait.referenceSpeed:walkSpeed,time:elapsed});
 if(mode==='playing'&&moving)for(const foot of character.gait.stepEvents)playChapterSound('footstep',{volume:.25});
 world.setTape(state.tapePosition,state.tapePlaying&&!paused);if(!paused)world.update(dt,reduced?0:elapsed);hintBeacon.intensity=elapsed<(hintBeacon.userData.until||0)?Math.sin((hintBeacon.userData.until-elapsed)*Math.PI/3)*.8:0;
 if(mode==='intro'||mode==='arrival'){
  if(mode==='arrival'&&!paused)arrival+=dt;
  const p=mode==='intro'?0:Math.min(1,arrival/(reduced?.8:3.8));
  const movingPhase=resuming?0:Math.min(1,p/.70),smooth=movingPhase*movingPhase*(3-2*movingPhase),o=world.spawn.standing;
  const dissolve=resuming?p:THREE.MathUtils.clamp((p-.70)/.30,0,1);introBlend=dissolve*dissolve*(3-2*dissolve);
  if(mode==='arrival'&&!paused){if(arrival>.35&&arrivalCues<1){arrivalCues=1;playChapterSound('paper');}if(arrival>.9&&arrivalCues<2){arrivalCues=2;playChapterSound('cloth',{volume:.45});}if(arrival>1.4&&arrivalCues<3){arrivalCues=3;playChapterSound('realityChair',{volume:.12});}}
  opening.update(elapsed,1);world.setIntroFade(1);
  introCharacter.update(0,{time:elapsed});
  introCharacter.joints.rig.position.copy(character.joints.rig.position);introCharacter.joints.rig.quaternion.copy(character.joints.rig.quaternion);introCharacter.joints.rig.scale.copy(character.joints.rig.scale);
  for(const [source,target]of introBones){target.position.copy(source.position);target.quaternion.copy(source.quaternion);target.scale.copy(source.scale);}
  introCharacter.root.position.set(o.x,THREE.MathUtils.lerp(1.9+(reduced?0:Math.sin(elapsed*.8)*.06),0,smooth),o.z);
  introCharacter.root.rotation.set(-.38*(1-smooth),.2*(1-smooth)+Math.PI*smooth,-.12*(1-smooth));introCharacter.root.scale.setScalar(1+.45*(1-smooth));
  introCharacter.joints.leftArm.rotation.x+=.18*(1-smooth);introCharacter.joints.rightArm.rotation.x+=.18*(1-smooth);
  introCharacter.root.getObjectByName('ElbowL').rotation.set(.72*(1-smooth),-.38*(1-smooth),0);introCharacter.root.getObjectByName('ElbowR').rotation.set(.72*(1-smooth),.38*(1-smooth),0);
  introCharacter.joints.leftLeg.rotation.x-=.18*(1-smooth);introCharacter.joints.rightLeg.rotation.x-=.08*(1-smooth);introCharacter.joints.leftKnee.rotation.x+=.20*(1-smooth);
  if(smooth===1){introCharacter.root.position.copy(character.root.position);introCharacter.root.quaternion.copy(character.root.quaternion);introCharacter.root.scale.copy(character.root.scale);for(const [source,target]of introBones){target.position.copy(source.position);target.quaternion.copy(source.quaternion);target.scale.copy(source.scale);}}
  if(mode==='intro'||resuming)opening.camera(introCamera,introLook,introCamera.aspect);
  else{introCamera.position.copy(arrivalCamera).lerp(camera.position,smooth);introLook.copy(arrivalLook).lerp(lookTarget,smooth);introCamera.lookAt(introLook);}
  if(p>=1&&!paused){mode='playing';introBlend=1;if(!resuming){yaw=0;distance=5.7;}clearControls();$('hud').hidden=false;write('vesper-started-v2','1');save();setTimeout(()=>$('hud').querySelector('.controls-strip').classList.add('faded'),9000);}
 }else if(mode!=='won'){
  if(mode==='model')opening.group.visible=false;else opening.update(elapsed,0);
  cameraTarget.copy(character.root.position).add(new THREE.Vector3(0,mode==='model'?1:1.5,0));
  const amongPews=mode==='playing'&&zone==='nave'&&Math.abs(character.root.position.x)>1.5&&Math.abs(character.root.position.x)<6.6&&character.root.position.z>-8.5&&character.root.position.z<12;
  const cameraDistance=amongPews?Math.min(distance,3):distance;
  const offset=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*cameraDistance,Math.sin(pitch)*cameraDistance+(mode==='model'?.12:amongPews?2.15:1),Math.cos(yaw)*Math.cos(pitch)*cameraDistance),desired=cameraTarget.clone().add(offset);
  if(mode!=='model'){const b=boundsOf(zone),floor=world.zones?.[zone]?.floorY||0;desired.x=THREE.MathUtils.clamp(desired.x,b.minX-.15,b.maxX+.15);desired.z=THREE.MathUtils.clamp(desired.z,b.minZ-.15,b.maxZ+.15);desired.y=THREE.MathUtils.clamp(desired.y,floor+1.65,floor+(zone==='upper'?3:4.8));}
  if(exitGlance>0&&zone==='nave'){exitGlance-=dt;desired.set(0,3,10.7);cameraTarget.set(0,7.23,15.6);}
  camera.position.lerp(desired,1-Math.exp(-dt*8));lookTarget.lerp(cameraTarget,1-Math.exp(-dt*10));camera.lookAt(lookTarget);
 }
 if(mode==='playing'){
  nearest=world.points.filter(p=>p.zone===zone&&pointEnabled(p)).map(p=>({...p,d:Math.hypot(character.root.position.x-p.x,character.root.position.z-p.z)})).filter(p=>p.d<=(p.radius||2)).sort((a,b)=>a.d-b.d)[0]||null;
  $('interactButton').hidden=!nearest||$('panel').open||transitioning;if(nearest)$('interactLabel').textContent=nearest.name||'查看';$('compassNeedle').style.transform='rotate('+(-yaw)+'rad)';
  const seat=world.points.find(p=>p.id==='seatB18');world.setB18Observed(!!seat&&zone==='nave'&&Math.hypot(character.root.position.x-seat.x,character.root.position.z-seat.z)<3&&Math.cos(yaw)*((seat.z-character.root.position.z))<0);
  if(state.tapeCompleted&&!state.floorStoneHeard&&zone==='nave'){const stone=world.points.find(p=>p.id==='stone');if(stone&&Math.hypot(character.root.position.x-stone.x,character.root.position.z-stone.z)<3)applyResult(act(state,'stoneNear'));}
  if(zone==='corridor'&&character.root.position.z>19&&!state.corridorEntered)applyResult(act(state,'corridorEnter'));
  if(doorClosing>0){doorClosing-=dt;if(doorClosing<=0)world.setExitOpen(false);}
  if(zone==='corridor'&&character.root.position.z>37&&state.corridorEntered)applyResult(act(state,'corridorEnd'));
  if(elapsed-lastAutosave>3){lastAutosave=elapsed;save();}
 }
 const showIntro=mode==='intro'||mode==='arrival';
 blendPass.enabled=showIntro;worldPass.enabled=!showIntro||introBlend>0;
 if(showIntro){const previous=renderer.getRenderTarget();renderer.setRenderTarget(introTarget);renderer.clear();renderer.render(introScene,introCamera);renderer.setRenderTarget(previous);blendPass.uniforms.blend.value=introBlend;}
 composer.render();
}

async function boot(){
 try{
  $('world').style.visibility='hidden';
  renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();scene.background=new THREE.Color('#17121e');camera=new THREE.PerspectiveCamera(57,innerWidth/innerHeight,.1,90);
  world=buildChurch(scene);churchFog=scene.fog;introScene=new THREE.Scene();introScene.background=new THREE.Color('#020305');introScene.fog=new THREE.FogExp2('#020305',.006);introCamera=camera.clone();opening=createOpening(introScene,world.spawn.standing);opening.group.visible=false;hintBeacon=new THREE.PointLight('#aaa0bb',0,2,2);scene.add(hintBeacon);
  character=createNailong();scene.add(character.root);character.root.position.set(world.spawn.standing.x,0,world.spawn.standing.z);character.root.rotation.y=Math.PI;introCharacter=createNailong();introScene.add(introCharacter.root);character.root.traverse(source=>{if(source.isBone){const target=introCharacter.root.getObjectByName(source.name);if(target)introBones.push([source,target]);}});
  charFill=new THREE.PointLight('#beb4cd',.6,5,1.7);charFill.position.set(0,2.6,1.5);character.root.add(charFill);
  modelLight=new THREE.Group();modelLight.add(new THREE.HemisphereLight('#ffffff','#c5c5c1',1.9));const key=new THREE.DirectionalLight('#ffffff',2.6);key.position.set(-3.6,5.6,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.normalBias=.008;key.shadow.bias=-.00005;key.target.position.set(0,1,0);modelLight.add(key,key.target);const fill=new THREE.DirectionalLight('#ffffff',1.35);fill.position.set(4,2.8,4);fill.target.position.set(0,1,0);modelLight.add(fill,fill.target);const rim=new THREE.DirectionalLight('#ffffff',.7);rim.position.set(1,4,-4);rim.target.position.set(0,1,0);modelLight.add(rim,rim.target);scene.add(modelLight);modelLight.visible=false;
  modelFloor=new THREE.Mesh(new THREE.CylinderGeometry(1.75,1.85,.13,80),new THREE.MeshStandardMaterial({color:'#e7e7e3',roughness:1}));modelFloor.position.y=-.065;modelFloor.receiveShadow=true;scene.add(modelFloor);modelFloor.visible=false;
  // Capture the room once for soft, tinted reflections on the traveller only.
  // This is scene lighting: the neutral study removes it and restores it on return.
  const pmrem=new THREE.PMREMGenerator(renderer);
  let characterEnvironment;
  const wasCharacterVisible=character.root.visible;
  try {
   character.root.visible=false;
   characterEnvironment=pmrem.fromScene(scene,0,.15,55,{size:128,position:new THREE.Vector3(0,1.4,3)});
  } finally {character.root.visible=wasCharacterVisible;pmrem.dispose();}
  characterEnvironment.texture.name='Church reflected light';
  const reflectedMaterials=new Set();
  for(const model of [character,introCharacter])model.root.traverse(o=>{if(o.isMesh)for(const material of Array.isArray(o.material)?o.material:[o.material]){
   if((material.name==='Soft golden skin'||material.name==='Golden eyelid skin')&&!reflectedMaterials.has(material)){
    reflectedMaterials.add(material);material.envMap=characterEnvironment.texture;material.envMapIntensity=1.1;material.needsUpdate=true;
   }
  }});
  const renderTarget=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});introTarget=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});
  composer=new EffectComposer(renderer,renderTarget);worldPass=new RenderPass(scene,camera);composer.addPass(worldPass);
  blendPass=new ShaderPass({uniforms:{tDiffuse:{value:null},tIntro:{value:null},blend:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D tDiffuse;uniform sampler2D tIntro;uniform float blend;void main(){vec3 a=texture2D(tIntro,vUv).rgb;vec3 b=texture2D(tDiffuse,vUv).rgb;gl_FragColor=vec4(mix(a,b,blend),1.);}'});blendPass.uniforms.tIntro.value=introTarget.texture;blendPass.material.depthTest=false;blendPass.material.depthWrite=false;blendPass.enabled=false;composer.addPass(blendPass);
  bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.25,.65,.95);composer.addPass(bloom);composer.addPass(new OutputPass());resize();
  // Warm the complete sanctuary once while the loading screen is still present.
  // Keep fog type and light count constant through the reveal to reuse these programs.
  world.setIntroFade(1);opening.update(0,0);camera.position.set(0,3,10);camera.lookAt(0,4,-10);
  renderer.setRenderTarget(composer.readBuffer);await renderer.compileAsync(scene,camera);composer.render();renderer.setRenderTarget(null);
  opening.update(0,1);opening.camera(introCamera,introLook,introCamera.aspect);introCharacter.root.position.set(world.spawn.standing.x,1.9,world.spawn.standing.z);introCharacter.root.scale.setScalar(1.45);
  renderer.setRenderTarget(introTarget);await renderer.compileAsync(introScene,introCamera);renderer.render(introScene,introCamera);renderer.setRenderTarget(null);
  blendPass.enabled=true;blendPass.uniforms.blend.value=0;composer.render();
  window.addEventListener('resize',resize);readyForInput=true;for(const id of ['startButton','modelButton','journalButton','settingsButton'])$(id).disabled=false;$('loading').hidden=true;updateHUD();$('startButton').onclick=start;
  $('world').addEventListener('webglcontextlost',e=>{e.preventDefault();$('fatal').hidden=false;$('fatalText').textContent='图形连接中断，请重新加载。也可以在设置中选择流畅画质。';});
  if(new URLSearchParams(location.search).has('qa')){
   window.__vesper={get state(){return state;},get mode(){return mode;},get zone(){return zone;},get sprint(){return sprint;},get focusPaused(){return focusPaused;},get introBlend(){return introBlend;},introCamera,introScene,get panelKind(){return panelKind;},get tapePosition(){return state.tapePosition;},player:character.root,character,world,scene,renderer,camera,interact:interactWith,blocked,enterModel,leaveModel,start,closePanel,dispatch,
    setPosition(id){const p=world.points.find(p=>p.id===id);if(!p)return false;zone=p.zone;character.root.position.set(p.x,world.zones[p.zone].floorY||0,p.z);return true;},
    advance(seconds){for(let t=0;t<seconds;t+=.1){applyResult(tickOrgan(state,Math.min(.1,seconds-t)));applyResult(tickTape(state,Math.min(.1,seconds-t)));}updateLivePanels();},
    async exportGLB(kind='character'){
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
  requestAnimationFrame(time=>{frame(time);$('world').style.visibility='visible';});const query=new URLSearchParams(location.search);if(query.has('model')){enterModel();if(query.has('inspect'))closePanel();if(query.has('walk')){modelWalking=true;$('modelWalk').textContent='暂停行走';}}
 }catch(error){console.error(error);$('loading').hidden=true;$('fatal').hidden=false;$('fatalText').textContent='需要支持 WebGL 2 的浏览器。请启用浏览器硬件加速后重试。'+error.message;}
}
boot();


