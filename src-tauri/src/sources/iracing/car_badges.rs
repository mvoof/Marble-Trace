//! The class badge of every car we know, keyed by iRacing `CarID`.
//!
//! This is the one hand-maintained list behind the class badge (resolution
//! order in [`super::car_classes`]). It is keyed by the **car**, not the class,
//! because a car keeps its category whatever class a session puts it in: the
//! Ferrari 296 GT3 races as `CarClassID` 2708 ("GT3 Class") in a multi-make
//! field and as 4036 ("Ferrari 296 GT3") in its own series, and is `GT3` in
//! both. A class id carries no such meaning, and iRacing mints a new one for
//! every series that needs its own class.
//!
//! # What goes in
//!
//! - A car that belongs to a racing category — F1, F3, GT3, GT4, GTP, LMP2,
//!   TCR… — gets the category. Every car of that category must carry the same
//!   string, since a class is only badged when all of its cars agree.
//! - A single-make car whose name is too long for a badge column gets a short
//!   label of its own (`Toyota GR86` → `GR86`).
//! - Anything else needs no entry: an unmapped car falls back to the sim's class
//!   name, then to the car name.
//!
//! Keep a badge within 6 characters — the Standings and Relative badge columns
//! are sized for it, and a test enforces it.
//!
//! # Where the ids come from
//!
//! `CarID` is per driver in the session YAML (`DriverInfo.Drivers[].CarID`).
//! Read it from a dump taken with the sim running, see the module docs of
//! [`super::car_classes`]. Entries marked *verified* were read off a session
//! dump or the iRacing UI's own data;

const F1: &str = "F1";
const F3: &str = "F3";
const GT3: &str = "GT3";
const GT4: &str = "GT4";
const GTE: &str = "GTE";
const GTP: &str = "GTP";
const LMP1: &str = "LMP1";
const LMP2: &str = "LMP2";
const TCR: &str = "TCR";

/// `(CarID, badge)`, grouped by category. The first number is the car model
/// (`DriverInfo.Drivers[].CarID`), never a `CarClassID`; the second is the text
/// the badge column shows.
const CAR_ID_BADGES: &[(i32, &str)] = &[
    // GT3
    (43, GT3),
    (55, GT3),
    (59, GT3),
    (72, GT3),
    (73, GT3),
    (94, GT3),
    (132, GT3),
    (133, GT3), // Lamborghini Huracan GT3 EVO — verified
    (137, GT3),
    (144, GT3),
    (156, GT3), // Mercedes-AMG GT3 2020 — verified
    (169, GT3),
    (173, GT3), // Ferrari 296 GT3 — verified
    (176, GT3),
    (184, GT3),
    (185, GT3),
    (188, GT3),
    (194, GT3),
    (206, GT3),
    // GT4
    (119, GT4), // Porsche 718 Cayman GT4 — verified
    (122, GT4),
    (135, GT4),
    (150, GT4),
    (157, GT4), // Mercedes AMG GT4 — verified
    // GTE
    (92, GTE),
    (93, GTE), // Ferrari 488 GTE — verified
    (102, GTE),
    (109, GTE),
    (127, GTE),
    // GTP / LMDh
    (159, GTP),
    (168, GTP),
    (170, GTP),
    (174, GTP),
    (196, GTP), // Ferrari 499P — verified
    // LMP1
    (98, LMP1),
    (100, LMP1),
    // LMP2
    (39, LMP2),
    (70, LMP2),
    (128, LMP2),
    // TCR
    (112, TCR),
    (146, TCR),
    (147, TCR),
    (153, TCR),
    // Formula 1
    (145, F1), // Mercedes W12 — verified
    (161, F1), // Mercedes-AMG W13 E Performance — verified
    // Formula 3
    (106, F3), // Dallara F312 F3 — verified
    // Single-make cars whose own name does not fit a badge column
    (67, "MX-5"),    // Global Mazda MX-5 Cup — verified
    (142, "FVee"),   // Formula Vee - Classic — verified
    (160, "GR86"),   // Toyota GR86 — verified
    (163, "FF1600"), // Ray FF1600
    (208, "PCup"),   // Porsche 911 Cup (992.2) — verified
    (216, "M2"),     // BMW M2 Racing (G87) — verified
];

/// The badge for one car, or `None` when the car is not in the map.
pub fn badge_for_car(car_id: i32) -> Option<&'static str> {
    CAR_ID_BADGES
        .iter()
        .find(|(id, _)| *id == car_id)
        .map(|(_, badge)| *badge)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Widest badge the table columns are sized for.
    const MAX_BADGE_LENGTH: usize = 6;

    #[test]
    fn every_badge_fits_the_badge_column() {
        for (car_id, badge) in CAR_ID_BADGES {
            assert!(
                !badge.is_empty() && badge.chars().count() <= MAX_BADGE_LENGTH,
                "car {car_id} carries badge {badge:?}"
            );
        }
    }

    #[test]
    fn every_car_is_listed_once() {
        let mut ids: Vec<i32> = CAR_ID_BADGES.iter().map(|(id, _)| *id).collect();
        ids.sort_unstable();

        let before = ids.len();
        ids.dedup();

        assert_eq!(ids.len(), before, "a CarID is listed twice");
    }

    #[test]
    fn looks_up_a_mapped_and_an_unmapped_car() {
        assert_eq!(badge_for_car(173), Some(GT3));
        assert_eq!(badge_for_car(-1), None);
    }
}
