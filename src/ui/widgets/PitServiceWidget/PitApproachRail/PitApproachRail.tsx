import { observer } from 'mobx-react-lite';

import {
  usePitServiceWidgetStore,
  usePlayerStore,
  useUnitsStore,
} from '@store/root-store-context';
import { buildPitApproachView } from '@ui/widgets/PitServiceWidget/pit-approach';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import { METERS_TO_FEET } from '@utils/telemetry-format';
import { ReservedSlot } from '@ui/shared/ReservedSlot/ReservedSlot';

import styles from './PitApproachRail.module.scss';

const PCT = 100;

const NO_VALUE_TEXT = '--';

const FILL_WIDTH_PROPERTY = '--rail-fill';
const BRAKE_LEFT_PROPERTY = '--rail-brake-left';

const URGENCY_CLASSES = [
  styles.urgencynear,
  styles.urgencybrake,
  styles.urgencyarrived,
];

/**
 * The rail is one lane and nothing else — `.track` is `ws(18)`, and the readout
 * is drawn on top of it rather than above it. Kept as a number here so the slot
 * the rail leaves behind is exactly the rail.
 */
const RAIL_HEIGHT_PX = 18;

interface PitApproachRailProps {
  cueDistM: number;
  withBrakeCue: boolean;
}

/**
 * How far there is left to roll, drawn as the lane the car is in. The distance
 * and the speed behind the brake cue both move with the car, so the fill, the
 * two markers and the number are written straight to the DOM; React renders the
 * rail when it appears and when the lane goes away. See `docs/rendering.md`.
 */
export const PitApproachRail = observer(
  ({ cueDistM, withBrakeCue }: PitApproachRailProps) => {
    const pitService = usePitServiceWidgetStore();
    const player = usePlayerStore();
    const units = useUnitsStore();

    // Off pit road, or on a track whose pit lane has not been recorded yet,
    // there is no lane to draw.
    const isIdle = !pitService.isOnPitRoad || !player.hasPitLaneProgress;

    // Before the entry line the rail counts down to the entry instead of the
    // box: that is the whole of what the sim lets us know on the way in, and it
    // is the number the driver is braking for.
    const isApproach = isIdle && pitService.isApproachingPit;

    const isImperial = units.unitSystem === 'imperial';

    const railRef = useReactiveDomWrite<HTMLDivElement>(
      (element, scheduleWrite) => {
        const view = buildPitApproachView({
          distM: player.pitTargetDistM,
          distMode: player.pitTargetType,
          progressPct: player.pitLaneProgressPct,
          laneLengthM: pitService.pitLaneLengthM,
          boxLanePct: pitService.pitboxLanePct,
          // oxlint-disable-next-line no-restricted-properties
          speedMs: player.carDynamics?.speed ?? 0,
          cueDistM,
          withBrakeCue,
        });

        const shownDistM = isIdle
          ? pitService.distToPitEntryM
          : player.pitTargetDistM;

        const distValue =
          shownDistM === null
            ? NO_VALUE_TEXT
            : Math.round(
                isImperial ? shownDistM * METERS_TO_FEET : shownDistM
              ).toString();

        const targetLabel = isIdle ? 'IN' : view.isTargetExit ? 'EXIT' : 'BOX';

        scheduleWrite(() => {
          for (const urgencyClass of URGENCY_CLASSES) {
            element.classList.remove(urgencyClass);
          }

          if (!isIdle) {
            element.classList.add(styles[`urgency${view.urgency}`]);
          }

          element.style.setProperty(
            FILL_WIDTH_PROPERTY,
            `${isIdle ? 0 : view.fill * PCT}%`
          );

          const fill = element.querySelector(`.${styles.fill}`);

          if (fill instanceof HTMLElement) {
            fill.hidden = isIdle;
          }

          const brakeMarker = element.querySelector(`.${styles.brakeMarker}`);
          const hasBrakeMarker = !isIdle && view.brakeMarker !== null;

          if (brakeMarker instanceof HTMLElement) {
            brakeMarker.hidden = !hasBrakeMarker;
          }

          if (hasBrakeMarker) {
            element.style.setProperty(
              BRAKE_LEFT_PROPERTY,
              `${(view.brakeMarker ?? 0) * PCT}%`
            );
          }

          const value = element.querySelector(`.${styles.value}`);

          if (value instanceof HTMLElement) {
            value.textContent = distValue;
          }

          const target = element.querySelector(`.${styles.target}`);

          if (target instanceof HTMLElement) {
            target.textContent = `→ ${targetLabel}`;
          }
        });
      },
      [player, pitService, cueDistM, withBrakeCue, isIdle, isImperial]
    );

    // The lane goes away, but not the room it stands in: the rail appears on
    // the way to the box, and a widget that grew a row at that moment would be
    // one the driver placed against a different bottom edge.
    if (isIdle && !isApproach) {
      return <ReservedSlot height={RAIL_HEIGHT_PX} label="Pit approach" />;
    }

    return (
      <div
        ref={railRef}
        className={[styles.rail, isIdle ? styles.railIdle : '']
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.track}>
          <span className={styles.fill} />

          <span className={styles.brakeMarker} />

          {/*
            The far end of the rail is the target itself — the stall on the way
            in, the exit line on the way out — so it is drawn as an end cap
            rather than as a patch somewhere along a full-lane bar.
          */}
          <span className={styles.targetCap} />

          <span className={styles.carMarker} />

          <span className={styles.readout}>
            <span className={styles.value} />

            <span className={styles.unit}>{isImperial ? 'ft' : 'm'}</span>

            <span className={styles.target} />
          </span>
        </div>
      </div>
    );
  }
);
