import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import CarIcon from '@assets/car-icon.svg?react';
import { RingGeometry } from './RingGeometry/RingGeometry';
import { RotatingRing } from './RotatingRing/RotatingRing';
import { WindArrow } from './WindArrow/WindArrow';

import styles from './WindCompass.module.scss';
import type { WeatherWidgetSettings } from '@/types/widget-settings';

// The box used to be drawn wide enough for the arrow to swing in — its tip
// reaches 105 units out, while the ring only reaches 82 — which left a rim of
// air on every side of the circle. The box is cropped to just past the ring
// instead, and the arrow is pulled in by the same amount rather than being
// clipped by it.
const VIEWBOX_RADIUS = 94;
const VIEWBOX_SIZE = VIEWBOX_RADIUS * 2;
const ARROW_SCALE = 0.88;

// The dial is drawn smaller in the horizontal layout, where it shares the row
// with the conditions, so its cardinal letters are set in larger user units to
// come out the same size on screen as the tall layout's.
const CARDINAL_UNITS_TALL = 15;
const CARDINAL_UNITS_HORIZONTAL = 20;

interface WindCompassProps {
  horizontal?: boolean;
}

export const WindCompass = observer(
  ({ horizontal = false }: WindCompassProps) => {
    const { showCompass, showCompassRing } =
      useWidgetSettings<WeatherWidgetSettings>('weather');

    if (!showCompass) {
      return null;
    }

    return (
      <div className={styles.compassBlock}>
        <div className={styles.compassWrapper}>
          <svg
            width="100%"
            height="100%"
            viewBox={`${-VIEWBOX_RADIUS} ${-VIEWBOX_RADIUS} ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
            className={styles.compassSvg}
          >
            {showCompassRing && (
              <RotatingRing>
                <RingGeometry
                  cardinalUnits={
                    horizontal ? CARDINAL_UNITS_HORIZONTAL : CARDINAL_UNITS_TALL
                  }
                />
              </RotatingRing>
            )}

            <g transform={`scale(${ARROW_SCALE})`}>
              <WindArrow />
            </g>

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
  }
);
