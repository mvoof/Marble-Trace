//! Vosk, loaded at runtime from the downloaded `libvosk.dll` — the app starts
//! and runs without it, the voice simply stays off.
//!
//! The FFI sits here alone, behind three owning types: `VoskLibrary` keeps the
//! DLL loaded, `VoskModel` and `Recognizer` free what they hold on drop and
//! keep the library alive while they do. None of them is `Send`: they are made,
//! used and dropped on the voice-in thread.

use std::ffi::{c_char, c_float, c_int, c_void, CStr, CString};
use std::path::Path;
use std::ptr::NonNull;
use std::rc::Rc;

use libloading::os::windows::{Library, LOAD_WITH_ALTERED_SEARCH_PATH};

type ModelNew = unsafe extern "C" fn(*const c_char) -> *mut c_void;
type ModelFree = unsafe extern "C" fn(*mut c_void);
type ModelFindWord = unsafe extern "C" fn(*mut c_void, *const c_char) -> c_int;
type RecognizerNewGrammar =
    unsafe extern "C" fn(*mut c_void, c_float, *const c_char) -> *mut c_void;
type RecognizerSetWords = unsafe extern "C" fn(*mut c_void, c_int);
type AcceptWaveform = unsafe extern "C" fn(*mut c_void, *const i16, c_int) -> c_int;
type FinalResult = unsafe extern "C" fn(*mut c_void) -> *const c_char;
type RecognizerReset = unsafe extern "C" fn(*mut c_void);
type RecognizerFree = unsafe extern "C" fn(*mut c_void);
type SetLogLevel = unsafe extern "C" fn(c_int);

/// Kaldi's own logging, which goes to stderr; -1 keeps it to errors.
const VOSK_LOG_ERRORS_ONLY: c_int = -1;

struct Api {
    model_new: ModelNew,
    model_free: ModelFree,
    model_find_word: ModelFindWord,
    recognizer_new_grammar: RecognizerNewGrammar,
    recognizer_set_words: RecognizerSetWords,
    accept_waveform: AcceptWaveform,
    final_result: FinalResult,
    recognizer_reset: RecognizerReset,
    recognizer_free: RecognizerFree,
    // Last, so the function pointers above are never outlived by it.
    _library: Library,
}

#[derive(Clone)]
pub struct VoskLibrary(Rc<Api>);

impl VoskLibrary {
    /// Loads `libvosk.dll`. Its MinGW runtime sits beside it, so the DLL's own
    /// folder is searched for its dependencies rather than the app's.
    pub fn load(path: &Path) -> Result<Self, String> {
        // SAFETY: loading runs the DLL's initialisers; this is the catalog's
        // libvosk, checked against its pinned sha256 when it was installed.
        let library = unsafe { Library::load_with_flags(path, LOAD_WITH_ALTERED_SEARCH_PATH) }
            .map_err(|error| format!("libvosk: {error}"))?;
        let api = Api {
            model_new: symbol(&library, b"vosk_model_new\0")?,
            model_free: symbol(&library, b"vosk_model_free\0")?,
            model_find_word: symbol(&library, b"vosk_model_find_word\0")?,
            recognizer_new_grammar: symbol(&library, b"vosk_recognizer_new_grm\0")?,
            recognizer_set_words: symbol(&library, b"vosk_recognizer_set_words\0")?,
            accept_waveform: symbol(&library, b"vosk_recognizer_accept_waveform_s\0")?,
            final_result: symbol(&library, b"vosk_recognizer_final_result\0")?,
            recognizer_reset: symbol(&library, b"vosk_recognizer_reset\0")?,
            recognizer_free: symbol(&library, b"vosk_recognizer_free\0")?,
            _library: library,
        };
        let set_log_level: SetLogLevel = symbol(&api._library, b"vosk_set_log_level\0")?;

        // SAFETY: a plain setter over an int, taking no pointers.
        unsafe { set_log_level(VOSK_LOG_ERRORS_ONLY) };

        Ok(Self(Rc::new(api)))
    }
}

/// A function from the library, copied out as a plain pointer. It stays valid
/// for as long as the `Library` it came from — `Api` holds both together.
fn symbol<T: Copy>(library: &Library, name: &[u8]) -> Result<T, String> {
    // SAFETY: `T` is the C signature from `vosk_api.h` for this name, and the
    // pointer is used only while `library` is loaded (see `Api`).
    let found = unsafe { library.get::<T>(name) };

    found.map(|function| *function).map_err(|error| {
        format!(
            "libvosk: {} missing: {error}",
            String::from_utf8_lossy(name).trim_end_matches('\0')
        )
    })
}

pub struct VoskModel {
    api: Rc<Api>,
    raw: NonNull<c_void>,
}

impl VoskModel {
    /// Loads a model folder — a few hundred milliseconds, done once per
    /// language rather than per press.
    pub fn load(library: &VoskLibrary, folder: &Path) -> Result<Self, String> {
        let path = CString::new(narrow_path(folder)?).map_err(|error| error.to_string())?;
        // SAFETY: `path` is a NUL-terminated string that outlives the call;
        // Vosk copies what it needs and returns null on failure.
        let raw = unsafe { (library.0.model_new)(path.as_ptr()) };

        NonNull::new(raw)
            .map(|raw| Self {
                api: Rc::clone(&library.0),
                raw,
            })
            .ok_or_else(|| format!("vosk could not load the model at {}", folder.display()))
    }

    /// Whether the model's vocabulary has the word. The recognizer drops a
    /// grammar word the model lacks, so a phrase with one is never heard.
    pub fn has_word(&self, word: &str) -> bool {
        let Ok(word) = CString::new(word) else {
            return false;
        };

        // SAFETY: `raw` is the live model, `word` a NUL-terminated string
        // that outlives the call; -1 means the word is missing.
        unsafe { (self.api.model_find_word)(self.raw.as_ptr(), word.as_ptr()) >= 0 }
    }
}

impl Drop for VoskModel {
    fn drop(&mut self) {
        // SAFETY: `raw` came from `vosk_model_new` and is freed only here;
        // every recognizer made from it holds an `Rc` to this model.
        unsafe { (self.api.model_free)(self.raw.as_ptr()) };
    }
}

pub struct Recognizer {
    model: Rc<VoskModel>,
    raw: NonNull<c_void>,
}

impl Recognizer {
    /// A recognizer limited to `grammar` — a JSON array of phrases with
    /// `[unk]` among them — at the capture's own sample rate; Vosk resamples
    /// to what the model wants.
    pub fn new(model: &Rc<VoskModel>, sample_rate: u32, grammar: &str) -> Result<Self, String> {
        let grammar = CString::new(grammar).map_err(|error| error.to_string())?;
        // SAFETY: the model pointer is live (held by `model`), `grammar` is a
        // NUL-terminated string that outlives the call; null means failure.
        let raw = unsafe {
            (model.api.recognizer_new_grammar)(
                model.raw.as_ptr(),
                sample_rate as c_float,
                grammar.as_ptr(),
            )
        };
        let raw = NonNull::new(raw).ok_or("vosk refused the grammar")?;

        // SAFETY: `raw` is the recognizer just made; the setter takes an int.
        unsafe { (model.api.recognizer_set_words)(raw.as_ptr(), 1) };

        Ok(Self {
            model: Rc::clone(model),
            raw,
        })
    }

    pub fn accept(&mut self, samples: &[i16]) {
        let Ok(length) = c_int::try_from(samples.len()) else {
            return;
        };

        // SAFETY: `samples` is a live slice of `length` 16-bit samples, read
        // only for the duration of the call.
        unsafe { (self.model.api.accept_waveform)(self.raw.as_ptr(), samples.as_ptr(), length) };
    }

    /// The result for everything accepted since the last call, as Vosk's
    /// JSON, and a clean slate for the next press.
    pub fn finish(&mut self) -> String {
        // SAFETY: the returned string belongs to the recognizer and stays
        // valid until its next call; it is copied before that happens.
        let raw = unsafe { (self.model.api.final_result)(self.raw.as_ptr()) };
        let text = if raw.is_null() {
            String::new()
        } else {
            // SAFETY: non-null, NUL-terminated, owned by the recognizer (above).
            unsafe { CStr::from_ptr(raw) }
                .to_string_lossy()
                .into_owned()
        };

        // SAFETY: `raw` is the live recognizer; reset takes nothing else.
        unsafe { (self.model.api.recognizer_reset)(self.raw.as_ptr()) };

        text
    }
}

impl Drop for Recognizer {
    fn drop(&mut self) {
        // SAFETY: `raw` came from `vosk_recognizer_new_grm` and is freed only
        // here, while `model` (and through it the library) is still alive.
        unsafe { (self.model.api.recognizer_free)(self.raw.as_ptr()) };
    }
}

/// Kaldi opens the model's files through narrow paths, so a folder under a
/// Cyrillic user name is handed over as its 8.3 short form, which is ASCII.
fn narrow_path(path: &Path) -> Result<String, String> {
    let text = path.to_string_lossy();

    if text.is_ascii() {
        return Ok(text.into_owned());
    }

    short_path(path)
        .filter(|short| short.is_ascii())
        .ok_or_else(|| {
            format!(
                "{} has no ASCII short name — move the voice folder to an ASCII path",
                path.display()
            )
        })
}

#[cfg(windows)]
fn short_path(path: &Path) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::GetShortPathNameW;

    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let mut buffer = vec![0u16; 1024];
    // SAFETY: `wide` is NUL-terminated and outlives the call; the buffer's
    // length is passed with it, and the return says how much was written.
    let written = unsafe { GetShortPathNameW(PCWSTR(wide.as_ptr()), Some(&mut buffer)) } as usize;

    (written > 0 && written < buffer.len()).then(|| String::from_utf16_lossy(&buffer[..written]))
}

#[cfg(not(windows))]
fn short_path(_path: &Path) -> Option<String> {
    None
}

/// What Vosk heard: the words of the grammar it settled on, and how sure it was.
#[derive(Debug, Clone, PartialEq)]
pub struct Heard {
    pub text: String,
    /// The least confident word's score, 0–1; the sentence is only as
    /// trustworthy as its weakest word.
    pub confidence: f32,
}

/// Reads `vosk_recognizer_final_result`'s JSON with words on:
/// `{"result": [{"conf": 0.98, "word": "…"}, …], "text": "…"}`.
pub fn parse_result(json: &str) -> Heard {
    let value: serde_json::Value = serde_json::from_str(json).unwrap_or_default();
    let text = value["text"]
        .as_str()
        .unwrap_or_default()
        .trim()
        .to_string();
    let confidence = value["result"]
        .as_array()
        .map(|words| {
            words
                .iter()
                .filter_map(|word| word["conf"].as_f64())
                .fold(1.0_f64, f64::min)
        })
        .unwrap_or(0.0) as f32;

    Heard {
        confidence: if text.is_empty() { 0.0 } else { confidence },
        text,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn takes_the_weakest_word_as_the_sentence_confidence() {
        let heard = parse_result(
            r#"{"result": [{"conf": 1.0, "word": "топливо"}, {"conf": 0.62, "word": "сорок"}], "text": "топливо сорок"}"#,
        );

        assert_eq!(heard.text, "топливо сорок");
        assert!((heard.confidence - 0.62).abs() < 1e-6);
    }

    #[test]
    fn hears_nothing_in_silence_or_garbage() {
        assert_eq!(parse_result(r#"{"text": ""}"#).confidence, 0.0);
        assert_eq!(parse_result("not json").text, "");
    }

    #[test]
    fn hands_over_an_ascii_path_as_it_is() {
        assert_eq!(
            narrow_path(Path::new("C:/voice/vosk-model-small-ru")).unwrap(),
            "C:/voice/vosk-model-small-ru"
        );
    }
}
