//! The pack as the Crew tab edits it: laid out key by key and intent by
//! intent, and written back as the user's pack.
//!
//! Only what differs from the built-in pack is written, so a phrase the user
//! never touched keeps following the shipped one when it improves. The JSON
//! Schemas are written beside the files for an external editor to complete
//! against.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io;
use std::path::Path;

use mt_model::app::crew::{QUESTION_PREFIX, QUESTION_VALUES};
use mt_model::app::voice::{
    VoiceConflictView, VoiceDraftCheck, VoiceIntentView, VoiceIssueView, VoicePackView,
    VoicePhraseView, VoiceQuestionView, VoiceRecognisedView, VoiceSlotHeard, VoiceSlotValueView,
    VoiceSlotView, VoiceTemplateCheck, VoiceVariantCheck, VoiceVariantView,
};

use crate::cache::{variant_status, VariantStatus};
use crate::pack::catalog::{reply_values_in, ASK_WHEN_UNSAID, COMPOUND_SLOT, INTENTS, PHRASE_KEYS};
use crate::pack::grammar::{compile, Conflict};
use crate::pack::message::{format, parse, values_used, Arg, Args};
use crate::pack::sayings::sayings;
use crate::pack::template::SlotValue;
use crate::pack::{
    built_in, commands_schema, phrases_schema, question_location, CommandsFile, CompiledVariant,
    CustomActions, LanguagePack, PhrasesFile, Question, Saying, Severity, Variant, COMMANDS_FILE,
    PACK_FORMAT, PHRASES_FILE,
};
use crate::voice_out::OutputConfig;

const PHRASES_SCHEMA_FILE: &str = "phrases.schema.json";
const COMMANDS_SCHEMA_FILE: &str = "commands.schema.json";
/// Sentences of a template the editor lists under it.
const TEMPLATE_EXAMPLES: usize = 6;
/// Samples shown for a reply with no values: its sayings, the first few.
const MAX_FIXED_SAMPLES: usize = 4;
/// The compound a reply's sample names.
const SAMPLE_COMPOUND: &str = "dry";

pub fn pack_view(pack: &LanguagePack, folder: &Path, config: &OutputConfig) -> VoicePackView {
    let questions = &pack.commands_file.custom.questions;
    let question_values: Vec<String> = QUESTION_VALUES
        .iter()
        .map(|value| value.to_string())
        .collect();
    let phrases = PHRASE_KEYS
        .iter()
        .map(|key| VoicePhraseView {
            key: key.id.to_string(),
            values: key.values.iter().map(|value| value.to_string()).collect(),
            variants: pack
                .phrases_file
                .phrases
                .get(key.id)
                .map(|variants| {
                    variants
                        .iter()
                        .map(|variant| variant_view(variant, config))
                        .collect()
                })
                .unwrap_or_default(),
        })
        .chain(questions.iter().map(|question| {
            VoicePhraseView {
                key: question.key(),
                values: question_values.clone(),
                variants: question
                    .replies
                    .iter()
                    .map(|variant| variant_view(variant, config))
                    .collect(),
            }
        }))
        .collect();
    let intents = INTENTS
        .iter()
        .map(|intent| VoiceIntentView {
            id: intent.id.to_string(),
            slots: intent.slots.iter().map(|slot| slot.to_string()).collect(),
            templates: pack
                .commands_file
                .intents
                .get(intent.id)
                .cloned()
                .unwrap_or_default(),
            sentences: pack.grammar.sentences_for(intent.id) as u32,
            replies: intent.replies.iter().map(|key| key.to_string()).collect(),
            when_unsaid: (!intent.slots.is_empty())
                .then(|| when_unsaid(&pack.commands_file, intent.id).to_string()),
        })
        .chain(questions.iter().map(|question| VoiceIntentView {
            id: question.key(),
            slots: Vec::new(),
            templates: question.phrases.clone(),
            sentences: pack.grammar.sentences_for(&question.key()) as u32,
            replies: vec![question.key()],
            when_unsaid: None,
        }))
        .collect();
    let slots = pack
        .commands_file
        .slots
        .iter()
        .map(|(slot, values)| VoiceSlotView {
            slot: slot.clone(),
            values: values
                .iter()
                .map(|(value, phrases)| VoiceSlotValueView {
                    value: value.clone(),
                    phrases: phrases.clone(),
                })
                .collect(),
        })
        .collect();

    VoicePackView {
        language: pack.language.clone(),
        folder: folder.to_string_lossy().into_owned(),
        phrases,
        intents,
        slots,
        questions: questions
            .iter()
            .map(|question| VoiceQuestionView {
                id: question.id.clone(),
                name: question.name.clone(),
                steps: question.steps.clone(),
            })
            .collect(),
        question_values,
        sentence_count: pack.grammar.sentence_count() as u32,
        conflicts: conflict_views(&pack.grammar.conflicts),
        issues: pack
            .issues
            .iter()
            .map(|issue| VoiceIssueView {
                severity: match issue.severity {
                    Severity::Error => "error",
                    Severity::Warning => "warning",
                }
                .to_string(),
                location: issue.location.clone(),
                message: issue.message.clone(),
            })
            .collect(),
    }
}

fn conflict_views(conflicts: &[Conflict]) -> Vec<VoiceConflictView> {
    conflicts
        .iter()
        .map(|conflict| VoiceConflictView {
            sentence: conflict.sentence.clone(),
            intents: conflict.intents.clone(),
        })
        .collect()
}

/// The draft's own questions, put back together from the intent and the
/// phrase listed for each.
fn draft_questions(view: &VoicePackView) -> Vec<Question> {
    view.questions
        .iter()
        .map(|question| {
            let key = format!("{QUESTION_PREFIX}{}", question.id);

            Question {
                id: question.id.clone(),
                name: question.name.clone(),
                steps: question.steps.clone(),
                phrases: view
                    .intents
                    .iter()
                    .find(|intent| intent.id == key)
                    .map(|intent| intent.templates.clone())
                    .unwrap_or_default(),
                replies: view
                    .phrases
                    .iter()
                    .find(|phrase| phrase.key == key)
                    .map(|phrase| phrase.variants.iter().map(variant_from_view).collect())
                    .unwrap_or_default(),
            }
        })
        .collect()
}

fn is_question(id: &str) -> bool {
    id.starts_with(QUESTION_PREFIX)
}

/// The draft's commands as a whole file — every intent, not only what differs.
fn draft_commands(view: &VoicePackView) -> CommandsFile {
    CommandsFile {
        format: PACK_FORMAT,
        intents: view
            .intents
            .iter()
            .filter(|intent| !is_question(&intent.id))
            .map(|intent| (intent.id.clone(), intent.templates.clone()))
            .collect(),
        slots: view
            .slots
            .iter()
            .map(|slot| {
                let values = slot
                    .values
                    .iter()
                    .map(|value| (value.value.clone(), value.phrases.clone()))
                    .collect();

                (slot.slot.clone(), values)
            })
            .collect(),
        custom: CustomActions {
            questions: draft_questions(view),
        },
        defaults: view
            .intents
            .iter()
            .filter_map(|intent| Some((intent.id.clone(), intent.when_unsaid.clone()?)))
            .collect(),
    }
}

/// The draft as the editor checks it before saving: every template on its
/// own, every variant read with samples, and the whole for counts and
/// conflicts.
/// The draft checked, its templates' words against the recognition model's
/// vocabulary through `missing_words` — `None` when there is no model to ask.
pub fn check_draft(
    view: &VoicePackView,
    missing_words: impl FnOnce(Vec<String>) -> Option<Vec<String>>,
) -> VoiceDraftCheck {
    let commands = draft_commands(view);
    let (grammar, _) = compile(&view.language, &commands);
    let (mut templates, words): (Vec<VoiceTemplateCheck>, Vec<BTreeSet<String>>) = view
        .intents
        .iter()
        .flat_map(|intent| {
            intent
                .templates
                .iter()
                .enumerate()
                .map(|(index, template)| {
                    check_template(&view.language, &commands, &intent.id, index, template)
                })
        })
        .unzip();
    let every_word: BTreeSet<String> = words.iter().flatten().cloned().collect();
    let missing: Option<BTreeSet<String>> = missing_words(every_word.into_iter().collect())
        .map(|missing| missing.into_iter().collect());

    if let Some(missing) = &missing {
        for (template, words) in templates.iter_mut().zip(&words) {
            template.missing_words = words.intersection(missing).cloned().collect();
        }
    }

    let compound = view
        .slots
        .iter()
        .find(|slot| slot.slot == COMPOUND_SLOT)
        .and_then(|slot| {
            slot.values
                .iter()
                .find(|value| value.value == SAMPLE_COMPOUND)
        })
        .and_then(|value| value.phrases.first())
        .map_or(SAMPLE_COMPOUND, String::as_str);
    let variants = view
        .phrases
        .iter()
        .flat_map(|phrase| {
            phrase.variants.iter().enumerate().map(|(index, variant)| {
                check_variant(&view.language, &phrase.key, index, &variant.text, compound)
            })
        })
        .collect();

    VoiceDraftCheck {
        templates,
        variants,
        sentence_count: grammar.sentence_count() as u32,
        conflicts: conflict_views(&grammar.conflicts),
        vocabulary_checked: missing.is_some(),
    }
}

/// One template compiled alone, with the draft's slots, and every word its
/// sentences use.
fn check_template(
    language: &str,
    commands: &CommandsFile,
    intent: &str,
    index: usize,
    template: &str,
) -> (VoiceTemplateCheck, BTreeSet<String>) {
    let (alone, location) = match intent.strip_prefix(QUESTION_PREFIX) {
        Some(id) => (
            CommandsFile {
                intents: BTreeMap::new(),
                custom: CustomActions {
                    questions: vec![Question {
                        id: id.to_string(),
                        phrases: vec![template.to_string()],
                        ..Question::default()
                    }],
                },
                ..commands.clone()
            },
            question_location(0, "phrases", 0),
        ),
        None => (
            CommandsFile {
                intents: BTreeMap::from([(intent.to_string(), vec![template.to_string()])]),
                custom: CustomActions::default(),
                ..commands.clone()
            },
            format!("commands.intents.{intent}[0]"),
        ),
    };
    let (grammar, issues) = compile(language, &alone);
    let sentences = grammar.sentences();
    // Spread across the list, so a slot's values show rather than one value
    // with every ending.
    let step = (sentences.len() / TEMPLATE_EXAMPLES).max(1);
    let words = sentences
        .iter()
        .flat_map(|sentence| sentence.split_whitespace())
        .map(str::to_string)
        .collect();
    let check = VoiceTemplateCheck {
        intent: intent.to_string(),
        index: index as u32,
        sentences: sentences.len() as u32,
        examples: sentences
            .iter()
            .step_by(step)
            .take(TEMPLATE_EXAMPLES)
            .cloned()
            .collect(),
        error: issues
            .into_iter()
            .find(|issue| issue.location == location)
            .map(|issue| issue.message),
        missing_words: Vec::new(),
    };

    (check, words)
}

/// Numbers that show every plural form the language has, a fraction last.
fn sample_numbers(language: &str) -> &'static [f64] {
    match language {
        "ru" => &[1.0, 3.0, 5.0, 1.5],
        _ => &[1.0, 5.0, 1.5],
    }
}

/// A variant read with every sample number, or the first mistake in it.
fn check_variant(
    language: &str,
    key: &str,
    index: usize,
    text: &str,
    compound: &str,
) -> VoiceVariantCheck {
    let mut check = VoiceVariantCheck {
        key: key.to_string(),
        index: index as u32,
        samples: Vec::new(),
        sayings: 0,
        error: None,
    };
    let texts = match sayings(text) {
        Ok(texts) => texts,
        Err(error) => {
            check.error = Some(error.to_string());

            return check;
        }
    };
    let mut messages = Vec::with_capacity(texts.len());

    for text in &texts {
        match parse(text) {
            Ok(message) => messages.push(message),
            Err(error) => {
                check.error = Some(error.to_string());

                return check;
            }
        }
    }

    check.sayings = messages.len() as u32;

    let values: Vec<String> = messages
        .iter()
        .flat_map(|message| reply_values_in(key, message))
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let has_numbers = values.iter().any(|value| value != COMPOUND_SLOT);
    let numbers: &[f64] = if has_numbers {
        sample_numbers(language)
    } else {
        &[0.0]
    };
    // A number for each sample, a saying in turn for each: the sample list
    // shows the choices as well as the forms the numbers take.
    let samples = numbers.len().max(messages.len().min(MAX_FIXED_SAMPLES));

    for sample in 0..samples {
        let number = numbers[sample % numbers.len()];
        let message = &messages[sample % messages.len()];
        let args: Args<'_> = values
            .iter()
            .map(|value| {
                let sample = if value == COMPOUND_SLOT {
                    Arg::Text(compound.to_string())
                } else {
                    Arg::Number(number)
                };

                (value.as_str(), sample)
            })
            .collect();

        match format(message, language, &args) {
            Ok(sample) => check.samples.push(sample),
            Err(error) => {
                check.error = Some(error.to_string());
                check.samples.clear();

                return check;
            }
        }
    }

    check
}

/// The commands the draft hears in a typed sentence, in the order said;
/// empty when it is not the draft's commands.
pub fn recognise_draft(view: &VoicePackView, sentence: &str) -> Vec<VoiceRecognisedView> {
    let (grammar, _) = compile(&view.language, &draft_commands(view));

    grammar
        .recognise_all(sentence)
        .into_iter()
        .map(|recognised| VoiceRecognisedView {
            intent: recognised.intent.clone(),
            slots: recognised
                .slots
                .iter()
                .map(|(slot, value)| VoiceSlotHeard {
                    slot: slot.clone(),
                    value: match value {
                        SlotValue::Number(number) => number.to_string(),
                        SlotValue::Name(name) => name.clone(),
                    },
                })
                .collect(),
        })
        .collect()
}

/// The pack being edited as the ear's grammar: what a test press listens for
/// before the pack is saved.
pub fn draft_vosk_grammar(view: &VoicePackView) -> String {
    let (grammar, _) = compile(&view.language, &draft_commands(view));

    grammar.vosk_grammar()
}

fn variant_view(variant: &Variant, config: &OutputConfig) -> VoiceVariantView {
    // A variant with a mistake is shown by its text, as its one saying.
    let sayings: Vec<Saying> = sayings(&variant.text)
        .unwrap_or_else(|_| vec![variant.text.clone()])
        .into_iter()
        .map(|text| Saying {
            message: parse(&text).unwrap_or_default(),
            text,
        })
        .collect();
    let compiled = CompiledVariant {
        dynamic: sayings
            .iter()
            .any(|saying| !values_used(&saying.message).is_empty()),
        variant: variant.clone(),
        sayings,
    };
    let status = match variant_status(&compiled, config) {
        VariantStatus::Generated => "generated",
        VariantStatus::Missing => "missing",
        VariantStatus::Dynamic => "dynamic",
    };

    VoiceVariantView {
        text: variant.text.clone(),
        status: status.to_string(),
    }
}

/// An intent's value when it is not said, `ask` when the pack names none.
fn when_unsaid<'a>(commands: &'a CommandsFile, intent: &str) -> &'a str {
    commands
        .defaults
        .get(intent)
        .map_or(ASK_WHEN_UNSAID, String::as_str)
}

fn variant_from_view(variant: &VoiceVariantView) -> Variant {
    Variant {
        text: variant.text.clone(),
    }
}

/// Writes the edited pack into `folder` as the user's pack: what differs from
/// the built-in one, and the schemas beside it.
pub fn save_pack(folder: &Path, view: &VoicePackView) -> io::Result<()> {
    let (built_in_phrases, built_in_commands) = built_in(&view.language).unwrap_or_default();
    let mut phrases = PhrasesFile {
        format: PACK_FORMAT,
        language: view.language.clone(),
        phrases: BTreeMap::new(),
    };
    let mut commands = CommandsFile {
        format: PACK_FORMAT,
        custom: CustomActions {
            questions: draft_questions(view),
        },
        ..CommandsFile::default()
    };

    for phrase in view
        .phrases
        .iter()
        .filter(|phrase| !is_question(&phrase.key))
    {
        let variants: Vec<Variant> = phrase.variants.iter().map(variant_from_view).collect();

        if built_in_phrases.phrases.get(&phrase.key) != Some(&variants) {
            phrases.phrases.insert(phrase.key.clone(), variants);
        }
    }

    for intent in view
        .intents
        .iter()
        .filter(|intent| !is_question(&intent.id))
    {
        if built_in_commands.intents.get(&intent.id) != Some(&intent.templates) {
            commands
                .intents
                .insert(intent.id.clone(), intent.templates.clone());
        }

        if let Some(value) = &intent.when_unsaid {
            if when_unsaid(&built_in_commands, &intent.id) != value {
                commands.defaults.insert(intent.id.clone(), value.clone());
            }
        }
    }

    for slot in &view.slots {
        let values: BTreeMap<String, Vec<String>> = slot
            .values
            .iter()
            .map(|value| (value.value.clone(), value.phrases.clone()))
            .collect();

        if built_in_commands.slots.get(&slot.slot) != Some(&values) {
            commands.slots.insert(slot.slot.clone(), values);
        }
    }

    fs::create_dir_all(folder)?;
    write_json(&folder.join(PHRASES_FILE), &phrases)?;
    write_json(&folder.join(COMMANDS_FILE), &commands)?;
    write_json(&folder.join(PHRASES_SCHEMA_FILE), &phrases_schema())?;
    write_json(&folder.join(COMMANDS_SCHEMA_FILE), &commands_schema())
}

fn write_json(path: &Path, value: &impl serde::Serialize) -> io::Result<()> {
    let text = serde_json::to_string_pretty(value).map_err(io::Error::other)?;

    fs::write(path, text + "\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pack::load;
    use mt_model::app::voice::VoiceStep;
    use std::path::PathBuf;

    fn scratch(name: &str) -> PathBuf {
        let folder =
            std::env::temp_dir().join(format!("mt-voice-editor-{name}-{}", std::process::id()));

        let _ = fs::remove_dir_all(&folder);
        fs::create_dir_all(&folder).unwrap();
        folder
    }

    fn config(root: &Path) -> OutputConfig {
        OutputConfig {
            root: root.to_path_buf(),
            piper: None,
            voice_id: "test".into(),
            voice_model: None,
            device: None,
            volume: 1.0,
            length_scale: 1.0,
        }
    }

    #[test]
    fn lists_every_key_and_intent_with_its_status() {
        let root = scratch("view");
        let view = pack_view(&load("en", None), &root, &config(&root));

        assert_eq!(view.phrases.len(), PHRASE_KEYS.len());
        assert_eq!(view.intents.len(), INTENTS.len());

        let fuel = view
            .phrases
            .iter()
            .find(|phrase| phrase.key == "engineer.ack.fuel")
            .unwrap();

        assert_eq!(fuel.values, vec!["liters"]);
        assert_eq!(fuel.variants[0].status, "dynamic");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn the_ear_listens_for_an_unsaved_sentence() {
        let root = scratch("draft-grammar");
        let mut view = pack_view(&load("en", None), &root, &config(&root));
        let before = draft_vosk_grammar(&view);

        view.intents
            .iter_mut()
            .find(|intent| intent.id == "pit.fuel")
            .unwrap()
            .templates
            .push("top me up".into());

        assert!(!before.contains("top me up"));
        assert!(draft_vosk_grammar(&view).contains("top me up"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn checks_a_draft_before_it_is_saved() {
        let root = scratch("check");
        let mut view = pack_view(&load("ru", None), &root, &config(&root));
        let fuel = view
            .intents
            .iter_mut()
            .find(|intent| intent.id == "pit.fuel")
            .unwrap();

        fuel.templates = vec!["долей {number}".into(), "(топливо".into()];

        let check = check_draft(&view, |_| None);
        let template = |index: u32| {
            check
                .templates
                .iter()
                .find(|template| template.intent == "pit.fuel" && template.index == index)
                .unwrap()
        };
        let ack = check
            .variants
            .iter()
            .find(|variant| variant.key == "engineer.ack.fuel" && variant.index == 0)
            .unwrap();

        assert!(template(0).error.is_none());
        assert_eq!(template(0).examples[0], "долей ноль");
        assert!(template(1).error.is_some());
        assert_eq!(template(1).sentences, 0);
        assert_eq!(
            ack.samples,
            vec![
                "Принято, 1 литр",
                "Принято, 3 литра",
                "Принято, 5 литров",
                "Принято, 1,5 литра"
            ]
        );
        assert_eq!(
            recognise_draft(&view, "долей сорок"),
            vec![VoiceRecognisedView {
                intent: "pit.fuel".into(),
                slots: vec![VoiceSlotHeard {
                    slot: "number".into(),
                    value: "40".into(),
                }],
            }]
        );
        assert!(recognise_draft(&view, "сколько стоит бензин").is_empty());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn saves_only_what_differs_from_the_built_in_pack() {
        let root = scratch("save");
        let folder = root.join("packs/en");
        let mut view = pack_view(&load("en", None), &folder, &config(&root));

        view.phrases
            .iter_mut()
            .find(|phrase| phrase.key == "engineer.notInCar")
            .unwrap()
            .variants[0]
            .text = "Get in the car".into();
        view.intents
            .iter_mut()
            .find(|intent| intent.id == "control.repeat")
            .unwrap()
            .templates
            .push("one more time".into());

        save_pack(&folder, &view).unwrap();

        let saved: PhrasesFile =
            serde_json::from_str(&fs::read_to_string(folder.join(PHRASES_FILE)).unwrap()).unwrap();
        let reloaded = load("en", Some(&folder));

        assert_eq!(
            saved.phrases.keys().collect::<Vec<_>>(),
            vec!["engineer.notInCar"]
        );
        assert_eq!(
            reloaded.variants("engineer.notInCar")[0].variant.text,
            "Get in the car"
        );
        assert!(reloaded.grammar.recognise("one more time").is_some());
        assert!(reloaded.issues.is_empty(), "{:?}", reloaded.issues);
        assert!(folder.join(PHRASES_SCHEMA_FILE).is_file());

        let _ = fs::remove_dir_all(root);
    }

    fn with_weather_question(view: &mut VoicePackView, template: &str, reply: &str) {
        view.questions.push(VoiceQuestionView {
            id: "weather".into(),
            name: "Weather".into(),
            steps: vec![VoiceStep {
                action: "pit.tires".into(),
                value: Some("front".into()),
            }],
        });
        view.intents.push(VoiceIntentView {
            id: "question.weather".into(),
            slots: Vec::new(),
            templates: vec![template.into()],
            sentences: 0,
            replies: vec!["question.weather".into()],
            when_unsaid: None,
        });
        view.phrases.push(VoicePhraseView {
            key: "question.weather".into(),
            values: view.question_values.clone(),
            variants: vec![VoiceVariantView {
                text: reply.into(),
                status: "dynamic".into(),
            }],
        });
    }

    #[test]
    fn a_question_of_the_drivers_own_is_checked_saved_and_heard() {
        let root = scratch("question");
        let folder = root.join("packs/ru");
        let mut view = pack_view(&load("ru", None), &folder, &config(&root));

        with_weather_question(
            &mut view,
            "как там [сейчас] небо",
            "Воздух {airTemp}, трасса {trackTemp}",
        );

        let check = check_draft(&view, |_| None);
        let template = check
            .templates
            .iter()
            .find(|template| template.intent == "question.weather")
            .unwrap();
        let reply = check
            .variants
            .iter()
            .find(|variant| variant.key == "question.weather")
            .unwrap();

        assert_eq!(template.sentences, 2);
        assert_eq!(reply.samples[0], "Воздух 1, трасса 1");
        assert_eq!(
            recognise_draft(&view, "как там сейчас небо")
                .into_iter()
                .map(|heard| heard.intent)
                .collect::<Vec<_>>(),
            ["question.weather"]
        );

        save_pack(&folder, &view).unwrap();

        let saved: CommandsFile =
            serde_json::from_str(&fs::read_to_string(folder.join(COMMANDS_FILE)).unwrap()).unwrap();
        let reloaded = load("ru", Some(&folder));

        assert_eq!(saved.format, PACK_FORMAT);
        assert_eq!(
            saved.custom.questions[0].phrases,
            vec!["как там [сейчас] небо"]
        );
        assert!(saved.intents.is_empty());
        assert!(reloaded.issues.is_empty(), "{:?}", reloaded.issues);
        assert_eq!(
            reloaded
                .grammar
                .recognise("как там небо")
                .map(|heard| heard.intent.as_str()),
            Some("question.weather")
        );
        assert_eq!(reloaded.variants("question.weather").len(), 1);
        assert!(reloaded.grammar.acts("question.weather"));

        let reloaded_view = pack_view(&reloaded, &folder, &config(&root));

        assert_eq!(reloaded_view.questions[0].name, "Weather");
        assert_eq!(reloaded_view.questions[0].steps, view.questions[0].steps);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn a_reply_naming_a_value_no_question_has_is_a_mistake() {
        let root = scratch("question-value");
        let mut view = pack_view(&load("en", None), &root, &config(&root));

        with_weather_question(&mut view, "weather", "It is {humidity}");

        let check = check_draft(&view, |_| None);
        let reply = check
            .variants
            .iter()
            .find(|variant| variant.key == "question.weather")
            .unwrap();

        assert!(reply.error.is_some());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn spreads_a_templates_examples_across_its_values() {
        let commands = draft_commands(&pack_view(
            &load("ru", None),
            Path::new("."),
            &config(Path::new(".")),
        ));
        let (check, _) = check_template(
            "ru",
            &commands,
            "pit.fuel",
            0,
            "топливо {number} [(литров|литра)]",
        );

        assert_eq!(check.examples.len(), TEMPLATE_EXAMPLES);
        assert!(!check.examples[1].starts_with("топливо ноль"));
    }

    #[test]
    fn names_the_words_the_model_lacks_under_each_template() {
        let mut view = pack_view(&load("ru", None), Path::new("."), &config(Path::new(".")));

        view.intents
            .iter_mut()
            .find(|intent| intent.id == "pit.fastRepair")
            .unwrap()
            .templates = vec!["чини (тачку|машину)".into()];

        let mut asked = Vec::new();
        let check = check_draft(&view, |words| {
            asked = words.clone();

            Some(vec!["тачку".into()])
        });
        let repair = check
            .templates
            .iter()
            .find(|template| template.intent == "pit.fastRepair")
            .unwrap();

        assert!(check.vocabulary_checked);
        assert_eq!(repair.missing_words, ["тачку"]);
        assert!(asked.contains(&"машину".to_string()));
        assert!(check
            .templates
            .iter()
            .filter(|template| template.intent != "pit.fastRepair")
            .all(|template| template.missing_words.is_empty()));
        assert!(!check_draft(&view, |_| None).vocabulary_checked);
    }
}
