//! The voice crew's contract: what the driver asked the engineer, what the
//! engineer answers, and what the windows are told about the radio.
//!
//! An intent is resolved on the telemetry thread against the frame it holds,
//! like a pit key; the answer is a phrase key and its values, never text — the
//! language pack turns it into words on the voice side.

use serde::{Deserialize, Serialize};

use crate::app::crew_questions::{AskedCar, QuestionField};
use crate::pit::pit_action::TireSet;

/// A tire compound as the driver names it; matched against the compounds the
/// session lists by their type.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CompoundKind {
    Dry,
    Wet,
    Soft,
    Medium,
    Hard,
}

impl CompoundKind {
    pub const fn name(self) -> &'static str {
        match self {
            Self::Dry => "dry",
            Self::Wet => "wet",
            Self::Soft => "soft",
            Self::Medium => "medium",
            Self::Hard => "hard",
        }
    }

    pub fn named(name: &str) -> Option<Self> {
        [Self::Dry, Self::Wet, Self::Soft, Self::Medium, Self::Hard]
            .into_iter()
            .find(|kind| kind.name() == name)
    }
}

pub use crate::contract::defaults::{
    ASK_WHEN_UNSAID, CHAT_MACRO_ACTION, CHAT_MACRO_COUNT, QUESTION_PREFIX,
};
/// What the driver asked of the engineer that needs the car's data. Controls
/// of the radio itself (repeat, quiet) never leave the voice side.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CrewIntent {
    Fuel {
        liters: u32,
    },
    FuelToFinish,
    ClearFuel,
    Tires {
        corners: TireSet,
    },
    ClearTires,
    Compound {
        compound: CompoundKind,
    },
    FastRepair,
    ClearFastRepair,
    Windshield,
    ClearWindshield,
    ClearAll,
    ApplyPlanned,
    QueryFuel,
    QueryGapAhead,
    QueryGapBehind,
    /// The nearest car ahead on track, lapped or not, as Relative shows it.
    QueryWhoAhead,
    QueryWhoBehind,
    QueryPosition,
    QueryLapsLeft,
    QueryLastLap,
    QueryBestLap,
    QueryPitOrder,
    QueryWeather,
    /// Another car, by the number on it as said: leading zeros kept.
    QueryCarPosition {
        car: String,
    },
    QueryCarLastLap {
        car: String,
    },
    QueryCarBestLap {
        car: String,
    },
    /// One of the sim's chat macros, by its slot; only ever a question's step.
    ChatMacro {
        slot: u32,
    },
    /// A question of the driver's own, by its id in the pack.
    Question {
        id: String,
        /// `None` for a question about no car.
        #[serde(default)]
        asked: Option<AskedCar>,
        /// The fields its answers name, each read once per car answered.
        #[serde(default)]
        fields: Vec<QuestionField>,
        /// Carried out in order before it is answered; the first that fails
        /// stops the rest.
        #[serde(default)]
        steps: Vec<CrewIntent>,
    },
}

impl CrewIntent {
    /// Changes the pit order, so it needs the driver in the car.
    pub fn is_pit_command(&self) -> bool {
        if let Self::Question { steps, .. } = self {
            return steps.iter().any(Self::is_pit_command);
        }

        !matches!(
            self,
            Self::QueryFuel
                | Self::QueryGapAhead
                | Self::QueryGapBehind
                | Self::QueryWhoAhead
                | Self::QueryWhoBehind
                | Self::QueryPosition
                | Self::QueryLapsLeft
                | Self::QueryLastLap
                | Self::QueryBestLap
                | Self::QueryPitOrder
                | Self::QueryWeather
                | Self::QueryCarPosition { .. }
                | Self::QueryCarLastLap { .. }
                | Self::QueryCarBestLap { .. }
                | Self::ChatMacro { .. }
        )
    }
}

/// A value a reply is filled with.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CrewArg {
    Number {
        value: f64,
    },
    /// Said the way the pack says this slot value — a compound in the
    /// driver's own words.
    Slot {
        slot: String,
        value: String,
    },
    /// Words from the sim — a name, a car number — said as they are.
    Text {
        value: String,
    },
    /// Said as the pack's yes or no.
    Flag {
        value: bool,
    },
    /// Said as the pack's phrase under this key — a word the code picks, the
    /// pack words.
    Word {
        key: String,
    },
    /// A measured amount in metric — liters, °C, m/s — said in the driver's
    /// units with the pack's word for them.
    Measure {
        quantity: Quantity,
        value: f64,
    },
}

/// What a measured amount is, so it is said in the driver's units.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Quantity {
    /// Liters or gallons.
    Volume,
    /// °C or °F.
    Temperature,
    /// km/h or mph, from m/s.
    Speed,
}

pub const GALLONS_PER_LITER: f64 = 0.264_172;
const KMH_PER_MS: f64 = 3.6;
const MPH_PER_MS: f64 = 2.236_936;
const FAHRENHEIT_PER_CELSIUS: f64 = 9.0 / 5.0;
const FAHRENHEIT_AT_ZERO_CELSIUS: f64 = 32.0;
/// A volume from here up is told in whole units.
const WHOLE_VOLUME_FROM: f64 = 10.0;
pub const TENTHS: f64 = 10.0;
pub const THOUSANDTHS: f64 = 1000.0;
const SECONDS_PER_MINUTE: f64 = 60.0;

/// What the unit system changes about a value told.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Units {
    pub imperial: bool,
}

/// A metric amount converted to the driver's units and rounded as it is told:
/// a volume under ten to a tenth — fuel saved per lap is fractions.
pub fn in_units(units: Units, quantity: Quantity, metric: f64) -> f64 {
    match quantity {
        Quantity::Speed => {
            let scale = if units.imperial {
                MPH_PER_MS
            } else {
                KMH_PER_MS
            };

            (metric * scale).round()
        }
        Quantity::Volume => {
            let volume = if units.imperial {
                metric * GALLONS_PER_LITER
            } else {
                metric
            };

            if volume.abs() < WHOLE_VOLUME_FROM {
                (volume * TENTHS).round() / TENTHS
            } else {
                volume.round()
            }
        }
        Quantity::Temperature => {
            let degrees = if units.imperial {
                metric * FAHRENHEIT_PER_CELSIUS + FAHRENHEIT_AT_ZERO_CELSIUS
            } else {
                metric
            };

            degrees.round()
        }
    }
}

/// A time split into minutes and seconds at a given precision, in steps per
/// second. Rounded before it is split: 59.9996 at thousandths is one minute
/// flat, never 60 seconds.
pub fn minutes_and_seconds(seconds: f64, steps_per_second: f64) -> (f64, f64) {
    let steps = (seconds * steps_per_second).round();
    let steps_per_minute = SECONDS_PER_MINUTE * steps_per_second;
    let minutes = (steps / steps_per_minute).floor();

    (
        minutes,
        (steps - minutes * steps_per_minute) / steps_per_second,
    )
}

/// The engineer's answer: a phrase key from the language pack and its values.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrewReply {
    pub key: String,
    pub args: Vec<(String, CrewArg)>,
    /// For a pit command: whether the order went out.
    pub command_ok: Option<bool>,
}

impl CrewReply {
    pub fn plain(key: &str) -> Self {
        Self {
            key: key.to_string(),
            args: Vec::new(),
            command_ok: None,
        }
    }

    pub fn number(mut self, name: &str, value: f64) -> Self {
        self.args
            .push((name.to_string(), CrewArg::Number { value }));
        self
    }

    pub fn measure(mut self, name: &str, quantity: Quantity, value: f64) -> Self {
        self.args
            .push((name.to_string(), CrewArg::Measure { quantity, value }));
        self
    }

    pub fn slot(mut self, name: &str, slot: &str, value: &str) -> Self {
        self.args.push((
            name.to_string(),
            CrewArg::Slot {
                slot: slot.to_string(),
                value: value.to_string(),
            },
        ));
        self
    }

    pub fn word(mut self, name: &str, key: &str) -> Self {
        self.args.push((
            name.to_string(),
            CrewArg::Word {
                key: key.to_string(),
            },
        ));
        self
    }

    pub fn arg(mut self, name: &str, value: CrewArg) -> Self {
        self.args.push((name.to_string(), value));
        self
    }

    pub fn command(mut self, ok: bool) -> Self {
        self.command_ok = Some(ok);
        self
    }
}

/// Where the telemetry thread hands what the crew needs from it. Implemented by
/// the app over the voice runtime; the telemetry crate knows only this.
pub trait CrewSink: Send + Sync {
    fn reply(&self, reply: CrewReply);
    /// The numbers the session's cars wear, sent when they change: the only
    /// car numbers the crew then hears. Empty with no session.
    fn cars(&self, numbers: Vec<String>);
}

/// The crew's settings as the main window pushes them. The voice folder is
/// the app's own; an empty `voice` means the language's recommended one.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceCrewSettings {
    pub enabled: bool,
    /// `ru` or `en`.
    pub language: String,
    pub voice: String,
    pub input_device: Option<String>,
    pub output_device: Option<String>,
    /// 0–1.
    pub volume: f32,
    /// Speech rate, 1 = the voice's own; above is faster.
    pub speed: f32,
    /// Below it a pit command is not carried out, 0–1.
    pub confidence_threshold: f32,
    /// Where the downloads, packs and cache live; empty is the app's own.
    #[serde(default)]
    pub folder: String,
    /// Answers say miles, gallons and Fahrenheit, as the overlay's units do.
    #[serde(default)]
    pub imperial: bool,
}

/// What the windows are told about the crew's radio — rare events, a few per
/// press, never part of the telemetry bundle.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CrewRadioEvent {
    /// Push-to-talk went down (`true`) or the sentence was taken (`false`).
    Listening { on: bool },
    /// What the driver said, and whether it was a command the crew knows.
    Heard { text: String, understood: bool },
    /// A reply went on air.
    Speaking { text: String },
    /// The reply on air ended or was cut.
    Finished,
    /// A pit command's result, for the ✓ / ✗ beside the reply.
    Command { ok: bool, text: String },
    /// The voice could not do what it was asked — nothing installed, no device.
    Failed { message: String },
    /// A test press in the Crew tab: what was heard and the commands it holds,
    /// carried out never.
    Tested {
        text: String,
        /// Empty when it holds none.
        intents: Vec<String>,
        confidence: f32,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_time_rounding_up_to_the_minute_carries_into_it() {
        assert_eq!(minutes_and_seconds(59.9996, THOUSANDTHS), (1.0, 0.0));
        assert_eq!(minutes_and_seconds(119.9996, THOUSANDTHS), (2.0, 0.0));
        assert_eq!(minutes_and_seconds(59.96, TENTHS), (1.0, 0.0));
    }

    #[test]
    fn a_time_keeps_its_precision_exact() {
        assert_eq!(minutes_and_seconds(92.456, THOUSANDTHS), (1.0, 32.456));
        assert_eq!(minutes_and_seconds(92.34, TENTHS), (1.0, 32.3));
        assert_eq!(minutes_and_seconds(59.94, TENTHS), (0.0, 59.9));
    }
}
