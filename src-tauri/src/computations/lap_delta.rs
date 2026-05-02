use std::sync::Mutex;

use pitwall::SessionInfo;
use serde::{Deserialize, Serialize};

use crate::iracing::frames::AllFieldsFrame;
use crate::utils::lock_or_recover;

const MAX_REASONABLE_SECTOR_TIME: f32 = 120.0;
const MAX_REASONABLE_LAP_TIME: f32 = 600.0;

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

    // Session best: game_delta snapshotted at sector boundaries so
    // sector deltas sum consistently to the total.
    pub sector_game_delta_at_entry: Option<f32>,
    pub session_best_sector_deltas: Vec<Option<f32>>,
    pub last_game_delta: Option<f32>,

    // Personal best: sector times from the single best completed lap.
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
            sector_game_delta_at_entry: None,
            session_best_sector_deltas: Vec::new(),
            last_game_delta: None,
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

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LapDeltaFrame {
    pub sector_times: Vec<Option<f32>>,
    pub current_sector_idx: i32,

    /// Delta vs session best. Total uses iRacing's live delta when available.
    /// Sector deltas are snapshotted at boundaries so they always sum to total.
    pub session_best_total: f32,
    pub session_best_sectors: Vec<Option<f32>>,

    /// Delta vs personal best (the driver's own best completed lap).
    /// Sector deltas are from the same reference lap so they always sum to total.
    pub personal_best_total: f32,
    pub personal_best_sectors: Vec<Option<f32>>,
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
            return build_frame(&locked, -1, 0.0, None);
        }
    };

    let current_lap_time = frame.lap_current_lap_time as f64;
    let current_lap = frame.lap.unwrap_or(0);
    let is_on_track = frame.is_on_track.unwrap_or(false);
    let on_pit_road = frame.on_pit_road.unwrap_or(false);
    let game_live_delta = frame.lap_delta_to_session_best_live;

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
        handle_reset(&mut locked, sector_count, game_live_delta);
        return build_frame(&locked, -1, 0.0, None);
    }

    if sector_count == 0 {
        locked.last_game_delta = game_live_delta;
        return build_frame(&locked, -1, 0.0, None);
    }

    let current_sector_idx = find_current_sector(&locked, lap_dist_pct);
    let current_sector_fraction =
        compute_sector_fraction(&locked, current_sector_idx, lap_dist_pct);

    // Handle lap change: close last sector of previous lap, save personal best.
    if current_lap != locked.last_lap && locked.last_lap >= 0 {
        handle_lap_change(
            &mut locked,
            frame.lap_last_lap_time.unwrap_or(0.0) as f64,
            current_lap,
            current_sector_idx,
            game_live_delta,
            lap_dist_pct,
            current_lap_time,
        );
        return build_frame(
            &locked,
            current_sector_idx,
            current_sector_fraction,
            game_live_delta,
        );
    }

    if locked.last_lap == -1 {
        init_state_on_first_lap(
            &mut locked,
            current_lap,
            current_sector_idx,
            current_lap_time,
            game_live_delta,
            lap_dist_pct,
            on_pit_road,
            is_on_track,
        );
    }

    // Handle sector change within the same lap.
    if current_sector_idx != locked.last_sector_idx {
        handle_sector_change(
            &mut locked,
            current_sector_idx,
            lap_dist_pct,
            current_lap_time,
            game_live_delta,
        );
    }

    update_live_sector(&mut locked, current_sector_idx, current_lap_time);

    locked.last_frame_pct = lap_dist_pct;
    locked.last_frame_time = current_lap_time;
    locked.last_game_delta = game_live_delta;

    build_frame(
        &locked,
        current_sector_idx,
        current_sector_fraction,
        game_live_delta,
    )
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
        locked.session_best_sector_deltas = vec![None; sector_count];
        locked.personal_best_lap_sectors = vec![None; sector_count];
        locked.sector_count = sector_count;
        locked.last_sector_idx = -1;
        locked.sector_entry_time = -1.0;
        locked.sector_game_delta_at_entry = None;
        locked.last_game_delta = None;
        locked.last_lap = -1;
        locked.last_frame_pct = -1.0;
        locked.last_frame_time = -1.0;
        locked.is_sector_start_valid = false;
        locked.personal_best_lap_time = None;
    }
}

fn handle_reset(locked: &mut LapDeltaState, sector_count: usize, game_live_delta: Option<f32>) {
    locked.sector_times = vec![None; sector_count];
    locked.session_best_sector_deltas = vec![None; sector_count];
    locked.sector_game_delta_at_entry = None;
    locked.sector_entry_time = -1.0;
    locked.last_sector_idx = -1;
    locked.is_sector_start_valid = false;
    locked.last_game_delta = game_live_delta;
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
    game_live_delta: Option<f32>,
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

    // Snapshot last sector's session-best delta using last frame's game_delta
    // (current frame's delta may already belong to the new lap).
    if let (Some(gd_prev), Some(entry)) =
        (locked.last_game_delta, locked.sector_game_delta_at_entry)
    {
        let idx = locked.last_sector_idx as usize;
        if idx < sector_count {
            locked.session_best_sector_deltas[idx] = Some(gd_prev - entry);
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

    // Reset lap-scoped session-best snapshots for new lap.
    locked.session_best_sector_deltas = vec![None; sector_count];
    locked.sector_game_delta_at_entry = game_live_delta;
    locked.is_sector_start_valid = true;
    locked.last_sector_idx = current_sector_idx;
    locked.sector_entry_time = 0.0;
    locked.last_lap = current_lap;

    if (current_sector_idx as usize) < sector_count {
        locked.sector_times[current_sector_idx as usize] = None;
    }

    locked.last_frame_pct = lap_dist_pct;
    locked.last_frame_time = current_lap_time;
    locked.last_game_delta = game_live_delta;
}

#[allow(clippy::too_many_arguments)]
fn init_state_on_first_lap(
    locked: &mut LapDeltaState,
    current_lap: i32,
    current_sector_idx: i32,
    current_lap_time: f64,
    game_live_delta: Option<f32>,
    lap_dist_pct: f64,
    on_pit_road: bool,
    is_on_track: bool,
) {
    locked.last_lap = current_lap;
    locked.last_sector_idx = current_sector_idx;
    locked.sector_entry_time = current_lap_time;
    locked.sector_game_delta_at_entry = game_live_delta;
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
    game_live_delta: Option<f32>,
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

    // Snapshot session-best sector delta at the boundary crossing.
    if let (Some(gd), Some(entry)) = (game_live_delta, locked.sector_game_delta_at_entry) {
        let idx = locked.last_sector_idx as usize;
        if idx < sector_count {
            locked.session_best_sector_deltas[idx] = Some(gd - entry);
        }
    }

    let was_emerging = locked.last_sector_idx == -1;
    locked.last_sector_idx = current_sector_idx;
    locked.sector_entry_time = interpolated_time;
    locked.sector_game_delta_at_entry = game_live_delta;

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
    game_delta: Option<f32>,
) -> LapDeltaFrame {
    let sector_count = state.sector_times.len();

    // --- Personal best ---
    let mut pb_sum_completed = 0.0f32;
    let personal_best_sectors: Vec<Option<f32>> = (0..sector_count)
        .map(|i| {
            let elapsed = state.sector_times[i]?;
            let best = (*state.personal_best_lap_sectors.get(i)?)?;
            let delta = if (i as i32) < current_sector_idx {
                // Completed sector: exact delta.
                let d = elapsed - best;
                pb_sum_completed += d;
                d
            } else if (i as i32) == current_sector_idx {
                // Active sector: linear interpolation so the value runs continuously.
                // elapsed - best × fraction → 0 at sector entry, exact at sector exit.
                elapsed - best * current_sector_fraction
            } else {
                return None;
            };
            Some(delta)
        })
        .collect();

    let pb_active_delta = personal_best_sectors
        .get(current_sector_idx.max(0) as usize)
        .and_then(|x| *x)
        .unwrap_or(0.0);

    let personal_best_total = pb_sum_completed + pb_active_delta;

    // --- Session best ---
    // Completed sectors use snapshotted deltas; active sector is derived live.
    let mut sb_sum_completed = 0.0f32;
    let mut session_best_sectors: Vec<Option<f32>> = (0..sector_count)
        .map(|i| {
            if (i as i32) < current_sector_idx {
                if let Some(d) = state.session_best_sector_deltas.get(i).and_then(|x| *x) {
                    sb_sum_completed += d;
                    Some(d)
                } else {
                    None
                }
            } else {
                None
            }
        })
        .collect();

    let session_best_total = game_delta.unwrap_or(personal_best_total);

    // Active sector for session best: total minus all completed sector contributions.
    if current_sector_idx >= 0 && (current_sector_idx as usize) < sector_count {
        if game_delta.is_some() {
            session_best_sectors[current_sector_idx as usize] =
                Some(session_best_total - sb_sum_completed);
        } else {
            // No game delta → mirror personal best for active sector.
            session_best_sectors[current_sector_idx as usize] = personal_best_sectors
                .get(current_sector_idx as usize)
                .and_then(|x| *x);
        }
    }

    // When game_delta is None, completed session best sectors also fall back
    // to personal best so the display is non-empty.
    if game_delta.is_none() {
        for (i, sector) in session_best_sectors
            .iter_mut()
            .enumerate()
            .take((current_sector_idx.max(0) as usize).min(sector_count))
        {
            if sector.is_none() {
                *sector = personal_best_sectors.get(i).and_then(|x| *x);
            }
        }
    }

    LapDeltaFrame {
        sector_times: state.sector_times.clone(),
        current_sector_idx,
        session_best_total,
        session_best_sectors,
        personal_best_total,
        personal_best_sectors,
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
            lap_current_lap_time: lap_time as f32,
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
        // Sector 1 of previous lap should be closed: 100.0 - 80.0 = 20.0
        assert_eq!(locked.sector_times[1], Some(20.0));
    }
}
