//! What a language pack may hold: the phrase keys the crew speaks and the
//! intents a driver can say, both ours — a pack fills them in, it never adds a
//! key the code would not know to use.
//!
//! Keys are namespaced by who speaks (`engineer.*`), so a spotter's phrases can
//! join later as `spotter.*` without touching these.

pub use mt_model::app::crew::ASK_WHEN_UNSAID;
use mt_model::app::crew::{SimValue, QUESTION_PREFIX, QUESTION_VALUES};
use mt_model::pit::pit_action::TireSet;

use crate::pack::message::{values_used, Part};
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
    key("engineer.ack.fuel", &["liters"]),
    key("engineer.ack.fuelToFinish", &["liters"]),
    key("engineer.ack.clearFuel", &[]),
    key("engineer.ack.tires", &["corners"]),
    key("engineer.ack.clearTires", &[]),
    key("engineer.ack.compound", &["compound"]),
    key("engineer.ack.fastRepair", &[]),
    key("engineer.ack.clearFastRepair", &[]),
    key("engineer.ack.windshield", &[]),
    key("engineer.ack.clearWindshield", &[]),
    key("engineer.ack.clearAll", &[]),
    key("engineer.ack.applyPlanned", &["liters"]),
    key("engineer.answer.fuel", &["liters", "laps"]),
    key("engineer.answer.gapAhead", &["gap"]),
    key("engineer.answer.gapBehind", &["gap"]),
    key("engineer.answer.noCarAhead", &[]),
    key("engineer.answer.noCarBehind", &[]),
    key("engineer.answer.position", &["position"]),
    key("engineer.answer.lapsLeft", &["laps"]),
    key("engineer.answer.timeLeft", &["minutes"]),
    key("engineer.answer.lastLap", &["minutes", "seconds"]),
    key("engineer.answer.bestLap", &["minutes", "seconds"]),
    key("engineer.answer.noLapTime", &[]),
    key("engineer.answer.pitOrder", &["liters", "tires"]),
    key("engineer.answer.pitOrderEmpty", &[]),
    key("engineer.answer.weather", &["airTemp", "trackTemp"]),
    key(
        "engineer.answer.weatherRain",
        &["airTemp", "trackTemp", "rain"],
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
];

pub fn phrase_key(id: &str) -> Option<&'static PhraseKey> {
    PHRASE_KEYS.iter().find(|key| key.id == id)
}

/// The values a reply is filled with: a built-in key's own, or every value a
/// question of the driver's may name.
pub fn reply_values(key: &str) -> &'static [&'static str] {
    match phrase_key(key) {
        Some(phrase) => phrase.values,
        None if key.starts_with(QUESTION_PREFIX) => QUESTION_VALUES,
        None => &[],
    }
}

/// A reply's values with the sim's own variables it names: a question's reply
/// may name any (`{sim.Speed.kmh}`), a built-in key's none.
pub fn reply_values_in(key: &str, message: &[Part]) -> Vec<String> {
    let mut values: Vec<String> = reply_values(key)
        .iter()
        .map(|value| value.to_string())
        .collect();

    if key.starts_with(QUESTION_PREFIX) {
        values.extend(sim_values_in(message));
    }

    values
}

/// The sim values a message names, each once.
pub fn sim_values_in(message: &[Part]) -> Vec<String> {
    let mut names: Vec<String> = values_used(message)
        .into_iter()
        .filter(|name| SimValue::parse(name).is_some())
        .collect();

    names.sort();
    names.dedup();
    names
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
        &["engineer.answer.gapAhead", "engineer.answer.noCarAhead"],
    ),
    intent(
        "query.gapBehind",
        &[],
        &["engineer.answer.gapBehind", "engineer.answer.noCarBehind"],
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
    fn a_questions_reply_takes_the_question_values() {
        assert_eq!(reply_values("engineer.ack.fuel"), &["liters"]);
        assert_eq!(reply_values("question.weather"), QUESTION_VALUES);
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
