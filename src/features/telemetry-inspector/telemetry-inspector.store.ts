import { makeAutoObservable, reaction, runInAction } from 'mobx';
import type { IReactionDisposer } from 'mobx';

import {
  getDeliveryCounters,
  getInspectorFrame,
  getInspectorRawValues,
  getRawSession,
  getRawVarMeta,
  resetDeliveryCounters,
  setInspectorActive,
} from '@shared/api/telemetry.service';
import type {
  DeliverySet,
  RawSession,
  RawValue,
  RawVarMeta,
  SourceFrame,
} from '@shared/contracts/bindings';
import type {
  DeliveryFieldRow,
  DeliveryRow,
  InspectorCapture,
  InspectorRow,
  InspectorSource,
  RawSessionLine,
  RawSessionView,
  RowAnnotation,
} from '@features/telemetry-inspector/inspector';
import { ARRAY_PAGE, buildRows, countAbsent } from './inspector-tree';
import type { SessionStore } from '@entities/session/session.store';

interface TelemetryInspectorDeps {
  session: SessionStore;
}

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
const MS_PER_SECOND = 1000;

/**
 * Bundles per second over the span the counters cover. A span of zero has
 * measured nothing yet — the first poll after a reset — and has no rate to
 * report rather than an infinite one.
 */
const ratePerSecond = (count: number, elapsedMs: number): number => {
  if (elapsedMs <= 0) {
    return 0;
  }

  return (count * MS_PER_SECOND) / elapsedMs;
};

/** The two sources the backend fills on its 4 Hz tick; the others are pulled once. */
const isFeedSource = (source: InspectorSource): boolean =>
  source === 'rawTelemetry' || source === 'telemetry';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export class TelemetryInspectorStore {
  frame: SourceFrame | null = null;
  /** Every variable under the sim's names, pulled with `frame`. */
  rawValues: Partial<Record<string, RawValue>> | null = null;
  /** The sim's variable list; read once per connection. */
  rawVarMeta: RawVarMeta[] = [];
  rawSession: RawSession | null = null;
  rawSessionView: RawSessionView = 'tree';
  /** The feed is open — the backend is filling frames for us. */
  running = false;
  source: InspectorSource = 'rawTelemetry';
  /** Substring match over the field name, case-insensitive. */
  filter = '';
  /** Hide fields the sim is not reporting in this session. */
  hideAbsent = false;
  /** What each recipient has actually been delivered, refreshed on the poll. */
  deliverySets: DeliverySet[] = [];
  /** Set when a poll throws, so the panel can say so instead of looking idle. */
  lastError: string | null = null;

  private expanded = new Set<string>();
  /** Per-array entry cap, raised by "show all" on that row. */
  private arrayLimits = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private sessionWatch: IReactionDisposer | null = null;

  constructor(private readonly root: TelemetryInspectorDeps) {
    makeAutoObservable<this, 'root'>(this, { root: false }, { autoBind: true });
  }

  setFilter(value: string) {
    this.filter = value;
  }

  setHideAbsent(value: boolean) {
    this.hideAbsent = value;
  }

  setRawSessionView(value: RawSessionView) {
    this.rawSessionView = value;
  }

  /**
   * The panel came on screen. The raw session is re-read whenever the parsed
   * one changes: both come from the same text, and `sim://session` — which this
   * window already receives — is the only signal that the text moved.
   */
  async open() {
    this.sessionWatch?.();
    this.sessionWatch = reaction(
      () => this.root.session.sessionInfo,
      () => {
        if (this.source === 'rawSession') {
          void this.loadRawSession();
        }
      }
    );

    await this.activate();
  }

  /** The panel left the screen: nothing is polled or kept for it any more. */
  async close() {
    this.sessionWatch?.();
    this.sessionWatch = null;

    await this.stop();
  }

  /**
   * Switching to either session stops the telemetry feed outright: a session
   * changes a few times a race and is read once per change, so keeping the
   * backend filling frames nobody is reading would be exactly the waste this
   * design exists to avoid.
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

    await this.activate();
  }

  async loadRawSession() {
    try {
      const session = await getRawSession();

      runInAction(() => {
        this.rawSession = session;
        this.lastError = null;
      });
    } catch (error) {
      runInAction(() => {
        this.lastError = String(error);
      });
    }
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

  /**
   * The counters as rates. A total alone cannot answer *does this window still
   * receive this field*, which is the claim the per-window mask work makes.
   */
  get deliveryRows(): DeliveryRow[] {
    return this.deliverySets.map((set) => ({
      label: set.label,
      bundles: set.bundles,
      elapsedMs: set.elapsedMs,
      hz: ratePerSecond(set.bundles, set.elapsedMs),
      fields: set.fields.map(
        (delivered): DeliveryFieldRow => ({
          field: delivered.field,
          bundles: delivered.bundles,
          hz: ratePerSecond(delivered.bundles, set.elapsedMs),
        })
      ),
    }));
  }

  async refreshDeliveryCounters() {
    try {
      const sets = await getDeliveryCounters();

      runInAction(() => {
        this.deliverySets = sets;
      });
    } catch (error) {
      runInAction(() => {
        this.lastError = String(error);
      });
    }
  }

  /** Gives a measurement run a defined start. */
  async resetDelivery() {
    await resetDeliveryCounters().catch((error: unknown) =>
      console.error('[telemetry-inspector] failed to reset counters:', error)
    );

    await this.refreshDeliveryCounters();
  }

  /** What the rows are built from, for the source on screen. */
  get sourceObject(): Record<string, unknown> | null {
    switch (this.source) {
      case 'rawTelemetry':
        return this.rawValues as Record<string, unknown> | null;
      case 'rawSession': {
        const tree = this.rawSession?.tree;

        return isPlainObject(tree) ? tree : null;
      }
      case 'session':
        return (this.root.session.sessionInfo ?? null) as Record<
          string,
          unknown
        > | null;
      case 'telemetry':
        return this.frame as Record<string, unknown> | null;
    }
  }

  /** The sim's description of each variable, keyed by its name. */
  get annotations(): ReadonlyMap<string, RowAnnotation> {
    return new Map(
      this.rawVarMeta.map((meta) => [
        meta.name,
        { typeName: meta.typeName, unit: meta.unit, desc: meta.desc },
      ])
    );
  }

  get rows(): InspectorRow[] {
    return buildRows(this.sourceObject, {
      expanded: this.expanded,
      filter: this.normalizedFilter,
      hideAbsent: this.hideAbsent && this.showsAbsent,
      arrayLimits: this.arrayLimits,
      annotations:
        this.source === 'rawTelemetry' ? this.annotations : undefined,
    });
  }

  /**
   * The raw session text, line by line. A filter keeps the matching lines with
   * their numbers rather than reflowing the document, so a match can still be
   * found again in the full text.
   */
  get rawSessionLines(): RawSessionLine[] {
    const yaml = this.rawSession?.yaml;

    if (!yaml) {
      return [];
    }

    const lines = yaml
      .split('\n')
      .map((text, index) => ({ number: index + 1, text }));

    if (this.normalizedFilter === '') {
      return lines;
    }

    return lines.filter((line) =>
      line.text.toLowerCase().includes(this.normalizedFilter)
    );
  }

  /** The adapted views mark what the sim does not report; the raw ones cannot. */
  get showsAbsent(): boolean {
    return this.source === 'telemetry' || this.source === 'session';
  }

  get showsRawText(): boolean {
    return this.source === 'rawSession' && this.rawSessionView === 'text';
  }

  private get normalizedFilter(): string {
    return this.filter.trim().toLowerCase();
  }

  /** How many fields the sim is not reporting at all. */
  get absentCount(): number {
    return countAbsent(this.sourceObject);
  }

  get isEmpty(): boolean {
    if (this.source === 'rawSession') {
      return this.rawSession === null;
    }

    return this.sourceObject === null;
  }

  /** Opens the feed. Only the two per-tick sources have one. */
  async start() {
    if (this.running || !isFeedSource(this.source)) {
      return;
    }

    await this.openFeed();
  }

  private async activate() {
    if (isFeedSource(this.source)) {
      await this.start();

      return;
    }

    await this.stop();

    if (this.source === 'rawSession') {
      await this.loadRawSession();
    }
  }

  private async openFeed() {
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
      this.rawValues = null;
    });

    await setInspectorActive(false).catch((error: unknown) =>
      console.error('[telemetry-inspector] failed to close the feed:', error)
    );
  }

  /**
   * Everything the snapshot export needs, without leaving the feed open: the
   * adapted frame, the sim's variables and their list, and the session text.
   *
   * When the feed is already open, what it has is used as it is. Otherwise it
   * is opened just long enough for the backend's next 4 Hz tick to fill one,
   * and closed again — so the export costs nothing beyond the moment the user
   * pressed the button. The source on screen is left alone.
   */
  async captureOnce(): Promise<InspectorCapture> {
    const wasRunning = this.running;

    if (!wasRunning) {
      await this.openFeed();
    }

    try {
      if (this.running && !wasRunning) {
        await this.awaitFrame();
      }

      const [rawVarMeta, rawSession] = await Promise.all([
        getRawVarMeta(),
        getRawSession(),
      ]);

      return {
        frame: this.frame,
        rawValues: this.rawValues,
        rawVarMeta,
        rawSession,
      };
    } finally {
      if (!wasRunning) {
        await this.stop();
      }
    }
  }

  /** Polls until a frame arrives or the sim is clearly not there. */
  private async awaitFrame() {
    for (let attempt = 0; attempt < CAPTURE_ATTEMPTS; attempt += 1) {
      await this.pullFrames();

      if (this.frame) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  /**
   * The adapted frame and the raw values come from the same tick and are read
   * together. The variable list is read once per connection — it is empty
   * until the sim connects, so it is asked for again until it is not.
   */
  private async pullFrames() {
    const [frame, rawValues, rawVarMeta] = await Promise.all([
      getInspectorFrame(),
      getInspectorRawValues(),
      this.rawVarMeta.length === 0 ? getRawVarMeta() : null,
    ]);

    runInAction(() => {
      this.frame = frame;
      this.rawValues = rawValues;

      if (rawVarMeta) {
        this.rawVarMeta = rawVarMeta;
      }
    });
  }

  private async poll() {
    void this.refreshDeliveryCounters();

    try {
      await this.pullFrames();

      runInAction(() => {
        this.lastError = null;
      });
    } catch (error) {
      runInAction(() => {
        this.lastError = String(error);
      });
    }
  }
}
