use pitwall::SessionInfo;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::iracing::frames::AllFieldsFrame;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FuelComputedFrame {
    pub avg_per_lap: f32,
    pub current_use_per_lap: f32,
    pub laps_remaining: f32,
    pub laps_to_finish: Option<f32>,
    /// Positive = surplus liters, negative = deficit
    pub shortage: Option<f32>,
    pub fuel_to_add: Option<f32>,
    pub fuel_to_add_with_buffer: Option<f32>,
    pub fuel_save_per_lap: Option<f32>,
    pub pit_warning: bool,
    pub pit_window_start: Option<i32>,
    pub pit_window_end: Option<i32>,
    pub is_timed_race: bool,
}

fn kg_per_ltr_from_session(session: &SessionInfo) -> f32 {
    session
        .driver_info
        .as_ref()
        .and_then(|di| di.driver_car_fuel_kg_per_ltr)
        .filter(|&k| k > 0.0)
        .unwrap_or(1.0) as f32
}

/// Compute instant avg fuel per lap from current telemetry (fuel_use_per_hour × lap_time).
/// Returns None when the car is not consuming fuel or no lap time is available.
pub fn instant_avg(frame: &AllFieldsFrame, session: &SessionInfo) -> Option<f32> {
    let fuel_use_per_hour = frame.fuel_use_per_hour.filter(|&v| v > 0.0)?;
    let best_lap = frame.lap_best_lap_time.filter(|&t| t > 0.0);
    let last_lap = frame.lap_last_lap_time.filter(|&t| t > 0.0);
    let lap_time_sec = best_lap.or(last_lap)?;

    let kg_per_ltr = kg_per_ltr_from_session(session);
    let use_per_hour_ltr = fuel_use_per_hour / kg_per_ltr;
    let avg = (use_per_hour_ltr / 3600.0) * lap_time_sec;

    if avg > 0.0 { Some(avg) } else { None }
}

pub fn compute(
    frame: &AllFieldsFrame,
    session: &SessionInfo,
    session_num: Option<i32>,
    pit_warning_laps: f32,
    stable_avg: Option<f32>,
) -> Option<FuelComputedFrame> {
    let fuel_level = frame.fuel_level;

    let current_use_per_lap = instant_avg(frame, session).unwrap_or(0.0);

    let avg_per_lap = stable_avg.or_else(|| instant_avg(frame, session))?;

    if avg_per_lap <= 0.0 {
        return None;
    }

    let laps_remaining = fuel_level / avg_per_lap;

    let current_session_num = session_num.unwrap_or(session.session_info.current_session_num);
    let sessions = &session.session_info.sessions;
    let current_session = sessions.get(current_session_num as usize);
    let session_laps = current_session
        .map(|s| s.session_laps.as_str())
        .unwrap_or("unlimited");

    let is_timed_race = session_laps.eq_ignore_ascii_case("unlimited");

    let laps_to_finish: Option<f32> = if !is_timed_race {
        let total = session_laps.parse::<f32>().ok()?;
        let current_lap = frame.lap.unwrap_or(0) as f32;
        let lap_dist_pct = frame.lap_dist_pct.unwrap_or(0.0);
        Some(total - current_lap - lap_dist_pct)
    } else {
        let best_lap = frame.lap_best_lap_time.filter(|&t| t > 0.0);
        let last_lap = frame.lap_last_lap_time.filter(|&t| t > 0.0);
        let lap_time_sec = best_lap.or(last_lap)?;
        let remain = frame.session_time_remain.filter(|&t| t > 0.0)?;
        Some(remain as f32 / lap_time_sec)
    };

    let fuel_needed = laps_to_finish.map(|ltf| ltf * avg_per_lap);
    let shortage = fuel_needed.map(|needed| fuel_level - needed);
    let fuel_to_add = fuel_needed.map(|needed| (needed - fuel_level).max(0.0));
    let fuel_to_add_with_buffer =
        laps_to_finish.map(|ltf| ((ltf + 1.0) * avg_per_lap - fuel_level).max(0.0));

    let current_lap_i = frame.lap.unwrap_or(0);
    let pit_window_start =
        Some((current_lap_i as f32 + laps_remaining - pit_warning_laps).floor() as i32);
    let pit_window_end = Some((current_lap_i as f32 + laps_remaining - 1.0).floor() as i32);

    let pit_warning = shortage
        .map(|s| s < 0.0 || s < pit_warning_laps * avg_per_lap)
        .unwrap_or(false);

    let fuel_save_per_lap = match (shortage, laps_to_finish) {
        (Some(s), Some(ltf)) if s < 0.0 && ltf > 0.0 => Some(s.abs() / ltf),
        _ => None,
    };

    Some(FuelComputedFrame {
        avg_per_lap,
        current_use_per_lap,
        laps_remaining,
        laps_to_finish,
        shortage,
        fuel_to_add,
        fuel_to_add_with_buffer,
        fuel_save_per_lap,
        pit_warning,
        pit_window_start,
        pit_window_end,
        is_timed_race,
    })
}
