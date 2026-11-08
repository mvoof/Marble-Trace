import { describe, expect, it } from 'vitest';

import { pitTimeStillToLoseS } from './pit-loss';

describe('pitTimeStillToLoseS', () => {
  const measured = { laneLossS: 22, exitLossS: 9 };

  it('counts the whole lane and the stop while still on track', () => {
    expect(
      pitTimeStillToLoseS({ phase: 'track', ...measured, standstillS: 30 })
    ).toBe(52);
  });

  it('counts the whole lane on the way into the stall', () => {
    expect(
      pitTimeStillToLoseS({ phase: 'entering', ...measured, standstillS: 30 })
    ).toBe(52);
  });

  it('counts only the run out of the lane once standing in the stall', () => {
    expect(
      pitTimeStillToLoseS({ phase: 'stall', ...measured, standstillS: 12 })
    ).toBe(21);
  });

  it('says nothing once the car has left the stall', () => {
    expect(
      pitTimeStillToLoseS({ phase: 'leaving', ...measured, standstillS: 0 })
    ).toBeNull();
  });

  it('falls back to the standing still before the lane has been measured', () => {
    expect(
      pitTimeStillToLoseS({
        phase: 'track',
        laneLossS: null,
        exitLossS: null,
        standstillS: 30,
      })
    ).toBe(30);
  });

  it('says nothing when nothing is known', () => {
    expect(
      pitTimeStillToLoseS({
        phase: 'track',
        laneLossS: null,
        exitLossS: null,
        standstillS: 0,
      })
    ).toBeNull();
  });
});
