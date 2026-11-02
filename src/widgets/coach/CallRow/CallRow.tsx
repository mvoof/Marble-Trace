import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import type { CSSProperties } from 'react';

import { observer } from 'mobx-react-lite';

import type { CoachInactiveReason } from '@shared/contracts/generated/bindings';
import type { PhaseFigure } from '@widgets/coach/coach-trace-utils';
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

/** A miss this small is the reference's point, near enough: the figure says ON. */
const ON_TARGET_M = 3;

/** How a figure is coloured: grey while counting down, green on target, amber off it. */
type ReadoutTone = 'idle' | 'on' | 'off';

interface ReadoutParts {
  word: string;
  metres: string | null;
  tone: ReadoutTone;
}

const NO_FIGURE: ReadoutParts = {
  word: NO_VALUE_TEXT,
  metres: null,
  tone: 'idle',
};

/**
 * The figure in words, so it reads without a legend: IN 40 before the
 * reference's point, PAST 25 while running past it undone, and once done ON,
 * or LATE / EARLY by how much.
 */
const readoutParts = (figure: PhaseFigure | null): ReadoutParts => {
  if (figure === null) {
    return NO_FIGURE;
  }

  const metres = Math.abs(figure.valueM).toFixed(0);

  if (figure.kind === 'to-go') {
    return { word: 'IN', metres, tone: 'idle' };
  }

  if (figure.kind === 'overshoot') {
    return { word: 'PAST', metres, tone: 'off' };
  }

  if (Math.abs(figure.valueM) <= ON_TARGET_M) {
    return { word: 'ON', metres: null, tone: 'on' };
  }

  return {
    word: figure.valueM > 0 ? 'LATE' : 'EARLY',
    metres,
    tone: 'off',
  };
};

const TONE_CLASS: Record<ReadoutTone, string> = {
  idle: styles.toneIdle ?? '',
  on: '',
  off: styles.toneOff ?? '',
};

interface PhaseReadoutProps {
  label: string;
  color: string;
  /** The on-target colour — the same green the trace draws a gain in. */
  onColor: string;
  figure: PhaseFigure | null;
}

/**
 * One phase of the corner, as two lines: the phase in its colour, and what this
 * lap did against the reference's point in words. Every cell has the same
 * fixed width, so a changing figure never moves its neighbours.
 */
const PhaseReadout = observer(
  ({ label, color, onColor, figure }: PhaseReadoutProps) => {
    const { word, metres, tone } = readoutParts(figure);

    return (
      <span className={styles.phase}>
        <span className={styles.phaseLabel} style={{ color } as CSSProperties}>
          {label}
        </span>
        <span className={`${styles.phaseValue} ${TONE_CLASS[tone]}`}>
          <span
            className={styles.phaseWord}
            style={
              tone === 'on' ? ({ color: onColor } as CSSProperties) : undefined
            }
          >
            {word}
          </span>
          {metres === null ? null : (
            <span className={styles.phaseMetres}>{metres}</span>
          )}
        </span>
      </span>
    );
  }
);

/**
 * The advisory call on the left, and on the right the corner in three figures:
 * braking, apex, throttle — each against the reference's point, see
 * `PhaseReadout`. A settled figure is the gap between a dot and a dashed line
 * on the chart below, in the same colour. The advisory comes from the
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
              onColor={settings.gainColor}
              figure={trace.displayedBrakeFigure}
            />
            {/* The apex has no pedal of its own: it takes the reference lap's
                colour, the line it is the lowest point of. */}
            <PhaseReadout
              label="APEX"
              color={settings.referenceColor}
              onColor={settings.gainColor}
              figure={trace.displayedApexFigure}
            />
            <PhaseReadout
              label="THROTTLE"
              color={settings.gasColor}
              onColor={settings.gainColor}
              figure={trace.displayedThrottleFigure}
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
