use pitwall::PitwallFrame;

#[derive(PitwallFrame, Debug)]
struct DefaultFieldsOnly {
    #[field_name = "Speed"]
    #[missing = "0.0"]
    speed: f32,

    #[field_name = "RPM"]
    #[missing = "0i32"]
    rpm: i32,
}

fn main() {}
