import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

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
const SHIFT_FLASH_MS = 220;

export const RingBadge = observer(() => {
  const { carDynamics, carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const gear = carDynamics?.gear ?? 0;
  const rpm = carDynamics?.rpm ?? 0;

  const { pct, zone } = computeRpmZoneState(rpm, sessionInfo, carStatus, gear);
  const { shiftRpm, blinkRpm, redLine } = computeShiftThresholds(
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
  const isBlink = zone === 'blink';

  // When the fill arc is hidden, the gear digit stays white — the core
  // glow already carries the zone color, so tinting the digit too would
  // wash the two together.
  const gearColor = settings.showRpmFill
    ? rpmNumberColor(zone, settings)
    : null;

  // Grows from a small dot at the center out to the full circle by the time
  // rpm hits the shift point — same zone colors as the fill arc, just as a
  // filled disc instead of a ring.
  const coreGlowScale = isBlink
    ? 1
    : Math.min(Math.max(rpm / (shiftRpm || 1), 0), 1);

  const coreGlowClassName = isBlink
    ? `${styles.coreGlow} ${styles.coreGlowBlink}`
    : styles.coreGlow;

  // A short pulse ring the instant the driver upshifts, on top of the
  // continuous core glow — the "shift landed" confirmation.
  const previousGearRef = useRef(gear);
  const [showShiftFlash, setShowShiftFlash] = useState(false);

  useEffect(() => {
    if (
      !settings.showRpmFill &&
      gear > previousGearRef.current &&
      previousGearRef.current > 0
    ) {
      setShowShiftFlash(true);
      const timeout = setTimeout(
        () => setShowShiftFlash(false),
        SHIFT_FLASH_MS
      );

      previousGearRef.current = gear;

      return () => clearTimeout(timeout);
    }

    previousGearRef.current = gear;
  }, [gear, settings.showRpmFill]);

  return (
    <div className={styles.root}>
      {settings.showRpmFill && (
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
            <path d={ringArcPath(0, fillDeg)} style={{ stroke: fillColor }} />
          )}
        </svg>
      )}

      <div className={styles.scrim} />
      <div className={styles.rim} />

      {!settings.showRpmFill && (
        <div
          className={coreGlowClassName}
          style={
            {
              '--core-glow-color': fillColor,
              '--core-glow-scale': coreGlowScale,
            } as CSSProperties
          }
        />
      )}

      {showShiftFlash && <div className={styles.shiftFlash} />}

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
