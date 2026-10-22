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
import type { InputTraceSettings } from '../settings-schema';

const EMPTY_VALUE = '—';

const ACCENT_PROPERTY = '--corner-accent';

/**
 * Entry, apex and exit, top to bottom, with no labels: each row is told by its
 * colour. A point the car has not reached yet shows the reference lap's
 * figure dimmed, and lights up with the car's own once it is passed. The frame changes a
 * few times a corner, so it is read here directly.
 */
export const CornerSpeeds = observer(() => {
  const backendComputed = useBackendComputedStore();
  const units = useUnitsStore();

  const settings = useWidgetSettings<InputTraceSettings>('input-trace');

  const accentOf: Record<CornerSpeedPoint, string> = {
    entry: settings.entrySpeedColor,
    apex: settings.apexSpeedColor,
    exit: settings.exitSpeedColor,
  };

  if (!settings.showCornerSpeeds) {
    return null;
  }

  const rows = cornerSpeedRows(backendComputed.cornerSpeeds);

  const textOf = (speed: number | null): string =>
    speed === null ? EMPTY_VALUE : formatSpeed(speed, units.unitSystem);

  return (
    <div className={styles.corners}>
      {rows.map((row) => (
        <div
          key={row.point}
          className={
            row.reached
              ? styles.cornerRow
              : `${styles.cornerRow} ${styles.cornerRowPending}`
          }
          style={{ [ACCENT_PROPERTY]: accentOf[row.point] } as CSSProperties}
        >
          <span className={styles.cornerValue}>{textOf(row.value)}</span>
        </div>
      ))}
    </div>
  );
});
