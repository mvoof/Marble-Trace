//! The session YAML of a file: a snapshot from when the file opened. Results
//! in it lag one file behind the rows, so only the field size is taken from
//! them; the finish comes from the rows.

use std::collections::BTreeMap;

use serde::Deserialize;

use mt_model::app::stats::{SessionFile, SessionFileRun};

use super::samples::RunSamples;
use crate::session_parse::sanitize_session_yaml;

const RACE_RUN_TYPE: &str = "Race";

/// The sim writes UTF-8 when `irsdkUTF8SessionStr` is on, Latin otherwise.
pub(crate) fn decode_yaml(bytes: &[u8]) -> String {
    let end = bytes
        .iter()
        .position(|&byte| byte == 0)
        .unwrap_or(bytes.len());
    let bytes = &bytes[..end];

    match std::str::from_utf8(bytes) {
        Ok(text) => text.to_owned(),
        Err(_) => kerb::decode_cp1252(bytes),
    }
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "PascalCase")]
pub(crate) struct FileYaml {
    weekend_info: WeekendInfo,
    driver_info: DriverInfo,
    session_info: SessionInfo,
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "PascalCase")]
struct WeekendInfo {
    #[serde(rename = "SubSessionID")]
    sub_session_id: Option<i64>,
    #[serde(rename = "SessionID")]
    session_id: Option<i64>,
    #[serde(rename = "SeriesID")]
    series_id: Option<i64>,
    #[serde(rename = "SeasonID")]
    season_id: Option<i64>,
    #[serde(rename = "LeagueID")]
    league_id: Option<i64>,
    event_type: Option<String>,
    category: Option<String>,
    official: i64,
    team_racing: i64,
    #[serde(rename = "TrackID")]
    track_id: Option<i64>,
    track_display_name: Option<String>,
    track_config_name: Option<String>,
    track_country: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "PascalCase")]
struct DriverInfo {
    driver_car_idx: Option<i64>,
    drivers: Vec<Driver>,
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "PascalCase")]
struct Driver {
    car_idx: Option<i64>,
    user_name: Option<String>,
    #[serde(rename = "UserID")]
    user_id: Option<i64>,
    #[serde(rename = "IRating")]
    irating: Option<i64>,
    lic_string: Option<String>,
    #[serde(rename = "CarID")]
    car_id: Option<i64>,
    car_screen_name: Option<String>,
    car_class_short_name: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "PascalCase")]
struct SessionInfo {
    sessions: Vec<RunInfo>,
}

#[derive(Deserialize, Default)]
#[serde(default, rename_all = "PascalCase")]
struct RunInfo {
    session_num: i64,
    session_type: Option<String>,
    results_positions: Option<Vec<serde_yaml_ng::Value>>,
}

impl FileYaml {
    pub fn parse(yaml: &str) -> Result<Self, String> {
        serde_yaml_ng::from_str(&sanitize_session_yaml(yaml))
            .map_err(|error| format!("session info unreadable: {error}"))
    }

    pub fn into_session_file(
        self,
        started_at: i64,
        ended_at: i64,
        runs: BTreeMap<i64, RunSamples>,
    ) -> SessionFile {
        let weekend = self.weekend_info;
        let player_idx = self.driver_info.driver_car_idx;
        let player = self
            .driver_info
            .drivers
            .into_iter()
            .find(|driver| driver.car_idx.is_some() && driver.car_idx == player_idx)
            .unwrap_or_default();
        let run_infos = self.session_info.sessions;
        let runs = runs
            .into_iter()
            .map(|(session_num, samples)| {
                let info = run_infos
                    .iter()
                    .find(|info| info.session_num == session_num);
                let run_type = info
                    .and_then(|info| info.session_type.clone())
                    .unwrap_or_default();
                let is_race = run_type == RACE_RUN_TYPE;
                let field_size = info
                    .and_then(|info| info.results_positions.as_ref())
                    .map(|results| results.len() as i64)
                    .filter(|size| *size > 0);

                SessionFileRun {
                    session_num,
                    time_in_car_s: samples.time_in_car_s,
                    incidents: samples.incidents,
                    finish_pos: samples.finish_pos.filter(|_| is_race),
                    field_size: field_size.filter(|_| is_race),
                    laps: samples.laps,
                    run_type,
                }
            })
            .collect();

        SessionFile {
            started_at,
            ended_at,
            subsession_id: weekend.sub_session_id.filter(|id| *id > 0),
            session_id: weekend.session_id,
            series_id: weekend.series_id,
            season_id: weekend.season_id,
            league_id: weekend.league_id,
            event_type: weekend.event_type.unwrap_or_default(),
            category: weekend.category,
            official: weekend.official != 0,
            team_racing: weekend.team_racing != 0,
            track_id: weekend.track_id,
            track_name: weekend.track_display_name,
            track_config: weekend.track_config_name.filter(|name| !name.is_empty()),
            track_country: weekend.track_country,
            car_id: player.car_id,
            car_name: player.car_screen_name,
            car_class: player.car_class_short_name,
            user_id: player.user_id,
            user_name: player.user_name,
            irating: player.irating,
            licence: player.lic_string,
            runs,
        }
    }
}
