import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, restoreState, act, tickOrgan, tickTape, ORGAN_BEAT_SECONDS, TAPE_DURATION, getTapeTimecode, getHint, getInventory, getJournal, B18_PRINTED_DATE } from './puzzle.mjs';

function apply(s, id, payload) { return act(s, id, payload).state; }
function curtains() { let s=createState(); for(const id of ['curtain','curtainRelease','curtainPull','curtainSecure']) s=apply(s,id); return s; }
function pattern() { return apply(apply(curtains(),'programme'),'window'); }
function perform(s=pattern()) {
  s=apply(s,'organStart');
  for(const symbol of ['○','△',null,'◇']) {
    if(symbol) s=apply(s,'organInput',{symbol});
    s=tickOrgan(s,ORGAN_BEAT_SECONDS).state;
  }
  return s;
}
function archive() { let s=perform(); s=tickOrgan(s,1).state; return tickOrgan(s,1).state; }
function drawer() {
  let s=archive(); s=apply(s,'b17Ticket'); s=apply(s,'b18Ticket');
  s=apply(s,'ticketInsert',{ticket:'B17'}); s=apply(s,'archiveLamp');
  for(const [index,value] of [0,1,1].entries()) s=apply(s,'archiveTurn',{index,value});
  return apply(s,'archiveCheck');
}
function transport() { return apply(apply(drawer(),'upperDoor'),'tapeInsert'); }
function advance(s,seconds) {
  const effects=[];
  while(seconds>1e-8) { const step=Math.min(seconds,.25);const r=tickTape(s,step);s=r.state;effects.push(...r.effects);seconds-=step; }
  return {state:s,effects};
}
function completed() { return advance(apply(transport(),'tapePlay'),TAPE_DURATION).state; }

test('curtain requires inspection, release, raise, and securing to the hook',()=>{
  let s=createState();
  assert.equal(apply(s,'curtainPull').curtainRaised,false);
  assert.equal(apply(s,'curtainSecure').curtainOpened,false);
  s=apply(s,'curtain');s=apply(s,'curtainRelease');s=apply(s,'curtainPull');
  assert.equal(s.curtainRaised,true);assert.equal(s.curtainOpened,false);
  assert.equal(apply(apply(s,'programme'),'window').patternRevealed,false);
  s=apply(s,'curtainSecure');assert.equal(s.curtainOpened,true);
  assert.equal(act(s,'curtainSecure').changed,false);
});

test('four visible timed beats prove the empty third beat; side-room unlock waits two seconds',()=>{
  let s=pattern();s=apply(s,'organStart');
  s=apply(s,'organInput',{symbol:'○'});s=tickOrgan(s,ORGAN_BEAT_SECONDS).state;
  s=apply(s,'organInput',{symbol:'△'});s=tickOrgan(s,ORGAN_BEAT_SECONDS).state;
  assert.equal(s.organBeat,2);assert.equal(s.organSolved,false);
  s=tickOrgan(s,ORGAN_BEAT_SECONDS).state;s=apply(s,'organInput',{symbol:'◇'});
  const r=tickOrgan(s,ORGAN_BEAT_SECONDS);s=r.state;
  assert.equal(s.organSolved,true);assert.equal(s.sideRoomUnlocked,false);
  assert.deepEqual(r.effects.map(e=>e.type),['organSolved']);
  s=tickOrgan(s,1).state;assert.equal(s.sideRoomUnlocked,false);
  const unlock=tickOrgan(s,1);s=unlock.state;assert.equal(s.sideRoomUnlocked,true);
  assert.ok(unlock.effects.some(e=>e.type==='colourLeak'&&e.duration===.7));
  assert.deepEqual(tickOrgan(s,1).effects,[]);
});

test('wrong, repeated and missing notes retry automatically; later help is nonverbal',()=>{
  let s=pattern();
  for(let attempt=1;attempt<=3;attempt++){
    s=apply(s,'organStart');const r=act(s,'organInput',{symbol:'◇'});s=r.state;
    assert.equal(s.organFailures,attempt);assert.equal(s.organPlaying,true);assert.equal(s.organBeat,-1);
    assert.equal(r.text,'');assert.equal(s.organSolved,false);
    assert.equal(r.effects.some(e=>e.type==='organHint'),attempt>=2);
  }
  s=apply(s,'organStart');s=apply(s,'organInput',{symbol:'○'});
  assert.equal(act(s,'organInput',{symbol:'○'}).state.organFailures,4);
  s=apply(s,'organStart');assert.equal(tickOrgan(s,ORGAN_BEAT_SECONDS).state.organFailures,4);
  s=apply(pattern(),'organStart');s=apply(s,'organInput',{symbol:'○'});s=tickOrgan(s,ORGAN_BEAT_SECONDS).state;
  s=apply(s,'organInput',{symbol:'△'});s=tickOrgan(s,ORGAN_BEAT_SECONDS).state;
  for(const symbol of ['○','△','◇']) assert.equal(act(s,'organInput',{symbol}).state.organSolved,false);
  assert.equal(perform(s).organSolved,true);
});

test('chapter gates cannot be skipped by sending actions directly',()=>{
  const s=createState();
  for(const id of ['organStart','b17Ticket','b18Ticket','archiveCheck','upperDoor','tapeInsert','tapePlay','stoneNear','exit','corridorEnter','corridorEnd']){
    const r=act(s,id);assert.equal(r.state.organSolved,false);assert.equal(r.state.archiveDrawerSolved,false);
    assert.equal(r.state.exitUnlocked,false);assert.equal(r.state.escaped,false);
  }
  assert.equal(apply(archive(),'archiveCheck').archiveDrawerSolved,false);
  assert.equal(apply(completed(),'corridorEnd').escaped,false);
});

test('B17 projection and mechanical symbols unlock the drawer; B18 remains recoverable',()=>{
  let s=archive();s=apply(s,'b17Ticket');s=apply(s,'b18Ticket');
  s=apply(s,'ticketInsert',{ticket:'B18'});s=apply(s,'archiveLamp');
  assert.equal(act(s,'archive').projection,null);
  const punched=act(s,'punchB18');s=punched.state;
  assert.equal(s.b18Altered,true);assert.deepEqual(s.routeBias,{restore:1,search:0,release:0});
  assert.equal(act(s,'punchB18').state.routeBias.restore,1);
  assert.equal(act(s,'archive').projection.join(''),'○×↓');
  s=apply(s,'ticketEject');assert.equal(s.archiveInserted,null);assert.equal(s.b18TicketCollected,true);
  s=apply(s,'ticketInsert',{ticket:'B17'});assert.deepEqual(act(s,'archive').projection,['○','×','↓']);
  for(const [index,value]of [0,1,1].entries())s=apply(s,'archiveTurn',{index,value});
  s=apply(s,'archiveCheck');assert.equal(s.tapeCollected,true);assert.equal(s.brassKeyCollected,true);
  assert.equal(getInventory(s).filter(i=>i.id==='b18Ticket').length,1);
});

test('optional inspections and hidden route scores occur once, never consume an item',()=>{
  let s=drawer();
  for(let i=0;i<8;i++){s=apply(s,'flipB18');s=apply(s,'seatLedger');}
  assert.equal(s.routeBias.search,1);assert.equal(s.b18TicketCollected,true);
  assert.equal(B18_PRINTED_DATE,null);
  assert.equal(act(s,'flipB18').printedDate,null);
  const text=JSON.stringify([getHint(s),getJournal(s),getInventory(s)]);
  assert.doesNotMatch(text,/routeBias|ECHO|REHEARSAL|恋人|分手|梦境|现实/);
});

test('tape stays playing through silence and emits exact events before opening the exit',()=>{
  let s=apply(transport(),'tapePlay');
  const first=advance(s,25);s=first.state;
  assert.equal(getTapeTimecode(s),'19:31:00');assert.equal(s.tapePlaying,true);assert.equal(s.exitUnlocked,false);
  assert.ok(first.effects.some(e=>e.type==='silence'));
  s=advance(s,4).state;assert.equal(s.heardTerminalChime,true);assert.equal(s.exitUnlocked,false);
  const leak=advance(s,2);s=leak.state;assert.ok(leak.effects.some(e=>e.type==='colourLeak'&&e.duration===1));
  s=advance(s,2).state;assert.equal(s.heardRealityChairSound,true);assert.equal(s.exitUnlocked,false);
  const end=advance(s,2);s=end.state;
  assert.equal(s.tapePlaying,false);assert.equal(s.exitUnlocked,true);assert.equal(getTapeTimecode(s),'19:31:10');
  assert.equal(s.playerWaitedThroughSilence,true);assert.equal(s.routeBias.release,1);
  assert.deepEqual(end.effects.map(e=>e.type),['tapeComplete','exitUnlock']);
  assert.equal(s.escaped,false);assert.equal(s.chapterComplete,false);
});

test('pause, rewind and eject never soft-lock; interrupted first listen earns no release',()=>{
  let s=apply(transport(),'tapePlay');s=advance(s,26).state;
  s=apply(s,'tapeStop');const position=s.tapePosition;
  assert.equal(tickTape(s,1).state.tapePosition,position);
  s=apply(s,'tapeEject');assert.equal(s.tapeCollected,true);assert.equal(s.tapeInserted,false);
  s=apply(s,'tapeInsert');s=apply(s,'tapePlay');s=advance(s,9).state;
  assert.equal(s.tapeCompleted,true);assert.equal(s.playerWaitedThroughSilence,false);
  assert.equal(s.routeBias.release,0);
  s=apply(s,'tapeRewind');s=apply(s,'tapePlay');s=advance(s,35).state;
  assert.equal(s.exitUnlocked,true);assert.equal(s.routeBias.release,0);
});

test('rewinding across warm flash does not repeat either chapter colour leak',()=>{
  let s=apply(transport(),'tapePlay');s=advance(s,31.5).state;
  s=apply(s,'tapeRewind');s=apply(s,'tapePlay');
  const r=advance(s,35);s=r.state;
  assert.equal(r.effects.some(e=>e.type==='colourLeak'),false);
  s=apply(s,'tapePlay');assert.equal(advance(s,35).effects.some(e=>e.type==='colourLeak'),false);
});

test('replay scoring is latched; STOP/PLAY without rewinding is not a replay',()=>{
  let s=transport();s=apply(s,'tapePlay');s=advance(s,1).state;
  for(let i=0;i<5;i++){s=apply(s,'tapeStop');s=apply(s,'tapePlay');}
  assert.equal(s.tapePlayCount,1);assert.equal(s.tapeReplayCount,0);
  for(let i=0;i<3;i++){s=apply(s,'tapeRewind');s=apply(s,'tapePlay');s=advance(s,1).state;}
  assert.equal(s.routeBias.search,1);
  s=advance(s,34).state;
  for(let i=0;i<3;i++){s=apply(s,'tapePlay');s=advance(s,35).state;}
  assert.equal(s.postExitReplayCount,3);assert.equal(s.routeBias.restore,1);assert.equal(s.routeBias.search,1);
  s=apply(s,'tapePlay');s=advance(s,35).state;assert.equal(s.routeBias.restore,1);
});

test('only corridor-end completes chapter; unlocked church remains explorable',()=>{
  let s=completed();assert.equal(apply(s,'seatB18').seatB18Inspected,true);
  const stone=act(s,'stoneNear');s=stone.state;
  assert.deepEqual(stone.effects,[{type:'floorStoneKnock'}]);assert.deepEqual(act(s,'stoneNear').effects,[]);
  assert.equal(act(s,'stone').marking,null);s=apply(s,'seatLedger');assert.equal(act(s,'stone').marking,'B18');
  s=apply(s,'exit');assert.equal(s.exitOpened,true);assert.equal(s.escaped,false);
  s=apply(s,'corridorEnter');assert.equal(s.escaped,false);
  const end=act(s,'corridorEnd');assert.equal(end.kind,'end');assert.equal(end.state.chapterComplete,true);
  assert.equal(act(end.state,'corridorEnd').changed,false);
});

test('save restore pauses transport, returns tickets, and retains all permanent progress',()=>{
  for(const source of [createState(),curtains(),pattern(),archive(),drawer(),transport(),completed()]){
    const s=restoreState(JSON.stringify(source));
    assert.equal(s.organPlaying,false);assert.equal(s.tapePlaying,false);assert.equal(s.archiveInserted,null);
    for(const key of ['curtainOpened','patternRevealed','organSolved','sideRoomUnlocked','archiveDrawerSolved','tapeCollected','upperDoorUnlocked','tapeCompleted','exitUnlocked'])assert.equal(s[key],source[key]);
  }
  let s=apply(transport(),'tapePlay');s=advance(s,30).state;s=restoreState(s);
  assert.equal(s.tapePosition,30);s=apply(s,'tapePlay');assert.equal(advance(s,5).state.exitUnlocked,true);
  const pending=restoreState(perform());assert.equal(tickOrgan(tickOrgan(pending,1).state,1).state.sideRoomUnlocked,true);
});

test('old, malformed, impossible and hostile saves cannot invent progress or scores',()=>{
  for(const value of [null,undefined,'', '{', 'null','true','[]',[],1,{}, {version:1,escaped:true},' '.repeat(20001)])assert.deepEqual(restoreState(value),createState());
  const invalid=restoreState({...createState(),organSolved:true,sideRoomUnlocked:true,tapeCompleted:true,escaped:true,routeBias:{restore:1000,search:1000,release:1000},extra:'bad'});
  assert.deepEqual(invalid,createState());
  const valid=restoreState({...drawer(),archiveDials:[-1,Infinity,'1'],tapePosition:Infinity,routeBias:{restore:1000}});
  assert.deepEqual(valid.archiveDials,[0,0,0]);assert.equal(valid.routeBias.restore,0);
  assert.equal({}.polluted,undefined);
  assert.deepEqual(restoreState('{"version":2,"__proto__":{"polluted":true}}'),createState());
});

test('actions and ticks never mutate frozen input; invalid durations do not advance',()=>{
  const s=pattern();Object.freeze(s.organInputs);Object.freeze(s.archiveDials);Object.freeze(s.routeBias);Object.freeze(s);
  act(s,'organStart');act(s,'clock');getJournal(s);assert.equal(s.organPlaying,false);
  const tape=apply(transport(),'tapePlay');
  for(const dt of [NaN,Infinity,-1,'1',null,undefined])assert.equal(tickTape(tape,dt).state.tapePosition,0);
  assert.equal(tickTape(tape,1000).state.tapePosition,1);
});


test('altered B18 works mechanically and neither ticket can strand the player',()=>{
  let s=archive();s=apply(s,'b18Ticket');s=apply(s,'ticketInsert',{ticket:'B18'});
  s=apply(s,'archiveLamp');s=apply(s,'punchB18');
  for(const [index,value] of [0,1,1].entries())s=apply(s,'archiveTurn',{index,value});
  s=apply(s,'archiveCheck');assert.equal(s.archiveDrawerSolved,true);assert.equal(s.brassKeyCollected,true);
  assert.equal(s.b17TicketCollected,false);assert.equal(restoreState(s).archiveDrawerSolved,true);
  assert.equal(apply(s,'b17Ticket').b17TicketCollected,true);
});
