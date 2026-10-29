//! Zip extraction for the downloaded archives. Every entry's path is checked
//! before it is written: an archive is data from the network, and one entry
//! named `../../x.dll` must not land outside the component's folder.

use std::fs::{self, File};
use std::io;
use std::path::{Component as PathPart, Path, PathBuf};

use zip::ZipArchive;

/// Extracts `archive` into `target`. When every entry sits inside one folder —
/// how the engines and models are packed — that folder is dropped, so a
/// component's files are found at the same place whatever its version.
pub fn unpack_zip(archive: &Path, target: &Path) -> io::Result<()> {
    let mut zip = ZipArchive::new(File::open(archive)?).map_err(io::Error::other)?;
    let mut names = Vec::with_capacity(zip.len());

    for index in 0..zip.len() {
        let entry = zip.by_index(index).map_err(io::Error::other)?;
        let Some(name) = entry.enclosed_name() else {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("unsafe path in archive: {}", entry.name()),
            ));
        };

        names.push((name, entry.is_dir()));
    }

    let shared_root = shared_root(&names);

    fs::create_dir_all(target)?;

    for (index, (name, _)) in names.iter().enumerate() {
        let relative = match &shared_root {
            Some(root) => name.strip_prefix(root).unwrap_or(name),
            None => name.as_path(),
        };

        if relative.as_os_str().is_empty() {
            continue;
        }

        let destination = target.join(relative);
        let mut entry = zip.by_index(index).map_err(io::Error::other)?;

        if entry.is_dir() {
            fs::create_dir_all(&destination)?;
            continue;
        }

        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)?;
        }

        io::copy(&mut entry, &mut File::create(&destination)?)?;
    }

    Ok(())
}

/// The one top-level folder every entry is inside, if there is one. A lone
/// `folder/` entry counts as inside it; a lone file does not.
fn shared_root(names: &[(PathBuf, bool)]) -> Option<PathBuf> {
    let first = names.first()?.0.components().next()?;
    let PathPart::Normal(root) = first else {
        return None;
    };
    let all_inside = names.iter().all(|(name, is_dir)| {
        let mut parts = name.components();

        parts.next() == Some(first) && (parts.next().is_some() || *is_dir)
    });

    all_inside.then(|| PathBuf::from(root))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    fn scratch(name: &str) -> PathBuf {
        let folder =
            std::env::temp_dir().join(format!("mt-voice-unpack-{name}-{}", std::process::id()));

        let _ = fs::remove_dir_all(&folder);
        fs::create_dir_all(&folder).unwrap();
        folder
    }

    fn write_zip(path: &Path, entries: &[(&str, Option<&str>)]) {
        let mut zip = ZipWriter::new(File::create(path).unwrap());

        for (name, contents) in entries {
            match contents {
                Some(text) => {
                    zip.start_file(*name, SimpleFileOptions::default()).unwrap();
                    zip.write_all(text.as_bytes()).unwrap();
                }
                None => zip
                    .add_directory(*name, SimpleFileOptions::default())
                    .unwrap(),
            }
        }

        zip.finish().unwrap();
    }

    #[test]
    fn drops_the_folder_every_entry_sits_in() {
        let folder = scratch("root");
        let archive = folder.join("engine.zip");

        write_zip(
            &archive,
            &[
                ("piper/", None),
                ("piper/piper.exe", Some("exe")),
                ("piper/espeak-ng-data/ru_dict", Some("dict")),
            ],
        );
        unpack_zip(&archive, &folder.join("out")).unwrap();

        assert_eq!(
            fs::read_to_string(folder.join("out/piper.exe")).unwrap(),
            "exe"
        );
        assert!(folder.join("out/espeak-ng-data/ru_dict").is_file());

        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn keeps_the_layout_of_an_archive_with_several_top_entries() {
        let folder = scratch("flat");
        let archive = folder.join("flat.zip");

        write_zip(&archive, &[("a.txt", Some("a")), ("b/c.txt", Some("c"))]);
        unpack_zip(&archive, &folder.join("out")).unwrap();

        assert!(folder.join("out/a.txt").is_file());
        assert!(folder.join("out/b/c.txt").is_file());

        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn keeps_a_single_top_level_file() {
        let folder = scratch("single");
        let archive = folder.join("single.zip");

        write_zip(&archive, &[("voice.onnx", Some("model"))]);
        unpack_zip(&archive, &folder.join("out")).unwrap();

        assert!(folder.join("out/voice.onnx").is_file());

        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn refuses_an_entry_that_climbs_out_of_the_target() {
        let folder = scratch("slip");
        let archive = folder.join("slip.zip");

        write_zip(&archive, &[("../escaped.txt", Some("x"))]);

        let result = unpack_zip(&archive, &folder.join("out"));

        assert_eq!(result.unwrap_err().kind(), io::ErrorKind::InvalidData);
        assert!(!folder.join("escaped.txt").exists());

        let _ = fs::remove_dir_all(folder);
    }
}
