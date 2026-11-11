use super::*;
use mt_computations::field::driver_entries::DriverEntriesFrame;
use mt_model::sim::enums::{PitState, TrackSurface};

fn entry() -> DriverEntry {
    DriverEntry {
        car_idx: 0,
        car_class_id: 0,
        tire_compound: String::new(),
        position: 0,
        class_position: 0,
        live_position: 0,
        live_class_position: 0,
        start_pos_overall: None,
        start_pos_class: None,
        lap: 0,
        lap_dist_pct: 0.0,
        last_lap_time: None,
        best_lap_time: None,
        qualify_time: None,
        f2_time: 0.0,
        est_time: 0.0,
        track_surface: TrackSurface::OnTrack,
        i_rating: 0,
        is_player: false,
        on_pit_road: false,
        estimated_ir_delta_live: None,
        estimated_ir_delta_official: None,
        relative_lap_dist: 0.0,
        class_est_lap_time: 0.0,
        raw_flags: 0,
        results_position_lap: None,
        results_position_time: None,
        is_retired: false,
        is_finished: false,
        is_towed: false,
        pit_state: PitState::None,
        speed: None,
        pit_lap: None,
        pit_elapsed_s: None,
        last_pit_s: None,
    }
}

#[test]
fn the_players_entry_outlives_the_ticks_without_a_driver_table() {
    let mut retained = None;
    let player = DriverEntry {
        is_player: true,
        estimated_ir_delta_live: Some(34),
        ..entry()
    };
    let with_table = TelemetryBundle {
        driver_entries: Some(DriverEntriesFrame {
            entries: vec![entry(), player],
            player_car_idx: 0,
            pit_lane_loss_s: None,
            pit_exit_loss_s: None,
        }),
        ..TelemetryBundle::default()
    };

    retain_player_entry(&mut retained, &with_table);
    retain_player_entry(&mut retained, &TelemetryBundle::default());

    assert_eq!(
        retained.and_then(|entry| entry.estimated_ir_delta_live),
        Some(34)
    );
}
