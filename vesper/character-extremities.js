import { createSoftUnionGeometry } from './sculpt-union.js';

let handTemplate;
let footTemplate;

function smoothMin(a, b, amount) {
  if (amount <= 0) return Math.min(a, b);
  const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / amount));
  return b * (1 - h) + a * h - amount * h * (1 - h);
}

function ellipsoid(cx, cy, cz, rx, ry, rz) {
  return (x, y, z) => {
    const qx = x - cx, qy = y - cy, qz = z - cz;
    const k0 = Math.hypot(qx / rx, qy / ry, qz / rz);
    const k1 = Math.hypot(qx / (rx * rx), qy / (ry * ry), qz / (rz * rz));
    return k1 > 1e-12 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
  };
}

// A rounded finger follows a softly bent centreline, with radius tapering at
// each joint. Flattening the Z metric gives flesh thickness without ball joints.
function curvedFinger(points, zScale = 1.2) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const ax = a[0], ay = a[1], az = a[2] / zScale;
    const bx = b[0] - ax, by = b[1] - ay, bz = b[2] / zScale - az;
    segments.push({ ax, ay, az, bx, by, bz, denominator: bx * bx + by * by + bz * bz,
      radius: a[3], radiusChange: b[3] - a[3] });
  }
  return (x, y, z) => {
    let distance = Infinity;
    const scaledZ = z / zScale;
    for (const s of segments) {
      const px = x - s.ax, py = y - s.ay, pz = scaledZ - s.az;
      const t = Math.max(0, Math.min(1,
        (px * s.bx + py * s.by + pz * s.bz) / s.denominator));
      const d = Math.hypot(px - s.bx * t, py - s.by * t, pz - s.bz * t) -
        (s.radius + s.radiusChange * t);
      distance = Math.min(distance, d);
    }
    return distance;
  };
}

function finish(geometry, name) {
  delete geometry.userData.sourceWeights;
  delete geometry.userData.sourceFieldCount;
  geometry.name = name;
  return geometry;
}

/**
 * A flattened soft palm with four short rounded fingers and a relaxed open thumb.
 * Wrist origin, fingers toward +X, palm facing +Z. Dimensions in metres.
 * Each call returns independently editable geometry, cached only internally.
 */
export function createHandGeometry() {
  if (!handTemplate) {
    const fields = [
      { distance: ellipsoid(0.033, -0.004, 0, 0.063, 0.059, 0.0205) },
      { distance: ellipsoid(-0.007, -0.002, -0.001, 0.034, 0.036, 0.0225) },
    ];
    const fingers = [
      { y: -0.044, end: 0.136, spread: -0.003, radius: 0.0116 },
      { y: -0.015, end: 0.156, spread: -0.001, radius: 0.0128 },
      { y: 0.015, end: 0.166, spread: 0.001, radius: 0.0131 },
      { y: 0.044, end: 0.153, spread: 0.003, radius: 0.0121 },
    ];
    for (const finger of fingers) {
      const y = finger.y;
      const end = 0.070 + (finger.end - 0.070) * 0.8;
      const radius = finger.radius * 1.15;
      fields.push({ distance: curvedFinger([
        [0.040, y * 0.76, 0.002, radius * 1.19],
        [0.088, y, 0.006, radius * 1.08],
        [end - 0.022, y + finger.spread, 0.004, radius],
        [end, y + finger.spread, -0.001, radius * 0.9],
      ], 1.26) });
    }
    fields.push({ distance: curvedFinger([
      [0.014, 0.034, 0.002, 0.020],
      [0.036, 0.057, 0.003, 0.019],
      [0.061, 0.079, 0.002, 0.0175],
      [0.084, 0.093, 0.000, 0.016],
    ], 1.12) });

    handTemplate = finish(createSoftUnionGeometry({
      fields,
      bounds: { min: [-0.052, -0.080, -0.043], max: [0.194, 0.115, 0.047] },
      step: 0.0049,
      smoothness: 0.0045,
    }), 'SculptedPalmAndFingers');
    handTemplate.computeBoundingBox();
  }
  return handTemplate.clone();
}

/**
 * A broad, weight-bearing three-toed foot. The ankle sits over the heel at
 * X=0, Z=0; +Z points forward. The flat sole is exactly Y=0.
 */
export function createFootGeometry() {
  if (!footTemplate) {
    const parts = [
      ellipsoid(0, 0.043, 0.047, 0.107, 0.044, 0.135),
      ellipsoid(0, 0.044, -0.030, 0.070, 0.047, 0.065),
      ellipsoid(0, 0.088, -0.018, 0.046, 0.062, 0.046),
      ellipsoid(0, 0.044, 0.110, 0.104, 0.038, 0.086),
      ellipsoid(-0.072, 0.036, 0.153, 0.034, 0.030, 0.067),
      ellipsoid(0, 0.037, 0.168, 0.035, 0.031, 0.067),
      ellipsoid(0.072, 0.036, 0.153, 0.034, 0.030, 0.067),
    ];
    // The full union is clipped once. Clipping every part individually would
    // let soft-min blending push their shared sole beneath the ground plane.
    function footDistance(x, y, z) {
      let distance = parts[0](x, y, z);
      for (let i = 1; i < parts.length; i++) {
        distance = smoothMin(distance, parts[i](x, y, z), i < 4 ? 0.012 : 0.010);
      }
      // Narrow open-ended cuts preserve readable toes from the front and top,
      // while ending inside the forefoot as natural rounded interdigital webs.
      for (const gapX of [-0.036, 0.036]) {
        const longitudinal = Math.max(0, 0.194 - z);
        const groove = Math.hypot(x - gapX, longitudinal) - 0.0043;
        distance = -smoothMin(-distance, groove, 0.0035);
      }
      return -smoothMin(-distance, y - 0.002, 0.004);
    }
    footTemplate = finish(createSoftUnionGeometry({
      fields: [{ distance: footDistance }],
      bounds: { min: [-0.127, -0.020, -0.105], max: [0.127, 0.165, 0.258] },
      step: 0.0056,
      smoothness: 0,
    }), 'SculptedThreeToeFoot');
    footTemplate.computeBoundingBox();
    footTemplate.translate(0, -footTemplate.boundingBox.min.y, 0);
    // Lengthen the weight-bearing forefoot without moving the ankle origin.
    // A smooth varying longitudinal scale avoids a kink at Z=0 and keeps the
    // rear heel compact; transform normals with the inverse Jacobian.
    const positions = footTemplate.attributes.position;
    const normals = footTemplate.attributes.normal;
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i);
      const t = Math.tanh(z / 0.04);
      const scale = 1.1425 + 0.3025 * t;
      const derivative = scale + z * 0.3025 / 0.04 * (1 - t * t);
      positions.setXYZ(i, positions.getX(i) * 1.13, positions.getY(i), z * scale);
      const nx = normals.getX(i) / 1.13;
      const ny = normals.getY(i);
      const nz = normals.getZ(i) / derivative;
      const inverseLength = 1 / Math.hypot(nx, ny, nz);
      normals.setXYZ(i, nx * inverseLength, ny * inverseLength, nz * inverseLength);
    }
    // Give the instep a fleshy slope into the forefoot, while preserving the
    // grounded sole, ankle height, and low rounded toe tips.
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i);
      const y = positions.getY(i);
      const riseT = Math.max(0, Math.min(1, (z - 0.018) / 0.072));
      const fallT = Math.max(0, Math.min(1, (z - 0.218) / 0.117));
      const rise = riseT * riseT * (3 - 2 * riseT);
      const fall = fallT * fallT * (3 - 2 * fallT);
      const riseDerivative = 6 * riseT * (1 - riseT) / 0.072;
      const fallDerivative = 6 * fallT * (1 - fallT) / 0.117;
      const heightScale = 1 + 0.3 * rise * (1 - fall);
      const heightDerivative = 0.3 * (riseDerivative * (1 - fall) - rise * fallDerivative);
      positions.setY(i, y * heightScale);
      const nx = normals.getX(i);
      const ny = normals.getY(i) / heightScale;
      const nz = normals.getZ(i) - y * heightDerivative * ny;
      const inverseLength = 1 / Math.hypot(nx, ny, nz);
      normals.setXYZ(i, nx * inverseLength, ny * inverseLength, nz * inverseLength);
    }
    positions.needsUpdate = true;
    normals.needsUpdate = true;
    footTemplate.computeBoundingBox();
    footTemplate.computeBoundingSphere();
  }
  return footTemplate.clone();
}
