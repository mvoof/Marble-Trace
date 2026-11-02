import { makeAutoObservable, reaction, type IReactionDisposer } from 'mobx';

import { REFERENCE_LAP_BUCKET_COUNT } from '@shared/contracts/generated/backend-constants';
import type { WidgetInstanceContext } from '@entities/widget/widget-instances.store';
import type {
  ReferenceLapSample,
  TrackCondition,
} from '@shared/contracts/generated/bindings';
import {
  createTraceWindowBuffers,
  EMPTY_TRACE_STATS,
  fillTraceWindow,
  NO_VALUE,
  phaseTime,
  playerLapDistPct,
  type PhaseTime,
  type TraceWindowBuffers,
  type TraceWindowStats,
} from './coach-trace-utils';
import type { BackendComputedStore } from '@entities/cars/computed.store';
import type { PlayerStore } from '@entities/player/player.store';
import type { ReferenceLapStore } from '@entities/player/reference-lap.store';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';
import type { SessionStore } from '@entities/session/session.store';
import type { CoachWidgetSettings } from './settings-schema';

interface CoachDeps {
  player: PlayerStore;
  backendComputed: BackendComputedStore;
  referenceLap: ReferenceLapStore;
  liveWidgets: LiveWidgetsView;
  session: SessionStore;
  readonly startsWidgetStores: boolean;
}

/**
 * A backwards jump larger than this (in lap fraction) is a teleport — a pit
 * tow, a reset to pits, or a session change — not a finish-line crossing. The
 * buffers are cleared either way; the distinction only matters for not treating
 * a rewind as a completed lap.
 */
const MAX_BACKWARD_STEP_PCT = 0.5;

/**
 * Phase times are displayed to the hundredth. The window is rebuilt on every
 * telemetry frame for the canvas, but the text above it must not re-render
 * observers for a digit that is not shown.
 */
const PHASE_TIME_DISPLAY_STEP_S = 0.01;

const quantizeTime = (time: PhaseTime | null): PhaseTime | null =>
  time === null
    ? null
    : {
        kind: time.kind,
        deltaS:
          Math.round(time.deltaS / PHASE_TIME_DISPLAY_STEP_S) *
          PHASE_TIME_DISPLAY_STEP_S,
      };

const sameTime = (left: PhaseTime | null, right: PhaseTime | null): boolean =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.kind === right.kind &&
    left.deltaS === right.deltaS);

/**
 * A phase starting within this of a settled one is the same phase measured
 * again on a later frame, not the next corner's.
 */
const SAME_PHASE_M = 15;

type CornerPhase = 'brake' | 'apex' | 'throttle';

/** The phases in the order a corner is driven through them. */
const CORNER_PHASES: readonly CornerPhase[] = ['brake', 'apex', 'throttle'];

/**
 * A settled phase further behind the car than this, when a new phase starts,
 * belongs to an earlier corner — however long a corner's phases run, they do
 * not stretch this far.
 */
const LAST_CORNER_SPAN_M = 400;

/** A phase time as it settled, and where on the lap its phase starts. */
interface SettledTime {
  startLapM: number;
  time: PhaseTime;
}

const NO_SETTLED_TIMES = (): Record<CornerPhase, SettledTime | null> => ({
  brake: null,
  apex: null,
  throttle: null,
});

/** Distance between two points on a lap, the short way round. */
const lapDistanceBetween = (
  fromM: number,
  toM: number,
  trackLengthM: number
): number => {
  const apart = Math.abs(fromM - toM) % trackLengthM;

  return Math.min(apart, trackLengthM - apart);
};

/**
 * Owns the lap in progress as a distance-bucketed trace, and the drawn window
 * comparing it against the reference lap the backend recorded.
 *
 * Nothing here is computed from a React render or a MobX computed read: the
 * window is refilled in place on the telemetry frame and the canvas draws
 * straight out of those buffers, the same way the input trace keeps its ring
 * buffer out of the render path. The only observable the canvas subscribes to
 * at frame rate is `frameTick`; the phase figures have their own quantized
 * fields that change far less often.
 *
 * The advisory itself (BRAKE / GAS and its urgency) is not duplicated here —
 * it stays owned by `DrivingCoachWidgetStore`.
 */
export class CoachWidgetStore {
  /**
   * Incremented once per telemetry frame that refilled the window. The canvas
   * subscribes to this instead of to the buffers, which are plain typed arrays
   * on purpose: making them observable would cost far more than the redraw.
   */
  frameTick = 0;

  /** Time gained or lost in the reference's braking zone: braking point to release. */
  displayedBrakeTime: PhaseTime | null = null;

  /** Time gained or lost mid-corner: brake release to the throttle opening. */
  displayedApexTime: PhaseTime | null = null;

  /** Time gained or lost on the exit: throttle opening to full throttle. */
  displayedThrottleTime: PhaseTime | null = null;

  /** The drawn window. Refilled in place — never reassigned, never observable. */
  readonly window: TraceWindowBuffers = createTraceWindowBuffers();

  /** Scalars produced alongside the window on the same pass. */
  windowStats: TraceWindowStats = EMPTY_TRACE_STATS;

  private readonly ownSpeedByBucket = new Float32Array(
    REFERENCE_LAP_BUCKET_COUNT
  ).fill(NO_VALUE);
  private readonly ownBrakeByBucket = new Float32Array(
    REFERENCE_LAP_BUCKET_COUNT
  ).fill(NO_VALUE);
  private readonly ownThrottleByBucket = new Float32Array(
    REFERENCE_LAP_BUCKET_COUNT
  ).fill(NO_VALUE);

  private previousDistPct: number | null = null;
  /** Last bucket written this lap, for forward-filling the ones jumped over. */
  private previousBucket: number | null = null;
  /**
   * Each phase's time, kept from the frame it settled until the phase leaves
   * the window. The phase is re-measured on every frame; a time read afresh
   * each time could wander by a hundredth and flicker in the header — and it
   * is a fact about a corner already driven, it has no reason to change.
   */
  private settledTimes = NO_SETTLED_TIMES();
  private readonly disposers: IReactionDisposer[] = [];

  private readonly root: CoachDeps;

  private readonly instanceId: string;

  constructor({
    core,
    instanceId,
  }: Pick<WidgetInstanceContext<CoachDeps>, 'core' | 'instanceId'>) {
    this.root = core;
    this.instanceId = instanceId;

    makeAutoObservable<
      CoachWidgetStore,
      | 'root'
      | 'instanceId'
      | 'previousDistPct'
      | 'previousBucket'
      | 'settledTimes'
      | 'disposers'
      | 'ownSpeedByBucket'
      | 'ownBrakeByBucket'
      | 'ownThrottleByBucket'
      | 'window'
      | 'windowStats'
    >(
      this,
      {
        root: false,
        instanceId: false,
        previousDistPct: false,
        previousBucket: false,
        settledTimes: false,
        disposers: false,
        ownSpeedByBucket: false,
        ownBrakeByBucket: false,
        ownThrottleByBucket: false,
        window: false,
        windowStats: false,
      },
      { autoBind: true }
    );

    if (core.startsWidgetStores) {
      this.start();
    }
  }

  private start() {
    // Speed and the position the coach frame carries both arrive on the overlay
    // clock; recording on the speed frame keeps the trace as dense as the
    // bucket grid allows, and repeated writes to one bucket simply keep the
    // latest value for it.
    this.disposers.push(
      reaction(
        () => this.root.player.carDynamics?.speed,
        (speed) => {
          this.recordSample(speed);
          this.rebuildWindow();
        }
      )
    );

    // A new reference lap changes what the current window is compared against.
    this.disposers.push(
      reaction(
        () => this.root.referenceLap.data,
        () => this.rebuildWindow()
      )
    );

    // Widening or narrowing the window has to repaint even while parked.
    this.disposers.push(
      reaction(
        () => this.settings.windowMeters,
        () => this.rebuildWindow()
      )
    );
  }

  private get settings(): CoachWidgetSettings {
    return this.root.liveWidgets.getSettings<CoachWidgetSettings>(
      this.instanceId
    );
  }

  private recordSample(speed: number | undefined) {
    const lapDistPct = this.currentDistPct;

    if (speed === undefined || lapDistPct === null) return;

    const previous = this.previousDistPct;

    if (previous !== null && lapDistPct < previous) {
      // Crossing the line or being teleported both leave the buffers holding a
      // lap that is no longer the one being driven.
      const wrappedNormally = previous - lapDistPct > MAX_BACKWARD_STEP_PCT;

      this.clearBuffers();
      this.previousBucket = null;

      if (!wrappedNormally) {
        this.previousDistPct = null;
      }
    }

    const bucket = Math.min(
      Math.floor(lapDistPct * REFERENCE_LAP_BUCKET_COUNT),
      REFERENCE_LAP_BUCKET_COUNT - 1
    );
    const brake = this.root.player.carInputs?.brake ?? 0;
    const throttle = this.root.player.carInputs?.throttle ?? 0;

    // Fill the buckets jumped over since the last sample. One bucket is
    // trackLength/1000 metres — on a short track that is about a metre, which a
    // car covers in well under one frame, so at speed whole runs of buckets are
    // never landed on. Left empty they read as missing data and the line is
    // drawn as a series of dashes; filled with the new value alone they read as
    // a flat step. They are filled along the straight line from the previous
    // sample to this one instead.
    const previousBucket = this.previousBucket;

    if (previousBucket !== null && bucket > previousBucket + 1) {
      const fromSpeed = this.ownSpeedByBucket[previousBucket];
      const fromBrake = this.ownBrakeByBucket[previousBucket];
      const fromThrottle = this.ownThrottleByBucket[previousBucket];
      const span = bucket - previousBucket;

      for (let skipped = previousBucket + 1; skipped < bucket; skipped++) {
        const weight = (skipped - previousBucket) / span;

        this.ownSpeedByBucket[skipped] =
          fromSpeed + (speed - fromSpeed) * weight;
        this.ownBrakeByBucket[skipped] =
          fromBrake + (brake - fromBrake) * weight;
        this.ownThrottleByBucket[skipped] =
          fromThrottle + (throttle - fromThrottle) * weight;
      }
    }

    this.ownSpeedByBucket[bucket] = speed;
    this.ownBrakeByBucket[bucket] = brake;
    this.ownThrottleByBucket[bucket] = throttle;
    this.previousBucket = bucket;
    this.previousDistPct = lapDistPct;
  }

  /**
   * Refills the window in place and publishes the figures the call row
   * needs. Called on the telemetry frame, never from a render.
   */
  private rebuildWindow() {
    const currentDistPct = this.currentDistPct;

    this.windowStats =
      currentDistPct === null
        ? EMPTY_TRACE_STATS
        : fillTraceWindow(this.window, {
            referenceSamples: this.referenceSamples,
            ownSpeedByBucket: this.ownSpeedByBucket,
            ownBrakeByBucket: this.ownBrakeByBucket,
            ownThrottleByBucket: this.ownThrottleByBucket,
            currentDistPct,
            trackLengthM: this.trackLengthM,
            windowMeters: this.settings.windowMeters,
          });

    const { reference } = this.windowStats;
    const measured: Record<CornerPhase, PhaseTime | null> = {
      brake: quantizeTime(
        phaseTime(this.window, reference.brakePointM, reference.brakeReleaseM)
      ),
      apex: quantizeTime(
        phaseTime(
          this.window,
          reference.brakeReleaseM,
          reference.throttlePointM
        )
      ),
      throttle: quantizeTime(
        phaseTime(
          this.window,
          reference.throttlePointM,
          reference.fullThrottleM
        )
      ),
    };
    const startsM: Record<CornerPhase, number | null> = {
      brake: reference.brakePointM,
      apex: reference.brakeReleaseM,
      throttle: reference.throttlePointM,
    };

    this.forgetLastCorner(measured);

    const brakeTime = this.settleTime('brake', startsM.brake, measured.brake);
    const apexTime = this.settleTime('apex', startsM.apex, measured.apex);
    const throttleTime = this.settleTime(
      'throttle',
      startsM.throttle,
      measured.throttle
    );

    if (!sameTime(brakeTime, this.displayedBrakeTime)) {
      this.displayedBrakeTime = brakeTime;
    }

    if (!sameTime(apexTime, this.displayedApexTime)) {
      this.displayedApexTime = apexTime;
    }

    if (!sameTime(throttleTime, this.displayedThrottleTime)) {
      this.displayedThrottleTime = throttleTime;
    }

    this.frameTick++;
  }

  /** Where on the lap a point `offsetM` from the car lies, in metres; null without a position. */
  private lapPositionM(offsetM: number): number | null {
    const currentDistPct = this.currentDistPct;
    const trackLengthM = this.trackLengthM;

    if (currentDistPct === null || trackLengthM <= 0) return null;

    const lapPct = (((currentDistPct + offsetM / trackLengthM) % 1) + 1) % 1;

    return lapPct * trackLengthM;
  }

  /**
   * Once a phase is running, the settled times that are not this corner's go:
   * the running phase's own and every one after it — this corner has not
   * reached them yet — and any too far behind the car to be this corner's.
   * Until then the last corner's figures stay up, down the straight after it.
   */
  private forgetLastCorner(measured: Record<CornerPhase, PhaseTime | null>) {
    const runningIndex = CORNER_PHASES.findIndex(
      (phase) => measured[phase]?.kind === 'running'
    );

    if (runningIndex === -1) return;

    const carLapM = this.lapPositionM(0);

    CORNER_PHASES.forEach((phase, index) => {
      const settled = this.settledTimes[phase];

      if (settled === null) return;

      const behindM =
        carLapM === null
          ? 0
          : (((carLapM - settled.startLapM) % this.trackLengthM) +
              this.trackLengthM) %
            this.trackLengthM;

      if (index >= runningIndex || behindM > LAST_CORNER_SPAN_M) {
        this.settledTimes[phase] = null;
      }
    });
  }

  /**
   * The time to show for a phase. A phase once settled keeps the time it
   * settled with — it is re-measured on every frame and would otherwise wander —
   * and stays up after its start leaves the window, until `forgetLastCorner`
   * clears it for the next corner.
   */
  private settleTime(
    phase: CornerPhase,
    startM: number | null,
    time: PhaseTime | null
  ): PhaseTime | null {
    const settled = this.settledTimes[phase];
    const startLapM = startM === null ? null : this.lapPositionM(startM);

    if (time === null || startLapM === null) {
      return settled?.time ?? time;
    }

    if (
      settled !== null &&
      lapDistanceBetween(settled.startLapM, startLapM, this.trackLengthM) <=
        SAME_PHASE_M
    ) {
      return settled.time;
    }

    if (time.kind === 'settled') {
      this.settledTimes[phase] = { startLapM, time };
    }

    return time;
  }

  private clearBuffers() {
    this.ownSpeedByBucket.fill(NO_VALUE);
    this.ownBrakeByBucket.fill(NO_VALUE);
    this.ownThrottleByBucket.fill(NO_VALUE);
    this.settledTimes = NO_SETTLED_TIMES();
  }

  /**
   * Writes one bucket of the lap in progress and refills the window from it.
   * For seeded previews (Storybook, the settings preview), which never run
   * `init()` and so have no telemetry frame to record on.
   */
  seedBucket(bucket: number, speed: number, brake: number, throttle: number) {
    if (bucket < 0 || bucket >= REFERENCE_LAP_BUCKET_COUNT) return;

    this.ownSpeedByBucket[bucket] = speed;
    this.ownBrakeByBucket[bucket] = brake;
    this.ownThrottleByBucket[bucket] = throttle;
  }

  /** Refills the window from whatever the buffers currently hold. For seeded previews. */
  refreshFromSeed() {
    this.rebuildWindow();
  }

  get referenceSamples(): ReferenceLapSample[] | null {
    return this.root.referenceLap.data?.samples ?? null;
  }

  /** Lap time (s) of the stored reference this trace is compared against. */
  get referenceLapTimeS(): number | null {
    return this.root.referenceLap.data?.lapTime ?? null;
  }

  /**
   * Which of the two stored references is loaded. Reads off the file rather
   * than off the current weather, so it says what is actually being compared
   * against — including the case where it rained but no wet lap exists yet.
   */
  get referenceCondition(): TrackCondition | null {
    return this.root.referenceLap.data?.condition ?? null;
  }

  get currentDistPct(): number | null {
    return playerLapDistPct(
      this.root.backendComputed.coach,
      this.root.player.lapTiming
    );
  }

  get trackLengthM(): number {
    return this.root.session.sessionInfo?.trackLengthM ?? 0;
  }

  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;
  }

  reset() {
    this.clearBuffers();
    this.previousDistPct = null;
    this.previousBucket = null;
    this.windowStats = EMPTY_TRACE_STATS;
    this.displayedBrakeTime = null;
    this.displayedApexTime = null;
    this.displayedThrottleTime = null;
    this.frameTick = 0;
  }
}
