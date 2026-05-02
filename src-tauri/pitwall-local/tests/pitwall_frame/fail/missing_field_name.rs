use pitwall::PitwallFrame;

#[derive(PitwallFrame, Debug)]
struct MissingFieldName {
    // Should fail: no #[field_name] and not #[skip]
    speed: f32,
}

fn main() {}