import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import {
  formatLapTime,
  formatSpeed,
  speedUnit,
} from '@shared/lib/telemetry-format';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { StatChip, type StatChipTone } from '@shared/ui/StatChip/StatChip';
import { useUnitsStore } from '@entities/app-settings/units-context';
import {
  EVEN_TIME_S,
  formatSignedSeconds,
} from '@widgets/coach/coach-trace-utils';
import {
  useCoachWidgetStore,
  useDrivingCoachWidgetStore,
} from '@widgets/coach/coach-stores';

import styles from './InfoRow.module.scss';
import type { CoachWidgetSettings } from '../settings-schema';

const NO_VALUE_TEXT = '—';
const REFERENCE_LABEL = 'REF LAP';
const SECONDS_UNIT = 's';

const cornerTimeTone = (cornerTimeS: number | null): StatChipTone => {
  if (cornerTimeS === null || Math.abs(cornerTimeS) < EVEN_TIME_S) {
    return 'muted';
  }

  return cornerTimeS > 0 ? 'danger' : 'positive';
};

/**
 * The footer bar: the speed pair at the car's current position, the stored
 * reference lap the trace is compared against, and what the corner has cost so
 * far — the gap between the two speeds sits on the chart above. All optional — the curves carry the shape,
 * this row carries the values for anyone who wants them.
 *
 * The speed pair moves with the car and is written straight to its spans; the
 * rest of the row changes far less often and is rendered by React. See
 * `docs/rendering.md`.
 */
export const InfoRow = observer(() => {
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

  const showsReference =
    settings.showReferenceLapTime || settings.showTrackCondition;

  if (!settings.showSpeed && !showsReference) {
    return null;
  }

  const referenceLapTimeS = trace.referenceLapTimeS;
  const condition = trace.referenceCondition;
  const cornerTimeS = trace.displayedCornerTimeS;

  // Lap time and condition are one fact — which stored reference is being
  // compared against — so they are one chip: REF DRY 1:47.48. Dry is the
  // best lap's own tone; wet is the exception worth noticing.
  const namesCondition = settings.showTrackCondition && condition !== null;
  const isWet = namesCondition && condition === 'wet';
  const referenceLead = namesCondition
    ? `REF ${condition.toUpperCase()}`
    : REFERENCE_LABEL;

  return (
    <div ref={rootRef} className={styles.root}>
      {settings.showSpeed ? (
        <span className={styles.speed}>
          <span className={styles.value} />
          <span className={styles.separator}>/</span>
          <span className={styles.reference} />
          <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
        </span>
      ) : null}

      <span className={`${styles.group} ${styles.groupEnd}`}>
        {showsReference ? (
          <StatChip
            className={
              isWet
                ? `${styles.referenceChip} ${styles.referenceChipWet}`
                : styles.referenceChip
            }
            lead={referenceLead}
            look="reading"
            tone={isWet ? 'info' : 'special'}
          >
            {settings.showReferenceLapTime
              ? referenceLapTimeS === null
                ? NO_VALUE_TEXT
                : formatLapTime(referenceLapTimeS)
              : undefined}
          </StatChip>
        ) : null}

        {settings.showCallRow && settings.showPhaseFigures ? (
          <StatChip
            className={styles.cornerTime}
            leadKind="number"
            tone={cornerTimeTone(cornerTimeS)}
            lead={
              cornerTimeS === null
                ? NO_VALUE_TEXT
                : `${formatSignedSeconds(cornerTimeS)}${SECONDS_UNIT}`
            }
          />
        ) : null}
      </span>
    </div>
  );
});
