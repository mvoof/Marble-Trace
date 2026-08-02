//! Twitch chat over IRC-on-WebSocket.
//!
//! Reading works with no account at all: a nick of `justinfan<digits>` and no
//! password puts the connection in anonymous read-only mode. That mode is not
//! in Twitch's docs — it is long-standing tolerated behaviour, which is why an
//! authenticated path exists alongside it and takes over whenever the user has
//! signed in.

use std::collections::HashMap;
use std::sync::Arc;

use futures::{SinkExt, StreamExt};
use tauri::{AppHandle, Emitter};
use tokio_tungstenite::{connect_async, tungstenite::Message};
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

const IRC_WS_URL: &str = "wss://irc-ws.chat.twitch.tv:443";
const EMOTE_CDN: &str = "https://static-cdn.jtvnw.net/emoticons/v2";
const DEFAULT_AUTHOR_COLOR: &str = "#9ca3af";

/// One parsed IRC line.
#[derive(Debug, Default)]
struct IrcLine {
    tags: HashMap<String, String>,
    /// Nick portion of the prefix, when the prefix carries one.
    nick: String,
    command: String,
    params: Vec<String>,
    trailing: Option<String>,
}

/// IRCv3 tag values escape a handful of characters; unescaping is required or
/// system messages come out littered with `\s`.
fn unescape_tag(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut chars = raw.chars();

    while let Some(current) = chars.next() {
        if current != '\\' {
            out.push(current);
            continue;
        }

        match chars.next() {
            Some('s') => out.push(' '),
            Some(':') => out.push(';'),
            Some('r') => out.push('\r'),
            Some('n') => out.push('\n'),
            Some('\\') => out.push('\\'),
            Some(other) => out.push(other),
            None => {}
        }
    }

    out
}

fn parse_line(raw: &str) -> IrcLine {
    let mut line = IrcLine::default();
    let mut rest = raw.trim_end_matches(['\r', '\n']);

    if let Some(stripped) = rest.strip_prefix('@') {
        let (tag_part, remainder) = stripped.split_once(' ').unwrap_or((stripped, ""));

        for pair in tag_part.split(';') {
            let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
            line.tags.insert(key.to_string(), unescape_tag(value));
        }

        rest = remainder;
    }

    if let Some(stripped) = rest.strip_prefix(':') {
        let (prefix, remainder) = stripped.split_once(' ').unwrap_or((stripped, ""));
        line.nick = prefix
            .split('!')
            .next()
            .unwrap_or(prefix)
            .split('@')
            .next()
            .unwrap_or(prefix)
            .to_string();
        rest = remainder;
    }

    // Trailing parameter starts at the first " :" and runs to end of line.
    let (head, trailing) = match rest.find(" :") {
        Some(index) => (&rest[..index], Some(rest[index + 2..].to_string())),
        None => (rest, None),
    };

    let mut parts = head.split_whitespace();
    line.command = parts.next().unwrap_or_default().to_uppercase();
    line.params = parts.map(str::to_string).collect();
    line.trailing = trailing;

    line
}

/// `badges=moderator/1,subscriber/12` -> plates the widget can colour, with
/// artwork attached when the badge map has been loaded.
fn parse_badges(raw: &str, service: Option<&ChatServiceState>) -> Vec<ChatBadge> {
    if raw.is_empty() {
        return Vec::new();
    }

    raw.split(',')
        .filter_map(|entry| {
            let mut parts = entry.split('/');
            let kind = parts.next().unwrap_or_default();
            let version = parts.next().unwrap_or("1");

            let label = match kind {
                "broadcaster" => "HOST",
                "moderator" => "MOD",
                "subscriber" | "founder" => "SUB",
                "vip" => "VIP",
                "staff" | "admin" | "global_mod" => "STAFF",
                "partner" | "verified" => "✓",
                _ => return None,
            };

            Some(ChatBadge {
                kind: kind.to_string(),
                label: label.to_string(),
                url: service.and_then(|state| state.badge_url(kind, version)),
            })
        })
        .collect()
}

/// `emotes=25:0-4,12-16/1902:6-10` — ranges index Unicode code points of the
/// message, not bytes, so the text is walked as a char vector.
fn build_fragments(text: &str, emotes_tag: &str) -> Vec<ChatFragment> {
    let chars: Vec<char> = text.chars().collect();

    if emotes_tag.is_empty() {
        return vec![ChatFragment::Text {
            text: text.to_string(),
        }];
    }

    // (start, end_inclusive, emote_id)
    let mut spans: Vec<(usize, usize, String)> = Vec::new();

    for emote in emotes_tag.split('/') {
        let Some((id, ranges)) = emote.split_once(':') else {
            continue;
        };

        for range in ranges.split(',') {
            let Some((from, to)) = range.split_once('-') else {
                continue;
            };

            let (Ok(start), Ok(end)) = (from.parse::<usize>(), to.parse::<usize>()) else {
                continue;
            };

            if start <= end && end < chars.len() {
                spans.push((start, end, id.to_string()));
            }
        }
    }

    if spans.is_empty() {
        return vec![ChatFragment::Text {
            text: text.to_string(),
        }];
    }

    spans.sort_by_key(|(start, _, _)| *start);

    let mut fragments = Vec::new();
    let mut cursor = 0usize;

    for (start, end, id) in spans {
        if start < cursor {
            continue;
        }

        if start > cursor {
            let chunk: String = chars[cursor..start].iter().collect();

            if !chunk.is_empty() {
                fragments.push(ChatFragment::Text { text: chunk });
            }
        }

        let name: String = chars[start..=end].iter().collect();
        fragments.push(ChatFragment::Emote {
            name,
            url: format!("{EMOTE_CDN}/{id}/default/dark/2.0"),
        });

        cursor = end + 1;
    }

    if cursor < chars.len() {
        let chunk: String = chars[cursor..].iter().collect();

        if !chunk.is_empty() {
            fragments.push(ChatFragment::Text { text: chunk });
        }
    }

    fragments
}

fn room_mode_from_tags(tags: &HashMap<String, String>) -> Option<String> {
    if tags.get("subs-only").map(String::as_str) == Some("1") {
        return Some("subs only".to_string());
    }

    if tags.get("emote-only").map(String::as_str) == Some("1") {
        return Some("emote only".to_string());
    }

    if let Some(seconds) = tags.get("slow") {
        if seconds != "0" {
            return Some(format!("slow {seconds}s"));
        }
    }

    if let Some(minutes) = tags.get("followers-only") {
        if minutes != "-1" {
            return Some("followers only".to_string());
        }
    }

    None
}

fn message_from_privmsg(line: &IrcLine, service: &ChatServiceState) -> Option<ChatMessage> {
    let text = line.trailing.clone()?;

    let author_name = line
        .tags
        .get("display-name")
        .filter(|name| !name.is_empty())
        .cloned()
        .unwrap_or_else(|| line.nick.clone());

    let author_color = line
        .tags
        .get("color")
        .filter(|color| color.starts_with('#') && color.len() == 7)
        .cloned()
        .unwrap_or_else(|| DEFAULT_AUTHOR_COLOR.to_string());

    let highlight = if line.tags.get("first-msg").map(String::as_str) == Some("1") {
        Some(ChatHighlight {
            kind: ChatHighlightKind::FirstMessage,
            text: String::new(),
            amount: None,
        })
    } else {
        None
    };

    Some(ChatMessage {
        platform: ChatPlatform::Twitch,
        id: line
            .tags
            .get("id")
            .cloned()
            .unwrap_or_else(|| format!("tw-{}", now_ms())),
        author_name,
        author_color,
        badges: parse_badges(
            line.tags.get("badges").map(String::as_str).unwrap_or(""),
            Some(service),
        ),
        fragments: build_fragments(
            &text,
            line.tags.get("emotes").map(String::as_str).unwrap_or(""),
        ),
        timestamp_ms: now_ms(),
        highlight,
    })
}

fn message_from_usernotice(line: &IrcLine) -> Option<ChatMessage> {
    let system_message = line.tags.get("system-msg")?.clone();

    if system_message.is_empty() {
        return None;
    }

    let notice_kind = line.tags.get("msg-id").map(String::as_str).unwrap_or("");

    let kind = match notice_kind {
        "raid" => ChatHighlightKind::Raid,
        "sub" | "resub" | "subgift" | "submysterygift" | "giftpaidupgrade" | "anonsubgift" => {
            ChatHighlightKind::Subscription
        }
        _ => return None,
    };

    let author_name = line
        .tags
        .get("display-name")
        .filter(|name| !name.is_empty())
        .cloned()
        .unwrap_or_else(|| line.nick.clone());

    Some(ChatMessage {
        platform: ChatPlatform::Twitch,
        id: line
            .tags
            .get("id")
            .cloned()
            .unwrap_or_else(|| format!("tw-notice-{}", now_ms())),
        author_name,
        author_color: color_for_author(&line.nick),
        badges: Vec::new(),
        fragments: Vec::new(),
        timestamp_ms: now_ms(),
        highlight: Some(ChatHighlight {
            kind,
            text: system_message,
            amount: None,
        }),
    })
}

fn emit_presence(app: &AppHandle, presence: ChatPresence) {
    if let Err(error) = app.emit(EVENT_CHAT_PRESENCE, &presence) {
        warn!("failed to emit twitch presence: {error}");
    }
}

/// Connects, reads until the connection drops or the generation is retired,
/// then backs off and reconnects. Returns only when the generation is retired.
pub async fn run(
    app: AppHandle,
    service: Arc<ChatServiceState>,
    generation: u64,
    channel: String,
    credentials: Option<(String, String)>,
) {
    let channel = channel.trim().trim_start_matches('#').to_lowercase();

    if channel.is_empty() {
        return;
    }

    let mut attempt: u32 = 0;

    while service.is_current(generation) {
        if attempt == 0 {
            emit_presence(
                &app,
                ChatPresence::new(ChatPlatform::Twitch, ChatConnectionStatus::Connecting),
            );
        } else {
            emit_presence(
                &app,
                ChatPresence::new(ChatPlatform::Twitch, ChatConnectionStatus::Reconnecting)
                    .with_retry(attempt),
            );
            tokio::time::sleep(backoff_delay(attempt)).await;

            if !service.is_current(generation) {
                return;
            }
        }

        match connect_once(&app, &service, generation, &channel, credentials.as_ref()).await {
            Ok(()) => attempt = attempt.saturating_add(1),
            Err(error) => {
                warn!("twitch chat connection failed: {error}");
                attempt = attempt.saturating_add(1);
            }
        }
    }

    emit_presence(
        &app,
        ChatPresence::new(ChatPlatform::Twitch, ChatConnectionStatus::Offline),
    );
}

async fn connect_once(
    app: &AppHandle,
    service: &Arc<ChatServiceState>,
    generation: u64,
    channel: &str,
    credentials: Option<&(String, String)>,
) -> Result<(), String> {
    let (stream, _) = connect_async(IRC_WS_URL)
        .await
        .map_err(|error| format!("connect: {error}"))?;

    let (mut writer, mut reader) = stream.split();

    let (pass, nick) = match credentials {
        Some((token, login)) => (format!("oauth:{token}"), login.clone()),
        // Anonymous read-only: any nick of the form justinfan<digits>.
        None => (
            "SCHMOOPIIE".to_string(),
            format!("justinfan{}", (now_ms() as u64) % 100_000),
        ),
    };

    // One IRC command per WebSocket frame. Twitch parses a frame as a single
    // message, so batching the handshake into one frame gets everything after
    // the first line ignored — login never completes and the connection is cut
    // exactly 30 s later with no error.
    let handshake = [
        "CAP REQ :twitch.tv/tags twitch.tv/commands".to_string(),
        format!("PASS {pass}"),
        format!("NICK {nick}"),
        format!("JOIN #{channel}"),
    ];

    for command in handshake {
        writer
            .send(Message::Text(command.into()))
            .await
            .map_err(|error| format!("handshake: {error}"))?;
    }

    info!(
        channel,
        authenticated = credentials.is_some(),
        "twitch chat handshake sent"
    );

    while let Some(frame) = reader.next().await {
        if !service.is_current(generation) {
            let _ = writer.close().await;

            return Ok(());
        }

        let payload = match frame {
            Ok(Message::Text(text)) => text.to_string(),
            Ok(Message::Ping(data)) => {
                let _ = writer.send(Message::Pong(data)).await;
                continue;
            }
            Ok(Message::Close(_)) => return Ok(()),
            Ok(_) => continue,
            Err(error) => return Err(format!("read: {error}")),
        };

        for raw in payload.split("\r\n").filter(|line| !line.is_empty()) {
            let line = parse_line(raw);

            match line.command.as_str() {
                // 001 is the welcome numeric — the only proof login worked.
                // Anything before it means we are not really in chat yet.
                "001" => {
                    info!(channel, "twitch chat login accepted");
                    emit_presence(
                        app,
                        ChatPresence::new(ChatPlatform::Twitch, ChatConnectionStatus::Live),
                    );
                }
                // Answering PING is mandatory — miss it and Twitch drops us.
                "PING" => {
                    let token = line.trailing.clone().unwrap_or_default();
                    let pong = format!("PONG :{token}\r\n");

                    if writer.send(Message::Text(pong.into())).await.is_err() {
                        return Err("pong failed".to_string());
                    }
                }
                "RECONNECT" => {
                    debug!("twitch asked us to reconnect");

                    return Ok(());
                }
                "PRIVMSG" => {
                    if let Some(message) = message_from_privmsg(&line, service) {
                        if let Err(error) = app.emit(EVENT_CHAT_MESSAGE, &message) {
                            warn!("failed to emit twitch message: {error}");
                        }
                    }
                }
                "USERNOTICE" => {
                    if let Some(message) = message_from_usernotice(&line) {
                        let _ = app.emit(EVENT_CHAT_MESSAGE, &message);
                    }
                }
                "CLEARMSG" => {
                    let deletion = ChatDeletion {
                        platform: ChatPlatform::Twitch,
                        message_id: line.tags.get("target-msg-id").cloned(),
                        author_name: None,
                    };
                    let _ = app.emit(EVENT_CHAT_DELETION, &deletion);
                }
                "CLEARCHAT" => {
                    let deletion = ChatDeletion {
                        platform: ChatPlatform::Twitch,
                        message_id: None,
                        author_name: line.trailing.clone(),
                    };
                    let _ = app.emit(EVENT_CHAT_DELETION, &deletion);
                }
                "ROOMSTATE" => {
                    let mut presence =
                        ChatPresence::new(ChatPlatform::Twitch, ChatConnectionStatus::Live);
                    presence.room_mode = room_mode_from_tags(&line.tags);
                    emit_presence(app, presence);
                }
                "NOTICE" => {
                    if let Some(text) = &line.trailing {
                        warn!("twitch notice: {text}");

                        // Twitch reports a rejected login as a NOTICE rather
                        // than an error frame; retrying would just loop.
                        if text.to_lowercase().contains("login authentication failed")
                            || text.to_lowercase().contains("improperly formatted auth")
                        {
                            emit_presence(
                                app,
                                ChatPresence::new(
                                    ChatPlatform::Twitch,
                                    ChatConnectionStatus::Error,
                                )
                                .with_detail(text.clone()),
                            );
                        }
                    }
                }
                other => debug!(command = other, "twitch line ignored"),
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tags_prefix_and_trailing() {
        let line = parse_line(
            "@badges=moderator/1;color=#1E90FF;display-name=Forsen;id=abc :forsen!forsen@forsen.tmi.twitch.tv PRIVMSG #chan :hello there",
        );

        assert_eq!(line.command, "PRIVMSG");
        assert_eq!(line.nick, "forsen");
        assert_eq!(line.params, vec!["#chan"]);
        assert_eq!(line.trailing.as_deref(), Some("hello there"));
        assert_eq!(line.tags.get("display-name").unwrap(), "Forsen");
    }

    #[test]
    fn keeps_colons_inside_message_text() {
        let line = parse_line(":a!a@a PRIVMSG #chan :time is 12:30 now");

        assert_eq!(line.trailing.as_deref(), Some("time is 12:30 now"));
    }

    #[test]
    fn unescapes_system_messages() {
        let line = parse_line("@system-msg=Nick\\ssubscribed! :tmi.twitch.tv USERNOTICE #chan");

        assert_eq!(line.tags.get("system-msg").unwrap(), "Nick subscribed!");
    }

    #[test]
    fn splits_emotes_by_codepoint_ranges() {
        let fragments = build_fragments("Kappa hi", "25:0-4");

        assert_eq!(fragments.len(), 2);

        match &fragments[0] {
            ChatFragment::Emote { name, url } => {
                assert_eq!(name, "Kappa");
                assert!(url.contains("/25/"));
            }
            other => panic!("expected emote, got {other:?}"),
        }

        match &fragments[1] {
            ChatFragment::Text { text } => assert_eq!(text, " hi"),
            other => panic!("expected text, got {other:?}"),
        }
    }

    #[test]
    fn emote_ranges_survive_multibyte_text() {
        // Cyrillic before the emote: byte offsets would land mid-character.
        let fragments = build_fragments("привет Kappa", "25:7-11");

        match fragments.last().unwrap() {
            ChatFragment::Emote { name, .. } => assert_eq!(name, "Kappa"),
            other => panic!("expected trailing emote, got {other:?}"),
        }
    }

    #[test]
    fn plain_text_yields_single_fragment() {
        let fragments = build_fragments("no emotes here", "");

        assert_eq!(fragments.len(), 1);
    }

    #[test]
    fn maps_known_badges_only() {
        let badges = parse_badges("moderator/1,subscriber/12,unknown/1", None);

        assert_eq!(badges.len(), 2);
        assert_eq!(badges[0].label, "MOD");
        assert_eq!(badges[1].label, "SUB");
    }

    #[test]
    fn author_color_is_stable() {
        assert_eq!(color_for_author("kartoshka"), color_for_author("kartoshka"));
    }
}
