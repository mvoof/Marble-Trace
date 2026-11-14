//! Which session files on disk are still to be read.

use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

use crate::db::FileStamp;

const SESSION_FILE_EXTENSION: &str = "ibt";

/// Every session file directly in `folder`, oldest name first: the sim names
/// them by date, so a pass reads in the order they were driven.
pub fn list_session_files(folder: &Path) -> Result<Vec<FileStamp>, String> {
    let entries = fs::read_dir(folder).map_err(|error| error.to_string())?;
    let mut stamps: Vec<FileStamp> = entries
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .path()
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case(SESSION_FILE_EXTENSION))
        })
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;

            if !metadata.is_file() {
                return None;
            }

            let modified_at = metadata
                .modified()
                .ok()?
                .duration_since(UNIX_EPOCH)
                .ok()?
                .as_secs();

            Some(FileStamp {
                path: entry.path().to_string_lossy().into_owned(),
                size: i64::try_from(metadata.len()).ok()?,
                modified_at: i64::try_from(modified_at).ok()?,
            })
        })
        .collect();

    stamps.sort_by(|left, right| left.path.cmp(&right.path));

    Ok(stamps)
}

/// The files never seen, or changed since they were: a broken file is not
/// retried until it changes.
pub fn pending_files(
    on_disk: Vec<FileStamp>,
    known: &HashMap<String, FileStamp>,
) -> Vec<FileStamp> {
    on_disk
        .into_iter()
        .filter(|stamp| known.get(&stamp.path) != Some(stamp))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stamp(path: &str, size: i64) -> FileStamp {
        FileStamp {
            path: path.into(),
            size,
            modified_at: 10,
        }
    }

    #[test]
    fn only_new_and_changed_files_are_pending() {
        let known = HashMap::from([
            ("same.ibt".to_string(), stamp("same.ibt", 5)),
            ("grown.ibt".to_string(), stamp("grown.ibt", 5)),
            ("gone.ibt".to_string(), stamp("gone.ibt", 5)),
        ]);
        let on_disk = vec![
            stamp("grown.ibt", 9),
            stamp("new.ibt", 1),
            stamp("same.ibt", 5),
        ];

        let pending: Vec<String> = pending_files(on_disk, &known)
            .into_iter()
            .map(|stamp| stamp.path)
            .collect();

        assert_eq!(pending, vec!["grown.ibt", "new.ibt"]);
    }
}
