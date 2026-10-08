import { makeAutoObservable, reaction, type IReactionDisposer } from 'mobx';

import type { WidgetInstanceContext } from '@entities/widget/widget-instances.store';
import { useWidgetInstanceStore } from '@entities/widget/widget-instance-context';
import type { PlayerStore } from '@entities/player/player.store';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';
import type { InputTraceSettings } from './settings-schema';

interface InputTraceDeps {
  player: PlayerStore;
  liveWidgets: LiveWidgetsView;
}

export type InputChannel = 'throttle' | 'brake' | 'clutch';

type SmoothedInputs = Record<InputChannel, number>;

const advance = (previous: number, raw: number, smoothing: number): number =>
  smoothing <= 0 ? raw : (previous * smoothing + raw) / (smoothing + 1);

export class InputTraceWidgetStore {
  smoothed: SmoothedInputs = { throttle: 0, brake: 0, clutch: 0 };

  // Advanced once per telemetry frame, alongside `smoothed`. The trace canvas
  // gates its ring-buffer push on this so a repeated autorun pass — settings
  // edits, or the write to `smoothed` re-invalidating an autorun that already
  // ran earlier in the same MobX flush — cannot append a second sample for one
  // frame. The buffer is sized for 60 samples per second, so a double push
  // halves the visible history.
  frameTick = 0;

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
      { root: false, disposers: false },
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

          this.smoothed = {
            throttle: advance(
              this.smoothed.throttle,
              inputs?.throttle ?? 0,
              smoothing
            ),
            brake: advance(this.smoothed.brake, inputs?.brake ?? 0, smoothing),
            clutch: advance(
              this.smoothed.clutch,
              inputs?.clutch != null ? 1 - inputs.clutch : 0,
              smoothing
            ),
          };

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
  }
}

export const useInputTraceWidgetStore = () =>
  useWidgetInstanceStore<InputTraceWidgetStore>();
