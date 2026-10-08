import { describe, expect, it } from 'vitest';

import type { RaceFlags } from '@shared/contracts/bindings';
import { mockFlags } from '@features/preview/mocks/flags';
import { FlagsStore } from './flags.store';

type FlagsStoreDeps = ConstructorParameters<typeof FlagsStore>[0];

const storeWith = (overrides: Partial<RaceFlags>) =>
  new FlagsStore({
    liveWidgets: {},
    player: { carStatus: { flags: mockFlags(overrides) } },
    backendComputed: { isPaceCarOnTrack: false },
  } as unknown as FlagsStoreDeps);

describe('FlagsStore — the track-cut slowdown', () => {
  it('lists the furled flag on its own', () => {
    const store = storeWith({ furled: true });

    expect(store.parsedFlags).toEqual(['furled']);
    expect(store.parsedFlag).toBe('furled');
  });

  it('ranks a black flag above the slowdown', () => {
    const store = storeWith({ black: true, furled: true });

    expect(store.parsedFlag).toBe('black');
    expect(store.parsedFlags).toEqual(['black', 'furled']);
  });

  it('ranks the slowdown above a meatball and the session flags', () => {
    const store = storeWith({ furled: true, meatball: true, yellow: true });

    expect(store.parsedFlag).toBe('furled');
  });
});
