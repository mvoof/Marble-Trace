import { observer } from 'mobx-react-lite';

import { usePitState } from '@ui/hooks/usePitState';
import { usePitServiceWidgetStore } from '@store/root-store-context';
import { buildPitApproachView } from '@ui/widgets/PitServiceWidget/pit-approach';

import { METERS_TO_FEET } from '@utils/telemetry-format';

import { ReservedSlot } from '@ui/shared/ReservedSlot/ReservedSlot';

import styles from './PitApproachRail.module.scss';

const PCT = 100;

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

export const PitApproachRail = observer(
  ({ cueDistM, withBrakeCue }: PitApproachRailProps) => {
    const pitService = usePitServiceWidgetStore();
    const {
      distM,
      distMode,
      pitLaneProgressPct,
      pitLaneLengthM,
      pitboxLanePct,
      speed,
      system,
    } = usePitState();

    const view = buildPitApproachView({
      distM,
      distMode,
      progressPct: pitLaneProgressPct,
      laneLengthM: pitLaneLengthM,
      boxLanePct: pitboxLanePct,
      speedMs: speed,
      cueDistM,
      withBrakeCue,
    });

    // Off pit road, or on a track whose pit lane has not been recorded yet,
    // there is no lane to draw.
    const isIdle = !pitService.isOnPitRoad || pitLaneProgressPct === null;

    // Before the entry line the rail counts down to the entry instead of the
    // box: that is the whole of what the sim lets us know on the way in, and it
    // is the number the driver is braking for.
    const entryDistM = pitService.isApproachingPit
      ? pitService.distToPitEntryM
      : null;
    const isApproach = isIdle && entryDistM !== null;

    // The lane goes away, but not the room it stands in: the rail appears on
    // the way to the box, and a widget that grew a row at that moment would be
    // one the driver placed against a different bottom edge.
    if (isIdle && !isApproach) {
      return <ReservedSlot height={RAIL_HEIGHT_PX} label="Pit approach" />;
    }

    const isImperial = system === 'imperial';
    const shownDistM = isIdle ? entryDistM : distM;
    const distValue =
      shownDistM === null
        ? '--'
        : Math.round(
            isImperial ? shownDistM * METERS_TO_FEET : shownDistM
          ).toString();

    const targetLabel = isIdle ? 'IN' : view.isTargetExit ? 'EXIT' : 'BOX';

    return (
      <div
        className={[
          styles.rail,
          isIdle ? styles.railIdle : styles[`urgency${view.urgency}`],
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.track}>
          {!isIdle && (
            <span
              className={styles.fill}
              style={{ width: `${view.fill * PCT}%` }}
            />
          )}

          {!isIdle && view.brakeMarker !== null && (
            <span
              className={styles.brakeMarker}
              style={{ left: `${view.brakeMarker * PCT}%` }}
            />
          )}

          {/*
            The far end of the rail is the target itself — the stall on the way
            in, the exit line on the way out — so it is drawn as an end cap
            rather than as a patch somewhere along a full-lane bar.
          */}
          <span className={styles.targetCap} />

          <span
            className={styles.carMarker}
            style={{ left: `${view.fill * PCT}%` }}
          />

          <span className={styles.readout}>
            <span className={styles.value}>{distValue}</span>

            <span className={styles.unit}>{isImperial ? 'ft' : 'm'}</span>

            <span className={styles.target}>→ {targetLabel}</span>
          </span>
        </div>
      </div>
    );
  }
);
