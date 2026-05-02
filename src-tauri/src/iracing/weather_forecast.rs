use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::enums::Skies;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "PascalCase")]
#[serde(default)]
pub struct WeatherForecastEntry {
    pub time: f32,
    pub temp: f32,
    #[serde(alias = "WindSpeed")]
    pub wind_speed: f32,
    #[serde(alias = "WindDir")]
    pub wind_dir: f32,
    pub skies: Skies,
    pub humidity: f32,
    pub fog: f32,
    #[serde(alias = "Precipitation", alias = "RainProbability")]
    pub rain_pct: f32,
}

pub fn parse_weather_forecast(
    unknown_fields: &HashMap<String, serde_yaml_ng::Value>,
) -> Vec<WeatherForecastEntry> {
    fn find_key_case_insensitive<'a>(
        map: &'a HashMap<String, serde_yaml_ng::Value>,
        target: &str,
    ) -> Option<&'a serde_yaml_ng::Value> {
        let target_lower = target.to_lowercase();
        for (k, v) in map {
            if k.to_lowercase() == target_lower {
                return Some(v);
            }
        }
        None
    }

    fn find_key_in_value<'a>(
        value: &'a serde_yaml_ng::Value,
        target: &str,
    ) -> Option<&'a serde_yaml_ng::Value> {
        if let Some(map) = value.as_mapping() {
            let target_lower = target.to_lowercase();
            for (k, v) in map {
                if let Some(k_str) = k.as_str() {
                    if k_str.to_lowercase() == target_lower {
                        return Some(v);
                    }
                }
            }
        }
        None
    }

    fn try_extract_sequence(value: &serde_yaml_ng::Value) -> Option<Vec<WeatherForecastEntry>> {
        if let Some(seq) = value.as_sequence() {
            let entries: Vec<WeatherForecastEntry> = seq
                .iter()
                .filter_map(|entry| {
                    match serde_yaml_ng::from_value::<WeatherForecastEntry>(entry.clone()) {
                        Ok(e) => Some(e),
                        Err(err) => {
                            tracing::debug!("Failed to deserialize WeatherForecastEntry: {}", err);
                            None
                        }
                    }
                })
                .collect();
            if !entries.is_empty() {
                return Some(entries);
            }
        }
        None
    }

    // 1. Look for WeatherForecastList
    if let Some(list_val) = find_key_case_insensitive(unknown_fields, "WeatherForecastList") {
        // Try as map with WeatherForecast key
        if let Some(entries) = find_key_in_value(list_val, "WeatherForecast") {
            if let Some(res) = try_extract_sequence(entries) {
                return res;
            }
        }
        // Try as direct sequence
        if let Some(res) = try_extract_sequence(list_val) {
            return res;
        }
    }

    // 2. Look for WeatherForecast directly
    if let Some(wf_val) = find_key_case_insensitive(unknown_fields, "WeatherForecast") {
        // Try as sequence directly
        if let Some(res) = try_extract_sequence(wf_val) {
            return res;
        }
        // Try as map with ForecastEntries key
        if let Some(entries) = find_key_in_value(wf_val, "ForecastEntries") {
            if let Some(res) = try_extract_sequence(entries) {
                return res;
            }
        }
        // Try as map with WeatherForecast key (nested)
        if let Some(entries) = find_key_in_value(wf_val, "WeatherForecast") {
            if let Some(res) = try_extract_sequence(entries) {
                return res;
            }
        }
    }

    vec![]
}
