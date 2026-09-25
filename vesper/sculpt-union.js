import * as THREE from 'three';

// Six tetrahedra share the 0–6 cube diagonal. The same split is used in every
// cell, so adjacent cubes agree on their shared face diagonals.
const TETRAHEDRA = [
  [0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6],
  [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6],
];

/**
 * Build a watertight, smoothly shaded zero isosurface from signed distance
 * fields (negative inside). Bounds must contain the complete surface with
 * at least one positive sample outside it.
 *
 * fields: [{ distance(x, y, z): number, bounds?: { min, max } }]
 * sourceWeights is a vertex-major Float32Array with fields.length weights per
 * vertex. It lives in userData, not in a custom GLTF vertex attribute.
 *
 * Field-local bounds are deliberately not used to omit evaluations: arbitrary
 * distance callbacks need not be exact SDFs, and a soft union can extend beyond
 * either original zero surface.
 */
export function createSoftUnionGeometry({
  fields,
  bounds,
  step = 0.012,
  smoothness = 0.035,
}) {
  if (!Array.isArray(fields) || fields.length === 0 ||
      fields.some((field) => typeof field.distance !== 'function')) {
    throw new TypeError('createSoftUnionGeometry: fields must contain distance callbacks.');
  }
  if (!bounds || !Array.isArray(bounds.min) || !Array.isArray(bounds.max) ||
      bounds.min.length !== 3 || bounds.max.length !== 3 ||
      bounds.min.some((value, axis) => !Number.isFinite(value) ||
        !Number.isFinite(bounds.max[axis]) || value >= bounds.max[axis])) {
    throw new RangeError('createSoftUnionGeometry: bounds must be finite, increasing XYZ arrays.');
  }
  if (!Number.isFinite(step) || step <= 0 ||
      !Number.isFinite(smoothness) || smoothness < 0) {
    throw new RangeError('createSoftUnionGeometry: step must be positive and smoothness nonnegative.');
  }

  const fieldCount = fields.length;
  const callbacks = fields.map((field) => field.distance.bind(field));
  const min = bounds.min;
  const cellsX = Math.ceil((bounds.max[0] - min[0]) / step);
  const cellsY = Math.ceil((bounds.max[1] - min[1]) / step);
  const cellsZ = Math.ceil((bounds.max[2] - min[2]) / step);
  const nx = cellsX + 1;
  const ny = cellsY + 1;
  const nz = cellsZ + 1;
  const strideZ = nx * ny;
  const sampleCount = strideZ * nz;
  if (!Number.isSafeInteger(sampleCount) || sampleCount > 32_000_000) {
    throw new RangeError('createSoftUnionGeometry: grid is too large; increase step.');
  }
  const dx = (bounds.max[0] - min[0]) / cellsX;
  const dy = (bounds.max[1] - min[1]) / cellsY;
  const dz = (bounds.max[2] - min[2]) / cellsZ;
  const scalarGrid = new Float32Array(sampleCount);
  const k = smoothness;

  function checkedDistance(callback, x, y, z) {
    const value = callback(x, y, z);
    if (!Number.isFinite(value)) {
      throw new RangeError('createSoftUnionGeometry: non-finite distance at ' + [x, y, z].join(', '));
    }
    return value;
  }

  function scalar(x, y, z) {
    let distance = checkedDistance(callbacks[0], x, y, z);
    for (let i = 1; i < fieldCount; i++) {
      const next = checkedDistance(callbacks[i], x, y, z);
      if (k === 0) {
        distance = Math.min(distance, next);
      } else {
        const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (next - distance) / k));
        distance = next * (1 - h) + distance * h - k * h * (1 - h);
      }
    }
    return distance;
  }

  let sampleIndex = 0;
  for (let iz = 0; iz < nz; iz++) {
    const z = min[2] + iz * dz;
    for (let iy = 0; iy < ny; iy++) {
      const y = min[1] + iy * dy;
      for (let ix = 0; ix < nx; ix++) {
        scalarGrid[sampleIndex++] = scalar(min[0] + ix * dx, y, z);
      }
    }
  }

  const positions = [];
  const normals = [];
  const indices = [];
  const sourceWeights = [];
  const edgeVertices = new Map();
  const vertexWeights = new Float64Array(fieldCount);
  // A numeric undirected edge key remains exact at the maximum supported grid.
  const edgeKeyStride = sampleCount;
  const gradientStep = Math.min(dx, dy, dz) * 0.1;
  const maxProjection = Math.min(dx, dy, dz) * 0.3;
  const gradient = new Float64Array(3);
  let needsNormalFallback = false;

  function sampleGradient(x, y, z) {
    const e = gradientStep;
    const inverseSpan = 0.5 / e;
    gradient[0] = (scalar(x + e, y, z) - scalar(x - e, y, z)) * inverseSpan;
    gradient[1] = (scalar(x, y + e, z) - scalar(x, y - e, z)) * inverseSpan;
    gradient[2] = (scalar(x, y, z + e) - scalar(x, y, z - e)) * inverseSpan;
  }

  function appendWeights(x, y, z) {
    vertexWeights.fill(0);
    vertexWeights[0] = 1;
    let distance = checkedDistance(callbacks[0], x, y, z);
    for (let i = 1; i < fieldCount; i++) {
      const next = checkedDistance(callbacks[i], x, y, z);
      const h = k === 0
        ? (distance <= next ? 1 : 0)
        : Math.max(0, Math.min(1, 0.5 + 0.5 * (next - distance) / k));
      for (let j = 0; j < i; j++) vertexWeights[j] *= h;
      vertexWeights[i] = 1 - h;
      distance = next * (1 - h) + distance * h - k * h * (1 - h);
    }
    for (let i = 0; i < fieldCount; i++) sourceWeights.push(vertexWeights[i]);
  }

  function crossing(a, b) {
    if (a > b) { const swap = a; a = b; b = swap; }
    const va = scalarGrid[a];
    const vb = scalarGrid[b];
    let t = va / (va - vb);
    t = Math.max(0, Math.min(1, t));
    // If the isosurface passes exactly through a grid node, all incident
    // edges must resolve to the same vertex rather than disconnected copies.
    const key = t < 1e-10 ? -(a + 1)
      : t > 1 - 1e-10 ? -(b + 1)
        : a * edgeKeyStride + b;
    const existing = edgeVertices.get(key);
    if (existing !== undefined) return existing;

    const az = Math.floor(a / strideZ);
    const ay = Math.floor((a - az * strideZ) / nx);
    const ax = a - az * strideZ - ay * nx;
    const bz = Math.floor(b / strideZ);
    const by = Math.floor((b - bz * strideZ) / nx);
    const bx = b - bz * strideZ - by * nx;
    let x = min[0] + (ax + (bx - ax) * t) * dx;
    let y = min[1] + (ay + (by - ay) * t) * dy;
    let z = min[2] + (az + (bz - az) * t) * dz;
    // Linear edge interpolation follows the sampled tetrahedra, which leaves
    // visible terraces on a glossy sculpt. Project the shared vertex gently
    // onto the original continuous field. Its edge identity remains shared,
    // so adjacent tetrahedra still use precisely the same vertex position.
    for (let iteration = 0; iteration < 2; iteration++) {
      const residual = scalar(x, y, z);
      if (Math.abs(residual) < gradientStep * 1e-4) break;
      sampleGradient(x, y, z);
      const gradientSquared = gradient[0] * gradient[0] +
        gradient[1] * gradient[1] + gradient[2] * gradient[2];
      if (gradientSquared < 1e-16) break;
      const limit = maxProjection / Math.sqrt(gradientSquared);
      const correction = Math.max(-limit, Math.min(limit, residual / gradientSquared));
      x -= gradient[0] * correction;
      y -= gradient[1] * correction;
      z -= gradient[2] * correction;
    }
    // Field gradients shade the actual sculpt, rather than the arbitrary
    // tetrahedral tessellation. Central differences also remain continuous
    // across source-field boundaries under polynomial smooth-min blending.
    sampleGradient(x, y, z);
    const gradientLength = Math.hypot(gradient[0], gradient[1], gradient[2]);
    if (gradientLength > 1e-8) {
      normals.push(gradient[0] / gradientLength, gradient[1] / gradientLength,
        gradient[2] / gradientLength);
    } else {
      normals.push(0, 0, 0);
      needsNormalFallback = true;
    }
    const vertex = positions.length / 3;
    positions.push(x, y, z);
    appendWeights(x, y, z);
    edgeVertices.set(key, vertex);
    return vertex;
  }

  // Reject coincident vertices and numerically zero-area faces. Winding points
  // from the negative tetrahedron corners toward the positive corners.
  const areaThresholdSquared = Math.pow(Math.min(dx, dy, dz), 4) * 1e-20;
  function triangle(a, b, c, outwardX, outwardY, outwardZ) {
    if (a === b || b === c || c === a) return;
    const ai = a * 3;
    const bi = b * 3;
    const ci = c * 3;
    const abx = positions[bi] - positions[ai];
    const aby = positions[bi + 1] - positions[ai + 1];
    const abz = positions[bi + 2] - positions[ai + 2];
    const acx = positions[ci] - positions[ai];
    const acy = positions[ci + 1] - positions[ai + 1];
    const acz = positions[ci + 2] - positions[ai + 2];
    const crossX = aby * acz - abz * acy;
    const crossY = abz * acx - abx * acz;
    const crossZ = abx * acy - aby * acx;
    if (crossX * crossX + crossY * crossY + crossZ * crossZ <= areaThresholdSquared) return;
    if (crossX * outwardX + crossY * outwardY + crossZ * outwardZ < 0) {
      indices.push(a, c, b);
    } else {
      indices.push(a, b, c);
    }
  }

  const cube = new Uint32Array(8);
  const inside = new Uint32Array(4);
  const outside = new Uint32Array(4);
  const cornerX = [0, 1, 1, 0, 0, 1, 1, 0];
  const cornerY = [0, 0, 1, 1, 0, 0, 1, 1];
  const cornerZ = [0, 0, 0, 0, 1, 1, 1, 1];

  for (let iz = 0; iz < cellsZ; iz++) {
    for (let iy = 0; iy < cellsY; iy++) {
      let base = iz * strideZ + iy * nx;
      for (let ix = 0; ix < cellsX; ix++, base++) {
        cube[0] = base;
        cube[1] = base + 1;
        cube[2] = base + nx + 1;
        cube[3] = base + nx;
        cube[4] = base + strideZ;
        cube[5] = base + strideZ + 1;
        cube[6] = base + strideZ + nx + 1;
        cube[7] = base + strideZ + nx;
        const firstInside = scalarGrid[cube[0]] < 0;
        let mixed = false;
        for (let i = 1; i < 8; i++) {
          if ((scalarGrid[cube[i]] < 0) !== firstInside) { mixed = true; break; }
        }
        if (!mixed) continue;

        for (const tetrahedron of TETRAHEDRA) {
          let inCount = 0;
          let outCount = 0;
          let inX = 0, inY = 0, inZ = 0;
          let outX = 0, outY = 0, outZ = 0;
          for (let ti = 0; ti < 4; ti++) {
            const corner = tetrahedron[ti];
            const point = cube[corner];
            if (scalarGrid[point] < 0) {
              inside[inCount++] = point;
              inX += cornerX[corner]; inY += cornerY[corner]; inZ += cornerZ[corner];
            } else {
              outside[outCount++] = point;
              outX += cornerX[corner]; outY += cornerY[corner]; outZ += cornerZ[corner];
            }
          }
          if (inCount === 0 || outCount === 0) continue;
          const outwardX = (outX / outCount - inX / inCount) * dx;
          const outwardY = (outY / outCount - inY / inCount) * dy;
          const outwardZ = (outZ / outCount - inZ / inCount) * dz;
          if (inCount === 1) {
            triangle(crossing(inside[0], outside[0]), crossing(inside[0], outside[1]),
              crossing(inside[0], outside[2]), outwardX, outwardY, outwardZ);
          } else if (outCount === 1) {
            triangle(crossing(inside[0], outside[0]), crossing(inside[1], outside[0]),
              crossing(inside[2], outside[0]), outwardX, outwardY, outwardZ);
          } else {
            const a = crossing(inside[0], outside[0]);
            const b = crossing(inside[0], outside[1]);
            const c = crossing(inside[1], outside[1]);
            const d = crossing(inside[1], outside[0]);
            triangle(a, b, c, outwardX, outwardY, outwardZ);
            triangle(a, c, d, outwardX, outwardY, outwardZ);
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  if (needsNormalFallback) {
    geometry.computeVertexNormals();
    const fallback = geometry.attributes.normal.array;
    for (let i = 0; i < normals.length; i += 3) {
      if (normals[i] === 0 && normals[i + 1] === 0 && normals[i + 2] === 0) {
        normals[i] = fallback[i];
        normals[i + 1] = fallback[i + 1];
        normals[i + 2] = fallback[i + 2];
      }
    }
  }
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.sourceWeights = new Float32Array(sourceWeights);
  geometry.userData.sourceFieldCount = fieldCount;
  geometry.userData.sampleSpacing = [dx, dy, dz];
  return geometry;
}
