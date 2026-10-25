//! iRacing source adapter (kerb IRsdkConnection)

// The app's lint block (`src-tauri/src/lib.rs` says why it is not in `[lints]`).
#![deny(unsafe_op_in_unsafe_fn)]
#![deny(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::undocumented_unsafe_blocks,
    clippy::missing_safety_doc
)]
#![warn(clippy::multiple_unsafe_ops_per_block)]

pub mod car_badges;
pub mod car_classes;
pub mod flags;
pub mod frame_map;
pub mod pit_command;
pub mod session_parse;
pub mod source;
pub mod weather;

#[cfg(feature = "dev")]
use mt_source::SessionParsers;

/// How iRacing's session YAML is read, for a tape recorded from iRacing.
#[cfg(feature = "dev")]
pub const SESSION_PARSERS: SessionParsers = SessionParsers {
    session: session_parse::parse_session,
    tree: session_parse::session_tree,
};
