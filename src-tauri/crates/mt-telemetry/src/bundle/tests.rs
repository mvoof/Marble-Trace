use super::*;
use mt_computations::field::driver_entries::DriverEntriesFrame;
use mt_model::contract::telemetry_events::EVENT_CAR_INPUTS;
use mt_model::sim::cars::CarPositionsFrame;
use mt_model::sim::player::InputSample;

fn positions(pct: f32) -> CarPositionsFrame {
    CarPositionsFrame {
        car_idx_lap_dist_pct: vec![pct],
        car_idx_track_surface: vec![3],
    }
}

fn entries() -> DriverEntriesFrame {
    DriverEntriesFrame {
        entries: vec![],
        player_car_idx: 0,
        pit_lane_loss_s: None,
        pit_exit_loss_s: None,
    }
}

fn sample_with_throttle(throttle: f32) -> InputSample {
    InputSample {
        throttle,
        brake: 0.0,
        clutch: None,
        brake_abs_active: false,
        steering_wheel_angle: 0.0,
        body_slip_deg: None,
    }
}

#[test]
fn the_mask_strips_input_samples_nobody_asked_for() {
    let mut bundle = TelemetryBundle {
        input_samples: Some(vec![sample_with_throttle(1.0)]),
        ..TelemetryBundle::default()
    };

    apply_event_mask(&mut bundle, EVENT_CAR_INPUTS);

    assert!(bundle.input_samples.is_none());
}

#[test]
fn a_bundle_of_overlay_clock_fields_carries_no_slow_field() {
    let bundle = TelemetryBundle {
        car_positions: Some(positions(0.5)),
        ..Default::default()
    };

    assert!(!bundle.carries_slow_fields());
}

/// The timer widget reads the session clock; a thinned tick that carried
/// it made the clock jump a second at a time.
#[test]
fn a_bundle_with_a_slow_tier_field_carries_one() {
    let bundle = TelemetryBundle {
        car_positions: Some(positions(0.5)),
        driver_entries: Some(entries()),
        ..Default::default()
    };

    assert!(bundle.carries_slow_fields());
    assert!(TelemetryBundle {
        environment: Some(Default::default()),
        ..Default::default()
    }
    .carries_slow_fields());
}
