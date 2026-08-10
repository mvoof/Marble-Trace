import type { CSSProperties } from 'react';

import { observer } from 'mobx-react-lite';

import type { CoachWidgetSettings } from '@/types/widget-settings';
import type { CoachInactiveReason } from '@store/widgets/driving-coach.widget';
import {
  useCoachWidgetStore,
  useDrivingCoachWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './CallRow.module.scss';

/** Brake urgency at or above this pre-arms the row before the hard BRAKE call fires. */
const BRAKE_SOON_URGENCY = 0.7;

// Widget text is not localized — every widget in the overlay is English.
const ADVISORY_LABEL = {
  brake: 'BRAKE',
  gas: 'GAS',
} as const;

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
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<CoachWidgetSettings>('coach');

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

  const callColor =
    inactiveReason !== null
      ? undefined
      : advisory === 'brake' || brakeSoon
        ? settings.brakeColor
        : advisory === 'gas'
          ? settings.gasColor
          : undefined;

  const callClass =
    inactiveReason !== null
      ? `${styles.call} ${styles.callIdle}`
      : `${styles.call} ${styles.callActive}`;

  // The braking-point gap is the headline whenever the window holds both marks:
  // it is the one number a driver can act on directly, and the two ticks on the
  // chart below are the same fact drawn. Away from a braking zone there is
  // nothing to compare, and the time delta takes the slot instead.
  const brakeDeltaM = trace.displayedBrakeDeltaM;
  const windowDeltaS = trace.displayedWindowDeltaS;
  const headlineValue = brakeDeltaM ?? windowDeltaS;

  const deltaText =
    brakeDeltaM !== null
      ? signed(brakeDeltaM, 0)
      : windowDeltaS === null
        ? '—'
        : signed(windowDeltaS, 2);
  const deltaUnit = brakeDeltaM !== null ? 'm' : 's';

  // Losing time is the same red as a brake call, gaining it the same green as a
  // gas call — the number and the trace line under it read as one signal.
  const deltaColor =
    headlineValue === null || headlineValue === 0
      ? undefined
      : headlineValue > 0
        ? settings.lossColor
        : settings.gainColor;

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
            className={styles.urgencyFill}
            style={
              {
                width: `${Math.round(brakeUrgency * 100)}%`,
                background: settings.brakeColor,
              } as CSSProperties
            }
          />
        </div>
      ) : null}
    </div>
  );
});
