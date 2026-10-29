//! The ways a reply can be put: `(Copy|Got it), [setting] {liters}` is four
//! sayings of one variant. The marks are the driver's sentences' own — `(a|b)`
//! one of, `[a]` may be left out — and never reach into a `{value}` or a
//! plural, whose braces are copied as they stand.

use std::fmt;

/// The most sayings one variant may have: each fixed one is a sound file of
/// its own.
pub const MAX_SAYINGS: usize = 16;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SayingsError {
    /// A `(`, `[` or `{` with no closing mark.
    Unclosed(char),
    /// A `)`, `]` or `|` with nothing open for it.
    Unexpected(char),
    TooMany(usize),
}

impl fmt::Display for SayingsError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unclosed(mark) => write!(formatter, "'{mark}' is never closed"),
            Self::Unexpected(mark) => write!(formatter, "'{mark}' has nothing open to close"),
            Self::TooMany(count) => write!(
                formatter,
                "{count} ways to say it, at most {MAX_SAYINGS} — fewer choices"
            ),
        }
    }
}

/// Every way `text` can be said. Text without marks is its one saying,
/// untouched — the name its sound file is cached under stays the same.
pub fn sayings(text: &str) -> Result<Vec<String>, SayingsError> {
    let characters: Vec<char> = text.chars().collect();

    if !has_marks(&characters) {
        return Ok(vec![text.to_string()]);
    }

    let mut cursor = 0;
    let alternatives = sequence(&characters, &mut cursor)?;

    if let Some(&mark) = characters.get(cursor) {
        return Err(SayingsError::Unexpected(mark));
    }

    let mut said: Vec<String> = Vec::new();

    for saying in alternatives.iter().map(|saying| tidy(saying)) {
        if !said.contains(&saying) {
            said.push(saying);
        }
    }

    Ok(said)
}

/// A choice or an optional part outside the braces.
fn has_marks(characters: &[char]) -> bool {
    let mut depth = 0usize;

    characters.iter().any(|&character| {
        match character {
            '{' => depth += 1,
            '}' => depth = depth.saturating_sub(1),
            _ => {}
        }

        depth == 0 && matches!(character, '(' | ')' | '[' | ']' | '|')
    })
}

/// The ways the text from `cursor` can be said, up to a `|` or a closing mark
/// left for the caller.
fn sequence(characters: &[char], cursor: &mut usize) -> Result<Vec<String>, SayingsError> {
    let mut said = vec![String::new()];

    while let Some(&character) = characters.get(*cursor) {
        match character {
            '|' | ')' | ']' => break,
            '{' => {
                let braced = braces(characters, cursor)?;

                said.iter_mut().for_each(|saying| saying.push_str(&braced));
            }
            '(' | '[' => {
                *cursor += 1;

                let close = if character == '(' { ')' } else { ']' };
                let mut options = alternatives(characters, cursor, character, close)?;

                if character == '[' {
                    options.push(String::new());
                }

                said = product(&said, &options)?;
            }
            _ => {
                said.iter_mut().for_each(|saying| saying.push(character));
                *cursor += 1;
            }
        }
    }

    Ok(said)
}

/// The options of a choice, the cursor past its closing mark.
fn alternatives(
    characters: &[char],
    cursor: &mut usize,
    open: char,
    close: char,
) -> Result<Vec<String>, SayingsError> {
    let mut options = Vec::new();

    loop {
        options.extend(sequence(characters, cursor)?);

        match characters.get(*cursor) {
            Some('|') => *cursor += 1,
            Some(&mark) if mark == close => {
                *cursor += 1;

                return Ok(options);
            }
            Some(&mark) => return Err(SayingsError::Unexpected(mark)),
            None => return Err(SayingsError::Unclosed(open)),
        }
    }
}

/// A `{…}` as it stands, nested braces and all, the cursor past it.
fn braces(characters: &[char], cursor: &mut usize) -> Result<String, SayingsError> {
    let mut depth = 0usize;
    let mut braced = String::new();

    while let Some(&character) = characters.get(*cursor) {
        braced.push(character);
        *cursor += 1;

        match character {
            '{' => depth += 1,
            '}' => {
                depth -= 1;

                if depth == 0 {
                    return Ok(braced);
                }
            }
            _ => {}
        }
    }

    Err(SayingsError::Unclosed('{'))
}

fn product(said: &[String], options: &[String]) -> Result<Vec<String>, SayingsError> {
    let count = said.len() * options.len();

    if count > MAX_SAYINGS {
        return Err(SayingsError::TooMany(count));
    }

    Ok(said
        .iter()
        .flat_map(|saying| {
            options
                .iter()
                .map(move |option| format!("{saying}{option}"))
        })
        .collect())
}

/// One space between words and none before a mark of punctuation: what is
/// left where an optional part was taken out.
fn tidy(saying: &str) -> String {
    let words = saying.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut tidied = String::with_capacity(words.len());

    for character in words.chars() {
        if matches!(character, ',' | '.' | '!' | '?' | ':' | ';') && tidied.ends_with(' ') {
            tidied.pop();
        }

        tidied.push(character);
    }

    tidied.trim_start_matches([',', ' ']).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_without_marks_is_said_as_it_stands() {
        assert_eq!(
            sayings("Принято,  {liters, plural, one {# литр} other {# литров}}").unwrap(),
            ["Принято,  {liters, plural, one {# литр} other {# литров}}"]
        );
    }

    #[test]
    fn says_every_choice_and_leaves_out_an_optional_part() {
        assert_eq!(
            sayings("(Принято|Понял), [ставим] {liters}").unwrap(),
            [
                "Принято, ставим {liters}",
                "Принято, {liters}",
                "Понял, ставим {liters}",
                "Понял, {liters}",
            ]
        );
    }

    #[test]
    fn tidies_what_an_optional_part_leaves() {
        assert_eq!(
            sayings("Copy[, mate]. Fuel set").unwrap(),
            ["Copy, mate. Fuel set", "Copy. Fuel set"]
        );
        assert_eq!(sayings("[Okay,] box").unwrap(), ["Okay, box", "box"]);
    }

    #[test]
    fn a_choice_may_hold_values_and_other_choices() {
        assert_eq!(
            sayings("(Залили {liters}|(Есть|Готово))").unwrap(),
            ["Залили {liters}", "Есть", "Готово"]
        );
    }

    #[test]
    fn leaves_the_braces_alone() {
        assert_eq!(
            sayings("[Ну,] {liters, plural, one {(литр)} other {[литров]}}").unwrap(),
            [
                "Ну, {liters, plural, one {(литр)} other {[литров]}}",
                "{liters, plural, one {(литр)} other {[литров]}}",
            ]
        );
    }

    #[test]
    fn refuses_unbalanced_marks_and_too_many_sayings() {
        assert_eq!(sayings("(a|b"), Err(SayingsError::Unclosed('(')));
        assert_eq!(sayings("a]"), Err(SayingsError::Unexpected(']')));
        assert_eq!(sayings("(a|b]"), Err(SayingsError::Unexpected(']')));
        assert_eq!(
            sayings("[a] [b] [c] [d] [e]"),
            Err(SayingsError::TooMany(32))
        );
    }
}
