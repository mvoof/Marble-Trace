//! A question of the driver's own, as the language pack stores it: which car
//! it asks about, the sentences that ask it, and the answers written with
//! named fields (`{classPosition}`, `{fuelLaps}`).
//!
//! The fields are a fixed catalog, not expressions: each reads one value for
//! the asked car or for the session, and says it in its own format. Adding one
//! is a line in `QUESTION_FIELDS` and an arm in the resolver
//! (`mt-computations::crew`), which reads the telemetry thread's state on the
//! tick that answers.

use serde::{Deserialize, Serialize};

use crate::app::voice::VoiceStep;
use crate::contract::defaults::QUESTION_PREFIX;

/// The car a question asks about. The session's fields are there whatever
/// the target.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CarTarget {
    /// The player's own car; none for a spectator or in a replay.
    Me,
    /// One place ahead of the player in the class.
    Ahead,
    /// One place behind the player in the class.
    Behind,
    /// First overall.
    Leader,
    /// First in the player's class.
    ClassLeader,
    /// The nearest car ahead on track, lapped or not, as Relative shows it.
    AheadOnTrack,
    /// The nearest car behind on track.
    BehindOnTrack,
    /// The car whose number the phrase's `{number}` slot heard.
    ByCarNumber,
    /// The car at the overall place the phrase's `{position}` slot heard.
    ByPosition,
    /// The car at the class place the phrase's `{classPosition}` slot heard.
    ByClassPosition,
}

impl CarTarget {
    pub const ALL: [Self; 10] = [
        Self::Me,
        Self::Ahead,
        Self::Behind,
        Self::Leader,
        Self::ClassLeader,
        Self::AheadOnTrack,
        Self::BehindOnTrack,
        Self::ByCarNumber,
        Self::ByPosition,
        Self::ByClassPosition,
    ];

    /// The slot the target's phrases must carry; it is named as the car
    /// field holding the same value.
    pub const fn phrase_slot(self) -> Option<&'static str> {
        match self {
            Self::ByCarNumber => Some(NUMBER_FIELD),
            Self::ByPosition => Some(POSITION_FIELD),
            Self::ByClassPosition => Some(CLASS_POSITION_FIELD),
            Self::Me
            | Self::Ahead
            | Self::Behind
            | Self::Leader
            | Self::ClassLeader
            | Self::AheadOnTrack
            | Self::BehindOnTrack => None,
        }
    }
}

pub const NUMBER_FIELD: &str = "number";
pub const POSITION_FIELD: &str = "position";
pub const CLASS_POSITION_FIELD: &str = "classPosition";

/// The slots a phrase may carry to pick its car.
pub const PHRASE_SLOTS: [&str; 3] = [NUMBER_FIELD, POSITION_FIELD, CLASS_POSITION_FIELD];

/// The car a question was asked about, with what its phrase heard to name
/// it: a target and its slot's value.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(tag = "target", rename_all = "camelCase")]
pub enum AskedCar {
    Me,
    Ahead,
    Behind,
    Leader,
    ClassLeader,
    AheadOnTrack,
    BehindOnTrack,
    /// The number as said, leading zeros kept: "zero nine" is `09`.
    ByCarNumber {
        number: String,
    },
    ByPosition {
        position: i32,
    },
    ByClassPosition {
        position: i32,
    },
}

impl AskedCar {
    /// A target that needs no slot, as asked; `None` for one that does.
    pub const fn fixed(target: CarTarget) -> Option<Self> {
        Some(match target {
            CarTarget::Me => Self::Me,
            CarTarget::Ahead => Self::Ahead,
            CarTarget::Behind => Self::Behind,
            CarTarget::Leader => Self::Leader,
            CarTarget::ClassLeader => Self::ClassLeader,
            CarTarget::AheadOnTrack => Self::AheadOnTrack,
            CarTarget::BehindOnTrack => Self::BehindOnTrack,
            CarTarget::ByCarNumber | CarTarget::ByPosition | CarTarget::ByClassPosition => {
                return None
            }
        })
    }
}

/// The key a question's answers are spoken under; its "no such car" and
/// "no value" answers add a suffix, which an id cannot hold.
pub fn question_reply_key(id: &str) -> String {
    format!("{QUESTION_PREFIX}{id}")
}

pub fn question_no_car_key(id: &str) -> String {
    format!("{QUESTION_PREFIX}{id}{NO_CAR_SUFFIX}")
}

pub fn question_no_value_key(id: &str) -> String {
    format!("{QUESTION_PREFIX}{id}{NO_VALUE_SUFFIX}")
}

const NO_CAR_SUFFIX: &str = ".noCar";
const NO_VALUE_SUFFIX: &str = ".noValue";

/// Which of a question's answer lists a reply key names.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QuestionReplyKind {
    Reply,
    NoCar,
    NoValue,
}

/// A question's id and answer list from a reply key, `None` for a key that
/// is not a question's.
pub fn question_reply_kind(key: &str) -> Option<(&str, QuestionReplyKind)> {
    let rest = key.strip_prefix(QUESTION_PREFIX)?;

    Some(if let Some(id) = rest.strip_suffix(NO_CAR_SUFFIX) {
        (id, QuestionReplyKind::NoCar)
    } else if let Some(id) = rest.strip_suffix(NO_VALUE_SUFFIX) {
        (id, QuestionReplyKind::NoValue)
    } else {
        (rest, QuestionReplyKind::Reply)
    })
}

/// How a field's value is said.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SayFormat {
    Whole,
    /// "plus 3", "minus 1", in the pack's words.
    SignedWhole,
    Tenths,
    /// "faster by 0.3", "slower by 0.5", in the pack's words.
    DeltaTenths,
    /// Minutes, seconds and tenths, the way an engineer reads a lap.
    LapTime,
    /// Minutes and seconds.
    Duration,
    /// km/h or mph by the unit system.
    Speed,
    /// Litres or gallons by the unit system.
    Volume,
    /// °C or °F by the unit system.
    Temperature,
    /// The pack's `engineer.yes` / `engineer.no`.
    YesNo,
    /// Text as it is.
    Text,
    /// Digit by digit, leading zeros said: a car number, "zero seven".
    Digits,
}

/// A field read for the asked car.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CarField {
    Name,
    Number,
    CarName,
    ClassName,
    Position,
    ClassPosition,
    StartPosition,
    /// The class start place less the class place now.
    PositionsGained,
    /// The class leader's laps less the car's.
    LapsDown,
    LastLap,
    BestLap,
    QualifyTime,
    /// Seconds along the track to the player, as Relative shows it.
    GapToMe,
    /// The car's race time behind the class leader.
    GapToLeader,
    /// The car's last lap less the player's.
    LapDeltaToMe,
    InPit,
    PitStops,
    TireCompound,
    Speed,
    IRating,
    License,
    Incidents,
    IrDelta,
    IsRetired,
}

/// A field read once for the session or the player, whatever the target.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SessionField {
    Fuel,
    FuelLaps,
    FuelToFinish,
    FuelSavePerLap,
    PitWindowOpen,
    PitWindowClose,
    AirTemp,
    TrackTemp,
    Rain,
    TrackName,
    /// Empty in a timed race.
    LapsLeft,
    /// Empty when the session has no time limit.
    MinutesLeft,
    Lap,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(tag = "scope", content = "field", rename_all = "camelCase")]
pub enum QuestionField {
    Car(CarField),
    Session(SessionField),
}

/// A field as an answer names it, and how it is said.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FieldSpec {
    pub name: &'static str,
    pub field: QuestionField,
    pub say: SayFormat,
}

impl FieldSpec {
    pub const fn of_car(&self) -> bool {
        matches!(self.field, QuestionField::Car(_))
    }
}

const fn car(name: &'static str, field: CarField, say: SayFormat) -> FieldSpec {
    FieldSpec {
        name,
        field: QuestionField::Car(field),
        say,
    }
}

const fn session(name: &'static str, field: SessionField, say: SayFormat) -> FieldSpec {
    FieldSpec {
        name,
        field: QuestionField::Session(field),
        say,
    }
}

pub const QUESTION_FIELDS: &[FieldSpec] = &[
    car("name", CarField::Name, SayFormat::Text),
    car(NUMBER_FIELD, CarField::Number, SayFormat::Digits),
    car("carName", CarField::CarName, SayFormat::Text),
    car("className", CarField::ClassName, SayFormat::Text),
    car(POSITION_FIELD, CarField::Position, SayFormat::Whole),
    car(
        CLASS_POSITION_FIELD,
        CarField::ClassPosition,
        SayFormat::Whole,
    ),
    car("startPosition", CarField::StartPosition, SayFormat::Whole),
    car(
        "positionsGained",
        CarField::PositionsGained,
        SayFormat::SignedWhole,
    ),
    car("lapsDown", CarField::LapsDown, SayFormat::Whole),
    car("lastLap", CarField::LastLap, SayFormat::LapTime),
    car("bestLap", CarField::BestLap, SayFormat::LapTime),
    car("qualifyTime", CarField::QualifyTime, SayFormat::LapTime),
    car("gapToMe", CarField::GapToMe, SayFormat::Tenths),
    car("gapToLeader", CarField::GapToLeader, SayFormat::Tenths),
    car(
        "lapDeltaToMe",
        CarField::LapDeltaToMe,
        SayFormat::DeltaTenths,
    ),
    car("inPit", CarField::InPit, SayFormat::YesNo),
    car("pitStops", CarField::PitStops, SayFormat::Whole),
    car("tireCompound", CarField::TireCompound, SayFormat::Text),
    car("speed", CarField::Speed, SayFormat::Speed),
    car("iRating", CarField::IRating, SayFormat::Whole),
    car("license", CarField::License, SayFormat::Text),
    car("incidents", CarField::Incidents, SayFormat::Whole),
    car("irDelta", CarField::IrDelta, SayFormat::SignedWhole),
    car("isRetired", CarField::IsRetired, SayFormat::YesNo),
    session("fuel", SessionField::Fuel, SayFormat::Volume),
    session("fuelLaps", SessionField::FuelLaps, SayFormat::Whole),
    session(
        "fuelToFinish",
        SessionField::FuelToFinish,
        SayFormat::Volume,
    ),
    session(
        "fuelSavePerLap",
        SessionField::FuelSavePerLap,
        SayFormat::Volume,
    ),
    session(
        "pitWindowOpen",
        SessionField::PitWindowOpen,
        SayFormat::Whole,
    ),
    session(
        "pitWindowClose",
        SessionField::PitWindowClose,
        SayFormat::Whole,
    ),
    session("airTemp", SessionField::AirTemp, SayFormat::Temperature),
    session("trackTemp", SessionField::TrackTemp, SayFormat::Temperature),
    session("rain", SessionField::Rain, SayFormat::Whole),
    session("trackName", SessionField::TrackName, SayFormat::Text),
    session("lapsLeft", SessionField::LapsLeft, SayFormat::Whole),
    session(
        "minutesLeft",
        SessionField::MinutesLeft,
        SayFormat::Duration,
    ),
    session("lap", SessionField::Lap, SayFormat::Whole),
];

pub fn question_field_named(name: &str) -> Option<&'static FieldSpec> {
    QUESTION_FIELDS.iter().find(|spec| spec.name == name)
}

pub fn question_field_spec(field: QuestionField) -> Option<&'static FieldSpec> {
    QUESTION_FIELDS.iter().find(|spec| spec.field == field)
}

const fn enabled_by_default() -> bool {
    true
}

/// A question of the driver's own. With `target: None` it asks about no car
/// and its answers name session fields only.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceQuestionDef {
    /// Letters, digits, `-` and `_`.
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default = "enabled_by_default")]
    pub enabled: bool,
    #[serde(default)]
    pub phrases: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<CarTarget>,
    /// Said when every field a reply names has a value.
    #[serde(default)]
    pub replies: Vec<String>,
    /// Said when the target car is not there; required with a target.
    #[serde(default)]
    pub no_car: Vec<String>,
    /// Said when a field the chosen reply names is empty.
    #[serde(default)]
    pub no_value: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub steps: Vec<VoiceStep>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn every_field_name_is_listed_once() {
        let mut names: Vec<&str> = QUESTION_FIELDS.iter().map(|spec| spec.name).collect();
        let count = names.len();

        names.sort_unstable();
        names.dedup();

        assert_eq!(names.len(), count);
    }

    #[test]
    fn a_phrase_slot_is_a_car_field() {
        let slots = CarTarget::ALL
            .into_iter()
            .filter_map(CarTarget::phrase_slot);

        for slot in slots {
            let spec = question_field_named(slot).expect("slot is a field");

            assert!(spec.of_car(), "{slot}");
            assert!(PHRASE_SLOTS.contains(&slot));
        }
    }

    #[test]
    fn a_reply_key_names_its_question_and_answer_list() {
        assert_eq!(
            question_reply_kind(&question_reply_key("gap")),
            Some(("gap", QuestionReplyKind::Reply))
        );
        assert_eq!(
            question_reply_kind(&question_no_car_key("gap")),
            Some(("gap", QuestionReplyKind::NoCar))
        );
        assert_eq!(
            question_reply_kind(&question_no_value_key("gap")),
            Some(("gap", QuestionReplyKind::NoValue))
        );
        assert_eq!(question_reply_kind("engineer.noData"), None);
    }

    #[test]
    fn a_target_with_a_slot_is_asked_by_what_was_heard() {
        assert_eq!(AskedCar::fixed(CarTarget::Leader), Some(AskedCar::Leader));
        assert_eq!(AskedCar::fixed(CarTarget::ByCarNumber), None);
    }

    #[test]
    fn a_car_number_is_said_by_digits() {
        let spec = question_field_named(NUMBER_FIELD).expect("number is a field");

        assert_eq!(spec.say, SayFormat::Digits);
    }

    #[test]
    fn reads_a_question_the_pack_wrote_without_defaults() {
        let def: VoiceQuestionDef = serde_json::from_value(json!({
            "id": "gap",
            "phrases": ["gap to {number}"],
            "target": "byCarNumber",
            "replies": ["{gapToMe}"],
            "noCar": ["no such car"]
        }))
        .expect("parses");

        assert!(def.enabled);
        assert_eq!(def.target, Some(CarTarget::ByCarNumber));
        assert_eq!(def.no_car, vec!["no such car".to_string()]);
        assert!(def.no_value.is_empty());
        assert!(def.steps.is_empty());
    }

    #[test]
    fn a_question_without_a_car_leaves_the_target_out() {
        let def = VoiceQuestionDef {
            id: "fuel".to_string(),
            name: String::new(),
            enabled: true,
            phrases: Vec::new(),
            target: None,
            replies: vec!["{fuelLaps} laps".to_string()],
            no_car: Vec::new(),
            no_value: Vec::new(),
            steps: Vec::new(),
        };
        let written = serde_json::to_value(&def).expect("writes");

        assert!(written.get("target").is_none());
        assert_eq!(
            serde_json::from_value::<VoiceQuestionDef>(written).expect("reads back"),
            def
        );
    }
}
