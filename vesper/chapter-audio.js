// Optional authorized music files can be assigned without changing puzzle timing.
export const MUSIC_SLOTS=Object.freeze({experienceMain:null,experienceMemory:null,experienceEnding:null});
/** Original, local chapter foley. Narrative timing belongs to the chapter state machine.
 * Uses shared mute/volume preferences without mutating them or scheduling missed cues.
 */
const FILES=Object.freeze({
 paper:'paper',cloth:'cloth',latch:'latch',curtain:'curtain',footstep:'footstep',
 door:'door',cup:'cup',stone:'stone',breath:'breath',tapeStart:'tapeStart',tapeStop:'tapeStop',
 organCircle:'organCircle',organTriangle:'organTriangle',organDiamond:'organDiamond',
 organFail:'organFail',pianoLast:'pianoLast',terminalChime:'terminalChime',
 realityChair:'realityChair',tapeMotor:'tapeMotor'
});
const ALIASES=Object.freeze({
 'organ○':'organCircle','organ△':'organTriangle','organ◇':'organDiamond',
 '○':'organCircle','△':'organTriangle','◇':'organDiamond',
 noteCircle:'organCircle',noteTriangle:'organTriangle',noteDiamond:'organDiamond',
 chair:'realityChair',lock:'latch',step:'footstep',piano:'pianoLast',floorStone:'stone',
 note:'organCircle'
});
const LEVEL=Object.freeze({paper:.30,cloth:.28,latch:.34,curtain:.38,footstep:.22,
 door:.38,cup:.24,stone:.25,breath:.10,tapeStart:.28,tapeStop:.27,
 organCircle:.48,organTriangle:.48,organDiamond:.48,organFail:.32,
 pianoLast:.34,terminalChime:.28,realityChair:.34,tapeMotor:.13});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function createChapterAudio(controller) {
 let context=null,master=null,compressor=null,unlocked=false,disposed=false;
 let hidden=Boolean(globalThis.document?.hidden),paused=false,resuming=null;
 let loadChain=Promise.resolve(),motor=null,lastStep=-Infinity;
 const buffers=new Map(),loading=new Map(),failed=new Set(),voices=new Set(),requests=new Set();
 const currentVolume=()=>Number.isFinite(Number(controller?.volume))?clamp(Number(controller.volume),0,1):.6;
 const permitted=()=>!disposed&&unlocked&&!hidden&&!paused&&!globalThis.document?.hidden&&!controller?.muted&&currentVolume()>0;
 function endVoice(voice) {
  if(!voice)return;
  voices.delete(voice);if(motor===voice)motor=null;
  try{voice.source.stop();}catch{}
  try{voice.source.disconnect();voice.gain.disconnect();voice.pan?.disconnect();}catch{}
 }
 function stopAll() {
  for(const voice of [...voices])endVoice(voice);
  motor=null;lastStep=-Infinity;
 }
 function resume() {
  if(!context||!permitted()||context.state==='running'||context.state==='closed'||resuming)return;
  resuming=Promise.resolve(context.resume()).catch(()=>{}).finally(()=>{resuming=null;});
 }
 function sync(options={}) {
  if('hidden' in options)hidden=Boolean(options.hidden);
  if('paused' in options)paused=Boolean(options.paused);
  if(disposed)return;
  if(master&&context.state!=='closed')master.gain.setValueAtTime(permitted()?currentVolume():0,context.currentTime);
  if(!permitted()){
   stopAll();
   if(context?.state==='running')context.suspend().catch(()=>{});
  }else resume();
 }
 function queueBuffer(id) {
  if(disposed||failed.has(id)||!FILES[id]||!context)return Promise.resolve(null);
  if(buffers.has(id))return Promise.resolve(buffers.get(id));
  if(loading.has(id))return loading.get(id);
  // One request/decode at a time; missing optional audio never blocks game progress.
  const request=loadChain.then(async()=>{
   if(disposed||context.state==='closed')return null;
   const abort=new AbortController();requests.add(abort);
   const timeout=setTimeout(()=>abort.abort(),6000);
   try{
    const response=await fetch(new URL('./assets/audio/chapter1/'+FILES[id]+'.wav',import.meta.url),{signal:abort.signal,cache:'force-cache'});
    if(!response.ok)throw new Error('Audio unavailable');
    const data=await response.arrayBuffer();
    if(disposed||context.state==='closed')return null;
    const buffer=await context.decodeAudioData(data);
    if(disposed)return null;
    buffers.set(id,buffer);return buffer;
   }catch{failed.add(id);return null;}
   finally{clearTimeout(timeout);requests.delete(abort);}
  }).finally(()=>loading.delete(id));
  loading.set(id,request);loadChain=request.catch(()=>null);return request;
 }
 function unlock() {
  if(disposed)return false;
  try{controller?.unlock?.();}catch{}
  unlocked=true;
  if(controller?.muted||currentVolume()<=0)return false;
  try{
   if(!context){
    const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Audio)return false;
    context=new Audio();master=context.createGain();master.gain.value=currentVolume();
    compressor=context.createDynamicsCompressor();compressor.threshold.value=-15;
    compressor.knee.value=15;compressor.ratio.value=3;compressor.attack.value=.015;compressor.release.value=.24;
    master.connect(compressor);compressor.connect(context.destination);
   }
   sync();
   for(const id of Object.keys(FILES))queueBuffer(id);
   return true;
  }catch{return false;}
 }
 function startVoice(id,options={},loop=false) {
  if(!permitted()||!context||context.state!=='running')return null;
  const buffer=buffers.get(id);
  // Do not play a story cue later after its file finishes loading.
  if(!buffer){queueBuffer(id);return null;}
  if(voices.size>=8)endVoice([...voices].find(v=>v!==motor)||voices.values().next().value);
  try{
   const source=context.createBufferSource(),gain=context.createGain();
   source.buffer=buffer;source.loop=loop;
   source.playbackRate.value=Number.isFinite(options.rate)?clamp(options.rate,.7,1.4):1;
   gain.gain.value=(LEVEL[id]??.3)*(Number.isFinite(options.volume)?clamp(options.volume,0,1.5):1);
   source.connect(gain);
   const pan=context.createStereoPanner?.();
   if(pan){pan.pan.value=Number.isFinite(options.pan)?clamp(options.pan,-1,1):0;gain.connect(pan);pan.connect(master);}else gain.connect(master);
   const voice={id,source,gain,pan};voices.add(voice);
   source.onended=()=>{voices.delete(voice);if(motor===voice)motor=null;source.disconnect();gain.disconnect();pan?.disconnect();};
   source.start();return voice;
  }catch{return null;}
 }
 function play(id,options={}) {
  id=ALIASES[id]||id;
  if(!FILES[id]||id==='tapeMotor')return false;
  sync();
  if(id==='footstep'){
   const now=context?.currentTime??0;
   if(now-lastStep<.12)return false;
   const voice=startVoice(id,options);if(voice)lastStep=now;return Boolean(voice);
  }
  return Boolean(startVoice(id,options));
 }
 function tickTape(position,playing) {
  sync();
  if(!playing||!Number.isFinite(position)||position<0||position>=35||!permitted()){
   if(motor)endVoice(motor);return;
  }
  // The roll remains visually active during silence; its motor is deliberately inaudible.
  // Cue events at 29/33/35 seconds are dispatched exactly once by the story controller.
  if(position>=25){if(motor)endVoice(motor);return;}
  if(!motor)motor=startVoice('tapeMotor',{},true);
 }
 function onVisibility(){sync({hidden:Boolean(globalThis.document?.hidden)});}
 function dispose() {
  if(disposed)return;
  stopAll();disposed=true;
  for(const request of requests)request.abort();requests.clear();buffers.clear();
  globalThis.document?.removeEventListener('visibilitychange',onVisibility);
  try{master?.disconnect();compressor?.disconnect();}catch{}
  context?.close().catch(()=>{});
 }
 globalThis.document?.addEventListener('visibilitychange',onVisibility);
 return {unlock,sync,play,tickTape,stopAll,dispose};
}

