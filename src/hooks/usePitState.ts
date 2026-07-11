import {
  usePlayerStore,
  useSessionStore,
  useTrackMapWidgetStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type {
  PitBoxSide,
  RaceDashWidgetSettings,
} from '@/types/widget-settings';
import {
  formatSpeed,
  MPS_TO_KMH,
  MPS_TO_MPH,
  speedUnit,
} from '@utils/formatters/telemetry-format';
import { parsePitSpeedLimitMs } from '@utils/widget/speed-utils';

export type PitState =
  | 'normal'
  | 'pit-lane'
  | 'limiter-active'
  | 'limiter-near-exit'
  | 'limiter-exit'
  | 'over-limit';

export const PIT_LIMITER_BIT = 0x10;

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
  /** Whether the distance counts down to pitbox or pitExit. */
  distMode: 'pitbox' | 'pitExit' | null;
  /** The distance value in meters to the current target (pitbox or pitexit). */
  distM: number | null;
  /** Progress through pit lane 0..1. null = not calibrated. */
  pitLaneProgressPct: number | null;
  /** Total pit lane length in meters. null = not calibrated. */
  pitLaneLengthM: number | null;
  /** Pitbox position as fraction of pit lane 0..1. null = not calibrated. */
  pitboxLanePct: number | null;
  /** pit_in_pct recorded but pit_exit_pct not yet — actively traversing pit lane for calibration. */
  isPitLaneRecording: boolean;
  showPitAssist: boolean;
  pitBoxSide: PitBoxSide;
  boxCueDistM: number;
  nearLimitDelta: number;
  throttle: number;
  brake: number;
}

export const usePitState = (): PitStateResult => {
  const player = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();
  const trackMap = useTrackMapWidgetStore();
  const isPitLaneRecording = trackMap.isPitLaneRecording;

  const {
    pitSpeedLimitOverride,
    showPitAssist,
    pitBoxSide,
    boxCueDistM,
    nearLimitDelta,
  } = widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');
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

    if (pitLimitMs > 0 && speed > pitLimitMs + 1 / speedFactor) {
      return 'over-limit';
    }

    if (isLimiter) {
      if (!onPitRoad) return 'limiter-exit';

      const nearExit =
        player.pitLaneProgressPct !== null && player.pitLaneProgressPct >= 0.75;

      return nearExit ? 'limiter-near-exit' : 'limiter-active';
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

  const trackLengthM = sessionInfo?.trackLengthM ?? 0;
  const pitInPct = trackMap.trackShape?.pitInPct ?? null;
  const pitExitPct = trackMap.trackShape?.pitExitPct ?? null;
  const pitboxPct = sessionInfo?.driverPitTrkPct ?? null;

  const pitLaneLengthM = (() => {
    if (pitInPct === null || pitExitPct === null || trackLengthM <= 0)
      return null;

    return ((pitExitPct - pitInPct + 1) % 1) * trackLengthM;
  })();

  const pitboxLanePct = (() => {
    if (pitInPct === null || pitExitPct === null || pitboxPct === null)
      return null;

    const laneLengthPct = (pitExitPct - pitInPct + 1) % 1;

    if (laneLengthPct <= 0) return null;

    return Math.min(
      Math.max(((pitboxPct - pitInPct + 1) % 1) / laneLengthPct, 0),
      1
    );
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
    distToExitM:
      player.pitTargetType === 'pitExit' ? player.pitTargetDistM : null,
    distMode: player.pitTargetType,
    distM: player.pitTargetDistM,
    pitLaneProgressPct: player.pitLaneProgressPct,
    pitLaneLengthM,
    pitboxLanePct,
    showPitAssist,
    pitBoxSide,
    boxCueDistM,
    nearLimitDelta,
    isPitLaneRecording,
    throttle: player.carInputs?.throttle ?? 0,
    brake: player.carInputs?.brake ?? 0,
  };
};
