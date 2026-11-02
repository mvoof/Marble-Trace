import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import type { CSSProperties } from 'react';

import { observer } from 'mobx-react-lite';

import type { CoachInactiveReason } from '@shared/contracts/generated/bindings';
import type { PhaseTime } from '@widgets/coach/coach-trace-utils';
import {
  useCoachWidgetStore,
  useDrivingCoachWidgetStore,
} from '@widgets/coach/coach-stores';

import styles from './CallRow.module.scss';
import type { CoachWidgetSettings } from '../settings-schema';

/** Brake urgency at or above this pre-arms the row before the hard BRAKE call fires. */
const BRAKE_SOON_URGENCY = 0.7;

// Widget text is not localized — every widget in the overlay is English.
const ADVISORY_LABEL = {
  brake: 'BRAKE',
  gas: 'GAS',
  grip: 'GRIP',
} as const;

const SOON_LABEL = 'SOON';
const PACE_LABEL = 'PACE';
const NO_VALUE_TEXT = '—';

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

/** Below this (seconds) a phase is called even — neither gained nor lost. */
const EVEN_TIME_S = 0.005;

const signedSeconds = (deltaS: number): string => {
  const sign = deltaS >= EVEN_TIME_S ? '+' : deltaS <= -EVEN_TIME_S ? '−' : '';

  return `${sign}${Math.abs(deltaS).toFixed(2)}`;
};

interface PhaseReadoutProps {
  label: string;
  color: string;
  gainColor: string;
  lossColor: string;
  time: PhaseTime | null;
}

/**
 * One phase of the reference's corner, as two lines: the phase in its colour,
 * and the time this lap gained (−, gain colour) or lost (+, loss colour) inside
 * it. While the car is still in the phase the figure runs, dimmed; past it,
 * it settles. Every cell has the same fixed width, so a changing figure never
 * moves its neighbours.
 */
const PhaseReadout = observer(
  ({ label, color, gainColor, lossColor, time }: PhaseReadoutProps) => {
    const deltaColor =
      time === null || Math.abs(time.deltaS) < EVEN_TIME_S
        ? undefined
        : time.deltaS > 0
          ? lossColor
          : gainColor;

    const valueClass = [
      styles.phaseValue,
      time === null ? styles.phaseValueEmpty : '',
      time?.kind === 'running' ? styles.phaseValueRunning : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span className={styles.phase}>
        <span className={styles.phaseLabel} style={{ color } as CSSProperties}>
          {label}
        </span>
        <span
          className={valueClass}
          style={
            deltaColor ? ({ color: deltaColor } as CSSProperties) : undefined
          }
        >
          {time === null ? NO_VALUE_TEXT : signedSeconds(time.deltaS)}
        </span>
      </span>
    );
  }
);

/**
 * The advisory call on the left, and on the right where the corner's time went:
 * gained or lost in the braking zone, mid-corner and on the exit, each phase
 * as the reference drove it — the shaded zones on the chart below. The three
 * add up to what the corner cost. The advisory comes from the
 * shared coach store; the figures from this widget's trace window.
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
        ) : settings.showPhaseFigures ? (
          <span className={styles.phases}>
            <PhaseReadout
              label="BRAKE"
              color={settings.brakeColor}
              gainColor={settings.gainColor}
              lossColor={settings.lossColor}
              time={trace.displayedBrakeTime}
            />
            {/* Mid-corner has no pedal of its own: it takes the reference
                lap's colour, the same as its zone on the chart. */}
            <PhaseReadout
              label="APEX"
              color={settings.referenceColor}
              gainColor={settings.gainColor}
              lossColor={settings.lossColor}
              time={trace.displayedApexTime}
            />
            <PhaseReadout
              label="THROTTLE"
              color={settings.gasColor}
              gainColor={settings.gainColor}
              lossColor={settings.lossColor}
              time={trace.displayedThrottleTime}
            />
          </span>
        ) : null}
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
