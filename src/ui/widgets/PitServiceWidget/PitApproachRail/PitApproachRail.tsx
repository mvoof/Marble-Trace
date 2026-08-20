import { observer } from 'mobx-react-lite';

import { usePitState } from '@ui/hooks/usePitState';
import { usePitServiceWidgetStore } from '@store/root-store-context';
import type {
  PitApproachPlacement,
  PitApproachSide,
} from '@/types/widget-settings';
import { buildPitApproachView } from '@ui/widgets/PitServiceWidget/pit-approach';

import styles from './PitApproachRail.module.scss';

const PCT = 100;
const METERS_TO_FEET = 3.28084;

interface PitApproachRailProps {
  placement: PitApproachPlacement;
  side: PitApproachSide;
  cueDistM: number;
  withBrakeCue: boolean;
}

export const PitApproachRail = observer(
  ({ placement, side, cueDistM, withBrakeCue }: PitApproachRailProps) => {
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

    const isVertical = placement === 'side';

    // Off pit road, or on a track whose pit lane has not been recorded yet,
    // there is no lane to draw.
    //
    // The inline block simply goes away — the stack closes over it. The side
    // rail does not: it is the column the widget was widened for, and dropping
    // it would leave the panel the same width with the stack stretched across
    // the empty strip. It stays as an idle rail instead, which is also what the
    // layout editor and `alwaysVisible` have to show.
    const isIdle = !pitService.isOnPitRoad || pitLaneProgressPct === null;

    // Before the entry line the rail counts down to the entry instead of the
    // box: that is the whole of what the sim lets us know on the way in, and it
    // is the number the driver is braking for.
    const entryDistM = pitService.isApproachingPit
      ? pitService.distToPitEntryM
      : null;
    const isApproach = isIdle && entryDistM !== null;

    if (isIdle && !isVertical && !isApproach) {
      return null;
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

    const spanStyle = (start: number, size: number) =>
      isVertical
        ? { bottom: `${start * PCT}%`, height: `${size * PCT}%` }
        : { left: `${start * PCT}%`, width: `${size * PCT}%` };

    const markerStyle = (at: number) =>
      isVertical ? { bottom: `${at * PCT}%` } : { left: `${at * PCT}%` };

    return (
      <div
        className={[
          styles.rail,
          isVertical ? styles.railVertical : styles.railInline,
          isVertical && side === 'left' && styles.railLeft,
          isIdle ? styles.railIdle : styles[`urgency${view.urgency}`],
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.readout}>
          <span className={styles.value}>{distValue}</span>

          <span className={styles.unit}>
            {isImperial ? 'ft' : 'm'} → {targetLabel}
          </span>
        </div>

        <div className={styles.track}>
          {!isIdle && (
            <span className={styles.fill} style={spanStyle(0, view.fill)} />
          )}

          {view.boxLeft !== null && view.boxWidth !== null && (
            <span
              className={styles.boxZone}
              style={spanStyle(view.boxLeft, view.boxWidth)}
            />
          )}

          {!isIdle && view.brakeMarker !== null && (
            <span
              className={styles.brakeMarker}
              style={markerStyle(view.brakeMarker)}
            />
          )}

          <span className={styles.carMarker} style={markerStyle(view.fill)} />
        </div>

        {/*
          The end labels only fit the horizontal block — on a rail the width of
          two digits they would crowd out the number that matters, and the fill
          growing upwards already says which end is the entry.
        */}
        {!isVertical && (
          <div className={styles.ends}>
            <span>IN</span>
            <span>OUT</span>
          </div>
        )}
      </div>
    );
  }
);
