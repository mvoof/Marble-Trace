//! The settings the telemetry runtime takes from the user, as one value: the
//! frontend sends them whole, on start and on every change, and the backend
//! applies them whole — never one field at a time.

use std::fmt;

use mt_model::contract::defaults::{MAX_FUEL_AVG_WINDOW, SOURCE_TICK_HZ};
use serde::Deserialize;

use crate::control::TelemetryConfig;

const MIN_CAR_LENGTH_M: f32 = 0.5;
const MAX_CAR_LENGTH_M: f32 = 15.0;

/// What `set_telemetry_settings` carries.
#[derive(Debug, Clone, Copy, PartialEq, Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySettings {
    /// The player's car length, which turns a centre-to-centre distance into
    /// the gap between bumpers.
    pub car_length_m: f32,
    /// How often a bundle is published; a divisor of `SOURCE_TICK_HZ`. The
    /// processors keep running at the source's rate (ADR-0009).
    pub overlay_update_hz: u32,
    pub pit_warning_laps: f32,
    /// Recent laps averaged for fuel use; 0 is the whole session.
    pub fuel_avg_window: u32,
    /// Whether laps under a local yellow count towards fuel use.
    pub fuel_count_yellow_laps: bool,
}

/// Why a `TelemetrySettings` was refused.
#[derive(Debug, Clone, PartialEq)]
pub enum SettingsError {
    CarLength(f32),
    OverlayUpdateHz(u32),
    PitWarningLaps(f32),
    FuelAvgWindow(u32),
}

impl fmt::Display for SettingsError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CarLength(length) => write!(
                formatter,
                "car length must be a finite value between {MIN_CAR_LENGTH_M} and {MAX_CAR_LENGTH_M} meters, got {length}"
            ),
            Self::OverlayUpdateHz(hz) => write!(
                formatter,
                "overlay update rate must divide {SOURCE_TICK_HZ} Hz evenly, got {hz} Hz"
            ),
            Self::PitWarningLaps(laps) => write!(
                formatter,
                "pit warning laps must be a finite non-negative number, got {laps}"
            ),
            Self::FuelAvgWindow(window) => write!(
                formatter,
                "fuel average window must be between 0 (all laps) and {MAX_FUEL_AVG_WINDOW}, got {window}"
            ),
        }
    }
}

impl TelemetrySettings {
    pub fn validate(&self) -> Result<(), SettingsError> {
        if !self.car_length_m.is_finite()
            || !(MIN_CAR_LENGTH_M..=MAX_CAR_LENGTH_M).contains(&self.car_length_m)
        {
            return Err(SettingsError::CarLength(self.car_length_m));
        }

        let hz = self.overlay_update_hz;

        if hz == 0 || hz > SOURCE_TICK_HZ || !SOURCE_TICK_HZ.is_multiple_of(hz) {
            return Err(SettingsError::OverlayUpdateHz(hz));
        }

        if !self.pit_warning_laps.is_finite() || self.pit_warning_laps < 0.0 {
            return Err(SettingsError::PitWarningLaps(self.pit_warning_laps));
        }

        if self.fuel_avg_window > MAX_FUEL_AVG_WINDOW {
            return Err(SettingsError::FuelAvgWindow(self.fuel_avg_window));
        }

        Ok(())
    }

    /// Writes every field into the runtime's config. Validate first.
    pub fn apply_to(&self, config: &mut TelemetryConfig) {
        config.car_length_m = self.car_length_m;
        config.overlay_update_hz = self.overlay_update_hz;
        config.fuel.pit_warning_laps = self.pit_warning_laps;
        config.fuel.avg_window = self.fuel_avg_window as usize;
        config.fuel.count_local_yellow_laps = self.fuel_count_yellow_laps;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid() -> TelemetrySettings {
        TelemetrySettings {
            car_length_m: 4.4,
            overlay_update_hz: 30,
            pit_warning_laps: 3.0,
            fuel_avg_window: 5,
            fuel_count_yellow_laps: true,
        }
    }

    #[test]
    fn accepts_the_shipped_values() {
        assert_eq!(valid().validate(), Ok(()));
    }

    #[test]
    fn refuses_each_field_out_of_range() {
        let cases = [
            TelemetrySettings {
                car_length_m: f32::NAN,
                ..valid()
            },
            TelemetrySettings {
                car_length_m: 30.0,
                ..valid()
            },
            TelemetrySettings {
                overlay_update_hz: 0,
                ..valid()
            },
            TelemetrySettings {
                overlay_update_hz: 7,
                ..valid()
            },
            TelemetrySettings {
                pit_warning_laps: -1.0,
                ..valid()
            },
            TelemetrySettings {
                fuel_avg_window: MAX_FUEL_AVG_WINDOW + 1,
                ..valid()
            },
        ];

        for settings in cases {
            assert!(settings.validate().is_err(), "{settings:?} was accepted");
        }
    }

    #[test]
    fn writes_every_field_into_the_config() {
        let mut config = TelemetryConfig::default();

        valid().apply_to(&mut config);

        assert_eq!(config.car_length_m, 4.4);
        assert_eq!(config.overlay_update_hz, 30);
        assert_eq!(config.fuel.pit_warning_laps, 3.0);
        assert_eq!(config.fuel.avg_window, 5);
        assert!(config.fuel.count_local_yellow_laps);
    }

    #[test]
    fn reads_the_frontends_names() {
        let settings: TelemetrySettings = serde_json::from_str(
            r#"{"carLengthM":4.4,"overlayUpdateHz":30,"pitWarningLaps":3,"fuelAvgWindow":5,"fuelCountYellowLaps":true}"#,
        )
        .unwrap();

        assert_eq!(settings, valid());
    }
}
