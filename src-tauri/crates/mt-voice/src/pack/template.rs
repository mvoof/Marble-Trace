//! Command templates: `(a|b)` picks one, `[x]` may be left out, `{slot}` is a
//! typed value. A template is expanded into every sentence it allows, because
//! that is what a recogniser in grammar mode is given — a closed list.

use std::fmt;

/// Past this many sentences a template is refused rather than expanded: the
/// recogniser's grammar grows with every one of them.
pub const MAX_SENTENCES_PER_TEMPLATE: usize = 20_000;

#[derive(Debug, Clone, PartialEq)]
pub enum Node {
    Word(String),
    Slot(String),
    Choice(Vec<Vec<Node>>),
    Optional(Vec<Node>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TemplateError {
    Unclosed(char),
    Unexpected(char),
    EmptySlot,
    UnknownSlot(String),
    TooManySentences,
}

impl fmt::Display for TemplateError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unclosed(bracket) => write!(formatter, "'{bracket}' is never closed"),
            Self::Unexpected(character) => write!(formatter, "unexpected '{character}'"),
            Self::EmptySlot => write!(formatter, "a slot needs a name: {{name}}"),
            Self::UnknownSlot(name) => write!(formatter, "unknown slot {{{name}}}"),
            Self::TooManySentences => write!(
                formatter,
                "expands to more than {MAX_SENTENCES_PER_TEMPLATE} sentences"
            ),
        }
    }
}

/// What a slot stands for once a sentence is recognised.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum SlotValue {
    Number(u32),
    Name(String),
}

/// One way to say a slot's value.
#[derive(Debug, Clone, PartialEq)]
pub struct SlotPhrase {
    pub words: Vec<String>,
    pub value: SlotValue,
}

/// One sentence a template allows, with the values its slots took.
#[derive(Debug, Clone, PartialEq)]
pub struct Sentence {
    pub words: Vec<String>,
    pub slots: Vec<(String, SlotValue)>,
}

impl Sentence {
    pub fn text(&self) -> String {
        self.words.join(" ")
    }
}

pub fn parse(template: &str) -> Result<Vec<Node>, TemplateError> {
    let characters: Vec<char> = template.chars().collect();
    let mut cursor = 0;
    let (nodes, stop) = parse_sequence(&characters, &mut cursor)?;

    match stop {
        Some(character) => Err(TemplateError::Unexpected(character)),
        None => Ok(nodes),
    }
}

/// Reads until a character that ends a sequence — `|`, `)` or `]` — and hands
/// that character back to the caller, which knows whether it is allowed there.
fn parse_sequence(
    characters: &[char],
    cursor: &mut usize,
) -> Result<(Vec<Node>, Option<char>), TemplateError> {
    let mut nodes = Vec::new();
    let mut word = String::new();

    while let Some(&character) = characters.get(*cursor) {
        *cursor += 1;

        if character.is_whitespace() || "()[]{}|".contains(character) {
            flush_word(&mut word, &mut nodes);
        }

        match character {
            '(' => nodes.push(parse_choice(characters, cursor)?),
            '[' => {
                let (inner, stop) = parse_sequence(characters, cursor)?;

                if stop != Some(']') {
                    return Err(
                        stop.map_or(TemplateError::Unclosed('['), TemplateError::Unexpected)
                    );
                }

                nodes.push(Node::Optional(inner));
            }
            '{' => nodes.push(parse_slot(characters, cursor)?),
            '|' | ')' | ']' => return Ok((nodes, Some(character))),
            '}' => return Err(TemplateError::Unexpected('}')),
            _ if character.is_whitespace() => {}
            _ => word.extend(character.to_lowercase()),
        }
    }

    flush_word(&mut word, &mut nodes);

    Ok((nodes, None))
}

fn parse_choice(characters: &[char], cursor: &mut usize) -> Result<Node, TemplateError> {
    let mut alternatives = Vec::new();

    loop {
        let (alternative, stop) = parse_sequence(characters, cursor)?;

        alternatives.push(alternative);

        match stop {
            Some('|') => {}
            Some(')') => return Ok(Node::Choice(alternatives)),
            Some(other) => return Err(TemplateError::Unexpected(other)),
            None => return Err(TemplateError::Unclosed('(')),
        }
    }
}

fn parse_slot(characters: &[char], cursor: &mut usize) -> Result<Node, TemplateError> {
    let mut name = String::new();

    while let Some(&character) = characters.get(*cursor) {
        *cursor += 1;

        if character == '}' {
            let name = name.trim().to_string();

            if name.is_empty() {
                return Err(TemplateError::EmptySlot);
            }

            return Ok(Node::Slot(name));
        }

        name.push(character);
    }

    Err(TemplateError::Unclosed('{'))
}

fn flush_word(word: &mut String, nodes: &mut Vec<Node>) {
    if !word.is_empty() {
        nodes.push(Node::Word(std::mem::take(word)));
    }
}

/// Every sentence the nodes allow. `slot_phrases` names the ways to say each
/// slot; a slot it does not know is an error, not a silent gap.
pub fn expand<'a>(
    nodes: &[Node],
    slot_phrases: &dyn Fn(&str) -> Option<&'a [SlotPhrase]>,
) -> Result<Vec<Sentence>, TemplateError> {
    let mut sentences = vec![Sentence {
        words: Vec::new(),
        slots: Vec::new(),
    }];

    for node in nodes {
        sentences = append_node(sentences, node, slot_phrases)?;

        if sentences.len() > MAX_SENTENCES_PER_TEMPLATE {
            return Err(TemplateError::TooManySentences);
        }
    }

    Ok(sentences)
}

fn append_node<'a>(
    sentences: Vec<Sentence>,
    node: &Node,
    slot_phrases: &dyn Fn(&str) -> Option<&'a [SlotPhrase]>,
) -> Result<Vec<Sentence>, TemplateError> {
    let tails: Vec<Sentence> = match node {
        Node::Word(word) => vec![Sentence {
            words: vec![word.clone()],
            slots: Vec::new(),
        }],
        Node::Slot(name) => slot_phrases(name)
            .ok_or_else(|| TemplateError::UnknownSlot(name.clone()))?
            .iter()
            .map(|phrase| Sentence {
                words: phrase.words.clone(),
                slots: vec![(name.clone(), phrase.value.clone())],
            })
            .collect(),
        Node::Choice(alternatives) => {
            let mut tails = Vec::new();

            for alternative in alternatives {
                tails.extend(expand(alternative, slot_phrases)?);
            }

            tails
        }
        Node::Optional(inner) => {
            let mut tails = expand(inner, slot_phrases)?;

            tails.push(Sentence {
                words: Vec::new(),
                slots: Vec::new(),
            });

            tails
        }
    };

    if sentences.len().saturating_mul(tails.len()) > MAX_SENTENCES_PER_TEMPLATE {
        return Err(TemplateError::TooManySentences);
    }

    let mut joined = Vec::with_capacity(sentences.len() * tails.len());

    for head in &sentences {
        for tail in &tails {
            let mut sentence = head.clone();

            sentence.words.extend(tail.words.iter().cloned());
            sentence.slots.extend(tail.slots.iter().cloned());
            joined.push(sentence);
        }
    }

    Ok(joined)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn texts(template: &str) -> Vec<String> {
        let nodes = parse(template).unwrap();
        let mut texts: Vec<String> = expand(&nodes, &|_| None)
            .unwrap()
            .iter()
            .map(Sentence::text)
            .collect();

        texts.sort();
        texts
    }

    #[test]
    fn expands_choices_and_optional_words() {
        assert_eq!(
            texts("[а] (сколько|что по) топлива"),
            vec![
                "а сколько топлива",
                "а что по топлива",
                "сколько топлива",
                "что по топлива",
            ]
        );
    }

    #[test]
    fn lowercases_and_collapses_spaces() {
        assert_eq!(texts("  Box   Box "), vec!["box box"]);
    }

    #[test]
    fn nests_a_choice_inside_an_optional() {
        assert_eq!(
            texts("fuel [(please|now)]"),
            vec!["fuel", "fuel now", "fuel please"]
        );
    }

    #[test]
    fn fills_a_slot_and_records_its_value() {
        let phrases = [
            SlotPhrase {
                words: vec!["forty".into()],
                value: SlotValue::Number(40),
            },
            SlotPhrase {
                words: vec!["forty".into(), "five".into()],
                value: SlotValue::Number(45),
            },
        ];
        let nodes = parse("fuel {number}").unwrap();
        let sentences = expand(&nodes, &|name| (name == "number").then_some(&phrases[..])).unwrap();

        assert_eq!(sentences[1].text(), "fuel forty five");
        assert_eq!(
            sentences[1].slots,
            vec![("number".to_string(), SlotValue::Number(45))]
        );
    }

    #[test]
    fn refuses_broken_brackets_and_unknown_slots() {
        assert_eq!(parse("(a|b"), Err(TemplateError::Unclosed('(')));
        assert_eq!(parse("a]"), Err(TemplateError::Unexpected(']')));
        assert_eq!(parse("[a)"), Err(TemplateError::Unexpected(')')));
        assert_eq!(parse("{}"), Err(TemplateError::EmptySlot));

        let nodes = parse("{tires}").unwrap();

        assert_eq!(
            expand(&nodes, &|_| None),
            Err(TemplateError::UnknownSlot("tires".into()))
        );
    }

    #[test]
    fn refuses_a_template_that_explodes() {
        let nodes = parse(&"(a|b|c|d|e|f|g|h|i|j) ".repeat(6)).unwrap();

        assert_eq!(
            expand(&nodes, &|_| None),
            Err(TemplateError::TooManySentences)
        );
    }
}
