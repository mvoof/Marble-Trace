/// Project-owned normalized session model, built from the raw iRacing
/// session YAML (`kerb` `session_yaml()`). Contains only the fields actually
/// consumed by computations and the frontend — not a mirror of iRacing's
/// full YAML schema.
///
/// Emitted to the frontend as `sim://session` (camelCase via serde).
use std::collections::HashMap;

use serde::Deserialize;

use super::weather::parse_weather_forecast;
use crate::computations::proximity::parse_track_length;
use crate::model::session::{
    CarEntry, QualifyResultEntry, ResultPosition, SectorEntry, SessionEntry, SessionSnapshot,
    SessionType, TireCompoundEntry,
};
use crate::sources::source::ParsedSession;

enum IracingSessionType {
    Practice,
    LoneQualify,
    OpenQualify,
    Race,
    OfflineTesting,
    Warmup,
    Unknown,
}

impl IracingSessionType {
    fn from_str(s: &str) -> Self {
        match s {
            "Practice" => Self::Practice,
            "Lone Qualify" => Self::LoneQualify,
            "Open Qualify" => Self::OpenQualify,
            "Race" => Self::Race,
            "Offline Testing" => Self::OfflineTesting,
            "Warmup" => Self::Warmup,
            _ => Self::Unknown,
        }
    }

    fn to_session_type(&self) -> SessionType {
        match self {
            Self::Practice | Self::OfflineTesting | Self::Warmup => SessionType::Practice,
            Self::LoneQualify | Self::OpenQualify => SessionType::Qualify,
            Self::Race => SessionType::Race,
            Self::Unknown => SessionType::Unknown,
        }
    }
}

/// iRacing emits these user-controlled text fields unquoted, so names like
/// `? ?` or values containing `: ` break YAML parsing. Only these keys are
/// sanitized — everything else in the document is machine-generated.
const FREE_TEXT_YAML_KEYS: [&str; 5] = [
    "UserName",
    "AbbrevName",
    "Initials",
    "TeamName",
    "DriverSetupName",
];

/// Quote the values of free-text keys so arbitrary driver/team names cannot
/// break the YAML document structure.
fn sanitize_session_yaml(yaml: &str) -> String {
    let mut sanitized = String::with_capacity(yaml.len() + 256);

    for line in yaml.lines() {
        let trimmed_start = line.trim_start();
        let key_part = trimmed_start.strip_prefix("- ").unwrap_or(trimmed_start);

        let needs_quoting = FREE_TEXT_YAML_KEYS.iter().any(|key| {
            key_part
                .strip_prefix(key)
                .is_some_and(|rest| rest.starts_with(": "))
        });

        if needs_quoting {
            if let Some(colon_pos) = line.find(": ") {
                let (prefix, value) = line.split_at(colon_pos + 2);
                let value = value.trim_end();

                if !value.is_empty() && !value.starts_with('\'') && !value.starts_with('"') {
                    sanitized.push_str(prefix);
                    sanitized.push('\'');
                    sanitized.push_str(&value.replace('\'', "''"));
                    sanitized.push('\'');
                    sanitized.push('\n');

                    continue;
                }
            }
        }

        sanitized.push_str(line);
        sanitized.push('\n');
    }

    sanitized
}

/// iRacing session YAML reports class colors as "0xRRGGBB" strings.
/// Some telemetry colors don't match what iRacing displays in-game.
/// This map corrects the known mismatches: keys are normalized "#rrggbb",
/// values are the in-game color.
const CLASS_COLOR_MAP: [(&str, &str); 6] = [
    ("#53ff77", "#ff7199"),
    ("#ae6bff", "#5cecff"),
    ("#d35400", "#a07cc8"),
    ("#ff5888", "#ef4444"),
    ("#ffda59", "#ffd259"),
    ("#33ceff", "#4d7bd9"),
];

/// Convert a raw iRacing class color string ("0xRRGGBB" or "#RRGGBB") to a
/// lowercase "#rrggbb" hex string, then apply in-game color corrections.
/// Returns "#888888" for empty/missing values.
fn normalize_class_color(raw: &str) -> String {
    let trimmed = raw.trim();

    if trimmed.is_empty() {
        return "#888888".to_string();
    }

    let hex = if trimmed.starts_with("0x") || trimmed.starts_with("0X") {
        trimmed[2..].to_lowercase()
    } else {
        trimmed.trim_start_matches('#').to_lowercase()
    };

    let normalized = format!("#{hex}");

    CLASS_COLOR_MAP
        .iter()
        .find(|(key, _)| *key == normalized)
        .map(|(_, val)| (*val).to_string())
        .unwrap_or(normalized)
}

/// Parse the raw iRacing session YAML into the project model.
/// Returns `None` only if the YAML does not parse at all.
pub fn parse_session(yaml: &str) -> Option<ParsedSession> {
    let yaml = sanitize_session_yaml(yaml);

    let raw: RawSession = match serde_yaml_ng::from_str(&yaml) {
        Ok(raw) => raw,
        Err(e) => {
            tracing::warn!("Session YAML parse error: {e}");

            return None;
        }
    };

    let weekend = raw.weekend_info.unwrap_or_default();
    let session_info = raw.session_info.unwrap_or_default();
    let driver_info = raw.driver_info.unwrap_or_default();

    let weather_forecast = parse_weather_forecast(&weekend.extra);

    let sessions = session_info
        .sessions
        .unwrap_or_default()
        .into_iter()
        .map(|raw_session| {
            let raw_label = raw_session.session_type.unwrap_or_default();
            let iracing_type = IracingSessionType::from_str(&raw_label);
            SessionEntry {
                session_type: iracing_type.to_session_type(),
                session_type_label: raw_label,
                session_laps: raw_session.session_laps.unwrap_or_default(),
                results_positions: raw_session
                    .results_positions
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|raw_pos| {
                        Some(ResultPosition {
                            car_idx: raw_pos.car_idx?,
                            position: raw_pos.position?,
                            class_position: raw_pos.class_position,
                            lap: raw_pos.lap,
                            time: raw_pos.time.filter(|t| t.is_finite()),
                        })
                    })
                    .collect(),
            }
        })
        .collect();

    let cars = driver_info
        .drivers
        .unwrap_or_default()
        .into_iter()
        .filter_map(|raw_driver| {
            Some(CarEntry {
                car_idx: raw_driver.car_idx?,
                user_name: raw_driver.user_name.unwrap_or_default(),
                car_number: raw_driver.car_number.unwrap_or_default(),
                car_class_id: raw_driver.car_class_id.unwrap_or(-1),
                car_class_color: normalize_class_color(
                    raw_driver.car_class_color.as_deref().unwrap_or_default(),
                ),
                car_screen_name: raw_driver.car_screen_name.unwrap_or_default(),
                car_screen_name_short: raw_driver.car_screen_name_short.unwrap_or_default(),
                i_rating: raw_driver.i_rating.unwrap_or(0),
                lic_string: raw_driver.lic_string.unwrap_or_default(),
                lic_color: raw_driver.lic_color.unwrap_or_default(),
                incident_count: raw_driver.cur_driver_incident_count.unwrap_or(0),
                is_pace_car: raw_driver.car_is_pace_car == Some(1),
                is_spectator: raw_driver.is_spectator == Some(1),
                car_class_est_lap_time: raw_driver
                    .car_class_est_lap_time
                    .filter(|t| t.is_finite())
                    .unwrap_or(0.0) as f32,
            })
        })
        .collect();

    let driver_tires = driver_info
        .driver_tires
        .unwrap_or_default()
        .into_iter()
        .filter_map(|raw_tire| {
            Some(TireCompoundEntry {
                tire_index: raw_tire.tire_index?,
                tire_compound_type: raw_tire.tire_compound_type.unwrap_or_default(),
            })
        })
        .collect();

    let sectors = raw
        .split_time_info
        .unwrap_or_default()
        .sectors
        .unwrap_or_default()
        .into_iter()
        .filter_map(|raw_sector| {
            Some(SectorEntry {
                sector_num: raw_sector.sector_num?,
                sector_start_pct: raw_sector.sector_start_pct?,
            })
        })
        .collect();

    let qualify_results = raw
        .qualify_results_info
        .unwrap_or_default()
        .results
        .unwrap_or_default()
        .into_iter()
        .filter_map(|raw_result| {
            Some(QualifyResultEntry {
                car_idx: raw_result.car_idx?,
                position: raw_result.position?,
                class_position: raw_result.class_position,
            })
        })
        .collect();

    let snapshot = SessionSnapshot {
        track_id: weekend.track_id.unwrap_or(-1),
        track_name: weekend.track_name.unwrap_or_default(),
        track_display_name: weekend.track_display_name.unwrap_or_default(),
        track_config_name: weekend.track_config_name.unwrap_or_default(),
        driver_pit_trk_pct: driver_info.driver_pit_trk_pct,
        track_length_m: parse_track_length(&weekend.track_length.unwrap_or_default()),
        track_pit_speed_limit: weekend.track_pit_speed_limit.unwrap_or_default(),
        track_weather_type: weekend.track_weather_type.unwrap_or_default(),
        track_air_temp: weekend.track_air_temp.unwrap_or_default(),
        track_surface_temp: weekend.track_surface_temp.unwrap_or_default(),
        track_wind_vel: weekend.track_wind_vel.unwrap_or_default(),
        track_wind_dir: weekend.track_wind_dir.unwrap_or_default(),
        track_relative_humidity: weekend.track_relative_humidity.unwrap_or_default(),
        weekend_date: weekend
            .weekend_options
            .and_then(|options| options.date)
            .unwrap_or_default(),
        current_session_num: session_info.current_session_num.unwrap_or(0),
        sessions,
        player_car_idx: driver_info.driver_car_idx.unwrap_or(-1),
        driver_car_fuel_max_ltr: driver_info
            .driver_car_fuel_max_ltr
            .filter(|v| v.is_finite()),
        driver_car_red_line: driver_info.driver_car_red_line.filter(|v| v.is_finite()),
        driver_car_sl_shift_rpm: driver_info
            .driver_car_sl_shift_rpm
            .filter(|v| v.is_finite()),
        driver_car_sl_blink_rpm: driver_info
            .driver_car_sl_blink_rpm
            .filter(|v| v.is_finite()),
        cars,
        driver_tires,
        sectors,
        qualify_results,
    };

    Some(ParsedSession {
        snapshot,
        weather_forecast,
    })
}

// ---------------------------------------------------------------------------
// Raw deserialization mirrors of the iRacing YAML sections we consume.
// Every field is Option so a missing/odd section never fails the whole parse.
// ---------------------------------------------------------------------------

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawSession {
    weekend_info: Option<RawWeekendInfo>,
    session_info: Option<RawSessionInfo>,
    driver_info: Option<RawDriverInfo>,
    split_time_info: Option<RawSplitTimeInfo>,
    qualify_results_info: Option<RawQualifyResultsInfo>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawWeekendInfo {
    #[serde(rename = "TrackID")]
    track_id: Option<i32>,
    track_name: Option<String>,
    track_display_name: Option<String>,
    track_config_name: Option<String>,
    track_length: Option<String>,
    track_pit_speed_limit: Option<String>,
    track_weather_type: Option<String>,
    track_air_temp: Option<String>,
    track_surface_temp: Option<String>,
    track_wind_vel: Option<String>,
    track_wind_dir: Option<String>,
    track_relative_humidity: Option<String>,
    weekend_options: Option<RawWeekendOptions>,
    /// Unmodeled WeekendInfo keys — the weather forecast lives here
    /// (WeatherForecastList / WeatherForecast, format varies by build).
    #[serde(flatten)]
    extra: HashMap<String, serde_yaml_ng::Value>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawWeekendOptions {
    date: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawSessionInfo {
    current_session_num: Option<i32>,
    sessions: Option<Vec<RawSessionEntry>>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawSessionEntry {
    session_type: Option<String>,
    session_laps: Option<String>,
    results_positions: Option<Vec<RawResultPosition>>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawResultPosition {
    car_idx: Option<i32>,
    position: Option<i32>,
    class_position: Option<i32>,
    lap: Option<i32>,
    time: Option<f32>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawDriverInfo {
    driver_car_idx: Option<i32>,
    driver_car_fuel_max_ltr: Option<f32>,
    driver_car_red_line: Option<f32>,
    #[serde(rename = "DriverCarSLShiftRPM")]
    driver_car_sl_shift_rpm: Option<f32>,
    #[serde(rename = "DriverCarSLBlinkRPM")]
    driver_car_sl_blink_rpm: Option<f32>,
    #[serde(rename = "DriverPitTrkPct")]
    driver_pit_trk_pct: Option<f32>,
    drivers: Option<Vec<RawDriver>>,
    driver_tires: Option<Vec<RawDriverTire>>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawDriver {
    car_idx: Option<i32>,
    user_name: Option<String>,
    car_number: Option<String>,
    #[serde(rename = "CarClassID")]
    car_class_id: Option<i32>,
    car_class_color: Option<String>,
    car_screen_name: Option<String>,
    car_screen_name_short: Option<String>,
    #[serde(rename = "IRating")]
    i_rating: Option<i32>,
    lic_string: Option<String>,
    lic_color: Option<String>,
    cur_driver_incident_count: Option<i32>,
    car_is_pace_car: Option<i32>,
    is_spectator: Option<i32>,
    car_class_est_lap_time: Option<f64>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawDriverTire {
    tire_index: Option<i32>,
    tire_compound_type: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawSplitTimeInfo {
    sectors: Option<Vec<RawSector>>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawSector {
    sector_num: Option<i32>,
    sector_start_pct: Option<f64>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawQualifyResultsInfo {
    results: Option<Vec<RawQualifyResult>>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawQualifyResult {
    car_idx: Option<i32>,
    position: Option<i32>,
    class_position: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_YAML: &str = r#"
WeekendInfo:
 TrackDisplayName: Okayama International Circuit
 TrackLength: 3.70 km
 TrackPitSpeedLimit: 56.33 kph
 TrackWeatherType: Static
 TrackAirTemp: 25.55 C
 TrackSurfaceTemp: 39.75 C
 TrackWindVel: 0.89 m/s
 TrackWindDir: 0.00 rad
 TrackRelativeHumidity: 45 %
 WeekendOptions:
  Date: 2025-05-21
SessionInfo:
 CurrentSessionNum: 1
 Sessions:
 - SessionNum: 0
   SessionType: Practice
   SessionLaps: unlimited
 - SessionNum: 1
   SessionType: Race
   SessionLaps: 20
   ResultsPositions:
   - Position: 1
     CarIdx: 7
     ClassPosition: 0
     Lap: 5
     Time: 83.123
   - Position: 2
     CarIdx: 3
     ClassPosition: 1
     Lap: 5
     Time: 84.456
DriverInfo:
 DriverCarIdx: 3
 DriverCarFuelMaxLtr: 45.500
 DriverCarRedLine: 7200.00
 DriverCarSLShiftRPM: 6900.00
 DriverCarSLBlinkRPM: 7100.00
 DriverTires:
 - TireIndex: 0
   TireCompoundType: "Hard"
 Drivers:
 - CarIdx: 3
   UserName: Test Driver
   CarNumber: "11"
   CarClassID: 4011
   CarClassColor: 0xffda59
   CarScreenName: Mazda MX-5
   CarScreenNameShort: MX-5
   IRating: 2350
   LicString: A 3.51
   LicColor: 0x0153db
   CurDriverIncidentCount: 2
   CarIsPaceCar: 0
   IsSpectator: 0
   CarClassEstLapTime: 99.1
 - CarIdx: 0
   UserName: Pace Car
   CarIsPaceCar: 1
SplitTimeInfo:
 Sectors:
 - SectorNum: 0
   SectorStartPct: 0.000000
 - SectorNum: 1
   SectorStartPct: 0.493951
QualifyResultsInfo:
 Results:
 - Position: 0
   ClassPosition: 0
   CarIdx: 3
"#;

    #[test]
    fn parses_all_consumed_sections() {
        let parsed = parse_session(SAMPLE_YAML).expect("sample YAML must parse");
        let snapshot = parsed.snapshot;

        assert_eq!(snapshot.track_display_name, "Okayama International Circuit");
        assert!((snapshot.track_length_m - 3700.0).abs() < 0.01);
        assert_eq!(snapshot.track_air_temp, "25.55 C");
        assert_eq!(snapshot.weekend_date, "2025-05-21");
        assert_eq!(snapshot.current_session_num, 1);
        assert_eq!(snapshot.sessions.len(), 2);
        assert_eq!(snapshot.sessions[0].session_laps, "unlimited");
        assert_eq!(snapshot.sessions[1].session_type, SessionType::Race);
        assert_eq!(snapshot.sessions[1].session_type_label, "Race");
        assert_eq!(snapshot.sessions[1].session_laps, "20");
        assert_eq!(snapshot.sessions[1].results_positions.len(), 2);
        assert_eq!(snapshot.sessions[1].results_positions[0].car_idx, 7);
        assert_eq!(snapshot.player_car_idx, 3);
        assert_eq!(snapshot.driver_car_fuel_max_ltr, Some(45.5));
        assert_eq!(snapshot.driver_car_red_line, Some(7200.0));
        assert_eq!(snapshot.driver_car_sl_shift_rpm, Some(6900.0));
        assert_eq!(snapshot.driver_car_sl_blink_rpm, Some(7100.0));
        assert_eq!(snapshot.cars.len(), 2);

        let player = &snapshot.cars[0];
        assert_eq!(player.car_class_id, 4011);
        assert_eq!(player.car_class_color, "#ffd259");
        assert_eq!(player.i_rating, 2350);
        assert!(!player.is_pace_car);
        assert!(snapshot.cars[1].is_pace_car);

        assert_eq!(snapshot.driver_tires[0].tire_compound_type, "Hard");
        assert_eq!(snapshot.sectors.len(), 2);
        assert!((snapshot.sectors[1].sector_start_pct - 0.493951).abs() < 1e-9);
        assert_eq!(snapshot.qualify_results.len(), 1);
        assert_eq!(snapshot.qualify_results[0].position, 0);
    }

    #[test]
    fn sanitizes_unescaped_free_text_fields() {
        let yaml = "DriverInfo:\n DriverCarIdx: 5\n Drivers:\n - CarIdx: 5\n   UserName: ? ?\n   AbbrevName: ?, ?\n   Initials: ??\n   TeamName: O'Brien: Racing\n   CarNumber: \"6\"\n";
        let parsed = parse_session(yaml).expect("sanitized YAML must parse");

        assert_eq!(parsed.snapshot.cars.len(), 1);
        assert_eq!(parsed.snapshot.cars[0].user_name, "? ?");
    }

    #[test]
    fn normalizes_class_color_applies_map() {
        assert_eq!(normalize_class_color("0xffda59"), "#ffd259");
        assert_eq!(normalize_class_color("0x53ff77"), "#ff7199");
        assert_eq!(normalize_class_color("0xAE6BFF"), "#5cecff");
    }

    #[test]
    fn normalizes_class_color_passthrough() {
        assert_eq!(normalize_class_color("0xaabbcc"), "#aabbcc");
        assert_eq!(normalize_class_color("#AABBCC"), "#aabbcc");
        assert_eq!(normalize_class_color(""), "#888888");
    }

    #[test]
    fn sanitize_keeps_quoted_values_untouched() {
        let yaml = "Drivers:\n - UserName: \"Already Quoted\"\n";

        assert_eq!(sanitize_session_yaml(yaml), yaml);
    }

    #[test]
    fn empty_yaml_yields_defaults() {
        let parsed = parse_session("---\n{}\n").expect("empty mapping must parse");

        assert_eq!(parsed.snapshot.cars.len(), 0);
        assert_eq!(parsed.snapshot.player_car_idx, -1);
        assert_eq!(parsed.snapshot.current_session_num, 0);
    }
}
