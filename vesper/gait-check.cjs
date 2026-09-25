/* Focused locomotion verification for the authored Nailong rig.
 * Usage: node vesper/gait-check.cjs [http://127.0.0.1:18760/vesper.html?qa=1]
 * Reads the live module and tests a fresh GLB export; does not rewrite assets.
 */
const path = require('node:path');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.resolve(path.dirname(process.execPath), '../node_modules/playwright')); }

(async () => {
  const browser = await playwright.chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  const page = await browser.newPage({viewport: {width: 1000, height: 760}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(process.argv[2] || 'http://127.0.0.1:18760/vesper.html?qa=1');
    await page.waitForFunction(() => window.__vesper, {timeout: 30000});
    const result = await page.evaluate(async () => {
      const THREE = await import('./vesper/vendor/three.module.js');
      const {createNailong} = await import('./vesper/character.js');
      window.requestAnimationFrame = () => 0;
      const model = createNailong();
      const walk = model.animations.find(clip => clip.name === 'Walk');
      if (!walk || !model.gait) throw Error('The character must provide Walk and gait metadata');
      const {period, stance, travel, referenceSpeed} = model.gait;
      if (![period, stance, travel, referenceSpeed].every(Number.isFinite)) throw Error('Non-finite gait metadata');
      const joints = model.joints;
      for (const name of ['leftLeg', 'rightLeg', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'])
        if (!joints[name]) throw Error('Missing gait joint: ' + name);
      const isVisible = object => {
        for (let current = object; current; current = current.parent) if (!current.visible) return false;
        return true;
      };
      const organic = model.organicMesh && model.soleSamples;
      const footSources = (leg, side) => {
        if (organic) {
          const mesh = model.organicMesh, indices = Array.from(model.soleSamples[side] || []);
          if (!mesh.isSkinnedMesh || !isVisible(mesh)) throw Error('Organic foot source must be the visible skinned surface');
          if (!indices.length || indices.some(index => !Number.isInteger(index) || index < 0 || index >= mesh.geometry.attributes.position.count))
            throw Error('Invalid organic sole samples: ' + side);
          return [{mesh, indices}];
        }
        const sources = [];
        leg.traverseVisible(object => {
          if (object.isMesh && /foot|feet|toe/i.test(object.name)) sources.push({mesh: object, indices: null});
        });
        if (!sources.length) throw Error('No visible foot geometry below ' + leg.name);
        return sources;
      };
      const leftFeet = footSources(joints.leftLeg, 'left'), rightFeet = footSources(joints.rightLeg, 'right');
      const vertex = new THREE.Vector3();
      function matrices() {
        model.root.updateMatrixWorld(true);
        model.root.traverse(object => { if (object.isSkinnedMesh) object.skeleton.update(); });
      }
      function minimumY(sources) {
        let minimum = Infinity;
        for (const {mesh, indices} of sources) {
          const count = indices ? indices.length : mesh.geometry.attributes.position.count;
          for (let sample = 0; sample < count; sample++) {
            const index = indices ? indices[sample] : sample;
            mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld);
            if (![vertex.x, vertex.y, vertex.z].every(Number.isFinite)) throw Error('Non-finite animated foot vertex');
            minimum = Math.min(minimum, vertex.y);
          }
        }
        return minimum;
      }
      function clipLoopError(clips) {
        let maximum = 0;
        for (const clip of clips) for (const track of clip.tracks) {
          const size = track.getValueSize(), values = track.values;
          if (![...values].every(Number.isFinite)) throw Error('Non-finite animation track ' + track.name);
          for (let component = 0; component < size; component++)
            maximum = Math.max(maximum, Math.abs(values[component] - values[values.length - size + component]));
        }
        return maximum;
      }
      model.mixer.stopAllAction();
      model.mixer.clipAction(walk).reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      const stats = {
        frames: 240, minY: Infinity, maxUnsupportedY: -Infinity,
        maxStanceError: 0, leftSwingPeak: 0, rightSwingPeak: 0,
        leftAngleMin: Infinity, leftAngleMax: -Infinity,
        rightAngleMin: Infinity, rightAngleMax: -Infinity,
        headPitchMin: Infinity, headPitchMax: -Infinity,
        headLocalPitchMin: Infinity, headLocalPitchMax: -Infinity,
        kneeFlexMin: Infinity, kneeFlexMax: -Infinity
      };
      for (let frame = 0; frame < stats.frames; frame++) {
        const phase = frame / stats.frames;
        model.mixer.setTime(phase * period);
        matrices();
        const leftY = minimumY(leftFeet), rightY = minimumY(rightFeet);
        stats.minY = Math.min(stats.minY, leftY, rightY);
        stats.maxUnsupportedY = Math.max(stats.maxUnsupportedY, Math.min(leftY, rightY));
        for (const [localPhase, y, key] of [
          [phase, leftY, 'leftSwingPeak'], [(phase + .5) % 1, rightY, 'rightSwingPeak']
        ]) {
          if (localPhase > .025 && localPhase < stance - .025)
            stats.maxStanceError = Math.max(stats.maxStanceError, Math.abs(y));
          if (localPhase > stance + .025 && localPhase < .975) stats[key] = Math.max(stats[key], y);
        }
        stats.leftAngleMin = Math.min(stats.leftAngleMin, joints.leftLeg.rotation.x);
        stats.leftAngleMax = Math.max(stats.leftAngleMax, joints.leftLeg.rotation.x);
        stats.rightAngleMin = Math.min(stats.rightAngleMin, joints.rightLeg.rotation.x);
        stats.rightAngleMax = Math.max(stats.rightAngleMax, joints.rightLeg.rotation.x);
        const faceForward = new THREE.Vector3(0, 0, 1).applyQuaternion(joints.head.getWorldQuaternion(new THREE.Quaternion()));
        const headPitch = Math.atan2(-faceForward.y, Math.hypot(faceForward.x, faceForward.z));
        stats.headPitchMin = Math.min(stats.headPitchMin, headPitch);
        stats.headPitchMax = Math.max(stats.headPitchMax, headPitch);
        stats.headLocalPitchMin = Math.min(stats.headLocalPitchMin, joints.head.rotation.x);
        stats.headLocalPitchMax = Math.max(stats.headLocalPitchMax, joints.head.rotation.x);
        for (const knee of [joints.leftKnee, joints.rightKnee]) {
          stats.kneeFlexMin = Math.min(stats.kneeFlexMin, knee.rotation.x);
          stats.kneeFlexMax = Math.max(stats.kneeFlexMax, knee.rotation.x);
        }
      }
      // Track one fixed underside patch, not the changing lowest vertex. This
      // separates actual sliding from the contact point rolling along the sole.
      const patchSource = leftFeet.find(source => /continuous/i.test(source.mesh.name)) || leftFeet[0];
      const patchMesh = patchSource.mesh, positions = patchMesh.geometry.attributes.position;
      const leftIndices = patchSource.indices || Array.from({length: positions.count}, (_, index) => index);
      let lowestBindY = Infinity;
      for (const index of leftIndices) lowestBindY = Math.min(lowestBindY, positions.getY(index));
      const patchIndices = leftIndices.filter(index => positions.getY(index) < lowestBindY + .020);
      if (!patchIndices.length) throw Error('No fixed sole patch available');
      const supportPatchZ = [];
      for (let sample = 0; sample <= 12; sample++) {
        const phase = .07 + (stance - .14) * sample / 12;
        const time = phase * period;
        model.root.position.z = referenceSpeed * time;
        model.mixer.setTime(time);
        matrices();
        let z = 0;
        for (const index of patchIndices) {
          patchMesh.getVertexPosition(index, vertex).applyMatrix4(patchMesh.matrixWorld);
          z += vertex.z;
        }
        supportPatchZ.push(z / patchIndices.length);
      }
      const supportDrift = Math.max(...supportPatchZ) - Math.min(...supportPatchZ);
      const runtime = createNailong();
      const dt = 1 / 120;
      for (let frame = 0; frame < 120; frame++) runtime.update(dt, {moving: true, speed: referenceSpeed});
      let previousPhase = runtime.gait.phase, cycles = 0, steps = 0;
      const runtimeFrames = Math.round(period * 3 / dt);
      for (let frame = 0; frame < runtimeFrames; frame++) {
        runtime.update(dt, {moving: true, speed: referenceSpeed});
        const phase = runtime.gait.phase;
        if (!Number.isFinite(phase) || phase < 0 || phase >= 1.000001) throw Error('gait.phase must be normalized');
        const increment = (phase - previousPhase + 1) % 1;
        if (increment > .1) throw Error('Gait phase skipped backward or jumped');
        cycles += increment;
        previousPhase = phase;
        if (!Array.isArray(runtime.gait.stepEvents)) throw Error('stepEvents must be an array');
        steps += runtime.gait.stepEvents.length;
      }
      // Check the actual glTF binary animation accessors after fresh export.
      const base64 = await window.__vesper.exportGLB('character');
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const view = new DataView(bytes.buffer);
      if (view.getUint32(0, true) !== 0x46546c67) throw Error('Character export is not a GLB');
      const jsonLength = view.getUint32(12, true);
      const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).trim());
      const binaryStart = 20 + jsonLength + 8;
      const componentCount = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4};
      let exportedLoopError = 0, exportedTracks = 0;
      for (const animation of gltf.animations || []) for (const sampler of animation.samplers) {
        const accessor = gltf.accessors[sampler.output], bufferView = gltf.bufferViews[accessor.bufferView];
        if (accessor.componentType !== 5126) throw Error('Unexpected animation component type');
        const size = componentCount[accessor.type];
        const stride = bufferView.byteStride || size * 4;
        const offset = binaryStart + (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        for (let component = 0; component < size; component++) {
          const first = view.getFloat32(offset + component * 4, true);
          const last = view.getFloat32(offset + (accessor.count - 1) * stride + component * 4, true);
          exportedLoopError = Math.max(exportedLoopError, Math.abs(first - last));
        }
        exportedTracks++;
      }
      const report = {
        gait: {period, stance, travel, referenceSpeed}, walkDuration: walk.duration,
        soleSource: organic ? 'visible unified skin' : 'visible separate feet',
        soleSamples: {left: leftFeet.reduce((count, source) => count + (source.indices ? source.indices.length : source.mesh.geometry.attributes.position.count), 0),
          right: rightFeet.reduce((count, source) => count + (source.indices ? source.indices.length : source.mesh.geometry.attributes.position.count), 0)},
        ...stats, supportDrift, supportPatchVertices: patchIndices.length,
        runtime: {seconds: runtimeFrames * dt, cycles, expectedCycles: runtimeFrames * dt / period, steps},
        clipLoopError: clipLoopError(model.animations),
        glb: {bytes: bytes.length, clips: (gltf.animations || []).map(a => a.name), tracks: exportedTracks, loopError: exportedLoopError}
      };
      model.dispose(); runtime.dispose();
      return report;
    });
    console.log(JSON.stringify(result, null, 2));
    assert.ok(Math.abs(result.walkDuration - result.gait.period) < 1e-5, 'Walk duration must match gait period');
    assert.ok(result.minY > -.012, 'Feet penetrate the floor: ' + result.minY);
    assert.ok(result.maxStanceError < .015, 'Support foot fails to contact floor: ' + result.maxStanceError);
    assert.ok(result.maxUnsupportedY < .015, 'Both feet leave the floor: ' + result.maxUnsupportedY);
    for (const key of ['leftSwingPeak', 'rightSwingPeak'])
      assert.ok(result[key] > .025 && result[key] < .10, 'Swing clearance out of range: ' + key + ' = ' + result[key]);
    for (const side of ['left', 'right']) {
      assert.ok(result[side + 'AngleMin'] < -.28 && result[side + 'AngleMax'] > .25, 'Leg excursion remains too small: ' + side);
      assert.ok(result[side + 'AngleMax'] - result[side + 'AngleMin'] > .57, 'Leg swing must exceed previous 0.47 rad range');
    }
    assert.ok(result.headPitchMin > .14, 'Walk needs the requested downward head posture');
    assert.ok(result.supportDrift < .030, 'Planted sole slides too far: ' + result.supportDrift);
    assert.ok(Math.abs(result.runtime.cycles - result.runtime.expectedCycles) < .04, 'Speed mapping changes the intended cadence');
    assert.ok(result.runtime.steps >= 5 && result.runtime.steps <= 7, 'Expected about six footfall events across three cycles');
    assert.ok(result.clipLoopError < 1e-5, 'Authored clip endpoints are discontinuous');
    assert.ok(result.glb.loopError < 1e-5, 'Exported GLB clip endpoints are discontinuous');
    assert.deepEqual(result.glb.clips.slice().sort(), ['Idle', 'Walk']);
    assert.ok(result.glb.tracks > 0, 'Exported GLB contains no animation channels');
    assert.deepEqual(errors, [], 'Browser script errors');
    console.log('PASS gait range, stance contact, swing clearance, planted-foot drift, cadence, footfalls and portable GLB loops');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
