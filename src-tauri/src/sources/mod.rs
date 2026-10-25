//! Sim source adapters — the only layer allowed to import kerb.
//! Each sim contributes one adapter that fills the normalized `model` types.

pub mod iracing;
pub mod raw;
#[cfg(feature = "dev")]
pub mod replay;
pub mod source;
#[cfg(feature = "dev")]
pub mod tape;

/// The adapted frame and the sim's own data, which the telemetry inspector
/// reads whole.
#[cfg(feature = "dev")]
pub fn register_types(types: &mut specta::TypeCollection) {
    types.register::<source::SourceFrame>();
    types.register::<raw::RawVarMeta>();
    types.register::<raw::RawValue>();
    types.register::<raw::RawSession>();
}
