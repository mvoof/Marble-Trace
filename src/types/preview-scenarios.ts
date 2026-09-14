/**
 * The ids of every scenario the preview ships, as a literal union.
 *
 * It lives here rather than beside the registry on purpose. Manifests are read
 * by the store layer at import time, and a manifest importing the registry
 * would drag the snapshot and every mock builder into each chunk that holds a
 * manifest — the remote screen's browser bundle among them.
 *
 * The registry is typed from this union and paired with it by test, so an id
 * that exists here but nowhere else, or a declaration naming an id that does
 * not exist, fails before anyone opens the picker.
 */
export type PreviewScenarioId =
  | 'baseline'
  | 'yellow-flag'
  | 'safety-car'
  | 'blue-flag'
  | 'black-flag'
  | 'dq-flag'
  | 'green-flag'
  | 'white-flag'
  | 'checkered-flag'
  | 'red-flag'
  | 'meatball-flag'
  | 'debris-flag'
  | 'radar-traffic'
  | 'traffic-left'
  | 'traffic-right'
  | 'traffic-three-wide'
  | 'traffic-rear-bumper'
  | 'close-battle'
  | 'rain'
  | 'heavy-rain'
  | 'high-g'
  | 'driving-coach-brake'
  | 'driving-coach-brake-soon'
  | 'driving-coach-gas'
  | 'driving-coach-grip'
  | 'driving-coach-inactive'
  | 'field-close-pack'
  | 'incident-limit'
  | 'pit-tow'
  | 'pit-lane'
  | 'pit-limiter'
  | 'pit-over-limit'
  | 'pit-service'
  | 'fuel-pit-window'
  | 'fuel-short'
  | 'fuel-refuel-calc'
  | 'delta-ahead'
  | 'delta-behind'
  | 'delta-personal-best'
  | 'sector-in-progress'
  | 'engine-oil-overheat'
  | 'engine-water-overheat'
  | 'engine-stalled'
  | 'timer-final-minute'
  | 'timer-lap-limited'
  // Session-wide moments. Composed from the same domain builders, but scoped to
  // the whole canvas rather than to one widget: the layout editor offers them
  // and a widget's own picker never does.
  | 'session-green'
  | 'session-traffic'
  | 'session-yellow'
  | 'session-pit-stop'
  | 'session-rain'
  | 'session-finish';
