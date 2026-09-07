import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';

import type { RadarSettings } from '@/types/widget-settings';
import { distanceUnit, formatDistance } from '@utils/telemetry-format';
import { getBarPillColor } from '@utils/radar-constants';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import {
  useAppSettingsStore,
  useBackendComputedStore,
  useRadarWidgetStore,
  useUnitsStore,
} from '@store/root-store-context';

import styles from './RadarBar.module.scss';

const MIN_PILL_PERCENT = 8;

const PILL_TOP_PROPERTY = '--radar-pill-top';
const PILL_HEIGHT_PROPERTY = '--radar-pill-height';
const PILL_COLOR_PROPERTY = '--radar-pill-color';
const TEXT_ROTATION_PROPERTY = '--radar-text-rotation';

const LEFT_TEXT_ROTATION = '-90deg';
const RIGHT_TEXT_ROTATION = '90deg';

interface RadarBarProps {
  side: 'left' | 'right';
}

interface PillGeometry {
  topPercent: number;
  heightPercent: number;
}

/**
 * Where the pill sits in the bar, as percentages of the bar's own height. The
 * car alongside is a body one car long, so the pill spans from its nose to its
 * tail and is never drawn thinner than `MIN_PILL_PERCENT`.
 */
const pillGeometryOf = (rawDist: number, carLength: number): PillGeometry => {
  const topPercent = (100 * -rawDist) / carLength;
  const bottomPercent = (100 * (carLength - rawDist)) / carLength;

  let clampedTop = Math.max(0, Math.min(100, topPercent));
  const clampedBottom = Math.max(0, Math.min(100, bottomPercent));
  let heightPercent = clampedBottom - clampedTop;

  if (heightPercent < MIN_PILL_PERCENT) {
    heightPercent = MIN_PILL_PERCENT;

    if (topPercent >= 100) {
      clampedTop = 100 - MIN_PILL_PERCENT;
    }

    if (bottomPercent <= 0) {
      clampedTop = 0;
    }
  }

  return { topPercent: clampedTop, heightPercent };
};

const signOf = (rawDist: number): string => {
  if (rawDist > 0) {
    return '+';
  }

  if (rawDist < 0) {
    return '-';
  }

  return '';
};

/**
 * One side of the bar radar. The distance to the car alongside changes on every
 * proximity frame, so the pill's position, its colour and its label all go to
 * the DOM through the reactive-DOM primitive; what re-renders this component is
 * only the spotter turning the side on and off. See `docs/rendering.md`.
 */
export const RadarBar = observer(({ side }: RadarBarProps) => {
  const units = useUnitsStore();
  const appSettings = useAppSettingsStore();
  const computed = useBackendComputedStore();
  const radarStore = useRadarWidgetStore();

  const radarSettings = useWidgetSettings<RadarSettings>('radar-bar');

  const visible = radarStore.isVisibleForWidget('radar-bar');
  const spotterActive =
    side === 'left' ? computed.spotterLeft : computed.spotterRight;
  const sideVisible = appSettings.dragMode || spotterActive;

  const pillRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const rawDist =
        side === 'left'
          ? computed.proximity?.radarDistances.leftDist
          : computed.proximity?.radarDistances.rightDist;

      if (rawDist === null || rawDist === undefined) {
        scheduleWrite(() => {
          element.classList.add(styles.pillEmpty);
        });

        return;
      }

      const { carLength } = appSettings.appSettings;
      const { topPercent, heightPercent } = pillGeometryOf(rawDist, carLength);
      const color = getBarPillColor(Math.abs(rawDist));
      const label = `${signOf(rawDist)}${formatDistance(
        Math.abs(rawDist),
        units.unitSystem
      )}${distanceUnit(units.unitSystem)}`;

      scheduleWrite(() => {
        element.classList.remove(styles.pillEmpty);
        element.style.setProperty(PILL_TOP_PROPERTY, `${topPercent}%`);
        element.style.setProperty(PILL_HEIGHT_PROPERTY, `${heightPercent}%`);
        element.style.setProperty(PILL_COLOR_PROPERTY, color);

        const text = element.firstElementChild;

        if (text instanceof HTMLElement) {
          text.textContent = label;
        }
      });
    },
    [computed, appSettings, units, side]
  );

  if (!visible || !sideVisible || !computed.hasProximity) {
    return null;
  }

  return (
    <div className={styles.bar}>
      <div
        ref={pillRef}
        className={styles.pill}
        style={
          {
            [TEXT_ROTATION_PROPERTY]:
              side === 'left' ? LEFT_TEXT_ROTATION : RIGHT_TEXT_ROTATION,
          } as CSSProperties
        }
      >
        {radarSettings.showDistance && <span className={styles.pillText} />}
      </div>
    </div>
  );
});
