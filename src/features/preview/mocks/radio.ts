import type {
  RadioChannel,
  RadioFrequencyEntry,
  RadioTransmission,
  SessionSnapshot,
} from '@shared/contracts/generated/bindings';

const RADIO_NUM = 0;

/** The built-in frequencies of an iRacing session, in the sim's own order. */
export const mockRadioFrequencies = (): RadioFrequencyEntry[] => [
  { radioNum: RADIO_NUM, frequencyNum: 0, channel: 'all', name: '@ALLTEAMS' },
  { radioNum: RADIO_NUM, frequencyNum: 1, channel: 'all', name: '@DRIVERS' },
  { radioNum: RADIO_NUM, frequencyNum: 2, channel: 'team', name: '@TEAM' },
  { radioNum: RADIO_NUM, frequencyNum: 3, channel: 'club', name: '@CLUB' },
  {
    radioNum: RADIO_NUM,
    frequencyNum: 4,
    channel: 'raceControl',
    name: '@RACECONTROL',
  },
  { radioNum: RADIO_NUM, frequencyNum: 5, channel: 'other', name: 'Spotters' },
];

/**
 * A transmission from `carIdx` on the first frequency of `channel` — or, with
 * no car given, from the first car in the session that is not the player's.
 */
export const mockRadioTransmission = (
  session: SessionSnapshot | null,
  channel: RadioChannel = 'all',
  carIdx?: number
): RadioTransmission | null => {
  const frequency = mockRadioFrequencies().find(
    (entry) => entry.channel === channel
  );
  const speaker =
    carIdx ??
    session?.cars.find(
      (car) =>
        car.carIdx !== session.playerCarIdx &&
        !car.isPaceCar &&
        !car.isSpectator
    )?.carIdx;

  if (!frequency || speaker === undefined) {
    return null;
  }

  return {
    carIdx: speaker,
    radioNum: frequency.radioNum,
    frequencyNum: frequency.frequencyNum,
  };
};
