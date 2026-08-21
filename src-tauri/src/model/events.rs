//! The names on the wire: every Tauri event the backend emits, and every
//! message kind the remote hub pushes over its socket.
//!
//! These used to be plain strings declared once in Rust and once again in
//! TypeScript — three times for the chat events, which `remote/mirror.rs` also
//! kept a copy of. A name that drifts on one side does not fail a build: the
//! listener simply never fires, which is how a missing `case` in
//! `remote-sync.ts` came to be documented as a known hazard rather than a bug.
//!
//! So Rust owns them. The two remote kinds are types, so specta carries them
//! into `bindings.ts` with the rest of the contract; the names are values and
//! come out of the one list below into `src/utils/backend-events.ts` — see
//! [`ts_values`](super::ts_values).

use serde::{Deserialize, Serialize};

use crate::model::ts_values::ts_values;
#[cfg(feature = "dev")]
use crate::model::ts_values::GENERATED_HEADER;

ts_values! {
    export_event_names => GENERATED_HEADER;

    /// The full telemetry bundle, one per tick. Only windows that draw widgets
    /// subscribe: Tauri delivers an event solely to webviews holding a
    /// listener, so the main window pays nothing for 60 Hz it does not render.
    pub const EVENT_TELEMETRY_BUNDLE: &str = "sim://telemetry/bundle" => SIM_TELEMETRY_BUNDLE;

    /// A 4 Hz slice for windows that do not take the bundle. The main window
    /// drives layout auto-switching off `is_on_track` and the automatic pit
    /// order off the fuel calculation and the sim's own order — subscribing it
    /// to 60 Hz telemetry to read four frames at four hertz is not the way to
    /// get them.
    pub const EVENT_TELEMETRY_SLOW: &str = "sim://telemetry/slow" => SIM_TELEMETRY_SLOW;

    /// The parsed session snapshot, re-emitted whenever the sim's session
    /// string changes.
    pub const EVENT_SESSION_INFO: &str = "sim://session" => SIM_SESSION;

    /// Weather forecast entries for the session.
    pub const EVENT_WEATHER_FORECAST: &str = "sim://weather" => SIM_WEATHER;

    /// Which sim is connected, and whether it is running.
    pub const EVENT_STATUS: &str = "sim://status" => SIM_STATUS;

    /// The sim's own performance counters. Deliberately not part of the
    /// telemetry bundle: the FPS diagnostics runner is the only consumer, it
    /// lives in the main window, and folding these into the bundle would force
    /// that window to subscribe to 60 Hz telemetry it otherwise has no use for
    /// — and would hide the cost of that subscription from the very tool meant
    /// to measure it.
    pub const EVENT_SIM_PERF: &str = "sim://perf" => SIM_PERF;

    /// The sim went away. Clears every data store.
    pub const EVENT_DISCONNECTED: &str = "sim://disconnected" => SIM_DISCONNECTED;

    /// What the connected sim can and cannot report, so a widget can hide a
    /// field the sim does not have rather than draw an empty one.
    pub const EVENT_CAPABILITIES: &str = "sim://capabilities" => SIM_CAPABILITIES;

    /// The recorded shape of the current track. Emitted once per track change,
    /// which is why a window that subscribes later pulls it instead.
    pub const EVENT_TRACK_SHAPE: &str = "sim://track-shape" => SIM_TRACK_SHAPE;

    /// A new or replaced reference lap is available for this track and car.
    pub const EVENT_REFERENCE_LAP_UPDATED: &str = "sim://reference-lap/updated" => SIM_REFERENCE_LAP_UPDATED;

    /// One normalized chat message. Emitted per message, so the frontend
    /// appends. Stream chat rides its own namespace on purpose: it keeps
    /// running with no sim connected at all.
    pub const EVENT_CHAT_MESSAGE: &str = "chat://message" => CHAT_MESSAGE;

    /// Per-platform status and viewer count. Slow cadence, replaces previous
    /// state.
    pub const EVENT_CHAT_PRESENCE: &str = "chat://presence" => CHAT_PRESENCE;

    /// A row must disappear — a moderator deleted a message or banned an
    /// author.
    pub const EVENT_CHAT_DELETION: &str = "chat://deletion" => CHAT_DELETION;

    /// The set of attached game controllers changed.
    pub const INPUT_DEVICES_EVENT: &str = "input://devices" => INPUT_DEVICES_EVENT;

    /// A controller button edge, for the global input bindings.
    pub const INPUT_BUTTON_EVENT: &str = "input://button" => INPUT_BUTTON_EVENT;

    /// A connected remote device came, went, or reported a new viewport.
    pub const EVENT_REMOTE_DEVICE: &str = "remote://device" => REMOTE_DEVICE_EVENT;
}

// --- Remote socket message kinds ----------------------------------------

/// Control messages the main window may push to the remote screens.
///
/// A whitelist rather than a free-form kind: the value reaching the socket is
/// one of these or nothing, so a typo in the main window cannot invent a
/// message the browser will never understand.
///
/// **A Tauri event never leaves the app.** Anything a hotkey does to a widget
/// needs a variant here too, or the monitors move and the tablet stays where it
/// was.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "kebab-case")]
pub enum RemoteControlKind {
    StandingsClassIndex,
    StandingsScroll,
    StreamChatScroll,
    TrackRotation,
}

/// Message kinds the server pushes on its own — the mirrored sim events, plus
/// the two the hub originates.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "kebab-case")]
pub enum RemoteStreamKind {
    /// The screen's own widget layout, published by the main window.
    Snapshot,
    /// A whole `TelemetryBundle`, forwarded already serialized.
    Telemetry,
    Session,
    Status,
    Weather,
    Capabilities,
    Disconnected,
    TrackShape,
    ReferenceLap,
    ChatMessage,
    ChatPresence,
    ChatDeletion,
}

/// Whether a kind's last message is cached and replayed to a socket that
/// connects later — which is what a device joining mid-session needs in order
/// to paint anything at all.
pub trait Replayed {
    fn replayed(self) -> bool;
}

impl Replayed for RemoteControlKind {
    fn replayed(self) -> bool {
        match self {
            // The rotation of the track map is a per-track setting the browser
            // cannot read for itself, so it is replayed like the shape it
            // applies to.
            Self::TrackRotation => true,
            Self::StandingsClassIndex | Self::StandingsScroll | Self::StreamChatScroll => false,
        }
    }
}

impl Replayed for RemoteStreamKind {
    fn replayed(self) -> bool {
        match self {
            Self::Session
            | Self::Status
            | Self::Weather
            | Self::Capabilities
            | Self::TrackShape
            | Self::ReferenceLap
            | Self::ChatPresence => true,
            // A snapshot is addressed to one screen and held per slug instead.
            // Telemetry and a disconnect are superseded within a tick. And
            // replaying a deletion against a fresh, empty message buffer would
            // do nothing.
            Self::Snapshot
            | Self::Telemetry
            | Self::Disconnected
            | Self::ChatMessage
            | Self::ChatDeletion => false,
        }
    }
}

/// The wire string — what the socket envelope carries and what the browser's
/// `switch` reads.
pub trait WireName {
    fn wire_name(self) -> &'static str;
}

impl WireName for RemoteControlKind {
    fn wire_name(self) -> &'static str {
        match self {
            Self::StandingsClassIndex => "standings-class-index",
            Self::StandingsScroll => "standings-scroll",
            Self::StreamChatScroll => "stream-chat-scroll",
            Self::TrackRotation => "track-rotation",
        }
    }
}

impl WireName for RemoteStreamKind {
    fn wire_name(self) -> &'static str {
        match self {
            Self::Snapshot => "snapshot",
            Self::Telemetry => "telemetry",
            Self::Session => "session",
            Self::Status => "status",
            Self::Weather => "weather",
            Self::Capabilities => "capabilities",
            Self::Disconnected => "disconnected",
            Self::TrackShape => "track-shape",
            Self::ReferenceLap => "reference-lap",
            Self::ChatMessage => "chat-message",
            Self::ChatPresence => "chat-presence",
            Self::ChatDeletion => "chat-deletion",
        }
    }
}

impl RemoteControlKind {
    pub const ALL: [Self; 4] = [
        Self::StandingsClassIndex,
        Self::StandingsScroll,
        Self::StreamChatScroll,
        Self::TrackRotation,
    ];

    /// Resolves a kind arriving from the frontend. `None` means an unknown
    /// string, which the hub drops with a warning rather than forwarding.
    pub fn from_wire(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|kind| kind.wire_name() == name)
    }
}

impl RemoteStreamKind {
    /// The Tauri event this kind mirrors, for the kinds that mirror one.
    ///
    /// `Snapshot` and `Telemetry` have none: the hub originates the first, and
    /// forwards the bundle through its own rate-limited path.
    pub fn source_event(self) -> Option<&'static str> {
        match self {
            Self::Session => Some(EVENT_SESSION_INFO),
            Self::Status => Some(EVENT_STATUS),
            Self::Weather => Some(EVENT_WEATHER_FORECAST),
            Self::Capabilities => Some(EVENT_CAPABILITIES),
            Self::Disconnected => Some(EVENT_DISCONNECTED),
            Self::TrackShape => Some(EVENT_TRACK_SHAPE),
            Self::ReferenceLap => Some(EVENT_REFERENCE_LAP_UPDATED),
            Self::ChatMessage => Some(EVENT_CHAT_MESSAGE),
            Self::ChatPresence => Some(EVENT_CHAT_PRESENCE),
            Self::ChatDeletion => Some(EVENT_CHAT_DELETION),
            Self::Snapshot | Self::Telemetry => None,
        }
    }

    /// Every kind that mirrors a Tauri event.
    ///
    /// Everything a widget can read has to be here: a remote screen renders the
    /// same components as the overlay, so an event that never arrives leaves
    /// its widget stuck on its empty state — the track map waiting for a shape,
    /// the chat waiting for a message.
    pub const MIRRORED: [Self; 10] = [
        Self::Session,
        Self::Status,
        Self::Weather,
        Self::Capabilities,
        Self::Disconnected,
        Self::TrackShape,
        Self::ReferenceLap,
        Self::ChatMessage,
        Self::ChatPresence,
        Self::ChatDeletion,
    ];
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `serde` writes the enum onto the wire and `wire_name` reads it back; the
    /// browser's `switch` sees whichever of the two produced the string. They
    /// have to agree.
    #[test]
    fn control_wire_names_match_the_serde_representation() {
        for kind in RemoteControlKind::ALL {
            let serialized = serde_json::to_string(&kind).unwrap();

            assert_eq!(serialized, format!("{:?}", kind.wire_name()));
        }
    }

    #[test]
    fn stream_wire_names_match_the_serde_representation() {
        for kind in RemoteStreamKind::MIRRORED {
            let serialized = serde_json::to_string(&kind).unwrap();

            assert_eq!(serialized, format!("{:?}", kind.wire_name()));
        }
    }

    #[test]
    fn every_control_kind_round_trips_through_its_wire_name() {
        for kind in RemoteControlKind::ALL {
            assert_eq!(RemoteControlKind::from_wire(kind.wire_name()), Some(kind));
        }

        assert_eq!(RemoteControlKind::from_wire("not-a-kind"), None);
    }

    #[cfg(feature = "dev")]
    #[test]
    fn the_checked_in_file_carries_every_event_name() {
        crate::model::ts_values::assert_exported(crate::bindings::EVENTS_PATH, exported_pairs());
    }

    #[test]
    fn every_mirrored_kind_names_the_event_it_mirrors() {
        for kind in RemoteStreamKind::MIRRORED {
            assert!(
                kind.source_event().is_some(),
                "{kind:?} is mirrored but names no source event"
            );
        }
    }
}
