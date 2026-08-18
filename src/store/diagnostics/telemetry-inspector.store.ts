import { makeAutoObservable, runInAction } from 'mobx';

import {
  getInspectorFrame,
  setInspectorActive,
} from '@platform/services/telemetry.service';
import type { RootStore } from '@store/root-store';
import type { SourceFrame } from '@/types/bindings';
import type { InspectorRow, InspectorSource } from '@/types/inspector';
import { ARRAY_PAGE, buildRows, countAbsent } from './inspector-tree';

/**
 * The telemetry inspector's data feed and view state.
 *
 * **This store never subscribes to a telemetry event, and must not start.** The
 * settings window was deliberately taken off the 60 Hz bundle; an inspector that
 * listened for it would hand that cost straight back and quietly undo the work.
 * It pulls one frame at a time instead, only while its panel is on screen, and
 * the backend keeps nothing at all while the feed is closed.
 *
 * The poll rate is not a compromise: nobody can read a table of a hundred
 * numbers sixty times a second, so 4 Hz is already past the point of diminishing
 * returns for a human reading values.
 */
const POLL_INTERVAL_MS = 250;
/**
 * How many polls a one-shot capture waits for the first frame. The backend fills
 * one on its next 4 Hz tick, so this is about a second — long enough to cover a
 * tick boundary, short enough that a disconnected sim answers quickly.
 */
const CAPTURE_ATTEMPTS = 4;

export class TelemetryInspectorStore {
  frame: SourceFrame | null = null;
  /** The feed is open — the backend is filling frames for us. */
  running = false;
  source: InspectorSource = 'telemetry';
  /** Substring match over the field name, case-insensitive. */
  filter = '';
  /** Hide fields the sim is not reporting in this session. */
  hideAbsent = false;
  /** Set when a poll throws, so the panel can say so instead of looking idle. */
  lastError: string | null = null;

  private expanded = new Set<string>();
  /** Per-array entry cap, raised by "show all" on that row. */
  private arrayLimits = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly root: RootStore) {
    makeAutoObservable<this, 'root'>(this, { root: false }, { autoBind: true });
  }

  setFilter(value: string) {
    this.filter = value;
  }

  setHideAbsent(value: boolean) {
    this.hideAbsent = value;
  }

  /**
   * Switching to the session stops the telemetry feed outright: the session
   * snapshot arrives on `sim://session`, which this window already receives, so
   * keeping the backend filling frames nobody is reading would be exactly the
   * waste this design exists to avoid.
   */
  async setSource(value: InspectorSource) {
    if (value === this.source) {
      return;
    }

    runInAction(() => {
      this.source = value;
      this.expanded.clear();
      this.arrayLimits.clear();
    });

    if (value === 'session') {
      await this.stop();

      return;
    }

    await this.start();
  }

  toggleExpanded(path: string) {
    if (this.expanded.has(path)) {
      this.expanded.delete(path);
    } else {
      this.expanded.add(path);
    }
  }

  /** Lifts the cap on one array so the rest of its entries are built too. */
  showAllEntries(path: string, length: number) {
    this.arrayLimits.set(path, length);
  }

  entryLimit(path: string): number {
    return this.arrayLimits.get(path) ?? ARRAY_PAGE;
  }

  /** What the rows are built from — the pulled frame, or the session snapshot. */
  get sourceObject(): Record<string, unknown> | null {
    if (this.source === 'session') {
      return (this.root.session.sessionInfo ?? null) as Record<
        string,
        unknown
      > | null;
    }

    return this.frame as Record<string, unknown> | null;
  }

  get rows(): InspectorRow[] {
    return buildRows(this.sourceObject, {
      expanded: this.expanded,
      filter: this.filter.trim().toLowerCase(),
      hideAbsent: this.hideAbsent,
      arrayLimits: this.arrayLimits,
    });
  }

  /** How many fields the sim is not reporting at all. */
  get absentCount(): number {
    return countAbsent(this.sourceObject);
  }

  get isEmpty(): boolean {
    return this.sourceObject === null;
  }

  async start() {
    if (this.running || this.source === 'session') {
      return;
    }

    runInAction(() => {
      this.running = true;
      this.lastError = null;
    });

    try {
      await setInspectorActive(true);
    } catch (error) {
      runInAction(() => {
        this.running = false;
        this.lastError = String(error);
      });

      return;
    }

    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  /**
   * Closes the feed. Safe to call when it was never opened — the panel calls it
   * from an effect cleanup, which also runs on an unmount that never started.
   */
  async stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (!this.running) {
      return;
    }

    runInAction(() => {
      this.running = false;
      this.frame = null;
    });

    await setInspectorActive(false).catch((error: unknown) =>
      console.error('[telemetry-inspector] failed to close the feed:', error)
    );
  }

  /**
   * One frame for the snapshot export, without leaving the feed open.
   *
   * When the panel is already showing telemetry, the frame it has is used as it
   * is. Otherwise the feed is opened just long enough for the backend's next
   * 4 Hz tick to fill one, and closed again — so the export costs nothing beyond
   * the moment the user pressed the button.
   */
  async captureOnce(): Promise<SourceFrame | null> {
    if (this.running) {
      return this.frame;
    }

    const wasSession = this.source === 'session';

    if (wasSession) {
      runInAction(() => {
        this.source = 'telemetry';
      });
    }

    await this.start();

    if (!this.running) {
      return null;
    }

    try {
      return await this.awaitFrame();
    } finally {
      await this.stop();

      if (wasSession) {
        runInAction(() => {
          this.source = 'session';
        });
      }
    }
  }

  /** Polls until a frame arrives or the sim is clearly not there. */
  private async awaitFrame(): Promise<SourceFrame | null> {
    for (let attempt = 0; attempt < CAPTURE_ATTEMPTS; attempt += 1) {
      const frame = await getInspectorFrame();

      if (frame) {
        return frame;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    return null;
  }

  private async poll() {
    try {
      const frame = await getInspectorFrame();

      runInAction(() => {
        this.frame = frame;
        this.lastError = null;
      });
    } catch (error) {
      runInAction(() => {
        this.lastError = String(error);
      });
    }
  }
}
