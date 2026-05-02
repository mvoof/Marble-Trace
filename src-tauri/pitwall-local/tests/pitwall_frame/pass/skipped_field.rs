use pitwall::PitwallFrame;

#[derive(PitwallFrame, Debug)]
struct SimpleSkipped {
    #[skip]
    app_data: String,
}

fn main() {}