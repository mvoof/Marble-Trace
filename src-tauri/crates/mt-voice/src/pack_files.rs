//! A user pack as the archive it is shared as: a zip of `phrases.json` and
//! `commands.json`. The crew's voice is always synthesised, so a pack carries
//! text alone.

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use mt_model::app::voice::PackFileError;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use serde_json::Value;

use crate::assets::unpack::unpack_zip_within;
use crate::pack::{unreadable_file, COMMANDS_FILE, PHRASES_FILE};

const IMPORT_STAGING_SUFFIX: &str = ".importing";
/// Where the pack being replaced waits until the imported one is in place.
const IMPORT_PREVIOUS_SUFFIX: &str = ".previous";
/// A pack is two JSON files of text; anything near this is not one.
const PACK_ARCHIVE_MAX_BYTES: u64 = 16 * 1024 * 1024;

fn failed(error: impl ToString) -> PackFileError {
    PackFileError::Failed {
        detail: error.to_string(),
    }
}

/// The pack folder as one zip to hand to someone else.
pub fn export_pack(pack_folder: &Path, archive: &Path) -> Result<(), PackFileError> {
    let files: Vec<_> = [PHRASES_FILE, COMMANDS_FILE]
        .into_iter()
        .map(|name| (name, pack_folder.join(name)))
        .filter(|(_, path)| path.is_file())
        .collect();

    if files.is_empty() {
        return Err(PackFileError::NoPack);
    }

    let mut zip = ZipWriter::new(File::create(archive).map_err(failed)?);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    for (name, path) in files {
        zip.start_file(name, options).map_err(failed)?;
        zip.write_all(&fs::read(path).map_err(failed)?)
            .map_err(failed)?;
    }

    zip.finish().map_err(failed)?;

    Ok(())
}

/// Replaces the pack folder with an archive's contents — only once the
/// archive has unpacked whole and holds a pack the loader reads. Someone
/// else's questions that carry out steps (pit orders, chat macros) come in
/// switched off; their names are returned for the driver to look over.
pub fn import_pack(archive: &Path, pack_folder: &Path) -> Result<Vec<String>, PackFileError> {
    ZipArchive::new(File::open(archive).map_err(failed)?).map_err(|error| {
        PackFileError::NotAnArchive {
            detail: error.to_string(),
        }
    })?;

    let staging = PathBuf::from(format!("{}{IMPORT_STAGING_SUFFIX}", pack_folder.display()));
    let previous = PathBuf::from(format!("{}{IMPORT_PREVIOUS_SUFFIX}", pack_folder.display()));
    let _ = fs::remove_dir_all(&staging);
    let result = (|| {
        unpack_zip_within(archive, &staging, PACK_ARCHIVE_MAX_BYTES).map_err(failed)?;

        if !staging.join(PHRASES_FILE).is_file() && !staging.join(COMMANDS_FILE).is_file() {
            return Err(PackFileError::NoPack);
        }

        if let Some(issue) = unreadable_file(&staging) {
            return Err(PackFileError::BrokenFile {
                file: issue.location,
                mistake: issue.mistake,
            });
        }

        let switched_off =
            switch_off_questions_with_steps(&staging.join(COMMANDS_FILE)).map_err(failed)?;

        if let Some(parent) = pack_folder.parent() {
            fs::create_dir_all(parent).map_err(failed)?;
        }

        swap_in(&staging, pack_folder, &previous).map_err(failed)?;

        Ok(switched_off)
    })();

    if result.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }

    result
}

/// Puts the staged pack in the folder's place. The pack there is moved aside
/// first and put back when the staged one cannot take its place, so a failed
/// rename never leaves the driver with no pack.
fn swap_in(staging: &Path, pack_folder: &Path, previous: &Path) -> io::Result<()> {
    let _ = fs::remove_dir_all(previous);
    let had_pack = match fs::rename(pack_folder, previous) {
        Ok(()) => true,
        Err(error) if error.kind() == io::ErrorKind::NotFound => false,
        Err(error) => return Err(error),
    };

    if let Err(error) = fs::rename(staging, pack_folder) {
        if had_pack {
            let _ = fs::rename(previous, pack_folder);
        }

        return Err(error);
    }

    if had_pack {
        let _ = fs::remove_dir_all(previous);
    }

    Ok(())
}

/// Sets `enabled: false` on every question in `commands.json` that has steps
/// and returns their names. A file that does not parse is left as it is: the
/// pack loader refuses it whole, so none of its steps can run.
fn switch_off_questions_with_steps(commands: &Path) -> io::Result<Vec<String>> {
    let Ok(text) = fs::read_to_string(commands) else {
        return Ok(Vec::new());
    };
    let Ok(mut file) = serde_json::from_str::<Value>(&text) else {
        return Ok(Vec::new());
    };
    let Some(questions) = file
        .pointer_mut("/custom/questions")
        .and_then(Value::as_array_mut)
    else {
        return Ok(Vec::new());
    };
    let mut switched_off = Vec::new();

    for question in questions.iter_mut().filter_map(Value::as_object_mut) {
        let has_steps = question
            .get("steps")
            .and_then(Value::as_array)
            .is_some_and(|steps| !steps.is_empty());
        let enabled = question.get("enabled").and_then(Value::as_bool) != Some(false);

        if !has_steps || !enabled {
            continue;
        }

        question.insert("enabled".to_string(), Value::Bool(false));

        let name = question
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let id = question
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default();

        switched_off.push(if name.is_empty() { id } else { name }.to_string());
    }

    if !switched_off.is_empty() {
        let text = serde_json::to_string_pretty(&file).map_err(io::Error::other)?;

        fs::write(commands, text + "\n")?;
    }

    Ok(switched_off)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let folder =
            std::env::temp_dir().join(format!("mt-voice-packfiles-{name}-{}", std::process::id()));

        let _ = fs::remove_dir_all(&folder);
        fs::create_dir_all(&folder).unwrap();
        folder
    }

    #[test]
    fn a_pack_survives_export_and_import() {
        let root = scratch("roundtrip");
        let source = root.join("ru");
        let archive = root.join("ru.zip");
        let target = root.join("packs/ru");

        fs::create_dir_all(&source).unwrap();
        fs::write(
            source.join(PHRASES_FILE),
            r#"{ "format": 1, "phrases": {} }"#,
        )
        .unwrap();
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join("stale.txt"), "old").unwrap();

        export_pack(&source, &archive).unwrap();
        import_pack(&archive, &target).unwrap();

        assert!(target.join(PHRASES_FILE).is_file());
        assert!(!target.join("stale.txt").exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn refuses_an_archive_without_a_pack_and_keeps_the_old_one() {
        let root = scratch("notapack");
        let archive = root.join("photos.zip");
        let target = root.join("packs/en");
        let mut zip = ZipWriter::new(File::create(&archive).unwrap());

        zip.start_file("cat.jpg", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"jpg").unwrap();
        zip.finish().unwrap();
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join(PHRASES_FILE), "{}").unwrap();

        assert_eq!(import_pack(&archive, &target), Err(PackFileError::NoPack));
        assert!(target.join(PHRASES_FILE).is_file());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn refuses_a_file_that_is_not_a_zip() {
        let root = scratch("notazip");
        let archive = root.join("pack.zip");

        fs::write(&archive, "plain text").unwrap();

        let result = import_pack(&archive, &root.join("packs/en"));

        assert!(matches!(result, Err(PackFileError::NotAnArchive { .. })));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn refuses_a_broken_pack_file_and_keeps_the_old_pack() {
        let root = scratch("broken");
        let archive = root.join("broken.zip");
        let target = root.join("packs/en");
        let mut zip = ZipWriter::new(File::create(&archive).unwrap());

        zip.start_file(PHRASES_FILE, SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"{ not json").unwrap();
        zip.finish().unwrap();
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join(PHRASES_FILE), "old").unwrap();

        let result = import_pack(&archive, &target);

        assert!(matches!(
            result,
            Err(PackFileError::BrokenFile { ref file, .. }) if file == PHRASES_FILE
        ));
        assert_eq!(
            fs::read_to_string(target.join(PHRASES_FILE)).unwrap(),
            "old"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn export_without_a_pack_says_so() {
        let root = scratch("exportempty");

        assert_eq!(
            export_pack(&root.join("en"), &root.join("en.zip")),
            Err(PackFileError::NoPack)
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn imports_someone_elses_questions_with_steps_switched_off() {
        let root = scratch("steps");
        let source = root.join("en");
        let archive = root.join("en.zip");
        let target = root.join("packs/en");
        let commands = r#"{
          "format": 1,
          "custom": { "questions": [
            { "id": "box", "name": "Box now", "steps": [{ "action": "chat", "value": "/box" }] },
            { "id": "gap", "name": "", "replies": ["{gap}"] },
            { "id": "fuel", "steps": [{ "action": "chat", "value": "/fuel" }] }
          ] }
        }"#;

        fs::create_dir_all(&source).unwrap();
        fs::write(source.join(COMMANDS_FILE), commands).unwrap();
        export_pack(&source, &archive).unwrap();

        let switched_off = import_pack(&archive, &target).unwrap();
        let imported: Value =
            serde_json::from_str(&fs::read_to_string(target.join(COMMANDS_FILE)).unwrap()).unwrap();
        let enabled = |index: usize| {
            imported["custom"]["questions"][index]
                .get("enabled")
                .and_then(Value::as_bool)
        };

        assert_eq!(switched_off, vec!["Box now", "fuel"]);
        assert_eq!(enabled(0), Some(false));
        assert_eq!(enabled(1), None);
        assert_eq!(enabled(2), Some(false));

        let _ = fs::remove_dir_all(root);
    }
}
