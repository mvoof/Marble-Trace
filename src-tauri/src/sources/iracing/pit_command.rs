//! Maps pit orders from the frontend contract onto kerb's SDK broadcast channel.
//!
//! The protocol itself (message name, command codes, packing) lives in
//! `kerb::iracing::broadcast` — this layer only translates types.

use kerb::iracing::{send_pit_command, PitCommand};
use tracing::{debug, warn};

use crate::model::pit_command::{PitCommandKind, PitCommandRequest};

fn to_kerb(kind: PitCommandKind) -> PitCommand {
    match kind {
        PitCommandKind::Clear => PitCommand::Clear,
        PitCommandKind::Windshield => PitCommand::Windshield,
        PitCommandKind::Fuel => PitCommand::Fuel,
        PitCommandKind::Lf => PitCommand::Lf,
        PitCommandKind::Rf => PitCommand::Rf,
        PitCommandKind::Lr => PitCommand::Lr,
        PitCommandKind::Rr => PitCommand::Rr,
        PitCommandKind::ClearTires => PitCommand::ClearTires,
        PitCommandKind::FastRepair => PitCommand::FastRepair,
        PitCommandKind::ClearWindshield => PitCommand::ClearWindshield,
        PitCommandKind::ClearFastRepair => PitCommand::ClearFastRepair,
        PitCommandKind::ClearFuel => PitCommand::ClearFuel,
        PitCommandKind::TireCompound => PitCommand::TireCompound,
    }
}

/// Sends a whole pit order. The SDK has no batch form, so each checkbox is its
/// own message and they are applied in the order given.
pub fn send_pit_order(requests: &[PitCommandRequest]) -> Result<(), String> {
    if requests.is_empty() {
        return Ok(());
    }

    for request in requests {
        if !send_pit_command(to_kerb(request.kind), request.value) {
            warn!("pit command: broadcast message unavailable, order aborted");

            return Err("could not register the iRacing broadcast message".to_string());
        }

        debug!(kind = ?request.kind, value = request.value, "pit command sent");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_kind_maps_to_the_same_sdk_code() {
        let pairs = [
            (PitCommandKind::Clear, PitCommand::Clear),
            (PitCommandKind::Windshield, PitCommand::Windshield),
            (PitCommandKind::Fuel, PitCommand::Fuel),
            (PitCommandKind::Lf, PitCommand::Lf),
            (PitCommandKind::Rf, PitCommand::Rf),
            (PitCommandKind::Lr, PitCommand::Lr),
            (PitCommandKind::Rr, PitCommand::Rr),
            (PitCommandKind::ClearTires, PitCommand::ClearTires),
            (PitCommandKind::FastRepair, PitCommand::FastRepair),
            (PitCommandKind::ClearWindshield, PitCommand::ClearWindshield),
            (PitCommandKind::ClearFastRepair, PitCommand::ClearFastRepair),
            (PitCommandKind::ClearFuel, PitCommand::ClearFuel),
            (PitCommandKind::TireCompound, PitCommand::TireCompound),
        ];

        for (kind, expected) in pairs {
            assert_eq!(to_kerb(kind), expected);
        }
    }

    #[test]
    fn empty_order_is_a_no_op() {
        assert!(send_pit_order(&[]).is_ok());
    }
}
