import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';

import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { formatSpeed } from '@shared/lib/telemetry-format';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';

import {
  CORNER_SPEED_POINTS,
  cornerSpeedRows,
  type CornerSpeedPoint,
} from './corner-speed-rows';

const EMPTY_VALUE = '—';

const ACCENT_PROPERTY = '--corner-accent';

interface CornerSpeedColumnProps {
  entryColor: string;
  apexColor: string;
  exitColor: string;
  /** The column. */
  className: string;
  /** Each figure; its colour is `var(--corner-accent)`, set per row. */
  valueClassName: string;
  /** Added to every figure but the lit one. */
  pendingClassName: string;
}

/**
 * Entry, apex and exit, top to bottom, each told by its colour; one is lit at a
 * time, as `cornerSpeedRows` decides. Every widget that draws the corner speeds
 * draws this, in its own sizes.
 *
 * With a reference lap the frame changes a few times a corner, but without one
 * the apex is the lowest speed so far and moves on every bundle under braking.
 * So React renders the three rows once, per setting, and the figures and the
 * lit row are written into them — only what differs from what is on screen.
 * See `docs/rendering.md`. The props are flat strings, so a parent that
 * re-renders for its own reasons does not re-render the column.
 */
export const CornerSpeedColumn = observer(
  ({
    entryColor,
    apexColor,
    exitColor,
    className,
    valueClassName,
    pendingClassName,
  }: CornerSpeedColumnProps) => {
    const backendComputed = useBackendComputedStore();
    const units = useUnitsStore();

    const accentOf: Record<CornerSpeedPoint, string> = {
      entry: entryColor,
      apex: apexColor,
      exit: exitColor,
    };

    const rootRef = useReactiveDomWrite<HTMLDivElement>(
      (element, scheduleWrite) => {
        const rows = cornerSpeedRows(backendComputed.cornerSpeeds).map(
          (row) => ({
            text:
              row.value === null
                ? EMPTY_VALUE
                : formatSpeed(row.value, units.unitSystem),
            lit: row.lit,
          })
        );

        scheduleWrite(() => {
          rows.forEach((row, index) => {
            const value = element.children[index];

            if (!(value instanceof HTMLElement)) {
              return;
            }

            if (value.textContent !== row.text) {
              value.textContent = row.text;
            }

            // A no-op on the DOM when the row already is in that state.
            value.classList.toggle(pendingClassName, !row.lit);
          });
        });
      },
      [backendComputed, units, pendingClassName]
    );

    return (
      <div ref={rootRef} className={className}>
        {CORNER_SPEED_POINTS.map((point) => (
          <span
            key={point}
            className={valueClassName}
            style={{ [ACCENT_PROPERTY]: accentOf[point] } as CSSProperties}
          />
        ))}
      </div>
    );
  }
);
