//! The sim's car catalogue, for the auto-switch rule picker.

use mt_model::sim::car_catalogue::CatalogueCar;
use mt_sim_iracing::car_badges::car_catalogue;

/// Every car of the car badge table: id, name, badge and whether it is retired.
#[tauri::command]
pub fn get_car_catalogue() -> Vec<CatalogueCar> {
    car_catalogue()
}
