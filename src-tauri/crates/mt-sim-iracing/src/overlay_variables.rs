//! The iRacing variables the overlay reads, for the voice crew's question
//! editor: a question's reply may name any of them as `{sim.<Variable>}`.
//!
//! Generated, not written: the fields this crate reads off kerb's
//! `IracingFrame`, each with the name, type, unit and description kerb's own
//! source gives it, so the list cannot drift from the adapter. Run with
//! `UPDATE_BINDINGS=1 cargo test --features dev` to rewrite the file; without it the test compares the
//! checked-in file with the code.

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    reason = "a test-only generator; a panic is how it fails"
)]

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::process::Command;

use mt_model::app::crew::QUESTION_VALUES;
use mt_model::contract::generated_paths::IRACING_VARIABLES_PATH;
use serde::Serialize;

/// Variables the engineer already reads into a value of its own, which the
/// editor offers first: `{fuel}` rather than `{sim.FuelLevel}`. Each is the
/// variable `frame_map` maps onto the field `update_view`
/// (`mt-telemetry/src/crew.rs`) fills that value from.
const READY_VALUES: &[(&str, &str)] = &[
    ("AirTemp", "airTemp"),
    ("TrackTempCrew", "trackTemp"),
    ("Precipitation", "rain"),
    ("TrackWetness", "wetness"),
    ("WindVel", "wind"),
    ("FuelLevel", "fuel"),
    ("Lap", "lap"),
    ("SessionLapsRemainEx", "lapsLeft"),
    ("SessionTimeRemain", "minutesLeft"),
    ("PlayerCarClassPosition", "position"),
];

const FRAME_ACCESS: &str = "frame.";
const FRAME_STRUCT: &str = "pub struct IracingFrame {";
const VARIABLE_LOOKUP: &str = ": vars.get(\"";
const KERB_TYPES: &str = "src/iracing/types.rs";
const PER_CAR_PREFIX: &str = "CarIdx";
/// iRacing's per-car arrays hold one entry per car slot.
const PER_CAR_COUNT: u32 = 64;
const THIS_FILE: &str = "overlay_variables.rs";

/// One variable, in the shape of `RawVarMeta` plus the ready value.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OverlayVariable {
    name: String,
    type_name: String,
    unit: String,
    desc: String,
    count: u32,
    ready: Option<String>,
}

/// A field of kerb's `IracingFrame`: its Rust type and doc comment.
struct KerbField {
    rust_type: String,
    doc: String,
}

/// Every `frame.<field>` this crate's source reads.
fn fields_read() -> BTreeSet<String> {
    let mut fields = BTreeSet::new();
    let mut pending = vec![Path::new(env!("CARGO_MANIFEST_DIR")).join("src")];

    while let Some(directory) = pending.pop() {
        for entry in std::fs::read_dir(&directory).unwrap() {
            let path = entry.unwrap().path();

            if path.is_dir() {
                pending.push(path);
                continue;
            }

            let is_source = path.extension().is_some_and(|extension| extension == "rs");
            let is_this_file = path.file_name().is_some_and(|name| name == THIS_FILE);

            if is_source && !is_this_file {
                collect_frame_reads(&std::fs::read_to_string(&path).unwrap(), &mut fields);
            }
        }
    }

    fields
}

fn collect_frame_reads(source: &str, fields: &mut BTreeSet<String>) {
    let is_identifier = |character: char| character.is_ascii_alphanumeric() || character == '_';

    for (start, _) in source.match_indices(FRAME_ACCESS) {
        let preceded_by_identifier = source[..start]
            .chars()
            .next_back()
            .is_some_and(is_identifier);

        if preceded_by_identifier {
            continue;
        }

        let field: String = source[start + FRAME_ACCESS.len()..]
            .chars()
            .take_while(|&character| is_identifier(character))
            .collect();

        if !field.is_empty() {
            fields.insert(field);
        }
    }
}

/// Where cargo unpacked the kerb this workspace builds against.
fn kerb_source() -> PathBuf {
    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".into());
    let output = Command::new(cargo)
        .args(["metadata", "--format-version", "1"])
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .output()
        .unwrap();

    assert!(output.status.success(), "cargo metadata failed");

    let metadata: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    let manifest = metadata["packages"]
        .as_array()
        .unwrap()
        .iter()
        .find(|package| package["name"] == "kerb")
        .and_then(|package| package["manifest_path"].as_str())
        .expect("kerb is a dependency");

    Path::new(manifest).parent().unwrap().join(KERB_TYPES)
}

/// `IracingFrame`'s fields by name.
fn kerb_fields(source: &str) -> BTreeMap<String, KerbField> {
    let mut fields = BTreeMap::new();
    let mut doc: Vec<&str> = Vec::new();
    let body = source
        .lines()
        .skip_while(|line| !line.starts_with(FRAME_STRUCT))
        .skip(1)
        .take_while(|line| !line.starts_with('}'));

    for line in body {
        let line = line.trim();

        if let Some(text) = line.strip_prefix("///") {
            doc.push(text.trim());
        } else if let Some((name, rust_type)) = line
            .strip_prefix("pub ")
            .and_then(|field| field.trim_end_matches(',').split_once(": "))
        {
            fields.insert(
                name.to_owned(),
                KerbField {
                    rust_type: rust_type.to_owned(),
                    doc: doc.join(" "),
                },
            );
            doc.clear();
        }
    }

    fields
}

/// iRacing's own variable name for each field: `speed: vars.get("Speed")`.
fn iracing_names(source: &str) -> BTreeMap<String, String> {
    source
        .lines()
        .filter_map(|line| {
            let (field, rest) = line.trim().split_once(VARIABLE_LOOKUP)?;
            let (name, _) = rest.split_once('"')?;

            Some((field.to_owned(), name.to_owned()))
        })
        .collect()
}

/// `"GPS vehicle speed [m/s]"` → description and unit.
fn split_unit(doc: &str) -> (String, String) {
    if let Some(open) = doc.rfind('[').filter(|_| doc.ends_with(']')) {
        let unit = &doc[open + 1..doc.len() - 1];

        return (doc[..open].trim().to_owned(), unit.to_owned());
    }

    (doc.to_owned(), String::new())
}

/// kerb's Rust type as the sim's storage type, and how many values it holds.
fn storage_type(name: &str, rust_type: &str) -> (String, u32) {
    let (scalar, count) = match rust_type
        .strip_prefix("Vec<")
        .and_then(|inner| inner.strip_suffix('>'))
    {
        Some(inner) => {
            assert!(
                name.starts_with(PER_CAR_PREFIX),
                "{name}: only per-car arrays have a known length"
            );

            (inner, PER_CAR_COUNT)
        }
        None => (rust_type, 1),
    };
    let type_name = match scalar {
        "f32" => "float",
        "f64" => "double",
        "i32" => "int",
        "bool" => "bool",
        other => panic!("{name}: kerb type {other} has no storage type"),
    };

    (type_name.to_owned(), count)
}

fn overlay_variables() -> Vec<OverlayVariable> {
    let source = std::fs::read_to_string(kerb_source()).unwrap();
    let kerb = kerb_fields(&source);
    let names = iracing_names(&source);
    let ready: BTreeMap<&str, &str> = READY_VALUES.iter().copied().collect();
    let mut variables: Vec<OverlayVariable> = fields_read()
        .into_iter()
        .filter_map(|field| {
            let kerb_field = kerb.get(&field)?;
            let name = names
                .get(&field)
                .unwrap_or_else(|| panic!("{field}: no iRacing name in kerb"))
                .clone();
            let (desc, unit) = split_unit(&kerb_field.doc);
            let (type_name, count) = storage_type(&name, &kerb_field.rust_type);

            Some(OverlayVariable {
                ready: ready.get(name.as_str()).map(|&value| value.to_owned()),
                name,
                type_name,
                unit,
                desc,
                count,
            })
        })
        .collect();

    variables.sort_by(|left, right| left.name.cmp(&right.name));
    variables
}

#[test]
fn the_checked_in_variable_list_is_current() {
    let variables = overlay_variables();

    if std::env::var("UPDATE_BINDINGS").is_ok() {
        let json = serde_json::to_string_pretty(&variables).unwrap();

        std::fs::write(IRACING_VARIABLES_PATH, format!("{json}\n")).unwrap();

        return;
    }

    // Compared as JSON, not as bytes: `oxfmt` formats the file after it is written.
    let checked_in: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(IRACING_VARIABLES_PATH)
            .expect("iracing-variables.json is missing — regenerate with UPDATE_BINDINGS=1"),
    )
    .unwrap();

    assert_eq!(
        checked_in,
        serde_json::to_value(&variables).unwrap(),
        "iracing-variables.json is stale.\n\
         Rerun with UPDATE_BINDINGS=1 cargo test --features dev, then npm run format."
    );
}

#[test]
fn every_ready_value_is_a_listed_variable_and_a_question_value() {
    let variables = overlay_variables();

    for (name, value) in READY_VALUES {
        assert!(
            QUESTION_VALUES.contains(value),
            "{value} is not a question value"
        );
        assert!(
            variables.iter().any(|variable| variable.name == *name),
            "{name} is not read by the overlay"
        );
    }
}

#[test]
fn reads_units_and_descriptions_from_kerb() {
    let variables = overlay_variables();
    let find = |name: &str| {
        variables
            .iter()
            .find(|variable| variable.name == name)
            .unwrap_or_else(|| panic!("{name} is listed"))
    };

    assert_eq!(find("Speed").unit, "m/s");
    assert_eq!(find("Speed").desc, "GPS vehicle speed");
    assert_eq!(find("PlayerCarMyIncidentCount").type_name, "int");
    assert!(!find("PlayerCarMyIncidentCount").desc.is_empty());
    assert_eq!(find("CarIdxPosition").count, PER_CAR_COUNT);
}
