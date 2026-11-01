//! What a question of the driver's own is checked by when the pack loads:
//! its answers name fields the catalog has and the question can read, its
//! phrases carry the slot its car is picked by.

use mt_model::app::crew_questions::{question_field_named, CarTarget, VoiceQuestionDef};

use crate::pack::template::Node;

/// Which of a question's answer lists a variant is in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnswerList {
    Replies,
    NoCar,
    NoValue,
}

impl AnswerList {
    pub const ALL: [Self; 3] = [Self::Replies, Self::NoCar, Self::NoValue];

    /// The list's name in `commands.json`.
    pub const fn part(self) -> &'static str {
        match self {
            Self::Replies => "replies",
            Self::NoCar => "noCar",
            Self::NoValue => "noValue",
        }
    }

    pub fn variants(self, question: &VoiceQuestionDef) -> &[String] {
        match self {
            Self::Replies => &question.replies,
            Self::NoCar => &question.no_car,
            Self::NoValue => &question.no_value,
        }
    }
}

/// The first field an answer names that it cannot: one the catalog lacks, a
/// car's field in a question about no car, or — when the car is not there —
/// any car field but the one its phrase heard.
pub fn answer_mistake(
    target: Option<CarTarget>,
    list: AnswerList,
    used: &[String],
) -> Option<String> {
    used.iter().find_map(|name| {
        let Some(spec) = question_field_named(name) else {
            return Some(format!("no field {{{name}}}"));
        };

        if !spec.of_car() {
            return None;
        }

        match target {
            None => Some(format!(
                "{{{name}}} is a car's — this question asks about no car"
            )),
            Some(target)
                if list == AnswerList::NoCar && target.phrase_slot() != Some(name.as_str()) =>
            {
                Some(format!(
                    "{{{name}}} is a car's — there is no car to read it from"
                ))
            }
            Some(_) => None,
        }
    })
}

/// What is wrong with the slots a phrase carries: a question picking its car
/// by a number or a place hears it in exactly that slot, any other question
/// in none.
pub fn phrase_mistake(target: Option<CarTarget>, nodes: &[Node]) -> Option<String> {
    let mut slots = Vec::new();

    slots_in(nodes, &mut slots);
    slots.sort();
    slots.dedup();

    match (target.and_then(CarTarget::phrase_slot), slots.as_slice()) {
        (Some(wanted), [slot]) if slot == wanted => None,
        (Some(wanted), []) => Some(format!("needs {{{wanted}}} — it names the car by it")),
        (Some(wanted), _) => Some(format!(
            "names the car by {{{wanted}}} alone, not {}",
            braced(&slots)
        )),
        (None, []) => None,
        (None, _) => Some(format!(
            "{} — this question does not pick its car by a slot",
            braced(&slots)
        )),
    }
}

fn slots_in(nodes: &[Node], slots: &mut Vec<String>) {
    for node in nodes {
        match node {
            Node::Word(_) => {}
            Node::Slot(name) => slots.push(name.clone()),
            Node::Choice(alternatives) => {
                for alternative in alternatives {
                    slots_in(alternative, slots);
                }
            }
            Node::Optional(inner) => slots_in(inner, slots),
        }
    }
}

fn braced(names: &[String]) -> String {
    names
        .iter()
        .map(|name| format!("{{{name}}}"))
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pack::template::parse;

    fn used(names: &[&str]) -> Vec<String> {
        names.iter().map(|name| name.to_string()).collect()
    }

    fn phrase(target: Option<CarTarget>, template: &str) -> Option<String> {
        phrase_mistake(target, &parse(template).unwrap())
    }

    #[test]
    fn an_answer_names_only_fields_the_catalog_has() {
        assert_eq!(
            answer_mistake(None, AnswerList::Replies, &used(&["fuelLaps", "humidity"])),
            Some("no field {humidity}".into())
        );
        assert_eq!(
            answer_mistake(None, AnswerList::Replies, &used(&["fuelLaps"])),
            None
        );
    }

    #[test]
    fn a_car_field_needs_a_car() {
        assert!(answer_mistake(None, AnswerList::Replies, &used(&["lastLap"])).is_some());
        assert!(answer_mistake(None, AnswerList::NoValue, &used(&["lastLap"])).is_some());
        assert_eq!(
            answer_mistake(
                Some(CarTarget::Ahead),
                AnswerList::Replies,
                &used(&["lastLap", "fuel"])
            ),
            None
        );
    }

    #[test]
    fn with_no_car_only_what_was_heard_is_there() {
        let by_number = Some(CarTarget::ByCarNumber);

        assert_eq!(
            answer_mistake(by_number, AnswerList::NoCar, &used(&["number", "lap"])),
            None
        );
        assert!(answer_mistake(by_number, AnswerList::NoCar, &used(&["lastLap"])).is_some());
        assert!(answer_mistake(
            Some(CarTarget::Leader),
            AnswerList::NoCar,
            &used(&["number"])
        )
        .is_some());
    }

    #[test]
    fn a_phrase_carries_the_slot_its_car_is_picked_by() {
        let by_position = Some(CarTarget::ByPosition);

        assert_eq!(phrase(by_position, "who is (p|place) {position}"), None);
        assert_eq!(
            phrase(by_position, "gap to car {number}"),
            Some("names the car by {position} alone, not {number}".into())
        );
        assert_eq!(
            phrase(by_position, "who is ahead"),
            Some("needs {position} — it names the car by it".into())
        );
        assert!(phrase(Some(CarTarget::Ahead), "car [{number}]").is_some());
        assert!(phrase(None, "fuel {number}").is_some());
        assert_eq!(phrase(None, "how much fuel"), None);
    }
}
