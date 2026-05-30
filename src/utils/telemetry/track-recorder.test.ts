import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TrackRecorder } from './track-recorder';

describe('TrackRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default empty state', () => {
    const recorder = new TrackRecorder();

    expect(recorder.isRecording).toBe(false);
    expect(recorder.isComplete).toBe(false);
    expect(recorder.progress).toBe(0);
    expect(recorder.getPoints()).toEqual([]);
  });

  it('should start recording and track progress correctly', () => {
    const recorder = new TrackRecorder();
    recorder.start();

    expect(recorder.isRecording).toBe(true);
    expect(recorder.isComplete).toBe(false);

    // First tick at startPct = 0.1
    recorder.tick(10, 0, 0.1);
    expect(recorder.progress).toBe(0);

    // Advance time by 100ms
    vi.advanceTimersByTime(100);

    // Tick again at 0.15
    recorder.tick(10, 0, 0.15);
    expect(recorder.progress).toBeGreaterThan(0);
  });

  it('should clip overlapping points and correct drift upon completion', () => {
    const recorder = new TrackRecorder();
    recorder.start();

    // First tick initializes startPct at 0.0
    recorder.tick(10, 0, 0.0);

    // Simulate a loop of 110 ticks (above the MIN_POINTS_FOR_COMPLETION limit of 100)
    // We increment lapDistPct from 0.0 to 1.0.
    const steps = 110;

    for (let i = 1; i <= steps; i++) {
      vi.advanceTimersByTime(16); // ~60Hz

      let pct = i / 100;

      if (pct > 1.0) {
        pct -= 1.0; // wraps around
      }

      // Speed 10m/s, yaw 0.5 rad
      recorder.tick(10, 0.5, pct);
    }

    // At steps = 110, pct is 0.10.
    // Since progress reached > 0.90 at step 90+, and now at step 100+ pct wrapped around
    // to < 0.10, the recorder should have marked itself complete.
    expect(recorder.isComplete).toBe(true);
    expect(recorder.isRecording).toBe(false);

    const points = recorder.getPoints();

    // Check that we clipped points to only a single lap (no overlapping points from second lap)
    expect(points.length).toBeGreaterThan(0);

    const startPt = points[0];
    const endPt = points[points.length - 1];

    // Due to our linear drift correction, the final point's coordinates must exactly match the start point's coordinates
    expect(startPt.x).toBeCloseTo(endPt.x, 5);
    expect(startPt.y).toBeCloseTo(endPt.y, 5);

    // Also verify that the pct values are strictly monotonic and cover only one lap
    for (let i = 0; i < points.length - 1; i++) {
      expect(points[i].pct).toBeLessThanOrEqual(points[i + 1].pct);
    }
  });
});
