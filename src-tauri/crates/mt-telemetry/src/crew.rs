//! The engineer on the telemetry thread: the driver's requests resolved
//! against the frame this tick holds, the same way a pit key is.

use mt_computations::crew::engineer::{
    acknowledge, class_gaps, ordered_tire_count, plan, CarView, EngineerStep, EngineerView,
};
use mt_computations::field::driver_entries::DriverEntry;
use mt_model::app::crew::{CrewIntent, CrewReply, CrewSink};
use mt_model::sim::session::SessionSnapshot;
use mt_source::{PitCommander, SourceFrame};

use crate::emitter::{compound_indexes, send_manual_action, TelemetryBundle};
use crate::loop_state::LoopState;

/// Every tick: keeps the engineer's view current and answers what was asked.
pub fn run_crew(
    frame: &SourceFrame,
    bundle: &TelemetryBundle,
    session: Option<&SessionSnapshot>,
    state: &mut LoopState,
    pit: Option<&dyn PitCommander>,
    crew: Option<&dyn CrewSink>,
) {
    update_view(&mut state.engineer, frame, bundle, session);

    let Some(crew) = crew else {
        state.pending_crew.clear();
        return;
    };

    if state.pending_crew.is_empty() {
        return;
    }

    let compounds = compound_indexes(session);
    let tires = session.map_or(&[][..], |session| session.driver_tires.as_slice());

    for mut intent in std::mem::take(&mut state.pending_crew) {
        // A question whose steps need the car is refused whole by `plan`.
        let steps = match &mut intent {
            CrewIntent::Question { steps, .. }
                if state.engineer.in_car || !steps.iter().any(CrewIntent::is_pit_command) =>
            {
                std::mem::take(steps)
            }
            _ => Vec::new(),
        };
        let carried_out =
            steps
                .iter()
                .all(|step| match plan(step.clone(), &state.engineer, tires) {
                    EngineerStep::Pit { action, .. } => {
                        send_manual_action(action, frame, session, &compounds, state, pit).1
                    }
                    EngineerStep::ChatMacro { slot } => send_chat_macro(pit, slot),
                    EngineerStep::Reply(reply) => reply.command_ok == Some(true),
                });

        if !carried_out {
            crew.reply(CrewReply::plain("engineer.cannot").command(false));
            continue;
        }

        let reply = match plan(intent, &state.engineer, tires) {
            EngineerStep::Reply(reply) if !steps.is_empty() => reply.command(true),
            EngineerStep::Reply(reply) => reply,
            EngineerStep::Pit { action, ack } => {
                let (order, sent) =
                    send_manual_action(action, frame, session, &compounds, state, pit);

                acknowledge(ack, order.as_ref(), sent)
            }
            // Only a question's step names a macro; the question speaks for it.
            EngineerStep::ChatMacro { slot } => {
                send_chat_macro(pit, slot);
                continue;
            }
        };

        crew.reply(reply);
    }
}

fn send_chat_macro(pit: Option<&dyn PitCommander>, slot: u32) -> bool {
    pit.is_some_and(|pit| pit.send_chat_macro(slot).is_ok())
}

fn update_view(
    view: &mut EngineerView,
    frame: &SourceFrame,
    bundle: &TelemetryBundle,
    session: Option<&SessionSnapshot>,
) {
    let service = &frame.pit_service;

    view.in_car = frame.car_status.is_on_track.unwrap_or(false);
    view.fuel_l = Some(frame.car_status.fuel_level);
    view.last_lap_s = frame.lap_timing.lap_last_lap_time;
    view.best_lap_s = frame.lap_timing.lap_best_lap_time;
    view.laps_left = frame.session.session_laps_remain_ex;
    view.seconds_left = frame.session.session_time_remain;
    view.ordered_fuel_l = service.add_fuel.then(|| service.fuel_amount.unwrap_or(0.0));
    view.lap = frame.lap_timing.lap;
    view.air_temp_c = frame.environment.air_temp;
    view.track_temp_c = frame.environment.track_temp;
    view.precipitation = frame.environment.precipitation;
    view.track_wetness = frame.environment.track_wetness;
    view.wind_ms = frame.environment.wind_vel;
    view.ordered_tires = ordered_tire_count([
        service.change_lf,
        service.change_rf,
        service.change_lr,
        service.change_rr,
    ]);

    // The slower tiers arrive on their own ticks; between them the last
    // values stand.
    if let Some(fuel) = &bundle.fuel {
        view.fuel_laps = fuel.laps_remaining;
        view.needs_fuel = fuel.refuel_plan.is_some();
        view.pit_window = fuel.pit_window_start.zip(fuel.pit_window_end);
    }

    if let Some(entries) = &bundle.driver_entries {
        let (position, ahead, behind) = class_gaps(&entries.entries);

        view.class_position = position.or(frame.lap_timing.player_car_class_position);
        view.gap_ahead_s = ahead;
        view.gap_behind_s = behind;
        view.cars = car_views(&entries.entries, session);
    }
}

/// The other cars by the numbers on them; a car whose number is not a number
/// cannot be asked about by voice and is left out.
fn car_views(entries: &[DriverEntry], session: Option<&SessionSnapshot>) -> Vec<CarView> {
    let Some(session) = session else {
        return Vec::new();
    };

    entries
        .iter()
        .filter(|entry| !entry.is_player)
        .filter_map(|entry| {
            let car = session
                .cars
                .iter()
                .find(|car| car.car_idx == entry.car_idx)?;

            Some(CarView {
                number: car.car_number.trim().parse().ok()?,
                class_position: (entry.live_class_position > 0)
                    .then_some(entry.live_class_position),
                last_lap_s: entry.last_lap_time,
                best_lap_s: entry.best_lap_time,
            })
        })
        .collect()
}
