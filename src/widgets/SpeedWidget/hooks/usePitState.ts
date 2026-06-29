import {
  usePlayerStore,
  useSessionStore,
  useTrackMapWidgetStore,
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
  /** Meters remaining to pit exit line. null = pit pcts not yet calibrated for this track. */
  distToExitM: number | null;
  /** Progress through pit lane 0..1. null = not calibrated. */
  pitLaneProgressPct: number | null;
  /** pit_in_pct recorded but pit_exit_pct not yet — actively traversing pit lane for calibration. */
  isPitLaneRecording: boolean;
  showPitAssist: boolean;
  throttle: number;
  brake: number;
}

/** Compute distance remaining to pit exit, handling start/finish wrap-around. */
const computePitExitData = (
  lapDistPct: number,
  pitInPct: number,
  pitExitPct: number,
  trackLengthM: number
): { distToExitM: number; pitLaneProgressPct: number } => {
  const laneLengthPct = (pitExitPct - pitInPct + 1) % 1 || 1;
  const traveledPct = (lapDistPct - pitInPct + 1) % 1;
  const remainingPct = (pitExitPct - lapDistPct + 1) % 1;

  return {
    distToExitM: remainingPct * trackLengthM,
    pitLaneProgressPct: Math.min(traveledPct / laneLengthPct, 1),
  };
};

export const usePitState = (): PitStateResult => {
  const player = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();
  const trackMap = useTrackMapWidgetStore();
  const isPitLaneRecording = trackMap.isPitLaneRecording;

  const { pitSpeedLimitOverride, showPitAssist } =
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

  const lapDistPct = player.lapTiming?.lap_dist_pct ?? null;
  const pitInPct = trackMap.trackShape?.pitInPct ?? null;
  const pitExitPct = trackMap.trackShape?.pitExitPct ?? null;
  const trackLengthM = sessionInfo?.trackLengthM ?? 0;

  const pitExitData =
    lapDistPct !== null &&
    pitInPct !== null &&
    pitExitPct !== null &&
    trackLengthM > 0
      ? computePitExitData(lapDistPct, pitInPct, pitExitPct, trackLengthM)
      : null;

  return {
    pitState,
    pitLimitMs,
    pitLimitFormatted,
    speed,
    speedKmhOrMph: Math.round(speed * speedFactor),
    limitKmhOrMph: Math.round(pitLimitMs * speedFactor),
    system,
    pitSubLabel,
    distToExitM: pitExitData?.distToExitM ?? null,
    pitLaneProgressPct: pitExitData?.pitLaneProgressPct ?? null,
    showPitAssist,
    isPitLaneRecording,
    throttle: player.carInputs?.throttle ?? 0,
    brake: player.carInputs?.brake ?? 0,
  };
};
