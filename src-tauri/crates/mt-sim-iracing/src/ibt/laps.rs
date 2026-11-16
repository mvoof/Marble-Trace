//! The laps of a file for the analysis: every number channel of the laps
//! asked for, resampled onto one grid of a point a metre from the line, so
//! laps line up by where on the track they were.
//!
//! A lap is the rows its `Lap` counter names in its run. `LapDist` steps back
//! now and then (a spin, a reset); a row that does not move forward is left
//! out of the resampling. Before the lap's first row and after its last the
//! values hold.

use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

use mt_model::app::lap_telemetry::{
    FileTelemetry, LapChannel, LapKey, LapTelemetry, ELAPSED_CHANNEL,
};

use super::samples::{is_stepped, number_at, value_size};
use super::yaml::parse_track_length;
use super::{open_file, VarHeader, READ_BUFFER};

const LAP_CHANNEL: &str = "Lap";
const SESSION_NUM_CHANNEL: &str = "SessionNum";
const LAP_DIST_CHANNEL: &str = "LapDist";
const SESSION_TIME_CHANNEL: &str = "SessionTime";
const SPEED_CHANNEL: &str = "Speed";
const ELAPSED_UNIT: &str = "s";
const ELAPSED_DESCRIPTION: &str = "Time since the line";
/// The grid's step, metres.
const GRID_STEP_M: f64 = 1.0;
/// Longer than any track the sim has; a longer one is a broken header, and
/// would size the grid.
const MAX_TRACK_LENGTH_M: f64 = 40_000.0;
/// An hour at 60 Hz: more rows than any lap holds.
const MAX_LAP_ROWS: usize = 216_000;
/// Below this a car is not moving: the time back to the line is not guessed.
const MIN_SPEED_M_S: f64 = 1.0;

/// One row of a lap: where it was, and the value of each kept channel.
struct LapRow {
    distance_m: f64,
    session_time: f64,
    speed_m_s: f64,
    values: Vec<f64>,
}

/// The channels `stats.db` keeps of every timed lap: what the analysis draws
/// by default and the ones a driver adds most. The time since the line is
/// always added. A channel a car's file lacks is left out, not zero-filled.
/// The sim writes no brake temperatures, only line pressures.
pub const STORED_LAP_CHANNELS: &[&str] = &[
    "Speed",
    "Throttle",
    "Brake",
    "Clutch",
    "Gear",
    "RPM",
    "SteeringWheelAngle",
    "LatAccel",
    "LongAccel",
    "Lat",
    "Lon",
    "YawNorth",
    "WindVel",
    "WindDir",
    "LFtempL",
    "LFtempM",
    "LFtempR",
    "RFtempL",
    "RFtempM",
    "RFtempR",
    "LRtempL",
    "LRtempM",
    "LRtempR",
    "RRtempL",
    "RRtempM",
    "RRtempR",
    "LFtempCL",
    "LFtempCM",
    "LFtempCR",
    "RFtempCL",
    "RFtempCM",
    "RFtempCR",
    "LRtempCL",
    "LRtempCM",
    "LRtempCR",
    "RRtempCL",
    "RRtempCM",
    "RRtempCR",
    "LFpressure",
    "RFpressure",
    "LRpressure",
    "RRpressure",
];

/// Which of a file's channels a read keeps.
#[derive(Clone, Copy)]
enum ChannelSet {
    All,
    Stored,
}

impl ChannelSet {
    fn keeps(self, name: &str) -> bool {
        match self {
            Self::All => true,
            Self::Stored => STORED_LAP_CHANNELS.contains(&name),
        }
    }
}

/// Reads `laps` of the file at `path`, every channel. The grid runs from the
/// line to the track's length as the file's session info gives it.
pub fn read_lap_telemetry(path: &Path, laps: &[LapKey]) -> Result<FileTelemetry, String> {
    read_laps(path, laps, ChannelSet::All)
}

/// Reads `laps` of the file at `path`, the [`STORED_LAP_CHANNELS`] it holds.
pub fn read_stored_lap_telemetry(path: &Path, laps: &[LapKey]) -> Result<FileTelemetry, String> {
    read_laps(path, laps, ChannelSet::Stored)
}

fn read_laps(path: &Path, laps: &[LapKey], set: ChannelSet) -> Result<FileTelemetry, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let length = file.metadata().map_err(|error| error.to_string())?.len();
    let mut reader = BufReader::with_capacity(READ_BUFFER, file);
    let opened = open_file(&mut reader, length)?;
    let track_length_m = track_length(&opened.yaml)
        .filter(|length| *length <= MAX_TRACK_LENGTH_M)
        .ok_or_else(|| "no usable track length in the session info".to_string())?;
    let points = (track_length_m / GRID_STEP_M).round() as usize + 1;
    let kept = kept_vars(&opened.vars, opened.header.buf_len, set);
    let find = |name: &str| {
        opened
            .vars
            .iter()
            .find(|var| var.name == name)
            .ok_or_else(|| format!("no {name} channel in the file"))
    };
    let lap_var = find(LAP_CHANNEL)?;
    let session_var = find(SESSION_NUM_CHANNEL)?;
    let distance_var = find(LAP_DIST_CHANNEL)?;
    let time_var = find(SESSION_TIME_CHANNEL)?;
    let speed_var = find(SPEED_CHANNEL).ok();
    let mut rows_by_lap: HashMap<LapKey, Vec<LapRow>> =
        laps.iter().map(|lap| (*lap, Vec::new())).collect();
    let mut row = vec![0_u8; opened.header.buf_len];

    for _ in 0..opened.row_count(length) {
        reader
            .read_exact(&mut row)
            .map_err(|_| "rows cut short".to_string())?;

        let key = LapKey {
            session_num: number_at(&row, session_var.var_type, session_var.offset) as i32,
            lap_num: number_at(&row, lap_var.var_type, lap_var.offset) as i32,
        };
        let Some(lap_rows) = rows_by_lap
            .get_mut(&key)
            .filter(|rows| rows.len() < MAX_LAP_ROWS)
        else {
            continue;
        };

        lap_rows.push(LapRow {
            distance_m: number_at(&row, distance_var.var_type, distance_var.offset),
            session_time: number_at(&row, time_var.var_type, time_var.offset),
            speed_m_s: speed_var
                .map(|var| number_at(&row, var.var_type, var.offset))
                .unwrap_or_default(),
            values: kept
                .iter()
                .map(|var| number_at(&row, var.var_type, var.offset))
                .collect(),
        });
    }

    let stepped: Vec<bool> = kept.iter().map(|var| is_stepped(var.var_type)).collect();
    let mut channels: Vec<LapChannel> = kept
        .iter()
        .map(|var| LapChannel {
            name: var.name.clone(),
            unit: var.unit.clone(),
            description: var.description.clone(),
        })
        .collect();
    channels.push(LapChannel {
        name: ELAPSED_CHANNEL.into(),
        unit: ELAPSED_UNIT.into(),
        description: ELAPSED_DESCRIPTION.into(),
    });

    let resampled = laps
        .iter()
        .filter_map(|lap| {
            let rows = rows_by_lap.remove(lap)?;

            (!rows.is_empty()).then(|| LapTelemetry {
                lap: *lap,
                values: resample_lap(&forward_rows(rows), &stepped, points),
            })
        })
        .collect();

    Ok(FileTelemetry {
        points,
        channels,
        laps: resampled,
    })
}

/// The single-value number channels whose value lies inside a row, each
/// place in the row once: a broken header cannot make a row read bigger
/// than it is.
fn kept_vars(vars: &[VarHeader], buf_len: usize, set: ChannelSet) -> Vec<&VarHeader> {
    let mut offsets = HashSet::new();

    vars.iter()
        .filter(|var| {
            let fits = value_size(var.var_type).is_some_and(|size| {
                var.offset
                    .checked_add(size)
                    .is_some_and(|end| end <= buf_len)
            });

            var.count == 1 && fits && set.keeps(&var.name) && offsets.insert(var.offset)
        })
        .collect()
}

fn track_length(yaml: &str) -> Option<f64> {
    yaml.lines()
        .find_map(|line| line.trim().strip_prefix("TrackLength:"))
        .and_then(|value| parse_track_length(value.trim()))
}

/// The rows that move forward along the lap, in order.
fn forward_rows(rows: Vec<LapRow>) -> Vec<LapRow> {
    let mut kept: Vec<LapRow> = Vec::with_capacity(rows.len());

    for row in rows {
        let moves_forward = kept
            .last()
            .is_none_or(|last| row.distance_m > last.distance_m);

        if moves_forward {
            kept.push(row);
        }
    }

    kept
}

/// Each channel on the grid, then the time since the line. `rows` is not
/// empty and moves forward.
fn resample_lap(rows: &[LapRow], stepped: &[bool], points: usize) -> Vec<Vec<f32>> {
    let first = &rows[0];
    // The first row is a little past the line: back to it at the speed then.
    let line_time = if first.speed_m_s >= MIN_SPEED_M_S {
        first.session_time - first.distance_m / first.speed_m_s
    } else {
        first.session_time
    };
    let mut values: Vec<Vec<f32>> = (0..stepped.len())
        .map(|_| Vec::with_capacity(points))
        .collect();
    let mut elapsed = Vec::with_capacity(points);
    let mut segment = 0;

    for point in 0..points {
        let distance_m = point as f64 * GRID_STEP_M;

        while segment + 1 < rows.len() && rows[segment + 1].distance_m <= distance_m {
            segment += 1;
        }

        let before = &rows[segment];
        let after = rows.get(segment + 1).unwrap_or(before);
        let fraction = if after.distance_m > before.distance_m {
            ((distance_m - before.distance_m) / (after.distance_m - before.distance_m))
                .clamp(0.0, 1.0)
        } else {
            0.0
        };

        for (channel, is_stepped) in stepped.iter().enumerate() {
            let value = if *is_stepped {
                before.values[channel]
            } else {
                lerp(before.values[channel], after.values[channel], fraction)
            };

            values[channel].push(value as f32);
        }

        let time = if distance_m < first.distance_m && first.distance_m > 0.0 {
            lerp(line_time, first.session_time, distance_m / first.distance_m)
        } else {
            lerp(before.session_time, after.session_time, fraction)
        };

        elapsed.push((time - line_time) as f32);
    }

    values.push(elapsed);

    values
}

fn lerp(from: f64, to: f64, fraction: f64) -> f64 {
    from + (to - from) * fraction
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(distance_m: f64, session_time: f64, value: f64, gear: f64) -> LapRow {
        LapRow {
            distance_m,
            session_time,
            speed_m_s: 10.0,
            values: vec![value, gear],
        }
    }

    #[test]
    fn a_float_is_interpolated_a_stepped_value_held() {
        let rows = vec![row(0.5, 10.05, 0.0, 2.0), row(2.5, 10.25, 20.0, 3.0)];

        let values = resample_lap(&rows, &[false, true], 4);

        assert_eq!(values[0], vec![0.0, 5.0, 15.0, 20.0]);
        assert_eq!(values[1], vec![2.0, 2.0, 2.0, 3.0]);
    }

    #[test]
    fn the_time_counts_from_the_line_before_the_first_row() {
        // 0.5 m past the line at 10 m/s: the line was 0.05 s earlier.
        let rows = vec![row(0.5, 10.05, 0.0, 2.0), row(2.5, 10.25, 20.0, 3.0)];

        let elapsed = &resample_lap(&rows, &[false, true], 4)[2];

        let rounded: Vec<f32> = elapsed
            .iter()
            .map(|time| (time * 1000.0).round() / 1000.0)
            .collect();
        assert_eq!(rounded, vec![0.0, 0.1, 0.2, 0.25]);
    }

    #[test]
    fn rows_that_step_back_at_the_seam_are_left_out() {
        // The last rows of the lap before wrapped to the next: dist goes back.
        let rows = vec![
            row(0.4, 1.0, 1.0, 1.0),
            row(2.0, 2.0, 2.0, 1.0),
            row(1.5, 2.1, 9.0, 1.0),
            row(3.0, 3.0, 3.0, 1.0),
        ];

        let kept: Vec<f64> = forward_rows(rows)
            .iter()
            .map(|row| row.distance_m)
            .collect();

        assert_eq!(kept, vec![0.4, 2.0, 3.0]);
    }

    #[test]
    fn past_the_last_row_the_values_hold() {
        let rows = vec![row(0.0, 0.0, 1.0, 1.0), row(1.0, 0.1, 2.0, 4.0)];

        let values = resample_lap(&rows, &[false, true], 4);

        assert_eq!(values[0], vec![1.0, 2.0, 2.0, 2.0]);
        assert_eq!(values[1], vec![1.0, 4.0, 4.0, 4.0]);
    }

    fn var(offset: usize, var_type: i32, count: usize) -> VarHeader {
        VarHeader {
            name: format!("v{offset}"),
            var_type,
            offset,
            count,
            unit: String::new(),
            description: String::new(),
        }
    }

    #[test]
    fn a_var_past_the_row_an_array_text_and_a_repeated_place_are_left_out() {
        const FLOAT: i32 = 4;
        const DOUBLE: i32 = 5;
        const TEXT: i32 = 0;
        let vars = vec![
            var(0, FLOAT, 1),
            var(0, FLOAT, 1),
            var(4, DOUBLE, 1),
            var(12, FLOAT, 6),
            var(16, TEXT, 1),
        ];

        let kept: Vec<usize> = kept_vars(&vars, 16, ChannelSet::All)
            .iter()
            .map(|var| var.offset)
            .collect();

        assert_eq!(kept, vec![0, 4]);
        assert!(kept_vars(&[var(12, DOUBLE, 1)], 16, ChannelSet::All).is_empty());
    }

    #[test]
    fn the_stored_set_keeps_its_channels_the_file_holds_and_no_other() {
        const FLOAT: i32 = 4;
        let named = |name: &str, offset| VarHeader {
            name: name.into(),
            ..var(offset, FLOAT, 1)
        };
        // A car without a clutch pedal: no `Clutch` in its file.
        let vars = vec![named("Speed", 0), named("OilTemp", 4), named("Brake", 8)];

        let kept: Vec<&str> = kept_vars(&vars, 12, ChannelSet::Stored)
            .iter()
            .map(|var| var.name.as_str())
            .collect();

        assert_eq!(kept, vec!["Speed", "Brake"]);
    }

    #[test]
    fn the_track_length_is_read_from_the_session_info() {
        let yaml = "WeekendInfo:\n TrackName: fuji\n TrackLength: 4.4837 km\n";

        assert_eq!(track_length(yaml), Some(4_483.7));
        assert_eq!(track_length("WeekendInfo:\n"), None);
    }
}
