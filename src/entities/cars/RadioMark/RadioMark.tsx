import { observer } from 'mobx-react-lite';
import { Mic } from 'lucide-react';
import type { RadioChannel } from '@shared/contracts/generated/bindings';
import { useCarsStore } from '@entities/cars/cars-context';
import { channelOfTransmission } from '@entities/cars/radio-channel';
import { useSessionStore } from '@entities/session/session-context';
import styles from './RadioMark.module.scss';

const CHANNEL_CLASS: Record<RadioChannel, string> = {
  all: styles.channelAll,
  team: styles.channelTeam,
  raceControl: styles.channelRaceControl,
  club: styles.channelClub,
  other: styles.channelOther,
};

interface RadioMarkProps {
  carIdx: number;
}

/**
 * A mic beside a driver who is on the radio — the player included, while
 * holding push-to-talk — in the colour of the channel. It reads the
 * transmission itself, so a new voice redraws the marks and not the rows
 * they sit in.
 */
export const RadioMark = observer(({ carIdx }: RadioMarkProps) => {
  const { radioTransmission } = useCarsStore();
  const { sessionInfo } = useSessionStore();

  if (radioTransmission?.carIdx !== carIdx) {
    return null;
  }

  const { channel } = channelOfTransmission(radioTransmission, sessionInfo);

  return (
    <Mic
      className={`${styles.mark} ${CHANNEL_CLASS[channel]}`}
      aria-label="On the radio"
    />
  );
});
