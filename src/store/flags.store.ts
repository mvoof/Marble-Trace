import { action, makeAutoObservable, reaction } from 'mobx';

import type { FlagType } from '@/types';
import {
  parseAllSessionFlags,
  parseSessionFlags,
} from '@utils/formatters/flags-utils';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { telemetryStore } from './iracing/telemetry.store';

const NO_FLAG: FlagType = 'none';
const NO_FLAGS: FlagType[] = [];

interface HoldState {
  timer: ReturnType<typeof setTimeout> | null;
}

class FlagsStore {
  displayFlags: FlagType[] = [];
  ledDisplayFlag: FlagType = NO_FLAG;

  private readonly flatHold: HoldState = { timer: null };
  private readonly ledHold: HoldState = { timer: null };

  constructor() {
    makeAutoObservable(this);
    this.initFlatHold();
    this.initLedHold();
  }

  get parsedFlags(): FlagType[] {
    return parseAllSessionFlags(
      telemetryStore.session?.session_flags ?? null,
      telemetryStore.session?.player_car_flags ?? null
    );
  }

  get parsedFlag(): FlagType {
    return parseSessionFlags(
      telemetryStore.session?.session_flags ?? null,
      telemetryStore.session?.player_car_flags ?? null
    );
  }

  private createHoldReaction<T>(
    getValue: () => T,
    isEmpty: (value: T) => boolean,
    emptyValue: T,
    getHoldDuration: () => number,
    setValue: (value: T) => void,
    getCurrentValue: () => T,
    hold: HoldState
  ) {
    reaction(
      () => ({ value: getValue(), holdDuration: getHoldDuration() }),
      ({ value, holdDuration }) => {
        if (!isEmpty(value)) {
          if (hold.timer) {
            clearTimeout(hold.timer);
            hold.timer = null;
          }

          action(() => setValue(value))();
        } else {
          if (holdDuration > 0 && !isEmpty(getCurrentValue())) {
            if (hold.timer) clearTimeout(hold.timer);

            hold.timer = setTimeout(
              action(() => setValue(emptyValue)),
              holdDuration * 1000
            );
          } else if (holdDuration === 0) {
            action(() => setValue(emptyValue))();
          }
        }
      }
    );
  }

  private initFlatHold() {
    this.createHoldReaction(
      () => this.parsedFlags,
      (flags) => flags.length === 0,
      NO_FLAGS,
      () =>
        widgetSettingsStore.getFlagDisplaySettings('flat-flags').holdDuration,
      (value) => {
        this.displayFlags = value;
      },
      () => this.displayFlags,
      this.flatHold
    );
  }

  private initLedHold() {
    this.createHoldReaction(
      () => this.parsedFlag,
      (flag) => flag === NO_FLAG,
      NO_FLAG,
      () =>
        widgetSettingsStore.getFlagDisplaySettings('led-flags').holdDuration,
      (value) => {
        this.ledDisplayFlag = value;
      },
      () => this.ledDisplayFlag,
      this.ledHold
    );
  }

  reset() {
    this.displayFlags = [];
    this.ledDisplayFlag = NO_FLAG;

    if (this.flatHold.timer) {
      clearTimeout(this.flatHold.timer);
      this.flatHold.timer = null;
    }

    if (this.ledHold.timer) {
      clearTimeout(this.ledHold.timer);
      this.ledHold.timer = null;
    }
  }
}

export const flagsStore = new FlagsStore();
