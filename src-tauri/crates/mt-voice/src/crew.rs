//! The crew as the app runs it: the ear, the mouth and the language pack,
//! joined to the car through a host.
//!
//! A press goes to both threads — the ear opens the microphone, the mouth
//! falls silent. A sentence heard is either a radio control (repeat),
//! handled here, or a request for the engineer, which the host takes to the
//! telemetry thread; its reply comes back through `on_reply` and is spoken.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use mt_model::app::crew::{
    CompoundKind, CrewArg, CrewIntent, CrewRadioEvent, CrewReply, SimRead, CHAT_MACRO_ACTION,
    QUESTION_PREFIX,
};
use mt_model::pit::pit_action::TireSet;
use mt_model::utils::lock_or_recover;

use crate::assets::VoiceAssets;
use crate::pack::catalog::{
    ask_key, intent_named, sim_values_in, COMPOUND_SLOT, NUMBER_SLOT, TIRES_SLOT,
};
use crate::pack::grammar::Recognised;
use crate::pack::message::{Arg, Args};
use crate::pack::template::SlotValue;
use crate::pack::{load, step_command, CompiledVariant, LanguagePack, VariantPicker};
use crate::queue::Reply;
use crate::voice_in::{understand, InputConfig, Understood, VoiceIn, VoiceInEvents, WordLookup};
use crate::voice_out::{OutputConfig, Utterance, VoiceOut, VoiceOutEvents};
use crate::vosk::Heard;

/// An answer that waited this long is no longer worth saying.
const ANSWER_TTL: Duration = Duration::from_secs(8);
const PACKS_DIR: &str = "packs";
const CUSTOM_VOICE_PREFIX: &str = "custom:";

/// What the app takes from the crew: requests for the telemetry thread and
/// what the windows show.
pub trait CrewHost: Send + Sync + 'static {
    fn ask(&self, intent: CrewIntent);
    fn radio_event(&self, event: CrewRadioEvent);
}

/// The crew's settings, from the main window.
#[derive(Debug, Clone, PartialEq)]
pub struct CrewConfig {
    pub enabled: bool,
    pub language: String,
    pub voice_root: PathBuf,
    /// A catalog voice id, or `custom:<name>` for one the user imported.
    pub voice: String,
    pub input_device: Option<String>,
    pub output_device: Option<String>,
    pub volume: f32,
    pub length_scale: f32,
    pub confidence_threshold: f32,
}

struct Mouth {
    out: Option<VoiceOut>,
    pack: LanguagePack,
    picker: VariantPicker,
    last: Option<Utterance>,
    threshold: f32,
}

struct Shared {
    host: Arc<dyn CrewHost>,
    mouth: Mutex<Mouth>,
    /// The press under way is a test from the Crew tab: what is heard is
    /// shown, never carried out.
    testing: AtomicBool,
}

pub struct Crew {
    shared: Arc<Shared>,
    ear: Option<VoiceIn>,
    /// What the ear runs with from the saved pack; a test press of a draft
    /// swaps the grammar and puts this back.
    input: Option<InputConfig>,
    /// A test press is listening with a draft's grammar.
    draft_heard: bool,
    config: Option<CrewConfig>,
}

impl Crew {
    pub fn new(host: Arc<dyn CrewHost>) -> Self {
        Self {
            shared: Arc::new(Shared {
                host,
                testing: AtomicBool::new(false),
                mouth: Mutex::new(Mouth {
                    out: None,
                    pack: load("en", None),
                    picker: VariantPicker::default(),
                    last: None,
                    threshold: 0.0,
                }),
            }),
            ear: None,
            input: None,
            draft_heard: false,
            config: None,
        }
    }

    /// Applies the settings: starts, reconfigures or stops both threads. The
    /// language pack is read again every time — that is how an edited pack is
    /// picked up without a restart.
    pub fn configure(&mut self, config: CrewConfig) {
        if !config.enabled {
            self.ear = None;
            self.input = None;
            lock_or_recover(&self.shared.mouth).out = None;
            self.config = Some(config);
            return;
        }

        let assets = VoiceAssets::new(&config.voice_root);
        let pack_folder = pack_folder(&config.voice_root, &config.language);
        let pack = load(&config.language, Some(&pack_folder));
        let input = InputConfig {
            library: assets.vosk_library(),
            model: assets.vosk_model(&config.language),
            grammar: pack.grammar.vosk_grammar(),
            device: config.input_device.clone(),
        };
        let output = output_config(&config);

        for issue in &pack.issues {
            tracing::warn!(location = %issue.location, message = %issue.message, "voice pack");
        }

        {
            let mut mouth = lock_or_recover(&self.shared.mouth);

            mouth.pack = pack;
            mouth.threshold = config.confidence_threshold;

            match &mouth.out {
                Some(out) => out.configure(output),
                None => match VoiceOut::start(output, MouthEvents(Arc::clone(&self.shared.host))) {
                    Ok(out) => mouth.out = Some(out),
                    Err(error) => tracing::error!(%error, "voice out did not start"),
                },
            }
        }

        self.input = Some(input.clone());
        self.draft_heard = false;

        match &self.ear {
            Some(ear) => ear.configure(input),
            None => match VoiceIn::start(input, EarEvents(Arc::clone(&self.shared))) {
                Ok(ear) => self.ear = Some(ear),
                Err(error) => tracing::error!(%error, "voice in did not start"),
            },
        }

        self.config = Some(config);
    }

    pub fn set_ptt(&self, held: bool) {
        if let Some(ear) = &self.ear {
            ear.set_ptt(held);
        }

        if let Some(out) = &lock_or_recover(&self.shared.mouth).out {
            out.set_ptt(held);
        }
    }

    /// A test press from the Crew tab: listens like push-to-talk, but what it
    /// hears is reported (`CrewRadioEvent::Tested`) and never carried out.
    /// `draft_grammar` listens for a pack still being edited, until the
    /// release; the ear's own messages keep the order, so the release is
    /// heard with the draft before the saved grammar is back.
    pub fn set_test_ptt(&mut self, held: bool, draft_grammar: Option<String>) {
        let Some(ear) = &self.ear else {
            return;
        };

        if held {
            self.shared.testing.store(true, Ordering::Relaxed);

            if let (Some(grammar), Some(input)) = (draft_grammar, &self.input) {
                ear.configure(InputConfig {
                    grammar,
                    ..input.clone()
                });
                self.draft_heard = true;
            }
        }

        ear.set_ptt(held);

        if !held && self.draft_heard {
            if let Some(input) = &self.input {
                ear.configure(input.clone());
            }

            self.draft_heard = false;
        }
    }

    pub fn config(&self) -> Option<&CrewConfig> {
        self.config.as_ref()
    }

    /// The ear's model, asked about words — when it is listening in this
    /// language.
    pub fn word_lookup(&self, language: &str) -> Option<WordLookup> {
        let config = self.config.as_ref()?;

        (config.enabled && config.language == language)
            .then(|| self.ear.as_ref().map(VoiceIn::word_lookup))
            .flatten()
    }

    /// Reads the pack and the installed components again — after an edit, a
    /// download or an import.
    pub fn reload(&mut self) {
        if let Some(config) = self.config.clone() {
            self.configure(config);
        }
    }

    /// Plays a line now, as an answer: the editor's play button.
    pub fn preview(&self, utterance: Utterance) {
        if let Some(out) = &lock_or_recover(&self.shared.mouth).out {
            out.say(reply(utterance));
        }
    }

    /// The engineer's answer from the telemetry thread.
    pub fn on_reply(&self, reply: &CrewReply) {
        self.shared.speak(reply);
    }
}

impl Shared {
    fn heard(&self, heard: Heard) {
        if self.testing.swap(false, Ordering::Relaxed) {
            let intents = {
                let mouth = lock_or_recover(&self.mouth);

                mouth
                    .pack
                    .grammar
                    .recognise_all(&heard.text)
                    .into_iter()
                    .map(|command| command.intent.clone())
                    .collect()
            };

            self.host.radio_event(CrewRadioEvent::Tested {
                text: heard.text,
                intents,
                confidence: heard.confidence,
            });
            return;
        }

        // A press with nothing said gets no reply at all.
        if heard.text.is_empty() {
            return;
        }

        let understood = {
            let mouth = lock_or_recover(&self.mouth);

            understand(&mouth.pack.grammar, &heard, mouth.threshold)
        };

        self.host.radio_event(CrewRadioEvent::Heard {
            text: heard.text.clone(),
            understood: !understood.is_empty()
                && understood
                    .iter()
                    .all(|command| matches!(command, Understood::Command(_))),
        });

        if understood.is_empty() {
            self.speak(&CrewReply::plain("engineer.notUnderstood"));
            return;
        }

        // In the order said, each with its own reply.
        for command in understood {
            match command {
                Understood::Command(command) => self.carry_out(&command),
                Understood::Unsure(_) => self.speak(&CrewReply::plain("engineer.notUnderstood")),
            }
        }
    }

    fn carry_out(&self, command: &Recognised) {
        match command.intent.as_str() {
            "control.repeat" => self.repeat(),
            _ => match crew_intent(command) {
                Some(intent) => self.host.ask(self.with_pack_parts(intent)),
                None => self.speak(&CrewReply::plain(missing_value_reply(command))),
            },
        }
    }

    /// A question names the sim values its replies say, for the telemetry
    /// thread to read on the tick that answers it, and the steps it carries
    /// out first.
    fn with_pack_parts(&self, intent: CrewIntent) -> CrewIntent {
        let CrewIntent::Question { id, .. } = intent else {
            return intent;
        };
        let mouth = lock_or_recover(&self.mouth);
        let mut names: Vec<String> = mouth
            .pack
            .variants(&format!("{QUESTION_PREFIX}{id}"))
            .iter()
            .flat_map(CompiledVariant::messages)
            .flat_map(sim_values_in)
            .collect();
        // A step the pack check refused is left out, as it was reported.
        let steps = mouth
            .pack
            .commands_file
            .custom
            .questions
            .iter()
            .find(|question| question.id == id)
            .map(|question| {
                question
                    .steps
                    .iter()
                    .filter_map(|step| step_command(step).ok())
                    .filter_map(|command| crew_intent(&command))
                    .collect()
            })
            .unwrap_or_default();

        names.sort();
        names.dedup();

        CrewIntent::Question {
            id,
            sim: names
                .into_iter()
                .map(|name| SimRead { name, value: None })
                .collect(),
            steps,
        }
    }

    fn repeat(&self) {
        let mouth = lock_or_recover(&self.mouth);
        let (Some(last), Some(out)) = (mouth.last.clone(), &mouth.out) else {
            drop(mouth);
            self.speak(&CrewReply::plain("engineer.nothingToRepeat"));
            return;
        };

        out.say(reply(last));
    }

    fn speak(&self, crew_reply: &CrewReply) {
        let mut mouth = lock_or_recover(&self.mouth);
        // A question's answer may name a value the sim does not have now.
        let utterance = utterance(&mut mouth, crew_reply).or_else(|| {
            crew_reply
                .key
                .starts_with(QUESTION_PREFIX)
                .then(|| utterance(&mut mouth, &CrewReply::plain("engineer.noData")))
                .flatten()
        });
        let Some(utterance) = utterance else {
            tracing::warn!(key = %crew_reply.key, "voice pack has no words for this reply");
            return;
        };

        if let Some(ok) = crew_reply.command_ok {
            self.host.radio_event(CrewRadioEvent::Command {
                ok,
                text: utterance.text.clone(),
            });
        }

        mouth.last = Some(utterance.clone());

        if let Some(out) = &mouth.out {
            out.say(reply(utterance));
        }
    }
}

fn reply(utterance: Utterance) -> Reply<Utterance> {
    Reply {
        queued_at: Instant::now(),
        ttl: ANSWER_TTL,
        content: utterance,
    }
}

/// The reply in the pack's words: a variant picked, its values filled in.
fn utterance(mouth: &mut Mouth, crew_reply: &CrewReply) -> Option<Utterance> {
    let Mouth { pack, picker, .. } = mouth;
    let saying = picker.pick(pack, &crew_reply.key)?;
    let args: Args<'_> = crew_reply
        .args
        .iter()
        .map(|(name, value)| {
            let arg = match value {
                CrewArg::Number { value } => Arg::Number(*value),
                CrewArg::Slot { slot, value } => {
                    Arg::Text(pack.slot_word(slot, value).unwrap_or(value).to_string())
                }
            };

            (name.as_str(), arg)
        })
        .collect();
    let text = pack.text(saying, &args)?;

    Some(Utterance { text })
}

/// Where the voice comes from and goes, for these settings.
pub fn output_config(config: &CrewConfig) -> OutputConfig {
    let assets = VoiceAssets::new(&config.voice_root);

    OutputConfig {
        root: config.voice_root.clone(),
        piper: assets.piper_executable(),
        voice_id: config.voice.clone(),
        voice_model: voice_model(&assets, &config.voice),
        device: config.output_device.clone(),
        volume: config.volume,
        length_scale: config.length_scale,
    }
}

/// The user's pack folder for a language.
pub fn pack_folder(voice_root: &Path, language: &str) -> PathBuf {
    voice_root.join(PACKS_DIR).join(language)
}

fn voice_model(assets: &VoiceAssets, voice: &str) -> Option<PathBuf> {
    match voice.strip_prefix(CUSTOM_VOICE_PREFIX) {
        Some(name) => assets
            .custom_voices()
            .into_iter()
            .find(|custom| custom.name == name)
            .map(|custom| custom.model),
        None => assets.voice_model(voice),
    }
}

/// What the engineer says to a sentence that names no request: asks for the
/// value it left out, or did not understand it.
fn missing_value_reply(command: &Recognised) -> &'static str {
    intent_named(&command.intent)
        .filter(|intent| intent.slots.iter().any(|slot| command.slot(slot).is_none()))
        .and_then(ask_key)
        .unwrap_or("engineer.notUnderstood")
}

/// A recognised sentence as the engineer's request. Radio controls are not
/// requests and give `None`, as does a slot value nothing maps.
pub fn crew_intent(command: &Recognised) -> Option<CrewIntent> {
    let name = |slot: &str| match command.slot(slot) {
        Some(SlotValue::Name(name)) => Some(name.as_str()),
        _ => None,
    };
    let number = || match command.slot(NUMBER_SLOT) {
        Some(SlotValue::Number(number)) => Some(*number),
        _ => None,
    };

    Some(match command.intent.as_str() {
        "pit.fuel" => match command.slot(NUMBER_SLOT) {
            Some(SlotValue::Number(liters)) => CrewIntent::Fuel { liters: *liters },
            _ => return None,
        },
        "pit.fuelToFinish" => CrewIntent::FuelToFinish,
        "pit.clearFuel" => CrewIntent::ClearFuel,
        "pit.tires" => CrewIntent::Tires {
            corners: TireSet::named(name(TIRES_SLOT)?)?,
        },
        "pit.clearTires" => CrewIntent::ClearTires,
        "pit.compound" => CrewIntent::Compound {
            compound: CompoundKind::named(name(COMPOUND_SLOT)?)?,
        },
        "pit.fastRepair" => CrewIntent::FastRepair,
        "pit.clearFastRepair" => CrewIntent::ClearFastRepair,
        "pit.windshield" => CrewIntent::Windshield,
        "pit.clearWindshield" => CrewIntent::ClearWindshield,
        "pit.clearAll" => CrewIntent::ClearAll,
        "pit.applyPlanned" => CrewIntent::ApplyPlanned,
        "query.fuel" => CrewIntent::QueryFuel,
        "query.gapAhead" => CrewIntent::QueryGapAhead,
        "query.gapBehind" => CrewIntent::QueryGapBehind,
        "query.position" => CrewIntent::QueryPosition,
        "query.lapsLeft" => CrewIntent::QueryLapsLeft,
        "query.lastLap" => CrewIntent::QueryLastLap,
        "query.bestLap" => CrewIntent::QueryBestLap,
        "query.pitOrder" => CrewIntent::QueryPitOrder,
        "query.weather" => CrewIntent::QueryWeather,
        "query.carPosition" => CrewIntent::QueryCarPosition { car: number()? },
        "query.carLastLap" => CrewIntent::QueryCarLastLap { car: number()? },
        "query.carBestLap" => CrewIntent::QueryCarBestLap { car: number()? },
        CHAT_MACRO_ACTION => CrewIntent::ChatMacro { slot: number()? },
        other => CrewIntent::Question {
            id: other.strip_prefix(QUESTION_PREFIX)?.to_string(),
            sim: Vec::new(),
            steps: Vec::new(),
        },
    })
}

struct EarEvents(Arc<Shared>);

impl VoiceInEvents for EarEvents {
    fn listening(&self, on: bool) {
        self.0.host.radio_event(CrewRadioEvent::Listening { on });
    }

    fn heard(&self, heard: Heard) {
        self.0.heard(heard);
    }

    fn failed(&self, message: &str) {
        self.0.host.radio_event(CrewRadioEvent::Failed {
            message: message.to_string(),
        });
    }
}

struct MouthEvents(Arc<dyn CrewHost>);

impl VoiceOutEvents for MouthEvents {
    fn speaking(&self, text: &str) {
        self.0.radio_event(CrewRadioEvent::Speaking {
            text: text.to_string(),
        });
    }

    fn finished(&self) {
        self.0.radio_event(CrewRadioEvent::Finished);
    }

    fn failed(&self, message: &str) {
        self.0.radio_event(CrewRadioEvent::Failed {
            message: message.to_string(),
        });
    }
}

#[cfg(test)]
mod tests {
    use mt_model::app::voice::VoiceStep;

    use super::*;

    #[derive(Default)]
    struct Recorder {
        asked: Mutex<Vec<CrewIntent>>,
        events: Mutex<Vec<CrewRadioEvent>>,
    }

    impl CrewHost for Recorder {
        fn ask(&self, intent: CrewIntent) {
            self.asked.lock().unwrap().push(intent);
        }

        fn radio_event(&self, event: CrewRadioEvent) {
            self.events.lock().unwrap().push(event);
        }
    }

    fn shared(language: &str) -> (Arc<Recorder>, Shared) {
        let recorder = Arc::new(Recorder::default());
        let shared = Shared {
            host: recorder.clone(),
            testing: AtomicBool::new(false),
            mouth: Mutex::new(Mouth {
                out: None,
                pack: load(language, None),
                picker: VariantPicker::with_seed(1),
                last: None,
                threshold: 0.6,
            }),
        };

        (recorder, shared)
    }

    fn heard(text: &str) -> Heard {
        Heard {
            text: text.into(),
            confidence: 1.0,
        }
    }

    #[test]
    fn a_value_left_unsaid_is_the_packs_default_or_a_question() {
        let (recorder, shared) = shared("ru");
        let pack = load("ru", None);

        shared.heard(heard("меняй шины"));

        assert_eq!(
            *recorder.asked.lock().unwrap(),
            vec![CrewIntent::Tires {
                corners: TireSet::ALL
            }]
        );
        assert_eq!(
            missing_value_reply(pack.grammar.recognise("смени состав").unwrap()),
            "engineer.ask.compound"
        );
        assert_eq!(
            missing_value_reply(pack.grammar.recognise("где я").unwrap()),
            "engineer.notUnderstood"
        );
    }

    #[test]
    fn takes_a_request_to_the_engineer() {
        let (recorder, shared) = shared("ru");

        shared.heard(heard("меняем передние"));
        shared.heard(heard("ставь дождевые"));

        assert_eq!(
            *recorder.asked.lock().unwrap(),
            vec![
                CrewIntent::Tires {
                    corners: TireSet {
                        lf: true,
                        rf: true,
                        ..TireSet::NONE
                    }
                },
                CrewIntent::Compound {
                    compound: CompoundKind::Wet
                },
            ]
        );
    }

    #[test]
    fn carries_out_commands_said_together_in_order() {
        let (recorder, shared) = shared("ru");

        shared.heard(heard("топливо сорок и меняем передние"));

        assert_eq!(
            *recorder.asked.lock().unwrap(),
            vec![
                CrewIntent::Fuel { liters: 40 },
                CrewIntent::Tires {
                    corners: TireSet {
                        lf: true,
                        rf: true,
                        ..TireSet::NONE
                    }
                },
            ]
        );
    }

    #[test]
    fn changes_one_named_corner() {
        let (recorder, shared) = shared("ru");

        shared.heard(heard("поменяй переднюю левую шину"));
        shared.heard(heard("меняем правое заднее колесо"));

        assert_eq!(
            *recorder.asked.lock().unwrap(),
            vec![
                CrewIntent::Tires {
                    corners: TireSet {
                        lf: true,
                        ..TireSet::NONE
                    }
                },
                CrewIntent::Tires {
                    corners: TireSet {
                        rr: true,
                        ..TireSet::NONE
                    }
                },
            ]
        );
    }

    #[test]
    fn fuel_without_an_amount_is_fuel_to_the_finish() {
        let (recorder, shared) = shared("ru");

        shared.heard(heard("залей топливо и поменяй все шины"));

        assert_eq!(
            *recorder.asked.lock().unwrap(),
            vec![
                CrewIntent::FuelToFinish,
                CrewIntent::Tires {
                    corners: TireSet::ALL
                },
            ]
        );
    }

    #[test]
    fn says_it_did_not_understand_and_stays_quiet_on_silence() {
        let (recorder, shared) = shared("en");

        shared.heard(heard(""));
        assert!(recorder.events.lock().unwrap().is_empty());

        shared.heard(heard("[unk]"));

        assert_eq!(
            recorder.events.lock().unwrap()[0],
            CrewRadioEvent::Heard {
                text: "[unk]".into(),
                understood: false
            }
        );
        assert!(recorder.asked.lock().unwrap().is_empty());
        assert!(lock_or_recover(&shared.mouth).last.is_some());
    }

    #[test]
    fn speaks_a_reply_in_the_packs_words_and_reports_the_command() {
        let (recorder, shared) = shared("ru");

        shared.speak(
            &CrewReply::plain("engineer.ack.compound")
                .slot("compound", "compound", "wet")
                .command(true),
        );

        assert_eq!(
            *recorder.events.lock().unwrap(),
            vec![CrewRadioEvent::Command {
                ok: true,
                text: "Принято, ставим дождевые".into()
            }]
        );
    }

    #[test]
    fn names_the_tyres_it_changes() {
        let (recorder, shared) = shared("ru");

        for tires in ["lf", "front", "all"] {
            shared.speak(
                &CrewReply::plain("engineer.ack.tires")
                    .slot("corners", "tires", tires)
                    .command(true),
            );
        }

        let spoken: Vec<String> = recorder
            .events
            .lock()
            .unwrap()
            .iter()
            .map(|event| match event {
                CrewRadioEvent::Command { text, .. } => text.clone(),
                other => panic!("a command, not {other:?}"),
            })
            .collect();

        assert!(spoken[0].ends_with("еняем переднюю левую"), "{spoken:?}");
        assert!(spoken[1].ends_with("еняем передние"), "{spoken:?}");
        assert!(spoken[2].ends_with("еняем все четыре"), "{spoken:?}");
    }

    fn step(action: &str, value: Option<&str>) -> VoiceStep {
        VoiceStep {
            action: action.into(),
            value: value.map(str::to_string),
        }
    }

    fn with_question(shared: &Shared, name: &str) {
        let mut mouth = lock_or_recover(&shared.mouth);
        let mut commands = mouth.pack.commands_file.clone();

        commands.custom.questions.push(crate::pack::Question {
            id: "weather".into(),
            name: "Weather".into(),
            phrases: vec!["how is the sky".into()],
            steps: vec![
                step("pit.fuel", Some("30")),
                step("chat.macro", Some("4")),
                step("pit.fuel", Some("lots")),
            ],
            replies: vec![crate::pack::Variant {
                text: "Air {airTemp}, {sim.PlayerCarMyIncidentCount, plural, one {# incident} other {# incidents}}".into(),
            }],
        });

        let folder =
            std::env::temp_dir().join(format!("mt-voice-crew-{name}-{}", std::process::id()));

        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(
            folder.join(crate::pack::COMMANDS_FILE),
            serde_json::to_string(&commands).unwrap(),
        )
        .unwrap();
        mouth.pack = load("en", Some(&folder));

        let _ = std::fs::remove_dir_all(folder);
    }

    #[test]
    fn asks_the_engineer_a_question_of_the_drivers_own_with_its_steps() {
        let (recorder, shared) = shared("en");

        with_question(&shared, "ask");
        shared.heard(heard("how is the sky"));

        assert_eq!(
            *recorder.asked.lock().unwrap(),
            vec![CrewIntent::Question {
                id: "weather".into(),
                sim: vec![SimRead {
                    name: "sim.PlayerCarMyIncidentCount".into(),
                    value: None,
                }],
                // The step the pack refused is left out.
                steps: vec![
                    CrewIntent::Fuel { liters: 30 },
                    CrewIntent::ChatMacro { slot: 4 },
                ],
            }]
        );
    }

    #[test]
    fn a_routine_heard_unsure_is_not_carried_out() {
        let (recorder, shared) = shared("en");

        with_question(&shared, "unsure");
        shared.heard(Heard {
            text: "how is the sky".into(),
            confidence: 0.3,
        });

        assert!(recorder.asked.lock().unwrap().is_empty());
    }

    #[test]
    fn answers_a_question_or_says_there_is_no_data_for_it() {
        let (_, shared) = shared("en");
        let text = |shared: &Shared| {
            lock_or_recover(&shared.mouth)
                .last
                .as_ref()
                .map(|last| last.text.clone())
        };

        with_question(&shared, "answer");
        shared.speak(
            &CrewReply::plain("question.weather")
                .number("airTemp", 21.0)
                .number("sim.PlayerCarMyIncidentCount", 4.0),
        );
        assert_eq!(text(&shared).as_deref(), Some("Air 21, 4 incidents"));

        shared.speak(&CrewReply::plain("question.weather"));

        let no_data: Vec<String> = lock_or_recover(&shared.mouth)
            .pack
            .variants("engineer.noData")
            .iter()
            .map(|variant| variant.variant.text.clone())
            .collect();

        assert!(no_data.contains(&text(&shared).unwrap()));
    }
}
