use mt_model::sim::radio::{RadioFrame, RadioTransmission};
use mt_model::sim::session::SessionSnapshot;

/// Who is on the air, with the player filled in.
///
/// The sim reports every transmission but the player's own, which shows only
/// as the push-to-talk button. A transmission the player hears wins over the
/// button: that is the voice on the air. Otherwise the button puts the player
/// on the frequency their selected radio is tuned to.
pub fn on_air(radio: &RadioFrame, session: Option<&SessionSnapshot>) -> RadioFrame {
    if radio.transmission.is_some() || !radio.push_to_talk {
        return radio.clone();
    }

    let transmission = session.and_then(|session| {
        let tune = session.player_radio?;

        (session.player_car_idx >= 0).then_some(RadioTransmission {
            car_idx: session.player_car_idx,
            radio_num: tune.radio_num,
            frequency_num: tune.frequency_num,
        })
    });

    RadioFrame {
        transmission,
        push_to_talk: radio.push_to_talk,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mt_model::sim::radio::RadioTune;

    const PLAYER: i32 = 1;
    const OTHER: i32 = 7;

    fn session() -> SessionSnapshot {
        SessionSnapshot {
            player_car_idx: PLAYER,
            player_radio: Some(RadioTune {
                radio_num: 0,
                frequency_num: 2,
            }),
            ..SessionSnapshot::default()
        }
    }

    fn transmission(car_idx: i32) -> RadioTransmission {
        RadioTransmission {
            car_idx,
            radio_num: 0,
            frequency_num: 0,
        }
    }

    #[test]
    fn the_button_puts_the_player_on_the_tuned_frequency() {
        let radio = RadioFrame {
            transmission: None,
            push_to_talk: true,
        };

        assert_eq!(
            on_air(&radio, Some(&session())).transmission,
            Some(RadioTransmission {
                car_idx: PLAYER,
                radio_num: 0,
                frequency_num: 2,
            })
        );
    }

    #[test]
    fn a_voice_the_player_hears_wins_over_the_button() {
        let radio = RadioFrame {
            transmission: Some(transmission(OTHER)),
            push_to_talk: true,
        };

        assert_eq!(
            on_air(&radio, Some(&session())).transmission,
            Some(transmission(OTHER))
        );
    }

    #[test]
    fn nobody_is_on_the_air_without_the_button() {
        assert_eq!(
            on_air(&RadioFrame::default(), Some(&session())).transmission,
            None
        );
    }

    #[test]
    fn a_session_without_a_radio_cannot_place_the_player() {
        let radio = RadioFrame {
            transmission: None,
            push_to_talk: true,
        };
        let session = SessionSnapshot {
            player_radio: None,
            ..session()
        };

        assert_eq!(on_air(&radio, Some(&session)).transmission, None);
    }
}
