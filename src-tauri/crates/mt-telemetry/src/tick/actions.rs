use std::time::Instant;

use tracing::info;

use crate::bundle::TelemetryBundle;
use crate::loop_state::LoopState;
use mt_computations::strategy::pit_actions::{self, ManualOrder, PitActionInput};
use mt_computations::strategy::pit_auto::{worst_tire_wear, PitAutoCommand, PitAutoInput};
use mt_model::pit::pit_action::PitAction;
use mt_model::pit::pit_auto::PitAutoFrame;
use mt_model::sim::session::SessionSnapshot;
use mt_source::{PitCommander, SourceFrame};

/// Auto pit mode's tick: decides on this frame, sends what it decided, and
/// returns the state the widget shows. On the 4 Hz tier, after the processors,
/// because the fuel half orders the fuel calculation's `fill_now`.
pub(super) fn run_pit_auto(
    frame: &SourceFrame,
    bundle: &TelemetryBundle,
    state: &mut LoopState,
    pit: Option<&dyn PitCommander>,
) -> PitAutoFrame {
    state.planned_fuel_l = bundle
        .fuel
        .as_ref()
        .and_then(|fuel| fuel.refuel_plan.as_ref())
        .map(|plan| plan.fill_now);

    let input = PitAutoInput {
        on_pit_road: frame.car_status.on_pit_road.unwrap_or(false),
        in_pit_stall: frame.pit_service.in_pit_stall,
        service_active: frame.pit_service.service_active,
        armed_flags: frame.pit_service.flags.unwrap_or(0),
        fast_repair_ordered: frame.pit_service.fast_repair,
        tire_wear: worst_tire_wear(&frame.chassis),
        planned_fuel_l: state.planned_fuel_l,
    };
    let config = state.config.pit_auto;

    for order in state.pit_auto.step(&input, &config) {
        let Some(pit) = pit else {
            continue;
        };

        let result = pit.send_pit_order(&order);

        info!(?order, ok = result.is_ok(), "auto pit order");
        state.pit_auto.record_send(result.is_ok());
    }

    PitAutoFrame {
        dialed_pressure: state.pressure_dial.frame(&frame.pit_service),
        ..state.pit_auto.frame(&config)
    }
}

/// The manual pit actions applied this tick: each resolved against this frame
/// and sent, its claim handed to auto mode before the broadcast leaves so the
/// next tick cannot decide that half over the driver's hand. Counted with auto
/// mode's orders, which is how the widget learns one went out.
pub(super) fn run_pit_actions(
    frame: &SourceFrame,
    session: Option<&SessionSnapshot>,
    state: &mut LoopState,
    pit: Option<&dyn PitCommander>,
) {
    if !state.pending_pit_actions.is_empty() {
        let compounds = compound_indexes(session);

        for action in std::mem::take(&mut state.pending_pit_actions) {
            send_manual_action(action, frame, session, &compounds, state, pit);
        }
    }

    send_dialed_pressures(frame, state, pit);
}

/// The dialed tire pressures, sent once the presses have settled.
pub(super) fn send_dialed_pressures(
    frame: &SourceFrame,
    state: &mut LoopState,
    pit: Option<&dyn PitCommander>,
) {
    let Some(order) = state
        .pressure_dial
        .take_due(&frame.pit_service, Instant::now())
    else {
        return;
    };

    let Some(pit) = pit else {
        info!(
            ?order,
            "dialed pressures not sent: the source takes no orders"
        );

        return;
    };

    let result = pit.send_pit_order(&order);

    info!(?order, ok = result.is_ok(), "dialed pressure order");
    state.pit_auto.record_send(result.is_ok());
}

/// The session's compound indexes, in the order it lists them.
pub(crate) fn compound_indexes(session: Option<&SessionSnapshot>) -> Vec<i32> {
    session
        .map(|session| {
            session
                .driver_tires
                .iter()
                .map(|tire| tire.tire_index)
                .collect()
        })
        .unwrap_or_default()
}

/// Resolves one manual action against this frame and sends it — a key, a
/// click and a voice command alike. Returns the order and whether it went out.
pub(crate) fn send_manual_action(
    action: PitAction,
    frame: &SourceFrame,
    session: Option<&SessionSnapshot>,
    compounds: &[i32],
    state: &mut LoopState,
    pit: Option<&dyn PitCommander>,
) -> (Option<ManualOrder>, bool) {
    // A pressure step is dialed, not sent: the steps add up and go out as one
    // order once they stop. It takes the tires from auto mode the moment it
    // is pressed, so auto mode cannot order them over the dial meanwhile.
    if let PitAction::PressureStepUp { corners } | PitAction::PressureStepDown { corners } = action
    {
        let step_kpa = state.config.pit_auto.pressure_step_kpa;
        let signed_step = if matches!(action, PitAction::PressureStepUp { .. }) {
            step_kpa
        } else {
            -step_kpa
        };

        if state
            .pressure_dial
            .step(&frame.pit_service, corners, signed_step, Instant::now())
        {
            state.pit_auto.command(
                PitAutoCommand::Claim(pit_actions::TIRES_CLAIM),
                &state.config.pit_auto,
            );
        }

        return (None, false);
    }

    let input = PitActionInput {
        service: &frame.pit_service,
        fuel_in_tank_l: frame.car_status.fuel_level,
        fuel_capacity_l: session.and_then(|session| session.fuel_capacity_ltr),
        planned_fuel_l: state.planned_fuel_l,
        compounds,
        fuel_step_l: state.config.pit_auto.fuel_step_liters,
    };
    let Some(order) = pit_actions::resolve(action, &input) else {
        return (None, false);
    };

    if let Some(claim) = order.claim {
        state
            .pit_auto
            .command(PitAutoCommand::Claim(claim), &state.config.pit_auto);
    }

    let Some(pit) = pit else {
        info!(?action, "pit action not sent: the source takes no orders");

        return (Some(order), false);
    };

    let result = pit.send_pit_order(&order.requests);

    info!(?action, ok = result.is_ok(), "manual pit order");
    state.pit_auto.record_send(result.is_ok());

    (Some(order), result.is_ok())
}
