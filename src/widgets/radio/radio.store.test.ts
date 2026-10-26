import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observable, observableRef, runInAction } from 'mobx';

import type {
  CarEntry,
  RadioTune,
  SessionSnapshot,
} from '@shared/contracts/generated/bindings';
import { mockRadioFrequencies } from '@features/preview/mocks/radio';
import { RadioWidgetStore } from './radio.store';

type Deps = ConstructorParameters<typeof RadioWidgetStore>[0];

const PLAYER_IDX = 1;
const RETUNE_SHOWN_MS = 3000;

const sessionTunedTo = (frequencyNum: number): SessionSnapshot =>
  ({
    playerCarIdx: PLAYER_IDX,
    playerRadio: { radioNum: 0, frequencyNum } satisfies RadioTune,
    cars: [
      {
        carIdx: PLAYER_IDX,
        userName: 'Max Verstappen',
        carNumber: '1',
        carClassColor: '#ffda59',
      } as CarEntry,
    ],
    radioFrequencies: mockRadioFrequencies(),
  }) as SessionSnapshot;

const makeStore = (showOnRetune = true) => {
  const session = observable(
    { sessionInfo: null as SessionSnapshot | null },
    { sessionInfo: observableRef }
  );
  const store = new RadioWidgetStore({
    core: {
      cars: observable({ radioTransmission: null }),
      session,
      liveWidgets: {
        getSettings: () => ({
          nameFormat: 'full',
          showChannel: true,
          showOnRetune,
        }),
      },
      startsWidgetStores: true,
    },
    instanceId: 'radio',
    type: 'radio',
  } as unknown as Deps);

  const tuneTo = (frequencyNum: number) =>
    runInAction(() => {
      session.sessionInfo = sessionTunedTo(frequencyNum);
    });

  return { store, tuneTo };
};

describe('RadioWidgetStore — change of channel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the player on the new channel for a moment', () => {
    const { store, tuneTo } = makeStore();

    tuneTo(0);
    tuneTo(2);

    expect(store.isVisible).toBe(true);
    expect(store.speaker?.channelLabel).toBe('TEAM');
    expect(store.isTalking).toBe(false);

    vi.advanceTimersByTime(RETUNE_SHOWN_MS);

    expect(store.isVisible).toBe(false);
    store.dispose();
  });

  it('does not take a session arriving for a change of channel', () => {
    const { store, tuneTo } = makeStore();

    tuneTo(0);

    expect(store.isVisible).toBe(false);
    store.dispose();
  });

  it('stays quiet when the setting is off', () => {
    const { store, tuneTo } = makeStore(false);

    tuneTo(0);
    tuneTo(2);

    expect(store.isVisible).toBe(false);
    store.dispose();
  });
});
