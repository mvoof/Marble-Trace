import { describe, expect, it } from 'vitest';

import type {
  CarEntry,
  SessionSnapshot,
} from '@shared/contracts/generated/bindings';
import { mockRadioFrequencies } from '@features/preview/mocks/radio';
import { resolveSpeaker, shortenName } from './radio-utils';

const SPEAKER_IDX = 4;

const session = (): SessionSnapshot =>
  ({
    playerCarIdx: 0,
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

describe('shortenName', () => {
  it('keeps the first name and the initial of the last', () => {
    expect(shortenName('Juan Pablo Montoya')).toBe('Juan M.');
  });

  it('leaves a single word alone', () => {
    expect(shortenName('SkyRaven')).toBe('SkyRaven');
  });
});

describe('resolveSpeaker', () => {
  it('names the car and the channel of the transmission', () => {
    expect(
      resolveSpeaker(
        { carIdx: SPEAKER_IDX, radioNum: 0, frequencyNum: 2 },
        session(),
        'short'
      )
    ).toEqual({
      carNumber: '27',
      name: 'Max V.',
      classColor: '#ffda59',
      channel: 'team',
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
