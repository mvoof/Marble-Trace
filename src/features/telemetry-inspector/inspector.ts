import type {
  RawSession,
  RawValue,
  RawVarMeta,
  SourceFrame,
} from '@shared/contracts/bindings';

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
  /** What the sim says about a top-level variable, on the raw telemetry only. */
  annotation?: RowAnnotation;
}

/** The sim's own description of a variable, drawn beside its value. */
export interface RowAnnotation {
  typeName: string;
  unit: string;
  desc: string;
}

/**
 * Which stream the inspector is showing.
 *
 * Two are the sim's own data, untouched: `rawTelemetry` — every variable under
 * iRacing's names, read straight from kerb — and `rawSession`, the session YAML
 * as written. The other two are what the app made of them: `telemetry` is the
 * adapted frame, `session` the parsed session snapshot.
 */
export type InspectorSource =
  | 'rawTelemetry'
  | 'rawSession'
  | 'telemetry'
  | 'session';

/** How the raw session is drawn: the parsed tree, or the text line by line. */
export type RawSessionView = 'tree' | 'text';

/** One line of the raw session text, numbered as in the document. */
export interface RawSessionLine {
  number: number;
  text: string;
}

/** Everything the snapshot export takes from the inspector in one go. */
export interface InspectorCapture {
  frame: SourceFrame | null;
  rawValues: Partial<Record<string, RawValue>> | null;
  rawVarMeta: RawVarMeta[];
  rawSession: RawSession | null;
}

/** One gated field's delivery, as a total and as the rate it implies. */
export interface DeliveryFieldRow {
  field: string;
  bundles: number;
  hz: number;
}

/** One recipient's delivery counters, ready to draw. */
export interface DeliveryRow {
  label: string;
  bundles: number;
  elapsedMs: number;
  hz: number;
  fields: DeliveryFieldRow[];
}
