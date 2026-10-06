/** @param {number} value @param {number} min @param {number} max */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Pure damage calculation. Storm damage can bypass shields.
 * @param {{health: number, shield: number}} state
 * @param {number} amount
 * @param {boolean} [bypassShield]
 */
export function applyDamage(state, amount, bypassShield = false) {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Damage must be finite and nonnegative');
  const absorbed = bypassShield ? 0 : Math.min(Math.max(0, state.shield), amount);
  return {
    health: clamp(state.health - (amount - absorbed), 0, 100),
    shield: clamp(state.shield - absorbed, 0, 100),
  };
}

/** @param {number} elapsed Seconds of active gameplay, excluding pauses. */
export function zoneRadius(elapsed) {
  return 95 - 83 * clamp((elapsed - 20) / 200, 0, 1);
}

/** @param {number} x @param {number} z @param {number} radius */
export function outsideZone(x, z, radius) {
  return x * x + z * z > radius * radius;
}

/**
 * @typedef {{x: number, z: number, width: number, depth: number, angle: number}} Footprint
 */

/** @param {number} x @param {number} z @param {Footprint} box */
function localPoint(x, z, box) {
  const dx = x - box.x;
  const dz = z - box.z;
  const c = Math.cos(box.angle);
  const s = Math.sin(box.angle);
  return { x: c * dx - s * dz, z: s * dx + c * dz };
}

/** @param {number} x @param {number} z @param {number} radius @param {Footprint} box */
export function circleIntersectsBox(x, z, radius, box) {
  const p = localPoint(x, z, box);
  const dx = p.x - clamp(p.x, -box.width / 2, box.width / 2);
  const dz = p.z - clamp(p.z, -box.depth / 2, box.depth / 2);
  return dx * dx + dz * dz <= radius * radius;
}

/**
 * Ramps rise toward local -Z. Returns null outside the footprint.
 * @param {number} x @param {number} z
 * @param {Footprint & {height: number}} ramp
 * @returns {number | null}
 */
export function rampHeight(x, z, ramp) {
  const p = localPoint(x, z, ramp);
  if (Math.abs(p.x) > ramp.width / 2 + 1e-6 || Math.abs(p.z) > ramp.depth / 2 + 1e-6) return null;
  return clamp((ramp.depth / 2 - p.z) / ramp.depth, 0, 1) * ramp.height;
}

/** @param {number} value @param {number} [size] */
export function snapToGrid(value, size = 4) {
  if (!Number.isFinite(value) || !Number.isFinite(size) || size <= 0) throw new RangeError('Invalid grid position or size');
  return Math.round(value / size) * size;
}
