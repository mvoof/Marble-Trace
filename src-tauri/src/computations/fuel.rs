use pitwall::SessionInfo;
use serde::{Deserialize, Serialize};

use crate::iracing::frames::AllFieldsFrame;

const MAX_LAP_FUEL_HISTORY: usize = 100;
const MIN_RECORDED_FUEL_USE: f32 = 0.1;
const MAX_REALISTIC_LAP_FUEL: f32 = 20.0;

pub const DEFAULT_PIT_WARNING_LAPS: f32 = 3.0;

pub struct FuelState {
    pub lap_fuel_history: Vec<f32>,
    pub last_lap: i32,
    pub last_lap_start_fuel: Option<f32>,
    pub tracked_session_num: i32,
}

impl Default for FuelState {
    fn default() -> Self {
        Self {
            lap_fuel_history: Vec::new(),
            last_lap: -1,
            last_lap_start_fuel: None,
            tracked_session_num: -1,
        }
    }
}

impl FuelState {
    pub fn reset(&mut self) {
        *self = Self::default();
    }

    pub fn update(&mut self, current_lap: i32, fuel_level: f32, session_num: i32) {
        if session_num != self.tracked_session_num {
            self.reset();
            self.tracked_session_num = session_num;
        }

        if self.last_lap < 0 || current_lap < self.last_lap {
            if current_lap < self.last_lap && self.last_lap >= 0 {
                self.lap_fuel_history.clear();
            }

            self.last_lap = current_lap;
            self.last_lap_start_fuel = Some(fuel_level);

            return;
        }

        if current_lap != self.last_lap {
            if let Some(start_fuel) = self.last_lap_start_fuel {
                let used = start_fuel - fuel_level;

                if used > MIN_RECORDED_FUEL_USE && used < MAX_REALISTIC_LAP_FUEL {
                    self.lap_fuel_history.push(used);

                    if self.lap_fuel_history.len() > MAX_LAP_FUEL_HISTORY {
                        self.lap_fuel_history.remove(0);
                    }
                }
            }

            self.last_lap = current_lap;
            self.last_lap_start_fuel = Some(fuel_level);
        }
    }

    pub fn avg(&self) -> Option<f32> {
        if self.lap_fuel_history.is_empty() {
            return None;
        }

        let sum: f32 = self.lap_fuel_history.iter().sum();

        Some(sum / self.lap_fuel_history.len() as f32)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct FuelComputedFrame {
    pub avg_per_lap: Option<f32>,
    pub laps_remaining: Option<f32>,
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
    pub lap_fuel_history: Vec<f32>,
}

pub fn compute(
    frame: &AllFieldsFrame,
    session: &SessionInfo,
    session_num: Option<i32>,
    pit_warning_laps: f32,
    fuel_state: &FuelState,
) -> FuelComputedFrame {
    let fuel_level = frame.fuel_level;

    let avg_per_lap = fuel_state.avg();

    let laps_remaining = avg_per_lap.and_then(|avg| {
        if avg > 0.0 {
            Some(fuel_level / avg)
        } else {
            None
        }
    });

    let current_session_num = session_num.unwrap_or(session.session_info.current_session_num);

    let sessions = &session.session_info.sessions;
    let current_session = if current_session_num >= 0 {
        sessions.get(current_session_num as usize)
    } else {
        None
    };

    let session_laps = current_session
        .map(|s| s.session_laps.as_str())
        .unwrap_or("unlimited");

    let is_timed_race = session_laps.eq_ignore_ascii_case("unlimited");

    let laps_to_finish: Option<f32> = if !is_timed_race {
        session_laps.parse::<f32>().ok().map(|total| {
            let current_lap = frame.lap.unwrap_or(0) as f32;
            let lap_dist_pct = frame.lap_dist_pct.unwrap_or(0.0);
            total - current_lap - lap_dist_pct
        })
    } else {
        let best_lap = frame.lap_best_lap_time.filter(|&t| t > 0.0);
        let last_lap = frame.lap_last_lap_time.filter(|&t| t > 0.0);

        best_lap.or(last_lap).and_then(|lap_time_sec| {
            frame
                .session_time_remain
                .filter(|&t| t > 0.0)
                .map(|remain| remain as f32 / lap_time_sec)
        })
    };

    let fuel_needed = match (laps_to_finish, avg_per_lap) {
        (Some(ltf), Some(avg)) if avg > 0.0 => Some(ltf * avg),
        _ => None,
    };

    let shortage = fuel_needed.map(|needed| fuel_level - needed);
    let fuel_to_add = fuel_needed.map(|needed| (needed - fuel_level).max(0.0));
    let fuel_to_add_with_buffer = match (laps_to_finish, avg_per_lap) {
        (Some(ltf), Some(avg)) if avg > 0.0 => Some(((ltf + 1.0) * avg - fuel_level).max(0.0)),
        _ => None,
    };

    let current_lap_i = frame.lap.unwrap_or(0);

    let (pit_window_start, pit_window_end) = match (laps_remaining, avg_per_lap) {
        (Some(rem), Some(avg)) if avg > 0.0 => (
            Some((current_lap_i as f32 + rem - pit_warning_laps).floor() as i32),
            Some((current_lap_i as f32 + rem - 1.0).floor() as i32),
        ),
        _ => (None, None),
    };

    let pit_warning = match (shortage, avg_per_lap) {
        (Some(s), Some(avg)) if avg > 0.0 => s < 0.0 || s < pit_warning_laps * avg,
        _ => false,
    };

    let fuel_save_per_lap = match (shortage, laps_to_finish) {
        (Some(s), Some(ltf)) if s < 0.0 && ltf > 0.0 => Some(s.abs() / ltf),
        _ => None,
    };

    FuelComputedFrame {
        avg_per_lap,
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
        lap_fuel_history: fuel_state.lap_fuel_history.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_empty_history() {
        let frame = AllFieldsFrame {
            fuel_level: 50.0,
            ..Default::default()
        };
        let session = SessionInfo::default();
        let fuel_state = FuelState::default();

        let result = compute(&frame, &session, None, 3.0, &fuel_state);

        assert_eq!(result.avg_per_lap, None);
        assert_eq!(result.laps_remaining, None);
        assert_eq!(result.laps_to_finish, None);
        assert_eq!(result.shortage, None);
        assert_eq!(result.fuel_to_add, None);
        assert_eq!(result.fuel_to_add_with_buffer, None);
        assert_eq!(result.fuel_save_per_lap, None);
        assert_eq!(result.pit_warning, false);
        assert_eq!(result.pit_window_start, None);
        assert_eq!(result.pit_window_end, None);
        assert_eq!(result.is_timed_race, true);
        assert!(result.lap_fuel_history.is_empty());
    }

    #[test]
    fn test_compute_with_history() {
        let frame = AllFieldsFrame {
            fuel_level: 50.0,
            lap: Some(5),
            ..Default::default()
        };
        let session = SessionInfo::default();
        let mut fuel_state = FuelState::default();
        fuel_state.lap_fuel_history = vec![2.0, 2.0, 2.0];

        let result = compute(&frame, &session, None, 3.0, &fuel_state);

        assert_eq!(result.avg_per_lap, Some(2.0));
        assert_eq!(result.laps_remaining, Some(25.0)); // 50.0 / 2.0
    }
}
