//! A track outline from one lap of positions: north up, in metres.
//!
//! A lap is short next to the earth, so an equirectangular projection about
//! the lap's mean latitude keeps its shape; the path is thinned to points at
//! least a fixed share of the lap apart.

use mt_model::app::stats::TrackOutline;

const METRES_PER_DEGREE: f64 = 111_320.0;
/// About this many points along the lap: enough for a card, small to store.
const TARGET_POINTS: f64 = 400.0;
/// Fewer kept points than this is not a lap worth drawing.
const MIN_POINTS: usize = 16;
/// A lap shorter than this was not driven round a track.
const MIN_LENGTH_M: f64 = 200.0;

/// `positions` are (latitude, longitude) in degrees, in driving order.
pub(crate) fn outline_from(positions: &[(f64, f64)]) -> Option<TrackOutline> {
    let count = positions.len();

    if count < MIN_POINTS {
        return None;
    }

    let mean_latitude = positions.iter().map(|(latitude, _)| latitude).sum::<f64>() / count as f64;
    let longitude_scale = mean_latitude.to_radians().cos() * METRES_PER_DEGREE;
    let (first_latitude, first_longitude) = positions[0];
    let projected: Vec<(f64, f64)> = positions
        .iter()
        .map(|(latitude, longitude)| {
            (
                (longitude - first_longitude) * longitude_scale,
                (first_latitude - latitude) * METRES_PER_DEGREE,
            )
        })
        .collect();
    let length: f64 = projected
        .windows(2)
        .map(|pair| distance(pair[0], pair[1]))
        .sum();

    if length < MIN_LENGTH_M {
        return None;
    }

    let spacing = length / TARGET_POINTS;
    let mut kept = vec![projected[0]];

    for point in &projected[1..] {
        if distance(*kept.last()?, *point) >= spacing {
            kept.push(*point);
        }
    }

    if kept.len() < MIN_POINTS {
        return None;
    }

    Some(TrackOutline {
        svg_path: svg_path(&kept),
        view_box: view_box(&kept),
    })
}

fn distance(from: (f64, f64), to: (f64, f64)) -> f64 {
    (to.0 - from.0).hypot(to.1 - from.1)
}

fn svg_path(points: &[(f64, f64)]) -> String {
    let steps: Vec<String> = points
        .iter()
        .enumerate()
        .map(|(index, (x, y))| {
            let command = if index == 0 { 'M' } else { 'L' };

            format!("{command} {x:.1} {y:.1}")
        })
        .collect();

    format!("{} Z", steps.join(" "))
}

fn view_box(points: &[(f64, f64)]) -> String {
    let fold = |pick: fn(&(f64, f64)) -> f64, start: f64, keep: fn(f64, f64) -> f64| {
        points.iter().map(pick).fold(start, keep)
    };
    let min_x = fold(|point| point.0, f64::MAX, f64::min);
    let max_x = fold(|point| point.0, f64::MIN, f64::max);
    let min_y = fold(|point| point.1, f64::MAX, f64::min);
    let max_y = fold(|point| point.1, f64::MIN, f64::max);

    format!(
        "{min_x:.1} {min_y:.1} {:.1} {:.1}",
        max_x - min_x,
        max_y - min_y
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A square lap of `side_m` metres a side, starting at its south-west
    /// corner and driven north first, near the equator.
    fn square_lap(side_m: f64, samples_per_side: usize) -> Vec<(f64, f64)> {
        let side = side_m / METRES_PER_DEGREE;
        let step = side / samples_per_side as f64;
        let mut positions = Vec::new();

        for index in 0..samples_per_side {
            positions.push((index as f64 * step, 0.0));
        }
        for index in 0..samples_per_side {
            positions.push((side, index as f64 * step));
        }
        for index in 0..samples_per_side {
            positions.push((side - index as f64 * step, side));
        }
        for index in 0..samples_per_side {
            positions.push((0.0, side - index as f64 * step));
        }

        positions
    }

    fn numbers(text: &str) -> Vec<f64> {
        text.split(' ')
            .filter_map(|part| part.parse().ok())
            .collect()
    }

    #[test]
    fn a_lap_draws_north_up_in_metres() {
        let outline = outline_from(&square_lap(1000.0, 500)).unwrap();
        let view_box = numbers(&outline.view_box);

        // North is up: the lap leaves its start towards negative y.
        assert!((view_box[1] + 1000.0).abs() < 5.0, "{view_box:?}");
        assert!((view_box[2] - 1000.0).abs() < 5.0, "{view_box:?}");
        assert!((view_box[3] - 1000.0).abs() < 5.0, "{view_box:?}");
        assert!(outline.svg_path.starts_with("M 0.0 0.0 L "));
        assert!(outline.svg_path.ends_with(" Z"));
    }

    #[test]
    fn a_dense_lap_is_thinned() {
        let outline = outline_from(&square_lap(4000.0, 10_000)).unwrap();
        let points = outline.svg_path.matches('L').count() + 1;

        assert!(points <= TARGET_POINTS as usize + 1, "{points}");
        assert!(points >= TARGET_POINTS as usize - 10, "{points}");
    }

    #[test]
    fn a_lap_too_short_or_too_sparse_is_not_drawn() {
        assert_eq!(outline_from(&square_lap(30.0, 100)), None);
        assert_eq!(outline_from(&square_lap(1000.0, 2)), None);
    }
}
