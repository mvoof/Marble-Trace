import type {
  RadioTransmission,
  SessionSnapshot,
} from '@shared/contracts/generated/bindings';
import {
  channelOfTransmission,
  type RadioChannelView,
} from '@entities/cars/radio-channel';

export type RadioNameFormat = 'full' | 'short';

export interface RadioSpeaker extends RadioChannelView {
  carNumber: string;
  /** The first line: the first name, or the whole short form ("Max V."). */
  firstLine: string;
  /** The rest of the full name, drawn below; empty for the short form. */
  secondLine: string;
  /** The class colour as the session gives it, a `#rrggbb`. */
  classColor: string;
}

interface NameLines {
  firstLine: string;
  secondLine: string;
}

/**
 * "Max Verstappen" → "Max" over "Verstappen", or "Max V." on one line. A name
 * of one word is one line either way.
 */
export const splitName = (
  fullName: string,
  nameFormat: RadioNameFormat
): NameLines => {
  const words = fullName.trim().split(/\s+/);

  if (words.length < 2) {
    return { firstLine: fullName.trim(), secondLine: '' };
  }

  const [firstName, ...rest] = words;

  if (nameFormat === 'short') {
    const lastName = rest[rest.length - 1];

    return {
      firstLine: `${firstName} ${lastName.charAt(0).toUpperCase()}.`,
      secondLine: '',
    };
  }

  return { firstLine: firstName, secondLine: rest.join(' ') };
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

  return {
    carNumber: car.carNumber,
    ...splitName(car.userName, nameFormat),
    classColor: car.carClassColor,
    ...channelOfTransmission(transmission, session),
  };
};

/**
 * The player on the frequency their radio is tuned to — what the plate shows
 * for a moment after the player changes channel. Null while the session names
 * no radio.
 */
export const playerOnTunedFrequency = (
  session: SessionSnapshot | null
): RadioTransmission | null => {
  const tune = session?.playerRadio;

  if (!session || !tune || session.playerCarIdx < 0) {
    return null;
  }

  return {
    carIdx: session.playerCarIdx,
    radioNum: tune.radioNum,
    frequencyNum: tune.frequencyNum,
  };
};

/** The channel the player's radio is tuned to, or null with no radio. */
export const resolveTunedChannel = (
  session: SessionSnapshot | null
): RadioChannelView | null => {
  const tuned = playerOnTunedFrequency(session);

  if (!tuned || !session) {
    return null;
  }

  return channelOfTransmission(tuned, session);
};
