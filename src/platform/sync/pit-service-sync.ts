import { comparer, reaction, type IReactionDisposer } from 'mobx';

import {
  emitPitServiceAutoSuspended,
  emitPitServiceHalvesTakenOver,
  emitPitServiceReveal,
} from '@platform/services/events.service';
import type { RootStore } from '@store/root-store';

/**
 * Which halves of the pit order the driver has taken over, mirrored to the
 * other window. Registered in BOTH windows: the checkboxes are clicked in the
 * overlay and the hotkeys fire in main, so either can be the one that suspends.
 *
 * No temporal precondition — safe to register at any point after the stores
 * exist.
 */
export const registerPitServiceMirrorReactions = (
  root: RootStore
): IReactionDisposer[] => [
  reaction(
    () => root.pitServiceWidget.auto.autoSuspended,
    (suspended) => {
      void emitPitServiceAutoSuspended(suspended);
    }
  ),
  reaction(
    () => ({
      fuel: root.pitServiceWidget.auto.fuelTakenOver,
      tires: root.pitServiceWidget.auto.tiresTakenOver,
    }),
    (halves) => {
      void emitPitServiceHalvesTakenOver(halves);
    },
    { equals: comparer.structural }
  ),
];

/**
 * The automatic order, sent from the MAIN window only: both windows run the
 * same telemetry, so an overlay copy of these would broadcast every order a
 * second time.
 *
 * Registered after hydration so the pit-service widget's settings (auto fuel /
 * auto tires) are the user's rather than the shipped defaults — one of these
 * reactions is `fireImmediately`.
 */
export const registerPitServiceAutoReactions = (
  root: RootStore
): IReactionDisposer[] => [
  // One emit per command rather than per change of the flag: pressing a
  // second key while the panel is already up has to restart the overlay's
  // countdown too, and a boolean has no edge left to carry that.
  reaction(
    () => root.pitServiceWidget.panel.commandRevealNonce,
    () => {
      void emitPitServiceReveal();
    }
  ),
  // The order goes out in two halves because the sim answers the two questions
  // at different moments — the fuel calculation is ours and ready on pit entry,
  // while tire wear is only refreshed once the car is in the box.
  reaction(
    () => root.pitServiceWidget.isOnPitRoad,
    (onPitRoad) => {
      if (onPitRoad) {
        void root.pitServiceWidget.auto.applyAutoFuelOrder();
      }
    }
  ),
  // Watches the flags rather than pit exit itself. The sim arms the previous
  // order as the car leaves, and both land inside the same 4 Hz sample, so "on
  // exit" cannot say which happened first — a clear sent on the transition can
  // beat the arming and wipe nothing. The order appearing is unambiguous, and
  // off pit road it can only be the sim.
  //
  // Both values are watched, not just the flags: which of the two moves first
  // is not fixed, and a reaction on the flags alone silently loses the case
  // where the order is armed while the car still counts as on pit road — the
  // later pit-road edge is no change to the flags, so nothing would re-run the
  // check. The two pending flags are tracked as well, so switching auto mode on
  // mid-stint clears an order that is already standing — and `fireImmediately`
  // covers the case where one is standing before this reaction ever exists,
  // which is every app start and every reload of this window.
  reaction(
    () => ({
      flags: root.pitServiceWidget.order.simArmedFlags,
      onPitRoad: root.pitServiceWidget.isOnPitRoad,
      fuelPending: root.pitServiceWidget.auto.isAutoFuelPending,
      tiresPending: root.pitServiceWidget.auto.isAutoTiresPending,
    }),
    ({ flags, onPitRoad }) => {
      if (flags !== 0 && !onPitRoad) {
        void root.pitServiceWidget.auto.clearSelfArmedOrder();
      }
    },
    { equals: comparer.structural, fireImmediately: true }
  ),
  // Three separate signals for the same moment, because their order is not
  // fixed: arriving in the box, the crew starting, and the wear numbers
  // refreshing have each been observed first. The tire half is idempotent per
  // stop, so the earliest one wins and the rest are no-ops.
  reaction(
    () => root.pitServiceWidget.isInPitStall,
    (inPitStall) => {
      if (inPitStall) {
        void root.pitServiceWidget.auto.applyAutoTireOrder();
      }
    }
  ),
  reaction(
    () => root.pitServiceWidget.isServiceActive,
    (serviceActive) => {
      if (serviceActive) {
        void root.pitServiceWidget.auto.applyAutoTireOrder();
      }
    }
  ),
  // A wear refresh only ever happens on arrival in the box, so on pit road it
  // is the arrival — and it is the signal that the threshold check has
  // something current to read, which the flags do not promise.
  reaction(
    () => root.pitServiceWidget.auto.tireWearSignature,
    () => {
      if (root.pitServiceWidget.isOnPitRoad) {
        void root.pitServiceWidget.auto.applyAutoTireOrder();
      }
    }
  ),
];
