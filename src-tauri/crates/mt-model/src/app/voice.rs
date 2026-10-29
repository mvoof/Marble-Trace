//! What the Crew tab reads and sends: the downloads, the audio devices, and a
//! language pack laid out for editing.

use serde::{Deserialize, Serialize};

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum VoiceComponentState {
    Installed,
    /// Installed from files this build's catalog no longer pins.
    Outdated,
    Missing,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceComponentView {
    pub id: String,
    /// `ttsEngine`, `sttEngine`, `ttsVoice` or `sttModel`.
    pub kind: String,
    pub language: Option<String>,
    pub title: String,
    pub license: String,
    pub license_url: String,
    pub size_bytes: f64,
    pub recommended: bool,
    /// A recording to listen to before downloading; voices only.
    pub sample_url: Option<String>,
    pub state: VoiceComponentState,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceView {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceStatus {
    pub voice_folder: String,
    pub components: Vec<VoiceComponentView>,
    /// Imported Piper voices, by name; chosen as `custom:<name>`.
    pub custom_voices: Vec<String>,
    pub inputs: Vec<AudioDeviceView>,
    pub outputs: Vec<AudioDeviceView>,
}

/// A download's progress, on `crew://download`.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceDownloadProgress {
    pub component: String,
    pub done_bytes: f64,
    pub total_bytes: f64,
    pub finished: bool,
    pub error: Option<String>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceVariantView {
    pub text: String,
    /// `generated`, `missing` or `dynamic`.
    pub status: String,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoicePhraseView {
    pub key: String,
    /// The values the code fills this phrase with.
    pub values: Vec<String>,
    pub variants: Vec<VoiceVariantView>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceIntentView {
    pub id: String,
    pub slots: Vec<String>,
    pub templates: Vec<String>,
    /// Sentences the templates expand to.
    pub sentences: u32,
    /// The phrase keys the engineer answers it with.
    pub replies: Vec<String>,
    /// For an intent with a value: the value it takes when the driver does
    /// not say one, or `ask` for the engineer to ask.
    pub when_unsaid: Option<String>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSlotValueView {
    pub value: String,
    pub phrases: Vec<String>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSlotView {
    pub slot: String,
    pub values: Vec<VoiceSlotValueView>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceConflictView {
    pub sentence: String,
    pub intents: Vec<String>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceIssueView {
    /// `error` or `warning`.
    pub severity: String,
    pub location: String,
    pub message: String,
}

/// A question of the driver's own. Its sentences are listed with the intents
/// and its answers with the phrases, both as `question.<id>`.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceQuestionView {
    pub id: String,
    pub name: String,
    pub steps: Vec<VoiceStep>,
}

/// Something a question carries out before it is answered: a pit action by
/// its intent (`pit.fuel`) or a chat macro (`chat.macro`), with the value of
/// its one slot — liters, a tire set, a compound, a macro's number. The pack
/// stores it as it is.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceStep {
    pub action: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

/// A language pack as the editor shows it: the built-in one with the user's
/// overrides, every key and intent listed.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoicePackView {
    pub language: String,
    pub folder: String,
    pub phrases: Vec<VoicePhraseView>,
    pub intents: Vec<VoiceIntentView>,
    pub slots: Vec<VoiceSlotView>,
    pub questions: Vec<VoiceQuestionView>,
    /// What a question's answer may name.
    pub question_values: Vec<String>,
    pub sentence_count: u32,
    pub conflicts: Vec<VoiceConflictView>,
    pub issues: Vec<VoiceIssueView>,
}

/// One template of a draft: how many sentences it allows, a few of them, or
/// why it allows none.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceTemplateCheck {
    pub intent: String,
    pub index: u32,
    pub sentences: u32,
    pub examples: Vec<String>,
    pub error: Option<String>,
    /// Words the recognition model lacks: a sentence with one is never heard.
    pub missing_words: Vec<String>,
}

/// One variant of a draft read out with sample values — one sample per
/// plural form the language has — or why it cannot be.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceVariantCheck {
    pub key: String,
    pub index: u32,
    pub samples: Vec<String>,
    /// The ways the variant can be put: its choices and optional parts.
    pub sayings: u32,
    pub error: Option<String>,
}

/// The pack being edited, checked before it is saved.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceDraftCheck {
    pub templates: Vec<VoiceTemplateCheck>,
    pub variants: Vec<VoiceVariantCheck>,
    pub sentence_count: u32,
    pub conflicts: Vec<VoiceConflictView>,
    /// False when no recognition model was there to check the words against.
    pub vocabulary_checked: bool,
}

/// A slot's value in a recognised sentence: a number, or a value name.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSlotHeard {
    pub slot: String,
    pub value: String,
}

/// What a typed sentence is recognised as by the draft.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceRecognisedView {
    pub intent: String,
    pub slots: Vec<VoiceSlotHeard>,
}
