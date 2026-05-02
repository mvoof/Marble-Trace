use pitwall::PitwallFrame;

#[derive(PitwallFrame, Debug)]
struct SimpleDefault {
    #[field_name = "Speed"]
    #[missing = "100.0f32"]
    speed: f32,
}

fn main() {}
