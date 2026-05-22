import { observer } from 'mobx-react-lite';

import { BLOCKS, buildGridData } from '@utils/widget/led-flag-utils';
import { getColorClass, type ColorStyles } from '../led-matrix-utils';

import styles from './LedMatrix.module.scss';
import {
  useFlagsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface LedMatrixProps {
  diodesPerBlock: number;
  blinkOn: boolean;
}

export const LedMatrix = observer(
  ({ diodesPerBlock, blinkOn }: LedMatrixProps) => {
    const flags = useFlagsStore();
    const widgetSettings = useWidgetSettingsStore();
    const { alwaysShow } = widgetSettings.getFlagDisplaySettings('led-flags');
    const flag = flags.ledDisplayFlag;

    if (!alwaysShow && flag === 'none') {
      return null;
    }

    const isOff =
      flag === 'none' || ((flag === 'yellow' || flag === 'red') && !blinkOn);

    const gridData = buildGridData(diodesPerBlock);
    const matrixSize = BLOCKS * diodesPerBlock;

    return (
      <div
        className={styles.board}
        style={{ '--dpb': diodesPerBlock, '--blocks': BLOCKS } as object}
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
                    matrixSize,
                    styles as unknown as ColorStyles
                  );

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
  }
);
