//! Stream chat runtime — Twitch and YouTube live chat, normalized and pushed
//! to the frontend.
//!
//! Deliberately a sibling of `telemetry/` rather than a part of it: chat is not
//! sim data, runs on its own connections, and must keep working while no sim is
//! running at all.

pub mod commands;
pub mod helix;
pub mod runtime;
pub mod secrets;
pub mod state;
pub mod twitch;
pub mod youtube;

/// One normalized message. Emitted per message, so the frontend appends.
pub const EVENT_CHAT_MESSAGE: &str = "chat://message";
/// Per-platform status and viewer count. Slow cadence, replaces previous state.
pub const EVENT_CHAT_PRESENCE: &str = "chat://presence";
/// A row must disappear — moderator deleted a message or banned an author.
pub const EVENT_CHAT_DELETION: &str = "chat://deletion";

/// Palette mirrored from `_widget-tokens.scss` ($race-*). YouTube gives authors
/// no colour, so one is derived from the name — a grey wall of identical nicks
/// is far worse than an arbitrary but stable colour.
const AUTHOR_COLORS: [&str; 8] = [
    "#8b5cf6", // lilac
    "#10b981", // green
    "#3b82f6", // blue
    "#f59e0b", // amber
    "#ef4444", // red
    "#a855f7", // purple
    "#facc15", // gold
    "#f97316", // orange
];

/// FNV-1a over the author name. Stable across restarts and across platforms,
/// which is the whole point — regulars stay recognizable.
pub fn color_for_author(name: &str) -> String {
    let mut hash: u32 = 2_166_136_261;

    for byte in name.as_bytes() {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(16_777_619);
    }

    AUTHOR_COLORS[(hash as usize) % AUTHOR_COLORS.len()].to_string()
}

/// Twitch client id, baked at compile time from `.env` / CI. Public by Twitch's
/// own definition ("Client IDs are considered public"), so embedding it is fine
/// — only the client secret would need protecting, and no flow here uses one.
///
/// A user-supplied id always wins: builds from source have no baked value, and
/// some users prefer their own application.
pub fn resolve_client_id(provided: Option<&str>) -> Option<String> {
    let user_value = provided
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    if user_value.is_some() {
        return user_value;
    }

    option_env!("TWITCH_CLIENT_ID")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

/// Whether signing in is possible at all — drives the hint in the settings UI.
pub fn has_baked_client_id() -> bool {
    option_env!("TWITCH_CLIENT_ID")
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
}

/// Milliseconds since the Unix epoch, as f64 so it survives the JSON bridge
/// without precision games on the frontend.
pub fn now_ms() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as f64)
        .unwrap_or(0.0)
}

/// Exponential backoff, capped. Used by both platform loops.
pub fn backoff_delay(attempt: u32) -> std::time::Duration {
    const BASE_MS: u64 = 1_000;
    const MAX_MS: u64 = 30_000;

    let shift = attempt.min(5);
    let millis = BASE_MS.saturating_mul(1 << shift).min(MAX_MS);

    std::time::Duration::from_millis(millis)
}
