//! A user pack as the archive it is shared as: a zip of `phrases.json` and
//! `commands.json`. The crew's voice is always synthesised, so a pack carries
//! text alone.

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::assets::unpack::unpack_zip;
use crate::pack::{COMMANDS_FILE, PHRASES_FILE};
const IMPORT_STAGING_SUFFIX: &str = ".importing";

/// The pack folder as one zip to hand to someone else.
pub fn export_pack(pack_folder: &Path, archive: &Path) -> io::Result<()> {
    let mut zip = ZipWriter::new(File::create(archive)?);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let mut files = Vec::new();

    for name in [PHRASES_FILE, COMMANDS_FILE] {
        let path = pack_folder.join(name);

        if path.is_file() {
            files.push((name.to_string(), path));
        }
    }

    if files.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "the pack folder holds no pack",
        ));
    }

    for (name, path) in files {
        zip.start_file(name, options).map_err(io::Error::other)?;
        zip.write_all(&fs::read(path)?)?;
    }

    zip.finish().map_err(io::Error::other)?;

    Ok(())
}

/// Replaces the pack folder with an archive's contents — only once the
/// archive has unpacked whole and holds a pack at all.
pub fn import_pack(archive: &Path, pack_folder: &Path) -> io::Result<()> {
    let staging = PathBuf::from(format!("{}{IMPORT_STAGING_SUFFIX}", pack_folder.display()));
    let _ = fs::remove_dir_all(&staging);
    let result = (|| {
        unpack_zip(archive, &staging)?;

        if !staging.join(PHRASES_FILE).is_file() && !staging.join(COMMANDS_FILE).is_file() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "the archive holds no phrases.json or commands.json",
            ));
        }

        match fs::remove_dir_all(pack_folder) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => return Err(error),
            _ => {}
        }

        if let Some(parent) = pack_folder.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::rename(&staging, pack_folder)
    })();

    if result.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }

    result
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

        assert!(import_pack(&archive, &target).is_err());
        assert!(target.join(PHRASES_FILE).is_file());

        let _ = fs::remove_dir_all(root);
    }
}
