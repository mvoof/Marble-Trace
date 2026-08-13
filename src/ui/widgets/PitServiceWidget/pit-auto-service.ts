import { makeAutoObservable } from 'mobx';

import type { PitCommandRequest } from '@/types/bindings';
import type { CornerPosition } from '@ui/widgets/PitServiceWidget/pit-service-utils';
import {
  ALL_CORNERS,
  cornerWorstWear,
  cornersBelowWearThreshold,
} from '@ui/widgets/PitServiceWidget/pit-service-utils';
import type { PitServiceWidgetStore } from '@ui/widgets/PitServiceWidget/pit-service.widget';

/**
 * Auto mode: what the widget orders on the driver's behalf, and when it stands
 * down.
 *
 * The two halves — fuel and tires — are tracked separately throughout. They are
 * sent at different moments (pit entry vs. arrival in the box, because tire wear
 * is not readable before that) and the driver can take over one without saying
 * anything about the other.
 */
export class PitAutoService {
  /**
   * Auto mode is switched off, and stays off until the driver switches it back
   * on. Only the auto-mode key sets this — a driver who reaches for that key
   * has made a decision about the strategy, not about this one stop, so pit
   * exit deliberately leaves it alone. The per-stop overrides are the two
   * take-over flags below, and those are the ones a new lap clears.
   *
   * Public because both windows have to agree on it: the checkboxes are
   * clicked in the overlay and the hotkeys fire in main, and the badge is read
   * in the overlay — the sync layer mirrors the flag between them.
   */
  autoSuspended = false;

  /**
   * Whether the driver has taken each half of the order over by hand for the
   * rest of this stop. Two flags rather than one so the halves are independent:
   * nudging the fuel by a liter is the most ordinary thing a driver does on the
   * way in, and it has no business switching off the tire decision as well.
   *
   * Deliberately not the same thing as "auto mode has already sent this half".
   * Both stop auto mode from acting again, but only this one means the stop is
   * no longer automatic — folding them together made the header plate read
   * MANUAL the moment auto mode successfully did its job.
   *
   * Public for the same reason as `autoSuspended`: clicks land in the overlay,
   * hotkeys in main, and the plate is read in the overlay.
   */
  fuelTakenOver = false;

  tiresTakenOver = false;

  // Whether auto mode has already dispatched each half this stop. Only ever
  // read where the reactions run, so unlike the take-over flags these are not
  // mirrored to the overlay.
  private autoFuelSent = false;
  private autoTiresSent = false;

  // Whether the order the sim armed on its own has already been wiped this
  // stint. One clear per stint: after it, an order the driver builds by hand is
  // theirs, and re-clearing it every time the flags moved would be a fight.
  private selfArmedCleared = false;

  constructor(private readonly store: PitServiceWidgetStore) {
    makeAutoObservable(this, {}, { autoBind: true });
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
    return this.store.root.widgetSettings.isWidgetInActiveLayout('pit-service');
  }

  get isAutoFuelEnabled(): boolean {
    return this.store.settings.autoFuel;
  }

  get isAutoTiresEnabled(): boolean {
    return this.store.settings.autoTires;
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
    return this.isAutoActive && this.isAutoFuelEnabled && !this.fuelTakenOver;
  }

  get isAutoTiresPending(): boolean {
    return this.isAutoActive && this.isAutoTiresEnabled && !this.tiresTakenOver;
  }

  /**
   * What the header plate says: which parts of the stop auto mode is still
   * going to decide. Naming what is left automatic rather than what was taken
   * over is the useful direction — the driver already knows what they touched,
   * and what they want back from the plate is what they can still stop
   * thinking about.
   *
   * Null while auto mode is switched off in the settings: the order is manual
   * by definition then, and a permanent plate would say nothing.
   */
  get autoModeLabel(): 'AUTO' | 'FUEL AUTO' | 'TIRE AUTO' | 'MANUAL' | null {
    if (!this.isAutoEnabled) {
      return null;
    }

    if (this.isAutoFuelPending && this.isAutoTiresPending) {
      return 'AUTO';
    }

    if (this.isAutoFuelPending) {
      return 'FUEL AUTO';
    }

    if (this.isAutoTiresPending) {
      return 'TIRE AUTO';
    }

    return 'MANUAL';
  }

  /**
   * Every wear number as one value, so a reaction can watch the whole set for
   * the refresh the sim performs on arrival in the box. Reactions cannot watch
   * twelve fields without either twelve disposers or a deep observer, and this
   * is the only thing anything needs to know about them changing.
   */
  get tireWearSignature(): string {
    const frame = this.store.root.player.chassis;

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
    return !this.store.isInPitStall;
  }

  /**
   * Corners auto mode considers finished. Recomputed on read, so the settings
   * panel slider and the tire grid always agree with what the next entry would
   * order.
   */
  get autoTireCorners(): CornerPosition[] {
    if (!this.store.settings.autoTires) {
      return [];
    }

    return cornersBelowWearThreshold(
      this.store.root.player.chassis,
      this.store.settings.autoTireWearThreshold
    );
  }

  /**
   * The first half of the automatic order, sent on pit road entry: the
   * calculated fuel, and nothing else.
   *
   * Deliberately `clearFuel` rather than a full `clear`. There may well be an
   * order standing by the time the car reaches pit road — the driver's, or the
   * set the sim arms on exit — and a full clear wipes all of it, including the
   * tires, which this half has no
   * business deciding on, because tire wear is not readable yet on pit road.
   * Fast repair and the windshield are left alone for the same reason: auto
   * mode does not own them.
   */
  get autoFuelOrder(): PitCommandRequest[] {
    if (!this.store.settings.autoFuel) {
      return [];
    }

    const fuel = this.store.order.plannedFuelLiters;

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
   * Wipes the order the sim arms by itself the moment the car leaves the box.
   *
   * On pit exit the sim checks a service set of its own: measured at 0→63 and
   * 0→111 on two separate exits, and reported by hand as all four corners plus
   * fuel even when the stop was ordered with less. It is not the previous
   * order, the two exits did not match each other, and the rule behind it is
   * not known — what is constant is that all four corners come back.
   *
   * Auto mode used to fight that at the box, one second before the crew
   * commits; doing it here instead moves the whole argument to a point in the
   * lap where nothing is under time pressure, and leaves the box arrival with
   * nothing to do but tick the corners it wants.
   *
   * Of the two halves, only the ones auto mode owns are cleared. With auto mode
   * off nothing is cleared at all: the armed order is then something the driver
   * may well be counting on, and taking it away without being asked is exactly
   * the surprise this widget must not spring.
   *
   * Fast repair and the windshield are cleared whenever this runs, even though
   * auto mode never orders them. Not ordering them and not removing them are
   * different rules: the sim ticks the windshield on every exit, and leaving it
   * there means a tear-off on every stop that nobody chose. Wiping what was
   * imposed is not the same as deciding.
   */
  async clearSelfArmedOrder() {
    if (this.selfArmedCleared || !this.isAutoActive) {
      return;
    }

    // With both halves auto mode's, the whole order is going anyway, and the
    // SDK has no batch form — one `clear` instead of four broadcasts. The
    // itemised form is kept for the case that makes `clear` wrong: this also
    // runs on app start and when auto mode is switched on mid-stint, where the
    // half auto does not own may hold work the driver did by hand.
    const order: PitCommandRequest[] =
      this.isAutoFuelPending && this.isAutoTiresPending
        ? [{ kind: 'clear', value: 0 }]
        : this.itemisedSelfArmedClear();

    if (order.length === 0) {
      return;
    }

    this.selfArmedCleared = true;

    await this.store.order.send(order);
  }

  /**
   * The half auto mode owns, plus the two boxes the sim imposes. Empty when
   * neither half is auto mode's — there is then nothing to wipe, and the
   * imposed boxes are left with the rest of an order this widget is not
   * touching.
   */
  private itemisedSelfArmedClear(): PitCommandRequest[] {
    const order: PitCommandRequest[] = [];

    if (this.isAutoFuelPending) {
      order.push({ kind: 'clearFuel', value: 0 });
    }

    if (this.isAutoTiresPending) {
      order.push({ kind: 'clearTires', value: 0 });
    }

    if (order.length === 0) {
      return order;
    }

    order.push(
      { kind: 'clearWindshield', value: 0 },
      { kind: 'clearFastRepair', value: 0 }
    );

    return order;
  }

  /**
   * Sends the fuel half. Called once per pit road entry, from the main window
   * only — two windows running the same telemetry would otherwise broadcast the
   * order twice.
   */
  async applyAutoFuelOrder() {
    if (!this.isAutoFuelPending || this.autoFuelSent) {
      return;
    }

    const order = this.autoFuelOrder;

    if (order.length === 0) {
      return;
    }

    this.autoFuelSent = true;

    await this.store.order.send(order);
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
    if (!this.isAutoTiresPending || this.autoTiresSent) {
      return;
    }

    this.autoTiresSent = true;

    await this.store.order.send(this.autoTireOrder);
  }

  setAutoSuspended(suspended: boolean) {
    this.autoSuspended = suspended;
  }

  /**
   * Hands the whole stop back to auto mode, halves included.
   *
   * Clearing the claims is the point: a driver pressing "auto" after correcting
   * the fuel by hand is asking for the order to be worked out again, and
   * leaving the half they touched claimed would give them a key that reports
   * auto mode is on while it quietly declines to do the thing they asked for.
   */
  resumeAuto() {
    this.autoSuspended = false;
    this.fuelTakenOver = false;
    this.tiresTakenOver = false;
    this.autoFuelSent = false;
    this.autoTiresSent = false;
  }

  /**
   * The auto mode key. It reads off what the header plate says rather than off
   * `autoSuspended` alone: anything short of a fully automatic stop — suspended
   * outright, or one half taken over by hand — goes back to `AUTO` on a press.
   * Only from `AUTO` does the key hand the stop to the driver.
   *
   * Toggling on `autoSuspended` alone would strand the half-manual states: with
   * the fuel corrected by hand the plate reads `TIRE AUTO`, and a key labelled
   * "auto mode" would suspend rather than restore.
   */
  toggleAutoSuspended() {
    // Sends nothing, so it has to ask for the reveal itself — but handing the
    // stop over is exactly the kind of press worth seeing confirmed.
    this.store.panel.revealAfterCommand();

    if (this.autoModeLabel === 'AUTO') {
      this.autoSuspended = true;

      return;
    }

    this.resumeAuto();
  }

  /**
   * Takes one half of the order away from auto mode for the rest of this stop,
   * leaving the other half alone. A driver correcting the fuel has said nothing
   * about the tires, and the reverse holds just as well.
   */
  claimFuelHalf() {
    this.fuelTakenOver = true;
  }

  claimTireHalf() {
    this.tiresTakenOver = true;
  }

  setHalvesTakenOver(fuel: boolean, tires: boolean) {
    this.fuelTakenOver = fuel;
    this.tiresTakenOver = tires;
  }

  /**
   * Pit road entry: arm the one self-armed clear this stint gets, so the next
   * exit is wiped again.
   */
  armSelfArmedClear() {
    this.selfArmedCleared = false;
  }

  /**
   * Pit exit: a new lap starts a new decision, so whatever the driver overrode
   * belonged to the stop that just ended. `autoSuspended` is not one of those —
   * it is the off switch, and pit exit silently flipping it back on was
   * reported as the widget "putting itself into auto" on the way out of the box.
   */
  clearStopOverrides() {
    this.fuelTakenOver = false;
    this.autoFuelSent = false;
    this.tiresTakenOver = false;
    this.autoTiresSent = false;
  }

  reset() {
    this.autoSuspended = false;
    this.selfArmedCleared = false;
    this.clearStopOverrides();
  }
}
