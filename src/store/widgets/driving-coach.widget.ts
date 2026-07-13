import { action, makeAutoObservable, reaction } from 'mobx';

import type { RootStore } from '@store/root-store';
import type { ReferenceLapSample } from '@/types/bindings';
import {
  computeDrivingAdvisory,
  extractCornerTargets,
  getAverageTireWear,
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

export class DrivingCoachWidgetStore {
  displayedAdvisory: DrivingAdvisory = 'neutral';

  /**
   * Latched advisory state fed back into `computeDrivingAdvisory` each tick —
   * the transition function needs the previous state to hold an advisory
   * across its whole zone (hysteresis). Not observable: the UI only reacts to
   * `displayedAdvisory`.
   */
  private advisoryState: AdvisoryState = NEUTRAL_ADVISORY_STATE;
  private pendingAdvisory: DrivingAdvisory | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly root: RootStore) {
    makeAutoObservable<DrivingCoachWidgetStore, 'advisoryState'>(
      this,
      { advisoryState: false },
      { autoBind: true }
    );
  }

  init() {
    reaction(
      () => this.advisoryInput,
      (input) => {
        const next = input
          ? computeDrivingAdvisory(input, this.advisoryState)
          : NEUTRAL_ADVISORY_STATE;

        this.advisoryState = next;
        this.scheduleAdvisoryChange(next.advisory);
      }
    );
  }

  /** Whether a best-lap reference has been recorded at all for this track+car. */
  get hasReferenceLap(): boolean {
    return this.root.referenceLap.data !== null;
  }

  /** Best-lap reference sample interpolated at the player's current track position. */
  get referenceSample(): ReferenceLapSample | null {
    const lapDistPct = this.root.player.lapTiming?.lap_dist_pct;

    if (lapDistPct == null || lapDistPct < 0) return null;

    return this.root.referenceLap.getInterpolatedSampleAtDistPct(lapDistPct);
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

    if (
      !dynamics ||
      !inputs ||
      lapDistPct == null ||
      lapDistPct < 0 ||
      trackLengthM <= 0
    ) {
      return null;
    }

    if (this.conditionsMismatched) return null;

    const cornerTargets = this.cornerTargets;

    if (cornerTargets.length === 0) return null;

    const referenceSample =
      this.root.referenceLap.getInterpolatedSampleAtDistPct(lapDistPct);

    return {
      currentSpeed: dynamics.speed,
      currentThrottle: inputs.throttle,
      currentDistPct: lapDistPct,
      trackLengthM,
      cornerTargets,
      referenceSpeedAtCurrent: referenceSample?.speed ?? null,
      referenceThrottleAtCurrent: referenceSample?.throttle ?? null,
      brakeAbsActive: inputs.brake_abs_active,
      currentSteeringWheelAngle: dynamics.steering_wheel_angle,
      referenceSteeringWheelAngleAtCurrent:
        referenceSample?.steeringWheelAngle ?? null,
      currentLatAccel: dynamics.lat_accel ?? null,
      referenceLatAccelAtCurrent: referenceSample?.latAccel ?? null,
    };
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
    this.displayedAdvisory = 'neutral';
  }
}
