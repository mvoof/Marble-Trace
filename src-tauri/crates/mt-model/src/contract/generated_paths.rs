//! Where the generated frontend contract files are written: `bindings.ts`
//! by `bindings.rs`, the `ts_values!` files by the modules that declare them,
//! whose tests also read them back.

/// Where the generated files go.
///
/// Anchored on `CARGO_MANIFEST_DIR` (baked in at compile time) rather than a
/// path relative to the process's cwd: `export()` runs at app setup whenever
/// the `dev` feature is on, including in a `tauri:build:dev` binary launched
/// from anywhere — a relative `../src/...` only resolved because `cargo
/// run`/`tauri dev` happen to set cwd to `src-tauri/`, and panicked on
/// `NotFound` the moment that stopped being true.
///
/// Everything generated lands in `src/shared/contracts/generated/`, inside the
/// contract layer every other layer may import: the specta types and the
/// `ts_values!` value files alike — a default, an event name and a mask bit
/// are compile-time literals the widget manifests read at import time.
pub const BINDINGS_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../src/shared/contracts/generated/bindings.ts"
);
pub const CONSTANTS_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../src/shared/contracts/generated/backend-constants.ts"
);
pub const EVENTS_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../src/shared/contracts/generated/backend-events.ts"
);
/// The bindable actions, declared in `model/hotkeys.rs`.
pub const HOTKEY_ACTIONS_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../src/shared/contracts/generated/hotkey-actions.ts"
);
pub const TELEMETRY_EVENT_BITS_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../src/shared/contracts/generated/telemetry-event-bits.ts"
);
