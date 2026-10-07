import { comparer, reaction, type IReactionDisposer } from 'mobx';

import { setPitStrategySilent } from '@shared/api/pit.service';
import type { RendererCore } from '@store/roots/renderer-core';

// The fuel step keys move by the unit the driver reads: a liter, or a gallon's
// worth of liters — the sim itself only ever takes liters.
const LITERS_PER_STEP_METRIC = 1;
const LITERS_PER_GALLON = 3.785412;

/**
 * The main window's half of the pit service: telling the telemetry thread the
 * rules. Auto mode decides there (`computations/pit_auto.rs`), and the pit keys
 * are resolved there too (`computations/pit_actions.rs`).
 *
 * Registered after hydration, so the strategy pushed first is the user's rather
 * than the shipped defaults.
 */
export const registerPitServiceMainReactions = (
  root: RendererCore
): IReactionDisposer[] => [
  // The backend keeps the strategy across stream restarts, so one push per
  // change is enough. Whether the widget is on screen goes with it: auto mode
  // never orders for a widget the driver removed from the layout.
  reaction(
    () => ({
      autoFuel: root.appSettings.appSettings.pitAutoFuel,
      autoTires: root.appSettings.appSettings.pitAutoTires,
      tireWearThresholdPct:
        root.appSettings.appSettings.pitAutoTireWearThreshold,
      fuelStepLiters:
        root.appSettings.appSettings.pitFuelAdjustStep *
        (root.units.unitSystem === 'metric'
          ? LITERS_PER_STEP_METRIC
          : LITERS_PER_GALLON),
      widgetOnScreen: root.liveWidgets.isWidgetOnScreen('pit-service'),
    }),
    (strategy) => setPitStrategySilent(strategy),
    { equals: comparer.structural, fireImmediately: true }
  ),
];
