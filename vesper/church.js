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
    box(mat.plaster, side * 9.15, 3.4, 0, .35, 6.8, 32.6);
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-16.3, 6.8); wallShape.lineTo(16.3, 6.8); wallShape.lineTo(16.3, 13.2); wallShape.lineTo(-16.3, 13.2); wallShape.closePath();
    for (const z of windowZ) {
      const hole = new THREE.Path(); hole.moveTo(z - 1.1, 7.1); hole.lineTo(z + 1.1, 7.1); hole.lineTo(z + 1.1, 10.45);
      hole.absarc(z, 10.45, 1.1, 0, Math.PI, false); hole.lineTo(z - 1.1, 7.1); wallShape.holes.push(hole);
    }
    const wall = mesh(new THREE.ExtrudeGeometry(wallShape, { depth: .35, bevelEnabled: false, curveSegments: 24 }), mat.plaster);
    wall.rotation.y = Math.PI / 2; wall.position.x = side * 9.0;
    // Skirting and low wainscot mouldings; damp staining is in the plaster map.
    for (const [y, h, d] of [[.12, .24, .18], [.36, .08, .1], [2.45, .06, .08], [4.82, .15, .18]]) box(mat.moulding, side * 8.87, y, 0, d, h, 32.1);
    for (let z = -14.6; z <= 14.6; z += 2.9) {
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
    box(mat.blackMetal, side * 8.73, .65, z, .13, .55, 1.9);
    for (let n = 0; n < 16; n++) box(mat.stone, side * 8.62, .65, z - .85 + n * .115, .13, .63, .046);
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
    ctx.font = '22px Georgia'; ctx.fillText('IV  ·  II  ·  V  ·  I', s / 2, 170);
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
  directBox(door, mat.brass, 2.42, 1.63, -.19, .09, .26, .075);
  torus(mat.brass, 2.42, 1.64, -.25, .093, .02, 0, 0, door);
  for (const x of [-1.54, 1.54]) box(mat.moulding, x, 1.9, 15.8, .28, 3.83, .42);
  for (const [y, w] of [[3.89, 3.5], [4.08, 3.7]]) box(mat.moulding, 0, y, 15.79, w, .17, .55);
  const outside = mesh(new THREE.PlaneGeometry(2.83, 3.66), new THREE.MeshBasicMaterial({ color: '#b0a6c4' })); outside.position.set(0, 1.83, 16.18); outside.rotation.y = Math.PI;

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
  const ambient = new THREE.HemisphereLight('#b8adc8', '#352338', 1.03); scene.add(ambient);
  const frontFill = new THREE.DirectionalLight('#aaa0bd', .48); frontFill.position.set(-4, 10, 8); scene.add(frontFill);
  const keyLight = new THREE.DirectionalLight('#d8d8ed', 2.7); keyLight.position.set(14, 14.8, -6.6); keyLight.target.position.set(-1, 5.6, -15.2); keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.camera.left = -20; keyLight.shadow.camera.right = 20; keyLight.shadow.camera.top = 18; keyLight.shadow.camera.bottom = -18; keyLight.shadow.camera.near = .1; keyLight.shadow.camera.far = 55;
  keyLight.shadow.normalBias = .035; keyLight.shadow.bias = -.0001; keyLight.shadow.radius = 3; scene.add(keyLight, keyLight.target);
  const altarLight = new THREE.PointLight('#e6bd8c', 7, 6, 2); altarLight.position.set(0, 1.6, -13.5); scene.add(altarLight);
  const deskLight = new THREE.PointLight('#e5bd92', 2.8, 3.5, 2); deskLight.position.set(-7.7, 1.35, 9.9); scene.add(deskLight);
  // Soft diffuse window contribution, without the cost of ten additional shadow maps.
  for (const z of [-11.6, -5.8, 5.8, 11.6]) {
    const fill = new THREE.PointLight('#a69ebf', 15, 16, 2); fill.position.set(8.1, 8.4, z); scene.add(fill);
  }
  const crossLight = new THREE.SpotLight('#dbd7ee', 110, 25, .25, .85, 1.7); crossLight.position.set(8.4, 9.5, -9.6); crossLight.target.position.set(0, 7.2, -15.4); scene.add(crossLight, crossLight.target);

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
  shaft([8.87, 9.8, -11.45], [-3.2, 4.4, -15.45], 1.8, .055);
  shaft([8.84, 8.1, -10.94], [-4.6, 1.1, -15.05], .5, .06);
  shaft([8.84, 10.1, -5.7], [-5.1, .35, -11.6], 2.0, .055);
  shaft([8.84, 8.8, .25], [-5.4, .25, -7.1], 1.7, .042);
  shaft([8.84, 9.7, 6.02], [-5.5, .25, -1.7], 1.8, .038);
  shaft([8.84, 9.1, 11.75], [-4.9, .3, 4.1], 1.6, .035);
  const reflectedShafts = shaft([7.4, 1.79, -6.1], [0, 7.2, -15.28], .19, .23);
  reflectedShafts.forEach(o => { o.visible = false; });
  const reflectedLight = new THREE.SpotLight('#d6d3fb', 0, 18, .065, .4, 1.2);
  reflectedLight.position.set(7.4, 1.79, -6.1); reflectedLight.target.position.set(0, 7.2, -15.28); scene.add(reflectedLight, reflectedLight.target);
  const revealedKeyLight = new THREE.PointLight('#ded0ae', 0, 3, 2); revealedKeyLight.position.set(0, 1.55, -13.1); scene.add(revealedKeyLight);
  // Sparse drifting motes remain small in world space and become visible in the shafts.
  const dustCount = 900;
  const dustRays = [
    [[8.87, 9.8, -11.45], [-3.2, 4.4, -15.45]],
    [[8.84, 10.1, -5.7], [-5.1, .35, -11.6]],
    [[8.84, 8.8, .25], [-5.4, .25, -7.1]],
    [[8.84, 9.7, 6.02], [-5.5, .25, -1.7]],
    [[8.84, 9.1, 11.75], [-4.9, .3, 4.1]],
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
    door.rotation.y = THREE.MathUtils.damp(door.rotation.y, escaped ? -1.45 : 0, 1.7, Math.min(dt || .016, .1));
    reflectedLight.intensity = THREE.MathUtils.damp(reflectedLight.intensity, beamAligned ? 45 : 0, 3, Math.min(dt || .016, .1));
    revealedKeyLight.intensity = THREE.MathUtils.damp(revealedKeyLight.intensity, beamAligned ? 5 : 0, 3, Math.min(dt || .016, .1));
  };
  return {
    world, colliders, update, door, mirror, altar, organ, journal, key,
    setMirror: angleDegrees => { mirrorTarget = -.5 + THREE.MathUtils.degToRad(angleDegrees - 30); },
    setBeamAligned: value => { beamAligned = Boolean(value); reflectedShafts.forEach(o => { o.visible = beamAligned; }); },
    setEscaped: value => { escaped = Boolean(value); },
    bounds: { minX: -8.5, maxX: 8.5, minZ: -15.2, maxZ: 15.1 },
  };
}
