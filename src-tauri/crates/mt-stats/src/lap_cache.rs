//! The analysis laps' telemetry in memory: the stored channels of each lap on one
//! distance grid, read by one background thread. A lap `stats.db` keeps comes
//! from there; the others from their file, a file at a time.
//!
//! The main window decides when it is held (the game and focus rule of the
//! analysis): `unload` drops it, and a load cut by an unload is given up.

use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

use mt_model::app::lap_telemetry::{
    AnalysisLoad, FileTelemetry, LapChannel, LapKey, ELAPSED_CHANNEL,
};
use mt_model::app::stats::LapRef;
use mt_model::utils::lock_or_recover;

use crate::lap_store::{unpack_values, StoredLap};

const THREAD_NAME: &str = "analysis-loader";
const UNLOADED: &str = "analysis unloaded while loading";
const POINTS_HEADER_BYTES: usize = 4;
const VALUE_BYTES: usize = 4;

/// Reads laps of one session file; the sim's adapter provides it.
pub type LapTelemetryReader = fn(&Path, &[LapKey]) -> Result<FileTelemetry, String>;

/// A lap as `stats.db` keeps it; `None` when it keeps none.
pub type StoredLapReader = Box<dyn Fn(&LapRef) -> Result<Option<StoredLap>, String> + Send>;

/// What the loader needs from the app.
pub struct LapCacheHost {
    pub read_laps: LapTelemetryReader,
    pub read_stored: StoredLapReader,
    /// Runs first on the loader thread: the app lowers its priority there.
    pub on_thread_start: fn(),
}

#[derive(Default)]
struct Cache {
    points: usize,
    /// Every channel some held lap has, the time since the line last.
    channels: Vec<LapChannel>,
    /// Each lap's values by channel name: a stored lap holds fewer channels
    /// than one read from its file.
    laps: HashMap<LapRef, HashMap<String, Vec<f32>>>,
}

impl Cache {
    /// Keeps a lap's values, `channels` order, fitted to the grid. The first
    /// lap held sets the grid.
    fn hold(&mut self, lap: LapRef, points: usize, channels: &[LapChannel], values: Vec<Vec<f32>>) {
        if self.laps.is_empty() {
            self.points = points;
        }

        let mut by_name = HashMap::with_capacity(channels.len());

        for (channel, mut channel_values) in channels.iter().zip(values) {
            let last = channel_values.last().copied().unwrap_or_default();

            channel_values.resize(self.points, last);
            by_name.insert(channel.name.clone(), channel_values);

            if !self.channels.iter().any(|known| known.name == channel.name) {
                self.channels.push(channel.clone());
            }
        }

        self.laps.insert(lap, by_name);
    }

    /// Drops the channels no held lap has; the time since the line goes last.
    /// With no lap held, the grid goes too.
    fn tidy_channels(&mut self) {
        let laps = &self.laps;

        self.channels.retain(|channel| {
            laps.values()
                .any(|values| values.contains_key(&channel.name))
        });
        self.channels
            .sort_by_key(|channel| channel.name == ELAPSED_CHANNEL);

        if self.laps.is_empty() {
            self.points = 0;
        }
    }
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
            read_stored: host.read_stored,
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
    /// (u32), then per lap, per channel, a f32 a point. A channel the lap
    /// does not hold reads as zeros.
    pub fn channel_bytes(&self, laps: &[LapRef], channels: &[String]) -> Result<Vec<u8>, String> {
        let cache = lock_or_recover(&self.cache);
        let capacity = laps
            .len()
            .checked_mul(channels.len())
            .and_then(|count| count.checked_mul(cache.points))
            .and_then(|count| count.checked_mul(VALUE_BYTES))
            .and_then(|count| count.checked_add(POINTS_HEADER_BYTES))
            .ok_or("too many channels asked for")?;
        let mut bytes = Vec::with_capacity(capacity);

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

            for name in channels {
                match values.get(name) {
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
    read_stored: StoredLapReader,
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
        let wanted: Vec<&LapRef> = {
            let mut cache = lock_or_recover(&self.cache);

            cache.laps.retain(|lap, _| laps.contains(lap));
            laps.iter()
                .filter(|lap| !cache.laps.contains_key(*lap))
                .collect()
        };
        let mut by_file: BTreeMap<&str, Vec<&LapRef>> = BTreeMap::new();

        for lap in wanted {
            let stored = self.read_stored_lap(lap);

            if self.generation.load(Ordering::SeqCst) != generation {
                return Err(UNLOADED.into());
            }

            match stored {
                Some((stored, values)) => {
                    lock_or_recover(&self.cache).hold(
                        lap.clone(),
                        stored.points as usize,
                        &stored.channels,
                        values,
                    );
                }
                None => by_file.entry(lap.path.as_str()).or_default().push(lap),
            }
        }

        let mut missing = Vec::new();

        for (path, file_laps) in by_file {
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
                Ok(file) => missing.extend(self.hold_file(file, &file_laps)),
                Err(error) => {
                    tracing::warn!(%error, path, "analysis laps not read");
                    missing.extend(file_laps.into_iter().cloned());
                }
            }
        }

        let mut cache = lock_or_recover(&self.cache);

        cache.tidy_channels();

        Ok(AnalysisLoad {
            points: u32::try_from(cache.points).unwrap_or(u32::MAX),
            channels: cache.channels.clone(),
            missing,
        })
    }

    /// The lap's stored values; `None` sends it to its file.
    fn read_stored_lap(&self, lap: &LapRef) -> Option<(StoredLap, Vec<Vec<f32>>)> {
        let stored = match (self.read_stored)(lap) {
            Ok(stored) => stored?,
            Err(error) => {
                tracing::warn!(%error, lap = lap.lap_num, "stored lap not read");
                return None;
            }
        };

        match unpack_values(&stored) {
            Ok(values) => Some((stored, values)),
            Err(error) => {
                tracing::warn!(%error, lap = lap.lap_num, "stored lap not unpacked");
                None
            }
        }
    }

    /// Keeps a file's laps; answers those it did not hold.
    fn hold_file(&self, file: FileTelemetry, asked: &[&LapRef]) -> Vec<LapRef> {
        let mut cache = lock_or_recover(&self.cache);
        let mut not_held = Vec::new();
        let mut read_laps = file.laps;

        for lap in asked {
            let index = read_laps.iter().position(|read| {
                read.lap.session_num == lap.session_num && read.lap.lap_num == lap.lap_num
            });

            match index {
                Some(index) => {
                    let read = read_laps.swap_remove(index);

                    cache.hold((*lap).clone(), file.points, &file.channels, read.values);
                }
                None => not_held.push((*lap).clone()),
            }
        }

        not_held
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lap_store::pack_file;
    use mt_model::app::lap_telemetry::LapTelemetry;

    const POINTS: usize = 3;
    /// Laps from this number up are kept in the fake database.
    const FIRST_STORED_LAP: i32 = 200;

    fn channel(name: &str) -> LapChannel {
        LapChannel {
            name: name.into(),
            unit: String::new(),
            description: String::new(),
        }
    }

    /// Two channels; a lap's values are its number, then ten times it.
    fn fake_reader(_: &Path, laps: &[LapKey]) -> Result<FileTelemetry, String> {
        Ok(FileTelemetry {
            points: POINTS,
            channels: vec![channel("Speed"), channel(ELAPSED_CHANNEL)],
            laps: laps
                .iter()
                .filter(|lap| lap.lap_num < 100 || lap.lap_num >= FIRST_STORED_LAP)
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

    /// Stored laps hold `Throttle` and the time; their speed is not kept.
    /// The time is a hundred times the lap number, to tell it from the file's.
    fn fake_store(lap: &LapRef) -> Result<Option<StoredLap>, String> {
        if lap.lap_num < FIRST_STORED_LAP {
            return Ok(None);
        }

        let telemetry = FileTelemetry {
            points: POINTS,
            channels: vec![channel(ELAPSED_CHANNEL), channel("Throttle")],
            laps: vec![LapTelemetry {
                lap: LapKey {
                    session_num: lap.session_num,
                    lap_num: lap.lap_num,
                },
                values: vec![vec![lap.lap_num as f32 * 100.0; POINTS], vec![0.5; POINTS]],
            }],
        };

        Ok(pack_file(&telemetry)?.pop())
    }

    fn cache() -> LapCache {
        LapCache::start(LapCacheHost {
            read_laps: fake_reader,
            read_stored: Box::new(fake_store),
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

    fn gone(lap_num: i32) -> LapRef {
        LapRef {
            path: "Z:/no/such.ibt".into(),
            ..lap(lap_num)
        }
    }

    fn floats(bytes: &[u8]) -> Vec<f32> {
        bytes[POINTS_HEADER_BYTES..]
            .chunks(VALUE_BYTES)
            .map(|chunk| f32::from_le_bytes(chunk.try_into().unwrap()))
            .collect()
    }

    fn names(load: &AnalysisLoad) -> Vec<&str> {
        load.channels
            .iter()
            .map(|channel| channel.name.as_str())
            .collect()
    }

    #[test]
    fn channels_come_back_per_lap_per_channel_after_the_point_count() {
        let cache = cache();
        let load = cache.load(vec![lap(3), lap(5)]).unwrap();

        let bytes = cache
            .channel_bytes(&[lap(5), lap(3)], &[ELAPSED_CHANNEL.into(), "Nope".into()])
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
    fn a_lap_neither_stored_nor_on_disk_and_a_lap_the_file_lacks_are_missing() {
        let cache = cache();

        let load = cache.load(vec![gone(3), lap(100), lap(4)]).unwrap();

        assert_eq!(load.missing.len(), 2);
        assert!(load.missing.contains(&gone(3)) && load.missing.contains(&lap(100)));
        assert!(cache.channel_bytes(&[lap(4)], &["Speed".into()]).is_ok());
        assert!(cache.channel_bytes(&[lap(100)], &["Speed".into()]).is_err());
    }

    #[test]
    fn a_stored_lap_loads_after_its_file_is_deleted() {
        let cache = cache();

        let load = cache.load(vec![gone(201)]).unwrap();
        let bytes = cache
            .channel_bytes(&[gone(201)], &[ELAPSED_CHANNEL.into()])
            .unwrap();

        assert!(load.missing.is_empty());
        assert_eq!(floats(&bytes), vec![20_100.0; POINTS]);
    }

    #[test]
    fn a_stored_lap_is_read_from_the_database_though_its_file_is_on_disk() {
        let cache = cache();

        cache.load(vec![lap(201)]).unwrap();
        let bytes = cache
            .channel_bytes(&[lap(201)], &[ELAPSED_CHANNEL.into()])
            .unwrap();

        assert_eq!(floats(&bytes), vec![20_100.0; POINTS]);
    }

    #[test]
    fn the_channels_are_those_of_every_lap_held_the_time_last() {
        let cache = cache();

        let mixed = cache.load(vec![gone(201), lap(4)]).unwrap();
        let bytes = cache
            .channel_bytes(&[gone(201)], &["Speed".into()])
            .unwrap();

        assert_eq!(names(&mixed), vec!["Throttle", "Speed", ELAPSED_CHANNEL]);
        assert_eq!(floats(&bytes), vec![0.0; POINTS]);

        let stored_only = cache.load(vec![gone(201)]).unwrap();

        assert_eq!(names(&stored_only), vec!["Throttle", ELAPSED_CHANNEL]);
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
