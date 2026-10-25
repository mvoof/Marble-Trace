//! Who gets which field, when, and how it travels: the demand masks,
//! the tiers' schedule, the per-recipient plan, deduplication, rounding
//! and the counters of what went out.

pub mod counters;
pub mod dispatch;
pub mod masks;
pub mod publications;
pub mod quantize;
pub mod scheduler;
