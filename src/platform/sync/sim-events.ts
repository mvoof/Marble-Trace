export const SIM_TELEMETRY_BUNDLE = 'sim://telemetry/bundle';
export const SIM_SESSION = 'sim://session';
export const SIM_WEATHER = 'sim://weather';
export const SIM_STATUS = 'sim://status';
export const SIM_PERF = 'sim://perf';
export const SIM_TELEMETRY_SLOW = 'sim://telemetry/slow';
export const SIM_DISCONNECTED = 'sim://disconnected';
export const SIM_CAPABILITIES = 'sim://capabilities';
export const SIM_TRACK_SHAPE = 'sim://track-shape';
export const SIM_REFERENCE_LAP_UPDATED = 'sim://reference-lap/updated';
export const TRACK_MAP_CLEAR = 'track-map:clear';

// Stream chat lives outside the sim:// namespace — it keeps running with no
// sim connected at all.
// Game controllers, for global input bindings. Emitted by src-tauri/src/input.
export const INPUT_DEVICES_EVENT = 'input://devices';
export const INPUT_BUTTON_EVENT = 'input://button';

export const CHAT_MESSAGE = 'chat://message';
export const CHAT_PRESENCE = 'chat://presence';
export const CHAT_DELETION = 'chat://deletion';
