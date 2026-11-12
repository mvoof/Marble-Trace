//! How the built-in languages say a number, for the `{number}` slot, and a
//! car number as it is heard.
//!
//! The `{number}` slot hears whole numbers up to `MAX_NUMBER_SLOT_VALUE`:
//! every one of them is a branch of each command that takes a number, and
//! nothing a driver orders by voice — liters of fuel — goes past it. A car
//! number is heard only as one of the session's cars wears it; with no session
//! known, as any number the slot hears, leading zeros and all.

use crate::pack::template::{SlotPhrase, SlotValue};

pub use mt_model::contract::defaults::MAX_NUMBER_SLOT_VALUE;
/// "zero seven", "zero zero seven": iRacing numbers carry up to two.
const MAX_LEADING_ZEROS: usize = 2;
/// iRacing's longest car number.
const MAX_CAR_NUMBER_DIGITS: usize = 3;
/// The hundreds tables end at nine hundred.
const MAX_SPELLED: u32 = 999;
const ZERO_DIGIT: char = '0';
/// Chinese numbers are spoken without spaces; the recogniser's dictionary
/// holds them a character a word.
const UNSPACED_LANGUAGES: [&str; 1] = ["zh"];

const _: () = assert!(MAX_NUMBER_SLOT_VALUE <= MAX_SPELLED);
const _: () = assert!(10u32.pow(MAX_CAR_NUMBER_DIGITS as u32) - 1 <= MAX_SPELLED);

const RU_UNITS: [&str; 20] = [
    "ноль",
    "один",
    "два",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
];
const RU_TENS: [&str; 10] = [
    "",
    "",
    "двадцать",
    "тридцать",
    "сорок",
    "пятьдесят",
    "шестьдесят",
    "семьдесят",
    "восемьдесят",
    "девяносто",
];
const RU_HUNDREDS: [&str; 10] = [
    "",
    "сто",
    "двести",
    "триста",
    "четыреста",
    "пятьсот",
    "шестьсот",
    "семьсот",
    "восемьсот",
    "девятьсот",
];

const EN_UNITS: [&str; 20] = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
];
const EN_TENS: [&str; 10] = [
    "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
];
const EN_HUNDREDS: [&str; 10] = [
    "",
    "one hundred",
    "two hundred",
    "three hundred",
    "four hundred",
    "five hundred",
    "six hundred",
    "seven hundred",
    "eight hundred",
    "nine hundred",
];

/// Spanish says every number below thirty as one word.
const ES_UNITS: [&str; 30] = [
    "cero",
    "uno",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
    "dieciséis",
    "diecisiete",
    "dieciocho",
    "diecinueve",
    "veinte",
    "veintiuno",
    "veintidós",
    "veintitrés",
    "veinticuatro",
    "veinticinco",
    "veintiséis",
    "veintisiete",
    "veintiocho",
    "veintinueve",
];
/// "cien" alone, "ciento" before more.
const ES_HUNDREDS: [&str; 10] = [
    "",
    "ciento",
    "doscientos",
    "trescientos",
    "cuatrocientos",
    "quinientos",
    "seiscientos",
    "setecientos",
    "ochocientos",
    "novecientos",
];
const ES_TENS: [&str; 10] = [
    "",
    "",
    "",
    "treinta",
    "cuarenta",
    "cincuenta",
    "sesenta",
    "setenta",
    "ochenta",
    "noventa",
];

const ZH_DIGITS: [&str; 10] = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
/// Two hundred is "两百", not "二百".
const ZH_TWO_HUNDREDS: &str = "两";
const ZH_TEN: &str = "十";
const ZH_HUNDRED: &str = "百";

struct NumberWords {
    units: [&'static str; 20],
    tens: [&'static str; 10],
    hundreds: [&'static str; 10],
}

const RU: NumberWords = NumberWords {
    units: RU_UNITS,
    tens: RU_TENS,
    hundreds: RU_HUNDREDS,
};
const EN: NumberWords = NumberWords {
    units: EN_UNITS,
    tens: EN_TENS,
    hundreds: EN_HUNDREDS,
};

/// The number's words, or `None` for a language with no built-in dictionary.
pub fn spoken(language: &str, number: u32) -> Option<String> {
    if number > MAX_NUMBER_SLOT_VALUE {
        return None;
    }

    spelled(language, number)
}

/// Any number the tables spell: car numbers go past `MAX_NUMBER_SLOT_VALUE`.
fn spelled(language: &str, number: u32) -> Option<String> {
    if number > MAX_SPELLED {
        return None;
    }

    match language {
        "ru" => Some(spell(&RU, number)),
        "en" => Some(spell(&EN, number)),
        "es" => Some(spell_spanish(number)),
        "zh" => Some(spell_chinese(number)),
        _ => None,
    }
}

/// A character to a word, as the recogniser's dictionary holds them:
/// "四 十 五", "十 二" without a leading one, "一 百 零 五" for a gap.
fn spell_chinese(number: u32) -> String {
    let hundreds = (number / 100) as usize;
    let tens = (number % 100 / 10) as usize;
    let units = (number % 10) as usize;
    let mut parts: Vec<&str> = Vec::new();

    if hundreds == 2 {
        parts.extend([ZH_TWO_HUNDREDS, ZH_HUNDRED]);
    } else if hundreds > 0 {
        parts.extend([ZH_DIGITS[hundreds], ZH_HUNDRED]);
    }

    if tens > 0 {
        if hundreds > 0 || tens > 1 {
            parts.push(ZH_DIGITS[tens]);
        }

        parts.push(ZH_TEN);
    } else if hundreds > 0 && units > 0 {
        parts.push(ZH_DIGITS[0]);
    }

    if units > 0 || number == 0 {
        parts.push(ZH_DIGITS[units]);
    }

    parts.join(" ")
}

/// "treinta y uno", "cien" alone but "ciento uno", "doscientos".
fn spell_spanish(number: u32) -> String {
    let hundreds = number / 100;
    let rest = (number % 100) as usize;
    let mut parts: Vec<&str> = Vec::new();

    match (hundreds, rest) {
        (0, _) => {}
        (1, 0) => parts.push("cien"),
        _ => parts.push(ES_HUNDREDS[hundreds as usize]),
    }

    if rest >= ES_UNITS.len() {
        parts.push(ES_TENS[rest / 10]);

        if !rest.is_multiple_of(10) {
            parts.push("y");
            parts.push(ES_UNITS[rest % 10]);
        }
    } else if rest > 0 || hundreds == 0 {
        parts.push(ES_UNITS[rest]);
    }

    parts.join(" ")
}

fn spell(words: &NumberWords, number: u32) -> String {
    let hundreds = (number / 100) as usize;
    let rest = (number % 100) as usize;
    let mut parts: Vec<&str> = Vec::new();

    if hundreds > 0 {
        parts.push(words.hundreds[hundreds]);
    }

    if rest >= 20 {
        parts.push(words.tens[rest / 10]);

        if !rest.is_multiple_of(10) {
            parts.push(words.units[rest % 10]);
        }
    } else if rest > 0 || hundreds == 0 {
        parts.push(words.units[rest]);
    }

    parts.join(" ")
}

/// Every number the language can say, as the slot's phrases.
pub fn number_phrases(language: &str) -> Option<Vec<SlotPhrase>> {
    (0..=MAX_NUMBER_SLOT_VALUE)
        .map(|number| {
            spoken(language, number).map(|text| SlotPhrase {
                words: text.split(' ').map(str::to_string).collect(),
                value: SlotValue::Number(number),
            })
        })
        .collect()
}

/// Every car number the slot hears with no session known: any number it
/// hears, as it is ("nine" is `9`) or after its leading zeros ("zero nine" is
/// `09`).
pub fn car_number_phrases(language: &str) -> Option<Vec<SlotPhrase>> {
    let mut digits = Vec::new();

    for zeros in 0..=MAX_LEADING_ZEROS {
        for number in 0..=MAX_NUMBER_SLOT_VALUE {
            let padded = format!("{}{number}", ZERO_DIGIT.to_string().repeat(zeros));

            if padded.len() <= MAX_CAR_NUMBER_DIGITS {
                digits.push(padded);
            }
        }
    }

    session_car_number_phrases(language, &digits)
}

/// The numbers the session's cars wear, as the slot's phrases. A number that
/// is not a car number — letters, too long — is left out.
pub fn session_car_number_phrases(language: &str, numbers: &[String]) -> Option<Vec<SlotPhrase>> {
    spelled(language, 0)?;

    Some(
        numbers
            .iter()
            .filter_map(|digits| {
                car_number_words(language, digits).map(|words| SlotPhrase {
                    words,
                    value: SlotValue::Digits(digits.clone()),
                })
            })
            .collect(),
    )
}

/// A car number's words as the recogniser hears them: each leading zero said,
/// then the rest as one number — "33" is "thirty three", "033" is "zero
/// thirty three", "512" is "five hundred twelve".
fn car_number_words(language: &str, digits: &str) -> Option<Vec<String>> {
    let is_car_number = !digits.is_empty()
        && digits.len() <= MAX_CAR_NUMBER_DIGITS
        && digits.chars().all(|digit| digit.is_ascii_digit());

    if !is_car_number {
        return None;
    }

    let rest = digits.trim_start_matches(ZERO_DIGIT);
    let rest = if rest.is_empty() {
        &digits[digits.len() - 1..]
    } else {
        rest
    };
    let zeros = digits.len() - rest.len();
    let zero = spelled(language, 0)?;
    let number = spelled(language, rest.parse().ok()?)?;
    let mut words = vec![zero; zeros];

    words.extend(number.split(' ').map(str::to_string));

    Some(words)
}

/// A car number as the reply says it, the way it is heard. What the language
/// has no words for is left to the synthesiser as it is.
pub fn spoken_car_number(language: &str, digits: &str) -> String {
    let Some(words) = car_number_words(language, digits) else {
        return digits.to_string();
    };
    let separator = if UNSPACED_LANGUAGES.contains(&language) {
        ""
    } else {
        " "
    };

    words.join(separator)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hears_a_car_number_with_its_leading_zeros() {
        let phrases = car_number_phrases("ru").unwrap();
        let heard = |said: &str| {
            phrases
                .iter()
                .find(|phrase| phrase.words.join(" ") == said)
                .map(|phrase| phrase.value.clone())
        };

        assert_eq!(heard("девять"), Some(SlotValue::Digits("9".into())));
        assert_eq!(heard("ноль девять"), Some(SlotValue::Digits("09".into())));
        assert_eq!(
            heard("ноль ноль семь"),
            Some(SlotValue::Digits("007".into()))
        );
        assert_eq!(heard("ноль"), Some(SlotValue::Digits("0".into())));
        assert_eq!(heard("ноль сто"), None);
        assert_eq!(heard("пятьсот двенадцать"), None);
        assert_eq!(car_number_phrases("xx"), None);
    }

    #[test]
    fn hears_only_the_numbers_the_session_cars_wear() {
        let numbers = ["512", "07", "33", "12A", "1234", ""].map(String::from);
        let phrases = session_car_number_phrases("ru", &numbers).unwrap();
        let said: Vec<(String, SlotValue)> = phrases
            .into_iter()
            .map(|phrase| (phrase.words.join(" "), phrase.value))
            .collect();

        assert_eq!(
            said,
            [
                ("пятьсот двенадцать".into(), SlotValue::Digits("512".into())),
                ("ноль семь".into(), SlotValue::Digits("07".into())),
                ("тридцать три".into(), SlotValue::Digits("33".into())),
            ]
        );
        assert_eq!(session_car_number_phrases("xx", &numbers), None);
    }

    #[test]
    fn says_a_car_number_as_it_is_heard() {
        assert_eq!(spoken_car_number("ru", "33"), "тридцать три");
        assert_eq!(spoken_car_number("ru", "033"), "ноль тридцать три");
        assert_eq!(spoken_car_number("ru", "007"), "ноль ноль семь");
        assert_eq!(spoken_car_number("ru", "0"), "ноль");
        assert_eq!(spoken_car_number("ru", "00"), "ноль ноль");
        assert_eq!(spoken_car_number("en", "12"), "twelve");
        assert_eq!(spoken_car_number("en", "512"), "five hundred twelve");
        assert_eq!(spoken_car_number("ru", "512"), "пятьсот двенадцать");
        assert_eq!(spoken_car_number("ru", "999"), "девятьсот девяносто девять");
        assert_eq!(spoken_car_number("es", "500"), "quinientos");
        assert_eq!(spoken_car_number("es", "701"), "setecientos uno");
        assert_eq!(spoken_car_number("zh", "305"), "三百零五");
        assert_eq!(spoken_car_number("zh", "250"), "两百五十");
        assert_eq!(spoken_car_number("zh", "07"), "零七");
        assert_eq!(spoken_car_number("xx", "07"), "07");
    }

    #[test]
    fn says_back_every_car_number_it_hears() {
        for phrase in car_number_phrases("ru").unwrap() {
            let SlotValue::Digits(digits) = &phrase.value else {
                panic!("a car number");
            };

            assert_eq!(spoken_car_number("ru", digits), phrase.words.join(" "));
        }
    }

    #[test]
    fn spells_russian_numbers() {
        assert_eq!(spoken("ru", 0).as_deref(), Some("ноль"));
        assert_eq!(spoken("ru", 13).as_deref(), Some("тринадцать"));
        assert_eq!(spoken("ru", 40).as_deref(), Some("сорок"));
        assert_eq!(spoken("ru", 45).as_deref(), Some("сорок пять"));
        assert_eq!(spoken("ru", 100).as_deref(), Some("сто"));
        assert_eq!(spoken("ru", 107).as_deref(), Some("сто семь"));
        assert_eq!(spoken("ru", 200).as_deref(), Some("двести"));
    }

    #[test]
    fn spells_english_numbers() {
        assert_eq!(spoken("en", 21).as_deref(), Some("twenty one"));
        assert_eq!(spoken("en", 115).as_deref(), Some("one hundred fifteen"));
    }

    #[test]
    fn spells_spanish_numbers() {
        assert_eq!(spoken("es", 16).as_deref(), Some("dieciséis"));
        assert_eq!(spoken("es", 28).as_deref(), Some("veintiocho"));
        assert_eq!(spoken("es", 30).as_deref(), Some("treinta"));
        assert_eq!(spoken("es", 45).as_deref(), Some("cuarenta y cinco"));
        assert_eq!(spoken("es", 100).as_deref(), Some("cien"));
        assert_eq!(spoken("es", 121).as_deref(), Some("ciento veintiuno"));
        assert_eq!(spoken("es", 200).as_deref(), Some("doscientos"));
    }

    #[test]
    fn spells_chinese_numbers() {
        assert_eq!(spoken("zh", 0).as_deref(), Some("零"));
        assert_eq!(spoken("zh", 12).as_deref(), Some("十 二"));
        assert_eq!(spoken("zh", 40).as_deref(), Some("四 十"));
        assert_eq!(spoken("zh", 45).as_deref(), Some("四 十 五"));
        assert_eq!(spoken("zh", 105).as_deref(), Some("一 百 零 五"));
        assert_eq!(spoken("zh", 110).as_deref(), Some("一 百 一 十"));
        assert_eq!(spoken("zh", 200).as_deref(), Some("两 百"));
    }

    #[test]
    fn says_nothing_past_the_limit_or_in_an_unknown_language() {
        assert_eq!(spoken("ru", MAX_NUMBER_SLOT_VALUE + 1), None);
        assert_eq!(spoken("de", 1), None);
    }

    #[test]
    fn gives_one_phrase_per_number() {
        let phrases = number_phrases("en").unwrap();

        assert_eq!(phrases.len(), MAX_NUMBER_SLOT_VALUE as usize + 1);
        assert_eq!(phrases[45].words, vec!["forty", "five"]);
    }
}
