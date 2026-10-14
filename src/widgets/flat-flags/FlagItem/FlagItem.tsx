import { observer } from 'mobx-react-lite';

import type { FlagType } from '@shared/contracts/domain';
import { BLINK_FLAGS, FLAG_LABEL } from '@widgets/flat-flags/flat-flags-utils';
import { FLAG_BLINK } from '@entities/flags/flag-blink';
import { useBlink } from '@shared/hooks/useBlink';

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
  const blinkRef = useBlink<HTMLDivElement>(
    BLINK_FLAGS.has(flag) ? FLAG_BLINK : null
  );

  return (
    <div ref={blinkRef} className={`${styles.item} ${FLAG_ITEM_CLASS[flag]}`}>
      {FLAG_LABEL[flag]}
    </div>
  );
});
