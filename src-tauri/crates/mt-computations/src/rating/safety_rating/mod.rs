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

use crate::{ComputeContext, ComputedOutput, Processor, ProcessorCommand, ProcessorId, TickRate};
use mt_model::contract::capabilities::Capabilities;
use mt_model::sim::enums::TrackSurface;
use mt_model::sim::session::SessionSnapshot;

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

/// Layouts whose Safety Rating is scored on fewer corners than the session's
/// `TrackNumTurns` says, as (`TrackID`, corners per lap). Each value is the
/// `corners_per_lap` of an official result on the layout; the track catalogue
/// carries the session's number, so neither can stand in for it.
const SCORED_CORNERS: &[(i32, i32)] = &[
    // Nordschleife Industriefahrten: the session says 154. Subsession
    // 89528004 — 11x took CPI 19.74 → 18.46, which 73 a lap matches.
    (249, 73),
];

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
    /// The estimate for the corners and incidents so far — with the earlier
    /// sessions of the event carried in. No projection to the flag: the time
    /// left keeps running through the cool-down, and a guess at the distance
    /// to go would be counted as clean corners never driven.
    pub sr_now: Option<f32>,
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
/// at `sr_before` in `licence`, and the licence it ends in: a session that
/// crosses a whole number leaves the next one starting in the neighbouring band.
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
    /// One tick. The pit box, the world outside the car and a teammate's stint
    /// earn nothing and break the trail; a jump bigger than a tick could drive
    /// resynchronises. `driver_in_car` is the SDK's `IsOnTrack` — the local
    /// driver in the car — since in a team race the surface is the shared
    /// car's, on track while someone else drives it.
    pub fn update(
        &mut self,
        lap_dist_pct: Option<f32>,
        surface: TrackSurface,
        driver_in_car: bool,
    ) {
        let in_world = driver_in_car
            && !matches!(surface, TrackSurface::NotInWorld | TrackSurface::InPitStall);
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

impl SafetyRatingState {
    /// An event with nothing counted yet. The processor starts its own from the
    /// session; tests, here and in the crates that store the state, build one.
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

/// Corners a lap of this layout is worth to the rating.
fn scored_corners_per_lap(session: &SessionSnapshot) -> Option<f64> {
    let scored = SCORED_CORNERS
        .iter()
        .find(|(track_id, _)| *track_id == session.track_id)
        .map(|(_, corners)| *corners);

    scored.or(session.track_num_turns).map(f64::from)
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

        // An event's sessions only move forward. The sim drops the number to 0
        // for a frame now and then — seen live on a reconnect and mid-race — and
        // taking that for a new session would latch the incident base again and
        // count the session's points from zero, a loss the save then carries
        // over a restart.
        if let (Some(current), Some(next)) = (self.start.session_num, session_num) {
            if next < current {
                return;
            }
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
    /// for a new session or a new start value (a rating), every
    /// [`SAVE_EVERY_LAPS`] for the distance alone. The incident count is not
    /// state: the sim holds it.
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

        self.corners.update(
            ctx.lap_timing.lap_dist_pct,
            surface,
            ctx.car_status.is_on_track == Some(true),
        );

        // The sim's own counts for this session, taken as they are.
        let driver_incidents = ctx.car_status.player_car_my_incident_count.unwrap_or(0);
        let team_incidents = ctx
            .car_status
            .player_car_team_incident_count
            .filter(|_| session.team_racing);

        let start_rating = self.start_rating(player_rating(session));

        let weight = session_num
            .and_then(|num| usize::try_from(num).ok())
            .and_then(|num| session.sessions.get(num))
            .map(|entry| event_session_weight(&session.event_type, &entry.session_type_label))
            .unwrap_or(0.0);
        let weighting = f64::from(weight);
        let corners_per_lap = scored_corners_per_lap(session);
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
mod tests;
