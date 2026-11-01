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
    CompoundKind, CrewArg, CrewIntent, CrewRadioEvent, CrewReply, CHAT_MACRO_ACTION,
    QUESTION_PREFIX,
};
use mt_model::app::crew_questions::{
    question_field_named, question_no_value_key, question_reply_key, question_reply_kind, AskedCar,
    CarTarget, QuestionField, QuestionReplyKind, VoiceQuestionDef, CLASS_POSITION_FIELD,
    NUMBER_FIELD, POSITION_FIELD,
};
use mt_model::pit::pit_action::TireSet;
use mt_model::utils::lock_or_recover;

use crate::assets::VoiceAssets;
use crate::pack::catalog::{
    ask_key, intent_named, COMPOUND_SLOT, NO_KEY, NUMBER_SLOT, TIRES_SLOT, YES_KEY,
};
use crate::pack::grammar::Recognised;
use crate::pack::message::{values_used, Arg, Args};
use crate::pack::questions::AnswerList;
use crate::pack::say::{said, Units};
use crate::pack::template::SlotValue;
use crate::pack::{answer_key, load, step_command, CompiledVariant, LanguagePack, VariantPicker};
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
    /// Answers say miles, gallons and Fahrenheit.
    pub imperial: bool,
}

struct Mouth {
    out: Option<VoiceOut>,
    pack: LanguagePack,
    picker: VariantPicker,
    last: Option<Utterance>,
    threshold: f32,
    units: Units,
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
                    units: Units::default(),
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
            mouth.units = Units {
                imperial: config.imperial,
            };

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

    /// The units the crew says values in, as the app's settings have them.
    pub fn units(&self) -> Units {
        lock_or_recover(&self.shared.mouth).units
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
            _ => {
                match crew_intent(command).and_then(|intent| self.with_pack_parts(intent, command))
                {
                    Some(intent) => self.host.ask(intent),
                    None => self.speak(&CrewReply::plain(missing_value_reply(command))),
                }
            }
        }
    }

    fn with_pack_parts(&self, intent: CrewIntent, command: &Recognised) -> Option<CrewIntent> {
        let CrewIntent::Question { id, .. } = intent else {
            return Some(intent);
        };

        question_intent(&lock_or_recover(&self.mouth).pack, &id, command)
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
        let Mouth {
            pack,
            picker,
            units,
            ..
        } = &mut *mouth;
        let Some(utterance) = answer(pack, picker, *units, crew_reply) else {
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

/// A question of the pack as the engineer is asked it: the car its phrase
/// named, the fields its answers say, for the telemetry thread to read on the
/// tick that answers it, and the steps it carries out first. `None` for a
/// question the pack does not have, or a car the phrase did not name.
fn question_intent(pack: &LanguagePack, id: &str, command: &Recognised) -> Option<CrewIntent> {
    let question = pack
        .commands_file
        .custom
        .questions
        .iter()
        .find(|question| question.id == id)?;
    let asked = match question.target {
        None => None,
        Some(target) => Some(asked_car(target, command)?),
    };
    // A step the pack check refused is left out, as it was reported.
    let steps = question
        .steps
        .iter()
        .filter_map(|step| step_command(step).ok())
        .filter_map(|command| crew_intent(&command))
        .collect();

    Some(CrewIntent::Question {
        fields: fields_named(pack, question),
        asked,
        id: id.to_string(),
        steps,
    })
}

/// A question as a preview asks it: its car named by `car` — the number or
/// the place its phrase's slot would hear — and its steps left out. `None`
/// when the question needs a car and `car` does not name one.
pub fn preview_intent(pack: &LanguagePack, id: &str, car: Option<&str>) -> Option<CrewIntent> {
    let target = pack
        .commands_file
        .custom
        .questions
        .iter()
        .find(|question| question.id == id)?
        .target;
    let slots = match (target.and_then(CarTarget::phrase_slot), car.map(str::trim)) {
        (None, _) => Vec::new(),
        (Some(slot), Some(car)) => vec![(slot.to_string(), heard_car(slot, car)?)],
        (Some(_), None) => return None,
    };
    let command = Recognised {
        intent: question_reply_key(id),
        slots,
    };
    let mut intent = question_intent(pack, id, &command)?;

    if let CrewIntent::Question { steps, .. } = &mut intent {
        steps.clear();
    }

    Some(intent)
}

/// A car typed as its phrase's slot would hear it: a number with its leading
/// zeros, a place as a whole number.
fn heard_car(slot: &str, car: &str) -> Option<SlotValue> {
    if slot == NUMBER_FIELD {
        return (!car.is_empty() && car.chars().all(|digit| digit.is_ascii_digit()))
            .then(|| SlotValue::Digits(car.to_string()));
    }

    car.parse().ok().map(SlotValue::Number)
}

/// The reply in the pack's words. A question's reply may name a value the sim
/// does not have now: then its "no value" answer is said, and failing that the
/// engineer's own.
pub fn answer(
    pack: &LanguagePack,
    picker: &mut VariantPicker,
    units: Units,
    crew_reply: &CrewReply,
) -> Option<Utterance> {
    utterance(pack, picker, units, crew_reply)
        .or_else(|| match question_reply_kind(&crew_reply.key) {
            Some((id, QuestionReplyKind::Reply)) => utterance(
                pack,
                picker,
                units,
                &CrewReply {
                    key: question_no_value_key(id),
                    ..crew_reply.clone()
                },
            ),
            _ => None,
        })
        .or_else(|| {
            crew_reply
                .key
                .starts_with(QUESTION_PREFIX)
                .then(|| utterance(pack, picker, units, &CrewReply::plain("engineer.noData")))
                .flatten()
        })
}

/// The reply in the pack's words: a variant picked, its values filled in —
/// a question's each in its field's format.
fn utterance(
    pack: &LanguagePack,
    picker: &mut VariantPicker,
    units: Units,
    crew_reply: &CrewReply,
) -> Option<Utterance> {
    let question = question_reply_kind(&crew_reply.key).is_some();
    let saying = picker.pick(pack, &crew_reply.key)?;
    let args: Args<'_> = crew_reply
        .args
        .iter()
        .filter_map(|(name, value)| {
            let arg = match question_field_named(name).filter(|_| question) {
                Some(spec) => said(pack, units, spec.say, value)?,
                None => plain_arg(pack, value)?,
            };

            Some((name.as_str(), arg))
        })
        .collect();
    let text = pack.text(saying, &args)?;

    Some(Utterance { text })
}

/// A built-in reply's value: a number as it is, a slot value in the pack's
/// words.
fn plain_arg(pack: &LanguagePack, value: &CrewArg) -> Option<Arg> {
    Some(match value {
        CrewArg::Number { value } => Arg::Number(*value),
        CrewArg::Slot { slot, value } => {
            Arg::Text(pack.slot_word(slot, value).unwrap_or(value).to_string())
        }
        CrewArg::Text { value } => Arg::Text(value.clone()),
        CrewArg::Flag { value } => {
            let key = if *value { YES_KEY } else { NO_KEY };

            Arg::Text(pack.variants(key).first()?.sayings.first()?.text.clone())
        }
    })
}

/// The car a question names, from what its phrase heard: a number in its
/// `{number}`, a place in its `{position}` or `{classPosition}`.
fn asked_car(target: CarTarget, command: &Recognised) -> Option<AskedCar> {
    if let Some(asked) = AskedCar::fixed(target) {
        return Some(asked);
    }

    let place = |slot: &str| match command.slot(slot) {
        Some(SlotValue::Number(place)) => i32::try_from(*place).ok(),
        _ => None,
    };

    Some(match target {
        CarTarget::ByCarNumber => match command.slot(NUMBER_FIELD) {
            Some(SlotValue::Digits(number)) => AskedCar::ByCarNumber {
                number: number.clone(),
            },
            _ => return None,
        },
        CarTarget::ByPosition => AskedCar::ByPosition {
            position: place(POSITION_FIELD)?,
        },
        CarTarget::ByClassPosition => AskedCar::ByClassPosition {
            position: place(CLASS_POSITION_FIELD)?,
        },
        CarTarget::Me
        | CarTarget::Ahead
        | CarTarget::Behind
        | CarTarget::Leader
        | CarTarget::ClassLeader
        | CarTarget::AheadOnTrack
        | CarTarget::BehindOnTrack => return None,
    })
}

/// Every field a question's answers name, each once, in catalog order.
fn fields_named(pack: &LanguagePack, question: &VoiceQuestionDef) -> Vec<QuestionField> {
    let names: Vec<String> = AnswerList::ALL
        .iter()
        .flat_map(|list| pack.variants(&answer_key(&question.id, *list)))
        .flat_map(CompiledVariant::messages)
        .flat_map(values_used)
        .collect();

    mt_model::app::crew_questions::QUESTION_FIELDS
        .iter()
        .filter(|spec| names.iter().any(|name| name == spec.name))
        .map(|spec| spec.field)
        .collect()
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
            asked: None,
            fields: Vec::new(),
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
    use mt_model::app::crew_questions::{CarField, SessionField};
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
                units: Units::default(),
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

    fn question(id: &str, target: Option<CarTarget>) -> VoiceQuestionDef {
        VoiceQuestionDef {
            id: id.into(),
            name: String::new(),
            enabled: true,
            phrases: Vec::new(),
            target,
            replies: Vec::new(),
            no_car: Vec::new(),
            no_value: Vec::new(),
            steps: Vec::new(),
        }
    }

    fn with_questions(shared: &Shared, name: &str) {
        let mut mouth = lock_or_recover(&shared.mouth);
        let mut commands = mouth.pack.commands_file.clone();

        commands.custom.questions.push(VoiceQuestionDef {
            phrases: vec!["how is the sky".into()],
            steps: vec![
                step("pit.fuel", Some("30")),
                step("chat.macro", Some("4")),
                step("pit.fuel", Some("lots")),
            ],
            replies: vec!["Air {airTemp}, track {trackTemp}".into()],
            no_value: vec!["No idea about {trackName}".into()],
            ..question("weather", None)
        });
        commands.custom.questions.push(VoiceQuestionDef {
            phrases: vec!["tell me about car {number}".into()],
            replies: vec!["Car {number} is P{position}, {inPit}".into()],
            no_car: vec!["No car {number}".into()],
            ..question("car", Some(CarTarget::ByCarNumber))
        });
        commands.custom.questions.push(VoiceQuestionDef {
            phrases: vec!["who is p {position}".into()],
            replies: vec!["{name}".into()],
            no_car: vec!["Nobody".into()],
            ..question("place", Some(CarTarget::ByPosition))
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

    fn last_said(shared: &Shared) -> Option<String> {
        lock_or_recover(&shared.mouth)
            .last
            .as_ref()
            .map(|last| last.text.clone())
    }

    #[test]
    fn asks_the_engineer_a_question_of_the_drivers_own_with_its_steps() {
        let (recorder, shared) = shared("en");

        with_questions(&shared, "ask");
        shared.heard(heard("how is the sky"));

        assert_eq!(
            *recorder.asked.lock().unwrap(),
            vec![CrewIntent::Question {
                id: "weather".into(),
                asked: None,
                fields: vec![
                    QuestionField::Session(SessionField::AirTemp),
                    QuestionField::Session(SessionField::TrackTemp),
                    QuestionField::Session(SessionField::TrackName),
                ],
                // The step the pack refused is left out.
                steps: vec![
                    CrewIntent::Fuel { liters: 30 },
                    CrewIntent::ChatMacro { slot: 4 },
                ],
            }]
        );
    }

    #[test]
    fn names_the_car_by_the_number_or_the_place_heard() {
        let (recorder, shared) = shared("en");

        with_questions(&shared, "car");
        shared.heard(heard("tell me about car zero nine"));
        shared.heard(heard("tell me about car nine"));
        shared.heard(heard("who is p three"));

        let asked: Vec<Option<AskedCar>> = recorder
            .asked
            .lock()
            .unwrap()
            .iter()
            .map(|intent| match intent {
                CrewIntent::Question { asked, .. } => asked.clone(),
                other => panic!("a question, not {other:?}"),
            })
            .collect();

        assert_eq!(
            asked,
            vec![
                Some(AskedCar::ByCarNumber {
                    number: "09".into()
                }),
                Some(AskedCar::ByCarNumber { number: "9".into() }),
                Some(AskedCar::ByPosition { position: 3 }),
            ]
        );
        assert!(matches!(
            &recorder.asked.lock().unwrap()[0],
            CrewIntent::Question { fields, .. } if *fields == vec![
                QuestionField::Car(CarField::Number),
                QuestionField::Car(CarField::Position),
                QuestionField::Car(CarField::InPit),
            ]
        ));
    }

    #[test]
    fn a_routine_heard_unsure_is_not_carried_out() {
        let (recorder, shared) = shared("en");

        with_questions(&shared, "unsure");
        shared.heard(Heard {
            text: "how is the sky".into(),
            confidence: 0.3,
        });

        assert!(recorder.asked.lock().unwrap().is_empty());
    }

    #[test]
    fn says_each_field_in_its_format() {
        let (_, shared) = shared("en");

        with_questions(&shared, "say");
        shared.speak(
            &CrewReply::plain("question.car")
                .arg("number", CrewArg::Text { value: "09".into() })
                .number("position", 3.0)
                .arg("inPit", CrewArg::Flag { value: false }),
        );

        assert_eq!(
            last_said(&shared).as_deref(),
            Some("Car zero nine is P3, no")
        );

        shared.speak(
            &CrewReply::plain("question.car.noCar")
                .arg("number", CrewArg::Text { value: "99".into() }),
        );

        assert_eq!(last_said(&shared).as_deref(), Some("No car nine nine"));
    }

    #[test]
    fn a_value_missing_says_the_no_value_answer_then_the_engineers_own() {
        let (_, shared) = shared("en");

        with_questions(&shared, "answer");
        shared.speak(
            &CrewReply::plain("question.weather")
                .number("airTemp", 21.4)
                .number("trackTemp", 30.0),
        );
        assert_eq!(last_said(&shared).as_deref(), Some("Air 21, track 30"));

        shared.speak(
            &CrewReply::plain("question.weather")
                .number("airTemp", 21.0)
                .arg(
                    "trackName",
                    CrewArg::Text {
                        value: "Spa".into(),
                    },
                ),
        );
        assert_eq!(last_said(&shared).as_deref(), Some("No idea about Spa"));

        shared.speak(&CrewReply::plain("question.weather"));

        let no_data: Vec<String> = lock_or_recover(&shared.mouth)
            .pack
            .variants("engineer.noData")
            .iter()
            .map(|variant| variant.variant.text.clone())
            .collect();

        assert!(no_data.contains(&last_said(&shared).unwrap()));
    }
}
