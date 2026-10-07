import { makeAutoObservable, runInAction } from 'mobx';

import { runPitAction } from '@shared/api/pit.service';
import type { PitAction, TireCompoundEntry } from '@shared/contracts/bindings';
import type { CornerPosition } from '@store/widgets/pit-service/pit-tires';
import {
  ALL_CORNERS,
  isCornerOrdered,
} from '@store/widgets/pit-service/pit-tires';
import type { PitServiceWidgetStore } from './pit-service.store';

// How long the widget confirms a sent order. The sim never acknowledges a
// broadcast, so this only reports that the message left, not that it landed.
const ORDER_FEEDBACK_MS = 2500;

/**
 * The pit order as the widget shows it: what the sim currently has checked,
 * and the clicks that change it.
 *
 * A click sends an intent (`PitAction`), not broadcasts: the telemetry thread
 * resolves it against the order the sim reports and sends it, the same path a
 * key takes (`computations/pit_actions.rs`). The claim on auto mode's half of
 * the stop is worked out there too.
 */
export class PitOrder {
  /** Outcome of the last order, shown briefly under the fuel row. */
  lastOrderResult: 'sent' | 'failed' | null = null;

  /**
   * Liters being dialled in right now by dragging the fuel bar. The sim is only
   * written on release: a command per pointer move would flood the broadcast
   * channel, and the sim reads back at 4 Hz anyway, so the bar would stutter
   * against its own echo.
   */
  fuelDraftLiters: number | null = null;

  /**
   * What was aboard when the crew started filling, or null off a stop.
   *
   * The sim keeps `fuelAmount` at the figure the order was placed with while
   * the hose is in, so `inTank + ordered` climbs liter by liter as the tank
   * does — and the mark showing the level the car leaves on would walk to the
   * right through the whole stop. Measured from this instead, it stands still
   * and the green band simply shrinks into the blue one.
   */
  fillBaselineLiters: number | null = null;

  private orderFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly store: PitServiceWidgetStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /**
   * Liters the Fuel widget recommends, capped at tank capacity. Read off the
   * fuel frame rather than recomputed, so the number the driver reads is
   * literally the number that gets sent — and so this keeps working from the
   * main window, which sees only the 4 Hz slow slice.
   */
  get plannedFuelLiters(): number | null {
    return this.store.root.backendComputed.fuel?.refuelPlan?.fillNow ?? null;
  }

  /**
   * What still has to go in, right now: the plan capped by the room left in the
   * tank.
   *
   * It falls as the crew works — `fuel_level` climbs while the hose is in, and
   * every liter that lands is one the plan no longer needs — so the row counts
   * down to zero instead of standing at the figure the stop began with. That is
   * also exactly the number every send clamps to, so what is read and what is
   * ordered cannot drift apart.
   */
  get plannedFillNowLiters(): number | null {
    const planned = this.plannedFuelLiters;

    return planned === null ? null : this.clampFuel(planned);
  }

  /**
   * Whether the checkboxes in the overlay accept a click. The overlay only owns
   * the mouse in interact mode, so outside it a click cannot reach the widget
   * anyway — this keeps the affordance honest about that.
   */
  get canClickOrders(): boolean {
    return this.store.root.appSettings.interactMode;
  }

  /**
   * Compounds this car can be sent out on, as the session lists them. Most cars
   * have exactly one, and for those the whole control is pointless — hence
   * `hasCompoundChoice` rather than rendering a row that can only say one thing.
   */
  get tireCompounds(): TireCompoundEntry[] {
    return this.store.root.session.sessionInfo?.driverTires ?? [];
  }

  get hasCompoundChoice(): boolean {
    return this.tireCompounds.length > 1;
  }

  /** Compound index the sim has on the order, or null when it reports none. */
  get orderedCompoundIndex(): number | null {
    return this.store.root.player.pitService?.tireCompound ?? null;
  }

  get orderedCompoundName(): string | null {
    const index = this.orderedCompoundIndex;

    if (index === null) {
      return null;
    }

    return (
      this.tireCompounds.find((entry) => entry.tireIndex === index)
        ?.tireCompoundType ?? null
    );
  }

  /** Whether the sim currently has this corner checked. */
  isCornerOrdered(corner: CornerPosition): boolean {
    return isCornerOrdered(corner, this.store.root.player.pitService);
  }

  get isFuelOrdered(): boolean {
    return this.store.root.player.pitService?.addFuel ?? false;
  }

  get isFastRepairOrdered(): boolean {
    return this.store.root.player.pitService?.fastRepair ?? false;
  }

  get isWindshieldOrdered(): boolean {
    return this.store.root.player.pitService?.cleanWindshield ?? false;
  }

  get areAllTiresOrdered(): boolean {
    return ALL_CORNERS.every((corner) => this.isCornerOrdered(corner));
  }

  /** Raw `PitSvFlags`, zero when the sim reports no order at all. */
  get simArmedFlags(): number {
    return this.store.root.player.pitService?.flags ?? 0;
  }

  /** Fuel the series lets this car carry; the ceiling the tank and the order share. */
  get fuelCapacityLiters(): number | null {
    return this.store.root.session.sessionInfo?.fuelCapacityLtr ?? null;
  }

  /** What is already aboard. The crew adds on top of this, never instead of it. */
  get fuelInTankLiters(): number {
    return this.store.root.player.carStatus?.fuel_level ?? 0;
  }

  /**
   * The most that can still be added: the tank, less what is in it.
   *
   * The sim silently truncates an order past the brim, so a bar that let the
   * driver dial in twenty liters onto a nearly full tank would report an order
   * the crew is not going to carry out — and the fuel calculation the whole
   * strategy hangs on would be read off that number. Null while the car's tank
   * size is unknown, which is the one case where no ceiling can be named.
   */
  get maxAddableLiters(): number | null {
    const capacity = this.fuelCapacityLiters;

    if (capacity === null) {
      return null;
    }

    return Math.max(0, capacity - this.fuelInTankLiters);
  }

  /** The tank is at the brim, so there is nothing left to order. */
  get isTankFull(): boolean {
    const addable = this.maxAddableLiters;

    return addable !== null && addable <= 0;
  }

  /** Liters the sim currently has on the order, zero when fuel is unchecked. */
  get orderedFuelLiters(): number {
    const service = this.store.root.player.pitService;

    return service?.addFuel ? (service.fuelAmount ?? 0) : 0;
  }

  /** Latches the tank level a stop starts from; see `fillBaselineLiters`. */
  handleServiceActiveChange(serviceActive: boolean) {
    this.fillBaselineLiters = serviceActive ? this.fuelInTankLiters : null;
  }

  /**
   * The level the car leaves the box on: what the order is measured from, plus
   * the order itself, capped at the brim.
   *
   * Off a stop that baseline is simply what is aboard right now — fuel burns,
   * and an order of thirty liters targets thirty above whatever is left. During
   * the stop it is frozen, so the target does not chase the rising tank.
   */
  get fuelTargetLiters(): number | null {
    const capacity = this.fuelCapacityLiters;

    if (capacity === null) {
      return null;
    }

    const baseline =
      this.fuelDraftLiters !== null
        ? this.fuelInTankLiters
        : (this.fillBaselineLiters ?? this.fuelInTankLiters);

    return Math.min(
      capacity,
      Math.max(this.fuelInTankLiters, baseline + this.fuelDisplayLiters)
    );
  }

  /** What the fuel bar shows: the live drag, or the sim when not dragging. */
  get fuelDisplayLiters(): number {
    return this.fuelDraftLiters ?? this.orderedFuelLiters;
  }

  // Private only in spirit: `plannedFillNowLiters` is the reading of it, and
  // every write goes through it too.
  private clampFuel(liters: number): number {
    const addable = this.maxAddableLiters;

    return Math.max(0, addable === null ? liters : Math.min(liters, addable));
  }

  /** Moves the bar without touching the sim; `commitFuelDraft` sends it. */
  setFuelDraft(liters: number) {
    this.fuelDraftLiters = this.clampFuel(liters);
  }

  commitFuelDraft() {
    const draft = this.fuelDraftLiters;

    this.fuelDraftLiters = null;

    if (draft === null) {
      return;
    }

    this.setFuelLiters(draft);
  }

  /**
   * Sets the ordered fuel outright; capped and rounded on the telemetry thread,
   * as every path into the sim is.
   */
  setFuelLiters(liters: number) {
    this.act({ kind: 'setFuel', liters });
  }

  toggleFuel() {
    this.act({ kind: 'toggleFuel' });
  }

  cycleTireCompound() {
    this.act({ kind: 'cycleCompound' });
  }

  toggleTire(corner: CornerPosition) {
    this.act({ kind: 'toggleTire', corner });
  }

  toggleFastRepair() {
    this.act({ kind: 'toggleFastRepair' });
  }

  toggleWindshield() {
    this.act({ kind: 'toggleWindshield' });
  }

  // Every click goes out through here. The result is reported when the thread
  // publishes it — `pitAuto.ordersSent` steps for a manual order as for an
  // automatic one — so a failure to reach the backend is all that is left.
  private act(action: PitAction) {
    runPitAction(action).catch((error: unknown) => {
      console.error('[pit-service] order failed', error);
      this.reportOrderResult('failed');
    });
  }

  /**
   * Shows how an order fared under the fuel row, read off the frame the
   * telemetry thread publishes.
   */
  reportOrderResult(result: 'sent' | 'failed') {
    runInAction(() => {
      this.lastOrderResult = result;
    });

    if (this.orderFeedbackTimer !== null) {
      clearTimeout(this.orderFeedbackTimer);
    }

    this.orderFeedbackTimer = setTimeout(() => {
      runInAction(() => {
        this.lastOrderResult = null;
        this.orderFeedbackTimer = null;
      });
    }, ORDER_FEEDBACK_MS);
  }

  reset() {
    if (this.orderFeedbackTimer !== null) {
      clearTimeout(this.orderFeedbackTimer);
      this.orderFeedbackTimer = null;
    }

    this.lastOrderResult = null;
    this.fuelDraftLiters = null;
  }
}
