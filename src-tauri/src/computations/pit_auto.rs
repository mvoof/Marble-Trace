//! Auto mode: what the pit order is on the driver's behalf, and when it stands
//! down.
//!
//! The two halves — fuel and tires — are tracked separately throughout. They are
//! sent at different moments (pit entry vs. arrival in the box, because tire wear
//! is not readable before that) and the driver can take over one without saying
//! anything about the other.
//!
//! Runs on the telemetry thread at 4 Hz, so the order does not depend on any
//! window being alive, unpaused or subscribed to the right slice. The thread
//! sends what `step` returns; this module only decides.

use crate::model::pit_auto::{PitAutoConfig, PitAutoFrame, PitAutoMode, PitClaim};
use crate::model::pit_command::{PitCommandKind, PitCommandRequest};
use crate::model::player::ChassisFrame;

const WEAR_TO_PCT: f32 = 100.0;
/// The sim reports wear as `f32`, where 0.6 × 100 lands a hair above 60; a
/// corner exactly at the threshold has to count as at it.
const WEAR_THRESHOLD_TOLERANCE_PCT: f32 = 0.001;

/// The four corners in the order the black box lists them, as the commands that
/// tick them.
const CORNER_KINDS: [PitCommandKind; 4] = [
    PitCommandKind::Lf,
    PitCommandKind::Rf,
    PitCommandKind::Lr,
    PitCommandKind::Rr,
];

/// One pit order: the SDK has no batch form, so it goes out as a sequence of
/// broadcasts.
pub type PitOrder = Vec<PitCommandRequest>;

/// What auto mode reads off one tick.
#[derive(Debug, Clone, Copy, Default)]
pub struct PitAutoInput {
    pub on_pit_road: bool,
    pub in_pit_stall: bool,
    pub service_active: bool,
    /// Raw `PitSvFlags`, zero when the sim has nothing checked.
    pub armed_flags: u32,
    pub fast_repair_ordered: bool,
    /// Remaining tread per corner, 0..1, on the most worn of its three points.
    pub tire_wear: [Option<f32>; 4],
    /// The fuel calculation's `fill_now`, in liters.
    pub planned_fuel_l: Option<f32>,
}

/// Remaining tread of the most worn of the three points across each corner. The
/// worst point decides: a tire down to the cords on the outer shoulder is
/// finished no matter how healthy its middle still reads.
pub fn worst_tire_wear(chassis: &ChassisFrame) -> [Option<f32>; 4] {
    let worst = |points: [Option<f32>; 3]| points.into_iter().flatten().reduce(f32::min);

    [
        worst([chassis.lf_wear_l, chassis.lf_wear_m, chassis.lf_wear_r]),
        worst([chassis.rf_wear_l, chassis.rf_wear_m, chassis.rf_wear_r]),
        worst([chassis.lr_wear_l, chassis.lr_wear_m, chassis.lr_wear_r]),
        worst([chassis.rr_wear_l, chassis.rr_wear_m, chassis.rr_wear_r]),
    ]
}

/// What the driver asks of auto mode, from the widget or a hotkey.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PitAutoCommand {
    /// A manual order took these halves over for the rest of the stop.
    Claim(PitClaim),
    /// The auto mode key.
    ToggleAuto,
}

/// The values whose edges the decisions run on.
#[derive(Debug, Clone, Copy, PartialEq)]
struct Observed {
    on_pit_road: bool,
    in_pit_stall: bool,
    service_active: bool,
    tire_wear: [Option<f32>; 4],
}

impl Observed {
    fn of(input: &PitAutoInput) -> Self {
        Self {
            on_pit_road: input.on_pit_road,
            in_pit_stall: input.in_pit_stall,
            service_active: input.service_active,
            tire_wear: input.tire_wear,
        }
    }
}

#[derive(Debug, Default)]
pub struct PitAuto {
    /// Auto mode is switched off, and stays off until the driver switches it
    /// back on. Only the auto mode key sets this — a driver who reaches for that
    /// key has made a decision about the strategy, not about this one stop, so
    /// pit exit deliberately leaves it alone. The per-stop overrides are the two
    /// take-over flags below, and those are the ones a new lap clears.
    suspended: bool,
    /// Whether the driver has taken each half over by hand for the rest of this
    /// stop. Deliberately not the same thing as "auto mode has already sent this
    /// half": both stop auto mode from acting again, but only this one means the
    /// stop is no longer automatic — folding them together made the plate read
    /// MANUAL the moment auto mode successfully did its job.
    fuel_taken_over: bool,
    tires_taken_over: bool,
    fuel_sent: bool,
    tires_sent: bool,
    fast_repair_sent: bool,
    /// Whether the order the sim armed on its own has already been wiped this
    /// stint. One clear per stint: after it, an order the driver builds by hand
    /// is theirs, and re-clearing it every time the flags moved would be a fight.
    self_armed_cleared: bool,
    /// The previous tick's edges; `None` before the first, which only records —
    /// a window opened on pit road never sent a fuel order either.
    last: Option<Observed>,
    orders_sent: u32,
    last_order_ok: Option<bool>,
}

impl PitAuto {
    /// Auto mode is armed: at least one of the two things it can order is on,
    /// and the widget is on screen. Ordering fuel on behalf of a widget the
    /// driver removed from the layout is the kind of surprise that loses races.
    fn is_enabled(config: &PitAutoConfig) -> bool {
        config.widget_on_screen && (config.auto_fuel || config.auto_tires)
    }

    fn is_active(&self, config: &PitAutoConfig) -> bool {
        Self::is_enabled(config) && !self.suspended
    }

    fn is_fuel_pending(&self, config: &PitAutoConfig) -> bool {
        self.is_active(config) && config.auto_fuel && !self.fuel_taken_over
    }

    fn is_tires_pending(&self, config: &PitAutoConfig) -> bool {
        self.is_active(config) && config.auto_tires && !self.tires_taken_over
    }

    /// Names what is left automatic rather than what was taken over: the driver
    /// already knows what they touched, and what they want back from the plate
    /// is what they can still stop thinking about.
    pub fn mode(&self, config: &PitAutoConfig) -> PitAutoMode {
        if !Self::is_enabled(config) {
            return PitAutoMode::Off;
        }

        match (self.is_fuel_pending(config), self.is_tires_pending(config)) {
            (true, true) => PitAutoMode::Auto,
            (true, false) => PitAutoMode::FuelAuto,
            (false, true) => PitAutoMode::TireAuto,
            (false, false) => PitAutoMode::Manual,
        }
    }

    pub fn frame(&self, config: &PitAutoConfig) -> PitAutoFrame {
        PitAutoFrame {
            mode: self.mode(config),
            orders_sent: self.orders_sent,
            last_order_ok: self.last_order_ok,
        }
    }

    /// Records how an order returned by `step` fared on its way out.
    pub fn record_send(&mut self, ok: bool) {
        self.orders_sent = self.orders_sent.wrapping_add(1);
        self.last_order_ok = Some(ok);
    }

    pub fn command(&mut self, command: PitAutoCommand, config: &PitAutoConfig) {
        match command {
            PitAutoCommand::Claim(claim) => {
                self.fuel_taken_over |= claim.fuel;
                self.tires_taken_over |= claim.tires;
            }
            // Reads off the plate rather than off `suspended` alone: anything
            // short of a fully automatic stop goes back to AUTO on a press. Only
            // from AUTO does the key hand the stop to the driver — otherwise a
            // key labelled "auto mode" would suspend a half-manual stop rather
            // than restore it.
            PitAutoCommand::ToggleAuto => {
                if self.mode(config) == PitAutoMode::Auto {
                    self.suspended = true;
                } else {
                    self.resume();
                }
            }
        }
    }

    /// Hands the whole stop back to auto mode, halves included: a driver
    /// pressing "auto" after correcting the fuel is asking for the order to be
    /// worked out again.
    fn resume(&mut self) {
        self.suspended = false;
        self.fuel_taken_over = false;
        self.tires_taken_over = false;
        self.fuel_sent = false;
        self.tires_sent = false;
        self.fast_repair_sent = false;
    }

    /// Pit exit: a new lap starts a new decision, so whatever the driver
    /// overrode belonged to the stop that just ended. `suspended` is the off
    /// switch, not one of those.
    fn clear_stop_overrides(&mut self) {
        self.fuel_taken_over = false;
        self.fuel_sent = false;
        self.tires_taken_over = false;
        self.tires_sent = false;
        self.fast_repair_sent = false;
    }

    pub fn reset(&mut self) {
        *self = Self::default();
    }

    /// The orders this tick calls for, in the order they go out.
    pub fn step(&mut self, input: &PitAutoInput, config: &PitAutoConfig) -> Vec<PitOrder> {
        let now = Observed::of(input);
        let previous = self.last.replace(now);
        let mut orders = Vec::new();

        if let Some(previous) = previous {
            if now.on_pit_road && !previous.on_pit_road {
                // Arms the one self-armed clear the next stint gets.
                self.self_armed_cleared = false;
                orders.extend(self.fuel_order(input, config));
            } else if !now.on_pit_road && previous.on_pit_road {
                self.clear_stop_overrides();
            }
        }

        // Watches the flags rather than pit exit itself: the sim arms its order
        // as the car leaves, and both land inside the same sample, so a clear
        // sent on the transition could beat the arming and wipe nothing. The
        // order appearing is unambiguous, and off pit road it can only be the
        // sim — or, after this one clear, the driver.
        if input.armed_flags != 0 && !input.on_pit_road {
            orders.extend(self.self_armed_clear(config));
        }

        orders.extend(self.fast_repair_order(input, config));

        // Three separate signals for arrival in the box, because their order is
        // not fixed: the stall flag, the crew starting, and the wear refreshing
        // have each been seen first. The tire half is sent once per stop, so the
        // earliest wins. A wear refresh only ever happens on arrival, so on pit
        // road it is the arrival.
        if let Some(previous) = previous {
            let arrived = (now.in_pit_stall && !previous.in_pit_stall)
                || (now.service_active && !previous.service_active)
                || (now.on_pit_road && now.tire_wear != previous.tire_wear);

            if arrived {
                orders.extend(self.tire_order(input, config));
            }
        }

        orders
    }

    /// The first half, sent on pit road entry: the calculated fuel and nothing
    /// else. `clearFuel` rather than a full `clear`, because the tires are not
    /// readable yet and fast repair and the windshield are not auto mode's.
    /// Rounded up: a liter short costs a stop, a liter over costs nothing.
    fn fuel_order(&mut self, input: &PitAutoInput, config: &PitAutoConfig) -> Option<PitOrder> {
        if !self.is_fuel_pending(config) || self.fuel_sent {
            return None;
        }

        self.fuel_sent = true;

        let mut order = vec![request(PitCommandKind::ClearFuel, 0)];

        if let Some(fuel) = input.planned_fuel_l.filter(|fuel| *fuel > 0.0) {
            order.push(request(PitCommandKind::Fuel, fuel.ceil() as i32));
        }

        Some(order)
    }

    /// The second half, sent once the wear read in the stall is current: the
    /// corners worn past the threshold behind a `clearTires`, so the set is
    /// exactly what auto mode decided. A lone `clearTires` is a decision too —
    /// "these tires stay on" — the sim arms the previous set on its own.
    fn tire_order(&mut self, input: &PitAutoInput, config: &PitAutoConfig) -> Option<PitOrder> {
        if !self.is_tires_pending(config) || self.tires_sent {
            return None;
        }

        self.tires_sent = true;

        let mut order = vec![request(PitCommandKind::ClearTires, 0)];

        // A corner the sim reports nothing for is left out: an unknown tire is
        // not a worn one.
        for (kind, wear) in CORNER_KINDS.into_iter().zip(input.tire_wear) {
            if wear.is_some_and(|wear| {
                wear * WEAR_TO_PCT <= config.tire_wear_threshold_pct + WEAR_THRESHOLD_TOLERANCE_PCT
            }) {
                order.push(request(kind, 0));
            }
        }

        Some(order)
    }

    /// Ticks the fast repair whenever auto mode is on and the box is empty.
    /// Neither damage nor the reported count gates it: the box can be checked
    /// ahead of any damage, and `FastRepairAvailable` reads zero in sessions that
    /// still accept the command. The sim ignores what it will not grant.
    fn fast_repair_order(
        &mut self,
        input: &PitAutoInput,
        config: &PitAutoConfig,
    ) -> Option<PitOrder> {
        if !self.is_active(config) || input.fast_repair_ordered || self.fast_repair_sent {
            return None;
        }

        self.fast_repair_sent = true;

        Some(vec![request(PitCommandKind::FastRepair, 0)])
    }

    /// Wipes the order the sim arms by itself as the car leaves the box —
    /// always all four corners, the rest varying, not the previous order. Only
    /// the halves auto mode owns go; with auto mode off nothing does, since the
    /// armed order may be one the driver is counting on. The windshield and fast
    /// repair go with them: not ordering them and not removing what was imposed
    /// are different rules, and the sim ticks the windshield on every exit.
    fn self_armed_clear(&mut self, config: &PitAutoConfig) -> Option<PitOrder> {
        if self.self_armed_cleared || !self.is_active(config) {
            return None;
        }

        let fuel = self.is_fuel_pending(config);
        let tires = self.is_tires_pending(config);

        let order = match (fuel, tires) {
            // The whole order goes anyway: one broadcast instead of four. The
            // itemised form is for a half the driver still owns.
            (true, true) => vec![request(PitCommandKind::Clear, 0)],
            (false, false) => return None,
            _ => {
                let half = if fuel {
                    PitCommandKind::ClearFuel
                } else {
                    PitCommandKind::ClearTires
                };

                vec![
                    request(half, 0),
                    request(PitCommandKind::ClearWindshield, 0),
                    request(PitCommandKind::ClearFastRepair, 0),
                ]
            }
        };

        self.self_armed_cleared = true;
        // Both forms wipe the fast repair, the one auto mode placed included.
        // Releasing the latch lets it be placed again; the clear happens once a
        // stint, so this cannot turn into a fight.
        self.fast_repair_sent = false;

        Some(order)
    }
}

fn request(kind: PitCommandKind, value: i32) -> PitCommandRequest {
    PitCommandRequest { kind, value }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FULL_TREAD: [Option<f32>; 4] = [Some(1.0); 4];

    fn config() -> PitAutoConfig {
        PitAutoConfig {
            auto_fuel: true,
            auto_tires: true,
            tire_wear_threshold_pct: 60.0,
            widget_on_screen: true,
        }
    }

    /// On track, nothing armed, fast repair already on the order so it stays
    /// out of tests about something else.
    fn on_track() -> PitAutoInput {
        PitAutoInput {
            fast_repair_ordered: true,
            tire_wear: FULL_TREAD,
            planned_fuel_l: Some(24.1),
            ..Default::default()
        }
    }

    fn on_pit_road() -> PitAutoInput {
        PitAutoInput {
            on_pit_road: true,
            ..on_track()
        }
    }

    fn in_stall(tire_wear: [Option<f32>; 4]) -> PitAutoInput {
        PitAutoInput {
            in_pit_stall: true,
            tire_wear,
            ..on_pit_road()
        }
    }

    fn wear(lf: f32, rf: f32, lr: f32, rr: f32) -> [Option<f32>; 4] {
        [Some(lf), Some(rf), Some(lr), Some(rr)]
    }

    fn order(requests: &[(PitCommandKind, i32)]) -> PitOrder {
        requests
            .iter()
            .map(|(kind, value)| request(*kind, *value))
            .collect()
    }

    fn fuel_order(liters: i32) -> PitOrder {
        order(&[
            (PitCommandKind::ClearFuel, 0),
            (PitCommandKind::Fuel, liters),
        ])
    }

    /// A pit stop from the track into the stall, collecting everything sent.
    fn drive_into_stall(
        auto: &mut PitAuto,
        config: &PitAutoConfig,
        stall_wear: [Option<f32>; 4],
    ) -> Vec<PitOrder> {
        let mut orders = auto.step(&on_track(), config);

        orders.extend(auto.step(&on_pit_road(), config));
        orders.extend(auto.step(&in_stall(stall_wear), config));

        orders
    }

    /// A self-armed clear already spent this stint, so a test about something
    /// else starts from a quiet track.
    fn settled(config: &PitAutoConfig) -> PitAuto {
        let mut auto = PitAuto::default();

        auto.step(
            &PitAutoInput {
                armed_flags: 1,
                ..on_track()
            },
            config,
        );

        auto
    }

    mod the_order_the_sim_arms_by_itself {
        use super::*;

        fn armed() -> PitAutoInput {
            PitAutoInput {
                armed_flags: 0x7f,
                ..on_track()
            }
        }

        #[test]
        fn wipes_both_halves_auto_mode_owns_with_a_single_clear() {
            let mut auto = PitAuto::default();

            assert_eq!(
                auto.step(&armed(), &config()),
                vec![order(&[(PitCommandKind::Clear, 0)])]
            );
        }

        #[test]
        fn wipes_it_once_per_stint() {
            let mut auto = PitAuto::default();

            auto.step(&armed(), &config());

            assert!(auto.step(&armed(), &config()).is_empty());
        }

        #[test]
        fn wipes_again_on_the_stint_after_the_next_stop() {
            let mut auto = PitAuto::default();

            auto.step(&armed(), &config());
            auto.step(&on_pit_road(), &config());

            assert!(auto
                .step(&armed(), &config())
                .contains(&order(&[(PitCommandKind::Clear, 0)])));
        }

        #[test]
        fn waits_for_the_car_to_leave_pit_road() {
            let mut auto = PitAuto::default();
            let armed_on_pit_road = PitAutoInput {
                on_pit_road: true,
                ..armed()
            };

            assert!(auto.step(&armed_on_pit_road, &config()).is_empty());
        }

        #[test]
        fn leaves_it_alone_when_auto_mode_is_off() {
            let mut auto = PitAuto {
                suspended: true,
                ..Default::default()
            };

            assert!(auto.step(&armed(), &config()).is_empty());
        }

        #[test]
        fn leaves_a_half_the_driver_has_taken_over_alone() {
            let mut auto = PitAuto::default();

            auto.command(
                PitAutoCommand::Claim(PitClaim {
                    fuel: true,
                    tires: false,
                }),
                &config(),
            );

            assert_eq!(
                auto.step(&armed(), &config()),
                vec![order(&[
                    (PitCommandKind::ClearTires, 0),
                    (PitCommandKind::ClearWindshield, 0),
                    (PitCommandKind::ClearFastRepair, 0),
                ])]
            );
        }

        // Both halves are the driver's, so there is nothing to wipe and the
        // imposed boxes are left with the rest of their order.
        #[test]
        fn sends_nothing_once_the_driver_owns_both_halves() {
            let mut auto = PitAuto::default();

            auto.command(
                PitAutoCommand::Claim(PitClaim {
                    fuel: true,
                    tires: true,
                }),
                &config(),
            );

            assert!(auto.step(&armed(), &config()).is_empty());
        }

        #[test]
        fn sends_nothing_when_auto_mode_owns_neither_half() {
            let mut auto = PitAuto::default();
            let config = PitAutoConfig {
                auto_fuel: false,
                auto_tires: false,
                ..config()
            };

            assert!(auto.step(&armed(), &config).is_empty());
        }
    }

    mod the_fast_repair {
        use super::*;

        fn empty_box() -> PitAutoInput {
            PitAutoInput {
                fast_repair_ordered: false,
                ..on_track()
            }
        }

        // Neither damage nor a reported count gates it: the sim leaves the
        // timers at zero until it has assessed the damage, and reports no fast
        // repairs in sessions that still take the command.
        #[test]
        fn orders_it_as_soon_as_auto_mode_is_on() {
            let mut auto = PitAuto::default();

            assert_eq!(
                auto.step(&empty_box(), &config()),
                vec![order(&[(PitCommandKind::FastRepair, 0)])]
            );
        }

        #[test]
        fn leaves_an_order_the_sim_already_has_alone() {
            let mut auto = PitAuto::default();

            assert!(auto.step(&on_track(), &config()).is_empty());
        }

        #[test]
        fn sends_nothing_with_auto_mode_off() {
            let mut auto = PitAuto::default();
            let config = PitAutoConfig {
                auto_fuel: false,
                auto_tires: false,
                ..config()
            };

            assert!(auto.step(&empty_box(), &config).is_empty());
        }

        #[test]
        fn sends_once_per_stop() {
            let mut auto = PitAuto::default();

            auto.step(&empty_box(), &config());

            assert!(auto.step(&empty_box(), &config()).is_empty());
        }
    }

    #[test]
    fn orders_only_the_corners_worn_past_the_threshold() {
        let mut auto = settled(&config());

        let orders = drive_into_stall(&mut auto, &config(), wear(0.55, 0.62, 0.9, 0.6));

        assert_eq!(
            orders,
            vec![
                fuel_order(25),
                order(&[
                    (PitCommandKind::ClearTires, 0),
                    (PitCommandKind::Lf, 0),
                    (PitCommandKind::Rr, 0),
                ]),
            ]
        );
    }

    #[test]
    fn takes_the_worst_of_the_three_points_across_the_tread() {
        let chassis = ChassisFrame {
            lf_wear_l: Some(0.4),
            lf_wear_m: Some(0.95),
            lf_wear_r: Some(0.95),
            ..Default::default()
        };

        assert_eq!(worst_tire_wear(&chassis), [Some(0.4), None, None, None]);
    }

    // On pit road the sim still reports the previous stop's tread; only the
    // reading taken in the box may decide the order.
    #[test]
    fn orders_tires_from_the_wear_read_in_the_box_not_on_pit_entry() {
        let mut auto = settled(&config());

        auto.step(&on_track(), &config());

        assert_eq!(auto.step(&on_pit_road(), &config()), vec![fuel_order(25)]);

        let refreshed = PitAutoInput {
            tire_wear: wear(0.3, 1.0, 1.0, 1.0),
            ..on_pit_road()
        };

        assert_eq!(
            auto.step(&refreshed, &config()),
            vec![order(&[
                (PitCommandKind::ClearTires, 0),
                (PitCommandKind::Lf, 0)
            ])]
        );
    }

    #[test]
    fn orders_tires_when_the_crew_starts_before_the_stall_flag() {
        let mut auto = settled(&config());

        auto.step(&on_pit_road(), &config());

        let serviced = PitAutoInput {
            service_active: true,
            ..on_pit_road()
        };

        assert_eq!(
            auto.step(&serviced, &config()),
            vec![order(&[(PitCommandKind::ClearTires, 0)])]
        );
    }

    // "Change nothing" has to be enforced: the sim arms the previous stop's set
    // by itself, so staying silent would leave four tires ordered.
    #[test]
    fn clears_the_tires_when_no_corner_is_worn_enough_to_change() {
        let mut auto = settled(&config());

        let orders = drive_into_stall(&mut auto, &config(), FULL_TREAD);

        assert_eq!(
            orders.last(),
            Some(&order(&[(PitCommandKind::ClearTires, 0)]))
        );
    }

    #[test]
    fn clears_the_fuel_when_none_is_needed() {
        let mut auto = settled(&config());
        let no_plan = PitAutoInput {
            planned_fuel_l: None,
            ..on_pit_road()
        };

        auto.step(&on_track(), &config());

        assert_eq!(
            auto.step(&no_plan, &config()),
            vec![order(&[(PitCommandKind::ClearFuel, 0)])]
        );
    }

    #[test]
    fn does_not_order_fuel_for_a_car_already_on_pit_road_at_start() {
        let mut auto = PitAuto::default();

        assert!(auto.step(&on_pit_road(), &config()).is_empty());
    }

    #[test]
    fn sends_each_half_once_per_stop() {
        let mut auto = settled(&config());
        let worn = wear(0.3, 1.0, 1.0, 1.0);

        assert_eq!(drive_into_stall(&mut auto, &config(), worn).len(), 2);

        let crew_on = PitAutoInput {
            service_active: true,
            ..in_stall(worn)
        };

        assert!(auto.step(&crew_on, &config()).is_empty());

        auto.step(&on_track(), &config());

        assert!(auto
            .step(&on_pit_road(), &config())
            .contains(&fuel_order(25)));
    }

    #[test]
    fn leaves_out_a_section_the_driver_switched_off() {
        let config = PitAutoConfig {
            auto_fuel: false,
            ..config()
        };
        let mut auto = settled(&config);

        let orders = drive_into_stall(&mut auto, &config, wear(0.1, 1.0, 1.0, 1.0));

        assert_eq!(
            orders,
            vec![order(&[
                (PitCommandKind::ClearTires, 0),
                (PitCommandKind::Lf, 0)
            ])]
        );
    }

    #[test]
    fn stands_both_halves_down_when_the_driver_takes_the_stop_over() {
        let mut auto = settled(&config());

        auto.command(PitAutoCommand::ToggleAuto, &config());

        assert_eq!(auto.mode(&config()), PitAutoMode::Manual);
        assert!(drive_into_stall(&mut auto, &config(), wear(0.1, 1.0, 1.0, 1.0)).is_empty());
    }

    // Auto mode doing its job is not the driver taking over: the two used to
    // share a flag, and the plate flipped to MANUAL the moment auto succeeded.
    #[test]
    fn still_reads_auto_after_auto_mode_has_sent_both_halves() {
        let mut auto = settled(&config());

        assert_eq!(
            drive_into_stall(&mut auto, &config(), wear(0.3, 1.0, 1.0, 1.0)).len(),
            2
        );
        assert_eq!(auto.mode(&config()), PitAutoMode::Auto);
    }

    #[test]
    fn names_the_halves_auto_mode_still_owns() {
        let mut auto = PitAuto::default();
        let claim = |fuel, tires| PitAutoCommand::Claim(PitClaim { fuel, tires });

        assert_eq!(auto.mode(&config()), PitAutoMode::Auto);

        auto.command(claim(true, false), &config());

        assert_eq!(auto.mode(&config()), PitAutoMode::TireAuto);

        auto.command(claim(false, true), &config());

        assert_eq!(auto.mode(&config()), PitAutoMode::Manual);

        let mut tires_by_hand = PitAuto::default();

        tires_by_hand.command(claim(false, true), &config());

        assert_eq!(tires_by_hand.mode(&config()), PitAutoMode::FuelAuto);
    }

    #[test]
    fn has_no_plate_while_auto_mode_is_switched_off() {
        let config = PitAutoConfig {
            auto_fuel: false,
            auto_tires: false,
            ..config()
        };

        assert_eq!(PitAuto::default().mode(&config), PitAutoMode::Off);
    }

    // Correcting the fuel is the most ordinary thing a driver does on the way
    // in, and it says nothing at all about the tires.
    #[test]
    fn a_claimed_fuel_half_leaves_the_tires_to_auto_mode() {
        let mut auto = settled(&config());

        auto.command(
            PitAutoCommand::Claim(PitClaim {
                fuel: true,
                tires: false,
            }),
            &config(),
        );

        assert_eq!(
            drive_into_stall(&mut auto, &config(), wear(0.3, 1.0, 1.0, 1.0)),
            vec![order(&[
                (PitCommandKind::ClearTires, 0),
                (PitCommandKind::Lf, 0)
            ])]
        );
    }

    #[test]
    fn a_claimed_tire_half_leaves_the_fuel_to_auto_mode() {
        let mut auto = settled(&config());

        auto.command(
            PitAutoCommand::Claim(PitClaim {
                fuel: false,
                tires: true,
            }),
            &config(),
        );

        assert_eq!(
            drive_into_stall(&mut auto, &config(), wear(0.3, 1.0, 1.0, 1.0)),
            vec![fuel_order(25)]
        );
    }

    // The way back into auto mode inside a stop. Without it a driver who has
    // corrected the fuel is stuck at TIRE AUTO until the next pit exit.
    #[test]
    fn restores_both_halves_when_the_auto_key_is_pressed_from_a_half_manual_stop() {
        let mut auto = PitAuto::default();

        auto.command(
            PitAutoCommand::Claim(PitClaim {
                fuel: true,
                tires: false,
            }),
            &config(),
        );
        auto.command(PitAutoCommand::ToggleAuto, &config());

        assert_eq!(auto.mode(&config()), PitAutoMode::Auto);
    }

    #[test]
    fn hands_the_stop_to_the_driver_when_the_auto_key_is_pressed_from_auto() {
        let mut auto = PitAuto::default();

        auto.command(PitAutoCommand::ToggleAuto, &config());

        assert_eq!(auto.mode(&config()), PitAutoMode::Manual);

        auto.command(PitAutoCommand::ToggleAuto, &config());

        assert_eq!(auto.mode(&config()), PitAutoMode::Auto);
    }

    // The off switch outlives the stop: pit exit clearing it turned "I switched
    // auto off" into "auto is back on next lap".
    #[test]
    fn stays_switched_off_across_a_pit_stop() {
        let mut auto = settled(&config());

        auto.command(PitAutoCommand::ToggleAuto, &config());
        auto.step(&on_pit_road(), &config());
        auto.step(&on_track(), &config());

        assert_eq!(auto.mode(&config()), PitAutoMode::Manual);
    }

    #[test]
    fn hands_a_half_taken_over_by_hand_back_after_the_stop() {
        let mut auto = settled(&config());

        auto.command(
            PitAutoCommand::Claim(PitClaim {
                fuel: true,
                tires: false,
            }),
            &config(),
        );
        auto.step(&on_pit_road(), &config());
        auto.step(&on_track(), &config());

        assert_eq!(auto.mode(&config()), PitAutoMode::Auto);
    }

    #[test]
    fn sends_nothing_when_the_widget_is_not_on_screen() {
        let config = PitAutoConfig {
            widget_on_screen: false,
            ..config()
        };
        let mut auto = PitAuto::default();
        let armed_and_empty = PitAutoInput {
            armed_flags: 0x7f,
            fast_repair_ordered: false,
            ..on_track()
        };

        assert!(auto.step(&armed_and_empty, &config).is_empty());
        assert!(drive_into_stall(&mut auto, &config, wear(0.1, 1.0, 1.0, 1.0)).is_empty());
        assert_eq!(auto.mode(&config), PitAutoMode::Off);
    }

    #[test]
    fn is_off_entirely_when_neither_fuel_nor_tires_are_automatic() {
        let config = PitAutoConfig {
            auto_fuel: false,
            auto_tires: false,
            ..config()
        };
        let mut auto = PitAuto::default();

        assert!(drive_into_stall(&mut auto, &config, wear(0.1, 1.0, 1.0, 1.0)).is_empty());
    }

    #[test]
    fn counts_what_went_out() {
        let mut auto = PitAuto::default();

        auto.record_send(true);
        auto.record_send(false);

        let frame = auto.frame(&config());

        assert_eq!(frame.orders_sent, 2);
        assert_eq!(frame.last_order_ok, Some(false));
    }
}
