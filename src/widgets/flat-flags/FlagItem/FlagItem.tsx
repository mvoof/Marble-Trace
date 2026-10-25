import { observer } from 'mobx-react-lite';
import {
  CarFront,
  ChevronsRight,
  Circle,
  Flag,
  Gauge,
  Grid2x2,
  Octagon,
  Shapes,
  Siren,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';

import type { FlagType } from '@shared/contracts/domain';
import { BLINK_FLAGS, FLAG_LABEL } from '@widgets/flat-flags/flat-flags-utils';
import { FLAG_BLINK } from '@entities/flags/flag-blink';
import { useBlink } from '@shared/hooks/useBlink';

import styles from './FlagItem.module.scss';

const ICON_STROKE_WIDTH = 2.5;

interface FlagLook {
  className: string;
  icon: LucideIcon;
  // Solid shapes (the octagon, the dot) read as a sign only when filled.
  filledIcon?: boolean;
}

const FLAG_LOOK: Record<Exclude<FlagType, 'none'>, FlagLook> = {
  yellow: { className: styles.itemYellow, icon: TriangleAlert },
  green: { className: styles.itemGreen, icon: Flag, filledIcon: true },
  red: { className: styles.itemRed, icon: Octagon, filledIcon: true },
  blue: { className: styles.itemBlue, icon: ChevronsRight },
  white: { className: styles.itemWhite, icon: CarFront },
  checkered: { className: styles.itemCheckered, icon: Grid2x2 },
  black: { className: styles.itemBlack, icon: Circle, filledIcon: true },
  meatball: { className: styles.itemMeatball, icon: Circle, filledIcon: true },
  furled: { className: styles.itemFurled, icon: Gauge },
  debris: { className: styles.itemDebris, icon: Shapes },
  sc: { className: styles.itemSc, icon: Siren },
  dq: { className: styles.itemDq, icon: X },
};

interface FlagItemProps {
  flag: FlagType;
}

export const FlagItem = observer(({ flag }: FlagItemProps) => {
  const blinkRef = useBlink<HTMLDivElement>(
    BLINK_FLAGS.has(flag) ? FLAG_BLINK : null
  );

  if (flag === 'none') {
    return null;
  }

  const { className, icon: Icon, filledIcon } = FLAG_LOOK[flag];

  return (
    <div ref={blinkRef} className={`${styles.item} ${className}`}>
      <div className={styles.iconCell}>
        <Icon
          className={styles.icon}
          fill={filledIcon ? 'currentColor' : 'none'}
          strokeWidth={ICON_STROKE_WIDTH}
        />
      </div>

      <div className={styles.slash} />

      <div className={styles.band}>
        <span className={styles.label}>{FLAG_LABEL[flag]}</span>
      </div>
    </div>
  );
});
