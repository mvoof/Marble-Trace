//! A file's laps as `stats.db` keeps them, so the analysis outlives the
//! `.ibt`: which laps are kept, and each lap's values packed — `f32`
//! little-endian, channel after channel, deflate-compressed.

use std::io::{Read, Write};

use flate2::read::DeflateDecoder;
use flate2::write::DeflateEncoder;
use flate2::Compression;

use mt_model::app::car_setup::CarSetupView;
use mt_model::app::lap_telemetry::{FileTelemetry, LapChannel, LapKey};
use mt_model::app::stats::SessionFile;

const VALUE_BYTES: usize = 4;

/// One lap's channels on the distance grid, packed.
#[derive(Debug, Clone, PartialEq)]
pub struct StoredLap {
    pub lap: LapKey,
    /// Grid points of each channel.
    pub points: u32,
    pub channels: Vec<LapChannel>,
    /// `points` values per channel, in `channels` order, deflated.
    pub packed: Vec<u8>,
}

/// What a file read stores beside its runs and laps.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct FileAnalysis {
    pub laps: Vec<StoredLap>,
    pub setup: Option<CarSetupView>,
}

/// The laps worth keeping: timed, full from the line, off pit road.
pub fn stored_lap_keys(file: &SessionFile) -> Vec<LapKey> {
    file.runs
        .iter()
        .flat_map(|run| {
            run.laps
                .iter()
                .filter(|lap| lap.time_s.is_some() && !lap.partial && !lap.in_pit)
                .filter_map(move |lap| {
                    Some(LapKey {
                        session_num: i32::try_from(run.session_num).ok()?,
                        lap_num: i32::try_from(lap.lap_num).ok()?,
                    })
                })
        })
        .collect()
}

/// Packs every lap a file read held.
pub fn pack_file(telemetry: &FileTelemetry) -> Result<Vec<StoredLap>, String> {
    let points = u32::try_from(telemetry.points).map_err(|error| error.to_string())?;

    telemetry
        .laps
        .iter()
        .map(|lap| {
            Ok(StoredLap {
                lap: lap.lap,
                points,
                channels: telemetry.channels.clone(),
                packed: pack_values(&lap.values)?,
            })
        })
        .collect()
}

fn pack_values(values: &[Vec<f32>]) -> Result<Vec<u8>, String> {
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());

    for value in values.iter().flatten() {
        encoder
            .write_all(&value.to_le_bytes())
            .map_err(|error| error.to_string())?;
    }

    encoder.finish().map_err(|error| error.to_string())
}

/// A stored lap's values, a `Vec` per channel in `channels` order.
pub fn unpack_values(lap: &StoredLap) -> Result<Vec<Vec<f32>>, String> {
    let points = lap.points as usize;
    let expected = points * lap.channels.len() * VALUE_BYTES;
    let mut bytes = Vec::with_capacity(expected);

    DeflateDecoder::new(lap.packed.as_slice())
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;

    if bytes.len() != expected {
        return Err(format!(
            "stored lap holds {} bytes, {expected} expected",
            bytes.len()
        ));
    }

    if points == 0 {
        return Ok(vec![Vec::new(); lap.channels.len()]);
    }

    Ok(bytes
        .chunks_exact(points * VALUE_BYTES)
        .map(|channel| {
            channel
                .as_chunks::<VALUE_BYTES>()
                .0
                .iter()
                .map(|value| f32::from_le_bytes(*value))
                .collect()
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use mt_model::app::lap_telemetry::LapTelemetry;
    use mt_model::app::stats::{SessionFileLap, SessionFileRun};

    fn channel(name: &str) -> LapChannel {
        LapChannel {
            name: name.into(),
            unit: String::new(),
            description: String::new(),
        }
    }

    fn lap(lap_num: i64, time_s: Option<f64>, in_pit: bool, partial: bool) -> SessionFileLap {
        SessionFileLap {
            lap_num,
            time_s,
            in_pit,
            partial,
            incidents: 0,
        }
    }

    #[test]
    fn a_lap_round_trips_through_packing() {
        let values = vec![vec![0.0, 1.5, -2.25], vec![3.0, 3.0, 3.0]];
        let telemetry = FileTelemetry {
            points: 3,
            channels: vec![channel("Speed"), channel("Gear")],
            laps: vec![LapTelemetry {
                lap: LapKey {
                    session_num: 2,
                    lap_num: 5,
                },
                values: values.clone(),
            }],
        };

        let stored = pack_file(&telemetry).unwrap();

        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].points, 3);
        assert_eq!(unpack_values(&stored[0]).unwrap(), values);
    }

    #[test]
    fn a_lap_cut_short_is_an_error() {
        let mut stored = pack_file(&FileTelemetry {
            points: 2,
            channels: vec![channel("Speed")],
            laps: vec![LapTelemetry {
                lap: LapKey {
                    session_num: 0,
                    lap_num: 1,
                },
                values: vec![vec![1.0, 2.0]],
            }],
        })
        .unwrap()
        .remove(0);
        stored.points = 3;

        assert!(unpack_values(&stored).is_err());
    }

    #[test]
    fn pit_partial_and_untimed_laps_are_not_kept() {
        let file = SessionFile {
            runs: vec![SessionFileRun {
                session_num: 2,
                laps: vec![
                    lap(1, Some(100.0), false, true),
                    lap(2, Some(99.0), false, false),
                    lap(3, Some(110.0), true, false),
                    lap(4, None, false, false),
                    lap(5, Some(98.5), false, false),
                ],
                ..SessionFileRun::default()
            }],
            ..SessionFile::default()
        };

        let kept: Vec<i32> = stored_lap_keys(&file)
            .iter()
            .map(|key| key.lap_num)
            .collect();

        assert_eq!(kept, vec![2, 5]);
    }
}
