/** What an inspector row holds, which decides how it is drawn and formatted. */
export type InspectorValueKind =
  | 'number'
  | 'boolean'
  | 'string'
  | 'array'
  | 'object'
  | 'absent';

/**
 * One line of the inspector's list.
 *
 * The list is flat and carries its own `depth` rather than nesting, because the
 * filter has to be able to show a leaf whose parents are closed.
 */
export interface InspectorRow {
  /** Dotted path from the root, e.g. `car_idx.car_idx_lap_dist_pct.7`. */
  path: string;
  /** Leaf name, or the index for an array entry. */
  name: string;
  depth: number;
  kind: InspectorValueKind;
  value: unknown;
  /** Entry count, for arrays only. */
  length?: number;
  expandable: boolean;
  expanded: boolean;
}

/**
 * Which of the two streams the inspector is showing.
 *
 * They are genuinely different data, not two views of one: `telemetry` is the
 * per-tick variable block pulled from the backend, `session` is the parsed
 * session YAML that arrives on its own event and changes a few times a session.
 */
export type InspectorSource = 'telemetry' | 'session';
