import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { formatGear } from '@utils/formatters/telemetry-format';
import { computeShiftThresholds } from '@utils/widget/shift-thresholds';
import {
  computeRpmZoneState,
  rpmFillColor,
  rpmNumberColor,
} from '../race-dash-utils';
import {
  usePlayerStore,
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { ARC_SWEEP_DEG, RING_SIZE, ringArcPath } from './ring-geometry';

import styles from './RingBadge.module.scss';

const MIN_VISIBLE_ARC_DEG = 0.5;

export const RingBadge = observer(() => {
  const { carDynamics, carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const gear = carDynamics?.gear ?? 0;
  const rpm = carDynamics?.rpm ?? 0;

  const { pct, zone } = computeRpmZoneState(rpm, sessionInfo, carStatus, gear);
  const { blinkRpm, redLine } = computeShiftThresholds(
    sessionInfo,
    carStatus,
    gear
  );

  // Printed redline zone spans blink RPM → redline on the same 0..redline
  // scale as the fill arc — the moment the fill sweeps into it is the shift
  // cue, no text needed.
  const sectorStartDeg =
    Math.min(Math.max(blinkRpm / (redLine || 1), 0), 1) * ARC_SWEEP_DEG;
  const fillDeg = pct * ARC_SWEEP_DEG;

  const fillColor = rpmFillColor(zone, settings);
  const gearColor = rpmNumberColor(zone, settings);
  const isBlink = zone === 'blink';

  return (
    <div className={styles.root}>
      <svg
        className={styles.arc}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        aria-hidden="true"
      >
        {sectorStartDeg > MIN_VISIBLE_ARC_DEG && (
          <path
            className={styles.trackDim}
            d={ringArcPath(0, sectorStartDeg)}
          />
        )}

        {sectorStartDeg < ARC_SWEEP_DEG - MIN_VISIBLE_ARC_DEG && (
          <path
            className={styles.trackRedline}
            d={ringArcPath(sectorStartDeg, ARC_SWEEP_DEG)}
          />
        )}

        {fillDeg > MIN_VISIBLE_ARC_DEG && (
          <path
            className={styles.fill}
            d={ringArcPath(0, fillDeg)}
            style={{ stroke: fillColor, color: fillColor }}
          />
        )}
      </svg>

      <div className={styles.scrim} />
      <div className={styles.rim} />

      <div className={styles.core}>
        <span
          className={`${styles.gear} ${isBlink ? styles.blinkPulse : ''}`}
          style={gearColor ? { color: gearColor } : undefined}
        >
          {formatGear(gear)}
        </span>
      </div>
    </div>
  );
});
