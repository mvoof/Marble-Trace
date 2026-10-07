//! The pit service commands: manual actions, the strategy, and the auto mode
//! plate. Every order to the sim goes out from the telemetry thread.

use std::time::Instant;

use tauri::State;
use tracing::{debug, info};

use crate::computations::pit_auto::PitAutoCommand;
use crate::model::pit_action::PitAction;
use crate::model::pit_auto::PitAutoConfig;
use crate::telemetry::control::TelemetryCommand;
use crate::telemetry::state::TelemetryState;

const MAX_TIRE_WEAR_THRESHOLD_PCT: f32 = 100.0;

/// A manual change to the pit order — a click in the widget. The keys send
/// the same command from the hotkey dispatcher.
///
/// Resolved on the telemetry thread against the order the sim reports on the
/// tick that drains it, and sent from there; the widget learns the result from
/// `pitAuto.ordersSent`, as it does for auto mode's orders. The SDK broadcast
/// is fire-and-forget and the sim ignores it unless the driver is in the car.
#[tauri::command]
pub async fn run_pit_action(
    state: State<'_, TelemetryState>,
    action: PitAction,
) -> Result<(), String> {
    if let PitAction::SetFuel { liters } = action {
        if !liters.is_finite() {
            return Err("Fuel amount must be finite".to_string());
        }
    }

    info!(?action, "pit action from the widget");

    state.service.send(TelemetryCommand::PitAction {
        action,
        issued_at: Instant::now(),
    });

    Ok(())
}

/// The pit strategy auto mode orders by, pushed by the main window whenever it
/// or the widget's place in the active layout changes. Kept in the config, so a
/// value pushed while the stream is stopped applies on the next start.
#[tauri::command]
pub async fn set_pit_strategy(
    state: State<'_, TelemetryState>,
    strategy: PitAutoConfig,
) -> Result<(), String> {
    let threshold = strategy.tire_wear_threshold_pct;

    if !threshold.is_finite() || !(0.0..=MAX_TIRE_WEAR_THRESHOLD_PCT).contains(&threshold) {
        return Err("Tire wear threshold must be a finite percentage".to_string());
    }

    if !strategy.fuel_step_liters.is_finite() || strategy.fuel_step_liters < 0.0 {
        return Err("Fuel step must be a finite, non-negative amount".to_string());
    }

    state.service.configure(|config| config.pit_auto = strategy);

    debug!(?strategy, "Pit strategy updated");

    Ok(())
}

/// The auto mode plate in the widget: hands an automatic stop to the driver,
/// and anything short of one back to auto mode. The key sends the same
/// command from the hotkey dispatcher.
#[tauri::command]
pub async fn toggle_pit_auto(state: State<'_, TelemetryState>) -> Result<(), String> {
    state
        .service
        .send(TelemetryCommand::PitAuto(PitAutoCommand::ToggleAuto));

    Ok(())
}
