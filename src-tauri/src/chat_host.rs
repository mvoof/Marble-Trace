//! What the chat commands read: the session through the telemetry thread, the
//! last race from its file.

use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::mpsc::sync_channel;
use std::sync::Arc;
use std::time::Duration;

use mt_chat::commands::ChatHost;
use mt_computations::crew::chat_answers::last_race_reply;
use mt_model::app::chat::{ChatCommand, ChatDisplay};
use mt_telemetry::control::TelemetryCommand;
use mt_telemetry::state::TelemetryServiceState;
use mt_telemetry::storage::load_last_race;

/// Long enough for the slowest tier; past it the sim has gone quiet.
const ANSWER_WAIT: Duration = Duration::from_secs(2);

pub struct AppChatHost {
    pub telemetry: Arc<TelemetryServiceState>,
    /// `None` when the app has no data directory.
    pub data_dir: Option<PathBuf>,
}

impl ChatHost for AppChatHost {
    fn answer(&self, command: ChatCommand, display: ChatDisplay) -> Option<String> {
        if command == ChatCommand::Lastrace {
            let race = load_last_race(self.data_dir.as_deref()?)?;

            return Some(last_race_reply(&race));
        }

        // Nothing drains the commands without a sim.
        if !self.telemetry.is_connected.load(Ordering::Relaxed) {
            return None;
        }

        let (sender, answered) = sync_channel(1);

        self.telemetry.send(TelemetryCommand::ChatCommand {
            command,
            display,
            answer: sender,
        });

        answered.recv_timeout(ANSWER_WAIT).ok().flatten()
    }
}
