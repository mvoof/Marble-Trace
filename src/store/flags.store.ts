import { action, makeAutoObservable, reaction } from 'mobx';

import type { FlagType } from '@/types';
import type { FlagDisplaySettings } from '@/types/widget-settings';
import {
  parseAllSessionFlags,
  parseSessionFlags,
} from '@utils/formatters/flags-utils';
import type { RootStore } from './root-store';

const NO_FLAG: FlagType = 'none';
const NO_FLAGS: FlagType[] = [];
const FLAG_BLINK_INTERVAL_MS = 400;
const BLINK_FLAG_TYPES = new Set<FlagType>(['yellow', 'red']);

interface HoldState {
  timer: ReturnType<typeof setTimeout> | null;
}

export class FlagsStore {
  displayFlags: FlagType[] = [];
  ledDisplayFlag: FlagType = NO_FLAG;
  blinkOn = true;

  private readonly flatHold: HoldState = { timer: null };
  private readonly ledHold: HoldState = { timer: null };
  private blinkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this);
  }

  init() {
    this.createHoldReaction(
      () => this.parsedFlags,
      (flags) => flags.length === 0,
      NO_FLAGS,
      () =>
        this.root.widgetSettings.getSettings<FlagDisplaySettings>('flat-flags')
          .holdDuration,
      (value) => {
        this.displayFlags = value;
      },
      () => this.displayFlags,
      this.flatHold
    );

    this.createHoldReaction(
      () => this.parsedFlag,
      (flag) => flag === NO_FLAG,
      NO_FLAG,
      () =>
        this.root.widgetSettings.getSettings<FlagDisplaySettings>('led-flags')
          .holdDuration,
      (value) => {
        this.ledDisplayFlag = value;
      },
      () => this.ledDisplayFlag,
      this.ledHold
    );

    this.initBlink();
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

  private initBlink() {
    reaction(
      () =>
        BLINK_FLAG_TYPES.has(this.ledDisplayFlag) ||
        this.displayFlags.some((flag) => BLINK_FLAG_TYPES.has(flag)),
      (shouldBlink) => {
        if (shouldBlink) {
          if (!this.blinkInterval) {
            this.blinkInterval = setInterval(
              action(() => {
                this.blinkOn = !this.blinkOn;
              }),
              FLAG_BLINK_INTERVAL_MS
            );
          }
        } else {
          if (this.blinkInterval) {
            clearInterval(this.blinkInterval);

            this.blinkInterval = null;
          }

          action(() => {
            this.blinkOn = true;
          })();
        }
      }
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

    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);

      this.blinkInterval = null;
    }

    this.blinkOn = true;
  }
}
