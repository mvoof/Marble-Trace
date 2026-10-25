//! One tick of the driver's inputs for the trace, with how far the car is
//! sliding sideways.

use mt_model::sim::player::{CarDynamicsFrame, CarInputsFrame, InputSample};

/// Below this forward speed the slip angle swings on noise, m/s.
const MIN_SLIP_SPEED_MPS: f32 = 5.0;

/// The angle between where the car points and where it is going, degrees.
/// The sim's velocity is in the car's own frame: X forward, Y sideways.
fn body_slip_deg(dynamics: &CarDynamicsFrame) -> Option<f32> {
    match (dynamics.velocity_x, dynamics.velocity_y) {
        (Some(forward), Some(sideways)) if forward >= MIN_SLIP_SPEED_MPS => {
            Some(sideways.atan2(forward).to_degrees())
        }
        _ => None,
    }
}

pub fn input_sample(inputs: &CarInputsFrame, dynamics: &CarDynamicsFrame) -> InputSample {
    InputSample {
        throttle: inputs.throttle,
        brake: inputs.brake,
        clutch: inputs.clutch,
        brake_abs_active: inputs.brake_abs_active,
        steering_wheel_angle: dynamics.steering_wheel_angle,
        body_slip_deg: body_slip_deg(dynamics),
    }
}
