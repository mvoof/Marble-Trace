//! The crew's voice out of one chosen device — the headset, while the game's
//! sound may go elsewhere.
//!
//! A device is remembered by cpal's id, which survives reboots; one that is
//! gone (a headset unplugged) falls back to the system default rather than
//! leaving the crew mute.

use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use rodio::cpal::traits::HostTrait;
use rodio::cpal::{self, DeviceId};
use rodio::{Decoder, DeviceSinkBuilder, DeviceTrait, MixerDeviceSink, Player};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

pub fn output_devices() -> Vec<AudioDevice> {
    let host = cpal::default_host();
    let default_id = host
        .default_output_device()
        .and_then(|device| device.id().ok());
    let Ok(devices) = host.output_devices() else {
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

fn output_device(id: Option<&str>) -> Option<cpal::Device> {
    let host = cpal::default_host();
    let chosen = id
        .and_then(|id| id.parse::<DeviceId>().ok())
        .and_then(|id| host.device_by_id(&id));

    if chosen.is_none() && id.is_some() {
        tracing::warn!(
            device = id,
            "voice output device not found, using the default"
        );
    }

    chosen.or_else(|| host.default_output_device())
}

pub struct Speaker {
    device_id: Option<String>,
    // Owns the output stream: dropped, the device closes and `player` goes quiet.
    _sink: MixerDeviceSink,
    player: Player,
}

impl Speaker {
    pub fn open(device_id: Option<&str>) -> Result<Self, String> {
        let device = output_device(device_id).ok_or("no audio output device")?;
        let mut sink = DeviceSinkBuilder::from_device(device)
            .and_then(|builder| builder.open_sink_or_fallback())
            .map_err(|error| error.to_string())?;

        sink.log_on_drop(false);

        let player = Player::connect_new(sink.mixer());

        Ok(Self {
            device_id: device_id.map(str::to_string),
            _sink: sink,
            player,
        })
    }

    pub fn device_id(&self) -> Option<&str> {
        self.device_id.as_deref()
    }

    pub fn play(&self, wav: &Path, volume: f32) -> Result<(), String> {
        let file = File::open(wav).map_err(|error| error.to_string())?;
        let source = Decoder::try_from(BufReader::new(file)).map_err(|error| error.to_string())?;

        self.player.stop();
        self.player.set_volume(volume.clamp(0.0, 1.0));
        self.player.append(source);
        self.player.play();

        Ok(())
    }

    /// Cuts the reply off mid-word — the driver pressed to talk.
    pub fn stop(&self) {
        self.player.stop();
    }

    pub fn set_volume(&self, volume: f32) {
        self.player.set_volume(volume.clamp(0.0, 1.0));
    }

    pub fn is_idle(&self) -> bool {
        self.player.empty()
    }
}
