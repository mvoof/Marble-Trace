import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../../store/iracing/telemetry.store';
import { unitsStore } from '../../../../store/units.store';
import {
  speedUnit,
  MPS_TO_KMH,
  MPS_TO_MPH,
} from '../../../../utils/telemetry-format';

import styles from './PitPanel.module.scss';

export type PitState = 'pit-lane' | 'limiter-active' | 'over-limit';

// irsdk_pitSpeedLimiter bit in EngineWarnings bitmask — isolates the limiter flag via bitwise AND
const PIT_LIMITER_BIT = 0x10;

interface PitPanelProps {
  showPitPanel: boolean;
  pitLimitMs: number;
  pitLimitFormatted: string;
}

const PIT_STATE_LABEL: Record<PitState, string> = {
  'pit-lane': 'PIT LANE',
  'limiter-active': 'PIT LIMITER',
  'over-limit': 'REDUCE SPEED',
};

const PIT_STATE_CLASS: Record<PitState, string> = {
  'pit-lane': styles.stateYellow,
  'limiter-active': styles.stateSafe,
  'over-limit': styles.stateWarn,
};

const getDeltaClass = (delta: number): string => {
  if (delta > 0) return styles.deltaOver;
  if (delta >= -5) return styles.deltaClose;

  return styles.deltaOk;
};

const formatDelta = (delta: number): string => {
  if (delta > 0) return `+${delta}`;
  if (delta === 0) return '±0';

  return `${delta}`;
};

export const PitPanel = observer(
  ({ showPitPanel, pitLimitMs, pitLimitFormatted }: PitPanelProps) => {
    const carStatus = telemetryStore.carStatus;
    const system = unitsStore.system;
    const speed = telemetryStore.carDynamics?.speed ?? 0;

    const isLimiter =
      ((carStatus?.engine_warnings ?? 0) & PIT_LIMITER_BIT) !== 0;

    const onPitRoad = carStatus?.on_pit_road ?? false;

    if (!showPitPanel || (!onPitRoad && !isLimiter)) {
      return null;
    }

    const pitState: PitState = (() => {
      if (pitLimitMs > 0 && speed > pitLimitMs) return 'over-limit';
      if (isLimiter) return 'limiter-active';

      return 'pit-lane';
    })();

    const factor = system === 'metric' ? MPS_TO_KMH : MPS_TO_MPH;
    const pitSpeedDelta =
      pitLimitMs > 0 ? Math.round((speed - pitLimitMs) * factor) : null;

    return (
      <div className={`${styles.panel} ${PIT_STATE_CLASS[pitState]}`}>
        <span className={styles.label}>{PIT_STATE_LABEL[pitState]}</span>

        <div className={styles.right}>
          <span className={styles.limit}>{pitLimitFormatted}</span>
          <span className={styles.unit}>{speedUnit(unitsStore.system)}</span>

          {pitSpeedDelta !== null && (
            <span className={`${styles.delta} ${getDeltaClass(pitSpeedDelta)}`}>
              {formatDelta(pitSpeedDelta)}
            </span>
          )}
        </div>
      </div>
    );
  }
);
