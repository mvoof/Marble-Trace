import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { CoachWidgetSettings } from '@/types/widget-settings';
import { formatLapTime, formatSpeed, speedUnit } from '@utils/telemetry-format';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import {
  useCoachWidgetStore,
  useDrivingCoachWidgetStore,
  useUnitsStore,
} from '@store/root-store-context';

import styles from './InfoRow.module.scss';

const NO_VALUE_TEXT = '—';

/**
 * Reference lap time, the speed pair at the car's current position, and which
 * of the two stored references is in use. All optional — the curves carry the
 * shape, this row carries the values for anyone who wants them.
 *
 * The speed pair moves with the car and is written straight to its two spans;
 * the rest of the row changes once a lap and is rendered by React. See
 * `docs/rendering.md`.
 */
export const InfoRow = observer(function InfoRow() {
  const coach = useDrivingCoachWidgetStore();
  const trace = useCoachWidgetStore();
  const units = useUnitsStore();

  const settings = useWidgetSettings<CoachWidgetSettings>('coach');

  const rootRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const currentText = formatSpeed(coach.currentSpeedMps, units.unitSystem);
      const referenceSpeedMps = coach.referenceSpeedMps;
      const referenceText =
        referenceSpeedMps === null
          ? NO_VALUE_TEXT
          : formatSpeed(referenceSpeedMps, units.unitSystem);

      scheduleWrite(() => {
        const current = element.querySelector(`.${styles.value}`);
        const reference = element.querySelector(`.${styles.reference}`);

        if (current instanceof HTMLElement) {
          current.textContent = currentText;
        }

        if (reference instanceof HTMLElement) {
          reference.textContent = referenceText;
        }
      });
    },
    [coach, units]
  );

  const showsAnything =
    settings.showSpeed ||
    settings.showReferenceLapTime ||
    settings.showTrackCondition;

  if (!showsAnything) {
    return null;
  }

  const referenceLapTimeS = trace.referenceLapTimeS;
  const condition = trace.referenceCondition;

  return (
    <div ref={rootRef} className={styles.root}>
      {settings.showSpeed ? (
        <span className={styles.group}>
          <span className={styles.value} />
          <span className={styles.separator}>/</span>
          <span className={styles.reference} />
          <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
        </span>
      ) : null}

      {/* Lap time and condition are one fact — which stored reference is being
          compared against — so they read as one line: 1:47.48 · DRY. */}
      {settings.showReferenceLapTime || settings.showTrackCondition ? (
        <span className={`${styles.group} ${styles.groupEnd}`}>
          <span className={styles.label}>REF LAP</span>

          {settings.showReferenceLapTime ? (
            <span className={styles.referenceLapTime}>
              {referenceLapTimeS === null
                ? NO_VALUE_TEXT
                : formatLapTime(referenceLapTimeS)}
            </span>
          ) : null}

          {settings.showReferenceLapTime && settings.showTrackCondition ? (
            <span className={styles.separator}>·</span>
          ) : null}

          {settings.showTrackCondition ? (
            <span
              className={
                condition === 'wet'
                  ? `${styles.condition} ${styles.conditionWet}`
                  : styles.condition
              }
            >
              {condition === null ? NO_VALUE_TEXT : condition.toUpperCase()}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
});
