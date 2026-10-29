//! The phrase text format: the subset of ICU MessageFormat a spoken reply
//! needs — `{name}` for a value and `{name, plural, one {…} few {…} other {…}}`
//! for the word that agrees with a number, `#` inside a case standing for it.

use std::collections::HashMap;
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum Part {
    Text(String),
    Value(String),
    /// `#` inside a plural case: the number that chose it.
    Count,
    Plural {
        name: String,
        cases: Vec<(PluralKey, Vec<Part>)>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum PluralKey {
    Exact(u32),
    Category(PluralCategory),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PluralCategory {
    Zero,
    One,
    Two,
    Few,
    Many,
    Other,
}

impl PluralCategory {
    fn named(name: &str) -> Option<Self> {
        match name {
            "zero" => Some(Self::Zero),
            "one" => Some(Self::One),
            "two" => Some(Self::Two),
            "few" => Some(Self::Few),
            "many" => Some(Self::Many),
            "other" => Some(Self::Other),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MessageError {
    Unclosed,
    Unexpected(char),
    UnknownFormat(String),
    UnknownCase(String),
    NoCases(String),
    UnknownValue(String),
}

impl fmt::Display for MessageError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unclosed => write!(formatter, "a '{{' is never closed"),
            Self::Unexpected(character) => write!(formatter, "unexpected '{character}'"),
            Self::UnknownFormat(format) => {
                write!(formatter, "unknown format '{format}', only plural")
            }
            Self::UnknownCase(case) => write!(formatter, "unknown plural case '{case}'"),
            Self::NoCases(name) => write!(formatter, "{{{name}, plural}} has no cases"),
            Self::UnknownValue(name) => write!(formatter, "this phrase has no value {{{name}}}"),
        }
    }
}

/// A value a reply is filled with.
#[derive(Debug, Clone, PartialEq)]
pub enum Arg {
    Number(f64),
    Text(String),
}

pub type Args<'a> = HashMap<&'a str, Arg>;

pub fn parse(text: &str) -> Result<Vec<Part>, MessageError> {
    let characters: Vec<char> = text.chars().collect();
    let mut cursor = 0;
    let parts = parse_parts(&characters, &mut cursor, false)?;

    match characters.get(cursor) {
        Some(&character) => Err(MessageError::Unexpected(character)),
        None => Ok(parts),
    }
}

/// Text up to the end, or up to the `}` that closes a plural case when
/// `in_case` — `#` means the count only there.
fn parse_parts(
    characters: &[char],
    cursor: &mut usize,
    in_case: bool,
) -> Result<Vec<Part>, MessageError> {
    let mut parts = Vec::new();
    let mut text = String::new();

    while let Some(&character) = characters.get(*cursor) {
        match character {
            '{' => {
                *cursor += 1;
                flush_text(&mut text, &mut parts);
                parts.push(parse_argument(characters, cursor)?);
            }
            '}' if in_case => break,
            '}' => return Err(MessageError::Unexpected('}')),
            '#' if in_case => {
                *cursor += 1;
                flush_text(&mut text, &mut parts);
                parts.push(Part::Count);
            }
            _ => {
                *cursor += 1;
                text.push(character);
            }
        }
    }

    flush_text(&mut text, &mut parts);

    Ok(parts)
}

fn flush_text(text: &mut String, parts: &mut Vec<Part>) {
    if !text.is_empty() {
        parts.push(Part::Text(std::mem::take(text)));
    }
}

/// After a `{`: `name}` or `name, plural, cases}`.
fn parse_argument(characters: &[char], cursor: &mut usize) -> Result<Part, MessageError> {
    let name = read_until(characters, cursor, &[',', '}'])?;

    if take(characters, cursor) == Some('}') {
        return Ok(Part::Value(name));
    }

    let format = read_until(characters, cursor, &[',', '}'])?;

    if format != "plural" {
        return Err(MessageError::UnknownFormat(format));
    }

    if take(characters, cursor) != Some(',') {
        return Err(MessageError::NoCases(name));
    }

    let mut cases = Vec::new();

    loop {
        skip_whitespace(characters, cursor);

        match characters.get(*cursor) {
            Some('}') => {
                *cursor += 1;
                break;
            }
            Some(_) => {}
            None => return Err(MessageError::Unclosed),
        }

        let key_text = read_until(characters, cursor, &['{'])?;
        let key = plural_key(&key_text)?;

        *cursor += 1;

        let body = parse_parts(characters, cursor, true)?;

        if take(characters, cursor) != Some('}') {
            return Err(MessageError::Unclosed);
        }

        cases.push((key, body));
    }

    if cases.is_empty() {
        return Err(MessageError::NoCases(name));
    }

    Ok(Part::Plural { name, cases })
}

fn plural_key(text: &str) -> Result<PluralKey, MessageError> {
    if let Some(exact) = text.strip_prefix('=') {
        return exact
            .parse()
            .map(PluralKey::Exact)
            .map_err(|_| MessageError::UnknownCase(text.to_string()));
    }

    PluralCategory::named(text)
        .map(PluralKey::Category)
        .ok_or_else(|| MessageError::UnknownCase(text.to_string()))
}

/// The trimmed text before the first of `stops`, leaving the cursor on it.
fn read_until(
    characters: &[char],
    cursor: &mut usize,
    stops: &[char],
) -> Result<String, MessageError> {
    let mut text = String::new();

    while let Some(&character) = characters.get(*cursor) {
        if stops.contains(&character) {
            return Ok(text.trim().to_string());
        }

        text.push(character);
        *cursor += 1;
    }

    Err(MessageError::Unclosed)
}

fn take(characters: &[char], cursor: &mut usize) -> Option<char> {
    let character = characters.get(*cursor).copied();

    *cursor += 1;

    character
}

fn skip_whitespace(characters: &[char], cursor: &mut usize) {
    while characters
        .get(*cursor)
        .is_some_and(|character| character.is_whitespace())
    {
        *cursor += 1;
    }
}

/// Every value the message reads, so a phrase can be checked against the
/// values its key provides.
pub fn values_used(parts: &[Part]) -> Vec<String> {
    let mut names = Vec::new();

    collect_values(parts, &mut names);
    names
}

fn collect_values(parts: &[Part], names: &mut Vec<String>) {
    for part in parts {
        match part {
            Part::Value(name) => names.push(name.clone()),
            Part::Plural { name, cases } => {
                names.push(name.clone());

                for (_, body) in cases {
                    collect_values(body, names);
                }
            }
            Part::Text(_) | Part::Count => {}
        }
    }
}

/// The message with its values filled in. A value the caller did not pass is
/// an error rather than an empty gap read out loud.
pub fn format(parts: &[Part], language: &str, args: &Args<'_>) -> Result<String, MessageError> {
    let mut out = String::new();

    write_parts(parts, language, args, None, &mut out)?;

    Ok(out)
}

fn write_parts(
    parts: &[Part],
    language: &str,
    args: &Args<'_>,
    count: Option<f64>,
    out: &mut String,
) -> Result<(), MessageError> {
    for part in parts {
        match part {
            Part::Text(text) => out.push_str(text),
            Part::Count => {
                if let Some(number) = count {
                    out.push_str(&format_number(number, language));
                }
            }
            Part::Value(name) => match args.get(name.as_str()) {
                Some(Arg::Number(number)) => out.push_str(&format_number(*number, language)),
                Some(Arg::Text(text)) => out.push_str(text),
                None => return Err(MessageError::UnknownValue(name.clone())),
            },
            Part::Plural { name, cases } => {
                let Some(Arg::Number(number)) = args.get(name.as_str()) else {
                    return Err(MessageError::UnknownValue(name.clone()));
                };
                let Some(body) = pick_case(cases, *number, language) else {
                    return Err(MessageError::NoCases(name.clone()));
                };

                write_parts(body, language, args, Some(*number), out)?;
            }
        }
    }

    Ok(())
}

/// An exact `=N` first, then the language's category, then `other`, then the
/// last case written — a pack missing `other` still says something.
fn pick_case<'a>(
    cases: &'a [(PluralKey, Vec<Part>)],
    number: f64,
    language: &str,
) -> Option<&'a [Part]> {
    let exact = cases
        .iter()
        .find(|(key, _)| matches!(key, PluralKey::Exact(exact) if f64::from(*exact) == number));
    let category = plural_category(language, number);
    let by_category = || {
        cases
            .iter()
            .find(|(key, _)| *key == PluralKey::Category(category))
    };
    let other = || {
        cases
            .iter()
            .find(|(key, _)| *key == PluralKey::Category(PluralCategory::Other))
    };

    exact
        .or_else(by_category)
        .or_else(other)
        .or(cases.last())
        .map(|(_, body)| body.as_slice())
}

/// CLDR cardinal rules for the built-in languages; anything else is `other`.
pub fn plural_category(language: &str, number: f64) -> PluralCategory {
    if number.fract() != 0.0 {
        return PluralCategory::Other;
    }

    let whole = number.abs() as u64;

    match language {
        "en" | "es" if whole == 1 => PluralCategory::One,
        "ru" => {
            let last = whole % 10;
            let last_two = whole % 100;

            if last == 1 && last_two != 11 {
                PluralCategory::One
            } else if (2..=4).contains(&last) && !(12..=14).contains(&last_two) {
                PluralCategory::Few
            } else {
                PluralCategory::Many
            }
        }
        _ => PluralCategory::Other,
    }
}

/// Whole numbers as they are, anything else to one decimal in the language's
/// own separator — that is what the synthesiser reads out.
pub fn format_number(number: f64, language: &str) -> String {
    if number.fract() == 0.0 {
        return format!("{number:.0}");
    }

    let text = format!("{number:.1}");

    if matches!(language, "ru" | "es") {
        text.replace('.', ",")
    } else {
        text
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn say(text: &str, language: &str, args: &[(&'static str, Arg)]) -> String {
        let parts = parse(text).unwrap();

        format(&parts, language, &args.iter().cloned().collect()).unwrap()
    }

    const LITERS: &str = "Принято, {liters, plural, one {# литр} few {# литра} many {# литров}}";

    #[test]
    fn agrees_russian_words_with_the_number() {
        assert_eq!(
            say(LITERS, "ru", &[("liters", Arg::Number(21.0))]),
            "Принято, 21 литр"
        );
        assert_eq!(
            say(LITERS, "ru", &[("liters", Arg::Number(43.0))]),
            "Принято, 43 литра"
        );
        assert_eq!(
            say(LITERS, "ru", &[("liters", Arg::Number(12.0))]),
            "Принято, 12 литров"
        );
        assert_eq!(
            say(LITERS, "ru", &[("liters", Arg::Number(40.0))]),
            "Принято, 40 литров"
        );
    }

    #[test]
    fn prefers_an_exact_case_and_falls_back_to_other() {
        let text = "{laps, plural, =0 {no laps} one {# lap} other {# laps}}";

        assert_eq!(say(text, "en", &[("laps", Arg::Number(0.0))]), "no laps");
        assert_eq!(say(text, "en", &[("laps", Arg::Number(1.0))]), "1 lap");
        assert_eq!(say(text, "en", &[("laps", Arg::Number(2.5))]), "2.5 laps");
    }

    #[test]
    fn fills_plain_values_with_the_language_separator() {
        assert_eq!(
            say(
                "Отрыв {gap} секунды от {driver}",
                "ru",
                &[
                    ("gap", Arg::Number(1.3)),
                    ("driver", Arg::Text("Иванов".into())),
                ]
            ),
            "Отрыв 1,3 секунды от Иванов"
        );
    }

    #[test]
    fn lists_the_values_a_message_reads() {
        let parts = parse("{a} and {b, plural, other {# {c}}}").unwrap();

        assert_eq!(values_used(&parts), vec!["a", "b", "c"]);
    }

    #[test]
    fn refuses_a_broken_message() {
        assert_eq!(parse("{laps"), Err(MessageError::Unclosed));
        assert_eq!(parse("text }"), Err(MessageError::Unexpected('}')));
        assert_eq!(
            parse("{n, select, a {x}}"),
            Err(MessageError::UnknownFormat("select".into()))
        );
        assert_eq!(
            parse("{n, plural, lots {x}}"),
            Err(MessageError::UnknownCase("lots".into()))
        );
    }

    #[test]
    fn refuses_to_read_out_a_missing_value() {
        let parts = parse("Gap {gap}").unwrap();

        assert_eq!(
            format(&parts, "en", &HashMap::new()),
            Err(MessageError::UnknownValue("gap".into()))
        );
    }
}
