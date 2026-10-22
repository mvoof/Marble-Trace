import {
  makeAutoObservable,
  reaction,
  type IReactionDisposer,
  observableRef,
} from 'mobx';

import type { WidgetInstanceContext } from '@entities/widget/widget-instances.store';
import { useWidgetInstanceStore } from '@entities/widget/widget-instance-context';
import type { PlayerStore } from '@entities/player/player.store';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';
import type { InputTraceSettings } from './settings-schema';
import type {
  CarDynamicsFrame,
  CarInputsFrame,
  InputSample,
} from '@shared/contracts/generated/bindings';
import type { TraceSample } from './CanvasTrace/canvas-trace-render';

interface InputTraceDeps {
  player: PlayerStore;
  liveWidgets: LiveWidgetsView;
}

export type InputChannel = 'throttle' | 'brake' | 'clutch';

type SmoothedInputs = Record<InputChannel, number>;

/**
 * A slip angle past this is the car sliding, not cornering — a GT car takes a
 * fast corner at up to a degree and a half, degrees.
 */
const SLIDE_ANGLE_DEG = 3;

const advance = (previous: number, raw: number, smoothing: number): number =>
  smoothing <= 0 ? raw : (previous * smoothing + raw) / (smoothing + 1);

// The one sample a bundle without `inputSamples` stands for — a preview, a
// story, or a window the samples are not sent to.
const sampleOfFrames = (
  inputs: CarInputsFrame | null,
  dynamics: CarDynamicsFrame | null
): InputSample => ({
  throttle: inputs?.throttle ?? 0,
  brake: inputs?.brake ?? 0,
  clutch: inputs?.clutch ?? null,
  brakeAbsActive: inputs?.brake_abs_active ?? false,
  steeringWheelAngle: dynamics?.steering_wheel_angle ?? 0,
  // Read per tick on the backend; the single published frame has no angle.
  bodySlipDeg: null,
});

export class InputTraceWidgetStore {
  smoothed: SmoothedInputs = { throttle: 0, brake: 0, clutch: 0 };

  // Advanced once per telemetry frame, alongside `smoothed`. The trace canvas
  // gates its ring-buffer push on this so a repeated autorun pass — settings
  // edits, or the write to `smoothed` re-invalidating an autorun that already
  // ran earlier in the same MobX flush — cannot append a second sample for one
  // frame. The buffer is sized for 60 samples per second, so a double push
  // halves the visible history.
  frameTick = 0;

  // What the last frame adds to the trace: one point per source tick it
  // covers, already smoothed. A bundle goes out on the overlay clock, every Nth
  // tick, and carries the ticks in between as `inputSamples`; pushing all of
  // them keeps the trace at the sim's own rate — and `historySeconds` true —
  // whatever the clock is.
  frameSamples: TraceSample[] = [];

  private readonly disposers: IReactionDisposer[] = [];

  private readonly root: InputTraceDeps;

  private readonly instanceId: string;

  // Built per instance when it mounts (`mount.ts`), so the filter runs only
  // while a trace is on screen, at that trace's own smoothing. Wired in the
  // constructor: it must advance once per telemetry frame, never per render.
  constructor({ core, instanceId }: WidgetInstanceContext<InputTraceDeps>) {
    this.root = core;
    this.instanceId = instanceId;

    makeAutoObservable<InputTraceWidgetStore, 'root' | 'disposers'>(
      this,
      { root: false, disposers: false, frameSamples: observableRef },
      { autoBind: true }
    );

    this.disposers.push(
      reaction(
        () => this.root.player.carInputs,
        (inputs) => {
          const { smoothing } =
            this.root.liveWidgets.getSettings<InputTraceSettings>(
              this.instanceId
            );

          const samples = this.root.player.inputSamples ?? [
            sampleOfFrames(inputs, this.root.player.carDynamics),
          ];

          // Smoothed tick by tick, so the filter keeps the strength it has at
          // the sim's rate whatever the overlay clock is.
          this.frameSamples = samples.map((sample) => {
            this.smoothed = {
              throttle: advance(
                this.smoothed.throttle,
                sample.throttle,
                smoothing
              ),
              brake: advance(this.smoothed.brake, sample.brake, smoothing),
              clutch: advance(
                this.smoothed.clutch,
                sample.clutch !== null ? 1 - sample.clutch : 0,
                smoothing
              ),
            };

            return {
              ...this.smoothed,
              absActive: sample.brakeAbsActive,
              steeringWheelAngle: sample.steeringWheelAngle,
              sliding: Math.abs(sample.bodySlipDeg ?? 0) >= SLIDE_ANGLE_DEG,
            };
          });

          this.frameTick++;
        }
      )
    );
  }

  // Called when the instance unmounts; the reaction otherwise outlives it.
  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;
    this.reset();
  }

  reset() {
    this.smoothed = { throttle: 0, brake: 0, clutch: 0 };
    this.frameTick = 0;
    this.frameSamples = [];
  }
}

export const useInputTraceWidgetStore = () =>
  useWidgetInstanceStore<InputTraceWidgetStore>();
