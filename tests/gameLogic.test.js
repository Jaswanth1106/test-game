import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, applyDamage, zoneRadius, outsideZone, circleIntersectsBox, rampHeight, snapToGrid } from '../src/gameLogic.js';

test('clamp constrains both ends', () => {
  assert.equal(clamp(-2, 0, 100), 0);
  assert.equal(clamp(101, 0, 100), 100);
  assert.equal(clamp(34, 0, 100), 34);
});
test('shield absorbs damage before health without mutating input', () => {
  const initial = { health: 100, shield: 30 };
  assert.deepEqual(applyDamage(initial, 45), { health: 85, shield: 0 });
  assert.deepEqual(initial, { health: 100, shield: 30 });
  assert.deepEqual(applyDamage(initial, 10), { health: 100, shield: 20 });
});
test('storm bypasses shield and lethal damage stops at zero', () => {
  assert.deepEqual(applyDamage({ health: 8, shield: 30 }, 10, true), { health: 0, shield: 30 });
  assert.deepEqual(applyDamage({ health: 100, shield: 30 }, 999), { health: 0, shield: 0 });
});
test('invalid damage is rejected', () => {
  assert.throws(() => applyDamage({ health: 100, shield: 0 }, -1), RangeError);
  assert.throws(() => applyDamage({ health: 100, shield: 0 }, NaN), RangeError);
});
test('zone waits, shrinks linearly, and holds at its minimum', () => {
  assert.equal(zoneRadius(0), 95);
  assert.equal(zoneRadius(20), 95);
  assert.equal(zoneRadius(120), 53.5);
  assert.equal(zoneRadius(220), 12);
  assert.equal(zoneRadius(1000), 12);
  assert.equal(zoneRadius(-10), 95);
});
test('safe-zone boundary is inclusive', () => {
  assert.equal(outsideZone(3, 4, 5), false);
  assert.equal(outsideZone(3, 4.1, 5), true);
});
test('rotated box collision works on edges and corners', () => {
  const box = { x: 0, z: 0, width: 6, depth: 1, angle: 0 };
  assert.equal(circleIntersectsBox(0, 1, 0.6, box), true);
  assert.equal(circleIntersectsBox(4, 2, 0.5, box), false);
  assert.equal(circleIntersectsBox(3.4, 0.9, 0.6, box), true);
  assert.equal(circleIntersectsBox(0, 2, 0.5, { ...box, angle: Math.PI / 2 }), true);
  assert.equal(circleIntersectsBox(2, 0, 0.5, { ...box, angle: Math.PI / 2 }), false);
});
test('ramp support follows slope and rotated placement', () => {
  const ramp = { x: 0, z: 0, width: 4, depth: 6, height: 3, angle: 0 };
  assert.equal(rampHeight(0, 3, ramp), 0);
  assert.equal(rampHeight(0, 0, ramp), 1.5);
  assert.equal(rampHeight(0, -3, ramp), 3);
  assert.equal(rampHeight(5, 0, ramp), null);
  assert.equal(rampHeight(-3, 0, { ...ramp, angle: Math.PI / 2 }), 3);
});
test('building positions snap to a grid', () => {
  assert.equal(snapToGrid(7.1), 8);
  assert.equal(snapToGrid(-7.1), -8);
  assert.equal(snapToGrid(8.9, 3), 9);
});
