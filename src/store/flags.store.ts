import { action, makeAutoObservable, reaction } from 'mobx';

import type { FlagType } from '@/types';
import {
  parseAllSessionFlags,
  parseSessionFlags,
} from '@utils/formatters/flags-utils';
import type { RootStore } from './root-store';

const NO_FLAG: FlagType = 'none';
const NO_FLAGS: FlagType[] = [];

interface HoldState {
  timer: ReturnType<typeof setTimeout> | null;
}

export class FlagsStore {
  displayFlags: FlagType[] = [];
  ledDisplayFlag: FlagType = NO_FLAG;

  private readonly flatHold: HoldState = { timer: null };
  private readonly ledHold: HoldState = { timer: null };

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this);
  }

  init() {
    this.initFlatHold();
    this.initLedHold();
  }

  get parsedFlags(): FlagType[] {
    return parseAllSessionFlags(
      this.root.telemetry.session?.session_flags ?? null,
      this.root.telemetry.session?.player_car_flags ?? null
    );
  }

  get parsedFlag(): FlagType {
    return parseSessionFlags(
      this.root.telemetry.session?.session_flags ?? null,
      this.root.telemetry.session?.player_car_flags ?? null
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
            if (!hold.timer) {
              hold.timer = setTimeout(
                action(() => {
                  setValue(emptyValue);
                  hold.timer = null;
                }),
                holdDuration * 1000
              );
            }
          } else if (holdDuration === 0) {
            action(() => {
              if (hold.timer) {
                clearTimeout(hold.timer);
                hold.timer = null;
              }

              setValue(emptyValue);
            })();
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
        this.root.widgetSettings.getFlagDisplaySettings('flat-flags')
          .holdDuration,
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
        this.root.widgetSettings.getFlagDisplaySettings('led-flags')
          .holdDuration,
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
