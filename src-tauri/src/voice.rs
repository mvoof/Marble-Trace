//! The voice crew's link to the app: requests go to the telemetry thread, the
//! radio's events to every window, and the telemetry thread's replies back to
//! the crew. Also what the Crew tab needs held between commands — a download
//! that can be cancelled.

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Instant;

use tauri::{AppHandle, Manager};
use tracing::warn;

use mt_model::app::crew::{CrewIntent, CrewRadioEvent, CrewReply, CrewSink};
use mt_model::contract::event_sink::EventSink;
use mt_model::contract::events::EVENT_CREW_RADIO;
use mt_model::utils::lock_or_recover;
use mt_telemetry::control::TelemetryCommand;
use mt_telemetry::state::{TelemetryServiceState, TelemetryState};
use mt_voice::crew::{Crew, CrewConfig, CrewHost};

use crate::sink::TauriSink;

const VOICE_DIR: &str = "voice";

pub struct VoiceCrewState {
    crew: Mutex<Crew>,
    /// The folder the user chose; `None` is the app's own.
    folder: Mutex<Option<PathBuf>>,
    /// Set to stop the download under way.
    pub cancel_download: AtomicBool,
    pub client: reqwest::Client,
}

impl VoiceCrewState {
    pub fn new(app: &AppHandle) -> Arc<Self> {
        let host = AppCrewHost {
            telemetry: Arc::clone(&app.state::<TelemetryState>().service),
            sink: Arc::new(TauriSink(app.clone())),
        };

        Arc::new(Self {
            crew: Mutex::new(Crew::new(Arc::new(host))),
            folder: Mutex::new(None),
            cancel_download: AtomicBool::new(false),
            client: reqwest::Client::new(),
        })
    }

    pub fn crew(&self) -> MutexGuard<'_, Crew> {
        lock_or_recover(&self.crew)
    }

    pub fn set_folder(&self, folder: Option<PathBuf>) {
        *lock_or_recover(&self.folder) = folder;
    }

    pub fn configure(&self, config: CrewConfig) {
        self.crew().configure(config);
    }

    pub fn set_ptt(&self, held: bool) {
        self.crew().set_ptt(held);
    }
}

/// The voice folder: engines, voices, models, packs and the cache — the one
/// the user chose, or the app's own.
pub fn voice_root(app: &AppHandle) -> Result<PathBuf, String> {
    let chosen = app
        .try_state::<Arc<VoiceCrewState>>()
        .and_then(|state| lock_or_recover(&state.folder).clone());

    match chosen {
        Some(folder) => Ok(folder),
        None => default_voice_root(app),
    }
}

/// The app's own voice folder, under its data folder.
pub fn default_voice_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(VOICE_DIR))
        .map_err(|error| error.to_string())
}

impl CrewSink for VoiceCrewState {
    fn reply(&self, reply: CrewReply) {
        self.crew().on_reply(&reply);
    }
}

struct AppCrewHost {
    telemetry: Arc<TelemetryServiceState>,
    sink: Arc<dyn EventSink>,
}

impl CrewHost for AppCrewHost {
    fn ask(&self, intent: CrewIntent) {
        self.telemetry.send(TelemetryCommand::Crew {
            intent,
            issued_at: Instant::now(),
        });
    }

    fn radio_event(&self, event: CrewRadioEvent) {
        if let Err(error) = self.sink.emit(EVENT_CREW_RADIO, &event) {
            warn!(%error, "crew radio event not delivered");
        }
    }
}
