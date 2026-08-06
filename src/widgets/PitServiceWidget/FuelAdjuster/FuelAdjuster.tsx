import { observer } from 'mobx-react-lite';
import { Minus, Plus } from 'lucide-react';
import type { ChangeEvent, CSSProperties } from 'react';

import styles from './FuelAdjuster.module.scss';
import { usePitServiceWidgetStore } from '@store/root-store-context';

const FULL_RATIO = 1;
const PERCENT = 100;
const SLIDER_STEP_L = 1;

/**
 * Manual fuel control for interact mode: step buttons, or drag the bar to dial
 * in an amount. Dragging only moves the draft in the store — the sim is written
 * once, on release.
 */
export const FuelAdjuster = observer(() => {
  const pitService = usePitServiceWidgetStore();

  const capacity = pitService.fuelCapacityLiters;

  if (!pitService.canClickOrders || capacity === null || capacity <= 0) {
    return null;
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    pitService.setFuelDraft(Number(event.target.value));
  };

  const handleCommit = () => {
    void pitService.commitFuelDraft();
  };

  const fillRatio = Math.min(
    FULL_RATIO,
    pitService.fuelDisplayLiters / capacity
  );

  return (
    <div className={styles.adjuster}>
      <button
        type="button"
        aria-label="Remove fuel from the pit order"
        className={styles.step}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => void pitService.adjustFuel(-pitService.fuelStepLiters)}
      >
        <Minus className={styles.icon} />
      </button>

      {/*
        The fill is painted as a gradient stop on the track so the bar reads as
        a level gauge; the native thumb stays as the drag handle.
      */}
      <input
        type="range"
        aria-label="Fuel to add"
        className={styles.bar}
        min={0}
        max={Math.round(capacity)}
        step={SLIDER_STEP_L}
        value={Math.round(pitService.fuelDisplayLiters)}
        style={{ '--fuel-fill': `${fillRatio * PERCENT}%` } as CSSProperties}
        onChange={handleChange}
        // Interact mode shares the mouse with widget dragging; without this a
        // drag on the bar would move the whole widget instead.
        onMouseDown={(event) => event.stopPropagation()}
        onPointerUp={handleCommit}
        onKeyUp={handleCommit}
        onBlur={handleCommit}
      />

      <button
        type="button"
        aria-label="Add fuel to the pit order"
        className={styles.step}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => void pitService.adjustFuel(pitService.fuelStepLiters)}
      >
        <Plus className={styles.icon} />
      </button>
    </div>
  );
});
