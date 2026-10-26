import {
  action,
  makeAutoObservable,
  reaction,
  type IReactionDisposer,
} from 'mobx';

import type { CarsStore } from '@entities/cars/cars.store';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';
import type { SessionStore } from '@entities/session/session.store';
import type { WidgetInstanceContext } from '@entities/widget/widget-instances.store';
import { useWidgetInstanceStore } from '@entities/widget/widget-instance-context';
import type { SelfHidingWidgetStore } from '@features/widget-auto-hide/widget-auto-hide.store';
import {
  playerOnTunedFrequency,
  resolveSpeaker,
  type RadioSpeaker,
} from './radio-utils';
import type { RadioWidgetSettings } from './settings-schema';

interface RadioDeps {
  cars: CarsStore;
  session: SessionStore;
  liveWidgets: LiveWidgetsView;
  readonly startsWidgetStores: boolean;
}

/** How long the player's plate stays up after a change of channel. */
const RETUNE_SHOWN_MS = 3000;

/** The tuned frequency as one comparable value, or null with no radio. */
const tuneKeyOf = (session: SessionStore): string | null => {
  const tune = session.sessionInfo?.playerRadio;

  return tune ? `${tune.radioNum}:${tune.frequencyNum}` : null;
};

/**
 * One Radio plate: who is on the air, or — for a moment after the player
 * changes channel — the player on the new one. Per instance, so the timer
 * lives and dies with the plate that shows it.
 */
export class RadioWidgetStore implements SelfHidingWidgetStore {
  /** The player just changed channel and the plate is showing it. */
  retuneShown = false;

  private retuneTimer: ReturnType<typeof setTimeout> | null = null;

  private disposers: IReactionDisposer[] = [];

  private readonly root: RadioDeps;

  private readonly instanceId: string;

  constructor({ core, instanceId }: WidgetInstanceContext<RadioDeps>) {
    this.root = core;
    this.instanceId = instanceId;

    makeAutoObservable<RadioWidgetStore, 'root' | 'instanceId'>(this, {
      root: false,
      instanceId: false,
    });

    if (core.startsWidgetStores) {
      this.start();
    }
  }

  private start() {
    this.disposers.push(
      reaction(
        () => tuneKeyOf(this.root.session),
        (tuneKey, previousKey) => {
          // A session arriving, or leaving, is not a change of channel.
          if (tuneKey === null || previousKey === null) {
            return;
          }

          if (this.settings.showOnRetune) {
            this.showRetune();
          }
        }
      )
    );
  }

  private showRetune() {
    this.clearRetuneTimer();
    this.retuneShown = true;
    this.retuneTimer = setTimeout(
      action(() => {
        this.retuneShown = false;
        this.retuneTimer = null;
      }),
      RETUNE_SHOWN_MS
    );
  }

  dispose() {
    this.clearRetuneTimer();

    for (const disposeReaction of this.disposers) {
      disposeReaction();
    }

    this.disposers = [];
  }

  get settings(): RadioWidgetSettings {
    return this.root.liveWidgets.getSettings<RadioWidgetSettings>(
      this.instanceId
    );
  }

  /** Somebody is on the air — the wave runs only then. */
  get isTalking(): boolean {
    return this.root.cars.radioTransmission !== null;
  }

  /** Who the plate names: the voice on the air, else the player just retuned. */
  get speaker(): RadioSpeaker | null {
    const transmission =
      this.root.cars.radioTransmission ??
      (this.retuneShown
        ? playerOnTunedFrequency(this.root.session.sessionInfo)
        : null);

    return resolveSpeaker(
      transmission,
      this.root.session.sessionInfo,
      this.settings.nameFormat
    );
  }

  get isVisible(): boolean {
    return this.speaker !== null;
  }

  private clearRetuneTimer() {
    if (this.retuneTimer) {
      clearTimeout(this.retuneTimer);
      this.retuneTimer = null;
    }
  }
}

export const useRadioWidgetStore = () =>
  useWidgetInstanceStore<RadioWidgetStore>();
