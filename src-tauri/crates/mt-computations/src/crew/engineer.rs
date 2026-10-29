//! The engineer: what a driver's request turns into on the telemetry thread —
//! a pit action and its confirmation, or an answer from the car's data.
//!
//! The answer is a phrase key and its values; the words are the language
//! pack's. A pit command is confirmed only once it went out, so the driver
//! never hears "copy" for an order the sim did not take.

use mt_model::app::crew::{CompoundKind, CrewIntent, CrewReply, SimRead, QUESTION_PREFIX};
use mt_model::pit::pit_action::{PitAction, TireSet};
use mt_model::pit::pit_command::PitCommandKind;
use mt_model::sim::session::TireCompoundEntry;

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

/// Another car as the engineer can answer about it.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CarView {
    /// The number on the car, as a number: "007" is 7.
    pub number: u32,
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
    Pit { action: PitAction, ack: Ack },
    ChatMacro { slot: u32 },
    Reply(CrewReply),
}

pub fn plan(
    intent: CrewIntent,
    view: &EngineerView,
    compounds: &[TireCompoundEntry],
) -> EngineerStep {
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
        CrewIntent::Question { id, sim, .. } => {
            EngineerStep::Reply(question_reply(&id, &sim, view))
        }
        query => EngineerStep::Reply(answer(query, view)),
    }
}

fn answer(query: CrewIntent, view: &EngineerView) -> CrewReply {
    let no_data = || CrewReply::plain("engineer.noData");

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
        CrewIntent::QueryCarPosition { car } => match car_named(view, car) {
            Some(CarView {
                class_position: Some(position),
                ..
            }) => CrewReply::plain("engineer.answer.carPosition")
                .number("car", f64::from(car))
                .number("position", f64::from(*position)),
            Some(_) => no_data(),
            None => no_such_car(car),
        },
        CrewIntent::QueryCarLastLap { car } => match car_named(view, car) {
            Some(found) => car_lap_reply("engineer.answer.carLastLap", car, found.last_lap_s),
            None => no_such_car(car),
        },
        CrewIntent::QueryCarBestLap { car } => match car_named(view, car) {
            Some(found) => car_lap_reply("engineer.answer.carBestLap", car, found.best_lap_s),
            None => no_such_car(car),
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

fn car_named(view: &EngineerView, number: u32) -> Option<&CarView> {
    view.cars.iter().find(|car| car.number == number)
}

fn no_such_car(car: u32) -> CrewReply {
    CrewReply::plain("engineer.answer.noSuchCar").number("car", f64::from(car))
}

fn car_lap_reply(key: &str, car: u32, lap_s: Option<f32>) -> CrewReply {
    let car_number = f64::from(car);

    match lap_s.filter(|lap| *lap > 0.0) {
        Some(lap) => with_lap_time(CrewReply::plain(key).number("car", car_number), lap),
        None => CrewReply::plain("engineer.answer.carNoLapTime").number("car", car_number),
    }
}

/// Every value a question of the driver's own may name that the sim has now,
/// and the sim's own variables its replies name, read this tick; the pack's
/// reply picks the ones it says.
fn question_reply(id: &str, sim: &[SimRead], view: &EngineerView) -> CrewReply {
    let rounded = |value: Option<f32>| value.map(|value| f64::from(value.round()));
    let tenths = |value: Option<f32>| value.map(|value| (f64::from(value) * 10.0).round() / 10.0);
    let laps_left = view
        .laps_left
        .filter(|laps| (0..UNLIMITED_LAPS).contains(laps));
    let minutes_left = view
        .seconds_left
        .filter(|seconds| *seconds >= 0.0)
        .map(|seconds| (seconds / SECONDS_PER_MINUTE).floor());
    let values = [
        ("airTemp", rounded(view.air_temp_c)),
        ("trackTemp", rounded(view.track_temp_c)),
        (
            "rain",
            rounded(view.precipitation.map(|share| share * PERCENT)),
        ),
        ("wetness", view.track_wetness.map(f64::from)),
        ("wind", rounded(view.wind_ms)),
        ("fuel", rounded(view.fuel_l)),
        (
            "fuelLaps",
            view.fuel_laps.map(|laps| f64::from(laps.floor().max(0.0))),
        ),
        ("position", view.class_position.map(f64::from)),
        ("gapAhead", tenths(view.gap_ahead_s)),
        ("gapBehind", tenths(view.gap_behind_s)),
        ("lap", view.lap.map(f64::from)),
        ("lapsLeft", laps_left.map(f64::from)),
        ("minutesLeft", minutes_left),
    ];

    let reply = values.into_iter().fold(
        CrewReply::plain(&format!("{QUESTION_PREFIX}{id}")),
        |reply, (name, value)| match value {
            Some(value) => reply.number(name, value),
            None => reply,
        },
    );

    sim.iter().fold(reply, |reply, read| match read.value {
        Some(value) => reply.number(&read.name, value),
        None => reply,
    })
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
            plan(CrewIntent::Fuel { liters: 40 }, &view, &[]),
            EngineerStep::Reply(CrewReply::plain("engineer.notInCar").command(false))
        );

        let routine = |step| CrewIntent::Question {
            id: "routine".into(),
            sim: Vec::new(),
            steps: vec![step],
        };

        assert_eq!(
            plan(routine(CrewIntent::FastRepair), &view, &[]),
            EngineerStep::Reply(CrewReply::plain("engineer.notInCar").command(false))
        );
        assert!(matches!(
            plan(routine(CrewIntent::ChatMacro { slot: 2 }), &view, &[]),
            EngineerStep::Reply(reply) if reply.key == "question.routine"
        ));

        let EngineerStep::Reply(position) = plan(CrewIntent::QueryPosition, &view, &[]) else {
            panic!("a reply");
        };

        assert_eq!(number(&position, "position"), Some(4.0));
    }

    #[test]
    fn confirms_the_liters_the_order_carries() {
        let EngineerStep::Pit { action, ack } =
            plan(CrewIntent::Fuel { liters: 120 }, &in_car(), &[])
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
        let EngineerStep::Pit { ack, .. } = plan(CrewIntent::Tires { corners }, &in_car(), &[])
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
        let session = [compound(0, "Hard"), compound(1, "Wet")];

        assert_eq!(compound_index(&session, CompoundKind::Wet), Some(1));
        assert_eq!(compound_index(&session, CompoundKind::Dry), Some(0));
        assert_eq!(compound_index(&session, CompoundKind::Soft), None);
        assert_eq!(
            plan(
                CrewIntent::Compound {
                    compound: CompoundKind::Soft
                },
                &in_car(),
                &session
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
        let EngineerStep::Reply(reply) = plan(CrewIntent::QueryLastLap, &view, &[]) else {
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

        let EngineerStep::Reply(laps) = plan(CrewIntent::QueryLapsLeft, &lap_race, &[]) else {
            panic!("a reply");
        };
        let EngineerStep::Reply(minutes) = plan(CrewIntent::QueryLapsLeft, &timed, &[]) else {
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
        let EngineerStep::Reply(ahead) = plan(CrewIntent::QueryGapAhead, &view, &[]) else {
            panic!("a reply");
        };
        let EngineerStep::Reply(behind) = plan(CrewIntent::QueryGapBehind, &view, &[]) else {
            panic!("a reply");
        };

        assert_eq!(ahead.key, "engineer.answer.noCarAhead");
        assert_eq!(number(&behind, "gap"), Some(2.3));
    }

    #[test]
    fn answers_a_question_of_the_drivers_own_with_the_values_the_sim_has() {
        let view = EngineerView {
            air_temp_c: Some(21.6),
            precipitation: Some(0.35),
            gap_ahead_s: Some(1.26),
            laps_left: Some(UNLIMITED_LAPS),
            ..in_car()
        };
        let EngineerStep::Reply(reply) = plan(
            CrewIntent::Question {
                id: "weather".into(),
                sim: vec![
                    SimRead {
                        name: "sim.PlayerCarMyIncidentCount".into(),
                        value: Some(4.0),
                    },
                    SimRead {
                        name: "sim.Missing".into(),
                        value: None,
                    },
                ],
                steps: Vec::new(),
            },
            &view,
            &[],
        ) else {
            panic!("a reply");
        };
        let names: Vec<&str> = reply.args.iter().map(|(name, _)| name.as_str()).collect();

        assert_eq!(reply.key, "question.weather");
        assert_eq!(
            names,
            vec![
                "airTemp",
                "rain",
                "gapAhead",
                "sim.PlayerCarMyIncidentCount"
            ]
        );
        assert_eq!(number(&reply, "airTemp"), Some(22.0));
        assert_eq!(number(&reply, "rain"), Some(35.0));
        assert_eq!(number(&reply, "gapAhead"), Some(1.3));
        assert_eq!(number(&reply, "sim.PlayerCarMyIncidentCount"), Some(4.0));
        assert!(names.iter().all(|name| {
            mt_model::app::crew::QUESTION_VALUES.contains(name) || name.starts_with("sim.")
        }));
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
        let EngineerStep::Reply(dry) = plan(CrewIntent::QueryWeather, &dry, &[]) else {
            panic!("a reply");
        };
        let EngineerStep::Reply(wet) = plan(CrewIntent::QueryWeather, &wet, &[]) else {
            panic!("a reply");
        };

        assert_eq!(dry.key, "engineer.answer.weather");
        assert_eq!(number(&dry, "trackTemp"), Some(27.0));
        assert_eq!(wet.key, "engineer.answer.weatherRain");
        assert_eq!(number(&wet, "rain"), Some(42.0));
    }

    #[test]
    fn answers_about_another_car_by_its_number() {
        let view = EngineerView {
            cars: vec![CarView {
                number: 12,
                class_position: Some(3),
                last_lap_s: Some(95.27),
                best_lap_s: None,
            }],
            ..EngineerView::default()
        };
        let reply = |intent| match plan(intent, &view, &[]) {
            EngineerStep::Reply(reply) => reply,
            _ => panic!("a reply"),
        };

        let position = reply(CrewIntent::QueryCarPosition { car: 12 });
        let last = reply(CrewIntent::QueryCarLastLap { car: 12 });
        let best = reply(CrewIntent::QueryCarBestLap { car: 12 });
        let missing = reply(CrewIntent::QueryCarPosition { car: 7 });

        assert_eq!(number(&position, "position"), Some(3.0));
        assert_eq!(last.key, "engineer.answer.carLastLap");
        assert_eq!(
            (
                number(&last, "car"),
                number(&last, "minutes"),
                number(&last, "seconds")
            ),
            (Some(12.0), Some(1.0), Some(35.3))
        );
        assert_eq!(best.key, "engineer.answer.carNoLapTime");
        assert_eq!(missing.key, "engineer.answer.noSuchCar");
        assert_eq!(number(&missing, "car"), Some(7.0));
    }

    #[test]
    fn measures_the_gap_along_the_lap_across_the_line() {
        assert_eq!(track_gap(85.0, 3.0, 90.0), Some(8.0));
        assert_eq!(track_gap(10.0, 12.5, 90.0), Some(2.5));
        assert_eq!(track_gap(10.0, 12.5, 0.0), None);
    }
}
