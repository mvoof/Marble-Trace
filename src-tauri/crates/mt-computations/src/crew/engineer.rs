//! The engineer: what a driver's request turns into on the telemetry thread —
//! a pit action and its confirmation, or an answer from the car's data.
//!
//! The answer is a phrase key and its values; the words are the language
//! pack's. A pit command is confirmed only once it went out, so the driver
//! never hears "copy" for an order the sim did not take.

use mt_model::app::crew::{CompoundKind, CrewArg, CrewIntent, CrewReply};
use mt_model::pit::pit_action::{PitAction, TireSet};
use mt_model::pit::pit_command::PitCommandKind;
use mt_model::sim::session::{SessionSnapshot, TireCompoundEntry};

use crate::crew::questions::{number_matches, QuestionSource, QuestionView};
use crate::field::driver_entries::DriverEntry;
use crate::strategy::pit_actions::ManualOrder;

const SECONDS_PER_MINUTE: f64 = 60.0;
const COMPOUND_SLOT: &str = "compound";
const TIRES_SLOT: &str = "tires";
/// The sim's "unlimited laps" marker in a timed session.
const UNLIMITED_LAPS: i32 = 32_767;
const PERCENT: f32 = 100.0;
/// Below this share of precipitation the weather is told as dry.
const RAIN_SHARE: f32 = 0.01;
const NO_DATA_KEY: &str = "engineer.noData";

/// Another car as the engineer can answer about it.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CarView {
    /// The number on the car as the sim writes it: "007" keeps its zeros.
    pub number: String,
    pub class_position: Option<i32>,
    pub last_lap_s: Option<f32>,
    pub best_lap_s: Option<f32>,
}

/// What the engineer knows about the car, kept current by the telemetry
/// thread — some of it arrives only on slower tiers, so it is held between
/// them rather than read off the tick's bundle.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct EngineerView {
    pub in_car: bool,
    pub fuel_l: Option<f32>,
    pub fuel_laps: Option<f32>,
    pub class_position: Option<i32>,
    pub gap_ahead_s: Option<f32>,
    pub gap_behind_s: Option<f32>,
    pub laps_left: Option<i32>,
    pub seconds_left: Option<f64>,
    pub last_lap_s: Option<f32>,
    pub best_lap_s: Option<f32>,
    /// `None` while no fuel is ordered.
    pub ordered_fuel_l: Option<f32>,
    pub ordered_tires: u8,
    pub lap: Option<i32>,
    /// First and last lap to stop on, from the fuel calculation.
    pub pit_window: Option<(i32, i32)>,
    /// The race cannot be finished on the fuel aboard.
    pub needs_fuel: bool,
    pub air_temp_c: Option<f32>,
    pub track_temp_c: Option<f32>,
    /// Precipitation at the line, 0–1.
    pub precipitation: Option<f32>,
    /// The sim's wetness level, 0–7.
    pub track_wetness: Option<i32>,
    pub wind_ms: Option<f32>,
    /// Every car but the player's.
    pub cars: Vec<CarView>,
    /// What the driver's own questions are answered from.
    pub questions: QuestionView,
}

/// How a pit command is confirmed once it went out.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Ack {
    pub key: &'static str,
    /// The confirmation names the liters the order carries.
    pub liters: bool,
    pub compound: Option<CompoundKind>,
    pub tires: Option<TireSet>,
}

const fn ack(key: &'static str) -> Ack {
    Ack {
        key,
        liters: false,
        compound: None,
        tires: None,
    }
}

const fn ack_with_liters(key: &'static str) -> Ack {
    Ack {
        key,
        liters: true,
        compound: None,
        tires: None,
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum EngineerStep {
    Pit {
        action: PitAction,
        ack: Ack,
    },
    ChatMacro {
        slot: u32,
    },
    Reply(CrewReply),
    /// A question of the driver's own: a reply for each car it names.
    Answers(Vec<CrewReply>),
}

pub fn plan(
    intent: CrewIntent,
    view: &EngineerView,
    session: Option<&SessionSnapshot>,
) -> EngineerStep {
    let compounds = session.map_or(&[][..], |session| session.driver_tires.as_slice());

    if intent.is_pit_command() && !view.in_car {
        return EngineerStep::Reply(CrewReply::plain("engineer.notInCar").command(false));
    }

    let pit = |action, ack| EngineerStep::Pit { action, ack };

    match intent {
        CrewIntent::Fuel { liters } => pit(
            PitAction::SetFuel {
                liters: liters as f32,
            },
            ack_with_liters("engineer.ack.fuel"),
        ),
        CrewIntent::FuelToFinish => pit(
            PitAction::PlannedFuel,
            ack_with_liters("engineer.ack.fuelToFinish"),
        ),
        CrewIntent::ClearFuel => pit(
            PitAction::SetFuel { liters: 0.0 },
            ack("engineer.ack.clearFuel"),
        ),
        CrewIntent::Tires { corners } => pit(
            PitAction::SetTires { corners },
            Ack {
                tires: Some(corners),
                ..ack("engineer.ack.tires")
            },
        ),
        CrewIntent::ClearTires => pit(
            PitAction::SetTires {
                corners: TireSet::NONE,
            },
            ack("engineer.ack.clearTires"),
        ),
        CrewIntent::Compound { compound } => match compound_index(compounds, compound) {
            Some(index) => pit(
                PitAction::SetCompound { index },
                Ack {
                    compound: Some(compound),
                    ..ack("engineer.ack.compound")
                },
            ),
            None => EngineerStep::Reply(CrewReply::plain("engineer.cannot").command(false)),
        },
        CrewIntent::FastRepair => pit(
            PitAction::SetFastRepair { on: true },
            ack("engineer.ack.fastRepair"),
        ),
        CrewIntent::ClearFastRepair => pit(
            PitAction::SetFastRepair { on: false },
            ack("engineer.ack.clearFastRepair"),
        ),
        CrewIntent::Windshield => pit(
            PitAction::SetWindshield { on: true },
            ack("engineer.ack.windshield"),
        ),
        CrewIntent::ClearWindshield => pit(
            PitAction::SetWindshield { on: false },
            ack("engineer.ack.clearWindshield"),
        ),
        CrewIntent::ClearAll => pit(PitAction::Clear, ack("engineer.ack.clearAll")),
        CrewIntent::ApplyPlanned => pit(
            PitAction::ApplyPlanned,
            ack_with_liters("engineer.ack.applyPlanned"),
        ),
        CrewIntent::ChatMacro { slot } => EngineerStep::ChatMacro { slot },
        // Its steps are carried out before it is planned.
        CrewIntent::Question {
            id, asked, fields, ..
        } => EngineerStep::Answers(
            QuestionSource {
                view: &view.questions,
                session,
            }
            .answer(&id, asked.as_ref(), &fields),
        ),
        CrewIntent::QueryCarPosition { car } => {
            about_cars(view, &car, |found| match found.class_position {
                Some(position) => CrewReply::plain("engineer.answer.carPosition")
                    .arg("car", car_number(found))
                    .number("position", f64::from(position)),
                None => CrewReply::plain(NO_DATA_KEY),
            })
        }
        CrewIntent::QueryCarLastLap { car } => about_cars(view, &car, |found| {
            car_lap_reply("engineer.answer.carLastLap", found, found.last_lap_s)
        }),
        CrewIntent::QueryCarBestLap { car } => about_cars(view, &car, |found| {
            car_lap_reply("engineer.answer.carBestLap", found, found.best_lap_s)
        }),
        query => EngineerStep::Reply(answer(query, view)),
    }
}

fn answer(query: CrewIntent, view: &EngineerView) -> CrewReply {
    let no_data = || CrewReply::plain(NO_DATA_KEY);

    match query {
        CrewIntent::QueryFuel => match (view.fuel_l, view.fuel_laps) {
            (Some(liters), Some(laps)) => CrewReply::plain("engineer.answer.fuel")
                .number("liters", f64::from(liters.round()))
                .number("laps", f64::from(laps.floor().max(0.0))),
            _ => no_data(),
        },
        CrewIntent::QueryGapAhead => {
            gap_reply(view.class_position == Some(1), view.gap_ahead_s, "Ahead")
        }
        CrewIntent::QueryGapBehind => gap_reply(false, view.gap_behind_s, "Behind"),
        CrewIntent::QueryPosition => view.class_position.map_or_else(no_data, |position| {
            CrewReply::plain("engineer.answer.position").number("position", f64::from(position))
        }),
        CrewIntent::QueryLapsLeft => match (view.laps_left, view.seconds_left) {
            (Some(laps), _) if (0..UNLIMITED_LAPS).contains(&laps) => {
                CrewReply::plain("engineer.answer.lapsLeft").number("laps", f64::from(laps))
            }
            (_, Some(seconds)) if seconds >= 0.0 => CrewReply::plain("engineer.answer.timeLeft")
                .number("minutes", (seconds / SECONDS_PER_MINUTE).floor()),
            _ => no_data(),
        },
        CrewIntent::QueryLastLap => lap_reply("engineer.answer.lastLap", view.last_lap_s),
        CrewIntent::QueryBestLap => lap_reply("engineer.answer.bestLap", view.best_lap_s),
        CrewIntent::QueryWeather => match (view.air_temp_c, view.track_temp_c) {
            (Some(air), Some(track)) => {
                let rain = view.precipitation.filter(|share| *share >= RAIN_SHARE);
                let reply = match rain {
                    Some(share) => CrewReply::plain("engineer.answer.weatherRain")
                        .number("rain", f64::from((share * PERCENT).round())),
                    None => CrewReply::plain("engineer.answer.weather"),
                };

                reply
                    .number("airTemp", f64::from(air.round()))
                    .number("trackTemp", f64::from(track.round()))
            }
            _ => no_data(),
        },
        CrewIntent::QueryPitOrder => {
            if view.ordered_fuel_l.is_none() && view.ordered_tires == 0 {
                CrewReply::plain("engineer.answer.pitOrderEmpty")
            } else {
                CrewReply::plain("engineer.answer.pitOrder")
                    .number(
                        "liters",
                        f64::from(view.ordered_fuel_l.unwrap_or(0.0).round()),
                    )
                    .number("tires", f64::from(view.ordered_tires))
            }
        }
        _ => no_data(),
    }
}

/// A reply about each car the heard number names — two cars may wear the
/// same number — or that there is none.
fn about_cars(
    view: &EngineerView,
    heard: &str,
    reply: impl Fn(&CarView) -> CrewReply,
) -> EngineerStep {
    let replies: Vec<CrewReply> = view
        .cars
        .iter()
        .filter(|car| number_matches(heard, &car.number))
        .map(reply)
        .collect();

    if replies.is_empty() {
        return EngineerStep::Reply(CrewReply::plain("engineer.answer.noSuchCar").arg(
            "car",
            CrewArg::Text {
                value: heard.to_string(),
            },
        ));
    }

    EngineerStep::Answers(replies)
}

fn car_number(car: &CarView) -> CrewArg {
    CrewArg::Text {
        value: car.number.clone(),
    }
}

fn car_lap_reply(key: &str, car: &CarView, lap_s: Option<f32>) -> CrewReply {
    match lap_s.filter(|lap| *lap > 0.0) {
        Some(lap) => with_lap_time(CrewReply::plain(key).arg("car", car_number(car)), lap),
        None => CrewReply::plain("engineer.answer.carNoLapTime").arg("car", car_number(car)),
    }
}

/// "Nobody ahead" for the class leader; a gap to one decimal otherwise.
fn gap_reply(leading: bool, gap_s: Option<f32>, side: &str) -> CrewReply {
    if leading {
        return CrewReply::plain(&format!("engineer.answer.noCar{side}"));
    }

    match gap_s {
        Some(gap) => CrewReply::plain(&format!("engineer.answer.gap{side}"))
            .number("gap", (f64::from(gap) * 10.0).round() / 10.0),
        None => CrewReply::plain(&format!("engineer.answer.noCar{side}")),
    }
}

/// Minutes and seconds the way an engineer reads a lap: "one thirty-two four".
fn lap_reply(key: &str, lap_s: Option<f32>) -> CrewReply {
    match lap_s.filter(|lap| *lap > 0.0) {
        Some(lap) => with_lap_time(CrewReply::plain(key), lap),
        None => CrewReply::plain("engineer.answer.noLapTime"),
    }
}

fn with_lap_time(reply: CrewReply, lap_s: f32) -> CrewReply {
    let lap = f64::from(lap_s);
    let minutes = (lap / SECONDS_PER_MINUTE).floor();
    let seconds = ((lap - minutes * SECONDS_PER_MINUTE) * 10.0).round() / 10.0;

    reply.number("minutes", minutes).number("seconds", seconds)
}

/// The session's compound of that kind: its type names it ("Wet", "Soft"…);
/// "dry" is any compound that is not a wet one, when none is called dry.
pub fn compound_index(compounds: &[TireCompoundEntry], kind: CompoundKind) -> Option<i32> {
    let named = |entry: &&TireCompoundEntry| {
        entry
            .tire_compound_type
            .to_lowercase()
            .contains(kind.name())
    };

    compounds
        .iter()
        .find(named)
        .or_else(|| {
            (kind == CompoundKind::Dry).then(|| {
                compounds
                    .iter()
                    .find(|entry| !entry.tire_compound_type.to_lowercase().contains("wet"))
            })?
        })
        .map(|entry| entry.tire_index)
}

/// The confirmation of a pit command: what was asked if the order went out,
/// "can't" if there was nothing to send or the sim refused it.
pub fn acknowledge(ack: Ack, order: Option<&ManualOrder>, sent: bool) -> CrewReply {
    let Some(order) = order.filter(|_| sent) else {
        return CrewReply::plain("engineer.cannot").command(false);
    };
    let mut reply = CrewReply::plain(ack.key);

    if ack.liters {
        let liters = order
            .requests
            .iter()
            .find(|request| request.kind == PitCommandKind::Fuel)
            .map_or(0, |request| request.value);

        reply = reply.number("liters", f64::from(liters));
    }

    if let Some(compound) = ack.compound {
        reply = reply.slot("compound", COMPOUND_SLOT, compound.name());
    }

    if let Some(name) = ack.tires.and_then(TireSet::name) {
        reply = reply.slot("corners", TIRES_SLOT, name);
    }

    reply.command(true)
}

/// The player's class position and the on-track gaps, in seconds, to the cars
/// one place ahead and behind in the class.
pub fn class_gaps(entries: &[DriverEntry]) -> (Option<i32>, Option<f32>, Option<f32>) {
    let Some(player) = entries.iter().find(|entry| entry.is_player) else {
        return (None, None, None);
    };
    let position = player.live_class_position;

    if position <= 0 {
        return (None, None, None);
    }

    let rival = |offset: i32| {
        entries.iter().find(|entry| {
            !entry.is_player
                && entry.car_class_id == player.car_class_id
                && entry.live_class_position == position + offset
        })
    };
    let lap_time = player.class_est_lap_time;
    let ahead = rival(-1).map(|car| track_gap(player.est_time, car.est_time, lap_time));
    let behind = rival(1).map(|car| track_gap(car.est_time, player.est_time, lap_time));

    (Some(position), ahead.flatten(), behind.flatten())
}

/// Seconds from `from` to `to` along the lap, wrapping the line.
fn track_gap(from: f32, to: f32, lap_time: f32) -> Option<f32> {
    if lap_time <= 0.0 {
        return None;
    }

    Some((to - from).rem_euclid(lap_time))
}

/// How many corners a stop changes.
pub fn ordered_tire_count(change: [bool; 4]) -> u8 {
    change.iter().filter(|changed| **changed).count() as u8
}

#[cfg(test)]
mod tests {
    use super::*;
    use mt_model::app::crew::CrewArg;
    use mt_model::pit::pit_command::PitCommandRequest;

    fn in_car() -> EngineerView {
        EngineerView {
            in_car: true,
            ..EngineerView::default()
        }
    }

    fn number(reply: &CrewReply, name: &str) -> Option<f64> {
        reply.args.iter().find_map(|(arg, value)| match value {
            CrewArg::Number { value } if arg == name => Some(*value),
            _ => None,
        })
    }

    fn compound(index: i32, kind: &str) -> TireCompoundEntry {
        TireCompoundEntry {
            tire_index: index,
            tire_compound_type: kind.into(),
        }
    }

    #[test]
    fn refuses_a_pit_command_out_of_the_car_but_answers_a_question() {
        let view = EngineerView {
            class_position: Some(4),
            ..EngineerView::default()
        };

        assert_eq!(
            plan(CrewIntent::Fuel { liters: 40 }, &view, None),
            EngineerStep::Reply(CrewReply::plain("engineer.notInCar").command(false))
        );

        let routine = |step| CrewIntent::Question {
            id: "routine".into(),
            asked: None,
            fields: Vec::new(),
            steps: vec![step],
        };

        assert_eq!(
            plan(routine(CrewIntent::FastRepair), &view, None),
            EngineerStep::Reply(CrewReply::plain("engineer.notInCar").command(false))
        );
        assert!(matches!(
            plan(routine(CrewIntent::ChatMacro { slot: 2 }), &view, None),
            EngineerStep::Answers(replies) if replies[0].key == "question.routine"
        ));

        let EngineerStep::Reply(position) = plan(CrewIntent::QueryPosition, &view, None) else {
            panic!("a reply");
        };

        assert_eq!(number(&position, "position"), Some(4.0));
    }

    #[test]
    fn confirms_the_liters_the_order_carries() {
        let EngineerStep::Pit { action, ack } =
            plan(CrewIntent::Fuel { liters: 120 }, &in_car(), None)
        else {
            panic!("a pit action");
        };
        let capped = ManualOrder {
            requests: vec![PitCommandRequest {
                kind: PitCommandKind::Fuel,
                value: 80,
            }],
            claim: None,
        };

        assert_eq!(action, PitAction::SetFuel { liters: 120.0 });

        let reply = acknowledge(ack, Some(&capped), true);

        assert_eq!(reply.key, "engineer.ack.fuel");
        assert_eq!(number(&reply, "liters"), Some(80.0));
        assert_eq!(reply.command_ok, Some(true));
    }

    #[test]
    fn says_it_cannot_when_nothing_went_out() {
        let ack = ack_with_liters("engineer.ack.fuelToFinish");
        let order = ManualOrder {
            requests: Vec::new(),
            claim: None,
        };

        assert_eq!(acknowledge(ack, None, true).key, "engineer.cannot");
        assert_eq!(
            acknowledge(ack, Some(&order), false).command_ok,
            Some(false)
        );
    }

    #[test]
    fn confirms_tyres_by_the_set_it_ordered() {
        let corners = TireSet {
            lf: true,
            ..TireSet::NONE
        };
        let EngineerStep::Pit { ack, .. } = plan(CrewIntent::Tires { corners }, &in_car(), None)
        else {
            panic!("a pit step");
        };
        let order = ManualOrder {
            requests: Vec::new(),
            claim: None,
        };

        assert_eq!(
            acknowledge(ack, Some(&order), true),
            CrewReply::plain("engineer.ack.tires")
                .slot("corners", TIRES_SLOT, "lf")
                .command(true)
        );
    }

    #[test]
    fn finds_a_compound_by_its_type_and_dry_as_any_but_wet() {
        let compounds = [compound(0, "Hard"), compound(1, "Wet")];
        let session = SessionSnapshot {
            driver_tires: compounds.to_vec(),
            ..SessionSnapshot::default()
        };

        assert_eq!(compound_index(&compounds, CompoundKind::Wet), Some(1));
        assert_eq!(compound_index(&compounds, CompoundKind::Dry), Some(0));
        assert_eq!(compound_index(&compounds, CompoundKind::Soft), None);
        assert_eq!(
            plan(
                CrewIntent::Compound {
                    compound: CompoundKind::Soft
                },
                &in_car(),
                Some(&session)
            ),
            EngineerStep::Reply(CrewReply::plain("engineer.cannot").command(false))
        );
    }

    #[test]
    fn reads_a_lap_as_minutes_and_seconds() {
        let view = EngineerView {
            last_lap_s: Some(92.43),
            ..EngineerView::default()
        };
        let EngineerStep::Reply(reply) = plan(CrewIntent::QueryLastLap, &view, None) else {
            panic!("a reply");
        };

        assert_eq!(number(&reply, "minutes"), Some(1.0));
        assert_eq!(number(&reply, "seconds"), Some(32.4));
    }

    #[test]
    fn answers_laps_in_a_lap_race_and_minutes_in_a_timed_one() {
        let lap_race = EngineerView {
            laps_left: Some(12),
            seconds_left: Some(900.0),
            ..EngineerView::default()
        };
        let timed = EngineerView {
            laps_left: Some(UNLIMITED_LAPS),
            seconds_left: Some(1_530.0),
            ..EngineerView::default()
        };

        let EngineerStep::Reply(laps) = plan(CrewIntent::QueryLapsLeft, &lap_race, None) else {
            panic!("a reply");
        };
        let EngineerStep::Reply(minutes) = plan(CrewIntent::QueryLapsLeft, &timed, None) else {
            panic!("a reply");
        };

        assert_eq!(
            (laps.key.as_str(), number(&laps, "laps")),
            ("engineer.answer.lapsLeft", Some(12.0))
        );
        assert_eq!(
            (minutes.key.as_str(), number(&minutes, "minutes")),
            ("engineer.answer.timeLeft", Some(25.0))
        );
    }

    #[test]
    fn the_class_leader_has_nobody_ahead() {
        let view = EngineerView {
            class_position: Some(1),
            gap_behind_s: Some(2.34),
            ..EngineerView::default()
        };
        let EngineerStep::Reply(ahead) = plan(CrewIntent::QueryGapAhead, &view, None) else {
            panic!("a reply");
        };
        let EngineerStep::Reply(behind) = plan(CrewIntent::QueryGapBehind, &view, None) else {
            panic!("a reply");
        };

        assert_eq!(ahead.key, "engineer.answer.noCarAhead");
        assert_eq!(number(&behind, "gap"), Some(2.3));
    }

    #[test]
    fn tells_the_weather_and_names_the_rain_only_when_it_falls() {
        let dry = EngineerView {
            air_temp_c: Some(18.4),
            track_temp_c: Some(26.6),
            precipitation: Some(0.0),
            ..EngineerView::default()
        };
        let wet = EngineerView {
            precipitation: Some(0.42),
            ..dry.clone()
        };
        let EngineerStep::Reply(dry) = plan(CrewIntent::QueryWeather, &dry, None) else {
            panic!("a reply");
        };
        let EngineerStep::Reply(wet) = plan(CrewIntent::QueryWeather, &wet, None) else {
            panic!("a reply");
        };

        assert_eq!(dry.key, "engineer.answer.weather");
        assert_eq!(number(&dry, "trackTemp"), Some(27.0));
        assert_eq!(wet.key, "engineer.answer.weatherRain");
        assert_eq!(number(&wet, "rain"), Some(42.0));
    }

    #[test]
    fn answers_about_another_car_by_its_number() {
        let car = |number: &str, class_position| CarView {
            number: number.into(),
            class_position,
            last_lap_s: Some(95.27),
            best_lap_s: None,
        };
        let view = EngineerView {
            cars: vec![car("12", Some(3)), car("012", Some(5))],
            ..EngineerView::default()
        };
        let replies = |intent| match plan(intent, &view, None) {
            EngineerStep::Answers(replies) => replies,
            EngineerStep::Reply(reply) => vec![reply],
            _ => panic!("a reply"),
        };
        let text = |reply: &CrewReply, name: &str| {
            reply.args.iter().find_map(|(arg, value)| match value {
                CrewArg::Text { value } if arg == name => Some(value.clone()),
                _ => None,
            })
        };

        let both = replies(CrewIntent::QueryCarPosition { car: "12".into() });
        let zeros = replies(CrewIntent::QueryCarPosition { car: "012".into() });
        let last = replies(CrewIntent::QueryCarLastLap { car: "012".into() });
        let best = replies(CrewIntent::QueryCarBestLap { car: "012".into() });
        let missing = replies(CrewIntent::QueryCarPosition { car: "7".into() });

        assert_eq!(
            both.iter()
                .map(|reply| number(reply, "position"))
                .collect::<Vec<_>>(),
            [Some(3.0), Some(5.0)]
        );
        assert_eq!(zeros.len(), 1);
        assert_eq!(text(&zeros[0], "car").as_deref(), Some("012"));
        assert_eq!(last[0].key, "engineer.answer.carLastLap");
        assert_eq!(
            (number(&last[0], "minutes"), number(&last[0], "seconds")),
            (Some(1.0), Some(35.3))
        );
        assert_eq!(best[0].key, "engineer.answer.carNoLapTime");
        assert_eq!(missing[0].key, "engineer.answer.noSuchCar");
        assert_eq!(text(&missing[0], "car").as_deref(), Some("7"));
    }

    #[test]
    fn measures_the_gap_along_the_lap_across_the_line() {
        assert_eq!(track_gap(85.0, 3.0, 90.0), Some(8.0));
        assert_eq!(track_gap(10.0, 12.5, 90.0), Some(2.5));
        assert_eq!(track_gap(10.0, 12.5, 0.0), None);
    }
}
