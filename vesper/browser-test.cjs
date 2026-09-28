'use strict';
/** Chapter I browser regression. Uses real controls; QA only places the actor and accelerates preliminary tape checks. */
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),port=Number(process.env.VESPER_TEST_PORT)||18761;
const output=path.join(root,'test-results','chapter1'),url=`http://127.0.0.1:${port}/vesper.html?qa=1`;
const report={started:new Date().toISOString(),checks:[],screenshots:[],errors:[],tapeSamples:[]};
let server,browser,page,serverLog='';
function pass(name,details){report.checks.push({name,status:'passed',...(details?{details}:{})});console.log('PASS '+name);}
async function snapshot(name,target=page){const file=path.join(output,name+'.png');await target.screenshot({path:file,fullPage:true,timeout:30000});report.screenshots.push(path.relative(root,file).replaceAll('\\','/'));}
async function waitServer(){const until=Date.now()+15000;while(Date.now()<until){if(server.exitCode!==null)throw Error(serverLog);try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,150));}throw Error('Test server timeout: '+serverLog);}
async function setup(context){await context.addInitScript(()=>{localStorage.setItem('vesper-quality','low');localStorage.setItem('vesper-muted','true');});const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await ready(p);await p.bringToFront();await p.evaluate(()=>window.dispatchEvent(new Event('focus')));return p;}
async function ready(p=page){await p.waitForFunction(()=>window.__vesper?.world&&document.getElementById('startButton')&&!document.getElementById('startButton').disabled,null,{timeout:90000});assert.equal(await p.locator('#fatal').isVisible(),false);await p.bringToFront();await p.evaluate(()=>window.dispatchEvent(new Event('focus')));}
async function state(p=page){return p.evaluate(()=>window.__vesper.state);}
async function expect(key,value=true,p=page){await p.waitForFunction(({key,value})=>window.__vesper.state[key]===value,{key,value},{timeout:30000});}
async function close(p=page){if(await p.locator('#panelClose').isVisible())await p.locator('#panelClose').click();}
async function place(id,p=page){assert.equal(await p.evaluate(id=>window.__vesper.setPosition(id),id),true,'Point missing: '+id);}
async function openAt(id,p=page){await close(p);await place(id,p);await p.waitForTimeout(100);const opened=await p.evaluate(id=>window.__vesper.interact(id),id);assert.equal(opened,true,'Cannot approach/interact: '+id);}
async function click(id,p=page){await p.locator('#'+id).click({timeout:10000});}
async function begin(p=page){await click('startButton',p);await p.waitForFunction(()=>window.__vesper.mode==='playing',null,{timeout:25000});}
async function readPosition(p=page){return p.evaluate(()=>window.__vesper.player.position.toArray());}
async function groundAt(x,z,p=page){await p.evaluate(({x,z})=>{window.__vesper.player.position.set(x,0,z);},{x,z});}
async function noOverflow(p){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Horizontal page overflow');for(const selector of ['#startButton','#panelClose','#joystick','#playTape','#journalButton','#settingsButton']){const el=p.locator(selector);if(await el.isVisible()){const b=await el.boundingBox(),w=await p.evaluate(()=>innerWidth);assert.ok(b.x>=-1&&b.x+b.width<=w+1,selector+' out of bounds');}}}
async function focusReset(){await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});}

async function openingAndMovement(){
 assert.equal(await page.evaluate(()=>window.__vesper.mode),'intro');
 await page.waitForTimeout(1700);
 await snapshot('01-opening');
 const spawn=await page.evaluate(()=>window.__vesper.world.spawn.standing);
 await page.keyboard.down('w');await page.waitForFunction(()=>window.__vesper.mode==='arrival');
 await page.keyboard.down('w');await page.keyboard.press('ArrowUp');
 await page.waitForFunction(()=>window.__vesper.mode==='playing',null,{timeout:25000});await page.keyboard.up('w');
 const landed=await readPosition();assert.ok(Math.abs(landed[0]-spawn.x)<.001&&Math.abs(landed[2]-spawn.z)<.001,'Arrival input must not move the actor');
 await page.waitForTimeout(350);assert.deepEqual(await readPosition(),landed);
 assert.equal(await page.evaluate(()=>window.__vesper.sprint),false);
 pass('opening: movement starts one arrival and cannot leak into walking');
 const poseCheck=await page.evaluate(async()=>{
  const {createNailong}=await import('./vesper/character.js'),live=window.__vesper.character,fresh=createNailong();
  fresh.mixer.setTime(live.mixer.time);fresh.update(0,{moving:false,time:live.mixer.time});
  const bones=['ArmL','ArmR','ElbowL','ElbowR','LegL','LegR','KneeL','KneeR'];
  const differences=Object.fromEntries(bones.map(name=>[name,live.root.getObjectByName(name).quaternion.angleTo(fresh.root.getObjectByName(name).quaternion)]));
  fresh.dispose();return {differences,scale:live.root.scale.toArray()};
 });
 assert.ok(Object.values(poseCheck.differences).every(angle=>angle<.015),'Opening pose must not accumulate or remain in resting limbs: '+JSON.stringify(poseCheck));
 assert.deepEqual(poseCheck.scale,[1,1,1]);pass('opening limb overlay clears after idle dwell and arrival',poseCheck);
 await snapshot('02-dark-sanctuary');
 await groundAt(0,10);await focusReset();
 await page.keyboard.press('w');await page.keyboard.down('ArrowUp');
 assert.equal(await page.evaluate(()=>window.__vesper.sprint),false,'W -> Up is not a double tap');await page.keyboard.up('ArrowUp');
 await focusReset();await page.keyboard.down('w');await page.keyboard.down('w');assert.equal(await page.evaluate(()=>window.__vesper.sprint),false,'Keyboard repeat must not sprint');await page.keyboard.up('w');
 await focusReset();await page.keyboard.press('w');await page.keyboard.down('w');assert.equal(await page.evaluate(()=>window.__vesper.sprint),true);
 await page.keyboard.up('w');assert.equal(await page.evaluate(()=>window.__vesper.sprint),false);
 await focusReset();await page.keyboard.press('ArrowUp');await page.keyboard.down('ArrowUp');assert.equal(await page.evaluate(()=>window.__vesper.sprint),true);await page.keyboard.up('ArrowUp');
 await focusReset();await page.keyboard.press('w');await page.keyboard.down('w');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 const paused=await readPosition();await page.waitForTimeout(300);assert.deepEqual(await readPosition(),paused);assert.equal(await page.evaluate(()=>window.__vesper.sprint),false);await page.keyboard.up('w');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 pass('sprint: same-key double tap, release, repeat, mixed keys and blur clearing');
 // Compare animation playback rate, computed from actual travelled distance, with the existing walk cycle.
 async function rate(run){await groundAt(0,10);await focusReset();if(run)await page.keyboard.press('w');await page.keyboard.down('w');await page.waitForTimeout(700);const v=await page.evaluate(()=>{const q=window.__vesper;return q.character.mixer.existingAction(q.character.animations.find(a=>a.name==='Walk')).getEffectiveTimeScale();});await page.keyboard.up('w');return v;}
 const walk=await rate(false),run=await rate(true);assert.ok(Math.abs(run/walk-1.7)<.04,`Walk/sprint ratio ${run/walk}`);pass('sprint speed remains 1.7 times base walking',{walk,run,ratio:run/walk});
 await groundAt(0,1.5);await page.keyboard.down('d');await page.waitForTimeout(2500);await page.keyboard.up('d');const x=(await readPosition())[0];assert.ok(x>0&&x<1.8,'Pews must block movement');
 await groundAt(-8.5,12);await page.keyboard.down('a');await page.waitForTimeout(700);await page.keyboard.up('a');assert.ok((await readPosition())[0]>=-8.74,'Outer wall collision');
 pass('real keyboard movement stops at pews and outer wall');
}

async function modelReturn(){
 await groundAt(0,5);const before=await page.evaluate(()=>{const q=window.__vesper;let material;q.character.root.traverse(o=>{if(o.material?.name==='Soft golden skin')material=o.material;});return {position:q.player.position.toArray(),rotation:q.player.rotation.toArray(),fov:q.camera.fov,map:material.envMap.uuid,intensity:material.envMapIntensity};});
 await click('settingsButton');await click('inspectModel');await page.waitForFunction(()=>window.__vesper.mode==='model');await click('walkPreview');
 await page.waitForFunction(()=>{const c=window.__vesper.character;return c.mixer.existingAction(c.animations.find(a=>a.name==='Walk')).getEffectiveWeight()>.3;});
 await close();await click('modelBack');assert.equal(await page.evaluate(()=>window.__vesper.mode),'playing');
 const after=await page.evaluate(()=>{const q=window.__vesper;let material;q.character.root.traverse(o=>{if(o.material?.name==='Soft golden skin')material=o.material;});return {position:q.player.position.toArray(),rotation:q.player.rotation.toArray(),fov:q.camera.fov,map:material.envMap.uuid,intensity:material.envMapIntensity};});
 assert.deepEqual(after,before);pass('model walking preview restores position, facing, FOV and reflected light exactly');
}

async function firstPuzzle(){
 await openAt('curtain');await click('pullCord');assert.equal((await state()).curtainOpened,false);assert.match(await page.locator('#panelBody').textContent(),/拉不动/);
 await click('releaseCord');assert.equal((await state()).curtainReleased,true);await click('pullCord');assert.equal((await state()).curtainRaised,true);assert.equal((await state()).curtainOpened,false);await click('secureCord');await expect('curtainOpened');
 await close();await snapshot('03-curtain-open');pass('curtain retry and release/raise/secure use actual buttons');
 await openAt('programme');await expect('programmeCollected');assert.match(await page.locator('.paper').textContent(),/Experience/);assert.equal(await page.locator('.trace').textContent(),'····');
 await openAt('window');await expect('patternRevealed');assert.equal(await page.locator('.trace span').nth(2).textContent(),'');await snapshot('04-programme-light');
 await openAt('organ');assert.equal(await page.locator('.symbol-keys button').count(),3);assert.equal(await page.getByRole('button',{name:/休止|空拍/}).count(),0);
 await click('startOrgan');await page.locator('[data-symbol="◇"]').click();await expect('organFailures',1);assert.equal((await state()).organSolved,false);
 await close();assert.equal((await state()).organPlaying,false);await openAt('organ');await click('startOrgan');
 for(const [beat,symbol]of [[0,'○'],[1,'△'],[2,null],[3,'◇']]){
  await page.waitForFunction(beat=>window.__vesper.state.organPlaying&&window.__vesper.state.organBeat===beat,beat,{timeout:12000});
  if(symbol)await page.locator('.symbol-keys [data-symbol="'+symbol+'"]').click();else assert.equal((await state()).organSolved,false);
 }
 await expect('organSolved');const solvedAt=Date.now();assert.equal((await state()).sideRoomUnlocked,false);await page.waitForTimeout(900);assert.equal((await state()).sideRoomUnlocked,false);await expect('sideRoomUnlocked');assert.ok(Date.now()-solvedAt>=1800);
 await close();await snapshot('05-side-room-unlocked');pass('music: three symbol keys, real timed rest, retry and delayed two-second unlock');
}

async function archivePuzzle(){
 await openAt('archive');await click('collect17');await click('collect18');assert.equal((await state()).b18TicketCollected,true);
 await click('insert18');await click('lampButton');assert.equal(await page.locator('.projection').textContent(),'');await click('punchButton');assert.equal((await state()).b18Altered,true);assert.equal((await state()).routeBias.restore,1);assert.equal(await page.locator('.projection').textContent(),'○ × ↓');
 await close();assert.equal((await state()).archiveInserted,null);assert.equal((await state()).b18TicketCollected,true);
 await openAt('archive');await click('insert17');assert.equal(await page.locator('.projection').textContent(),'○ × ↓');await page.locator('[data-dial="1"]').click();await page.locator('[data-dial="2"]').click();await click('checkArchive');await expect('archiveDrawerSolved');
 assert.equal((await state()).tapeCollected,true);assert.equal((await state()).brassKeyCollected,true);await snapshot('06-ticket-machine');
 await click('ledgerButton');await expect('inspectedSeatLedger');assert.equal(await page.locator('.ledger tr').count(),30);
 await close();await page.locator('[data-item="b18Ticket"]').click();await click('flipTicket');assert.equal((await state()).inspectedB18Date,false,'No date contradiction is recorded while B18 date is unconfigured');await close();
 pass('ticket machine: blank B18, optional punch, automatic ejection, B17 projection and drawer');
}

async function tapePuzzle(){
 await openAt('upperDoor');await page.waitForFunction(()=>window.__vesper.zone==='upper',null,{timeout:10000});await page.waitForTimeout(850);await openAt('clock');assert.match(await page.locator('#panelBody').textContent(),/指针停着/);await close();
 await openAt('tapePlayer');await click('insertTape');await click('playTape');
 await page.waitForFunction(()=>window.__vesper.state.tapePosition>.5);await click('stopTape');const stopped=(await state()).tapePosition;await page.waitForTimeout(350);assert.equal((await state()).tapePosition,stopped);
 await click('playTape');await page.evaluate(()=>window.__vesper.advance(3));await close();await page.reload({waitUntil:'domcontentloaded',timeout:90000});await ready();
 assert.equal((await state()).tapePlaying,false);assert.equal((await state()).tapeCollected,true);assert.equal((await state()).brassKeyCollected,true);await begin();await openAt('tapePlayer');
 await click('rewindTape');await click('playTape');const started=Date.now();
 // No advance() during this run: timecode/reels and chapter events are observed
 // across a complete real-time recording, including the silent tail.
 for(const [position,label]of [[12,'19:30:47'],[25,'19:31:00'],[29,'19:31:04'],[31,'19:31:06'],[33,'19:31:08']]){
  await page.waitForFunction(n=>window.__vesper.state.tapePosition>=n,position,{timeout:90000});
  const sample=await page.evaluate(()=>({position:window.__vesper.state.tapePosition,playing:window.__vesper.state.tapePlaying,code:document.getElementById('timecode').textContent,exitUnlocked:window.__vesper.state.exitUnlocked}));
  assert.equal(sample.playing,true);assert.equal(sample.exitUnlocked,false);assert.ok(sample.code>=label);report.tapeSamples.push({...sample,wallSeconds:(Date.now()-started)/1000});
  if(position===25){assert.ok(await page.locator('#cassette').evaluate(e=>e.classList.contains('playing')));await snapshot('07-tape-silent-reels');}
 }
 await expect('tapeCompleted');assert.ok(Date.now()-started>=34000,'Final recording may not be skipped');assert.equal(await page.locator('#timecode').textContent(),'19:31:10');assert.equal((await state()).exitUnlocked,true);assert.equal((await state()).chapterComplete,false);
 pass('upper floor and real tape: reload pauses safely, reels survive silence, final note alone unlocks exit',{wallSeconds:(Date.now()-started)/1000});
 await close();await openAt('downstairs');await page.waitForFunction(()=>window.__vesper.zone==='nave');await page.waitForTimeout(850);
 await openAt('stone');assert.match(await page.locator('#panelBody').textContent(),/很冷/);assert.match(await page.locator('#panelBody').textContent(),/B18/);await close();await openAt('seatB18');assert.equal((await state()).chapterComplete,false);await close();
 pass('unlocked chapter permits B18 and cold stone re-exploration');
}

async function corridorEnd(){
 await openAt('exit');await expect('exitOpened');assert.equal((await state()).chapterComplete,false);await close();
 await groundAt(0,15.1);
 // Turn the view towards the rear door, then use the actual double-W sprint.
 await page.mouse.move(800,380);await page.mouse.down();await page.mouse.move(276.4,380,{steps:8});await page.mouse.up();
 await page.keyboard.press('w');await page.keyboard.down('w');
 await page.waitForFunction(()=>window.__vesper.state.corridorEntered,null,{timeout:20000});await page.keyboard.up('w');assert.equal((await state()).chapterComplete,false);await snapshot('08-corridor-entered');
 await click('settingsButton');const pausedDoor=await page.evaluate(()=>window.__vesper.world.door.rotation.y);await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>window.__vesper.world.door.rotation.y),pausedDoor,'Paused world must not continue the closing door animation');await close();
 await page.waitForFunction(()=>window.__vesper.world.doorOpening<.02,null,{timeout:12000});
 assert.equal(await page.evaluate(()=>window.__vesper.blocked(0,15.9)),true,'Closed corridor door must regain collision');
 await page.reload({waitUntil:'domcontentloaded',timeout:90000});await ready();assert.equal((await state()).corridorEntered,true);await begin();
 assert.equal(await page.evaluate(()=>window.__vesper.zone),'corridor');await page.waitForTimeout(600);
 assert.ok(await page.evaluate(()=>window.__vesper.world.doorOpening<.02),'Reloaded corridor must keep the church door closed');
 assert.equal(await page.evaluate(()=>window.__vesper.blocked(0,15.9)),true);
 pass('closing doorway pauses with settings and remains closed/collidable after corridor reload');
 await page.keyboard.press('w');await page.keyboard.down('w');
 try{await page.waitForFunction(()=>window.__vesper.mode==='won',null,{timeout:65000});}finally{await page.keyboard.up('w');}
 await page.locator('#chapterEnd').waitFor({state:'visible'});assert.equal((await state()).chapterComplete,true);const end=await readPosition();assert.ok(end[2]>37);await snapshot('09-chapter-end');
 pass('corridor: normal sprint enters, closes door, and ends only beyond the distant threshold',{endPosition:end});
}

async function mobileChecks(){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),p=await setup(context);
 for(const width of [320,390]){await p.setViewportSize({width,height:width===320?740:844});await noOverflow(p);}await snapshot('10-opening-mobile',p);await begin(p);
 const cdp=await context.newCDPSession(p),stick=p.locator('#joystick');await stick.waitFor({state:'visible'});const b=await stick.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
 const send=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});const finger=yy=>[{x,y:yy,id:1,radiusX:1,radiusY:1,force:1}];
 await groundAt(0,10,p);await send('touchStart',finger(y));await send('touchMove',finger(y-32));await p.waitForFunction(()=>window.__vesper.player.position.z<9.75,null,{timeout:15000});await send('touchCancel');const canceled=await readPosition(p);await p.waitForTimeout(300);assert.deepEqual(await readPosition(p),canceled);
 await send('touchStart',finger(y));await send('touchMove',finger(y-32));await p.waitForFunction(z=>window.__vesper.player.position.z<z-.15,canceled[2]);await p.evaluate(()=>document.getElementById('journalButton').click());const paused=await readPosition(p);await send('touchEnd');await p.waitForTimeout(300);assert.deepEqual(await readPosition(p),paused);await close(p);await p.waitForTimeout(300);assert.deepEqual(await readPosition(p),paused);
 await openAt('curtain',p);await noOverflow(p);await snapshot('11-mobile-curtain',p);await close(p);
 pass('mobile: 320/390 bounds, real joystick cancel, modal pause and no stale movement');
 await cdp.detach();await context.close();
}

(async()=>{
 fs.mkdirSync(output,{recursive:true});
 try{
  server=spawn(process.execPath,[path.join(root,'server.js')],{cwd:root,env:{...process.env,PORT:String(port),LOCAL_ONLY:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);await waitServer();
  browser=await playwright.chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1280,height:800}});page=await setup(context);
  await openingAndMovement();await modelReturn();await firstPuzzle();await archivePuzzle();await tapePuzzle();await corridorEnd();await mobileChecks();
  assert.deepEqual(report.errors,[],'Browser errors');report.status='passed';await context.close();console.log('Chapter I regression passed.');
 }catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};if(page){try{report.lastState=await state();report.lastMode=await page.evaluate(()=>window.__vesper?.mode);report.focusPaused=await page.evaluate(()=>window.__vesper?.focusPaused);await snapshot('failure');}catch{}}console.error(error);process.exitCode=1;
 }finally{report.finished=new Date().toISOString();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();if(server)server.kill();}
})();
