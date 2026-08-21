//! Starts and stops the platform connectors.
//!
//! Every restart bumps a generation counter; the previous loops notice on their
//! next iteration and unwind themselves. That avoids retaining join handles for
//! tasks that spend most of their life parked in `await`, and makes a config
//! change indistinguishable from a fresh start.

use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::AppHandle;
use tracing::{info, warn};

use super::state::ChatServiceState;
use super::{helix, resolve_client_id, secrets, twitch, youtube};
use crate::model::chat::ChatConfig;

fn non_empty(value: &Option<String>) -> Option<String> {
    value
        .as_ref()
        .map(|raw| raw.trim().to_string())
        .filter(|trimmed| !trimmed.is_empty())
}

pub fn start(app: AppHandle, service: Arc<ChatServiceState>, config: ChatConfig) {
    service.running.store(true, Ordering::SeqCst);

    let generation = service.next_generation();

    if let Ok(mut stored) = service.config.lock() {
        *stored = config.clone();
    }

    let twitch_channel = non_empty(&config.twitch_channel);
    let youtube_target = non_empty(&config.youtube_target);
    // Falls back to the id baked in at build time when the user has not
    // supplied one of their own.
    let client_id = resolve_client_id(config.twitch_client_id.as_deref());
    let signed_in = secrets::is_signed_in();
    // The refresh token alone is enough to get back to a live access token, so
    // the loops that can refresh start on it; the badge fetch below needs a
    // token in hand right now and stays on `signed_in`.
    let has_credentials = secrets::has_credentials();

    info!(
        generation,
        twitch = twitch_channel.is_some(),
        youtube = youtube_target.is_some(),
        authenticated = signed_in,
        "starting chat connectors"
    );

    // Artwork is per channel, so never carry the previous channel's over.
    service.clear_badges();

    // Independent of the channel: the token has to stay alive even when only
    // YouTube is configured, so that signing in stays a one-time act.
    if has_credentials {
        if let Some(client_id) = client_id.clone() {
            tokio::spawn(helix::run_token_refresh(
                Arc::clone(&service),
                generation,
                client_id,
            ));
        }
    }

    if let Some(channel) = twitch_channel.clone() {
        // Badge images come only from Helix — Twitch retired the anonymous
        // badge host — so this is a no-op until the user signs in. Failure just
        // leaves the text plates in place.
        if signed_in {
            if let Some(client_id) = client_id.clone() {
                let service_for_badges = Arc::clone(&service);
                let channel_for_badges = channel.clone();

                tokio::spawn(async move {
                    match helix::load_badges(&client_id, &channel_for_badges).await {
                        Ok(loaded) => {
                            if let Ok(mut badges) = service_for_badges.badges.lock() {
                                info!(count = loaded.len(), "twitch badges loaded");
                                *badges = loaded;
                            }
                        }
                        Err(error) => warn!("twitch badges unavailable: {error}"),
                    }
                });
            }
        }

        let app_for_irc = app.clone();
        let service_for_irc = Arc::clone(&service);
        let channel_for_irc = channel.clone();

        // Signed in: IRC connects as the user's own account. Anonymous
        // otherwise — reading works either way, so a stale token silently
        // degrades instead of breaking chat.
        tokio::spawn(async move {
            let credentials = match secrets::access_token() {
                Some(token) => match helix::validate_token(&token).await {
                    Ok(login) if !login.is_empty() => Some((token, login)),
                    _ => None,
                },
                None => None,
            };

            twitch::run(
                app_for_irc,
                service_for_irc,
                generation,
                channel_for_irc,
                credentials,
            )
            .await;
        });

        // Viewer count and uptime exist only behind a token; the poll mints
        // one from the refresh token when the access token is gone.
        if has_credentials {
            if let Some(client_id) = client_id {
                tokio::spawn(helix::run_presence_poll(
                    app.clone(),
                    Arc::clone(&service),
                    generation,
                    channel,
                    client_id,
                ));
            }
        }
    }

    if let Some(target) = youtube_target {
        tokio::spawn(youtube::run(app, Arc::clone(&service), generation, target));
    }
}

pub fn stop(service: &Arc<ChatServiceState>) {
    service.running.store(false, Ordering::SeqCst);
    service.next_generation();

    info!("chat connectors stopped");
}
