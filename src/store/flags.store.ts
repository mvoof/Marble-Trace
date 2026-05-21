import { action, makeAutoObservable, reaction } from 'mobx';

import type { FlagType } from '@/types';
import { parseAllSessionFlags } from '@utils/formatters/flags-utils';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { telemetryStore } from './iracing/telemetry.store';

class FlagsStore {
  displayFlags: FlagType[] = [];

  private holdTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    makeAutoObservable(this);
    this.initHold();
  }

  get parsedFlags(): FlagType[] {
    return parseAllSessionFlags(
      telemetryStore.session?.session_flags ?? null,
      telemetryStore.session?.player_car_flags ?? null
    );
  }

  private initHold() {
    reaction(
      () => ({
        flags: this.parsedFlags,
        holdDuration:
          widgetSettingsStore.getFlagDisplaySettings('flat-flags').holdDuration,
      }),
      ({ flags, holdDuration }) => {
        if (flags.length > 0) {
          if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
          }

          action(() => {
            this.displayFlags = flags;
          })();
        } else {
          if (holdDuration > 0 && this.displayFlags.length > 0) {
            if (this.holdTimer) clearTimeout(this.holdTimer);

            this.holdTimer = setTimeout(
              action(() => {
                this.displayFlags = [];
              }),
              holdDuration * 1000
            );
          } else if (holdDuration === 0) {
            action(() => {
              this.displayFlags = [];
            })();
          }
        }
      }
    );
  }

  reset() {
    this.displayFlags = [];

    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }
}

export const flagsStore = new FlagsStore();
