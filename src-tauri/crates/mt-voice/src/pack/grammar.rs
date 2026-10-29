//! A pack's commands compiled into what the recogniser is given — every
//! sentence they allow, plus `[unk]` for anything else — and the way back from
//! a recognised sentence to its intent and slot values.

use std::collections::{BTreeMap, HashMap, HashSet};

use crate::pack::catalog::{
    changes_the_car, intent_named, slot_kind, unsaid_value, SlotKind, ASK_WHEN_UNSAID,
};
use crate::pack::numbers::number_phrases;
use crate::pack::template::{expand, parse, SlotPhrase, SlotValue};
use crate::pack::{question_location, usable_questions, CommandsFile, PackIssue};

/// What the recogniser hears when the driver says something outside the list.
pub const UNKNOWN_WORD: &str = "[unk]";

/// Past this many sentences recognition slows and confusions grow; the pack
/// still loads, with a warning.
pub const LARGE_GRAMMAR_SENTENCES: usize = 50_000;

/// Words that join commands said together ("fuel forty and change fronts").
/// The recogniser is given them on their own, so it hears them instead of
/// `[unk]`; between commands they are skipped.
fn connectives(language: &str) -> &'static [&'static str] {
    match language {
        "ru" => &["и", "потом", "ещё", "еще"],
        "en" => &["and", "then"],
        "es" => &["y", "luego", "después"],
        "zh" => &["然后", "还有", "再"],
        _ => &[],
    }
}

/// A sentence recognised as one of the pack's commands.
#[derive(Debug, Clone, PartialEq)]
pub struct Recognised {
    pub intent: String,
    pub slots: Vec<(String, SlotValue)>,
}

impl Recognised {
    pub fn slot(&self, name: &str) -> Option<&SlotValue> {
        self.slots
            .iter()
            .find(|(slot, _)| slot == name)
            .map(|(_, value)| value)
    }
}

/// One sentence two intents both claim. The first one written keeps it.
#[derive(Debug, Clone, PartialEq)]
pub struct Conflict {
    pub sentence: String,
    pub intents: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct CommandGrammar {
    sentences: HashMap<String, Recognised>,
    /// In the order they were written, so the recogniser's list is stable.
    order: Vec<String>,
    pub conflicts: Vec<Conflict>,
    pub intent_count: usize,
    connectives: &'static [&'static str],
    /// The driver's questions that carry something out before answering.
    routines: HashSet<String>,
}

impl CommandGrammar {
    /// Carries something out, so a sentence heard below the confidence
    /// threshold is not acted on: a pit command, or a question with steps.
    pub fn acts(&self, intent: &str) -> bool {
        changes_the_car(intent) || self.routines.contains(intent)
    }

    pub fn sentence_count(&self) -> usize {
        self.order.len()
    }

    /// How many sentences say an intent — the editor's count per intent.
    pub fn sentences_for(&self, intent: &str) -> usize {
        self.sentences
            .values()
            .filter(|recognised| recognised.intent == intent)
            .count()
    }

    /// Every sentence, in the order the templates wrote them.
    pub fn sentences(&self) -> &[String] {
        &self.order
    }

    pub fn recognise(&self, text: &str) -> Option<&Recognised> {
        let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");

        self.sentences.get(&normalized.to_lowercase())
    }

    /// Every command a sentence holds, in the order said: the fewest of the
    /// pack's sentences that cover it, with connectives between them skipped.
    /// Empty when anything in it is not one of them — `[unk]` included, since
    /// an unheard "don't" must not let the command after it through.
    pub fn recognise_all(&self, text: &str) -> Vec<&Recognised> {
        let lowered = text.to_lowercase();
        let words: Vec<&str> = lowered.split_whitespace().collect();
        // best[end] covers words[..end].
        let mut best: Vec<Option<Cover>> = vec![None; words.len() + 1];

        best[0] = Some(Cover {
            commands: 0,
            skipped: 0,
            last_command_start: None,
        });

        for end in 1..=words.len() {
            let skipped = self
                .connectives
                .contains(&words[end - 1])
                .then(|| best[end - 1])
                .flatten()
                .map(|before| Cover {
                    skipped: before.skipped + 1,
                    last_command_start: None,
                    ..before
                });
            let said = (0..end).filter_map(|start| {
                let before = best[start]?;

                self.sentences
                    .contains_key(&words[start..end].join(" "))
                    .then_some(Cover {
                        commands: before.commands + 1,
                        last_command_start: Some(start),
                        ..before
                    })
            });

            best[end] = skipped
                .into_iter()
                .chain(said)
                .min_by_key(|cover| (cover.commands, cover.skipped));
        }

        let mut commands = Vec::new();
        let mut end = words.len();

        while end > 0 {
            let Some(cover) = best[end] else {
                return Vec::new();
            };

            match cover.last_command_start {
                Some(start) => {
                    commands.extend(self.sentences.get(&words[start..end].join(" ")));
                    end = start;
                }
                None => end -= 1,
            }
        }

        commands.reverse();

        commands
    }

    /// The grammar as Vosk takes it: a JSON array of phrases.
    pub fn vosk_grammar(&self) -> String {
        let mut phrases: Vec<&str> = self.order.iter().map(String::as_str).collect();

        phrases.extend(self.connectives);
        phrases.push(UNKNOWN_WORD);

        serde_json::to_string(&phrases).unwrap_or_else(|_| "[]".to_string())
    }
}

/// What each intent takes when its value is not said; `ask` and an intent
/// left out take nothing, so the engineer asks.
fn unsaid_values(
    commands: &CommandsFile,
    issues: &mut Vec<PackIssue>,
) -> HashMap<String, (&'static str, SlotValue)> {
    let mut values = HashMap::new();

    for (intent_id, value) in &commands.defaults {
        let location = format!("commands.defaults.{intent_id}");
        let Some(intent) = intent_named(intent_id).filter(|intent| !intent.slots.is_empty()) else {
            issues.push(PackIssue::error(location, "no intent with a value"));
            continue;
        };

        if value == ASK_WHEN_UNSAID {
            continue;
        }

        match unsaid_value(intent, value) {
            Some(unsaid) => {
                values.insert(intent_id.clone(), unsaid);
            }
            None => issues.push(PackIssue::error(
                location,
                format!(
                    "\"{value}\" is not a value of {{{}}}",
                    intent.slots.join("}, {")
                ),
            )),
        }
    }

    values
}

pub fn compile(language: &str, commands: &CommandsFile) -> (CommandGrammar, Vec<PackIssue>) {
    let mut issues = Vec::new();
    let slot_phrases = slot_phrases(language, commands, &mut issues);
    let mut grammar = CommandGrammar {
        connectives: connectives(language),
        ..CommandGrammar::default()
    };
    let mut claimed_by: HashMap<String, Vec<String>> = HashMap::new();
    let mut said: Vec<Said<'_>> = Vec::new();
    let unsaid = unsaid_values(commands, &mut issues);

    for (intent_id, templates) in &commands.intents {
        let Some(intent) = intent_named(intent_id) else {
            issues.push(PackIssue::error(
                format!("commands.intents.{intent_id}"),
                "unknown intent",
            ));
            continue;
        };

        said.push(Said {
            intent_id: intent_id.clone(),
            slots: intent.slots,
            unsaid: unsaid.get(intent_id).cloned(),
            templates,
            location: Box::new(move |index| format!("commands.intents.{intent_id}[{index}]")),
        });
    }

    // The driver's questions come after the built-in intents, so a sentence
    // both claim stays with the built-in one.
    for (question_index, question) in usable_questions(&commands.custom.questions, &mut issues) {
        if !question.steps.is_empty() {
            grammar.routines.insert(question.key());
        }

        said.push(Said {
            intent_id: question.key(),
            slots: &[],
            unsaid: None,
            templates: &question.phrases,
            location: Box::new(move |index| question_location(question_index, "phrases", index)),
        });
    }

    for Said {
        intent_id,
        slots,
        unsaid,
        templates,
        location,
    } in &said
    {
        grammar.intent_count += 1;

        for (index, template) in templates.iter().enumerate() {
            let location = location(index);
            let nodes = match parse(template) {
                Ok(nodes) => nodes,
                Err(error) => {
                    issues.push(PackIssue::error(location, error.to_string()));
                    continue;
                }
            };
            let lookup = |name: &str| {
                slots
                    .contains(&name)
                    .then(|| slot_phrases.get(name).map(Vec::as_slice))
                    .flatten()
            };
            let sentences = match expand(&nodes, &lookup) {
                Ok(sentences) => sentences,
                Err(error) => {
                    issues.push(PackIssue::error(location, error.to_string()));
                    continue;
                }
            };

            for mut sentence in sentences {
                let text = sentence.text();

                if let Some((slot, value)) = unsaid {
                    if !sentence.slots.iter().any(|(name, _)| name == *slot) {
                        sentence.slots.push((slot.to_string(), value.clone()));
                    }
                }

                if text.is_empty() {
                    continue;
                }

                let claimants = claimed_by.entry(text.clone()).or_default();

                if !claimants.contains(intent_id) {
                    claimants.push(intent_id.clone());
                }

                if grammar.sentences.contains_key(&text) {
                    continue;
                }

                grammar.order.push(text.clone());
                grammar.sentences.insert(
                    text,
                    Recognised {
                        intent: intent_id.clone(),
                        slots: sentence.slots,
                    },
                );
            }
        }
    }

    let mut conflicts: Vec<Conflict> = claimed_by
        .into_iter()
        .filter(|(_, intents)| intents.len() > 1)
        .map(|(sentence, intents)| Conflict { sentence, intents })
        .collect();

    conflicts.sort_by(|left, right| left.sentence.cmp(&right.sentence));

    for conflict in &conflicts {
        issues.push(PackIssue::warning(
            "commands.intents",
            format!(
                "\"{}\" belongs to {}",
                conflict.sentence,
                conflict.intents.join(", ")
            ),
        ));
    }

    if grammar.sentence_count() > LARGE_GRAMMAR_SENTENCES {
        issues.push(PackIssue::warning(
            "commands",
            format!(
                "{} sentences — recognition slows past {LARGE_GRAMMAR_SENTENCES}",
                grammar.sentence_count()
            ),
        ));
    }

    grammar.conflicts = conflicts;

    (grammar, issues)
}

/// The cheapest reading found for a sentence's first words: the fewest
/// commands, then the fewest connectives skipped.
#[derive(Debug, Clone, Copy)]
struct Cover {
    commands: usize,
    skipped: usize,
    /// `None` when the last word was a connective skipped.
    last_command_start: Option<usize>,
}

/// An intent's templates as the grammar compiles them, built-in or the
/// driver's own.
struct Said<'a> {
    intent_id: String,
    slots: &'static [&'static str],
    /// The slot and value a sentence that leaves it out takes.
    unsaid: Option<(&'static str, SlotValue)>,
    templates: &'a [String],
    location: Box<dyn Fn(usize) -> String + 'a>,
}

/// Every slot's phrases: numbers from the language, the rest from the pack.
fn slot_phrases(
    language: &str,
    commands: &CommandsFile,
    issues: &mut Vec<PackIssue>,
) -> HashMap<String, Vec<SlotPhrase>> {
    let mut phrases = HashMap::new();

    match number_phrases(language) {
        Some(numbers) => {
            phrases.insert("number".to_string(), numbers);
        }
        None => issues.push(PackIssue::warning(
            "commands",
            format!("no number words for '{language}' — {{number}} commands are left out"),
        )),
    }

    for (slot, values) in &commands.slots {
        let location = format!("commands.slots.{slot}");

        match slot_kind(slot) {
            Some(SlotKind::Fixed(allowed)) => {
                for value in values
                    .keys()
                    .filter(|value| !allowed.contains(&value.as_str()))
                {
                    issues.push(PackIssue::error(
                        format!("{location}.{value}"),
                        format!("unknown value, expected one of {}", allowed.join(", ")),
                    ));
                }

                phrases.insert(
                    slot.clone(),
                    named_phrases(&location, values, allowed, issues),
                );
            }
            Some(SlotKind::Number) => issues.push(PackIssue::error(
                location,
                "numbers are built in and cannot be redefined",
            )),
            None => issues.push(PackIssue::error(location, "unknown slot")),
        }
    }

    phrases
}

/// A slot's phrases may use the template syntax themselves, but no slots.
fn named_phrases(
    location: &str,
    values: &BTreeMap<String, Vec<String>>,
    allowed: &[&str],
    issues: &mut Vec<PackIssue>,
) -> Vec<SlotPhrase> {
    let mut phrases = Vec::new();

    for (value, templates) in values {
        if !allowed.contains(&value.as_str()) {
            continue;
        }

        for (index, template) in templates.iter().enumerate() {
            let expanded = parse(template).and_then(|nodes| expand(&nodes, &|_| None));

            match expanded {
                Ok(sentences) => phrases.extend(sentences.into_iter().map(|sentence| SlotPhrase {
                    words: sentence.words,
                    value: SlotValue::Name(value.clone()),
                })),
                Err(error) => issues.push(PackIssue::error(
                    format!("{location}.{value}[{index}]"),
                    error.to_string(),
                )),
            }
        }
    }

    phrases
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pack::Severity;

    fn commands(json: &str) -> CommandsFile {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn recognises_a_sentence_with_its_slot_values() {
        let (grammar, issues) = compile(
            "ru",
            &commands(
                r#"{ "format": 1, "intents": {
                    "pit.fuel": ["(топливо|залей) {number} [литров]"],
                    "pit.tires": ["меняем {tires}"]
                }, "slots": { "tires": { "front": ["передние"], "all": ["все [четыре]"] } } }"#,
            ),
        );

        assert!(issues.is_empty(), "{issues:?}");

        let fuel = grammar.recognise("залей сорок пять литров").unwrap();

        assert_eq!(fuel.intent, "pit.fuel");
        assert_eq!(fuel.slot("number"), Some(&SlotValue::Number(45)));

        let tires = grammar.recognise("меняем все четыре").unwrap();

        assert_eq!(tires.slot("tires"), Some(&SlotValue::Name("all".into())));
        assert_eq!(grammar.recognise("меняем задние"), None);
    }

    #[test]
    fn hands_vosk_every_sentence_and_unknown() {
        let (grammar, _) = compile(
            "en",
            &commands(r#"{ "format": 1, "intents": { "control.repeat": ["[say it] again"] } }"#),
        );
        let phrases: Vec<String> = serde_json::from_str(&grammar.vosk_grammar()).unwrap();

        assert_eq!(
            phrases,
            vec!["say it again", "again", "and", "then", "[unk]"]
        );
    }

    #[test]
    fn splits_commands_said_together_and_skips_what_joins_them() {
        let (grammar, _) = compile(
            "ru",
            &commands(
                r#"{ "format": 1, "intents": {
                    "pit.fuel": ["залей {number} [литров]"],
                    "pit.tires": ["меняй {tires}"],
                    "control.repeat": ["ещё раз"]
                }, "slots": { "tires": { "front": ["передние"] } } }"#,
            ),
        );
        let intents = |text: &str| -> Vec<String> {
            grammar
                .recognise_all(text)
                .into_iter()
                .map(|recognised| recognised.intent.clone())
                .collect()
        };

        let both = grammar.recognise_all("залей сорок пять и потом меняй передние");

        assert_eq!(both.len(), 2);
        assert_eq!(both[0].slot("number"), Some(&SlotValue::Number(45)));
        assert_eq!(
            intents("залей сорок меняй передние"),
            ["pit.fuel", "pit.tires"]
        );
        assert_eq!(
            intents("залей сорок ещё раз"),
            ["pit.fuel", "control.repeat"]
        );
        assert_eq!(intents("ещё залей сорок"), ["pit.fuel"]);
        assert!(intents("залей сорок [unk] меняй передние").is_empty());
        assert!(intents("меняй передние задние").is_empty());
        assert!(intents("и потом").is_empty());
        assert!(intents("").is_empty());
    }

    #[test]
    fn reports_a_sentence_two_intents_claim() {
        let (grammar, issues) = compile(
            "en",
            &commands(
                r#"{ "format": 1, "intents": {
                    "query.bestLap": ["(best|lap) time"],
                    "query.lastLap": ["lap [time]"]
                } }"#,
            ),
        );

        assert_eq!(
            grammar.conflicts,
            vec![Conflict {
                sentence: "lap time".into(),
                intents: vec!["query.bestLap".into(), "query.lastLap".into()],
            }]
        );
        assert_eq!(
            grammar.recognise("lap time").unwrap().intent,
            "query.bestLap"
        );
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].severity, Severity::Warning);
    }

    #[test]
    fn refuses_unknown_intents_slots_and_values() {
        let (grammar, issues) = compile(
            "en",
            &commands(
                r#"{ "format": 1, "intents": {
                    "pit.teleport": ["beam me up"],
                    "query.fuel": ["fuel {number}"]
                }, "slots": { "tires": { "middle": ["middle"] }, "mood": { "happy": ["yay"] } } }"#,
            ),
        );
        let locations: Vec<&str> = issues.iter().map(|issue| issue.location.as_str()).collect();

        assert_eq!(grammar.sentence_count(), 0);
        assert_eq!(
            locations,
            vec![
                "commands.slots.mood",
                "commands.slots.tires.middle",
                "commands.intents.pit.teleport",
                "commands.intents.query.fuel[0]",
            ]
        );
    }

    #[test]
    fn matches_whatever_spacing_and_case_the_recogniser_returns() {
        let (grammar, _) = compile(
            "en",
            &commands(r#"{ "format": 1, "intents": { "query.fuel": ["how much fuel"] } }"#),
        );

        assert!(grammar.recognise("  How much   fuel ").is_some());
    }
}
