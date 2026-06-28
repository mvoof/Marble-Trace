import {
  usePlayerStore,
  useSessionStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { SpeedWidgetSettings } from '@/types/widget-settings';
import {
  formatSpeed,
  MPS_TO_KMH,
  MPS_TO_MPH,
  speedUnit,
} from '@utils/formatters/telemetry-format';
import { parsePitSpeedLimitMs } from '@utils/widget/speed-utils';

export type PitState = 'normal' | 'pit-lane' | 'limiter-active' | 'over-limit';

const PIT_LIMITER_BIT = 0x10;

export interface PitStateResult {
  pitState: PitState;
  pitLimitMs: number;
  pitLimitFormatted: string;
  speed: number;
  speedKmhOrMph: number;
  limitKmhOrMph: number;
  system: 'metric' | 'imperial';
  pitSubLabel: string;
}

export const usePitState = (): PitStateResult => {
  const player = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const { pitSpeedLimitOverride } =
    widgetSettings.getSettings<SpeedWidgetSettings>('speed');
  const system = units.unitSystem;
  const speedFactor = system === 'metric' ? MPS_TO_KMH : MPS_TO_MPH;

  const pitLimitMs =
    pitSpeedLimitOverride !== null
      ? pitSpeedLimitOverride / speedFactor
      : parsePitSpeedLimitMs(sessionInfo?.trackPitSpeedLimit);

  const pitLimitFormatted =
    pitLimitMs > 0 ? formatSpeed(pitLimitMs, system) : '—';

  const speed = player.carDynamics?.speed ?? 0;
  const isLimiter =
    ((player.carStatus?.engine_warnings ?? 0) & PIT_LIMITER_BIT) !== 0;
  const onPitRoad = player.carStatus?.on_pit_road ?? false;
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
        const delta = Math.round((speed - pitLimitMs) * speedFactor);

        if (delta > 0) {
          return `+${delta} ${speedUnit(system)}`;
        }

        return `LIM ${pitLimitFormatted}`;
      }

      return 'LIM';
    }

    return 'LIM OFF';
  })();

  return {
    pitState,
    pitLimitMs,
    pitLimitFormatted,
    speed,
    speedKmhOrMph: Math.round(speed * speedFactor),
    limitKmhOrMph: Math.round(pitLimitMs * speedFactor),
    system,
    pitSubLabel,
  };
};
