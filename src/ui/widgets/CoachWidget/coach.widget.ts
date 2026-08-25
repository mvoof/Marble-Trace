import { makeAutoObservable, reaction, type IReactionDisposer } from 'mobx';

import { REFERENCE_LAP_BUCKET_COUNT } from '@utils/backend-constants';
import type { RootStore } from '@store/root-store';
import type { ReferenceLapSample, TrackCondition } from '@/types/bindings';
import type { CoachWidgetSettings } from '@/types/widget-settings';
import {
  createTraceWindowBuffers,
  EMPTY_TRACE_STATS,
  fillTraceWindow,
  NO_VALUE,
  type TraceWindowBuffers,
  type TraceWindowStats,
} from './coach-trace-utils';

/**
 * A backwards jump larger than this (in lap fraction) is a teleport — a pit
 * tow, a reset to pits, or a session change — not a finish-line crossing. The
 * buffers are cleared either way; the distinction only matters for not treating
 * a rewind as a completed lap.
 */
const MAX_BACKWARD_STEP_PCT = 0.5;

/**
 * The delta readout is quantized to this step (seconds). The window is rebuilt
 * on every telemetry frame for the canvas, but the text next to it must not
 * re-render observers at 60 Hz for a digit that is not shown.
 */
const WINDOW_DELTA_DISPLAY_STEP_S = 0.01;

/** The braking-point figure is displayed to the metre; anything finer is noise. */
const BRAKE_DELTA_DISPLAY_STEP_M = 1;

/**
 * Owns the lap in progress as a distance-bucketed trace, and the drawn window
 * comparing it against the reference lap the backend recorded.
 *
 * Nothing here is computed from a React render or a MobX computed read: the
 * window is refilled in place on the telemetry frame and the canvas draws
 * straight out of those buffers, the same way the input trace keeps its ring
 * buffer out of the render path. The only observable the canvas subscribes to
 * at frame rate is `frameTick`; the delta text has its own quantized field that
 * changes far less often.
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

  /** Quantized `windowStats.windowDeltaS`, for the call row's readout. */
  displayedWindowDeltaS: number | null = null;

  /**
   * Quantized `windowStats.brakeDeltaM` — how many metres later than the
   * reference this lap got on the brakes. The call row's headline number
   * whenever both braking points are in the window.
   */
  displayedBrakeDeltaM: number | null = null;

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

  private previousDistPct: number | null = null;
  /** Last bucket written this lap, for forward-filling the ones jumped over. */
  private previousBucket: number | null = null;
  private readonly disposers: IReactionDisposer[] = [];

  constructor(private readonly root: RootStore) {
    makeAutoObservable<
      CoachWidgetStore,
      | 'root'
      | 'previousDistPct'
      | 'previousBucket'
      | 'disposers'
      | 'ownSpeedByBucket'
      | 'ownBrakeByBucket'
      | 'window'
      | 'windowStats'
    >(
      this,
      {
        root: false,
        previousDistPct: false,
        previousBucket: false,
        disposers: false,
        ownSpeedByBucket: false,
        ownBrakeByBucket: false,
        window: false,
        windowStats: false,
      },
      { autoBind: true }
    );
  }

  init() {
    this.dispose();

    // Speed arrives at 60 Hz and position at 10 Hz; recording on the speed
    // frame keeps the trace as dense as the bucket grid allows, and repeated
    // writes to one bucket simply keep the latest value for it.
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
    return this.root.widgetSettings.getSettings<CoachWidgetSettings>('coach');
  }

  private recordSample(speed: number | undefined) {
    const lapDistPct = this.root.player.lapTiming?.lap_dist_pct;

    if (speed === undefined || lapDistPct == null || lapDistPct < 0) return;

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

    // Forward-fill the buckets jumped over since the last sample. One bucket is
    // trackLength/1000 metres — on a short track that is about a metre, which a
    // car covers in well under one 60 Hz frame, so at speed whole runs of
    // buckets are never landed on. Left empty they read as missing data and the
    // line is drawn as a series of dashes. The reference lap is forward-filled
    // the same way on the Rust side, for the same reason.
    const previousBucket = this.previousBucket;

    if (previousBucket !== null && bucket > previousBucket + 1) {
      for (let skipped = previousBucket + 1; skipped < bucket; skipped++) {
        this.ownSpeedByBucket[skipped] = speed;
        this.ownBrakeByBucket[skipped] = brake;
      }
    }

    this.ownSpeedByBucket[bucket] = speed;
    this.ownBrakeByBucket[bucket] = brake;
    this.previousBucket = bucket;
    this.previousDistPct = lapDistPct;
  }

  /**
   * Refills the window in place and publishes the one number the text row
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
            currentDistPct,
            trackLengthM: this.trackLengthM,
            windowMeters: this.settings.windowMeters,
          });

    const { windowDeltaS } = this.windowStats;
    const quantized =
      windowDeltaS === null
        ? null
        : Math.round(windowDeltaS / WINDOW_DELTA_DISPLAY_STEP_S) *
          WINDOW_DELTA_DISPLAY_STEP_S;

    if (quantized !== this.displayedWindowDeltaS) {
      this.displayedWindowDeltaS = quantized;
    }

    const { brakeDeltaM } = this.windowStats;
    const quantizedBrakeDeltaM =
      brakeDeltaM === null
        ? null
        : Math.round(brakeDeltaM / BRAKE_DELTA_DISPLAY_STEP_M) *
          BRAKE_DELTA_DISPLAY_STEP_M;

    if (quantizedBrakeDeltaM !== this.displayedBrakeDeltaM) {
      this.displayedBrakeDeltaM = quantizedBrakeDeltaM;
    }

    this.frameTick++;
  }

  private clearBuffers() {
    this.ownSpeedByBucket.fill(NO_VALUE);
    this.ownBrakeByBucket.fill(NO_VALUE);
  }

  /**
   * Writes one bucket of the lap in progress and refills the window from it.
   * For seeded previews (Storybook, the settings preview), which never run
   * `init()` and so have no telemetry frame to record on.
   */
  seedBucket(bucket: number, speed: number, brake: number) {
    if (bucket < 0 || bucket >= REFERENCE_LAP_BUCKET_COUNT) return;

    this.ownSpeedByBucket[bucket] = speed;
    this.ownBrakeByBucket[bucket] = brake;
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
    const lapDistPct = this.root.player.lapTiming?.lap_dist_pct;

    return lapDistPct == null || lapDistPct < 0 ? null : lapDistPct;
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
    this.displayedWindowDeltaS = null;
    this.displayedBrakeDeltaM = null;
    this.frameTick = 0;
  }
}
