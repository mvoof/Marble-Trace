import type {
  RadioChannel,
  RadioTransmission,
  SessionSnapshot,
} from '@shared/contracts/generated/bindings';

export interface RadioChannelView {
  channel: RadioChannel;
  /** The frequency's name as a plate shows it. */
  channelLabel: string;
}

/** What a plate says for a frequency the session does not list. */
const UNKNOWN_CHANNEL_LABEL = 'RADIO';

/** The channel a transmission is on, named as the session lists it. */
export const channelOfTransmission = (
  transmission: RadioTransmission,
  session: SessionSnapshot | null
): RadioChannelView => {
  const frequency = (session?.radioFrequencies ?? []).find(
    (entry) =>
      entry.radioNum === transmission.radioNum &&
      entry.frequencyNum === transmission.frequencyNum
  );

  return {
    channel: frequency?.channel ?? 'other',
    channelLabel: frequency?.label ?? UNKNOWN_CHANNEL_LABEL,
  };
};
