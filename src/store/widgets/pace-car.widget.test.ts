import { describe, it, expect } from 'vitest';
import { nextPaceCarPitPhase } from './pace-car.widget';

const NOT_IN_WORLD = -1;
const OFF_TRACK = 0;
const IN_PIT_STALL = 1;
const APPROACHING_PITS = 2;
const ON_TRACK = 3;

describe('nextPaceCarPitPhase', () => {
  it('reads the unambiguous surfaces without the previous phase', () => {
    expect(nextPaceCarPitPhase(IN_PIT_STALL, 'onTrack')).toBe('stall');
    expect(nextPaceCarPitPhase(ON_TRACK, 'stall')).toBe('onTrack');
  });

  it('tells pit entry from pit exit by where the car came from', () => {
    expect(nextPaceCarPitPhase(APPROACHING_PITS, 'onTrack')).toBe('pitIn');
    expect(nextPaceCarPitPhase(APPROACHING_PITS, 'stall')).toBe('pitOut');
    expect(nextPaceCarPitPhase(APPROACHING_PITS, 'pitOut')).toBe('pitOut');
  });

  it('assumes pit entry when there is no trustworthy previous phase', () => {
    expect(nextPaceCarPitPhase(APPROACHING_PITS, 'unknown')).toBe('pitIn');
  });

  it('drops to unknown when the car leaves the world', () => {
    expect(nextPaceCarPitPhase(NOT_IN_WORLD, 'onTrack')).toBe('unknown');
    expect(nextPaceCarPitPhase(NOT_IN_WORLD, 'pitOut')).toBe('unknown');
  });

  it('keeps the phase across an off-track reading', () => {
    expect(nextPaceCarPitPhase(OFF_TRACK, 'onTrack')).toBe('onTrack');
    expect(nextPaceCarPitPhase(OFF_TRACK, 'stall')).toBe('stall');
  });

  it('trusts the pit-road flag over an on-track surface', () => {
    expect(nextPaceCarPitPhase(ON_TRACK, 'unknown', true)).toBe('pitIn');
    expect(nextPaceCarPitPhase(ON_TRACK, 'stall', true)).toBe('pitOut');
  });

  it('reads a clean on-track surface as on track once the flag clears', () => {
    expect(nextPaceCarPitPhase(ON_TRACK, 'pitOut', false)).toBe('onTrack');
  });

  it('never resurrects a pit-out phase after the car is removed', () => {
    let phase = nextPaceCarPitPhase(IN_PIT_STALL, 'unknown');
    phase = nextPaceCarPitPhase(APPROACHING_PITS, phase);
    expect(phase).toBe('pitOut');

    phase = nextPaceCarPitPhase(NOT_IN_WORLD, phase);
    expect(phase).toBe('unknown');
  });
});
