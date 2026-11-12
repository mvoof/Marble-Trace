//! How the built-in languages say a number, for the `{number}` slot, and a
//! car number as it is heard.
//!
//! Only whole numbers up to `MAX_SPOKEN_NUMBER`: every one of them is a branch
//! of each command that takes a number, and nothing a driver orders by voice —
//! liters of fuel — goes past it. Car numbers have their own limit: iRacing's
//! 999.

use crate::pack::template::{SlotPhrase, SlotValue};

pub use mt_model::contract::defaults::MAX_SPOKEN_NUMBER;
/// "zero seven", "zero zero seven": iRacing numbers carry up to two.
const MAX_LEADING_ZEROS: usize = 2;
/// iRacing's longest car number.
const MAX_CAR_NUMBER_DIGITS: usize = 3;
const MAX_CAR_NUMBER: u32 = 999;
const ZERO_DIGIT: char = '0';

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
    if number > MAX_SPOKEN_NUMBER {
        return None;
    }

    spelled(language, number)
}

/// Any number below a thousand: car numbers go past `MAX_SPOKEN_NUMBER`.
fn spelled(language: &str, number: u32) -> Option<String> {
    if number > MAX_CAR_NUMBER {
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

    if hundreds > 0 {
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
    (0..=MAX_SPOKEN_NUMBER)
        .map(|number| {
            spoken(language, number).map(|text| SlotPhrase {
                words: text.split(' ').map(str::to_string).collect(),
                value: SlotValue::Number(number),
            })
        })
        .collect()
}

/// Every car number the language can say: a number as it is ("nine" is
/// `9`), or after its leading zeros ("zero nine" is `09`).
pub fn car_number_phrases(language: &str) -> Option<Vec<SlotPhrase>> {
    let zero = spelled(language, 0)?;
    let mut phrases = Vec::new();

    for zeros in 0..=MAX_LEADING_ZEROS {
        for number in 0..=MAX_CAR_NUMBER {
            let digits = format!("{}{number}", ZERO_DIGIT.to_string().repeat(zeros));

            if digits.len() > MAX_CAR_NUMBER_DIGITS {
                continue;
            }

            let mut words = vec![zero.clone(); zeros];

            words.extend(spelled(language, number)?.split(' ').map(str::to_string));
            phrases.push(SlotPhrase {
                words,
                value: SlotValue::Digits(digits),
            });
        }
    }

    Some(phrases)
}

/// A car number the way it is heard: each leading zero said, then the rest
/// as one number — "33" is "thirty three", "033" is "zero thirty three",
/// "512" is "five hundred twelve". What the language has no words for is left
/// to the synthesiser as it is.
pub fn spoken_car_number(language: &str, digits: &str) -> String {
    let rest = digits.trim_start_matches(ZERO_DIGIT);
    let (zeros, rest) = if rest.is_empty() && !digits.is_empty() {
        (digits.len() - 1, &digits[digits.len() - 1..])
    } else {
        (digits.len() - rest.len(), rest)
    };
    let zero = spelled(language, 0).unwrap_or_else(|| ZERO_DIGIT.to_string());
    let number = rest
        .parse::<u32>()
        .ok()
        .and_then(|number| spelled(language, number))
        .unwrap_or_else(|| rest.to_string());

    std::iter::repeat_n(zero, zeros)
        .chain(std::iter::once(number))
        .collect::<Vec<_>>()
        .join(" ")
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
        assert_eq!(
            heard("пятьсот двенадцать"),
            Some(SlotValue::Digits("512".into()))
        );
        assert_eq!(heard("ноль сто"), None);
        assert_eq!(car_number_phrases("xx"), None);
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
        assert_eq!(spoken_car_number("zh", "305"), "三 百 零 五");
        assert_eq!(spoken_car_number("xx", "07"), "0 7");
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
        assert_eq!(spoken("zh", 200).as_deref(), Some("二 百"));
    }

    #[test]
    fn says_nothing_past_the_limit_or_in_an_unknown_language() {
        assert_eq!(spoken("ru", MAX_SPOKEN_NUMBER + 1), None);
        assert_eq!(spoken("de", 1), None);
    }

    #[test]
    fn gives_one_phrase_per_number() {
        let phrases = number_phrases("en").unwrap();

        assert_eq!(phrases.len(), MAX_SPOKEN_NUMBER as usize + 1);
        assert_eq!(phrases[45].words, vec!["forty", "five"]);
    }
}
