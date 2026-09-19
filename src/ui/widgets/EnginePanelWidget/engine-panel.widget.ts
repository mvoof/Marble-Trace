import {
  makeAutoObservable,
  observable,
  reaction,
  runInAction,
  type IReactionDisposer,
} from 'mobx';

import type { RootStore } from '@store/root-store';
import type { CarStatusFrame } from '@/types/bindings';
import { ADJUSTMENT_CELLS } from './engine-panel-utils';

type EnginePanelDeps = Pick<RootStore, 'player'>;

/** The ABS cell is not in the spec list — it has its own component. */
const ABS_FIELD: keyof CarStatusFrame = 'dc_abs';

const WATCHED_FIELDS: (keyof CarStatusFrame)[] = [
  ABS_FIELD,
  ...ADJUSTMENT_CELLS.map((spec) => spec.field),
];

/**
 * How long a cell stays lit after the driver stops moving it.
 *
 * It is a trailing window, not a duration per change: spinning a rotary through
 * four positions lights the cell once and holds it, rather than restarting a
 * flash on every click.
 */
export const CHANGE_HIGHLIGHT_MS = 1000;

/**
 * Which adjustment cells were just moved.
 *
 * The highlight is a plain background swap with no CSS animation — an animation
 * keeps the compositor awake for as long as it runs, which is not what an
 * always-on-top overlay over a sim should be doing for a cosmetic cue. Without
 * an animation there is nothing to turn the highlight off again, so the timer
 * lives here, which is where this codebase keeps timers.
 */
export class EnginePanelWidgetStore {
  /** Fields lit right now. Read by the cells. */
  readonly changed = observable.set<string>();

  private readonly previous = new Map<string, number | null>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly disposers: IReactionDisposer[] = [];

  // Wired in the constructor rather than an init() step: the highlight must
  // follow the telemetry frame, and it costs nothing when no adjustment moves.
  constructor(private readonly root: EnginePanelDeps) {
    makeAutoObservable(this, {}, { autoBind: true });

    this.disposers.push(
      reaction(
        () => this.readValues(),
        (values) => this.onValues(values),
        { fireImmediately: true }
      )
    );
  }

  isChanged(field: keyof CarStatusFrame): boolean {
    return this.changed.has(field);
  }

  private readValues(): (number | null)[] {
    const status = this.root.player.carStatus;

    return WATCHED_FIELDS.map((field) => {
      const raw = status?.[field];

      return typeof raw === 'number' ? raw : null;
    });
  }

  private onValues(values: (number | null)[]) {
    WATCHED_FIELDS.forEach((field, index) => {
      const value = values[index];
      const before = this.previous.get(field) ?? null;

      this.previous.set(field, value);

      // Only a move between two real values is the driver's doing. A field
      // arriving from null is the car declaring it — on the first frame of a
      // session that is every field at once, and lighting the whole panel says
      // nothing. A field going to null is the car leaving.
      if (before === null || value === null || before === value) {
        return;
      }

      this.light(field);
    });
  }

  private light(field: string) {
    this.changed.add(field);

    const running = this.timers.get(field);

    if (running) {
      clearTimeout(running);
    }

    this.timers.set(
      field,
      setTimeout(() => {
        runInAction(() => {
          this.changed.delete(field);
          this.timers.delete(field);
        });
      }, CHANGE_HIGHLIGHT_MS)
    );
  }

  reset() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();
    this.previous.clear();
    this.changed.clear();
  }

  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;
    this.reset();
  }
}
