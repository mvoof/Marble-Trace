use mt_computations::strategy::pit_target::resolve_pit_target;
use mt_model::sim::player::PitTargetFrame;
use mt_source::SourceFrame;

/// The pit lane as the track records it.
pub(super) struct PitLane {
    pub(super) pit_in_pct: Option<f32>,
    pub(super) pit_exit_pct: Option<f32>,
    pub(super) pitbox_pct: Option<f32>,
    pub(super) track_length: f32,
}

/// Where the car is in the pit lane, and how far its box or the exit is.
///
/// The entry this stint actually used is taken on the first frame the sim
/// reports pit road and dropped on the way out (`live_pit_in_pct`). Anchoring
/// the lane on it keeps the rail from filling the moment the car turns in,
/// where the recorded entry point sits a few meters the other side of the car.
pub(super) fn locate_pit_target(
    frame: &SourceFrame,
    lane: PitLane,
    live_pit_in_pct: &mut Option<f32>,
) -> Option<PitTargetFrame> {
    let lap_dist_pct = frame.lap_timing.lap_dist_pct;
    let on_pit_road = frame.car_status.on_pit_road.unwrap_or(false);

    if !on_pit_road {
        *live_pit_in_pct = None;
    } else if live_pit_in_pct.is_none() {
        *live_pit_in_pct = lap_dist_pct.filter(|dist| *dist >= 0.0);
    }

    let (Some(lap_dist), Some(pit_in), Some(pit_exit)) =
        (lap_dist_pct, lane.pit_in_pct, lane.pit_exit_pct)
    else {
        return None;
    };

    resolve_pit_target(
        lap_dist,
        pit_in,
        pit_exit,
        *live_pit_in_pct,
        lane.pitbox_pct,
        lane.track_length,
    )
    .map(|pit_target| PitTargetFrame {
        dist_m: pit_target.dist_m,
        target: pit_target.target,
        lane_progress_pct: pit_target.lane_progress,
    })
}
