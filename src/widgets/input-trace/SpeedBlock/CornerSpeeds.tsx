import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import {
  CORNER_SPEED_POINTS,
  cornerSpeedRows,
  type CornerSpeedPoint,
} from '@entities/corner-speeds/corner-speed-rows';
import { formatSpeed } from '@shared/lib/telemetry-format';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { writeStatChip } from '@shared/ui/StatChip/StatChip';

import styles from './CornerSpeeds.module.scss';
import type { InputTraceSettings } from '../settings-schema';

const EMPTY_VALUE = '—';

/**
 * Entry, apex and exit as a row of chips under the speed and gear. Quiet chips
 * in the point's own colour, and the one figure to read now bright — one per
 * block, as the design guide asks.
 *
 * Without a reference lap the apex moves on every bundle under braking, so the
 * chips are written into the DOM, and only when what they show changes. See
 * `docs/rendering.md`.
 */
export const CornerSpeeds = observer(() => {
  const settings = useWidgetSettings<InputTraceSettings>('input-trace');
  const backendComputed = useBackendComputedStore();
  const units = useUnitsStore();

  const rootRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const colorOf: Record<CornerSpeedPoint, string> = {
        entry: settings.entrySpeedColor,
        apex: settings.apexSpeedColor,
        exit: settings.exitSpeedColor,
      };

      const rows = cornerSpeedRows(backendComputed.cornerSpeeds).map((row) => ({
        text:
          row.value === null
            ? EMPTY_VALUE
            : formatSpeed(row.value, units.unitSystem),
        look: row.lit ? ('mark' as const) : ('reading' as const),
        color: colorOf[row.point],
      }));

      scheduleWrite(() => {
        rows.forEach((row, index) => {
          const chip = element.children[index]?.firstElementChild;

          if (!(chip instanceof HTMLElement)) {
            return;
          }

          // A no-op on the DOM when the cell already is in that state.
          chip.parentElement?.classList.toggle(
            styles.cellPending,
            row.look !== 'mark'
          );

          const signature = `${row.text}|${row.look}|${row.color}`;

          // The class is checked too: a chip React rebuilt has lost it.
          if (chip.dataset.shown === signature && chip.className !== '') {
            return;
          }

          writeStatChip(
            chip,
            'neutral',
            'number',
            row.text,
            row.look,
            row.color
          );
          chip.dataset.shown = signature;
        });
      });
    },
    [backendComputed, units, settings]
  );

  if (!settings.showCornerSpeeds) {
    return null;
  }

  return (
    <div ref={rootRef} className={styles.corners}>
      {CORNER_SPEED_POINTS.map((point) => (
        <div key={point} className={styles.cell}>
          <span />
        </div>
      ))}
    </div>
  );
});
