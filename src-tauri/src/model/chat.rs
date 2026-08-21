//! Stream chat model — normalized shape shared by every chat platform.
//!
//! Twitch arrives as IRC lines with IRCv3 tags, YouTube as deeply nested
//! InnerTube JSON. Both are flattened into `ChatMessage` here so the widget
//! never learns which platform a row came from beyond the `platform` field.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "lowercase")]
pub enum ChatPlatform {
    Twitch,
    Youtube,
}

/// Connection state of a single platform, surfaced as the footer status dot.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "lowercase")]
pub enum ChatConnectionStatus {
    Live,
    Connecting,
    Reconnecting,
    Offline,
    Error,
}

/// A message is a sequence of fragments, never a raw string: emote positions
/// arrive as index ranges (Twitch) or as separate runs (YouTube), and both
/// collapse to this list so the renderer just walks it.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ChatFragment {
    #[serde(rename_all = "camelCase")]
    Text { text: String },
    #[serde(rename_all = "camelCase")]
    Emote { name: String, url: String },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ChatBadge {
    /// Stable key the widget maps to a colour: "moderator", "subscriber", "vip".
    pub kind: String,
    /// Short uppercase text shown in the badge plate.
    pub label: String,
    /// Artwork, when it could be resolved. Twitch retired the anonymous badge
    /// endpoint, so on Twitch this is filled only while signed in; the text
    /// plate is always the fallback.
    pub url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub enum ChatHighlightKind {
    Subscription,
    Raid,
    Paid,
    FirstMessage,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ChatHighlight {
    pub kind: ChatHighlightKind,
    /// Pre-rendered line for event rows ("kartoshka resubscribed · 8 months").
    pub text: String,
    /// Super Chat amount, already formatted with its currency by the platform.
    pub amount: Option<String>,
    /// Twitch cheer size. A raw count rather than a formatted string: unlike a
    /// Super Chat sum, "bits" is a word the frontend has to translate.
    pub bits: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub platform: ChatPlatform,
    /// Platform message id — required to drop the row when a mod deletes it.
    pub id: String,
    pub author_name: String,
    /// Hex colour. Twitch sends it in the `color` tag; YouTube has none, so the
    /// source derives a stable colour from the author name.
    pub author_color: String,
    pub badges: Vec<ChatBadge>,
    pub fragments: Vec<ChatFragment>,
    pub timestamp_ms: f64,
    pub highlight: Option<ChatHighlight>,
}

/// Moderation event — removes an already rendered row.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ChatDeletion {
    pub platform: ChatPlatform,
    /// Single message id, when the platform names one.
    pub message_id: Option<String>,
    /// Author whose whole history is cleared (Twitch ban / timeout).
    pub author_name: Option<String>,
}

/// Active room restriction. Kept structured rather than pre-rendered: the
/// banner text is translated in the frontend, next to every other UI string.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ChatRoomMode {
    SubsOnly,
    EmoteOnly,
    FollowersOnly,
    #[serde(rename_all = "camelCase")]
    Slow {
        seconds: u32,
    },
}

/// Per-platform presence, emitted on its own slow cadence rather than riding
/// along with messages: viewer counts refresh every 30-60 s, messages do not.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ChatPresence {
    pub platform: ChatPlatform,
    pub status: ChatConnectionStatus,
    /// None when the platform does not expose a count on the current auth path.
    pub viewers: Option<u32>,
    /// Seconds since the stream went live, when known. u32 rather than u64
    /// because specta forbids BigInt-width integers in the TS contract.
    pub uptime_seconds: Option<u32>,
    pub room_mode: Option<ChatRoomMode>,
    /// Reconnect attempt number, shown in the reconnect banner.
    pub retry: Option<u32>,
    /// Human-readable failure reason for the error banner.
    pub detail: Option<String>,
}

impl ChatPresence {
    pub fn new(platform: ChatPlatform, status: ChatConnectionStatus) -> Self {
        Self {
            platform,
            status,
            viewers: None,
            uptime_seconds: None,
            room_mode: None,
            retry: None,
            detail: None,
        }
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    pub fn with_retry(mut self, retry: u32) -> Self {
        self.retry = Some(retry);
        self
    }
}

/// Everything the chat runtime needs to connect, sent from the frontend when
/// the user edits the source settings.
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ChatConfig {
    /// Twitch login name, without the leading '#'. Empty disables Twitch.
    pub twitch_channel: Option<String>,
    /// YouTube video id, full watch URL, channel URL or @handle.
    pub youtube_target: Option<String>,
    pub twitch_client_id: Option<String>,
    /// Bumped by the frontend on sign-in and sign-out. The tokens themselves
    /// live in the OS credential store and are read there by the runtime, so
    /// they never cross the IPC bridge; this only tells it to reconnect.
    pub auth_revision: u32,
}

/// Device code flow, step one — what the user must type in to authorize.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TwitchDeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u32,
    pub interval: u32,
}

/// Device code flow, step two — the result of one poll attempt.
///
/// Carries no tokens on purpose: they are written straight to the OS credential
/// store by the backend, so the frontend only ever learns *that* sign-in
/// succeeded and *who* signed in.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TwitchTokenResult {
    /// False while the user has not finished authorizing yet.
    pub authorized: bool,
    pub login: Option<String>,
    pub error: Option<String>,
}

#[cfg(feature = "dev")]
pub fn register_types(types: &mut specta::TypeCollection) {
    types
        .register::<ChatPlatform>()
        .register::<ChatConnectionStatus>()
        .register::<ChatFragment>()
        .register::<ChatBadge>()
        .register::<ChatHighlightKind>()
        .register::<ChatHighlight>()
        .register::<ChatMessage>()
        .register::<ChatDeletion>()
        .register::<ChatRoomMode>()
        .register::<ChatPresence>()
        .register::<ChatConfig>()
        .register::<TwitchDeviceCode>()
        .register::<TwitchTokenResult>();
}
