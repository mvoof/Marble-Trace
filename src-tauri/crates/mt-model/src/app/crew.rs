//! The voice crew's contract: what the driver asked the engineer, what the
//! engineer answers, and what the windows are told about the radio.
//!
//! An intent is resolved on the telemetry thread against the frame it holds,
//! like a pit key; the answer is a phrase key and its values, never text — the
//! language pack turns it into words on the voice side.

use serde::{Deserialize, Serialize};

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
pub use crate::contract::defaults::{
    SIM_SCALE_KMH, SIM_SCALE_PERCENT, SIM_SCALE_TENTHS, SIM_VALUE_PREFIX,
};

const KMH_PER_MS: f64 = 3.6;
const PERCENT: f64 = 100.0;
const TENTHS: f64 = 10.0;

/// What a question of the driver's own may be answered with — the reply names
/// them, the engineer fills those the sim has.
pub const QUESTION_VALUES: &[&str] = &[
    "airTemp",
    "trackTemp",
    "rain",
    "wetness",
    "wind",
    "fuel",
    "fuelLaps",
    "position",
    "gapAhead",
    "gapBehind",
    "lap",
    "lapsLeft",
    "minutesLeft",
];

/// How a sim value is read out.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimScale {
    Whole,
    Tenths,
    /// Metres per second, said in km/h.
    KmPerHour,
    /// A share of one, said as a percentage.
    Percent,
}

/// A reply value that is one of the sim's own variables:
/// `sim.<Variable>[.tenths|.kmh|.percent]`. Any variable the sim declares
/// may be named; one it does not have now leaves the reply without it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SimValue {
    pub variable: String,
    pub scale: SimScale,
}

impl SimValue {
    pub fn parse(name: &str) -> Option<Self> {
        let rest = name.strip_prefix(SIM_VALUE_PREFIX)?;
        let (variable, scale) = match rest.split_once('.') {
            None => (rest, SimScale::Whole),
            Some((variable, SIM_SCALE_TENTHS)) => (variable, SimScale::Tenths),
            Some((variable, SIM_SCALE_KMH)) => (variable, SimScale::KmPerHour),
            Some((variable, SIM_SCALE_PERCENT)) => (variable, SimScale::Percent),
            Some(_) => return None,
        };
        let valid = !variable.is_empty()
            && variable
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '_');

        valid.then(|| Self {
            variable: variable.to_string(),
            scale,
        })
    }

    /// The number said for the sim's raw value.
    pub fn read(&self, raw: f64) -> f64 {
        match self.scale {
            SimScale::Whole => raw.round(),
            SimScale::Tenths => (raw * TENTHS).round() / TENTHS,
            SimScale::KmPerHour => (raw * KMH_PER_MS).round(),
            SimScale::Percent => (raw * PERCENT).round(),
        }
    }
}

/// A sim value a question's reply names, read on the telemetry thread on the
/// tick that answers it. `None` until then, or when the sim lacks it.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SimRead {
    pub name: String,
    #[serde(default)]
    pub value: Option<f64>,
}

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
    QueryPosition,
    QueryLapsLeft,
    QueryLastLap,
    QueryBestLap,
    QueryPitOrder,
    QueryWeather,
    /// Another car, by the number on it.
    QueryCarPosition {
        car: u32,
    },
    QueryCarLastLap {
        car: u32,
    },
    QueryCarBestLap {
        car: u32,
    },
    /// One of the sim's chat macros, by its slot; only ever a question's step.
    ChatMacro {
        slot: u32,
    },
    /// A question of the driver's own, by its id in the pack.
    Question {
        id: String,
        /// The sim values its replies name.
        #[serde(default)]
        sim: Vec<SimRead>,
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

    pub fn command(mut self, ok: bool) -> Self {
        self.command_ok = Some(ok);
        self
    }
}

/// Where the telemetry thread hands what the crew needs from it. Implemented by
/// the app over the voice runtime; the telemetry crate knows only this.
pub trait CrewSink: Send + Sync {
    fn reply(&self, reply: CrewReply);
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
    fn reads_a_sim_value_by_its_name_and_scale() {
        let incidents = SimValue::parse("sim.PlayerCarMyIncidentCount").unwrap();
        let speed = SimValue::parse("sim.Speed.kmh").unwrap();

        assert_eq!(incidents.variable, "PlayerCarMyIncidentCount");
        assert_eq!(incidents.read(4.4), 4.0);
        assert_eq!(speed.read(50.0), 180.0);
        assert_eq!(
            SimValue::parse("sim.FuelLevelPct.percent")
                .unwrap()
                .read(0.456),
            46.0
        );
        assert_eq!(
            SimValue::parse("sim.LapDeltaToBestLap.tenths")
                .unwrap()
                .read(-0.46),
            -0.5
        );
        assert_eq!(SimValue::parse("fuel"), None);
        assert_eq!(SimValue::parse("sim."), None);
        assert_eq!(SimValue::parse("sim.Speed.mph"), None);
        assert_eq!(SimValue::parse("sim.Spe ed"), None);
    }
}
