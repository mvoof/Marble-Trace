use std::io::Cursor;

use mt_model::app::stats::{SessionFile, SessionFileLap};

use super::*;

const TYPE_BOOL: i32 = 1;
const TYPE_INT: i32 = 2;
const TYPE_FLOAT: i32 = 4;
const TYPE_DOUBLE: i32 = 5;

/// (name, type, offset) of each variable in a test row.
const VARS: [(&str, i32, usize); 10] = [
    ("SessionTime", TYPE_DOUBLE, 0),
    ("SessionNum", TYPE_INT, 8),
    ("SessionState", TYPE_INT, 12),
    ("LapCompleted", TYPE_INT, 16),
    ("LapLastLapTime", TYPE_FLOAT, 20),
    ("PlayerCarMyIncidentCount", TYPE_INT, 24),
    ("PlayerCarPosition", TYPE_INT, 28),
    ("OnPitRoad", TYPE_BOOL, 32),
    ("Lat", TYPE_DOUBLE, 36),
    ("Lon", TYPE_DOUBLE, 44),
];
const ROW_LEN: usize = 52;
/// One row a second keeps the settle arithmetic readable.
const TICK_RATE: i32 = 1;
const STARTED_AT: i64 = 1_762_449_323;

const YAML: &str = "---
WeekendInfo:
 TrackDisplayName: Nürburgring Combined
 TrackConfigName: Gesamtstrecke VLN
 TrackID: 252
 TrackCountry: Germany
 SeriesID: 230
 SeasonID: 5000
 SessionID: 900
 SubSessionID: 77
 LeagueID: 0
 Official: 1
 TeamRacing: 0
 EventType: Race
 Category: Road
SessionInfo:
 Sessions:
 - SessionNum: 0
   SessionType: Practice
   ResultsPositions:
 - SessionNum: 2
   SessionType: Race
   ResultsPositions:
   - Position: 1
   - Position: 2
   - Position: 3
DriverInfo:
 DriverCarIdx: 1
 Drivers:
 - CarIdx: 0
   UserName: Someone Else
   IRating: 3000
 - CarIdx: 1
   UserName: ? ?
   UserID: 42
   IRating: 1350
   LicString: B 3.74
   CarID: 156
   CarScreenName: Mercedes-AMG GT3 2020
   CarClassShortName: GT3
...
";

#[derive(Clone, Copy, Default)]
struct Row {
    time: f64,
    session_num: i32,
    state: i32,
    lap_completed: i32,
    last_lap: f32,
    incidents: i32,
    position: i32,
    on_pit_road: bool,
    /// (latitude, longitude); (0, 0) is a row without a fix.
    location: (f64, f64),
}

fn row_bytes(row: &Row) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(ROW_LEN);
    bytes.extend(row.time.to_le_bytes());
    bytes.extend(row.session_num.to_le_bytes());
    bytes.extend(row.state.to_le_bytes());
    bytes.extend(row.lap_completed.to_le_bytes());
    bytes.extend(row.last_lap.to_le_bytes());
    bytes.extend(row.incidents.to_le_bytes());
    bytes.extend(row.position.to_le_bytes());
    bytes.extend([u8::from(row.on_pit_road), 0, 0, 0]);
    bytes.extend(row.location.0.to_le_bytes());
    bytes.extend(row.location.1.to_le_bytes());
    bytes
}

fn put_i32(bytes: &mut [u8], at: usize, value: i32) {
    bytes[at..at + 4].copy_from_slice(&value.to_le_bytes());
}

/// An `.ibt` laid out as the sim writes one.
fn ibt_file(rows: &[Row]) -> Vec<u8> {
    let var_header_offset = HEADER_LEN + DISK_HEADER_LEN;
    let yaml_offset = var_header_offset + VARS.len() * VAR_HEADER_LEN;
    let rows_offset = yaml_offset + YAML.len();
    let mut bytes = vec![0_u8; rows_offset];

    put_i32(&mut bytes, 0, 2);
    put_i32(&mut bytes, 8, TICK_RATE);
    put_i32(&mut bytes, 16, YAML.len() as i32);
    put_i32(&mut bytes, 20, yaml_offset as i32);
    put_i32(&mut bytes, 24, VARS.len() as i32);
    put_i32(&mut bytes, 28, var_header_offset as i32);
    put_i32(&mut bytes, 32, 1);
    put_i32(&mut bytes, 36, ROW_LEN as i32);
    put_i32(&mut bytes, 52, rows_offset as i32);

    let last_time = rows.last().map(|row| row.time).unwrap_or_default();
    bytes[HEADER_LEN..HEADER_LEN + 8].copy_from_slice(&STARTED_AT.to_le_bytes());
    bytes[HEADER_LEN + 8..HEADER_LEN + 16].copy_from_slice(&0.0_f64.to_le_bytes());
    bytes[HEADER_LEN + 16..HEADER_LEN + 24].copy_from_slice(&last_time.to_le_bytes());
    put_i32(&mut bytes, HEADER_LEN + 28, rows.len() as i32);

    for (index, (name, var_type, offset)) in VARS.iter().enumerate() {
        let at = var_header_offset + index * VAR_HEADER_LEN;
        put_i32(&mut bytes, at, *var_type);
        put_i32(&mut bytes, at + 4, *offset as i32);
        put_i32(&mut bytes, at + 8, 1);
        bytes[at + VAR_NAME_OFFSET..at + VAR_NAME_OFFSET + name.len()]
            .copy_from_slice(name.as_bytes());
    }

    bytes[yaml_offset..rows_offset].copy_from_slice(YAML.as_bytes());

    for row in rows {
        bytes.extend(row_bytes(row));
    }

    bytes
}

fn read(bytes: Vec<u8>) -> Result<SessionFile, String> {
    let length = bytes.len() as u64;

    read_from(Cursor::new(bytes), length)
}

/// A race run joined mid-lap: a counted partial lap, an uncounted lap with
/// two incidents, an in-lap through the pits, then the checkered flag in P7.
fn race_rows() -> Vec<Row> {
    let base = Row {
        session_num: 2,
        position: 9,
        last_lap: -1.0,
        ..Row::default()
    };
    let mut rows = Vec::new();

    for second in 0..=15 {
        let time = f64::from(second);
        let lap_completed = match second {
            0 => 0,
            1..=5 => 1,
            6..=10 => 2,
            _ => 3,
        };
        let last_lap = match second {
            0..=3 => -1.0,
            4..=8 => 95.0,
            9..=13 => -1.0,
            _ => 120.0,
        };

        rows.push(Row {
            time,
            lap_completed,
            last_lap,
            incidents: if second >= 5 { 2 } else { 0 },
            on_pit_road: second == 10,
            state: if second == 15 { 5 } else { 4 },
            position: if second == 15 { 7 } else { base.position },
            ..base
        });
    }

    rows
}

#[test]
fn a_race_file_reads_into_its_session_run_and_laps() {
    let file = read(ibt_file(&race_rows())).unwrap();
    let run = &file.runs[0];

    assert_eq!(file.started_at, STARTED_AT);
    assert_eq!(file.ended_at, STARTED_AT + 15);
    assert_eq!(file.subsession_id, Some(77));
    assert_eq!(file.event_type, "Race");
    assert_eq!(file.category.as_deref(), Some("Road"));
    assert!(file.official);
    assert_eq!(file.track_name.as_deref(), Some("Nürburgring Combined"));
    assert_eq!(file.track_config.as_deref(), Some("Gesamtstrecke VLN"));
    assert_eq!(file.user_name.as_deref(), Some("? ?"));
    assert_eq!(file.irating, Some(1350));
    assert_eq!(file.licence.as_deref(), Some("B 3.74"));
    assert_eq!(file.car_name.as_deref(), Some("Mercedes-AMG GT3 2020"));

    assert_eq!(file.runs.len(), 1);
    assert_eq!(run.session_num, 2);
    assert_eq!(run.run_type, "Race");
    assert_eq!(run.time_in_car_s, 16.0);
    assert_eq!(run.incidents, 2);
    assert_eq!(run.finish_pos, Some(7));
    assert_eq!(run.field_size, Some(3));
    assert_eq!(
        run.laps,
        vec![
            SessionFileLap {
                lap_num: 1,
                time_s: Some(95.0),
                in_pit: false,
                partial: true,
                incidents: 0,
            },
            SessionFileLap {
                lap_num: 2,
                time_s: None,
                in_pit: false,
                partial: false,
                incidents: 2,
            },
            SessionFileLap {
                lap_num: 3,
                time_s: Some(120.0),
                in_pit: true,
                partial: false,
                incidents: 0,
            },
        ]
    );
}

#[test]
fn a_practice_run_has_no_finish_even_under_the_flag() {
    let rows: Vec<Row> = race_rows()
        .into_iter()
        .map(|row| Row {
            session_num: 0,
            ..row
        })
        .collect();

    let run = &read(ibt_file(&rows)).unwrap().runs[0];

    assert_eq!(run.run_type, "Practice");
    assert_eq!(run.finish_pos, None);
    assert_eq!(run.field_size, None);
}

#[test]
fn a_cut_file_is_an_error_not_a_session() {
    let mut bytes = ibt_file(&race_rows());
    bytes.truncate(HEADER_LEN + 40);

    assert!(read(bytes).is_err());
}

#[test]
fn a_file_of_another_kind_is_an_error() {
    assert!(read(vec![7_u8; 4096]).is_err());
}

/// Leaving the pits takes the counter from -1 to 0; a reset takes it back and
/// it climbs to a lap already counted; a lap whose time never settles keeps
/// showing the one before.
#[test]
fn lap_zero_repeated_laps_and_unsettled_times_are_not_laps() {
    let base = Row {
        session_num: 2,
        state: 4,
        ..Row::default()
    };
    // (lap counter, last lap time) per second.
    let script: [(i32, f32); 16] = [
        (-1, -1.0),
        (0, -1.0),
        (1, -1.0),
        (1, -1.0),
        (1, -1.0),
        (1, 100.0),
        (2, 100.0),
        (2, 100.0),
        (2, 100.0),
        (2, 101.0),
        (1, 101.0),
        (2, 101.0),
        (3, 101.0),
        (3, 101.0),
        (3, 101.0),
        (3, 101.0),
    ];
    let rows: Vec<Row> = script
        .iter()
        .enumerate()
        .map(|(second, (lap_completed, last_lap))| Row {
            time: second as f64,
            lap_completed: *lap_completed,
            last_lap: *last_lap,
            ..base
        })
        .collect();

    let laps: Vec<(i64, Option<f64>)> = read(ibt_file(&rows)).unwrap().runs[0]
        .laps
        .iter()
        .map(|lap| (lap.lap_num, lap.time_s))
        .collect();

    assert_eq!(laps, vec![(1, Some(100.0)), (2, Some(101.0)), (3, None)]);
}

const METRES_PER_DEGREE: f64 = 111_320.0;
const CIRCLE_LATITUDE: f64 = 10.0;

/// `count` rows round a circle of `radius_m` metres.
fn circle(radius_m: f64, count: usize) -> Vec<(f64, f64)> {
    let longitude_scale = CIRCLE_LATITUDE.to_radians().cos() * METRES_PER_DEGREE;

    (0..count)
        .map(|index| {
            let angle = std::f64::consts::TAU * index as f64 / count as f64;

            (
                CIRCLE_LATITUDE + radius_m * angle.cos() / METRES_PER_DEGREE,
                radius_m * angle.sin() / longitude_scale,
            )
        })
        .collect()
}

/// A partial lap, then laps of 70 s and 60 s round circles of 500 and 300 m,
/// then a 50 s lap round 100 m through the pits. `gap` drops the fix for one
/// row of the 60 s lap.
fn laps_round_circles(gap: bool) -> Vec<Row> {
    // (lap counter, last lap time, radius, through the pits)
    let segments = [
        (0, -1.0, 800.0, false),
        (1, 99.0, 500.0, false),
        (2, 70.0, 300.0, false),
        (3, 60.0, 100.0, true),
        (4, 50.0, 100.0, false),
    ];
    let mut rows = Vec::new();

    for (lap_completed, last_lap, radius, through_pits) in segments {
        for (index, location) in circle(radius, 40).into_iter().enumerate() {
            let lost_fix = gap && lap_completed == 2 && index == 20;

            rows.push(Row {
                time: rows.len() as f64,
                session_num: 2,
                state: 4,
                lap_completed,
                last_lap,
                on_pit_road: through_pits && index == 10,
                location: if lost_fix { (0.0, 0.0) } else { location },
                ..Row::default()
            });
        }
    }

    rows
}

/// How wide the outline drawn from `rows` is, in metres.
fn outline_width(rows: &[Row]) -> f64 {
    let outline = read(ibt_file(rows)).unwrap().outline.unwrap();

    outline.view_box.split(' ').nth(2).unwrap().parse().unwrap()
}

#[test]
fn the_fastest_clean_lap_draws_the_outline() {
    // The 60 s lap: 600 m across. The 50 s one went through the pits.
    let width = outline_width(&laps_round_circles(false));

    assert!((width - 600.0).abs() < 10.0, "{width}");
}

#[test]
fn a_lap_that_lost_the_fix_is_not_drawn() {
    let width = outline_width(&laps_round_circles(true));

    assert!((width - 1000.0).abs() < 10.0, "{width}");
}

#[test]
fn a_file_without_positions_has_no_outline() {
    assert_eq!(read(ibt_file(&race_rows())).unwrap().outline, None);
}
