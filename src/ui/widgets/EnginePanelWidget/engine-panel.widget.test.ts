import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { observable, runInAction } from 'mobx';

import {
  mockCarStatus,
  mockHybridCarStatus,
} from '@store/preview/mocks/engine';
import type { CarStatusFrame } from '@/types/bindings';
import {
  CHANGE_HIGHLIGHT_MS,
  EnginePanelWidgetStore,
} from './engine-panel.widget';

// The reaction tracks the frame, so the stand-in has to be observable — a
// plain object would leave it never firing and every assertion trivially false.
const makeDeps = () => {
  const player = observable({ carStatus: null as CarStatusFrame | null });

  return {
    player,
    set: (status: CarStatusFrame) =>
      runInAction(() => {
        player.carStatus = status;
      }),
  };
};

describe('EnginePanelWidgetStore', () => {
  let deps: ReturnType<typeof makeDeps>;
  let store: EnginePanelWidgetStore;

  beforeEach(() => {
    vi.useFakeTimers();
    deps = makeDeps();
    store = new EnginePanelWidgetStore(deps as never);
  });

  afterEach(() => {
    store.dispose();
    vi.useRealTimers();
  });

  it('lights nothing on the first frame of a session', () => {
    deps.set(mockHybridCarStatus());

    expect(store.isChanged('dc_brake_bias')).toBe(false);
  });

  it('lights only the cell whose value moved', () => {
    deps.set(mockHybridCarStatus({ dc_brake_bias: 57 }));
    deps.set(mockHybridCarStatus({ dc_brake_bias: 57.5 }));

    expect(store.isChanged('dc_brake_bias')).toBe(true);
    expect(store.isChanged('dc_diff_entry')).toBe(false);
  });

  it('goes dark once the window passes with no further change', () => {
    deps.set(mockHybridCarStatus({ dc_brake_bias: 57 }));
    deps.set(mockHybridCarStatus({ dc_brake_bias: 57.5 }));

    vi.advanceTimersByTime(CHANGE_HIGHLIGHT_MS + 1);

    expect(store.isChanged('dc_brake_bias')).toBe(false);
  });

  // A rotary spun through its positions must light the cell once and hold it,
  // rather than going dark a second after the first click while the driver is
  // still turning.
  it('holds the light while changes keep arriving', () => {
    deps.set(mockHybridCarStatus({ dc_diff_entry: 1 }));

    for (const value of [2, 3, 4, 5]) {
      deps.set(mockHybridCarStatus({ dc_diff_entry: value }));
      vi.advanceTimersByTime(CHANGE_HIGHLIGHT_MS - 200);
    }

    expect(store.isChanged('dc_diff_entry')).toBe(true);

    vi.advanceTimersByTime(CHANGE_HIGHLIGHT_MS + 1);

    expect(store.isChanged('dc_diff_entry')).toBe(false);
  });

  // A GT3 publishes null for the formula adjustments. Arriving at a car that
  // does expose them is the car declaring the field, not the driver moving it.
  it('stays dark when a field appears for the first time', () => {
    deps.set(mockCarStatus());
    deps.set(mockCarStatus({ dc_diff_entry: 3 }));

    expect(store.isChanged('dc_diff_entry')).toBe(false);
  });

  it('lights the field once it moves between two real values', () => {
    deps.set(mockCarStatus({ dc_diff_entry: 3 }));
    deps.set(mockCarStatus({ dc_diff_entry: 4 }));

    expect(store.isChanged('dc_diff_entry')).toBe(true);
  });
});
