import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import type { CSSProperties } from 'react';

import { observer } from 'mobx-react-lite';

import type { CoachInactiveReason } from '@shared/contracts/generated/bindings';
import {
  StatChip,
  type StatChipLook,
  type StatChipTone,
} from '@shared/ui/StatChip/StatChip';
import {
  EVEN_TIME_S,
  formatSignedSeconds,
  type PhaseTime,
} from '@widgets/coach/coach-trace-utils';
import {
  useCoachWidgetStore,
  useDrivingCoachWidgetStore,
} from '@widgets/coach/coach-stores';

import { SpeedGapChip } from './SpeedGapChip/SpeedGapChip';

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

interface PhaseCellProps {
  label: string;
  color: string;
  gainColor: string;
  lossColor: string;
  time: PhaseTime | null;
}

/**
 * One phase of the reference's corner, as a cell of two lines: the phase in
 * its colour, and the time this lap gained (−, gain colour) or lost (+, loss
 * colour) inside it. The cell the car is in is lit — a marker over it and a
 * shade of its colour under the figure, which is still running. The cells
 * share the row in equal parts, so a changing figure never moves its
 * neighbours.
 */
const PhaseCell = observer(
  ({ label, color, gainColor, lossColor, time }: PhaseCellProps) => {
    const deltaColor =
      time === null || Math.abs(time.deltaS) < EVEN_TIME_S
        ? undefined
        : time.deltaS > 0
          ? lossColor
          : gainColor;

    const cellClass = [
      styles.phase,
      time?.kind === 'running' ? styles.phaseActive : '',
    ]
      .filter(Boolean)
      .join(' ');

    const valueClass = [
      styles.phaseValue,
      time === null ? styles.phaseValueEmpty : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span
        className={cellClass}
        style={{ '--phase-tone': color } as CSSProperties}
      >
        <span className={styles.phaseLabel}>{label}</span>
        <span
          className={valueClass}
          style={
            deltaColor ? ({ color: deltaColor } as CSSProperties) : undefined
          }
        >
          {time === null ? NO_VALUE_TEXT : formatSignedSeconds(time.deltaS)}
        </span>
      </span>
    );
  }
);

/** How the call's chip is drawn: a fixed tone, or the color the user set for the pedal. */
interface CallChip {
  look: StatChipLook;
  tone?: StatChipTone;
  toneColor?: string;
}

/**
 * The advisory call on the left as a chip, and on the right where the corner's
 * time went: gained or lost IN (the braking zone), at the APEX (off the brakes
 * until the throttle opens) and OUT (until full throttle), each part as the
 * reference drove it — the shaded zones on the chart below. The three add up to
 * what the corner cost. The advisory comes from the shared coach store; the
 * figures from this widget's trace window.
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

  // A pedal call is a deep shade of the pedal's color. SOON is neither the
  // hard call nor the all-clear, so it takes neither of their colors: the
  // warning tone is fixed rather than configurable so the three steps always
  // read as a sequence. GRIP is no instruction — the car is being corrected —
  // and a status is no call at all, so both stay unlit.
  const callChip: CallChip =
    inactiveReason !== null || advisory === 'grip'
      ? { look: 'plain', tone: 'muted' }
      : brakeSoon
        ? { look: 'state', tone: 'accent' }
        : advisory === 'brake'
          ? { look: 'state', toneColor: settings.brakeColor }
          : advisory === 'gas'
            ? { look: 'state', toneColor: settings.gasColor }
            : { look: 'state', tone: 'muted' };

  const callClass = [
    inactiveReason !== null ? styles.status : styles.call,
    callChip.toneColor !== undefined ? styles.callPedal : '',
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
        <div className={styles.callCell}>
          {inactiveReason === null && settings.showSpeed ? (
            <SpeedGapChip />
          ) : null}

          <StatChip
            className={callClass}
            lead={callText}
            look={callChip.look}
            tone={callChip.tone}
            toneColor={callChip.toneColor}
          />

          {inactiveReason !== null ? (
            <span className={styles.hint}>{INACTIVE_HINT[inactiveReason]}</span>
          ) : null}
        </div>

        {inactiveReason === null && settings.showPhaseFigures ? (
          <span className={styles.phases}>
            <PhaseCell
              label="IN"
              color={settings.brakeColor}
              gainColor={settings.gainColor}
              lossColor={settings.lossColor}
              time={trace.displayedBrakeTime}
            />
            {/* Mid-corner has no pedal of its own: it takes the reference
                lap's colour, the same as its zone on the chart. */}
            <PhaseCell
              label="APEX"
              color={settings.referenceColor}
              gainColor={settings.gainColor}
              lossColor={settings.lossColor}
              time={trace.displayedApexTime}
            />
            <PhaseCell
              label="OUT"
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
