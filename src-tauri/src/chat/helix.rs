//! Twitch Helix — viewer count, uptime, and the device code sign-in flow.
//!
//! Anonymous IRC carries messages but no viewer count; that number lives only
//! in Helix, which always needs a token. The device code flow is used because
//! it is the one user-token flow that works for a public desktop client: no
//! client secret to ship, no embedded browser, and it returns a refresh token.
//!
//! Tokens are read from and written to the OS credential store here, so they
//! never reach the frontend.

use std::collections::HashMap;
use std::sync::Arc;

use tauri::{AppHandle, Emitter};
use tracing::{debug, info, warn};

use super::state::ChatServiceState;
use super::{secrets, EVENT_CHAT_PRESENCE};
use crate::model::chat::{
    ChatConnectionStatus, ChatPlatform, ChatPresence, TwitchDeviceCode, TwitchTokenResult,
};

const DEVICE_URL: &str = "https://id.twitch.tv/oauth2/device";
const TOKEN_URL: &str = "https://id.twitch.tv/oauth2/token";
const VALIDATE_URL: &str = "https://id.twitch.tv/oauth2/validate";
const STREAMS_URL: &str = "https://api.twitch.tv/helix/streams";
const USERS_URL: &str = "https://api.twitch.tv/helix/users";
const GLOBAL_BADGES_URL: &str = "https://api.twitch.tv/helix/chat/badges/global";
const CHANNEL_BADGES_URL: &str = "https://api.twitch.tv/helix/chat/badges";
const DEVICE_GRANT: &str = "urn:ietf:params:oauth:grant-type:device_code";

/// Read-only scope. Nothing here writes to chat or reads private data.
const SCOPES: &str = "chat:read";

/// Helix rate limits are generous (800/min); the ceiling here is taste, not
/// policy — a viewer number that moves faster than once a minute is noise.
const POLL_INTERVAL_SECONDS: u64 = 45;

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|error| format!("http client: {error}"))
}

fn rejected(message: impl Into<String>) -> TwitchTokenResult {
    TwitchTokenResult {
        authorized: false,
        login: None,
        error: Some(message.into()),
    }
}

fn pending() -> TwitchTokenResult {
    TwitchTokenResult {
        authorized: false,
        login: None,
        error: None,
    }
}

pub async fn request_device_code(client_id: &str) -> Result<TwitchDeviceCode, String> {
    let response = client()?
        .post(DEVICE_URL)
        .form(&[("client_id", client_id), ("scopes", SCOPES)])
        .send()
        .await
        .map_err(|error| format!("device code request: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("device code body: {error}"))?;

    if !status.is_success() {
        return Err(format!("device code rejected ({status}): {body}"));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&body).map_err(|error| format!("device code json: {error}"))?;

    Ok(TwitchDeviceCode {
        device_code: parsed["device_code"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        user_code: parsed["user_code"].as_str().unwrap_or_default().to_string(),
        verification_uri: parsed["verification_uri"]
            .as_str()
            .unwrap_or("https://www.twitch.tv/activate")
            .to_string(),
        expires_in: parsed["expires_in"].as_u64().unwrap_or(1800) as u32,
        interval: parsed["interval"].as_u64().unwrap_or(5).max(1) as u32,
    })
}

/// Persists a token response. Returns the login the token belongs to.
async fn store_token_response(parsed: &serde_json::Value) -> Result<TwitchTokenResult, String> {
    let access_token = parsed["access_token"]
        .as_str()
        .unwrap_or_default()
        .to_string();

    if access_token.is_empty() {
        return Ok(rejected("twitch returned no access token"));
    }

    let refresh = parsed["refresh_token"].as_str();

    if !secrets::save(&access_token, refresh) {
        return Ok(rejected(
            "could not store the token in the credential store",
        ));
    }

    let login = validate_token(&access_token).await.ok();

    Ok(TwitchTokenResult {
        authorized: true,
        login,
        error: None,
    })
}

/// One poll attempt. `authorized: false` with no error means the user simply
/// has not finished on twitch.tv yet — the caller should wait and retry.
pub async fn poll_device_token(
    client_id: &str,
    device_code: &str,
) -> Result<TwitchTokenResult, String> {
    let response = client()?
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client_id),
            ("device_code", device_code),
            ("grant_type", DEVICE_GRANT),
        ])
        .send()
        .await
        .map_err(|error| format!("token request: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("token body: {error}"))?;

    let parsed: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();

    if !status.is_success() {
        let message = parsed["message"].as_str().unwrap_or("").to_string();

        // Expected while the user is still typing the code in.
        if message.contains("authorization_pending") || message.contains("pending") {
            return Ok(pending());
        }

        return Ok(rejected(if message.is_empty() {
            format!("twitch rejected the code ({status})")
        } else {
            message
        }));
    }

    store_token_response(&parsed).await
}

/// Exchanges the stored refresh token for a fresh pair. Device code access
/// tokens last about four hours, so without this the viewer count quietly dies
/// mid-stream. Public clients send no secret — that is the point of the flow.
pub async fn refresh_stored_token(client_id: &str) -> Result<TwitchTokenResult, String> {
    let Some(refresh) = secrets::refresh_token() else {
        return Ok(rejected("no refresh token stored"));
    };

    let response = client()?
        .post(TOKEN_URL)
        .form(&[
            ("client_id", client_id),
            ("refresh_token", refresh.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|error| format!("refresh request: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("refresh body: {error}"))?;

    let parsed: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();

    if !status.is_success() {
        // The grant is gone for good; retrying would loop forever.
        secrets::clear();

        let message = parsed["message"].as_str().unwrap_or("").to_string();

        return Ok(rejected(if message.is_empty() {
            format!("refresh rejected ({status})")
        } else {
            message
        }));
    }

    store_token_response(&parsed).await
}

/// Returns the login name the token belongs to. Doubles as a liveness check —
/// a 401 here means the stored token is dead.
pub async fn validate_token(access_token: &str) -> Result<String, String> {
    let response = client()?
        .get(VALIDATE_URL)
        .header("Authorization", format!("OAuth {access_token}"))
        .send()
        .await
        .map_err(|error| format!("validate: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("token invalid ({})", response.status()));
    }

    let parsed: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("validate json: {error}"))?;

    Ok(parsed["login"].as_str().unwrap_or_default().to_string())
}

/// Login of the currently stored token, or None when signed out.
pub async fn current_login() -> Option<String> {
    let token = secrets::access_token()?;

    validate_token(&token).await.ok().filter(|l| !l.is_empty())
}

/// Resolves a login to the numeric broadcaster id that badge and stream
/// endpoints key off.
async fn fetch_user_id(client_id: &str, token: &str, login: &str) -> Result<String, String> {
    let response = client()?
        .get(USERS_URL)
        .query(&[("login", login)])
        .header("Client-Id", client_id)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|error| format!("users: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("users failed ({})", response.status()));
    }

    let parsed: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("users json: {error}"))?;

    parsed["data"][0]["id"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| format!("no twitch user named {login}"))
}

/// Flattens a badge response into `"set_id/version" -> image url`.
fn collect_badges(parsed: &serde_json::Value, into: &mut HashMap<String, String>) {
    let Some(sets) = parsed["data"].as_array() else {
        return;
    };

    for set in sets {
        let Some(set_id) = set["set_id"].as_str() else {
            continue;
        };

        let Some(versions) = set["versions"].as_array() else {
            continue;
        };

        for version in versions {
            let Some(id) = version["id"].as_str() else {
                continue;
            };

            // 4x downscaled stays crisp at any --wfs; 1x would not.
            let url = version["image_url_4x"]
                .as_str()
                .or_else(|| version["image_url_2x"].as_str())
                .or_else(|| version["image_url_1x"].as_str());

            if let Some(url) = url {
                into.insert(format!("{set_id}/{id}"), url.to_string());
            }
        }
    }
}

async fn fetch_badge_set(
    client_id: &str,
    token: &str,
    url: &str,
    broadcaster_id: Option<&str>,
) -> Result<serde_json::Value, String> {
    let mut request = client()?
        .get(url)
        .header("Client-Id", client_id)
        .header("Authorization", format!("Bearer {token}"));

    if let Some(id) = broadcaster_id {
        request = request.query(&[("broadcaster_id", id)]);
    }

    let response = request
        .send()
        .await
        .map_err(|error| format!("badges: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("badges failed ({})", response.status()));
    }

    response
        .json()
        .await
        .map_err(|error| format!("badges json: {error}"))
}

/// Global badges plus the channel's own. Channel entries deliberately overwrite
/// global ones: a broadcaster's subscriber artwork is theirs, not Twitch's.
pub async fn load_badges(
    client_id: &str,
    channel: &str,
) -> Result<HashMap<String, String>, String> {
    let token = secrets::access_token().ok_or("not signed in")?;
    let broadcaster_id = fetch_user_id(client_id, &token, channel).await?;

    let mut map = HashMap::new();

    match fetch_badge_set(client_id, &token, GLOBAL_BADGES_URL, None).await {
        Ok(parsed) => collect_badges(&parsed, &mut map),
        Err(error) => warn!("global badges failed: {error}"),
    }

    match fetch_badge_set(client_id, &token, CHANNEL_BADGES_URL, Some(&broadcaster_id)).await {
        Ok(parsed) => collect_badges(&parsed, &mut map),
        Err(error) => warn!("channel badges failed: {error}"),
    }

    Ok(map)
}

struct StreamInfo {
    viewers: u32,
    uptime_seconds: Option<u32>,
}

enum StreamError {
    /// Token expired or revoked — worth one refresh attempt.
    Unauthorized,
    Other(String),
}

async fn fetch_stream(
    client_id: &str,
    access_token: &str,
    channel: &str,
) -> Result<Option<StreamInfo>, StreamError> {
    let response = client()
        .map_err(StreamError::Other)?
        .get(STREAMS_URL)
        .query(&[("user_login", channel)])
        .header("Client-Id", client_id)
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|error| StreamError::Other(format!("streams: {error}")))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(StreamError::Unauthorized);
    }

    if !response.status().is_success() {
        return Err(StreamError::Other(format!(
            "streams failed ({})",
            response.status()
        )));
    }

    let parsed: serde_json::Value = response
        .json()
        .await
        .map_err(|error| StreamError::Other(format!("streams json: {error}")))?;

    let Some(entry) = parsed["data"].as_array().and_then(|items| items.first()) else {
        // Empty array simply means the channel is not live right now.
        return Ok(None);
    };

    let uptime_seconds = entry["started_at"]
        .as_str()
        .and_then(parse_rfc3339_seconds)
        .map(|started| {
            let now = super::now_ms() as u64 / 1000;

            now.saturating_sub(started).min(u64::from(u32::MAX)) as u32
        });

    Ok(Some(StreamInfo {
        viewers: entry["viewer_count"].as_u64().unwrap_or(0) as u32,
        uptime_seconds,
    }))
}

/// Minimal RFC3339 -> Unix seconds. Twitch always returns UTC with a `Z`, so
/// timezone offsets are intentionally not handled; anything unexpected yields
/// None and the uptime is simply hidden.
fn parse_rfc3339_seconds(raw: &str) -> Option<u64> {
    let bytes = raw.as_bytes();

    if bytes.len() < 20 || bytes[4] != b'-' || bytes[10] != b'T' {
        return None;
    }

    let year: i64 = raw.get(0..4)?.parse().ok()?;
    let month: i64 = raw.get(5..7)?.parse().ok()?;
    let day: i64 = raw.get(8..10)?.parse().ok()?;
    let hour: u64 = raw.get(11..13)?.parse().ok()?;
    let minute: u64 = raw.get(14..16)?.parse().ok()?;
    let second: u64 = raw.get(17..19)?.parse().ok()?;

    let days = days_from_civil(year, month, day);

    if days < 0 {
        return None;
    }

    Some((days as u64) * 86_400 + hour * 3_600 + minute * 60 + second)
}

/// Days since 1970-01-01, proleptic Gregorian (Howard Hinnant's algorithm).
fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = year - i64::from(month <= 2);
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400;
    let day_of_year = (153 * (month + if month > 2 { -3 } else { 9 }) + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;

    era * 146_097 + day_of_era - 719_468
}

/// Polls Helix for as long as the generation stays current, folding the result
/// into a presence update. Failures downgrade to "no number" rather than
/// tearing anything down — chat keeps working without a viewer count.
pub async fn run_presence_poll(
    app: AppHandle,
    service: Arc<ChatServiceState>,
    generation: u64,
    channel: String,
    client_id: String,
) {
    let channel = channel.trim().trim_start_matches('#').to_lowercase();

    while service.is_current(generation) {
        let Some(access_token) = secrets::access_token() else {
            debug!("no twitch token stored, viewer poll idle");

            return;
        };

        match fetch_stream(&client_id, &access_token, &channel).await {
            Ok(Some(info)) => {
                let mut presence =
                    ChatPresence::new(ChatPlatform::Twitch, ChatConnectionStatus::Live);
                presence.viewers = Some(info.viewers);
                presence.uptime_seconds = info.uptime_seconds;

                if let Err(error) = app.emit(EVENT_CHAT_PRESENCE, &presence) {
                    warn!("failed to emit twitch presence: {error}");
                }
            }
            Ok(None) => debug!(channel, "twitch channel is offline"),
            Err(StreamError::Unauthorized) => {
                info!("twitch token rejected, refreshing");

                match refresh_stored_token(&client_id).await {
                    Ok(result) if result.authorized => {
                        // Next iteration picks up the new token immediately.
                        continue;
                    }
                    Ok(result) => {
                        warn!(
                            "twitch refresh failed: {}",
                            result.error.unwrap_or_default()
                        );

                        return;
                    }
                    Err(error) => {
                        warn!("twitch refresh error: {error}");

                        return;
                    }
                }
            }
            Err(StreamError::Other(error)) => warn!("twitch viewer poll failed: {error}"),
        }

        for _ in 0..POLL_INTERVAL_SECONDS {
            if !service.is_current(generation) {
                return;
            }

            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn epoch_is_day_zero() {
        assert_eq!(days_from_civil(1970, 1, 1), 0);
    }

    #[test]
    fn parses_twitch_timestamps() {
        assert_eq!(parse_rfc3339_seconds("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(
            parse_rfc3339_seconds("2024-01-01T00:00:00Z"),
            Some(1_704_067_200)
        );
    }

    #[test]
    fn handles_leap_days() {
        assert_eq!(
            parse_rfc3339_seconds("2024-02-29T12:00:00Z"),
            Some(1_709_208_000)
        );
    }

    #[test]
    fn rejects_garbage() {
        assert_eq!(parse_rfc3339_seconds("not a date"), None);
        assert_eq!(parse_rfc3339_seconds(""), None);
    }
}
