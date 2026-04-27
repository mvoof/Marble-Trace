import type { FlagType } from '../../../types/flags';

import styles from './FlagsWidget.module.scss';

const BLOCKS = 3;
const DIODES_PER_BLOCK = 6;
const MATRIX_SIZE = BLOCKS * DIODES_PER_BLOCK;

interface DiodeData {
  gx: number;
  gy: number;
  bx: number;
  by: number;
  isCorner: boolean;
  key: string;
}

interface BlockData {
  bx: number;
  by: number;
  diodes: DiodeData[];
  key: string;
}

const GRID_DATA: BlockData[] = (() => {
  const blocks: BlockData[] = [];
  const last = MATRIX_SIZE - 1;

  for (let by = 0; by < BLOCKS; by++) {
    for (let bx = 0; bx < BLOCKS; bx++) {
      const diodes: DiodeData[] = [];

      for (let dy = 0; dy < DIODES_PER_BLOCK; dy++) {
        for (let dx = 0; dx < DIODES_PER_BLOCK; dx++) {
          const gx = bx * DIODES_PER_BLOCK + dx;
          const gy = by * DIODES_PER_BLOCK + dy;
          const isCorner =
            (gx === 0 && gy === 0) ||
            (gx === last && gy === 0) ||
            (gx === 0 && gy === last) ||
            (gx === last && gy === last);

          diodes.push({ gx, gy, bx, by, isCorner, key: `${gx}-${gy}` });
        }
      }

      blocks.push({ bx, by, diodes, key: `${bx}-${by}` });
    }
  }

  return blocks;
})();

const MEATBALL_CENTER = MATRIX_SIZE / 2 - 0.5;
const MEATBALL_RADIUS_SQ = 49;

const getColorClass = (
  gx: number,
  gy: number,
  bx: number,
  by: number,
  flag: FlagType
): string => {
  const last = MATRIX_SIZE - 1;
  const isEdge = gx === 0 || gx === last || gy === 0 || gy === last;

  switch (flag) {
    case 'green':
      return styles.colorGreen;

    case 'yellow':
      return styles.colorYellow;

    case 'red':
      return styles.colorRed;

    case 'white':
      return styles.colorWhite;

    case 'blue':
      return Math.floor((gx + gy) / DIODES_PER_BLOCK) % 2 === 0
        ? styles.colorBlue
        : styles.colorYellow;

    case 'checkered':
      return (bx + by) % 2 === 0 ? styles.colorWhite : '';

    case 'debris':
      return Math.floor(gx / 3) % 2 === 0
        ? styles.colorYellow
        : styles.colorRed;

    case 'black':
      return isEdge ? styles.colorWhite : '';

    case 'meatball': {
      if (isEdge) return styles.colorWhite;
      const dx = gx - MEATBALL_CENTER;
      const dy = gy - MEATBALL_CENTER;
      return dx * dx + dy * dy <= MEATBALL_RADIUS_SQ ? styles.colorOrange : '';
    }

    default:
      return '';
  }
};

export interface FlagsWidgetProps {
  flag: FlagType;
  blinkOn: boolean;
}

export const FlagsWidget = ({ flag, blinkOn }: FlagsWidgetProps) => {
  const isOff =
    flag === 'none' || ((flag === 'yellow' || flag === 'red') && !blinkOn);

  return (
    <div className={styles.board}>
      {GRID_DATA.map(({ diodes, key }) => (
        <div key={key} className={styles.block}>
          {diodes.map(({ gx, gy, bx: dx, by: dy, isCorner, key: dk }) => {
            if (isCorner) {
              return <div key={dk} className={styles.diodeHidden} />;
            }

            const colorClass = isOff ? '' : getColorClass(gx, gy, dx, dy, flag);

            return (
              <div
                key={dk}
                className={`${styles.diode}${colorClass ? ` ${colorClass}` : ''}`}
              />
            );
          })}
        </div>
      ))}
      <div className={styles.glassOverlay} aria-hidden="true" />
    </div>
  );
};
