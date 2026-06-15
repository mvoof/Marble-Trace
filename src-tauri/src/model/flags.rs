//! Normalized race flag state decoded from iRacing session flag bit fields.
//!
//! `RaceFlags` is the backend→frontend contract for flag state.
//! Bit decoding lives in `sources/iracing/flags.rs` (kerb-only zone).

use serde::{Deserialize, Serialize};

/// Decoded race flag state for the current session and the player's car.
///
/// Populated from `SessionFlags` (session-wide) and
/// `CarIdxSessionFlags[player_car_idx]` (per-player) bit fields.
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct RaceFlags {
    // --- session-wide flags ---
    pub checkered: bool,
    pub white: bool,
    pub green: bool,
    pub yellow: bool,
    pub red: bool,
    pub blue: bool,
    pub debris: bool,
    pub yellow_waving: bool,
    pub caution: bool,
    pub caution_waving: bool,
    // --- player-car flags ---
    pub black: bool,
    pub disqualify: bool,
    /// True when both servicible + repair bits are set (meatball flag).
    pub meatball: bool,
    pub furled: bool,
    pub repair: bool,
}
