import type { Migration, MigrationResult, SettingsBlob } from './types';
import { v1LegacyConsolidation } from './migrations/v1-legacy-consolidation';
import { v2CoachWidgetSplit } from './migrations/v2-coach-widget-split';

/**
 * Format version of `settings.json`. An integer, deliberately unrelated to the
 * app's semver: the app can reach 0.35 with the schema still at 1, and a schema
 * bump can land in any release. Never store a semver string here — the
 * comparison has to be numeric.
 *
 * 0 = anything written before 0.21, which carried no version field at all.
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Oldest version the chain can still migrate. Bump it only when a step is
 * actually deleted from `MIGRATIONS`; the invariant test catches the two halves
 * drifting apart.
 */
export const OLDEST_SUPPORTED_VERSION = 0;

/** Ordered chain. Each entry's `to` is the version it produces. */
export const MIGRATIONS: Migration[] = [
  v1LegacyConsolidation,
  v2CoachWidgetSplit,
];

/**
 * The chain as a value, so tests can drive the runner with a synthetic one.
 * `too-old` is unreachable with the real config (garbage reads as corrupt, and
 * nothing is below 0) and would otherwise be untestable.
 */
export interface SchemaConfig {
  current: number;
  oldest: number;
  migrations: Migration[];
}

export const SCHEMA_CONFIG: SchemaConfig = {
  current: CURRENT_SCHEMA_VERSION,
  oldest: OLDEST_SUPPORTED_VERSION,
  migrations: MIGRATIONS,
};

const isPlainObject = (value: unknown): value is SettingsBlob =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A file with no version field predates versioning, so it is 0. Anything else
 * non-integer is not a version we wrote — treated as corruption rather than
 * silently read as 0, which would run the whole chain over garbage.
 */
const readSchemaVersion = (blob: SettingsBlob): number | null => {
  const raw = blob.schemaVersion;

  if (raw === undefined) {
    return 0;
  }

  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
    return null;
  }

  return raw;
};

/**
 * Brings a settings blob up to `CURRENT_SCHEMA_VERSION`.
 *
 * Every status other than `current` and `migrated` means the caller must not
 * write the file back — see the locked mode in `sync-init`.
 */
export const runMigrations = (
  loaded: unknown,
  config: SchemaConfig = SCHEMA_CONFIG
): MigrationResult => {
  if (!isPlainObject(loaded)) {
    return { status: 'corrupt' };
  }

  const from = readSchemaVersion(loaded);

  if (from === null) {
    return { status: 'corrupt' };
  }

  if (from > config.current) {
    return { status: 'from-the-future', from };
  }

  if (from < config.oldest) {
    return { status: 'too-old', from };
  }

  if (from === config.current) {
    return { status: 'current', blob: loaded };
  }

  // Cloned once up front so steps can mutate freely, and so a step that forgets
  // to copy cannot corrupt the caller's blob. Both windows parse the file
  // separately, so that divergence would only ever show up in production.
  let working = structuredClone(loaded);
  const applied: string[] = [];

  for (const step of config.migrations) {
    if (step.to <= from) continue;

    working = step.migrate(working);
    applied.push(`v${step.to} ${step.describe}`);
  }

  return {
    status: 'migrated',
    blob: { ...working, schemaVersion: config.current },
    from,
    applied,
  };
};
