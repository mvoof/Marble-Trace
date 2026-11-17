//! Every car a sim knows, as the auto-switch rule picker lists it.

use serde::{Deserialize, Serialize};

/// One car of the sim's catalogue and the class badge it is shown under.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CatalogueCar {
    /// The car model (`CarID`), never a class id.
    pub car_id: i32,
    pub name: String,
    /// The badge the class badge column shows for the car.
    pub badge: String,
    /// The car is no longer sold or raced.
    pub retired: bool,
}
