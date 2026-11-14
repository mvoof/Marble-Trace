//! iRacing's `.ibt` telemetry files, read into a [`SessionFile`] for the
//! statistics. kerb reads only the live shared memory, so the file layout is
//! read here: the irsdk header, the disk sub-header with the UTC start, the
//! variable headers, the session YAML as of the file's opening, then one row
//! per tick.
//!
//! Only the player's car is in a file. Rows are streamed, never loaded whole:
//! a long race is half a gigabyte.

mod samples;
mod yaml;

use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

use mt_model::app::stats::SessionFile;

use samples::{Channels, RunTracker};
use yaml::{decode_yaml, FileYaml};

const HEADER_LEN: usize = 112;
const DISK_HEADER_LEN: usize = 32;
const VAR_HEADER_LEN: usize = 144;
const VAR_NAME_OFFSET: usize = 16;
const VAR_NAME_LEN: usize = 32;
/// More than any sim build has written; a larger count is a broken header.
const MAX_VARS: usize = 4096;
/// Rows go through a reader this large, so a 60 Hz file is not one syscall a row.
const READ_BUFFER: usize = 1 << 20;

/// The fixed part of the file: where everything else is.
struct Header {
    tick_rate: i32,
    session_info_len: usize,
    session_info_offset: u64,
    num_vars: usize,
    var_header_offset: u64,
    buf_len: usize,
    rows_offset: u64,
    started_at: i64,
    start_time: f64,
    end_time: f64,
    record_count: u64,
}

/// One variable: its name, type and place in a row.
pub(crate) struct VarHeader {
    pub name: String,
    pub var_type: i32,
    pub offset: usize,
}

/// Reads one `.ibt` file. An error names what was wrong; the caller marks the
/// file broken.
pub fn read_session_file(path: &Path) -> Result<SessionFile, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let length = file.metadata().map_err(|error| error.to_string())?.len();

    read_from(BufReader::with_capacity(READ_BUFFER, file), length)
}

fn read_from<R: Read + Seek>(mut reader: R, length: u64) -> Result<SessionFile, String> {
    let mut fixed = [0_u8; HEADER_LEN + DISK_HEADER_LEN];
    reader
        .read_exact(&mut fixed)
        .map_err(|_| "shorter than its header".to_string())?;
    let header = parse_header(&fixed, length)?;

    reader
        .seek(SeekFrom::Start(header.var_header_offset))
        .map_err(|error| error.to_string())?;
    let mut var_bytes = vec![0_u8; header.num_vars * VAR_HEADER_LEN];
    reader
        .read_exact(&mut var_bytes)
        .map_err(|_| "variable headers cut short".to_string())?;
    let vars = parse_var_headers(&var_bytes, header.buf_len);

    reader
        .seek(SeekFrom::Start(header.session_info_offset))
        .map_err(|error| error.to_string())?;
    let mut yaml_bytes = vec![0_u8; header.session_info_len];
    reader
        .read_exact(&mut yaml_bytes)
        .map_err(|_| "session info cut short".to_string())?;
    let file_yaml = FileYaml::parse(&decode_yaml(&yaml_bytes))?;

    let channels = Channels::find(&vars)?;
    let mut tracker = RunTracker::default();
    let rows_available = length.saturating_sub(header.rows_offset) / header.buf_len as u64;
    let rows = header.record_count.min(rows_available);

    reader
        .seek(SeekFrom::Start(header.rows_offset))
        .map_err(|error| error.to_string())?;
    let mut row = vec![0_u8; header.buf_len];

    for _ in 0..rows {
        reader
            .read_exact(&mut row)
            .map_err(|_| "rows cut short".to_string())?;
        tracker.add_row(&channels.read(&row));
    }

    let duration = (header.end_time - header.start_time).max(0.0);

    Ok(file_yaml.into_session_file(
        header.started_at,
        header.started_at + duration as i64,
        tracker.finish(f64::from(header.tick_rate)),
    ))
}

fn parse_header(bytes: &[u8], length: u64) -> Result<Header, String> {
    let int = |at: usize| read_i32(bytes, at);
    let size = |at: usize, what: &str| {
        usize::try_from(int(at)).map_err(|_| format!("negative {what} in the header"))
    };
    let tick_rate = int(8);
    let buf_len = size(36, "row length")?;
    let num_vars = size(24, "variable count")?;
    // The first of the variable buffers: a file has one.
    let rows_offset = size(52, "row offset")? as u64;
    let header = Header {
        tick_rate,
        session_info_len: size(16, "session info length")?,
        session_info_offset: size(20, "session info offset")? as u64,
        num_vars,
        var_header_offset: size(28, "variable header offset")? as u64,
        buf_len,
        rows_offset,
        started_at: read_i64(bytes, HEADER_LEN),
        start_time: read_f64(bytes, HEADER_LEN + 8),
        end_time: read_f64(bytes, HEADER_LEN + 16),
        record_count: u64::try_from(read_i32(bytes, HEADER_LEN + 28)).unwrap_or_default(),
    };

    if tick_rate <= 0 || buf_len == 0 || num_vars == 0 || num_vars > MAX_VARS {
        return Err("not an iRacing telemetry file".into());
    }

    if header.session_info_offset + header.session_info_len as u64 > length
        || header.var_header_offset + (num_vars * VAR_HEADER_LEN) as u64 > length
        || rows_offset > length
    {
        return Err("header points past the end of the file".into());
    }

    Ok(header)
}

/// Variables whose value would not fit in a row are dropped.
fn parse_var_headers(bytes: &[u8], buf_len: usize) -> Vec<VarHeader> {
    bytes
        .as_chunks::<VAR_HEADER_LEN>()
        .0
        .iter()
        .filter_map(|chunk| {
            let offset = usize::try_from(read_i32(chunk, 4)).ok()?;
            let name_bytes = &chunk[VAR_NAME_OFFSET..VAR_NAME_OFFSET + VAR_NAME_LEN];
            let name_len = name_bytes
                .iter()
                .position(|&byte| byte == 0)
                .unwrap_or(VAR_NAME_LEN);

            (offset < buf_len).then(|| VarHeader {
                name: String::from_utf8_lossy(&name_bytes[..name_len]).into_owned(),
                var_type: read_i32(chunk, 0),
                offset,
            })
        })
        .collect()
}

pub(crate) fn read_i32(bytes: &[u8], at: usize) -> i32 {
    bytes
        .get(at..at + 4)
        .and_then(|slice| slice.try_into().ok())
        .map(i32::from_le_bytes)
        .unwrap_or_default()
}

fn read_i64(bytes: &[u8], at: usize) -> i64 {
    bytes
        .get(at..at + 8)
        .and_then(|slice| slice.try_into().ok())
        .map(i64::from_le_bytes)
        .unwrap_or_default()
}

pub(crate) fn read_f64(bytes: &[u8], at: usize) -> f64 {
    bytes
        .get(at..at + 8)
        .and_then(|slice| slice.try_into().ok())
        .map(f64::from_le_bytes)
        .unwrap_or_default()
}

pub(crate) fn read_f32(bytes: &[u8], at: usize) -> f32 {
    bytes
        .get(at..at + 4)
        .and_then(|slice| slice.try_into().ok())
        .map(f32::from_le_bytes)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests;
