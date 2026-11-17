//! Statistics: session records kept in `stats.db`, and the import that reads
//! a sim's session files into them (ADR-0014). Knows no sim: the app hands it
//! the reader.

pub mod analysis;
pub mod db;
pub mod export;
pub mod home;
pub mod import;
pub mod lap_cache;
pub mod lap_store;
pub mod scan;
pub mod sessions;
