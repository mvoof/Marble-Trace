//! Fan-out point between the telemetry thread and the connected browsers.
//!
//! Messages are serialized once here and handed to every socket as a shared
//! string: a tablet costs one `Arc` clone per tick, not one `serde_json` run.
//! The hub knows nothing about widgets or settings — the main window publishes
//! its own snapshot through `publish_snapshot`, so the layout format stays a
//! frontend concern.
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU16, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use serde::Serialize;
use tokio::sync::broadcast;
use tracing::warn;

use crate::model::events::{RemoteControlKind, RemoteStreamKind, Replayed, WireName};
use crate::model::remote::RemoteDevice;
use crate::utils::lock_or_recover;

/// Browsers repaint at 60 Hz at best and usually less; anything above this is
/// Wi-Fi traffic nobody sees. Overridable per server start.
pub const DEFAULT_TELEMETRY_HZ: u32 = 30;

/// Bounded so a stalled socket cannot grow the queue without limit — a client
/// that falls this far behind is dropped and reconnects.
const CHANNEL_CAPACITY: usize = 64;

#[derive(Serialize)]
struct Envelope<'a, T: Serialize> {
    #[serde(rename = "type")]
    kind: &'a str,
    data: T,
}

/// A single serialized frame, shared by every subscriber.
pub type RemoteMessage = Arc<String>;

pub struct RemoteHub {
    tx: broadcast::Sender<RemoteMessage>,
    /// Layout snapshot per remote screen slug, published by the main window.
    snapshots: Mutex<HashMap<String, serde_json::Value>>,
    /// Last message of each replayed kind, sent to every new socket.
    replay: Mutex<HashMap<&'static str, RemoteMessage>>,
    /// Guards the telemetry rate limit. Stored as micros since the server start
    /// instead of an `Instant` so the check stays lock-free.
    started: Instant,
    last_telemetry_us: AtomicU64,
    min_interval_us: AtomicU64,
    pub running: AtomicBool,
    pub port: AtomicU16,
    /// Empty means the server was started without one and accepts any client.
    pub token: Mutex<String>,
    /// Language for the server-rendered pages, resolved by the frontend.
    pub language: Mutex<String>,
    /// What each screen's device last reported about its own display. Kept
    /// after a disconnect so the settings UI can still show the size the tablet
    /// had, with `connected` cleared.
    devices: Mutex<HashMap<String, RemoteDevice>>,
}

impl Default for RemoteHub {
    fn default() -> Self {
        let (tx, _) = broadcast::channel(CHANNEL_CAPACITY);

        Self {
            tx,
            snapshots: Mutex::new(HashMap::new()),
            replay: Mutex::new(HashMap::new()),
            started: Instant::now(),
            last_telemetry_us: AtomicU64::new(0),
            min_interval_us: AtomicU64::new(1_000_000 / DEFAULT_TELEMETRY_HZ as u64),
            running: AtomicBool::new(false),
            port: AtomicU16::new(0),
            token: Mutex::new(String::new()),
            language: Mutex::new(String::from("en")),
            devices: Mutex::new(HashMap::new()),
        }
    }
}

impl RemoteHub {
    pub fn subscribe(&self) -> broadcast::Receiver<RemoteMessage> {
        self.tx.subscribe()
    }

    pub fn client_count(&self) -> usize {
        self.tx.receiver_count()
    }

    pub fn set_telemetry_hz(&self, hz: u32) {
        let hz = hz.clamp(1, 60) as u64;

        self.min_interval_us
            .store(1_000_000 / hz, Ordering::Relaxed);
    }

    /// True when the token matches, or when the server runs without one.
    pub fn accepts(&self, candidate: Option<&str>) -> bool {
        let expected = lock_or_recover(&self.token).clone();

        if expected.is_empty() {
            return true;
        }

        candidate.is_some_and(|value| tokens_match(value, &expected))
    }

    /// Nothing is serialized while no browser is connected — the telemetry
    /// thread pays only an atomic load per tick when the feature is idle.
    fn has_clients(&self) -> bool {
        self.tx.receiver_count() > 0
    }

    fn send<T: Serialize>(&self, kind: &'static str, data: T, replay: bool) {
        if !replay && !self.has_clients() {
            return;
        }

        let encoded = match serde_json::to_string(&Envelope { kind, data }) {
            Ok(json) => Arc::new(json),
            Err(error) => {
                warn!("remote: failed to encode {} message: {}", kind, error);

                return;
            }
        };

        if replay {
            lock_or_recover(&self.replay).insert(kind, Arc::clone(&encoded));
        }

        // Err only means nobody is listening, which is the normal idle state.
        let _ = self.tx.send(encoded);
    }

    /// Rate-limited, but only where rate-limiting means anything.
    ///
    /// The limit exists to keep 60 Hz motion data off the Wi-Fi, and it must
    /// not touch anything slower: the 10, 4 and 1 Hz fields ride the same
    /// bundle, so dropping a whole tick to save bandwidth also delays the
    /// session clock and the fuel numbers. A bundle carrying any slower field
    /// is always sent; only the pure 60 Hz ones are thinned.
    ///
    /// The mirror taps Tauri's own event stream, where the bundle has been
    /// serialized once for the overlay windows already — wrapping that string
    /// costs a `format!` instead of a second full `serde_json` pass at 60 Hz.
    pub fn publish_raw_telemetry(&self, json: &str) {
        if !self.has_clients() {
            return;
        }

        if carries_slow_fields(json) {
            self.last_telemetry_us
                .store(self.started.elapsed().as_micros() as u64, Ordering::Relaxed);

            let _ = self.tx.send(Arc::new(wrap_raw(
                RemoteStreamKind::Telemetry.wire_name(),
                json,
            )));

            return;
        }

        let now_us = self.started.elapsed().as_micros() as u64;
        let last = self.last_telemetry_us.load(Ordering::Relaxed);

        if now_us.saturating_sub(last) < self.min_interval_us.load(Ordering::Relaxed) {
            return;
        }

        self.last_telemetry_us.store(now_us, Ordering::Relaxed);

        let _ = self.tx.send(Arc::new(wrap_raw(
            RemoteStreamKind::Telemetry.wire_name(),
            json,
        )));
    }

    /// Session, status, weather and capabilities: rare, and every one of them
    /// is replayed to a socket that connects later.
    pub fn publish_raw_event(&self, kind: RemoteStreamKind, json: &str) {
        let replay = kind.replayed();

        if !replay && !self.has_clients() {
            return;
        }

        let encoded = Arc::new(wrap_raw(kind.wire_name(), json));

        if replay {
            lock_or_recover(&self.replay).insert(kind.wire_name(), Arc::clone(&encoded));
        }

        let _ = self.tx.send(encoded);
    }

    /// Called by the main window whenever the layout of a remote screen
    /// changes. Cached so a browser connecting later gets it without waking
    /// the main window.
    pub fn publish_snapshot(&self, slug: String, snapshot: serde_json::Value) {
        lock_or_recover(&self.snapshots).insert(slug.clone(), snapshot.clone());

        self.send(
            RemoteStreamKind::Snapshot.wire_name(),
            SnapshotPayload { slug, snapshot },
            RemoteStreamKind::Snapshot.replayed(),
        );
    }

    /// A command from the main window aimed at the widgets themselves — which
    /// class the standings show, how far they are scrolled, how the track map
    /// is turned. The overlay windows get these as Tauri events, which never
    /// leave the app; a remote screen gets them here.
    pub fn publish_control(&self, kind: &str, data: serde_json::Value) {
        let Some(kind) = RemoteControlKind::from_wire(kind) else {
            warn!("remote: ignoring unknown control message '{}'", kind);

            return;
        };

        self.send(kind.wire_name(), data, kind.replayed());
    }

    pub fn snapshot_for(&self, slug: &str) -> Option<serde_json::Value> {
        lock_or_recover(&self.snapshots).get(slug).cloned()
    }

    /// Screens the main window has published, as `(slug, name)`. Drives the
    /// index page, which is the only place the server itself has to know that
    /// a snapshot carries a name.
    pub fn screens(&self) -> Vec<(String, String)> {
        let mut screens: Vec<(String, String)> = lock_or_recover(&self.snapshots)
            .iter()
            .map(|(slug, snapshot)| {
                let name = snapshot
                    .get("name")
                    .and_then(|value| value.as_str())
                    .unwrap_or(slug.as_str());

                (slug.clone(), name.to_string())
            })
            .collect();

        screens.sort_by(|left, right| left.1.cmp(&right.1));

        screens
    }

    pub fn replay_messages(&self) -> Vec<RemoteMessage> {
        lock_or_recover(&self.replay).values().cloned().collect()
    }

    /// Records what a device reported about itself when it connected.
    ///
    /// This is the only thing a client is allowed to say, and it changes
    /// nothing: the settings UI reads it to offer matching the screen size to
    /// the real device.
    pub fn set_device(&self, device: RemoteDevice) {
        lock_or_recover(&self.devices).insert(device.slug.clone(), device);
    }

    /// Marks a screen's device as gone without forgetting its size.
    pub fn mark_device_disconnected(&self, slug: &str) {
        if let Some(device) = lock_or_recover(&self.devices).get_mut(slug) {
            device.connected = false;
        }
    }

    pub fn device_for(&self, slug: &str) -> Option<RemoteDevice> {
        lock_or_recover(&self.devices).get(slug).cloned()
    }

    pub fn devices(&self) -> Vec<RemoteDevice> {
        lock_or_recover(&self.devices).values().cloned().collect()
    }

    /// A stopped server must not hand stale frames to the next one.
    pub fn clear(&self) {
        lock_or_recover(&self.snapshots).clear();
        lock_or_recover(&self.replay).clear();
        lock_or_recover(&self.devices).clear();
    }

    /// Encodes an out-of-band message for one socket (the initial snapshot).
    pub fn encode<T: Serialize>(kind: &'static str, data: T) -> Option<RemoteMessage> {
        serde_json::to_string(&Envelope { kind, data })
            .map(Arc::new)
            .ok()
    }
}

/// Fields that arrive at 10 Hz or slower. `serde` omits the absent ones, so
/// their presence in the encoded bundle is what marks a tick as carrying
/// something the rate limit must not throw away.
///
/// These are the *wire* names, which `TelemetryBundle` renames to camelCase.
/// A rename that missed this list would not fail anything — it would quietly
/// make every bundle look 60 Hz-only and start throwing away the session clock
/// along with the motion data, which is why the test below pins them to the
/// real serialization.
const SLOW_FIELD_KEYS: [&str; 14] = [
    "\"carIdx\"",
    "\"chassis\"",
    "\"lapTiming\"",
    "\"proximity\"",
    "\"driverEntries\"",
    "\"relative\"",
    "\"carStatus\"",
    "\"fuel\"",
    "\"pitStops\"",
    "\"pitService\"",
    "\"session\"",
    "\"environment\"",
    "\"lapLog\"",
    "\"trackRecording\"",
];

/// Whether this bundle carries anything below 60 Hz.
///
/// A substring scan rather than a parse: the payload is already-encoded JSON,
/// and re-parsing it sixty times a second to answer one yes/no question would
/// cost more than the send it decides about.
fn carries_slow_fields(json: &str) -> bool {
    SLOW_FIELD_KEYS.iter().any(|key| json.contains(key))
}

/// Compares two tokens without returning early on the first differing byte.
///
/// `==` on strings stops at the first mismatch, so the time it takes leaks how
/// long a shared prefix was — enough, over enough attempts, to recover a token
/// one byte at a time. Every byte is folded in here, and the length check is
/// separate because the length is not a secret.
fn tokens_match(candidate: &str, expected: &str) -> bool {
    if candidate.len() != expected.len() {
        return false;
    }

    let difference = candidate
        .as_bytes()
        .iter()
        .zip(expected.as_bytes())
        .fold(0u8, |acc, (left, right)| acc | (left ^ right));

    difference == 0
}

/// `{"type":"<kind>","data":<json>}` without re-encoding `json`. The payload
/// comes from Tauri's event stream, so it is already valid JSON.
fn wrap_raw(kind: &str, json: &str) -> String {
    let body = if json.is_empty() { "null" } else { json };

    format!(r#"{{"type":"{kind}","data":{body}}}"#)
}

#[derive(Serialize)]
struct SnapshotPayload {
    slug: String,
    snapshot: serde_json::Value,
}

#[cfg(test)]
mod tests {
    use super::tokens_match;
    use super::{carries_slow_fields, SLOW_FIELD_KEYS};

    /// The rate limit reads these keys out of an already-encoded bundle, so
    /// they have to be the names `serde` actually writes. A `rename_all` added
    /// to `TelemetryBundle` without touching this list would not fail anything
    /// — it would quietly make every bundle look 60 Hz-only and start throwing
    /// the session clock and the fuel numbers off every remote screen.
    #[test]
    fn the_slow_field_keys_are_the_names_serde_writes() {
        let bundle = crate::telemetry::emitter::TelemetryBundle {
            environment: Some(Default::default()),
            ..Default::default()
        };

        let encoded = serde_json::to_string(&bundle).unwrap();

        assert!(encoded.contains("\"environment\""));
        assert!(carries_slow_fields(&encoded));

        for key in SLOW_FIELD_KEYS {
            assert!(
                !key.contains('_'),
                "{key} is a snake_case name; the bundle is serialized camelCase"
            );
        }
    }

    #[test]
    fn accepts_only_the_exact_token() {
        assert!(tokens_match("a3f9", "a3f9"));
        assert!(!tokens_match("a3f8", "a3f9"));
    }

    #[test]
    fn rejects_a_prefix_and_a_longer_guess() {
        assert!(!tokens_match("a3f", "a3f9"));
        assert!(!tokens_match("a3f90", "a3f9"));
    }

    #[test]
    fn rejects_an_empty_guess() {
        assert!(!tokens_match("", "a3f9"));
    }

    #[test]
    fn thins_only_the_pure_60_hz_bundles() {
        let fast = r#"{"car_dynamics":{"speed":1.0},"car_inputs":{"throttle":0.5}}"#;

        assert!(!carries_slow_fields(fast));
    }

    #[test]
    fn never_thins_a_bundle_carrying_the_session_clock() {
        // The timer widget reads the session clock; dropping the tick that
        // carried it made the clock jump a second at a time.
        let slow = r#"{"car_dynamics":{"speed":1.0},"session":{"session_time":12.0}}"#;

        assert!(carries_slow_fields(slow));
    }

    #[test]
    fn never_thins_the_four_hz_tier() {
        let slow = r#"{"car_inputs":{"throttle":0.1},"fuel":{"level":40.0}}"#;

        assert!(carries_slow_fields(slow));
    }
}
