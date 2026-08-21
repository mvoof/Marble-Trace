//! Generation of the frontend contract: `src/types/bindings.ts` and the two
//! generated value files beside it.
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

/// Where the generated files go, relative to `src-tauri/`.
///
/// The types land in `src/types/`, which is the contract layer. The two value
/// files do not: a default and an event name are values, and `types/` holds
/// types. They go to `src/utils/`, which is where the frontend already keeps
/// its shared constants and which every layer above it may import — including
/// the widget manifests, whose shipped defaults are the reason these have to be
/// compile-time literals in the first place.
pub const BINDINGS_PATH: &str = "../src/types/bindings.ts";
pub const CONSTANTS_PATH: &str = "../src/utils/backend-constants.ts";
pub const EVENTS_PATH: &str = "../src/utils/backend-events.ts";

/// Every type the frontend may name, collected from the modules that declare
/// them.
pub fn collect_types() -> TypeCollection {
    let mut types = TypeCollection::default();

    crate::model::register_types(&mut types);
    crate::computations::register_types(&mut types);
    crate::sources::register_types(&mut types);
    crate::telemetry::register_types(&mut types);

    types
}

/// Writes all three generated files.
pub fn export() {
    Typescript::default()
        .export_to(BINDINGS_PATH, &collect_types())
        .unwrap();

    crate::model::defaults::export_constants(CONSTANTS_PATH).unwrap();
    crate::model::events::export_event_names(EVENTS_PATH).unwrap();
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

        export();
    }

    /// Cheap guard against an empty or half-built collection.
    #[test]
    fn the_collection_is_not_empty() {
        assert!(collect_types().into_iter().count() > 50);
    }
}
