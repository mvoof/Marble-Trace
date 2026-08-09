import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runInAction } from 'mobx';
import { RootStore } from '../root-store';
import type { CarInputsFrame } from '@/types/bindings';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// RootStore subscribes to sim events on construction; the node test
// environment has no window for the Tauri event bridge to attach to.
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));

describe('InputTraceWidgetStore — frameTick', () => {
  let rootStore: RootStore;

  const pushFrame = (throttle: number) => {
    runInAction(() => {
      rootStore.player.updateCarInputs({ throttle } as CarInputsFrame);
    });
  };

  beforeEach(() => {
    rootStore = new RootStore();
  });

  afterEach(() => {
    rootStore.inputTraceWidget.dispose();
  });

  it('starts at zero so the canvas sentinel counts the first frame', () => {
    expect(rootStore.inputTraceWidget.frameTick).toBe(0);
  });

  it('advances exactly once per telemetry frame', () => {
    pushFrame(0.1);
    pushFrame(0.2);
    pushFrame(0.3);

    expect(rootStore.inputTraceWidget.frameTick).toBe(3);
  });

  // The trace buffer is sized at 60 samples per second, so an append driven by
  // anything other than a frame would shorten the configured history.
  it('does not advance when unrelated observables change', () => {
    pushFrame(0.1);

    runInAction(() => {
      rootStore.player.updateCarDynamics({
        steering_wheel_angle: 1.5,
      } as never);
    });

    expect(rootStore.inputTraceWidget.frameTick).toBe(1);
  });

  it('returns to zero on reset', () => {
    pushFrame(0.1);
    rootStore.inputTraceWidget.reset();

    expect(rootStore.inputTraceWidget.frameTick).toBe(0);
  });
});
