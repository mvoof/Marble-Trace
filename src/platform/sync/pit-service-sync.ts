import { comparer, reaction, type IReactionDisposer } from 'mobx';

import { emitPitServiceReveal } from '@platform/services/events.service';
import { setPitStrategySilent } from '@platform/services/pit.service';
import type { RendererCore } from '@store/renderer-core';

/**
 * The main window's half of the pit service. Auto mode itself decides on the
 * telemetry thread (`computations/pit_auto.rs`); what is left here is telling
 * it the rules and confirming the hotkeys on the overlay.
 *
 * Registered after hydration, so the strategy pushed first is the user's rather
 * than the shipped defaults.
 */
export const registerPitServiceMainReactions = (
  root: RendererCore
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
  // The backend keeps the strategy across stream restarts, so one push per
  // change is enough. Whether the widget is on screen goes with it: auto mode
  // never orders for a widget the driver removed from the layout.
  reaction(
    () => ({
      autoFuel: root.appSettings.appSettings.pitAutoFuel,
      autoTires: root.appSettings.appSettings.pitAutoTires,
      tireWearThresholdPct:
        root.appSettings.appSettings.pitAutoTireWearThreshold,
      widgetOnScreen: root.liveWidgets.isWidgetOnScreen('pit-service'),
    }),
    (strategy) => setPitStrategySilent(strategy),
    { equals: comparer.structural, fireImmediately: true }
  ),
];
