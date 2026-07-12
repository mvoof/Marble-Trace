//! Track shape processor — dead reckoning from 60 Hz speed/yaw telemetry.
//! Ports the TypeScript `TrackRecorder` class in full.
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use crate::model::enums::TrackSurface;
use crate::model::track_shape::{TrackPoint, TrackRecordingFrame, TrackShapePayload};

const DT_CAP_SECONDS: f32 = 0.1;
const DT_FALLBACK_SECONDS: f32 = 0.016;
const LAP_WRAP_THRESHOLD: f32 = 0.5;
const SAMPLING_THRESHOLD_PCT: f32 = 0.001;
const NEAR_END_THRESHOLD: f32 = 0.9;
const NEAR_START_THRESHOLD: f32 = 0.1;
const MIN_POINTS_FOR_COMPLETION: usize = 100;
const VIEWBOX_PADDING_FACTOR: f32 = 0.02;
const SPEED_THRESHOLD_MPS: f32 = 5.0;
/// Emit recording status every 15 60 Hz ticks (~4 Hz).
const STATUS_EMIT_INTERVAL: u64 = 15;

struct TrackShapeState {
    points: Vec<TrackPoint>,
    x: f32,
    y: f32,
    recording: bool,
    complete: bool,
    prev_time: Option<Instant>,
    start_pct: f32,
    highest_pct: f32,
    last_lap_dist_pct: f32,
    points_count: usize,
}

impl Default for TrackShapeState {
    fn default() -> Self {
        Self {
            points: Vec::new(),
            x: 0.0,
            y: 0.0,
            recording: false,
            complete: false,
            prev_time: None,
            start_pct: -1.0,
            highest_pct: -1.0,
            last_lap_dist_pct: -1.0,
            points_count: 0,
        }
    }
}

impl TrackShapeState {
    fn reset(&mut self) {
        *self = Self::default();
    }

    fn progress(&self) -> f32 {
        if self.complete {
            return 1.0;
        }

        if !self.recording || self.start_pct < 0.0 || self.highest_pct < 0.0 {
            return 0.0;
        }

        let mut pct = self.highest_pct - self.start_pct;

        if pct < 0.0 {
            pct += 1.0;
        }

        pct.clamp(0.0, 0.99)
    }

    fn start(&mut self) {
        self.reset();
        self.recording = true;
        self.prev_time = Some(Instant::now());
    }

    /// Feed one telemetry tick. Returns `true` if recording just completed.
    fn tick_with_dt(&mut self, speed: f32, yaw: f32, lap_dist_pct: f32, dt: f32) -> bool {
        if !self.recording || self.complete {
            return false;
        }

        if self.start_pct < 0.0 {
            if lap_dist_pct < 0.0 {
                return false;
            }

            self.start_pct = lap_dist_pct;
            self.highest_pct = lap_dist_pct;
            self.last_lap_dist_pct = lap_dist_pct;
            self.points.push(TrackPoint {
                x: 0.0,
                y: 0.0,
                pct: lap_dist_pct,
            });
            self.points_count = 1;

            return false;
        }

        let effective_dt = if dt > DT_CAP_SECONDS {
            DT_FALLBACK_SECONDS
        } else if dt <= 0.0 {
            return false;
        } else {
            dt
        };

        let dx = speed * yaw.sin() * effective_dt;
        let dy = speed * yaw.cos() * effective_dt;

        self.x += dx;
        self.y += dy;

        let mut pct_diff = lap_dist_pct - self.last_lap_dist_pct;

        if pct_diff < -LAP_WRAP_THRESHOLD {
            pct_diff += 1.0;
        }

        if pct_diff > LAP_WRAP_THRESHOLD {
            pct_diff -= 1.0;
        }

        if pct_diff.abs() >= SAMPLING_THRESHOLD_PCT {
            self.points.push(TrackPoint {
                x: self.x,
                y: self.y,
                pct: lap_dist_pct,
            });
            self.last_lap_dist_pct = lap_dist_pct;
            self.points_count += 1;
        }

        let mut current_rel = lap_dist_pct - self.start_pct;

        if current_rel < 0.0 {
            current_rel += 1.0;
        }

        let mut highest_rel = self.highest_pct - self.start_pct;

        if highest_rel < 0.0 {
            highest_rel += 1.0;
        }

        if current_rel > highest_rel && current_rel - highest_rel < NEAR_START_THRESHOLD {
            self.highest_pct = lap_dist_pct;
        }

        let crossed_start = highest_rel > NEAR_END_THRESHOLD && current_rel < NEAR_START_THRESHOLD;

        if crossed_start && self.points_count > MIN_POINTS_FOR_COMPLETION {
            self.complete = true;
            self.recording = false;
            self.post_process();
            return true;
        }

        false
    }

    fn post_process(&mut self) {
        if self.points.len() < 3 {
            return;
        }

        let mut highest_progress: f32 = 0.0;
        let mut clip_index: Option<usize> = None;

        for (i, p) in self.points.iter().enumerate() {
            let mut rel = p.pct - self.start_pct;

            if rel < 0.0 {
                rel += 1.0;
            }

            if rel > highest_progress {
                highest_progress = rel;
            }

            if highest_progress > 0.9 && rel < 0.1 {
                clip_index = Some(i);
                break;
            }
        }

        if let Some(idx) = clip_index {
            self.points.truncate(idx);
        }

        let n = self.points.len();

        if n > 1 {
            let start_x = self.points[0].x;
            let start_y = self.points[0].y;
            let end_x = self.points[n - 1].x;
            let end_y = self.points[n - 1].y;
            let drift_x = end_x - start_x;
            let drift_y = end_y - start_y;

            for (i, p) in self.points.iter_mut().enumerate() {
                let factor = i as f32 / (n - 1) as f32;
                p.x -= factor * drift_x;
                p.y -= factor * drift_y;
            }
        }
    }

    fn sorted_points(&self) -> Vec<TrackPoint> {
        let mut pts = self.points.clone();
        pts.sort_by(|a, b| {
            a.pct
                .partial_cmp(&b.pct)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        pts
    }
}

pub struct TrackShapeProcessor {
    state: TrackShapeState,
    last_track_id: Option<i32>,
    force_start: Arc<AtomicBool>,
    reset_pit_pcts: Arc<AtomicBool>,
    /// Set to a loaded track_id when a cached track was loaded from disk; -1 = unset.
    /// Consumed by compute() on the first tick after a track_id change to skip re-recording.
    track_cached: Arc<std::sync::atomic::AtomicI32>,
    /// Set when the user manually clears the current track's recorded shape.
    /// Consumed on next tick to un-complete the in-memory recording state.
    reset_track_shape: Arc<AtomicBool>,
    status_tick: u64,
    last_lap_dist_pct: f32,
    /// Previous frame's on_pit_road per car (CarIdx-indexed).
    prev_on_pit_road: Vec<bool>,
    /// Previous frame's track surface per car — used to reject pit stall exits.
    prev_track_surface: Vec<TrackSurface>,
    /// Recorded pit entry pct per car; present while car is inside pit lane, awaiting exit.
    pit_in_pcts_by_car: HashMap<usize, f32>,
}

impl TrackShapeProcessor {
    pub fn new(
        force_start: Arc<AtomicBool>,
        reset_pit_pcts: Arc<AtomicBool>,
        track_cached: Arc<std::sync::atomic::AtomicI32>,
        reset_track_shape: Arc<AtomicBool>,
    ) -> Self {
        Self {
            state: TrackShapeState::default(),
            last_track_id: None,
            force_start,
            reset_pit_pcts,
            track_cached,
            reset_track_shape,
            status_tick: 0,
            last_lap_dist_pct: -1.0,
            prev_on_pit_road: Vec::new(),
            prev_track_surface: Vec::new(),
            pit_in_pcts_by_car: HashMap::new(),
        }
    }
}

impl Processor for TrackShapeProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::TrackShape
    }

    fn required(&self) -> Capabilities {
        Capabilities::empty()
    }

    fn rate(&self) -> TickRate {
        TickRate::Hz60
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let track_id = ctx.session.track_id;
        let on_pit_road = ctx.car_status.on_pit_road.unwrap_or(false);

        if self.reset_track_shape.swap(false, Ordering::Relaxed) {
            self.state.reset();
            self.status_tick = 0;
            self.last_lap_dist_pct = -1.0;
        }

        if self.last_track_id != Some(track_id) {
            self.state.reset();
            self.last_track_id = Some(track_id);
            self.status_tick = 0;
            self.prev_on_pit_road.clear();
            self.prev_track_surface.clear();
            self.pit_in_pcts_by_car.clear();

            // A cached track was loaded from disk for this track_id — skip re-recording.
            if self.track_cached.swap(-1, Ordering::Relaxed) == track_id {
                self.state.complete = true;
            }
        }

        let speed = ctx.car_dynamics.speed;
        let yaw = ctx.car_dynamics.yaw.unwrap_or(0.0);
        let lap_dist_pct = ctx.lap_timing.lap_dist_pct.unwrap_or(-1.0);
        let is_moving = speed > SPEED_THRESHOLD_MPS;
        let player_idx = ctx.session.player_car_idx as usize;

        // Reset pit tracking if commanded by the user (manual recalibrate).
        if self.reset_pit_pcts.swap(false, Ordering::Relaxed) {
            self.prev_on_pit_road.clear();
            self.prev_track_surface.clear();
            self.pit_in_pcts_by_car.clear();
        }

        // Detect pit entry / exit for every car using CarIdx arrays (10 Hz, less noisy than
        // the player's own 60 Hz OnPitRoad signal which can glitch for 1-2 frames on entry).
        // Any car that completes a valid pit lane traversal calibrates the track.
        let mut pit_lane_output: Option<ComputedOutput> = None;

        let current_on_pit_road = &ctx.car_idx.car_idx_on_pit_road;
        let current_lap_dist = &ctx.car_idx.car_idx_lap_dist_pct;
        let current_surface = &ctx.car_idx.car_idx_track_surface;

        for (i, &is_on_pit) in current_on_pit_road.iter().enumerate() {
            let was_on_pit = self.prev_on_pit_road.get(i).copied().unwrap_or(false);
            let car_lap_dist = match current_lap_dist.get(i).copied() {
                Some(d) if d >= 0.0 => d,
                _ => continue,
            };

            // Pit entry: false → true
            if !was_on_pit && is_on_pit {
                let prev_surface = self
                    .prev_track_surface
                    .get(i)
                    .copied()
                    .unwrap_or(TrackSurface::NotInWorld);

                // Reject cars leaving a pit stall — their on_pit_road transition goes false→true
                // just like a real track→pit entry, but we don't want to record that.
                if prev_surface != TrackSurface::InPitStall {
                    self.pit_in_pcts_by_car.insert(i, car_lap_dist);
                }
            }

            // Pit exit: true → false
            if was_on_pit && !is_on_pit {
                if let Some(pit_in) = self.pit_in_pcts_by_car.remove(&i) {
                    let lane_length_pct = (car_lap_dist - pit_in + 1.0) % 1.0;

                    // Sanity: pit lane must be 3–30% of track length.
                    // <3% catches on_pit_road glitch frames; >30% catches reversed/warped data.
                    if (0.03..=0.30).contains(&lane_length_pct) && pit_lane_output.is_none() {
                        pit_lane_output = Some(ComputedOutput::PitLanePct {
                            track_id,
                            pit_in_pct: pit_in,
                            pit_exit_pct: car_lap_dist,
                        });
                    }
                }
            }
        }

        // Update previous-frame snapshots for next tick.
        self.prev_on_pit_road.clear();
        self.prev_on_pit_road.extend_from_slice(current_on_pit_road);
        self.prev_track_surface.clear();
        self.prev_track_surface.extend_from_slice(current_surface);

        if pit_lane_output.is_some() {
            return pit_lane_output;
        }

        let player_is_recording_pit = self.pit_in_pcts_by_car.contains_key(&player_idx);

        if self.state.complete {
            self.status_tick += 1;
            if self.status_tick.is_multiple_of(STATUS_EMIT_INTERVAL) {
                return Some(ComputedOutput::TrackRecording(TrackRecordingFrame {
                    is_recording: false,
                    is_waiting_for_sf: false,
                    progress: 1.0,
                    pit_lane_recording: player_is_recording_pit,
                }));
            }
            return None;
        }

        let force = self.force_start.swap(false, Ordering::Relaxed);

        if !self.state.recording && !self.state.complete && is_moving {
            let lap_dist = ctx.lap_timing.lap_dist_pct.unwrap_or(-1.0);

            let crossed_sf =
                !on_pit_road && self.last_lap_dist_pct > 0.8 && (0.0..0.2).contains(&lap_dist);

            if (crossed_sf || force) && !on_pit_road && lap_dist >= 0.0 {
                self.state.start();
            }
        }

        if lap_dist_pct >= 0.0 {
            self.last_lap_dist_pct = lap_dist_pct;
        }

        let just_completed = if self.state.recording {
            let now = Instant::now();
            let dt = self
                .state
                .prev_time
                .map(|t| now.duration_since(t).as_secs_f32())
                .unwrap_or(DT_FALLBACK_SECONDS);
            self.state.prev_time = Some(now);
            self.state.tick_with_dt(speed, yaw, lap_dist_pct, dt)
        } else {
            false
        };

        if just_completed {
            return Some(ComputedOutput::TrackShape(build_payload(
                track_id,
                &self.state,
            )));
        }

        self.status_tick += 1;

        if self.status_tick.is_multiple_of(STATUS_EMIT_INTERVAL) {
            let is_waiting = is_moving && !self.state.recording && !self.state.complete && !force;

            return Some(ComputedOutput::TrackRecording(TrackRecordingFrame {
                is_recording: self.state.recording,
                is_waiting_for_sf: is_waiting,
                progress: self.state.progress(),
                pit_lane_recording: player_is_recording_pit,
            }));
        }

        None
    }

    fn reset(&mut self) {
        self.state.reset();
        self.last_track_id = None;
        self.status_tick = 0;
        self.last_lap_dist_pct = -1.0;
        self.prev_on_pit_road.clear();
        self.prev_track_surface.clear();
        self.pit_in_pcts_by_car.clear();
    }
}

fn build_payload(track_id: i32, state: &TrackShapeState) -> TrackShapePayload {
    let pts = state.sorted_points();

    if pts.len() < 3 {
        return TrackShapePayload {
            track_id,
            svg_path: String::new(),
            view_box: "0 0 100 100".to_string(),
            points: pts,
            pit_in_pct: None,
            pit_exit_pct: None,
        };
    }

    let mut min_x = f32::MAX;
    let mut min_y = f32::MAX;
    let mut max_x = f32::MIN;
    let mut max_y = f32::MIN;

    for p in &pts {
        if p.x < min_x {
            min_x = p.x;
        }
        if p.y < min_y {
            min_y = p.y;
        }
        if p.x > max_x {
            max_x = p.x;
        }
        if p.y > max_y {
            max_y = p.y;
        }
    }

    let width = (max_x - min_x).max(1.0);
    let height = (max_y - min_y).max(1.0);
    let padding = width.max(height) * VIEWBOX_PADDING_FACTOR;

    let vb_x = min_x - padding;
    let vb_y = min_y - padding;
    let vb_w = width + padding * 2.0;
    let vb_h = height + padding * 2.0;

    let view_box = format!("{:.0} {:.0} {:.0} {:.0}", vb_x, vb_y, vb_w, vb_h);

    let mut d = format!("M {:.1} {:.1}", pts[0].x, pts[0].y);

    for p in &pts[1..] {
        d.push_str(&format!(" L {:.1} {:.1}", p.x, p.y));
    }

    d.push_str(" Z");

    TrackShapePayload {
        track_id,
        svg_path: d,
        view_box,
        points: pts,
        pit_in_pct: None,
        pit_exit_pct: None,
    }
}

/// Find interpolated (x, y) at the given lapDistPct along a sorted points slice.
#[allow(dead_code)]
fn get_point_at_pct(points: &[TrackPoint], pct: f32) -> (f32, f32) {
    if points.is_empty() {
        return (0.0, 0.0);
    }

    if points.len() == 1 {
        return (points[0].x, points[0].y);
    }

    let mut p = pct % 1.0;

    if p < 0.0 {
        p += 1.0;
    }

    let last_idx = points.len() - 1;

    // p is outside the stored pct range — wrap-around segment (last → first point).
    if p < points[0].pct || p > points[last_idx].pct {
        let a = &points[last_idx];
        let b = &points[0];
        let seg_len = b.pct - a.pct + 1.0;
        let mut t = (p - a.pct) / seg_len;

        if t < 0.0 {
            t += 1.0 / seg_len;
        }

        let t_clamped = t.clamp(0.0, 1.0);

        return (a.x + (b.x - a.x) * t_clamped, a.y + (b.y - a.y) * t_clamped);
    }

    let mut lo = 0usize;
    let mut hi = last_idx;

    while lo < hi.saturating_sub(1) {
        let mid = (lo + hi) / 2;

        if points[mid].pct <= p {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    let a = &points[lo];
    let b = &points[hi];

    let seg_len = b.pct - a.pct;

    if seg_len <= 0.0 {
        return (a.x, a.y);
    }

    let t = ((p - a.pct) / seg_len).clamp(0.0, 1.0);

    (a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::atomic::AtomicBool;

    use crate::model::cars::CarIdxFrame;
    use crate::model::player::{CarDynamicsFrame, CarInputsFrame, CarStatusFrame, LapTimingFrame};
    use crate::model::session::SessionSnapshot;

    fn make_processor() -> TrackShapeProcessor {
        TrackShapeProcessor::new(
            Arc::new(AtomicBool::new(false)),
            Arc::new(AtomicBool::new(false)),
            Arc::new(std::sync::atomic::AtomicI32::new(-1)),
            Arc::new(AtomicBool::new(false)),
        )
    }

    fn make_dynamics(speed: f32, yaw: f32) -> CarDynamicsFrame {
        CarDynamicsFrame {
            speed,
            rpm: 3000.0,
            gear: 3,
            steering_wheel_angle: 0.0,
            velocity_x: None,
            velocity_y: None,
            velocity_z: None,
            lat_accel: None,
            long_accel: None,
            yaw: Some(yaw),
            yaw_rate: None,
            pitch: None,
            roll: None,
            shift_indicator_pct: None,
            shift_grind_rpm: None,
        }
    }

    fn make_car_inputs() -> CarInputsFrame {
        CarInputsFrame {
            throttle: 0.0,
            brake: 0.0,
            clutch: None,
            brake_abs_active: false,
        }
    }

    fn make_lap_timing(lap_dist_pct: f32) -> LapTimingFrame {
        LapTimingFrame {
            lap: None,
            lap_dist: None,
            lap_dist_pct: Some(lap_dist_pct),
            lap_current_lap_time: 30.0,
            lap_last_lap_time: None,
            lap_best_lap_time: None,
            player_car_position: None,
            player_car_class_position: None,
            lap_delta_to_session_best_live: None,
            lap_delta_to_session_optimal_live: None,
            lap_delta_to_driver_best_live: None,
            lap_delta_to_best_lap: None,
            lap_delta_to_best_lap_dd: None,
            lap_delta_to_best_lap_ok: None,
            lap_delta_to_optimal_lap: None,
            lap_delta_to_optimal_lap_dd: None,
            lap_delta_to_optimal_lap_ok: None,
            lap_delta_to_session_best_lap: None,
            lap_delta_to_session_best_lap_dd: None,
            lap_delta_to_session_best_lap_ok: None,
            lap_delta_to_session_lastl_lap: None,
            lap_delta_to_session_lastl_lap_dd: None,
            lap_delta_to_session_lastl_lap_ok: None,
            lap_delta_to_session_optimal_lap: None,
            lap_delta_to_session_optimal_lap_dd: None,
            lap_delta_to_session_optimal_lap_ok: None,
        }
    }

    fn make_car_status() -> CarStatusFrame {
        CarStatusFrame {
            fuel_level: 0.0,
            fuel_level_pct: None,
            fuel_use_per_hour: None,
            oil_temp: None,
            oil_press: None,
            water_temp: None,
            voltage: None,
            on_pit_road: Some(false),
            is_on_track: None,
            car_left_right: None,
            engine_warnings: None,
            player_car_sl_shift_rpm: vec![],
            player_car_sl_blink_rpm: vec![],
            flags: crate::model::flags::RaceFlags::default(),
            dc_abs: None,
            dc_brake_bias: None,
            dc_traction_control: None,
            dc_throttle_shape: None,
        }
    }

    fn make_car_idx() -> CarIdxFrame {
        CarIdxFrame {
            car_idx_lap_dist_pct: vec![],
            car_idx_on_pit_road: vec![],
            car_idx_position: vec![],
            car_idx_class_position: vec![],
            car_idx_lap: vec![],
            car_idx_last_lap_time: vec![],
            car_idx_best_lap_time: vec![],
            car_idx_f2_time: vec![],
            car_idx_est_time: vec![],
            car_idx_track_surface: vec![],
            car_idx_tire_compound: vec![],
            car_idx_session_flags: vec![],
            car_left_right: None,
        }
    }

    fn make_session(track_id: i32) -> SessionSnapshot {
        SessionSnapshot {
            track_id,
            ..SessionSnapshot::default()
        }
    }

    struct MakeCtxArgs<'a> {
        dynamics: &'a CarDynamicsFrame,
        lap_timing: &'a LapTimingFrame,
        car_status: &'a CarStatusFrame,
        session: &'a SessionSnapshot,
        car_idx: &'a CarIdxFrame,
        start_positions: &'a HashMap<i32, (i32, i32)>,
        car_inputs: &'a CarInputsFrame,
        chassis: &'a crate::model::player::ChassisFrame,
        environment: &'a crate::model::environment::EnvironmentFrame,
    }

    fn make_ctx(args: MakeCtxArgs) -> ComputeContext {
        ComputeContext {
            car_dynamics: args.dynamics,
            car_inputs: args.car_inputs,
            car_idx: args.car_idx,
            lap_timing: args.lap_timing,
            car_status: args.car_status,
            chassis: args.chassis,
            environment: args.environment,
            session: args.session,
            track_length_m: 3700.0,
            car_length_m: 4.4,
            start_positions: args.start_positions,
            pit_warning_laps: 2.0,
            lap_delta_active: false,
            session_num: Some(0),
            session_time_remain: None,
        }
    }

    #[test]
    fn initial_state_is_idle() {
        let proc = make_processor();
        assert!(!proc.state.recording);
        assert!(!proc.state.complete);
        assert_eq!(proc.state.progress(), 0.0);
        assert!(proc.state.points.is_empty());
    }

    #[test]
    fn track_cached_flag_skips_recording() {
        let track_cached = Arc::new(std::sync::atomic::AtomicI32::new(1));
        let mut proc = TrackShapeProcessor::new(
            Arc::new(AtomicBool::new(false)),
            Arc::new(AtomicBool::new(false)),
            Arc::clone(&track_cached),
            Arc::new(AtomicBool::new(false)),
        );
        let session = make_session(1);
        let dynamics = make_dynamics(10.0, 0.0);
        let lap_timing = make_lap_timing(0.5);
        let car_status = make_car_status();
        let car_idx = make_car_idx();
        let start_pos = HashMap::new();
        let chassis = crate::model::player::ChassisFrame::default();
        let environment = crate::model::environment::EnvironmentFrame::default();
        let car_inputs = make_car_inputs();

        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            car_inputs: &car_inputs,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);

        assert!(
            proc.state.complete,
            "processor must be complete when track_cached was set"
        );
        assert!(
            !proc.state.recording,
            "processor must not start recording when track_cached was set"
        );
        assert_eq!(
            track_cached.load(Ordering::Relaxed),
            -1,
            "track_cached must be reset to -1 after being consumed"
        );
    }

    #[test]
    fn resets_on_track_id_change() {
        let mut proc = make_processor();
        let session2 = make_session(99);
        let dynamics = make_dynamics(10.0, 0.0);
        let lap_timing = make_lap_timing(0.5);
        let car_status = make_car_status();
        let car_idx = make_car_idx();
        let start_pos = HashMap::new();
        let chassis = crate::model::player::ChassisFrame::default();
        let environment = crate::model::environment::EnvironmentFrame::default();
        let car_inputs = make_car_inputs();

        proc.state.recording = true;
        proc.state.start_pct = 0.0;
        proc.last_track_id = Some(42);

        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session2,
            car_idx: &car_idx,
            start_positions: &start_pos,
            car_inputs: &car_inputs,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);

        assert_eq!(proc.last_track_id, Some(99));
        assert!(!proc.state.recording);
    }

    #[test]
    fn force_start_triggers_recording() {
        let flag = Arc::new(AtomicBool::new(true));
        let mut proc = TrackShapeProcessor::new(
            Arc::clone(&flag),
            Arc::new(AtomicBool::new(false)),
            Arc::new(std::sync::atomic::AtomicI32::new(-1)),
            Arc::new(AtomicBool::new(false)),
        );

        let session = make_session(1);
        let dynamics = make_dynamics(10.0, 0.0);
        let lap_timing = make_lap_timing(0.5);
        let car_status = make_car_status();
        let car_idx = make_car_idx();
        let start_pos = HashMap::new();
        let chassis = crate::model::player::ChassisFrame::default();
        let environment = crate::model::environment::EnvironmentFrame::default();
        let car_inputs = make_car_inputs();

        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            car_inputs: &car_inputs,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);

        assert!(proc.state.recording);
        assert!(
            !flag.load(Ordering::Relaxed),
            "flag should be cleared after consume"
        );
    }

    #[test]
    fn records_and_completes_full_lap() {
        let mut state = TrackShapeState::default();
        state.start();

        state.tick_with_dt(10.0, 0.0, 0.0, 0.016);

        for i in 1..=110usize {
            let mut pct = i as f32 / 100.0;

            if pct > 1.0 {
                pct -= 1.0;
            }

            state.tick_with_dt(10.0, 0.5, pct, 0.016);
        }

        assert!(state.complete);
        assert!(!state.recording);

        let pts = state.sorted_points();
        assert!(!pts.is_empty());

        let start = &pts[0];
        let end = &pts[pts.len() - 1];

        assert!(
            (start.x - end.x).abs() < 0.01,
            "drift correction: start.x≈end.x"
        );
        assert!(
            (start.y - end.y).abs() < 0.01,
            "drift correction: start.y≈end.y"
        );

        for window in pts.windows(2) {
            assert!(
                window[0].pct <= window[1].pct,
                "points must be monotonically increasing by pct"
            );
        }
    }

    #[test]
    fn get_point_at_pct_interpolates_correctly() {
        let points = vec![
            TrackPoint {
                x: 0.0,
                y: 0.0,
                pct: 0.0,
            },
            TrackPoint {
                x: 10.0,
                y: 0.0,
                pct: 0.5,
            },
            TrackPoint {
                x: 20.0,
                y: 0.0,
                pct: 1.0,
            },
        ];

        let (x, _) = get_point_at_pct(&points, 0.25);
        assert!(
            (x - 5.0).abs() < 0.5,
            "midpoint between 0 and 10 should be ~5, got {x}"
        );

        let (x2, _) = get_point_at_pct(&points, 0.0);
        assert!((x2 - 0.0).abs() < 0.01);
    }
}
