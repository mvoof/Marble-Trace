import type {
  RadioChannel,
  RadioTransmission,
  SessionSnapshot,
} from '@shared/contracts/generated/bindings';

export type RadioNameFormat = 'full' | 'short';

export interface RadioSpeaker {
  carNumber: string;
  name: string;
  /** The class colour as the session gives it, a `#rrggbb`. */
  classColor: string;
  channel: RadioChannel;
}

/** What the plate says under the name, per channel. */
export const CHANNEL_LABEL: Record<RadioChannel, string> = {
  all: 'ALL',
  team: 'TEAM',
  raceControl: 'RACE CONTROL',
  club: 'CLUB',
  other: 'PRIVATE',
};

/**
 * "Max Verstappen" → "Max V.": the first word and the initial of the last. A
 * name of one word is left as it is.
 */
export const shortenName = (fullName: string): string => {
  const words = fullName.trim().split(/\s+/);

  if (words.length < 2) {
    return fullName.trim();
  }

  const lastName = words[words.length - 1];

  return `${words[0]} ${lastName.charAt(0).toUpperCase()}.`;
};

/**
 * The car and the channel a transmission is on, from the session. Null when
 * the session does not know the car — a speaker the plate cannot name is not
 * worth a plate.
 */
export const resolveSpeaker = (
  transmission: RadioTransmission | null,
  session: SessionSnapshot | null,
  nameFormat: RadioNameFormat
): RadioSpeaker | null => {
  if (!transmission || !session) {
    return null;
  }

  const car = session.cars.find(
    (entry) => entry.carIdx === transmission.carIdx
  );

  if (!car) {
    return null;
  }

  const frequency = (session.radioFrequencies ?? []).find(
    (entry) =>
      entry.radioNum === transmission.radioNum &&
      entry.frequencyNum === transmission.frequencyNum
  );

  return {
    carNumber: car.carNumber,
    name: nameFormat === 'short' ? shortenName(car.userName) : car.userName,
    classColor: car.carClassColor,
    channel: frequency?.channel ?? 'other',
  };
};
