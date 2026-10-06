import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TrackRotations } from '@platform/services/track-settings.service';
import { TrackRotationStore } from './track-rotation.store';

const { file, writes } = vi.hoisted(() => ({
  file: { contents: {} as Record<string, number> },
  writes: [] as Record<string, number>[],
}));

// A write that yields before it lands, as the plugin's IPC does: the race the
// store exists for is two saves in flight at once.
vi.mock('@platform/services/track-settings.service', () => ({
  readTrackRotations: async (): Promise<TrackRotations> => ({
    ...file.contents,
  }),
  writeTrackRotations: async (rotations: TrackRotations) => {
    await Promise.resolve();
    writes.push({ ...rotations });
    file.contents = { ...rotations };
  },
}));

describe('TrackRotationStore', () => {
  beforeEach(() => {
    file.contents = { '1': 90, '7': 180 };
    writes.length = 0;
  });

  it('keeps both turns made on two monitors in quick succession', async () => {
    const owner = new TrackRotationStore();

    void owner.load();

    // Neither step waits for the other: both overlays fired before main
    // answered either of them.
    const first = owner.step('1', 'cw');
    const second = owner.step('1', 'cw');

    await Promise.all([first, second]);

    expect(owner.rotationOf('1')).toBe(270);
    expect(file.contents).toEqual({ '1': 270, '7': 180 });
    expect(writes).toHaveLength(2);
  });

  it('applies a step that arrives before the file is read on the stored angle', async () => {
    const owner = new TrackRotationStore();
    const loading = owner.load();
    const step = owner.step('7', 'ccw');

    await Promise.all([loading, step]);

    expect(owner.rotationOf('7')).toBe(90);
    expect(file.contents).toEqual({ '1': 90, '7': 90 });
  });

  it('announces every angle it stores', async () => {
    const owner = new TrackRotationStore();

    await owner.load();
    await owner.step('1', 'ccw');

    expect(owner.lastChange).toEqual({ trackId: '1', rotation: 0 });
  });

  it('never writes a file it has not read', async () => {
    const owner = new TrackRotationStore();

    await owner.step('1', 'cw');

    expect(writes).toHaveLength(0);
  });

  it('keeps an angle without a track in memory only', async () => {
    const owner = new TrackRotationStore();

    await owner.load();
    await owner.setRotation('', 270);

    expect(owner.rotationOf('')).toBe(270);
    expect(writes).toHaveLength(0);
  });

  it('forgets a track and announces it back at zero', async () => {
    const owner = new TrackRotationStore();

    await owner.load();
    await owner.forget('7');

    expect(owner.rotationOf('7')).toBe(0);
    expect(owner.lastChange).toEqual({ trackId: '7', rotation: 0 });
    expect(file.contents).toEqual({ '1': 90 });
  });
});
