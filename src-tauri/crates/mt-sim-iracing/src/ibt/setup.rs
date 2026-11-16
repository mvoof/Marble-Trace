//! The `CarSetup` block of a file's session info, as the garage shows it:
//! group → section → `Key: value`. Read line by line rather than through
//! serde: a YAML parser would turn `1.50` into `1.5`, and the value has to
//! stay the text the sim wrote.

use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use mt_model::app::car_setup::{CarSetupView, SetupGroup, SetupRow, SetupSection};

use super::{open_file, READ_BUFFER};

const SETUP_KEY: &str = "CarSetup:";
/// Under `DriverInfo`, one level in.
const SETUP_NAME_KEY: &str = " DriverSetupName:";
const GROUP_INDENT: usize = 1;
const SECTION_INDENT: usize = 2;

/// The setup of the file at `path`.
pub fn read_car_setup(path: &Path) -> Result<CarSetupView, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let length = file.metadata().map_err(|error| error.to_string())?.len();
    let mut reader = BufReader::with_capacity(READ_BUFFER, file);
    let opened = open_file(&mut reader, length)?;

    Ok(CarSetupView::Setup {
        name: setup_name(&opened.yaml),
        groups: parse_car_setup(&opened.yaml),
    })
}

/// `DriverInfo.DriverSetupName`: the setup file the car was driven on.
fn setup_name(yaml: &str) -> Option<String> {
    yaml.lines()
        .find_map(|line| line.strip_prefix(SETUP_NAME_KEY))
        .map(|name| name.trim().trim_matches('"').to_owned())
        .filter(|name| !name.is_empty())
}

/// The groups of the session info's `CarSetup`, in the file's order. A
/// value at the group's own depth (`UpdateCount`) is not a group and is
/// left out; values deeper than a section's belong to it.
pub(crate) fn parse_car_setup(yaml: &str) -> Vec<SetupGroup> {
    let mut groups: Vec<SetupGroup> = Vec::new();
    let lines = yaml
        .lines()
        .skip_while(|line| line.trim_end() != SETUP_KEY)
        .skip(1)
        .take_while(|line| line.is_empty() || line.starts_with(' '));

    for line in lines {
        let indent = line.len() - line.trim_start().len();
        let Some((key, value)) = line.trim().split_once(':') else {
            continue;
        };
        let value = value.trim();

        if indent <= GROUP_INDENT {
            if value.is_empty() {
                groups.push(SetupGroup {
                    name: key.to_owned(),
                    sections: Vec::new(),
                });
            }

            continue;
        }

        let Some(group) = groups.last_mut() else {
            continue;
        };

        if indent == SECTION_INDENT && value.is_empty() {
            group.sections.push(SetupSection {
                name: key.to_owned(),
                rows: Vec::new(),
            });

            continue;
        }

        let row = SetupRow {
            label: key.to_owned(),
            value: value.to_owned(),
        };
        let in_own_section = indent > SECTION_INDENT
            || group
                .sections
                .last()
                .is_some_and(|section| section.name.is_empty());

        match group.sections.last_mut() {
            Some(section) if in_own_section => section.rows.push(row),
            _ => group.sections.push(SetupSection {
                name: String::new(),
                rows: vec![row],
            }),
        }
    }

    groups.retain(|group| !group.sections.is_empty());

    groups
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A GT3 file's block, cut down: three groups, `LeftFront` in two.
    const GT3: &str = "---
WeekendInfo:
 TrackLength: 4.4837 km
CarSetup:
 UpdateCount: 3
 TiresAero:
  LeftFront:
   StartingPressure: 159 kPa
   LastTempsOMI: 35C, 35C, 35C
  AeroBalanceCalc:
   FrontRhAtSpeed: 1.50 in
 Chassis:
  LeftFront:
   CornerWeight: 3122 N
   Camber: -4.0 deg
  InCarAdjustments:
   AbsSetting: 4 (ABS)
   TcSetting: Race
 Dampers:
  FrontDampers:
   LowSpeedCompressionDamping: 8 clicks

";

    /// A Formula Vee file's block: two groups, the setup last in the YAML.
    const FORMULA_VEE: &str = "---
DriverInfo:
 DriverCarIdx: 0
CarSetup:
 UpdateCount: 1
 Tires:
  LeftFront:
   ColdPressure: 103 kPa
 Chassis:
  Front:
   BrakeBias: Medium friction
...
";

    fn row(label: &str, value: &str) -> SetupRow {
        SetupRow {
            label: label.into(),
            value: value.into(),
        }
    }

    fn section(name: &str, rows: Vec<SetupRow>) -> SetupSection {
        SetupSection {
            name: name.into(),
            rows,
        }
    }

    #[test]
    fn a_gt3_setup_keeps_the_garage_groups_and_the_values_as_written() {
        let groups = parse_car_setup(GT3);
        let names: Vec<&str> = groups.iter().map(|group| group.name.as_str()).collect();

        assert_eq!(names, ["TiresAero", "Chassis", "Dampers"]);
        assert_eq!(
            groups[0].sections,
            vec![
                section(
                    "LeftFront",
                    vec![
                        row("StartingPressure", "159 kPa"),
                        row("LastTempsOMI", "35C, 35C, 35C"),
                    ],
                ),
                section("AeroBalanceCalc", vec![row("FrontRhAtSpeed", "1.50 in")]),
            ]
        );
        assert_eq!(
            groups[1].sections[1],
            section(
                "InCarAdjustments",
                vec![row("AbsSetting", "4 (ABS)"), row("TcSetting", "Race")],
            )
        );
        assert_eq!(groups[1].sections[0].rows[1], row("Camber", "-4.0 deg"));
    }

    #[test]
    fn a_formula_vee_setup_has_its_two_groups() {
        let groups = parse_car_setup(FORMULA_VEE);

        assert_eq!(
            groups,
            vec![
                SetupGroup {
                    name: "Tires".into(),
                    sections: vec![section("LeftFront", vec![row("ColdPressure", "103 kPa")])],
                },
                SetupGroup {
                    name: "Chassis".into(),
                    sections: vec![section("Front", vec![row("BrakeBias", "Medium friction")])],
                },
            ]
        );
    }

    #[test]
    fn a_499p_setup_adds_the_systems_group() {
        let systems_last = format!(
            "{}\n Systems:\n  HybridConfig:\n   MguKDeployMode: Qual\n  Fuel:\n   FuelLevel: 40.0 L\n",
            GT3.trim_end()
        );
        let groups = parse_car_setup(&systems_last);
        let names: Vec<&str> = groups.iter().map(|group| group.name.as_str()).collect();

        assert_eq!(names, ["TiresAero", "Chassis", "Dampers", "Systems"]);
        assert_eq!(
            groups[3].sections,
            vec![
                section("HybridConfig", vec![row("MguKDeployMode", "Qual")]),
                section("Fuel", vec![row("FuelLevel", "40.0 L")]),
            ]
        );
    }

    #[test]
    fn values_in_the_group_itself_get_a_nameless_section() {
        let yaml = "CarSetup:\n Systems:\n  Fuel: 40.0 L\n  Notes: none\n";

        assert_eq!(
            parse_car_setup(yaml)[0].sections,
            vec![section(
                "",
                vec![row("Fuel", "40.0 L"), row("Notes", "none")]
            )]
        );
    }

    #[test]
    fn the_setup_file_name_comes_from_the_driver_info() {
        let yaml = "DriverInfo:\n DriverCarIdx: 0\n DriverSetupName: fixed.sto\n";

        assert_eq!(setup_name(yaml), Some("fixed.sto".into()));
        assert_eq!(setup_name(GT3), None);
        assert_eq!(setup_name("Other:\n  DriverSetupName: no.sto\n"), None);
    }

    #[test]
    fn a_file_without_a_setup_has_no_groups() {
        assert!(parse_car_setup("WeekendInfo:\n TrackLength: 1 km\n").is_empty());
        assert!(parse_car_setup("CarSetup:\n UpdateCount: 0\n").is_empty());
    }
}
