use std::sync::Mutex;

use pitwall::SessionInfo;
use serde::{Deserialize, Serialize};

use crate::iracing::frames::AllFieldsFrame;
use crate::utils::lock_or_recover;

const MAX_REASONABLE_SECTOR_TIME: f32 = 120.0;
const MAX_REASONABLE_LAP_TIME: f32 = 600.0;

/// Sector timing state — tracks current lap sector times and personal best sectors.
/// Total delta is provided directly by iRacing via LapTimingFrame fields.
pub struct LapDeltaState {
    pub last_sector_idx: i32,
    pub sector_entry_time: f64,
    pub sector_times: Vec<Option<f32>>,
    pub last_lap: i32,
    pub sector_count: usize,
    pub cached_sector_pcts: Vec<f64>,
    pub sectors_checksum: u64,
    pub last_frame_pct: f64,
    pub last_frame_time: f64,
    pub was_on_track: bool,
    pub is_sector_start_valid: bool,

    // Personal best: sector times from the driver's best completed lap.
    pub personal_best_lap_time: Option<f32>,
    pub personal_best_lap_sectors: Vec<Option<f32>>,
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
            sectors_checksum: 0,
            last_frame_pct: -1.0,
            last_frame_time: -1.0,
            was_on_track: false,
            is_sector_start_valid: false,
            personal_best_lap_time: None,
            personal_best_lap_sectors: Vec::new(),
        }
    }
}

impl LapDeltaState {
    pub fn reset(&mut self) {
        *self = Self::default();
    }
}

/// Sector timing data for the sector matrix widget.
/// Total delta is provided directly by iRacing via LapTimingFrame delta fields.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LapDeltaFrame {
    pub sector_times: Vec<Option<f32>>,
    pub current_sector_idx: i32,
    /// Per-sector delta vs driver's personal best lap (sector matrix display only)
    pub sector_deltas: Vec<Option<f32>>,
}

fn sectors_checksum(session: &SessionInfo) -> u64 {
    let sectors = session
        .split_time_info
        .as_ref()
        .and_then(|s| s.sectors.as_deref())
        .unwrap_or(&[]);

    const MULTIPLIER: u64 = 6_364_136_223_846_793_005;
    let mut h: u64 = sectors.len() as u64;
    for s in sectors {
        if let (Some(num), Some(pct)) = (s.sector_num, s.sector_start_pct) {
            h = h.wrapping_mul(MULTIPLIER).wrapping_add(num as u64);
            h = h.wrapping_mul(MULTIPLIER).wrapping_add(pct.to_bits());
        }
    }
    h
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
        .filter_map(|s| Some((s.sector_num?, s.sector_start_pct?)))
        .collect();

    pcts.sort_by(|a, b| a.1.total_cmp(&b.1));
    pcts.into_iter().map(|(_, pct)| pct).collect()
}

pub fn compute(
    frame: &AllFieldsFrame,
    session: &SessionInfo,
    state: &Mutex<LapDeltaState>,
) -> LapDeltaFrame {
    let mut locked = lock_or_recover(state);

    update_sector_cache(&mut locked, session);

    let sector_count = locked.cached_sector_pcts.len();

    let lap_dist_pct = match frame.lap_dist_pct {
        Some(p) if p >= 0.0 => p as f64,
        _ => {
            return build_frame(&locked, -1, 0.0);
        }
    };

    let current_lap_time = frame.lap_current_lap_time as f64;
    let current_lap = frame.lap.unwrap_or(0);
    let is_on_track = frame.is_on_track.unwrap_or(false);
    let on_pit_road = frame.on_pit_road.unwrap_or(false);

    if on_pit_road || !is_on_track {
        locked.is_sector_start_valid = false;
        locked.last_sector_idx = -1;
    }

    let was_on_track = locked.was_on_track;
    locked.was_on_track = is_on_track;

    let is_reset = ((on_pit_road || was_on_track) && !is_on_track)
        || (locked.last_frame_pct >= 0.0
            && lap_dist_pct < locked.last_frame_pct - 0.1
            && current_lap == locked.last_lap);

    if is_reset {
        handle_reset(&mut locked, sector_count);
        return build_frame(&locked, -1, 0.0);
    }

    if sector_count == 0 {
        return build_frame(&locked, -1, 0.0);
    }

    let current_sector_idx = find_current_sector(&locked, lap_dist_pct);
    let current_sector_fraction =
        compute_sector_fraction(&locked, current_sector_idx, lap_dist_pct);

    if current_lap != locked.last_lap && locked.last_lap >= 0 {
        handle_lap_change(
            &mut locked,
            frame.lap_last_lap_time.unwrap_or(0.0) as f64,
            current_lap,
            current_sector_idx,
            lap_dist_pct,
            current_lap_time,
        );
        return build_frame(&locked, current_sector_idx, current_sector_fraction);
    }

    if locked.last_lap == -1 {
        init_state_on_first_lap(
            &mut locked,
            current_lap,
            current_sector_idx,
            current_lap_time,
            lap_dist_pct,
            on_pit_road,
            is_on_track,
        );
    }

    if current_sector_idx != locked.last_sector_idx {
        handle_sector_change(
            &mut locked,
            current_sector_idx,
            lap_dist_pct,
            current_lap_time,
        );
    }

    update_live_sector(&mut locked, current_sector_idx, current_lap_time);

    locked.last_frame_pct = lap_dist_pct;
    locked.last_frame_time = current_lap_time;

    build_frame(&locked, current_sector_idx, current_sector_fraction)
}

fn update_sector_cache(locked: &mut LapDeltaState, session: &SessionInfo) {
    let checksum = sectors_checksum(session);
    if locked.sectors_checksum != checksum {
        locked.sectors_checksum = checksum;
        locked.cached_sector_pcts = get_sector_pcts(session);
    }

    let sector_count = locked.cached_sector_pcts.len();
    if locked.sector_count != sector_count {
        locked.sector_times = vec![None; sector_count];
        locked.personal_best_lap_sectors = vec![None; sector_count];
        locked.sector_count = sector_count;
        locked.last_sector_idx = -1;
        locked.sector_entry_time = -1.0;
        locked.last_lap = -1;
        locked.last_frame_pct = -1.0;
        locked.last_frame_time = -1.0;
        locked.is_sector_start_valid = false;
        locked.personal_best_lap_time = None;
    }
}

fn handle_reset(locked: &mut LapDeltaState, sector_count: usize) {
    locked.sector_times = vec![None; sector_count];
    locked.sector_entry_time = -1.0;
    locked.last_sector_idx = -1;
    locked.is_sector_start_valid = false;
}

fn find_current_sector(locked: &LapDeltaState, lap_dist_pct: f64) -> i32 {
    let mut current_sector_idx = 0i32;
    for (i, &pct) in locked.cached_sector_pcts.iter().enumerate().rev() {
        if pct <= lap_dist_pct {
            current_sector_idx = i as i32;
            break;
        }
    }
    current_sector_idx
}

fn compute_sector_fraction(
    locked: &LapDeltaState,
    current_sector_idx: i32,
    lap_dist_pct: f64,
) -> f32 {
    let idx = current_sector_idx as usize;
    let start = locked.cached_sector_pcts.get(idx).copied().unwrap_or(0.0);
    let end = locked
        .cached_sector_pcts
        .get(idx + 1)
        .copied()
        .unwrap_or(1.0);
    let len = end - start;
    if len > 0.0 {
        ((lap_dist_pct - start) / len).clamp(0.0, 1.0) as f32
    } else {
        0.0
    }
}

fn handle_lap_change(
    locked: &mut LapDeltaState,
    last_lap_time_f64: f64,
    current_lap: i32,
    current_sector_idx: i32,
    lap_dist_pct: f64,
    current_lap_time: f64,
) {
    let sector_count = locked.sector_count;

    if locked.is_sector_start_valid
        && locked.last_sector_idx >= 0
        && locked.sector_entry_time >= 0.0
    {
        let elapsed = (last_lap_time_f64 - locked.sector_entry_time) as f32;
        if elapsed > 0.0 && elapsed < MAX_REASONABLE_SECTOR_TIME {
            let idx = locked.last_sector_idx as usize;
            if idx < sector_count {
                locked.sector_times[idx] = Some(elapsed);
            }
        }
    }

    // Save personal best if this completed lap is faster and all sectors valid.
    let lap_last_lap_time = last_lap_time_f64 as f32;
    if lap_last_lap_time > 0.0 && lap_last_lap_time < MAX_REASONABLE_LAP_TIME {
        let all_valid = locked.sector_times.iter().all(|t| t.is_some());
        if all_valid
            && locked
                .personal_best_lap_time
                .is_none_or(|pb| lap_last_lap_time < pb)
        {
            locked.personal_best_lap_time = Some(lap_last_lap_time);
            locked.personal_best_lap_sectors = locked.sector_times.clone();
        }
    }

    locked.is_sector_start_valid = true;
    locked.last_sector_idx = current_sector_idx;
    locked.sector_entry_time = 0.0;
    locked.last_lap = current_lap;

    if (current_sector_idx as usize) < sector_count {
        locked.sector_times[current_sector_idx as usize] = None;
    }

    locked.last_frame_pct = lap_dist_pct;
    locked.last_frame_time = current_lap_time;
}

fn init_state_on_first_lap(
    locked: &mut LapDeltaState,
    current_lap: i32,
    current_sector_idx: i32,
    current_lap_time: f64,
    lap_dist_pct: f64,
    on_pit_road: bool,
    is_on_track: bool,
) {
    locked.last_lap = current_lap;
    locked.last_sector_idx = current_sector_idx;
    locked.sector_entry_time = current_lap_time;
    locked.last_frame_pct = lap_dist_pct;
    locked.last_frame_time = current_lap_time;
    if !on_pit_road && is_on_track {
        locked.is_sector_start_valid = true;
    }
}

fn handle_sector_change(
    locked: &mut LapDeltaState,
    current_sector_idx: i32,
    lap_dist_pct: f64,
    current_lap_time: f64,
) {
    let sector_count = locked.sector_count;
    let sector_start_pct = locked
        .cached_sector_pcts
        .get(current_sector_idx as usize)
        .copied()
        .unwrap_or(0.0);

    let mut interpolated_time = current_lap_time;
    if locked.last_frame_pct >= 0.0
        && lap_dist_pct > locked.last_frame_pct
        && sector_start_pct > locked.last_frame_pct
        && sector_start_pct <= lap_dist_pct
    {
        let dist_range = lap_dist_pct - locked.last_frame_pct;
        let time_range = current_lap_time - locked.last_frame_time;
        let dist_to_sector = sector_start_pct - locked.last_frame_pct;
        let fraction = dist_to_sector / dist_range;
        interpolated_time = locked.last_frame_time + time_range * fraction;
    }

    if locked.is_sector_start_valid
        && locked.last_sector_idx >= 0
        && locked.sector_entry_time >= 0.0
    {
        let elapsed = (interpolated_time - locked.sector_entry_time) as f32;
        if elapsed > 0.0 && elapsed < MAX_REASONABLE_SECTOR_TIME {
            let idx = locked.last_sector_idx as usize;
            if idx < sector_count {
                locked.sector_times[idx] = Some(elapsed);
            }
        }
    }

    let was_emerging = locked.last_sector_idx == -1;
    locked.last_sector_idx = current_sector_idx;
    locked.sector_entry_time = interpolated_time;

    if !was_emerging {
        locked.is_sector_start_valid = true;
    }

    if (current_sector_idx as usize) < sector_count {
        locked.sector_times[current_sector_idx as usize] = None;
    }
}

fn update_live_sector(locked: &mut LapDeltaState, current_sector_idx: i32, current_lap_time: f64) {
    let sector_count = locked.sector_count;
    if locked.is_sector_start_valid
        && current_sector_idx >= 0
        && (current_sector_idx as usize) < sector_count
    {
        let live_elapsed = (current_lap_time - locked.sector_entry_time) as f32;
        if live_elapsed >= 0.0 {
            locked.sector_times[current_sector_idx as usize] = Some(live_elapsed);
        }
    } else if current_sector_idx >= 0 && (current_sector_idx as usize) < sector_count {
        locked.sector_times[current_sector_idx as usize] = None;
    }
}

fn build_frame(
    state: &LapDeltaState,
    current_sector_idx: i32,
    current_sector_fraction: f32,
) -> LapDeltaFrame {
    let sector_count = state.sector_times.len();

    let sector_deltas: Vec<Option<f32>> = (0..sector_count)
        .map(|i| {
            let elapsed = state.sector_times[i]?;
            let best = (*state.personal_best_lap_sectors.get(i)?)?;
            let delta = if (i as i32) < current_sector_idx {
                elapsed - best
            } else if (i as i32) == current_sector_idx {
                elapsed - best * current_sector_fraction
            } else {
                return None;
            };
            Some(delta)
        })
        .collect();

    LapDeltaFrame {
        sector_times: state.sector_times.clone(),
        current_sector_idx,
        sector_deltas,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::iracing::frames::AllFieldsFrame;
    use std::sync::Mutex;

    fn create_mock_frame(lap_dist_pct: f32, lap_time: f32) -> AllFieldsFrame {
        AllFieldsFrame {
            lap_dist_pct: Some(lap_dist_pct),
            lap_current_lap_time: lap_time,
            lap: Some(1),
            is_on_track: Some(true),
            ..Default::default()
        }
    }

    fn create_mock_session() -> SessionInfo {
        use pitwall::schema::session::{Sector, SplitTimeInfo};
        SessionInfo {
            split_time_info: Some(SplitTimeInfo {
                sectors: Some(vec![
                    Sector {
                        sector_num: Some(0),
                        sector_start_pct: Some(0.0),
                        ..Default::default()
                    },
                    Sector {
                        sector_num: Some(1),
                        sector_start_pct: Some(0.5),
                        ..Default::default()
                    },
                ]),
                ..Default::default()
            }),
            ..Default::default()
        }
    }

    #[test]
    fn test_interpolation_at_sector_crossing() {
        let session = create_mock_session();
        let checksum = sectors_checksum(&session);
        let pcts = get_sector_pcts(&session);

        let state = Mutex::new(LapDeltaState {
            cached_sector_pcts: pcts,
            sector_count: 2,
            sector_times: vec![None, None],
            last_lap: 1,
            last_frame_pct: 0.4,
            last_frame_time: 40.0,
            last_sector_idx: 0,
            sector_entry_time: 0.0,
            is_sector_start_valid: true,
            sectors_checksum: checksum,
            ..Default::default()
        });

        let frame = create_mock_frame(0.6, 60.0);

        let _result = compute(&frame, &session, &state);

        let locked = state.lock().unwrap();
        let elapsed = locked.sector_times[0].unwrap();
        assert!((elapsed - 50.0).abs() < 0.001);
        assert!((locked.sector_entry_time - 50.0).abs() < 0.001);
        assert_eq!(locked.last_sector_idx, 1);
    }

    #[test]
    fn test_lap_change_resets_sector_times() {
        let session = create_mock_session();
        let checksum = sectors_checksum(&session);
        let pcts = get_sector_pcts(&session);

        let state = Mutex::new(LapDeltaState {
            cached_sector_pcts: pcts,
            sector_count: 2,
            last_lap: 1,
            last_sector_idx: 1,
            sector_entry_time: 80.0,
            is_sector_start_valid: true,
            sector_times: vec![Some(50.0), Some(20.0)],
            sectors_checksum: checksum,
            ..Default::default()
        });

        let mut frame = create_mock_frame(0.1, 5.0);
        frame.lap = Some(2);
        frame.lap_last_lap_time = Some(100.0);

        let _result = compute(&frame, &session, &state);

        let locked = state.lock().unwrap();
        assert_eq!(locked.last_lap, 2);
        assert_eq!(locked.last_sector_idx, 0);
        assert_eq!(locked.sector_times[1], Some(20.0));
    }
}
