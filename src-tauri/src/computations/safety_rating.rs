//! An estimate of the player's Safety Rating, now and at the flag.
//!
//! iRacing does not publish its Safety Rating formula. The model here is the
//! reconstruction by [Nishizumi-SR](https://github.com/nishizumi-maho/Nishizumi-SR)
//! (nishizumi-maho, MIT), fitted to the official before/after CPI that iRacing's
//! results API reports for 123,361 driver-sessions — held-out mean error
//! 0.033 SR, 88 % of sessions within ±0.05. The equations and how the constants
//! were measured are in its `docs/MODEL.md`; nothing here is iRacing's own, and
//! the widget marks every number it draws as an estimate.
//!
//! The hidden state is CPI, corners per incident. A displayed rating is only a
//! mapping of it into a whole-number band:
//!
//! ```text
//! Φ(κ, b) = Φ0 · r^(κ + b)           CPI at which band b shows b.00
//! S       = b + a · ln(P / Φ(κ, b))  rating of CPI P in band b
//! α       = 1 − e^(−c / W(κ, b))     the session's weight in a moving average
//! 1/P'    = (1 − α)/P + α · x/c      incidents per corner after the session
//! ```
//!
//! then redrawn in the neighbouring band while the result leaves
//! `[b, b + 1)`. The ~0.4 jump across a whole number falls out of that geometry
//! (`1 − a·ln r`); no bonus is added on top. `a`, `r` and `Φ0` come from a
//! least-squares fit to observed (SR, CPI, licence) triples, the window
//! constants from the session data — they are measurements, not tuning knobs.
//!
//! Corners are counted by distance, as iRacing scores them: a tow moves the lap
//! counter without a corner driven, an abandoned lap still earned its corners.
//! The estimate covers the local driver only — the SDK cannot see a teammate's
//! stint driven on another PC.

use serde::{Deserialize, Serialize};
use tracing::info;

use crate::capabilities::Capabilities;
use crate::computations::fuel::laps_to_finish;
use crate::computations::{
    ComputeContext, ComputedOutput, Processor, ProcessorCommand, ProcessorId, TickRate,
};
use crate::model::enums::TrackSurface;
use crate::model::session::SessionSnapshot;

/// Slope of the CPI → rating mapping inside one band.
const A_SLOPE: f64 = 1.5236;
/// Ratio of floor CPIs between neighbouring bands and classes.
const R_RATIO: f64 = 1.4562;
/// Floor CPI of class R, band 0.
const F0_CPI: f64 = 3.4949;
/// Memory of the moving average in band 1, in corners.
const WINDOW_BAND1: f64 = 1060.0;
/// Growth of that memory per band — √2 to the precision it was fitted, and
/// the fitted value is the one the reference vectors were made with.
#[allow(clippy::approx_constant)]
const WINDOW_BAND_RATIO: f64 = 1.4142;
/// Rookie and class D ratings move measurably faster than the rest.
const WINDOW_FACTOR_ROOKIE: f64 = 0.69;
const WINDOW_FACTOR_CLASS_D: f64 = 0.83;
/// A sanity clamp on one session's change; never reached in practice.
const MAX_ABS_SESSION_DELTA: f64 = 3.0;

const BAND_MIN: i32 = 0;
const BAND_MAX: i32 = 4;
const SR_DISPLAY_MIN: f64 = 0.0;
/// Sporting Code 3.7.2.
const SR_DISPLAY_MAX: f64 = 4.99;
/// Incidents per corner below which the window is treated as perfectly clean.
const CLEAN_INCIDENT_RATE: f64 = 1e-9;
/// The CPI that stands for a perfectly clean window: huge, but finite.
const CLEAN_CPI: f64 = 1e9;
/// Bound on the band remap; it converges in one or two steps.
const MAX_REMAP_STEPS: usize = 8;

/// Bands per licence class in `LicLevel`.
const BANDS_PER_CLASS: i32 = 4;
/// `LicSubLevel` is the rating × 100.
const SUB_LEVEL_SCALE: f64 = 100.0;

/// The largest share of a lap one tick can plausibly cover. A tow, a reset or
/// a teleport covers more, and is resynchronised without crediting corners.
const MAX_TICK_FRACTION: f64 = 0.10;

/// Sporting Code 3.6.1.1, "Table of Corner and Incident Multipliers".
const WEIGHT_RACE: f32 = 1.0;
const WEIGHT_OPEN: f32 = 0.5;
const WEIGHT_LONE: f32 = 0.35;

/// What the Safety Rating estimate knows at this tick.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SafetyRatingFrame {
    /// The local driver's own incident points this session.
    pub driver_incidents: i32,
    /// The crew's incident points this session; only in a team race, where
    /// the limit and the penalties count them.
    pub team_incidents: Option<i32>,
    /// Corners driven this session, by distance — real corners, not weighted.
    pub corners_driven: f32,
    /// The session's corner and incident multiplier; 0 where SR does not move.
    pub session_weight: f32,
    /// `Some(false)` for a session known not to change SR (a league), `None`
    /// when the session YAML cannot tell.
    pub is_ranked: Option<bool>,
    /// The rating the session started from; `None` until the sim sends it.
    pub sr_start: Option<f32>,
    /// The estimate for the corners and incidents so far.
    pub sr_now: Option<f32>,
    /// The estimate at the flag, with the corners left driven clean; `None`
    /// when the distance left cannot be estimated.
    pub sr_finish: Option<f32>,
    /// Clean corners still needed for the session to come out level or better;
    /// `None` without a rating or in a session that does not move it.
    pub clean_corners_needed: Option<f32>,
}

/// A licence class and a whole-number band, as the model reads a licence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Licence {
    /// 0 Rookie, 1 D, 2 C, 3 B, 4 A, 5 Pro.
    pub class_index: i32,
    pub band: i32,
}

impl Licence {
    fn in_band(self, band: i32) -> Self {
        Self { band, ..self }
    }
}

/// SDK `LicLevel` (1..24) carries the class and the band together: level 13
/// is class B band 1. The band is read from here, not from `floor(SR)` — right
/// after a jump to 3.41 the band is 3 while the CPI is the old band's 2.99.
pub fn licence_from_level(lic_level: i32) -> Licence {
    Licence {
        class_index: (lic_level - 1) / BANDS_PER_CLASS,
        band: (lic_level - 1) % BANDS_PER_CLASS + 1,
    }
}

/// The corner and incident multiplier of a raw `SessionType`. Matched by
/// substring: the sim has no closed list of the values it sends. Offline
/// testing and anything unrecognised weigh nothing.
pub fn session_weight(session_type: &str) -> f32 {
    let label = session_type.to_ascii_lowercase();

    if label.contains("time trial") || (label.contains("lone") && label.contains("qualify")) {
        return WEIGHT_LONE;
    }

    if label.contains("qualify") || label.contains("warmup") || label.contains("practice") {
        return WEIGHT_OPEN;
    }

    if label.contains("heat") || label.contains("race") {
        return WEIGHT_RACE;
    }

    0.0
}

/// The multiplier of a session inside its event. A practice or test server
/// (`WeekendInfo.EventType`) is not a ranked event, so nothing on it counts —
/// Sporting Code 3.7.1.1 scores practice only inside a ranked event.
pub fn event_session_weight(event_type: &str, session_type: &str) -> f32 {
    let event = event_type.to_ascii_lowercase();

    if event.contains("practice") || event.contains("test") {
        return 0.0;
    }

    session_weight(session_type)
}

/// CPI at the floor of a band — the exact CPI of e.g. "3.00".
fn band_floor_cpi(licence: Licence) -> f64 {
    // `powf`, not `powi`: the reference rounds like `Math.pow`, and at a band
    // floor one ulp decides which side of the whole number a rating falls.
    F0_CPI * R_RATIO.powf(f64::from(licence.class_index + licence.band))
}

fn sr_from_cpi(cpi: f64, licence: Licence) -> f64 {
    if cpi <= 0.0 {
        return f64::from(licence.band);
    }

    f64::from(licence.band) + A_SLOPE * (cpi / band_floor_cpi(licence)).ln()
}

/// The CPI behind a displayed rating in a given band.
pub fn cpi_from_sr(sr: f64, licence: Licence) -> f64 {
    let band = licence.band.clamp(BAND_MIN, BAND_MAX);

    band_floor_cpi(licence.in_band(band)) * ((sr - f64::from(band)) / A_SLOPE).exp()
}

/// Sporting Code 3.7.4: the same CPI redrawn in the neighbouring band while
/// the rating leaves `[band, band + 1)`. Returns the rating and its band.
fn remap_band(cpi: f64, licence: Licence) -> (f64, i32) {
    let mut band = licence.band.clamp(BAND_MIN, BAND_MAX);

    for _ in 0..MAX_REMAP_STEPS {
        let sr = sr_from_cpi(cpi, licence.in_band(band));

        if sr >= f64::from(band) + 1.0 && band < BAND_MAX {
            band += 1;

            continue;
        }

        if sr < f64::from(band) && band > BAND_MIN {
            band -= 1;

            continue;
        }

        break;
    }

    let sr = sr_from_cpi(cpi, licence.in_band(band)).clamp(SR_DISPLAY_MIN, SR_DISPLAY_MAX);

    (sr, band)
}

/// The moving average's memory, in corners. Longer in higher bands, which is
/// why the rating gets harder to move as it climbs.
fn window_corners(licence: Licence) -> f64 {
    let factor = match licence.class_index {
        index if index <= 0 => WINDOW_FACTOR_ROOKIE,
        1 => WINDOW_FACTOR_CLASS_D,
        _ => 1.0,
    };

    WINDOW_BAND1 * WINDOW_BAND_RATIO.powf(f64::from((licence.band - 1).max(0))) * factor
}

/// The share of the moving average one session of weighted `corners` takes.
fn session_alpha(corners: f64, licence: Licence) -> f64 {
    if corners <= 0.0 {
        return 0.0;
    }

    1.0 - (-corners / window_corners(licence).max(1.0)).exp()
}

/// One session folded into the accumulated CPI. `corners` and `incidents`
/// carry the session weight already.
fn update_cpi(cpi_old: f64, corners: f64, incidents: f64, licence: Licence) -> f64 {
    if corners <= 0.0 || cpi_old <= 0.0 {
        return cpi_old;
    }

    let alpha = session_alpha(corners, licence);
    let rate = (1.0 - alpha) / cpi_old + alpha * incidents / corners;

    if rate <= CLEAN_INCIDENT_RATE {
        return CLEAN_CPI;
    }

    1.0 / rate
}

/// The rating after a session of weighted `corners` and `incidents`, started
/// at `sr_before` in `licence`.
pub fn project_sr(sr_before: f64, licence: Licence, corners: f64, incidents: f64) -> f64 {
    project(sr_before, licence, corners, incidents).0
}

/// [`project_sr`] with the licence the rating ends in: a session that crosses
/// a whole number leaves the next one starting in the neighbouring band.
fn project(sr_before: f64, licence: Licence, corners: f64, incidents: f64) -> (f64, Licence) {
    let cpi_old = cpi_from_sr(sr_before, licence);
    let cpi = update_cpi(cpi_old, corners, incidents, licence);
    let (sr, band) = remap_band(cpi, licence);
    let delta = (sr - sr_before).clamp(-MAX_ABS_SESSION_DELTA, MAX_ABS_SESSION_DELTA);

    (sr_before + delta, licence.in_band(band))
}

/// Corners to drive clean before the session stops costing rating:
/// `ΔS ≥ 0 ⇔ x / c ≤ 1 / P`. The session weight multiplies both sides, so
/// real counts serve.
pub fn clean_corners_needed(incidents: f64, corners: f64, start_cpi: f64) -> f64 {
    (incidents * start_cpi - corners).max(0.0)
}

/// Distance driven this session, in laps, for the corners it earned.
#[derive(Debug, Default, Clone)]
pub struct CornerAccumulator {
    distance_laps: f64,
    previous_pct: Option<f64>,
}

impl CornerAccumulator {
    /// One tick. The pit box and the world outside the car earn nothing and
    /// break the trail; a jump bigger than a tick could drive resynchronises.
    pub fn update(&mut self, lap_dist_pct: Option<f32>, surface: TrackSurface) {
        let in_world = !matches!(surface, TrackSurface::NotInWorld | TrackSurface::InPitStall);
        let pct = lap_dist_pct
            .map(f64::from)
            .filter(|pct| in_world && (0.0..=1.0).contains(pct));

        let Some(pct) = pct else {
            self.previous_pct = None;

            return;
        };

        let Some(previous) = self.previous_pct.replace(pct) else {
            return;
        };

        let mut delta = pct - previous;

        // Crossed the start/finish line.
        if delta < 0.0 {
            delta += 1.0;
        }

        if delta <= MAX_TICK_FRACTION {
            self.distance_laps += delta;
        }
    }

    pub fn corners(&self, corners_per_lap: f64) -> f64 {
        self.distance_laps * corners_per_lap
    }
}

/// What a session started from, each value latched once it is known.
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct SessionStart {
    session_num: Option<i32>,
    driver_incidents: Option<i32>,
    team_incidents: Option<i32>,
    /// The rating the session is estimated from.
    rating: Option<(f64, Licence)>,
    /// The YAML's own rating as first seen in this session — stale or not.
    yaml_rating: Option<f64>,
    /// The previous session's outcome, used while the YAML still shows the
    /// rating from before it.
    carried: Option<Carry>,
}

/// Where one session of an event left the rating, for the next to start from.
///
/// iRacing scores every ranked session of an event — practice, qualifying and
/// the race each move SR (Sporting Code 3.7.1.1) — but writes the new rating
/// into the session YAML only once the event is over (seen on a live event:
/// `LicSubLevel` unchanged from practice to the race). So the next session
/// starts from this estimate; should the YAML ever change mid-event, the sim's
/// number wins.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Carry {
    /// The YAML rating the carrying session saw; equal means not rewritten.
    yaml_rating: Option<f64>,
    rating: (f64, Licence),
}

/// Distance driven between two saves while nothing else changes, in laps.
const SAVE_EVERY_LAPS: f64 = 0.25;

/// What the processor knows about the event in progress, written to disk so a
/// restart of the app mid-event picks up where it left off — the qualifying
/// carried into the race included. Never history: one event, overwritten.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SafetyRatingState {
    /// The event (`WeekendInfo.SubSessionID`) the state belongs to.
    pub sub_session_id: i32,
    start: SessionStart,
    distance_laps: f64,
    outcome: Option<Carry>,
}

#[cfg(test)]
impl SafetyRatingState {
    /// An event with nothing counted yet, for tests of where the state goes.
    pub fn empty_for(sub_session_id: i32) -> Self {
        Self {
            sub_session_id,
            start: SessionStart::default(),
            distance_laps: 0.0,
            outcome: None,
        }
    }
}

#[derive(Default)]
pub struct SafetyRatingProcessor {
    start: SessionStart,
    corners: CornerAccumulator,
    /// The current session's outcome so far, handed on when it changes.
    outcome: Option<Carry>,
    /// The event the state belongs to; a different one starts from scratch.
    sub_session_id: Option<i32>,
    /// The last state handed out to be saved.
    saved: Option<SafetyRatingState>,
}

/// Points since the session's base. A counter that went backwards was reset
/// by the sim, and becomes the new base.
fn since_base(base: &mut Option<i32>, current: Option<i32>) -> Option<i32> {
    let current = current?;
    let base_value = *base.get_or_insert(current);

    if current < base_value {
        *base = Some(current);

        return Some(0);
    }

    Some(current - base_value)
}

/// The player's rating and licence as the session YAML has them right now.
fn player_rating(session: &SessionSnapshot) -> Option<(f64, Licence)> {
    let player = session
        .cars
        .iter()
        .find(|car| car.car_idx == session.player_car_idx)?;

    Some((
        f64::from(player.lic_sub_level?) / SUB_LEVEL_SCALE,
        licence_from_level(player.lic_level?),
    ))
}

impl SafetyRatingProcessor {
    fn begin_session_if_new(&mut self, session_num: Option<i32>) {
        if self.start.session_num == session_num {
            return;
        }

        let is_next_session = self.start.session_num.is_some();

        // Logged so a live event answers whether the YAML is rewritten
        // between sessions, and how the estimate compares with the site.
        if let Some(carry) = self.outcome.filter(|_| is_next_session) {
            info!(
                from_session = ?self.start.session_num,
                to_session = ?session_num,
                sr_end = carry.rating.0,
                yaml_sr = ?carry.yaml_rating,
                "safety rating: session ended, carrying the estimate"
            );
        }

        self.start = SessionStart {
            session_num,
            carried: self.outcome.take().filter(|_| is_next_session),
            ..SessionStart::default()
        };
        self.corners = CornerAccumulator::default();
    }

    /// The rating this session starts from: carried over from the previous
    /// session until the YAML is rewritten, the YAML's own first value
    /// otherwise. The first value is kept because the YAML may already carry
    /// the rating iRacing wrote after this session.
    fn start_rating(&mut self, yaml: Option<(f64, Licence)>) -> Option<(f64, Licence)> {
        let yaml_sr = yaml.map(|(sr, _)| sr);

        if self.start.yaml_rating.is_none() {
            self.start.yaml_rating = yaml_sr;
        }

        if let Some(carry) = self.start.carried {
            if yaml_sr.is_none() || yaml_sr == carry.yaml_rating {
                return Some(carry.rating);
            }

            // Rewritten: the sim's rating replaces the estimate for good.
            info!(
                session = ?self.start.session_num,
                carried_sr = carry.rating.0,
                yaml_before = ?carry.yaml_rating,
                yaml_now = ?yaml_sr,
                "safety rating: the session YAML was rewritten mid-event"
            );
            self.start.carried = None;
            self.start.rating = yaml;
            self.start.yaml_rating = yaml_sr;
        }

        if self.start.rating.is_none() {
            self.start.rating = yaml;
        }

        self.start.rating
    }

    /// A new event without a disconnect in between starts from scratch.
    fn follow_event(&mut self, sub_session_id: Option<i32>) {
        if self.sub_session_id == sub_session_id {
            return;
        }

        if self.sub_session_id.is_some() {
            self.reset_state();
        }

        self.sub_session_id = sub_session_id;
    }

    fn reset_state(&mut self) {
        self.start = SessionStart::default();
        self.corners = CornerAccumulator::default();
        self.outcome = None;
        self.saved = None;
    }

    /// Takes over a state saved before the app restarted — only into a
    /// processor that has not started on anything yet, so a stale save can
    /// never overwrite the event being counted.
    fn restore(&mut self, state: SafetyRatingState) {
        if self.start.session_num.is_some() {
            return;
        }

        info!(
            sub_session_id = state.sub_session_id,
            session = ?state.start.session_num,
            distance_laps = state.distance_laps,
            "safety rating: restored the event after a restart"
        );

        self.sub_session_id = Some(state.sub_session_id);
        self.start = state.start.clone();
        self.corners = CornerAccumulator {
            distance_laps: state.distance_laps,
            previous_pct: None,
        };
        self.outcome = state.outcome;
        self.saved = Some(state);
    }

    /// The state to write, when it differs from the last one written: at once
    /// for a new session or a new start value (an incident base, a rating),
    /// every [`SAVE_EVERY_LAPS`] for the distance alone. The incident count
    /// itself is not state — the sim keeps counting from the saved base.
    fn state_to_save(&mut self) -> Option<SafetyRatingState> {
        let state = SafetyRatingState {
            sub_session_id: self.sub_session_id?,
            start: self.start.clone(),
            distance_laps: self.corners.distance_laps,
            outcome: self.outcome,
        };

        let is_due = match &self.saved {
            None => true,
            Some(saved) => {
                saved.sub_session_id != state.sub_session_id
                    || saved.start != state.start
                    || state.distance_laps - saved.distance_laps >= SAVE_EVERY_LAPS
            }
        };

        if !is_due {
            return None;
        }

        self.saved = Some(state.clone());

        Some(state)
    }

    fn frame(&mut self, ctx: &ComputeContext) -> SafetyRatingFrame {
        let session = ctx.session;
        let session_num = ctx.session_num.or(Some(session.current_session_num));

        self.follow_event(session.sub_session_id);
        self.begin_session_if_new(session_num);

        let surface = usize::try_from(session.player_car_idx)
            .ok()
            .and_then(|idx| ctx.car_idx.car_idx_track_surface.get(idx).copied())
            .unwrap_or_default();

        self.corners.update(ctx.lap_timing.lap_dist_pct, surface);

        let driver_incidents = since_base(
            &mut self.start.driver_incidents,
            ctx.car_status.player_car_my_incident_count,
        )
        .unwrap_or(0);
        let team_incidents = since_base(
            &mut self.start.team_incidents,
            ctx.car_status.player_car_team_incident_count,
        )
        .filter(|_| session.team_racing);

        let start_rating = self.start_rating(player_rating(session));

        let weight = session_num
            .and_then(|num| usize::try_from(num).ok())
            .and_then(|num| session.sessions.get(num))
            .map(|entry| event_session_weight(&session.event_type, &entry.session_type_label))
            .unwrap_or(0.0);
        let weighting = f64::from(weight);
        let corners_per_lap = session.track_num_turns.map(f64::from);
        let corners = self.corners.corners(corners_per_lap.unwrap_or(0.0));
        let incidents = f64::from(driver_incidents);

        // Without the corners on a lap there is no distance to score.
        let rated = start_rating.filter(|_| corners_per_lap.is_some());
        let now = rated
            .map(|(sr, licence)| project(sr, licence, corners * weighting, incidents * weighting));
        let sr_now = now.map(|(sr, _)| sr);

        if let Some(end) = now {
            self.outcome = Some(Carry {
                yaml_rating: self.start.yaml_rating,
                rating: end,
            });
        }

        let (laps_left, _) = laps_to_finish(
            ctx.lap_timing,
            session,
            ctx.session_num,
            ctx.session_time_remain,
        );
        let corners_left = laps_left
            .zip(corners_per_lap)
            .map(|(laps, per_lap)| f64::from(laps.max(0.0)) * per_lap);
        let sr_finish = rated
            .zip(corners_left)
            .map(|((sr, licence), corners_left)| {
                project_sr(
                    sr,
                    licence,
                    (corners + corners_left) * weighting,
                    incidents * weighting,
                )
            });

        let clean_corners = rated.filter(|_| weight > 0.0).map(|(sr, licence)| {
            clean_corners_needed(incidents, corners, cpi_from_sr(sr, licence))
        });

        SafetyRatingFrame {
            driver_incidents,
            team_incidents,
            corners_driven: corners as f32,
            session_weight: weight,
            is_ranked: session.league_id.map(|_| false),
            sr_start: start_rating.map(|(sr, _)| sr as f32),
            sr_now: sr_now.map(|sr| sr as f32),
            sr_finish: sr_finish.map(|sr| sr as f32),
            clean_corners_needed: clean_corners.map(|needed| needed as f32),
        }
    }
}

impl Processor for SafetyRatingProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::SafetyRating
    }

    /// The licence and the incident counters come with the sim's roster.
    fn required(&self) -> Capabilities {
        Capabilities::STANDINGS
    }

    /// The tier it publishes on. A quarter second is a small share of the
    /// shortest lap, so the corner trail stays far under the jump threshold.
    fn rate(&self) -> TickRate {
        TickRate::Hz4
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let frame = self.frame(ctx);

        Some(ComputedOutput::SafetyRating {
            frame,
            save: self.state_to_save().map(Box::new),
        })
    }

    fn reset(&mut self) {
        self.reset_state();
        self.sub_session_id = None;
    }

    fn command(&mut self, command: &ProcessorCommand) {
        if let ProcessorCommand::RestoreSafetyRating(state) = command {
            self.restore(state.as_ref().clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;
    use crate::computations::fuel::FuelSettings;
    use crate::model::cars::CarIdxFrame;
    use crate::model::environment::EnvironmentFrame;
    use crate::model::player::{
        CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame,
        PitServiceFrame,
    };
    use crate::model::session::{CarEntry, SessionEntry};

    /// Nishizumi-SR's golden vectors, copied unchanged from
    /// <https://github.com/nishizumi-maho/Nishizumi-SR/blob/main/docs/integration/vectors.json>
    /// (© nishizumi-maho, MIT). Every section that maps onto a function here is
    /// checked against it; `license_strings` and `session_weight_lookups` are
    /// not, because this module reads `LicLevel` and the raw `SessionType`.
    const VECTORS: &str = include_str!("safety_rating_vectors.json");

    #[derive(Deserialize)]
    struct Vectors {
        _meta: Meta,
        constants: Constants,
        target_cpi_to_hold_3_00: Vec<TargetCpi>,
        license_levels: Vec<LicenceLevel>,
        band_floors: Vec<BandFloor>,
        sr_cpi: Vec<SrCpi>,
        remap: Vec<Remap>,
        windows: Vec<Window>,
        alphas: Vec<Alpha>,
        update_cpi: Vec<UpdateCpi>,
        project: Vec<Project>,
        corner_accumulator: Vec<CornerRun>,
    }

    #[derive(Deserialize)]
    struct Meta {
        tolerance: Tolerance,
    }

    #[derive(Deserialize)]
    struct Tolerance {
        sr: f64,
        cpi_relative: f64,
    }

    #[derive(Deserialize)]
    struct Constants {
        a_slope: f64,
        r_ratio: f64,
        f0_cpi: f64,
        window_band1: f64,
        window_band_ratio: f64,
        window_factor_rookie: f64,
        window_factor_class_d: f64,
        max_abs_session_delta: f64,
        sr_display_max: f64,
        band_crossing_bonus: f64,
    }

    #[derive(Deserialize)]
    struct TargetCpi {
        class_index: i32,
        target_cpi: f64,
    }

    #[derive(Deserialize)]
    struct LicenceLevel {
        lic_level: i32,
        class_index: i32,
        band: i32,
    }

    #[derive(Deserialize)]
    struct BandFloor {
        class_index: i32,
        band: i32,
        floor_cpi: f64,
    }

    #[derive(Deserialize)]
    struct SrCpi {
        sr: f64,
        class_index: i32,
        band: i32,
        cpi: f64,
        sr_round_trip: f64,
    }

    #[derive(Deserialize)]
    struct Remap {
        cpi: f64,
        class_index: i32,
        band: i32,
        sr: f64,
        final_band: i32,
    }

    #[derive(Deserialize)]
    struct Window {
        band: i32,
        class_index: i32,
        window: f64,
    }

    #[derive(Deserialize)]
    struct Alpha {
        corners: f64,
        band: i32,
        class_index: i32,
        alpha: f64,
    }

    #[derive(Deserialize)]
    struct UpdateCpi {
        cpi_old: f64,
        corners: f64,
        incident_points: f64,
        band: i32,
        class_index: i32,
        cpi_new: f64,
    }

    #[derive(Deserialize)]
    struct Project {
        comment: String,
        sr_before: f64,
        class_index: i32,
        corners: f64,
        incident_points: f64,
        projected_sr: f64,
        delta: f64,
        cpi_new: f64,
    }

    #[derive(Deserialize)]
    struct CornerRun {
        comment: String,
        corners_per_lap: f64,
        samples: Vec<CornerSample>,
        corners: f64,
    }

    #[derive(Deserialize)]
    struct CornerSample {
        lap_dist_pct: f32,
        track_surface: i32,
    }

    fn vectors() -> Vectors {
        serde_json::from_str(VECTORS).expect("the vectors file parses")
    }

    fn licence(class_index: i32, band: i32) -> Licence {
        Licence { class_index, band }
    }

    fn assert_sr(actual: f64, expected: f64, tolerance: &Tolerance, what: &str) {
        assert!(
            (actual - expected).abs() <= tolerance.sr,
            "{what}: {actual} != {expected}"
        );
    }

    fn assert_cpi(actual: f64, expected: f64, tolerance: &Tolerance, what: &str) {
        assert!(
            (actual - expected).abs() <= tolerance.cpi_relative * expected.abs().max(1.0),
            "{what}: {actual} != {expected}"
        );
    }

    #[test]
    fn the_constants_are_the_fitted_ones() {
        let constants = vectors().constants;

        assert_eq!(A_SLOPE, constants.a_slope);
        assert_eq!(R_RATIO, constants.r_ratio);
        assert_eq!(F0_CPI, constants.f0_cpi);
        assert_eq!(WINDOW_BAND1, constants.window_band1);
        assert_eq!(WINDOW_BAND_RATIO, constants.window_band_ratio);
        assert_eq!(WINDOW_FACTOR_ROOKIE, constants.window_factor_rookie);
        assert_eq!(WINDOW_FACTOR_CLASS_D, constants.window_factor_class_d);
        assert_eq!(MAX_ABS_SESSION_DELTA, constants.max_abs_session_delta);
        assert_eq!(SR_DISPLAY_MAX, constants.sr_display_max);
        assert!((1.0 - A_SLOPE * R_RATIO.ln() - constants.band_crossing_bonus).abs() < 1e-12);
    }

    #[test]
    fn lic_level_carries_class_and_band() {
        for case in vectors().license_levels {
            assert_eq!(
                licence_from_level(case.lic_level),
                licence(case.class_index, case.band),
                "LicLevel {}",
                case.lic_level
            );
        }
    }

    #[test]
    fn the_mapping_matches_the_vectors() {
        let vectors = vectors();
        let tolerance = &vectors._meta.tolerance;

        for case in &vectors.band_floors {
            let what = format!("floor {}/{}", case.class_index, case.band);

            assert_cpi(
                band_floor_cpi(licence(case.class_index, case.band)),
                case.floor_cpi,
                tolerance,
                &what,
            );
        }

        for case in &vectors.sr_cpi {
            let what = format!("sr {} in {}/{}", case.sr, case.class_index, case.band);
            let cpi = cpi_from_sr(case.sr, licence(case.class_index, case.band));

            assert_cpi(cpi, case.cpi, tolerance, &what);
            assert_sr(
                sr_from_cpi(cpi, licence(case.class_index, case.band)),
                case.sr_round_trip,
                tolerance,
                &what,
            );
        }

        for case in &vectors.target_cpi_to_hold_3_00 {
            assert_cpi(
                cpi_from_sr(3.0, licence(case.class_index, 3)),
                case.target_cpi,
                tolerance,
                "target cpi",
            );
        }
    }

    #[test]
    fn the_band_remap_matches_the_vectors() {
        let vectors = vectors();

        for case in &vectors.remap {
            let what = format!("cpi {} from {}/{}", case.cpi, case.class_index, case.band);
            let (sr, band) = remap_band(case.cpi, licence(case.class_index, case.band));

            assert_sr(sr, case.sr, &vectors._meta.tolerance, &what);
            assert_eq!(band, case.final_band, "{what}");
        }
    }

    #[test]
    fn the_moving_average_matches_the_vectors() {
        let vectors = vectors();
        let tolerance = &vectors._meta.tolerance;

        for case in &vectors.windows {
            assert_cpi(
                window_corners(licence(case.class_index, case.band)),
                case.window,
                tolerance,
                "window",
            );
        }

        for case in &vectors.alphas {
            assert_sr(
                session_alpha(case.corners, licence(case.class_index, case.band)),
                case.alpha,
                tolerance,
                "alpha",
            );
        }

        for case in &vectors.update_cpi {
            assert_cpi(
                update_cpi(
                    case.cpi_old,
                    case.corners,
                    case.incident_points,
                    licence(case.class_index, case.band),
                ),
                case.cpi_new,
                tolerance,
                "update cpi",
            );
        }
    }

    #[test]
    fn projections_match_the_vectors() {
        let vectors = vectors();
        let tolerance = &vectors._meta.tolerance;

        for case in &vectors.project {
            // The vectors take the band from the rating, as a reader of
            // `LicString` would.
            let start = licence(case.class_index, case.sr_before.floor() as i32);
            let projected = project_sr(case.sr_before, start, case.corners, case.incident_points);
            let cpi = update_cpi(
                cpi_from_sr(case.sr_before, start),
                case.corners,
                case.incident_points,
                start,
            );

            assert_sr(projected, case.projected_sr, tolerance, &case.comment);
            assert_sr(
                projected - case.sr_before,
                case.delta,
                tolerance,
                &case.comment,
            );
            assert_cpi(cpi, case.cpi_new, tolerance, &case.comment);
        }
    }

    #[test]
    fn corners_follow_the_distance_driven() {
        for run in vectors().corner_accumulator {
            let mut accumulator = CornerAccumulator::default();

            for sample in &run.samples {
                accumulator.update(
                    Some(sample.lap_dist_pct),
                    TrackSurface::from(sample.track_surface),
                );
            }

            // The samples are f32 here, as the SDK sends them.
            assert!(
                (accumulator.corners(run.corners_per_lap) - run.corners).abs() < 1e-4,
                "{}",
                run.comment
            );
        }
    }

    #[test]
    fn session_weights_follow_the_sporting_code() {
        assert_eq!(session_weight("Race"), WEIGHT_RACE);
        assert_eq!(session_weight("Heat Race"), WEIGHT_RACE);
        assert_eq!(session_weight("Open Qualify"), WEIGHT_OPEN);
        assert_eq!(session_weight("Lone Qualify"), WEIGHT_LONE);
        assert_eq!(session_weight("Time Trial"), WEIGHT_LONE);
        assert_eq!(session_weight("Warmup"), WEIGHT_OPEN);
        assert_eq!(session_weight("Practice"), WEIGHT_OPEN);
        assert_eq!(session_weight("Offline Testing"), 0.0);
        assert_eq!(session_weight("something else"), 0.0);
    }

    #[test]
    fn a_practice_or_test_server_moves_nothing() {
        assert_eq!(event_session_weight("Race", "Practice"), WEIGHT_OPEN);
        assert_eq!(event_session_weight("Practice", "Practice"), 0.0);
        assert_eq!(event_session_weight("Test", "Practice"), 0.0);
        assert_eq!(
            event_session_weight("Time Trial", "Time Trial"),
            WEIGHT_LONE
        );
        assert_eq!(event_session_weight("", "Race"), WEIGHT_RACE);
    }

    #[test]
    fn clean_corners_level_the_session_out() {
        assert_eq!(clean_corners_needed(0.0, 50.0, 25.0), 0.0);
        assert_eq!(clean_corners_needed(4.0, 30.0, 25.0), 70.0);
        assert_eq!(clean_corners_needed(1.0, 40.0, 25.0), 0.0);
    }

    const ON_TRACK: TrackSurface = TrackSurface::OnTrack;

    fn race_session(team_racing: bool) -> SessionSnapshot {
        SessionSnapshot {
            player_car_idx: 0,
            track_num_turns: Some(20),
            team_racing,
            sessions: vec![
                SessionEntry {
                    session_type_label: "Practice".to_string(),
                    session_laps: "unlimited".to_string(),
                    ..SessionEntry::default()
                },
                SessionEntry {
                    session_type_label: "Race".to_string(),
                    session_laps: "10".to_string(),
                    ..SessionEntry::default()
                },
            ],
            cars: vec![CarEntry {
                car_idx: 0,
                // Class C, band 2 — the band 2.75 sits in.
                lic_level: Some(10),
                lic_sub_level: Some(275),
                ..CarEntry::default()
            }],
            ..SessionSnapshot::default()
        }
    }

    struct Tick {
        session_num: i32,
        pct: f32,
        my_incidents: i32,
        team_incidents: i32,
    }

    fn race_tick(pct: f32, incidents: i32) -> Tick {
        Tick {
            session_num: 1,
            pct,
            my_incidents: incidents,
            team_incidents: incidents,
        }
    }

    fn step(
        processor: &mut SafetyRatingProcessor,
        session: &SessionSnapshot,
        tick: Tick,
    ) -> SafetyRatingFrame {
        let car_idx = CarIdxFrame {
            car_idx_track_surface: vec![ON_TRACK],
            ..CarIdxFrame::default()
        };
        let lap_timing = LapTimingFrame {
            lap: Some(1),
            lap_dist_pct: Some(tick.pct),
            ..LapTimingFrame::default()
        };
        let car_status = CarStatusFrame {
            player_car_my_incident_count: Some(tick.my_incidents),
            player_car_team_incident_count: Some(tick.team_incidents),
            ..CarStatusFrame::default()
        };
        let start_positions = HashMap::new();
        let ctx = ComputeContext {
            car_dynamics: &CarDynamicsFrame::default(),
            car_inputs: &CarInputsFrame::default(),
            car_idx: &car_idx,
            lap_timing: &lap_timing,
            car_status: &car_status,
            pit_service: &PitServiceFrame::default(),
            chassis: &ChassisFrame::default(),
            environment: &EnvironmentFrame::default(),
            session,
            track_length_m: 0.0,
            car_length_m: 0.0,
            start_positions: &start_positions,
            fuel_settings: FuelSettings::default(),
            lap_delta_active: false,
            session_num: Some(tick.session_num),
            session_time: None,
            session_time_remain: None,
            session_state: None,
        };

        processor.frame(&ctx)
    }

    #[test]
    fn incidents_count_from_the_session_start() {
        let session = race_session(false);
        let mut processor = SafetyRatingProcessor::default();

        step(&mut processor, &session, race_tick(0.10, 6));
        let frame = step(&mut processor, &session, race_tick(0.15, 10));

        assert_eq!(frame.driver_incidents, 4);
        assert_eq!(frame.team_incidents, None, "not a team race");
        assert_eq!(frame.session_weight, WEIGHT_RACE);
        assert_eq!(frame.sr_start, Some(2.75));
        assert!((frame.corners_driven - 1.0).abs() < 1e-4);
    }

    #[test]
    fn a_new_session_starts_from_scratch() {
        let session = race_session(true);
        let mut processor = SafetyRatingProcessor::default();
        let practice = |pct: f32, incidents: i32| Tick {
            session_num: 0,
            pct,
            my_incidents: incidents,
            team_incidents: incidents,
        };

        step(&mut processor, &session, practice(0.10, 0));
        let practice_frame = step(&mut processor, &session, practice(0.20, 3));

        assert_eq!(practice_frame.driver_incidents, 3);
        assert_eq!(practice_frame.session_weight, WEIGHT_OPEN);

        let race_frame = step(&mut processor, &session, race_tick(0.50, 3));

        assert_eq!(race_frame.driver_incidents, 0);
        assert_eq!(race_frame.team_incidents, Some(0));
        assert_eq!(race_frame.corners_driven, 0.0);
        assert_eq!(race_frame.session_weight, WEIGHT_RACE);
    }

    fn practice_tick(pct: f32, incidents: i32) -> Tick {
        Tick {
            session_num: 0,
            pct,
            my_incidents: incidents,
            team_incidents: incidents,
        }
    }

    #[test]
    fn the_race_starts_where_the_practice_left_the_rating() {
        let session = race_session(false);
        let mut processor = SafetyRatingProcessor::default();

        step(&mut processor, &session, practice_tick(0.10, 0));
        let practice = step(&mut processor, &session, practice_tick(0.18, 4));
        let practice_end = practice.sr_now.expect("rated");

        assert!(practice_end < 2.75, "four points in a lap cost rating");

        // The YAML still reads 2.75: the race carries the practice's outcome.
        let race = step(&mut processor, &session, race_tick(0.50, 4));

        assert_eq!(race.sr_start, Some(practice_end));
        assert_eq!(race.driver_incidents, 0);
    }

    #[test]
    fn a_rewritten_yaml_rating_replaces_the_carried_one() {
        let mut session = race_session(false);
        let mut processor = SafetyRatingProcessor::default();

        step(&mut processor, &session, practice_tick(0.10, 0));
        step(&mut processor, &session, practice_tick(0.18, 4));
        step(&mut processor, &session, race_tick(0.50, 4));

        // iRacing writes the practice's result into the YAML mid-race.
        session.cars[0].lic_sub_level = Some(271);
        let race = step(&mut processor, &session, race_tick(0.52, 4));

        assert_eq!(race.sr_start, Some(2.71));
    }

    #[test]
    fn the_first_session_starts_from_the_yaml() {
        let session = race_session(false);
        let mut processor = SafetyRatingProcessor::default();

        let race = step(&mut processor, &session, race_tick(0.50, 0));

        assert_eq!(race.sr_start, Some(2.75));
    }

    const EVENT: i32 = 89_241_518;

    fn event_session() -> SessionSnapshot {
        SessionSnapshot {
            sub_session_id: Some(EVENT),
            ..race_session(false)
        }
    }

    #[test]
    fn a_restart_mid_event_picks_up_the_carried_qualifying() {
        let session = event_session();
        let mut before = SafetyRatingProcessor::default();

        step(&mut before, &session, practice_tick(0.10, 0));
        let practice_end = step(&mut before, &session, practice_tick(0.18, 4))
            .sr_now
            .expect("rated");
        step(&mut before, &session, race_tick(0.30, 4));
        step(&mut before, &session, race_tick(0.40, 5));
        let saved = before.state_to_save().expect("a first state is always due");

        // The app restarts: a fresh processor, then the file, then the sim.
        let mut after = SafetyRatingProcessor::default();
        after.command(&ProcessorCommand::RestoreSafetyRating(Box::new(saved)));
        let race = step(&mut after, &session, race_tick(0.45, 5));

        assert_eq!(race.sr_start, Some(practice_end));
        assert_eq!(race.driver_incidents, 1, "the base survives the restart");
        assert!(
            (race.corners_driven - 2.0).abs() < 1e-3,
            "0.10 lap before the restart, the jump over it uncounted"
        );
    }

    #[test]
    fn a_saved_state_never_overwrites_an_event_in_progress() {
        let session = event_session();
        let mut processor = SafetyRatingProcessor::default();

        step(&mut processor, &session, race_tick(0.10, 0));
        processor.command(&ProcessorCommand::RestoreSafetyRating(Box::new(
            SafetyRatingState::empty_for(EVENT),
        )));
        let race = step(&mut processor, &session, race_tick(0.15, 0));

        assert!(race.corners_driven > 0.0);
    }

    #[test]
    fn a_new_event_starts_from_scratch() {
        let session = event_session();
        let mut processor = SafetyRatingProcessor::default();

        step(&mut processor, &session, race_tick(0.10, 0));
        step(&mut processor, &session, race_tick(0.15, 2));

        let next_event = SessionSnapshot {
            sub_session_id: Some(EVENT + 1),
            ..event_session()
        };
        let race = step(&mut processor, &next_event, race_tick(0.20, 2));

        assert_eq!(race.driver_incidents, 0);
        assert_eq!(race.corners_driven, 0.0);
    }

    #[test]
    fn the_state_is_saved_on_a_change_and_every_quarter_lap() {
        let session = event_session();
        let mut processor = SafetyRatingProcessor::default();

        step(&mut processor, &session, race_tick(0.10, 0));
        assert!(processor.state_to_save().is_some(), "the first state");

        step(&mut processor, &session, race_tick(0.15, 0));
        assert!(processor.state_to_save().is_none(), "a twentieth of a lap");

        step(&mut processor, &session, race_tick(0.17, 1));
        assert!(
            processor.state_to_save().is_none(),
            "the count is not a start value"
        );

        for pct in [0.22, 0.27, 0.32, 0.37] {
            step(&mut processor, &session, race_tick(pct, 1));
        }
        assert!(processor.state_to_save().is_some(), "a quarter lap on");

        step(&mut processor, &session, practice_tick(0.40, 1));
        assert!(processor.state_to_save().is_some(), "a new session");
    }

    #[test]
    fn nothing_is_saved_without_an_event_id() {
        let session = race_session(false);
        let mut processor = SafetyRatingProcessor::default();

        step(&mut processor, &session, race_tick(0.10, 0));

        assert!(processor.state_to_save().is_none());
    }

    #[test]
    fn a_counter_reset_by_the_sim_becomes_the_new_base() {
        let session = race_session(false);
        let mut processor = SafetyRatingProcessor::default();

        step(&mut processor, &session, race_tick(0.10, 5));
        let frame = step(&mut processor, &session, race_tick(0.12, 0));

        assert_eq!(frame.driver_incidents, 0);
    }

    #[test]
    fn a_clean_race_projects_a_gain_at_the_flag() {
        let session = race_session(false);
        let mut processor = SafetyRatingProcessor::default();

        step(&mut processor, &session, race_tick(0.10, 0));
        let frame = step(&mut processor, &session, race_tick(0.15, 0));

        let now = frame.sr_now.expect("rated");
        let finish = frame.sr_finish.expect("a lap race has a distance left");

        assert!(finish > now, "{finish} should exceed {now}");
        assert_eq!(frame.clean_corners_needed, Some(0.0));
    }

    #[test]
    fn incidents_cost_clean_corners() {
        let session = race_session(false);
        let mut processor = SafetyRatingProcessor::default();

        step(&mut processor, &session, race_tick(0.10, 0));
        let frame = step(&mut processor, &session, race_tick(0.15, 4));

        assert!(frame.sr_now.expect("rated") < 2.75);
        assert!(frame.clean_corners_needed.expect("rated") > 0.0);
    }

    #[test]
    fn no_rating_from_the_sim_is_no_estimate() {
        let mut session = race_session(false);
        session.cars[0].lic_sub_level = None;
        let mut processor = SafetyRatingProcessor::default();

        let frame = step(&mut processor, &session, race_tick(0.10, 0));

        assert_eq!(frame.sr_start, None);
        assert_eq!(frame.sr_now, None);
        assert_eq!(frame.sr_finish, None);
        assert_eq!(frame.clean_corners_needed, None);
    }

    #[test]
    fn a_session_that_does_not_move_sr_needs_no_clean_corners() {
        let mut session = race_session(false);
        session.sessions[1].session_type_label = "Offline Testing".to_string();
        let mut processor = SafetyRatingProcessor::default();

        let frame = step(&mut processor, &session, race_tick(0.10, 4));

        assert_eq!(frame.session_weight, 0.0);
        assert_eq!(frame.sr_now, Some(2.75));
        assert_eq!(frame.clean_corners_needed, None);
    }

    #[test]
    fn a_league_session_is_known_unranked() {
        let mut session = race_session(false);
        session.league_id = Some(4321);
        let mut processor = SafetyRatingProcessor::default();

        let frame = step(&mut processor, &session, race_tick(0.10, 0));

        assert_eq!(frame.is_ranked, Some(false));
    }
}
