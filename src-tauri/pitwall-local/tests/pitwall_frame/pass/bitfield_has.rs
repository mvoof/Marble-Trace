use pitwall::PitwallFrame;

#[derive(PitwallFrame, Debug)]
struct SessionView {
    #[bitfield(name = "SessionFlags", has = "pitwall::irsdk_flags::session_flags::DQ_SCORING_INVALID")]
    dq_invalid: Option<bool>,
}

fn main() {}

