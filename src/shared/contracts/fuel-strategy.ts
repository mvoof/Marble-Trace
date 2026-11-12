import {
  DEFAULT_PIT_WARNING_LAPS,
  FUEL_AVG_WINDOW_ALL_LAPS,
} from '@shared/contracts/generated/backend-constants';

/**
 * How the fuel figures are worked out — app-level, because the backend
 * computes fuel once for the car and sends the same frame to every screen: two
 * Fuel widgets cannot average over two different windows. Kept in
 * `appSettings` and mirrored to the overlays and remote screens as one value.
 */
export interface FuelStrategy {
  /** Laps of fuel left at which the widget warns and the pit window opens. */
  fuelPitWarningLaps: number;
  /** Laps averaged for consumption; `FUEL_AVG_WINDOW_ALL_LAPS` is every lap. */
  fuelAvgWindow: number;
  /** Count laps under a local yellow; full-course cautions are always dropped. */
  fuelCountYellowFlagLaps: boolean;
}

export const DEFAULT_FUEL_STRATEGY: FuelStrategy = {
  fuelPitWarningLaps: DEFAULT_PIT_WARNING_LAPS,
  fuelAvgWindow: FUEL_AVG_WINDOW_ALL_LAPS,
  fuelCountYellowFlagLaps: false,
};

export const FUEL_PIT_WARNING_LAPS_MIN = 1;
export const FUEL_PIT_WARNING_LAPS_MAX = 20;
