//! Benchmarks for frame adapter performance using real IBT data
//!
//! Tests the <100μs frame construction latency goal for:
//! - DynamicFrame adapter (HashMap-based field lookups)
//! - Derived adapters with varying field counts (5, 20, 50 fields)
//! - Optional vs required field extraction overhead
//! - Array field extraction performance
//!
//! Platform: Cross-platform (uses IBT test files, CI-safe)

#![allow(dead_code)] // JUSTIFICATION: Benchmark frame structs are exercised through generated adapters; fields stay unread by the harness.

use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use pitwall::adapters::FrameAdapter;
use pitwall::types::FramePacket;
use pitwall::{DynamicFrame, PitwallFrame, VariableSchema};
use std::hint::black_box;
use std::sync::Arc;

// Small adapter (5 fields) - minimal overhead baseline
#[derive(PitwallFrame, Debug, Clone)]
struct SmallFrame {
    #[field_name = "Speed"]
    speed: f32,

    #[field_name = "Gear"]
    gear: i32,

    #[field_name = "RPM"]
    rpm: f32,

    #[field_name = "Throttle"]
    throttle: f32,

    #[field_name = "Brake"]
    brake: f32,
}

// Medium adapter (20 fields) - typical dashboard use case
#[derive(PitwallFrame, Debug, Clone)]
struct MediumFrame {
    // Core telemetry
    #[field_name = "Speed"]
    speed: f32,
    #[field_name = "Gear"]
    gear: i32,
    #[field_name = "RPM"]
    rpm: f32,
    #[field_name = "Throttle"]
    throttle: f32,
    #[field_name = "Brake"]
    brake: f32,
    #[field_name = "Clutch"]
    clutch: f32,
    #[field_name = "SteeringWheelAngle"]
    steering: f32,

    // Lap data
    #[field_name = "Lap"]
    lap: i32,
    #[field_name = "LapDist"]
    lap_dist: f32,
    #[field_name = "LapDistPct"]
    lap_dist_pct: f32,
    #[field_name = "LapCurrentLapTime"]
    current_lap_time: f32,
    #[field_name = "LapLastLapTime"]
    last_lap_time: f32,
    #[field_name = "LapBestLapTime"]
    best_lap_time: f32,

    // Session
    #[field_name = "SessionTime"]
    session_time: f64,
    #[field_name = "SessionTick"]
    session_tick: i32,
    #[field_name = "SessionNum"]
    session_num: i32,
    #[field_name = "SessionState"]
    session_state: i32,

    // Position
    #[field_name = "VelocityX"]
    velocity_x: f32,
    #[field_name = "VelocityY"]
    velocity_y: f32,
    #[field_name = "VelocityZ"]
    velocity_z: f32,
}

// Large adapter (50 fields) - comprehensive telemetry logging
#[derive(PitwallFrame, Debug, Clone)]
struct LargeFrame {
    // All fields from MediumFrame
    #[field_name = "Speed"]
    speed: f32,
    #[field_name = "Gear"]
    gear: i32,
    #[field_name = "RPM"]
    rpm: f32,
    #[field_name = "Throttle"]
    throttle: f32,
    #[field_name = "Brake"]
    brake: f32,
    #[field_name = "Clutch"]
    clutch: f32,
    #[field_name = "SteeringWheelAngle"]
    steering: f32,
    #[field_name = "Lap"]
    lap: i32,
    #[field_name = "LapDist"]
    lap_dist: f32,
    #[field_name = "LapDistPct"]
    lap_dist_pct: f32,
    #[field_name = "LapCurrentLapTime"]
    current_lap_time: f32,
    #[field_name = "LapLastLapTime"]
    last_lap_time: f32,
    #[field_name = "LapBestLapTime"]
    best_lap_time: f32,
    #[field_name = "SessionTime"]
    session_time: f64,
    #[field_name = "SessionTick"]
    session_tick: i32,
    #[field_name = "SessionNum"]
    session_num: i32,
    #[field_name = "SessionState"]
    session_state: i32,
    #[field_name = "VelocityX"]
    velocity_x: f32,
    #[field_name = "VelocityY"]
    velocity_y: f32,
    #[field_name = "VelocityZ"]
    velocity_z: f32,

    // Additional fields for large frame
    #[field_name = "YawRate"]
    yaw_rate: f32,
    #[field_name = "Pitch"]
    pitch: f32,
    #[field_name = "Roll"]
    roll: f32,
    #[field_name = "PitchRate"]
    pitch_rate: f32,
    #[field_name = "RollRate"]
    roll_rate: f32,
    #[field_name = "SteeringWheelTorque"]
    steering_torque: f32,

    // Engine/fuel
    #[field_name = "FuelLevel"]
    fuel: Option<f32>,
    #[field_name = "FuelLevelPct"]
    fuel_pct: Option<f32>,
    #[field_name = "FuelUsePerHour"]
    fuel_use: Option<f32>,
    #[field_name = "WaterTemp"]
    water_temp: Option<f32>,
    #[field_name = "OilTemp"]
    oil_temp: Option<f32>,
    #[field_name = "OilPress"]
    oil_press: Option<f32>,

    // Tires
    #[field_name = "LFtempCL"]
    lf_temp_cl: Option<f32>,
    #[field_name = "LFtempCM"]
    lf_temp_cm: Option<f32>,
    #[field_name = "LFtempCR"]
    lf_temp_cr: Option<f32>,
    #[field_name = "RFtempCL"]
    rf_temp_cl: Option<f32>,
    #[field_name = "RFtempCM"]
    rf_temp_cm: Option<f32>,
    #[field_name = "RFtempCR"]
    rf_temp_cr: Option<f32>,
    #[field_name = "LRtempCL"]
    lr_temp_cl: Option<f32>,
    #[field_name = "LRtempCM"]
    lr_temp_cm: Option<f32>,
    #[field_name = "LRtempCR"]
    lr_temp_cr: Option<f32>,
    #[field_name = "RRtempCL"]
    rr_temp_cl: Option<f32>,
    #[field_name = "RRtempCM"]
    rr_temp_cm: Option<f32>,
    #[field_name = "RRtempCR"]
    rr_temp_cr: Option<f32>,

    // Timing
    #[field_name = "SessionTimeRemain"]
    time_remain: Option<f64>,
    #[field_name = "ReplayFrameNum"]
    replay_frame: Option<i32>,
    #[field_name = "IsReplayPlaying"]
    is_replay: Option<bool>,
}

// Adapter testing optional fields overhead
#[derive(PitwallFrame, Debug, Clone)]
struct OptionalFieldsFrame {
    #[field_name = "Speed"]
    speed: f32,

    #[field_name = "Gear"]
    gear: Option<i32>,

    #[field_name = "FuelLevel"]
    fuel: Option<f32>,

    #[field_name = "FuelLevelPct"]
    fuel_pct: Option<f32>,

    #[field_name = "WaterTemp"]
    water_temp: Option<f32>,
}

/// Get a test frame packet from IBT data
fn get_test_frame() -> (FramePacket, Arc<VariableSchema>) {
    use pitwall::IbtReader;
    use pitwall::test_utils::get_smallest_ibt_test_file;

    let ibt_file = get_smallest_ibt_test_file().expect("No IBT test files found");
    let mut reader = IbtReader::open(&ibt_file).expect("Failed to open IBT file");

    let schema = Arc::new(reader.variables().clone());

    // Read first frame
    let (data, tick, session_version) =
        reader.read_next_frame().expect("Failed to read frame").expect("No frames in IBT");

    let packet = FramePacket::new(data, tick, session_version, Arc::clone(&schema));

    (packet, schema)
}

fn bench_dynamic_frame(c: &mut Criterion) {
    let (packet, schema) = get_test_frame();

    // Pre-validate for DynamicFrame
    let validation =
        DynamicFrame::validate_schema(&schema).expect("DynamicFrame validation failed");

    let mut group = c.benchmark_group("dynamic_frame");

    group.bench_function("adapt", |b| {
        b.iter(|| {
            let frame = DynamicFrame::adapt(black_box(&packet), black_box(&validation));
            black_box(frame)
        })
    });

    // Create frame once for field access benchmarks
    let frame = DynamicFrame::adapt(&packet, &validation);

    group.bench_function("scalar_field_access", |b| {
        b.iter(|| {
            let speed = black_box(frame.f32("Speed"));
            black_box(speed)
        })
    });

    group.bench_function("array_field_access", |b| {
        b.iter(|| {
            let lap_dist: Option<Vec<f32>> = black_box(frame.get("CarIdxLapDistPct"));
            black_box(lap_dist)
        })
    });

    group.finish();
}

fn bench_derived_adapters(c: &mut Criterion) {
    let (packet, schema) = get_test_frame();

    let mut group = c.benchmark_group("derived_adapters");

    // Small frame (5 fields)
    if let Ok(validation) = SmallFrame::validate_schema(&schema) {
        group.bench_function(BenchmarkId::new("small_frame", "5_fields"), |b| {
            b.iter(|| {
                let frame = SmallFrame::adapt(black_box(&packet), black_box(&validation));
                black_box(frame)
            })
        });
    }

    // Medium frame (20 fields)
    if let Ok(validation) = MediumFrame::validate_schema(&schema) {
        group.bench_function(BenchmarkId::new("medium_frame", "20_fields"), |b| {
            b.iter(|| {
                let frame = MediumFrame::adapt(black_box(&packet), black_box(&validation));
                black_box(frame)
            })
        });
    }

    // Large frame (50 fields)
    if let Ok(validation) = LargeFrame::validate_schema(&schema) {
        group.bench_function(BenchmarkId::new("large_frame", "50_fields"), |b| {
            b.iter(|| {
                let frame = LargeFrame::adapt(black_box(&packet), black_box(&validation));
                black_box(frame)
            })
        });
    }

    group.finish();
}

fn bench_optional_fields(c: &mut Criterion) {
    let (packet, schema) = get_test_frame();

    let mut group = c.benchmark_group("optional_fields");

    if let Ok(validation) = OptionalFieldsFrame::validate_schema(&schema) {
        group.bench_function("optional_fields_frame", |b| {
            b.iter(|| {
                let frame = OptionalFieldsFrame::adapt(black_box(&packet), black_box(&validation));
                black_box(frame)
            })
        });
    }

    group.finish();
}

criterion_group!(benches, bench_dynamic_frame, bench_derived_adapters, bench_optional_fields);
criterion_main!(benches);
