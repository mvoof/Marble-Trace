import { action, makeAutoObservable, reaction } from 'mobx';

import type { RendererCore } from '@store/roots/renderer-core';
import type { WidgetInstanceContext } from '@store/widget-runtime/widget-instances.store';
import type {
  CoachCall,
  CoachInactiveReason,
  DrivingAdvisory,
  ReferenceLapSample,
} from '@/types/bindings';
import type { CoachWidgetSettings } from '@/types/widget-settings';
import { interpolateReferenceSample } from './coach-trace-utils';

type DrivingCoachDeps = Pick<
  RendererCore,
  | 'player'
  | 'referenceLap'
  | 'backendComputed'
  | 'liveWidgets'
  | 'startsWidgetStores'
>;

/**
 * How long a new call must hold before it is shown. The telemetry thread
 * latches the call across its zone already; this only swallows a single-frame
 * glitch at a zone boundary.
 */
const ADVISORY_DEBOUNCE_MS = 250;

/** What a coach shows while the telemetry thread is making no call. */
const NEUTRAL_CALL: CoachCall = {
  advisory: 'neutral',
  brakeUrgency: 0,
  exitLateM: null,
  exitThrottleDeficit: 0,
};

/**
 * The coach's call — BRAKE / GAS / GRIP and the countdowns beside it — as the
 * telemetry thread computes it (`computations/coach.rs`). Built per instance
 * (`mount.ts`): each coach reads the variant its own corner-exit setting asks
 * for, and debounces what it shows.
 */
export class DrivingCoachWidgetStore {
  /** The call as shown, once it has held for `ADVISORY_DEBOUNCE_MS`. */
  private settledAdvisory: DrivingAdvisory = 'neutral';
  private pendingAdvisory: DrivingAdvisory | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private reactionDisposers: (() => void)[] = [];

  private readonly root: DrivingCoachDeps;

  private readonly instanceId: string;

  constructor({
    core,
    instanceId,
  }: Pick<WidgetInstanceContext, 'core' | 'instanceId'>) {
    this.root = core;
    this.instanceId = instanceId;

    makeAutoObservable<
      DrivingCoachWidgetStore,
      'root' | 'instanceId' | 'reactionDisposers'
    >(
      this,
      { root: false, instanceId: false, reactionDisposers: false },
      { autoBind: true }
    );

    if (core.startsWidgetStores) {
      this.reactionDisposers.push(
        reaction(
          () => this.call.advisory,
          (advisory) => this.scheduleAdvisoryChange(advisory),
          { fireImmediately: true }
        )
      );
    }
  }

  dispose() {
    this.reactionDisposers.forEach((dispose) => dispose());
    this.reactionDisposers = [];
    this.clearDebounce();
  }

  private get settings(): CoachWidgetSettings {
    return this.root.liveWidgets.getSettings<CoachWidgetSettings>(
      this.instanceId
    );
  }

  /** This coach's call: with the corner-exit calls or without, as it is set. */
  private get call(): CoachCall {
    const frame = this.root.backendComputed.coach;

    if (!frame || frame.inactiveReason !== null) {
      return NEUTRAL_CALL;
    }

    return this.settings.showCornerExitCalls
      ? frame.withExitCalls
      : frame.withoutExitCalls;
  }

  /**
   * The call shown. A core that starts no reactions — a preview — shows the
   * frame it was seeded with as it is.
   */
  get displayedAdvisory(): DrivingAdvisory {
    return this.root.startsWidgetStores
      ? this.settledAdvisory
      : this.call.advisory;
  }

  /** How close the last possible braking point is, 0..1, for pre-arming. */
  get displayedBrakeUrgency(): number {
    return this.call.brakeUrgency;
  }

  /** Metres later than the reference this exit's throttle was opened. */
  get displayedExitLateM(): number | null {
    return this.call.exitLateM;
  }

  /** Pedal missing against the reference inside the current corner exit, 0..1. */
  get displayedExitThrottleDeficit(): number {
    return this.call.exitThrottleDeficit;
  }

  get hasReferenceLap(): boolean {
    return this.root.referenceLap.data !== null;
  }

  /**
   * Why no call is being made, or null while the coach is running. A neutral
   * call alone reads as "on the pace" while the coach is in fact switched off.
   * Before the first frame arrives the reference says whether there is
   * anything to wait for.
   */
  get inactiveReason(): CoachInactiveReason | null {
    const frame = this.root.backendComputed.coach;

    if (frame) {
      return frame.inactiveReason;
    }

    return this.hasReferenceLap ? 'no-telemetry' : 'no-reference';
  }

  /** Metres to the next apex, when one is close enough to count down to. */
  get apexDistanceM(): number | null {
    return this.root.backendComputed.coach?.apexDistanceM ?? null;
  }

  /** Metres to where the reference braked for the next corner. */
  get brakePointDistanceM(): number | null {
    return this.root.backendComputed.coach?.brakePointDistanceM ?? null;
  }

  /** The reference lap interpolated at the player's position — for the readouts. */
  private get referenceSample(): ReferenceLapSample | null {
    const lapDistPct = this.root.player.lapTiming?.lap_dist_pct;
    const data = this.root.referenceLap.data;

    if (!data || lapDistPct == null || lapDistPct < 0) return null;

    return interpolateReferenceSample(data.samples, lapDistPct);
  }

  get currentSpeedMps(): number {
    return this.root.player.carDynamics?.speed ?? 0;
  }

  /** Recorded reference speed (m/s) at the current track position. */
  get referenceSpeedMps(): number | null {
    return this.referenceSample?.speed ?? null;
  }

  /**
   * How much more throttle the reference carries here than this lap, 0..1 —
   * the GAS call's magnitude: the call says open the throttle, this says by
   * how much of the pedal.
   */
  get throttleDeficit(): number {
    const reference = this.referenceSample?.throttle;
    const throttle = this.root.player.carInputs?.throttle;

    if (reference === undefined || throttle === undefined) return 0;

    return Math.min(Math.max(reference - throttle, 0), 1);
  }

  private scheduleAdvisoryChange(advisory: DrivingAdvisory) {
    if (advisory === this.settledAdvisory) {
      this.clearDebounce();

      return;
    }

    if (this.pendingAdvisory === advisory) return;

    this.clearDebounce();
    this.pendingAdvisory = advisory;
    this.debounceTimer = setTimeout(
      action(() => {
        this.settledAdvisory = advisory;
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
}
