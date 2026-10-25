//! iRacing source adapter (kerb IRsdkConnection)

pub mod car_badges;
pub mod car_classes;
pub mod flags;
pub mod frame_map;
pub mod pit_command;
pub mod session_parse;
pub mod source;
pub mod weather;

#[cfg(feature = "dev")]
use crate::sources::source::SessionParsers;

/// How iRacing's session YAML is read, for a tape recorded from iRacing.
#[cfg(feature = "dev")]
pub const SESSION_PARSERS: SessionParsers = SessionParsers {
    session: session_parse::parse_session,
    tree: session_parse::session_tree,
};
