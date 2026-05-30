import { observer } from 'mobx-react-lite';

import type { FlagType } from '@/types';
import { BLINK_FLAGS, FLAG_LABEL } from '@utils/widget/flat-flags-utils';
import { useFlagsStore } from '@store/root-store-context';

import styles from './FlagItem.module.scss';

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
  penalty: styles.itemBlack,
  dq: styles.itemBlack,
};

interface FlagItemProps {
  flag: FlagType;
}

export const FlagItem = observer(({ flag }: FlagItemProps) => {
  const { blinkOn } = useFlagsStore();
  const isBlinkOff = BLINK_FLAGS.has(flag) && !blinkOn;

  return (
    <div
      className={`${styles.item} ${FLAG_ITEM_CLASS[flag]}${isBlinkOff ? ` ${styles.itemBlinkOff}` : ''}`}
    >
      {FLAG_LABEL[flag]}
    </div>
  );
});
