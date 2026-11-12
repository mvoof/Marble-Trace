import { useLayoutEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronUp } from 'lucide-react';

import { usePitServiceWidgetStore } from '@features/pit-service/pit-service-context';
import { usePlayerStore } from '@entities/player/player-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { buildPitApproachView } from '@features/pit-service/pit-approach';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import {
  useLiveParts,
  writeState,
  writeStyle,
} from '@shared/ui/live/live-parts';
import {
  useBlink,
  useBlinkHandle,
  type BlinkCycle,
} from '@shared/hooks/useBlink';
import {
  metersToDisplayDistance,
  widgetDistanceUnit,
} from '@shared/lib/telemetry-format';
import { ReservedSlot } from '@entities/app-settings/ReservedSlot/ReservedSlot';

import styles from './PitApproachRail.module.scss';

const PCT = 100;

const NO_VALUE_TEXT = '--';

const FILL_WIDTH_PROPERTY = '--rail-fill';
const BRAKE_LEFT_PROPERTY = '--rail-brake-left';

/**
 * The room the column asks for while the widget is being placed. Kept as a
 * number here so the slot the rail leaves behind is exactly the rail.
 */
const RAIL_HEIGHT_PX = 130;

// Small enough to read as a sign rather than a bar: three of them stacked are
// the signal, not one arrow blown up to fill the column.
const GO_ARROW_SIZE = 22;
const GO_ARROW_STROKE = 3;

/** Inside the braking point: the column flashes red, 200 ms a side. */
const BRAKE_BLINK: BlinkCycle = { stepMs: 200, steps: 2 };

/**
 * The GO arrows run the column in fourteen 100 ms steps — one length of the bar
 * in 1.4 s. Must match `$go-steps` in the stylesheet.
 */
const GO_SWEEP: BlinkCycle = { stepMs: 100, steps: 14 };

interface PitApproachRailProps {
  withBrakeCue: boolean;
  withUnit: boolean;
  revealOnApproachM: number;
}

/**
 * How far there is left to roll, drawn as the lane the car is in. The distance
 * and the speed behind the brake cue both move with the car, so the fill, the
 * two markers and the number are written straight to the DOM; React renders the
 * rail when it appears and when the lane goes away. See `docs/rendering.md`.
 */
export const PitApproachRail = observer(
  ({ withBrakeCue, withUnit, revealOnApproachM }: PitApproachRailProps) => {
    const pitService = usePitServiceWidgetStore();
    const player = usePlayerStore();
    const units = useUnitsStore();

    // Off pit road, or on a track whose pit lane has not been recorded yet,
    // there is no lane to draw.
    const isIdle = !pitService.isOnPitRoad || !player.hasPitLaneProgress;

    // Before the entry line the rail counts down to the entry instead of the
    // box: that is the whole of what the sim lets us know on the way in, and it
    // is the number the driver is braking for.
    const isApproach =
      isIdle && pitService.isApproachingWithin(revealOnApproachM);

    const { unitSystem } = units;
    const brakeBlink = useBlinkHandle();
    const goSweepRef = useBlink<HTMLSpanElement>(
      pitService.isPitLimitReleased ? GO_SWEEP : null
    );

    // The rail unmounts for the GO column, and its reactive write with it, so
    // nothing would be left to stop a flash that was running when it went.
    useLayoutEffect(() => {
      if (pitService.isPitLimitReleased) {
        brakeBlink.run(null);
      }
    }, [brakeBlink, pitService.isPitLimitReleased]);

    const parts = useLiveParts<'fill' | 'brakeMarker' | 'value'>();

    const railRef = useReactiveDomWrite<HTMLDivElement>(
      (element, scheduleWrite) => {
        const view = buildPitApproachView({
          distM: player.pitTargetDistM,
          distMode: player.pitTargetType,
          progressPct: player.pitLaneProgressPct,
          laneLengthM: pitService.pitLaneLengthM,
          boxLanePct: pitService.pitboxLanePct,
          speedMs: player.carDynamics?.speed ?? 0,
          withBrakeCue,
        });

        const shownDistM = isIdle
          ? pitService.distToPitEntryM
          : player.pitTargetDistM;

        const distValue =
          shownDistM === null
            ? NO_VALUE_TEXT
            : Math.round(
                metersToDisplayDistance(shownDistM, unitSystem)
              ).toString();

        scheduleWrite(() => {
          writeState(element, 'urgency', isIdle ? null : view.urgency);

          brakeBlink.attach(element);
          brakeBlink.run(
            !isIdle && view.urgency === 'brake' ? BRAKE_BLINK : null
          );

          writeStyle(
            element,
            FILL_WIDTH_PROPERTY,
            `${isIdle ? 0 : view.fill * PCT}%`
          );

          parts.attribute('fill', 'hidden', isIdle ? '' : null);

          const hasBrakeMarker = !isIdle && view.brakeMarker !== null;

          parts.attribute('brakeMarker', 'hidden', hasBrakeMarker ? null : '');

          if (hasBrakeMarker) {
            writeStyle(
              element,
              BRAKE_LEFT_PROPERTY,
              `${(view.brakeMarker ?? 0) * PCT}%`
            );
          }

          parts.text('value', distValue);
        });
      },
      [player, pitService, withBrakeCue, isIdle, unitSystem, brakeBlink, parts]
    );

    // The lane goes away, but not the room it stands in: the rail appears on
    // the way to the box, and a widget that grew a row at that moment would be
    // one the driver placed against a different bottom edge.
    // Out of the pits altogether the column has nothing left to measure — the
    // lane is behind the car — so it becomes the other half of the GO the speed
    // column shows at the same moment: three arrows running the way the car is
    // going. It is deliberately the same flag, so the two columns cannot
    // disagree about when the lane stops applying.
    if (pitService.isPitLimitReleased) {
      return (
        <div className={styles.rail}>
          <div className={`${styles.track} ${styles.trackGo}`}>
            {/*
              One group of three, swept up the whole column rather than three
              arrows blinking in place: the leading arrow is solid and the tail
              fades out behind it, so the run has a direction even in a frame.
            */}
            <span ref={goSweepRef} className={styles.goArrows}>
              <ChevronUp
                size={GO_ARROW_SIZE}
                strokeWidth={GO_ARROW_STROKE}
                className={styles.goArrow}
              />

              <ChevronUp
                size={GO_ARROW_SIZE}
                strokeWidth={GO_ARROW_STROKE}
                className={styles.goArrow}
              />

              <ChevronUp
                size={GO_ARROW_SIZE}
                strokeWidth={GO_ARROW_STROKE}
                className={styles.goArrow}
              />
            </span>
          </div>
        </div>
      );
    }

    if (isIdle && !isApproach) {
      return <ReservedSlot height={RAIL_HEIGHT_PX} label="Pit approach" />;
    }

    return (
      <div ref={railRef} className={styles.rail}>
        <div className={styles.track}>
          <span ref={parts.ref('fill')} className={styles.fill} />

          <span ref={parts.ref('brakeMarker')} className={styles.brakeMarker} />

          {/*
            The number is the first thing read on the column, so it stands at
            the head of it; the unit is read once and sits out of the way at the
            foot. Nothing marks the top of the fill — the fill's own edge is the
            car, and a line drawn over it only competed with the box.
          */}
          <span ref={parts.ref('value')} className={styles.value} />

          {withUnit && (
            <span className={styles.unit}>
              {widgetDistanceUnit(unitSystem)}
            </span>
          )}
        </div>
      </div>
    );
  }
);
