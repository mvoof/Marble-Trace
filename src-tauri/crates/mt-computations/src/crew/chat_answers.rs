//! The replies to viewers' chat commands, read from the same view the
//! engineer answers the driver from. In English, like widget text.
//!
//! A value the sim does not have is left out of the reply; with nothing left
//! there is no reply at all, which is also what happens outside a session.

use mt_model::app::chat::ChatCommand;
use mt_model::sim::session::{CarEntry, SessionSnapshot};

use crate::crew::engineer::{EngineerView, Gap, UNLIMITED_LAPS, UNLIMITED_SECONDS};
use crate::field::driver_entries::DriverEntry;
use crate::rating::last_race::{is_multiclass, LastRace};

const SECONDS_PER_MINUTE: f64 = 60.0;
const MILLIS_PER_SECOND: i64 = 1000;
const MILLIS_PER_MINUTE: i64 = 60_000;
const KMH_PER_MS: f32 = 3.6;
const SEPARATOR: &str = ", ";

/// The reply to a command answered from the session. `!lastrace` is not one:
/// it reads the stored record, through `last_race_reply`.
pub fn answer(
    command: ChatCommand,
    view: &EngineerView,
    session: Option<&SessionSnapshot>,
) -> Option<String> {
    let session = session?;

    match command {
        ChatCommand::Pos => position(view, session),
        ChatCommand::Gap => gaps(view),
        ChatCommand::Lap => lap(view),
        ChatCommand::Best => lap_times(view),
        ChatCommand::Sof => strength_of_field(session),
        ChatCommand::Car => car_at_track(session),
        ChatCommand::Info => info(session),
        ChatCommand::Weather => weather(view),
        ChatCommand::Fuel => fuel(view),
        ChatCommand::Lastrace => None,
    }
}

pub fn last_race_reply(race: &LastRace) -> String {
    let finish = match &race.class_finish {
        Some(class) => format!(
            "P{} in {}, P{} overall",
            class.position, class.class_name, race.position
        ),
        None => format!("P{}", race.position),
    };
    let result = joined([
        Some(finish),
        Some(format!("{}x", race.incidents)),
        race.estimated_sr.map(|sr| format!("SR ~{sr:.2}")),
        race.estimated_ir.map(|ir| format!("iR ~{ir}")),
    ])
    .unwrap_or_default();

    format!("{}: {result}", race.track)
}

fn joined(parts: impl IntoIterator<Item = Option<String>>) -> Option<String> {
    let present: Vec<String> = parts.into_iter().flatten().collect();

    (!present.is_empty()).then(|| present.join(SEPARATOR))
}

fn named(value: &str) -> Option<&str> {
    let value = value.trim();

    (!value.is_empty()).then_some(value)
}

fn player_entry(view: &EngineerView) -> Option<&DriverEntry> {
    view.questions.entries.iter().find(|entry| entry.is_player)
}

fn player_car(session: &SessionSnapshot) -> Option<&CarEntry> {
    session
        .cars
        .iter()
        .find(|car| car.car_idx == session.player_car_idx)
}

fn real_cars(session: &SessionSnapshot) -> impl Iterator<Item = &CarEntry> {
    session
        .cars
        .iter()
        .filter(|car| !car.is_pace_car && !car.is_spectator && !car.user_name.is_empty())
}

fn position(view: &EngineerView, session: &SessionSnapshot) -> Option<String> {
    let player = player_entry(view)?;
    let overall = Some(player.live_position).filter(|place| *place > 0);

    if !is_multiclass(session) {
        let cars = real_cars(session).count();

        return overall.map(|place| format!("P{place} of {cars}"));
    }

    let class_name = player_car(session)
        .and_then(|car| named(&car.car_class_short_name))
        .unwrap_or("class");
    let in_class = Some(player.live_class_position)
        .filter(|place| *place > 0)
        .map(|place| format!("P{place} in {class_name}"));

    joined([in_class, overall.map(|place| format!("P{place} overall"))])
}

fn gap_text(gap: Gap) -> String {
    match gap {
        Gap::Seconds(seconds) => format!("{seconds:.1} s"),
        Gap::Laps(1) => "1 lap".to_string(),
        Gap::Laps(laps) => format!("{laps} laps"),
    }
}

fn gaps(view: &EngineerView) -> Option<String> {
    joined([
        view.gap_ahead.map(|gap| format!("Ahead {}", gap_text(gap))),
        view.gap_behind
            .map(|gap| format!("Behind {}", gap_text(gap))),
    ])
}

fn lap(view: &EngineerView) -> Option<String> {
    let current = view
        .lap
        .filter(|lap| *lap > 0)
        .map(|lap| format!("Lap {lap}"));
    let left = match (view.laps_left, view.seconds_left) {
        (Some(1), _) => Some("1 lap left".to_string()),
        (Some(laps), _) if (0..UNLIMITED_LAPS).contains(&laps) => Some(format!("{laps} laps left")),
        (_, Some(seconds)) if (0.0..UNLIMITED_SECONDS).contains(&seconds) => Some(format!(
            "{} min left",
            (seconds / SECONDS_PER_MINUTE).floor()
        )),
        _ => None,
    };

    joined([current, left])
}

fn lap_time(lap_s: f32) -> String {
    let millis = (f64::from(lap_s) * MILLIS_PER_SECOND as f64).round() as i64;
    let minutes = millis / MILLIS_PER_MINUTE;
    let rest = millis % MILLIS_PER_MINUTE;

    format!(
        "{minutes}:{:02}.{:03}",
        rest / MILLIS_PER_SECOND,
        rest % MILLIS_PER_SECOND
    )
}

fn lap_times(view: &EngineerView) -> Option<String> {
    let timed = |lap: Option<f32>| lap.filter(|lap| *lap > 0.0).map(lap_time);

    joined([
        timed(view.best_lap_s).map(|lap| format!("Best {lap}")),
        timed(view.last_lap_s).map(|lap| format!("Last {lap}")),
    ])
}

/// The average iRating of the player's class, the number Standings shows.
fn strength_of_field(session: &SessionSnapshot) -> Option<String> {
    let player = player_car(session)?;
    let ratings: Vec<i64> = real_cars(session)
        .filter(|car| car.car_class_id == player.car_class_id)
        .map(|car| i64::from(car.i_rating))
        .filter(|rating| *rating > 0)
        .collect();
    let sof = (!ratings.is_empty())
        .then(|| ratings.iter().sum::<i64>() as f64 / ratings.len() as f64)
        .map(|average| format!("SOF {}", average.round() as i64));
    let rating = Some(player.i_rating)
        .filter(|rating| *rating > 0)
        .map(|rating| format!("iRating {rating}"));

    joined([sof, rating])
}

fn track_name(session: &SessionSnapshot) -> Option<String> {
    let track = named(&session.track_display_name)?;

    Some(match named(&session.track_config_name) {
        Some(config) => format!("{track} ({config})"),
        None => track.to_string(),
    })
}

fn car_name(session: &SessionSnapshot) -> Option<&str> {
    player_car(session).and_then(|car| named(&car.car_screen_name))
}

fn car_at_track(session: &SessionSnapshot) -> Option<String> {
    match (car_name(session), track_name(session)) {
        (Some(car), Some(track)) => Some(format!("{car} at {track}")),
        (car, track) => car.map(str::to_string).or(track),
    }
}

fn info(session: &SessionSnapshot) -> Option<String> {
    let session_label = usize::try_from(session.current_session_num)
        .ok()
        .and_then(|num| session.sessions.get(num))
        .and_then(|entry| named(&entry.session_type_label));

    joined([
        track_name(session),
        car_name(session).map(str::to_string),
        session_label.map(str::to_string),
    ])
}

/// The levels the weather widget shows.
fn surface(track_wetness: Option<i32>) -> Option<&'static str> {
    match track_wetness? {
        1 => Some("dry track"),
        2 => Some("mostly dry track"),
        3 => Some("very lightly wet track"),
        4 => Some("lightly wet track"),
        5 => Some("moderately wet track"),
        6 => Some("very wet track"),
        level if level >= 7 => Some("extremely wet track"),
        _ => None,
    }
}

fn weather(view: &EngineerView) -> Option<String> {
    joined([
        view.air_temp_c.map(|air| format!("Air {air:.0}°C")),
        view.track_temp_c.map(|track| format!("Track {track:.0}°C")),
        view.wind_ms
            .map(|wind| format!("Wind {:.0} km/h", wind * KMH_PER_MS)),
        surface(view.track_wetness).map(str::to_string),
    ])
}

fn fuel(view: &EngineerView) -> Option<String> {
    joined([
        view.fuel_l
            .filter(|fuel| *fuel > 0.0)
            .map(|fuel| format!("Fuel {fuel:.1} L")),
        view.fuel_laps
            .filter(|laps| *laps > 0.0)
            .map(|laps| format!("{:.0} laps of it", laps.floor())),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rating::last_race::ClassFinish;
    use mt_model::sim::session::SessionEntry;

    fn car(car_idx: i32, class: i32, rating: i32) -> CarEntry {
        CarEntry {
            car_idx,
            user_name: format!("Driver {car_idx}"),
            car_class_id: class,
            car_class_short_name: "GT3".into(),
            car_screen_name: "BMW M4 GT3".into(),
            i_rating: rating,
            ..CarEntry::default()
        }
    }

    fn session() -> SessionSnapshot {
        SessionSnapshot {
            track_display_name: "Spa".into(),
            track_config_name: "Endurance".into(),
            player_car_idx: 0,
            sessions: vec![SessionEntry {
                session_type_label: "Race".into(),
                ..SessionEntry::default()
            }],
            cars: vec![car(0, 1, 2000), car(1, 1, 3000), car(2, 2, 9000)],
            ..SessionSnapshot::default()
        }
    }

    #[test]
    fn nothing_is_said_outside_a_session() {
        let view = EngineerView::default();

        assert_eq!(answer(ChatCommand::Weather, &view, None), None);
    }

    #[test]
    fn a_missing_value_is_left_out_of_the_reply() {
        let view = EngineerView {
            air_temp_c: Some(23.4),
            track_wetness: Some(1),
            ..EngineerView::default()
        };

        assert_eq!(
            answer(ChatCommand::Weather, &view, Some(&session())).as_deref(),
            Some("Air 23°C, dry track")
        );
    }

    #[test]
    fn a_reply_with_no_value_at_all_is_no_reply() {
        let view = EngineerView::default();

        for command in [ChatCommand::Gap, ChatCommand::Best, ChatCommand::Fuel] {
            assert_eq!(answer(command, &view, Some(&session())), None);
        }
    }

    #[test]
    fn a_leader_has_only_the_gap_behind() {
        let view = EngineerView {
            gap_behind: Some(Gap::Laps(1)),
            ..EngineerView::default()
        };

        assert_eq!(
            answer(ChatCommand::Gap, &view, Some(&session())).as_deref(),
            Some("Behind 1 lap")
        );
    }

    #[test]
    fn an_unlimited_race_tells_the_time_instead_of_the_laps() {
        let view = EngineerView {
            lap: Some(5),
            laps_left: Some(UNLIMITED_LAPS),
            seconds_left: Some(630.0),
            ..EngineerView::default()
        };

        assert_eq!(
            answer(ChatCommand::Lap, &view, Some(&session())).as_deref(),
            Some("Lap 5, 10 min left")
        );
    }

    #[test]
    fn lap_times_keep_the_thousandths() {
        let view = EngineerView {
            best_lap_s: Some(92.456),
            last_lap_s: Some(-1.0),
            ..EngineerView::default()
        };

        assert_eq!(
            answer(ChatCommand::Best, &view, Some(&session())).as_deref(),
            Some("Best 1:32.456")
        );
    }

    #[test]
    fn strength_of_field_is_the_players_class() {
        let view = EngineerView::default();

        assert_eq!(
            answer(ChatCommand::Sof, &view, Some(&session())).as_deref(),
            Some("SOF 2500, iRating 2000")
        );
    }

    #[test]
    fn info_names_the_track_car_and_session() {
        let view = EngineerView::default();

        assert_eq!(
            answer(ChatCommand::Info, &view, Some(&session())).as_deref(),
            Some("Spa (Endurance), BMW M4 GT3, Race")
        );
    }

    #[test]
    fn the_last_race_marks_the_estimates() {
        let race = LastRace {
            track: "Spa".into(),
            position: 12,
            class_finish: Some(ClassFinish {
                class_name: "GT3".into(),
                position: 4,
            }),
            incidents: 2,
            estimated_sr: Some(2.81),
            estimated_ir: None,
        };

        assert_eq!(
            last_race_reply(&race),
            "Spa: P4 in GT3, P12 overall, 2x, SR ~2.81"
        );
    }
}
