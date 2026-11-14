import { describe, expect, it } from 'vitest';
import {
  advanceWaveClock,
  INITIAL_WAVE_CLOCK,
  waveLines,
  type WaveLine,
} from './header-wave';

const HEADER_WIDTH = 1200;
const HEADER_HEIGHT = 80;
/** The spec keeps the wave's peak within ~20 px of the header's bottom. */
const WAVE_BAND = 20;

const linesAt = (phase: number, liveness: number) =>
  waveLines({
    width: HEADER_WIDTH,
    height: HEADER_HEIGHT,
    phase,
    liveness,
  });

const highestPointX = (line: WaveLine) =>
  line.points.reduce((highest, point) =>
    point.y < highest.y ? point : highest
  ).x;

describe('waveLines', () => {
  it('is grey while the sim is not connected', () => {
    for (const line of linesAt(0, 0)) {
      const [red, green, blue] = line.rgb;

      expect(red).toBe(green);
      expect(green).toBe(blue);
    }
  });

  it('turns warm red, green and blue once connected', () => {
    const [warm, green, blue] = linesAt(0, 1).map((line) => line.rgb);

    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(green[1]).toBeGreaterThan(green[0]);
    expect(blue[2]).toBeGreaterThan(blue[0]);
  });

  it('is stronger connected than not', () => {
    const grey = linesAt(0, 0);
    const live = linesAt(0, 1);

    grey.forEach((line, index) => {
      expect(live[index].alpha).toBeGreaterThan(line.alpha);
    });
  });

  it('runs along the bottom of the header, clear of the pocket', () => {
    for (const phase of [0, 3, 17, 42]) {
      for (const line of linesAt(phase, 1)) {
        for (const point of line.points) {
          expect(point.y).toBeGreaterThanOrEqual(HEADER_HEIGHT - WAVE_BAND);
          expect(point.y).toBeLessThanOrEqual(HEADER_HEIGHT);
        }
      }
    }
  });

  it('spans the whole width and settles flat at both ends', () => {
    for (const line of linesAt(5, 1)) {
      const first = line.points[0];
      const last = line.points[line.points.length - 1];

      expect(first.x).toBe(0);
      expect(last.x).toBe(HEADER_WIDTH);
      expect(first.y).toBeCloseTo(last.y);
    }
  });

  it('lets its bump wander along the header over time', () => {
    const [earlier] = linesAt(0, 0);
    const [later] = linesAt(20, 0);

    expect(
      Math.abs(highestPointX(later) - highestPointX(earlier))
    ).toBeGreaterThan(100);
  });
});

describe('advanceWaveClock', () => {
  it('moves the wave while the window is watched', () => {
    const next = advanceWaveClock(INITIAL_WAVE_CLOCK, 0.016, {
      isWatched: true,
      isConnected: false,
    });

    expect(next.phase).toBeGreaterThan(INITIAL_WAVE_CLOCK.phase);
  });

  it('holds the wave still while the window is not watched', () => {
    const next = advanceWaveClock(INITIAL_WAVE_CLOCK, 0.016, {
      isWatched: false,
      isConnected: false,
    });

    expect(next.phase).toBe(INITIAL_WAVE_CLOCK.phase);
  });

  it('never runs backwards', () => {
    const next = advanceWaveClock(INITIAL_WAVE_CLOCK, -0.01, {
      isWatched: true,
      isConnected: false,
    });

    expect(next.phase).toBe(INITIAL_WAVE_CLOCK.phase);
  });

  it('does not jump after a long gap between frames', () => {
    const next = advanceWaveClock(INITIAL_WAVE_CLOCK, 5, {
      isWatched: true,
      isConnected: false,
    });

    expect(next.phase).toBeLessThan(0.1);
  });

  const runFor = (
    seconds: number,
    isConnected: boolean,
    start = INITIAL_WAVE_CLOCK
  ) => {
    const frameSeconds = 1 / 60;
    let clock = start;

    for (let elapsed = 0; elapsed < seconds; elapsed += frameSeconds) {
      clock = advanceWaveClock(clock, frameSeconds, {
        isWatched: true,
        isConnected,
      });
    }

    return clock;
  };

  it('starts grey', () => {
    expect(INITIAL_WAVE_CLOCK.liveness).toBe(0);
  });

  it('fades into colour within a couple of seconds of the sim connecting', () => {
    const halfway = runFor(0.2, true);
    const settled = runFor(2, true);

    expect(halfway.liveness).toBeGreaterThan(0);
    expect(halfway.liveness).toBeLessThan(1);
    expect(settled.liveness).toBeGreaterThan(0.99);
  });

  it('fades back to grey when the sim disconnects', () => {
    const settled = runFor(2, false, runFor(2, true));

    expect(settled.liveness).toBeLessThan(0.01);
  });

  it('shows the new state at once while the window is not watched', () => {
    const next = advanceWaveClock(INITIAL_WAVE_CLOCK, 0.016, {
      isWatched: false,
      isConnected: true,
    });

    expect(next.liveness).toBe(1);
  });
});
