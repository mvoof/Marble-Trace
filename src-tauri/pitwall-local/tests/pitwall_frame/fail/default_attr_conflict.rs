use pitwall::PitwallFrame;

#[derive(PitwallFrame, Default, Debug)]
struct ConflictDefault {
    #[field_name = "Speed"]
    #[default = "42.0f32"]
    speed: f32,
}

fn main() {}
