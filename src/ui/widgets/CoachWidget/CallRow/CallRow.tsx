import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import type { CSSProperties } from 'react';

import { observer } from 'mobx-react-lite';

import type { CoachWidgetSettings } from '@/types/widget-settings';
import type { CoachInactiveReason } from '@ui/widgets/CoachWidget/driving-coach.widget';
import {
  useCoachWidgetStore,
  useDrivingCoachWidgetStore,
} from '@store/root-store-context';

import styles from './CallRow.module.scss';

/** Brake urgency at or above this pre-arms the row before the hard BRAKE call fires. */
const BRAKE_SOON_URGENCY = 0.7;

// Widget text is not localized — every widget in the overlay is English.
const ADVISORY_LABEL = {
  brake: 'BRAKE',
  gas: 'GAS',
  grip: 'GRIP',
} as const;

/** Pedal deficit below this reads as noise and is not worth putting a number on. */
const MIN_DISPLAYED_THROTTLE_DEFICIT = 0.05;

const SOON_LABEL = 'SOON';
const PACE_LABEL = 'PACE';

/**
 * What the coach shows when it is not evaluating. Each of these used to read as
 * PACE, which claimed the driver was on the reference when in fact nothing was
 * being compared at all.
 */
const INACTIVE_LABEL: Record<CoachInactiveReason, string> = {
  'no-reference': 'NO REFERENCE',
  'no-track-data': 'NO TRACK DATA',
  'no-corners': 'NO CORNERS',
  'no-telemetry': 'NO TELEMETRY',
};

const INACTIVE_HINT: Record<CoachInactiveReason, string> = {
  'no-reference': 'drive a clean lap',
  'no-track-data': 'waiting for session',
  'no-corners': 'reference lap has no braking zones',
  'no-telemetry': 'waiting for telemetry',
};

const signed = (value: number, digits: number): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}`;

/**
 * The advisory call and how much time this pass through the window has cost or
 * gained. The advisory itself comes from the shared coach store; only the
 * window delta belongs to this widget.
 */
export const CallRow = observer(() => {
  const coach = useDrivingCoachWidgetStore();
  const trace = useCoachWidgetStore();

  const settings = useWidgetSettings<CoachWidgetSettings>('coach');

  const inactiveReason = coach.inactiveReason;
  const advisory = coach.displayedAdvisory;
  const brakeUrgency = coach.displayedBrakeUrgency;

  const brakeSoon =
    inactiveReason === null &&
    advisory === 'neutral' &&
    brakeUrgency >= BRAKE_SOON_URGENCY;

  const callText =
    inactiveReason !== null
      ? INACTIVE_LABEL[inactiveReason]
      : advisory === 'neutral'
        ? brakeSoon
          ? SOON_LABEL
          : PACE_LABEL
        : ADVISORY_LABEL[advisory];

  // SOON is neither the hard call nor the all-clear, so it takes neither of
  // their colors: amber is the warning step between them, and it is fixed
  // rather than configurable so the three steps always read as a sequence.
  const callColor =
    inactiveReason !== null || brakeSoon
      ? undefined
      : advisory === 'brake'
        ? settings.brakeColor
        : advisory === 'gas'
          ? settings.gasColor
          : undefined;

  const callClass = [
    styles.call,
    inactiveReason !== null ? styles.callIdle : styles.callActive,
    brakeSoon ? styles.callSoon : '',
    advisory === 'grip' && inactiveReason === null ? styles.callGrip : '',
  ]
    .filter(Boolean)
    .join(' ');

  // One slot, filled by whichever fact the driver can act on where they are.
  // The braking-point gap is the headline whenever the window holds both marks:
  // it is a number a driver can act on directly, and the two ticks on the chart
  // below are the same fact drawn. Away from a braking zone there is nothing to
  // compare, and the time delta takes the slot instead.
  // Coming out of a corner the throttle-opening gap displaces both: it is the
  // one thing the driver can still act on there, and unlike the time delta it
  // names what to do about it. Once on the power with the reference's own
  // opening point matched, the pedal deficit takes over — same fact, the only
  // form left once the metres are settled.
  const exitLateM = coach.displayedExitLateM;
  const exitDeficit = coach.displayedExitThrottleDeficit;
  const brakeDeltaM = trace.displayedBrakeDeltaM;
  const windowDeltaS = trace.displayedWindowDeltaS;

  const showExitDeficit =
    exitLateM === null && exitDeficit >= MIN_DISPLAYED_THROTTLE_DEFICIT;
  const headlineDistanceM = exitLateM ?? brakeDeltaM;
  const headlineValue = showExitDeficit
    ? exitDeficit
    : (headlineDistanceM ?? windowDeltaS);

  const deltaText = showExitDeficit
    ? `−${Math.round(exitDeficit * 100)}`
    : headlineDistanceM !== null
      ? signed(headlineDistanceM, 0)
      : windowDeltaS === null
        ? '—'
        : signed(windowDeltaS, 2);
  const deltaUnit = showExitDeficit
    ? '%'
    : headlineDistanceM !== null
      ? 'm'
      : 's';

  // Losing time is the same red as a brake call, gaining it the same green as a
  // gas call — the number and the trace line under it read as one signal.
  const deltaColor =
    headlineValue === null || headlineValue === 0
      ? undefined
      : headlineValue > 0
        ? settings.lossColor
        : settings.gainColor;

  // Between calls the number that matters is not what the last corner cost but
  // how far the next one is: the braking point while it is still ahead, the
  // apex once the car is inside the zone.
  const countdownM = brakeSoon ? coach.brakePointDistanceM : null;
  const apexM = advisory === 'neutral' ? coach.apexDistanceM : null;

  // Inside an exit the throttle figure owns the slot: counting down to the next
  // apex there would replace the one number that scores the corner just driven.
  const inExit = exitLateM !== null || showExitDeficit;

  const countdown = inExit
    ? null
    : countdownM !== null
      ? { label: 'BRAKE IN', value: countdownM }
      : apexM !== null
        ? { label: 'APEX IN', value: apexM }
        : null;

  // The bar is the continuous signal behind the discrete call: how close the
  // last possible braking point is, and — once the call is GAS — how much of
  // the pedal the reference is carrying that this lap is not.
  const fillRatio = advisory === 'gas' ? coach.throttleDeficit : brakeUrgency;
  const fillColor =
    advisory === 'gas'
      ? settings.gasColor
      : advisory === 'brake' && !brakeSoon
        ? settings.brakeColor
        : undefined;

  const fillClass = [
    styles.urgencyFill,
    brakeSoon ? styles.urgencyFillSoon : '',
    !brakeSoon && advisory !== 'brake' && advisory !== 'gas'
      ? styles.urgencyFillIdle
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <span
          className={callClass}
          style={
            callColor ? ({ color: callColor } as CSSProperties) : undefined
          }
        >
          {callText}
        </span>

        {inactiveReason !== null ? (
          <span className={styles.hint}>{INACTIVE_HINT[inactiveReason]}</span>
        ) : countdown !== null ? (
          <span className={styles.countdown}>
            {countdown.label}
            <b className={styles.countdownValue}>{countdown.value}</b>
            <small className={styles.deltaUnit}>m</small>
          </span>
        ) : (
          <span
            className={styles.delta}
            style={
              deltaColor ? ({ color: deltaColor } as CSSProperties) : undefined
            }
          >
            {deltaText}
            <small className={styles.deltaUnit}>{deltaUnit}</small>
          </span>
        )}
      </div>

      {settings.showUrgencyBar ? (
        <div className={styles.urgencyTrack}>
          <div
            className={fillClass}
            style={
              {
                width: `${Math.round(fillRatio * 100)}%`,
                ...(fillColor ? { background: fillColor } : {}),
              } as CSSProperties
            }
          />
        </div>
      ) : null}
    </div>
  );
});
