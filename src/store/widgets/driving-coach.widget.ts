import { action, makeAutoObservable, reaction } from 'mobx';

import type { RootStore } from '@store/root-store';
import type { ReferenceLapSample } from '@/types/bindings';
import {
  buildTargetSpeedProfile,
  computeDrivingAdvisory,
  extractCornerTargets,
  getAverageTireWear,
  interpolateReferenceSample,
  isConditionMismatch,
  NEUTRAL_ADVISORY_STATE,
  type AdvisoryState,
  type CornerTarget,
  type DrivingAdvisory,
  type DrivingAdvisoryInput,
} from './driving-coach-utils';

/**
 * Debounce entry/exit into a new advisory. With the zone latch in
 * `computeDrivingAdvisory` this no longer carries the anti-flicker load —
 * hysteresis does — it only smooths single-frame glitches at zone boundaries.
 */
const ADVISORY_DEBOUNCE_MS = 250;
/**
 * `lap_dist_pct` arrives at 10 Hz while the advisory evaluates at 60 Hz —
 * between updates the position is extrapolated dead-reckoning style:
 *
 *   pct(t) = pct_0 + v * (t - t_0) / trackLength   (mod 1)
 *
 * capped at this horizon so a stalled feed cannot run the position away.
 */
const MAX_POSITION_EXTRAPOLATION_S = 0.2;
/** Displayed urgency is quantized to this step to avoid re-rendering observers at 60 Hz. */
const URGENCY_DISPLAY_STEP = 0.05;

export class DrivingCoachWidgetStore {
  displayedAdvisory: DrivingAdvisory = 'neutral';
  /** Quantized `brakeUrgency` from the latest advisory evaluation, for pre-arm UI (0..1). */
  displayedBrakeUrgency = 0;

  /**
   * Latched advisory state fed back into `computeDrivingAdvisory` each tick —
   * the transition function needs the previous state to hold an advisory
   * across its whole zone (hysteresis). Not observable: the UI only reacts to
   * the `displayed*` fields.
   */
  private advisoryState: AdvisoryState = NEUTRAL_ADVISORY_STATE;
  /** `performance.now()` of the last observed `lap_dist_pct` change, for extrapolation. */
  private lastDistPctUpdateAt: number | null = null;
  private pendingAdvisory: DrivingAdvisory | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private reactionDisposers: (() => void)[] = [];

  constructor(private readonly root: RootStore) {
    makeAutoObservable<
      DrivingCoachWidgetStore,
      'advisoryState' | 'lastDistPctUpdateAt' | 'reactionDisposers'
    >(
      this,
      {
        advisoryState: false,
        lastDistPctUpdateAt: false,
        reactionDisposers: false,
      },
      { autoBind: true }
    );
  }

  init() {
    this.disposeReactions();

    this.reactionDisposers.push(
      reaction(
        () => this.root.player.lapTiming?.lap_dist_pct,
        () => {
          this.lastDistPctUpdateAt = performance.now();
        }
      )
    );

    this.reactionDisposers.push(
      reaction(
        () => this.advisoryInput,
        (input) => {
          const next = input
            ? computeDrivingAdvisory(
                this.withExtrapolatedPosition(input),
                this.advisoryState
              )
            : NEUTRAL_ADVISORY_STATE;

          this.advisoryState = next;
          this.applyAdvisoryState(next);
        }
      )
    );
  }

  private disposeReactions() {
    this.reactionDisposers.forEach((dispose) => dispose());
    this.reactionDisposers = [];
  }

  /** Whether a best-lap reference has been recorded at all for this track+car. */
  get hasReferenceLap(): boolean {
    return this.root.referenceLap.data !== null;
  }

  /** Best-lap reference sample interpolated at the player's current track position. */
  get referenceSample(): ReferenceLapSample | null {
    const lapDistPct = this.root.player.lapTiming?.lap_dist_pct;
    const data = this.root.referenceLap.data;

    if (!data || lapDistPct == null || lapDistPct < 0) return null;

    return interpolateReferenceSample(data.samples, lapDistPct);
  }

  get currentSpeedMps(): number {
    return this.root.player.carDynamics?.speed ?? 0;
  }

  /** Recorded reference speed (m/s) at the current track position, or null. */
  get referenceSpeedMps(): number | null {
    return this.referenceSample?.speed ?? null;
  }

  /** Current speed minus reference speed (m/s). Positive = faster than reference. */
  get speedDeltaMps(): number | null {
    const reference = this.referenceSpeedMps;
    const speed = this.root.player.carDynamics?.speed;

    if (reference === null || speed === undefined) return null;

    return speed - reference;
  }

  private get cornerTargets(): CornerTarget[] {
    const data = this.root.referenceLap.data;
    const trackLengthM = this.root.session.sessionInfo?.trackLengthM ?? 0;

    if (!data || trackLengthM <= 0) return [];

    return extractCornerTargets(data.samples, trackLengthM);
  }

  /** Physics target-speed profile derived from the reference lap, or null when lateral data is too sparse. */
  private get targetSpeedProfile(): (number | null)[] | null {
    const data = this.root.referenceLap.data;

    if (!data) return null;

    return buildTargetSpeedProfile(data.samples);
  }

  /** Whether current wetness/tire wear/fuel load have diverged too far from the reference lap's recorded conditions to trust the comparison. */
  private get conditionsMismatched(): boolean {
    const data = this.root.referenceLap.data;

    if (!data) return false;

    return isConditionMismatch({
      currentWetness: this.root.environment.environment?.track_wetness ?? null,
      recordedWetness: data.recordedWetness,
      currentTireWear: getAverageTireWear(this.root.player.chassis),
      recordedTireWear: data.recordedTireWear,
      currentFuelLevel: this.root.player.carStatus?.fuel_level ?? null,
      recordedFuelLevel: data.recordedFuelLevel,
    });
  }

  private get advisoryInput(): DrivingAdvisoryInput | null {
    const player = this.root.player;
    const dynamics = player.carDynamics;
    const inputs = player.carInputs;
    const lapDistPct = player.lapTiming?.lap_dist_pct;
    const trackLengthM = this.root.session.sessionInfo?.trackLengthM ?? 0;
    const data = this.root.referenceLap.data;

    if (
      !dynamics ||
      !inputs ||
      !data ||
      lapDistPct == null ||
      lapDistPct < 0 ||
      trackLengthM <= 0
    ) {
      return null;
    }

    if (this.conditionsMismatched) return null;

    const cornerTargets = this.cornerTargets;

    if (cornerTargets.length === 0) return null;

    return {
      currentSpeed: dynamics.speed,
      currentThrottle: inputs.throttle,
      currentBrake: inputs.brake,
      currentDistPct: lapDistPct,
      trackLengthM,
      cornerTargets,
      referenceSamples: data.samples,
      targetSpeedProfile: this.targetSpeedProfile,
      brakeAbsActive: inputs.brake_abs_active,
      currentSteeringWheelAngle: dynamics.steering_wheel_angle,
      currentLatAccel: dynamics.lat_accel ?? null,
      currentLongAccel: dynamics.long_accel ?? null,
    };
  }

  /** Dead-reckon `currentDistPct` forward from the last 10 Hz position update (see `MAX_POSITION_EXTRAPOLATION_S`). */
  private withExtrapolatedPosition(
    input: DrivingAdvisoryInput
  ): DrivingAdvisoryInput {
    if (this.lastDistPctUpdateAt === null) return input;

    const elapsedS = Math.min(
      (performance.now() - this.lastDistPctUpdateAt) / 1000,
      MAX_POSITION_EXTRAPOLATION_S
    );

    if (elapsedS <= 0) return input;

    const traveledPct = (input.currentSpeed * elapsedS) / input.trackLengthM;

    return {
      ...input,
      currentDistPct: (input.currentDistPct + traveledPct) % 1,
    };
  }

  private applyAdvisoryState(state: AdvisoryState) {
    const quantizedUrgency =
      Math.round(state.brakeUrgency / URGENCY_DISPLAY_STEP) *
      URGENCY_DISPLAY_STEP;

    if (quantizedUrgency !== this.displayedBrakeUrgency) {
      this.displayedBrakeUrgency = quantizedUrgency;
    }

    this.scheduleAdvisoryChange(state.advisory);
  }

  private scheduleAdvisoryChange(advisory: DrivingAdvisory) {
    if (advisory === this.displayedAdvisory) {
      this.clearDebounce();
      return;
    }

    if (this.pendingAdvisory === advisory) return;

    this.clearDebounce();
    this.pendingAdvisory = advisory;
    this.debounceTimer = setTimeout(
      action(() => {
        this.displayedAdvisory = advisory;
        this.pendingAdvisory = null;
        this.debounceTimer = null;
      }),
      ADVISORY_DEBOUNCE_MS
    );
  }

  private clearDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.pendingAdvisory = null;
  }

  reset() {
    this.clearDebounce();
    this.advisoryState = NEUTRAL_ADVISORY_STATE;
    this.lastDistPctUpdateAt = null;
    this.displayedAdvisory = 'neutral';
    this.displayedBrakeUrgency = 0;
  }
}
