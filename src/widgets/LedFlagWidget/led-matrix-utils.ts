import type { FlagType } from '@/types';
import { BLOCKS } from '@utils/widget/led-flag-utils';

export interface ColorStyles {
  colorGreen: string;
  colorYellow: string;
  colorYellowStatic: string;
  colorRed: string;
  colorWhite: string;
  colorBlue: string;
  colorOrange: string;
  colorCheckered?: string;
  colorDebris?: string;
  colorDq?: string;
}

export const getColorClass = (
  gx: number,
  gy: number,
  _bx: number,
  _by: number,
  flag: FlagType,
  matrixSizeX: number,
  matrixSizeY: number,
  styles: ColorStyles
): string => {
  const lastX = matrixSizeX - 1;
  const lastY = matrixSizeY - 1;
  const isEdge = gx === 0 || gx === lastX || gy === 0 || gy === lastY;
  const dpb = matrixSizeY / BLOCKS;

  switch (flag) {
    case 'green':
      return styles.colorGreen;

    case 'yellow': {
      const midX = matrixSizeX / 2 - 0.5;
      if (Math.abs(gx - midX) < 0.8) {
        return styles.colorYellowStatic;
      }
      return styles.colorYellow;
    }

    case 'red':
      return styles.colorRed;

    case 'white':
      return styles.colorWhite;

    case 'blue':
      return Math.floor((gx + gy) / dpb) % 2 === 0
        ? styles.colorBlue
        : styles.colorYellow;

    case 'checkered':
      return styles.colorWhite;

    case 'debris':
      return Math.floor((gx + gy) / 3) % 2 === 0
        ? styles.colorYellow
        : styles.colorRed;

    case 'black':
      return isEdge ? styles.colorWhite : '';

    case 'dq': {
      if (isEdge) return styles.colorWhite;
      const normX = gx / (matrixSizeX - 1);
      const normY = gy / (matrixSizeY - 1);
      const onDiag1 = Math.abs(normX - normY) < 0.15;
      const onDiag2 = Math.abs(normX - (1 - normY)) < 0.15;
      return onDiag1 || onDiag2 ? styles.colorRed : '';
    }

    case 'meatball': {
      if (isEdge) return styles.colorWhite;
      const cx = matrixSizeX / 2 - 0.5;
      const cy = matrixSizeY / 2 - 0.5;
      const radiusSq = Math.pow(Math.min(matrixSizeX, matrixSizeY) * 0.38, 2);
      const dx = gx - cx;
      const dy = gy - cy;
      return dx * dx + dy * dy <= radiusSq ? styles.colorOrange : '';
    }

    default:
      return '';
  }
};

export const getSingleLedColorClass = (
  flag: FlagType,
  styles: ColorStyles
): string => {
  switch (flag) {
    case 'green':
      return styles.colorGreen;
    case 'yellow':
      return styles.colorYellow;
    case 'red':
      return styles.colorRed;
    case 'white':
      return styles.colorWhite;
    case 'checkered':
      return styles.colorCheckered || styles.colorWhite;
    case 'blue':
      return styles.colorBlue;
    case 'meatball':
      return styles.colorOrange;
    case 'debris':
      return styles.colorDebris || styles.colorYellow;
    case 'dq':
      return styles.colorDq || styles.colorRed;
    default:
      return '';
  }
};
