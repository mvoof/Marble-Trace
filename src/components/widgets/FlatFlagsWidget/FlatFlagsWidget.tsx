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

export const FlatFlagsWidget = ({ flags, blinkOn }: FlatFlagsWidgetProps) => {
  const visibleFlags = flags.filter((f) => !BLINK_FLAGS.has(f) || blinkOn);

  return (
    <div className={styles.widget}>
      <div className={styles.header}>FLAGS</div>
      <div className={styles.list}>
        {visibleFlags.length === 0 ? (
          <div className={styles.empty}>NO ACTIVE FLAGS</div>
        ) : (
          visibleFlags.map((flag) => (
            <div
              key={flag}
              className={`${styles.item} ${FLAG_ITEM_CLASS[flag]}`}
            >
              {FLAG_LABEL[flag]}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
