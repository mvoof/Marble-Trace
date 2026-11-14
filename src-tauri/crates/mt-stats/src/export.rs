//! Session records as CSV, one row a session, oldest first.

use rusqlite::params;

use mt_model::app::stats::RecentSession;

use crate::db::{to_message, StatsDb, STATUS_READ};

const HEADER: [&str; 17] = [
    "started_utc",
    "event_type",
    "category",
    "official",
    "subsession_id",
    "track",
    "track_config",
    "track_country",
    "car",
    "car_class",
    "irating",
    "licence",
    "finish_position",
    "field_size",
    "best_lap_s",
    "incidents",
    "time_in_car_s",
];

const DAY_S: i64 = 24 * 60 * 60;

/// One session row as the export reads it, before its results are added.
struct ExportedSession {
    session: RecentSession,
    category: Option<String>,
    official: bool,
    subsession_id: Option<i64>,
    track_country: Option<String>,
    car_class: Option<String>,
    irating: Option<i64>,
    licence: Option<String>,
    time_in_car_s: f64,
}

impl StatsDb {
    /// Every session record as CSV text, header first. Returns the text and
    /// the count of sessions in it.
    pub fn sessions_csv(&self) -> Result<(String, u32), String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT s.key, MIN(f.started_at) AS started, s.event_type, s.track_name,
                        s.track_config, s.car_name, s.category, s.official, s.subsession_id,
                        s.track_country, s.car_class, s.irating, s.licence,
                        (SELECT COALESCE(SUM(r.time_in_car_s), 0) FROM run r
                         WHERE r.session_key = s.key)
                 FROM session s
                 JOIN ibt_file f ON f.session_key = s.key AND f.status = ?1
                 GROUP BY s.key
                 ORDER BY started ASC",
            )
            .map_err(to_message)?;
        let rows = statement
            .query_map(params![STATUS_READ], |row| {
                Ok(ExportedSession {
                    session: RecentSession {
                        key: row.get(0)?,
                        started_at: row.get::<_, i64>(1)? as f64,
                        event_type: row.get(2)?,
                        track_name: row.get(3)?,
                        track_config: row.get(4)?,
                        car_name: row.get(5)?,
                        finish_pos: None,
                        field_size: None,
                        best_lap_s: None,
                        incidents: 0,
                    },
                    category: row.get(6)?,
                    official: row.get(7)?,
                    subsession_id: row.get(8)?,
                    track_country: row.get(9)?,
                    car_class: row.get(10)?,
                    irating: row.get(11)?,
                    licence: row.get(12)?,
                    time_in_car_s: row.get(13)?,
                })
            })
            .map_err(to_message)?;

        let mut text = csv_line(HEADER.iter().map(|name| (*name).to_string()));
        let mut count: u32 = 0;

        for row in rows {
            let exported = row.map_err(to_message)?;
            let session = self.with_results(exported.session.clone())?;

            text.push_str(&csv_line(session_fields(&exported, &session)));
            count += 1;
        }

        Ok((text, count))
    }
}

fn session_fields(exported: &ExportedSession, session: &RecentSession) -> Vec<String> {
    vec![
        utc_timestamp(session.started_at as i64),
        session.event_type.clone(),
        optional(exported.category.as_ref()),
        exported.official.to_string(),
        optional(exported.subsession_id.as_ref()),
        optional(session.track_name.as_ref()),
        optional(session.track_config.as_ref()),
        optional(exported.track_country.as_ref()),
        optional(session.car_name.as_ref()),
        optional(exported.car_class.as_ref()),
        optional(exported.irating.as_ref()),
        optional(exported.licence.as_ref()),
        optional(session.finish_pos.as_ref()),
        optional(session.field_size.as_ref()),
        session
            .best_lap_s
            .map(|seconds| format!("{seconds:.3}"))
            .unwrap_or_default(),
        session.incidents.to_string(),
        format!("{:.0}", exported.time_in_car_s),
    ]
}

fn optional<T: ToString>(value: Option<&T>) -> String {
    value.map(ToString::to_string).unwrap_or_default()
}

/// One CSV line, CRLF-ended as RFC 4180 has it.
fn csv_line(fields: impl IntoIterator<Item = String>) -> String {
    let quoted: Vec<String> = fields.into_iter().map(|field| csv_field(&field)).collect();

    format!("{}\r\n", quoted.join(","))
}

fn csv_field(field: &str) -> String {
    let needs_quotes = field.contains([',', '"', '\n', '\r']);

    if needs_quotes {
        return format!("\"{}\"", field.replace('"', "\"\""));
    }

    field.to_string()
}

/// `YYYY-MM-DD HH:MM:SS`, UTC.
fn utc_timestamp(unix_s: i64) -> String {
    let days = unix_s.div_euclid(DAY_S);
    let seconds_of_day = unix_s.rem_euclid(DAY_S);
    let (year, month, day) = civil_from_days(days);

    format!(
        "{year:04}-{month:02}-{day:02} {:02}:{:02}:{:02}",
        seconds_of_day / 3600,
        seconds_of_day % 3600 / 60,
        seconds_of_day % 60
    )
}

/// The proleptic Gregorian date of a day count since 1970-01-01 (Howard
/// Hinnant's `civil_from_days`).
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let shifted = days + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);

    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::FileStamp;
    use mt_model::app::stats::{SessionFile, SessionFileLap, SessionFileRun};

    #[test]
    fn dates_are_utc_calendar_days() {
        assert_eq!(utc_timestamp(0), "1970-01-01 00:00:00");
        assert_eq!(utc_timestamp(951_782_400), "2000-02-29 00:00:00");
        assert_eq!(utc_timestamp(1_794_663_669), "2026-11-14 13:41:09");
    }

    #[test]
    fn a_field_with_a_comma_or_quote_is_quoted() {
        assert_eq!(csv_field("Spa"), "Spa");
        assert_eq!(csv_field("Spa, GP"), "\"Spa, GP\"");
        assert_eq!(csv_field("the \"Ring\""), "\"the \"\"Ring\"\"\"");
    }

    #[test]
    fn every_session_is_a_row_with_its_results() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let file = SessionFile {
            started_at: 0,
            ended_at: 600,
            subsession_id: Some(42),
            event_type: "Race".into(),
            official: true,
            track_name: Some("Spa, GP".into()),
            car_name: Some("GT3".into()),
            irating: Some(1500),
            runs: vec![SessionFileRun {
                session_num: 2,
                run_type: "Race".into(),
                time_in_car_s: 600.4,
                incidents: 4,
                finish_pos: Some(3),
                field_size: Some(20),
                laps: vec![SessionFileLap {
                    lap_num: 2,
                    time_s: Some(138.5),
                    ..SessionFileLap::default()
                }],
            }],
            ..SessionFile::default()
        };
        let stamp = FileStamp {
            path: "a.ibt".into(),
            size: 1,
            modified_at: 1,
        };
        db.record_read(&stamp, &file, 5).unwrap();

        let (text, count) = db.sessions_csv().unwrap();
        let lines: Vec<&str> = text.split("\r\n").collect();

        assert_eq!(count, 1);
        assert!(lines[0].starts_with("started_utc,event_type,"));
        assert_eq!(
            lines[1],
            "1970-01-01 00:00:00,Race,,true,42,\"Spa, GP\",,,GT3,,1500,,3,20,138.500,4,600"
        );
    }
}
