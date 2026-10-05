//! The envelope of the client protocol (ADR-0007): main holds the settings,
//! and every other window — an overlay, later a remote screen — is a client
//! that is sent a snapshot of what it draws and changes a setting only by
//! sending main a command.
//!
//! Only the envelope is declared here. The payload a message carries — the
//! snapshot, the command — is a TypeScript type (`src/types/client-protocol.ts`)
//! that rides beside these fields and is forwarded opaquely: nothing in Rust
//! reads a widget record, and declaring one here would put the whole settings shape
//! into the backend contract for a value it only passes on.

// Nothing in Rust builds or reads a message yet — the overlays talk to main
// over Tauri events that never enter a Rust handler; the remote hub will, to
// refuse a command from a browser. The type exists for the contract, which
// only a `dev` build exports.
#![cfg_attr(not(feature = "dev"), allow(dead_code))]

use serde::{Deserialize, Serialize};

/// One message between main and a client, told apart by `kind`.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ClientEnvelope {
    /// A client has started and wants its snapshot. `client_id` is the window
    /// label (`overlay-<monitor>`), which is also where main sends the answer.
    #[serde(rename_all = "camelCase")]
    Hello { client_id: String },
    /// A client asks main to change a setting. `command_no` counts the
    /// client's commands from 1 and restarts with the window; `layout_id` is
    /// the layout the client was drawing, and main refuses a command for any
    /// layout but the live one.
    #[serde(rename_all = "camelCase")]
    Command {
        client_id: String,
        command_no: u32,
        layout_id: String,
    },
    /// Main's whole view of what one client draws. Replaces the client's state
    /// entirely — there are no patches.
    ///
    /// `last_handled_command_no` is the last of this client's commands main
    /// has handled, applied or refused; until it reaches a command, the client
    /// keeps showing that command's fields over the snapshot. `rejected` lists
    /// the refusals since the previous snapshot, for the log — the snapshot
    /// itself already carries main's value.
    #[serde(rename_all = "camelCase")]
    Snapshot {
        client_id: String,
        last_handled_command_no: u32,
        rejected: Vec<RejectedCommand>,
    },
}

/// A command main refused, and why.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct RejectedCommand {
    pub command_no: u32,
    pub reason: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_kind_and_the_client_travel_in_camel_case() {
        let hello = ClientEnvelope::Hello {
            client_id: "overlay-1".to_string(),
        };

        assert_eq!(
            serde_json::to_string(&hello).unwrap(),
            r#"{"kind":"hello","clientId":"overlay-1"}"#
        );
    }

    /// The payload rides beside the envelope's own fields, so reading a
    /// message must not choke on a field it does not declare.
    #[test]
    fn a_snapshot_with_its_payload_still_reads_as_an_envelope() {
        let message = r#"{"kind":"snapshot","clientId":"overlay-1","lastHandledCommandNo":3,"rejected":[],"snapshot":{"widgets":[]}}"#;

        let envelope: ClientEnvelope = serde_json::from_str(message).unwrap();

        assert!(matches!(
            envelope,
            ClientEnvelope::Snapshot { client_id, last_handled_command_no: 3, .. }
                if client_id == "overlay-1"
        ));
    }
}
