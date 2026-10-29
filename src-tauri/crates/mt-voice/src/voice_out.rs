//! The crew's mouth: one thread that owns the reply queue, Piper and the
//! output device, so a reply is heard with every webview paused or hidden.
//!
//! Commands come in over a channel; what happens goes out through
//! `VoiceOutEvents`. Synthesis runs on this thread too — a short line takes a
//! fraction of a second, and nothing else may speak meanwhile anyway.

use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use sha2::{Digest, Sha256};

use crate::assets::catalog::{catalog, PIPER_ENGINE};
use crate::piper::{Piper, PiperSetup};
use crate::playback::Speaker;
use crate::queue::{Reply, ReplyQueue};

/// How often the thread looks at the queue and the player while no command
/// arrives — the gap between one reply ending and the next starting.
const TICK: Duration = Duration::from_millis(40);
const CACHE_DIR: &str = "cache";
/// Hex characters of the hash kept in a cache file's name.
const CACHE_NAME_LENGTH: usize = 20;

/// One line to say, synthesised from its text.
#[derive(Debug, Clone, PartialEq)]
pub struct Utterance {
    pub text: String,
}

/// Where the voice comes from and where it goes. `None` for the engine or the
/// voice keeps the crew silent — nothing is installed yet.
#[derive(Debug, Clone, PartialEq)]
pub struct OutputConfig {
    pub root: PathBuf,
    pub piper: Option<PathBuf>,
    pub voice_id: String,
    pub voice_model: Option<PathBuf>,
    pub device: Option<String>,
    pub volume: f32,
    pub length_scale: f32,
}

pub trait VoiceOutEvents: Send + 'static {
    fn speaking(&self, text: &str);
    fn finished(&self);
    fn failed(&self, message: &str);
}

enum Command {
    Say(Reply<Utterance>),
    Ptt(bool),
    Configure(OutputConfig),
    Silence,
    Shutdown,
}

/// The handle the app keeps; dropping it stops the thread.
pub struct VoiceOut {
    commands: Sender<Command>,
    thread: Option<JoinHandle<()>>,
}

impl VoiceOut {
    pub fn start(config: OutputConfig, events: impl VoiceOutEvents) -> std::io::Result<Self> {
        let (commands, inbox) = mpsc::channel();
        let thread = thread::Builder::new()
            .name("voice-out".into())
            .spawn(move || Worker::new(config, events).run(inbox))?;

        Ok(Self {
            commands,
            thread: Some(thread),
        })
    }

    pub fn say(&self, reply: Reply<Utterance>) {
        let _ = self.commands.send(Command::Say(reply));
    }

    /// Held: the reply on air is cut and nothing starts until release.
    pub fn set_ptt(&self, held: bool) {
        let _ = self.commands.send(Command::Ptt(held));
    }

    pub fn configure(&self, config: OutputConfig) {
        let _ = self.commands.send(Command::Configure(config));
    }

    /// Stops the reply on air and drops everything waiting.
    pub fn silence(&self) {
        let _ = self.commands.send(Command::Silence);
    }
}

impl Drop for VoiceOut {
    fn drop(&mut self) {
        let _ = self.commands.send(Command::Shutdown);

        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

struct Worker<E> {
    config: OutputConfig,
    events: E,
    queue: ReplyQueue<Utterance>,
    ptt_held: bool,
    piper: Option<Piper>,
    speaker: Option<Speaker>,
    on_air: bool,
}

impl<E: VoiceOutEvents> Worker<E> {
    fn new(config: OutputConfig, events: E) -> Self {
        Self {
            config,
            events,
            queue: ReplyQueue::default(),
            ptt_held: false,
            piper: None,
            speaker: None,
            on_air: false,
        }
    }

    fn run(mut self, inbox: Receiver<Command>) {
        self.warm_up();

        loop {
            match inbox.recv_timeout(TICK) {
                Ok(Command::Shutdown) | Err(RecvTimeoutError::Disconnected) => return,
                Ok(command) => self.handle(command),
                Err(RecvTimeoutError::Timeout) => {}
            }

            self.tick(Instant::now());
        }
    }

    fn handle(&mut self, command: Command) {
        match command {
            Command::Say(reply) => self.queue.push(reply),
            Command::Ptt(held) => {
                self.ptt_held = held;

                if held {
                    self.cut();
                }
            }
            Command::Configure(config) => {
                if let Some(speaker) = &self.speaker {
                    speaker.set_volume(config.volume);
                }

                self.config = config;
                self.warm_up();
            }
            Command::Silence => {
                self.queue.clear();
                self.cut();
            }
            Command::Shutdown => {}
        }
    }

    /// Starts Piper before the first reply needs it: loading a voice is most
    /// of the first line's delay, a warm process speaks a short one in tens of
    /// milliseconds.
    fn warm_up(&mut self) {
        if self.config.piper.is_none() || self.config.voice_model.is_none() {
            return;
        }

        if let Err(message) = self.piper() {
            tracing::warn!(%message, "voice engine did not start");
        }
    }

    fn cut(&mut self) {
        if let Some(speaker) = &self.speaker {
            speaker.stop();
        }

        if self.on_air {
            self.on_air = false;
            self.events.finished();
        }
    }

    fn tick(&mut self, now: Instant) {
        if self.on_air {
            if self.speaker.as_ref().is_none_or(Speaker::is_idle) {
                self.on_air = false;
                self.events.finished();
            }

            return;
        }

        let Some(reply) = self.queue.next(now, self.ptt_held) else {
            return;
        };

        match self.speak(&reply.content) {
            Ok(()) => {
                tracing::debug!(spoken_in = ?now.elapsed(), since_queued = ?reply.queued_at.elapsed(), "on air");
                self.on_air = true;
                self.events.speaking(&reply.content.text);
            }
            Err(message) => {
                tracing::warn!(%message, text = %reply.content.text, "voice reply not spoken");
                self.events.failed(&message);
            }
        }
    }

    fn speak(&mut self, utterance: &Utterance) -> Result<(), String> {
        let wav = self.synthesized(&utterance.text)?;
        let volume = self.config.volume;

        self.speaker()?.play(&wav, volume)
    }

    /// The line from the cache, or synthesised into it.
    fn synthesized(&mut self, text: &str) -> Result<PathBuf, String> {
        let wav = cache_path(&self.config, text);

        if wav.is_file() {
            return Ok(wav);
        }

        let piper = self.piper()?;

        if let Err(error) = piper.synthesize(text, &wav) {
            self.piper = None;

            return Err(format!("piper: {error}"));
        }

        Ok(wav)
    }

    fn piper(&mut self) -> Result<&mut Piper, String> {
        let (Some(executable), Some(model)) = (&self.config.piper, &self.config.voice_model) else {
            return Err("no voice engine or voice installed".into());
        };
        let setup = PiperSetup {
            root: self.config.root.clone(),
            executable: executable.clone(),
            model: model.clone(),
            length_scale: self.config.length_scale,
        };

        if self
            .piper
            .as_ref()
            .is_some_and(|piper| *piper.setup() != setup)
        {
            self.piper = None;
        }

        if self.piper.is_none() {
            self.piper = Some(Piper::spawn(setup).map_err(|error| format!("piper: {error}"))?);
        }

        self.piper
            .as_mut()
            .ok_or_else(|| "piper did not start".into())
    }

    fn speaker(&mut self) -> Result<&Speaker, String> {
        let wanted = self.config.device.as_deref();

        if self
            .speaker
            .as_ref()
            .is_some_and(|speaker| speaker.device_id() != wanted)
        {
            self.speaker = None;
        }

        if self.speaker.is_none() {
            self.speaker = Some(Speaker::open(wanted)?);
        }

        self.speaker
            .as_ref()
            .ok_or_else(|| "no audio output".into())
    }
}

/// `cache/<voice>/<hash>.wav`, the hash over everything that changes the
/// sound: the text, the voice, the engine and the speed.
pub fn cache_path(config: &OutputConfig, text: &str) -> PathBuf {
    let engine = catalog()
        .component(PIPER_ENGINE)
        .and_then(|engine| engine.files.first())
        .map(|file| file.sha256.as_str())
        .unwrap_or_default();
    let mut hasher = Sha256::new();

    for part in [
        text,
        &config.voice_id,
        engine,
        &config.length_scale.to_string(),
    ] {
        hasher.update(part.as_bytes());
        hasher.update([0]);
    }

    let hash: String = hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();

    config
        .root
        .join(CACHE_DIR)
        .join(&config.voice_id)
        .join(format!("{}.wav", &hash[..CACHE_NAME_LENGTH]))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> OutputConfig {
        OutputConfig {
            root: PathBuf::from("voice"),
            piper: Some(PathBuf::from("voice/piper-engine/piper.exe")),
            voice_id: "piper-voice-ru-dmitri".into(),
            voice_model: None,
            device: None,
            volume: 1.0,
            length_scale: 1.0,
        }
    }

    struct ChannelEvents(mpsc::Sender<String>);

    impl VoiceOutEvents for ChannelEvents {
        fn speaking(&self, text: &str) {
            let _ = self.0.send(format!("speaking {text}"));
        }

        fn finished(&self) {
            let _ = self.0.send("finished".into());
        }

        fn failed(&self, message: &str) {
            let _ = self.0.send(format!("failed {message}"));
        }
    }

    /// Installs the real engine and the Dmitri voice from files downloaded
    /// beforehand, then speaks through them — silently, at volume 0.
    #[test]
    #[ignore = "needs MT_VOICE_DOWNLOADS: a folder with the Piper zip and the Dmitri voice files"]
    fn speaks_through_the_real_engine() {
        use crate::assets::VoiceAssets;

        let downloads = PathBuf::from(std::env::var("MT_VOICE_DOWNLOADS").unwrap());
        let root = std::env::temp_dir().join("mt-voice-live");
        let assets = VoiceAssets::new(&root);
        let voice_id = "piper-voice-ru-dmitri";

        for id in [PIPER_ENGINE, voice_id] {
            let component = catalog().component(id).unwrap();

            if !assets.is_installed(component) {
                let files: Vec<PathBuf> = component
                    .files
                    .iter()
                    .map(|file| downloads.join(&file.name))
                    .collect();

                assets.import_files(component, &files).unwrap();
            }
        }

        let config = OutputConfig {
            root: root.clone(),
            piper: assets.piper_executable(),
            voice_id: voice_id.into(),
            voice_model: assets.voice_model(voice_id),
            device: None,
            volume: 0.0,
            length_scale: 1.0,
        };
        let _ = std::fs::remove_dir_all(root.join(CACHE_DIR));

        let started = Instant::now();
        let mut piper = Piper::spawn(PiperSetup {
            root: root.clone(),
            executable: config.piper.clone().unwrap(),
            model: config.voice_model.clone().unwrap(),
            length_scale: 1.0,
        })
        .unwrap();
        let first = root.join(CACHE_DIR).join("first.wav");

        piper.synthesize("Принято, сорок литров", &first).unwrap();
        println!("spawn + first line: {:?}", started.elapsed());

        let again = Instant::now();

        piper
            .synthesize(
                "До переднего одна и две",
                &root.join(CACHE_DIR).join("second.wav"),
            )
            .unwrap();
        println!("warm line: {:?}", again.elapsed());
        drop(piper);

        let (sender, received) = mpsc::channel();
        let out = VoiceOut::start(config, ChannelEvents(sender)).unwrap();

        // The app starts the thread long before the first reply; let it warm up.
        thread::sleep(Duration::from_secs(1));

        let queued = Instant::now();

        out.say(Reply {
            queued_at: queued,
            ttl: Duration::from_secs(10),
            content: Utterance {
                text: "Топлива на двенадцать кругов".into(),
            },
        });

        let speaking = received.recv_timeout(Duration::from_secs(20)).unwrap();

        println!("queued → on air: {:?}", queued.elapsed());
        assert_eq!(speaking, "speaking Топлива на двенадцать кругов");
        assert_eq!(
            received.recv_timeout(Duration::from_secs(20)).unwrap(),
            "finished"
        );
        println!("queued → finished: {:?}", queued.elapsed());
    }

    #[test]
    fn caches_by_text_voice_engine_and_speed() {
        let base = cache_path(&config(), "Принято");

        assert!(base.starts_with("voice/cache/piper-voice-ru-dmitri"));
        assert_eq!(base, cache_path(&config(), "Принято"));
        assert_ne!(base, cache_path(&config(), "Принято, 40 литров"));
        assert_ne!(
            base,
            cache_path(
                &OutputConfig {
                    length_scale: 1.2,
                    ..config()
                },
                "Принято"
            )
        );
    }
}
