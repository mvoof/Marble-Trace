//! YouTube live chat via InnerTube — the same endpoint the live_chat page uses.
//!
//! The official Data API is unusable here: `liveChatMessages.list` costs 5 quota
//! units per poll against a project-wide daily budget of 10 000, so an app
//! shipped to many users would exhaust it within minutes. InnerTube has no
//! quota and needs no key from us, at the cost of being undocumented — hence the
//! defensive parsing throughout: unknown renderers are skipped, never fatal.

use std::sync::Arc;

use tauri::{AppHandle, Emitter};
use tracing::{debug, info, warn};

use super::state::ChatServiceState;
use super::{
    backoff_delay, color_for_author, now_ms, EVENT_CHAT_DELETION, EVENT_CHAT_MESSAGE,
    EVENT_CHAT_PRESENCE,
};
use crate::model::chat::{
    ChatBadge, ChatConnectionStatus, ChatDeletion, ChatFragment, ChatHighlight, ChatHighlightKind,
    ChatMessage, ChatPlatform, ChatPresence,
};

const CHAT_ENDPOINT: &str = "https://www.youtube.com/youtubei/v1/live_chat/get_live_chat";
const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const DEFAULT_POLL_MS: u64 = 2_000;
const VIEWER_POLL_SECONDS: u64 = 60;

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|error| format!("http client: {error}"))
}

/// Scans forward from `key` and returns the balanced JSON object that follows
/// it. A plain regex cannot do this — the payloads nest arbitrarily deep and
/// contain braces inside string literals.
fn extract_json_after(haystack: &str, key: &str) -> Option<String> {
    let start = haystack.find(key)? + key.len();
    let rest = &haystack[start..];
    let open = rest.find('{')?;
    let bytes = rest.as_bytes();

    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for index in open..bytes.len() {
        let current = bytes[index];

        if in_string {
            if escaped {
                escaped = false;
            } else if current == b'\\' {
                escaped = true;
            } else if current == b'"' {
                in_string = false;
            }

            continue;
        }

        match current {
            b'"' => in_string = true,
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;

                if depth == 0 {
                    return Some(rest[open..=index].to_string());
                }
            }
            _ => {}
        }
    }

    None
}

fn extract_string_after(haystack: &str, key: &str) -> Option<String> {
    let start = haystack.find(key)? + key.len();
    let rest = haystack[start..].trim_start();
    let rest = rest.strip_prefix('"')?;
    let end = rest.find('"')?;

    Some(rest[..end].to_string())
}

/// Accepts a bare video id, a watch/live/short URL, a channel URL or a @handle.
/// Channel forms need a round trip because the video id changes every stream.
async fn resolve_video_id(target: &str) -> Result<String, String> {
    let trimmed = target.trim();

    if trimmed.is_empty() {
        return Err("empty youtube target".to_string());
    }

    if trimmed.len() == 11 && !trimmed.contains('/') && !trimmed.contains('.') {
        return Ok(trimmed.to_string());
    }

    if let Some(rest) = trimmed.split("v=").nth(1) {
        let id: String = rest.chars().take_while(|c| *c != '&').collect();

        if id.len() == 11 {
            return Ok(id);
        }
    }

    if let Some(rest) = trimmed.rsplit("youtu.be/").next() {
        let id: String = rest
            .chars()
            .take_while(|c| *c != '?' && *c != '&')
            .collect();

        if id.len() == 11 {
            return Ok(id);
        }
    }

    // Channel or handle: /live redirects to whatever is streaming right now.
    let live_url = if trimmed.starts_with("http") {
        format!("{}/live", trimmed.trim_end_matches('/'))
    } else if let Some(handle) = trimmed.strip_prefix('@') {
        format!("https://www.youtube.com/@{handle}/live")
    } else {
        format!("https://www.youtube.com/@{trimmed}/live")
    };

    let body = client()?
        .get(&live_url)
        .send()
        .await
        .map_err(|error| format!("resolve live: {error}"))?
        .text()
        .await
        .map_err(|error| format!("resolve live body: {error}"))?;

    if let Some(id) = extract_string_after(&body, "\"videoId\":") {
        if id.len() == 11 {
            return Ok(id);
        }
    }

    Err("no live stream found for that channel".to_string())
}

struct ChatSession {
    api_key: String,
    context: serde_json::Value,
    continuation: String,
}

/// Recursively finds the first `continuation` string. YouTube moves it between
/// `invalidationContinuationData`, `timedContinuationData` and
/// `reloadContinuationData` depending on the stream, so keying off one of them
/// breaks periodically; searching by field name does not.
fn find_continuation(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Object(map) => {
            if let Some(serde_json::Value::String(token)) = map.get("continuation") {
                if !token.is_empty() {
                    return Some(token.clone());
                }
            }

            map.values().find_map(find_continuation)
        }
        serde_json::Value::Array(items) => items.iter().find_map(find_continuation),
        _ => None,
    }
}

async fn open_session(video_id: &str) -> Result<ChatSession, String> {
    let url = format!("https://www.youtube.com/live_chat?v={video_id}");
    let body = client()?
        .get(&url)
        .send()
        .await
        .map_err(|error| format!("live_chat page: {error}"))?
        .text()
        .await
        .map_err(|error| format!("live_chat body: {error}"))?;

    let api_key = extract_string_after(&body, "\"INNERTUBE_API_KEY\":")
        .ok_or_else(|| "no INNERTUBE_API_KEY on the page".to_string())?;

    // Reusing the page's whole context object keeps the session valid far
    // longer than assembling one from individual client fields.
    let context_raw = extract_json_after(&body, "\"INNERTUBE_CONTEXT\":")
        .ok_or_else(|| "no INNERTUBE_CONTEXT on the page".to_string())?;
    let context: serde_json::Value =
        serde_json::from_str(&context_raw).map_err(|error| format!("context json: {error}"))?;

    let initial_raw = extract_json_after(&body, "window[\"ytInitialData\"] =")
        .or_else(|| extract_json_after(&body, "var ytInitialData ="))
        .or_else(|| extract_json_after(&body, "\"ytInitialData\":"))
        .ok_or_else(|| "no ytInitialData on the page".to_string())?;
    let initial: serde_json::Value = serde_json::from_str(&initial_raw)
        .map_err(|error| format!("ytInitialData json: {error}"))?;

    let continuation =
        find_continuation(&initial).ok_or_else(|| "no continuation token".to_string())?;

    Ok(ChatSession {
        api_key,
        context,
        continuation,
    })
}

fn fragments_from_runs(runs: &serde_json::Value) -> Vec<ChatFragment> {
    let Some(items) = runs.as_array() else {
        return Vec::new();
    };

    let mut fragments = Vec::new();

    for run in items {
        if let Some(text) = run["text"].as_str() {
            fragments.push(ChatFragment::Text {
                text: text.to_string(),
            });

            continue;
        }

        let emoji = &run["emoji"];

        if emoji.is_null() {
            continue;
        }

        // Unicode emoji come through as emoji objects too, but with no useful
        // image — those are better rendered as plain text.
        let shortcut = emoji["shortcuts"][0]
            .as_str()
            .or_else(|| emoji["emojiId"].as_str())
            .unwrap_or("")
            .to_string();

        let url = emoji["image"]["thumbnails"]
            .as_array()
            .and_then(|thumbnails| thumbnails.last())
            .and_then(|thumbnail| thumbnail["url"].as_str())
            .unwrap_or_default()
            .to_string();

        if url.is_empty() {
            fragments.push(ChatFragment::Text { text: shortcut });
        } else {
            fragments.push(ChatFragment::Emote {
                name: shortcut,
                url,
            });
        }
    }

    fragments
}

fn badges_from_renderer(renderer: &serde_json::Value) -> Vec<ChatBadge> {
    let Some(items) = renderer["authorBadges"].as_array() else {
        return Vec::new();
    };

    items
        .iter()
        .filter_map(|badge| {
            let inner = &badge["liveChatAuthorBadgeRenderer"];
            let icon = inner["icon"]["iconType"].as_str().unwrap_or("");

            match icon {
                "MODERATOR" => Some(ChatBadge {
                    kind: "moderator".to_string(),
                    label: "MOD".to_string(),
                    // YouTube's own badge icons are vector glyphs with no image
                    // URL, so these keep the text plate.
                    url: None,
                }),
                "OWNER" => Some(ChatBadge {
                    kind: "broadcaster".to_string(),
                    label: "HOST".to_string(),
                    url: None,
                }),
                "VERIFIED" => Some(ChatBadge {
                    kind: "verified".to_string(),
                    label: "✓".to_string(),
                    url: None,
                }),
                // Channel members carry a custom thumbnail instead of an icon —
                // and that one is a real image, no extra request needed.
                _ if inner["customThumbnail"].is_object() => Some(ChatBadge {
                    kind: "subscriber".to_string(),
                    label: "SUB".to_string(),
                    url: inner["customThumbnail"]["thumbnails"]
                        .as_array()
                        .and_then(|thumbnails| thumbnails.last())
                        .and_then(|thumbnail| thumbnail["url"].as_str())
                        .map(str::to_string),
                }),
                _ => None,
            }
        })
        .collect()
}

fn message_from_renderer(
    renderer: &serde_json::Value,
    highlight: Option<ChatHighlight>,
) -> Option<ChatMessage> {
    let author_name = renderer["authorName"]["simpleText"]
        .as_str()
        .unwrap_or_default()
        .to_string();

    if author_name.is_empty() {
        return None;
    }

    let id = renderer["id"].as_str().unwrap_or_default().to_string();

    Some(ChatMessage {
        platform: ChatPlatform::Youtube,
        id: if id.is_empty() {
            format!("yt-{}", now_ms())
        } else {
            id
        },
        // YouTube has no author colour at all — derive a stable one.
        author_color: color_for_author(&author_name),
        author_name,
        badges: badges_from_renderer(renderer),
        fragments: fragments_from_runs(&renderer["message"]["runs"]),
        timestamp_ms: now_ms(),
        highlight,
    })
}

/// Returns the next continuation token and how long to wait before using it.
fn handle_actions(app: &AppHandle, payload: &serde_json::Value) -> (Option<String>, u64) {
    let live_chat = &payload["continuationContents"]["liveChatContinuation"];

    if let Some(actions) = live_chat["actions"].as_array() {
        for action in actions {
            if let Some(target) = action["markChatItemAsDeletedAction"]["targetItemId"].as_str() {
                let deletion = ChatDeletion {
                    platform: ChatPlatform::Youtube,
                    message_id: Some(target.to_string()),
                    author_name: None,
                };
                let _ = app.emit(EVENT_CHAT_DELETION, &deletion);

                continue;
            }

            let item = &action["addChatItemAction"]["item"];

            if item.is_null() {
                continue;
            }

            let message = if item["liveChatTextMessageRenderer"].is_object() {
                message_from_renderer(&item["liveChatTextMessageRenderer"], None)
            } else if item["liveChatPaidMessageRenderer"].is_object() {
                let renderer = &item["liveChatPaidMessageRenderer"];
                let amount = renderer["purchaseAmountText"]["simpleText"]
                    .as_str()
                    .map(str::to_string);

                message_from_renderer(
                    renderer,
                    Some(ChatHighlight {
                        kind: ChatHighlightKind::Paid,
                        text: String::new(),
                        amount,
                        bits: None,
                    }),
                )
            } else if item["liveChatMembershipItemRenderer"].is_object() {
                let renderer = &item["liveChatMembershipItemRenderer"];
                let text = renderer["headerSubtext"]["runs"]
                    .as_array()
                    .map(|runs| {
                        runs.iter()
                            .filter_map(|run| run["text"].as_str())
                            .collect::<Vec<_>>()
                            .join("")
                    })
                    .unwrap_or_default();

                message_from_renderer(
                    renderer,
                    Some(ChatHighlight {
                        kind: ChatHighlightKind::Subscription,
                        text,
                        amount: None,
                        bits: None,
                    }),
                )
            } else {
                // Placeholders, tickers, banners and whatever YouTube adds next.
                None
            };

            if let Some(message) = message {
                if let Err(error) = app.emit(EVENT_CHAT_MESSAGE, &message) {
                    warn!("failed to emit youtube message: {error}");
                }
            }
        }
    }

    let continuation_entry = live_chat["continuations"]
        .as_array()
        .and_then(|items| items.first())
        .cloned()
        .unwrap_or(serde_json::Value::Null);

    let timeout = continuation_entry
        .as_object()
        .and_then(|map| map.values().next())
        .and_then(|inner| inner["timeoutMs"].as_u64())
        .unwrap_or(DEFAULT_POLL_MS)
        .clamp(1_000, 10_000);

    (find_continuation(&continuation_entry), timeout)
}

/// Concurrent viewers off the watch page. Free — the number sits in the same
/// blob we already know how to read, so no API and no quota are involved.
async fn fetch_viewers(video_id: &str) -> Option<u32> {
    let url = format!("https://www.youtube.com/watch?v={video_id}");
    let body = client()
        .ok()?
        .get(&url)
        .send()
        .await
        .ok()?
        .text()
        .await
        .ok()?;

    let raw = extract_string_after(&body, "\"originalViewCount\":")?;

    raw.chars()
        .filter(|c| c.is_ascii_digit())
        .collect::<String>()
        .parse()
        .ok()
}

async fn run_viewer_poll(
    app: AppHandle,
    service: Arc<ChatServiceState>,
    generation: u64,
    video_id: String,
) {
    while service.is_current(generation) {
        if let Some(viewers) = fetch_viewers(&video_id).await {
            let mut presence = ChatPresence::new(ChatPlatform::Youtube, ChatConnectionStatus::Live);
            presence.viewers = Some(viewers);
            let _ = app.emit(EVENT_CHAT_PRESENCE, &presence);
        }

        for _ in 0..VIEWER_POLL_SECONDS {
            if !service.is_current(generation) {
                return;
            }

            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    }
}

fn emit_presence(app: &AppHandle, presence: ChatPresence) {
    if let Err(error) = app.emit(EVENT_CHAT_PRESENCE, &presence) {
        warn!("failed to emit youtube presence: {error}");
    }
}

pub async fn run(app: AppHandle, service: Arc<ChatServiceState>, generation: u64, target: String) {
    let mut attempt: u32 = 0;
    let mut viewer_task: Option<tokio::task::JoinHandle<()>> = None;

    while service.is_current(generation) {
        if attempt == 0 {
            emit_presence(
                &app,
                ChatPresence::new(ChatPlatform::Youtube, ChatConnectionStatus::Connecting),
            );
        } else {
            emit_presence(
                &app,
                ChatPresence::new(ChatPlatform::Youtube, ChatConnectionStatus::Reconnecting)
                    .with_retry(attempt),
            );
            tokio::time::sleep(backoff_delay(attempt)).await;

            if !service.is_current(generation) {
                break;
            }
        }

        let video_id = match resolve_video_id(&target).await {
            Ok(id) => id,
            Err(error) => {
                warn!("youtube resolve failed: {error}");
                emit_presence(
                    &app,
                    ChatPresence::new(ChatPlatform::Youtube, ChatConnectionStatus::Error)
                        .with_detail(error),
                );
                attempt = attempt.saturating_add(1);

                continue;
            }
        };

        let mut session = match open_session(&video_id).await {
            Ok(session) => session,
            Err(error) => {
                warn!("youtube session failed: {error}");
                emit_presence(
                    &app,
                    ChatPresence::new(ChatPlatform::Youtube, ChatConnectionStatus::Error)
                        .with_detail(error),
                );
                attempt = attempt.saturating_add(1);

                continue;
            }
        };

        info!(video_id, "youtube chat connected");
        emit_presence(
            &app,
            ChatPresence::new(ChatPlatform::Youtube, ChatConnectionStatus::Live),
        );

        if viewer_task.is_none() {
            viewer_task = Some(tokio::spawn(run_viewer_poll(
                app.clone(),
                Arc::clone(&service),
                generation,
                video_id.clone(),
            )));
        }

        attempt = 0;

        // Poll loop: one request per continuation token, pacing set by YouTube.
        loop {
            if !service.is_current(generation) {
                break;
            }

            let url = format!("{CHAT_ENDPOINT}?key={}", session.api_key);
            let body = serde_json::json!({
                "context": session.context,
                "continuation": session.continuation,
            });

            let response = match client() {
                Ok(http) => http.post(&url).json(&body).send().await,
                Err(error) => {
                    warn!("youtube client error: {error}");

                    break;
                }
            };

            let payload: serde_json::Value = match response {
                Ok(response) if response.status().is_success() => match response.json().await {
                    Ok(value) => value,
                    Err(error) => {
                        warn!("youtube chat json: {error}");

                        break;
                    }
                },
                Ok(response) => {
                    debug!(status = %response.status(), "youtube chat poll rejected");

                    break;
                }
                Err(error) => {
                    warn!("youtube chat poll: {error}");

                    break;
                }
            };

            let (next, timeout) = handle_actions(&app, &payload);

            let Some(next) = next else {
                debug!("youtube stopped issuing continuations — stream likely ended");

                break;
            };

            session.continuation = next;
            tokio::time::sleep(std::time::Duration::from_millis(timeout)).await;
        }

        attempt = attempt.saturating_add(1);
    }

    if let Some(task) = viewer_task {
        task.abort();
    }

    emit_presence(
        &app,
        ChatPresence::new(ChatPlatform::Youtube, ChatConnectionStatus::Offline),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_balanced_object_with_nested_braces() {
        let html = r#"junk "INNERTUBE_CONTEXT":{"client":{"name":"WEB"},"x":1},"other":2"#;
        let extracted = extract_json_after(html, "\"INNERTUBE_CONTEXT\":").unwrap();

        assert_eq!(extracted, r#"{"client":{"name":"WEB"},"x":1}"#);
    }

    #[test]
    fn ignores_braces_inside_strings() {
        let html = r#""K":{"a":"}{","b":1}"#;
        let extracted = extract_json_after(html, "\"K\":").unwrap();

        assert_eq!(extracted, r#"{"a":"}{","b":1}"#);
    }

    #[test]
    fn extracts_plain_strings() {
        let html = r#"x "INNERTUBE_API_KEY": "AIzaSyABC", y"#;

        assert_eq!(
            extract_string_after(html, "\"INNERTUBE_API_KEY\":").as_deref(),
            Some("AIzaSyABC")
        );
    }

    #[test]
    fn finds_continuation_at_any_depth() {
        let value = serde_json::json!({
            "a": { "b": [ { "timedContinuationData": { "continuation": "TOKEN" } } ] }
        });

        assert_eq!(find_continuation(&value).as_deref(), Some("TOKEN"));
    }

    #[test]
    fn ignores_empty_continuation() {
        let value = serde_json::json!({ "continuation": "" });

        assert_eq!(find_continuation(&value), None);
    }

    #[test]
    fn builds_fragments_from_runs() {
        let runs = serde_json::json!([
            { "text": "hi " },
            { "emoji": { "shortcuts": [":yt:"], "image": { "thumbnails": [{ "url": "u" }] } } }
        ]);

        let fragments = fragments_from_runs(&runs);

        assert_eq!(fragments.len(), 2);
        assert!(matches!(fragments[1], ChatFragment::Emote { .. }));
    }

    #[test]
    fn emoji_without_image_falls_back_to_text() {
        let runs = serde_json::json!([{ "emoji": { "emojiId": "😀" } }]);
        let fragments = fragments_from_runs(&runs);

        assert!(matches!(fragments[0], ChatFragment::Text { .. }));
    }

    #[test]
    fn skips_messages_without_author() {
        let renderer = serde_json::json!({ "message": { "runs": [] } });

        assert!(message_from_renderer(&renderer, None).is_none());
    }
}
