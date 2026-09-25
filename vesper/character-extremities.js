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

// Short, bent fingers use one continuous cubic centreline. Closest-point
// refinement avoids the small ridges left by a union of straight capsules.
function curvedFinger(points, zScale = 1.2) {
  const coefficients = [0, 1, 2, 3].map(axis => {
    const v = points.map(p => p[axis] / (axis === 2 ? zScale : 1));
    return [v[0], 3 * (v[1] - v[0]), 3 * (v[2] - 2 * v[1] + v[0]),
      v[3] - 3 * v[2] + 3 * v[1] - v[0]];
  });
  const sample = (axis, t) => {
    const c = coefficients[axis];
    return c[0] + t * (c[1] + t * (c[2] + t * c[3]));
  };
  const segments = [];
  for (let i = 0; i < 14; i++) {
    const t = i / 14, t1 = (i + 1) / 14;
    const ax = sample(0, t), ay = sample(1, t), az = sample(2, t);
    const bx = sample(0, t1) - ax, by = sample(1, t1) - ay, bz = sample(2, t1) - az;
    segments.push({ ax, ay, az, bx, by, bz, t,
      denominator: bx * bx + by * by + bz * bz });
  }
  return (x, y, z) => {
    z /= zScale;
    let nearestT = 0, nearestD2 = Infinity;
    for (const s of segments) {
      const px = x - s.ax, py = y - s.ay, pz = z - s.az;
      const h = Math.max(0, Math.min(1, (px * s.bx + py * s.by + pz * s.bz) / s.denominator));
      const dx = px - s.bx * h, dy = py - s.by * h, dz = pz - s.bz * h;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < nearestD2) { nearestD2 = d2; nearestT = s.t + h / 14; }
    }
    for (let iteration = 0; iteration < 3; iteration++) {
      let first = 0, second = 0;
      for (let axis = 0; axis < 3; axis++) {
        const c = coefficients[axis], t = nearestT;
        const residual = sample(axis, t) - (axis === 0 ? x : axis === 1 ? y : z);
        const derivative = c[1] + t * (2 * c[2] + t * 3 * c[3]);
        const derivative2 = 2 * c[2] + t * 6 * c[3];
        first += residual * derivative;
        second += derivative * derivative + residual * derivative2;
      }
      if (second <= 1e-10) break;
      const step = Math.max(-0.12, Math.min(0.12, first / second));
      const t = Math.max(0, Math.min(1, nearestT - step));
      if (Math.abs(t - nearestT) < 1e-7) { nearestT = t; break; }
      nearestT = t;
    }
    return Math.hypot(x - sample(0, nearestT), y - sample(1, nearestT),
      z - sample(2, nearestT)) - sample(3, nearestT);
  };
}

function finish(geometry, name) {
  delete geometry.userData.sourceWeights;
  delete geometry.userData.sourceFieldCount;
  geometry.name = name;
  return geometry;
}

/**
 * A fleshy soft palm with three short bent fingers and a relaxed opposing thumb.
 * Wrist origin, fingers toward +X, palm facing +Z. Dimensions in metres.
 * Each call returns independently editable geometry, cached only internally.
 */
export function createHandGeometry() {
  if (!handTemplate) {
    const fields = [
      { distance: ellipsoid(0.033, -0.002, 0, 0.064, 0.061, 0.0245) },
      { distance: ellipsoid(-0.007, -0.002, -0.001, 0.034, 0.036, 0.0225) },
    ];
    // Use the main hands-on-belly reference consistently: one thumb and three
    // unequal, short rounded fingers. The palm is not scaled down with them.
    const fingers = [
      { y: -0.037, end: 0.113, spread: -0.004, radius: 0.0170, curl: -0.007 },
      { y: -0.001, end: 0.132, spread: -0.001, radius: 0.0180, curl: -0.009 },
      { y: 0.034, end: 0.122, spread: 0.004, radius: 0.0175, curl: -0.006 },
    ];
    for (const finger of fingers) {
      const { y, end, radius, spread, curl } = finger;
      fields.push({ distance: curvedFinger([
        [0.039, y * 0.78, 0.002, radius * 1.18],
        [0.081, y * 0.98, 0.007, radius * 1.12],
        [end - 0.016, y + spread, 0.003, radius],
        [end, y + spread * 0.7, curl, radius * 0.94],
      ], 1.20) });
    }
    fields.push({ distance: curvedFinger([
      [0.012, 0.027, 0.002, 0.0215],
      [0.029, 0.053, 0.005, 0.0220],
      [0.060, 0.077, 0.002, 0.0200],
      [0.080, 0.078, -0.004, 0.0185],
    ], 1.12) });

    handTemplate = finish(createSoftUnionGeometry({
      fields,
      bounds: { min: [-0.052, -0.080, -0.043], max: [0.194, 0.115, 0.047] },
      step: 0.0036,
      smoothness: 0.009,
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
    // Lower the overfull instep by 20% through its middle while retaining the
    // ankle height, grounded sole, and rounded toe volumes.
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i);
      const y = positions.getY(i);
      const riseT = Math.max(0, Math.min(1, (z - 0.018) / 0.072));
      const fallT = Math.max(0, Math.min(1, (z - 0.218) / 0.117));
      const rise = riseT * riseT * (3 - 2 * riseT);
      const fall = fallT * fallT * (3 - 2 * fallT);
      const riseDerivative = 6 * riseT * (1 - riseT) / 0.072;
      const fallDerivative = 6 * fallT * (1 - fallT) / 0.117;
      const heightScale = 1 + 0.04 * rise * (1 - fall);
      const heightDerivative = 0.04 * (riseDerivative * (1 - fall) - rise * fallDerivative);
      positions.setY(i, y * heightScale);
      const nx = normals.getX(i);
      const ny = normals.getY(i) / heightScale;
      const nz = normals.getZ(i) - y * heightDerivative * ny;
      const inverseLength = 1 / Math.hypot(nx, ny, nz);
      normals.setXYZ(i, nx * inverseLength, ny * inverseLength, nz * inverseLength);
    }

    // Extend the forefoot only: smoothstep leaves the ankle and rear heel
    // unchanged and has zero derivative at both transition endpoints.
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i);
      const t = Math.max(0, Math.min(1, z / 0.08));
      const blend = t * t * (3 - 2 * t);
      const blendDerivative = 6 * t * (1 - t) / 0.08;
      const derivative = 1 + 0.14 * (blend + z * blendDerivative);
      positions.setZ(i, z * (1 + 0.14 * blend));
      const nx = normals.getX(i), ny = normals.getY(i);
      const nz = normals.getZ(i) / derivative;
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
