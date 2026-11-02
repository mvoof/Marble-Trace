//! What can be downloaded: the engines, the voices and the recognition models,
//! each pinned to a URL and a sha256. The catalog ships inside the app — a
//! download is checked against the hash this build was made with, never one a
//! server hands out.

use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

const CATALOG_JSON: &str = include_str!("../../voice-catalog.json");

pub const PIPER_ENGINE: &str = "piper-engine";
pub const VOSK_ENGINE: &str = "vosk-engine";

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ComponentKind {
    TtsEngine,
    SttEngine,
    TtsVoice,
    SttModel,
}

/// How a downloaded file becomes the component's files.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum Unpack {
    /// Kept as it is, under its own name.
    #[default]
    None,
    /// Extracted; a single folder every entry sits in is dropped.
    Zip,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFile {
    pub name: String,
    pub url: String,
    /// Tried when `url` fails.
    #[serde(default)]
    pub mirror: Option<String>,
    pub sha256: String,
    pub size: u64,
    #[serde(default)]
    pub unpack: Unpack,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Component {
    pub id: String,
    pub kind: ComponentKind,
    /// `None` for an engine, which serves every language.
    #[serde(default)]
    pub language: Option<String>,
    pub title: String,
    pub license: String,
    pub license_url: String,
    /// Part of "download the recommended set" for its language.
    #[serde(default)]
    pub recommended: bool,
    /// A recording of the voice to listen to before downloading it.
    #[serde(default)]
    pub sample: Option<String>,
    pub files: Vec<RemoteFile>,
}

impl Component {
    pub fn size(&self) -> u64 {
        self.files.iter().map(|file| file.size).sum()
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub format: u32,
    pub components: Vec<Component>,
}

impl Catalog {
    pub fn component(&self, id: &str) -> Option<&Component> {
        self.components.iter().find(|component| component.id == id)
    }

    /// The engines and the language's recommended voice and model — what the
    /// empty Crew tab offers to download in one go.
    pub fn recommended_for(&self, language: &str) -> Vec<&Component> {
        self.components
            .iter()
            .filter(|component| {
                component.recommended
                    && component
                        .language
                        .as_deref()
                        .is_none_or(|own| own == language)
            })
            .collect()
    }
}

/// The catalog this build ships. It is pinned by a test, so a parse failure is
/// a broken build: logged, and nothing is offered for download.
pub fn catalog() -> &'static Catalog {
    static CATALOG: OnceLock<Catalog> = OnceLock::new();

    CATALOG.get_or_init(|| {
        serde_json::from_str(CATALOG_JSON).unwrap_or_else(|error| {
            tracing::error!(%error, "voice catalog does not parse");
            Catalog::default()
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pack::BUILT_IN_LANGUAGES;
    use std::collections::HashSet;

    #[test]
    fn the_shipped_catalog_parses_and_every_file_is_pinned() {
        let catalog: Catalog = serde_json::from_str(CATALOG_JSON).unwrap();
        let mut ids = HashSet::new();

        assert!(!catalog.components.is_empty());

        for component in &catalog.components {
            assert!(ids.insert(&component.id), "{} listed twice", component.id);
            assert!(!component.files.is_empty(), "{} has no files", component.id);

            for file in &component.files {
                assert_eq!(file.sha256.len(), 64, "{}", file.name);
                assert!(
                    file.sha256
                        .chars()
                        .all(|character| character.is_ascii_hexdigit()
                            && !character.is_ascii_uppercase()),
                    "{}",
                    file.name
                );
                assert!(file.url.starts_with("https://"), "{}", file.name);
                assert!(file.size > 0, "{}", file.name);
            }
        }
    }

    #[test]
    fn every_voice_can_be_heard_before_it_is_downloaded() {
        for component in &catalog().components {
            if component.kind == ComponentKind::TtsVoice {
                assert!(
                    component
                        .sample
                        .as_deref()
                        .is_some_and(|sample| sample.starts_with("https://")),
                    "{} has no sample",
                    component.id
                );
            }
        }
    }

    #[test]
    fn recommends_both_engines_and_one_voice_and_one_model_per_language() {
        for language in BUILT_IN_LANGUAGES {
            let kinds: Vec<ComponentKind> = catalog()
                .recommended_for(language)
                .iter()
                .map(|component| component.kind)
                .collect();

            for kind in [
                ComponentKind::TtsEngine,
                ComponentKind::SttEngine,
                ComponentKind::TtsVoice,
                ComponentKind::SttModel,
            ] {
                assert_eq!(
                    kinds.iter().filter(|own| **own == kind).count(),
                    1,
                    "{language}: {kind:?}"
                );
            }
        }
    }

    #[test]
    fn names_the_engines_the_runtime_looks_for() {
        assert_eq!(
            catalog().component(PIPER_ENGINE).map(|engine| engine.kind),
            Some(ComponentKind::TtsEngine)
        );
        assert_eq!(
            catalog().component(VOSK_ENGINE).map(|engine| engine.kind),
            Some(ComponentKind::SttEngine)
        );
    }
}
