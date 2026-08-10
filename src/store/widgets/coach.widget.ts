import { makeAutoObservable, reaction, type IReactionDisposer } from 'mobx';

import type { RootStore } from '@store/root-store';
import type { ReferenceLapSample } from '@/types/bindings';
import type { CoachWidgetSettings } from '@/types/widget-settings';
import {
  buildTraceWindow,
  UNRECORDED_SPEED,
  type TraceWindow,
} from './coach-trace-utils';

/**
 * Buckets the lap in progress is recorded into. Must match the reference lap's
 * own resolution (`REFERENCE_LAP_BUCKET_COUNT` on the Rust side) so both traces
 * are sampled on the same grid.
 */
const LAP_BUCKET_COUNT = 1000;

/**
 * A backwards jump larger than this (in lap fraction) is a teleport — a pit
 * tow, a reset to pits, or a session change — not a finish-line crossing. The
 * buffer is cleared either way; the distinction only matters for not treating
 * a rewind as a completed lap.
 */
const MAX_BACKWARD_STEP_PCT = 0.5;

/**
 * The window delta is displayed quantized to this step (seconds). The trace
 * itself is rebuilt per telemetry frame; the text next to it must not re-render
 * observers at 60 Hz for a digit that is not shown.
 */
const WINDOW_DELTA_DISPLAY_STEP_S = 0.01;

/**
 * Owns the lap in progress as a distance-bucketed speed trace, so it can be
 * compared against the reference lap the backend recorded.
 *
 * The advisory itself (BRAKE / GAS and its urgency) is not duplicated here —
 * it stays owned by `DrivingCoachWidgetStore`, and this store only adds the
 * trace the widget draws underneath it.
 */
export class CoachWidgetStore {
  /**
   * Incremented once per telemetry frame that wrote a sample. The trace canvas
   * subscribes to this instead of to the buffer itself, which is a plain typed
   * array on purpose: making 1000 floats observable would cost far more than
   * the redraw it triggers.
   */
  frameTick = 0;

  /** Speed (m/s) per lap-distance bucket for the lap in progress. */
  readonly ownSpeedByBucket = new Float32Array(LAP_BUCKET_COUNT).fill(
    UNRECORDED_SPEED
  );

  private previousDistPct: number | null = null;
  private readonly disposers: IReactionDisposer[] = [];

  constructor(private readonly root: RootStore) {
    makeAutoObservable<
      CoachWidgetStore,
      'root' | 'previousDistPct' | 'disposers' | 'ownSpeedByBucket'
    >(
      this,
      {
        root: false,
        previousDistPct: false,
        disposers: false,
        ownSpeedByBucket: false,
      },
      { autoBind: true }
    );
  }

  init() {
    this.dispose();

    // Speed arrives at 60 Hz and position at 10 Hz; recording on the speed
    // frame keeps the trace as dense as the bucket grid allows, and repeated
    // writes to one bucket simply keep the latest speed for it.
    this.disposers.push(
      reaction(
        () => this.root.player.carDynamics?.speed,
        (speed) => this.recordSample(speed),
        { fireImmediately: false }
      )
    );

    // A new reference lap invalidates the comparison the current window shows,
    // but not the lap being driven — only the delta is rebuilt, from the next
    // frame onwards.
    this.disposers.push(
      reaction(
        () => this.root.referenceLap.data,
        () => {
          this.frameTick++;
        }
      )
    );
  }

  private recordSample(speed: number | undefined) {
    const lapDistPct = this.root.player.lapTiming?.lap_dist_pct;

    if (speed === undefined || lapDistPct == null || lapDistPct < 0) return;

    const previous = this.previousDistPct;

    if (previous !== null && lapDistPct < previous) {
      // Crossing the line or being teleported both leave the buffer holding a
      // lap that is no longer the one being driven.
      const wrappedNormally = previous - lapDistPct > MAX_BACKWARD_STEP_PCT;

      this.clearBuffer();

      if (!wrappedNormally) {
        this.previousDistPct = null;
      }
    }

    const bucket = Math.min(
      Math.floor(lapDistPct * LAP_BUCKET_COUNT),
      LAP_BUCKET_COUNT - 1
    );

    this.ownSpeedByBucket[bucket] = speed;
    this.previousDistPct = lapDistPct;
    this.frameTick++;
  }

  private clearBuffer() {
    this.ownSpeedByBucket.fill(UNRECORDED_SPEED);
  }

  /** Whether a best-lap reference has been recorded for this track+car. */
  get hasReferenceLap(): boolean {
    return this.root.referenceLap.data !== null;
  }

  get referenceSamples(): ReferenceLapSample[] | null {
    return this.root.referenceLap.data?.samples ?? null;
  }

  /** Lap time (s) of the stored reference this trace is compared against. */
  get referenceLapTimeS(): number | null {
    return this.root.referenceLap.data?.lapTime ?? null;
  }

  get currentDistPct(): number | null {
    const lapDistPct = this.root.player.lapTiming?.lap_dist_pct;

    return lapDistPct == null || lapDistPct < 0 ? null : lapDistPct;
  }

  get trackLengthM(): number {
    return this.root.session.sessionInfo?.trackLengthM ?? 0;
  }

  /**
   * The drawn window, rebuilt whenever a sample lands. Owned here rather than
   * in the canvas so the call row's readout and the line's coloring are the
   * same numbers, not two independent computations of them.
   */
  get traceWindow(): TraceWindow {
    const { windowMeters } =
      this.root.widgetSettings.getSettings<CoachWidgetSettings>('coach');

    const currentDistPct = this.currentDistPct;
    // Reading the tick is also what subscribes this getter to the buffer: the
    // buffer is a plain typed array and cannot be observed on its own.
    const hasSamples = this.frameTick > 0;

    if (currentDistPct === null || !hasSamples) {
      return { points: [], windowDeltaS: null };
    }

    return buildTraceWindow({
      referenceSamples: this.referenceSamples,
      ownSpeedByBucket: this.ownSpeedByBucket,
      currentDistPct,
      trackLengthM: this.trackLengthM,
      windowMeters,
    });
  }

  /**
   * `traceWindow.windowDeltaS` for the text readout, quantized: the window is
   * rebuilt per telemetry frame, and a computed that only changes when the
   * displayed digits do keeps the row from re-rendering at 60 Hz.
   */
  get displayedWindowDeltaS(): number | null {
    const windowDeltaS = this.traceWindow.windowDeltaS;

    return windowDeltaS === null
      ? null
      : Math.round(windowDeltaS / WINDOW_DELTA_DISPLAY_STEP_S) *
          WINDOW_DELTA_DISPLAY_STEP_S;
  }

  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;
  }

  reset() {
    this.clearBuffer();
    this.previousDistPct = null;
    this.frameTick = 0;
  }
}
