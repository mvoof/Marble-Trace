import { makeAutoObservable } from 'mobx';

import { togglePitAuto } from '@shared/api/pit.service';
import type { PitAutoMode } from '@shared/contracts/bindings';
import type { PitServiceWidgetStore } from './pit-service.store';

export type AutoModeLabel = 'AUTO' | 'FUEL AUTO' | 'TIRE AUTO' | 'MANUAL';

const AUTO_MODE_LABELS: Record<PitAutoMode, AutoModeLabel | null> = {
  off: null,
  auto: 'AUTO',
  fuelAuto: 'FUEL AUTO',
  tireAuto: 'TIRE AUTO',
  manual: 'MANUAL',
};

/**
 * Auto mode as the widget shows it.
 *
 * The decisions — what to order on pit entry and in the box, which halves the
 * driver has taken over, when to stand down — are made on the telemetry thread
 * (`computations/pit_auto.rs`), so an order goes out whether or not any window
 * is alive to watch. This reads back the state it publishes and sends the auto
 * mode key; a manual order claims its half through `PitOrder.send`.
 */
export class PitAutoService {
  constructor(private readonly store: PitServiceWidgetStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get isAutoFuelEnabled(): boolean {
    return this.store.strategy.pitAutoFuel;
  }

  get isAutoTiresEnabled(): boolean {
    return this.store.strategy.pitAutoTires;
  }

  /**
   * What the header plate says: which parts of the stop auto mode will still
   * decide. Null while auto mode is switched off — the order is manual by
   * definition then, and a permanent plate would say nothing.
   */
  get autoModeLabel(): AutoModeLabel | null {
    const mode = this.store.root.backendComputed.pitAuto?.mode ?? 'off';

    return AUTO_MODE_LABELS[mode];
  }

  /**
   * Whether the wear on display was measured somewhere other than here and now.
   *
   * `*_wear_*` is not a sensor: the sim writes it once, when the car stops in
   * the box, and then leaves it alone — through the whole next stint, and even
   * after the crew has fitted a fresh set. Outside the box the numbers describe
   * tires that may no longer be on the car, and the widget has to say so rather
   * than present them as current.
   */
  get isTireWearStale(): boolean {
    return !this.store.isInPitStall;
  }

  /**
   * The auto mode key. Sends nothing to the sim, so it asks for the reveal
   * itself — handing the stop over is exactly the kind of press worth seeing
   * confirmed.
   */
  toggleAutoSuspended() {
    this.store.panel.revealAfterCommand();

    togglePitAuto().catch((error) =>
      console.error('[pit-service] auto mode toggle failed', error)
    );
  }
}
