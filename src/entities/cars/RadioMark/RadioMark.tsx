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
  /**
   * The player's row, filled with a colour the user picks — one that may be
   * the channel's own. The mic then sits on a dark square of its own.
   */
  onPlayerRow?: boolean;
}

/**
 * A mic beside a driver who is on the radio — the player included, while
 * holding push-to-talk — in the colour of the channel. It reads the
 * transmission itself, so a new voice redraws the marks and not the rows
 * they sit in.
 */
export const RadioMark = observer(
  ({ carIdx, onPlayerRow = false }: RadioMarkProps) => {
    const { radioTransmission } = useCarsStore();
    const { sessionInfo } = useSessionStore();

    if (radioTransmission?.carIdx !== carIdx) {
      return null;
    }

    const { channel } = channelOfTransmission(radioTransmission, sessionInfo);

    return (
      <span
        className={[
          styles.mark,
          CHANNEL_CLASS[channel],
          onPlayerRow ? styles.markOnPlayerRow : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="On the radio"
      >
        <Mic className={styles.icon} aria-hidden="true" />
      </span>
    );
  }
);
