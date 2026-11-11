//! Which language and voice the crew runs with, and releasing its engines
//! while their files are replaced.

use std::path::PathBuf;

use crate::assets::catalog::{catalog, ComponentKind};
use crate::crew::{Crew, CrewConfig};
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
}
