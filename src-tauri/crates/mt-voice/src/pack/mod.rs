//! A language pack: what the crew says (`phrases.json`) and what the driver
//! can say (`commands.json`).
//!
//! The built-in packs ship inside the app; a user pack in
//! `voice/packs/<lang>/` overrides them key by key, intent by intent and slot
//! by slot, so a pack that changes one phrase holds that phrase alone. A pack
//! is checked as a whole and still loads with mistakes in it — what is wrong is
//! left out and listed, the built-in text stands in for it.

pub mod catalog;
pub mod editor;
pub mod grammar;
pub mod message;
pub mod numbers;
pub mod sayings;
pub mod template;

use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};

use mt_model::app::crew::{
    SimValue, CHAT_MACRO_ACTION, CHAT_MACRO_COUNT, QUESTION_PREFIX, QUESTION_VALUES,
    SIM_VALUE_PREFIX,
};
use mt_model::app::voice::VoiceStep;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::pack::catalog::{
    intent_named, phrase_key, slot_kind, SlotKind, ASK_WHEN_UNSAID, INTENTS, NUMBER_SLOT,
    PHRASE_KEYS,
};
use crate::pack::grammar::{compile, CommandGrammar, Recognised};
use crate::pack::message::{format, parse as parse_message, values_used, Args, Part};
use crate::pack::sayings::sayings;
use crate::pack::template::{expand, parse as parse_template, SlotValue};

/// The format a pack is written in. Format 2 added the driver's own actions
/// (`commands.json` → `custom`), format 3 what an intent takes when its value
/// is not said (`commands.json` → `defaults`); older files read as they are.
pub const PACK_FORMAT: u32 = 3;
const OLDEST_FORMAT: u32 = 1;
pub const PHRASES_FILE: &str = "phrases.json";
pub const COMMANDS_FILE: &str = "commands.json";
pub const BUILT_IN_LANGUAGES: &[&str] = &["ru", "en", "es", "zh"];

const BUILT_IN_RU_PHRASES: &str = include_str!("../../packs/ru/phrases.json");
const BUILT_IN_RU_COMMANDS: &str = include_str!("../../packs/ru/commands.json");
const BUILT_IN_EN_PHRASES: &str = include_str!("../../packs/en/phrases.json");
const BUILT_IN_EN_COMMANDS: &str = include_str!("../../packs/en/commands.json");
const BUILT_IN_ES_PHRASES: &str = include_str!("../../packs/es/phrases.json");
const BUILT_IN_ES_COMMANDS: &str = include_str!("../../packs/es/commands.json");
const BUILT_IN_ZH_PHRASES: &str = include_str!("../../packs/zh/phrases.json");
const BUILT_IN_ZH_COMMANDS: &str = include_str!("../../packs/zh/commands.json");

/// One way to say a phrase, always synthesised. A recording or a file named
/// by an older pack (`source`, `audio`) is read past and never played.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Variant {
    pub text: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PhrasesFile {
    pub format: u32,
    #[serde(default)]
    pub language: String,
    #[serde(default)]
    pub phrases: BTreeMap<String, Vec<Variant>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct CommandsFile {
    pub format: u32,
    #[serde(default)]
    pub intents: BTreeMap<String, Vec<String>>,
    /// Slot → value name → the ways to say it.
    #[serde(default)]
    pub slots: BTreeMap<String, BTreeMap<String, Vec<String>>>,
    #[serde(default, skip_serializing_if = "CustomActions::is_empty")]
    pub custom: CustomActions,
    /// Intent → its slot's value when the driver does not say one, or
    /// `ask` for the engineer to ask; an intent left out asks.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub defaults: BTreeMap<String, String>,
}

/// Actions the driver made up, rather than ones the code ships.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct CustomActions {
    #[serde(default)]
    pub questions: Vec<Question>,
}

impl CustomActions {
    pub fn is_empty(&self) -> bool {
        self.questions.is_empty()
    }
}

/// A question of the driver's own: the sentences that ask it, what it
/// carries out — pit actions, chat macros — and the engineer's answers,
/// filled with `QUESTION_VALUES`. One with steps is a routine.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    /// Letters, digits, `-` and `_`; the intent and reply key are
    /// `question.<id>`.
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub phrases: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub steps: Vec<VoiceStep>,
    #[serde(default)]
    pub replies: Vec<Variant>,
}

impl Question {
    pub fn key(&self) -> String {
        format!("{QUESTION_PREFIX}{}", self.id)
    }
}

/// Where a question's phrase or reply is in `commands.json`.
pub fn question_location(question: usize, part: &str, index: usize) -> String {
    format!("commands.custom.questions[{question}].{part}[{index}]")
}

/// A question's step as the command it stands for: a pit intent with its slot
/// filled, or a chat macro by its number.
pub fn step_command(step: &VoiceStep) -> Result<Recognised, String> {
    let value = step.value.as_deref().map(str::trim).unwrap_or_default();
    let slot = if step.action == CHAT_MACRO_ACTION {
        Some(NUMBER_SLOT)
    } else {
        match intent_named(&step.action) {
            Some(intent) if intent.id.starts_with("pit.") => intent.slots.first().copied(),
            _ => return Err(format!("no action \"{}\"", step.action)),
        }
    };
    let slots = match slot.map(|slot| (slot, slot_kind(slot))) {
        None => Vec::new(),
        Some((slot, Some(SlotKind::Number))) => {
            let number: u32 = value
                .parse()
                .map_err(|_| format!("{} needs a number, not \"{value}\"", step.action))?;

            if step.action == CHAT_MACRO_ACTION && !(1..=CHAT_MACRO_COUNT).contains(&number) {
                return Err(format!(
                    "a chat macro is 1 to {CHAT_MACRO_COUNT}, not {number}"
                ));
            }

            vec![(slot.to_string(), SlotValue::Number(number))]
        }
        Some((slot, Some(SlotKind::Fixed(values)))) => {
            if !values.contains(&value) {
                return Err(format!(
                    "{} takes {}, not \"{value}\"",
                    step.action,
                    values.join(", ")
                ));
            }

            vec![(slot.to_string(), SlotValue::Name(value.to_string()))]
        }
        Some((slot, None)) => return Err(format!("unknown slot {{{slot}}}")),
    };

    Ok(Recognised {
        intent: step.action.clone(),
        slots,
    })
}

fn valid_question_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|letter| letter.is_ascii_alphanumeric() || letter == '-' || letter == '_')
}

/// The questions whose ids are well-formed and not taken by an earlier one,
/// with their place in the file; the rest are reported.
pub fn usable_questions<'a>(
    questions: &'a [Question],
    issues: &mut Vec<PackIssue>,
) -> Vec<(usize, &'a Question)> {
    let mut seen: Vec<&str> = Vec::new();
    let mut usable = Vec::new();

    for (index, question) in questions.iter().enumerate() {
        let location = format!("commands.custom.questions[{index}]");

        if !valid_question_id(&question.id) {
            issues.push(PackIssue::error(
                location,
                format!("id \"{}\" — letters, digits, - and _ only", question.id),
            ));
        } else if seen.contains(&question.id.as_str()) {
            issues.push(PackIssue::error(
                location,
                format!("id \"{}\" is taken", question.id),
            ));
        } else {
            seen.push(&question.id);
            usable.push((index, question));
        }
    }

    usable
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    /// Left out of the pack.
    Error,
    /// Loaded, but worth a look.
    Warning,
}

/// A mistake in a pack, where the editor can point at it.
#[derive(Debug, Clone, PartialEq)]
pub struct PackIssue {
    pub severity: Severity,
    /// `phrases.<key>[<variant>]`, `commands.intents.<intent>[<template>]`, …
    pub location: String,
    pub message: String,
}

impl PackIssue {
    pub fn error(location: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            severity: Severity::Error,
            location: location.into(),
            message: message.into(),
        }
    }

    pub fn warning(location: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            severity: Severity::Warning,
            location: location.into(),
            message: message.into(),
        }
    }
}

/// A variant ready to be spoken, in each of the ways it can be put.
#[derive(Debug, Clone, PartialEq)]
pub struct CompiledVariant {
    pub variant: Variant,
    /// Never empty: text without choices is its one saying.
    pub sayings: Vec<Saying>,
    /// Has values to fill in, so it is synthesised when spoken rather than
    /// played from the cache.
    pub dynamic: bool,
}

/// One way a variant is put: its text with the choices made, parsed.
#[derive(Debug, Clone, PartialEq)]
pub struct Saying {
    pub text: String,
    pub message: Vec<Part>,
}

impl CompiledVariant {
    /// Every part the variant's sayings hold, for what they name.
    pub fn messages(&self) -> impl Iterator<Item = &[Part]> {
        self.sayings.iter().map(|saying| saying.message.as_slice())
    }

    /// One of its sayings, at random.
    pub fn any_saying(&self) -> &Saying {
        &self.sayings[fastrand::usize(..self.sayings.len())]
    }
}

#[derive(Debug, Clone)]
pub struct LanguagePack {
    pub language: String,
    /// The user's pack folder, `None` when only the built-in pack is loaded.
    pub folder: Option<PathBuf>,
    pub phrases: HashMap<String, Vec<CompiledVariant>>,
    pub grammar: CommandGrammar,
    /// How the pack says each slot value — its first phrase — for a reply
    /// that names one ("copy, wets").
    pub slot_words: HashMap<(String, String), String>,
    pub issues: Vec<PackIssue>,
    /// The files as merged — built-in, then the user's — for the editor.
    pub phrases_file: PhrasesFile,
    pub commands_file: CommandsFile,
}

impl LanguagePack {
    /// The variants of a key, empty for a key the pack does not say.
    pub fn variants(&self, key: &str) -> &[CompiledVariant] {
        self.phrases.get(key).map_or(&[], Vec::as_slice)
    }

    pub fn slot_word(&self, slot: &str, value: &str) -> Option<&str> {
        self.slot_words
            .get(&(slot.to_string(), value.to_string()))
            .map(String::as_str)
    }

    pub fn text(&self, saying: &Saying, args: &Args<'_>) -> Option<String> {
        format(&saying.message, &self.language, args).ok()
    }
}

/// Loads a language: the built-in pack, overridden by the user's in `folder`
/// when it holds one. Reading it again is how a pack is reloaded.
pub fn load(language: &str, folder: Option<&Path>) -> LanguagePack {
    let mut issues = Vec::new();
    let (mut phrases, mut commands) = built_in(language).unwrap_or_else(|| {
        (
            PhrasesFile {
                format: PACK_FORMAT,
                language: language.to_string(),
                phrases: BTreeMap::new(),
            },
            CommandsFile {
                format: PACK_FORMAT,
                ..CommandsFile::default()
            },
        )
    });
    let user_folder = folder.filter(|folder| folder.is_dir());

    if let Some(folder) = user_folder {
        if let Some(user) = read_pack_file::<PhrasesFile>(&folder.join(PHRASES_FILE), &mut issues) {
            phrases.phrases.extend(user.phrases);
        }

        if let Some(user) = read_pack_file::<CommandsFile>(&folder.join(COMMANDS_FILE), &mut issues)
        {
            commands.intents.extend(user.intents);
            commands.slots.extend(user.slots);
            commands.defaults.extend(user.defaults);
            commands.custom = user.custom;
        }
    }

    let mut compiled = compile_phrases(&phrases, &mut issues);

    compile_question_replies(&commands, &mut compiled, &mut issues);

    let (grammar, grammar_issues) = compile(language, &commands);

    issues.extend(grammar_issues);

    LanguagePack {
        language: language.to_string(),
        folder: user_folder.map(Path::to_path_buf),
        phrases: compiled,
        grammar,
        slot_words: slot_words(&commands),
        issues,
        phrases_file: phrases,
        commands_file: commands,
    }
}

fn slot_words(commands: &CommandsFile) -> HashMap<(String, String), String> {
    let mut words = HashMap::new();

    for (slot, values) in &commands.slots {
        for (value, templates) in values {
            let first = templates
                .first()
                .and_then(|template| parse_template(template).ok())
                .and_then(|nodes| expand(&nodes, &|_| None).ok())
                .and_then(|sentences| sentences.into_iter().next());

            if let Some(sentence) = first {
                words.insert((slot.clone(), value.clone()), sentence.text());
            }
        }
    }

    words
}

pub(crate) fn built_in(language: &str) -> Option<(PhrasesFile, CommandsFile)> {
    let (phrases, commands) = match language {
        "ru" => (BUILT_IN_RU_PHRASES, BUILT_IN_RU_COMMANDS),
        "en" => (BUILT_IN_EN_PHRASES, BUILT_IN_EN_COMMANDS),
        "es" => (BUILT_IN_ES_PHRASES, BUILT_IN_ES_COMMANDS),
        "zh" => (BUILT_IN_ZH_PHRASES, BUILT_IN_ZH_COMMANDS),
        _ => return None,
    };

    // The built-in packs are pinned by the tests below, so a parse failure here
    // means a broken build — logged, and the language comes up empty.
    match (
        serde_json::from_str(phrases),
        serde_json::from_str(commands),
    ) {
        (Ok(phrases), Ok(commands)) => Some((phrases, commands)),
        (phrases, commands) => {
            tracing::error!(
                language,
                phrases_ok = phrases.is_ok(),
                commands_ok = commands.is_ok(),
                "built-in voice pack does not parse"
            );
            None
        }
    }
}

/// A user file that is absent is no mistake; one that does not parse is
/// reported and ignored, leaving the built-in pack in its place.
fn read_pack_file<T>(path: &Path, issues: &mut Vec<PackIssue>) -> Option<T>
where
    T: for<'de> Deserialize<'de> + PackFormat,
{
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return None,
        Err(error) => {
            issues.push(PackIssue::error(name, error.to_string()));
            return None;
        }
    };
    let file: T = match serde_json::from_str(&text) {
        Ok(file) => file,
        Err(error) => {
            issues.push(PackIssue::error(name, error.to_string()));
            return None;
        }
    };

    if !(OLDEST_FORMAT..=PACK_FORMAT).contains(&file.format()) {
        issues.push(PackIssue::error(
            name,
            format!(
                "format {} — this build reads {OLDEST_FORMAT} to {PACK_FORMAT}",
                file.format()
            ),
        ));
        return None;
    }

    Some(file)
}

trait PackFormat {
    fn format(&self) -> u32;
}

impl PackFormat for PhrasesFile {
    fn format(&self) -> u32 {
        self.format
    }
}

impl PackFormat for CommandsFile {
    fn format(&self) -> u32 {
        self.format
    }
}

fn compile_phrases(
    file: &PhrasesFile,
    issues: &mut Vec<PackIssue>,
) -> HashMap<String, Vec<CompiledVariant>> {
    let mut compiled = HashMap::new();

    for (key_id, variants) in &file.phrases {
        let Some(key) = phrase_key(key_id) else {
            issues.push(PackIssue::error(format!("phrases.{key_id}"), "unknown key"));
            continue;
        };
        let mut good = Vec::new();

        for (index, variant) in variants.iter().enumerate() {
            match compile_variant(key.values, false, variant) {
                Ok(variant) => good.push(variant),
                Err(message) => {
                    issues.push(PackIssue::error(
                        format!("phrases.{key_id}[{index}]"),
                        message,
                    ));
                }
            }
        }

        compiled.insert(key_id.clone(), good);
    }

    compiled
}

/// The answers to the driver's questions, under their reply keys beside the
/// built-in phrases.
fn compile_question_replies(
    commands: &CommandsFile,
    compiled: &mut HashMap<String, Vec<CompiledVariant>>,
    issues: &mut Vec<PackIssue>,
) {
    // A bad id is reported once, by the grammar.
    let mut id_issues = Vec::new();

    for (question_index, question) in usable_questions(&commands.custom.questions, &mut id_issues) {
        let mut good = Vec::new();

        for (index, variant) in question.replies.iter().enumerate() {
            match compile_variant(QUESTION_VALUES, true, variant) {
                Ok(variant) => good.push(variant),
                Err(message) => issues.push(PackIssue::error(
                    question_location(question_index, "replies", index),
                    message,
                )),
            }
        }

        compiled.insert(question.key(), good);

        for (index, step) in question.steps.iter().enumerate() {
            if let Err(message) = step_command(step) {
                issues.push(PackIssue::error(
                    question_location(question_index, "steps", index),
                    message,
                ));
            }
        }
    }
}

/// `sim_values`: a question's reply, which may also name any of the sim's own
/// variables.
fn compile_variant(
    values: &[&str],
    sim_values: bool,
    variant: &Variant,
) -> Result<CompiledVariant, String> {
    let texts = sayings(&variant.text).map_err(|error| error.to_string())?;
    let mut compiled = Vec::with_capacity(texts.len());

    for text in texts {
        let message = parse_message(&text).map_err(|error| error.to_string())?;

        compiled.push(Saying { text, message });
    }

    let used: Vec<String> = compiled
        .iter()
        .flat_map(|saying| values_used(&saying.message))
        .collect();
    let known =
        |name: &str| values.contains(&name) || (sim_values && SimValue::parse(name).is_some());

    if let Some(unknown) = used.iter().find(|name| !known(name)) {
        let mut offered = if values.is_empty() {
            "none".to_string()
        } else {
            values.join(", ")
        };

        if sim_values {
            offered.push_str(&format!(", {SIM_VALUE_PREFIX}<iRacing variable>"));
        }

        return Err(format!(
            "no value {{{unknown}}} here — this phrase has {offered}"
        ));
    }

    Ok(CompiledVariant {
        variant: variant.clone(),
        sayings: compiled,
        dynamic: !used.is_empty(),
    })
}

/// Picks a variant at random, never the one a key said last time while it has
/// another.
#[derive(Debug, Default)]
pub struct VariantPicker {
    last: HashMap<String, usize>,
    rng: fastrand::Rng,
}

impl VariantPicker {
    pub fn with_seed(seed: u64) -> Self {
        Self {
            last: HashMap::new(),
            rng: fastrand::Rng::with_seed(seed),
        }
    }

    /// A variant, then one of the ways it is put: a variant with many sayings
    /// is picked no more often than one with a single saying.
    pub fn pick<'a>(&mut self, pack: &'a LanguagePack, key: &str) -> Option<&'a Saying> {
        let variants = pack.variants(key);

        if variants.is_empty() {
            return None;
        }

        let previous = self.last.get(key).copied().filter(|_| variants.len() > 1);
        let choice = match previous {
            Some(previous) => {
                let offset = self.rng.usize(1..variants.len());

                (previous + offset) % variants.len()
            }
            None => self.rng.usize(..variants.len()),
        };

        self.last.insert(key.to_string(), choice);

        let sayings = &variants.get(choice)?.sayings;

        sayings.get(self.rng.usize(..sayings.len()))
    }
}

/// The JSON Schema of `phrases.json`, the keys and their values spelled out,
/// for an editor to complete against. Written next to a user pack.
pub fn phrases_schema() -> Value {
    let keys: serde_json::Map<String, Value> = PHRASE_KEYS
        .iter()
        .map(|key| {
            let description = if key.values.is_empty() {
                "No values.".to_string()
            } else {
                format!(
                    "Values: {}",
                    key.values
                        .iter()
                        .map(|value| format!("{{{value}}}"))
                        .collect::<Vec<_>>()
                        .join(", ")
                )
            };

            (
                key.id.to_string(),
                json!({ "description": description, "$ref": "#/$defs/variants" }),
            )
        })
        .collect();

    json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Marble Trace voice phrases",
        "type": "object",
        "required": ["format", "phrases"],
        "properties": {
            "format": { "enum": (OLDEST_FORMAT..=PACK_FORMAT).collect::<Vec<_>>() },
            "language": { "type": "string" },
            "phrases": { "type": "object", "properties": keys, "additionalProperties": false }
        },
        "$defs": { "variants": variants_schema() }
    })
}

fn variants_schema() -> Value {
    json!({
        "type": "array",
        "items": {
            "type": "object",
            "required": ["text"],
            "properties": {
                "text": { "type": "string" }
            },
            "additionalProperties": false
        }
    })
}

/// The JSON Schema of `commands.json`.
pub fn commands_schema() -> Value {
    let intents: serde_json::Map<String, Value> = INTENTS
        .iter()
        .map(|intent| {
            let description = if intent.slots.is_empty() {
                "No slots.".to_string()
            } else {
                format!("Slots: {}", intent.slots.iter().map(|slot| format!("{{{slot}}}")).collect::<Vec<_>>().join(", "))
            };

            (
                intent.id.to_string(),
                json!({ "description": description, "type": "array", "items": { "type": "string" } }),
            )
        })
        .collect();
    let phrase_lists = json!({ "type": "array", "items": { "type": "string" } });
    let slots: serde_json::Map<String, Value> = ["tires", "compound"]
        .iter()
        .map(|slot| {
            let values = match slot_kind(slot) {
                Some(SlotKind::Fixed(values)) => json!({
                    "type": "object",
                    "properties": values.iter().map(|value| (value.to_string(), phrase_lists.clone())).collect::<serde_json::Map<_, _>>(),
                    "additionalProperties": false
                }),
                _ => json!({ "type": "object", "additionalProperties": phrase_lists.clone() }),
            };

            (slot.to_string(), values)
        })
        .collect();

    let step_actions: Vec<&str> = INTENTS
        .iter()
        .map(|intent| intent.id)
        .filter(|id| id.starts_with("pit."))
        .chain([CHAT_MACRO_ACTION])
        .collect();
    let question = json!({
        "type": "object",
        "required": ["id"],
        "properties": {
            "id": { "type": "string", "pattern": "^[A-Za-z0-9_-]+$" },
            "name": { "type": "string" },
            "phrases": phrase_lists.clone(),
            "steps": {
                "description": "Carried out in order before the answer; the first that fails stops the rest.",
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["action"],
                    "properties": {
                        "action": { "enum": step_actions },
                        "value": {
                            "type": "string",
                            "description": format!("Liters for pit.fuel, a tire set for pit.tires, a compound for pit.compound, 1 to {CHAT_MACRO_COUNT} for {CHAT_MACRO_ACTION}")
                        }
                    },
                    "additionalProperties": false
                }
            },
            "replies": {
                "description": format!("Values: {}, or any iRacing variable as {{{SIM_VALUE_PREFIX}<Name>}}, {{{SIM_VALUE_PREFIX}<Name>.tenths|kmh|percent}}", QUESTION_VALUES.iter().map(|value| format!("{{{value}}}")).collect::<Vec<_>>().join(", ")),
                "$ref": "#/$defs/variants"
            }
        },
        "additionalProperties": false
    });

    let defaults: serde_json::Map<String, Value> = INTENTS
        .iter()
        .filter(|intent| !intent.slots.is_empty())
        .map(|intent| {
            (
                intent.id.to_string(),
                json!({
                    "type": "string",
                    "description": format!("{{{}}} when it is not said, or \"{ASK_WHEN_UNSAID}\" for the engineer to ask", intent.slots.join("}, {"))
                }),
            )
        })
        .collect();

    json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Marble Trace voice commands",
        "type": "object",
        "required": ["format", "intents"],
        "properties": {
            "format": { "enum": (OLDEST_FORMAT..=PACK_FORMAT).collect::<Vec<_>>() },
            "intents": { "type": "object", "properties": intents, "additionalProperties": false },
            "slots": { "type": "object", "properties": slots, "additionalProperties": false },
            "defaults": { "type": "object", "properties": defaults, "additionalProperties": false },
            "custom": {
                "type": "object",
                "properties": { "questions": { "type": "array", "items": question } },
                "additionalProperties": false
            }
        },
        "$defs": { "variants": variants_schema() }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pack::message::Arg;
    use crate::pack::template::SlotValue;

    fn scratch_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("mt-voice-{name}-{}", std::process::id()));

        let _ = fs::remove_dir_all(&folder);
        fs::create_dir_all(&folder).unwrap();
        folder
    }

    #[test]
    fn built_in_packs_load_clean_and_cover_every_key_and_intent() {
        for language in BUILT_IN_LANGUAGES {
            let pack = load(language, None);

            assert!(pack.issues.is_empty(), "{language}: {:?}", pack.issues);

            for key in PHRASE_KEYS {
                assert!(
                    !pack.variants(key.id).is_empty(),
                    "{language}: no {}",
                    key.id
                );
            }

            for intent in INTENTS {
                assert!(
                    pack.grammar.sentences_for(intent.id) > 0,
                    "{language}: nothing says {}",
                    intent.id
                );
            }
        }
    }

    #[test]
    fn recognises_the_built_in_examples() {
        let pack = load("ru", None);
        let fuel = pack.grammar.recognise("топливо сорок").unwrap();

        assert_eq!(fuel.intent, "pit.fuel");
        assert_eq!(fuel.slot("number"), Some(&SlotValue::Number(40)));
        assert_eq!(
            pack.grammar
                .recognise("а сколько у меня топлива осталось")
                .unwrap()
                .intent,
            "query.fuel"
        );
    }

    #[test]
    fn a_user_pack_overrides_one_key_and_keeps_the_rest() {
        let folder = scratch_folder("override");

        fs::write(
            folder.join(PHRASES_FILE),
            r#"{ "format": 1, "phrases": { "engineer.notUnderstood": [{ "text": "Ещё раз?" }] } }"#,
        )
        .unwrap();

        let pack = load("ru", Some(&folder));
        let variants = pack.variants("engineer.notUnderstood");

        assert_eq!(variants.len(), 1);
        assert_eq!(variants[0].variant.text, "Ещё раз?");
        assert!(!pack.variants("engineer.notInCar").is_empty());
        assert_eq!(pack.folder.as_deref(), Some(folder.as_path()));

        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn a_broken_user_file_is_reported_and_the_built_in_stands() {
        let folder = scratch_folder("broken");

        fs::write(folder.join(COMMANDS_FILE), "{ not json").unwrap();
        fs::write(
            folder.join(PHRASES_FILE),
            r#"{ "format": 99, "phrases": {} }"#,
        )
        .unwrap();

        let pack = load("en", Some(&folder));
        let locations: Vec<&str> = pack
            .issues
            .iter()
            .map(|issue| issue.location.as_str())
            .collect();

        assert_eq!(locations, vec![PHRASES_FILE, COMMANDS_FILE]);
        assert!(pack.grammar.sentence_count() > 0);

        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn refuses_a_variant_with_a_value_its_key_lacks() {
        let mut issues = Vec::new();
        let file = PhrasesFile {
            format: PACK_FORMAT,
            language: "en".into(),
            phrases: BTreeMap::from([
                (
                    "engineer.notInCar".to_string(),
                    vec![Variant {
                        text: "You are in {position}".into(),
                    }],
                ),
                ("engineer.teleport".to_string(), Vec::new()),
            ]),
        };
        let compiled = compile_phrases(&file, &mut issues);
        let locations: Vec<&str> = issues.iter().map(|issue| issue.location.as_str()).collect();

        assert_eq!(
            locations,
            vec!["phrases.engineer.notInCar[0]", "phrases.engineer.teleport"]
        );
        assert!(compiled["engineer.notInCar"].is_empty());
    }

    #[test]
    fn reads_an_older_packs_recording_as_plain_text() {
        let file: PhrasesFile = serde_json::from_str(
            r#"{ "format": 1, "phrases": { "engineer.cannot": [
                { "text": "Can't", "source": "recording", "audio": "audio/take.wav" }
            ] } }"#,
        )
        .unwrap();

        assert_eq!(
            file.phrases["engineer.cannot"],
            vec![Variant {
                text: "Can't".into()
            }]
        );
    }

    #[test]
    fn marks_a_variant_with_values_dynamic() {
        let pack = load("ru", None);
        let ack = &pack.variants("engineer.ack.fuel")[0];

        assert!(ack.dynamic);
        assert_eq!(
            pack.text(
                &ack.sayings[0],
                &Args::from([("liters", Arg::Number(40.0))])
            )
            .as_deref(),
            Some("Принято, 40 литров")
        );
        assert!(!pack.variants("engineer.notUnderstood")[0].dynamic);
    }

    #[test]
    fn a_variant_with_choices_is_put_each_way() {
        let compiled = compile_variant(
            &["liters"],
            false,
            &Variant {
                text: "(Принято|Понял), [ставим] {liters}".into(),
            },
        )
        .unwrap();
        let texts: Vec<&str> = compiled
            .sayings
            .iter()
            .map(|saying| saying.text.as_str())
            .collect();

        assert!(compiled.dynamic);
        assert_eq!(
            texts,
            [
                "Принято, ставим {liters}",
                "Принято, {liters}",
                "Понял, ставим {liters}",
                "Понял, {liters}",
            ]
        );
        assert!(compile_variant(
            &["liters"],
            false,
            &Variant {
                text: "(Принято|{laps})".into()
            }
        )
        .is_err());
    }

    #[test]
    fn names_a_slot_value_by_its_first_phrase() {
        let pack = load("ru", None);

        assert_eq!(pack.slot_word("compound", "wet"), Some("дождевые"));
        assert_eq!(pack.slot_word("tires", "all"), Some("все четыре"));
        assert_eq!(pack.slot_word("tires", "lf"), Some("переднюю левую"));
    }

    #[test]
    fn never_picks_the_same_variant_twice_in_a_row() {
        let pack = load("ru", None);
        let key = "engineer.notUnderstood";
        let mut picker = VariantPicker::with_seed(7);
        let mut previous = None;

        assert!(
            pack.variants(key).len() > 1,
            "the test needs variants to choose from"
        );

        for _ in 0..50 {
            let picked = picker.pick(&pack, key).map(|saying| saying.text.clone());

            assert_ne!(picked, previous);
            previous = picked;
        }
    }

    #[test]
    fn the_schemas_name_every_key_and_intent() {
        let phrases = phrases_schema();
        let commands = commands_schema();

        for key in PHRASE_KEYS {
            assert!(phrases["properties"]["phrases"]["properties"][key.id].is_object());
        }

        for intent in INTENTS {
            assert!(commands["properties"]["intents"]["properties"][intent.id].is_object());
        }
    }

    #[test]
    fn a_step_is_a_pit_action_or_a_chat_macro_with_its_value() {
        let step = |action: &str, value: Option<&str>| {
            step_command(&VoiceStep {
                action: action.into(),
                value: value.map(str::to_string),
            })
        };

        assert_eq!(
            step("pit.fuel", Some(" 40 ")).unwrap().slots,
            vec![(NUMBER_SLOT.to_string(), SlotValue::Number(40))]
        );
        assert_eq!(
            step("pit.compound", Some("wet")).unwrap().slots,
            vec![("compound".to_string(), SlotValue::Name("wet".into()))]
        );
        assert!(step("pit.fastRepair", None).unwrap().slots.is_empty());
        assert_eq!(step("chat.macro", Some("15")).unwrap().intent, "chat.macro");
        assert!(step("chat.macro", Some("16")).is_err());
        assert!(step("chat.macro", None).is_err());
        assert!(step("pit.tires", Some("middle")).is_err());
        assert!(step("query.fuel", None).is_err());
    }
}
