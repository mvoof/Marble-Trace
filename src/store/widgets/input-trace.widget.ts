import { makeAutoObservable, reaction } from 'mobx';

import type { RootStore } from '@store/root-store';
import type { InputTraceSettings } from '@/types/widget-settings';

export type InputChannel = 'throttle' | 'brake' | 'clutch';

type SmoothedInputs = Record<InputChannel, number>;

const advance = (previous: number, raw: number, smoothing: number): number =>
  smoothing <= 0 ? raw : (previous * smoothing + raw) / (smoothing + 1);

export class InputTraceWidgetStore {
  smoothed: SmoothedInputs = { throttle: 0, brake: 0, clutch: 0 };

  // Wired in the constructor rather than an init() step: the exponential filter
  // must advance once per telemetry frame (never per React render), and the
  // isolated preview stores used by the workbench and Storybook skip init().
  constructor(private readonly root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });

    reaction(
      () => this.root.player.carInputs,
      (inputs) => {
        const { smoothing } =
          this.root.widgetSettings.getSettings<InputTraceSettings>(
            'input-trace'
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
      }
    );
  }

  reset() {
    this.smoothed = { throttle: 0, brake: 0, clutch: 0 };
  }
}
