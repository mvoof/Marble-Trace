//! The crew's ear: one thread that owns Vosk and, while push-to-talk is held,
//! the microphone.
//!
//! The library and the model are loaded when the voice is configured, not on
//! the press — a model takes a moment to load, and the driver is already
//! talking. On release the microphone keeps running for a short tail, since a
//! button let go on the last syllable would otherwise cut it off.

use std::collections::HashMap;
use std::path::PathBuf;
use std::rc::Rc;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use crate::capture::Capture;
use crate::pack::grammar::{CommandGrammar, Recognised};
use crate::vosk::{parse_result, Heard, Recognizer, VoskLibrary, VoskModel};

/// Kept listening after release, for the last word.
pub const RELEASE_TAIL: Duration = Duration::from_millis(150);
/// Below this a pit command is not carried out; a question is still answered.
pub const DEFAULT_CONFIDENCE_THRESHOLD: f32 = 0.6;
const IDLE_WAIT: Duration = Duration::from_millis(200);
/// A model still loading answers within this, or the words go unchecked.
const WORD_LOOKUP_WAIT: Duration = Duration::from_secs(3);

/// What one command in a heard sentence means to the crew.
#[derive(Debug, Clone, PartialEq)]
pub enum Understood {
    Command(Recognised),
    /// A pit command heard too faintly to act on.
    Unsure(Recognised),
}

/// Every command the sentence holds, in the order said; empty when it is not
/// the pack's commands.
pub fn understand(grammar: &CommandGrammar, heard: &Heard, threshold: f32) -> Vec<Understood> {
    grammar
        .recognise_all(&heard.text)
        .into_iter()
        .map(|recognised| {
            if grammar.acts(&recognised.intent) && heard.confidence < threshold {
                Understood::Unsure(recognised.clone())
            } else {
                Understood::Command(recognised.clone())
            }
        })
        .collect()
}

/// What the ear runs with. `None` for the library or the model keeps it deaf.
#[derive(Debug, Clone, PartialEq)]
pub struct InputConfig {
    pub library: Option<PathBuf>,
    pub model: Option<PathBuf>,
    /// The pack's grammar as Vosk takes it (`CommandGrammar::vosk_grammar`).
    pub grammar: String,
    pub device: Option<String>,
}

pub trait VoiceInEvents: Send + 'static {
    fn listening(&self, on: bool);
    fn heard(&self, heard: Heard);
    fn failed(&self, message: &str);
}

enum Message {
    Configure(InputConfig),
    Ptt(bool),
    Samples(Vec<i16>),
    /// Which of the words the model lacks; `None` without a model.
    MissingWords {
        words: Vec<String>,
        reply: Sender<Option<Vec<String>>>,
    },
    Shutdown,
}

/// Asks the ear's model which words it lacks, from any thread — the model
/// itself never leaves the ear's.
#[derive(Clone)]
pub struct WordLookup {
    messages: Sender<Message>,
}

impl WordLookup {
    /// The words the model lacks, in the order given; `None` when no model
    /// is loaded or it did not answer in time.
    pub fn missing(&self, words: Vec<String>) -> Option<Vec<String>> {
        let (reply, answer) = mpsc::channel();

        self.messages
            .send(Message::MissingWords { words, reply })
            .ok()?;

        answer.recv_timeout(WORD_LOOKUP_WAIT).ok().flatten()
    }
}

pub struct VoiceIn {
    messages: Sender<Message>,
    thread: Option<JoinHandle<()>>,
}

impl VoiceIn {
    pub fn start(config: InputConfig, events: impl VoiceInEvents) -> std::io::Result<Self> {
        let (messages, inbox) = mpsc::channel();
        let samples = messages.clone();
        let thread = thread::Builder::new()
            .name("voice-in".into())
            .spawn(move || Ear::new(config, events, samples).run(inbox))?;

        Ok(Self {
            messages,
            thread: Some(thread),
        })
    }

    pub fn set_ptt(&self, held: bool) {
        let _ = self.messages.send(Message::Ptt(held));
    }

    pub fn configure(&self, config: InputConfig) {
        let _ = self.messages.send(Message::Configure(config));
    }

    pub fn word_lookup(&self) -> WordLookup {
        WordLookup {
            messages: self.messages.clone(),
        }
    }
}

impl Drop for VoiceIn {
    fn drop(&mut self) {
        let _ = self.messages.send(Message::Shutdown);

        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

struct LoadedModel {
    library_path: PathBuf,
    model_path: PathBuf,
    model: Rc<VoskModel>,
    /// The model's answer per word asked, kept for as long as the model.
    known_words: HashMap<String, bool>,
}

struct ReadyRecognizer {
    sample_rate: u32,
    grammar: String,
    recognizer: Recognizer,
}

struct Ear<E> {
    config: InputConfig,
    events: E,
    samples: Sender<Message>,
    loaded: Option<LoadedModel>,
    recognizer: Option<ReadyRecognizer>,
    capture: Option<Capture>,
    /// Set on release: the capture stops and the sentence is read then.
    release_at: Option<Instant>,
}

impl<E: VoiceInEvents> Ear<E> {
    fn new(config: InputConfig, events: E, samples: Sender<Message>) -> Self {
        Self {
            config,
            events,
            samples,
            loaded: None,
            recognizer: None,
            capture: None,
            release_at: None,
        }
    }

    fn run(mut self, inbox: Receiver<Message>) {
        self.warm_up();

        loop {
            let wait = self.release_at.map_or(IDLE_WAIT, |release| {
                release.saturating_duration_since(Instant::now())
            });

            match inbox.recv_timeout(wait) {
                Ok(Message::Shutdown) | Err(RecvTimeoutError::Disconnected) => return,
                Ok(Message::Configure(config)) => {
                    self.config = config;
                    self.warm_up();
                }
                Ok(Message::Ptt(true)) => self.press(),
                Ok(Message::Ptt(false)) => {
                    if self.capture.is_some() && self.release_at.is_none() {
                        self.release_at = Some(Instant::now() + RELEASE_TAIL);
                    }
                }
                Ok(Message::Samples(samples)) => {
                    if self.capture.is_some() {
                        if let Some(ready) = &mut self.recognizer {
                            ready.recognizer.accept(&samples);
                        }
                    }
                }
                Ok(Message::MissingWords { words, reply }) => {
                    let _ = reply.send(self.missing_words(words));
                }
                Err(RecvTimeoutError::Timeout) => {}
            }

            if self
                .release_at
                .is_some_and(|release| Instant::now() >= release)
            {
                self.release();
            }
        }
    }

    fn warm_up(&mut self) {
        if self.config.library.is_none() || self.config.model.is_none() {
            self.loaded = None;
            self.recognizer = None;
            return;
        }

        if let Err(message) = self.model() {
            tracing::warn!(%message, "speech recognition did not start");
        }
    }

    fn model(&mut self) -> Result<Rc<VoskModel>, String> {
        let (Some(library_path), Some(model_path)) = (&self.config.library, &self.config.model)
        else {
            return Err("no recognition engine or model installed".into());
        };

        if let Some(loaded) = &self.loaded {
            if &loaded.library_path == library_path && &loaded.model_path == model_path {
                return Ok(Rc::clone(&loaded.model));
            }
        }

        self.recognizer = None;
        self.loaded = None;

        let library = VoskLibrary::load(library_path)?;
        let model = Rc::new(VoskModel::load(&library, model_path)?);

        self.loaded = Some(LoadedModel {
            library_path: library_path.clone(),
            model_path: model_path.clone(),
            model: Rc::clone(&model),
            known_words: HashMap::new(),
        });

        Ok(model)
    }

    fn missing_words(&mut self, words: Vec<String>) -> Option<Vec<String>> {
        self.model().ok()?;

        let loaded = self.loaded.as_mut()?;

        Some(
            words
                .into_iter()
                .filter(|word| {
                    !*loaded
                        .known_words
                        .entry(word.clone())
                        .or_insert_with(|| loaded.model.has_word(word))
                })
                .collect(),
        )
    }

    fn press(&mut self) {
        // A press during the release tail carries on the same sentence.
        if self.capture.is_some() {
            self.release_at = None;
            return;
        }

        match self.open() {
            Ok(()) => self.events.listening(true),
            Err(message) => {
                tracing::warn!(%message, "push-to-talk: not listening");
                self.events.failed(&message);
            }
        }
    }

    fn open(&mut self) -> Result<(), String> {
        let model = self.model()?;
        let samples = self.samples.clone();
        let capture = Capture::start(self.config.device.as_deref(), move |chunk| {
            let _ = samples.send(Message::Samples(chunk));
        })?;
        let stale = self.recognizer.as_ref().is_none_or(|ready| {
            ready.sample_rate != capture.sample_rate || ready.grammar != self.config.grammar
        });

        if stale {
            self.recognizer = Some(ReadyRecognizer {
                sample_rate: capture.sample_rate,
                grammar: self.config.grammar.clone(),
                recognizer: Recognizer::new(&model, capture.sample_rate, &self.config.grammar)?,
            });
        }

        self.capture = Some(capture);

        Ok(())
    }

    fn release(&mut self) {
        self.release_at = None;
        self.capture = None;
        self.events.listening(false);

        if let Some(ready) = &mut self.recognizer {
            let started = Instant::now();
            let heard = parse_result(&ready.recognizer.finish());

            tracing::debug!(recognized_in = ?started.elapsed(), text = %heard.text, confidence = heard.confidence, "heard");
            self.events.heard(heard);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pack::load;
    use crate::pack::template::SlotValue;

    fn heard(text: &str, confidence: f32) -> Heard {
        Heard {
            text: text.into(),
            confidence,
        }
    }

    #[test]
    fn acts_on_a_confident_command_and_doubts_a_faint_one() {
        let pack = load("ru", None);
        let grammar = &pack.grammar;

        let confident = understand(grammar, &heard("топливо сорок", 0.9), 0.6);
        let [Understood::Command(fuel)] = confident.as_slice() else {
            panic!("a confident command");
        };

        assert_eq!(fuel.slot("number"), Some(&SlotValue::Number(40)));
        assert!(matches!(
            understand(grammar, &heard("топливо сорок", 0.4), 0.6).as_slice(),
            [Understood::Unsure(_)]
        ));
    }

    #[test]
    fn answers_a_faint_question_and_drops_what_is_not_a_command() {
        let pack = load("ru", None);

        assert!(matches!(
            understand(&pack.grammar, &heard("где я", 0.3), 0.6).as_slice(),
            [Understood::Command(_)]
        ));
        assert!(understand(&pack.grammar, &heard("[unk]", 1.0), 0.6).is_empty());
        assert!(understand(&pack.grammar, &heard("", 0.0), 0.6).is_empty());
    }

    #[test]
    fn doubts_only_the_pit_commands_of_a_faint_pair() {
        let pack = load("ru", None);
        let understood = understand(&pack.grammar, &heard("топливо сорок и где я", 0.4), 0.6);

        assert!(matches!(
            understood.as_slice(),
            [Understood::Unsure(_), Understood::Command(_)]
        ));
    }

    /// Feeds a line Piper spoke into the real Vosk with the built-in Russian
    /// grammar — the whole ear but the microphone.
    #[test]
    #[ignore = "needs MT_VOICE_DOWNLOADS: the Piper, Vosk and small-ru zips and the Dmitri voice files"]
    fn recognises_a_spoken_command_through_the_real_engine() {
        use crate::assets::catalog::{catalog, PIPER_ENGINE, VOSK_ENGINE};
        use crate::assets::VoiceAssets;
        use crate::piper::{Piper, PiperSetup};

        let downloads = PathBuf::from(std::env::var("MT_VOICE_DOWNLOADS").unwrap());
        let root = std::env::temp_dir().join("mt-voice-live");
        let assets = VoiceAssets::new(&root);
        let voice_id = "piper-voice-ru-dmitri";

        for id in [PIPER_ENGINE, VOSK_ENGINE, voice_id, "vosk-model-small-ru"] {
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

        let wav = root.join("cache").join("command.wav");
        let mut piper = Piper::spawn(PiperSetup {
            root: root.clone(),
            executable: assets.piper_executable().unwrap(),
            model: assets.voice_model(voice_id).unwrap(),
            length_scale: 1.0,
        })
        .unwrap();

        piper.synthesize("Залей сорок пять литров", &wav).unwrap();
        drop(piper);

        let bytes = std::fs::read(&wav).unwrap();
        // Piper writes a plain 44-byte header: mono, 16-bit, the voice's rate.
        let sample_rate = u32::from_le_bytes([bytes[24], bytes[25], bytes[26], bytes[27]]);
        let samples: Vec<i16> = bytes[44..]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| i16::from_le_bytes(*pair))
            .collect();
        let pack = load("ru", None);
        let started = Instant::now();
        let library = VoskLibrary::load(&assets.vosk_library().unwrap()).unwrap();
        let model = Rc::new(VoskModel::load(&library, &assets.vosk_model("ru").unwrap()).unwrap());

        println!("library + model: {:?}", started.elapsed());

        let started = Instant::now();
        let mut recognizer =
            Recognizer::new(&model, sample_rate, &pack.grammar.vosk_grammar()).unwrap();

        println!(
            "recognizer over {} sentences: {:?}",
            pack.grammar.sentence_count(),
            started.elapsed()
        );

        for chunk in samples.chunks(sample_rate as usize / 10) {
            recognizer.accept(chunk);
        }

        let started = Instant::now();
        let heard = parse_result(&recognizer.finish());

        println!("final result: {:?} — {heard:?}", started.elapsed());

        let understood = understand(&pack.grammar, &heard, DEFAULT_CONFIDENCE_THRESHOLD);
        let [Understood::Command(command)] = understood.as_slice() else {
            panic!("not understood: {heard:?}");
        };

        assert_eq!(command.intent, "pit.fuel");
        assert_eq!(command.slot("number"), Some(&SlotValue::Number(45)));
    }
    #[test]
    #[ignore = "needs the Vosk engine and small-ru model installed by the tests above"]
    fn the_model_tells_the_words_it_lacks() {
        use crate::assets::VoiceAssets;

        let assets = VoiceAssets::new(std::env::temp_dir().join("mt-voice-live"));
        let (messages, inbox) = mpsc::channel();
        let ear = thread::spawn(move || {
            let config = InputConfig {
                library: assets.vosk_library(),
                model: assets.vosk_model("ru"),
                grammar: "[]".into(),
                device: None,
            };

            struct Deaf;

            impl VoiceInEvents for Deaf {
                fn listening(&self, _: bool) {}
                fn heard(&self, _: Heard) {}
                fn failed(&self, _: &str) {}
            }

            Ear::new(config, Deaf, mpsc::channel().0).run(inbox);
        });
        let lookup = WordLookup {
            messages: messages.clone(),
        };
        let words = vec!["залей".to_string(), "тачкабульон".to_string()];

        assert_eq!(
            lookup.missing(words.clone()),
            Some(vec!["тачкабульон".into()])
        );
        assert_eq!(lookup.missing(words), Some(vec!["тачкабульон".into()]));

        messages.send(Message::Shutdown).unwrap();
        ear.join().unwrap();
    }

    /// Builds a recognizer from each built-in grammar on its own model. Vosk
    /// prints every word its vocabulary lacks ("Ignoring word missing in
    /// vocabulary") — the pack must be rewritten until it prints none.
    #[test]
    #[ignore = "needs MT_VOICE_DOWNLOADS: the Vosk zip and every small model zip"]
    fn built_in_grammars_print_their_missing_words() {
        use crate::assets::catalog::{catalog, VOSK_ENGINE};
        use crate::assets::VoiceAssets;

        let downloads = PathBuf::from(std::env::var("MT_VOICE_DOWNLOADS").unwrap());
        let assets = VoiceAssets::new(std::env::temp_dir().join("mt-voice-live"));

        let models = crate::pack::BUILT_IN_LANGUAGES
            .iter()
            .map(|language| format!("vosk-model-small-{language}"));

        for id in std::iter::once(VOSK_ENGINE.to_string()).chain(models) {
            let component = catalog().component(&id).unwrap();

            if !assets.is_installed(component) {
                let files: Vec<PathBuf> = component
                    .files
                    .iter()
                    .map(|file| downloads.join(&file.name))
                    .collect();

                assets.import_files(component, &files).unwrap();
            }
        }

        let library = VoskLibrary::load(&assets.vosk_library().unwrap()).unwrap();

        for language in crate::pack::BUILT_IN_LANGUAGES {
            let model =
                Rc::new(VoskModel::load(&library, &assets.vosk_model(language).unwrap()).unwrap());
            let pack = load(language, None);

            eprintln!("--- {language}");
            Recognizer::new(&model, 16_000, &pack.grammar.vosk_grammar()).unwrap();
        }
    }
}
