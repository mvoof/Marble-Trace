//! How a question's answer says each value: in its field's format, in the
//! driver's unit system, with the pack's own words for yes and no, a sign or
//! a faster lap.

use mt_model::app::crew::{
    in_units, minutes_and_seconds, CrewArg, Quantity, GALLONS_PER_LITER, TENTHS,
};
use mt_model::app::crew_questions::SayFormat;

use crate::pack::catalog::{
    unit_key, FASTER_KEY, MINUS_KEY, NO_KEY, PLUS_KEY, SAID_VALUE, SLOWER_KEY, YES_KEY,
};
use crate::pack::message::{format, Arg, Args};
use crate::pack::numbers::spoken_car_number;
use crate::pack::LanguagePack;

const SECONDS_PER_MINUTE: f64 = 60.0;
/// A text from the sim is cut here: it is put in as words, never a template.
const MAX_SPOKEN_TEXT: usize = 80;

pub use mt_model::app::crew::Units;

/// The value as the reply says it, `None` when the pack lacks the words it
/// needs.
pub fn said(pack: &LanguagePack, units: Units, say: SayFormat, value: &CrewArg) -> Option<Arg> {
    let number = match value {
        CrewArg::Number { value } => *value,
        CrewArg::Text { value } if say == SayFormat::Digits => {
            return Some(Arg::Text(spoken_car_number(&pack.language, value.trim())));
        }
        CrewArg::Text { value } => return Some(Arg::Text(speakable(value))),
        CrewArg::Flag { value } => {
            return words(pack, if *value { YES_KEY } else { NO_KEY }, None).map(Arg::Text);
        }
        CrewArg::Word { key } => return words(pack, key, None).map(Arg::Text),
        CrewArg::Slot { slot, value } => {
            return Some(Arg::Text(
                pack.slot_word(slot, value).unwrap_or(value).to_string(),
            ));
        }
        CrewArg::Measure { quantity, value } => {
            return Some(measured(pack, units, *quantity, *value))
        }
    };

    Some(match say {
        SayFormat::Whole => Arg::Number(number.round()),
        SayFormat::SignedWhole => signed(pack, number.round(), PLUS_KEY, MINUS_KEY)?,
        SayFormat::Tenths => Arg::Number(tenths(number)),
        SayFormat::DeltaTenths => signed(pack, tenths(number), SLOWER_KEY, FASTER_KEY)?,
        SayFormat::LapTime => Arg::Text(lap_time(number, &pack.language)),
        SayFormat::Duration => Arg::Number((number / SECONDS_PER_MINUTE).floor()),
        SayFormat::Speed => measured(pack, units, Quantity::Speed, number),
        SayFormat::Volume => measured(pack, units, Quantity::Volume, number),
        SayFormat::Temperature => measured(pack, units, Quantity::Temperature, number),
        SayFormat::YesNo => {
            words(pack, if number != 0.0 { YES_KEY } else { NO_KEY }, None).map(Arg::Text)?
        }
        SayFormat::Text => Arg::Number(number),
        SayFormat::Digits => Arg::Text(spoken_car_number(&pack.language, &number.to_string())),
    })
}

/// A metric amount in the driver's units, rounded the way it is said, with
/// the pack's word for the unit — the number alone when the pack has none.
pub fn measured(pack: &LanguagePack, units: Units, quantity: Quantity, metric: f64) -> Arg {
    let number = in_units(units, quantity, metric);

    match words(pack, unit_key(quantity, units.imperial), Some(number)) {
        Some(said) => Arg::Measured { number, said },
        None => Arg::Number(number),
    }
}

/// An amount the driver said in their units, in liters for the pit crew.
pub fn liters_from(units: Units, amount: u32) -> u32 {
    if units.imperial {
        (f64::from(amount) / GALLONS_PER_LITER).round() as u32
    } else {
        amount
    }
}

/// A number above zero in the `above` words, below in the `below` words with
/// its size; zero as it is.
fn signed(pack: &LanguagePack, number: f64, above: &str, below: &str) -> Option<Arg> {
    if number == 0.0 {
        return Some(Arg::Number(0.0));
    }

    let key = if number > 0.0 { above } else { below };

    words(pack, key, Some(number.abs())).map(Arg::Text)
}

/// The pack's first way of saying a key, with its value filled in.
fn words(pack: &LanguagePack, key: &str, value: Option<f64>) -> Option<String> {
    let saying = pack.variants(key).first()?.sayings.first()?;
    let args: Args<'_> = value
        .map(|value| (SAID_VALUE, Arg::Number(value)))
        .into_iter()
        .collect();

    format(&saying.message, &pack.language, &args).ok()
}

fn tenths(value: f64) -> f64 {
    (value * TENTHS).round() / TENTHS
}

/// Minutes and seconds the way an engineer reads a lap: "1 32.4", or the
/// seconds alone under a minute; Chinese names the units ("1分32.4秒").
fn lap_time(seconds: f64, language: &str) -> String {
    let (minutes, rest) = minutes_and_seconds(seconds, TENTHS);

    match (language, minutes > 0.0) {
        ("zh", true) => format!("{minutes}分{rest}秒"),
        ("zh", false) => format!("{rest}秒"),
        (_, true) => format!("{minutes} {rest}"),
        (_, false) => rest.to_string(),
    }
}

/// A text from the sim as the voice may say it: no control characters, not
/// past a sane length.
fn speakable(text: &str) -> String {
    text.chars()
        .filter(|character| !character.is_control())
        .take(MAX_SPOKEN_TEXT)
        .collect::<String>()
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pack::load;

    fn say(language: &str, imperial: bool, format: SayFormat, value: CrewArg) -> Option<Arg> {
        said(&load(language, None), Units { imperial }, format, &value)
    }

    fn number(value: f64) -> CrewArg {
        CrewArg::Number { value }
    }

    fn text(value: &str) -> Arg {
        Arg::Text(value.into())
    }

    fn amount(number: f64, said: &str) -> Arg {
        Arg::Measured {
            number,
            said: said.into(),
        }
    }

    #[test]
    fn says_a_built_in_amount_in_the_drivers_units_with_its_word() {
        let fuel = CrewArg::Measure {
            quantity: Quantity::Volume,
            value: 40.0,
        };

        assert_eq!(
            said(
                &load("ru", None),
                Units { imperial: false },
                SayFormat::Text,
                &fuel
            ),
            Some(amount(40.0, "40 литров"))
        );
        assert_eq!(
            said(
                &load("ru", None),
                Units { imperial: true },
                SayFormat::Text,
                &fuel
            ),
            Some(amount(11.0, "11 галлонов"))
        );
    }

    #[test]
    fn an_amount_said_in_gallons_is_ordered_in_liters() {
        assert_eq!(liters_from(Units { imperial: true }, 10), 38);
        assert_eq!(liters_from(Units { imperial: false }, 10), 10);
    }

    #[test]
    fn says_a_value_in_its_format_and_units() {
        assert_eq!(
            say("en", false, SayFormat::Whole, number(6.6)),
            Some(Arg::Number(7.0))
        );
        assert_eq!(
            say("en", false, SayFormat::Tenths, number(1.26)),
            Some(Arg::Number(1.3))
        );
        assert_eq!(
            say("en", false, SayFormat::Speed, number(50.0)),
            Some(amount(180.0, "180 kilometers per hour"))
        );
        assert_eq!(
            say("en", true, SayFormat::Speed, number(50.0)),
            Some(amount(112.0, "112 miles per hour"))
        );
        assert_eq!(
            say("en", true, SayFormat::Temperature, number(20.0)),
            Some(amount(68.0, "68 degrees"))
        );
        assert_eq!(
            say("en", false, SayFormat::Volume, number(0.34)),
            Some(amount(0.3, "0.3 liters"))
        );
        assert_eq!(
            say("en", true, SayFormat::Volume, number(40.0)),
            Some(amount(11.0, "11 gallons"))
        );
        assert_eq!(
            say("en", false, SayFormat::Duration, number(1_530.0)),
            Some(Arg::Number(25.0))
        );
        assert_eq!(
            say("en", false, SayFormat::LapTime, number(92.43)),
            Some(text("1 32.4"))
        );
        assert_eq!(
            say("zh", false, SayFormat::LapTime, number(58.0)),
            Some(text("58秒"))
        );
    }

    #[test]
    fn says_signs_deltas_and_flags_in_the_packs_words() {
        assert_eq!(
            say("en", false, SayFormat::SignedWhole, number(3.0)),
            Some(text("plus 3"))
        );
        assert_eq!(
            say("en", false, SayFormat::SignedWhole, number(-1.0)),
            Some(text("minus 1"))
        );
        assert_eq!(
            say("en", false, SayFormat::SignedWhole, number(0.2)),
            Some(Arg::Number(0.0))
        );
        assert_eq!(
            say("en", false, SayFormat::DeltaTenths, number(-0.31)),
            Some(text("0.3 faster"))
        );
        assert_eq!(
            say("en", false, SayFormat::DeltaTenths, number(0.5)),
            Some(text("0.5 slower"))
        );
        assert_eq!(
            say("en", false, SayFormat::YesNo, CrewArg::Flag { value: true }),
            Some(text("yes"))
        );
        assert_eq!(
            say(
                "ru",
                false,
                SayFormat::YesNo,
                CrewArg::Flag { value: false }
            ),
            Some(text("нет"))
        );
    }

    #[test]
    fn says_a_car_number_digit_by_digit_and_a_name_as_it_is() {
        assert_eq!(
            say(
                "ru",
                false,
                SayFormat::Digits,
                CrewArg::Text { value: "07".into() }
            ),
            Some(text("ноль семь"))
        );
        assert_eq!(
            say(
                "en",
                false,
                SayFormat::Text,
                CrewArg::Text {
                    value: " Max\u{7}Verstappen ".into()
                }
            ),
            Some(text("MaxVerstappen"))
        );
    }
}
