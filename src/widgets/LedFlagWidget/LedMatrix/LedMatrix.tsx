import { observer } from 'mobx-react-lite';

import { BLOCKS, buildGridData } from '@utils/widget/led-flag-utils';
import { getColorClass, type ColorStyles } from '../led-matrix-utils';

import styles from './LedMatrix.module.scss';
import type { FlagDisplaySettings } from '@/types/widget-settings';
import {
  useFlagsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface LedMatrixProps {
  diodesPerBlock: number;
  splitRows?: number;
}

export const LedMatrix = observer(
  ({ diodesPerBlock, splitRows = 18 }: LedMatrixProps) => {
    const flags = useFlagsStore();
    const widgetSettings = useWidgetSettingsStore();
    const { alwaysShow, animate, split } =
      widgetSettings.getSettings<FlagDisplaySettings>('led-flags');
    const { ledDisplayFlag: flag, blinkOn } = flags;

    if (!alwaysShow && flag === 'none') {
      return null;
    }

    const isOff =
      flag === 'none' ||
      (!animate && (flag === 'yellow' || flag === 'red') && !blinkOn);

    const dpbX = split ? 3 : diodesPerBlock;
    const dpbY = split ? splitRows : diodesPerBlock;
    const widthBlocks = split ? 1 : BLOCKS;
    const heightBlocks = split ? 1 : BLOCKS;

    const gridData = buildGridData(
      dpbX,
      dpbY,
      widthBlocks,
      heightBlocks,
      !!split
    );
    const matrixSizeX = widthBlocks * dpbX;
    const matrixSizeY = heightBlocks * dpbY;

    const checkerSize = dpbX >= 8 ? 3 : dpbX >= 6 ? 2 : 1;

    const maxRing = split
      ? Math.floor((matrixSizeY - 1) / 2)
      : Math.floor((Math.min(matrixSizeX, matrixSizeY) - 1) / 2);

    return (
      <div
        className={`${styles.board}${animate ? ` ${styles.animate}` : ''} ${styles[`flag-${flag}`] || ''}`}
        data-size={dpbX >= 8 && !split ? 'large' : 'small'}
        data-max-ring={maxRing}
        style={
          {
            '--dpb': dpbX,
            '--dpb-x': dpbX,
            '--dpb-y': dpbY,
            '--blocks': heightBlocks,
            '--blocks-x': widthBlocks,
            '--board-gap': split ? '0px' : undefined,
            '--max-ring': maxRing,
            '--wave-width': dpbX >= 8 && !split ? 1.5 : 0.5,
            '--max-radius': Math.min(matrixSizeX, matrixSizeY) * 0.38,
          } as React.CSSProperties
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
                : getColorClass(
                    gx,
                    gy,
                    bx,
                    by,
                    flag,
                    matrixSizeX,
                    matrixSizeY,
                    styles as unknown as ColorStyles
                  );

              const ring = split
                ? Math.min(gy, matrixSizeY - 1 - gy)
                : Math.min(gx, gy, matrixSizeX - 1 - gx, matrixSizeY - 1 - gy);
              const cx = matrixSizeX / 2 - 0.5;
              const cy = matrixSizeY / 2 - 0.5;
              const distCenter = Math.sqrt((gx - cx) ** 2 + (gy - cy) ** 2);
              const colParity = gx < cx ? 0 : 1;
              const checkeredParity =
                (Math.floor(gx / checkerSize) + Math.floor(gy / checkerSize)) %
                2;

              const isCenter = split
                ? ring >= maxRing - 1
                : bx === 1 && by === 1;
              const isInner =
                !isCenter &&
                (split
                  ? ring >= maxRing - 4 && ring < maxRing - 1
                  : ring >= dpbX - 3 && ring < dpbX);
              const isOuter = !isCenter && !isInner && ring <= 2;

              const chevronVal = gy - Math.abs(gx - cx);
              const chevronParity = Math.floor((chevronVal + 100) / 3) % 2;

              return (
                <div
                  key={dk}
                  className={`${styles.diode}${colorClass ? ` ${colorClass}` : ''}`}
                  data-ring={ring}
                  data-is-center={isCenter}
                  data-is-inner={isInner}
                  data-is-outer={isOuter}
                  style={
                    {
                      '--gx': gx,
                      '--gy': gy,
                      '--bx': bx,
                      '--by': by,
                      '--diag-parity': (gx + gy) % 2,
                      '--col-parity': colParity,
                      '--col-offset': (gx * 3) % 7,
                      '--checkered-parity': checkeredParity,
                      '--ring': ring,
                      '--dist-center': distCenter,
                      '--chevron-val': chevronVal,
                      '--chevron-parity': chevronParity,
                    } as React.CSSProperties
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    );
  }
);
