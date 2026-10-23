import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { formatSpeed } from '@shared/lib/telemetry-format';

import {
  cornerSpeedRows,
  type CornerSpeedPoint,
} from '@entities/corner-speeds/corner-speed-rows';

import styles from './CornerSpeeds.module.scss';
import type { RaceDashWidgetSettings } from '../settings-schema';

const EMPTY_VALUE = '—';

const ACCENT_PROPERTY = '--corner-accent';

/**
 * Entry, apex and exit beside the speed, top to bottom, each told by its
 * colour; one is lit at a time, as `cornerSpeedRows` decides. The frame changes
 * a few times a corner, so it is read here directly.
 */
export const CornerSpeeds = observer(() => {
  const backendComputed = useBackendComputedStore();
  const units = useUnitsStore();

  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const accentOf: Record<CornerSpeedPoint, string> = {
    entry: settings.entrySpeedColor,
    apex: settings.apexSpeedColor,
    exit: settings.exitSpeedColor,
  };

  const rows = cornerSpeedRows(backendComputed.cornerSpeeds);

  const textOf = (speed: number | null): string =>
    speed === null ? EMPTY_VALUE : formatSpeed(speed, units.unitSystem);

  return (
    <div className={styles.corners}>
      {rows.map((row) => (
        <span
          key={row.point}
          className={
            row.lit
              ? styles.cornerValue
              : `${styles.cornerValue} ${styles.cornerValuePending}`
          }
          style={{ [ACCENT_PROPERTY]: accentOf[row.point] } as CSSProperties}
        >
          {textOf(row.value)}
        </span>
      ))}
    </div>
  );
});
