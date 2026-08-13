/**
 * `settings.json` as it comes off disk: parsed JSON and nothing more. Migrations
 * work on this shape rather than on `Settings`, because the whole point is to
 * read fields that no longer exist in the current types.
 */
export type SettingsBlob = Record<string, unknown>;

/**
 * One step of the schema chain.
 *
 * A migration is a pure function of the blob. It must not touch stores, the
 * filesystem or the network — both windows run the chain independently on their
 * own copy, so anything with a side effect happens twice and diverges.
 *
 * It must also never import live types, defaults or registries. Whatever it
 * needs is frozen as a literal inside the migration file, or a step written
 * today starts rewriting history by next year's rules.
 */
export interface Migration {
  /** Schema version this step produces. */
  readonly to: number;
  /** One line for the log, e.g. "app-level bindings". */
  readonly describe: string;
  readonly migrate: (blob: SettingsBlob) => SettingsBlob;
}

export type MigrationResult =
  /** Already at the current version — the blob is passed through untouched. */
  | { status: 'current'; blob: SettingsBlob }
  | { status: 'migrated'; blob: SettingsBlob; from: number; applied: string[] }
  /** Written by a newer build. Never rewrite it — the user downgraded. */
  | { status: 'from-the-future'; from: number }
  /** Older than the retention window; the chain can no longer reach it. */
  | { status: 'too-old'; from: number }
  /** Present on disk but not a settings object at all. */
  | { status: 'corrupt' };

/** Every non-`ok` status locks the file against writes. */
export type SettingsLockReason = 'from-the-future' | 'too-old' | 'corrupt';
