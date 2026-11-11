//! What the pack editor's preview buttons play: a variant with sample values,
//! or the answers a draft question would give.

use mt_model::app::crew::CrewReply;

use crate::crew::answer;
use crate::pack::catalog::reply_values;
use crate::pack::message::{Arg, Args};
use crate::pack::say::Units;
use crate::pack::{LanguagePack, VariantPicker};
use crate::voice_out::Utterance;

/// What a phrase's numbers read as when it is played in the editor.
const PREVIEW_NUMBER: f64 = 12.0;
const COMPOUND_VALUE: &str = "compound";
const PREVIEW_COMPOUND: &str = "dry";

/// One variant of `key`, its values filled with samples. Played again, a
/// variant with choices is heard another way.
pub fn line_preview(pack: &LanguagePack, key: &str, index: u32) -> Result<Utterance, &'static str> {
    let variant = pack
        .variants(key)
        .get(index as usize)
        .ok_or("that variant has a mistake in it")?;
    let saying = variant.any_saying();
    let compound = pack
        .slot_word(COMPOUND_VALUE, PREVIEW_COMPOUND)
        .unwrap_or(PREVIEW_COMPOUND)
        .to_string();
    let values = reply_values(key);
    let args: Args<'_> = values
        .iter()
        .map(|value| {
            let sample = if *value == COMPOUND_VALUE {
                Arg::Text(compound.clone())
            } else {
                Arg::Number(PREVIEW_NUMBER)
            };

            (*value, sample)
        })
        .collect();
    let text = pack.text(saying, &args).ok_or("the line does not format")?;

    Ok(Utterance { text })
}

/// What the crew would say for `replies` with the draft pack, one utterance
/// each; replies the pack has nothing for are left out.
pub fn reply_utterances(
    draft: &LanguagePack,
    units: Units,
    replies: &[CrewReply],
) -> Vec<Utterance> {
    let mut picker = VariantPicker::default();

    replies
        .iter()
        .filter_map(|reply| answer(draft, &mut picker, units, reply))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pack::load;

    #[test]
    fn a_built_in_variant_is_said_with_its_text() {
        let pack = load("en", None);
        let expected = &pack.variants("engineer.notInCar")[0].variant.text;
        let utterance = line_preview(&pack, "engineer.notInCar", 0).unwrap();

        assert!(!utterance.text.is_empty());
        assert_eq!(&utterance.text, expected);
    }

    #[test]
    fn a_variant_past_the_end_is_refused() {
        let pack = load("en", None);

        assert!(line_preview(&pack, "engineer.notInCar", 999).is_err());
        assert!(line_preview(&pack, "no.such.key", 0).is_err());
    }

    #[test]
    fn a_reply_the_pack_has_no_line_for_is_left_out() {
        let pack = load("en", None);
        let replies = [
            CrewReply::plain("engineer.notInCar"),
            CrewReply::plain("no.such.key"),
        ];

        let said = reply_utterances(&pack, Units::default(), &replies);

        assert_eq!(said.len(), 1);
    }
}
