'use strict';
/** Full browser regression for the standalone Vesper chapter. Run: node vesper/browser-test.cjs */
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.resolve(path.dirname(process.execPath), '../node_modules/playwright')); }
const root = path.resolve(__dirname, '..');
const port = Number(process.env.VESPER_TEST_PORT) || 18761;
const output = path.join(root, 'test-results');
const baseURL = `http://127.0.0.1:${port}/vesper.html?qa=1`;
const server = spawn(process.execPath, [path.join(root, 'server.js')], {
  cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let serverLog = '';
server.stdout.on('data', data => { serverLog += data.toString(); });
server.stderr.on('data', data => { serverLog += data.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vesper test server exited: ${serverLog}`);
    try { const response = await fetch(baseURL); if (response.ok) return; }
    catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Vesper test server did not serve its page: ${serverLog}`);
}
async function ready(page) {
  await page.waitForFunction(() => window.__vesper?.player && window.__vesper?.renderer, null, { timeout: 45000 });
  await page.locator('#startButton:not([disabled])').waitFor({ timeout: 45000 });
}
async function begin(page) {
  if (await page.locator('#startButton').isVisible()) await page.locator('#startButton').click();
  await page.waitForFunction(() => document.getElementById('startButton')?.getBoundingClientRect().width === 0 || !document.getElementById('startButton')?.checkVisibility());
}
async function closePanel(page) {
  if (await page.locator('#panelClose').isVisible()) await page.locator('#panelClose').click();
}
async function saveShot(page, name) {
  await page.waitForTimeout(550);
  await page.screenshot({ path: path.join(output, `vesper-${name}.png`), fullPage: true, timeout: 30000 });
}
async function moveTo(page, id) {
  const fallback = { journal: [-7, 10], organ: [-6, -11], mirror: [7, -6], altar: [0, -13], exit: [0, 15] };
  await page.evaluate(({ id, fallback }) => {
    const qa = window.__vesper;
    const known = qa.world.interactables?.find?.(target => target.id === id);
    const p = known?.position || known;
    const x = Number.isFinite(p?.x) ? p.x : fallback[id][0];
    const z = Number.isFinite(p?.z) ? p.z : fallback[id][1];
    qa.player.position.set(x, 0, z + (id === 'exit' ? -1.4 : 1.4));
  }, { id, fallback });
}
async function openAt(page, id, keyboard = false) {
  await closePanel(page);
  await moveTo(page, id);
  if (keyboard) {
    await page.waitForTimeout(250);
    await page.keyboard.press('e');
  } else await page.evaluate(id => window.__vesper.interact(id), id);
  await page.locator('#panelClose').waitFor({ state: 'visible' });
}
async function expectState(page, key, value = true) {
  await page.waitForFunction(({ key, value }) => window.__vesper?.state?.[key] === value, { key, value });
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Page must not overflow horizontally');
  for (const selector of ['#startButton', '#panelClose', '#journalButton', '#settingsButton']) {
    const locator = page.locator(selector);
    if (await locator.isVisible()) {
      const box = await locator.boundingBox();
      const width = await page.evaluate(() => innerWidth);
      assert.ok(box.x >= -1 && box.x + box.width <= width + 1, `${selector} must fit within screen width`);
    }
  }
}

async function inspectReturnAndCancellation(page) {
  await page.evaluate(() => window.__vesper.player.position.set(0, 0, -7));
  const before = await page.evaluate(() => window.__vesper.player.position.toArray());
  await page.locator('#settingsButton').click();
  await page.locator('#inspectModel').click();
  await page.waitForFunction(() => window.__vesper.mode === 'model');
  await page.locator('#walkPreview').click();
  await page.waitForFunction(() => {
    const character = window.__vesper.character;
    return character.mixer.existingAction(character.animations.find(clip => clip.name === 'Walk')).getEffectiveWeight() > 0.3;
  });
  await closePanel(page);
  await page.locator('#modelBack').click();
  assert.equal(await page.evaluate(() => window.__vesper.mode), 'playing');
  assert.deepEqual(await page.evaluate(() => window.__vesper.player.position.toArray()), before, 'Model inspection must restore the exact explorer position');
  console.log('PASS model walking preview and return to exact explorer position');

  await openAt(page, 'journal');
  await openAt(page, 'organ');
  await page.evaluate(() => {
    for (const note of ['E', 'G', 'C']) document.querySelector(`[data-note="${note}"]`).click();
    document.getElementById('clearNotes').click();
  });
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__vesper.state.organSolved), false, 'Clearing notes must cancel the queued melody result');
  assert.match(await page.locator('#playedNotes').textContent(), /· · ·/);
  await page.evaluate(() => {
    for (const note of ['E', 'G', 'C']) document.querySelector(`[data-note="${note}"]`).click();
    document.getElementById('panelClose').click();
    window.__vesper.interact('organ');
  });
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__vesper.state.organSolved), false, 'Closing and reopening the organ must cancel its old result');
  assert.match(await page.locator('#playedNotes').textContent(), /· · ·/);
  console.log('PASS clear-notes and close/reopen both invalidate delayed organ answers');

  await closePanel(page);
  await page.locator('#settingsButton').click();
  await page.locator('#resetButton').click();
  await page.locator('#confirmReset').click();
  await expectState(page, 'journalRead', false);
}

async function touchMovementAndPause(page, context) {
  const cdp = await context.newCDPSession(page);
  const joystick = page.locator('#joystick');
  await joystick.waitFor({ state: 'visible' });
  const box = await joystick.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const touch = async (type, points = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const point = y => [{ x, y, id: 1, radiusX: 1, radiusY: 1, force: 1 }];
  await page.evaluate(() => window.__vesper.player.position.set(0, 0, 10));
  await touch('touchStart', point(y));
  await touch('touchMove', point(y - 32));
  await page.waitForFunction(() => window.__vesper.player.position.z < 9.65, null, { timeout: 15000 });
  await touch('touchEnd');
  const stopped = await page.evaluate(() => window.__vesper.player.position.z);
  await page.waitForTimeout(450);
  assert.ok(Math.abs((await page.evaluate(() => window.__vesper.player.position.z)) - stopped) < 0.03, 'Releasing a real touch joystick must stop motion');

  await touch('touchStart', point(y));
  await touch('touchMove', point(y - 32));
  await page.waitForFunction(z => window.__vesper.player.position.z < z - 0.2, stopped, { timeout: 15000 });
  await page.evaluate(() => document.getElementById('journalButton').click());
  const paused = await page.evaluate(() => window.__vesper.player.position.z);
  await touch('touchEnd');
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.__vesper.player.position.z), paused, 'Opening a dialog pauses joystick movement');
  await closePanel(page);
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => window.__vesper.player.position.z), paused, 'Closing a dialog must not resume a stale touch input');
  await cdp.detach();
  console.log('PASS real touch joystick movement, release, pause and resume without drift');
}
(async () => {
  let browser;
  const errors = [];
  try {
    await waitForServer();
    const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser = await playwright.chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader'] });
    fs.mkdirSync(output, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(baseURL);
    await ready(page);
    await saveShot(page, 'landing-desktop');
    await begin(page);
    await inspectReturnAndCancellation(page);
    if (process.env.VESPER_TEST_FOCUSED === '1') {
      const focusedMobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const focusedMobile = await focusedMobileContext.newPage();
      focusedMobile.on('pageerror', error => errors.push(error.message));
      await focusedMobile.goto(baseURL);
      await ready(focusedMobile);
      await begin(focusedMobile);
      await touchMovementAndPause(focusedMobile, focusedMobileContext);
      assert.deepEqual(errors, []);
      await focusedMobileContext.close();
      await context.close();
      console.log('Vesper focused interaction regression passed.');
      return;
    }

    const initial = await page.evaluate(() => ({ x: window.__vesper.player.position.x, z: window.__vesper.player.position.z }));
    await page.keyboard.down('w');
    try {
      await page.waitForFunction(initial => {
        const p = window.__vesper.player.position;
        return Math.hypot(p.x - initial.x, p.z - initial.z) > 0.6;
      }, initial, { timeout: 15000 });
    } finally { await page.keyboard.up('w'); }
    console.log('PASS actual WASD motion');
    assert.equal(await page.evaluate(() => window.__vesper.interact('journal')), false, 'Cannot interact with remote props');
    assert.equal(await page.evaluate(() => window.__vesper.state.journalRead), false);
    const paths = await page.evaluate(() => {
      const qa = window.__vesper, step = 0.2, visited = new Set(), queue = [[0, 50]], targets = { journal: [-7, 10], organ: [-6, -11], mirror: [7, -6], altar: [0, -13], exit: [0, 15] };
      const reached = {};
      visited.add('0,50');
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const [ix, iz] = queue[cursor], x = ix * step, z = iz * step;
        for (const [id, p] of Object.entries(targets)) if (Math.hypot(x - p[0], z - p[1]) < 2.15) reached[id] = true;
        for (const [nx, nz] of [[ix + 1, iz], [ix - 1, iz], [ix, iz + 1], [ix, iz - 1]]) {
          const key = `${nx},${nz}`;
          if (!visited.has(key) && !qa.blocked(nx * step, nz * step)) { visited.add(key); queue.push([nx, nz]); }
        }
      }
      return { reached, cells: visited.size };
    });
    assert.deepEqual(Object.keys(paths.reached).sort(), ['altar', 'exit', 'journal', 'mirror', 'organ'], 'Each story prop needs a navigable approach from the start');
    console.log(`PASS walkable approaches to all five props (${paths.cells} reachable grid cells)`);

    await page.evaluate(() => window.__vesper.player.position.set(1, 0, 1.5));
    await page.keyboard.down('d');
    try { await page.waitForFunction(() => window.__vesper.player.position.x > 1.55, null, { timeout: 15000 }); await page.waitForTimeout(900); }
    finally { await page.keyboard.up('d'); }
    const collisionX = await page.evaluate(() => window.__vesper.player.position.x);
    assert.ok(collisionX > 1.2 && collisionX <= 1.71, `Pew collision must stop actual keyboard motion before x=1.71; got ${collisionX}`);
    await page.evaluate(() => window.__vesper.player.position.set(8, 0, 13.5));
    await page.keyboard.down('d');
    try { await page.waitForTimeout(1200); }
    finally { await page.keyboard.up('d'); }
    assert.ok((await page.evaluate(() => window.__vesper.player.position.x)) <= 8.15, 'Outer walls must stop keyboard motion');
    await page.evaluate(() => window.__vesper.player.position.set(0, 0, 8));
    console.log('PASS furniture and outer-wall collision under actual keyboard input');

    const avatar = page.locator('#playerAvatar .avatar-initial');
    const firstGrapheme = await page.evaluate(() => [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(document.getElementById('playerName').value)][0].segment);
    assert.equal((await avatar.textContent()).trim(), firstGrapheme, 'Default human avatar uses the first name grapheme');
    const presence = page.locator('#playerAvatar .presence-dot');
    assert.equal(await presence.getAttribute('data-connected'), 'true');
    assert.equal(await presence.getAttribute('aria-label'), '在线 / Online');
    assert.equal(await presence.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(36, 151, 107)');
    console.log('PASS shared avatar initial and green online presence');
    await saveShot(page, 'gameplay-desktop');

    await openAt(page, 'journal', true);
    await expectState(page, 'journalRead');
    assert.match(await page.locator('dialog[open]').textContent(), /E、G、C|E.*G.*C/);
    await openAt(page, 'organ');
    for (const note of ['C', 'C', 'C']) await page.locator(`[data-note="${note}"]`).click();
    await page.waitForFunction(() => document.getElementById('panelBody').textContent.includes('机关没有回应'));
    assert.equal(await page.evaluate(() => window.__vesper.state.organSolved), false);
    await closePanel(page);
    await openAt(page, 'organ');
    for (const note of ['E', 'G', 'C']) await page.locator(`[data-note="${note}"]`).click();
    await expectState(page, 'organSolved');
    console.log('PASS journal and organ UI, including a wrong melody retry');

    await page.reload();
    await ready(page);
    await expectState(page, 'organSolved');
    await begin(page);
    console.log('PASS saved puzzle state survives reload');

    await openAt(page, 'mirror');
    await expectState(page, 'lensInstalled');
    await page.locator('[data-angle="30"]').click();
    assert.equal(await page.evaluate(() => window.__vesper.state.beamAligned), false);
    await closePanel(page);
    await openAt(page, 'mirror');
    await page.locator('[data-angle="60"]').click();
    await expectState(page, 'beamAligned');
    await saveShot(page, 'light-aligned');
    await openAt(page, 'altar');
    await expectState(page, 'keyTaken');
    await openAt(page, 'exit');
    await expectState(page, 'escaped');
    assert.match(await page.locator('dialog[open]').textContent(), /奶龙胜利/);
    await saveShot(page, 'ending');
    console.log('PASS reflector, altar, exit and named winner');

    await closePanel(page);
    await page.locator('#journalButton').click();
    assert.match(await page.locator('dialog[open]').textContent(), /手记|笔记/);
    await closePanel(page);
    await page.locator('#settingsButton').click();
    await page.locator('#panelClose').waitFor();
    await closePanel(page);

    // Corrupt only this game's save, discovered by its canonical puzzle field.
    const saveKeys = await page.evaluate(() => Object.keys(localStorage).filter(key => {
      const value = localStorage.getItem(key) || '';
      return /vesper/i.test(key) && /journalRead/.test(value);
    }));
    assert.ok(saveKeys.length, 'The chapter must persist its progress in localStorage');
    await page.evaluate(keys => keys.forEach(key => localStorage.setItem(key, '{malformed')), saveKeys);
    await page.reload();
    await ready(page);
    assert.equal(await page.evaluate(() => window.__vesper.state.journalRead), false);
    assert.equal(await page.evaluate(() => window.__vesper.state.escaped), false);
    console.log('PASS malformed save recovers safely');

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobile = await mobileContext.newPage();
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(baseURL);
    await ready(mobile);
    for (const width of [320, 390]) {
      await mobile.setViewportSize({ width, height: width === 320 ? 740 : 844 });
      await noOverflow(mobile);
      await saveShot(mobile, `landing-mobile-${width}`);
    }
    await begin(mobile);
    await touchMovementAndPause(mobile, mobileContext);
    await noOverflow(mobile);
    await openAt(mobile, 'journal');
    await noOverflow(mobile);
    await saveShot(mobile, 'journal-mobile');
    await closePanel(mobile);
    await saveShot(mobile, 'gameplay-mobile');
    console.log('PASS mobile landing, gameplay and dialog bounds');
    assert.deepEqual(errors, [], 'Browser should have no script or console errors');
    console.log('Vesper browser regression passed. Screenshots: test-results/vesper-*.png');
    await mobileContext.close();
    await context.close();
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });





