import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
 * colour. One figure is lit at a time — with a reference, the point the car is
 * heading for; with none, the car's own point passed last. Beside the lit
 * one, a single arrow: up to carry more speed than now, down to carry less,
 * against the reference at this spot. The
 * frame changes a few times a corner, so it is read here directly.
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

  const frame = backendComputed.cornerSpeeds;
  const rows = cornerSpeedRows(frame);
  const pace = frame?.pace ?? null;

  // What to do about it, not where the car stands: slower than the reference
  // points up — carry more speed — and faster points down.
  const PaceIcon =
    pace === 'slower' ? ChevronUp : pace === 'faster' ? ChevronDown : null;

  const textOf = (speed: number | null): string =>
    speed === null ? EMPTY_VALUE : formatSpeed(speed, units.unitSystem);

  return (
    <div className={styles.corners}>
      {rows.map((row) => (
        <div
          key={row.point}
          className={
            row.lit
              ? styles.cornerRow
              : `${styles.cornerRow} ${styles.cornerRowPending}`
          }
          style={{ [ACCENT_PROPERTY]: accentOf[row.point] } as CSSProperties}
        >
          <span className={styles.pace}>
            {row.lit && PaceIcon && (
              <PaceIcon className={styles.paceIcon} strokeWidth={3} />
            )}
          </span>

          <span className={styles.cornerValue}>{textOf(row.value)}</span>
        </div>
      ))}
    </div>
  );
});
