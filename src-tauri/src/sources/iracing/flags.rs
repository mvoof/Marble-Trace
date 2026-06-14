//! Decode iRacing session flag bit fields into a normalized `RaceFlags` struct.
//!
//! Bit masks mirror `src/utils/formatters/flags-utils.ts` exactly.
//! This module is the only place that reads raw iRacing flag bits.

use crate::model::flags::RaceFlags;

const CHECKERED: u32 = 0x0000_0001;
const WHITE: u32 = 0x0000_0002;
const GREEN: u32 = 0x0000_0004;
const YELLOW: u32 = 0x0000_0008;
const RED: u32 = 0x0000_0010;
const BLUE: u32 = 0x0000_0020;
const DEBRIS: u32 = 0x0000_0040;
const YELLOW_WAVING: u32 = 0x0000_0100;
const CAUTION: u32 = 0x0000_4000;
const CAUTION_WAVING: u32 = 0x0000_8000;
const BLACK: u32 = 0x0001_0000;
const DISQUALIFY: u32 = 0x0002_0000;
const SERVICIBLE: u32 = 0x0004_0000;
const FURLED: u32 = 0x0008_0000;
const REPAIR: u32 = 0x0010_0000;

const MEATBALL_MASK: u32 = SERVICIBLE | REPAIR;

/// Decode raw iRacing session flag bit fields into a normalized [`RaceFlags`].
///
/// * `session_bits` — `SessionFlags` telemetry value (session-wide).
/// * `player_car_bits` — `CarIdxSessionFlags[player_car_idx]` (per-player car).
pub fn decode_race_flags(session_bits: u32, player_car_bits: u32) -> RaceFlags {
    let s = session_bits;
    let p = player_car_bits;

    RaceFlags {
        // session-wide
        checkered: s & CHECKERED != 0,
        white: s & WHITE != 0,
        green: s & GREEN != 0,
        yellow: s & (YELLOW | CAUTION | CAUTION_WAVING | YELLOW_WAVING) != 0,
        red: s & RED != 0,
        blue: s & BLUE != 0,
        debris: s & DEBRIS != 0,
        yellow_waving: s & YELLOW_WAVING != 0,
        caution: s & CAUTION != 0,
        caution_waving: s & CAUTION_WAVING != 0,
        // player-car
        black: p & (BLACK | DISQUALIFY) != 0,
        disqualify: p & DISQUALIFY != 0,
        meatball: (p & MEATBALL_MASK) == MEATBALL_MASK || (s & MEATBALL_MASK) == MEATBALL_MASK,
        furled: p & FURLED != 0,
        repair: p & REPAIR != 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_bits_gives_empty_flags() {
        let flags = decode_race_flags(0, 0);
        assert!(!flags.checkered);
        assert!(!flags.yellow);
        assert!(!flags.red);
        assert!(!flags.black);
        assert!(!flags.meatball);
    }

    #[test]
    fn session_checkered_flag() {
        let flags = decode_race_flags(CHECKERED, 0);
        assert!(flags.checkered);
        assert!(!flags.white);
    }

    #[test]
    fn session_yellow_variants_all_set_yellow() {
        for mask in [YELLOW, CAUTION, CAUTION_WAVING, YELLOW_WAVING] {
            let flags = decode_race_flags(mask, 0);
            assert!(flags.yellow, "mask 0x{mask:08X} should set yellow");
        }
    }

    #[test]
    fn session_red_flag() {
        let flags = decode_race_flags(RED, 0);
        assert!(flags.red);
        assert!(!flags.yellow);
    }

    #[test]
    fn player_black_flag() {
        let flags = decode_race_flags(0, BLACK);
        assert!(flags.black);
        assert!(!flags.disqualify);
    }

    #[test]
    fn player_disqualify_sets_black_and_disqualify() {
        let flags = decode_race_flags(0, DISQUALIFY);
        assert!(flags.black);
        assert!(flags.disqualify);
    }

    #[test]
    fn player_meatball_both_bits() {
        let flags = decode_race_flags(0, SERVICIBLE | REPAIR);
        assert!(flags.meatball);
        assert!(!flags.black);
    }

    #[test]
    fn session_meatball_both_bits() {
        let flags = decode_race_flags(SERVICIBLE | REPAIR, 0);
        assert!(flags.meatball);
    }

    #[test]
    fn meatball_requires_both_bits() {
        let flags = decode_race_flags(0, SERVICIBLE);
        assert!(!flags.meatball);
        let flags2 = decode_race_flags(0, REPAIR);
        assert!(!flags2.meatball);
    }

    #[test]
    fn player_furled_flag() {
        let flags = decode_race_flags(0, FURLED);
        assert!(flags.furled);
    }

    #[test]
    fn session_debris_flag() {
        let flags = decode_race_flags(DEBRIS, 0);
        assert!(flags.debris);
    }

    #[test]
    fn yellow_waving_and_caution_waving_individual_fields() {
        let flags = decode_race_flags(YELLOW_WAVING | CAUTION_WAVING, 0);
        assert!(flags.yellow_waving);
        assert!(flags.caution_waving);
        assert!(flags.yellow);
    }
}
