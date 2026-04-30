use serde::{Deserialize, Serialize};
use specta::Type;

use super::AllFieldsFrame;

/// Lightweight per-car position frame emitted at 30Hz for smooth map rendering.
#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct CarPositionsFrame {
    /// Lap distance percentage for each car (-1 = not on track)
    pub car_idx_lap_dist_pct: Vec<f32>,

    /// Track surface type for each car (-1=NotInWorld, 0=OffTrack, 1=InPitStall, 2=AproachingPits, 3=OnTrack)
    pub car_idx_track_surface: Vec<i32>,
}

impl From<&AllFieldsFrame> for CarPositionsFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            car_idx_lap_dist_pct: f.car_idx_lap_dist_pct.clone(),
            car_idx_track_surface: f.car_idx_track_surface.clone(),
        }
    }
}
