import { describe, expect, it } from 'vitest';

import type {
  CarEntry,
  SessionSnapshot,
} from '@shared/contracts/generated/bindings';
import { mockRadioFrequencies } from '@features/preview/mocks/radio';
import {
  playerOnTunedFrequency,
  resolveSpeaker,
  splitName,
} from './radio-utils';

const SPEAKER_IDX = 4;

const session = (): SessionSnapshot =>
  ({
    playerCarIdx: SPEAKER_IDX,
    playerRadio: { radioNum: 0, frequencyNum: 1 },
    cars: [
      {
        carIdx: SPEAKER_IDX,
        userName: 'Max Verstappen',
        carNumber: '27',
        carClassColor: '#ffda59',
      } as CarEntry,
    ],
    radioFrequencies: mockRadioFrequencies(),
  }) as SessionSnapshot;

describe('splitName', () => {
  it('puts the rest of a full name on the second line', () => {
    expect(splitName('Juan Pablo Montoya', 'full')).toEqual({
      firstLine: 'Juan',
      secondLine: 'Pablo Montoya',
    });
  });

  it('keeps the short form on one line', () => {
    expect(splitName('Juan Pablo Montoya', 'short')).toEqual({
      firstLine: 'Juan M.',
      secondLine: '',
    });
  });

  it('leaves a single word on one line', () => {
    expect(splitName('SkyRaven', 'full')).toEqual({
      firstLine: 'SkyRaven',
      secondLine: '',
    });
  });
});

describe('resolveSpeaker', () => {
  it('names the car and the frequency of the transmission', () => {
    expect(
      resolveSpeaker(
        { carIdx: SPEAKER_IDX, radioNum: 0, frequencyNum: 1 },
        session(),
        'full'
      )
    ).toEqual({
      carNumber: '27',
      firstLine: 'Max',
      secondLine: 'Verstappen',
      classColor: '#ffda59',
      channel: 'all',
      channelLabel: 'DRIVERS',
    });
  });

  it('reads a frequency the session does not list as another channel', () => {
    expect(
      resolveSpeaker(
        { carIdx: SPEAKER_IDX, radioNum: 0, frequencyNum: 99 },
        session(),
        'full'
      )?.channel
    ).toBe('other');
  });

  it('has nobody to show for a car the session does not know', () => {
    expect(
      resolveSpeaker(
        { carIdx: 60, radioNum: 0, frequencyNum: 0 },
        session(),
        'full'
      )
    ).toBeNull();
  });
});

describe('playerOnTunedFrequency', () => {
  it('puts the player on the frequency the radio is tuned to', () => {
    expect(playerOnTunedFrequency(session())).toEqual({
      carIdx: SPEAKER_IDX,
      radioNum: 0,
      frequencyNum: 1,
    });
  });

  it('places nobody without a tuned radio', () => {
    expect(
      playerOnTunedFrequency({ ...session(), playerRadio: null })
    ).toBeNull();
  });
});
