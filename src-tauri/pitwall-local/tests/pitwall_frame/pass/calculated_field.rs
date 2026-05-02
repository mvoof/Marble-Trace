use pitwall::PitwallFrame;

#[derive(PitwallFrame, Debug)]
struct SimpleCalculated {
    #[calculated = "42i32"]
    value: i32,
}

fn main() {}