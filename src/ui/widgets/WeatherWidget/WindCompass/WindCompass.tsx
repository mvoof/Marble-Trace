import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import CarIcon from '@assets/car-icon.svg?react';
import { RotatingRing } from './RotatingRing/RotatingRing';
import { WindArrow } from './WindArrow/WindArrow';

import styles from './WindCompass.module.scss';
import type { WeatherWidgetSettings } from '@/types/widget-settings';

export const WindCompass = observer(() => {
  const { showCompass } = useWidgetSettings<WeatherWidgetSettings>('weather');

  if (!showCompass) {
    return null;
  }

  return (
    <div className={styles.compassBlock}>
      <div className={styles.compassWrapper}>
        <svg
          width="100%"
          height="100%"
          viewBox="-110 -110 220 220"
          className={styles.compassSvg}
        >
          <RotatingRing />

          <WindArrow />

          <g pointerEvents="none">
            <CarIcon
              x="-40"
              y="-40"
              width="80"
              height="80"
              style={{ color: 'rgba(255,255,255,0.88)' }}
            />
          </g>
        </svg>
      </div>
    </div>
  );
});
