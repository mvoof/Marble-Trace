/**
 * POV hats are reported as synthetic button indices so a binding stays a flat
 * integer. Mirrors `POV_BUTTON_BASE` in src-tauri/src/input/dinput.rs — the two
 * must agree or hat bindings would be labelled as ordinary buttons.
 */
export const POV_BUTTON_BASE = 1000;
export const POV_DIRECTION_COUNT = 4;
