//! The one path out to the sim's pit service.

use tracing::info;

use crate::model::pit_command::PitCommandRequest;
use crate::sources::iracing::pit_command::send_pit_order as send_pit_order_to_sim;

/// A full order is a clear, fuel, four corners, windshield and fast repair —
/// eight messages. The cap is set at twice that so adding a checkbox does not
/// need a bump here; anything past it is a caller bug, not a real pit stop.
const MAX_PIT_ORDER_COMMANDS: usize = 16;

/// Sends a pit service order to the sim. Only ever called from an explicit user
/// action — the widget never orders anything on its own.
///
/// The SDK broadcast is fire-and-forget: a successful return means the messages
/// were posted, not that iRacing accepted them. The sim ignores pit commands
/// unless the driver is in the car.
#[tauri::command]
pub async fn send_pit_order(requests: Vec<PitCommandRequest>) -> Result<(), String> {
    if requests.len() > MAX_PIT_ORDER_COMMANDS {
        return Err(format!(
            "pit order must not exceed {} commands",
            MAX_PIT_ORDER_COMMANDS
        ));
    }

    info!(count = requests.len(), "sending pit order");

    send_pit_order_to_sim(&requests)
}
