use pitwall::PitwallFrame;

#[derive(PitwallFrame, Debug)]
struct SimpleRequired {
    #[field_name = "Speed"]
    speed: f32,
}

fn main() {}