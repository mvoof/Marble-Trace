//! Which language and voice the crew runs with, and releasing its engines
//! while their files are replaced.

use std::path::{Path, PathBuf};

use mt_model::app::crew::VoiceCrewSettings;

use crate::assets::catalog::{catalog, ComponentKind};
use crate::crew::{pack_folder, Crew, CrewConfig};
use crate::pack::BUILT_IN_LANGUAGES;

/// The language a pack falls back to when asked for one the app does not ship.
pub const FALLBACK_LANGUAGE: &str = "en";

/// `language` when the app ships a pack for it, the fallback otherwise.
pub fn known_language(language: &str) -> String {
    if BUILT_IN_LANGUAGES.contains(&language) {
        language.to_string()
    } else {
        FALLBACK_LANGUAGE.to_string()
    }
}

/// The catalog's recommended voice for `language`; empty when it has none.
pub fn recommended_voice(language: &str) -> String {
    catalog()
        .recommended_for(language)
        .into_iter()
        .find(|component| component.kind == ComponentKind::TtsVoice)
        .map(|component| component.id.clone())
        .unwrap_or_default()
}

/// The crew's settings with the voice switched off, to release the engines.
pub fn disabled_config(config: Option<&CrewConfig>) -> CrewConfig {
    match config {
        Some(config) => CrewConfig {
            enabled: false,
            ..config.clone()
        },
        None => CrewConfig {
            enabled: false,
            language: FALLBACK_LANGUAGE.to_string(),
            voice_root: PathBuf::new(),
            voice: String::new(),
            input_device: None,
            output_device: None,
            volume: 1.0,
            length_scale: 1.0,
            confidence_threshold: 0.0,
            imperial: false,
        },
    }
}

/// What the Crew tab's own actions run with: the crew's settings for
/// `language`, over `voice_root` even before the first push. A voice chosen
/// for another language gives way to this one's recommended voice.
pub fn config_for_language(
    current: Option<&CrewConfig>,
    voice_root: PathBuf,
    language: &str,
) -> CrewConfig {
    let base = disabled_config(current);
    let voice = if base.voice.is_empty() || base.language != language {
        recommended_voice(language)
    } else {
        base.voice.clone()
    };

    CrewConfig {
        voice,
        voice_root,
        language: language.to_string(),
        ..base
    }
}

impl Crew {
    /// Stops the engines so their files can be replaced; returns the settings
    /// to restart with.
    pub fn release_engines(&mut self) -> Option<CrewConfig> {
        let previous = self.config().cloned();

        self.configure(disabled_config(previous.as_ref()));

        previous
    }

    /// Restarts the crew as it was before `release_engines`, with whatever is
    /// still installed.
    pub fn restore_engines(&mut self, previous: Option<CrewConfig>) {
        if let Some(config) = previous {
            self.configure(config);
        }
    }
}

const MIN_SPEED: f32 = 0.5;
const MAX_SPEED: f32 = 2.0;

/// The folder the settings name: `None` for the app's own, an error for one
/// that is not a full path.
pub fn chosen_folder(folder: &str) -> Result<Option<PathBuf>, String> {
    let folder = folder.trim();

    if folder.is_empty() {
        return Ok(None);
    }

    let path = PathBuf::from(folder);

    if !path.is_absolute() {
        return Err(format!("Voice folder must be a full path: {folder}"));
    }

    Ok(Some(path))
}

/// The folder the pushed settings name, once their numbers are known to be
/// usable.
pub fn checked_folder(settings: &VoiceCrewSettings) -> Result<Option<PathBuf>, String> {
    let numbers = [
        settings.volume,
        settings.speed,
        settings.confidence_threshold,
    ];

    if numbers.iter().any(|number| !number.is_finite()) {
        return Err("Voice settings must be finite".to_string());
    }

    chosen_folder(&settings.folder)
}

/// The crew's configuration for the settings the main window pushed, clamped
/// to what the engines take.
pub fn config_from_settings(settings: &VoiceCrewSettings, voice_root: PathBuf) -> CrewConfig {
    let language = known_language(&settings.language);
    let voice = if settings.voice.is_empty() {
        recommended_voice(&language)
    } else {
        settings.voice.clone()
    };

    CrewConfig {
        enabled: settings.enabled,
        language,
        voice_root,
        voice,
        input_device: settings
            .input_device
            .clone()
            .filter(|device| !device.is_empty()),
        output_device: settings
            .output_device
            .clone()
            .filter(|device| !device.is_empty()),
        volume: settings.volume.clamp(0.0, 1.0),
        // Piper's length scale is the inverse of a speed: 2 speaks at half pace.
        length_scale: 1.0 / settings.speed.clamp(MIN_SPEED, MAX_SPEED),
        confidence_threshold: settings.confidence_threshold.clamp(0.0, 1.0),
        imperial: settings.imperial,
    }
}

/// The user's pack folder for `language`, an unshipped one read as the
/// fallback.
pub fn language_pack_folder(voice_root: &Path, language: &str) -> PathBuf {
    pack_folder(voice_root, &known_language(language))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(language: &str, voice: &str) -> CrewConfig {
        CrewConfig {
            enabled: true,
            language: language.to_string(),
            voice: voice.to_string(),
            ..disabled_config(None)
        }
    }

    #[test]
    fn an_unshipped_language_falls_back() {
        assert_eq!(known_language("xx"), FALLBACK_LANGUAGE);
        assert_eq!(known_language(FALLBACK_LANGUAGE), FALLBACK_LANGUAGE);
    }

    #[test]
    fn a_disabled_config_keeps_everything_but_the_switch() {
        let disabled = disabled_config(Some(&config("ru", "custom:me")));

        assert!(!disabled.enabled);
        assert_eq!(disabled.voice, "custom:me");
        assert_eq!(disabled.language, "ru");
    }

    #[test]
    fn the_same_language_keeps_its_voice() {
        let next = config_for_language(
            Some(&config("en", "custom:me")),
            PathBuf::from("voice"),
            "en",
        );

        assert_eq!(next.voice, "custom:me");
        assert_eq!(next.voice_root, PathBuf::from("voice"));
        assert!(!next.enabled);
    }

    #[test]
    fn another_language_takes_its_recommended_voice() {
        let next = config_for_language(
            Some(&config("en", "custom:me")),
            PathBuf::from("voice"),
            "ru",
        );

        assert_eq!(next.voice, recommended_voice("ru"));
        assert_eq!(next.language, "ru");
    }

    fn settings() -> VoiceCrewSettings {
        VoiceCrewSettings {
            enabled: true,
            language: "en".to_string(),
            voice: String::new(),
            input_device: Some(String::new()),
            output_device: Some("Speakers".to_string()),
            volume: 0.8,
            speed: 1.0,
            confidence_threshold: 0.5,
            folder: String::new(),
            imperial: false,
        }
    }

    #[test]
    fn an_empty_folder_is_the_apps_own_and_a_relative_one_is_refused() {
        assert_eq!(chosen_folder("  "), Ok(None));
        assert!(chosen_folder("voice/here").is_err());
    }

    #[test]
    fn a_non_finite_number_is_refused_before_the_folder_is_read() {
        let bad = VoiceCrewSettings {
            speed: f32::NAN,
            folder: "relative".to_string(),
            ..settings()
        };

        assert_eq!(
            checked_folder(&bad),
            Err("Voice settings must be finite".to_string())
        );
        assert_eq!(checked_folder(&settings()), Ok(None));
    }

    #[test]
    fn the_pushed_numbers_are_clamped_and_the_speed_inverted() {
        let loud_and_fast = VoiceCrewSettings {
            volume: 3.0,
            speed: 10.0,
            confidence_threshold: -1.0,
            ..settings()
        };
        let config = config_from_settings(&loud_and_fast, PathBuf::from("voice"));

        assert_eq!(config.volume, 1.0);
        assert_eq!(config.length_scale, 1.0 / MAX_SPEED);
        assert_eq!(config.confidence_threshold, 0.0);
        assert_eq!(
            config_from_settings(&settings(), PathBuf::new()).length_scale,
            1.0
        );
    }

    #[test]
    fn an_empty_device_or_voice_means_the_default() {
        let config = config_from_settings(&settings(), PathBuf::from("voice"));

        assert_eq!(config.input_device, None);
        assert_eq!(config.output_device.as_deref(), Some("Speakers"));
        assert_eq!(config.voice, recommended_voice("en"));
    }

    #[test]
    fn the_pack_folder_of_an_unshipped_language_is_the_fallbacks() {
        let root = Path::new("voice");

        assert_eq!(
            language_pack_folder(root, "xx"),
            language_pack_folder(root, FALLBACK_LANGUAGE)
        );
    }
}
