/// What commands and listeners tell the telemetry thread, and the settings it
/// is started with.
///
/// The thread owns its state; nothing outside it writes there. A command that
/// changes something is a `TelemetryCommand` on a channel the thread drains at
/// the top of each tick, so the tick never waits on a lock a command holds.
use std::sync::mpsc::{channel, Receiver, Sender};
use std::time::Instant;

use crate::computations::fuel::FuelSettings;
use crate::computations::pit_auto::PitAutoCommand;
use crate::model::defaults::DEFAULT_CAR_LENGTH_M;
use crate::model::pit_action::PitAction;
use crate::model::pit_auto::PitAutoConfig;

/// The values a command sets that must outlive a run: they are kept beside the
/// channel and handed to the next thread, so a value set while the stream is
/// stopped still applies when it starts.
#[derive(Debug, Clone, Copy)]
pub struct TelemetryConfig {
    /// The player's car length in meters.
    pub car_length_m: f32,
    pub fuel: FuelSettings,
    /// The pit strategy auto mode orders by. Starts with auto mode off: until
    /// main has pushed the user's strategy, nothing is ordered on their behalf.
    pub pit_auto: PitAutoConfig,
    /// The telemetry inspector in the settings window is open. While this is
    /// false no frame is kept for it at all — the inspector costs the running
    /// app exactly nothing when nobody is looking at it, which is why it pulls
    /// instead of subscribing: the settings window must never take the 60 Hz
    /// bundle again.
    pub inspector_active: bool,
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self {
            car_length_m: DEFAULT_CAR_LENGTH_M,
            fuel: FuelSettings::default(),
            pit_auto: PitAutoConfig::default(),
            inspector_active: false,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum TelemetryCommand {
    /// The whole config, not the one value that changed: the thread's copy is
    /// then always exactly the one the next run would be started with.
    Configure(TelemetryConfig),
    /// `track-map:force-start`: record the shape from here, not from the line.
    ForceTrackStart,
    /// `track-map:clear`: the current track's shape was deleted.
    ClearTrackShape,
    /// The pit lane markers were removed from the stored track.
    ResetPitLane,
    /// The stored reference laps for the track and car were deleted.
    ResetReferenceLap,
    /// The auto mode key.
    PitAuto(PitAutoCommand),
    /// A manual change to the pit order, from a key or a click. Resolved
    /// against the frame of the tick that drains it; `issued_at` lets a press
    /// that waited out a stall in the stream be dropped rather than sent late.
    PitAction {
        action: PitAction,
        issued_at: Instant,
    },
}

/// What a telemetry thread is started with.
pub struct TelemetryRun {
    /// Compared against `TelemetryServiceState::running`: a thread whose run is
    /// no longer the current one stops, whether the stream was stopped or a
    /// newer run was started over it.
    pub id: u64,
    pub commands: Receiver<TelemetryCommand>,
    pub config: TelemetryConfig,
}

/// The sending half and the config, under one lock: a command either reaches
/// the running thread or is folded into the config the next one starts with,
/// never neither.
pub(super) struct Control {
    sender: Sender<TelemetryCommand>,
    config: TelemetryConfig,
    last_run: u64,
}

impl Default for Control {
    fn default() -> Self {
        // No thread yet: what is sent before the first start goes nowhere, and
        // the config carries what matters of it.
        let (sender, _) = channel();

        Self {
            sender,
            config: TelemetryConfig::default(),
            last_run: 0,
        }
    }
}

impl Control {
    pub(super) fn send(&self, command: TelemetryCommand) {
        // Fails only while no thread is running, which the config covers.
        let _ = self.sender.send(command);
    }

    pub(super) fn configure(&mut self, change: impl FnOnce(&mut TelemetryConfig)) {
        change(&mut self.config);
        self.send(TelemetryCommand::Configure(self.config));
    }

    /// A fresh channel for a new thread. Replacing the sender disconnects the
    /// previous run's receiver, so nothing meant for the new run is drained by
    /// a thread that is on its way out.
    pub(super) fn begin_run(&mut self) -> TelemetryRun {
        let (sender, commands) = channel();

        self.sender = sender;
        self.last_run += 1;

        TelemetryRun {
            id: self.last_run,
            commands,
            config: self.config,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_value_set_before_the_start_reaches_the_thread() {
        let mut control = Control::default();

        control.configure(|config| config.car_length_m = 5.0);

        let run = control.begin_run();

        assert_eq!(run.config.car_length_m, 5.0);
    }

    #[test]
    fn a_new_run_takes_the_commands_away_from_the_old_one() {
        let mut control = Control::default();
        let old = control.begin_run();
        let new = control.begin_run();

        control.send(TelemetryCommand::ForceTrackStart);

        assert!(old.commands.try_recv().is_err());
        assert!(matches!(
            new.commands.try_recv(),
            Ok(TelemetryCommand::ForceTrackStart)
        ));
        assert!(new.id > old.id);
    }
}
