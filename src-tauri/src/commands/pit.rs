//! The one path out to the sim's pit service, and the knobs of auto mode that
//! decides on the telemetry thread.

use tauri::State;
use tracing::{debug, info};

use crate::computations::pit_auto::PitAutoCommand;
use crate::model::pit_auto::{PitAutoConfig, PitClaim};
use crate::model::pit_command::PitCommandRequest;
use crate::sources::iracing::pit_command::send_pit_order as send_pit_order_to_sim;
use crate::telemetry::control::TelemetryCommand;
use crate::telemetry::state::TelemetryState;

const MAX_TIRE_WEAR_THRESHOLD_PCT: f32 = 100.0;

/// A full order is a clear, fuel, four corners, windshield and fast repair —
/// eight messages. The cap is set at twice that so adding a checkbox does not
/// need a bump here; anything past it is a caller bug, not a real pit stop.
const MAX_PIT_ORDER_COMMANDS: usize = 16;

/// Sends a manual pit order to the sim — a click or a key. Auto mode's own
/// orders go out from the telemetry thread instead.
///
/// `claim` names the halves of the stop this order takes away from auto mode.
/// It reaches the telemetry thread before the broadcast leaves, so the next
/// tick cannot decide that half over the driver's hand.
///
/// The SDK broadcast is fire-and-forget: a successful return means the messages
/// were posted, not that iRacing accepted them. The sim ignores pit commands
/// unless the driver is in the car.
#[tauri::command]
pub async fn send_pit_order(
    state: State<'_, TelemetryState>,
    requests: Vec<PitCommandRequest>,
    claim: Option<PitClaim>,
) -> Result<(), String> {
    if requests.len() > MAX_PIT_ORDER_COMMANDS {
        return Err(format!(
            "pit order must not exceed {} commands",
            MAX_PIT_ORDER_COMMANDS
        ));
    }

    if let Some(claim) = claim.filter(|claim| claim.fuel || claim.tires) {
        state
            .service
            .send(TelemetryCommand::PitAuto(PitAutoCommand::Claim(claim)));
    }

    info!(count = requests.len(), "sending pit order");

    send_pit_order_to_sim(&requests)
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

    state.service.configure(|config| config.pit_auto = strategy);

    debug!(?strategy, "Pit strategy updated");

    Ok(())
}

/// The auto mode key: hands an automatic stop to the driver, and anything short
/// of one back to auto mode.
#[tauri::command]
pub async fn toggle_pit_auto(state: State<'_, TelemetryState>) -> Result<(), String> {
    state
        .service
        .send(TelemetryCommand::PitAuto(PitAutoCommand::ToggleAuto));

    Ok(())
}
