import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { unitsStore } from '@store/units.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import {
  formatGear,
  formatSpeed,
  speedUnit,
  MPS_TO_KMH,
  MPS_TO_MPH,
} from '@utils/formatters/telemetry-format';
import { parsePitSpeedLimitMs } from '@utils/widget/speed-utils';

import styles from './PitPanel.module.scss';

export type PitState = 'normal' | 'pit-lane' | 'limiter-active' | 'over-limit';

const PIT_LIMITER_BIT = 0x10;

const PIT_STATE_CLASS: Record<PitState, string> = {
  normal: '',
  'pit-lane': styles.statePitLane,
  'limiter-active': styles.stateLimiter,
  'over-limit': styles.stateOverLimit,
};

export const PitPanel = observer(() => {
  const { pitSpeedLimitOverride, gearColor, gearPanelBg } =
    widgetSettingsStore.getSpeedSettings();
  const carStatus = telemetryStore.carStatus;
  const carDynamics = telemetryStore.carDynamics;
  const system = unitsStore.system;
  const speedFactor = system === 'metric' ? MPS_TO_KMH : MPS_TO_MPH;
  const pitLimitMs =
    pitSpeedLimitOverride !== null
      ? pitSpeedLimitOverride / speedFactor
      : parsePitSpeedLimitMs(telemetryStore.weekendInfo?.TrackPitSpeedLimit);
  const pitLimitFormatted =
    pitLimitMs > 0 ? formatSpeed(pitLimitMs, system) : '—';

  const gear = carDynamics?.gear ?? 0;
  const speed = carDynamics?.speed ?? 0;

  const isLimiter = ((carStatus?.engine_warnings ?? 0) & PIT_LIMITER_BIT) !== 0;
  const onPitRoad = carStatus?.on_pit_road ?? false;

  const isPitActive = onPitRoad || isLimiter;

  const pitState: PitState = (() => {
    if (!isPitActive) {
      return 'normal';
    }

    if (pitLimitMs > 0 && speed > pitLimitMs) {
      return 'over-limit';
    }

    if (isLimiter) {
      return 'limiter-active';
    }

    return 'pit-lane';
  })();

  const pitSubLabel = (() => {
    if (pitState === 'normal') {
      return 'GEAR';
    }

    if (pitState === 'over-limit') {
      return 'SLOW!';
    }

    if (pitState === 'limiter-active') {
      if (pitLimitMs > 0) {
        const factor = system === 'metric' ? MPS_TO_KMH : MPS_TO_MPH;
        const delta = Math.round((speed - pitLimitMs) * factor);

        if (delta > 0) {
          return `+${delta} ${speedUnit(system)}`;
        }

        return `LIM ${pitLimitFormatted}`;
      }

      return 'LIM';
    }

    return 'LIM OFF';
  })();

  const panelStyle =
    pitState === 'normal' ? { background: gearPanelBg } : undefined;

  const gearStyle = pitState === 'normal' ? { color: gearColor } : undefined;

  return (
    <div
      className={`${styles.panel} ${PIT_STATE_CLASS[pitState]}`}
      style={panelStyle}
    >
      <span className={styles.gearDigit} style={gearStyle}>
        {formatGear(gear)}
      </span>

      <span
        className={`${styles.pitSub} ${
          pitState === 'normal'
            ? styles.pitSubNormal
            : pitState === 'pit-lane'
              ? styles.pitSubLimOff
              : pitState === 'over-limit'
                ? styles.pitSubOver
                : ''
        }`}
      >
        {pitSubLabel}
      </span>
    </div>
  );
});
