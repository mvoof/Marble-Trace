import { useId } from 'react';
import { observer } from 'mobx-react-lite';
import {
  CarFront,
  ChevronsRight,
  Circle,
  Flag,
  Gauge,
  Octagon,
  Siren,
  Stone,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';

import type { FlagType } from '@shared/contracts/domain';
import { FLAG_LABEL } from '@widgets/flat-flags/flat-flags-utils';

import styles from './FlagItem.module.scss';

const ICON_STROKE_WIDTH = 2.5;
// One checker square in the icon's 24-unit viewBox.
const CHECKER_CELL = 4;
const CHECKER_PERIOD = CHECKER_CELL * 2;

interface FlagLook {
  className: string;
  icon: LucideIcon;
  // Solid shapes (the octagon, the dot) read as a sign only when filled.
  filledIcon?: boolean;
  // Lucide has no chequered flag: its flag, filled with a chequer pattern.
  checkered?: boolean;
}

const FLAG_LOOK: Record<Exclude<FlagType, 'none'>, FlagLook> = {
  yellow: { className: styles.itemYellow, icon: TriangleAlert },
  green: { className: styles.itemGreen, icon: Flag, filledIcon: true },
  red: { className: styles.itemRed, icon: Octagon, filledIcon: true },
  blue: { className: styles.itemBlue, icon: ChevronsRight },
  white: { className: styles.itemWhite, icon: CarFront },
  checkered: { className: styles.itemCheckered, icon: Flag, checkered: true },
  black: { className: styles.itemBlack, icon: Circle, filledIcon: true },
  meatball: { className: styles.itemMeatball, icon: Circle, filledIcon: true },
  furled: { className: styles.itemFurled, icon: Gauge },
  debris: { className: styles.itemDebris, icon: Stone },
  sc: { className: styles.itemSc, icon: Siren },
  dq: { className: styles.itemDq, icon: X },
};

interface FlagItemProps {
  flag: FlagType;
}

export const FlagItem = observer(({ flag }: FlagItemProps) => {
  const checkerPatternId = useId();

  if (flag === 'none') {
    return null;
  }

  const { className, icon: Icon, filledIcon, checkered } = FLAG_LOOK[flag];

  let iconFill = 'none';

  if (checkered) {
    iconFill = `url(#${checkerPatternId})`;
  } else if (filledIcon) {
    iconFill = 'currentColor';
  }

  return (
    <div className={`${styles.item} ${className}`}>
      <div className={styles.iconCell}>
        <Icon
          className={styles.icon}
          fill={iconFill}
          strokeWidth={ICON_STROKE_WIDTH}
        >
          {checkered && (
            <defs>
              <pattern
                id={checkerPatternId}
                width={CHECKER_PERIOD}
                height={CHECKER_PERIOD}
                patternUnits="userSpaceOnUse"
              >
                <rect
                  width={CHECKER_CELL}
                  height={CHECKER_CELL}
                  fill="currentColor"
                />
                <rect
                  x={CHECKER_CELL}
                  y={CHECKER_CELL}
                  width={CHECKER_CELL}
                  height={CHECKER_CELL}
                  fill="currentColor"
                />
              </pattern>
            </defs>
          )}
        </Icon>
      </div>

      <div className={styles.slash} />

      <div className={styles.band}>
        <span className={styles.label}>{FLAG_LABEL[flag]}</span>
      </div>
    </div>
  );
});
