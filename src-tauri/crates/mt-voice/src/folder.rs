//! Moving the voice folder — engines, voices, models, packs and the cache —
//! to where the user wants it, usually a drive with more room.

use std::fs;
use std::io;
use std::path::Path;

/// Moves everything in `from` into `to`. `to` must be empty or absent, so
/// nothing of the user's is overwritten; inside another folder it may not
/// be, nor `from` inside it. A rename is tried first — instant on one drive —
/// then a copy, after which `from` is removed.
pub fn move_folder(from: &Path, to: &Path) -> io::Result<()> {
    if to.starts_with(from) || from.starts_with(to) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "the new folder cannot be inside the old one, or hold it",
        ));
    }

    if to.exists() && fs::read_dir(to)?.next().is_some() {
        return Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "the new folder is not empty",
        ));
    }

    if !from.exists() {
        return fs::create_dir_all(to);
    }

    if to.exists() {
        fs::remove_dir(to)?;
    }

    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent)?;
    }

    if fs::rename(from, to).is_ok() {
        return Ok(());
    }

    // A half-made copy is removed, so a retry finds the new folder empty.
    if let Err(error) = copy_tree(from, to) {
        let _ = fs::remove_dir_all(to);

        return Err(error);
    }

    fs::remove_dir_all(from)
}

fn copy_tree(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;

    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());

        if entry.file_type()?.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn scratch(name: &str) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("mt-voice-folder-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);

        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn moves_everything_into_an_empty_folder() {
        let root = scratch("move");
        let from = root.join("voice");
        let to = root.join("elsewhere/voice");

        fs::create_dir_all(from.join("packs/ru")).unwrap();
        fs::write(from.join("packs/ru/phrases.json"), "{}").unwrap();
        fs::create_dir_all(&to).unwrap();

        move_folder(&from, &to).unwrap();

        assert!(!from.exists());
        assert_eq!(
            fs::read_to_string(to.join("packs/ru/phrases.json")).unwrap(),
            "{}"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn copies_the_tree_when_it_cannot_rename() {
        let root = scratch("copy");
        let from = root.join("voice");
        let to = root.join("copy");

        fs::create_dir_all(from.join("a/b")).unwrap();
        fs::write(from.join("a/b/model.onnx"), "weights").unwrap();

        copy_tree(&from, &to).unwrap();

        assert_eq!(
            fs::read_to_string(to.join("a/b/model.onnx")).unwrap(),
            "weights"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn refuses_a_folder_with_files_or_one_inside_the_other() {
        let root = scratch("refuse");
        let from = root.join("voice");
        let full = root.join("full");

        fs::create_dir_all(&from).unwrap();
        fs::create_dir_all(&full).unwrap();
        fs::write(full.join("keep.txt"), "mine").unwrap();

        assert!(move_folder(&from, &full).is_err());
        assert!(move_folder(&from, &from.join("inner")).is_err());
        assert!(move_folder(&from, &root).is_err());
        assert_eq!(fs::read_to_string(full.join("keep.txt")).unwrap(), "mine");
        assert!(from.exists());

        let _ = fs::remove_dir_all(root);
    }
}
