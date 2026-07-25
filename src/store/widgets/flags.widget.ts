import {
  action,
  makeAutoObservable,
  reaction,
  type IReactionDisposer,
} from 'mobx';

import type { FlagType } from '@/types';
import type { RaceFlags } from '@/types/bindings';
import type { FlagDisplaySettings } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';

const NO_FLAG: FlagType = 'none';
const NO_FLAGS: FlagType[] = [];

const flagsToList = (flags: RaceFlags): FlagType[] => {
  const result: FlagType[] = [];

  if (flags.black) {
    result.push('black');
  }

  if (flags.disqualify) {
    result.push('dq');
  }

  if (flags.meatball) {
    result.push('meatball');
  }

  if (flags.red) {
    result.push('red');
  }

  if (flags.checkered) {
    result.push('checkered');
  }

  if (flags.white) {
    result.push('white');
  }

  if (flags.caution || flags.cautionWaving) {
    result.push('sc');
  } else if (flags.yellow) {
    result.push('yellow');
  }

  if (flags.blue) {
    result.push('blue');
  }

  if (flags.debris) {
    result.push('debris');
  }

  if (flags.green) {
    result.push('green');
  }

  return result;
};

const flagToPriority = (flags: RaceFlags): FlagType => {
  if (flags.disqualify) {
    return 'dq';
  }

  if (flags.black) {
    return 'black';
  }

  if (flags.meatball) {
    return 'meatball';
  }

  if (flags.red) {
    return 'red';
  }

  if (flags.checkered) {
    return 'checkered';
  }

  if (flags.white) {
    return 'white';
  }

  if (flags.caution || flags.cautionWaving) {
    return 'sc';
  }

  if (flags.yellow) {
    return 'yellow';
  }

  if (flags.blue) {
    return 'blue';
  }

  if (flags.debris) {
    return 'debris';
  }

  if (flags.green) {
    return 'green';
  }

  return 'none';
};
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
  private readonly disposers: IReactionDisposer[] = [];

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
    const flags = this.root.player.carStatus?.flags;
    const list = flags ? flagsToList(flags) : [];

    if (this.root.paceCar.isPaceCarOnTrack && !list.includes('sc')) {
      list.push('sc');
    }

    return list;
  }

  get parsedFlag(): FlagType {
    const flags = this.root.player.carStatus?.flags;
    const priority = flags ? flagToPriority(flags) : 'none';

    if (priority === 'none' && this.root.paceCar.isPaceCarOnTrack) {
      return 'sc';
    }

    return priority;
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
    this.disposers.push(
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
      )
    );
  }

  private initBlink() {
    this.disposers.push(
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
      )
    );
  }

  // Every RootStore instance (main window, overlay window, each isolated widget
  // preview) creates its own reactions; without this they outlive the store.
  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;
    this.reset();
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
