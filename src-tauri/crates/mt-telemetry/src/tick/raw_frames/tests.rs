use super::*;
use mt_model::sim::player::InputSample;

fn sample_with_throttle(throttle: f32) -> InputSample {
    InputSample {
        throttle,
        brake: 0.0,
        clutch: None,
        brake_abs_active: false,
        steering_wheel_angle: 0.0,
        body_slip_deg: None,
    }
}

#[test]
fn input_samples_keep_every_tick_oldest_first() {
    let mut samples = Vec::new();

    record_input_sample(&mut samples, sample_with_throttle(0.1));
    record_input_sample(&mut samples, sample_with_throttle(0.2));

    let throttles: Vec<f32> = samples.iter().map(|sample| sample.throttle).collect();

    assert_eq!(throttles, vec![0.1, 0.2]);
}

#[test]
fn a_stalled_publication_drops_the_oldest_input_samples() {
    let mut samples = Vec::new();
    let overflow = 5;

    for tick in 0..MAX_INPUT_SAMPLES + overflow {
        record_input_sample(&mut samples, sample_with_throttle(tick as f32));
    }

    assert_eq!(samples.len(), MAX_INPUT_SAMPLES);
    assert_eq!(samples[0].throttle, overflow as f32);
}
