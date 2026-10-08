import { computed, makeAutoObservable } from 'mobx';

import type { WidgetInstanceContext } from '@entities/widget/widget-instances.store';
import { isHiddenInQualifying } from '@shared/lib/qualifying-visibility';
import {
  buildPaceCarRowEntries,
  mergePaceCarRows,
  type PaceCarRowEntry,
} from './relative-utils';
import { useWidgetInstanceStore } from '@entities/widget/widget-instance-context';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';
import type { CarsStore } from '@entities/cars/cars.store';
import type { SessionStore } from '@entities/session/session.store';
import type { BackendComputedStore } from '@entities/cars/computed.store';
import type { AppSettingsStore } from '@entities/app-settings/app-settings.store';
import type { RelativeWidgetSettings } from './settings-schema';

interface RelativeDeps {
  liveWidgets: LiveWidgetsView;
  cars: CarsStore;
  session: SessionStore;
  backendComputed: BackendComputedStore;
  appSettings: AppSettingsStore;
}

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
 * none of which a data store may know about. Built per instance (`mount.ts`),
 * so two strips follow their own pace-car and qualifying settings.
 */
export class RelativeWidgetStore {
  private readonly root: RelativeDeps;

  private readonly instanceId: string;

  constructor({ core, instanceId }: WidgetInstanceContext<RelativeDeps>) {
    this.root = core;
    this.instanceId = instanceId;

    makeAutoObservable<RelativeWidgetStore, 'root' | 'instanceId'>(
      this,
      { root: false, instanceId: false, rowOrder: computed.struct },
      { autoBind: true }
    );
  }

  /** Nothing to stop: the store is derivations only. */
  dispose() {}

  private get settings(): RelativeWidgetSettings {
    return this.root.liveWidgets.getSettings<RelativeWidgetSettings>(
      this.instanceId
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
      (carIdx) => this.root.backendComputed.paceCarPhaseOf(carIdx),
      this.settings.paceCarShowInPits
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

export const useRelativeWidgetStore = () =>
  useWidgetInstanceStore<RelativeWidgetStore>();
