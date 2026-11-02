//! The voice crew: the driver holds a button, says a command or a question, and
//! the engineer answers out loud. Everything runs offline; the speech engines
//! and their models are downloaded on demand, never bundled.
//!
//! Knows nothing about a sim — what a command does to the car is decided by the
//! app on the telemetry thread, from the intent this crate recognises.

pub mod assets;
pub mod cache;
pub mod capture;
pub mod crew;
pub mod folder;
pub mod pack;
pub mod pack_files;
pub mod piper;
pub mod playback;
pub mod queue;
pub mod voice_in;
pub mod voice_out;
pub mod vosk;
