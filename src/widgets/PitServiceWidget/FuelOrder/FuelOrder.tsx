import { observer } from 'mobx-react-lite';
import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

import styles from './FuelOrder.module.scss';
import { formatFuel } from '@utils/formatters/telemetry-format';
import type { UnitSystem } from '@/types';
import {
  usePitServiceWidgetStore,
  useUnitsStore,
} from '@store/root-store-context';

// The sim always reports fuel in liters; only the readout follows the setting.
const fuelUnit = (unitSystem: UnitSystem): string =>
  unitSystem === 'metric' ? 'L' : 'gal';

const FULL_RATIO = 1;
const PERCENT = 100;

// Below this the press is a click, not a drag — a toggle should survive the
// pixel or two a mouse moves while the button is down.
const DRAG_THRESHOLD_PX = 3;

/**
 * The fuel row doubles as the fuel gauge: it fills to the ordered amount, and
 * in interact mode it is dragged left and right to set it. A press that does
 * not move is still the on/off toggle.
 */
export const FuelOrder = observer(() => {
  const pitServiceWidget = usePitServiceWidgetStore();
  const units = useUnitsStore();
  const pressStartX = useRef<number | null>(null);
  const dragging = useRef(false);

  // Follows the drag while the row is being moved, the sim otherwise.
  const ordered = pitServiceWidget.fuelDisplayLiters;

  // Owned by the widget store so the number shown here is exactly the number
  // the order hotkey sends.
  const calculated = pitServiceWidget.plannedFuelLiters;

  const capacity = pitServiceWidget.fuelCapacityLiters;
  const canFill = capacity !== null && capacity > 0;
  const fillRatio = canFill ? Math.min(FULL_RATIO, ordered / capacity) : 0;

  const litersAt = (element: HTMLElement, clientX: number): number => {
    const { left, width } = element.getBoundingClientRect();

    if (width === 0 || capacity === null) {
      return ordered;
    }

    const ratio = Math.min(FULL_RATIO, Math.max(0, (clientX - left) / width));

    return ratio * capacity;
  };

  // Interact mode shares the mouse with widget dragging; without stopping the
  // event here a drag on the row would move the whole widget instead.
  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pressStartX.current = event.clientX;
    dragging.current = false;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const startX = pressStartX.current;

    if (startX === null) {
      return;
    }

    if (
      !dragging.current &&
      Math.abs(event.clientX - startX) < DRAG_THRESHOLD_PX
    ) {
      return;
    }

    dragging.current = true;
    pitServiceWidget.setFuelDraft(litersAt(event.currentTarget, event.clientX));
  };

  const handlePointerUp = () => {
    pressStartX.current = null;

    if (dragging.current) {
      dragging.current = false;
      void pitServiceWidget.commitFuelDraft();

      return;
    }

    void pitServiceWidget.toggleFuel();
  };

  const content = (
    <>
      {canFill && (
        <div
          className={styles.fill}
          style={{ width: `${fillRatio * PERCENT}%` } as CSSProperties}
        />
      )}

      <div className={styles.content}>
        <div className={styles.row}>
          <span className={styles.label}>FUEL ADD</span>

          <span className={styles.value}>
            {ordered > 0 ? `+${formatFuel(ordered, units.unitSystem)}` : '—'}
            <span className={styles.unit}> {fuelUnit(units.unitSystem)}</span>
          </span>
        </div>

        {calculated !== null && (
          <span className={styles.sub}>
            CALC +{formatFuel(calculated, units.unitSystem)}{' '}
            {fuelUnit(units.unitSystem)}
          </span>
        )}
      </div>
    </>
  );

  if (!pitServiceWidget.canClickOrders) {
    return <div className={styles.fuel}>{content}</div>;
  }

  return (
    <button
      type="button"
      aria-label="Fuel on the pit order: click to toggle, drag to set the amount"
      className={`${styles.fuel} ${styles.fuelClickable}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {content}
    </button>
  );
});
