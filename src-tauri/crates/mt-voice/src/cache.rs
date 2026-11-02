//! Where each variant's sound stands, and synthesising the ones that are
//! missing ahead of time — so a race never waits on Piper for a fixed line.
//!
//! A synthesised line is cached by the hash of what makes its sound
//! (`voice_out::cache_path`), so "generate changed" is simply "generate what
//! has no file": an edited text, another voice or speed is a new name.

use std::collections::BTreeSet;

use crate::pack::{CompiledVariant, LanguagePack};
use crate::piper::{Piper, PiperSetup};
use crate::voice_out::{cache_path, OutputConfig};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VariantStatus {
    /// Synthesised and cached.
    Generated,
    /// Synthesised text with no file yet — new, edited, or another voice.
    Missing,
    /// Has values to fill in: synthesised when spoken, never cached ahead.
    Dynamic,
}

/// Generated once every way the variant is put has its file.
pub fn variant_status(variant: &CompiledVariant, config: &OutputConfig) -> VariantStatus {
    if variant.dynamic {
        VariantStatus::Dynamic
    } else if variant
        .sayings
        .iter()
        .all(|saying| cache_path(config, &saying.text).is_file())
    {
        VariantStatus::Generated
    } else {
        VariantStatus::Missing
    }
}

/// Every fixed line the pack synthesises that has no file yet.
pub fn missing_lines(pack: &LanguagePack, config: &OutputConfig) -> Vec<String> {
    let texts: BTreeSet<String> = pack
        .phrases
        .values()
        .flatten()
        .filter(|variant| !variant.dynamic)
        .flat_map(|variant| &variant.sayings)
        .filter(|saying| !cache_path(config, &saying.text).is_file())
        .map(|saying| saying.text.clone())
        .collect();

    texts.into_iter().collect()
}

/// Synthesises the lines into the cache with a Piper of its own, reporting
/// each as it goes. Stops at the first line Piper fails: the process is gone.
pub fn generate(
    lines: &[String],
    config: &OutputConfig,
    mut on_line: impl FnMut(&str, Result<(), String>),
) -> Result<(), String> {
    let (Some(executable), Some(model)) = (&config.piper, &config.voice_model) else {
        return Err("no voice engine or voice installed".into());
    };
    let mut piper = Piper::spawn(PiperSetup {
        root: config.root.clone(),
        executable: executable.clone(),
        model: model.clone(),
        length_scale: config.length_scale,
    })
    .map_err(|error| format!("piper: {error}"))?;

    for line in lines {
        let result = piper
            .synthesize(line, &cache_path(config, line))
            .map_err(|error| format!("piper: {error}"));
        let failed = result.is_err();

        on_line(line, result);

        if failed {
            return Err("piper stopped".into());
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pack::load;
    use std::fs;
    use std::path::PathBuf;

    fn config(root: &std::path::Path) -> OutputConfig {
        OutputConfig {
            root: root.to_path_buf(),
            piper: None,
            voice_id: "test-voice".into(),
            voice_model: None,
            device: None,
            volume: 1.0,
            length_scale: 1.0,
        }
    }

    fn scratch(name: &str) -> PathBuf {
        let folder =
            std::env::temp_dir().join(format!("mt-voice-cache-{name}-{}", std::process::id()));

        let _ = fs::remove_dir_all(&folder);
        fs::create_dir_all(&folder).unwrap();
        folder
    }

    #[test]
    fn a_cached_line_is_generated_and_an_edited_one_is_missing_again() {
        let root = scratch("status");
        let config = config(&root);
        let pack = load("en", None);
        let variant = &pack.variants("engineer.notInCar")[0];

        assert_eq!(variant_status(variant, &config), VariantStatus::Missing);
        assert!(missing_lines(&pack, &config).contains(&variant.variant.text));

        let cached = cache_path(&config, &variant.variant.text);

        fs::create_dir_all(cached.parent().unwrap()).unwrap();
        fs::write(&cached, b"wav").unwrap();

        assert_eq!(variant_status(variant, &config), VariantStatus::Generated);
        assert!(!missing_lines(&pack, &config).contains(&variant.variant.text));
        assert_eq!(
            variant_status(&pack.variants("engineer.ack.fuel")[0], &config),
            VariantStatus::Dynamic
        );

        let _ = fs::remove_dir_all(root);
    }

    /// Synthesises every fixed line of the Russian pack with the real engine
    /// installed by the voice-out live test.
    #[test]
    #[ignore = "needs the engine and the Dmitri voice installed by speaks_through_the_real_engine"]
    fn generates_the_packs_fixed_lines_through_the_real_engine() {
        use crate::assets::VoiceAssets;
        use std::time::Instant;

        let root = std::env::temp_dir().join("mt-voice-live");
        let assets = VoiceAssets::new(&root);
        let config = OutputConfig {
            piper: assets.piper_executable(),
            voice_id: "piper-voice-ru-dmitri".into(),
            voice_model: assets.voice_model("piper-voice-ru-dmitri"),
            ..config(&root)
        };
        let pack = load("ru", None);
        let _ = fs::remove_dir_all(root.join("cache").join("piper-voice-ru-dmitri"));
        let lines = missing_lines(&pack, &config);
        let started = Instant::now();
        let mut done = 0;

        generate(&lines, &config, |_, result| {
            result.unwrap();
            done += 1;
        })
        .unwrap();

        println!("{done} lines in {:?}", started.elapsed());
        assert_eq!(done, lines.len());
        assert!(missing_lines(&pack, &config).is_empty());
    }
}
