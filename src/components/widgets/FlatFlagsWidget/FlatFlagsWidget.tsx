import type { FlagType } from '../../../types/flags';

import styles from './FlatFlagsWidget.module.scss';

const FLAG_LABEL: Record<FlagType, string> = {
  none: '',
  green: 'GREEN FLAG',
  yellow: 'YELLOW FLAG',
  red: 'RED FLAG',
  blue: 'BLUE FLAG',
  white: 'LAST LAP',
  checkered: 'CHECKERED',
  black: 'BLACK FLAG',
  meatball: 'MEATBALL',
  debris: 'DEBRIS',
};

const FLAG_ITEM_CLASS: Record<FlagType, string> = {
  none: '',
  green: styles.itemGreen,
  yellow: styles.itemYellow,
  red: styles.itemRed,
  blue: styles.itemBlue,
  white: styles.itemWhite,
  checkered: styles.itemCheckered,
  black: styles.itemBlack,
  meatball: styles.itemMeatball,
  debris: styles.itemDebris,
};

const BLINK_FLAGS = new Set<FlagType>(['yellow', 'red']);

export interface FlatFlagsWidgetProps {
  flags: FlagType[];
  blinkOn: boolean;
}

export const FlatFlagsWidget = ({ flags, blinkOn }: FlatFlagsWidgetProps) => (
  <div className={styles.widget}>
    <div className={styles.header}>FLAGS</div>
    <div className={styles.list}>
      {flags.length === 0 ? (
        <div className={styles.empty}>NO ACTIVE FLAGS</div>
      ) : (
        flags.map((flag) => {
          const isBlinkOff = BLINK_FLAGS.has(flag) && !blinkOn;
          return (
            <div
              key={flag}
              className={`${styles.item} ${FLAG_ITEM_CLASS[flag]}${isBlinkOff ? ` ${styles.itemBlinkOff}` : ''}`}
            >
              {FLAG_LABEL[flag]}
            </div>
          );
        })
      )}
    </div>
  </div>
);
