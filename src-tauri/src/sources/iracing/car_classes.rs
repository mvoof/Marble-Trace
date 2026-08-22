//! Car class presentation data: badge labels and class colors.
//!
//! # Where the badge comes from
//!
//! iRacing's `DriverInfo.Drivers[].CarClassShortName` is only filled in official
//! series, and even then it holds the *car* name when a class has a single model
//! ("BMW M4 GT4", "Toyota GR86"). In AI and hosted sessions it is empty for every
//! car, so the label is resolved in this order:
//!
//! 1. `CarClassShortName` — whatever the sim reports, minus the filler words
//!    ([`tidy_class_badge`]): a badge column three characters wide has no room
//!    for "GT3 Class" when the class is GT3. Kept only if it is badge-shaped:
//!    in a single-model class the sim puts the whole car name here, and a
//!    curated badge beats "Porsche 911 GT3 Cup (992)" every time;
//! 2. [`CLASS_BADGE_BY_ID`] — curated badge for a known `CarClassID`;
//! 3. [`derive_badge_from_car_names`] — tokens shared by every model in the class;
//! 4. `CarScreenNameShort` — the car name, as a last resort.
//!
//! # Adding a class
//!
//! Only step 2 is hand-maintained. Multi-model classes (GT3, LMP2, TCR…) usually
//! resolve themselves at step 3, so an entry is only worth adding when a class
//! holds one model and its car name is too long for the badge column.
//!
//! To read the real values, dump the session YAML while the sim is running —
//! `kerb::utils::save_session(&conn, path)`, or `cargo run --example
//! session_diagnostics` in `kerb/examples` — then grep it:
//!
//! ```text
//! grep -o "CarClassID: [0-9]*\|CarScreenNameShort: .*" dump.yaml | paste - - | sort -u
//! ```
//!
//! `CarClassID` is stable across sessions and seasons, so a value read once stays
//! valid. The same list is exposed by the iRacing `/data/carclass/get` endpoint
//! (fields `car_class_id` / `name`), which needs an account login — note that its
//! `short_name` is the *longer* car name, `name` is the concise one.

use crate::model::session::CarEntry;

/// Badges for classes iRacing leaves unnamed, keyed by `CarClassID`.
/// Values were read off live session dumps — see the module docs before editing.
const CLASS_BADGE_BY_ID: [(i32, &str); 8] = [
    (11, "Safety"),
    (34, "Street Stock"),
    (74, "MX-5"),
    (3002, "FVee"),
    (4012, "GR86"),
    (4016, "FF1600"),
    (4102, "M2"),
    (4109, "GT3"),
];

const MIN_BADGE_TOKEN_LENGTH: usize = 2;

/// Longest a sim label may be and still read as a badge rather than a car name.
/// "LMP2", "GTP", "TCR" fit; "Global Mazda MX-5 Cup" does not.
const MAX_SIM_BADGE_LENGTH: usize = 6;

/// Words the sim pads a class label with that say nothing the badge needs:
/// "GT3 Class" is GT3, "Class C" is C. Dropped whatever the case.
const BADGE_FILLER_WORDS: [&str; 2] = ["class", "division"];

/// Words shared by unrelated models in a class carry no class meaning.
const NON_BADGE_TOKENS: [&str; 4] = ["racing", "car", "cup", "series"];

/// Fallback color for cars with no class color reported.
pub use crate::model::defaults::DEFAULT_CLASS_COLOR;

/// iRacing session YAML reports class colors as "0xRRGGBB" strings.
/// Some telemetry colors don't match what iRacing displays in-game.
/// This map corrects the known mismatches: keys are normalized "#rrggbb",
/// values are the in-game color.
const CLASS_COLOR_MAP: [(&str, &str); 6] = [
    ("#53ff77", "#ff7199"),
    ("#ae6bff", "#5cecff"),
    ("#d35400", "#a07cc8"),
    ("#ff5888", "#ef4444"),
    ("#ffda59", "#ffd259"),
    ("#33ceff", "#4d7bd9"),
];

/// Convert a raw iRacing class color string ("0xRRGGBB" or "#RRGGBB") to a
/// lowercase "#rrggbb" hex string, then apply in-game color corrections.
/// Returns [`DEFAULT_CLASS_COLOR`] for empty/missing values.
pub fn normalize_class_color(raw: &str) -> String {
    let trimmed = raw.trim();

    if trimmed.is_empty() {
        return DEFAULT_CLASS_COLOR.to_string();
    }

    let hex = if trimmed.starts_with("0x") || trimmed.starts_with("0X") {
        trimmed[2..].to_lowercase()
    } else {
        trimmed.trim_start_matches('#').to_lowercase()
    };

    let normalized = format!("#{hex}");

    CLASS_COLOR_MAP
        .iter()
        .find(|(key, _)| *key == normalized)
        .map(|(_, val)| (*val).to_string())
        .unwrap_or(normalized)
}

/// Separators the sim joins two words with, as surely as a space does.
const JOINERS: [char; 2] = ['-', '/'];

/// Strips the filler words off a class label, whatever produced it. Everything
/// that reaches a badge column goes through here, so the same class reads the
/// same in every widget. A label that is *only* filler is left alone — an empty
/// badge says less than a clumsy one.
///
/// Filler is recognised across the separators the sim actually uses, so
/// "GT3 Class", "GT3-Class" and "GT3 / Class" all land on `GT3`. The parts of a
/// hyphenated name are only dropped when they are filler themselves, which is
/// what keeps "MX-5" whole.
pub fn tidy_class_badge(raw: &str) -> String {
    let is_filler = |part: &str| {
        let word = part
            .trim_matches(|c: char| !c.is_ascii_alphanumeric())
            .to_lowercase();

        !word.is_empty() && BADGE_FILLER_WORDS.contains(&word.as_str())
    };

    let kept: Vec<String> = raw
        .split_whitespace()
        .filter_map(|word| {
            if is_filler(word) {
                return None;
            }

            // A separator left standing on its own once the word beside it went
            // ("GT3 / Class") carries nothing.
            if !word.chars().any(|c| c.is_ascii_alphanumeric()) {
                return None;
            }

            // A hyphen or a slash joins two words as surely as a space does,
            // and only the filler halves are dropped: "MX-5" has none.
            let parts: Vec<&str> = word
                .split(JOINERS)
                .filter(|part| !is_filler(part))
                .collect();

            if parts.len() == word.split(JOINERS).count() {
                return Some(word.to_string());
            }

            let rejoined = parts.join("-");
            let trimmed = rejoined.trim_matches(JOINERS);

            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .collect();

    if kept.is_empty() {
        return raw.trim().to_string();
    }

    kept.join(" ")
}

fn tokenize_car_name(name: &str) -> Vec<String> {
    name.split_whitespace()
        .map(|token| {
            token
                .trim_matches(|c: char| !c.is_ascii_alphanumeric())
                .to_string()
        })
        .filter(|token| {
            token.len() >= MIN_BADGE_TOKEN_LENGTH
                && !NON_BADGE_TOKENS.contains(&token.to_lowercase().as_str())
        })
        .collect()
}

/// Derives a class badge from the models actually in the class: tokens present
/// in every car name are what the class is about ("BMW M4 GT3 EVO" +
/// "Ferrari 296 GT3" + "Porsche 911 GT3 R (992)" → "GT3"). Needs at least two
/// distinct models, otherwise the car name is the best label there is.
fn derive_badge_from_car_names(car_names: &[&str]) -> String {
    let mut distinct: Vec<&str> = car_names.iter().map(|name| name.trim()).collect();
    distinct.sort_unstable();
    distinct.dedup();

    if distinct.len() < 2 {
        return String::new();
    }

    let mut shared = tokenize_car_name(distinct[0]);

    for name in &distinct[1..] {
        let tokens = tokenize_car_name(name);
        shared.retain(|token| tokens.iter().any(|other| other.eq_ignore_ascii_case(token)));
    }

    shared.join(" ")
}

/// Fills in `car_class_short_name` for classes the sim left unnamed, following
/// the resolution order documented at the module level. Entries the sim already
/// labeled are never overwritten.
pub fn apply_class_badges(cars: &mut [CarEntry]) {
    for car in cars.iter_mut() {
        car.car_class_short_name = tidy_class_badge(&car.car_class_short_name);
    }

    // A label the sim filled with a car name is treated as no label at all, so
    // the curated badge and the shared-token derivation both get their turn. If
    // neither produces anything the original label is put back below — it is
    // clumsy, but it is still the name of the class.
    let needs_badge = |car: &CarEntry| {
        car.car_class_short_name.is_empty()
            || car.car_class_short_name.chars().count() > MAX_SIM_BADGE_LENGTH
    };

    let sim_labels: Vec<String> = cars
        .iter()
        .map(|car| car.car_class_short_name.clone())
        .collect();

    let unnamed_class_ids: Vec<i32> = {
        let mut ids: Vec<i32> = cars
            .iter()
            .filter(|car| needs_badge(car))
            .map(|car| car.car_class_id)
            .collect();
        ids.sort_unstable();
        ids.dedup();

        ids
    };

    for class_id in unnamed_class_ids {
        let car_names: Vec<&str> = cars
            .iter()
            .filter(|car| car.car_class_id == class_id)
            .map(|car| car.car_screen_name_short.as_str())
            .collect();

        let curated = CLASS_BADGE_BY_ID
            .iter()
            .find(|(key, _)| *key == class_id)
            .map(|(_, badge)| (*badge).to_string())
            .unwrap_or_default();

        let badge = if curated.is_empty() {
            derive_badge_from_car_names(&car_names)
        } else {
            curated
        };

        for (index, car) in cars
            .iter_mut()
            .enumerate()
            .filter(|(_, car)| car.car_class_id == class_id && needs_badge(car))
        {
            let fallback = if sim_labels[index].is_empty() {
                &car.car_screen_name_short
            } else {
                &sim_labels[index]
            };

            car.car_class_short_name =
                tidy_class_badge(if badge.is_empty() { fallback } else { &badge });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_badge_from_shared_tokens_in_class_roster() {
        assert_eq!(
            derive_badge_from_car_names(&[
                "BMW M4 GT3 EVO",
                "Ferrari 296 GT3",
                "Ford Mustang GT3",
                "Porsche 911 GT3 R (992)",
            ]),
            "GT3"
        );
        assert_eq!(
            derive_badge_from_car_names(&["Dallara P217 LMP2", "Oreca 07 LMP2"]),
            "LMP2"
        );
        assert_eq!(derive_badge_from_car_names(&["MX-5 Cup", "MX-5 Cup"]), "");
        assert_eq!(derive_badge_from_car_names(&["Toyota GR86"]), "");
        assert_eq!(
            derive_badge_from_car_names(&["Ferrari 296 GT3", "Toyota GR86"]),
            ""
        );
    }

    #[test]
    fn tidies_filler_words_out_of_any_badge() {
        assert_eq!(tidy_class_badge("GT3 Class"), "GT3");
        assert_eq!(tidy_class_badge("Class C"), "C");
        assert_eq!(tidy_class_badge("GT3"), "GT3");
        assert_eq!(tidy_class_badge("GT3-Class"), "GT3");
        assert_eq!(tidy_class_badge("GT3 / Class"), "GT3");
        assert_eq!(tidy_class_badge("Class/GTP"), "GTP");
        // A hyphenated name whose parts are not filler survives intact.
        assert_eq!(tidy_class_badge("MX-5"), "MX-5");
        assert_eq!(tidy_class_badge("MX-5 Cup Class"), "MX-5 Cup");
        // Only filler left: a clumsy badge still beats an empty one.
        assert_eq!(tidy_class_badge("Class"), "Class");
        assert_eq!(tidy_class_badge(""), "");
    }

    #[test]
    fn class_badges_fill_in_what_the_sim_left_empty_or_filled_with_a_car_name() {
        let make_car = |car_idx: i32, class_id: i32, model: &str, sim_label: &str| CarEntry {
            car_idx,
            car_class_id: class_id,
            car_class_short_name: sim_label.to_string(),
            car_screen_name_short: model.to_string(),
            ..CarEntry::default()
        };

        let mut cars = vec![
            make_car(0, 4109, "Ferrari 296 GT3", ""),
            make_car(1, 4109, "BMW M4 GT3 EVO", ""),
            make_car(2, 4012, "Toyota GR86", ""),
            make_car(3, 74, "MX-5 Cup", "Global Mazda MX-5 Cup"),
            make_car(4, 5001, "Oreca 07 LMP2", ""),
            make_car(5, 5001, "Dallara P217 LMP2", ""),
            make_car(6, 4110, "Porsche 992 GT3 Cup", "GT3 Class"),
            make_car(7, 9001, "Ligier JS P320", "Prototype Challenge"),
        ];

        apply_class_badges(&mut cars);

        assert_eq!(cars[0].car_class_short_name, "GT3");
        assert_eq!(cars[1].car_class_short_name, "GT3");
        assert_eq!(cars[2].car_class_short_name, "GR86");
        // A car name is not a badge: the curated label for the class wins.
        assert_eq!(cars[3].car_class_short_name, "MX-5");
        assert_eq!(cars[4].car_class_short_name, "LMP2");
        assert_eq!(cars[5].car_class_short_name, "LMP2");
        // A sim label is kept, but not its filler.
        assert_eq!(cars[6].car_class_short_name, "GT3");
        // Nothing to replace a long label with: it is kept rather than swapped
        // for the car name.
        assert_eq!(cars[7].car_class_short_name, "Prototype Challenge");
    }

    #[test]
    fn normalizes_class_color_applies_map() {
        assert_eq!(normalize_class_color("0xffda59"), "#ffd259");
        assert_eq!(normalize_class_color("0x53ff77"), "#ff7199");
        assert_eq!(normalize_class_color("0xAE6BFF"), "#5cecff");
    }

    #[test]
    fn normalizes_class_color_passthrough() {
        assert_eq!(normalize_class_color("0xaabbcc"), "#aabbcc");
        assert_eq!(normalize_class_color("#AABBCC"), "#aabbcc");
        assert_eq!(normalize_class_color(""), "#888888");
    }
}
