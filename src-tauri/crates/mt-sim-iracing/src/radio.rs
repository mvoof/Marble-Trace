//! The session's `RadioInfo` section: the frequencies a transmission is on.
//!
//! @see https://sajax.github.io/irsdkdocs/yaml/radioinfo/

use serde::Deserialize;

use mt_model::sim::radio::{RadioChannel, RadioFrequencyEntry};

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
pub(crate) struct RawRadioInfo {
    radios: Option<Vec<RawRadio>>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawRadio {
    radio_num: Option<i32>,
    frequencies: Option<Vec<RawFrequency>>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
struct RawFrequency {
    frequency_num: Option<i32>,
    frequency_name: Option<String>,
}

pub(crate) fn parse_radio_frequencies(raw: Option<RawRadioInfo>) -> Vec<RadioFrequencyEntry> {
    raw.unwrap_or_default()
        .radios
        .unwrap_or_default()
        .into_iter()
        .filter_map(|radio| Some((radio.radio_num?, radio.frequencies.unwrap_or_default())))
        .flat_map(|(radio_num, frequencies)| {
            frequencies.into_iter().filter_map(move |frequency| {
                let name = frequency.frequency_name.unwrap_or_default();

                Some(RadioFrequencyEntry {
                    radio_num,
                    frequency_num: frequency.frequency_num?,
                    channel: channel_of(&name),
                    name,
                })
            })
        })
        .collect()
}

/// iRacing names its built-in frequencies with an `@` prefix; anything else
/// is one a driver or a league created.
fn channel_of(name: &str) -> RadioChannel {
    match name.to_ascii_uppercase().as_str() {
        "@ALLTEAMS" | "@DRIVERS" => RadioChannel::All,
        "@TEAM" => RadioChannel::Team,
        "@RACECONTROL" | "@ADMIN" => RadioChannel::RaceControl,
        "@CLUB" => RadioChannel::Club,
        _ => RadioChannel::Other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RADIO_INFO: &str = r#"
Radios:
 - RadioNum: 0
   Frequencies:
   - FrequencyNum: 0
     FrequencyName: "@ALLTEAMS"
   - FrequencyNum: 1
     FrequencyName: "@DRIVERS"
   - FrequencyNum: 2
     FrequencyName: "@TEAM"
   - FrequencyNum: 3
     FrequencyName: "@CLUB"
   - FrequencyNum: 4
     FrequencyName: "@RACECONTROL"
   - FrequencyNum: 5
     FrequencyName: "Spotters"
"#;

    #[test]
    fn names_every_built_in_frequency() {
        let raw: RawRadioInfo = serde_yaml_ng::from_str(RADIO_INFO).unwrap();
        let channels: Vec<_> = parse_radio_frequencies(Some(raw))
            .into_iter()
            .map(|entry| (entry.frequency_num, entry.channel))
            .collect();

        assert_eq!(
            channels,
            vec![
                (0, RadioChannel::All),
                (1, RadioChannel::All),
                (2, RadioChannel::Team),
                (3, RadioChannel::Club),
                (4, RadioChannel::RaceControl),
                (5, RadioChannel::Other),
            ]
        );
    }

    #[test]
    fn no_radio_section_is_no_frequencies() {
        assert!(parse_radio_frequencies(None).is_empty());
    }
}
