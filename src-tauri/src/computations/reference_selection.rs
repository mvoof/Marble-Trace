//! Which stored reference lap is the active one — the lap the coach compares
//! against, and the one every window draws its reference trace from.
//!
//! Each window used to pick it for itself, from the session and the wetness,
//! and load it from disk. The telemetry thread needs it now (the coach runs
//! here), so it picks it once and the windows are told.
//!
//! The session's two stored laps (dry and wet) come from the I/O worker with
//! every session update. That is a re-read of the same files most of the time,
//! so a lap is judged by what it is — track, car, condition and time — not by
//! which read it came from: swapping in an identical copy would reset the
//! coach's latched call for nothing.

use std::sync::Arc;

use crate::model::reference_lap::{ReferenceLapData, StoredReferenceTimes, TrackCondition};

/// The stored reference laps of one track and car, one per condition.
#[derive(Debug, Clone, Default)]
pub struct StoredReferences {
    pub dry: Option<Arc<ReferenceLapData>>,
    pub wet: Option<Arc<ReferenceLapData>>,
}

impl StoredReferences {
    fn get(&self, condition: TrackCondition) -> Option<&Arc<ReferenceLapData>> {
        match condition {
            TrackCondition::Dry => self.dry.as_ref(),
            TrackCondition::Wet => self.wet.as_ref(),
        }
    }

    fn slot(&mut self, condition: TrackCondition) -> &mut Option<Arc<ReferenceLapData>> {
        match condition {
            TrackCondition::Dry => &mut self.dry,
            TrackCondition::Wet => &mut self.wet,
        }
    }

    /// The lap times the recorder has to beat.
    pub fn times(&self) -> StoredReferenceTimes {
        let time_of = |lap: Option<&Arc<ReferenceLapData>>| lap.map(|lap| lap.lap_time);

        StoredReferenceTimes {
            dry: time_of(self.dry.as_ref()),
            wet: time_of(self.wet.as_ref()),
        }
    }
}

/// Two copies of the same stored lap — a re-read, not a new reference.
fn same_lap(left: &ReferenceLapData, right: &ReferenceLapData) -> bool {
    left.track_id == right.track_id
        && left.car_screen_name == right.car_screen_name
        && left.condition == right.condition
        && left.lap_time == right.lap_time
}

/// The faster of two candidates for one slot, keeping the copy already held
/// when they are the same lap. Faster wins because a read the worker started
/// before a new best was saved arrives after it, carrying the old file.
fn faster(
    held: Option<Arc<ReferenceLapData>>,
    read: Option<Arc<ReferenceLapData>>,
) -> Option<Arc<ReferenceLapData>> {
    match (held, read) {
        (Some(held), Some(read)) if same_lap(&held, &read) || held.lap_time <= read.lap_time => {
            Some(held)
        }
        (held, read) => read.or(held),
    }
}

/// The active reference changed to this — `None` inside means it went away.
pub type ReferenceChange = Option<Option<Arc<ReferenceLapData>>>;

#[derive(Debug, Default)]
pub struct ReferenceSelection {
    /// Track id and the player's car — whose laps `stored` holds.
    identity: Option<(i32, String)>,
    stored: StoredReferences,
    condition: Option<TrackCondition>,
    active: Option<Arc<ReferenceLapData>>,
}

impl ReferenceSelection {
    #[cfg(test)]
    pub fn active(&self) -> Option<&Arc<ReferenceLapData>> {
        self.active.as_ref()
    }

    pub fn stored_times(&self) -> StoredReferenceTimes {
        self.stored.times()
    }

    /// A session update arrived with what the disk holds for its track and car.
    pub fn load(
        &mut self,
        track_id: i32,
        car_screen_name: &str,
        read: StoredReferences,
        track_wetness: Option<i32>,
    ) -> ReferenceChange {
        let same_identity = self
            .identity
            .as_ref()
            .is_some_and(|(id, car)| *id == track_id && car == car_screen_name);

        if same_identity {
            let held = std::mem::take(&mut self.stored);

            self.stored = StoredReferences {
                dry: faster(held.dry, read.dry),
                wet: faster(held.wet, read.wet),
            };
        } else {
            // Another car or track is another set of laps, classified afresh.
            self.identity = Some((track_id, car_screen_name.to_owned()));
            self.stored = read;
            self.condition = None;
        }

        self.observe_wetness(track_wetness)
    }

    /// Follows the track as it gets wetter or dries.
    pub fn observe_wetness(&mut self, track_wetness: Option<i32>) -> ReferenceChange {
        self.identity.as_ref()?;

        self.condition = Some(TrackCondition::next(self.condition, track_wetness));
        self.reselect()
    }

    /// A lap was just recorded as the new best for its condition.
    pub fn record(&mut self, lap: ReferenceLapData) -> ReferenceChange {
        let belongs = self
            .identity
            .as_ref()
            .is_some_and(|(id, car)| *id == lap.track_id && *car == lap.car_screen_name);

        if !belongs {
            return None;
        }

        let condition = lap.condition;

        *self.stored.slot(condition) = Some(Arc::new(lap));
        self.reselect()
    }

    /// The driver deleted the stored laps of this track and car.
    pub fn clear(&mut self) -> ReferenceChange {
        self.stored = StoredReferences::default();
        self.reselect()
    }

    fn reselect(&mut self) -> ReferenceChange {
        let next = self
            .condition
            .and_then(|condition| self.stored.get(condition))
            .cloned();
        let unchanged = match (&self.active, &next) {
            (Some(active), Some(next)) => Arc::ptr_eq(active, next),
            (None, None) => true,
            _ => false,
        };

        if unchanged {
            return None;
        }

        self.active = next.clone();

        Some(next)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TRACK: i32 = 244;
    const CAR: &str = "Ferrari 296 GT3";
    const DRY: Option<i32> = Some(1);
    const WET: Option<i32> = Some(4);

    fn lap(condition: TrackCondition, lap_time: f32) -> ReferenceLapData {
        ReferenceLapData {
            track_id: TRACK,
            car_screen_name: CAR.into(),
            lap_time,
            samples: Vec::new(),
            condition,
            recorded_wetness: None,
            recorded_tire_wear: None,
            recorded_fuel_level: None,
        }
    }

    fn stored(dry: Option<f32>, wet: Option<f32>) -> StoredReferences {
        StoredReferences {
            dry: dry.map(|time| Arc::new(lap(TrackCondition::Dry, time))),
            wet: wet.map(|time| Arc::new(lap(TrackCondition::Wet, time))),
        }
    }

    fn active_time(selection: &ReferenceSelection) -> Option<f32> {
        selection.active().map(|lap| lap.lap_time)
    }

    #[test]
    fn classifies_wetness_with_hysteresis() {
        use TrackCondition::{Dry, Wet};

        assert_eq!(TrackCondition::next(None, None), Dry);
        assert_eq!(TrackCondition::next(None, Some(3)), Wet);
        assert_eq!(TrackCondition::next(None, Some(2)), Dry);
        assert_eq!(TrackCondition::next(Some(Dry), Some(3)), Wet);
        assert_eq!(TrackCondition::next(Some(Wet), Some(2)), Wet);
        assert_eq!(TrackCondition::next(Some(Wet), Some(3)), Wet);
        assert_eq!(TrackCondition::next(Some(Wet), Some(1)), Dry);
        assert_eq!(TrackCondition::next(Some(Wet), Some(0)), Dry);
    }

    #[test]
    fn picks_the_lap_of_the_current_condition() {
        let mut selection = ReferenceSelection::default();

        selection.load(TRACK, CAR, stored(Some(90.0), Some(100.0)), DRY);
        assert_eq!(active_time(&selection), Some(90.0));

        assert!(selection.observe_wetness(WET).is_some());
        assert_eq!(active_time(&selection), Some(100.0));
    }

    #[test]
    fn a_re_read_of_the_same_files_is_not_a_change() {
        let mut selection = ReferenceSelection::default();

        selection.load(TRACK, CAR, stored(Some(90.0), None), DRY);

        assert!(selection
            .load(TRACK, CAR, stored(Some(90.0), None), DRY)
            .is_none());
    }

    #[test]
    fn a_read_from_before_a_new_best_does_not_bring_the_old_lap_back() {
        let mut selection = ReferenceSelection::default();

        selection.load(TRACK, CAR, stored(Some(90.0), None), DRY);
        selection.record(lap(TrackCondition::Dry, 88.0));
        selection.load(TRACK, CAR, stored(Some(90.0), None), DRY);

        assert_eq!(active_time(&selection), Some(88.0));
    }

    #[test]
    fn a_recorded_lap_becomes_active_only_in_its_own_condition() {
        let mut selection = ReferenceSelection::default();

        selection.load(TRACK, CAR, stored(Some(90.0), None), DRY);

        assert!(selection.record(lap(TrackCondition::Wet, 99.0)).is_none());
        assert_eq!(active_time(&selection), Some(90.0));
    }

    #[test]
    fn another_car_is_another_set_of_laps() {
        let mut selection = ReferenceSelection::default();

        selection.load(TRACK, CAR, stored(Some(90.0), None), DRY);

        assert!(matches!(
            selection.load(TRACK, "Porsche 911 GT3 R", stored(None, None), DRY),
            Some(None)
        ));
        assert!(selection.record(lap(TrackCondition::Dry, 80.0)).is_none());
    }

    #[test]
    fn clearing_takes_the_active_lap_away() {
        let mut selection = ReferenceSelection::default();

        selection.load(TRACK, CAR, stored(Some(90.0), Some(100.0)), DRY);

        assert!(matches!(selection.clear(), Some(None)));
        assert_eq!(selection.stored_times().dry, None);
    }
}
