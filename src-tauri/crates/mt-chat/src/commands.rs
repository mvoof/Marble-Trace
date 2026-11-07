//! Viewers' commands in the streamer's Twitch chat, answered from the
//! streamer's own account.
//!
//! `mt-chat` knows no telemetry: what a command replies comes through
//! `ChatHost`. Only the signed-in user's own channel is answered, and never
//! past the cooldowns.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use mt_model::app::chat::{ChatCommand, ChatDisplay};
use tracing::{debug, warn};

use super::helix;
use super::state::ChatServiceState;

/// The least time between any two replies, whatever the settings say: 15
/// messages in 30 seconds stays under the 20 Twitch allows an ordinary account.
const MIN_GLOBAL_COOLDOWN: Duration = Duration::from_secs(2);

/// How often commands may be answered.
#[derive(Debug, Clone, Copy)]
pub struct CommandLimits {
    pub per_command: Duration,
    pub between_replies: Duration,
}

impl CommandLimits {
    pub fn new(cooldown_seconds: u32, global_cooldown_seconds: u32) -> Self {
        Self {
            per_command: Duration::from_secs(u64::from(cooldown_seconds)),
            between_replies: Duration::from_secs(u64::from(global_cooldown_seconds))
                .max(MIN_GLOBAL_COOLDOWN),
        }
    }
}

/// The reply to `!commands`: what the streamer has switched on.
pub fn command_list_reply(enabled: &[ChatCommand]) -> Option<String> {
    let triggers: Vec<&str> = enabled
        .iter()
        .filter(|command| **command != ChatCommand::Commands)
        .map(|command| command.trigger())
        .collect();

    (!triggers.is_empty()).then(|| format!("Commands: {}", triggers.join(" ")))
}

/// What the app answers a command with. Blocks while it waits for the
/// telemetry thread; `None` is silence: no session, or nothing to say.
pub trait ChatHost: Send + Sync {
    fn answer(&self, command: ChatCommand, display: ChatDisplay) -> Option<String>;
}

/// When each command was last let through.
#[derive(Debug, Default)]
pub struct Cooldowns {
    last_reply: Option<Instant>,
    last_by_command: HashMap<ChatCommand, Instant>,
}

impl Cooldowns {
    /// Whether the command may be answered now; if so, the cooldowns start.
    pub fn admit(&mut self, command: ChatCommand, limits: CommandLimits, now: Instant) -> bool {
        let elapsed_since = |moment: Option<&Instant>, wait: Duration| {
            moment.is_none_or(|moment| now.duration_since(*moment) >= wait)
        };

        if !elapsed_since(self.last_reply.as_ref(), limits.between_replies)
            || !elapsed_since(self.last_by_command.get(&command), limits.per_command)
        {
            return false;
        }

        self.last_reply = Some(now);
        self.last_by_command.insert(command, now);

        true
    }
}

/// One connector run's way of answering what chat asks.
pub struct CommandResponder {
    pub host: Arc<dyn ChatHost>,
    pub service: Arc<ChatServiceState>,
    pub generation: u64,
    /// The channel being read, lowercase.
    pub channel: String,
    pub client_id: Option<String>,
}

impl CommandResponder {
    /// Called for each chat message. Never waits: the reply has its own task,
    /// so the chat keeps being read meanwhile.
    pub fn on_message(self: &Arc<Self>, message: &str) {
        let Some(command) = ChatCommand::parse(message) else {
            return;
        };

        if !self.service.admit_command(command, Instant::now()) {
            return;
        }

        let responder = Arc::clone(self);

        tokio::spawn(async move {
            responder.reply(command).await;
        });
    }

    async fn reply(&self, command: ChatCommand) {
        let Some(client_id) = &self.client_id else {
            return;
        };
        let Some(identity) = helix::current_identity().await else {
            debug!("chat command unanswered: not signed in");

            return;
        };

        if !identity.login.eq_ignore_ascii_case(&self.channel) {
            return;
        }

        if !helix::can_send_chat(&identity.scopes) {
            debug!("chat command unanswered: the token predates the write scope");

            return;
        }

        let reply = if command == ChatCommand::Commands {
            self.service.command_list()
        } else {
            let host = Arc::clone(&self.host);
            let display = self.service.chat_display();

            tokio::task::spawn_blocking(move || host.answer(command, display))
                .await
                .ok()
                .flatten()
        };
        let Some(reply) = reply else {
            return;
        };

        // The answer took a moment: the feature may have been turned off.
        if !self.service.is_current(self.generation) || !self.service.commands_enabled() {
            return;
        }

        if let Err(error) = helix::send_chat_message(client_id, &identity.user_id, &reply).await {
            warn!("chat reply not sent: {error}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const COOLDOWN: Duration = Duration::from_secs(10);
    const LIMITS: CommandLimits = CommandLimits {
        per_command: COOLDOWN,
        between_replies: MIN_GLOBAL_COOLDOWN,
    };

    #[test]
    fn a_burst_gets_one_reply() {
        let mut cooldowns = Cooldowns::default();
        let start = Instant::now();
        let admitted = (0..50)
            .filter(|_| cooldowns.admit(ChatCommand::Gap, LIMITS, start))
            .count();

        assert_eq!(admitted, 1);
    }

    #[test]
    fn a_command_answers_again_after_its_cooldown() {
        let mut cooldowns = Cooldowns::default();
        let start = Instant::now();

        assert!(cooldowns.admit(ChatCommand::Gap, LIMITS, start));
        assert!(!cooldowns.admit(ChatCommand::Gap, LIMITS, start + Duration::from_secs(9)));
        assert!(cooldowns.admit(ChatCommand::Gap, LIMITS, start + COOLDOWN));
    }

    #[test]
    fn another_command_waits_only_for_the_global_cooldown() {
        let mut cooldowns = Cooldowns::default();
        let start = Instant::now();

        assert!(cooldowns.admit(ChatCommand::Gap, LIMITS, start));
        assert!(!cooldowns.admit(ChatCommand::Pos, LIMITS, start + Duration::from_secs(1)));
        assert!(cooldowns.admit(ChatCommand::Pos, LIMITS, start + MIN_GLOBAL_COOLDOWN));
    }

    #[test]
    fn a_longer_global_cooldown_holds_every_command_back() {
        let limits = CommandLimits::new(10, 30);
        let mut cooldowns = Cooldowns::default();
        let start = Instant::now();

        assert!(cooldowns.admit(ChatCommand::Gap, limits, start));
        assert!(!cooldowns.admit(ChatCommand::Pos, limits, start + Duration::from_secs(29)));
        assert!(cooldowns.admit(ChatCommand::Pos, limits, start + Duration::from_secs(30)));
    }

    #[test]
    fn the_global_cooldown_cannot_go_under_what_twitch_allows() {
        assert_eq!(
            CommandLimits::new(10, 0).between_replies,
            MIN_GLOBAL_COOLDOWN
        );
    }

    #[test]
    fn the_list_names_what_is_on_and_not_itself() {
        let enabled = [ChatCommand::Pos, ChatCommand::Gap, ChatCommand::Commands];

        assert_eq!(
            command_list_reply(&enabled).as_deref(),
            Some("Commands: !pos !gap")
        );
        assert_eq!(command_list_reply(&[ChatCommand::Commands]), None);
    }

    #[test]
    fn the_list_cannot_read_as_a_command() {
        let reply = command_list_reply(&[ChatCommand::Pos]).expect("a reply");

        assert_eq!(ChatCommand::parse(&reply), None);
    }

    #[test]
    fn commands_parse_in_any_case_with_words_after_them() {
        assert_eq!(ChatCommand::parse("!gap"), Some(ChatCommand::Gap));
        assert_eq!(ChatCommand::parse("!GAP please"), Some(ChatCommand::Gap));
        assert_eq!(
            ChatCommand::parse("  !lastrace"),
            Some(ChatCommand::Lastrace)
        );
    }

    #[test]
    fn anything_else_is_not_a_command() {
        assert_eq!(ChatCommand::parse("what is the gap"), None);
        assert_eq!(ChatCommand::parse("the !gap"), None);
        assert_eq!(ChatCommand::parse("!gaps"), None);
        assert_eq!(ChatCommand::parse(""), None);
    }
}
