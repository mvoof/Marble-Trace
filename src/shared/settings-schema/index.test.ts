import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  OLDEST_SUPPORTED_VERSION,
  runMigrations,
  type SchemaConfig,
} from './index';
import type { Migration, SettingsBlob } from './types';

const step = (to: number, migrate: Migration['migrate']): Migration => ({
  to,
  describe: `step ${to}`,
  migrate,
});

const configOf = (
  migrations: Migration[],
  oldest = 0,
  current = migrations.at(-1)?.to ?? 0
): SchemaConfig => ({ current, oldest, migrations });

describe('MIGRATIONS chain', () => {
  // The runner trusts the array's order. A step appended in the wrong place, or
  // a CURRENT_SCHEMA_VERSION bumped without a step to match, produces a chain
  // that silently stops short instead of failing.
  it('runs from 1 upwards without gaps', () => {
    MIGRATIONS.forEach((migration, index) => {
      expect(migration.to, migration.describe).toBe(index + 1);
    });
  });

  it('ends exactly at the current version', () => {
    expect(MIGRATIONS.at(-1)?.to ?? 0).toBe(CURRENT_SCHEMA_VERSION);
  });

  // Deleting a step without raising the floor leaves a version the chain claims
  // to support and cannot actually reach.
  it('can reach every version it claims to support', () => {
    expect(MIGRATIONS.length).toBe(
      CURRENT_SCHEMA_VERSION - OLDEST_SUPPORTED_VERSION
    );
  });
});

describe('runMigrations', () => {
  it('reads a missing version as 0 and runs the whole chain', () => {
    const config = configOf([
      step(1, (blob) => ({ ...blob, one: true })),
      step(2, (blob) => ({ ...blob, two: true })),
    ]);

    const result = runMigrations({ kept: 1 }, config);

    expect(result).toEqual({
      status: 'migrated',
      blob: { kept: 1, one: true, two: true, schemaVersion: 2 },
      from: 0,
      applied: ['v1 step 1', 'v2 step 2'],
    });
  });

  it('applies only the steps above the file version', () => {
    const config = configOf([
      step(1, () => {
        throw new Error('must not run');
      }),
      step(2, (blob) => ({ ...blob, two: true })),
    ]);

    const result = runMigrations({ schemaVersion: 1 }, config);

    expect(result).toMatchObject({ status: 'migrated', from: 1 });
  });

  it('passes a current file through untouched', () => {
    const blob = { schemaVersion: 1, anything: [1, 2, 3] };
    const config = configOf([step(1, () => ({ replaced: true }))]);

    const result = runMigrations(blob, config);

    expect(result).toEqual({ status: 'current', blob });
    expect(result.status === 'current' && result.blob).toBe(blob);
  });

  // The user downgraded the app. Their file is newer than anything this build
  // understands, so it must be left exactly as it is.
  it('refuses a file from a newer build', () => {
    const config = configOf([step(1, () => ({}))]);

    expect(runMigrations({ schemaVersion: 99 }, config)).toEqual({
      status: 'from-the-future',
      from: 99,
    });
  });

  it('refuses a file below the retention floor', () => {
    const config = configOf([step(2, (blob) => blob)], 1, 2);

    expect(runMigrations({ schemaVersion: 0 }, config)).toEqual({
      status: 'too-old',
      from: 0,
    });
  });

  // Anything that is not a settings object is corruption, not version 0 —
  // running the chain over it would produce a plausible-looking wreck.
  it.each([
    ['a string', 'settings'],
    ['an array', []],
    ['null', null],
    ['a fractional version', { schemaVersion: 1.5 }],
    ['a negative version', { schemaVersion: -1 }],
    ['a version as text', { schemaVersion: '1' }],
  ])('rejects %s as corrupt', (_label, loaded) => {
    expect(runMigrations(loaded, configOf([step(1, (blob) => blob)]))).toEqual({
      status: 'corrupt',
    });
  });

  // Both windows migrate their own copy of the same file. A step that mutates
  // its input would make them disagree, and only in production.
  it('never mutates the blob it was given', () => {
    const blob: SettingsBlob = { nested: { value: 1 } };
    const config = configOf([
      step(1, (working) => {
        (working.nested as { value: number }).value = 2;

        return working;
      }),
    ]);

    runMigrations(blob, config);

    expect(blob).toEqual({ nested: { value: 1 } });
  });

  it('changes nothing when run over its own output', () => {
    const config = configOf([
      step(1, (blob) => ({ ...blob, lifted: blob.legacy, legacy: undefined })),
    ]);

    const once = runMigrations({ legacy: 'value' }, config);
    const twice = runMigrations(
      once.status === 'migrated' ? once.blob : {},
      config
    );

    expect(twice.status).toBe('current');
    expect(twice.status === 'current' && twice.blob).toEqual(
      once.status === 'migrated' && once.blob
    );
  });
});
