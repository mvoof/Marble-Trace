// Generated from Rust by `ts_values!` (src-tauri/src/model/ts_values.rs), the
// value generator that runs alongside specta's type export. Specta writes
// `bindings.ts` and only handles types; these are values, so they come from
// here. Edit the Rust declaration, not this file.

/**
 * The full telemetry bundle, one per tick. Only windows that draw widgets
 * subscribe: Tauri delivers an event solely to webviews holding a
 * listener, so the main window pays nothing for 60 Hz it does not render.
 */
export const SIM_TELEMETRY_BUNDLE = 'sim://telemetry/bundle';

/**
 * A 4 Hz slice for windows that do not take the bundle. The main window
 * drives layout auto-switching off `is_on_track` and the automatic pit
 * order off the fuel calculation and the sim's own order — subscribing it
 * to 60 Hz telemetry to read four frames at four hertz is not the way to
 * get them.
 */
export const SIM_TELEMETRY_SLOW = 'sim://telemetry/slow';

/**
 * The parsed session snapshot, re-emitted whenever the sim's session
 * string changes.
 */
export const SIM_SESSION = 'sim://session';

/**
 * Weather forecast entries for the session.
 */
export const SIM_WEATHER = 'sim://weather';

/**
 * Which sim is connected, and whether it is running.
 */
export const SIM_STATUS = 'sim://status';

/**
 * The sim's own performance counters. Deliberately not part of the
 * telemetry bundle: the FPS diagnostics runner is the only consumer, it
 * lives in the main window, and folding these into the bundle would force
 * that window to subscribe to 60 Hz telemetry it otherwise has no use for
 * — and would hide the cost of that subscription from the very tool meant
 * to measure it.
 */
export const SIM_PERF = 'sim://perf';

/**
 * The sim went away. Clears every data store.
 */
export const SIM_DISCONNECTED = 'sim://disconnected';

/**
 * What the connected sim can and cannot report, so a widget can hide a
 * field the sim does not have rather than draw an empty one.
 */
export const SIM_CAPABILITIES = 'sim://capabilities';

/**
 * The recorded shape of the current track. Emitted once per track change,
 * which is why a window that subscribes later pulls it instead.
 */
export const SIM_TRACK_SHAPE = 'sim://track-shape';

/**
 * A new or replaced reference lap is available for this track and car.
 */
export const SIM_REFERENCE_LAP_UPDATED = 'sim://reference-lap/updated';

/**
 * One normalized chat message. Emitted per message, so the frontend
 * appends. Stream chat rides its own namespace on purpose: it keeps
 * running with no sim connected at all.
 */
export const CHAT_MESSAGE = 'chat://message';

/**
 * Per-platform status and viewer count. Slow cadence, replaces previous
 * state.
 */
export const CHAT_PRESENCE = 'chat://presence';

/**
 * A row must disappear — a moderator deleted a message or banned an
 * author.
 */
export const CHAT_DELETION = 'chat://deletion';

/**
 * The set of attached game controllers changed.
 */
export const INPUT_DEVICES_EVENT = 'input://devices';

/**
 * A controller button edge, for the global input bindings.
 */
export const INPUT_BUTTON_EVENT = 'input://button';

/**
 * A connected remote device came, went, or reported a new viewport.
 */
export const REMOTE_DEVICE_EVENT = 'remote://device';
