import type { FlagType } from '../../../types';
import { BLOCKS } from '../../../utils/widget/led-flag-utils';

import styles from './LedMatrix.module.scss';

export const getColorClass = (
  gx: number,
  gy: number,
  bx: number,
  by: number,
  flag: FlagType,
  matrixSize: number
): string => {
  const last = matrixSize - 1;
  const isEdge = gx === 0 || gx === last || gy === 0 || gy === last;
  const dpb = matrixSize / BLOCKS;

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
      return Math.floor((gx + gy) / dpb) % 2 === 0
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
      const cx = matrixSize / 2 - 0.5;
      const cy = matrixSize / 2 - 0.5;
      const radiusSq = Math.pow(matrixSize * 0.38, 2);
      const dx = gx - cx;
      const dy = gy - cy;
      return dx * dx + dy * dy <= radiusSq ? styles.colorOrange : '';
    }

    default:
      return '';
  }
};

export const getSingleLedColorClass = (flag: FlagType): string => {
  switch (flag) {
    case 'green':
      return styles.colorGreen;
    case 'yellow':
      return styles.colorYellow;
    case 'red':
      return styles.colorRed;
    case 'white':
    case 'checkered':
      return styles.colorWhite;
    case 'blue':
      return styles.colorBlue;
    case 'meatball':
      return styles.colorOrange;
    case 'debris':
      return styles.colorYellow;
    default:
      return '';
  }
};
