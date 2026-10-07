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
//! come out of the one list below into `src/shared/contracts/backend-events.ts` — see
//! [`ts_values`](super::ts_values).

// The perf run's two names are emitted only by `dev` code; a release build
// would otherwise flag them unused. A `dev` build still lints this file whole.
#![cfg_attr(not(feature = "dev"), allow(dead_code))]

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

    /// A 4 Hz slice for windows that do not take the bundle: the player's car
    /// status, which the main window's layout auto-switch reads `is_on_track`
    /// off. Subscribing main to 60 Hz telemetry for one flag at four hertz is
    /// not the way to get it.
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

    /// The overlay's drag and interact modes changed. The hotkey dispatcher
    /// owns them; every window mirrors them.
    pub const EVENT_OVERLAY_MODES: &str = "app://overlay-modes" => OVERLAY_MODES_EVENT;

    /// A settings action's key fired. Sent to the main window only, which owns
    /// the settings it writes.
    pub const EVENT_HOTKEY_SETTINGS_ACTION: &str = "hotkey://settings-action" => HOTKEY_SETTINGS_ACTION_EVENT;

    /// A signal to the widgets of every overlay — a hotkey's scroll or class
    /// step, the track map turned, the chat cleared, a layout switched in. The
    /// payload is `{ type: RemoteControlKind, data }`, the very message a
    /// remote screen receives over its socket, so both clients run one handler.
    pub const EVENT_CLIENT_CONTROL: &str = "client://control" => CLIENT_CONTROL_EVENT;

    /// A perf run's measured span starts: the overlays begin collecting.
    /// Emitted only by a `dev` build running `MARBLE_TRACE_PERF`.
    pub const EVENT_PERF_BEGIN: &str = "perf://begin" => PERF_BEGIN;

    /// A perf run's measured span is over: each overlay sends its report.
    pub const EVENT_PERF_END: &str = "perf://end" => PERF_END;

    /// A client of the settings (ADR-0007) to main: an overlay's `hello`.
    /// Sent by one webview to another — the backend only carries it.
    pub const EVENT_CLIENT_TO_MAIN: &str = "client://to-main" => CLIENT_TO_MAIN_EVENT;

    /// Main to one client of the settings: the snapshot of what it draws.
    pub const EVENT_CLIENT_FROM_MAIN: &str = "client://from-main" => CLIENT_FROM_MAIN_EVENT;

    /// A connected remote device came, went, or reported a new viewport.
    pub const EVENT_REMOTE_DEVICE: &str = "remote://device" => REMOTE_DEVICE_EVENT;
}

/// The same bundle again, for the remote screens only.
///
/// **Temporary — the second half of spec decision 6.** `remote/mirror.rs` taps
/// the event stream with `app.listen`, and `emit_to` does not feed a Rust
/// listener, so the bundle built for the remote screens' own mask is re-emitted
/// under this name for the tap to pick up. The follow-up — moving the mirror to
/// `emit_to` — is named as out of scope in
/// `.scratch/per-window-telemetry-mask/spec.md`; this name goes away with it.
///
/// Not in `ts_values!` on purpose: it never crosses into TypeScript. A webview
/// listening for it would take the remote screens' bundle on top of its own.
pub const EVENT_TELEMETRY_BUNDLE_MIRROR: &str = "sim://telemetry/bundle/mirror";

// --- Remote socket message kinds ----------------------------------------

/// Signals to the widgets of every client — the overlays, over
/// `EVENT_CLIENT_CONTROL`, and the remote screens, over their socket. The one
/// vocabulary for both (ADR-0007): each client handles it in one exhaustive
/// switch, so a kind added here without a handler does not compile.
///
/// A whitelist rather than a free-form kind: the value reaching the socket is
/// one of these or nothing, so a typo in the main window cannot invent a
/// message the browser will never understand.
///
/// State never travels here — a value a client must still show after a reload
/// belongs in its snapshot.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "kebab-case")]
pub enum RemoteControlKind {
    StandingsClassStep,
    StandingsScroll,
    StreamChatScroll,
    TrackRotation,
    /// The order box popped up or down. The driver's alone — see
    /// `reaches_remote_screens`.
    PitServiceToggle,
    /// The chat connectors were shut down; drop the buffered messages.
    StreamChatCleared,
    /// The session switched the layout in; show its name for a moment.
    LayoutActivated,
    /// The current track's recorded shape was deleted; drop the copy drawn.
    TrackMapCleared,
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
            Self::StandingsClassStep
            | Self::StandingsScroll
            | Self::StreamChatScroll
            | Self::PitServiceToggle
            | Self::StreamChatCleared
            | Self::LayoutActivated
            | Self::TrackMapCleared => false,
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
            Self::StandingsClassStep => "standings-class-step",
            Self::StandingsScroll => "standings-scroll",
            Self::StreamChatScroll => "stream-chat-scroll",
            Self::TrackRotation => "track-rotation",
            Self::PitServiceToggle => "pit-service-toggle",
            Self::StreamChatCleared => "stream-chat-cleared",
            Self::LayoutActivated => "layout-activated",
            Self::TrackMapCleared => "track-map-cleared",
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
    pub const ALL: [Self; 8] = [
        Self::StandingsClassStep,
        Self::StandingsScroll,
        Self::StreamChatScroll,
        Self::TrackRotation,
        Self::PitServiceToggle,
        Self::StreamChatCleared,
        Self::LayoutActivated,
        Self::TrackMapCleared,
    ];

    /// Whether the kind goes to the remote screens at all. The pit order box
    /// is the driver's: a stream copy of the pit service shows the order, but
    /// a key popping it up on the driver's screen must not pop it up on air.
    pub fn reaches_remote_screens(self) -> bool {
        !matches!(self, Self::PitServiceToggle)
    }

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

    #[test]
    fn a_late_screen_gets_the_session_the_driver_list_joins_on() {
        // `DriverEntry` carries no name, number or class — a browser that
        // connects mid-session draws a field of blanks without the snapshot.
        assert!(RemoteStreamKind::Session.replayed());
    }
}
