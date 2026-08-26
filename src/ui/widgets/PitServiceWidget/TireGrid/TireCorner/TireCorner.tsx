import { observer } from 'mobx-react-lite';
import { Check } from 'lucide-react';

import styles from './TireCorner.module.scss';
import { OrderToggle } from '@ui/widgets/PitServiceWidget/OrderToggle/OrderToggle';
import type { CornerPosition } from '@ui/widgets/PitServiceWidget/pit-service-utils';
import {
  buildTireCorner,
  convertPressure,
  isCornerOrdered,
  orderedPressure,
  wearLevel,
} from '@ui/widgets/PitServiceWidget/pit-service-utils';
import {
  usePitServiceWidgetStore,
  usePlayerStore,
  useUnitsStore,
} from '@store/root-store-context';

const WEAR_TO_PCT = 100;
const MIN_FILL_PCT = 5;
const CHECK_SIZE = 22;

interface TireCornerProps {
  position: CornerPosition;
}

export const TireCorner = observer(({ position }: TireCornerProps) => {
  const { chassis, pitService } = usePlayerStore();
  const widget = usePitServiceWidgetStore();
  const units = useUnitsStore();

  const data = buildTireCorner(position, chassis, units.unitSystem);
  const ordered = isCornerOrdered(position, pitService);
  const orderedKpa = orderedPressure(position, pitService);

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

  return (
    <OrderToggle
      className={`${styles.corner} ${ordered ? styles.cornerOrdered : styles.cornerKept}`}
      clickableClassName={styles.cornerClickable}
      label={`Toggle ${position.toUpperCase()} tire change`}
      onToggle={() => void widget.order.toggleTire(position)}
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

        {ordered ? (
          <>
            <Check size={CHECK_SIZE} className={styles.check} />

            {orderedBar !== null && (
              <span className={`${styles.pressure} ${styles.pressureOrdered}`}>
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
  );
});
