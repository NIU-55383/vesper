import * as THREE from 'three';

/**
 * A hand-built, real-time interpretation of Kensington United Reformed Church.
 * Measurements are compositional estimates from the supplied photographs, not a survey.
 * All material images are generated locally; no remote images or tracking requests.
 */
export function buildChurch(scene) {
  const world = new THREE.Group();
  world.name = 'Kensington / Vesper sanctuary';
  scene.add(world);
  scene.background = new THREE.Color('#17141d');
  scene.fog = new THREE.FogExp2('#423449', 0.014);
  const colliders = [];
  const naturalShafts = [], windowLights = [], curtainPanels = [], corridorLights = [];
  const batches = new Map();
  const dummy = new THREE.Object3D();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeometry = new THREE.SphereGeometry(1, 12, 8);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 14);
  let seed = 372841;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  function texture(draw, size = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas.getContext('2d'), size);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
    return map;
  }
  const plasterMap = texture((ctx, s) => {
    ctx.fillStyle = '#b6a8bb'; ctx.fillRect(0, 0, s, s);
    for (let n = 0; n < 7600; n++) {
      const radius = random() * 18 + 1, x = random() * s, y = random() * s;
      const alpha = random() * 0.09;
      ctx.fillStyle = `rgba(${random() > .4 ? '49,31,62' : '227,218,225'},${alpha})`;
      ctx.beginPath(); ctx.ellipse(x, y, radius * .6, radius, random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 45; i++) {
      let x = random() * s, y = random() * s;
      ctx.strokeStyle = 'rgba(34,22,39,.12)'; ctx.lineWidth = .3 + random();
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let n = 0; n < 7; n++) { x += (random() - .5) * 10; y += random() * 13; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  const woodMap = texture((ctx, s) => {
    ctx.fillStyle = '#62524e'; ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 2) {
      ctx.strokeStyle = `rgba(${random() > .55 ? '173,133,94' : '27,17,20'},${random() * .16})`;
      ctx.lineWidth = random() * 3 + .3; ctx.beginPath(); ctx.moveTo(x, 0);
      for (let y = 0; y <= s; y += 24) ctx.lineTo(x + Math.sin(y * .009 + x) * 3 + random() * 2, y);
      ctx.stroke();
    }
    for (let i = 0; i < 28; i++) {
      const x = random() * s, y = random() * s;
      ctx.strokeStyle = 'rgba(20,13,17,.24)'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.ellipse(x, y, 3 + random() * 6, 20 + random() * 70, 0, 0, Math.PI * 2); ctx.stroke();
    }
  });
  const parquetMap = texture((ctx, s) => {
    ctx.fillStyle = '#241e25'; ctx.fillRect(0, 0, s, s);
    const w = 64, h = 256;
    for (let x = -w; x < s + w; x += w) for (let y = -h; y < s + h; y += h) {
      const yy = y + ((x / w) % 2 ? h / 2 : 0);
      const v = random() * 24;
      ctx.fillStyle = `rgb(${69 + v},${57 + v},${57 + v})`; ctx.fillRect(x + 1, yy + 1, w - 2, h - 2);
      for (let k = 0; k < 22; k++) {
        ctx.strokeStyle = `rgba(${random() > .5 ? '200,171,139' : '9,7,12'},${.025 + random() * .1})`;
        ctx.beginPath(); const xx = x + random() * w; ctx.moveTo(xx, yy);
        ctx.bezierCurveTo(xx + 2, yy + 80, xx - 3, yy + 160, xx, yy + h); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(3,2,5,.34)'; ctx.fillRect(x + 8, yy + 7, 2, 2); ctx.fillRect(x + w - 10, yy + h - 9, 2, 2);
    }
  });
  parquetMap.repeat.set(3, 5.2);
  const roughnessMap = texture((ctx, s) => {
    ctx.fillStyle = '#aaa'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 6000; i++) { const v = 80 + random() * 160; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(random() * s, random() * s, random() * 15 + 1, random() * 25 + 1); }
  }, 512);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  const mat = {
    plaster: new THREE.MeshStandardMaterial({ color: '#a89ab5', map: plasterMap, bumpMap: plasterMap, bumpScale: .036, roughness: .94 }),
    shadowPlaster: new THREE.MeshStandardMaterial({ color: '#6f5e79', map: plasterMap, bumpMap: plasterMap, bumpScale: .035, roughness: .95 }),
    moulding: new THREE.MeshStandardMaterial({ color: '#c1b5c5', map: plasterMap, bumpMap: plasterMap, bumpScale: .018, roughness: .83 }),
    wood: new THREE.MeshStandardMaterial({ color: '#b4a097', map: woodMap, roughnessMap, roughness: .84, bumpMap: woodMap, bumpScale: .025 }),
    woodEdge: new THREE.MeshStandardMaterial({ color: '#b39582', map: woodMap, roughness: .75 }),
    darkWood: new THREE.MeshStandardMaterial({ color: '#806d75', map: woodMap, roughness: .85 }),
    floor: new THREE.MeshStandardMaterial({ color: '#b6abb2', map: parquetMap, roughnessMap, roughness: .66, bumpMap: parquetMap, bumpScale: .022 }),
    brass: new THREE.MeshStandardMaterial({ color: '#9f7d53', metalness: .72, roughness: .37 }),
    blackMetal: new THREE.MeshStandardMaterial({ color: '#29282e', metalness: .68, roughness: .57 }),
    stone: new THREE.MeshStandardMaterial({ color: '#7a7184', map: plasterMap, bumpMap: plasterMap, bumpScale: .03, roughness: .9 }),
    felt: new THREE.MeshStandardMaterial({ color: '#443046', roughness: 1 }),
    ivory: new THREE.MeshStandardMaterial({ color: '#d7ceb4', roughness: .6 }),
    wax: new THREE.MeshStandardMaterial({ color: '#bca894', roughness: .8 }),
    cross: new THREE.MeshStandardMaterial({ color: '#352b34', map: woodMap, metalness: .03, roughness: .65 }),
  };
  function instance(geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const key = geometry.uuid + material.uuid;
    if (!batches.has(key)) batches.set(key, { geometry, material, matrices: [] });
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(rx, ry, rz); dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  const box = (m, x, y, z, w, h, d, ry = 0) => instance(boxGeometry, m, x, y, z, w, h, d, 0, ry);
  const ball = (m, x, y, z, sx, sy = sx, sz = sx, rz = 0) => instance(sphereGeometry, m, x, y, z, sx, sy, sz, 0, 0, rz);
  const cylinder = (m, x, y, z, r, h, ry = 0) => instance(cylinderGeometry, m, x, y, z, r, h, r, 0, ry);
  function mesh(geometry, material, parent = world) {
    const object = new THREE.Mesh(geometry, material); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function directBox(parent, m, x, y, z, w, h, d) {
    const object = mesh(boxGeometry, m, parent); object.position.set(x, y, z); object.scale.set(w, h, d); return object;
  }
  function collision(x, z, w, d) { colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }); }
  function torus(m, x, y, z, r, tube = .03, rx = 0, ry = 0, parent = world) {
    const object = mesh(new THREE.TorusGeometry(r, tube, 6, 20), m, parent); object.position.set(x, y, z); object.rotation.set(rx, ry, 0); return object;
  }
  function line(points, color, opacity = 1) {
    const o = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })); world.add(o); return o;
  }

  // Room envelope: a broad classical chapel, with real openings in the upper walls.
  box(mat.floor, 0, -.13, 0, 18.5, .25, 32.5);
  box(mat.shadowPlaster, 0, 13.18, 0, 18.6, .4, 32.7);
  box(mat.plaster, 0, 6.5, -16.15, 18.5, 13, .35);
  box(mat.plaster, -5.25, 6.5, 16.15, 7.5, 13, .35);
  box(mat.plaster, 5.25, 6.5, 16.15, 7.5, 13, .35);
  box(mat.plaster, 0, 8.5, 16.15, 3, 9, .35);
  const windowZ = [-11.6, -5.8, 0, 5.8, 11.6];
  for (const side of [-1, 1]) {
    // Actual openings: the accessible stained window on the left and archive door on the right.
    const openingZ = side < 0 ? 0 : -7.4, openingHalf = side < 0 ? 1.25 : 1.2;
    const start = -16.3, end = 16.3, lo = openingZ - openingHalf, hi = openingZ + openingHalf;
    box(mat.plaster, side * 9.15, 3.4, (start + lo) / 2, .35, 6.8, lo - start);
    box(mat.plaster, side * 9.15, 3.4, (hi + end) / 2, .35, 6.8, end - hi);
    const lintelStart = side < 0 ? 4.65 : 3.6;
    box(mat.plaster, side * 9.15, (6.8 + lintelStart) / 2, openingZ, .35, 6.8 - lintelStart, openingHalf * 2);
    if (side < 0) box(mat.plaster, -9.15, .65, 0, .35, 1.3, 2.5);
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-16.3, 6.8); wallShape.lineTo(16.3, 6.8); wallShape.lineTo(16.3, 13.2); wallShape.lineTo(-16.3, 13.2); wallShape.closePath();
    for (const z of windowZ) {
      const hole = new THREE.Path(); hole.moveTo(z - 1.1, 7.1); hole.lineTo(z + 1.1, 7.1); hole.lineTo(z + 1.1, 10.45);
      hole.absarc(z, 10.45, 1.1, 0, Math.PI, false); hole.lineTo(z - 1.1, 7.1); wallShape.holes.push(hole);
    }
    const wall = mesh(new THREE.ExtrudeGeometry(wallShape, { depth: .35, bevelEnabled: false, curveSegments: 24 }), mat.plaster);
    wall.rotation.y = Math.PI / 2; wall.position.x = side * 9.0;
    // Skirting and low wainscot mouldings; damp staining is in the plaster map.
    for (const [y, h, d] of [[.12, .24, .18], [.36, .08, .1], [2.45, .06, .08], [4.82, .15, .18]]) {
      if ((side > 0 && y < 3.6) || (side < 0 && y > 1.3 && y < 4.65)) {
        box(mat.moulding, side * 8.87, y, (start + lo) / 2, d, h, lo - start);
        box(mat.moulding, side * 8.87, y, (hi + end) / 2, d, h, end - hi);
      } else box(mat.moulding, side * 8.87, y, 0, d, h, 32.1);
    }
    for (let z = -14.6; z <= 14.6; z += 2.9) {
      if (Math.abs(z + 1.37 - openingZ) < openingHalf + 1.35) continue;
      box(mat.moulding, side * 8.86, 1.37, z, .04, 1.65, .045);
      box(mat.moulding, side * 8.86, .56, z + 1.37, .04, .045, 2.7);
      box(mat.moulding, side * 8.86, 2.2, z + 1.37, .04, .045, 2.7);
    }
  }
  // Front wall inset, tall pilasters, entablature and prominent wooden cross.
  box(mat.shadowPlaster, 0, 6.7, -15.88, 9.3, 10.4, .06);
  for (const x of [-4.8, 4.8]) {
    box(mat.moulding, x, 5.9, -15.6, .94, 9.65, .45);
    box(mat.shadowPlaster, x, 5.9, -15.34, .65, 8.9, .025);
    for (let f = -2; f <= 2; f++) box(mat.moulding, x + f * .13, 5.75, -15.26, .065, 8.35, .1);
    for (const [y, w, h, d] of [[.2, 1.5, .4, .9], [.5, 1.3, .18, .7], [.68, 1.05, .18, .6], [10.3, 1.24, .16, .7], [11.03, 1.5, .2, .72]]) box(mat.moulding, x, y, -15.46, w, h, d);
    // Acanthus leaf clusters and corner volutes make recognizable Corinthian capitals.
    for (let tier = 0; tier < 2; tier++) for (let n = 0; n < 7; n++) {
      const a = n * Math.PI * 2 / 7;
      ball(mat.moulding, x + Math.cos(a) * (.43 + tier * .09), 10.49 + tier * .25, -15.34 + Math.sin(a) * .2, .14, .26, .12, Math.cos(a) * -.45);
      ball(mat.shadowPlaster, x + Math.cos(a) * (.44 + tier * .1), 10.57 + tier * .25, -15.18 + Math.sin(a) * .13, .033, .17, .025, Math.cos(a) * -.45);
    }
    for (const dx of [-.53, .53]) torus(mat.moulding, x + dx, 10.91, -15.13, .145, .052);
  }
  for (const [y, h, d] of [[11.22, .15, .6], [11.48, .34, .36], [11.75, .14, .58], [11.93, .1, .73]]) box(mat.moulding, 0, y, -15.56, 17.85, h, d);
  for (let x = -8.6; x <= 8.6; x += .36) box(mat.moulding, x, 11.66, -15.21, .16, .18, .2);
  box(mat.cross, 0, 7.1, -15.38, .33, 5.05, .26);
  box(mat.cross, 0, 8.2, -15.38, 3.22, .33, .26);
  // Slight burnished edge catches the side light without turning the cross into a lamp.
  box(mat.woodEdge, -.158, 7.1, -15.23, .015, 5.02, .016);

  // Deep ceiling coffers, cornices and dentils.
  for (const side of [-1, 1]) {
    for (const [x, y, w, h] of [[8.7, 12.25, .52, .18], [8.56, 12.46, .68, .14], [8.37, 12.61, .93, .12]]) box(mat.moulding, side * x, y, 0, w, h, 32.2);
    for (let z = -15.6; z < 15.9; z += .4) box(mat.moulding, side * 8.47, 12.23, z, .27, .21, .19);
  }
  for (let z = -12.8; z < 15; z += 6.4) {
    box(mat.moulding, 0, 12.9, z, 15.9, .18, .2);
    for (const side of [-1, 1]) box(mat.moulding, side * 7.7, 12.92, z, .15, .12, 5.5);
    for (const dz of [-2.8, 2.8]) box(mat.moulding, 0, 12.89, z + dz, 15.5, .12, .1);
    torus(mat.moulding, 0, 12.77, z, .32, .065, Math.PI / 2);
    cylinder(mat.moulding, 0, 12.79, z, .16, .09);
  }
  // Arched plaster braces beneath flat transversal beams, as in the reference photographs.
  for (const z of [-8.9, 0, 8.9]) {
    box(mat.moulding, 0, 11.82, z, 18, .27, .32);
    for (const side of [-1, 1]) {
      const brace = new THREE.Shape(); brace.moveTo(0, 0); brace.lineTo(3.8, 0); brace.bezierCurveTo(1.6, -.1, .35, -1.02, .25, -3.02); brace.lineTo(0, -3.12); brace.closePath();
      const object = mesh(new THREE.ExtrudeGeometry(brace, { depth: .36, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .035, bevelThickness: .03, curveSegments: 28 }), mat.moulding);
      object.position.set(side * 8.98, 11.72, z - .18); object.scale.x = -side;
      box(mat.moulding, side * 8.82, 8.67, z, .4, .2, .52);
      for (const x of [5.65, 7.15]) {
        torus(mat.shadowPlaster, side * x, 11.28, z + .22, .2, .038);
        ball(mat.moulding, side * x, 11.28, z + .22, .08, .08, .04);
      }
    }
    for (const x of [-4.8, 4.8]) { box(mat.moulding, x, 11.55, z, .31, .35, .45); ball(mat.moulding, x, 11.29, z, .18, .25, .18); }
  }

  // Galleries: ornamental balusters, panelled fascia, corbels and slim supporting columns.
  const balusterProfile = [[.075, 0], [.09, .04], [.09, .1], [.052, .13], [.042, .19], [.09, .28], [.085, .34], [.045, .41], [.035, .58], [.072, .64], [.085, .66], [.085, .72]].map(p => new THREE.Vector2(...p));
  const balusterGeometry = new THREE.LatheGeometry(balusterProfile, 10);
  for (const side of [-1, 1]) {
    box(mat.darkWood, side * 7.2, 5.05, .15, 3.75, .3, 28.5);
    box(mat.moulding, side * 5.35, 4.91, .15, .3, .45, 28.7);
    box(mat.moulding, side * 5.25, 5.2, .15, .42, .16, 28.8);
    box(mat.moulding, side * 5.29, 6.12, .15, .35, .16, 28.8);
    box(mat.woodEdge, side * 5.29, 6.23, .15, .4, .07, 28.8);
    for (let z = -13.82; z < 14.4; z += .39) instance(balusterGeometry, mat.moulding, side * 5.29, 5.28, z);
    for (let z = -13.8; z < 14.5; z += 2.8) {
      box(mat.moulding, side * 5.28, 5.64, z, .23, 1.03, .23);
      box(mat.moulding, side * 5.28, 6.14, z, .36, .18, .35);
      box(mat.shadowPlaster, side * 5.17, 4.91, z + 1.4, .06, .18, 1.99);
      for (const dz of [-.68, .68]) ball(mat.moulding, side * 5.12, 4.94, z + 1.4 + dz, .04, .11, .11);
    }
    for (const z of [-12.8, -6.4, 0, 6.4, 12.8]) {
      cylinder(mat.moulding, side * 5.7, 2.52, z, .13, 4.65);
      cylinder(mat.moulding, side * 5.7, .23, z, .23, .3);
      cylinder(mat.moulding, side * 5.7, 4.7, z, .25, .14);
      box(mat.moulding, side * 5.7, 4.79, z, .61, .14, .55);
      box(mat.moulding, side * 5.7, .06, z, .49, .12, .49);
      collision(side * 5.7, z, .4, .4);
    }
    for (const x of [6.3, 7.4, 8.45]) {
      box(mat.darkWood, side * x, 5.26 + (x - 6.3) * .32, .4, .8, .16, 26.5);
      box(mat.wood, side * (x + .3), 5.67 + (x - 6.3) * .32, .4, .15, .72, 26.5);
    }
  }
  // Rear balcony joins the two galleries above the entry, leaving a full-height nave.
  box(mat.darkWood, 0, 5.05, 14.8, 18, .3, 2.5);
  box(mat.moulding, 0, 4.95, 13.6, 10.4, .4, .28);
  box(mat.moulding, 0, 5.26, 13.6, 10.5, .16, .38);
  box(mat.moulding, 0, 6.12, 13.6, 10.5, .16, .34);
  for (let x = -5; x <= 5; x += .39) instance(balusterGeometry, mat.moulding, x, 5.3, 13.6);

  // Upper windows use round heads, clear antique glazing and fine leaded subdivisions.
  const glassMap = texture((ctx, s) => {
    const grd = ctx.createLinearGradient(0, 0, s, s); grd.addColorStop(0, '#cfccdf'); grd.addColorStop(.5, '#8b869f'); grd.addColorStop(1, '#626377'); ctx.fillStyle = grd; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2000; i++) { ctx.fillStyle = `rgba(36,28,52,${random() * .14})`; ctx.fillRect(random() * s, random() * s, random() * 12, random() * 5); }
  }, 512);
  const glassMat = new THREE.MeshStandardMaterial({ color: '#bbb3cb', map: glassMap, emissive: '#a5a2c0', emissiveMap: glassMap, emissiveIntensity: .4, roughness: .38, metalness: .13, side: THREE.DoubleSide });
  const windowFrameMaterial = new THREE.MeshStandardMaterial({ color: '#91879c', roughness: .7, metalness: .05 });
  for (const side of [-1, 1]) for (const z of windowZ) {
    const window = new THREE.Group(); world.add(window); window.position.set(side * 9.025, 7.1, z); window.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    const shape = new THREE.Shape(); shape.moveTo(-1.1, 0); shape.lineTo(1.1, 0); shape.lineTo(1.1, 3.35); shape.absarc(0, 3.35, 1.1, 0, Math.PI, false); shape.closePath();
    const glass = mesh(new THREE.ShapeGeometry(shape, 32), glassMat, window); glass.castShadow = false;
    for (const x of [-1.14, 1.14]) directBox(window, mat.moulding, x, 1.7, .08, .15, 3.5, .22);
    directBox(window, mat.moulding, 0, -.08, .12, 2.6, .2, .43);
    for (const x of [-.39, .39]) directBox(window, windowFrameMaterial, x, 2.03, .13, .035, 4.02, .05);
    for (const y of [.82, 1.63, 2.44, 3.3]) directBox(window, windowFrameMaterial, 0, y, .13, 2.17, .04, .055);
    const arch = mesh(new THREE.TorusGeometry(1.17, .095, 8, 32, Math.PI), mat.moulding, window); arch.position.set(0, 3.35, .09);
    const innerArch = mesh(new THREE.TorusGeometry(1.065, .027, 6, 32, Math.PI), windowFrameMaterial, window); innerArch.position.set(0, 3.35, .14);
    for (const a of [Math.PI / 4, Math.PI / 2, Math.PI * 3 / 4]) {
      const bar = directBox(window, windowFrameMaterial, Math.cos(a) * .52, 3.35 + Math.sin(a) * .52, .14, 1.04, .035, .05); bar.rotation.z = a;
    }
    // Window-sill drip stains and slim horizontal radiators underneath the gallery.
    for (let n = 0; n < 9; n++) box(mat.shadowPlaster, side * 8.96, 2.5, z - .85 + n * .21, .07, .8, .09);
    if (!(side > 0 && z === -5.8)) {
      box(mat.blackMetal, side * 8.73, .65, z, .13, .55, 1.9);
      for (let n = 0; n < 16; n++) box(mat.stone, side * 8.62, .65, z - .85 + n * .115, .13, .63, .046);
    }
  }

  // Pews have rolled top rails, raised panel backs, curved side cheeks and kneelers.
  const endShape = new THREE.Shape();
  endShape.moveTo(-.54, 0); endShape.lineTo(.47, 0); endShape.lineTo(.47, 1.6); endShape.bezierCurveTo(.46, 1.7, .22, 1.72, .19, 1.53); endShape.bezierCurveTo(.12, 1.19, -.16, 1.1, -.32, 1.08); endShape.lineTo(-.5, 1.08); endShape.lineTo(-.54, 0);
  const endGeometry = new THREE.ExtrudeGeometry(endShape, { depth: .14, bevelEnabled: true, bevelThickness: .025, bevelSize: .027, bevelSegments: 2, curveSegments: 16 });
  for (const side of [-1, 1]) for (let row = 0; row < 6; row++) {
    const x = side * 4.06, z = -4.5 + row * 3;
    box(mat.wood, x, .57, z, 3.88, .16, .81);
    box(mat.wood, x, 1.07, z + .41, 3.88, 1.02, .15);
    box(mat.woodEdge, x, 1.59, z + .41, 4.04, .115, .23);
    box(mat.woodEdge, x, .69, z - .39, 3.91, .055, .045);
    box(mat.darkWood, x, .19, z - .69, 3.52, .12, .26);
    box(mat.felt, x, .27, z - .69, 3.49, .075, .255);
    for (const dx of [-1.91, 1.78]) instance(endGeometry, mat.wood, x + dx, 0, z, 1, 1, 1, 0, -Math.PI / 2);
    for (let panel = 0; panel < 4; panel++) {
      const px = x - 1.45 + panel * .96;
      box(mat.darkWood, px, 1.08, z + .496, .8, .68, .035);
      for (const dx of [-.39, .39]) box(mat.woodEdge, px + dx, 1.08, z + .524, .024, .72, .038);
      for (const y of [.73, 1.43]) box(mat.woodEdge, px, y, z + .524, .78, .025, .035);
      box(mat.darkWood, px, .9, z + .61, .54, .15, .18);
      if ((panel + row) % 3 === 0) {
        box(mat.felt, px, .97, z + .6, .17, .21, .035);
        box(mat.ivory, px + .005, .974, z + .618, .125, .18, .013);
      }
    }
    collision(x, z + .02, 4.02, 1.15);
  }
  // A worn runner and the inlaid aisle border establish the axial perspective.
  for (const x of [-1.67, 1.67]) box(mat.brass, x, .006, 1.8, .018, .008, 27.2);
  const runner = new THREE.MeshStandardMaterial({ color: '#3d2e43', roughness: 1, map: roughnessMap });
  box(runner, 0, .01, -11.84, 4.8, .02, 6.7);
  for (const x of [-2.25, 2.25]) box(mat.brass, x, .023, -11.84, .025, .009, 6.4);
  // Shallow sanctuary platform is a visual finish; it does not impede character navigation.
  box(mat.darkWood, 0, .04, -14.65, 10.8, .075, 2.25);
  box(mat.woodEdge, 0, .055, -13.53, 10.85, .11, .09);

  // Organ console: a dark carved case, ranked pipes, two keyboards and an open score.
  const organ = new THREE.Group(); organ.name = 'organ'; organ.position.set(-6.65, 0, -11.55); world.add(organ);
  directBox(organ, mat.wood, 0, .96, 0, 2.55, 1.9, 1.18);
  directBox(organ, mat.darkWood, 0, 2.05, -.29, 2.25, 2.1, .48);
  directBox(organ, mat.woodEdge, 0, 3.17, -.27, 2.71, .17, .77);
  for (const x of [-1.22, 1.22]) { directBox(organ, mat.woodEdge, x, 1.95, -.2, .22, 2.37, .65); directBox(organ, mat.woodEdge, x, 3.03, -.2, .38, .19, .8); }
  for (let i = 0; i < 17; i++) {
    const x = -.99 + i * .123, h = 1.3 - Math.abs(i - 8) * .065;
    const pipe = mesh(new THREE.CylinderGeometry(.048, .048, h, 12), mat.brass, organ); pipe.position.set(x, 1.62 + h / 2, -.01);
    directBox(organ, mat.blackMetal, x, 1.83, .041, .063, .058, .008);
  }
  for (let manual = 0; manual < 2; manual++) {
    directBox(organ, mat.darkWood, 0, 1.12 + manual * .13, .72 - manual * .12, 2.24, .13, .63);
    for (let i = 0; i < 28; i++) directBox(organ, mat.ivory, -.96 + i * .071, 1.21 + manual * .13, .73 - manual * .12, .063, .046, .44);
    for (let i = 0; i < 27; i++) if (![2, 6].includes(i % 7)) directBox(organ, mat.blackMetal, -.926 + i * .071, 1.253 + manual * .13, .60 - manual * .12, .038, .04, .22);
  }
  for (const x of [-1.11, 1.11]) for (const y of [1.36, 1.53, 1.70]) {
    const knob = mesh(new THREE.SphereGeometry(.055, 10, 8), mat.ivory, organ); knob.position.set(x, y, .64);
  }
  directBox(organ, mat.woodEdge, 0, .52, 1.58, 1.62, .13, .45);
  for (const x of [-.61, .61]) directBox(organ, mat.wood, x, .24, 1.58, .14, .48, .38);
  collision(-6.65, -11.65, 2.65, 1.4);
  // The small musical score is deliberately readable when inspected at the console.
  const scoreMap = texture((ctx, s) => {
    ctx.fillStyle = '#c8bba0'; ctx.fillRect(0, 0, s, s); ctx.fillStyle = '#493b40'; ctx.textAlign = 'center'; ctx.font = '44px Georgia'; ctx.fillText('VESPER', s / 2, 116);
    ctx.font = '22px Georgia'; ctx.fillText('LUDOVICO EINAUDI', s / 2, 170);
    for (let staff = 0; staff < 3; staff++) { for (let line = 0; line < 5; line++) { ctx.fillStyle = '#6f6060'; ctx.fillRect(90, 260 + staff * 210 + line * 20, s - 180, 2); } for (let n = 0; n < 7; n++) { const x = 150 + n * 110, y = 292 + staff * 210 + (n % 4) * 13; ctx.fillStyle = '#43323a'; ctx.beginPath(); ctx.ellipse(x, y, 13, 9, -.4, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 10, y - 55, 3, 56); } }
  });
  const score = mesh(new THREE.PlaneGeometry(.82, .71), new THREE.MeshStandardMaterial({ map: scoreMap, roughness: .95 }), organ); score.position.set(0, 1.78, .49); score.rotation.x = -.15;

  // Reading desk and journal in the rear left aisle.
  const journal = new THREE.Group(); journal.name = 'journal'; journal.position.set(-7.3, 0, 10); journal.rotation.y = .2; world.add(journal);
  directBox(journal, mat.woodEdge, 0, .84, 0, 1.3, .11, .85);
  for (const x of [-.48, .48]) for (const z of [-.27, .27]) directBox(journal, mat.wood, x, .42, z, .09, .84, .09);
  directBox(journal, mat.felt, 0, .93, 0, .63, .06, .46);
  const pages = directBox(journal, mat.ivory, 0, .968, 0, .57, .024, .41); pages.rotation.y = -.16;
  const openBookMap = texture((ctx, s) => {
    ctx.fillStyle = '#c4b394'; ctx.fillRect(0, 0, s, s); ctx.fillStyle = '#5b4346'; ctx.font = '38px Georgia'; ctx.textAlign = 'center'; ctx.fillText('A KEEPERS JOURNAL', s / 2, 155);
    ctx.strokeStyle = '#7d6259'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s / 2, 80); ctx.lineTo(s / 2, s - 70); ctx.stroke();
    ctx.font = '28px Georgia'; ctx.fillText('IV', s * .25, 350); ctx.fillText('II', s * .75, 350); ctx.fillText('V', s * .25, 650); ctx.fillText('I', s * .75, 650);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(73,52,49,.42)'; ctx.fillRect(75, 405 + i * 11, 300 - (i % 3) * 35, 2); ctx.fillRect(570, 710 + i * 11, 330 - (i % 4) * 27, 2); }
  });
  const openBook = mesh(new THREE.PlaneGeometry(.59, .42), new THREE.MeshStandardMaterial({ map: openBookMap, roughness: .9 }), journal); openBook.position.y = .987; openBook.rotation.x = -Math.PI / 2; openBook.rotation.z = .16;
  collision(-7.3, 10, 1.35, .9);

  // The adjustable mirror: oxidised silver, concentric brass rings, three engraved stars.
  const mirror = new THREE.Group(); mirror.name = 'mirror'; mirror.position.set(7.4, 0, -6.1); mirror.rotation.y = -.5; world.add(mirror);
  directBox(mirror, mat.stone, 0, .13, 0, 1.05, .26, .82);
  directBox(mirror, mat.brass, 0, 1, 0, .13, 1.8, .13);
  const mirrorFace = new THREE.MeshStandardMaterial({ color: '#9595ae', metalness: .93, roughness: .23, emissive: '#514465', emissiveIntensity: .15 });
  const disc = mesh(new THREE.CylinderGeometry(.57, .57, .045, 64), mirrorFace, mirror); disc.rotation.x = Math.PI / 2; disc.position.set(0, 1.76, 0);
  torus(mat.brass, 0, 1.76, .036, .6, .045, 0, 0, mirror);
  torus(mat.brass, 0, 1.76, .04, .65, .014, 0, 0, mirror);
  const holder = torus(mat.blackMetal, 0, 1.76, -.03, .69, .026, 0, 0, mirror); holder.rotation.y = .3;
  directBox(mirror, mat.brass, 0, 1.02, .1, .5, .08, .12);
  collision(7.4, -6.1, .93, .85);

  // Low altar table and an intricate small key at the front of the central aisle.
  const altar = new THREE.Group(); altar.name = 'altar'; altar.position.set(0, 0, -13.6); world.add(altar);
  directBox(altar, mat.woodEdge, 0, 1.02, 0, 3.08, .16, 1.07);
  directBox(altar, mat.wood, 0, .73, .05, 2.57, .52, .75);
  for (const x of [-1.15, 1.15]) directBox(altar, mat.woodEdge, x, .51, 0, .23, .94, .73);
  for (const x of [-.79, 0, .79]) {
    directBox(altar, mat.darkWood, x, .74, .442, .67, .33, .045);
    directBox(altar, mat.brass, x, .74, .47, .017, .15, .02); directBox(altar, mat.brass, x, .78, .47, .095, .017, .02);
  }
  const cloth = new THREE.MeshStandardMaterial({ color: '#958a9c', roughness: 1 });
  directBox(altar, cloth, 0, 1.115, .03, .6, .016, 1.08);
  directBox(altar, cloth, 0, .9, .578, .6, .44, .02);
  const key = new THREE.Group(); key.name = 'vesper-key'; key.position.set(0, 1.18, .04); key.rotation.set(-Math.PI / 2, 0, -.5); altar.add(key);
  torus(mat.brass, 0, .16, 0, .09, .024, 0, 0, key); directBox(key, mat.brass, 0, -.03, 0, .035, .24, .033); directBox(key, mat.brass, .045, -.13, 0, .1, .04, .04); directBox(key, mat.brass, .069, -.1, 0, .025, .07, .04);
  collision(0, -13.6, 3.15, 1.1);

  // A small lectern, a forgotten chair, hymn boards and tarnished wall sconces.
  box(mat.wood, 3.6, .6, -11.4, .82, 1.18, .74);
  const lecternTop = mesh(new THREE.BoxGeometry(1.17, .11, .88), mat.woodEdge); lecternTop.position.set(3.6, 1.27, -11.4); lecternTop.rotation.x = -.19;
  box(mat.darkWood, 3.6, .67, -11.0, .6, .82, .035);
  collision(3.6, -11.4, 1.15, .88);
  for (const x of [-7.02, 7.02]) {
    box(mat.darkWood, x, 3.34, -15.75, 1.36, 1.73, .09);
    for (const dx of [-.69, .69]) box(mat.woodEdge, x + dx, 3.34, -15.67, .05, 1.81, .05);
    for (const y of [2.45, 4.22]) box(mat.woodEdge, x, y, -15.66, 1.41, .055, .055);
    for (const y of [2.88, 3.28, 3.68]) box(mat.woodEdge, x, y, -15.64, 1.24, .035, .04);
  }
  // Entry door has a real pivot for the ending animation.
  const door = new THREE.Group(); door.name = 'exit-door'; door.position.set(-1.36, 0, 15.84); world.add(door);
  directBox(door, mat.wood, 1.36, 1.83, 0, 2.72, 3.66, .17);
  for (const x of [.69, 2.03]) for (const y of [1.0, 2.62]) {
    directBox(door, mat.darkWood, x, y, -.1, 1.1, 1.34, .035);
    for (const dx of [-.53, .53]) directBox(door, mat.woodEdge, x + dx, y, -.135, .052, 1.37, .06);
    for (const dy of [-.67, .67]) directBox(door, mat.woodEdge, x, y + dy, -.135, 1.08, .055, .06);
  }
  const doorHandle = directBox(door, mat.brass, 2.42, 1.63, -.19, .09, .26, .075);
  const doorHandleRing = torus(mat.brass, 2.42, 1.64, -.25, .093, .02, 0, 0, door);
  for (const x of [-1.54, 1.54]) box(mat.moulding, x, 1.9, 15.8, .28, 3.83, .42);
  for (const [y, w] of [[3.89, 3.5], [4.08, 3.7]]) box(mat.moulding, 0, y, 15.79, w, .17, .55);
  // The exit now opens into a traversable corridor; no flat exterior image blocks it.

  // Tiny warm flames act as contrast points in the cold violet daylight.
  const flameMaterial = new THREE.MeshBasicMaterial({ color: '#ffd496', transparent: true, opacity: .95, depthWrite: false });
  const flames = [];
  function candle(x, y, z, h = .22) {
    cylinder(mat.brass, x, y + .018, z, .1, .035);
    cylinder(mat.wax, x, y + h / 2 + .027, z, .054, h);
    const flame = mesh(new THREE.SphereGeometry(1, 8, 6), flameMaterial); flame.position.set(x, y + h + .085, z); flame.scale.set(.025, .069, .025); flame.castShadow = false; flames.push(flame);
    cylinder(mat.blackMetal, x, y + h + .042, z, .007, .034);
  }
  for (const x of [-1.15, 1.15]) candle(x, 1.11, -13.61, .37);
  candle(-7.7, .905, 9.83, .25);
  for (const x of [2.72, 2.91, 3.12, 3.28]) candle(x, .1, -14.65 + random() * .7, .16 + random() * .22);
  for (const z of [-10, 2, 12]) for (const side of [-1, 1]) {
    box(mat.brass, side * 8.83, 3.23, z, .12, .39, .18);
    box(mat.brass, side * 8.63, 3.09, z, .36, .065, .065);
    candle(side * 8.49, 3.11, z, .22);
  }

  // Physically lit surfaces: one soft window key with shadow, quiet ambient fill.
  const ambient = new THREE.HemisphereLight('#b8adc8', '#55415c', .18); scene.add(ambient);
  const frontFill = new THREE.DirectionalLight('#aaa0bd', .48); frontFill.position.set(-4, 10, 8); scene.add(frontFill);
  const keyLight = new THREE.DirectionalLight('#d8d8ed', 0); keyLight.position.set(-14, 14.8, -6.6); keyLight.target.position.set(1, 5.6, -15.2); keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.camera.left = -20; keyLight.shadow.camera.right = 20; keyLight.shadow.camera.top = 18; keyLight.shadow.camera.bottom = -18; keyLight.shadow.camera.near = .1; keyLight.shadow.camera.far = 55;
  keyLight.shadow.normalBias = .035; keyLight.shadow.bias = -.0001; keyLight.shadow.radius = 3; scene.add(keyLight, keyLight.target);
  const altarLight = new THREE.PointLight('#e6bd8c', 7, 6, 2); altarLight.position.set(0, 1.6, -13.5); scene.add(altarLight);
  const deskLight = new THREE.PointLight('#e5bd92', 2.8, 3.5, 2); deskLight.position.set(-7.7, 1.35, 9.9); scene.add(deskLight);
  // Soft diffuse window contribution, without the cost of ten additional shadow maps.
  for (const z of [-11.6, -5.8, 5.8, 11.6]) {
    const fill = new THREE.PointLight('#a69ebf', 0, 16, 2); fill.position.set(-8.1, 8.4, z); scene.add(fill); windowLights.push(fill);
  }
  const crossLight = new THREE.SpotLight('#dbd7ee', 0, 25, .25, .85, 1.7); crossLight.position.set(-8.4, 9.5, -9.6); crossLight.target.position.set(0, 7.2, -15.4); scene.add(crossLight, crossLight.target);

  // Translucent volumetric ribbons: density fades at the aperture and along their edges.
  const shaftMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#b6aec9') }, uOpacity: { value: .13 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv;uniform vec3 uColor;uniform float uOpacity;uniform float uTime;
      void main(){float edge=pow(max(0.,sin(clamp(vUv.x,0.,1.)*3.14159265)),1.7);float lengthFade=smoothstep(0.,.1,vUv.y)*(1.-smoothstep(.7,1.,vUv.y));float veins=.92+.08*sin(vUv.x*19.+uTime*.07);gl_FragColor=vec4(uColor,uOpacity*edge*lengthFade*veins);}`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  function shaft(start, end, width, opacity) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), direction = b.clone().sub(a);
    const created = [];
    // Two intersecting ribbons keep the shaft visible while circling the character.
    for (let n = 0; n < 2; n++) {
      const geo = new THREE.PlaneGeometry(width, direction.length()); geo.translate(0, direction.length() / 2, 0);
      const material = shaftMaterial.clone(); material.uniforms.uOpacity.value = opacity;
      const object = new THREE.Mesh(geo, material); object.position.copy(a); object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()); object.rotateY(n * Math.PI / 2); object.renderOrder = 2; world.add(object);
      created.push(object);
    }
    return created;
  }
  naturalShafts.push(...shaft([-8.87, 9.8, -11.45], [3.2, 4.4, -15.45], 1.8, .055));
  naturalShafts.push(...shaft([-8.84, 8.1, -10.94], [4.6, 1.1, -15.05], .5, .06));
  naturalShafts.push(...shaft([-8.84, 10.1, -5.7], [5.1, .35, -11.6], 2, .055));
  naturalShafts.push(...shaft([-8.84, 8.8, .25], [5.4, .25, -7.1], 1.7, .042));
  naturalShafts.push(...shaft([-8.84, 9.7, 6.02], [5.5, .25, -1.7], 1.8, .038));
  naturalShafts.push(...shaft([-8.84, 9.1, 11.75], [4.9, .3, 4.1], 1.6, .035));
  for (const object of naturalShafts) { object.userData.baseOpacity = object.material.uniforms.uOpacity.value; object.material.uniforms.uOpacity.value = 0; }
  const reflectedShafts = shaft([7.4, 1.79, -6.1], [0, 7.2, -15.28], .19, .23);
  reflectedShafts.forEach(o => { o.visible = false; });
  const reflectedLight = new THREE.SpotLight('#d6d3fb', 0, 18, .065, .4, 1.2);
  reflectedLight.position.set(7.4, 1.79, -6.1); reflectedLight.target.position.set(0, 7.2, -15.28); scene.add(reflectedLight, reflectedLight.target);
  const revealedKeyLight = new THREE.PointLight('#ded0ae', 0, 3, 2); revealedKeyLight.position.set(0, 1.55, -13.1); scene.add(revealedKeyLight);
  // Sparse drifting motes remain small in world space and become visible in the shafts.
  const dustCount = 900;
  const dustRays = [
    [[-8.87, 9.8, -11.45], [3.2, 4.4, -15.45]],
    [[-8.84, 10.1, -5.7], [5.1, .35, -11.6]],
    [[-8.84, 8.8, .25], [5.4, .25, -7.1]],
    [[-8.84, 9.7, 6.02], [5.5, .25, -1.7]],
    [[-8.84, 9.1, 11.75], [4.9, .3, 4.1]],
  ].map(([a, b]) => new THREE.Line3(new THREE.Vector3(...a), new THREE.Vector3(...b)));
  const dustClosest = new THREE.Vector3();
  const dustPositions = new Float32Array(dustCount * 3), dustAlpha = new Float32Array(dustCount), dustBase = [];
  for (let i = 0; i < dustCount; i++) {
    const x = random() * 16 - 8, y = .35 + random() * 10.3, z = random() * 29 - 14.5;
    dustPositions.set([x, y, z], i * 3); dustBase.push({ x, y, z, speed: .012 + random() * .025, phase: random() * Math.PI * 2 });
    const point = new THREE.Vector3(x, y, z);
    let illumination = 0;
    for (const ray of dustRays) { ray.closestPointToPoint(point, true, dustClosest); illumination = Math.max(illumination, Math.max(0, 1 - dustClosest.distanceTo(point) / 1.2)); }
    dustAlpha[i] = .014 + illumination * (.19 + random() * .23);
  }
  const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3)); dustGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(dustAlpha, 1));
  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.8) } },
    vertexShader: 'attribute float aAlpha;varying float vAlpha;uniform float uPixelRatio;void main(){vAlpha=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(20./-mv.z,.6,2.)*uPixelRatio;}',
    fragmentShader: 'varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(.12,.5,d);gl_FragColor=vec4(.83,.79,.91,a*vAlpha);}',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial); dust.frustumCulled = false; world.add(dust);

  // -------------------------------------------------------------------------
  // Chapter I. The objects have ordinary, physical forms; their meaning is not
  // explained by the environment. All new areas are walkable geometry.
  // -------------------------------------------------------------------------
  const chapter = new THREE.Group(); chapter.name = 'chapter-one-physical-props'; world.add(chapter);
  let chapterState = {}, curtainTarget = 0, curtainProgress = 0, introFade = 1;
  let tapeSeconds = 0, tapePlaying = false, tapeInertia = 0, tapeDisplayCode = '';
  let windowFlash = 0, slitFlash = 0, doorAttempt = 0, sideDoorTarget = 0, drawerTarget = 0, punchPulse = 0;
  let b18Transient = false, b18Seen = false, lastTapeComplete = false, exitIsOpen = false;
  const coldBrass = new THREE.MeshStandardMaterial({ color: '#827767', metalness: .72, roughness: .54 });
  const paperMaterial = new THREE.MeshStandardMaterial({ color: '#b1a59c', roughness: .94 });
  const curtainMaterial = new THREE.MeshStandardMaterial({ color: '#514655', roughness: 1, side: THREE.DoubleSide });
  const newSeatMaterial = new THREE.MeshStandardMaterial({ color: '#514553', roughness: .94 });
  const oldSeatMaterial = new THREE.MeshStandardMaterial({ color: '#4b404a', roughness: 1, map: roughnessMap });

  function sign(lines, width, height, x, y, z, parent = chapter, options = {}) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = Math.max(96, Math.round(768 * height / width));
    const ctx = canvas.getContext('2d');
    if (options.background !== 'transparent') { ctx.fillStyle = options.background || '#92847a'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    const texts = Array.isArray(lines) ? lines : [lines], gap = canvas.height / (texts.length + 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = options.color || '#302930';
    ctx.font = `${options.bold ? 'bold ' : ''}${Math.min(gap * .66, options.fontSize || 128)}px ${options.font || 'Georgia'}`;
    texts.forEach((text, i) => ctx.fillText(text, canvas.width / 2, gap * (i + 1), canvas.width * .92));
    if (options.worn) { for (let i = 0; i < 30; i++) { ctx.strokeStyle = `rgba(25,21,28,${random() * .3})`; ctx.beginPath(); const px = random() * canvas.width, py = random() * canvas.height; ctx.moveTo(px, py); ctx.lineTo(px + random() * 35, py - random() * 5); ctx.stroke(); } }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const material = new THREE.MeshStandardMaterial({ map, roughness: .83, transparent: options.background === 'transparent', side: THREE.DoubleSide, metalness: options.metal ? .35 : 0 });
    const object = mesh(new THREE.PlaneGeometry(width, height), material, parent); object.position.set(x, y, z); object.rotation.y = options.rotationY || 0; object.castShadow = false; return object;
  }
  function cylinderIn(parent, m, x, y, z, radius, height, segments = 24) {
    const object = mesh(new THREE.CylinderGeometry(radius, radius, height, segments), m, parent); object.position.set(x, y, z); return object;
  }
  function furnitureCollider(list, x, z, width, depth) { list.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 }); }
  function screenMaterial(canvas) { const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map, color: '#dedbe4', emissive: '#777082', emissiveMap: map, emissiveIntensity: .45, roughness: .7 }); }

  // Remove superseded first-prototype objects and their floor obstructions.
  journal.visible = false; mirror.visible = false; key.visible = false;
  for (let i = colliders.length - 1; i >= 0; i--) {
    const c = colliders[i], x = (c.minX + c.maxX) / 2, z = (c.minZ + c.maxZ) / 2;
    if ((Math.abs(x + 7.3) < .05 && Math.abs(z - 10) < .05) || (Math.abs(x - 7.4) < .05 && Math.abs(z + 6.1) < .05)) colliders.splice(i, 1);
  }
  reflectedShafts.forEach(o => { o.visible = false; });

  // Heavy pleated curtains cover every upper window at the opening. Only the
  // left set is connected to the physical release/lift/hook mechanism.
  function makeCurtain(side, z, centreY = 9.34, height = 4.94, width = 2.58, x = side * 8.82) {
    const rig = new THREE.Group(); rig.position.set(x, centreY, z); rig.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; chapter.add(rig);
    for (const leafSide of [-1, 1]) {
      const geometry = new THREE.PlaneGeometry(width / 2, height, 32, 6);
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / width + .5) * Math.PI * 24) * .055);
      geometry.computeVertexNormals();
      const leaf = mesh(geometry, curtainMaterial, rig); leaf.position.x = leafSide * width / 4;
      leaf.userData = { side, leafSide, width }; curtainPanels.push(leaf);
    }
    directBox(rig, mat.blackMetal, 0, height / 2 + .065, 0, width + .32, .07, .08);
    return rig;
  }
  for (const side of [-1, 1]) for (const z of windowZ) makeCurtain(side, z);
  makeCurtain(-1, 0, 3.0, 3.39, 2.6, -8.82);
  const ropeMaterial = new THREE.MeshStandardMaterial({ color: '#887984', roughness: 1 });
  const ropeCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-8.68, 1.1, 3.8), new THREE.Vector3(-8.68, 4.8, 3.8), new THREE.Vector3(-8.68, 6.85, 3.1), new THREE.Vector3(-8.68, 7.4, 1.2)]);
  mesh(new THREE.TubeGeometry(ropeCurve, 40, .024, 6, false), ropeMaterial, chapter);
  const clasp = torus(coldBrass, -8.64, 1.21, 3.8, .112, .035, 0, Math.PI / 2, chapter);
  directBox(chapter, coldBrass, -8.67, 1.24, 3.8, .11, .22, .08);
  const curtainHook = new THREE.Group(); curtainHook.position.set(-8.61, 1.66, 3.8); chapter.add(curtainHook);
  torus(coldBrass, 0, 0, 0, .095, .023, 0, Math.PI / 2, curtainHook);
  directBox(curtainHook, coldBrass, -.035, -.1, 0, .085, .12, .07); curtainHook.visible = false;

  // Low, accessible stained glass makes inspection against the light physical.
  const stainedGlass = new THREE.Group(); stainedGlass.name = 'left-stained-window'; stainedGlass.position.set(-8.985, 1.36, 0); stainedGlass.rotation.y = Math.PI / 2; chapter.add(stainedGlass);
  const stainedBase = new THREE.MeshStandardMaterial({ color: '#8a8199', emissive: '#7b738d', emissiveIntensity: .06, metalness: .16, roughness: .46, side: THREE.DoubleSide });
  directBox(stainedGlass, stainedBase, 0, 1.59, -.02, 2.38, 3.14, .07);
  const stainedPanels = [];
  for (let i = 0; i < 4; i++) {
    const panelMat = new THREE.MeshStandardMaterial({ color: ['#827990', '#81758e', '#9b92a7', '#847791'][i], emissive: '#4c435b', emissiveIntensity: .04, roughness: .42, side: THREE.DoubleSide });
    const pane = directBox(stainedGlass, panelMat, -.87 + i * .58, 1.68, .035, .54, 2.77, .025); stainedPanels.push(pane);
    directBox(stainedGlass, mat.blackMetal, -1.15 + i * .58, 1.61, .08, .035, 3.15, .035);
  }
  for (const y of [.12, 1.09, 2.07, 3.11]) directBox(stainedGlass, mat.blackMetal, 0, y, .075, 2.41, .043, .055);
  for (const x of [-1.27, 1.27]) directBox(stainedGlass, mat.moulding, x, 1.59, .06, .14, 3.4, .3);
  for (const y of [-.06, 3.29]) directBox(stainedGlass, mat.moulding, 0, y, .08, 2.7, .14, .35);
  const paneGlint = new THREE.PointLight('#9c91b0', 0, 5.5, 2); paneGlint.position.set(-8.2, 3.1, .1); scene.add(paneGlint);
  const colourLeak = directBox(stainedGlass, new THREE.MeshBasicMaterial({ color: '#d3b66d', transparent: true, opacity: 0, depthWrite: false }), -.87, 2.4, .085, .49, .69, .02);
  const tracing = sign(['○   △        ◇', '1     2     3     4'], 1.38, .48, .02, 1.56, .14, stainedGlass, { background: 'transparent', color: '#dbd2e3', font: 'sans-serif' }); tracing.visible = false;

  // Stall B: B17 and B18 share the same existing pew, immediately adjacent.
  const stallB = new THREE.Group(); stallB.name = 'stallB'; chapter.add(stallB);
  const seatB17 = new THREE.Group(), seatB18 = new THREE.Group(); seatB17.name = 'seatB17'; seatB18.name = 'seatB18'; seatB17.position.set(-3.42, 0, 7.5); seatB18.position.set(-2.44, 0, 7.5); stallB.add(seatB17, seatB18);
  function seatCushion(parent, material, depression) {
    const geometry = new THREE.BoxGeometry(.82, .09, .62, 12, 1, 10), a = geometry.attributes.position;
    for (let i = 0; i < a.count; i++) if (a.getY(i) > 0) { const d = Math.exp(-((a.getX(i) / .28) ** 2 + (a.getZ(i) / .23) ** 2)); a.setY(i, a.getY(i) - d * depression); }
    geometry.computeVertexNormals(); const object = mesh(geometry, material, parent); object.position.set(0, .695, -.01); return object;
  }
  seatCushion(seatB17, oldSeatMaterial, .026);
  const b18Cushion = seatCushion(seatB18, newSeatMaterial, .004);
  const b18Original = new Float32Array(b18Cushion.geometry.attributes.position.array);
  for (const [seat, label, worn] of [[seatB17, 'B17', true], [seatB18, 'B18', false]]) {
    directBox(seat, coldBrass, 0, 1.34, .308, .38, .16, .025);
    sign(label, .33, .125, 0, 1.34, .293, seat, { background: '#9c8b70', color: '#302d34', rotationY: Math.PI, worn, metal: true });
  }
  for (let i = 0; i < 13; i++) {
    const scratch = directBox(seatB17, mat.woodEdge, -.36 + random() * .72, .66, -.41, .018 + random() * .04, .008, .012); scratch.rotation.y = random() * .3;
  }
  sign('STALL B', .62, .16, -2.046, 1.06, 7.34, chapter, { background: '#776862', color: '#d2c9bc', rotationY: Math.PI / 2, worn: true });
  const programme = new THREE.Group(); programme.name = 'folded-programme'; programme.position.set(-3.42, .14, 7.12); programme.rotation.y = -.19; chapter.add(programme);
  const paperBody = directBox(programme, paperMaterial, 0, 0, 0, .5, .024, .34);
  const programmePrint = sign(['PROGRAMME', 'LUDOVICO EINAUDI', '[Track]     [Track]', 'Experience', '[Track]     [Track]'], .46, .32, 0, .015, 0, programme, { background: '#c0b09b', color: '#54484a', worn: true }); programmePrint.rotation.x = -Math.PI / 2;
  directBox(programme, mat.ivory, -.09, .025, 0, .007, .009, .32);
  const fold = directBox(programme, paperMaterial, .18, .035, -.105, .14, .014, .12); fold.rotation.z = -.15;
  const watermark = mesh(new THREE.RingGeometry(.112, .126, 48), new THREE.MeshBasicMaterial({ color: '#77727c', transparent: true, opacity: .19, side: THREE.DoubleSide, depthWrite: false }), chapter); watermark.position.set(-2.52, .662, 7.055); watermark.rotation.x = -Math.PI / 2; watermark.visible = false;

  // A fixed 19:31 dial can be read from the nave. On the upper walkway its
  // open mechanism is visible from behind, and none of its gears ever moves.
  const clock = new THREE.Group(); clock.name = 'clock-19-31'; clock.position.set(0, 7.23, 13.61); chapter.add(clock);
  const clockDialMap = texture((ctx, s) => {
    ctx.fillStyle = '#b2a79f'; ctx.fillRect(0, 0, s, s); ctx.translate(s / 2, s / 2);
    ctx.strokeStyle = '#504b52'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, s * .43, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 60; i++) { const a = i * Math.PI / 30; ctx.save(); ctx.rotate(a); ctx.lineWidth = i % 5 ? 2 : 5; ctx.beginPath(); ctx.moveTo(0, -s * .39); ctx.lineTo(0, -s * (i % 5 ? .37 : .35)); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = '#48424a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '45px Georgia';
    for (let i = 1; i <= 12; i++) { const a = i * Math.PI / 6; ctx.fillText(String(i), Math.sin(a) * s * .293, -Math.cos(a) * s * .293); }
    function hand(angle, length, width) { ctx.save(); ctx.rotate(angle); ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(0, s * .035); ctx.lineTo(0, -length); ctx.stroke(); ctx.restore(); }
    hand((7 + 31 / 60) * Math.PI / 6, s * .21, 12); hand(31 * Math.PI / 30, s * .31, 7); hand(Math.PI * .18, s * .34, 2);
    ctx.fillStyle = '#827363'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.font = '30px Georgia'; ctx.fillStyle = '#57505a'; ctx.fillText('19:31', 0, s * .16);
  });
  const dial = mesh(new THREE.CircleGeometry(1.05, 80), new THREE.MeshStandardMaterial({ map: clockDialMap, roughness: .81, side: THREE.FrontSide }), clock); dial.position.z = -.092; dial.rotation.y = Math.PI;
  torus(coldBrass, 0, 0, -.08, 1.07, .075, 0, 0, clock);
  torus(mat.darkWood, 0, 0, .03, 1.12, .058, 0, 0, clock);
  const clockMechanism = new THREE.Group(); clockMechanism.name = 'still-clock-mechanism'; clockMechanism.position.z = .1; clock.add(clockMechanism);
  for (let i = 0; i < 5; i++) {
    const x = [-.45, 0, .41, -.22, .42][i], y = [.29, .08, -.22, -.42, .37][i], r = [.28, .22, .26, .19, .16][i];
    torus(coldBrass, x, y, .08, r, .045, 0, 0, clockMechanism);
    for (let tooth = 0; tooth < 14; tooth++) { const a = tooth * Math.PI / 7; const part = directBox(clockMechanism, coldBrass, x + Math.cos(a) * r, y + Math.sin(a) * r, .08, .07, .055, .07); part.rotation.z = a; }
    for (let spoke = 0; spoke < 4; spoke++) { const a = spoke * Math.PI / 2; const part = directBox(clockMechanism, mat.blackMetal, x, y, .09, r * 1.77, .03, .04); part.rotation.z = a; }
  }
  directBox(clockMechanism, mat.blackMetal, 0, -.95, .07, .035, 1.35, .04);
  directBox(chapter, mat.blackMetal, 0, 5.7, 13.9, .055, .55, .065);
  const exitLinkage = directBox(chapter, coldBrass, 0, 4.89, 15.67, 1.55, .075, .08);

  // Right archive room: the doorway is cut through the existing church wall.
  const archive = new THREE.Group(); archive.name = 'right-archive-room'; chapter.add(archive);
  box(mat.floor, 12.08, -.12, -7.2, 6.15, .24, 6.5);
  box(mat.plaster, 15.28, 2.3, -7.2, .3, 4.6, 6.6);
  box(mat.plaster, 12.05, 2.3, -10.4, 6.5, 4.6, .28);
  box(mat.plaster, 12.05, 2.3, -3.95, 6.5, 4.6, .28);
  box(mat.shadowPlaster, 12.05, 4.63, -7.2, 6.6, .23, 6.65);
  for (const y of [.16, 3.85, 4.33]) { box(mat.moulding, 15.09, y, -7.2, .16, .12, 6.2); box(mat.moulding, 12.09, y, -10.22, 6.1, .12, .16); box(mat.moulding, 12.09, y, -4.13, 6.1, .12, .16); }
  for (const z of [-8.64, -6.16]) box(mat.moulding, 8.95, 1.87, z, .28, 3.74, .18);
  box(mat.moulding, 8.95, 3.73, -7.4, .34, .19, 2.73);
  const sideRoomDoor = new THREE.Group(); sideRoomDoor.name = 'archive-door'; sideRoomDoor.position.set(9.06, 0, -8.6); sideRoomDoor.rotation.y = -Math.PI / 2; chapter.add(sideRoomDoor);
  directBox(sideRoomDoor, mat.wood, 1.2, 1.77, 0, 2.4, 3.54, .14);
  for (const x of [.6, 1.8]) for (const y of [.91, 2.64]) directBox(sideRoomDoor, mat.darkWood, x, y, .09, .94, 1.46, .038);
  directBox(sideRoomDoor, coldBrass, 2.17, 1.62, .14, .085, .28, .055);
  sign('ARCHIVE', .67, .18, 1.19, 2.76, -.09, sideRoomDoor, { background: '#7f756e', color: '#c3bcb2', rotationY: Math.PI, worn: true });
  const archiveAmbient = new THREE.PointLight('#9c93a9', 4.5, 10, 2); archiveAmbient.position.set(12.2, 3.8, -7.2); scene.add(archiveAmbient);
  // Glass cabinet and a handful of stacked, unlabelled folded programmes.
  box(mat.wood, 14.65, .47, -5.7, .68, .94, 2.05);
  box(mat.woodEdge, 14.65, 2.11, -5.7, .78, .13, 2.13);
  for (const z of [-6.72, -4.68]) box(mat.woodEdge, 14.65, 1.5, z, .67, 1.25, .085);
  for (const y of [1.14, 1.6]) box(mat.woodEdge, 14.65, y, -5.7, .66, .055, 2.05);
  const cabinetGlass = new THREE.MeshStandardMaterial({ color: '#a3a0b3', transparent: true, opacity: .18, roughness: .26, metalness: .12, depthWrite: false });
  directBox(archive, cabinetGlass, 14.28, 1.54, -5.7, .025, 1.04, 1.96);
  for (let i = 0; i < 8; i++) box(paperMaterial, 14.57, 1.2 + (i % 4) * .028, -6.26 + Math.floor(i / 4) * .78, .4, .022, .44);
  const ticketTable = new THREE.Group(); ticketTable.position.set(10.85, 0, -5.15); archive.add(ticketTable);
  directBox(ticketTable, mat.woodEdge, 0, .94, 0, 1.84, .13, 1.0);
  for (const x of [-.73, .73]) for (const z of [-.35, .35]) directBox(ticketTable, mat.wood, x, .46, z, .1, .93, .1);
  const b17Ticket = new THREE.Group(), b18Ticket = new THREE.Group(); b17Ticket.name = 'ticket-B17'; b18Ticket.name = 'ticket-B18'; ticketTable.add(b17Ticket, b18Ticket);
  b17Ticket.position.set(-.43, 1.022, .02); b18Ticket.position.set(.43, 1.022, .02); b17Ticket.rotation.y = -.12;
  for (const [ticket, label, worn] of [[b17Ticket, 'B17', true], [b18Ticket, 'B18', false]]) {
    directBox(ticket, paperMaterial, 0, 0, 0, .54, .012, .28);
    const print = sign(['STALL B', label], .52, .27, 0, .009, 0, ticket, { background: worn ? '#afa091' : '#bdb2a3', color: '#4e454c', worn }); print.rotation.x = -Math.PI / 2;
  }
  for (let i = 0; i < 3; i++) { const hole = mesh(new THREE.CircleGeometry(.025, 12), new THREE.MeshBasicMaterial({ color: '#242028' }), b17Ticket); hole.position.set(-.14 + i * .14, .014, .078); hole.rotation.x = -Math.PI / 2; }
  // The machine is a small, plausible mechanical verifier with three physical dials.
  const ticketMachine = new THREE.Group(); ticketMachine.name = 'ticket-validator'; ticketMachine.position.set(12.78, 0, -8.87); archive.add(ticketMachine);
  directBox(ticketMachine, mat.wood, 0, .49, 0, 2.25, .98, 1.02);
  directBox(ticketMachine, mat.woodEdge, 0, 1.03, 0, 2.4, .12, 1.12);
  directBox(ticketMachine, mat.blackMetal, 0, 1.35, -.14, 1.64, .58, .74);
  directBox(ticketMachine, coldBrass, 0, 1.56, .249, 1.61, .14, .065);
  directBox(ticketMachine, mat.darkWood, -.28, 1.59, .29, .65, .032, .085);
  const dialSymbols = [['○', '△', '□'], ['│', '×', '◇'], ['↑', '↓', '•']];
  const verifierDials = [];
  for (let i = 0; i < 3; i++) {
    const disc = cylinderIn(ticketMachine, coldBrass, -.46 + i * .46, 1.32, .277, .165, .075, 32); disc.rotation.x = Math.PI / 2;
    const wheel = new THREE.Group(); wheel.position.set(-.46 + i * .46, 1.32, .32); ticketMachine.add(wheel);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3, mark = sign(dialSymbols[i][k], .105, .105, Math.sin(a) * .091, Math.cos(a) * .091, .005, wheel, { background: 'transparent', color: '#d2c7ae', font: 'sans-serif' }); }
    verifierDials.push(wheel);
  }
  const punch = directBox(ticketMachine, coldBrass, .71, 1.42, .43, .22, .10, .19);
  const ticketSlip = new THREE.Group(); ticketSlip.name = 'inserted-ticket'; ticketSlip.position.set(-.24, 1.64, .28); ticketMachine.add(ticketSlip);
  directBox(ticketSlip, paperMaterial, 0, 0, 0, .64, .012, .35);
  const insertedB17 = sign('B17', .4, .13, 0, .009, .065, ticketSlip, { background: '#b5a793', color: '#4b4248', worn: true }); insertedB17.rotation.x = -Math.PI / 2;
  const insertedB18 = sign('B18', .4, .13, 0, .01, .065, ticketSlip, { background: '#c1b5a1', color: '#4b4248' }); insertedB18.rotation.x = -Math.PI / 2;
  const punchedHoles = new THREE.Group(); ticketSlip.add(punchedHoles);
  for (let i = 0; i < 3; i++) { const hole = mesh(new THREE.CircleGeometry(.028, 14), new THREE.MeshBasicMaterial({ color: '#242029' }), punchedHoles); hole.position.set(-.18 + i * .18, .016, -.08); hole.rotation.x = -Math.PI / 2; }
  ticketSlip.visible = false;
  sign('PUNCH', .29, .075, .7, 1.26, .332, ticketMachine, { background: '#514b4f', color: '#c5bdb1', font: 'sans-serif' });
  const frosted = new THREE.MeshStandardMaterial({ color: '#aca7b6', roughness: .9, transparent: true, opacity: .78, side: THREE.DoubleSide });
  directBox(ticketMachine, frosted, 0, 2.07, -.4, 1.23, .91, .045);
  for (const x of [-.65, .65]) directBox(ticketMachine, mat.blackMetal, x, 2.08, -.4, .04, 1.05, .08);
  for (const y of [1.58, 2.58]) directBox(ticketMachine, mat.blackMetal, 0, y, -.4, 1.34, .045, .08);
  const projectedMarks = sign('○  ×  ↓', 1.02, .25, 0, 2.08, -.366, ticketMachine, { background: 'transparent', color: '#ebdfba', font: 'sans-serif' }); projectedMarks.visible = false;
  const archiveDrawer = new THREE.Group(); archiveDrawer.name = 'archive-drawer'; archiveDrawer.position.set(0, .78, .46); ticketMachine.add(archiveDrawer);
  directBox(archiveDrawer, mat.wood, 0, 0, -.31, 1.6, .16, .66);
  directBox(archiveDrawer, mat.woodEdge, 0, .09, .01, 1.73, .27, .1);
  directBox(archiveDrawer, coldBrass, 0, .1, .085, .31, .05, .055);
  const drawerTape = directBox(archiveDrawer, mat.blackMetal, -.36, .18, -.25, .53, .085, .33);
  const tapeLabel = sign('19:31', .4, .12, -.36, .225, -.25, archiveDrawer, { background: '#ada396', color: '#48404b' }); tapeLabel.rotation.x = -Math.PI / 2;
  const archiveKey = new THREE.Group(); archiveKey.position.set(.31, .2, -.24); archiveKey.rotation.x = -Math.PI / 2; archiveDrawer.add(archiveKey);
  torus(coldBrass, 0, .075, 0, .073, .018, 0, 0, archiveKey); directBox(archiveKey, coldBrass, 0, -.07, 0, .025, .21, .025); directBox(archiveKey, coldBrass, .036, -.15, 0, .09, .038, .035);
  const ledger = sign(['SEATING / STORAGE RECORD', 'B01  MOVED    B02  STORAGE', 'B03  REPLACED       B04', 'B05   B06   B07   B08   B09', 'B10   B11   B12   B13   B14', 'B15   B16   B17   B18   B19', 'B20   B21   B22   B23   B24', 'B25   B26   B27   B28   B29   B30'], .84, 1.08, 14.035, 1.55, -5.32, archive, { background: '#afa294', color: '#4b434b', rotationY: -Math.PI / 2, worn: true, font: 'sans-serif' });
  // A hinged desk lamp sends its small light through the inserted ticket.
  cylinderIn(ticketMachine, coldBrass, -.91, 1.14, -.15, .17, .045);
  directBox(ticketMachine, coldBrass, -.91, 1.58, -.25, .035, .84, .035);
  const shade = mesh(new THREE.ConeGeometry(.2, .23, 24, 1, true), coldBrass, ticketMachine); shade.position.set(-.86, 1.95, -.17); shade.rotation.z = -.4;
  const validatorLamp = new THREE.PointLight('#c3baa7', 0, 3.2, 2); validatorLamp.position.set(11.92, 1.89, -8.98); scene.add(validatorLamp);

  // Narrow maintenance access and a real upper rear gallery with guard rails.
  const upperDoor = new THREE.Group(); upperDoor.name = 'choir-access-door'; upperDoor.position.set(6.89, 0, 12.96); chapter.add(upperDoor);
  directBox(upperDoor, mat.wood, .63, 1.68, 0, 1.26, 3.36, .13);
  directBox(upperDoor, mat.darkWood, .63, 2.05, -.09, .93, 2.02, .03);
  directBox(upperDoor, coldBrass, 1.07, 1.45, -.13, .06, .19, .06);
  for (const x of [6.75, 8.28]) box(mat.moulding, x, 1.77, 12.98, .2, 3.55, .31);
  box(mat.moulding, 7.51, 3.58, 12.98, 1.76, .2, .33);
  sign('CHOIR / MAINTENANCE', 1.05, .18, 7.52, 3.09, 12.79, chapter, { background: '#665b60', color: '#bdb3a5', rotationY: Math.PI, worn: true });
  for (const x of [7.12, 8.02]) box(mat.woodEdge, x, 2.73, 14.92, .075, 5.44, .11);
  for (let y = .38; y <= 5.22; y += .31) box(mat.woodEdge, 7.57, y, 14.92, .98, .065, .23);
  // This additional deck closes the tiny perimeter gap, without altering the nave.
  box(mat.wood, 0, 5.13, 14.83, 17.5, .16, 2.44);
  for (let x = -8.5; x <= 8.5; x += .34) box(mat.darkWood, x, 5.218, 14.83, .013, .006, 2.41);
  // Small tape table is fixed to the rear wall, leaving an uninterrupted walkway.
  const tapePlayer = new THREE.Group(); tapePlayer.name = 'tape-player'; tapePlayer.position.set(3.33, 5.21, 15.63); tapePlayer.rotation.y = Math.PI; chapter.add(tapePlayer);
  directBox(tapePlayer, mat.woodEdge, 0, .86, 0, 1.8, .12, .75);
  for (const x of [-.68, .68]) directBox(tapePlayer, mat.wood, x, .4, .1, .1, .8, .45);
  directBox(tapePlayer, mat.blackMetal, 0, 1.17, .01, 1.45, .54, .49);
  directBox(tapePlayer, coldBrass, 0, 1.2, .274, 1.37, .47, .028);
  const tapeReels = [];
  for (const x of [-.37, .37]) {
    const reel = new THREE.Group(); reel.position.set(x, 1.28, .3); tapePlayer.add(reel); tapeReels.push(reel);
    torus(mat.blackMetal, 0, 0, 0, .182, .036, 0, 0, reel);
    torus(coldBrass, 0, 0, .008, .212, .015, 0, 0, reel);
    for (let i = 0; i < 3; i++) { const spoke = directBox(reel, coldBrass, 0, 0, .015, .35, .028, .025); spoke.rotation.z = i * Math.PI / 3; }
    const hub = cylinderIn(reel, mat.blackMetal, 0, 0, .032, .055, .04); hub.rotation.x = Math.PI / 2;
  }
  directBox(tapePlayer, mat.blackMetal, 0, 1.102, .306, .56, .025, .018);
  const timeCanvas = document.createElement('canvas'); timeCanvas.width = 512; timeCanvas.height = 96;
  const timeMaterial = screenMaterial(timeCanvas), timeScreen = mesh(new THREE.PlaneGeometry(.63, .117), timeMaterial, tapePlayer); timeScreen.position.set(0, 1.016, .314);
  for (let i = 0; i < 4; i++) { directBox(tapePlayer, mat.blackMetal, -.47 + i * .31, .938, .32, .25, .07, .085); sign(['PLAY', 'STOP', 'REWIND', 'EJECT'][i], .225, .039, -.47 + i * .31, .937, .367, tapePlayer, { background: 'transparent', color: '#c4bdc9', font: 'sans-serif' }); }
  sign('19:31', .28, .095, 0, 1.54, .12, tapePlayer, { background: '#ada49a', color: '#403c44', worn: true });
  const upperLight = new THREE.PointLight('#aaa0ba', 5.5, 9, 2); upperLight.position.set(2.5, 8.7, 14.7); scene.add(upperLight);
  const slit = directBox(chapter, new THREE.MeshBasicMaterial({ color: '#928b9f', transparent: true, opacity: .35 }), -4.3, 7.13, 15.92, .53, 1.3, .015);
  for (const x of [-4.62, -3.98]) box(mat.woodEdge, x, 7.13, 15.81, .07, 1.48, .16);
  for (const y of [6.42, 7.84]) box(mat.woodEdge, -4.3, y, 15.81, .7, .07, .16);
  const slitGlow = new THREE.PointLight('#d6b58c', 0, 4, 2); slitGlow.position.set(-4.3, 7.13, 15.4); scene.add(slitGlow);

  // Ordinary paving joint on the right: it remains closed throughout Chapter I.
  const stone = new THREE.Group(); stone.name = 'old-floor-stone'; stone.position.set(7.3, .008, 2.7); chapter.add(stone);
  directBox(stone, mat.stone, 0, 0, 0, 1.47, .018, 1.09);
  for (const x of [-.75, .75]) directBox(stone, mat.darkWood, x, .011, 0, .018, .008, 1.13);
  for (const z of [-.57, .57]) directBox(stone, mat.darkWood, 0, .011, z, 1.51, .008, .018);
  const stoneMark = sign('B18', .18, .07, .46, .022, -.44, stone, { background: 'transparent', color: '#625b69', worn: true }); stoneMark.rotation.x = -Math.PI / 2; stoneMark.visible = false;

  // The door opens onto a complete, physically traversable grey-violet passage.
  // Repeating off-axis arches and impossible side recesses quietly break the
  // church's exterior footprint without narration or a different visual world.
  const corridor = new THREE.Group(); corridor.name = 'non-euclidean-grey-violet-corridor'; chapter.add(corridor);
  box(mat.stone, 0, -.12, 30.4, 3.3, .24, 28.6);
  for (const side of [-1, 1]) {
    box(mat.shadowPlaster, side * 1.83, 2.65, 30.4, .35, 5.3, 28.6);
    for (const y of [.18, 4.61, 4.88]) box(mat.moulding, side * 1.62, y, 30.4, .14, .1, 28.6);
  }
  box(mat.shadowPlaster, 0, 5.2, 30.4, 3.95, .25, 28.6);
  box(mat.shadowPlaster, 0, 2.65, 44.7, 3.95, 5.3, .24);
  for (let index = 0; index < 7; index++) {
    const z = 18.5 + index * 3.7, offset = Math.sin(index * .8) * .13;
    for (const side of [-1, 1]) box(mat.moulding, side * 1.59 + offset, 2.06, z, .18, 4.12, .23);
    const arch = mesh(new THREE.TorusGeometry(1.6, .105, 8, 32, Math.PI), mat.moulding, corridor); arch.position.set(offset, 3.99, z); arch.scale.y = .58;
    const light = new THREE.PointLight('#9d92b4', index % 2 ? 2.6 : 3.5, 7.4, 2); light.position.set(-1.25 + (index % 2) * 2.5, 3.75, z); light.userData.baseIntensity = light.intensity; corridorLights.push(light); scene.add(light);
    for (const side of [-1, 1]) {
      box(mat.darkWood, side * 1.631, 2.01, z + 1.83, .025, 2.91, 1.03);
      for (const dz of [-.59, .59]) box(mat.moulding, side * 1.56, 2.0, z + 1.83 + dz, .1, 3.11, .09);
      box(mat.moulding, side * 1.56, 3.59, z + 1.83, .13, .1, 1.29);
    }
  }

  // Spatial contract. Walkable heights are explicit; the upper area is reached
  // by using the narrow access door and then the modelled maintenance ladder.
  const naveStatic = colliders.slice(), archiveStatic = [], upperStatic = [], corridorStatic = [];
  furnitureCollider(naveStatic, -8.96, 0, .18, 32.4);
  furnitureCollider(naveStatic, 8.96, -12.44, .18, 7.51);
  furnitureCollider(naveStatic, 8.96, 5.01, .18, 22.31);
  furnitureCollider(naveStatic, 0, -16.04, 18.25, .18);
  furnitureCollider(naveStatic, -5.43, 16.05, 7.67, .2);
  furnitureCollider(naveStatic, 5.43, 16.05, 7.67, .2);
  furnitureCollider(naveStatic, 7.57, 14.91, 1.11, .32);
  furnitureCollider(archiveStatic, 12.78, -8.87, 2.45, 1.16);
  furnitureCollider(archiveStatic, 10.85, -5.15, 1.94, 1.11);
  furnitureCollider(archiveStatic, 14.66, -5.7, .84, 2.15);
  furnitureCollider(archiveStatic, 8.98, -9.53, .18, 1.85);
  furnitureCollider(archiveStatic, 8.98, -5.05, .18, 2.25);
  furnitureCollider(upperStatic, 3.33, 15.63, 1.9, .81);
  furnitureCollider(upperStatic, 0, 13.74, 2.2, .25);
  const archiveBarrier = { minX: 8.84, maxX: 9.2, minZ: -8.6, maxZ: -6.2 };
  const exitBarrier = { minX: -1.48, maxX: 1.48, minZ: 15.69, maxZ: 16.16 };
  const upperBarrier = { minX: 6.76, maxX: 8.3, minZ: 12.82, maxZ: 13.1 };
  const zones = {
    nave: { bounds: { minX: -8.73, maxX: 9.35, minZ: -15.72, maxZ: 16.48 }, floorY: 0, colliders },
    archive: { bounds: { minX: 8.5, maxX: 14.8, minZ: -9.94, maxZ: -4.42 }, floorY: 0, colliders: [] },
    upper: { bounds: { minX: -8.48, maxX: 8.48, minZ: 14.08, maxZ: 15.68 }, floorY: 5.21, colliders: upperStatic },
    corridor: { bounds: { minX: -1.3, maxX: 1.3, minZ: 15.85, maxZ: 44.2 }, floorY: 0, colliders: corridorStatic },
  };
  const points = [
    { id: 'seatB17', name: 'B17', x: -3.42, y: .7, z: 7.45, zone: 'nave', radius: 1.6 },
    { id: 'seatB18', name: 'B18', x: -2.44, y: .7, z: 7.45, zone: 'nave', radius: 1.6 },
    { id: 'programme', name: '座位下的节目单', x: -3.42, y: .15, z: 7.12, zone: 'nave', radius: 1.8 },
    { id: 'curtain', name: '窗帘绳扣', x: -8.35, y: 1.3, z: 3.8, zone: 'nave', radius: 1.8 },
    { id: 'window', name: '左侧彩窗', x: -7.75, y: 1.6, z: 0, zone: 'nave', radius: 2 },
    { id: 'organ', name: '演奏装置', x: -6.3, y: 1.3, z: -10.6, zone: 'nave', radius: 2.1 },
    { id: 'sideRoom', name: '右侧小门', x: 8.25, y: 1.5, z: -7.4, zone: 'nave', radius: 1.65 },
    { id: 'b17Ticket', name: 'B17票', x: 10.42, y: 1.02, z: -5.75, zone: 'archive', radius: 1.65 },
    { id: 'b18Ticket', name: 'B18票', x: 11.28, y: 1.02, z: -5.75, zone: 'archive', radius: 1.65 },
    { id: 'archive', name: '票据验证器', x: 12.78, y: 1.35, z: -8.13, zone: 'archive', radius: 1.9 },
    { id: 'seatLedger', name: '座位维护表', x: 14, y: 1.5, z: -5.45, zone: 'archive', radius: 1.6 },
    { id: 'upperDoor', name: '唱诗班维护窄门', x: 7.51, y: 1.5, z: 12.36, zone: 'nave', radius: 1.75 },
    { id: 'downstairs', name: '回到中殿', x: 7.45, y: 6.0, z: 14.62, zone: 'upper', radius: 1.35 },
    { id: 'tapePlayer', name: '磁带播放器', x: 3.33, y: 6.35, z: 14.86, zone: 'upper', radius: 1.85 },
    { id: 'clock', name: '时钟机械', x: 0, y: 7.1, z: 14.38, zone: 'upper', radius: 1.8 },
    { id: 'clock', name: '19:31', x: 0, y: 7.23, z: 13.45, zone: 'nave', radius: 2.5 },
    { id: 'stone', name: '旧石板', x: 7.3, y: .02, z: 2.7, zone: 'nave', radius: 1.6 },
    { id: 'exit', name: '主出口', x: 0, y: 1.6, z: 15.12, zone: 'nave', radius: 2 },
  ];
  const spawn = { seated: { x: -3.42, y: .69, z: 7.45 }, standing: { x: -3.42, y: 0, z: 6.25 } };
  const transitions = { upperEntry: { x: 7.35, y: 5.21, z: 14.65 }, lowerEntry: { x: 7.3, y: 0, z: 12 }, corridorEntry: { x: 0, y: 0, z: 16.8 } };
  function refreshColliders() {
    colliders.splice(0, colliders.length, ...naveStatic, ...(chapterState.sideRoomUnlocked ? [] : [archiveBarrier]), ...(exitIsOpen ? [] : [exitBarrier]), ...(chapterState.upperDoorUnlocked ? [] : [upperBarrier]));
    zones.archive.colliders.splice(0, zones.archive.colliders.length, ...archiveStatic, ...(chapterState.sideRoomUnlocked ? [] : [archiveBarrier]));
    corridorStatic.splice(0, corridorStatic.length, ...(exitIsOpen ? [] : [exitBarrier]));
  }
  function applyChapter(state = {}) {
    if (state.b18Altered && !chapterState.b18Altered && state.archiveInserted === 'B18') punchPulse = .4;
    chapterState = state;
    curtainTarget = state.curtainOpened || state.curtainStage === 'secured' ? 1 : state.curtainStage === 'raised' ? .55 : 0;
    curtainHook.visible = state.curtainStage === 'raised' || state.curtainStage === 'secured' || Boolean(state.curtainOpened);
    clasp.rotation.x = state.curtainStage && state.curtainStage !== 'latched' ? .7 : 0;
    programme.visible = !state.programmeCollected;
    tracing.visible = Boolean(state.programmeLit || state.tracingRevealed || state.windowInspected || state.patternRevealed) && curtainTarget > 0;
    sideDoorTarget = state.sideRoomUnlocked ? 1.45 : 0;
    drawerTarget = state.archiveDrawerSolved ? .57 : 0;
    b17Ticket.visible = !state.b17TicketCollected; b18Ticket.visible = !state.b18TicketCollected;
    archiveKey.visible = !state.brassKeyCollected && !state.keyCollected;
    drawerTape.visible = !state.tapeCollected; tapeLabel.visible = !state.tapeCollected;
    watermark.visible = Boolean(state.tapeCompleted);
    stoneMark.visible = Boolean(state.tapeCompleted && state.inspectedSeatLedger);
    if (state.tapeCompleted && !lastTapeComplete) { b18Transient = Boolean(state.b18Altered); b18Seen = false; }
    if (!state.tapeCompleted) { b18Transient = false; b18Seen = false; }
    lastTapeComplete = Boolean(state.tapeCompleted);
    const inserted = state.archiveInserted || state.insertedTicket || state.validatorTicket;
    ticketSlip.visible = inserted === 'B17' || inserted === 'B18';
    insertedB17.visible = inserted === 'B17'; insertedB18.visible = inserted === 'B18';
    punchedHoles.visible = inserted === 'B17' || (inserted === 'B18' && Boolean(state.b18Altered));
    projectedMarks.visible = Boolean(state.archiveLampOn || state.validatorLampOn || state.lampOn) && (inserted === 'B17' || (state.b18Altered && inserted === 'B18'));
    validatorLamp.intensity = state.archiveLampOn || state.validatorLampOn || state.lampOn ? 3 : 0;
    const dialState = state.archiveDials || state.validatorDials || state.dials;
    if (Array.isArray(dialState)) verifierDials.forEach((wheel, i) => { const value = typeof dialState[i] === 'number' ? dialState[i] : Math.max(0, dialSymbols[i].indexOf(dialState[i])); wheel.rotation.z = -value * Math.PI * 2 / 3; });
    upperDoor.rotation.y = state.upperDoorUnlocked ? -.65 : 0;
    exitIsOpen = Boolean(state.exitOpened && !state.corridorEntered);
    exitLinkage.rotation.z = state.exitUnlocked ? .18 : 0;
    refreshColliders();
  }
  function setTape(seconds, playing, timeCode) {
    tapeSeconds = Math.max(0, Math.min(35, Number(seconds) || 0));
    if (tapePlaying && !playing && (chapterState.tapeEarlyStops || chapterState.earlyTapeStops || 0) >= 2) tapeInertia = 1.7;
    tapePlaying = Boolean(playing);
    const totalSeconds = 19 * 3600 + 30 * 60 + 35 + Math.floor(tapeSeconds);
    const code = timeCode || `${String(Math.floor(totalSeconds / 3600)).padStart(2, '0')}:${String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
    if (tapeDisplayCode !== code) {
      const ctx = timeCanvas.getContext('2d'); ctx.fillStyle = '#24222a'; ctx.fillRect(0, 0, 512, 96); ctx.fillStyle = '#bdb8cc'; ctx.font = '58px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(code, 256, 50); timeMaterial.map.needsUpdate = true; tapeDisplayCode = code;
    }
  }
  function getZoneAt(x, z, current = 'nave') {
    if (current === 'upper') return 'upper';
    if (z > 16.28 && Math.abs(x) < 1.65) return 'corridor';
    if (x > 9.14 && z > -10.2 && z < -4.15) return 'archive';
    return 'nave';
  }
  function updateChapter(dt, time) {
    const delta = Math.min(dt || .016, .1);
    curtainProgress = THREE.MathUtils.damp(curtainProgress, curtainTarget, 1.7, delta);
    for (const panel of curtainPanels) {
      const opening = panel.userData.side < 0 ? curtainProgress : 0;
      panel.scale.x = 1 - opening * .81;
      panel.position.x = panel.userData.leafSide * panel.userData.width * (.25 + opening * .2);
    }
    const daylight = curtainProgress * introFade;
    ambient.intensity = (.31 + .72 * curtainProgress) * introFade;
    frontFill.intensity = (.075 + .405 * curtainProgress) * introFade;
    keyLight.intensity = 2.7 * daylight; crossLight.intensity = 110 * daylight;
    glassMat.emissiveIntensity = .018 + .382 * daylight;
    stainedBase.emissiveIntensity = .015 + .48 * daylight;
    paneGlint.intensity = 3.8 * daylight;
    windowLights.forEach(light => { light.intensity = 15 * daylight; });
    naturalShafts.forEach(object => { object.material.uniforms.uOpacity.value = object.userData.baseOpacity * daylight; });
    dust.visible = daylight > .06;
    altarLight.intensity = (1.8 + Math.sin(time * 5.1) * .09) * introFade;
    deskLight.intensity = 0;
    archiveAmbient.intensity = (chapterState.sideRoomUnlocked ? 6.5 : 2) * introFade;
    upperLight.intensity = 5.5 * introFade;
    validatorLamp.intensity = (chapterState.archiveLampOn || chapterState.validatorLampOn || chapterState.lampOn ? 3 : 0) * introFade;
    corridorLights.forEach(light => { light.intensity = light.userData.baseIntensity * introFade; });
    flameMaterial.opacity = .7 * introFade;
    timeMaterial.emissiveIntensity = .45 * introFade;
    sideRoomDoor.rotation.y = THREE.MathUtils.damp(sideRoomDoor.rotation.y, -Math.PI / 2 + sideDoorTarget, 2.3, delta);
    archiveDrawer.position.z = THREE.MathUtils.damp(archiveDrawer.position.z, .46 + drawerTarget, 3, delta);
    punchPulse = Math.max(0, punchPulse - delta); punch.position.y = 1.42 - Math.sin(punchPulse * Math.PI / .4) * .065;
    windowFlash = Math.max(0, windowFlash - delta); slitFlash = Math.max(0, slitFlash - delta);
    colourLeak.material.opacity = windowFlash > 0 ? Math.min(1, windowFlash * 12) * .78 * introFade : 0;
    slit.material.color.set(slitFlash > 0 ? '#deb37e' : '#928b9f'); slit.material.opacity = (slitFlash > 0 ? .94 : .35) * introFade;
    slitGlow.intensity = slitFlash > 0 ? 8 * Math.min(1, slitFlash * 10) * introFade : 0;
    tapeInertia = Math.max(0, tapeInertia - delta);
    const reelSpeed = tapePlaying ? 2.25 : tapeInertia * 1.35;
    tapeReels.forEach((reel, i) => { reel.rotation.z -= delta * reelSpeed * (i ? .9 : 1.08); });
    const positions = b18Cushion.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const j = i * 3, orig = b18Original[j + 1];
      const depression = b18Transient && orig > 0 ? .016 * Math.exp(-((b18Original[j] / .3) ** 2 + (b18Original[j + 2] / .24) ** 2)) : 0;
      positions.setY(i, THREE.MathUtils.damp(positions.getY(i), orig - depression, 2.4, delta));
    }
    positions.needsUpdate = true;
    if (doorAttempt > 0) { doorAttempt = Math.max(0, doorAttempt - delta); door.rotation.y = Math.sin(doorAttempt * 39) * .012 * doorAttempt; doorHandle.rotation.z = Math.sin(doorAttempt * Math.PI / .6) * -.23; doorHandleRing.rotation.x = Math.sin(doorAttempt * Math.PI / .6) * .34; }
    else { door.rotation.y = THREE.MathUtils.damp(door.rotation.y, exitIsOpen ? -1.48 : 0, 1.5, delta); doorHandle.rotation.z = 0; doorHandleRing.rotation.x = 0; }
  }
  applyChapter({}); setTape(0, false);

  // Consolidate the many fixed chapter trims, furniture boards and gear teeth
  // into the existing GPU batches. Objects with state-driven movement or
  // visibility remain separate so their interactions are never baked away.
  world.updateMatrixWorld(true);
  const dynamicRoots = new Set([door, mirror, journal, key, sideRoomDoor, upperDoor, archiveDrawer, archiveKey, programme, b17Ticket, b18Ticket, ticketSlip, punch, seatB18, colourLeak, slit, curtainHook, clasp, exitLinkage, ...tapeReels]);
  const staticChapterBoxes = [];
  world.traverse(object => {
    if (!object.isMesh || object.geometry !== boxGeometry) return;
    for (let ancestor = object; ancestor && ancestor !== world; ancestor = ancestor.parent) if (dynamicRoots.has(ancestor) || !ancestor.visible) return;
    staticChapterBoxes.push(object);
  });
  for (const object of staticChapterBoxes) {
    const batchKey = boxGeometry.uuid + object.material.uuid;
    if (!batches.has(batchKey)) batches.set(batchKey, { geometry: boxGeometry, material: object.material, matrices: [] });
    batches.get(batchKey).matrices.push(object.matrixWorld.clone()); object.removeFromParent();
  }

  // All repeated architectural pieces share GPU draw calls by geometry/material pair.
  for (const { geometry, material, matrices } of batches.values()) {
    const batch = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, i) => batch.setMatrixAt(i, matrix));
    batch.castShadow = true; batch.receiveShadow = true; batch.instanceMatrix.needsUpdate = true; world.add(batch);
  }
  let escaped = false, mirrorTarget = -.5, beamAligned = false;
  const update = (dt, time) => {
    const t = Number.isFinite(time) ? time : performance.now() / 1000;
    for (let i = 0; i < dustCount; i++) {
      const p = dustBase[i], j = i * 3;
      dustPositions[j] = p.x + Math.sin(t * .14 + p.phase) * .12;
      dustPositions[j + 1] = .25 + ((p.y + t * p.speed) % 10.5);
      dustPositions[j + 2] = p.z + Math.cos(t * .11 + p.phase) * .13;
    }
    dustGeometry.attributes.position.needsUpdate = true;
    for (let i = 0; i < flames.length; i++) { const flicker = 1 + Math.sin(t * 8.7 + i * 2.1) * .11 + Math.sin(t * 13.1 + i) * .065; flames[i].scale.y = .069 * flicker; }
    altarLight.intensity = 7 + Math.sin(t * 5.1) * .35;
    mirror.rotation.y = THREE.MathUtils.damp(mirror.rotation.y, mirrorTarget, 4, Math.min(dt || .016, .1));
    reflectedLight.intensity = 0; revealedKeyLight.intensity = 0;
    updateChapter(dt, t);
  };
  return {
    world, colliders, update, door, mirror, altar, organ, journal, key,
    chapter, points, zones, spawn, transitions, clock, clockMechanism, tapePlayer, tapeReels, programme, seatB17, seatB18, sideRoomDoor, upperDoor, archiveDrawer,
    applyChapter, getZoneAt, setTape,
    setCurtain: open => { curtainTarget = open ? 1 : 0; },
    setIntroFade: level => { introFade = THREE.MathUtils.clamp(Number(level) || 0, 0, 1); world.visible = introFade > .0001; updateChapter(.001, 0); },
    flashColor: kind => { if (kind === 'window') windowFlash = .72; else if (kind === 'slit' || kind === 'smallWindow') slitFlash = 1; },
    setDoorAttempt: () => { if (!exitIsOpen) doorAttempt = .6; },
    setExitOpen: open => { exitIsOpen = Boolean(open); refreshColliders(); },
    setB18Observed: observed => { if (observed) b18Seen = true; else if (b18Seen) b18Transient = false; },
    get doorOpening() { return Math.abs(door.rotation.y) / 1.48; },
    get curtainOpening() { return curtainProgress; },
    setMirror: angleDegrees => { mirrorTarget = -.5 + THREE.MathUtils.degToRad(angleDegrees - 30); },
    setBeamAligned: () => {},
    setEscaped: value => { escaped = Boolean(value); exitIsOpen = escaped; refreshColliders(); },
    bounds: zones.nave.bounds,
  };
}
