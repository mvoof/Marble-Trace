import { observer } from 'mobx-react-lite';

import styles from './TireCorner.module.scss';
import { OrderToggle } from '@widgets/PitServiceWidget/OrderToggle/OrderToggle';
import type { CornerPosition } from '@utils/widget/pit-service-utils';
import {
  buildTireCorner,
  convertPressure,
  isCornerOrdered,
  orderedPressure,
  wearLevel,
} from '@utils/widget/pit-service-utils';
import {
  usePitServiceWidgetStore,
  usePlayerStore,
  useUnitsStore,
} from '@store/root-store-context';

const WEAR_TO_PCT = 100;
const MIN_FILL_PCT = 5;

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

  const orderLabel =
    ordered && orderedKpa !== null && orderedKpa > 0
      ? `SET ${Math.round(convertPressure(orderedKpa, units.unitSystem))}`
      : ordered
        ? 'SET'
        : 'KEEP';

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
      onToggle={() => void widget.toggleTire(position)}
    >
      <div className={styles.head}>
        <span className={styles.side}>{position.toUpperCase()}</span>

        <span className={styles.order}>{orderLabel}</span>
      </div>

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

        <span className={styles.pressure}>
          {data.pressure === null ? '—' : Math.round(data.pressure)}
        </span>
      </div>

      {/*
        The sim writes tire wear once per stop, on arrival in the box, and never
        touches it in between — not even when the crew fits a new set. Away from
        the box these numbers describe tires that may already be off the car, so
        they are dimmed rather than read as live.
      */}
      <div
        className={`${styles.zoneRow} ${widget.isTireWearStale ? styles.zoneRowStale : ''}`}
        title={
          widget.isTireWearStale
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
