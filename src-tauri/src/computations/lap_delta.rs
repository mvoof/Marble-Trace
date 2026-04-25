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
    pub was_on_track: bool,
    pub is_sector_start_valid: bool,
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
            was_on_track: false,
            is_sector_start_valid: false,
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
        locked.is_sector_start_valid = false;
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
    let is_on_track = frame.is_on_track.unwrap_or(false);
    let on_pit_road = frame.on_pit_road.unwrap_or(false);

    // Detect reset/tow or being on pit road: invalidate current sector start
    if on_pit_road || !is_on_track {
        locked.is_sector_start_valid = false;
        locked.last_sector_idx = -1; // Force re-emergence detection
    }

    // Detect reset/tow: car leaves track or suddenly appears in pits
    let was_on_track = locked.was_on_track;
    locked.was_on_track = is_on_track;

    let is_reset = (!is_on_track && was_on_track) || 
                   (on_pit_road && !is_on_track) ||
                   (locked.last_frame_pct >= 0.0 && lap_dist_pct < locked.last_frame_pct - 0.1 && current_lap == locked.last_lap);

    if is_reset {
        // Clear current lap progress
        locked.sector_times = vec![None; sector_count];
        locked.sector_entry_time = -1.0;
        locked.last_sector_idx = -1;
        locked.is_sector_start_valid = false;
        
        return build_frame(&locked.sector_times, best_lap_time, sector_count, -1);
    }

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

    // Handle lap change
    if current_lap != locked.last_lap && locked.last_lap >= 0 {
        // Record last sector ONLY if its start was valid
        if locked.is_sector_start_valid && locked.last_sector_idx >= 0 && locked.sector_entry_time >= 0.0 {
            let last_lap_time = frame.lap_last_lap_time.unwrap_or(0.0) as f64;
            let elapsed = last_lap_time - locked.sector_entry_time;
            if elapsed > 0.0 && elapsed < 600.0 {
                let prev = locked.last_sector_idx as usize;
                if prev < sector_count {
                    locked.sector_times[prev] = Some(elapsed as f32);
                }
            }
        }
        
        // Prepare for new lap (Crossing S/F always validates S1)
        locked.is_sector_start_valid = true;
        locked.last_sector_idx = current_sector_idx;
        locked.sector_entry_time = 0.0; // New lap starts at 0
        locked.last_lap = current_lap;
        
        // Clear only the current sector of the new lap to start fresh
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
        locked.last_frame_pct = lap_dist_pct;
        locked.last_frame_time = current_lap_time;
        if !on_pit_road && is_on_track {
            locked.is_sector_start_valid = true;
        }
    }

    // Handle sector change
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

        // Record previous sector ONLY if it had a valid start
        if locked.is_sector_start_valid && locked.last_sector_idx >= 0 && locked.sector_entry_time >= 0.0 {
            let elapsed = interpolated_crossing_time - locked.sector_entry_time;
            if elapsed > 0.0 && elapsed < 600.0 {
                let prev = locked.last_sector_idx as usize;
                if prev < sector_count {
                    locked.sector_times[prev] = Some(elapsed as f32);
                }
            }
        }

        // If we just emerged (last_sector_idx was -1), we don't validate yet.
        // If we crossed a real boundary (last_sector_idx >= 0), then the start of the NEW sector is valid.
        let was_emerging = locked.last_sector_idx == -1;
        
        locked.last_sector_idx = current_sector_idx;
        locked.sector_entry_time = interpolated_crossing_time;
        
        if !was_emerging {
            locked.is_sector_start_valid = true;
        }

        // Clear the current sector time of the new lap as we just entered it (to avoid showing stale live time)
        if (current_sector_idx as usize) < sector_count {
            locked.sector_times[current_sector_idx as usize] = None;
        }
    }

    // Update live time for the current sector ONLY if its start is valid
    if locked.is_sector_start_valid && current_sector_idx >= 0 && (current_sector_idx as usize) < sector_count {
        let live_elapsed = current_lap_time - locked.sector_entry_time;
        if live_elapsed >= 0.0 {
            locked.sector_times[current_sector_idx as usize] = Some(live_elapsed as f32);
        }
    } else if current_sector_idx >= 0 && (current_sector_idx as usize) < sector_count {
        // If start is NOT valid, ensure the time is None so UI doesn't show anything
        locked.sector_times[current_sector_idx as usize] = None;
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
