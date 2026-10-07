// Generated from Rust by `ts_values!` (src-tauri/src/model/ts_values.rs), the
// value generator that runs alongside specta's type export. Specta writes
// `bindings.ts` and only handles types; these are values, so they come from
// here. Edit the Rust declaration, not this file.

/**
 * The player car's 60 Hz motion: G forces, yaw, velocities.
 */
export const carDynamics = 1;

/**
 * The player's 60 Hz pedal, wheel and gear inputs.
 */
export const carInputs = 2;

/**
 * The 60 Hz live delta to the chosen reference lap.
 */
export const lapDelta = 4;

/**
 * Every car's 60 Hz position on the lap.
 */
export const carPositions = 8;

/**
 * The heavy per-car standings rows. Like the two below, computed on every
 * due tick no matter what — their processors carry state — but a frame
 * nobody reads is left out of the bundle rather than serialized, shipped
 * to every window and remote screen, parsed there and written into a store.
 */
export const driverEntries = 16;

/**
 * The cars just ahead of and behind the player, by track position.
 */
export const relative = 32;

/**
 * Cars alongside the player, for the radars.
 */
export const proximity = 64;

/**
 * Where on the lap cars are stopped or off track — the warning zones the
 * track map draws.
 */
export const incidents = 128;

/**
 * The driving coach's call against the reference lap. Computed on every
 * tick so the latch survives the coach being switched off and on again.
 */
export const coach = 256;
