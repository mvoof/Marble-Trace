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
  | 'high-g'
  | 'driving-coach-brake'
  | 'driving-coach-gas'
  | 'field-close-pack'
  | 'pit-tow'
  | 'pit-lane'
  | 'pit-limiter'
  | 'pit-over-limit'
  | 'fuel-pit-window'
  | 'fuel-short'
  | 'fuel-refuel-calc'
  | 'delta-ahead'
  | 'delta-behind'
  | 'delta-personal-best'
  | 'sector-in-progress';
