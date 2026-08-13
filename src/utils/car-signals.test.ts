import { describe, it, expect } from 'vitest';
import {
  normalizedSteering,
  steeringAngleDeg,
  wrapToHalfTurn,
} from './car-signals';

const HALF_TURN_RAD = Math.PI;
const QUARTER_TURN_RAD = Math.PI / 2;

describe('steeringAngleDeg', () => {
  it('converts the raw radian reading to degrees of wheel rotation', () => {
    expect(steeringAngleDeg(0)).toBe(0);
    expect(steeringAngleDeg(HALF_TURN_RAD)).toBeCloseTo(180);
    expect(steeringAngleDeg(-QUARTER_TURN_RAD)).toBeCloseTo(-90);
  });
});

describe('normalizedSteering', () => {
  it('reaches ±1 exactly at full lock', () => {
    // 900° lock — half lock is 450°, i.e. 2.5 turns of the wheel.
    const fullLockRad = (450 * Math.PI) / 180;

    expect(normalizedSteering(fullLockRad, 900)).toBeCloseTo(1);
    expect(normalizedSteering(-fullLockRad, 900)).toBeCloseTo(-1);
    expect(normalizedSteering(0, 900)).toBe(0);
  });

  it('scales with the lock, so the same angle reads further on a smaller wheel', () => {
    const angleRad = (225 * Math.PI) / 180;

    expect(normalizedSteering(angleRad, 900)).toBeCloseTo(0.5);
    expect(normalizedSteering(angleRad, 450)).toBeCloseTo(1);
  });

  it('clamps beyond full lock instead of running off the graph', () => {
    const beyondLockRad = (900 * Math.PI) / 180;

    expect(normalizedSteering(beyondLockRad, 900)).toBe(1);
    expect(normalizedSteering(-beyondLockRad, 900)).toBe(-1);
  });

  it('zooms in on the centre without changing the sign', () => {
    const angleRad = (225 * Math.PI) / 180;

    expect(normalizedSteering(angleRad, 900, 2)).toBeCloseTo(1);
    expect(normalizedSteering(-angleRad, 900, 2)).toBeCloseTo(-1);
  });

  it('does not divide by zero when the lock is unset', () => {
    expect(Number.isFinite(normalizedSteering(QUARTER_TURN_RAD, 0))).toBe(true);
  });
});

describe('wrapToHalfTurn', () => {
  it('leaves angles inside a half turn untouched', () => {
    expect(wrapToHalfTurn(0)).toBe(0);
    expect(wrapToHalfTurn(90)).toBe(90);
    expect(wrapToHalfTurn(-90)).toBe(-90);
    expect(wrapToHalfTurn(179)).toBe(179);
  });

  it('laps the circle, mapping every full turn back onto the same point', () => {
    expect(wrapToHalfTurn(360)).toBe(0);
    expect(wrapToHalfTurn(450)).toBe(90);
    expect(wrapToHalfTurn(-450)).toBe(-90);
    expect(wrapToHalfTurn(810)).toBe(90);
  });

  it('resolves the half-turn boundary to the negative end of the range', () => {
    expect(wrapToHalfTurn(180)).toBe(-180);
    expect(wrapToHalfTurn(-180)).toBe(-180);
  });
});
