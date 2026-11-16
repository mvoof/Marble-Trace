//! The analysis laps' telemetry in memory: every channel of each lap on one
//! distance grid, read by one background thread, a file at a time.
//!
//! The main window decides when it is held (the game and focus rule of the
//! analysis): `unload` drops it, and a load cut by an unload is given up.

use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

use mt_model::app::lap_telemetry::{AnalysisLoad, FileTelemetry, LapChannel, LapKey};
use mt_model::app::stats::LapRef;
use mt_model::utils::lock_or_recover;

const THREAD_NAME: &str = "analysis-loader";
const UNLOADED: &str = "analysis unloaded while loading";
const POINTS_HEADER_BYTES: usize = 4;
const VALUE_BYTES: usize = 4;

/// Reads laps of one session file; the sim's adapter provides it.
pub type LapTelemetryReader = fn(&Path, &[LapKey]) -> Result<FileTelemetry, String>;

/// What the loader needs from the app.
pub struct LapCacheHost {
    pub read_laps: LapTelemetryReader,
    /// Runs first on the loader thread: the app lowers its priority there.
    pub on_thread_start: fn(),
}

#[derive(Default)]
struct Cache {
    points: usize,
    channels: Vec<LapChannel>,
    /// Each lap's values, in `channels` order.
    laps: HashMap<LapRef, Vec<Vec<f32>>>,
}

struct Job {
    laps: Vec<LapRef>,
    reply: Sender<Result<AnalysisLoad, String>>,
}

/// The cache and the thread that fills it.
pub struct LapCache {
    cache: Arc<Mutex<Cache>>,
    /// Bumped by every unload: a load started before it is given up.
    generation: Arc<AtomicU64>,
    jobs: Mutex<Option<Sender<Job>>>,
}

impl LapCache {
    /// Starts the loader thread.
    pub fn start(host: LapCacheHost) -> Self {
        let cache = Arc::new(Mutex::new(Cache::default()));
        let generation = Arc::new(AtomicU64::new(0));
        let (sender, receiver) = mpsc::channel::<Job>();
        let worker = Worker {
            cache: Arc::clone(&cache),
            generation: Arc::clone(&generation),
            read_laps: host.read_laps,
        };
        let spawned = thread::Builder::new()
            .name(THREAD_NAME.into())
            .spawn(move || {
                (host.on_thread_start)();
                worker.run(&receiver);
            });
        let jobs = match spawned {
            Ok(_) => Some(sender),
            Err(error) => {
                tracing::error!(%error, "analysis loader thread not started");
                None
            }
        };

        Self {
            cache,
            generation,
            jobs: Mutex::new(jobs),
        }
    }

    /// Holds exactly `laps`: drops the others, reads the missing ones. Blocks
    /// until the loader has done it.
    pub fn load(&self, laps: Vec<LapRef>) -> Result<AnalysisLoad, String> {
        let (reply, answer) = mpsc::channel();
        let sent = lock_or_recover(&self.jobs)
            .as_ref()
            .map(|jobs| jobs.send(Job { laps, reply }));

        match sent {
            Some(Ok(())) => answer
                .recv()
                .map_err(|error| error.to_string())
                .and_then(|result| result),
            _ => Err("analysis loader not running".into()),
        }
    }

    /// Drops every lap; a load under way is given up.
    pub fn unload(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        *lock_or_recover(&self.cache) = Cache::default();
    }

    /// `channels` of `laps` as little-endian bytes: the grid's point count
    /// (u32), then per lap, per channel, a f32 a point. A channel the files
    /// do not hold reads as zeros.
    pub fn channel_bytes(&self, laps: &[LapRef], channels: &[String]) -> Result<Vec<u8>, String> {
        let cache = lock_or_recover(&self.cache);
        let indexes: Vec<Option<usize>> = channels
            .iter()
            .map(|name| {
                cache
                    .channels
                    .iter()
                    .position(|channel| &channel.name == name)
            })
            .collect();
        let mut bytes = Vec::with_capacity(
            POINTS_HEADER_BYTES + laps.len() * channels.len() * cache.points * VALUE_BYTES,
        );

        bytes.extend(
            u32::try_from(cache.points)
                .unwrap_or(u32::MAX)
                .to_le_bytes(),
        );

        for lap in laps {
            let values = cache
                .laps
                .get(lap)
                .ok_or_else(|| format!("lap {} not loaded", lap.lap_num))?;

            for index in &indexes {
                match index.and_then(|index| values.get(index)) {
                    Some(channel) => {
                        for value in channel {
                            bytes.extend(value.to_le_bytes());
                        }
                    }
                    None => bytes.extend(vec![0_u8; cache.points * VALUE_BYTES]),
                }
            }
        }

        Ok(bytes)
    }
}

struct Worker {
    cache: Arc<Mutex<Cache>>,
    generation: Arc<AtomicU64>,
    read_laps: LapTelemetryReader,
}

impl Worker {
    fn run(&self, jobs: &Receiver<Job>) {
        for job in jobs {
            let result = self.load(&job.laps);

            if job.reply.send(result).is_err() {
                tracing::debug!("analysis load answered to no one");
            }
        }
    }

    fn load(&self, laps: &[LapRef]) -> Result<AnalysisLoad, String> {
        let generation = self.generation.load(Ordering::SeqCst);
        let mut missing = Vec::new();
        let wanted: BTreeMap<&str, Vec<&LapRef>> = {
            let mut cache = lock_or_recover(&self.cache);

            cache.laps.retain(|lap, _| laps.contains(lap));

            let mut by_file: BTreeMap<&str, Vec<&LapRef>> = BTreeMap::new();

            for lap in laps.iter().filter(|lap| !cache.laps.contains_key(*lap)) {
                by_file.entry(lap.path.as_str()).or_default().push(lap);
            }

            by_file
        };

        for (path, file_laps) in wanted {
            let keys: Vec<LapKey> = file_laps
                .iter()
                .map(|lap| LapKey {
                    session_num: lap.session_num,
                    lap_num: lap.lap_num,
                })
                .collect();
            let read = if Path::new(path).is_file() {
                (self.read_laps)(Path::new(path), &keys)
            } else {
                Err("file deleted".into())
            };

            if self.generation.load(Ordering::SeqCst) != generation {
                return Err(UNLOADED.into());
            }

            match read {
                Ok(file) => missing.extend(self.store(file, &file_laps)),
                Err(error) => {
                    tracing::warn!(%error, path, "analysis laps not read");
                    missing.extend(file_laps.into_iter().cloned());
                }
            }
        }

        let cache = lock_or_recover(&self.cache);

        Ok(AnalysisLoad {
            points: u32::try_from(cache.points).unwrap_or(u32::MAX),
            channels: cache.channels.clone(),
            missing,
        })
    }

    /// Keeps a file's laps; answers those it did not hold. The first file
    /// read sets the grid and the channels; later ones are fitted to them.
    fn store(&self, file: FileTelemetry, asked: &[&LapRef]) -> Vec<LapRef> {
        let mut cache = lock_or_recover(&self.cache);

        if cache.laps.is_empty() {
            cache.points = file.points;
            cache.channels = file.channels.clone();
        }

        let mut not_held = Vec::new();

        for lap in asked {
            let read = file.laps.iter().find(|read| {
                read.lap.session_num == lap.session_num && read.lap.lap_num == lap.lap_num
            });
            let Some(read) = read else {
                not_held.push((*lap).clone());
                continue;
            };
            let values = cache
                .channels
                .iter()
                .map(|channel| {
                    let index = file
                        .channels
                        .iter()
                        .position(|own| own.name == channel.name);
                    let mut values = index
                        .and_then(|index| read.values.get(index).cloned())
                        .unwrap_or_default();
                    let last = values.last().copied().unwrap_or_default();

                    values.resize(cache.points, last);

                    values
                })
                .collect();

            cache.laps.insert((*lap).clone(), values);
        }

        not_held
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mt_model::app::lap_telemetry::LapTelemetry;

    const POINTS: usize = 3;

    /// Two channels; a lap's values are its number, then ten times it.
    fn fake_reader(_: &Path, laps: &[LapKey]) -> Result<FileTelemetry, String> {
        Ok(FileTelemetry {
            points: POINTS,
            channels: ["Speed", "ElapsedTime"]
                .iter()
                .map(|name| LapChannel {
                    name: (*name).into(),
                    unit: String::new(),
                    description: String::new(),
                })
                .collect(),
            laps: laps
                .iter()
                .filter(|lap| lap.lap_num < 100)
                .map(|lap| LapTelemetry {
                    lap: *lap,
                    values: vec![
                        vec![lap.lap_num as f32; POINTS],
                        vec![lap.lap_num as f32 * 10.0; POINTS],
                    ],
                })
                .collect(),
        })
    }

    fn cache() -> LapCache {
        LapCache::start(LapCacheHost {
            read_laps: fake_reader,
            on_thread_start: || {},
        })
    }

    /// A real file, so the existence check passes.
    fn lap(lap_num: i32) -> LapRef {
        LapRef {
            path: concat!(env!("CARGO_MANIFEST_DIR"), "/Cargo.toml").into(),
            session_num: 2,
            lap_num,
        }
    }

    fn floats(bytes: &[u8]) -> Vec<f32> {
        bytes[POINTS_HEADER_BYTES..]
            .chunks(VALUE_BYTES)
            .map(|chunk| f32::from_le_bytes(chunk.try_into().unwrap()))
            .collect()
    }

    #[test]
    fn channels_come_back_per_lap_per_channel_after_the_point_count() {
        let cache = cache();
        let load = cache.load(vec![lap(3), lap(5)]).unwrap();

        let bytes = cache
            .channel_bytes(&[lap(5), lap(3)], &["ElapsedTime".into(), "Nope".into()])
            .unwrap();

        assert_eq!(load.points, 3);
        assert!(load.missing.is_empty());
        assert_eq!(u32::from_le_bytes(bytes[..4].try_into().unwrap()), 3);
        assert_eq!(
            floats(&bytes),
            vec![50.0, 50.0, 50.0, 0.0, 0.0, 0.0, 30.0, 30.0, 30.0, 0.0, 0.0, 0.0]
        );
    }

    #[test]
    fn a_gone_file_and_a_lap_the_file_lacks_are_missing() {
        let cache = cache();
        let gone = LapRef {
            path: "Z:/no/such.ibt".into(),
            ..lap(3)
        };

        let load = cache.load(vec![gone.clone(), lap(100), lap(4)]).unwrap();

        assert_eq!(load.missing.len(), 2);
        assert!(load.missing.contains(&gone) && load.missing.contains(&lap(100)));
        assert!(cache.channel_bytes(&[lap(4)], &["Speed".into()]).is_ok());
        assert!(cache.channel_bytes(&[lap(100)], &["Speed".into()]).is_err());
    }

    #[test]
    fn a_load_keeps_only_its_laps_and_an_unload_drops_them_all() {
        let cache = cache();
        cache.load(vec![lap(3), lap(4)]).unwrap();

        cache.load(vec![lap(4)]).unwrap();
        assert!(cache.channel_bytes(&[lap(3)], &["Speed".into()]).is_err());
        assert!(cache.channel_bytes(&[lap(4)], &["Speed".into()]).is_ok());

        cache.unload();
        assert!(cache.channel_bytes(&[lap(4)], &["Speed".into()]).is_err());
    }
}
