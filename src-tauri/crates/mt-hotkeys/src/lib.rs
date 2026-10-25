//! What a pressed key means: the binding map, the actions a press or release
//! fires in the current context, and how the drag and interact modes follow.
//!
//! Pure decisions only. The app registers the keys with the OS, takes the
//! controller buttons from `mt-input`, and carries the fired actions out.

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

pub mod dispatch;
pub mod modes;
