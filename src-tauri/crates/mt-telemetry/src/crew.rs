//! The engineer on the telemetry thread: the driver's requests resolved
//! against the frame this tick holds, the same way a pit key is.

use mt_computations::crew::chat_answers;
use mt_computations::crew::engineer::{
    acknowledge, class_gaps, ordered_tire_count, plan, track_neighbours, CarView, EngineerStep,
    EngineerView,
};
use mt_computations::crew::questions::QuestionView;
use mt_computations::field::driver_entries::DriverEntry;
use mt_model::app::crew::{CrewIntent, CrewReply, CrewSink};
use mt_model::sim::session::{CarEntry, SessionSnapshot};
use mt_source::{PitCommander, SourceFrame};

use crate::bundle::TelemetryBundle;
use crate::loop_state::LoopState;
use crate::tick::actions::{compound_indexes, send_manual_action};

/// Every tick: keeps the engineer's view current and answers what was asked.
/// The cars are read only while someone can ask about them; pit stops are
/// counted all the time — a crew switched on mid-race still knows them.
pub fn run_crew(
    frame: &SourceFrame,
    bundle: &TelemetryBundle,
    session: Option<&SessionSnapshot>,
    state: &mut LoopState,
    pit: Option<&dyn PitCommander>,
    crew: Option<&dyn CrewSink>,
) {
    let read_cars =
        crew.is_some() || !state.pending_previews.is_empty() || !state.pending_chat.is_empty();

    update_view(&mut state.engineer, frame, bundle, session, read_cars);

    // Text only: a preview needs no voice running. With none, the cars were
    // last read who knows when — the preview waits for the next driver table.
    if crew.is_some() || bundle.driver_entries.is_some() {
        answer_previews(state, session);
        answer_chat_commands(state, session);
    }

    let Some(crew) = crew else {
        state.pending_crew.clear();
        state.crew_cars.clear();
        return;
    };

    tell_cars(crew, session, &mut state.crew_cars);

    if state.pending_crew.is_empty() {
        return;
    }

    let compounds = compound_indexes(session);

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
                .all(|step| match plan(step.clone(), &state.engineer, session) {
                    EngineerStep::Pit { action, .. } => {
                        send_manual_action(action, frame, session, &compounds, state, pit).1
                    }
                    EngineerStep::ChatMacro { slot } => send_chat_macro(pit, slot),
                    EngineerStep::Reply(reply) => reply.command_ok == Some(true),
                    // A question is never a step.
                    EngineerStep::Answers(_) => false,
                });

        if !carried_out {
            crew.reply(CrewReply::plain("engineer.cannot").command(false));
            continue;
        }

        let reply = match plan(intent, &state.engineer, session) {
            EngineerStep::Reply(reply) => reply,
            EngineerStep::Answers(replies) => {
                for reply in replies {
                    crew.reply(if steps.is_empty() {
                        reply
                    } else {
                        reply.command(true)
                    });
                }

                continue;
            }
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

/// Tells the crew the numbers the session's cars wear when they change; the
/// same cars cost a comparison, nothing allocated.
fn tell_cars(crew: &dyn CrewSink, session: Option<&SessionSnapshot>, told: &mut Vec<String>) {
    let racing =
        |car: &&CarEntry| !car.is_pace_car && !car.is_spectator && !car.user_name.is_empty();
    let numbers = || {
        session
            .into_iter()
            .flat_map(|session| session.cars.iter().filter(racing))
            .map(|car| car.car_number.trim())
    };

    if numbers().eq(told.iter().map(String::as_str)) {
        return;
    }

    *told = numbers().map(str::to_string).collect();
    crew.cars(told.clone());
}

/// The connection dropped: with no session the crew hears no car numbers.
pub fn forget_cars(crew: Option<&dyn CrewSink>, told: &mut Vec<String>) {
    match crew {
        Some(crew) => tell_cars(crew, None, told),
        None => told.clear(),
    }
}

/// A preview's steps never reach it: it is only answered.
fn answer_previews(state: &mut LoopState, session: Option<&SessionSnapshot>) {
    for (intent, answer) in std::mem::take(&mut state.pending_previews) {
        if let EngineerStep::Answers(replies) = plan(intent, &state.engineer, session) {
            // The tab may have stopped waiting; then nobody needs them.
            let _ = answer.try_send(replies);
        }
    }
}

/// A reply nobody waits for any more is dropped.
fn answer_chat_commands(state: &mut LoopState, session: Option<&SessionSnapshot>) {
    for (command, display, answer) in std::mem::take(&mut state.pending_chat) {
        let reply = chat_answers::answer(command, display, &state.engineer, session);

        let _ = answer.try_send(reply);
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
    read_cars: bool,
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
    update_question_view(&mut view.questions, frame, bundle, read_cars);
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

    if let Some(entries) = bundle.driver_entries.as_ref().filter(|_| read_cars) {
        let (position, ahead, behind) = class_gaps(&entries.entries);

        view.class_position = position.or(frame.lap_timing.player_car_class_position);
        view.gap_ahead = ahead;
        view.gap_behind = behind;
        (view.car_ahead_on_track, view.car_behind_on_track) = session
            .map(|session| track_neighbours(&entries.entries, session))
            .unwrap_or_default();
        view.cars = car_views(&entries.entries, session);
    }
}

/// What a question of the driver's own is answered from; the slower tiers
/// values stand between their ticks.
fn update_question_view(
    view: &mut QuestionView,
    frame: &SourceFrame,
    bundle: &TelemetryBundle,
    read_cars: bool,
) {
    view.fuel_level = Some(frame.car_status.fuel_level);
    view.air_temp = frame.environment.air_temp;
    view.track_temp = frame.environment.track_temp;
    view.precipitation = frame.environment.precipitation;
    view.laps_remain_ex = frame.session.session_laps_remain_ex;
    view.time_remain = frame.session.session_time_remain;
    view.lap = frame.lap_timing.lap;
    view.incidents = frame.car_status.player_car_my_incident_count;

    if let Some(fuel) = &bundle.fuel {
        view.fuel_laps_remaining = fuel.laps_remaining;
        view.fuel_to_add = fuel.fuel_to_add;
        view.fuel_save_per_lap = fuel.fuel_save_per_lap;
        view.pit_window_start = fuel.pit_window_start;
        view.pit_window_end = fuel.pit_window_end;
    }

    if let Some(entries) = &bundle.driver_entries {
        view.pit_entries
            .update(frame.session.session_num, &entries.entries);

        if read_cars {
            view.entries.clone_from(&entries.entries);
        }
    }
}

/// The other cars by the numbers on them, as the sim writes them: no pace
/// car, no spectator, no car without a driver — the cars a question finds.
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
                .find(|car| car.car_idx == entry.car_idx)
                .filter(|car| !car.is_pace_car && !car.is_spectator && !car.user_name.is_empty())?;

            Some(CarView {
                number: car.car_number.trim().to_string(),
                class_position: (entry.live_class_position > 0)
                    .then_some(entry.live_class_position),
                last_lap_s: entry.last_lap_time,
                best_lap_s: entry.best_lap_time,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;

    #[derive(Default)]
    struct ToldCars(Mutex<Vec<Vec<String>>>);

    impl CrewSink for ToldCars {
        fn reply(&self, _reply: CrewReply) {}

        fn cars(&self, numbers: Vec<String>) {
            self.0.lock().unwrap().push(numbers);
        }
    }

    fn session(numbers: &[&str]) -> SessionSnapshot {
        let car = |number: &&str| CarEntry {
            car_number: format!(" {number} "),
            user_name: format!("Driver {number}"),
            ..CarEntry::default()
        };
        let pace_car = CarEntry {
            car_number: "0".into(),
            user_name: "Pace Car".into(),
            is_pace_car: true,
            ..CarEntry::default()
        };

        SessionSnapshot {
            cars: numbers.iter().map(car).chain([pace_car]).collect(),
            ..SessionSnapshot::default()
        }
    }

    #[test]
    fn tells_the_crew_the_cars_numbers_only_when_they_change() {
        let crew = ToldCars::default();
        let mut told = Vec::new();
        let field = session(&["7", "512"]);
        let joined = session(&["7", "512", "033"]);

        tell_cars(&crew, Some(&field), &mut told);
        tell_cars(&crew, Some(&field), &mut told);
        tell_cars(&crew, Some(&joined), &mut told);
        tell_cars(&crew, None, &mut told);
        tell_cars(&crew, None, &mut told);

        assert_eq!(
            *crew.0.lock().unwrap(),
            [
                vec!["7".to_string(), "512".to_string()],
                vec!["7".to_string(), "512".to_string(), "033".to_string()],
                Vec::new(),
            ]
        );
    }

    #[test]
    fn a_dropped_connection_takes_the_cars_numbers_away() {
        let crew = ToldCars::default();
        let mut told = Vec::new();

        tell_cars(&crew, Some(&session(&["7"])), &mut told);
        forget_cars(Some(&crew), &mut told);
        forget_cars(Some(&crew), &mut told);

        assert_eq!(*crew.0.lock().unwrap(), [vec!["7".to_string()], Vec::new()]);

        told.push("7".into());
        forget_cars(None, &mut told);

        assert!(told.is_empty());
    }
}
