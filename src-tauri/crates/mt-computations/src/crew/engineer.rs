//! The engineer: what a driver's request turns into on the telemetry thread —
//! a pit action and its confirmation, or an answer from the car's data.
//!
//! The answer is a phrase key and its values; the words are the language
//! pack's. A pit command is confirmed only once it went out, so the driver
//! never hears "copy" for an order the sim did not take.

use mt_model::app::crew::{
    minutes_and_seconds, CompoundKind, CrewArg, CrewIntent, CrewReply, Quantity, TENTHS,
};
use mt_model::pit::pit_action::{PitAction, TireSet};
use mt_model::pit::pit_command::PitCommandKind;
use mt_model::sim::enums::TrackSurface;
use mt_model::sim::session::{CarEntry, SessionSnapshot, TireCompoundEntry};

use crate::crew::questions::{number_matches, QuestionSource, QuestionView};
use crate::field::driver_entries::DriverEntry;
use crate::strategy::pit_actions::ManualOrder;

const SECONDS_PER_MINUTE: f64 = 60.0;
const COMPOUND_SLOT: &str = "compound";
const TIRES_SLOT: &str = "tires";
/// The sim's "unlimited laps" marker in a timed session.
pub(crate) const UNLIMITED_LAPS: i32 = 32_767;
/// The sim's time remaining in a session with no time limit: a week.
pub(crate) const UNLIMITED_SECONDS: f64 = 604_800.0;
/// Below this share of the lap the car's time into it says too little to
/// read a lap time from.
const MIN_LAP_SHARE_FOR_PACE: f32 = 0.1;
const PERCENT: f32 = 100.0;
/// Below this share of precipitation the weather is told as dry.
const RAIN_SHARE: f32 = 0.01;
const NO_DATA_KEY: &str = "engineer.noData";
/// The fuel a reply names, in liters; said in the driver's units.
const FUEL_VALUE: &str = "fuel";
const SURFACE_VALUE: &str = "surface";

/// Another car as the engineer can answer about it.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CarView {
    /// The number on the car as the sim writes it: "007" keeps its zeros.
    pub number: String,
    pub class_position: Option<i32>,
    pub last_lap_s: Option<f32>,
    pub best_lap_s: Option<f32>,
}

/// How far a rival in the class is: seconds while on the same lap, whole
/// laps once a lap or more apart.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Gap {
    Seconds(f32),
    Laps(i32),
}

/// Who the nearest car on track is to the player.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrackRelation {
    /// One place ahead or behind in the class, on the same lap.
    Rival,
    /// That many laps down on the player.
    Lapped(i32),
    /// That many laps up on the player.
    LapsUp(i32),
    /// Another place, another class, or laps unknown.
    Other,
}

/// The nearest car on one side of the player along the lap, as Relative
/// shows it.
#[derive(Debug, Clone, PartialEq)]
pub struct TrackNeighbour {
    pub number: String,
    /// `None` in a session of one class.
    pub class_name: Option<String>,
    pub gap_s: f32,
    pub relation: TrackRelation,
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
    /// To the cars one place ahead and behind in the class.
    pub gap_ahead: Option<Gap>,
    pub gap_behind: Option<Gap>,
    /// The nearest cars on track, any class, lapped or not.
    pub car_ahead_on_track: Option<TrackNeighbour>,
    pub car_behind_on_track: Option<TrackNeighbour>,
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
        CrewIntent::QueryWhoAhead => who_reply(view.car_ahead_on_track.as_ref(), "Ahead"),
        CrewIntent::QueryWhoBehind => who_reply(view.car_behind_on_track.as_ref(), "Behind"),
        query => EngineerStep::Reply(answer(query, view)),
    }
}

fn answer(query: CrewIntent, view: &EngineerView) -> CrewReply {
    let no_data = || CrewReply::plain(NO_DATA_KEY);

    match query {
        CrewIntent::QueryFuel => match (view.fuel_l, view.fuel_laps) {
            (Some(liters), Some(laps)) => CrewReply::plain("engineer.answer.fuel")
                .measure(FUEL_VALUE, Quantity::Volume, f64::from(liters))
                .number("laps", f64::from(whole_laps(laps))),
            _ => no_data(),
        },
        CrewIntent::QueryGapAhead => {
            gap_reply(view.class_position == Some(1), view.gap_ahead, "Ahead")
        }
        CrewIntent::QueryGapBehind => gap_reply(false, view.gap_behind, "Behind"),
        CrewIntent::QueryPosition => view.class_position.map_or_else(no_data, |position| {
            CrewReply::plain("engineer.answer.position").number("position", f64::from(position))
        }),
        CrewIntent::QueryLapsLeft => match session_left(view) {
            Some(SessionLeft::Laps(laps)) => {
                CrewReply::plain("engineer.answer.lapsLeft").number("laps", f64::from(laps))
            }
            Some(SessionLeft::Minutes(minutes)) => {
                CrewReply::plain("engineer.answer.timeLeft").number("minutes", minutes)
            }
            None => no_data(),
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
                    .measure("airTemp", Quantity::Temperature, f64::from(air))
                    .measure("trackTemp", Quantity::Temperature, f64::from(track))
                    .word(SURFACE_VALUE, surface_key(view.track_wetness))
            }
            _ => no_data(),
        },
        CrewIntent::QueryPitOrder => {
            if view.ordered_fuel_l.is_none() && view.ordered_tires == 0 {
                CrewReply::plain("engineer.answer.pitOrderEmpty")
            } else {
                CrewReply::plain("engineer.answer.pitOrder")
                    .measure(
                        FUEL_VALUE,
                        Quantity::Volume,
                        f64::from(view.ordered_fuel_l.unwrap_or(0.0)),
                    )
                    .number("tires", f64::from(view.ordered_tires))
            }
        }
        _ => no_data(),
    }
}

/// The sim's wetness levels from 1, as the weather widget shows them: the
/// pack's key, and the words chat says.
const SURFACES: [(&str, &str); 7] = [
    ("engineer.surface.dry", "dry track"),
    ("engineer.surface.mostlyDry", "mostly dry track"),
    ("engineer.surface.veryLightlyWet", "very lightly wet track"),
    ("engineer.surface.lightlyWet", "lightly wet track"),
    ("engineer.surface.moderatelyWet", "moderately wet track"),
    ("engineer.surface.veryWet", "very wet track"),
    ("engineer.surface.extremelyWet", "extremely wet track"),
];

fn surface(track_wetness: Option<i32>) -> Option<(&'static str, &'static str)> {
    let level = track_wetness.filter(|level| *level >= 1)?;
    let index = usize::try_from(level - 1).ok()?;

    SURFACES.get(index.min(SURFACES.len() - 1)).copied()
}

fn surface_key(track_wetness: Option<i32>) -> &'static str {
    surface(track_wetness).map_or("engineer.surface.unknown", |(key, _)| key)
}

pub(crate) fn surface_words(track_wetness: Option<i32>) -> Option<&'static str> {
    surface(track_wetness).map(|(_, words)| words)
}

/// More than one class of real cars in the session.
pub(crate) fn is_multiclass(session: &SessionSnapshot) -> bool {
    let mut classes = session
        .cars
        .iter()
        .filter(|car| !car.is_pace_car && !car.is_spectator && !car.user_name.is_empty())
        .map(|car| car.car_class_id);
    let first = classes.next();

    classes.any(|class| Some(class) != first)
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

/// "Nobody ahead" for the class leader; a gap to one decimal, or the laps
/// between, otherwise.
fn gap_reply(leading: bool, gap: Option<Gap>, side: &str) -> CrewReply {
    if leading {
        return CrewReply::plain(&format!("engineer.answer.noCar{side}"));
    }

    match gap {
        Some(Gap::Seconds(seconds)) => {
            CrewReply::plain(&format!("engineer.answer.gap{side}")).number("gap", tenths(seconds))
        }
        Some(Gap::Laps(laps)) => {
            CrewReply::plain(&format!("engineer.answer.laps{side}")).number("laps", f64::from(laps))
        }
        None => CrewReply::plain(&format!("engineer.answer.noCar{side}")),
    }
}

fn tenths(seconds: f32) -> f64 {
    (f64::from(seconds) * 10.0).round() / 10.0
}

/// Who the nearest car on track is — number, class in a session of several — then how it stands to the player when that matters.
fn who_reply(car: Option<&TrackNeighbour>, side: &str) -> EngineerStep {
    let Some(car) = car else {
        return EngineerStep::Reply(CrewReply::plain(&format!(
            "engineer.answer.noCar{side}OnTrack"
        )));
    };
    let text = |value: &str| CrewArg::Text {
        value: value.to_string(),
    };
    let who = match &car.class_name {
        Some(class_name) => CrewReply::plain(&format!("engineer.answer.car{side}OnTrackClass"))
            .arg("className", text(class_name)),
        None => CrewReply::plain(&format!("engineer.answer.car{side}OnTrack")),
    }
    .arg("car", text(&car.number))
    .number("gap", tenths(car.gap_s));
    let relation = match car.relation {
        TrackRelation::Rival => Some(CrewReply::plain("engineer.answer.trackRival")),
        TrackRelation::Lapped(laps) => {
            Some(CrewReply::plain("engineer.answer.trackLapped").number("laps", f64::from(laps)))
        }
        TrackRelation::LapsUp(laps) => {
            Some(CrewReply::plain("engineer.answer.trackLapsUp").number("laps", f64::from(laps)))
        }
        TrackRelation::Other => None,
    };

    EngineerStep::Answers(std::iter::once(who).chain(relation).collect())
}

/// Minutes and seconds the way an engineer reads a lap: "one thirty-two four".
fn lap_reply(key: &str, lap_s: Option<f32>) -> CrewReply {
    match lap_s.filter(|lap| *lap > 0.0) {
        Some(lap) => with_lap_time(CrewReply::plain(key), lap),
        None => CrewReply::plain("engineer.answer.noLapTime"),
    }
}

fn with_lap_time(reply: CrewReply, lap_s: f32) -> CrewReply {
    let (minutes, seconds) = minutes_and_seconds(f64::from(lap_s), TENTHS);

    reply.number("minutes", minutes).number("seconds", seconds)
}

/// What is left of the session, in the terms it is limited by.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) enum SessionLeft {
    Laps(i32),
    /// Whole minutes.
    Minutes(f64),
}

pub(crate) fn session_left(view: &EngineerView) -> Option<SessionLeft> {
    match (view.laps_left, view.seconds_left) {
        (Some(laps), _) if (0..UNLIMITED_LAPS).contains(&laps) => Some(SessionLeft::Laps(laps)),
        (_, Some(seconds)) if (0.0..UNLIMITED_SECONDS).contains(&seconds) => {
            Some(SessionLeft::Minutes((seconds / SECONDS_PER_MINUTE).floor()))
        }
        _ => None,
    }
}

/// The laps the fuel lasts, as complete laps.
pub(crate) fn whole_laps(laps: f32) -> f32 {
    laps.floor().max(0.0)
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

        reply = reply.measure(FUEL_VALUE, Quantity::Volume, f64::from(liters));
    }

    if let Some(compound) = ack.compound {
        reply = reply.slot("compound", COMPOUND_SLOT, compound.name());
    }

    if let Some(name) = ack.tires.and_then(TireSet::name) {
        reply = reply.slot("corners", TIRES_SLOT, name);
    }

    reply.command(true)
}

/// The player's class position and the live gaps to the cars one place ahead
/// and behind in the class: seconds along the lap, whole laps once the cars
/// are a lap or more apart.
pub fn class_gaps(entries: &[DriverEntry]) -> (Option<i32>, Option<Gap>, Option<Gap>) {
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
    let gap = |front: &DriverEntry, back: &DriverEntry| {
        let laps_apart = progress(front)
            .zip(progress(back))
            .map(|(front, back)| (front - back).floor() as i32)
            .filter(|laps| *laps >= 1);

        match laps_apart {
            Some(laps) => Some(Gap::Laps(laps)),
            None => track_gap(back.est_time, front.est_time, lap_time).map(Gap::Seconds),
        }
    };
    let ahead = rival(-1).and_then(|car| gap(car, player));
    let behind = rival(1).and_then(|car| gap(player, car));

    (Some(position), ahead, behind)
}

/// Laps run plus the share of the current one; `None` before the car has a
/// lap or a place on track.
pub(crate) fn progress(entry: &DriverEntry) -> Option<f32> {
    (entry.lap >= 0 && entry.lap_dist_pct >= 0.0).then_some(entry.lap as f32 + entry.lap_dist_pct)
}

/// The nearest cars ahead and behind the player along the lap, as Relative
/// shows them: any class, lapped or not; a car on pit road or out of the
/// world is passed over.
pub fn track_neighbours(
    entries: &[DriverEntry],
    session: &SessionSnapshot,
) -> (Option<TrackNeighbour>, Option<TrackNeighbour>) {
    let racing =
        |car: &&CarEntry| !car.is_pace_car && !car.is_spectator && !car.user_name.is_empty();
    let Some(player) = entries.iter().find(|entry| entry.is_player) else {
        return (None, None);
    };
    let multiclass = is_multiclass(session);
    let nearest = |ahead: bool| {
        entries
            .iter()
            .filter(|entry| {
                !entry.is_player
                    && !entry.on_pit_road
                    && entry.track_surface != TrackSurface::NotInWorld
                    && (entry.relative_lap_dist > 0.0) == ahead
                    && entry.relative_lap_dist != 0.0
            })
            .filter_map(|entry| {
                let car = session
                    .cars
                    .iter()
                    .filter(racing)
                    .find(|car| car.car_idx == entry.car_idx)?;

                Some((entry, car))
            })
            .min_by(|(left, _), (right, _)| {
                left.relative_lap_dist
                    .abs()
                    .total_cmp(&right.relative_lap_dist.abs())
            })
            .map(|(entry, car)| TrackNeighbour {
                number: car.car_number.trim().to_string(),
                class_name: multiclass.then(|| car.car_class_short_name.trim().to_string()),
                gap_s: relative_gap(entry, player).abs(),
                relation: track_relation(entry, player),
            })
    };

    (nearest(true), nearest(false))
}

/// Seconds between a car and the player along the lap, scaled by class pace
/// so a faster class is not told closer than it is — Relative's gap.
fn relative_gap(car: &DriverEntry, player: &DriverEntry) -> f32 {
    // Before a class pace or a best lap, the time into the lap over its
    // share stands in for the lap.
    let lap_time = |entry: &DriverEntry| {
        Some(entry.class_est_lap_time)
            .filter(|time| *time > 0.0)
            .or(entry.best_lap_time)
            .filter(|time| *time > 0.0)
            .or_else(|| {
                (entry.lap_dist_pct >= MIN_LAP_SHARE_FOR_PACE)
                    .then(|| entry.est_time / entry.lap_dist_pct)
                    .filter(|time| *time > 0.0)
            })
    };
    let ahead = car.relative_lap_dist > 0.0;
    let (front, back) = if ahead { (car, player) } else { (player, car) };
    let (Some(front_lap), Some(back_lap)) = (
        lap_time(front).or(lap_time(back)),
        lap_time(back).or(lap_time(front)),
    ) else {
        return car.est_time - player.est_time;
    };
    let front_scaled = front.est_time * back_lap / front_lap;
    let gap = (front_scaled - back.est_time).rem_euclid(back_lap);

    if gap > back_lap / 2.0 {
        gap - back_lap
    } else {
        gap
    }
}

/// Laps the car is up or down on the player, from both cars' progress less
/// the distance between them on track.
fn track_relation(car: &DriverEntry, player: &DriverEntry) -> TrackRelation {
    let Some(laps_up) = progress(car)
        .zip(progress(player))
        .map(|(car_progress, mine)| (car_progress - mine - car.relative_lap_dist).round() as i32)
    else {
        return TrackRelation::Other;
    };
    let next_place = player.live_class_position > 0
        && (car.live_class_position - player.live_class_position).abs() == 1;

    match laps_up {
        laps if laps < 0 => TrackRelation::Lapped(-laps),
        laps if laps > 0 => TrackRelation::LapsUp(laps),
        _ if car.car_class_id == player.car_class_id && next_place => TrackRelation::Rival,
        _ => TrackRelation::Other,
    }
}

/// Seconds from `from` to `to` along the lap, wrapping the line.
pub(crate) fn track_gap(from: f32, to: f32, lap_time: f32) -> Option<f32> {
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
            CrewArg::Number { value } | CrewArg::Measure { value, .. } if arg == name => {
                Some(*value)
            }
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
        assert_eq!(number(&reply, "fuel"), Some(80.0));
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
            gap_behind: Some(Gap::Seconds(2.34)),
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
        assert!(number(&dry, "trackTemp").is_some_and(|degrees| (degrees - 26.6).abs() < 1e-3));
        assert_eq!(wet.key, "engineer.answer.weatherRain");
        assert_eq!(number(&wet, "rain"), Some(42.0));
    }

    #[test]
    fn names_the_track_surface_by_its_wetness_not_the_rain() {
        let surface = |track_wetness| {
            let view = EngineerView {
                air_temp_c: Some(18.0),
                track_temp_c: Some(22.0),
                precipitation: Some(0.0),
                track_wetness,
                ..EngineerView::default()
            };
            let EngineerStep::Reply(reply) = plan(CrewIntent::QueryWeather, &view, None) else {
                panic!("a reply");
            };

            reply
                .args
                .into_iter()
                .find_map(|(name, value)| match value {
                    CrewArg::Word { key } if name == "surface" => Some(key),
                    _ => None,
                })
        };

        assert_eq!(surface(Some(1)).as_deref(), Some("engineer.surface.dry"));
        assert_eq!(
            surface(Some(2)).as_deref(),
            Some("engineer.surface.mostlyDry")
        );
        assert_eq!(
            surface(Some(5)).as_deref(),
            Some("engineer.surface.moderatelyWet")
        );
        assert_eq!(
            surface(Some(7)).as_deref(),
            Some("engineer.surface.extremelyWet")
        );
        assert_eq!(surface(None).as_deref(), Some("engineer.surface.unknown"));
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

    const GT3: i32 = 1;
    const GT4: i32 = 2;

    /// A car on track at `lap` + `lap_dist_pct`, its estimated time on a
    /// 90 s lap.
    fn racing(
        car_idx: i32,
        class: i32,
        class_position: i32,
        lap: i32,
        lap_dist_pct: f32,
    ) -> DriverEntry {
        DriverEntry {
            car_idx,
            car_class_id: class,
            tire_compound: String::new(),
            position: class_position,
            class_position,
            live_position: class_position,
            live_class_position: class_position,
            start_pos_overall: None,
            start_pos_class: None,
            lap,
            lap_dist_pct,
            last_lap_time: None,
            best_lap_time: None,
            qualify_time: None,
            f2_time: 0.0,
            est_time: lap_dist_pct * 90.0,
            track_surface: TrackSurface::OnTrack,
            i_rating: 0,
            is_player: car_idx == 0,
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
            pit_lap: None,
            pit_elapsed_s: None,
            last_pit_s: None,
        }
    }

    fn placed(mut entry: DriverEntry, relative_lap_dist: f32) -> DriverEntry {
        entry.relative_lap_dist = relative_lap_dist;
        entry
    }

    fn session_car(car_idx: i32, class: i32, number: &str, class_name: &str) -> CarEntry {
        CarEntry {
            car_idx,
            user_name: format!("Driver {car_idx}"),
            car_number: number.into(),
            car_class_id: class,
            car_class_short_name: class_name.into(),
            ..CarEntry::default()
        }
    }

    #[test]
    fn a_class_rival_a_lap_or_more_away_is_told_in_laps() {
        let entries = [
            racing(0, GT3, 2, 5, 0.5),
            racing(1, GT3, 1, 6, 0.6),
            racing(2, GT3, 3, 5, 0.45),
        ];

        let (position, ahead, behind) = class_gaps(&entries);

        assert_eq!(position, Some(2));
        assert_eq!(ahead, Some(Gap::Laps(1)));
        assert!(matches!(behind, Some(Gap::Seconds(gap)) if (gap - 4.5).abs() < 1e-3));
    }

    #[test]
    fn the_nearest_car_on_track_skips_the_pits_and_says_how_it_stands() {
        let mut in_pits = placed(racing(3, GT3, 4, 5, 0.51), 0.01);
        in_pits.on_pit_road = true;
        let mut lapped_gt4 = placed(racing(4, GT4, 6, 4, 0.55), 0.05);
        lapped_gt4.class_est_lap_time = 100.0;
        lapped_gt4.est_time = 55.0;
        let entries = [
            racing(0, GT3, 2, 5, 0.5),
            in_pits,
            lapped_gt4,
            placed(racing(2, GT3, 3, 5, 0.48), -0.02),
        ];
        let session = SessionSnapshot {
            player_car_idx: 0,
            cars: vec![
                session_car(0, GT3, "5", "GT3"),
                session_car(2, GT3, "12", "GT3"),
                session_car(3, GT3, "33", "GT3"),
                session_car(4, GT4, "09", "GT4"),
            ],
            ..SessionSnapshot::default()
        };

        let (ahead, behind) = track_neighbours(&entries, &session);
        let ahead = ahead.expect("a car ahead");
        let behind = behind.expect("a car behind");

        assert_eq!(
            (
                ahead.number.as_str(),
                ahead.class_name.as_deref(),
                ahead.relation
            ),
            ("09", Some("GT4"), TrackRelation::Lapped(1))
        );
        assert!((ahead.gap_s - 4.5).abs() < 1e-3);
        assert_eq!(
            (behind.number.as_str(), behind.relation),
            ("12", TrackRelation::Rival)
        );
    }

    #[test]
    fn who_is_ahead_names_the_car_then_how_it_stands() {
        let view = EngineerView {
            car_ahead_on_track: Some(TrackNeighbour {
                number: "09".into(),
                class_name: None,
                gap_s: 1.26,
                relation: TrackRelation::Lapped(1),
            }),
            ..EngineerView::default()
        };

        let EngineerStep::Answers(replies) = plan(CrewIntent::QueryWhoAhead, &view, None) else {
            panic!("answers");
        };
        let EngineerStep::Reply(nobody) = plan(CrewIntent::QueryWhoBehind, &view, None) else {
            panic!("a reply");
        };

        assert_eq!(
            replies
                .iter()
                .map(|reply| reply.key.as_str())
                .collect::<Vec<_>>(),
            [
                "engineer.answer.carAheadOnTrack",
                "engineer.answer.trackLapped"
            ]
        );
        assert_eq!(number(&replies[0], "gap"), Some(1.3));
        assert_eq!(nobody.key, "engineer.answer.noCarBehindOnTrack");
    }

    #[test]
    fn a_session_with_no_time_limit_has_no_time_left_to_tell() {
        let open_practice = EngineerView {
            laps_left: Some(UNLIMITED_LAPS),
            seconds_left: Some(UNLIMITED_SECONDS),
            ..EngineerView::default()
        };

        let EngineerStep::Reply(reply) = plan(CrewIntent::QueryLapsLeft, &open_practice, None)
        else {
            panic!("a reply");
        };

        assert_eq!(reply.key, NO_DATA_KEY);
    }

    #[test]
    fn before_any_lap_time_the_gap_still_wraps_the_line() {
        let mut player = placed(racing(0, GT3, 1, 0, 0.95), 0.0);
        let mut across_the_line = placed(racing(1, GT3, 2, 1, 0.05), 0.1);
        player.class_est_lap_time = 0.0;
        across_the_line.class_est_lap_time = 0.0;

        let gap = relative_gap(&across_the_line, &player);

        assert!((gap - 9.0).abs() < 1e-3, "gap {gap}");
    }
}
