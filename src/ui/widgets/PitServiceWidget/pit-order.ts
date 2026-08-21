import { makeAutoObservable, runInAction } from 'mobx';

import { sendPitOrder } from '@platform/services/pit.service';
import type { PitCommandRequest, TireCompoundEntry } from '@/types/bindings';
import type { CornerPosition } from '@ui/widgets/PitServiceWidget/pit-service-utils';
import {
  ALL_CORNERS,
  isCornerOrdered,
  orderedPressure,
} from '@ui/widgets/PitServiceWidget/pit-service-utils';
import type { PitServiceWidgetStore } from '@ui/widgets/PitServiceWidget/pit-service.widget';

// How long the widget confirms a sent order. The sim never acknowledges a
// broadcast, so this only reports that the message left, not that it landed.
const ORDER_FEEDBACK_MS = 2500;

// Manual fuel steps follow the unit the driver reads: one liter, or one gallon
// worth of liters — the sim itself only ever takes liters.
const FUEL_STEP_L = 1;
const LITERS_PER_GALLON = 3.785412;

/**
 * The pit order itself: what the sim currently has checked, what the driver
 * changes by hand, and the one path out to the SDK.
 *
 * Every manual change claims its half of the order from auto mode — see
 * `PitAutoService`. Fast repair and the windshield are the exceptions and claim
 * nothing: auto mode never touches them either way.
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
   * Whether the checkboxes in the overlay accept a click. The overlay only owns
   * the mouse in interact mode, so outside it a click cannot reach the widget
   * anyway — this keeps the affordance honest about that.
   */
  get canClickOrders(): boolean {
    return this.store.root.appSettings.interactMode;
  }

  /**
   * The order the apply hotkey would send. Rebuilt on every call rather than
   * stored, so it always reflects the current fuel calculation.
   *
   * Fuel is rounded up: landing a liter short costs a whole extra stop, while a
   * liter over costs nothing but weight. Tire pressures are left at whatever
   * the driver set in the garage — the sim keeps them when passed 0.
   */
  get plannedOrder(): PitCommandRequest[] {
    const order: PitCommandRequest[] = [{ kind: 'clear', value: 0 }];
    const fuel = this.plannedFuelLiters;

    if (fuel !== null && fuel > 0) {
      order.push({ kind: 'fuel', value: Math.ceil(fuel) });
    }

    for (const corner of ALL_CORNERS) {
      order.push({ kind: corner, value: 0 });
    }

    return order;
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

  /** Tank size for this car; the ceiling for every manual fuel change. */
  get fuelCapacityLiters(): number | null {
    return this.store.root.session.sessionInfo?.driverCarFuelMaxLtr ?? null;
  }

  /** Liters the sim currently has on the order, zero when fuel is unchecked. */
  get orderedFuelLiters(): number {
    const service = this.store.root.player.pitService;

    return service?.addFuel ? (service.fuelAmount ?? 0) : 0;
  }

  /** What the fuel bar shows: the live drag, or the sim when not dragging. */
  get fuelDisplayLiters(): number {
    return this.fuelDraftLiters ?? this.orderedFuelLiters;
  }

  /** One press of the manual step, in liters, matching the displayed unit. */
  get fuelStepLiters(): number {
    const step = this.store.settings.fuelAdjustStep;

    return this.store.root.units.unitSystem === 'metric'
      ? step * FUEL_STEP_L
      : step * LITERS_PER_GALLON;
  }

  private clampFuel(liters: number): number {
    const capacity = this.fuelCapacityLiters;

    return Math.max(0, capacity === null ? liters : Math.min(liters, capacity));
  }

  /** Moves the bar without touching the sim; `commitFuelDraft` sends it. */
  setFuelDraft(liters: number) {
    this.fuelDraftLiters = this.clampFuel(liters);
  }

  async commitFuelDraft() {
    const draft = this.fuelDraftLiters;

    this.fuelDraftLiters = null;

    if (draft === null) {
      return;
    }

    await this.setFuelLiters(draft);
  }

  /** Steps the order up or down from whatever the sim currently holds. */
  async adjustFuel(deltaLiters: number) {
    await this.setFuelLiters(this.fuelDisplayLiters + deltaLiters);
  }

  /**
   * Sets the ordered fuel outright. Rounded up for the same reason the planned
   * order is: a liter short costs a stop, a liter over costs nothing.
   */
  async setFuelLiters(liters: number) {
    this.store.auto.claimFuelHalf();

    const target = Math.round(this.clampFuel(liters));

    if (target <= 0) {
      await this.send([{ kind: 'clearFuel', value: 0 }]);

      return;
    }

    await this.send([{ kind: 'fuel', value: target }]);
  }

  /**
   * Toggles fuel. The SDK has no toggle, only set and clear, so the current
   * state read back from the sim decides which of the two to send.
   */
  async toggleFuel() {
    this.store.auto.claimFuelHalf();

    if (this.isFuelOrdered) {
      await this.send([{ kind: 'clearFuel', value: 0 }]);

      return;
    }

    const fuel = this.plannedFuelLiters;

    if (fuel === null || fuel <= 0) {
      return;
    }

    await this.send([{ kind: 'fuel', value: Math.ceil(fuel) }]);
  }

  /**
   * Steps to the next compound in the session's list, wrapping at the end. The
   * SDK takes an index rather than a delta, and there is no "next" command, so
   * the wrap is worked out here.
   *
   * Part of the tire half: picking a compound is as much a tire decision as
   * ticking a corner, and auto mode has no business overruling it afterwards.
   */
  async cycleTireCompound() {
    const compounds = this.tireCompounds;

    if (compounds.length < 2) {
      return;
    }

    this.store.auto.claimTireHalf();

    const current = compounds.findIndex(
      (entry) => entry.tireIndex === this.orderedCompoundIndex
    );
    const next = compounds[(current + 1) % compounds.length];

    await this.send([{ kind: 'tireCompound', value: next.tireIndex }]);
  }

  /**
   * Toggles one corner. Unchecking is the awkward direction: the SDK can only
   * clear all four at once, so the other ordered corners are re-sent right
   * after — at the pressure the sim reports for them, so an explicitly set
   * pressure survives the round trip.
   */
  async toggleTire(corner: CornerPosition) {
    this.store.auto.claimTireHalf();

    if (!this.isCornerOrdered(corner)) {
      await this.send([{ kind: corner, value: 0 }]);

      return;
    }

    const survivors = ALL_CORNERS.filter(
      (other) => other !== corner && this.isCornerOrdered(other)
    );

    await this.send([
      { kind: 'clearTires', value: 0 },
      ...survivors.map((other) => ({
        kind: other,
        value: Math.round(
          orderedPressure(other, this.store.root.player.pitService) ?? 0
        ),
      })),
    ]);
  }

  async toggleAllTires() {
    this.store.auto.claimTireHalf();

    if (this.areAllTiresOrdered) {
      await this.send([{ kind: 'clearTires', value: 0 }]);

      return;
    }

    await this.send(ALL_CORNERS.map((corner) => ({ kind: corner, value: 0 })));
  }

  // Fast repair and the windshield are outside auto mode entirely — it never
  // orders them and never reads them — so using one says nothing about who is
  // deciding the fuel or the tires, and claims neither half.
  async toggleFastRepair() {
    await this.send([
      {
        kind: this.isFastRepairOrdered ? 'clearFastRepair' : 'fastRepair',
        value: 0,
      },
    ]);
  }

  async toggleWindshield() {
    await this.send([
      {
        kind: this.isWindshieldOrdered ? 'clearWindshield' : 'windshield',
        value: 0,
      },
    ]);
  }

  /**
   * Sends the planned order. Only ever reached from an explicit key press —
   * nothing in this store calls it on a telemetry transition.
   */
  async sendPlannedOrder() {
    this.store.auto.claimFuelHalf();
    this.store.auto.claimTireHalf();

    await this.send(this.plannedOrder);
  }

  /** Unchecks the whole pit order in the sim. */
  async sendClearOrder() {
    this.store.auto.claimFuelHalf();
    this.store.auto.claimTireHalf();

    await this.send([{ kind: 'clear', value: 0 }]);
  }

  // Every path into the sim goes through this method, so the result reporting
  // lives here rather than at each call site.
  async send(requests: PitCommandRequest[]) {
    this.store.panel.revealAfterCommand();

    try {
      await sendPitOrder(requests);
      this.setOrderResult('sent');
    } catch (error) {
      console.error('[pit-service] order failed', error);
      this.setOrderResult('failed');
    }
  }

  private setOrderResult(result: 'sent' | 'failed') {
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
