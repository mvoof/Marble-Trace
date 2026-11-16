//! The car's setup as a session file wrote it: the `CarSetup` block of the
//! file's session info, grouped as the sim's garage shows it.

use serde::{Deserialize, Serialize};

/// One garage value: the sim's key and the text it wrote, units included,
/// e.g. `StartingPressure` and `159 kPa`.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetupRow {
    pub label: String,
    pub value: String,
}

/// A part of a group, e.g. `LeftFront`. The same name recurs in other
/// groups: a row is known by group and section together.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetupSection {
    /// Empty for values that sit in the group itself.
    pub name: String,
    pub rows: Vec<SetupRow>,
}

/// A garage tab, e.g. `TiresAero`, in the file's order.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetupGroup {
    pub name: String,
    pub sections: Vec<SetupSection>,
}

/// What the setup tab shows of a file.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum CarSetupView {
    /// The file is no longer on disk.
    #[default]
    FileDeleted,
    /// The file's setup; no groups when it wrote none.
    Setup {
        /// The setup file the car was driven on, e.g. `race.sto`.
        name: Option<String>,
        groups: Vec<SetupGroup>,
    },
}
