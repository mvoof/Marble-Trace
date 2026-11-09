import { observer } from 'mobx-react-lite';
import { Check, Minus, Plus } from 'lucide-react';

import styles from './TireCorner.module.scss';
import { OrderToggle } from '@widgets/pit-service/OrderToggle/OrderToggle';
import {
  buildTireCorner,
  convertPressure,
  wearLevel,
} from '@widgets/pit-service/pit-service-utils';
import {
  isCornerOrdered,
  orderedPressure,
  type CornerPosition,
} from '@features/pit-service/pit-tires';
import { usePitServiceWidgetStore } from '@features/pit-service/pit-service-context';
import { usePlayerStore } from '@entities/player/player-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { useBlink, type BlinkCycle } from '@shared/hooks/useBlink';
import type { MouseEvent as ReactMouseEvent } from 'react';

const WEAR_TO_PCT = 100;

/** A punctured tire's outline flashes red, 600 ms a side. */
const PUNCTURE_BLINK: BlinkCycle = { stepMs: 600, steps: 2 };
const MIN_FILL_PCT = 5;
// Heavier and larger than an inline icon: it is read at a glance over a busy
// tread, not next to a label.
const CHECK_SIZE = 22;
const CHECK_STROKE = 3.2;
const STEP_ICON_SIZE = 12;
const STEP_ICON_STROKE = 3;

interface TireCornerProps {
  position: CornerPosition;
}

export const TireCorner = observer(({ position }: TireCornerProps) => {
  const { chassis, pitService } = usePlayerStore();
  const widget = usePitServiceWidgetStore();
  const units = useUnitsStore();

  const data = buildTireCorner(position, chassis, units.unitSystem);
  const punctureRef = useBlink<HTMLDivElement>(
    data.isPunctured ? PUNCTURE_BLINK : null
  );
  const ordered = isCornerOrdered(position, pitService);
  // A pressure being dialed, or sent and not yet reported back by the sim,
  // stands over the sim's own: the sim keeps showing the old one.
  const dialed = widget.auto.dialedPressure(position);
  const orderedKpa = dialed?.kpa ?? orderedPressure(position, pitService);
  const isDialing = dialed?.pending === true;
  const showsOrder = ordered || dialed !== null;

  // Which corner this is says itself from the place it holds in the grid, so
  // the row that used to name it (LF · SET 165) is gone. What the order sets is
  // said inside the tread instead: a check for the change, and under it the
  // pressure being fitted — the current one belongs to a tire coming off.
  const orderedBar =
    orderedKpa !== null && orderedKpa > 0
      ? Math.round(convertPressure(orderedKpa, units.unitSystem))
      : null;

  const zones = [
    { wear: data.wearL, temp: data.tempL, color: data.tempColorL },
    { wear: data.wearM, temp: data.tempM, color: data.tempColorM },
    { wear: data.wearR, temp: data.tempR, color: data.tempColorR },
  ];

  const stepPressure = (
    event: ReactMouseEvent<HTMLButtonElement>,
    direction: 'up' | 'down'
  ) => {
    event.stopPropagation();
    widget.order.stepPressure(position, direction);
  };

  // Interact mode shares the mouse with widget dragging; without this a press
  // on a step would start moving the widget.
  const stopDrag = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div className={styles.cornerFrame}>
      <OrderToggle
        className={`${styles.corner} ${ordered ? styles.cornerOrdered : styles.cornerKept}`}
        clickableClassName={styles.cornerClickable}
        label={`Toggle ${position.toUpperCase()} tire change`}
        onToggle={() => widget.order.toggleTire(position)}
      >
        <div className={styles.zoneRow}>
          {zones.map((zone, index) => (
            <span
              key={`temp-${index}`}
              className={styles.zoneTemp}
              style={{ color: zone.color }}
            >
              {zone.temp === null ? '—' : `${Math.round(zone.temp)}°`}
            </span>
          ))}
        </div>

        <div
          ref={punctureRef}
          className={`${styles.tire} ${data.isPunctured ? styles.puncture : ''}`}
        >
          {zones.map((zone, index) => (
            <span key={`fill-${index}`} className={styles.section}>
              <span
                className={styles.fill}
                style={{
                  height: `${Math.max(MIN_FILL_PCT, (zone.wear ?? 0) * WEAR_TO_PCT)}%`,
                  backgroundColor: zone.color,
                }}
              />
            </span>
          ))}

          {showsOrder ? (
            <>
              {ordered && (
                <Check
                  size={CHECK_SIZE}
                  strokeWidth={CHECK_STROKE}
                  className={styles.check}
                />
              )}

              {orderedBar !== null && (
                <span
                  className={`${styles.pressure} ${styles.pressureOrdered} ${isDialing ? styles.pressureDialing : ''}`}
                >
                  {orderedBar}
                </span>
              )}
            </>
          ) : (
            <span className={styles.pressure}>
              {data.pressure === null ? '—' : Math.round(data.pressure)}
            </span>
          )}
        </div>

        {/*
        The sim writes tire wear once per stop, on arrival in the box, and never
        touches it in between — not even when the crew fits a new set. Away from
        the box these numbers describe tires that may already be off the car, so
        they are dimmed rather than read as live.
      */}
        <div
          className={`${styles.zoneRow} ${widget.auto.isTireWearStale ? styles.zoneRowStale : ''}`}
          title={
            widget.auto.isTireWearStale
              ? 'Tread measured at the last pit stop — the sim only refreshes it in the box'
              : 'Tread measured on arrival in the box'
          }
        >
          {zones.map((zone, index) => (
            <span
              key={`wear-${index}`}
              className={`${styles.zoneWear} ${styles[wearLevel(zone.wear)]}`}
            >
              {zone.wear === null
                ? '—'
                : `${Math.round(zone.wear * WEAR_TO_PCT)}%`}
            </span>
          ))}
        </div>
      </OrderToggle>

      {/*
        Beside the toggle rather than inside it, so a step is never also a
        click on the corner. The sim takes a pressure only with the change, so
        a step orders the corner as well.
      */}
      {widget.order.canClickOrders && (
        <>
          <button
            type="button"
            aria-label={`Lower ${position.toUpperCase()} pressure one step`}
            className={`${styles.step} ${styles.stepDown}`}
            onClick={(event) => stepPressure(event, 'down')}
            onMouseDown={stopDrag}
          >
            <Minus size={STEP_ICON_SIZE} strokeWidth={STEP_ICON_STROKE} />
          </button>

          <button
            type="button"
            aria-label={`Raise ${position.toUpperCase()} pressure one step`}
            className={`${styles.step} ${styles.stepUp}`}
            onClick={(event) => stepPressure(event, 'up')}
            onMouseDown={stopDrag}
          >
            <Plus size={STEP_ICON_SIZE} strokeWidth={STEP_ICON_STROKE} />
          </button>
        </>
      )}
    </div>
  );
});
