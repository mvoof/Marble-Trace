//! Generation of the frontend contract:
//! `src/shared/contracts/generated/bindings.ts` and the generated value files
//! beside it.
//!
//! This used to sit inline in `run()`, together with thirty `#[cfg(feature =
//! "dev")] use` lines that existed for no other reason. Moving it here does two
//! things: `lib.rs` goes back to being about wiring up the app, and the export
//! becomes a function that can be *called* — which is what lets a test check
//! that the checked-in files still match, instead of the whole contract
//! silently depending on somebody having run `npm run tauri:dev` recently.
//!
//! Each module registers its own types in a `register_types` of its own, so a
//! new type is declared and registered in the same file. A type that is only
//! reachable through another registered one does not need a line here — specta
//! pulls in dependencies — but registering it anyway is what keeps it in the
//! output when the last reference to it moves.

use specta::TypeCollection;
use specta_typescript::Typescript;

use mt_model::generated_paths::{
    BINDINGS_PATH, CONSTANTS_PATH, EVENTS_PATH, HOTKEY_ACTIONS_PATH, TELEMETRY_EVENT_BITS_PATH,
};

/// Every type the frontend may name, collected from the modules that declare
/// them.
pub fn collect_types() -> TypeCollection {
    let mut types = TypeCollection::default();

    mt_model::register_types(&mut types);
    mt_computations::register_types(&mut types);
    mt_source::register_types(&mut types);
    mt_telemetry::register_types(&mut types);
    crate::perf_run::register_types(&mut types);

    types
}

/// Prefixes an export error with the file it was writing.
fn at_path<E: std::fmt::Display>(path: &'static str) -> impl FnOnce(E) -> String {
    move |error| format!("{path}: {error}")
}

/// Writes every generated file.
///
/// Fails with the path of the first file that could not be written (a locked
/// or read-only file in `generated/`) instead of panicking: a stale contract
/// still shows in the diff and in the `ts_values!` tests.
pub fn export() -> Result<(), String> {
    Typescript::default()
        .export_to(BINDINGS_PATH, &collect_types())
        .map_err(at_path(BINDINGS_PATH))?;

    mt_model::defaults::export_constants(CONSTANTS_PATH).map_err(at_path(CONSTANTS_PATH))?;
    mt_model::events::export_event_names(EVENTS_PATH).map_err(at_path(EVENTS_PATH))?;
    mt_model::telemetry_events::export_telemetry_event_bits(TELEMETRY_EVENT_BITS_PATH)
        .map_err(at_path(TELEMETRY_EVENT_BITS_PATH))?;
    mt_model::hotkeys::export_hotkey_actions(HOTKEY_ACTIONS_PATH)
        .map_err(at_path(HOTKEY_ACTIONS_PATH))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Regeneration entry point rather than an assertion.
    ///
    /// The checked-in `bindings.ts` is `oxfmt`-formatted after generation, so
    /// comparing it byte-for-byte against fresh specta output would fail on
    /// formatting alone. What the generated *values* carry is checked in
    /// `model::defaults` and `model::events`, where formatting cannot move a
    /// string literal.
    ///
    /// Run with `UPDATE_BINDINGS=1 cargo test --features dev`, then
    /// `npm run format`.
    #[test]
    fn regenerates_the_contract_on_demand() {
        if std::env::var("UPDATE_BINDINGS").is_err() {
            return;
        }

        export().expect("contract export failed");
    }

    /// Cheap guard against an empty or half-built collection.
    #[test]
    fn the_collection_is_not_empty() {
        assert!(collect_types().into_iter().count() > 50);
    }
}
