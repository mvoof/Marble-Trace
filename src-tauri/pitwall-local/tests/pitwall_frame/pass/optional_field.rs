use pitwall::PitwallFrame;

#[derive(PitwallFrame, Debug)]
struct SimpleOptional {
    #[field_name = "Gear"]
    gear: Option<i32>,
}

fn main() {}