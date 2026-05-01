use pitwall::PitwallFrame;

#[derive(PitwallFrame, Debug)]
struct IncidentView {
    #[bitfield_map(name = "IncidentFlags", decoder = "pitwall::decode_incident")]
    incident: Option<pitwall::IncidentClassification>,
}

fn main() {}

