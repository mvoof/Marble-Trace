use super::actions::run_pit_auto;
use super::session_notes::note_session_memory;
use super::{EVENT_SIM_PERF, EVENT_TELEMETRY_SLOW};

use tracing::warn;

use crate::bundle::{TelemetryBundle, TelemetrySlowBundle};
use crate::delivery::scheduler::DueGroups;
use crate::io_worker::IoWorker;
use crate::loop_state::LoopState;
use crate::state::TelemetryServiceState;
use mt_computations::field::radio;
use mt_model::contract::event_sink::EventSink;
use mt_model::sim::session::SessionSnapshot;
use mt_model::utils::lock_or_recover;
use mt_source::{PitCommander, SourceFrame};

/// What the slow-tier stage reads besides the loop state.
pub(super) struct SlowTierRun<'a> {
    pub(super) frame: &'a SourceFrame,
    pub(super) session_info: Option<&'a SessionSnapshot>,
    pub(super) due: DueGroups,
    pub(super) sink: &'a dyn EventSink,
    pub(super) service: &'a TelemetryServiceState,
    pub(super) io: &'a IoWorker,
    pub(super) pit: Option<&'a dyn PitCommander>,
}

/// The raw frames of the 10, 4 and 1 Hz tiers, auto pit on the 4 Hz one, and
/// the events those tiers send on their own.
pub(super) fn collect_slow_tiers(
    bundle: &mut TelemetryBundle,
    run: SlowTierRun<'_>,
    state: &mut LoopState,
) {
    let SlowTierRun {
        frame,
        session_info,
        due,
        sink,
        service,
        io,
        pit,
    } = run;

    if due.hz10 {
        bundle.chassis = Some(frame.chassis.clone());
        bundle.car_idx = Some(frame.car_idx.clone());
        bundle.lap_timing = Some(frame.lap_timing.clone());
        bundle.radio = Some(radio::on_air(&frame.radio, session_info));
    }

    if due.hz4 {
        bundle.car_status = Some(frame.car_status.clone());
        bundle.pit_service = Some(frame.pit_service.clone());
        bundle.pit_auto = Some(run_pit_auto(frame, bundle, state, pit));

        let slow = TelemetrySlowBundle {
            car_status: frame.car_status.clone(),
        };

        if let Err(e) = sink.emit(EVENT_TELEMETRY_SLOW, &slow) {
            warn!("Failed to emit slow telemetry bundle: {}", e);
        }

        // The inspector pulls this over a command instead of subscribing, so the
        // settings window never takes the bundle. Nothing is written — not even
        // the clone — while its panel is closed.
        if state.config.inspector_active {
            *lock_or_recover(&service.inspector_frame) = Some(frame.clone());
        }
    }

    if due.hz1 {
        note_session_memory(session_info, state, io);

        bundle.session = Some(frame.session.clone());
        bundle.environment = Some(frame.environment.clone());

        if let Err(e) = sink.emit(EVENT_SIM_PERF, &frame.sim_perf) {
            warn!("Failed to emit sim perf: {}", e);
        }
    }
}
