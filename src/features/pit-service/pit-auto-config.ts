import type { PitAutoConfig } from '@shared/contracts/bindings';
import type { UnitSystem } from '@shared/contracts/domain';
import type { PitStrategy } from '@shared/contracts/pit-strategy';

// The fuel step keys move by the unit the driver reads: a liter, or a gallon's
// worth of liters — the sim itself only ever takes liters.
const LITERS_PER_STEP_METRIC = 1;
const LITERS_PER_GALLON = 3.785412;

/**
 * The rules the telemetry thread runs the pit service by. Auto mode decides
 * there (`computations/pit_auto.rs`), and the pit keys are resolved there too
 * (`computations/pit_actions.rs`). Whether the widget is on screen goes with
 * them: auto mode never orders for a widget the driver removed from the layout.
 */
export const pitAutoConfigOf = (
  strategy: PitStrategy,
  unitSystem: UnitSystem,
  widgetOnScreen: boolean
): PitAutoConfig => ({
  autoFuel: strategy.pitAutoFuel,
  autoTires: strategy.pitAutoTires,
  tireWearThresholdPct: strategy.pitAutoTireWearThreshold,
  fuelStepLiters:
    strategy.pitFuelAdjustStep *
    (unitSystem === 'metric' ? LITERS_PER_STEP_METRIC : LITERS_PER_GALLON),
  widgetOnScreen,
});
