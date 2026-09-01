//! Normalized race flag state decoded from iRacing session flag bit fields.
//!
//! `RaceFlags` is the backend→frontend contract for flag state.
//! The raw bit masks live here too, since `computations/` reads them as well;
//! the decoding into `RaceFlags` lives in `sources/iracing/flags.rs` (kerb-only zone).

use serde::{Deserialize, Serialize};

/// Raw iRacing session flag bit masks. Mirror `src/utils/flags-utils.ts` exactly.
pub const CHECKERED: u32 = 0x0000_0001;
pub const WHITE: u32 = 0x0000_0002;
pub const GREEN: u32 = 0x0000_0004;
pub const YELLOW: u32 = 0x0000_0008;
pub const RED: u32 = 0x0000_0010;
pub const BLUE: u32 = 0x0000_0020;
pub const DEBRIS: u32 = 0x0000_0040;
pub const YELLOW_WAVING: u32 = 0x0000_0100;
pub const CAUTION: u32 = 0x0000_4000;
pub const CAUTION_WAVING: u32 = 0x0000_8000;
pub const BLACK: u32 = 0x0001_0000;
pub const DISQUALIFY: u32 = 0x0002_0000;
pub const SERVICIBLE: u32 = 0x0004_0000;
pub const FURLED: u32 = 0x0008_0000;
pub const REPAIR: u32 = 0x0010_0000;

/// Both bits together are the meatball (black flag with orange disc).
pub const MEATBALL_MASK: u32 = SERVICIBLE | REPAIR;

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
