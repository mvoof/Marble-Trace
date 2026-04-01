/**
 * Convenience hooks for accessing iRacing telemetry domain stores.
 *
 * Each hook returns the frame data from its corresponding MobX store.
 * Use these in observer() components for reactive updates.
 *
 * @see https://sajax.github.io/irsdkdocs/telemetry/
 * @see https://sajax.github.io/irsdkdocs/yaml/
 */
import {
  carDynamicsStore,
  carInputsStore,
  carStatusStore,
  environmentStore,
  lapTimingStore,
  sessionStore,
} from '../store/iracing';

/** Car dynamics: speed, rpm, gear, steering, g-forces, shift indicators */
export const useCarDynamics = () => carDynamicsStore.frame;

/** Driver inputs: throttle, brake, clutch pedal positions */
export const useCarInputs = () => carInputsStore.frame;

/** Vehicle status: fuel, engine temps, voltage, pit/track state */
export const useCarStatus = () => carStatusStore.frame;

/** Lap timing: current/last/best lap times, distances, race positions */
export const useLapTiming = () => lapTimingStore.frame;

/** Session state + parsed session info (driver/weekend data) */
export const useSession = () => ({
  frame: sessionStore.frame,
  sessionInfo: sessionStore.sessionInfo,
  driverInfo: sessionStore.driverInfo,
  weekendInfo: sessionStore.weekendInfo,
});

/** Environment conditions: air temp, weather */
export const useEnvironment = () => environmentStore.frame;

/** Shortcut: driver car info (RPM limits, fuel capacity, gear count, etc.) */
export const useDriverInfo = () => sessionStore.driverInfo;
