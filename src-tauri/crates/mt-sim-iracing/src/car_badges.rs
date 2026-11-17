//! The class badge, name and retired flag of every iRacing car, keyed by
//! `CarID`.
//!
//! This table is behind the class badge (resolution order in
//! [`super::car_classes`]). It is keyed by the **car**, not the class, because a
//! car keeps its category whatever class a session puts it in: the Ferrari 296
//! GT3 races as `CarClassID` 2708 ("GT3 Class") in a multi-make field and as 4036
//! ("Ferrari 296 GT3") in its own series, and is `GT3` in both. A class id
//! carries no such meaning, and iRacing mints a new one for every series that
//! needs its own class.
//!
//! # Where the rows come from
//!
//! `car_badges/table.rs` is written by `scripts/car-badges.mjs` from iRacing's
//! car and car class catalogue (see the script's header). The script refreshes
//! every name and retired flag, adds the cars it has not seen with a
//! [`CarBadge::draft`] badge, and never changes a badge already in the table.
//!
//! # Reviewing a badge
//!
//! A draft is used like any other badge; the marker only says nobody checked it.
//! To review one, edit the badge if needed and turn `CarBadge::draft` into
//! `CarBadge::reviewed`. What a badge should be:
//!
//! - A car that belongs to a racing category — F1, F3, GT3, GT4, GTP, LMP2,
//!   TCR… — gets the category. Every car of that category must carry the same
//!   string, since a class is only badged when all of its cars agree; the cars
//!   of a multi-make series (NASCAR Cup, Supercars…) share one label the same
//!   way.
//! - A single-make car gets a short label of its own (`Toyota GR86` → `GR86`).
//!
//! Keep a badge within 6 characters — the Standings and Relative badge columns
//! are sized for it, and a test enforces it. A trailing `// verified` marks a
//! car whose `CarID` was read off a session dump.

mod table;

use mt_model::sim::car_catalogue::CatalogueCar;
use table::CAR_BADGES;

/// One car of iRacing's catalogue and the badge the class badge column shows
/// for it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CarBadge {
    /// The car model (`DriverInfo.Drivers[].CarID`), never a `CarClassID`.
    pub car_id: i32,
    pub badge: &'static str,
    /// iRacing's catalogue name of the car.
    pub name: &'static str,
    /// The car is no longer sold or raced.
    pub retired: bool,
    /// The badge was drafted by the script and not reviewed yet.
    pub draft: bool,
}

impl CarBadge {
    pub(crate) const fn reviewed(car_id: i32, badge: &'static str, name: &'static str) -> Self {
        Self {
            car_id,
            badge,
            name,
            retired: false,
            draft: false,
        }
    }

    pub(crate) const fn draft(car_id: i32, badge: &'static str, name: &'static str) -> Self {
        Self {
            draft: true,
            ..Self::reviewed(car_id, badge, name)
        }
    }

    pub(crate) const fn retired(self) -> Self {
        Self {
            retired: true,
            ..self
        }
    }
}

/// The badge for one car, or `None` when the car is not in the table.
pub fn badge_for_car(car_id: i32) -> Option<&'static str> {
    CAR_BADGES
        .binary_search_by_key(&car_id, |car| car.car_id)
        .ok()
        .map(|index| CAR_BADGES[index].badge)
}

/// Every car of the table, as the auto-switch rule picker lists it. Whether a
/// badge was reviewed stays here: the picker shows a draft like any other.
pub fn car_catalogue() -> Vec<CatalogueCar> {
    CAR_BADGES
        .iter()
        .map(|car| CatalogueCar {
            car_id: car.car_id,
            name: car.name.to_string(),
            badge: car.badge.to_string(),
            retired: car.retired,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Widest badge the table columns are sized for.
    const MAX_BADGE_LENGTH: usize = 6;

    #[test]
    fn every_badge_fits_the_badge_column() {
        for car in CAR_BADGES {
            assert!(
                !car.badge.is_empty() && car.badge.chars().count() <= MAX_BADGE_LENGTH,
                "car {} carries badge {:?}",
                car.car_id,
                car.badge
            );
        }
    }

    #[test]
    fn every_car_is_listed_once_in_id_order() {
        for pair in CAR_BADGES.windows(2) {
            assert!(
                pair[0].car_id < pair[1].car_id,
                "car {} is listed after car {}",
                pair[1].car_id,
                pair[0].car_id
            );
        }
    }

    #[test]
    fn every_car_has_a_name() {
        for car in CAR_BADGES {
            assert!(
                !car.name.trim().is_empty(),
                "car {} has no name",
                car.car_id
            );
        }
    }

    #[test]
    fn looks_up_a_mapped_and_an_unmapped_car() {
        assert_eq!(badge_for_car(173), Some("GT3"));
        assert_eq!(badge_for_car(-1), None);
    }

    #[test]
    fn the_catalogue_lists_every_car_with_its_badge() {
        let catalogue = car_catalogue();

        assert_eq!(catalogue.len(), CAR_BADGES.len());

        let gt3_car = catalogue.iter().find(|car| car.car_id == 173);

        assert_eq!(gt3_car.map(|car| car.badge.as_str()), Some("GT3"));
        assert!(catalogue.iter().any(|car| car.retired));
    }
}
