import { describe, expect, it } from 'vitest';

import { resolveDriverStatuses, type DriverStatusState } from './driver-status';

const ON_TRACK: DriverStatusState = {
  flagType: 'none',
  isTowed: false,
  isOut: false,
  isOffTrack: false,
  isPit: false,
  pitState: null,
};

const statusesOf = (state: Partial<DriverStatusState>) =>
  resolveDriverStatuses({ ...ON_TRACK, ...state }).map((chip) => chip.status);

describe('resolveDriverStatuses', () => {
  it('shows nothing for a car running on track', () => {
    expect(statusesOf({})).toEqual([]);
  });

  it('lets a disqualification hide every other status', () => {
    expect(
      statusesOf({ flagType: 'dq', isTowed: true, isPit: true, isOut: true })
    ).toEqual(['dnf']);
  });

  it('shows the tow alone while the car stands in its stall', () => {
    expect(statusesOf({ isTowed: true, isOut: true, isPit: true })).toEqual([
      'tow',
    ]);
  });

  it('names the stop by where the car is on pit road', () => {
    expect(statusesOf({ isPit: true, pitState: 'in' })).toEqual(['pit_in']);
    expect(statusesOf({ isPit: true, pitState: 'exit' })).toEqual(['pit_exit']);
    expect(statusesOf({ isPit: true, pitState: null })).toEqual(['pit']);
  });

  it('drops the pit badge when the table turns it off', () => {
    expect(statusesOf({ isPit: true, showPit: false })).toEqual([]);
  });

  it('keeps a finished car clear of where it parked', () => {
    expect(
      statusesOf({
        isFinished: true,
        isOut: true,
        isOffTrack: true,
        isPit: true,
      })
    ).toEqual([]);
  });

  it('draws garage and off-track in that order', () => {
    expect(statusesOf({ isOut: true, isOffTrack: true })).toEqual([
      'out',
      'off_track',
    ]);
  });

  it('fills the events and tints the states', () => {
    const [pit] = resolveDriverStatuses({ ...ON_TRACK, isPit: true });
    const [garage] = resolveDriverStatuses({ ...ON_TRACK, isOut: true });

    expect(pit).toMatchObject({ label: 'PIT', lead: 'solid' });
    expect(garage).toMatchObject({ label: 'GAR', lead: 'tint' });
  });
});
