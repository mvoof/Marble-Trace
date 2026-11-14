//! Statistics: session records kept in `stats.db`, and the import that reads
//! a sim's session files into them (ADR-0014). Knows no sim: the app hands it
//! the reader.

pub mod db;
pub mod import;
pub mod scan;
