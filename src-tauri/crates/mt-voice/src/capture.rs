//! The microphone, open only while push-to-talk is held: nothing is listened
//! to between presses.
//!
//! Audio is taken at the device's own rate and format and handed on as mono
//! 16-bit samples; Vosk resamples to its model's rate itself, so no resampler
//! sits here.

use rodio::cpal::traits::{HostTrait, StreamTrait};
use rodio::cpal::{self, DeviceId, SampleFormat, Stream, StreamConfig};
use rodio::DeviceTrait;

use crate::playback::AudioDevice;

pub fn input_devices() -> Vec<AudioDevice> {
    let host = cpal::default_host();
    let default_id = host
        .default_input_device()
        .and_then(|device| device.id().ok());
    let Ok(devices) = host.input_devices() else {
        return Vec::new();
    };

    devices
        .filter_map(|device| {
            let id = device.id().ok()?;

            Some(AudioDevice {
                is_default: Some(&id) == default_id.as_ref(),
                id: id.to_string(),
                name: device.to_string(),
            })
        })
        .collect()
}

fn input_device(id: Option<&str>) -> Option<cpal::Device> {
    let host = cpal::default_host();
    let chosen = id
        .and_then(|id| id.parse::<DeviceId>().ok())
        .and_then(|id| host.device_by_id(&id));

    if chosen.is_none() && id.is_some() {
        tracing::warn!(
            device = id,
            "voice input device not found, using the default"
        );
    }

    chosen.or_else(|| host.default_input_device())
}

/// A running capture; dropping it closes the microphone.
pub struct Capture {
    _stream: Stream,
    pub sample_rate: u32,
}

impl Capture {
    pub fn start(
        device_id: Option<&str>,
        on_samples: impl FnMut(Vec<i16>) + Send + 'static,
    ) -> Result<Self, String> {
        let device = input_device(device_id).ok_or("no microphone")?;
        let supported = device
            .default_input_config()
            .map_err(|error| error.to_string())?;
        let config: StreamConfig = supported.config();
        let channels = usize::from(config.channels.max(1));
        let on_error = |error| tracing::warn!(%error, "microphone stream error");
        let stream = match supported.sample_format() {
            SampleFormat::F32 => {
                let mut on_samples = on_samples;

                device.build_input_stream::<f32, _, _>(
                    config,
                    move |data, _| on_samples(mono(data, channels, f32_to_i16)),
                    on_error,
                    None,
                )
            }
            SampleFormat::I16 => {
                let mut on_samples = on_samples;

                device.build_input_stream::<i16, _, _>(
                    config,
                    move |data, _| on_samples(mono(data, channels, |sample| sample)),
                    on_error,
                    None,
                )
            }
            other => return Err(format!("unsupported microphone format {other:?}")),
        }
        .map_err(|error| error.to_string())?;

        stream.play().map_err(|error| error.to_string())?;

        Ok(Self {
            _stream: stream,
            sample_rate: config.sample_rate,
        })
    }
}

fn f32_to_i16(sample: f32) -> i16 {
    (sample.clamp(-1.0, 1.0) * f32::from(i16::MAX)) as i16
}

/// One sample per frame: the channels' average.
fn mono<T: Copy>(data: &[T], channels: usize, to_i16: impl Fn(T) -> i16) -> Vec<i16> {
    data.chunks(channels)
        .map(|frame| {
            let sum: i32 = frame.iter().map(|sample| i32::from(to_i16(*sample))).sum();

            (sum / frame.len() as i32) as i16
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn averages_the_channels_of_each_frame() {
        assert_eq!(
            mono(&[100i16, 300, -50, 50], 2, |sample| sample),
            vec![200, 0]
        );
    }

    #[test]
    fn scales_float_samples_and_clips_them() {
        assert_eq!(f32_to_i16(0.5), 16383);
        assert_eq!(f32_to_i16(2.0), i16::MAX);
    }
    /// Opens the default microphone for half a second and checks samples
    /// arrive. Nothing is kept.
    #[test]
    #[ignore = "opens the real default microphone"]
    fn captures_from_the_default_microphone() {
        use std::sync::mpsc;
        use std::time::Duration;

        let (sender, received) = mpsc::channel();
        let capture = Capture::start(None, move |chunk| {
            let _ = sender.send(chunk.len());
        })
        .unwrap();

        std::thread::sleep(Duration::from_millis(500));
        drop(capture);

        let samples: usize = received.try_iter().sum();

        println!("{samples} samples in 500 ms");
        assert!(samples > 0);
    }
}
