import { observer } from 'mobx-react-lite';

import type { FlagType } from '@shared/contracts/domain';
import { BLINK_FLAGS, FLAG_LABEL } from '@widgets/flat-flags/flat-flags-utils';
import { useFlagsStore } from '@entities/flags/flags-context';

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
  sc: styles.itemSc,
  dq: styles.itemDq,
  furled: styles.itemFurled,
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
