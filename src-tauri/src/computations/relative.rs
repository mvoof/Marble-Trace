use crate::capabilities::Capabilities;
use crate::computations::standings::DriverEntry;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use crate::model::relative::RelativeFrame;

/// Computes the relative entry list from already-computed standings entries.
///
/// The player's `relative_lap_dist` is 0.0. Entries ahead have a positive
/// value; entries behind have a negative value. Sorted descending so that
/// the furthest-ahead car is first and the furthest-behind car is last.
///
/// Wrap-around near the 0/1 lap boundary is handled in `standings.rs` when
/// `relative_lap_dist` is computed. Example: player at 0.98, car at 0.02 →
/// raw diff = 0.02 - 0.98 = -0.96, then -0.96 + 1.0 = 0.04 (car is 4%
/// ahead, not 96% behind).
pub fn compute(entries: &[DriverEntry], player_car_idx: i32) -> RelativeFrame {
    let mut sorted: Vec<DriverEntry> = entries.to_vec();

    sorted.sort_by(|a, b| {
        b.relative_lap_dist
            .partial_cmp(&a.relative_lap_dist)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    RelativeFrame {
        entries: sorted,
        player_car_idx,
    }
}

/// Processor that derives the relative list from the standings output.
///
/// Runs at 10 Hz — same cadence as standings so the data is always fresh.
/// Required capability: `RELATIVE` (already set by `IracingSource`).
pub struct RelativeProcessor {
    state: std::sync::Mutex<crate::computations::standings::StandingsState>,
}

impl Default for RelativeProcessor {
    fn default() -> Self {
        Self {
            state: std::sync::Mutex::new(crate::computations::standings::StandingsState::default()),
        }
    }
}

impl Processor for RelativeProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::Relative
    }

    fn required(&self) -> Capabilities {
        Capabilities::RELATIVE
    }

    fn rate(&self) -> TickRate {
        TickRate::Hz10
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let player_car_idx = ctx.session.player_car_idx;
        let drivers = &ctx.session.cars;

        if drivers.is_empty() {
            return None;
        }

        let standings_frame = crate::computations::standings::compute(
            ctx.car_idx,
            ctx.session,
            ctx.start_positions,
            false,
            &self.state,
        );

        let frame = compute(&standings_frame.entries, player_car_idx);

        Some(ComputedOutput::Relative(frame))
    }

    fn reset(&mut self) {
        if let Ok(mut locked) = self.state.lock() {
            *locked = crate::computations::standings::StandingsState::default();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::computations::standings::DriverEntry;
    use crate::model::enums::{PitState, TrackSurface};

    fn make_entry(car_idx: i32, lap_dist_pct: f32, is_player: bool) -> DriverEntry {
        let player_lap_dist = 0.0_f32; // placeholder; relative_lap_dist set manually below
        DriverEntry {
            car_idx,
            user_name: format!("Driver {car_idx}"),
            car_number: car_idx.to_string(),
            car_class_id: 0,
            car_class_short_name: String::new(),
            car_class_color: String::new(),
            car_screen_name: String::new(),
            car_screen_name_short: String::new(),
            tire_compound: String::new(),
            position: 0,
            class_position: 0,
            start_pos_overall: 0,
            start_pos_class: 0,
            lap: 0,
            lap_dist_pct,
            last_lap_time: -1.0,
            best_lap_time: -1.0,
            f2_time: 0.0,
            est_time: 0.0,
            track_surface: TrackSurface::OnTrack,
            i_rating: 0,
            lic_string: String::new(),
            lic_color: String::new(),
            incidents: 0,
            is_player,
            on_pit_road: false,
            estimated_ir_delta: None,
            relative_lap_dist: {
                // Compute relative_lap_dist relative to player_lap_dist=0.0
                let mut diff = lap_dist_pct - player_lap_dist;
                if diff < -0.5 {
                    diff += 1.0;
                }
                if diff > 0.5 {
                    diff -= 1.0;
                }
                diff
            },
            class_est_lap_time: 0.0,
            raw_flags: 0,
            results_position_lap: None,
            results_position_time: None,
            pit_state: PitState::None,
        }
    }

    #[test]
    fn test_sorting_descending_by_relative_lap_dist() {
        let entries = vec![
            make_entry(0, 0.0, true),  // player, relative = 0.0
            make_entry(1, 0.1, false), // ahead by 0.1
            make_entry(2, 0.9, false), // relative = 0.9 - 1.0 = -0.1 (behind)
        ];

        let frame = compute(&entries, 0);

        assert_eq!(frame.entries[0].car_idx, 1); // +0.1 (most ahead)
        assert_eq!(frame.entries[1].car_idx, 0); // 0.0 (player)
        assert_eq!(frame.entries[2].car_idx, 2); // -0.1 (behind)
    }

    #[test]
    fn test_relative_lap_dist_wraparound_near_start_finish() {
        // Player at 0.98, car at 0.02 → car is 4% ahead, not 96% behind
        let player_lap_dist = 0.98_f32;
        let car_lap_dist = 0.02_f32;

        let mut diff = car_lap_dist - player_lap_dist;
        if diff < -0.5 {
            diff += 1.0;
        }
        if diff > 0.5 {
            diff -= 1.0;
        }

        // diff = 0.02 - 0.98 = -0.96 → +1.0 = 0.04
        assert!((diff - 0.04).abs() < 1e-5, "expected 0.04, got {diff}");
    }

    #[test]
    fn test_relative_lap_dist_wraparound_player_ahead_of_zero() {
        // Player at 0.02, car at 0.98 → car is 4% behind
        let player_lap_dist = 0.02_f32;
        let car_lap_dist = 0.98_f32;

        let mut diff = car_lap_dist - player_lap_dist;
        if diff < -0.5 {
            diff += 1.0;
        }
        if diff > 0.5 {
            diff -= 1.0;
        }

        // diff = 0.98 - 0.02 = 0.96 → -1.0 = -0.04
        assert!((diff - (-0.04)).abs() < 1e-5, "expected -0.04, got {diff}");
    }

    #[test]
    fn test_correct_fields_in_output() {
        let entry = make_entry(5, 0.25, false);

        let frame = compute(&[entry], 0);

        assert_eq!(frame.player_car_idx, 0);
        assert_eq!(frame.entries.len(), 1);
        assert_eq!(frame.entries[0].car_idx, 5);
        assert!((frame.entries[0].lap_dist_pct - 0.25).abs() < 1e-5);
    }

    #[test]
    fn test_empty_entries() {
        let frame = compute(&[], 0);

        assert!(frame.entries.is_empty());
        assert_eq!(frame.player_car_idx, 0);
    }
}
