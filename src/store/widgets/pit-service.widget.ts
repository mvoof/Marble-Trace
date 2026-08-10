import { invoke } from '@tauri-apps/api/core';
import { makeAutoObservable, runInAction } from 'mobx';

import { computeRefuelPlan } from '@widgets/FuelWidget/fuel-utils';
import type { RootStore } from '@store/root-store';
import type { PitCommandRequest } from '@/types/bindings';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import type { CornerPosition } from '@utils/widget/pit-service-utils';
import {
  ALL_CORNERS,
  cornerWorstWear,
  cornersBelowWearThreshold,
  isCornerOrdered,
  orderedPressure,
} from '@utils/widget/pit-service-utils';

// The panel lingers briefly after pit exit so the last service result stays
// readable while the car is already accelerating away.
const HIDE_DELAY_MS = 3000;

// The stop clock ticks on its own rather than on telemetry: the pit service
// tier runs at 4 Hz, which is too coarse to read as a running timer.
const STOP_TICK_MS = 100;
const MS_IN_SECOND = 1000;

// How long the widget confirms a sent order. The sim never acknowledges a
// broadcast, so this only reports that the message left, not that it landed.
const ORDER_FEEDBACK_MS = 2500;

// Manual fuel steps follow the unit the driver reads: one liter, or one gallon
// worth of liters — the sim itself only ever takes liters.
const FUEL_STEP_L = 1;
const LITERS_PER_GALLON = 3.785412;

export class PitServiceWidgetStore {
  /** Manual override toggled by hotkey; independent of pit road state. */
  manualShow = false;

  /** Seconds spent in the pit stall on the current stop. */
  stopElapsedS = 0;

  /**
   * How long the previous stop took this session. The sim reports no service
   * duration at all, so the only honest source for "how long will this take"
   * is what the last stop actually took.
   */
  lastStopDurationS: number | null = null;

  /** Outcome of the last order, shown briefly under the fuel row. */
  lastOrderResult: 'sent' | 'failed' | null = null;

  /**
   * Auto mode stands down for the rest of this pit stop because the driver
   * touched the order by hand. Cleared on pit exit, so the next stop is
   * automatic again.
   *
   * Public because both windows have to agree on it: the checkboxes are
   * clicked in the overlay and the hotkeys fire in main, and the badge is read
   * in the overlay — the sync layer mirrors the flag between them.
   */
  autoSuspended = false;

  /**
   * Whether each half of the automatic order is already settled for this stop —
   * because auto mode sent it, or because the driver took that half over by
   * hand. Either way there is nothing left for auto mode to do with it.
   *
   * Two flags rather than one so the halves can be claimed separately: nudging
   * the fuel by a liter is the most ordinary thing a driver does on the way in,
   * and it has no business switching off the tire decision as well.
   *
   * Public for the same reason as `autoSuspended`: clicks land in the overlay,
   * hotkeys in main, and the badges are read in the overlay.
   */
  autoFuelSent = false;

  autoTiresSent = false;

  /**
   * Liters being dialled in right now by dragging the fuel bar. The sim is only
   * written on release: a command per pointer move would flood the broadcast
   * channel, and the sim reads back at 4 Hz anyway, so the bar would stutter
   * against its own echo.
   */
  fuelDraftLiters: number | null = null;

  private lingering = false;
  private orderFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private lastOnPitRoad = false;
  private lastServiceActive = false;
  private stallEnteredAt: number | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private stopTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get isOnPitRoad(): boolean {
    return this.root.player.carStatus?.on_pit_road ?? false;
  }

  get isInPitStall(): boolean {
    return this.root.player.pitService?.inPitStall ?? false;
  }

  /** The crew is working on the car — `pitstop_active` from the sim. */
  get isServiceActive(): boolean {
    return this.root.player.pitService?.serviceActive ?? false;
  }

  get towTimeS(): number {
    return this.root.player.pitService?.towTimeS ?? 0;
  }

  get isTowing(): boolean {
    return this.towTimeS > 0;
  }

  /** Towing is shown anywhere on track — the sim has no other countdown for it. */
  get isVisible(): boolean {
    return (
      this.manualShow || this.isOnPitRoad || this.isTowing || this.lingering
    );
  }

  /**
   * Seconds the car is still expected to stand still: the countdowns the sim
   * reports plus whatever is left of a stop as long as the last one. Null when
   * nothing is known — the first stop of a session has nothing to learn from.
   */
  get expectedRemainingS(): number | null {
    const service = this.root.player.pitService;

    const timed = (service?.repairLeftS ?? 0) + (service?.optRepairLeftS ?? 0);
    const tow = this.towTimeS;

    if (!this.isServiceActive) {
      return timed + tow > 0 ? timed + tow : null;
    }

    if (this.lastStopDurationS === null) {
      return timed > 0 ? timed : null;
    }

    const serviceLeft = Math.max(0, this.lastStopDurationS - this.stopElapsedS);

    return Math.max(timed, serviceLeft);
  }

  private get settings(): PitServiceWidgetSettings {
    return this.root.widgetSettings.getSettings<PitServiceWidgetSettings>(
      'pit-service'
    );
  }

  /**
   * Liters the Fuel widget recommends, capped at tank capacity. Shared with
   * `FuelOrder` so the number the driver reads is the number that gets sent.
   */
  get plannedFuelLiters(): number | null {
    const plan = computeRefuelPlan(
      this.root.backendComputed.fuel?.fuelToAddWithBuffer ?? null,
      this.root.session.sessionInfo?.driverCarFuelMaxLtr ?? null
    );

    return plan?.fillNow ?? null;
  }

  /**
   * Whether the checkboxes in the overlay accept a click. The overlay only owns
   * the mouse in interact mode, so outside it a click cannot reach the widget
   * anyway — this keeps the affordance honest about that.
   */
  get canClickOrders(): boolean {
    return this.root.appSettings.interactMode;
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
   * Auto mode is armed: at least one of the two things it can order is on.
   * With both off there is nothing for it to build, so it is off — no separate
   * master switch to disagree with. It says nothing about whether it will act
   * right now — see `isAutoActive`.
   */
  get isAutoEnabled(): boolean {
    return (
      this.isInActiveLayout &&
      (this.isAutoFuelEnabled || this.isAutoTiresEnabled)
    );
  }

  /**
   * A widget that is not in the active layout does nothing at all — not just no
   * rendering, but no pit orders either. Ordering fuel on behalf of a widget the
   * driver removed from the layout is the kind of surprise that loses races, so
   * the auto-mode settings only take effect while the widget is actually there.
   */
  get isInActiveLayout(): boolean {
    return this.root.widgetSettings.isWidgetInActiveLayout('pit-service');
  }

  get isAutoFuelEnabled(): boolean {
    return this.settings.autoFuel;
  }

  get isAutoTiresEnabled(): boolean {
    return this.settings.autoTires;
  }

  /** Auto mode will build the next order itself. */
  get isAutoActive(): boolean {
    return this.isAutoEnabled && !this.autoSuspended;
  }

  /**
   * Whether each half is still auto mode's to decide on this stop. Drives the
   * badges: a half the driver has taken over says so on its own, instead of one
   * badge in the header standing for a stop that is only half manual.
   */
  get isAutoFuelPending(): boolean {
    return this.isAutoActive && this.isAutoFuelEnabled && !this.autoFuelSent;
  }

  get isAutoTiresPending(): boolean {
    return this.isAutoActive && this.isAutoTiresEnabled && !this.autoTiresSent;
  }

  /**
   * Every wear number as one value, so a reaction can watch the whole set for
   * the refresh the sim performs on arrival in the box. Reactions cannot watch
   * twelve fields without either twelve disposers or a deep observer, and this
   * is the only thing anything needs to know about them changing.
   */
  get tireWearSignature(): string {
    const frame = this.root.player.chassis;

    return ALL_CORNERS.map((corner) => cornerWorstWear(corner, frame)).join(
      ','
    );
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
    return !this.isInPitStall;
  }

  /**
   * Corners auto mode considers finished. Recomputed on read, so the settings
   * panel slider and the tire grid always agree with what the next entry would
   * order.
   */
  get autoTireCorners(): CornerPosition[] {
    if (!this.settings.autoTires) {
      return [];
    }

    return cornersBelowWearThreshold(
      this.root.player.chassis,
      this.settings.autoTireWearThreshold
    );
  }

  /**
   * The first half of the automatic order, sent on pit road entry: the
   * calculated fuel, and nothing else.
   *
   * Deliberately `clearFuel` rather than a full `clear`. The sim arms the pit
   * box with the previous stop's order the moment the car leaves the box, and a
   * full clear wipes that — including the tires, which this half has no
   * business deciding on, because tire wear is not readable yet on pit road.
   * Fast repair and the windshield are left alone for the same reason: auto
   * mode does not own them.
   */
  get autoFuelOrder(): PitCommandRequest[] {
    if (!this.settings.autoFuel) {
      return [];
    }

    const fuel = this.plannedFuelLiters;

    if (fuel === null || fuel <= 0) {
      return [{ kind: 'clearFuel', value: 0 }];
    }

    return [
      { kind: 'clearFuel', value: 0 },
      { kind: 'fuel', value: Math.ceil(fuel) },
    ];
  }

  /**
   * The second half, sent once the wear read in the stall is available: the
   * corners worn past the threshold, and a `clearTires` ahead of them so the
   * set is exactly what auto mode decided rather than that set merged with
   * whatever the sim had armed.
   *
   * An empty set is a decision too, and it is the whole order: a lone
   * `clearTires` means "these tires stay on".
   */
  get autoTireOrder(): PitCommandRequest[] {
    return [
      { kind: 'clearTires', value: 0 } as PitCommandRequest,
      ...this.autoTireCorners.map((corner) => ({ kind: corner, value: 0 })),
    ];
  }

  /**
   * Kept for the settings preview and the tests: what a stop would order in
   * total, if the wear the sim reports right now were the wear at the stall.
   */
  get autoOrder(): PitCommandRequest[] {
    return [...this.autoFuelOrder, ...this.autoTireOrder];
  }

  /**
   * Sends the fuel half. Called once per pit road entry, from the main window
   * only — two windows running the same telemetry would otherwise broadcast the
   * order twice.
   */
  async applyAutoFuelOrder() {
    if (!this.isAutoActive || this.autoFuelSent) {
      return;
    }

    const order = this.autoFuelOrder;

    if (order.length === 0) {
      return;
    }

    this.autoFuelSent = true;

    await this.send(order);
  }

  /**
   * Sends the tire half, once the car has reached the box rather than on pit
   * entry.
   *
   * The sim only refreshes `*_wear_*` when the car stops in the box: everywhere
   * else those fields hold the measurement taken at the *previous* stop, so a
   * threshold check there compares against tread that is not on the car — they
   * do not even reset when the crew fits new tires. Standing in the box the
   * values are finally current, and that is the one moment the order can be
   * both correct and still in time.
   *
   * Which of the three signals for "we are there" arrives first is not fixed:
   * `serviceActive` has been seen a frame ahead of `inPitStall`, and the wear
   * numbers themselves have refreshed ahead of both. Whichever lands first
   * calls this, and `autoTiresSent` keeps the other two from re-sending.
   */
  async applyAutoTireOrder() {
    if (!this.isAutoActive || !this.settings.autoTires || this.autoTiresSent) {
      return;
    }

    this.autoTiresSent = true;

    await this.send(this.autoTireOrder);
  }

  /**
   * Hands the order back to the driver for the rest of the stop. Every manual
   * path calls this: once a human has decided something, auto mode second
   * guessing it is worse than doing nothing.
   */
  suspendAuto() {
    if (!this.autoSuspended) {
      this.autoSuspended = true;
    }
  }

  setAutoSuspended(suspended: boolean) {
    this.autoSuspended = suspended;
  }

  /**
   * Takes one half of the order away from auto mode for the rest of this stop,
   * leaving the other half alone. A driver correcting the fuel has said nothing
   * about the tires, and the reverse holds just as well.
   */
  private claimFuelHalf() {
    this.autoFuelSent = true;
  }

  private claimTireHalf() {
    this.autoTiresSent = true;
  }

  setAutoHalvesSent(fuelSent: boolean, tiresSent: boolean) {
    this.autoFuelSent = fuelSent;
    this.autoTiresSent = tiresSent;
  }

  /** Whether the sim currently has this corner checked. */
  isCornerOrdered(corner: CornerPosition): boolean {
    return isCornerOrdered(corner, this.root.player.pitService);
  }

  get isFuelOrdered(): boolean {
    return this.root.player.pitService?.addFuel ?? false;
  }

  get isFastRepairOrdered(): boolean {
    return this.root.player.pitService?.fastRepair ?? false;
  }

  get isWindshieldOrdered(): boolean {
    return this.root.player.pitService?.cleanWindshield ?? false;
  }

  get areAllTiresOrdered(): boolean {
    return ALL_CORNERS.every((corner) => this.isCornerOrdered(corner));
  }

  /** Tank size for this car; the ceiling for every manual fuel change. */
  get fuelCapacityLiters(): number | null {
    return this.root.session.sessionInfo?.driverCarFuelMaxLtr ?? null;
  }

  /** Liters the sim currently has on the order, zero when fuel is unchecked. */
  get orderedFuelLiters(): number {
    const service = this.root.player.pitService;

    return service?.addFuel ? (service.fuelAmount ?? 0) : 0;
  }

  /** What the fuel bar shows: the live drag, or the sim when not dragging. */
  get fuelDisplayLiters(): number {
    return this.fuelDraftLiters ?? this.orderedFuelLiters;
  }

  /** One press of the manual step, in liters, matching the displayed unit. */
  get fuelStepLiters(): number {
    return this.root.units.unitSystem === 'metric'
      ? FUEL_STEP_L
      : LITERS_PER_GALLON;
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
    this.claimFuelHalf();

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
    this.claimFuelHalf();

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
   * Toggles one corner. Unchecking is the awkward direction: the SDK can only
   * clear all four at once, so the other ordered corners are re-sent right
   * after — at the pressure the sim reports for them, so an explicitly set
   * pressure survives the round trip.
   */
  async toggleTire(corner: CornerPosition) {
    this.claimTireHalf();

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
          orderedPressure(other, this.root.player.pitService) ?? 0
        ),
      })),
    ]);
  }

  async toggleAllTires() {
    this.claimTireHalf();

    if (this.areAllTiresOrdered) {
      await this.send([{ kind: 'clearTires', value: 0 }]);

      return;
    }

    await this.send(ALL_CORNERS.map((corner) => ({ kind: corner, value: 0 })));
  }

  async toggleFastRepair() {
    this.suspendAuto();

    await this.send([
      {
        kind: this.isFastRepairOrdered ? 'clearFastRepair' : 'fastRepair',
        value: 0,
      },
    ]);
  }

  async toggleWindshield() {
    this.suspendAuto();

    await this.send([
      {
        kind: this.isWindshieldOrdered ? 'clearWindshield' : 'windshield',
        value: 0,
      },
    ]);
  }

  /**
   * Orders exactly the fuel the calculation asks for, and hands the fuel half
   * back to auto mode — the inverse of a manual nudge, and the way out of one.
   *
   * Releasing the claim rather than setting it is the whole point: the driver
   * is saying "use the number you worked out", so a later recalculation on the
   * way in should still land. Useful with auto fuel off too, as a one-key
   * "fill what the fuel widget says".
   */
  async sendPlannedFuel() {
    const fuel = this.plannedFuelLiters;

    if (fuel === null || fuel <= 0) {
      return;
    }

    await this.send([{ kind: 'fuel', value: Math.ceil(fuel) }]);

    runInAction(() => {
      this.autoFuelSent = false;
    });
  }

  /**
   * Sends the planned order. Only ever reached from an explicit key press —
   * nothing in this store calls it on a telemetry transition.
   */
  async sendPlannedOrder() {
    this.suspendAuto();

    await this.send(this.plannedOrder);
  }

  /** Unchecks the whole pit order in the sim. */
  async sendClearOrder() {
    this.suspendAuto();

    await this.send([{ kind: 'clear', value: 0 }]);
  }

  // Every path into the sim goes through this method, so the result reporting
  // lives here rather than at each call site.
  private async send(requests: PitCommandRequest[]) {
    try {
      await invoke('send_pit_order', { requests });
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

  /**
   * Runs the stop clock off `serviceActive`, not off standing in the box: the
   * sim reports no service duration, and the crew starts and finishes on its
   * own schedule — the car sits in the stall both before and after that.
   */
  handleServiceActiveChange(serviceActive: boolean) {
    if (serviceActive === this.lastServiceActive) {
      return;
    }

    this.lastServiceActive = serviceActive;

    if (serviceActive) {
      this.stallEnteredAt = performance.now();
      this.stopElapsedS = 0;

      this.stopTimer = setInterval(() => {
        if (this.stallEnteredAt === null) return;

        this.setStopElapsed(
          (performance.now() - this.stallEnteredAt) / MS_IN_SECOND
        );
      }, STOP_TICK_MS);

      return;
    }

    this.clearStopTimer();

    if (this.stopElapsedS > 0) {
      this.lastStopDurationS = this.stopElapsedS;
    }

    this.stallEnteredAt = null;
  }

  private setStopElapsed(seconds: number) {
    this.stopElapsedS = seconds;
  }

  private clearStopTimer() {
    if (this.stopTimer !== null) {
      clearInterval(this.stopTimer);
      this.stopTimer = null;
    }
  }

  toggleManualShow() {
    this.manualShow = !this.manualShow;
  }

  /**
   * Called on every pit road transition so the panel can linger after exit.
   * Kept as an explicit call rather than a reaction — the timer is UI state.
   */
  handlePitRoadChange(onPitRoad: boolean) {
    if (onPitRoad === this.lastOnPitRoad) {
      return;
    }

    this.lastOnPitRoad = onPitRoad;

    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (onPitRoad) {
      this.lingering = false;

      return;
    }

    this.lingering = true;
    // A new lap starts a new decision: whatever the driver overrode belonged to
    // the stop that just ended.
    this.autoSuspended = false;
    this.autoFuelSent = false;
    this.autoTiresSent = false;

    this.hideTimer = setTimeout(() => {
      this.lingering = false;
      this.hideTimer = null;
    }, HIDE_DELAY_MS);
  }

  reset() {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.clearStopTimer();

    if (this.orderFeedbackTimer !== null) {
      clearTimeout(this.orderFeedbackTimer);
      this.orderFeedbackTimer = null;
    }

    this.lastOrderResult = null;
    this.fuelDraftLiters = null;
    this.autoSuspended = false;
    this.autoFuelSent = false;
    this.autoTiresSent = false;
    this.manualShow = false;
    this.lingering = false;
    this.lastOnPitRoad = false;
    this.lastServiceActive = false;
    this.stallEnteredAt = null;
    this.stopElapsedS = 0;
    this.lastStopDurationS = null;
  }
}
