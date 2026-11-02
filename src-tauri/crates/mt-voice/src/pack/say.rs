//! How a question's answer says each value: in its field's format, in the
//! driver's unit system, with the pack's own words for yes and no, a sign or
//! a faster lap.

use mt_model::app::crew::CrewArg;
use mt_model::app::crew_questions::SayFormat;

use crate::pack::catalog::{
    FASTER_KEY, MINUS_KEY, NO_KEY, PLUS_KEY, SAID_VALUE, SLOWER_KEY, YES_KEY,
};
use crate::pack::message::{format, Arg, Args};
use crate::pack::numbers::spoken_digits;
use crate::pack::LanguagePack;

const SECONDS_PER_MINUTE: f64 = 60.0;
const TENTHS: f64 = 10.0;
const KMH_PER_MS: f64 = 3.6;
const MPH_PER_MS: f64 = 2.236_936;
const GALLONS_PER_LITER: f64 = 0.264_172;
/// Below this a volume is said to a tenth — fuel saved per lap is fractions.
const WHOLE_VOLUME_FROM: f64 = 10.0;
/// A text from the sim is cut here: it is put in as words, never a template.
const MAX_SPOKEN_TEXT: usize = 80;

/// What the unit system changes about a value said.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Units {
    pub imperial: bool,
}

/// The value as the reply says it, `None` when the pack lacks the words it
/// needs.
pub fn said(pack: &LanguagePack, units: Units, say: SayFormat, value: &CrewArg) -> Option<Arg> {
    let number = match value {
        CrewArg::Number { value } => *value,
        CrewArg::Text { value } if say == SayFormat::Digits => {
            return Some(Arg::Text(spoken_digits(&pack.language, value.trim())));
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
    };

    Some(match say {
        SayFormat::Whole => Arg::Number(number.round()),
        SayFormat::SignedWhole => signed(pack, number.round(), PLUS_KEY, MINUS_KEY)?,
        SayFormat::Tenths => Arg::Number(tenths(number)),
        SayFormat::DeltaTenths => signed(pack, tenths(number), SLOWER_KEY, FASTER_KEY)?,
        SayFormat::LapTime => Arg::Text(lap_time(number, &pack.language)),
        SayFormat::Duration => Arg::Number((number / SECONDS_PER_MINUTE).floor()),
        SayFormat::Speed => {
            let scale = if units.imperial {
                MPH_PER_MS
            } else {
                KMH_PER_MS
            };

            Arg::Number((number * scale).round())
        }
        SayFormat::Volume => {
            let volume = if units.imperial {
                number * GALLONS_PER_LITER
            } else {
                number
            };

            if volume.abs() < WHOLE_VOLUME_FROM {
                Arg::Number(tenths(volume))
            } else {
                Arg::Number(volume.round())
            }
        }
        SayFormat::Temperature => {
            let degrees = if units.imperial {
                number * 9.0 / 5.0 + 32.0
            } else {
                number
            };

            Arg::Number(degrees.round())
        }
        SayFormat::YesNo => {
            words(pack, if number != 0.0 { YES_KEY } else { NO_KEY }, None).map(Arg::Text)?
        }
        SayFormat::Text => Arg::Number(number),
        SayFormat::Digits => Arg::Text(spoken_digits(&pack.language, &number.to_string())),
    })
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
    let minutes = (seconds / SECONDS_PER_MINUTE).floor();
    let rest = tenths(seconds - minutes * SECONDS_PER_MINUTE);

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
            Some(Arg::Number(180.0))
        );
        assert_eq!(
            say("en", true, SayFormat::Speed, number(50.0)),
            Some(Arg::Number(112.0))
        );
        assert_eq!(
            say("en", true, SayFormat::Temperature, number(20.0)),
            Some(Arg::Number(68.0))
        );
        assert_eq!(
            say("en", false, SayFormat::Volume, number(0.34)),
            Some(Arg::Number(0.3))
        );
        assert_eq!(
            say("en", true, SayFormat::Volume, number(40.0)),
            Some(Arg::Number(11.0))
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
