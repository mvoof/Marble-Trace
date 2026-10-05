//! A manual pit action turned into the broadcasts that carry it out.
//!
//! The SDK only sets and clears, so every toggle reads what the sim has checked
//! right now and sends the opposite. Done here, against the frame the telemetry
//! thread holds, rather than in a window: a key works with every webview
//! paused, and a click and a key go through the same arithmetic.
//!
//! Every manual change claims its half of the stop from auto mode. Fast repair
//! and the windshield claim nothing — auto mode never decides on them.

use crate::computations::pit_auto::PitOrder;
use crate::model::pit_action::{PitAction, TireCorner};
use crate::model::pit_auto::PitClaim;
use crate::model::pit_command::{PitCommandKind, PitCommandRequest};
use crate::model::player::PitServiceFrame;

const FUEL_CLAIM: PitClaim = PitClaim {
    fuel: true,
    tires: false,
};
const TIRES_CLAIM: PitClaim = PitClaim {
    fuel: false,
    tires: true,
};
const WHOLE_STOP_CLAIM: PitClaim = PitClaim {
    fuel: true,
    tires: true,
};

/// What an action is resolved against: the order the sim holds, the tank, and
/// what the fuel calculation and the session say.
#[derive(Debug, Clone, Copy)]
pub struct PitActionInput<'a> {
    pub service: &'a PitServiceFrame,
    pub fuel_in_tank_l: f32,
    /// Fuel the series lets this car carry; `None` while the session has not
    /// named it, the one case where no ceiling applies.
    pub fuel_capacity_l: Option<f32>,
    /// The fuel calculation's `fill_now`.
    pub planned_fuel_l: Option<f32>,
    /// The session's compound indexes, in the order it lists them.
    pub compounds: &'a [i32],
    /// One press of the fuel step keys, already in liters.
    pub fuel_step_l: f32,
}

/// What one action sends, and which halves of the stop it takes from auto mode.
#[derive(Debug, Clone, PartialEq)]
pub struct ManualOrder {
    pub requests: PitOrder,
    pub claim: Option<PitClaim>,
}

/// The order an action stands for, or `None` when it has nothing to do — no
/// fuel planned, a single compound.
pub fn resolve(action: PitAction, input: &PitActionInput<'_>) -> Option<ManualOrder> {
    match action {
        PitAction::ApplyPlanned => Some(claimed(planned_order(input), WHOLE_STOP_CLAIM)),
        PitAction::Clear => Some(claimed(
            vec![request(PitCommandKind::Clear, 0)],
            WHOLE_STOP_CLAIM,
        )),
        PitAction::ToggleFuel => toggle_fuel(input),
        PitAction::FuelStepUp => Some(set_fuel(
            input,
            ordered_fuel_l(input.service) + input.fuel_step_l,
        )),
        PitAction::FuelStepDown => Some(set_fuel(
            input,
            ordered_fuel_l(input.service) - input.fuel_step_l,
        )),
        PitAction::SetFuel { liters } => Some(set_fuel(input, liters)),
        PitAction::ToggleAllTires => Some(toggle_all_tires(input.service)),
        PitAction::ToggleTire { corner } => Some(toggle_tire(input.service, corner)),
        PitAction::CycleCompound => cycle_compound(input),
        PitAction::ToggleFastRepair => Some(unclaimed(if input.service.fast_repair {
            PitCommandKind::ClearFastRepair
        } else {
            PitCommandKind::FastRepair
        })),
        PitAction::ToggleWindshield => Some(unclaimed(if input.service.clean_windshield {
            PitCommandKind::ClearWindshield
        } else {
            PitCommandKind::Windshield
        })),
    }
}

/// The most that can still go in: the tank, less what is in it. The sim
/// silently truncates an order past the brim, so every path caps at this.
fn clamp_fuel(input: &PitActionInput<'_>, liters: f32) -> f32 {
    let capped = match input.fuel_capacity_l {
        Some(capacity) => liters.min((capacity - input.fuel_in_tank_l).max(0.0)),
        None => liters,
    };

    capped.max(0.0)
}

fn ordered_fuel_l(service: &PitServiceFrame) -> f32 {
    if service.add_fuel {
        service.fuel_amount.unwrap_or(0.0)
    } else {
        0.0
    }
}

/// Fuel is rounded up: a liter short costs a whole extra stop, a liter over
/// costs nothing but weight.
fn planned_fill_l(input: &PitActionInput<'_>) -> Option<i32> {
    input
        .planned_fuel_l
        .map(|planned| clamp_fuel(input, planned).ceil() as i32)
}

/// Tire pressures are left at what the driver set in the garage — the sim
/// keeps them when passed 0.
fn planned_order(input: &PitActionInput<'_>) -> PitOrder {
    let mut order = vec![request(PitCommandKind::Clear, 0)];
    let fill = planned_fill_l(input).unwrap_or(0);

    if fill > 0 {
        order.push(request(PitCommandKind::Fuel, fill));
    }

    for corner in TireCorner::ALL {
        order.push(request(corner_kind(corner), 0));
    }

    order
}

fn toggle_fuel(input: &PitActionInput<'_>) -> Option<ManualOrder> {
    if input.service.add_fuel {
        return Some(claimed(
            vec![request(PitCommandKind::ClearFuel, 0)],
            FUEL_CLAIM,
        ));
    }

    let fill = planned_fill_l(input).filter(|fill| *fill > 0)?;

    Some(claimed(
        vec![request(PitCommandKind::Fuel, fill)],
        FUEL_CLAIM,
    ))
}

fn set_fuel(input: &PitActionInput<'_>, liters: f32) -> ManualOrder {
    let target = clamp_fuel(input, liters).round() as i32;

    if target <= 0 {
        return claimed(vec![request(PitCommandKind::ClearFuel, 0)], FUEL_CLAIM);
    }

    claimed(vec![request(PitCommandKind::Fuel, target)], FUEL_CLAIM)
}

fn is_corner_ordered(service: &PitServiceFrame, corner: TireCorner) -> bool {
    match corner {
        TireCorner::Lf => service.change_lf,
        TireCorner::Rf => service.change_rf,
        TireCorner::Lr => service.change_lr,
        TireCorner::Rr => service.change_rr,
    }
}

fn ordered_pressure(service: &PitServiceFrame, corner: TireCorner) -> Option<f32> {
    match corner {
        TireCorner::Lf => service.lf_pressure,
        TireCorner::Rf => service.rf_pressure,
        TireCorner::Lr => service.lr_pressure,
        TireCorner::Rr => service.rr_pressure,
    }
}

fn corner_kind(corner: TireCorner) -> PitCommandKind {
    match corner {
        TireCorner::Lf => PitCommandKind::Lf,
        TireCorner::Rf => PitCommandKind::Rf,
        TireCorner::Lr => PitCommandKind::Lr,
        TireCorner::Rr => PitCommandKind::Rr,
    }
}

/// Unchecking is the awkward direction: the SDK can only clear all four, so
/// the other ordered corners are re-sent right after — at the pressure the sim
/// reports for them, so an explicitly set pressure survives the round trip.
fn toggle_tire(service: &PitServiceFrame, corner: TireCorner) -> ManualOrder {
    if !is_corner_ordered(service, corner) {
        return claimed(vec![request(corner_kind(corner), 0)], TIRES_CLAIM);
    }

    let mut order = vec![request(PitCommandKind::ClearTires, 0)];

    for other in TireCorner::ALL {
        if other != corner && is_corner_ordered(service, other) {
            let pressure = ordered_pressure(service, other).unwrap_or(0.0).round() as i32;

            order.push(request(corner_kind(other), pressure));
        }
    }

    claimed(order, TIRES_CLAIM)
}

fn toggle_all_tires(service: &PitServiceFrame) -> ManualOrder {
    let all_ordered = TireCorner::ALL
        .iter()
        .all(|corner| is_corner_ordered(service, *corner));

    if all_ordered {
        return claimed(vec![request(PitCommandKind::ClearTires, 0)], TIRES_CLAIM);
    }

    claimed(
        TireCorner::ALL
            .iter()
            .map(|corner| request(corner_kind(*corner), 0))
            .collect(),
        TIRES_CLAIM,
    )
}

/// The SDK takes an index, not a step, so the wrap is worked out here. Part of
/// the tire half: a compound is as much a tire decision as a corner.
fn cycle_compound(input: &PitActionInput<'_>) -> Option<ManualOrder> {
    let compounds = input.compounds;

    if compounds.len() < 2 {
        return None;
    }

    let next = input
        .service
        .tire_compound
        .and_then(|current| compounds.iter().position(|index| *index == current))
        .map_or(0, |position| (position + 1) % compounds.len());

    Some(claimed(
        vec![request(PitCommandKind::TireCompound, compounds[next])],
        TIRES_CLAIM,
    ))
}

fn claimed(requests: PitOrder, claim: PitClaim) -> ManualOrder {
    ManualOrder {
        requests,
        claim: Some(claim),
    }
}

fn unclaimed(kind: PitCommandKind) -> ManualOrder {
    ManualOrder {
        requests: vec![request(kind, 0)],
        claim: None,
    }
}

fn request(kind: PitCommandKind, value: i32) -> PitCommandRequest {
    PitCommandRequest { kind, value }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TANK_L: f32 = 106.0;

    fn service() -> PitServiceFrame {
        PitServiceFrame::default()
    }

    fn input<'a>(service: &'a PitServiceFrame, planned: Option<f32>) -> PitActionInput<'a> {
        PitActionInput {
            service,
            fuel_in_tank_l: 0.0,
            fuel_capacity_l: Some(TANK_L),
            planned_fuel_l: planned,
            compounds: &[],
            fuel_step_l: 1.0,
        }
    }

    fn requests(order: Option<ManualOrder>) -> Vec<(PitCommandKind, i32)> {
        order
            .expect("an order")
            .requests
            .into_iter()
            .map(|request| (request.kind, request.value))
            .collect()
    }

    fn claim_of(order: Option<ManualOrder>) -> Option<PitClaim> {
        order.expect("an order").claim
    }

    #[test]
    fn rounds_the_planned_fuel_up_and_orders_four_tires() {
        let service = service();

        assert_eq!(
            requests(resolve(
                PitAction::ApplyPlanned,
                &input(&service, Some(25.2))
            )),
            vec![
                (PitCommandKind::Clear, 0),
                (PitCommandKind::Fuel, 26),
                (PitCommandKind::Lf, 0),
                (PitCommandKind::Rf, 0),
                (PitCommandKind::Lr, 0),
                (PitCommandKind::Rr, 0),
            ]
        );
    }

    #[test]
    fn caps_the_planned_fuel_at_the_room_left_in_the_tank() {
        let service = service();
        let mut nearly_full = input(&service, Some(50.0));

        nearly_full.fuel_in_tank_l = 100.0;

        assert_eq!(
            requests(resolve(PitAction::ToggleFuel, &nearly_full)),
            vec![(PitCommandKind::Fuel, 6)]
        );
    }

    #[test]
    fn leaves_the_fuel_out_of_the_plan_when_none_is_needed() {
        let service = service();

        assert_eq!(
            requests(resolve(PitAction::ApplyPlanned, &input(&service, None)))[1],
            (PitCommandKind::Lf, 0)
        );
    }

    #[test]
    fn steps_the_ordered_fuel_from_what_the_sim_holds() {
        let service = PitServiceFrame {
            add_fuel: true,
            fuel_amount: Some(20.0),
            ..service()
        };
        let mut five_liter_step = input(&service, None);

        five_liter_step.fuel_step_l = 5.0;

        assert_eq!(
            requests(resolve(PitAction::FuelStepUp, &five_liter_step)),
            vec![(PitCommandKind::Fuel, 25)]
        );
        assert_eq!(
            requests(resolve(PitAction::FuelStepDown, &five_liter_step)),
            vec![(PitCommandKind::Fuel, 15)]
        );
    }

    #[test]
    fn caps_a_manual_amount_at_tank_capacity() {
        let service = service();

        assert_eq!(
            requests(resolve(
                PitAction::SetFuel { liters: 500.0 },
                &input(&service, None)
            )),
            vec![(PitCommandKind::Fuel, TANK_L as i32)]
        );
    }

    #[test]
    fn clears_the_fuel_instead_of_ordering_zero_liters() {
        let service = PitServiceFrame {
            add_fuel: true,
            fuel_amount: Some(1.0),
            ..service()
        };

        assert_eq!(
            requests(resolve(PitAction::FuelStepDown, &input(&service, None))),
            vec![(PitCommandKind::ClearFuel, 0)]
        );
    }

    #[test]
    fn orders_nothing_from_the_fuel_key_without_a_plan() {
        let service = service();

        assert_eq!(resolve(PitAction::ToggleFuel, &input(&service, None)), None);
    }

    #[test]
    fn clears_ordered_fuel_with_the_fuel_key() {
        let service = PitServiceFrame {
            add_fuel: true,
            ..service()
        };

        assert_eq!(
            requests(resolve(PitAction::ToggleFuel, &input(&service, Some(30.0)))),
            vec![(PitCommandKind::ClearFuel, 0)]
        );
    }

    #[test]
    fn checks_a_single_corner_without_touching_the_rest() {
        let service = service();

        assert_eq!(
            requests(resolve(
                PitAction::ToggleTire {
                    corner: TireCorner::Rf
                },
                &input(&service, None)
            )),
            vec![(PitCommandKind::Rf, 0)]
        );
    }

    #[test]
    fn unchecks_one_corner_by_clearing_all_and_restoring_the_others() {
        let service = PitServiceFrame {
            change_lf: true,
            change_rf: true,
            change_rr: true,
            lf_pressure: Some(165.4),
            rr_pressure: Some(170.0),
            ..service()
        };

        assert_eq!(
            requests(resolve(
                PitAction::ToggleTire {
                    corner: TireCorner::Rf
                },
                &input(&service, None)
            )),
            vec![
                (PitCommandKind::ClearTires, 0),
                (PitCommandKind::Lf, 165),
                (PitCommandKind::Rr, 170),
            ]
        );
    }

    #[test]
    fn clears_the_tires_only_when_all_four_are_ordered() {
        let some = PitServiceFrame {
            change_lf: true,
            ..service()
        };
        let all = PitServiceFrame {
            change_lf: true,
            change_rf: true,
            change_lr: true,
            change_rr: true,
            ..service()
        };

        assert_eq!(
            requests(resolve(PitAction::ToggleAllTires, &input(&some, None))).len(),
            4
        );
        assert_eq!(
            requests(resolve(PitAction::ToggleAllTires, &input(&all, None))),
            vec![(PitCommandKind::ClearTires, 0)]
        );
    }

    #[test]
    fn sends_the_clear_variant_when_a_box_is_checked() {
        let checked = PitServiceFrame {
            fast_repair: true,
            clean_windshield: true,
            ..service()
        };

        assert_eq!(
            requests(resolve(PitAction::ToggleFastRepair, &input(&checked, None))),
            vec![(PitCommandKind::ClearFastRepair, 0)]
        );
        assert_eq!(
            requests(resolve(PitAction::ToggleWindshield, &input(&checked, None))),
            vec![(PitCommandKind::ClearWindshield, 0)]
        );
    }

    #[test]
    fn steps_to_the_next_compound_and_wraps() {
        let on_last = PitServiceFrame {
            tire_compound: Some(2),
            ..service()
        };
        let mut session = input(&on_last, None);

        session.compounds = &[0, 2];

        assert_eq!(
            requests(resolve(PitAction::CycleCompound, &session)),
            vec![(PitCommandKind::TireCompound, 0)]
        );
    }

    #[test]
    fn offers_no_compound_change_with_a_single_compound() {
        let service = service();
        let mut session = input(&service, None);

        session.compounds = &[0];

        assert_eq!(resolve(PitAction::CycleCompound, &session), None);
    }

    #[test]
    fn claims_the_half_of_the_stop_each_action_belongs_to() {
        let service = service();
        let plain = input(&service, Some(30.0));
        let fuel_only = Some(FUEL_CLAIM);
        let tires_only = Some(TIRES_CLAIM);

        assert_eq!(claim_of(resolve(PitAction::FuelStepUp, &plain)), fuel_only);
        assert_eq!(claim_of(resolve(PitAction::ToggleFuel, &plain)), fuel_only);
        assert_eq!(
            claim_of(resolve(
                PitAction::ToggleTire {
                    corner: TireCorner::Lf
                },
                &plain
            )),
            tires_only
        );
        assert_eq!(
            claim_of(resolve(PitAction::ApplyPlanned, &plain)),
            Some(WHOLE_STOP_CLAIM)
        );
        assert_eq!(
            claim_of(resolve(PitAction::Clear, &plain)),
            Some(WHOLE_STOP_CLAIM)
        );
        assert_eq!(claim_of(resolve(PitAction::ToggleFastRepair, &plain)), None);
        assert_eq!(claim_of(resolve(PitAction::ToggleWindshield, &plain)), None);
    }
}
