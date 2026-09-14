import { observer } from 'mobx-react-lite';
import { Fuel } from 'lucide-react';
import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

import styles from './FuelOrder.module.scss';
import { litersToDisplayFuel } from '@utils/telemetry-format';
import type { UnitSystem } from '@/types';
import {
  usePitServiceWidgetStore,
  useUnitsStore,
} from '@store/root-store-context';

// The sim always reports fuel in liters; only the readout follows the setting.
const fuelUnit = (unitSystem: UnitSystem): string =>
  unitSystem === 'metric' ? 'L' : 'gal';

// Whole units: the row is read at speed, and the sim takes the order in whole
// liters anyway. The decimals belong on the Fuel widget.
const wholeUnits = (liters: number, unitSystem: UnitSystem): string =>
  Math.round(litersToDisplayFuel(liters, unitSystem)).toString();

const ICON_SIZE = 12;

const FULL_RATIO = 1;
const PERCENT = 100;

// Below this the press is a click, not a drag — a toggle should survive the
// pixel or two a mouse moves while the button is down.
const DRAG_THRESHOLD_PX = 3;

/**
 * The fuel row doubles as the tank gauge: it fills to what is aboard, then to
 * what has been ordered on top of it, and in interact mode it is dragged left
 * and right to set the level to arrive at. A press that does not move is still
 * the on/off toggle.
 *
 * Both halves are shown — `58 + 12` — because the number that decides a stop is
 * the sum: an order of twelve liters means nothing until it is read against a
 * tank that is already three quarters full. The order stops at the brim for the
 * same reason: past it the sim keeps the fuel it can hold and the driver reads a
 * number the crew never carried out.
 */
export const FuelOrder = observer(() => {
  const pitServiceWidget = usePitServiceWidgetStore();
  const units = useUnitsStore();
  const pressStartX = useRef<number | null>(null);
  const dragging = useRef(false);

  const { order } = pitServiceWidget;

  // Follows the drag while the row is being moved, the sim otherwise.
  const ordered = order.fuelDisplayLiters;

  // Owned by the widget store so the number shown here is exactly the number
  // the order hotkey sends — and it counts down as the tank fills.
  const calculated = order.plannedFillNowLiters;

  const inTank = order.fuelInTankLiters;
  const capacity = order.fuelCapacityLiters;
  const canFill = capacity !== null && capacity > 0;

  // The green band is the gap between what is aboard and the level the car
  // leaves the box on. Anchored to that level rather than stacked on the tank,
  // so while the crew fills it shrinks into the blue bar instead of sliding
  // right with it.
  const target = order.fuelTargetLiters;

  const tankRatio = canFill ? Math.min(FULL_RATIO, inTank / capacity) : 0;
  const targetRatio =
    canFill && target !== null
      ? Math.min(FULL_RATIO, Math.max(tankRatio, target / capacity))
      : tankRatio;
  const orderedRatio = targetRatio - tankRatio;

  // The bar is the tank, so the pointer names the level to arrive at and the
  // order is whatever is missing to reach it. Dragging below what is already
  // aboard clears the order rather than pretending fuel can be taken out.
  const litersAt = (element: HTMLElement, clientX: number): number => {
    const { left, width } = element.getBoundingClientRect();

    if (width === 0 || capacity === null) {
      return ordered;
    }

    const ratio = Math.min(FULL_RATIO, Math.max(0, (clientX - left) / width));

    return Math.max(0, ratio * capacity - inTank);
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
    order.setFuelDraft(litersAt(event.currentTarget, event.clientX));
  };

  const handlePointerUp = () => {
    pressStartX.current = null;

    if (dragging.current) {
      dragging.current = false;
      void order.commitFuelDraft();

      return;
    }

    void order.toggleFuel();
  };

  const content = (
    <>
      {canFill && (
        <>
          <div
            className={styles.fill}
            style={{ width: `${tankRatio * PERCENT}%` } as CSSProperties}
          />

          <div
            className={styles.fillOrdered}
            style={
              {
                left: `${tankRatio * PERCENT}%`,
                width: `${orderedRatio * PERCENT}%`,
              } as CSSProperties
            }
          />
        </>
      )}

      <Fuel size={ICON_SIZE} className={styles.icon} />

      {calculated !== null && (
        <span className={styles.calc}>
          CALC {wholeUnits(calculated, units.unitSystem)}
        </span>
      )}

      {/*
        Fixed slot, right-aligned: both numbers swing between one and three
        digits as the row is dragged, and the icon beside them must not move
        with it.
      */}
      <span
        className={`${styles.value} ${order.isTankFull ? styles.valueFull : ''}`}
      >
        <span className={styles.inTank}>
          {wholeUnits(inTank, units.unitSystem)}
        </span>

        {/*
          The sign travels with the number it signs: `6  +0`, not `6+  0`. Both
          live in one right-aligned slot, so the padding a short order leaves
          falls in front of the plus rather than between it and the digits.
        */}
        <span className={styles.order}>
          <span className={styles.plus}>+</span>

          <span className={styles.added}>
            {ordered > 0 ? wholeUnits(ordered, units.unitSystem) : '0'}
          </span>
        </span>
      </span>

      <span className={styles.unit}>{fuelUnit(units.unitSystem)}</span>
    </>
  );

  if (!order.canClickOrders) {
    return <div className={styles.fuel}>{content}</div>;
  }

  return (
    <button
      type="button"
      aria-label="Fuel on the pit order: click to toggle, drag to set the level to fill to"
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
