//! What a language pack may hold: the phrase keys the crew speaks and the
//! intents a driver can say, both ours — a pack fills them in, it never adds a
//! key the code would not know to use.
//!
//! Keys are namespaced by who speaks (`engineer.*`), so a spotter's phrases can
//! join later as `spotter.*` without touching these.

pub use mt_model::app::crew::ASK_WHEN_UNSAID;
use mt_model::app::crew::{Quantity, QUESTION_PREFIX};
use mt_model::app::crew_questions::{question_field_named, SayFormat, QUESTION_FIELDS};
use mt_model::pit::pit_action::TireSet;

use crate::pack::template::SlotValue;

/// A phrase key and the values the code fills it with.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PhraseKey {
    pub id: &'static str,
    pub values: &'static [&'static str],
}

const fn key(id: &'static str, values: &'static [&'static str]) -> PhraseKey {
    PhraseKey { id, values }
}

pub const PHRASE_KEYS: &[PhraseKey] = &[
    key("engineer.ack.fuel", &[FUEL_VALUE]),
    key("engineer.ack.fuelToFinish", &[FUEL_VALUE]),
    key("engineer.ack.clearFuel", &[]),
    key("engineer.ack.tires", &["corners"]),
    key("engineer.ack.clearTires", &[]),
    key("engineer.ack.compound", &["compound"]),
    key("engineer.ack.fastRepair", &[]),
    key("engineer.ack.clearFastRepair", &[]),
    key("engineer.ack.windshield", &[]),
    key("engineer.ack.clearWindshield", &[]),
    key("engineer.ack.clearAll", &[]),
    key("engineer.ack.applyPlanned", &[FUEL_VALUE]),
    key("engineer.answer.fuel", &[FUEL_VALUE, "laps"]),
    key("engineer.answer.gapAhead", &["gap"]),
    key("engineer.answer.gapBehind", &["gap"]),
    key("engineer.answer.noCarAhead", &[]),
    key("engineer.answer.noCarBehind", &[]),
    key("engineer.answer.lapsAhead", &["laps"]),
    key("engineer.answer.lapsBehind", &["laps"]),
    key("engineer.answer.carAheadOnTrack", &["car", "gap"]),
    key("engineer.answer.carBehindOnTrack", &["car", "gap"]),
    key(
        "engineer.answer.carAheadOnTrackClass",
        &["car", "className", "gap"],
    ),
    key(
        "engineer.answer.carBehindOnTrackClass",
        &["car", "className", "gap"],
    ),
    key("engineer.answer.noCarAheadOnTrack", &[]),
    key("engineer.answer.noCarBehindOnTrack", &[]),
    key("engineer.answer.trackRival", &[]),
    key("engineer.answer.trackLapped", &["laps"]),
    key("engineer.answer.trackLapsUp", &["laps"]),
    key("engineer.answer.position", &["position"]),
    key("engineer.answer.lapsLeft", &["laps"]),
    key("engineer.answer.timeLeft", &["minutes"]),
    key("engineer.answer.lastLap", &["minutes", "seconds"]),
    key("engineer.answer.bestLap", &["minutes", "seconds"]),
    key("engineer.answer.noLapTime", &[]),
    key("engineer.answer.pitOrder", &[FUEL_VALUE, "tires"]),
    key("engineer.answer.pitOrderEmpty", &[]),
    key(
        "engineer.answer.weather",
        &[AIR_TEMP_VALUE, TRACK_TEMP_VALUE, SURFACE_VALUE],
    ),
    key(
        "engineer.answer.weatherRain",
        &[AIR_TEMP_VALUE, TRACK_TEMP_VALUE, "rain", SURFACE_VALUE],
    ),
    key("engineer.answer.carPosition", &["car", "position"]),
    key("engineer.answer.carLastLap", &["car", "minutes", "seconds"]),
    key("engineer.answer.carBestLap", &["car", "minutes", "seconds"]),
    key("engineer.answer.carNoLapTime", &["car"]),
    key("engineer.answer.noSuchCar", &["car"]),
    key("engineer.ask.fuel", &[]),
    key("engineer.ask.tires", &[]),
    key("engineer.ask.compound", &[]),
    key("engineer.ask.car", &[]),
    key("engineer.notUnderstood", &[]),
    key("engineer.notInCar", &[]),
    key("engineer.noData", &[]),
    key("engineer.cannot", &[]),
    key("engineer.nothingToRepeat", &[]),
    // The words a question's answer says a value with.
    key(YES_KEY, &[]),
    key(NO_KEY, &[]),
    key(PLUS_KEY, &[SAID_VALUE]),
    key(MINUS_KEY, &[SAID_VALUE]),
    key(FASTER_KEY, &[SAID_VALUE]),
    key(SLOWER_KEY, &[SAID_VALUE]),
    // The track surface a weather answer names, by the sim's wetness level.
    key("engineer.surface.unknown", &[]),
    key(SURFACE_DRY_KEY, &[]),
    key("engineer.surface.mostlyDry", &[]),
    key("engineer.surface.veryLightlyWet", &[]),
    key("engineer.surface.lightlyWet", &[]),
    key("engineer.surface.moderatelyWet", &[]),
    key("engineer.surface.veryWet", &[]),
    key("engineer.surface.extremelyWet", &[]),
    // The words an amount is said with, by the driver's unit system.
    key(LITERS_KEY, &[SAID_VALUE]),
    key(GALLONS_KEY, &[SAID_VALUE]),
    key(CELSIUS_KEY, &[SAID_VALUE]),
    key(FAHRENHEIT_KEY, &[SAID_VALUE]),
    key(KMH_KEY, &[SAID_VALUE]),
    key(MPH_KEY, &[SAID_VALUE]),
];

pub const LITERS_KEY: &str = "engineer.unit.liters";
pub const GALLONS_KEY: &str = "engineer.unit.gallons";
pub const CELSIUS_KEY: &str = "engineer.unit.celsius";
pub const FAHRENHEIT_KEY: &str = "engineer.unit.fahrenheit";
pub const KMH_KEY: &str = "engineer.unit.kmh";
pub const MPH_KEY: &str = "engineer.unit.mph";
/// The fuel a built-in reply names.
pub const FUEL_VALUE: &str = "fuel";
const AIR_TEMP_VALUE: &str = "airTemp";
const TRACK_TEMP_VALUE: &str = "trackTemp";

/// The phrase that says an amount of this kind with its unit.
pub fn unit_key(quantity: Quantity, imperial: bool) -> &'static str {
    match (quantity, imperial) {
        (Quantity::Volume, false) => LITERS_KEY,
        (Quantity::Volume, true) => GALLONS_KEY,
        (Quantity::Temperature, false) => CELSIUS_KEY,
        (Quantity::Temperature, true) => FAHRENHEIT_KEY,
        (Quantity::Speed, false) => KMH_KEY,
        (Quantity::Speed, true) => MPH_KEY,
    }
}

/// Every value said with its unit word, built-in replies' and questions'.
pub fn amount_values() -> Vec<&'static str> {
    let built_in = PHRASE_KEYS.iter().flat_map(|key| {
        key.values
            .iter()
            .filter(|value| value_quantity(key.id, value).is_some())
    });
    let question = QUESTION_FIELDS
        .iter()
        .map(|spec| spec.name)
        .filter(|name| value_quantity(QUESTION_PREFIX, name).is_some());
    let mut names: Vec<&'static str> = built_in.copied().chain(question).collect();

    names.sort_unstable();
    names.dedup();
    names
}

/// What a reply's value measures, when it is an amount said with its unit:
/// a built-in reply's fuel and temperatures, a question's field by its format.
pub fn value_quantity(key: &str, value: &str) -> Option<Quantity> {
    if key.starts_with(QUESTION_PREFIX) {
        return match question_field_named(value)?.say {
            SayFormat::Volume => Some(Quantity::Volume),
            SayFormat::Temperature => Some(Quantity::Temperature),
            SayFormat::Speed => Some(Quantity::Speed),
            _ => None,
        };
    }

    match value {
        FUEL_VALUE => Some(Quantity::Volume),
        AIR_TEMP_VALUE | TRACK_TEMP_VALUE => Some(Quantity::Temperature),
        _ => None,
    }
}

pub const YES_KEY: &str = "engineer.yes";
pub const NO_KEY: &str = "engineer.no";
pub const PLUS_KEY: &str = "engineer.plus";
pub const MINUS_KEY: &str = "engineer.minus";
pub const FASTER_KEY: &str = "engineer.faster";
pub const SLOWER_KEY: &str = "engineer.slower";
/// The number a sign or a delta word puts in words.
pub const SAID_VALUE: &str = "value";
/// The track surface a weather answer says, in the pack's words.
pub const SURFACE_VALUE: &str = "surface";
/// The surface the phrase editor samples a weather answer with.
pub const SURFACE_DRY_KEY: &str = "engineer.surface.dry";

pub fn phrase_key(id: &str) -> Option<&'static PhraseKey> {
    PHRASE_KEYS.iter().find(|key| key.id == id)
}

/// The values a reply is filled with: a built-in key's own, or every field
/// a question of the driver's may name.
pub fn reply_values(key: &str) -> Vec<&'static str> {
    match phrase_key(key) {
        Some(phrase) => phrase.values.to_vec(),
        None if key.starts_with(QUESTION_PREFIX) => {
            QUESTION_FIELDS.iter().map(|spec| spec.name).collect()
        }
        None => Vec::new(),
    }
}

/// A slot's kind decides where its phrases come from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SlotKind {
    /// The language's own number words, built in.
    Number,
    /// Phrases from the pack's `slots`, under these value names only.
    Fixed(&'static [&'static str]),
}

pub const NUMBER_SLOT: &str = "number";
pub const TIRES_SLOT: &str = "tires";
pub const COMPOUND_SLOT: &str = "compound";

pub const TIRE_SETS: &[&str] = TireSet::NAMES;
/// `CompoundKind`'s names.
pub const COMPOUNDS: &[&str] = &["dry", "wet", "soft", "medium", "hard"];

pub fn slot_kind(name: &str) -> Option<SlotKind> {
    match name {
        NUMBER_SLOT => Some(SlotKind::Number),
        TIRES_SLOT => Some(SlotKind::Fixed(TIRE_SETS)),
        COMPOUND_SLOT => Some(SlotKind::Fixed(COMPOUNDS)),
        _ => None,
    }
}

/// An intent, the slots each of its templates must fill, and the phrase keys
/// the engineer answers it with — its own, not the shared ones every command
/// may get (`engineer.notInCar`, `engineer.cannot`, `engineer.noData`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Intent {
    pub id: &'static str,
    pub slots: &'static [&'static str],
    pub replies: &'static [&'static str],
}

const fn intent(
    id: &'static str,
    slots: &'static [&'static str],
    replies: &'static [&'static str],
) -> Intent {
    Intent { id, slots, replies }
}

pub const INTENTS: &[Intent] = &[
    intent(
        "pit.fuel",
        &[NUMBER_SLOT],
        &["engineer.ack.fuel", "engineer.ask.fuel"],
    ),
    intent("pit.fuelToFinish", &[], &["engineer.ack.fuelToFinish"]),
    intent("pit.clearFuel", &[], &["engineer.ack.clearFuel"]),
    intent(
        "pit.tires",
        &[TIRES_SLOT],
        &["engineer.ack.tires", "engineer.ask.tires"],
    ),
    intent("pit.clearTires", &[], &["engineer.ack.clearTires"]),
    intent(
        "pit.compound",
        &[COMPOUND_SLOT],
        &["engineer.ack.compound", "engineer.ask.compound"],
    ),
    intent("pit.fastRepair", &[], &["engineer.ack.fastRepair"]),
    intent(
        "pit.clearFastRepair",
        &[],
        &["engineer.ack.clearFastRepair"],
    ),
    intent("pit.windshield", &[], &["engineer.ack.windshield"]),
    intent(
        "pit.clearWindshield",
        &[],
        &["engineer.ack.clearWindshield"],
    ),
    intent("pit.clearAll", &[], &["engineer.ack.clearAll"]),
    intent("pit.applyPlanned", &[], &["engineer.ack.applyPlanned"]),
    intent("query.fuel", &[], &["engineer.answer.fuel"]),
    intent(
        "query.gapAhead",
        &[],
        &[
            "engineer.answer.gapAhead",
            "engineer.answer.lapsAhead",
            "engineer.answer.noCarAhead",
        ],
    ),
    intent(
        "query.gapBehind",
        &[],
        &[
            "engineer.answer.gapBehind",
            "engineer.answer.lapsBehind",
            "engineer.answer.noCarBehind",
        ],
    ),
    intent(
        "query.whoAhead",
        &[],
        &[
            "engineer.answer.carAheadOnTrack",
            "engineer.answer.carAheadOnTrackClass",
            "engineer.answer.noCarAheadOnTrack",
            "engineer.answer.trackRival",
            "engineer.answer.trackLapped",
            "engineer.answer.trackLapsUp",
        ],
    ),
    intent(
        "query.whoBehind",
        &[],
        &[
            "engineer.answer.carBehindOnTrack",
            "engineer.answer.carBehindOnTrackClass",
            "engineer.answer.noCarBehindOnTrack",
            "engineer.answer.trackRival",
            "engineer.answer.trackLapped",
            "engineer.answer.trackLapsUp",
        ],
    ),
    intent("query.position", &[], &["engineer.answer.position"]),
    intent(
        "query.lapsLeft",
        &[],
        &["engineer.answer.lapsLeft", "engineer.answer.timeLeft"],
    ),
    intent(
        "query.lastLap",
        &[],
        &["engineer.answer.lastLap", "engineer.answer.noLapTime"],
    ),
    intent(
        "query.bestLap",
        &[],
        &["engineer.answer.bestLap", "engineer.answer.noLapTime"],
    ),
    intent(
        "query.pitOrder",
        &[],
        &["engineer.answer.pitOrder", "engineer.answer.pitOrderEmpty"],
    ),
    intent(
        "query.weather",
        &[],
        &["engineer.answer.weather", "engineer.answer.weatherRain"],
    ),
    intent(
        "query.carPosition",
        &[NUMBER_SLOT],
        &[
            "engineer.answer.carPosition",
            "engineer.answer.noSuchCar",
            "engineer.ask.car",
        ],
    ),
    intent(
        "query.carLastLap",
        &[NUMBER_SLOT],
        &[
            "engineer.answer.carLastLap",
            "engineer.answer.carNoLapTime",
            "engineer.answer.noSuchCar",
            "engineer.ask.car",
        ],
    ),
    intent(
        "query.carBestLap",
        &[NUMBER_SLOT],
        &[
            "engineer.answer.carBestLap",
            "engineer.answer.carNoLapTime",
            "engineer.answer.noSuchCar",
            "engineer.ask.car",
        ],
    ),
    intent("control.repeat", &[], &["engineer.nothingToRepeat"]),
];

pub fn intent_named(id: &str) -> Option<&'static Intent> {
    INTENTS.iter().find(|intent| intent.id == id)
}

/// The engineer's question back when an intent comes without its value and
/// the pack says to ask: its reply key under `engineer.ask.*`.
pub fn ask_key(intent: &Intent) -> Option<&'static str> {
    intent
        .replies
        .iter()
        .copied()
        .find(|reply| reply.starts_with("engineer.ask."))
}

/// What an intent takes when its value is not said: `value` read as its
/// slot's, `None` when the slot has no such value or the intent no slot.
pub fn unsaid_value(intent: &Intent, value: &str) -> Option<(&'static str, SlotValue)> {
    let slot = *intent.slots.first()?;

    match slot_kind(slot)? {
        SlotKind::Number => value
            .parse()
            .ok()
            .map(|number| (slot, SlotValue::Number(number))),
        SlotKind::Fixed(allowed) => allowed
            .contains(&value)
            .then(|| (slot, SlotValue::Name(value.to_string()))),
    }
}

/// Pit intents change the car; below the confidence threshold they are not
/// carried out, while a question is still answered.
pub fn changes_the_car(intent: &str) -> bool {
    intent.starts_with("pit.")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_questions_reply_takes_the_question_fields() {
        assert_eq!(reply_values("engineer.ack.fuel"), vec!["fuel"]);
        assert_eq!(
            reply_values("question.weather").len(),
            QUESTION_FIELDS.len()
        );
        assert!(reply_values("engineer.teleport").is_empty());
    }

    #[test]
    fn an_unsaid_value_is_read_as_its_slots() {
        let tires = intent_named("pit.tires").unwrap();
        let fuel = intent_named("pit.fuel").unwrap();

        assert_eq!(
            unsaid_value(tires, "all"),
            Some((TIRES_SLOT, SlotValue::Name("all".into())))
        );
        assert_eq!(unsaid_value(tires, "middle"), None);
        assert_eq!(
            unsaid_value(fuel, "40"),
            Some((NUMBER_SLOT, SlotValue::Number(40)))
        );
        assert_eq!(
            unsaid_value(intent_named("pit.clearAll").unwrap(), "all"),
            None
        );
        assert_eq!(ask_key(tires), Some("engineer.ask.tires"));
    }

    #[test]
    fn every_reply_is_a_phrase_key() {
        for intent in INTENTS {
            for reply in intent.replies {
                assert!(phrase_key(reply).is_some(), "{}: {reply}", intent.id);
            }
        }
    }
}
