import { useEffect, useRef, useState } from 'react';

import type { FlagType } from '../../../types/flags';

import styles from './FlagsWidget.module.scss';

const BLOCKS = 3;
const DIODE_CELL_PX = 12;
const BOARD_PADDING_PX = 4;
const BLOCK_GAP_PX = 4;
const MIN_SINGLE_LED_PX = 40;

// Board width = 2*padding + 2*gaps + blocks*dpb*cell
// => dpb = (width - 2*padding - (blocks-1)*gap) / (blocks * cell)
const computeDiodesPerBlock = (containerWidth: number): number => {
  const available =
    containerWidth - BOARD_PADDING_PX * 2 - BLOCK_GAP_PX * (BLOCKS - 1);
  return Math.max(
    1,
    Math.min(6, Math.floor(available / (BLOCKS * DIODE_CELL_PX)))
  );
};

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

const buildGridData = (dpb: number): BlockData[] => {
  const blocks: BlockData[] = [];
  const last = BLOCKS * dpb - 1;

  for (let by = 0; by < BLOCKS; by++) {
    for (let bx = 0; bx < BLOCKS; bx++) {
      const diodes: DiodeData[] = [];

      for (let dy = 0; dy < dpb; dy++) {
        for (let dx = 0; dx < dpb; dx++) {
          const gx = bx * dpb + dx;
          const gy = by * dpb + dy;
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
};

const getColorClass = (
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

const getSingleLedColorClass = (flag: FlagType): string => {
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

export interface FlagsWidgetProps {
  flag: FlagType;
  blinkOn: boolean;
}

export const FlagsWidget = ({ flag, blinkOn }: FlagsWidgetProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [diodesPerBlock, setDiodesPerBlock] = useState(6);
  const [isSingleLed, setIsSingleLed] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const obs = new ResizeObserver(([entry]) => {
      const w = Math.min(entry.contentRect.width, entry.contentRect.height);
      if (w < MIN_SINGLE_LED_PX) {
        setIsSingleLed(true);
      } else {
        setIsSingleLed(false);
        setDiodesPerBlock(computeDiodesPerBlock(w));
      }
    });

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const isOff =
    flag === 'none' || ((flag === 'yellow' || flag === 'red') && !blinkOn);

  if (isSingleLed) {
    const colorClass = isOff ? '' : getSingleLedColorClass(flag);
    return (
      <div ref={wrapperRef} className={styles.wrapper}>
        <div className={styles.singleLed}>
          <div
            className={`${styles.singleLedInner}${colorClass ? ` ${colorClass}` : ''}`}
          />
        </div>
      </div>
    );
  }

  const gridData = buildGridData(diodesPerBlock);
  const matrixSize = BLOCKS * diodesPerBlock;

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <div
        className={styles.board}
        style={
          // CSS custom properties for dynamic grid sizing
          {
            '--dpb': diodesPerBlock,
            '--blocks': BLOCKS,
          } as object
        }
      >
        {gridData.map(({ diodes, key }) => (
          <div key={key} className={styles.block}>
            {diodes.map(({ gx, gy, bx, by, isCorner, key: dk }) => {
              if (isCorner) {
                return <div key={dk} className={styles.diodeHidden} />;
              }

              const colorClass = isOff
                ? ''
                : getColorClass(gx, gy, bx, by, flag, matrixSize);

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
    </div>
  );
};
