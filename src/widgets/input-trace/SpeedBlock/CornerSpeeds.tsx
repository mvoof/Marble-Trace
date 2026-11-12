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
import { useLiveParts } from '@shared/ui/live/live-parts';

import styles from './CornerSpeeds.module.scss';
import type { InputTraceSettings } from '../settings-schema';

const EMPTY_VALUE = '—';

type CornerPart = `cell${number}` | `chip${number}`;

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

  const parts = useLiveParts<CornerPart>();

  const rootRef = useReactiveDomWrite<HTMLDivElement>(
    (_element, scheduleWrite) => {
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
          const chip = parts.elementOf(`chip${index}`);

          if (!(chip instanceof HTMLElement)) {
            return;
          }

          parts.state(
            `cell${index}`,
            'pending',
            row.look !== 'mark' ? 'true' : null
          );

          writeStatChip(
            chip,
            'neutral',
            'number',
            row.text,
            row.look,
            row.color
          );
        });
      });
    },
    [backendComputed, units, settings, parts]
  );

  if (!settings.showCornerSpeeds) {
    return null;
  }

  return (
    <div ref={rootRef} className={styles.corners}>
      {CORNER_SPEED_POINTS.map((point, index) => (
        <div
          key={point}
          ref={parts.ref(`cell${index}`)}
          className={styles.cell}
        >
          <span ref={parts.ref(`chip${index}`)} />
        </div>
      ))}
    </div>
  );
});
