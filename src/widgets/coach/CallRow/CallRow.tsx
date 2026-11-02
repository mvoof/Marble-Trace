import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import type { CSSProperties } from 'react';

import { observer } from 'mobx-react-lite';

import type { CoachInactiveReason } from '@shared/contracts/generated/bindings';
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
const METRES_UNIT = 'm';

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

const signedMetres = (valueM: number | null): string => {
  if (valueM === null) {
    return NO_VALUE_TEXT;
  }

  const sign = valueM > 0 ? '+' : valueM < 0 ? '−' : '';

  return `${sign}${Math.abs(valueM).toFixed(0)}`;
};

interface PhaseFigureProps {
  label: string;
  color: string;
  valueM: number | null;
}

/** One phase of the corner: how many metres later than the reference this lap got there. */
const PhaseFigure = observer(({ label, color, valueM }: PhaseFigureProps) => {
  return (
    <span className={styles.phase}>
      <span className={styles.phaseLabel} style={{ color } as CSSProperties}>
        {label}
      </span>
      <span className={styles.phaseValue}>{signedMetres(valueM)}</span>
      {valueM === null ? null : (
        <small className={styles.phaseUnit}>{METRES_UNIT}</small>
      )}
    </span>
  );
});

/**
 * The advisory call on the left, and on the right the corner in three figures:
 * how many metres later than the reference this lap braked, reached its lowest
 * speed and opened the throttle. Each is the gap between a dot and a dashed
 * line on the chart below, in the same colour. The advisory comes from the
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
        ) : (
          <span className={styles.phases}>
            <PhaseFigure
              label="BRAKE"
              color={settings.brakeColor}
              valueM={trace.displayedBrakeDeltaM}
            />
            {/* The apex has no pedal of its own: it takes the reference lap's
                colour, the line it is the lowest point of. */}
            <PhaseFigure
              label="APEX"
              color={settings.referenceColor}
              valueM={trace.displayedApexDeltaM}
            />
            <PhaseFigure
              label="THROTTLE"
              color={settings.gasColor}
              valueM={trace.displayedThrottleDeltaM}
            />
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
