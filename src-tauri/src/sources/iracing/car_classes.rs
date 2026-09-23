//! Car class presentation data: badge labels and class colors.
//!
//! # Where the badge comes from
//!
//! The sim does not name classes reliably. `DriverInfo.Drivers[].CarClassShortName`
//! is empty in AI and hosted sessions, and in official ones it reads "GT3 Class"
//! or holds the car name of a single-make class. What it always reports is each
//! driver's `CarID` and `CarClassID`, so a class is badged from the cars in it,
//! in this order:
//!
//! 1. [`badge_for_car`] — the map in `car_badges.rs`, when **every** car of the
//!    class has an entry and they all agree ("Ferrari 296 GT3" + "Lamborghini
//!    GT3" → `GT3`);
//! 2. `CarClassShortName` — the sim's own class name, as it is;
//! 3. `CarScreenNameShort` — the car name, when the class holds one model;
//! 4. `Class <CarClassID>` — a multi-model class nothing above could name.
//!
//! The order is irdashies' with the map moved ahead of the sim's name, which
//! would otherwise print "GT3 Class" into a badge column sized for `GT3`.
//!
//! # Adding a car
//!
//! Only the map is hand-maintained — see `car_badges.rs` for what goes in. To
//! read real ids, dump the session YAML while the sim is running —
//! `kerb::utils::save_session(&conn, path)`, or `cargo run --example test` in
//! `kerb/examples`, which writes `session.yaml` — then grep it:
//!
//! ```text
//! grep -o "CarID: [0-9]*\|CarClassID: [0-9]*\|CarScreenName: .*" session.yaml | paste - - - | sort -u
//! ```

use super::car_badges::badge_for_car;
use crate::model::session::CarEntry;

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

/// The badge of one class, from the cars the session put in it.
fn resolve_class_badge(class_id: i32, members: &[&CarEntry]) -> String {
    let mut mapped: Vec<Option<&str>> = members
        .iter()
        .map(|car| badge_for_car(car.car_id))
        .collect();
    mapped.dedup();

    if let [Some(badge)] = mapped.as_slice() {
        return (*badge).to_string();
    }

    let sim_name = members
        .iter()
        .map(|car| car.car_class_short_name.trim())
        .find(|name| !name.is_empty());

    if let Some(name) = sim_name {
        return name.to_string();
    }

    let mut car_ids: Vec<i32> = members.iter().map(|car| car.car_id).collect();
    car_ids.sort_unstable();
    car_ids.dedup();

    let car_name = members
        .iter()
        .map(|car| car.car_screen_name_short.trim())
        .find(|name| !name.is_empty());

    match (car_ids.len(), car_name) {
        (1, Some(name)) => name.to_string(),
        _ => format!("Class {class_id}"),
    }
}

/// Writes the resolved badge into `car_class_short_name` of every car,
/// following the order documented at the module level. The whole class gets
/// one badge, so its cars never disagree between two rows of a table.
pub fn apply_class_badges(cars: &mut [CarEntry]) {
    let mut class_ids: Vec<i32> = cars.iter().map(|car| car.car_class_id).collect();
    class_ids.sort_unstable();
    class_ids.dedup();

    let badges: Vec<(i32, String)> = class_ids
        .into_iter()
        .map(|class_id| {
            let members: Vec<&CarEntry> = cars
                .iter()
                .filter(|car| car.car_class_id == class_id)
                .collect();

            (class_id, resolve_class_badge(class_id, &members))
        })
        .collect();

    for car in cars.iter_mut() {
        if let Some((_, badge)) = badges.iter().find(|(id, _)| *id == car.car_class_id) {
            car.car_class_short_name = badge.clone();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_car(car_idx: i32, class_id: i32, car_id: i32, model: &str, sim_name: &str) -> CarEntry {
        CarEntry {
            car_idx,
            car_id,
            car_class_id: class_id,
            car_class_short_name: sim_name.to_string(),
            car_screen_name_short: model.to_string(),
            ..CarEntry::default()
        }
    }

    fn badges(cars: &[CarEntry]) -> Vec<&str> {
        cars.iter()
            .map(|car| car.car_class_short_name.as_str())
            .collect()
    }

    /// The roster of a real AI race (Monza, 2026-09-23): the sim named no class.
    #[test]
    fn badges_an_ai_race_the_sim_left_unnamed() {
        let mut cars = vec![
            make_car(0, 2708, 173, "Ferrari 296 GT3", ""),
            make_car(1, 2708, 133, "Lamborghini GT3", ""),
            make_car(2, 2268, 157, "Mercedes AMG GT4", ""),
            make_car(3, 4029, 196, "Ferrari 499P", ""),
            make_car(4, 4012, 160, "Toyota GR86", ""),
            make_car(5, 74, 67, "MX-5 Cup", ""),
            make_car(6, 4108, 216, "BMW M2 Racing (G87)", ""),
            make_car(7, 45, 41, "CTS-V", ""),
            make_car(8, 4013, 161, "Mercedes W13", ""),
        ];

        apply_class_badges(&mut cars);

        assert_eq!(
            badges(&cars),
            ["GT3", "GT3", "GT4", "GTP", "GR86", "MX-5", "M2", "CTS-V", "F1"]
        );
    }

    /// A second AI race (Spa, 2026-09-23): one car per class, and the 499P in a
    /// different class than at Monza — the map follows the car, not the class.
    #[test]
    fn badges_a_one_car_per_class_ai_race() {
        let mut cars = vec![
            make_car(0, 99, 93, "Ferrari 488 GTE", ""),
            make_car(1, 1860, 119, "Porsche 718 Cayman GT4", ""),
            make_car(2, 4074, 196, "Ferrari 499P", ""),
            make_car(3, 870, 106, "Dallara F3", ""),
            make_car(4, 3185, 145, "Mercedes W12", ""),
            make_car(5, 4093, 208, "Porsche 911 Cup (992.2)", ""),
            make_car(6, 86, 79, "Street Stock", ""),
        ];

        apply_class_badges(&mut cars);

        assert_eq!(
            badges(&cars),
            ["GTE", "GT4", "GTP", "F3", "F1", "PCup", "Street Stock"]
        );
    }

    #[test]
    fn a_lone_category_car_is_badged_by_its_category() {
        let mut cars = vec![make_car(0, 4036, 173, "Ferrari 296 GT3", "Ferrari 296 GT3")];

        apply_class_badges(&mut cars);

        assert_eq!(badges(&cars), ["GT3"]);
    }

    #[test]
    fn the_map_wins_over_the_sim_name() {
        let mut cars = vec![
            make_car(0, 2708, 173, "Ferrari 296 GT3", "GT3 Class"),
            make_car(1, 2708, 133, "Lamborghini GT3", "GT3 Class"),
        ];

        apply_class_badges(&mut cars);

        assert_eq!(badges(&cars), ["GT3", "GT3"]);
    }

    #[test]
    fn a_class_the_map_does_not_fully_cover_takes_the_sim_name() {
        let mut cars = vec![
            make_car(0, 9001, 173, "Ferrari 296 GT3", "Pro-Am"),
            make_car(1, 9001, 9999, "New Car", "Pro-Am"),
        ];

        apply_class_badges(&mut cars);

        assert_eq!(badges(&cars), ["Pro-Am", "Pro-Am"]);
    }

    #[test]
    fn falls_back_to_the_car_name_then_to_the_class_id() {
        let mut cars = vec![
            make_car(0, 9001, 9998, "Example Cup Car", ""),
            make_car(1, 9001, 9998, "Example Cup Car", ""),
            make_car(2, 9002, 9998, "Example Cup Car", ""),
            make_car(3, 9002, 9999, "Other Car", ""),
        ];

        apply_class_badges(&mut cars);

        assert_eq!(
            badges(&cars),
            [
                "Example Cup Car",
                "Example Cup Car",
                "Class 9002",
                "Class 9002"
            ]
        );
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
