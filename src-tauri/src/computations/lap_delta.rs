use std::sync::Mutex;

use pitwall::SessionInfo;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::iracing::frames::AllFieldsFrame;

pub struct LapDeltaState {
    pub last_sector_idx: i32,
    pub sector_entry_time: f64,
    pub sector_times: Vec<Option<f32>>,
    pub last_lap: i32,
    pub sector_count: usize,
    pub cached_sector_pcts: Vec<f64>,
    pub last_frame_pct: f64,
    pub last_frame_time: f64,
}

impl Default for LapDeltaState {
    fn default() -> Self {
        Self {
            last_sector_idx: -1,
            sector_entry_time: -1.0,
            sector_times: Vec::new(),
            last_lap: -1,
            sector_count: 0,
            cached_sector_pcts: Vec::new(),
            last_frame_pct: -1.0,
            last_frame_time: -1.0,
        }
    }
}

impl LapDeltaState {
    pub fn reset(&mut self) {
        *self = Self::default();
    }
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LapDeltaFrame {
    pub sector_times: Vec<Option<f32>>,
    pub sector_deltas: Vec<Option<f32>>,
    pub current_sector_idx: i32,
}

fn get_sector_pcts(session: &SessionInfo) -> Vec<f64> {
    let sectors = session
        .split_time_info
        .as_ref()
        .and_then(|s| s.sectors.as_deref())
        .unwrap_or(&[]);

    if sectors.is_empty() {
        return Vec::new();
    }

    let mut pcts: Vec<(i32, f64)> = sectors
        .iter()
        .filter_map(|s| Some((s.sector_num?, s.sector_start_pct? as f64)))
        .collect();

    pcts.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    pcts.into_iter().map(|(_, pct)| pct).collect()
}

pub fn compute(
    frame: &AllFieldsFrame,
    session: &SessionInfo,
    state: &Mutex<LapDeltaState>,
) -> LapDeltaFrame {
    let mut locked = state.lock().unwrap_or_else(|e| e.into_inner());

    let sector_pcts = get_sector_pcts(session);
    let sector_count = sector_pcts.len();

    if locked.cached_sector_pcts != sector_pcts {
        locked.cached_sector_pcts = sector_pcts;
        locked.sector_times = vec![None; sector_count];
        locked.sector_count = sector_count;
        locked.last_sector_idx = -1;
        locked.sector_entry_time = -1.0;
        locked.last_lap = -1;
        locked.last_frame_pct = -1.0;
        locked.last_frame_time = -1.0;
    }

    let best_lap_time = frame
        .lap_best_lap_time
        .filter(|&t| t > 0.0)
        .map(|t| t as f64);

    let lap_dist_pct = match frame.lap_dist_pct {
        Some(p) if p >= 0.0 => p as f64,
        _ => {
            return build_frame(&locked.sector_times, best_lap_time, sector_count, -1);
        }
    };

    let current_lap_time = frame.lap_current_lap_time as f64;
    let current_lap = frame.lap.unwrap_or(0);

    if sector_count == 0 {
        return build_frame(&locked.sector_times, best_lap_time, sector_count, -1);
    }

    let mut current_sector_idx = 0i32;
    for (i, &pct) in locked.cached_sector_pcts.iter().enumerate().rev() {
        if pct <= lap_dist_pct {
            current_sector_idx = i as i32;
            break;
        }
    }

    // Handle lap change: record last sector of previous lap
    if current_lap != locked.last_lap && locked.last_lap >= 0 {
        if locked.last_sector_idx >= 0 && locked.sector_entry_time >= 0.0 {
            let last_lap_time = frame.lap_last_lap_time.unwrap_or(0.0) as f64;
            let elapsed = last_lap_time - locked.sector_entry_time;
            if elapsed > 0.0 && elapsed < 600.0 {
                let prev = locked.last_sector_idx as usize;
                if prev < sector_count {
                    locked.sector_times[prev] = Some(elapsed as f32);
                }
            }
        }
        
        // Prepare for new lap
        locked.last_sector_idx = current_sector_idx;
        locked.sector_entry_time = 0.0; // New lap starts at 0
        locked.last_lap = current_lap;
        
        // Clear the current sector time of the new lap
        if (current_sector_idx as usize) < sector_count {
            locked.sector_times[current_sector_idx as usize] = None;
        }

        locked.last_frame_pct = lap_dist_pct;
        locked.last_frame_time = current_lap_time;
        
        let sector_times = locked.sector_times.clone();
        return build_frame(
            &sector_times,
            best_lap_time,
            sector_count,
            current_sector_idx,
        );
    }

    if locked.last_lap == -1 {
        locked.last_lap = current_lap;
        locked.last_sector_idx = current_sector_idx;
        locked.sector_entry_time = current_lap_time;
        if (current_sector_idx as usize) < sector_count {
            locked.sector_times[current_sector_idx as usize] = None;
        }
        locked.last_frame_pct = lap_dist_pct;
        locked.last_frame_time = current_lap_time;
    }

    if current_sector_idx != locked.last_sector_idx {
        let sector_start_pct = locked.cached_sector_pcts.get(current_sector_idx as usize).copied().unwrap_or(0.0);
        
        // Linear interpolation to find the exact crossing time
        let mut interpolated_crossing_time = current_lap_time;
        if locked.last_frame_pct >= 0.0 && 
           lap_dist_pct > locked.last_frame_pct && 
           sector_start_pct > locked.last_frame_pct && 
           sector_start_pct <= lap_dist_pct 
        {
            let dist_range = lap_dist_pct - locked.last_frame_pct;
            let time_range = current_lap_time - locked.last_frame_time;
            let dist_to_sector = sector_start_pct - locked.last_frame_pct;
            let fraction = dist_to_sector / dist_range;
            interpolated_crossing_time = locked.last_frame_time + time_range * fraction;
        }

        if locked.last_sector_idx >= 0 && locked.sector_entry_time >= 0.0 {
            let elapsed = interpolated_crossing_time - locked.sector_entry_time;
            if elapsed > 0.0 && elapsed < 600.0 {
                let prev = locked.last_sector_idx as usize;
                if prev < sector_count {
                    locked.sector_times[prev] = Some(elapsed as f32);
                }
            }
        }
        locked.last_sector_idx = current_sector_idx;
        locked.sector_entry_time = interpolated_crossing_time;

        // Clear the current sector time as we just entered it
        if (current_sector_idx as usize) < sector_count {
            locked.sector_times[current_sector_idx as usize] = None;
        }
    }

    locked.last_frame_pct = lap_dist_pct;
    locked.last_frame_time = current_lap_time;

    let sector_times = locked.sector_times.clone();
    build_frame(
        &sector_times,
        best_lap_time,
        sector_count,
        current_sector_idx,
    )
}

fn build_frame(
    sector_times: &[Option<f32>],
    best_lap_time: Option<f64>,
    sector_count: usize,
    current_sector_idx: i32,
) -> LapDeltaFrame {
    let sector_deltas = sector_times
        .iter()
        .map(|&t| {
            let t = t?;
            let best = best_lap_time? as f32;
            if sector_count == 0 {
                return None;
            }
            let sector_best = best / sector_count as f32;
            Some(t - sector_best)
        })
        .collect();

    LapDeltaFrame {
        sector_times: sector_times.to_vec(),
        sector_deltas,
        current_sector_idx,
    }
}
