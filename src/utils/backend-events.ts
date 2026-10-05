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
 * A 4 Hz slice for windows that do not take the bundle: the player's car
 * status, which the main window's layout auto-switch reads `is_on_track`
 * off. Subscribing main to 60 Hz telemetry for one flag at four hertz is
 * not the way to get it.
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
 * The overlay's drag and interact modes changed. The hotkey dispatcher
 * owns them; every window mirrors them.
 */
export const OVERLAY_MODES_EVENT = 'app://overlay-modes';

/**
 * A settings action's key fired. Sent to the main window only, which owns
 * the settings it writes.
 */
export const HOTKEY_SETTINGS_ACTION_EVENT = 'hotkey://settings-action';

/**
 * The standings class hotkeys, to the overlays: one class forward or back.
 */
export const STANDINGS_CLASS_STEP_EVENT = 'standings-class-step';

/**
 * The standings scroll hotkeys, to the overlays: rows to move by.
 */
export const STANDINGS_SCROLL_EVENT = 'standings-scroll';

/**
 * The chat scroll hotkeys, to the overlays: rows to move by.
 */
export const STREAM_CHAT_SCROLL_EVENT = 'stream-chat-scroll';

/**
 * The pit service key, to the overlays: pop the order box up or down.
 */
export const PIT_SERVICE_TOGGLE_EVENT = 'pit-service-toggle';

/**
 * A perf run's measured span starts: the overlays begin collecting.
 * Emitted only by a `dev` build running `MARBLE_TRACE_PERF`.
 */
export const PERF_BEGIN = 'perf://begin';

/**
 * A perf run's measured span is over: each overlay sends its report.
 */
export const PERF_END = 'perf://end';

/**
 * A connected remote device came, went, or reported a new viewport.
 */
export const REMOTE_DEVICE_EVENT = 'remote://device';
