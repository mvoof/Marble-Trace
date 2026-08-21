import {
  makeAutoObservable,
  observable,
  reaction,
  runInAction,
  type IReactionDisposer,
} from 'mobx';

import type { RootStore } from '@store/root-store';
import type {
  DiagnosticsHudState,
  DiagnosticsPhase,
} from '@/types/diagnostics';
import {
  closeDiagnosticsHud,
  emitDiagnosticsHudState,
  openDiagnosticsHud,
} from '@platform/services/diagnostics-hud.service';
import { resolveAppLanguage } from '@store/settings/app-settings.store';
import { summarize, type SampleStats } from './stats';

/**
 * Measures what each overlay configuration costs the sim, using the sim's own
 * `frame_rate` / `gpu_usage` / `cpu_usage_fg` counters.
 *
 * Two design points carry the whole thing:
 *
 * 1. Steps are visited **round-robin**, not one long block each. Over a run of
 *    several minutes the GPU heats up and the car moves to a differently
 *    expensive part of the track; measuring each step once in a row would bake
 *    all of that drift into whichever step happened to run last. Cycling and
 *    taking the median across rounds cancels it.
 * 2. The run must happen with the **sim focused**. iRacing throttles its own
 *    frame rate when it loses focus, so a run driven from a focused settings
 *    window would measure the throttle, not the overlay. Hence the countdown
 *    before the first step and the hands-off run afterwards.
 */

export type DiagnosticsStepKind =
  | 'noOverlay'
  | 'hidden'
  | 'allWidgets'
  | 'widget';

export interface DiagnosticsStep {
  id: string;
  kind: DiagnosticsStepKind;
  widgetId?: string;
}

export interface DiagnosticsResult {
  step: DiagnosticsStep;
  frameRate: SampleStats | null;
  gpuUsage: SampleStats | null;
  cpuUsage: SampleStats | null;
}

export type { DiagnosticsPhase };

/** Seconds the user gets to switch to the sim before the first step applies. */
const COUNTDOWN_SECONDS = 8;

/**
 * Seconds between applying a configuration and trusting its numbers. Covers
 * window creation, the first paints and — crucially — the one-second window
 * iRacing averages its counters over, which still contains the old config
 * immediately after a switch.
 */
const SETTLE_SECONDS = 5;

/** Seconds of samples per cell. The counters arrive at 1 Hz, so this is also the sample count. */
const SAMPLE_SECONDS = 12;

/** How many times the full ladder is walked. */
const ROUNDS = 4;

/** Consecutive settle+sample seconds without a single counter before giving up. */
const STALL_LIMIT_SECONDS = (SETTLE_SECONDS + SAMPLE_SECONDS) * 2;

/**
 * iRacing documents `GpuUsage` and `CpuUsageFG` as percentages but reports them
 * as fractions — a machine at 61% load sends 0.61. Verified against a live
 * session; the table would otherwise read "1%" for everything.
 */
const LOAD_FRACTION_TO_PERCENT = 100;

/**
 * How long the banner stays up after the run ends. The user is still in the
 * sim when the last step finishes, and a banner that vanished instantly would
 * leave them with no idea whether the run completed or died.
 */
const HUD_LINGER_SECONDS = 25;

const SECOND_MS = 1000;

interface ConfigSnapshot {
  enabledWidgetIds: string[];
  hideAllWidgets: boolean;
}

export class FpsDiagnosticsStore {
  phase: DiagnosticsPhase = 'idle';
  detailed = false;
  secondsLeft = 0;
  currentRound = 0;
  currentStepIndex = 0;
  steps: DiagnosticsStep[] = [];
  results: DiagnosticsResult[] = [];
  error: string | null = null;

  private root: RootStore;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private perfDisposer: IReactionDisposer | null = null;
  private restoreTo: ConfigSnapshot | null = null;
  private samples = new Map<
    string,
    { fps: number[]; gpu: number[]; cpu: number[] }
  >();
  private collecting = false;
  private secondsWithoutCounter = 0;
  private hudDisposer: IReactionDisposer | null = null;
  private hudCloseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: RootStore) {
    this.root = root;

    makeAutoObservable(
      this,
      { steps: observable.ref, results: observable.ref },
      { autoBind: true }
    );
  }

  /**
   * The ladder as it would run right now. Read before a run to size the
   * estimate and after one to label the rows, so the button never promises a
   * duration for a different set of steps than the one it will walk.
   */
  get plannedSteps(): DiagnosticsStep[] {
    return this.buildSteps(this.root.widgetSettings.enabledWidgetIds);
  }

  get isRunning(): boolean {
    return (
      this.phase === 'countdown' ||
      this.phase === 'settling' ||
      this.phase === 'sampling'
    );
  }

  /** Total steps across every round, used to render progress. */
  get totalSteps(): number {
    const ladder = this.isRunning ? this.steps : this.plannedSteps;

    return ladder.length * ROUNDS;
  }

  get completedSteps(): number {
    return this.currentRound * this.steps.length + this.currentStepIndex;
  }

  /**
   * The cost of the full widget set against the empty-overlay baseline — the
   * one number worth putting in front of someone who is still driving.
   */
  get summaryDeltaFps(): number | null {
    const baseline = this.results.find(
      (entry) => entry.step.kind === 'noOverlay'
    );
    const loaded = this.results.find(
      (entry) => entry.step.kind === 'allWidgets'
    );

    if (!baseline?.frameRate || !loaded?.frameRate) {
      return null;
    }

    return loaded.frameRate.median - baseline.frameRate.median;
  }

  get hudState(): DiagnosticsHudState {
    return {
      phase: this.phase,
      secondsLeft: this.secondsLeft,
      completedSteps: this.completedSteps,
      totalSteps: this.totalSteps,
      summaryDeltaFps: this.summaryDeltaFps,
      error: this.error,
      language: resolveAppLanguage(this.root.appSettings.appSettings.language),
    };
  }

  get estimatedSeconds(): number {
    return (
      this.totalSteps * (SETTLE_SECONDS + SAMPLE_SECONDS) + COUNTDOWN_SECONDS
    );
  }

  setDetailed(value: boolean) {
    this.detailed = value;
  }

  start() {
    if (this.isRunning) {
      return;
    }

    const enabledWidgetIds = this.root.widgetSettings.enabledWidgetIds;

    if (enabledWidgetIds.length === 0) {
      this.phase = 'failed';
      this.error = 'noWidgets';

      return;
    }

    this.restoreTo = {
      enabledWidgetIds,
      hideAllWidgets: this.root.appSettings.appSettings.hideAllWidgets,
    };

    this.steps = this.plannedSteps;
    this.results = [];
    this.samples.clear();
    this.error = null;
    this.currentRound = 0;
    this.currentStepIndex = 0;
    this.secondsWithoutCounter = 0;

    this.clearHudCloseTimer();
    this.watchCounters();
    this.watchHud();

    void openDiagnosticsHud();

    this.runCountdown();
  }

  cancel() {
    if (!this.isRunning) {
      return;
    }

    this.finish('idle');
  }

  dispose() {
    if (this.isRunning) {
      this.finish('idle');
    }

    this.clearHudCloseTimer();
    this.hudDisposer?.();
    this.hudDisposer = null;
  }

  private buildSteps(enabledWidgetIds: string[]): DiagnosticsStep[] {
    const steps: DiagnosticsStep[] = [
      { id: 'noOverlay', kind: 'noOverlay' },
      { id: 'hidden', kind: 'hidden' },
      { id: 'allWidgets', kind: 'allWidgets' },
    ];

    if (this.detailed) {
      for (const widgetId of enabledWidgetIds) {
        steps.push({ id: `widget:${widgetId}`, kind: 'widget', widgetId });
      }
    }

    return steps;
  }

  /**
   * Collects every 1 Hz counter while a cell is sampling, and doubles as the
   * stall detector: a run started with the sim closed would otherwise sit in
   * `sampling` forever producing empty cells.
   */
  private watchCounters() {
    this.perfDisposer?.();

    this.perfDisposer = reaction(
      () => this.root.simPerf.simPerf,
      (frame) => {
        if (!frame) {
          return;
        }

        this.secondsWithoutCounter = 0;

        if (!this.collecting) {
          return;
        }

        const bucket = this.samples.get(this.currentStepId());

        if (!bucket) {
          return;
        }

        if (frame.frameRate !== null) {
          bucket.fps.push(frame.frameRate);
        }

        if (frame.gpuUsage !== null) {
          bucket.gpu.push(frame.gpuUsage * LOAD_FRACTION_TO_PERCENT);
        }

        if (frame.cpuUsageFg !== null) {
          bucket.cpu.push(frame.cpuUsageFg * LOAD_FRACTION_TO_PERCENT);
        }
      }
    );
  }

  /**
   * Mirrors the run state to the banner window. Kept as a reaction rather than
   * a call at every transition so no future branch can forget to publish and
   * leave the banner frozen on a stale step.
   */
  private watchHud() {
    this.hudDisposer?.();

    this.hudDisposer = reaction(
      () => this.hudState,
      (state) => {
        if (state.phase === 'idle') {
          return;
        }

        void emitDiagnosticsHudState(state);
      },
      { fireImmediately: true }
    );
  }

  private currentStepId(): string {
    return this.steps[this.currentStepIndex]?.id ?? '';
  }

  private runCountdown() {
    this.phase = 'countdown';
    this.secondsLeft = COUNTDOWN_SECONDS;

    this.tickDown(() => this.beginStep());
  }

  private beginStep() {
    const step = this.steps[this.currentStepIndex];

    if (!step) {
      this.completeRound();

      return;
    }

    this.applyStep(step);

    if (!this.samples.has(step.id)) {
      this.samples.set(step.id, { fps: [], gpu: [], cpu: [] });
    }

    this.phase = 'settling';
    this.secondsLeft = SETTLE_SECONDS;
    this.collecting = false;

    this.tickDown(() => {
      runInAction(() => {
        this.phase = 'sampling';
        this.secondsLeft = SAMPLE_SECONDS;
        this.collecting = true;
      });

      this.tickDown(() => {
        runInAction(() => {
          this.collecting = false;
          this.currentStepIndex += 1;
        });

        this.beginStep();
      });
    });
  }

  private completeRound() {
    this.currentRound += 1;
    this.currentStepIndex = 0;

    if (this.currentRound < ROUNDS) {
      this.beginStep();

      return;
    }

    this.collectResults();
    this.finish('done');
  }

  private collectResults() {
    this.results = this.steps.map((step) => {
      const bucket = this.samples.get(step.id);

      return {
        step,
        frameRate: summarize(bucket?.fps ?? []),
        gpuUsage: summarize(bucket?.gpu ?? []),
        cpuUsage: summarize(bucket?.cpu ?? []),
      };
    });
  }

  private applyStep(step: DiagnosticsStep) {
    const settings = this.root.widgetSettings;
    const original = this.restoreTo?.enabledWidgetIds ?? [];

    this.root.appSettings.setHideAllWidgets(step.kind === 'hidden');

    for (const widgetId of original) {
      const enabled =
        step.kind === 'widget'
          ? widgetId === step.widgetId
          : step.kind !== 'noOverlay';

      settings.setWidgetEnabled(widgetId, enabled);
    }
  }

  private restoreConfig() {
    const snapshot = this.restoreTo;

    if (!snapshot) {
      return;
    }

    for (const widgetId of snapshot.enabledWidgetIds) {
      this.root.widgetSettings.setWidgetEnabled(widgetId, true);
    }

    this.root.appSettings.setHideAllWidgets(snapshot.hideAllWidgets);
    this.restoreTo = null;
  }

  /**
   * Counts down `secondsLeft` one second at a time rather than sleeping the
   * whole span: the UI needs the number, and it is also where a sim that went
   * away mid-run is noticed.
   */
  private tickDown(onZero: () => void) {
    this.clearTimer();

    this.timer = setTimeout(() => {
      runInAction(() => {
        this.secondsLeft -= 1;

        if (this.phase !== 'countdown') {
          this.secondsWithoutCounter += 1;
        }
      });

      if (this.secondsWithoutCounter > STALL_LIMIT_SECONDS) {
        runInAction(() => {
          this.error = 'noTelemetry';
          this.finish('failed');
        });

        return;
      }

      if (this.secondsLeft > 0) {
        this.tickDown(onZero);

        return;
      }

      runInAction(onZero);
    }, SECOND_MS);
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private finish(phase: DiagnosticsPhase) {
    this.clearTimer();
    this.perfDisposer?.();
    this.perfDisposer = null;
    this.collecting = false;

    this.restoreConfig();

    this.phase = phase;
    this.secondsLeft = 0;

    this.closeHud(phase);
  }

  /**
   * A cancelled run takes the banner down at once — the user is back at the
   * settings window and already knows. A finished one leaves it up, because
   * that is the only place the result reaches someone still driving.
   */
  private closeHud(phase: DiagnosticsPhase) {
    const linger = phase === 'idle' ? 0 : HUD_LINGER_SECONDS * SECOND_MS;

    this.clearHudCloseTimer();

    this.hudCloseTimer = setTimeout(() => {
      this.hudDisposer?.();
      this.hudDisposer = null;

      void closeDiagnosticsHud();
    }, linger);
  }

  private clearHudCloseTimer() {
    if (this.hudCloseTimer !== null) {
      clearTimeout(this.hudCloseTimer);
      this.hudCloseTimer = null;
    }
  }
}
