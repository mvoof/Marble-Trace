import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runInAction } from 'mobx';
import { PreviewCore } from '@store/roots/renderer-core';
import type { WidgetStoreFactory } from '@store/widget-runtime/widget-instances.store';
import type { CarInputsFrame } from '@/types/bindings';
import { InputTraceWidgetStore } from './input-trace.store';

const INPUT_TRACE = 'input-trace';

const createInputTrace: WidgetStoreFactory = (context) =>
  new InputTraceWidgetStore(context);

describe('InputTraceWidgetStore — frameTick', () => {
  let core: PreviewCore;
  let inputTrace: InputTraceWidgetStore;

  const pushFrame = (throttle: number) => {
    runInAction(() => {
      core.player.updateCarInputs({ throttle } as CarInputsFrame);
    });
  };

  beforeEach(() => {
    core = new PreviewCore();
    inputTrace = core.widgetInstances.open(
      { core, instanceId: INPUT_TRACE, type: INPUT_TRACE },
      createInputTrace
    ) as InputTraceWidgetStore;
  });

  afterEach(() => {
    core.dispose();
  });

  it('starts at zero so the canvas sentinel counts the first frame', () => {
    expect(inputTrace.frameTick).toBe(0);
  });

  it('advances exactly once per telemetry frame', () => {
    pushFrame(0.1);
    pushFrame(0.2);
    pushFrame(0.3);

    expect(inputTrace.frameTick).toBe(3);
  });

  // The trace buffer is sized at 60 samples per second, so an append driven by
  // anything other than a frame would shorten the configured history.
  it('does not advance when unrelated observables change', () => {
    pushFrame(0.1);

    runInAction(() => {
      core.player.updateCarDynamics({
        steering_wheel_angle: 1.5,
      } as never);
    });

    expect(inputTrace.frameTick).toBe(1);
  });

  it('returns to zero on reset', () => {
    pushFrame(0.1);
    inputTrace.reset();

    expect(inputTrace.frameTick).toBe(0);
  });

  // The store exists only while its instance is mounted: a trace that is not on
  // screen must not filter a single frame.
  it('stops on unmount — a replayed frame no longer reaches it', () => {
    pushFrame(0.5);
    core.widgetInstances.close(INPUT_TRACE, inputTrace);
    pushFrame(0.9);

    expect(inputTrace.frameTick).toBe(0);
    expect(core.widgetInstances.storesOf(INPUT_TRACE)).toEqual([]);
  });

  it('smooths with its own instance settings', () => {
    runInAction(() => {
      core.liveWidgets.updateUserSettings(INPUT_TRACE, { smoothing: 0 });
    });

    pushFrame(0.8);

    expect(inputTrace.smoothed.throttle).toBeCloseTo(0.8);
  });
});
