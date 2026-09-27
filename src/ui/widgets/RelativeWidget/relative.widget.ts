import { computed, makeAutoObservable } from 'mobx';

import type { RootStore } from '@store/root-store';
import type { RelativeWidgetSettings } from '@/types/widget-settings';
import { isHiddenInQualifying } from '@utils/qualifying-visibility';
import {
  buildPaceCarRowEntries,
  mergePaceCarRows,
  type PaceCarRowEntry,
} from '@ui/widgets/RelativeWidget/relative-utils';

type RelativeDeps = Pick<
  RootStore,
  | 'liveWidgets'
  | 'cars'
  | 'session'
  | 'backendComputed'
  | 'paceCar'
  | 'appSettings'
>;

/** What one row of the strip is: a car, and whether it is a pace car. */
export interface RelativeRow {
  carIdx: number;
  isPaceCar: boolean;
}

/**
 * The order of the relative strip, and nothing else.
 *
 * The order is decided by `relativeLapDist`, which moves on every tick, but it
 * only *changes* when two cars actually swap places. Compared by content, this
 * hands the widget a list that is the same value for a whole burst, so the rows
 * are rendered once and their gaps are written to the DOM. See
 * `docs/rendering.md`.
 *
 * It lives here rather than in `BackendComputedStore` because the pace-car rows
 * are merged in from the session roster, the car-index frame and a setting —
 * none of which a data store may know about.
 */
export class RelativeWidgetStore {
  constructor(private readonly root: RelativeDeps) {
    makeAutoObservable<RelativeWidgetStore, 'root'>(
      this,
      { root: false, rowOrder: computed.struct },
      { autoBind: true }
    );
  }

  private get settings(): RelativeWidgetSettings {
    return this.root.liveWidgets.getSettings<RelativeWidgetSettings>(
      'relative'
    );
  }

  /**
   * Alone on track the other rows are stale garage entries, so only the
   * player's row stays. Drag mode keeps the full strip to place the widget by.
   */
  get showsOnlyPlayer(): boolean {
    if (this.root.appSettings.dragMode) {
      return false;
    }

    return isHiddenInQualifying(
      this.settings.qualifyingVisibility,
      this.root.session
    );
  }

  /**
   * The pace-car rows, synthesized from the session roster because the backend
   * leaves them out of the relative list. Not compared by content: the row that
   * draws one reads it inside a reaction, where the gap is expected to move.
   */
  get paceCarRows(): PaceCarRowEntry[] {
    return buildPaceCarRowEntries(
      this.root.cars.carIdx,
      this.root.session.sessionInfo?.cars,
      this.root.backendComputed.relativeEntries,
      (carIdx) => this.root.paceCar.getPitPhase(carIdx),
      this.settings.paceCarShowInPits ?? false
    );
  }

  paceCarRowOf(carIdx: number): PaceCarRowEntry | null {
    return this.paceCarRows.find((row) => row.carIdx === carIdx) ?? null;
  }

  get rowOrder(): RelativeRow[] {
    const entries = this.root.backendComputed.relativeEntries;

    if (this.showsOnlyPlayer) {
      return entries
        .filter((entry) => entry.isPlayer)
        .map((entry) => ({ carIdx: entry.carIdx, isPaceCar: false }));
    }

    return mergePaceCarRows(entries, this.paceCarRows).map((entry) => ({
      carIdx: entry.carIdx,
      isPaceCar: 'isPaceCar' in entry,
    }));
  }
}
