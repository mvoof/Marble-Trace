import type { CSSProperties } from 'react';

import { observer } from 'mobx-react-lite';

import type { CoachWidgetSettings } from '@/types/widget-settings';
import {
  useCoachWidgetStore,
  useDrivingCoachWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './CallRow.module.scss';

/** Brake urgency at or above this pre-arms the row before the hard BRAKE call fires. */
const BRAKE_SOON_URGENCY = 0.7;

const ADVISORY_LABEL = {
  brake: 'BRAKE',
  gas: 'GAS',
} as const;

// Widget text is not localized — every widget in the overlay is English.
const NO_REFERENCE_LABEL = 'NO REFERENCE';
const SOON_LABEL = 'SOON';
const PACE_LABEL = 'PACE';

const formatWindowDelta = (deltaS: number): string =>
  `${deltaS > 0 ? '+' : deltaS < 0 ? '−' : ''}${Math.abs(deltaS).toFixed(2)}`;

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

  const hasReferenceLap = coach.hasReferenceLap;
  const advisory = coach.displayedAdvisory;
  const brakeUrgency = coach.displayedBrakeUrgency;

  const brakeSoon =
    hasReferenceLap &&
    advisory === 'neutral' &&
    brakeUrgency >= BRAKE_SOON_URGENCY;

  const callText = !hasReferenceLap
    ? NO_REFERENCE_LABEL
    : advisory === 'neutral'
      ? brakeSoon
        ? SOON_LABEL
        : PACE_LABEL
      : ADVISORY_LABEL[advisory];

  const callColor =
    hasReferenceLap && advisory === 'brake'
      ? settings.brakeColor
      : hasReferenceLap && advisory === 'gas'
        ? settings.gasColor
        : brakeSoon
          ? settings.brakeColor
          : undefined;

  const callClass = hasReferenceLap
    ? `${styles.call} ${styles.callActive}`
    : `${styles.call} ${styles.callIdle}`;

  const windowDeltaS = trace.displayedWindowDeltaS;
  // Losing time is the same red as a brake call, gaining it the same green as a
  // gas call — the number and the trace line under it read as one signal.
  const deltaColor =
    windowDeltaS === null || windowDeltaS === 0
      ? undefined
      : windowDeltaS > 0
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

        {hasReferenceLap ? (
          <span
            className={styles.delta}
            style={
              deltaColor ? ({ color: deltaColor } as CSSProperties) : undefined
            }
          >
            {windowDeltaS === null ? '—' : formatWindowDelta(windowDeltaS)}
            <small className={styles.deltaUnit}>s</small>
          </span>
        ) : (
          <span className={styles.hint}>drive a clean lap</span>
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
