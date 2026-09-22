//! Twitch EventSub over WebSocket — follows and structured subscription events.
//!
//! IRC carries neither: a follow is never announced there at all, and a
//! subscription arrives only as the rendered sentence in `system-msg`, with
//! tier, month count and gift size buried inside prose. EventSub sends both as
//! fields.
//!
//! The transport is WebSocket rather than webhooks because a desktop app has no
//! public callback URL to verify against, and because the socket needs no
//! client secret — the same reason the sign-in uses the device code flow.
//!
//! Runs only for the signed-in user's own channel. Every scope here is granted
//! over one's own broadcast, so a viewer watching someone else's chat gets the
//! IRC path and nothing more.

use std::sync::Arc;

use futures::{SinkExt, StreamExt};
use tauri::{AppHandle, Emitter};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{debug, info, warn};

use super::state::ChatServiceState;
use super::{backoff_delay, color_for_author, helix, now_ms, secrets, EVENT_CHAT_MESSAGE};
use crate::model::chat::{ChatHighlight, ChatHighlightKind, ChatMessage, ChatPlatform};

const WS_URL: &str = "wss://eventsub.wss.twitch.tv/ws";
const SUBSCRIPTIONS_URL: &str = "https://api.twitch.tv/helix/eventsub/subscriptions";

/// What the socket asks for on welcome. `channel.follow` is the only one that
/// takes a moderator id, and the only one at version 2.
const TOPICS: [(&str, &str); 4] = [
    ("channel.follow", "2"),
    ("channel.subscribe", "1"),
    ("channel.subscription.message", "1"),
    ("channel.subscription.gift", "1"),
];

/// Outcome of one socket lifetime. Twitch hands out a new URL before closing an
/// old socket, and that handover is not a failure — it must not back off or
/// count as a retry.
enum SocketEnd {
    Closed,
    Reconnect(String),
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|error| format!("http client: {error}"))
}

/// "1000" / "2000" / "3000" as Twitch spells tiers, and Prime as its own thing.
fn tier_label(tier: &str) -> Option<String> {
    match tier {
        "1000" => Some("Tier 1".to_string()),
        "2000" => Some("Tier 2".to_string()),
        "3000" => Some("Tier 3".to_string()),
        "prime" | "Prime" => Some("Prime".to_string()),
        _ => None,
    }
}

/// Event rows are pre-rendered by the source, the way `system-msg` already is
/// for IRC, so the widget walks one list and renders one kind of row.
fn joined(parts: &[Option<String>]) -> String {
    parts
        .iter()
        .flatten()
        .map(String::as_str)
        .collect::<Vec<_>>()
        .join(" · ")
}

fn event_message(kind: ChatHighlightKind, author: String, text: String) -> ChatMessage {
    ChatMessage {
        platform: ChatPlatform::Twitch,
        // EventSub ids are per delivery, not per event, so the message id is
        // synthesised the same way the IRC notice path does it. Nothing
        // deletes an event row, which is the only thing the id is read for.
        id: format!("tw-eventsub-{}", now_ms()),
        author_color: color_for_author(&author),
        author_name: author,
        badges: Vec::new(),
        fragments: Vec::new(),
        timestamp_ms: now_ms(),
        highlight: Some(ChatHighlight {
            kind,
            text,
            amount: None,
            bits: None,
        }),
    }
}

/// Builds the row for one notification, or None for a topic this build does not
/// render.
fn message_from_notification(topic: &str, event: &serde_json::Value) -> Option<ChatMessage> {
    let user = event["user_name"]
        .as_str()
        .filter(|name| !name.is_empty())
        .unwrap_or("Anonymous")
        .to_string();

    let tier = event["tier"].as_str().and_then(tier_label);

    match topic {
        "channel.follow" => Some(event_message(
            ChatHighlightKind::Follow,
            user.clone(),
            format!("{user} followed"),
        )),
        // A gifted sub raises both this and `channel.subscription.gift`; the
        // gift row names the giver and the count, so the recipient's own row
        // would be the same event told twice.
        "channel.subscribe" => {
            if event["is_gift"].as_bool().unwrap_or(false) {
                return None;
            }

            Some(event_message(
                ChatHighlightKind::Subscription,
                user.clone(),
                joined(&[Some(format!("{user} subscribed")), tier]),
            ))
        }
        "channel.subscription.message" => {
            let months = event["cumulative_months"]
                .as_u64()
                .map(|count| format!("{count} months"));

            Some(event_message(
                ChatHighlightKind::Subscription,
                user.clone(),
                joined(&[Some(format!("{user} resubscribed")), months, tier]),
            ))
        }
        "channel.subscription.gift" => {
            let count = event["total"].as_u64().unwrap_or(1);
            // An anonymous gift carries no user at all, which is why the user
            // fallback above is a name rather than a rejection.
            let giver = if event["is_anonymous"].as_bool().unwrap_or(false) {
                "Anonymous".to_string()
            } else {
                user
            };

            Some(event_message(
                ChatHighlightKind::Subscription,
                giver.clone(),
                joined(&[Some(format!("{giver} gifted {count} subs")), tier]),
            ))
        }
        _ => None,
    }
}

/// Asks Twitch to deliver one topic to this socket. Every topic is requested
/// individually: one rejected topic must not take the others with it.
async fn create_subscription(
    client_id: &str,
    token: &str,
    session_id: &str,
    topic: &str,
    version: &str,
    user_id: &str,
) -> Result<(), String> {
    let mut condition = serde_json::json!({ "broadcaster_user_id": user_id });

    // Own channel, so the moderator `channel.follow` asks for is the
    // broadcaster themselves.
    if topic == "channel.follow" {
        condition["moderator_user_id"] = serde_json::Value::String(user_id.to_string());
    }

    let body = serde_json::json!({
        "type": topic,
        "version": version,
        "condition": condition,
        "transport": { "method": "websocket", "session_id": session_id },
    });

    let response = client()?
        .post(SUBSCRIPTIONS_URL)
        .header("Client-Id", client_id)
        .header("Authorization", format!("Bearer {token}"))
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("subscribe {topic}: {error}"))?;

    let status = response.status();

    if status.is_success() {
        return Ok(());
    }

    let detail = response.text().await.unwrap_or_default();

    Err(format!("subscribe {topic} rejected ({status}): {detail}"))
}

/// One socket, from connect to close. `url` is the welcome URL on the first
/// attempt and the handover URL afterwards.
async fn connect_once(
    app: &AppHandle,
    service: &Arc<ChatServiceState>,
    generation: u64,
    url: &str,
    client_id: &str,
    token: &str,
    user_id: &str,
) -> Result<SocketEnd, String> {
    let (stream, _) = connect_async(url)
        .await
        .map_err(|error| format!("connect: {error}"))?;

    let (mut writer, mut reader) = stream.split();

    while let Some(frame) = reader.next().await {
        if !service.is_current(generation) {
            let _ = writer.close().await;

            return Ok(SocketEnd::Closed);
        }

        let payload = match frame {
            Ok(Message::Text(text)) => text.to_string(),
            Ok(Message::Ping(data)) => {
                let _ = writer.send(Message::Pong(data)).await;
                continue;
            }
            Ok(Message::Close(_)) => return Ok(SocketEnd::Closed),
            Ok(_) => continue,
            Err(error) => return Err(format!("read: {error}")),
        };

        let parsed: serde_json::Value = match serde_json::from_str(&payload) {
            Ok(value) => value,
            Err(error) => {
                warn!("eventsub frame is not json: {error}");
                continue;
            }
        };

        match parsed["metadata"]["message_type"].as_str().unwrap_or("") {
            "session_welcome" => {
                let Some(session_id) = parsed["payload"]["session"]["id"].as_str() else {
                    return Err("welcome carried no session id".to_string());
                };

                let mut granted = 0;

                for (topic, version) in TOPICS {
                    match create_subscription(client_id, token, session_id, topic, version, user_id)
                        .await
                    {
                        Ok(()) => granted += 1,
                        // A rejected topic is survivable: the others keep
                        // working, and the IRC path still carries subs while
                        // the flag below stays down.
                        Err(error) => warn!("{error}"),
                    }
                }

                info!(granted, "eventsub subscriptions created");

                // Only now does EventSub own the subscription rows. Setting it
                // on connect instead would blank the IRC ones for however long
                // the handshake takes.
                service.set_eventsub_owns_subs(granted > 0);
            }
            // Twitch sends one every ten seconds to prove the socket is alive.
            // Nothing to do: a missed one shows up as a read error anyway.
            "session_keepalive" => {}
            "notification" => {
                let topic = parsed["metadata"]["subscription_type"]
                    .as_str()
                    .unwrap_or("");

                if let Some(message) = message_from_notification(topic, &parsed["payload"]["event"])
                {
                    if let Err(error) = app.emit(EVENT_CHAT_MESSAGE, &message) {
                        warn!("failed to emit eventsub message: {error}");
                    }
                }
            }
            "session_reconnect" => {
                let Some(next) = parsed["payload"]["session"]["reconnect_url"].as_str() else {
                    return Err("reconnect carried no url".to_string());
                };

                debug!("eventsub handed over to a new socket");

                return Ok(SocketEnd::Reconnect(next.to_string()));
            }
            // The user revoked the grant on twitch.tv, or the token died.
            // Neither is retryable on this socket.
            "revocation" => {
                warn!("eventsub subscription revoked");
                service.set_eventsub_owns_subs(false);

                return Ok(SocketEnd::Closed);
            }
            other => debug!("unhandled eventsub message type: {other}"),
        }
    }

    Ok(SocketEnd::Closed)
}

/// Token and ids for one attempt, or None when this channel is not one we may
/// subscribe to. Re-read per attempt: the refresh loop replaces the stored
/// token while this one is parked in `await`.
async fn authorize(channel: &str) -> Option<(String, String)> {
    let token = secrets::access_token()?;
    let identity = helix::validate_token(&token).await.ok()?;

    if !helix::missing_scopes(&identity.scopes).is_empty() {
        debug!("eventsub idle: the stored token predates its scopes");

        return None;
    }

    // Every scope here is granted over one's own channel, so watching someone
    // else's chat gets the IRC path and nothing more.
    if !identity.login.eq_ignore_ascii_case(channel) {
        return None;
    }

    if identity.user_id.is_empty() {
        return None;
    }

    Some((token, identity.user_id))
}

/// Connects, reads until the socket ends, then backs off and reconnects.
/// Returns only when the generation is retired.
pub async fn run(
    app: AppHandle,
    service: Arc<ChatServiceState>,
    generation: u64,
    channel: String,
    client_id: String,
) {
    let channel = channel.trim().trim_start_matches('#').to_lowercase();

    if channel.is_empty() {
        return;
    }

    let mut attempt: u32 = 0;
    let mut url = WS_URL.to_string();

    while service.is_current(generation) {
        if attempt > 0 {
            tokio::time::sleep(backoff_delay(attempt)).await;

            if !service.is_current(generation) {
                break;
            }
        }

        let Some((token, user_id)) = authorize(&channel).await else {
            // Not our channel, or a token without the scopes. Neither is fixed
            // by retrying, and the IRC path covers subs on its own.
            break;
        };

        match connect_once(
            &app, &service, generation, &url, &client_id, &token, &user_id,
        )
        .await
        {
            Ok(SocketEnd::Reconnect(next)) => {
                url = next;
                attempt = 0;
                continue;
            }
            Ok(SocketEnd::Closed) => attempt = attempt.saturating_add(1),
            Err(error) => {
                warn!("eventsub connection failed: {error}");
                attempt = attempt.saturating_add(1);
            }
        }

        // A dropped socket takes its subscriptions with it, so IRC has to carry
        // the subs again until the next welcome.
        service.set_eventsub_owns_subs(false);
        url = WS_URL.to_string();
    }

    service.set_eventsub_owns_subs(false);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(json: serde_json::Value) -> serde_json::Value {
        json
    }

    #[test]
    fn renders_a_follow() {
        let message = message_from_notification(
            "channel.follow",
            &event(serde_json::json!({ "user_name": "kartoshka" })),
        )
        .expect("follow row");

        assert_eq!(message.highlight.unwrap().text, "kartoshka followed");
    }

    #[test]
    fn renders_a_resub_with_months_and_tier() {
        let message = message_from_notification(
            "channel.subscription.message",
            &event(serde_json::json!({
                "user_name": "kartoshka",
                "cumulative_months": 8,
                "tier": "2000",
            })),
        )
        .expect("resub row");

        assert_eq!(
            message.highlight.unwrap().text,
            "kartoshka resubscribed · 8 months · Tier 2"
        );
    }

    /// The gift event names the giver and the count; the recipient's own
    /// `channel.subscribe` would be the same gift reported a second time.
    #[test]
    fn drops_the_gifted_half_of_a_gift() {
        assert!(message_from_notification(
            "channel.subscribe",
            &event(serde_json::json!({ "user_name": "kartoshka", "is_gift": true })),
        )
        .is_none());
    }

    #[test]
    fn names_an_anonymous_gifter() {
        let message = message_from_notification(
            "channel.subscription.gift",
            &event(serde_json::json!({
                "user_name": "",
                "is_anonymous": true,
                "total": 5,
                "tier": "1000",
            })),
        )
        .expect("gift row");

        assert_eq!(
            message.highlight.unwrap().text,
            "Anonymous gifted 5 subs · Tier 1"
        );
    }

    #[test]
    fn ignores_a_topic_it_does_not_render() {
        assert!(
            message_from_notification("channel.cheer", &event(serde_json::json!({}))).is_none()
        );
    }
}
