use serde::{Deserialize, Serialize};

/// Who is talking on the radio this tick, if anyone. The sim reports one
/// transmission at a time — the one the player hears.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/radiotransmitcaridx/
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct RadioFrame {
    pub transmission: Option<RadioTransmission>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RadioTransmission {
    pub car_idx: i32,
    /// Matches `RadioFrequencyEntry::radio_num` in the session.
    pub radio_num: i32,
    /// Matches `RadioFrequencyEntry::frequency_num` in the session.
    pub frequency_num: i32,
}

/// Who a frequency reaches. Sim-neutral: the source maps its own channel
/// names onto these.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum RadioChannel {
    /// Everyone in the session.
    All,
    /// The player's own team.
    Team,
    RaceControl,
    Club,
    /// A frequency the player or a league created.
    #[default]
    Other,
}

/// One frequency a radio can be tuned to, from the session.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RadioFrequencyEntry {
    pub radio_num: i32,
    pub frequency_num: i32,
    pub channel: RadioChannel,
    /// The sim's own name for the frequency, as written.
    pub name: String,
}
