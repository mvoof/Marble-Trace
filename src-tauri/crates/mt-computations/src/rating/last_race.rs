//! The race the driver finished last, kept across restarts for `!lastrace`.
//!
//! Track, finish and incidents are final. The ratings are estimates at the
//! flag: the official numbers arrive with a later session.

use serde::{Deserialize, Serialize};

use crate::crew::engineer::is_multiclass;
use crate::field::driver_entries::DriverEntry;
use crate::rating::safety_rating::SafetyRatingFrame;
use mt_model::sim::enums::SessionState;
use mt_model::sim::session::{SessionSnapshot, SessionType};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LastRace {
    pub track: String,
    pub position: i32,
    /// `None` in a race of one class.
    pub class_finish: Option<ClassFinish>,
    pub incidents: i32,
    pub estimated_sr: Option<f32>,
    pub estimated_ir_delta: Option<i32>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClassFinish {
    pub class_name: String,
    pub position: i32,
}

/// What the tick knows about the end of the session.
pub struct FinishSource<'a> {
    pub session: &'a SessionSnapshot,
    pub session_num: Option<i32>,
    pub session_state: Option<SessionState>,
    pub safety_rating: &'a SafetyRatingFrame,
    pub player: Option<&'a DriverEntry>,
}

impl FinishSource<'_> {
    /// The record of a race under the flag, `None` for anything else. The sim
    /// refines the result until the cool-down ends, so this is asked again
    /// and the newest answer stands.
    pub fn last_race(&self) -> Option<LastRace> {
        let session = self.session;

        if !matches!(
            self.session_state,
            Some(SessionState::Checkered | SessionState::CoolDown)
        ) {
            return None;
        }

        let entry = self
            .session_num
            .and_then(|num| usize::try_from(num).ok())
            .and_then(|num| session.sessions.get(num))
            .filter(|entry| entry.session_type == SessionType::Race)?;
        let result = entry
            .results_positions
            .iter()
            .find(|result| result.car_idx == session.player_car_idx)?;
        let car = session
            .cars
            .iter()
            .find(|car| car.car_idx == session.player_car_idx)?;
        let class_finish = result
            .class_position
            .filter(|_| is_multiclass(session))
            .map(|position| ClassFinish {
                class_name: car.car_class_short_name.clone(),
                position,
            });
        let rated = self.safety_rating.is_ranked != Some(false);
        let estimated_ir_delta = self.player.and_then(|player| {
            player
                .estimated_ir_delta_official
                .or(player.estimated_ir_delta_live)
        });

        Some(LastRace {
            track: session.track_display_name.clone(),
            position: result.position,
            class_finish,
            incidents: self.safety_rating.driver_incidents,
            estimated_sr: self.safety_rating.sr_now.filter(|_| rated),
            estimated_ir_delta,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mt_model::sim::session::{CarEntry, ResultPosition, SessionEntry};

    fn session(session_type: SessionType, classes: &[i32]) -> SessionSnapshot {
        SessionSnapshot {
            track_display_name: "Spa".into(),
            player_car_idx: 3,
            sessions: vec![SessionEntry {
                session_type,
                results_positions: vec![ResultPosition {
                    car_idx: 3,
                    position: 12,
                    class_position: Some(4),
                    ..ResultPosition::default()
                }],
                ..SessionEntry::default()
            }],
            cars: classes
                .iter()
                .enumerate()
                .map(|(index, class)| CarEntry {
                    car_idx: 3 + index as i32,
                    car_class_id: *class,
                    car_class_short_name: "GT3".into(),
                    user_name: "Driver".into(),
                    i_rating: 2000,
                    ..CarEntry::default()
                })
                .collect(),
            ..SessionSnapshot::default()
        }
    }

    fn frame() -> SafetyRatingFrame {
        SafetyRatingFrame {
            driver_incidents: 2,
            sr_now: Some(2.81),
            ..SafetyRatingFrame::default()
        }
    }

    fn record(
        session: &SessionSnapshot,
        session_state: SessionState,
        safety_rating: &SafetyRatingFrame,
    ) -> Option<LastRace> {
        FinishSource {
            session,
            session_num: Some(0),
            session_state: Some(session_state),
            safety_rating,
            player: None,
        }
        .last_race()
    }

    #[test]
    fn a_race_under_the_flag_is_recorded() {
        let race = record(
            &session(SessionType::Race, &[1]),
            SessionState::CoolDown,
            &frame(),
        )
        .expect("recorded");

        assert_eq!(race.position, 12);
        assert_eq!(race.class_finish, None);
        assert_eq!(race.incidents, 2);
        assert_eq!(race.estimated_sr, Some(2.81));
    }

    #[test]
    fn a_multiclass_race_keeps_the_class_finish() {
        let race = record(
            &session(SessionType::Race, &[1, 2]),
            SessionState::Checkered,
            &frame(),
        )
        .expect("recorded");

        assert_eq!(
            race.class_finish,
            Some(ClassFinish {
                class_name: "GT3".into(),
                position: 4
            })
        );
    }

    #[test]
    fn practice_and_qualifying_are_not_races() {
        for session_type in [SessionType::Practice, SessionType::Qualify] {
            let snapshot = session(session_type, &[1]);

            assert_eq!(record(&snapshot, SessionState::CoolDown, &frame()), None);
        }
    }

    #[test]
    fn a_race_still_running_is_not_recorded() {
        let snapshot = session(SessionType::Race, &[1]);

        assert_eq!(record(&snapshot, SessionState::Racing, &frame()), None);
    }

    #[test]
    fn a_league_race_has_no_rating_estimate() {
        let unranked = SafetyRatingFrame {
            is_ranked: Some(false),
            ..frame()
        };
        let race = record(
            &session(SessionType::Race, &[1]),
            SessionState::CoolDown,
            &unranked,
        )
        .expect("recorded");

        assert_eq!(race.estimated_sr, None);
    }
}
