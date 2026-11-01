//! A question of the driver's own answered on the telemetry thread: the car
//! it asks about found, and the fields its answers name read for that car and
//! for the session, on the tick that answers.
//!
//! A value the sim does not have now is left out of the reply rather than
//! filled with a zero; the voice side says the question's "no value" answer
//! for it. The computed fields — places gained, laps down, gaps — are worked
//! out here, never published in the bundle.

use std::collections::{BTreeMap, BTreeSet};

use mt_model::app::crew::{CrewArg, CrewReply};
use mt_model::app::crew_questions::{
    question_field_spec, question_no_car_key, question_reply_key, AskedCar, CarField,
    QuestionField, SessionField, CLASS_POSITION_FIELD, NUMBER_FIELD, POSITION_FIELD,
};
use mt_model::sim::enums::TrackSurface;
use mt_model::sim::session::{CarEntry, SessionSnapshot};

use crate::field::driver_entries::DriverEntry;

/// The sim's "unlimited laps" marker in a timed session.
const UNLIMITED_LAPS: i32 = 32_767;
/// The sim's time remaining in a session with no time limit: a week.
const UNLIMITED_SECONDS: f64 = 604_800.0;
const PERCENT: f64 = 100.0;
const LEADING_ZERO: char = '0';

/// How many times each car turned onto pit road this session, counted from
/// the driver table as it arrives.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct PitEntries {
    session_num: Option<i32>,
    counts: BTreeMap<i32, u32>,
    on_pit_road: BTreeSet<i32>,
}

impl PitEntries {
    pub fn update(&mut self, session_num: Option<i32>, entries: &[DriverEntry]) {
        if session_num != self.session_num {
            *self = Self {
                session_num,
                ..Self::default()
            };
        }

        for entry in entries {
            let was_on_pit_road = self.on_pit_road.contains(&entry.car_idx);

            if entry.on_pit_road && !was_on_pit_road {
                *self.counts.entry(entry.car_idx).or_default() += 1;
                self.on_pit_road.insert(entry.car_idx);
            } else if !entry.on_pit_road && was_on_pit_road {
                self.on_pit_road.remove(&entry.car_idx);
            }
        }
    }

    pub fn count(&self, car_idx: i32) -> u32 {
        self.counts.get(&car_idx).copied().unwrap_or(0)
    }
}

/// What a question's fields are read from: the driver table at 10 Hz, fuel at
/// 4 Hz — kept between their ticks — and what the frame gives every tick.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct QuestionView {
    pub entries: Vec<DriverEntry>,
    pub pit_entries: PitEntries,
    pub fuel_level: Option<f32>,
    pub fuel_laps_remaining: Option<f32>,
    pub fuel_to_add: Option<f32>,
    pub fuel_save_per_lap: Option<f32>,
    pub pit_window_start: Option<i32>,
    pub pit_window_end: Option<i32>,
    pub air_temp: Option<f32>,
    pub track_temp: Option<f32>,
    /// 0–1.
    pub precipitation: Option<f32>,
    /// As the sim reports it, markers and all.
    pub laps_remain_ex: Option<i32>,
    pub time_remain: Option<f64>,
    pub lap: Option<i32>,
    pub incidents: Option<i32>,
}

/// A car as a field reads it: its line in the driver table and in the
/// session's driver list.
#[derive(Clone, Copy)]
struct Car<'a> {
    entry: &'a DriverEntry,
    session: &'a CarEntry,
}

/// Everything a question is answered from on the tick that answers it.
pub struct QuestionSource<'a> {
    pub view: &'a QuestionView,
    pub session: Option<&'a SessionSnapshot>,
}

impl<'a> QuestionSource<'a> {
    /// The replies to a question: one per car it names, each with the
    /// fields that car and the session have now; the "no such car" reply
    /// when it names a car the session does not hold.
    pub fn answer(
        &self,
        id: &str,
        asked: Option<&AskedCar>,
        fields: &[QuestionField],
    ) -> Vec<CrewReply> {
        let with_session = |reply: CrewReply| {
            fields.iter().fold(reply, |reply, field| match field {
                QuestionField::Session(session_field) => {
                    with_value(reply, *field, self.session_value(*session_field))
                }
                QuestionField::Car(_) => reply,
            })
        };
        let Some(asked) = asked else {
            return vec![with_session(CrewReply::plain(&question_reply_key(id)))];
        };
        let cars = self.asked_cars(asked);

        if cars.is_empty() {
            let reply = with_session(CrewReply::plain(&question_no_car_key(id)));

            return vec![with_heard(reply, asked)];
        }

        cars.into_iter()
            .map(|car| {
                let reply = fields.iter().fold(
                    CrewReply::plain(&question_reply_key(id)),
                    |reply, field| match field {
                        QuestionField::Car(car_field) => {
                            with_value(reply, *field, self.car_value(*car_field, car))
                        }
                        QuestionField::Session(_) => reply,
                    },
                );

                with_session(reply)
            })
            .collect()
    }

    /// Every car the question names: many only for a number two cars carry
    /// ("9" and "09" said as "nine"), by place.
    fn asked_cars(&self, asked: &AskedCar) -> Vec<Car<'a>> {
        let in_my_class = |position: i32| {
            let me = self.me()?;

            self.cars().find(|car| {
                car.entry.car_class_id == me.entry.car_class_id
                    && car.entry.live_class_position == position
            })
        };
        let my_position = || {
            self.me()
                .map(|me| me.entry.live_class_position)
                .filter(|position| *position > 0)
        };
        let one = |car: Option<Car<'a>>| car.into_iter().collect::<Vec<_>>();

        match asked {
            AskedCar::Me => one(self.me()),
            AskedCar::Leader => one(self.cars().find(|car| car.entry.live_position == 1)),
            AskedCar::ClassLeader => one(in_my_class(1)),
            AskedCar::Ahead => one(my_position()
                .filter(|position| *position > 1)
                .and_then(|position| in_my_class(position - 1))),
            AskedCar::Behind => one(my_position().and_then(|position| in_my_class(position + 1))),
            AskedCar::AheadOnTrack => one(self.on_track_nearest(|gap| gap > 0.0)),
            AskedCar::BehindOnTrack => one(self.on_track_nearest(|gap| gap < 0.0)),
            AskedCar::ByPosition { position } => one(self
                .cars()
                .find(|car| *position > 0 && car.entry.live_position == *position)),
            AskedCar::ByClassPosition { position } => {
                one(in_my_class(*position).filter(|_| *position > 0))
            }
            AskedCar::ByCarNumber { number } => {
                let mut cars: Vec<Car<'a>> = self
                    .cars()
                    .filter(|car| number_matches(number, &car.session.car_number))
                    .collect();

                cars.sort_by_key(|car| match car.entry.live_position {
                    place if place > 0 => place,
                    _ => i32::MAX,
                });

                cars
            }
        }
    }

    /// Every car a question can be about: no pace car, no spectator, no car
    /// without a driver.
    fn cars(&self) -> impl Iterator<Item = Car<'a>> + 'a {
        let cars = self
            .session
            .map_or(&[][..], |session| session.cars.as_slice());

        let view: &'a QuestionView = self.view;

        view.entries.iter().filter_map(move |entry| {
            let session = cars.iter().find(|car| car.car_idx == entry.car_idx)?;
            let drivable =
                !session.is_pace_car && !session.is_spectator && !session.user_name.is_empty();

            drivable.then_some(Car { entry, session })
        })
    }

    fn me(&self) -> Option<Car<'a>> {
        let player = self.session?.player_car_idx;

        self.cars().find(|car| car.entry.car_idx == player)
    }

    /// The car on that side of the player along the lap, the nearest first;
    /// a car in the pits or not in the world is not racing there.
    fn on_track_nearest(&self, side: impl Fn(f32) -> bool) -> Option<Car<'a>> {
        let me = self.me()?;

        self.cars()
            .filter(|car| {
                car.entry.car_idx != me.entry.car_idx
                    && !car.entry.on_pit_road
                    && car.entry.track_surface != TrackSurface::NotInWorld
                    && side(car.entry.relative_lap_dist)
            })
            .min_by(|left, right| {
                left.entry
                    .relative_lap_dist
                    .abs()
                    .total_cmp(&right.entry.relative_lap_dist.abs())
            })
    }

    /// The leader of the car's own class.
    fn class_leader_of(&self, car: Car<'_>) -> Option<Car<'a>> {
        self.cars().find(|other| {
            other.entry.car_class_id == car.entry.car_class_id
                && other.entry.live_class_position == 1
        })
    }

    fn car_value(&self, field: CarField, car: Car<'_>) -> Option<CrewArg> {
        let entry = car.entry;
        let place = |place: i32| (place > 0).then(|| whole(place));
        let lap_time = |time: Option<f32>| time.filter(|time| *time > 0.0).map(measured);

        match field {
            CarField::Name => text(&car.session.user_name),
            CarField::Number => text(&car.session.car_number),
            CarField::CarName => text(&car.session.car_screen_name_short),
            CarField::ClassName => text(&car.session.car_class_short_name),
            CarField::Position => place(entry.live_position),
            CarField::ClassPosition => place(entry.live_class_position),
            CarField::StartPosition => place(entry.start_pos_class?),
            CarField::PositionsGained => {
                let start = entry.start_pos_class.filter(|start| *start > 0)?;
                let now = Some(entry.live_class_position).filter(|now| *now > 0)?;

                Some(whole(start - now))
            }
            CarField::LapsDown => {
                let leader = self.class_leader_of(car)?.entry;

                (leader.lap >= 0 && entry.lap >= 0).then(|| whole((leader.lap - entry.lap).max(0)))
            }
            CarField::LastLap => lap_time(entry.last_lap_time),
            CarField::BestLap => lap_time(entry.best_lap_time),
            CarField::QualifyTime => lap_time(entry.qualify_time),
            CarField::GapToMe => self.gap_to_me(entry).map(measured),
            CarField::GapToLeader => {
                let leader = self.class_leader_of(car)?.entry;

                (leader.f2_time >= 0.0 && entry.f2_time >= 0.0)
                    .then(|| measured((entry.f2_time - leader.f2_time).max(0.0)))
            }
            CarField::LapDeltaToMe => {
                let mine = self.me()?.entry.last_lap_time.filter(|lap| *lap > 0.0)?;
                let theirs = entry.last_lap_time.filter(|lap| *lap > 0.0)?;

                Some(measured(theirs - mine))
            }
            CarField::InPit => Some(CrewArg::Flag {
                value: entry.on_pit_road,
            }),
            CarField::PitStops => Some(CrewArg::Number {
                value: f64::from(self.view.pit_entries.count(entry.car_idx)),
            }),
            CarField::TireCompound => text(&entry.tire_compound),
            CarField::Speed => entry.speed.map(measured),
            CarField::IRating => place(car.session.i_rating),
            CarField::License => text(&car.session.lic_string),
            CarField::IrDelta => entry.estimated_ir_delta_live.map(whole),
            CarField::IsRetired => Some(CrewArg::Flag {
                value: entry.is_retired,
            }),
        }
    }

    /// Seconds along the lap from the player forward to a car placed ahead,
    /// or back to one placed behind, across the line.
    fn gap_to_me(&self, entry: &DriverEntry) -> Option<f32> {
        let me = self.me()?.entry;

        if me.car_idx == entry.car_idx {
            return Some(0.0);
        }

        let ahead = entry.live_position > 0 && entry.live_position < me.live_position;

        if ahead {
            track_gap(me.est_time, entry.est_time, me.class_est_lap_time)
        } else {
            track_gap(entry.est_time, me.est_time, me.class_est_lap_time)
        }
    }

    fn session_value(&self, field: SessionField) -> Option<CrewArg> {
        let view = self.view;
        let number = |value: Option<f32>| value.map(measured);
        let lap = |lap: Option<i32>| lap.filter(|lap| *lap >= 0).map(whole);

        match field {
            SessionField::Fuel => number(view.fuel_level),
            SessionField::FuelLaps => number(view.fuel_laps_remaining.map(|laps| laps.max(0.0))),
            SessionField::FuelToFinish => number(view.fuel_to_add),
            SessionField::FuelSavePerLap => number(view.fuel_save_per_lap),
            SessionField::PitWindowOpen => lap(view.pit_window_start),
            SessionField::PitWindowClose => lap(view.pit_window_end),
            SessionField::AirTemp => number(view.air_temp),
            SessionField::TrackTemp => number(view.track_temp),
            SessionField::Rain => view.precipitation.map(|share| CrewArg::Number {
                value: f64::from(share) * PERCENT,
            }),
            SessionField::TrackName => text(&self.session?.track_display_name),
            SessionField::LapsLeft => {
                lap(view.laps_remain_ex.filter(|laps| *laps < UNLIMITED_LAPS))
            }
            SessionField::MinutesLeft => view
                .time_remain
                .filter(|seconds| (0.0..UNLIMITED_SECONDS).contains(seconds))
                .map(|value| CrewArg::Number { value }),
            SessionField::Lap => lap(view.lap),
            SessionField::Incidents => view.incidents.filter(|count| *count >= 0).map(whole),
        }
    }
}

/// Whether a car's number is the one heard: said with its leading zero it
/// must match exactly ("zero nine" is `09` alone); said without, any number
/// that reads as it does ("nine" is `9` and `09`).
pub fn number_matches(heard: &str, car_number: &str) -> bool {
    let car_number = car_number.trim();

    if heard.is_empty() || car_number.is_empty() {
        return false;
    }

    if heard.starts_with(LEADING_ZERO) {
        return car_number == heard;
    }

    let significant = car_number.trim_start_matches(LEADING_ZERO);

    significant == heard
}

/// The value under its field's name, or the reply without it.
fn with_value(reply: CrewReply, field: QuestionField, value: Option<CrewArg>) -> CrewReply {
    match (question_field_spec(field), value) {
        (Some(spec), Some(value)) => reply.arg(spec.name, value),
        _ => reply,
    }
}

/// The "no such car" reply may name what was heard: the number or the place.
fn with_heard(reply: CrewReply, asked: &AskedCar) -> CrewReply {
    match asked {
        AskedCar::ByCarNumber { number } => reply.arg(
            NUMBER_FIELD,
            CrewArg::Text {
                value: number.clone(),
            },
        ),
        AskedCar::ByPosition { position } => reply.arg(POSITION_FIELD, whole(*position)),
        AskedCar::ByClassPosition { position } => reply.arg(CLASS_POSITION_FIELD, whole(*position)),
        AskedCar::Me
        | AskedCar::Ahead
        | AskedCar::Behind
        | AskedCar::Leader
        | AskedCar::ClassLeader
        | AskedCar::AheadOnTrack
        | AskedCar::BehindOnTrack => reply,
    }
}

fn whole(value: i32) -> CrewArg {
    CrewArg::Number {
        value: f64::from(value),
    }
}

/// A measured value as the sim gives it — seconds, liters, m/s; the voice
/// side rounds it the way its field is said.
fn measured(value: f32) -> CrewArg {
    CrewArg::Number {
        value: f64::from(value),
    }
}

fn text(value: &str) -> Option<CrewArg> {
    let value = value.trim();

    (!value.is_empty()).then(|| CrewArg::Text {
        value: value.to_string(),
    })
}

/// Seconds from `from` to `to` along the lap, wrapping the line.
fn track_gap(from: f32, to: f32, lap_time: f32) -> Option<f32> {
    if lap_time <= 0.0 {
        return None;
    }

    Some((to - from).rem_euclid(lap_time))
}

#[cfg(test)]
mod tests {
    use super::*;

    const PLAYER: i32 = 0;
    const GT3: i32 = 1;
    const GT4: i32 = 2;

    fn entry(car_idx: i32, class: i32, position: i32, class_position: i32) -> DriverEntry {
        DriverEntry {
            car_idx,
            car_class_id: class,
            tire_compound: String::new(),
            position,
            class_position,
            live_position: position,
            live_class_position: class_position,
            start_pos_overall: None,
            start_pos_class: None,
            lap: 5,
            lap_dist_pct: 0.0,
            last_lap_time: None,
            best_lap_time: None,
            qualify_time: None,
            f2_time: 0.0,
            est_time: 0.0,
            track_surface: TrackSurface::OnTrack,
            i_rating: 0,
            is_player: car_idx == PLAYER,
            on_pit_road: false,
            estimated_ir_delta_live: None,
            estimated_ir_delta_official: None,
            relative_lap_dist: 0.0,
            class_est_lap_time: 90.0,
            raw_flags: 0,
            results_position_lap: None,
            results_position_time: None,
            is_retired: false,
            is_finished: false,
            is_towed: false,
            pit_state: Default::default(),
            speed: None,
        }
    }

    fn session_car(car_idx: i32, class: i32, number: &str) -> CarEntry {
        CarEntry {
            car_idx,
            user_name: format!("Driver {car_idx}"),
            car_number: number.into(),
            car_class_id: class,
            ..CarEntry::default()
        }
    }

    /// The player third in GT3 behind cars 7 (P1) and 12 (P2), car 33 fourth;
    /// a GT4 car numbered 09 leads its class from P5.
    fn race() -> (QuestionView, SessionSnapshot) {
        let mut entries = vec![
            entry(PLAYER, GT3, 3, 3),
            entry(1, GT3, 1, 1),
            entry(2, GT3, 2, 2),
            entry(3, GT3, 4, 4),
            entry(4, GT4, 5, 1),
        ];
        let numbers = ["5", "7", "12", "33", "09"];
        let classes = [GT3, GT3, GT3, GT3, GT4];

        entries[0].last_lap_time = Some(92.0);
        entries[2].last_lap_time = Some(91.7);
        entries[0].start_pos_class = Some(5);
        entries[0].lap = 4;
        entries[1].lap = 5;
        entries[0].f2_time = 12.5;
        entries[1].f2_time = 0.0;

        let session = SessionSnapshot {
            player_car_idx: PLAYER,
            track_display_name: "Spa".into(),
            cars: (0..5)
                .map(|index| session_car(index, classes[index as usize], numbers[index as usize]))
                .collect(),
            ..SessionSnapshot::default()
        };

        (
            QuestionView {
                entries,
                fuel_laps_remaining: Some(6.4),
                laps_remain_ex: Some(UNLIMITED_LAPS),
                ..QuestionView::default()
            },
            session,
        )
    }

    fn arg<'a>(reply: &'a CrewReply, name: &str) -> Option<&'a CrewArg> {
        reply
            .args
            .iter()
            .find(|(arg, _)| arg == name)
            .map(|(_, value)| value)
    }

    fn number(reply: &CrewReply, name: &str) -> Option<f64> {
        match arg(reply, name)? {
            CrewArg::Number { value } => Some(*value),
            other => panic!("{name}: a number, not {other:?}"),
        }
    }

    fn car(field: CarField) -> QuestionField {
        QuestionField::Car(field)
    }

    #[test]
    fn answers_about_the_car_by_role_with_the_session_beside_it() {
        let (view, session) = race();
        let source = QuestionSource {
            view: &view,
            session: Some(&session),
        };
        let fields = [
            car(CarField::Number),
            car(CarField::ClassPosition),
            QuestionField::Session(SessionField::FuelLaps),
            QuestionField::Session(SessionField::LapsLeft),
        ];
        let replies = source.answer("ahead", Some(&AskedCar::Ahead), &fields);

        assert_eq!(replies.len(), 1);
        assert_eq!(replies[0].key, "question.ahead");
        assert_eq!(
            arg(&replies[0], "number"),
            Some(&CrewArg::Text { value: "12".into() })
        );
        assert_eq!(number(&replies[0], "classPosition"), Some(2.0));
        assert_eq!(number(&replies[0], "fuelLaps"), Some(f64::from(6.4_f32)));
        // A timed race has no laps left to say.
        assert_eq!(arg(&replies[0], "lapsLeft"), None);
    }

    #[test]
    fn a_question_without_a_car_reads_the_session_alone() {
        let (view, session) = race();
        let source = QuestionSource {
            view: &view,
            session: Some(&session),
        };
        let replies = source.answer(
            "track",
            None,
            &[QuestionField::Session(SessionField::TrackName)],
        );

        assert_eq!(
            arg(&replies[0], "trackName"),
            Some(&CrewArg::Text {
                value: "Spa".into()
            })
        );
    }

    #[test]
    fn incidents_are_the_players_own_live_count() {
        let (mut view, session) = race();
        let fields = [QuestionField::Session(SessionField::Incidents)];

        view.incidents = Some(4);

        let counted = QuestionSource {
            view: &view,
            session: Some(&session),
        }
        .answer("incidents", None, &fields);

        view.incidents = None;

        let not_sent = QuestionSource {
            view: &view,
            session: Some(&session),
        }
        .answer("incidents", None, &fields);

        assert_eq!(
            arg(&counted[0], "incidents"),
            Some(&CrewArg::Number { value: 4.0 })
        );
        assert_eq!(arg(&not_sent[0], "incidents"), None);
    }

    #[test]
    fn says_there_is_no_such_car_with_what_was_heard() {
        let (view, session) = race();
        let source = QuestionSource {
            view: &view,
            session: Some(&session),
        };
        let fields = [
            car(CarField::LastLap),
            QuestionField::Session(SessionField::TrackName),
        ];
        let missing = source.answer(
            "car",
            Some(&AskedCar::ByCarNumber {
                number: "99".into(),
            }),
            &fields,
        );
        let leader_has_nobody_ahead = QuestionSource {
            view: &QuestionView {
                entries: vec![entry(PLAYER, GT3, 1, 1)],
                ..QuestionView::default()
            },
            session: Some(&session),
        }
        .answer("ahead", Some(&AskedCar::Ahead), &fields);
        let spectator = QuestionSource {
            view: &view,
            session: None,
        }
        .answer("me", Some(&AskedCar::Me), &fields);

        assert_eq!(missing[0].key, "question.car.noCar");
        assert_eq!(
            arg(&missing[0], "number"),
            Some(&CrewArg::Text { value: "99".into() })
        );
        assert!(arg(&missing[0], "trackName").is_some());
        assert_eq!(leader_has_nobody_ahead[0].key, "question.ahead.noCar");
        assert_eq!(spectator[0].key, "question.me.noCar");
    }

    #[test]
    fn a_number_said_with_its_zero_is_that_car_and_without_it_every_car_it_reads_as() {
        assert!(number_matches("09", "09"));
        assert!(!number_matches("09", "9"));
        assert!(number_matches("9", "9"));
        assert!(number_matches("9", "09"));
        assert!(number_matches("0", "0"));
        assert!(!number_matches("0", "00"));
        assert!(!number_matches("1", "12"));
        assert!(!number_matches("", "0"));

        let (mut view, mut session) = race();

        view.entries.push(entry(5, GT4, 6, 2));
        session.cars.push(session_car(5, GT4, "9"));

        let source = QuestionSource {
            view: &view,
            session: Some(&session),
        };
        let fields = [car(CarField::Number)];
        let numbers = |heard: &str| -> Vec<Option<CrewArg>> {
            source
                .answer(
                    "car",
                    Some(&AskedCar::ByCarNumber {
                        number: heard.into(),
                    }),
                    &fields,
                )
                .iter()
                .map(|reply| arg(reply, "number").cloned())
                .collect()
        };
        let said = |number: &str| {
            Some(CrewArg::Text {
                value: number.into(),
            })
        };

        assert_eq!(numbers("9"), vec![said("09"), said("9")]);
        assert_eq!(numbers("09"), vec![said("09")]);
    }

    #[test]
    fn finds_a_car_by_place_overall_and_in_the_class() {
        let (view, session) = race();
        let source = QuestionSource {
            view: &view,
            session: Some(&session),
        };
        let fields = [car(CarField::Number)];
        let number_of = |asked: AskedCar| {
            source
                .answer("car", Some(&asked), &fields)
                .first()
                .and_then(|reply| arg(reply, "number").cloned())
        };

        assert_eq!(
            number_of(AskedCar::ByPosition { position: 5 }),
            Some(CrewArg::Text { value: "09".into() })
        );
        assert_eq!(
            number_of(AskedCar::ByClassPosition { position: 4 }),
            Some(CrewArg::Text { value: "33".into() })
        );
        assert_eq!(number_of(AskedCar::ByClassPosition { position: 0 }), None);
        assert_eq!(
            number_of(AskedCar::ClassLeader),
            Some(CrewArg::Text { value: "7".into() })
        );
    }

    #[test]
    fn works_out_the_computed_fields_at_answer_time() {
        let (view, session) = race();
        let source = QuestionSource {
            view: &view,
            session: Some(&session),
        };
        let me = source.answer(
            "me",
            Some(&AskedCar::Me),
            &[
                car(CarField::PositionsGained),
                car(CarField::LapsDown),
                car(CarField::GapToLeader),
            ],
        );
        let ahead = source.answer(
            "ahead",
            Some(&AskedCar::Ahead),
            &[car(CarField::LapDeltaToMe), car(CarField::LastLap)],
        );

        assert_eq!(number(&me[0], "positionsGained"), Some(2.0));
        assert_eq!(number(&me[0], "lapsDown"), Some(1.0));
        assert_eq!(number(&me[0], "gapToLeader"), Some(12.5));
        assert!(number(&ahead[0], "lapDeltaToMe").is_some_and(|delta| (delta + 0.3).abs() < 1e-4));
        assert!(number(&ahead[0], "lastLap").is_some());
    }

    #[test]
    fn leaves_out_a_value_the_sim_does_not_have() {
        let (view, session) = race();
        let source = QuestionSource {
            view: &view,
            session: Some(&session),
        };
        let replies = source.answer(
            "behind",
            Some(&AskedCar::Behind),
            &[
                car(CarField::LastLap),
                car(CarField::LapDeltaToMe),
                QuestionField::Session(SessionField::Fuel),
            ],
        );

        assert_eq!(replies[0].key, "question.behind");
        assert!(replies[0].args.is_empty());
    }

    #[test]
    fn counts_each_turn_onto_pit_road_once_per_session() {
        let mut pits = PitEntries::default();
        let mut car = entry(3, GT3, 4, 4);

        pits.update(Some(2), std::slice::from_ref(&car));
        car.on_pit_road = true;
        pits.update(Some(2), std::slice::from_ref(&car));
        pits.update(Some(2), std::slice::from_ref(&car));
        car.on_pit_road = false;
        pits.update(Some(2), std::slice::from_ref(&car));
        car.on_pit_road = true;
        pits.update(Some(2), std::slice::from_ref(&car));

        assert_eq!(pits.count(3), 2);

        pits.update(Some(3), &[]);

        assert_eq!(pits.count(3), 0);
    }
}
