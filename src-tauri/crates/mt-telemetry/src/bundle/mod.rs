use crate::delivery::quantize;
use mt_computations::field::relative::RelativeFrame;
use mt_computations::{
    driving::coach, driving::corner_speeds, field::driver_entries, field::pace_car,
    field::proximity, rating::incidents, rating::safety_rating, strategy::fuel,
    strategy::pit_stops, timing::lap_delta, ComputedOutput,
};
use mt_model::computed::lap_log::LapLogFrame;
use mt_model::computed::track_shape::TrackRecordingFrame;
use mt_model::contract::telemetry_events::{
    EVENT_CAR_DYNAMICS, EVENT_CAR_INPUTS, EVENT_CAR_POSITIONS, EVENT_COACH, EVENT_CORNER_SPEEDS,
    EVENT_DRIVER_ENTRIES, EVENT_INCIDENTS, EVENT_INPUT_SAMPLES, EVENT_LAP_DELTA, EVENT_PROXIMITY,
    EVENT_RELATIVE, EVENT_SAFETY_RATING,
};
use mt_model::pit::pit_auto::PitAutoFrame;
use mt_model::sim::cars::{CarIdxFrame, CarPositionsFrame};
use mt_model::sim::environment::EnvironmentFrame;
use mt_model::sim::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, InputSample, LapTimingFrame,
    PitServiceFrame, PitTargetFrame,
};
use mt_model::sim::radio::RadioFrame;
use mt_model::sim::session::SessionFrame;

#[derive(Debug, serde::Serialize, Clone, Default)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TelemetryBundle {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub car_dynamics: Option<CarDynamicsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub car_inputs: Option<CarInputsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_samples: Option<Vec<InputSample>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub car_positions: Option<CarPositionsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lap_delta: Option<lap_delta::LapDeltaFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coach: Option<coach::CoachFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub corner_speeds: Option<corner_speeds::CornerSpeedsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub car_idx: Option<CarIdxFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chassis: Option<ChassisFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lap_timing: Option<LapTimingFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proximity: Option<proximity::ProximityFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub incidents: Option<incidents::IncidentsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pace_car: Option<pace_car::PaceCarFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub radio: Option<RadioFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relative: Option<RelativeFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub driver_entries: Option<driver_entries::DriverEntriesFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub car_status: Option<CarStatusFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fuel: Option<fuel::FuelComputedFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pit_stops: Option<pit_stops::PitStopsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub safety_rating: Option<safety_rating::SafetyRatingFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pit_service: Option<PitServiceFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lap_log: Option<LapLogFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session: Option<SessionFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<EnvironmentFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub track_recording: Option<TrackRecordingFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pit_target: Option<PitTargetFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pit_auto: Option<PitAutoFrame>,
}

impl TelemetryBundle {
    /// Whether the bundle holds a field that arrives at 10 Hz or slower. The
    /// remote rate limit thins only the ticks that hold none: dropping one
    /// that carries the session clock or the fuel numbers would make them skip
    /// with the motion data.
    ///
    /// Every field is named, with no `..`: a field added to the bundle does not
    /// compile until it is sorted here as overlay-clock or slow.
    pub fn carries_slow_fields(&self) -> bool {
        let Self {
            // On the overlay clock.
            car_dynamics: _,
            car_inputs: _,
            input_samples: _,
            car_positions: _,
            lap_delta: _,
            coach: _,
            corner_speeds: _,
            incidents: _,
            pit_target: _,
            // Slower than the overlay clock.
            car_idx,
            pace_car,
            radio,
            chassis,
            lap_timing,
            proximity,
            driver_entries,
            relative,
            car_status,
            fuel,
            pit_stops,
            pit_service,
            pit_auto,
            session,
            environment,
            lap_log,
            track_recording,
            safety_rating,
        } = self;

        car_idx.is_some()
            || pace_car.is_some()
            || radio.is_some()
            || chassis.is_some()
            || lap_timing.is_some()
            || proximity.is_some()
            || driver_entries.is_some()
            || relative.is_some()
            || car_status.is_some()
            || fuel.is_some()
            || pit_stops.is_some()
            || pit_service.is_some()
            || pit_auto.is_some()
            || session.is_some()
            || environment.is_some()
            || lap_log.is_some()
            || track_recording.is_some()
            || safety_rating.is_some()
    }
}

/// The 4 Hz slice for a window that does not draw widgets.
///
/// The main window is off the bundle (see `SimStore.subscribeBundle`), but it
/// switches layouts by session context, and whether the car is on track is
/// part of that context. The hotkeys no longer need anything from it — they
/// are dispatched here, on the telemetry thread's own frames — so the slice is
/// down to the one frame that answers that.
#[derive(Debug, serde::Serialize, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySlowBundle {
    pub car_status: CarStatusFrame,
}

/// Removes from `bundle` every demand-gated field the mask does not ask for.
///
/// The four 60 Hz fields are already left out at assembly, so for them this is
/// a no-op; stating all of them in one place is what makes the function a
/// complete answer to *what may this bundle carry*, which is what the delivery
/// counters are compared against.
pub fn apply_event_mask(bundle: &mut TelemetryBundle, active_mask: u32) {
    if (active_mask & EVENT_CAR_DYNAMICS) == 0 {
        bundle.car_dynamics = None;
    }

    if (active_mask & EVENT_CAR_INPUTS) == 0 {
        bundle.car_inputs = None;
    }

    if (active_mask & EVENT_CAR_POSITIONS) == 0 {
        bundle.car_positions = None;
    }

    if (active_mask & EVENT_LAP_DELTA) == 0 {
        bundle.lap_delta = None;
    }

    if (active_mask & EVENT_DRIVER_ENTRIES) == 0 {
        bundle.driver_entries = None;
    }

    if (active_mask & EVENT_RELATIVE) == 0 {
        bundle.relative = None;
    }

    if (active_mask & EVENT_PROXIMITY) == 0 {
        bundle.proximity = None;
    }

    if (active_mask & EVENT_INCIDENTS) == 0 {
        bundle.incidents = None;
    }

    if (active_mask & EVENT_COACH) == 0 {
        bundle.coach = None;
    }

    if (active_mask & EVENT_SAFETY_RATING) == 0 {
        bundle.safety_rating = None;
    }

    if (active_mask & EVENT_CORNER_SPEEDS) == 0 {
        bundle.corner_speeds = None;
    }

    if (active_mask & EVENT_INPUT_SAMPLES) == 0 {
        bundle.input_samples = None;
    }
}

pub(crate) fn quantize_bundle(bundle: &mut TelemetryBundle) {
    if let Some(frame) = bundle.car_positions.as_mut() {
        quantize::car_positions(frame);
    }

    if let Some(frame) = bundle.car_idx.as_mut() {
        quantize::car_idx(frame);
    }

    if let Some(frame) = bundle.driver_entries.as_mut() {
        quantize::driver_entries(frame);
    }

    if let Some(frame) = bundle.relative.as_mut() {
        quantize::relative(frame);
    }

    if let Some(frame) = bundle.proximity.as_mut() {
        quantize::proximity(frame);
    }

    if let Some(frame) = bundle.pit_target.as_mut() {
        quantize::pit_target(frame);
    }

    if let Some(frame) = bundle.coach.as_mut() {
        quantize::coach(frame);
    }

    if let Some(frame) = bundle.safety_rating.as_mut() {
        quantize::safety_rating(frame);
    }

    if let Some(frame) = bundle.corner_speeds.as_mut() {
        quantize::corner_speeds(frame);
    }
}

pub(crate) fn scatter_output(bundle: &mut TelemetryBundle, output: ComputedOutput) {
    match output {
        ComputedOutput::Fuel(frame) => bundle.fuel = Some(frame),
        ComputedOutput::LapDelta(frame) => bundle.lap_delta = Some(frame),
        ComputedOutput::Coach(frame) => bundle.coach = Some(frame),
        ComputedOutput::CornerSpeeds(frame) => bundle.corner_speeds = Some(frame),
        ComputedOutput::LapLog(frame) => bundle.lap_log = Some(frame),
        ComputedOutput::PitStops(frame) => bundle.pit_stops = Some(frame),
        ComputedOutput::Proximity(frame) => bundle.proximity = Some(frame),
        ComputedOutput::Incidents(frame) => bundle.incidents = Some(frame),
        ComputedOutput::PaceCar(frame) => bundle.pace_car = Some(frame),
        ComputedOutput::Relative(frame) => bundle.relative = Some(frame),
        ComputedOutput::DriverEntries(frame) => bundle.driver_entries = Some(frame),
        // The save is handed to the I/O worker on the 4 Hz tier, its own.
        ComputedOutput::SafetyRating { frame, .. } => bundle.safety_rating = Some(frame),
        ComputedOutput::TrackRecording(frame) => bundle.track_recording = Some(frame),
        ComputedOutput::TrackShape(_) => {} // handled in OverlayClock loop directly
        ComputedOutput::ReferenceLap(_) => {} // handled in OverlayClock loop directly
        ComputedOutput::PitLanePct { .. } => {} // handled in OverlayClock loop directly
    }
}

#[cfg(test)]
mod tests;
